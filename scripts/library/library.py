#!/usr/bin/env python3
"""Search the source library: the text of every document in the private
bucket, page by page (built by build_library.py, decision record 0051).

Made for Claude first. Each result names the document, the page to cite (the
PDF page and, when known, the printed page or reporter star page), the
records that cite the document and, when the website serves a copy, its
/copies/ address. Text found here is a lead to read in context, not a
quotation to paste: open the page with `read` and check it before relying on
it, and cite the published source, not the library.

The library is downloaded from the bucket on first use to ~/.cache/
model-tribal-library/ (or the path in SOURCE_LIBRARY). It needs
R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID, and boto3
(pip install boto3), only for the download.

Commands:
  search QUERY       Passages matching QUERY, best first, a few per document.
                     QUERY is SQLite FTS5 syntax: words (all must match),
                     "exact phrase", OR, NOT, prefix*, NEAR(a b, 10),
                     title: or other columns are not needed. Words are
                     stemmed (mediate matches mediation). Punctuated terms
                     like "25 U.S.C. 1302" are quoted for you if the query
                     does not parse.
                     --nation ID --topic NAME --format pdf|html --served
                     --record KEY --limit N --per-document N --json
  titles QUERY       Documents whose title, citation, nations or key match.
  read DOCUMENT      Print a document's text. DOCUMENT is a key, a document
                     number, or "passage:N" from a search result.
                     --page N (PDF page) --label X (printed or star page)
                     --around N (also N passages either side) --find WORDS
  document DOCUMENT  The document's details: title, nations, rights, pages,
                     how its text was read, records citing it, other copies.
  nation ID          The nation's documents, by topic.
  record KEY         The documents a source record (or profile) cites.
  original DOCUMENT  Download the original file (to look at a PDF's pages).
  stats              What the library holds and how much text it has.
  sql QUERY          A read-only SQL query on the library.
  fetch              Download the latest library now (--force to re-download).

Examples:
  python3 scripts/library/library.py search 'peacemaker NEAR(elder, 15)' --topic constitutions
  python3 scripts/library/library.py search '"exhaustion of tribal remedies"' --format html
  python3 scripts/library/library.py read passage:123456 --around 1
  python3 scripts/library/library.py read caselaw-access-project/navajo-rptr/1/0001-01.html --label 2
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import re
import shutil
import sqlite3
import sys
import textwrap
import urllib.parse
from pathlib import Path

DEFAULT_BUCKET = "model-tribal-adr-code-sources"
LIBRARY_OBJECT = "_library/library.sqlite.gz"
MANIFEST_OBJECT = "_library/manifest.json"
SITE = "https://triballawproject.org"


# ---------------------------------------------------------------- getting the library


def cache_folder() -> Path:
    return Path(os.environ.get("SOURCE_LIBRARY_CACHE", "~/.cache/model-tribal-library")).expanduser()


def library_file() -> Path:
    configured = os.environ.get("SOURCE_LIBRARY")
    return Path(configured).expanduser() if configured else cache_folder() / "library.sqlite"


def bucket_client():
    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        sys.exit("Install boto3 first: pip install boto3")
    account = os.environ.get("R2_ACCOUNT_ID") or os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    key_id, secret = os.environ.get("R2_ACCESS_KEY_ID"), os.environ.get("R2_SECRET_ACCESS_KEY")
    if not (account and key_id and secret):
        sys.exit("Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID to download the library.")
    return boto3.client("s3", endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
                        aws_access_key_id=key_id, aws_secret_access_key=secret, region_name="auto",
                        config=Config(retries={"max_attempts": 8}))


def bucket_name() -> str:
    return os.environ.get("R2_BUCKET", DEFAULT_BUCKET)


def fetch(force: bool = False) -> Path:
    target = library_file()
    client = bucket_client()
    manifest = json.loads(client.get_object(Bucket=bucket_name(), Key=MANIFEST_OBJECT)["Body"].read())
    stamp = target.with_suffix(".manifest.json")
    if target.exists() and stamp.exists() and not force:
        current = json.loads(stamp.read_text(encoding="utf-8"))
        if current.get("sha256") == manifest.get("sha256"):
            print(f"The library is up to date (built {manifest.get('built')}).", file=sys.stderr)
            return target
    target.parent.mkdir(parents=True, exist_ok=True)
    compressed = target.with_suffix(".sqlite.gz.part")
    print(f"Downloading the library ({manifest['compressed_bytes'] / 1e9:.1f} GB, built {manifest.get('built')})...",
          file=sys.stderr, flush=True)
    client.download_file(bucket_name(), LIBRARY_OBJECT, str(compressed))
    partial = target.with_suffix(".sqlite.part")
    with gzip.open(compressed, "rb") as source, partial.open("wb") as destination:
        shutil.copyfileobj(source, destination, 1 << 22)
    compressed.unlink()
    partial.replace(target)
    stamp.write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    print(f"Saved to {target}.", file=sys.stderr)
    return target


def connect() -> sqlite3.Connection:
    path = library_file()
    if not path.exists():
        fetch()
    connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


# ---------------------------------------------------------------- helpers


def copy_address(row) -> str | None:
    if not row["served"]:
        return None
    return f"{SITE}/copies/" + "/".join(urllib.parse.quote(part) for part in row["key"].split("/"))


def page_name(row) -> str:
    parts = []
    if row["page"] is not None:
        parts.append(f"p. {row['page']}")
    if row["label"] and str(row["label"]) != str(row["page"]):
        parts.append(f"star page *{row['label']}" if row["page"] is None else f"printed {row['label']}")
    if row["part"] and row["part"] > 1:
        parts.append(f"part {row['part']}")
    return ", ".join(parts) or "pageless text"


def quote_terms(query: str) -> str:
    """Turn free text into an FTS5 query of quoted words, all required."""
    words = re.findall(r"[\w§.'’-]+", query)
    return " ".join('"' + word.replace('"', '""') + '"' for word in words if word.strip(".-'’"))


def find_document(connection, reference: str):
    reference = reference.strip()
    if reference.startswith("passage:"):
        row = connection.execute(
            "SELECT d.* FROM documents d JOIN pages p USING (document_id) WHERE p.passage_id = ?",
            (int(reference.split(":", 1)[1]),)).fetchone()
    elif reference.isdigit():
        row = connection.execute("SELECT * FROM documents WHERE document_id = ?", (int(reference),)).fetchone()
    else:
        row = connection.execute("SELECT * FROM documents WHERE key = ?", (reference,)).fetchone()
        if row is None:
            row = connection.execute(
                "SELECT * FROM documents WHERE other_keys LIKE ? ESCAPE '\\'",
                ('%"' + reference.replace("%", "\\%").replace("_", "\\_") + '"%',)).fetchone()
    if row is None:
        sys.exit(f"No document {reference!r} in the library. Try: library.py titles WORDS")
    return row


def filters(arguments, alias: str = "d") -> tuple[str, list]:
    clauses, values = [], []
    if getattr(arguments, "nation", None):
        clauses.append(f"{alias}.document_id IN (SELECT document_id FROM document_nations WHERE nation = ?)")
        values.append(arguments.nation)
    if getattr(arguments, "record", None):
        clauses.append(f"{alias}.document_id IN (SELECT document_id FROM citing_records WHERE record = ?)")
        values.append(arguments.record)
    if getattr(arguments, "topic", None):
        clauses.append(f"{alias}.topic = ?")
        values.append(arguments.topic)
    if getattr(arguments, "format", None):
        clauses.append(f"{alias}.format = ?")
        values.append(arguments.format)
    if getattr(arguments, "served", False):
        clauses.append(f"{alias}.served = 1")
    return ("AND " + " AND ".join(clauses)) if clauses else "", values


def describe_heading(row) -> str:
    title = row["title"] or row["key"]
    if row["citation"]:
        title = f"{title}, {row['citation']}"
        if row["court"] or row["decided"]:
            title += f" ({', '.join(part for part in (row['court'], (row['decided'] or '')[:4]) if part)})"
    return title


# ---------------------------------------------------------------- commands


def command_search(arguments) -> None:
    connection = connect()
    where, values = filters(arguments)
    sql = f"""
      WITH hits AS (
        SELECT p.passage_id, p.document_id, p.page, p.label, p.part,
               snippet(pages_search, 0, '[', ']', ' … ', {arguments.words}) AS excerpt,
               bm25(pages_search) AS score
        FROM pages_search JOIN pages p ON p.passage_id = pages_search.rowid
        JOIN documents d ON d.document_id = p.document_id
        WHERE pages_search MATCH ? {where}
        ORDER BY score LIMIT {max(arguments.limit * 40, 400)}
      ), ranked AS (
        SELECT hits.*, ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY score) AS place,
               MIN(score) OVER (PARTITION BY document_id) AS best
        FROM hits
      )
      SELECT ranked.*, d.key, d.title, d.citation, d.court, d.decided, d.topic, d.nations, d.records,
             d.served, d.format, d.text_status
      FROM ranked JOIN documents d USING (document_id)
      WHERE place <= ? ORDER BY best, document_id, place LIMIT ?"""
    query = arguments.query
    try:
        rows = connection.execute(sql, [query, *values, arguments.per_document,
                                        arguments.limit * arguments.per_document]).fetchall()
    except sqlite3.OperationalError as error:
        if "fts5" not in str(error) and "syntax" not in str(error) and "no such column" not in str(error):
            raise
        query = quote_terms(arguments.query)
        print(f"(Query read as plain words: {query})", file=sys.stderr)
        rows = connection.execute(sql, [query, *values, arguments.per_document,
                                        arguments.limit * arguments.per_document]).fetchall()
    documents: dict[int, dict] = {}
    for row in rows:
        entry = documents.setdefault(row["document_id"], {
            "document": row["document_id"], "key": row["key"], "title": describe_heading(row),
            "topic": row["topic"], "nations": [n for n in (row["nations"] or "").split(";") if n],
            "cited_by": [r for r in (row["records"] or "").split(";") if r],
            "copy": copy_address(row), "text": row["text_status"], "passages": []})
        entry["passages"].append({"passage": row["passage_id"], "where": page_name(row),
                                  "page": row["page"], "label": row["label"],
                                  "excerpt": " ".join(row["excerpt"].split())})
    results = list(documents.values())[: arguments.limit]
    if arguments.json:
        print(json.dumps(results, indent=1, ensure_ascii=False))
        return
    if not results:
        print("No passages match. Try fewer words, OR between synonyms, prefix* forms, or drop a filter.")
        return
    for number, entry in enumerate(results, 1):
        print(f"[{number}] {entry['title']}")
        details = [entry["key"], f"document {entry['document']}", entry["topic"]]
        if entry["nations"]:
            details.append("nations: " + ", ".join(entry["nations"][:4]) + (" …" if len(entry["nations"]) > 4 else ""))
        if entry["text"] != "full":
            details.append(f"text: {entry['text']}")
        print("    " + " · ".join(details))
        if entry["cited_by"]:
            print("    cited by: " + ", ".join(entry["cited_by"][:6]) + (" …" if len(entry["cited_by"]) > 6 else ""))
        if entry["copy"]:
            print(f"    site copy: {entry['copy']}")
        for passage in entry["passages"]:
            print(f"    - {passage['where']} (passage:{passage['passage']})")
            print(textwrap.indent(textwrap.fill(passage["excerpt"], 100), "        "))
        print()


def command_titles(arguments) -> None:
    connection = connect()
    where, values = filters(arguments)
    sql = f"""SELECT d.* FROM documents_search JOIN documents d ON d.document_id = documents_search.rowid
              WHERE documents_search MATCH ? {where} ORDER BY bm25(documents_search) LIMIT ?"""
    try:
        rows = connection.execute(sql, [arguments.query, *values, arguments.limit]).fetchall()
    except sqlite3.OperationalError:
        rows = connection.execute(sql, [quote_terms(arguments.query), *values, arguments.limit]).fetchall()
    for row in rows:
        print(f"{row['document_id']:>6}  {describe_heading(row)}")
        print(f"        {row['key']} · {row['topic']} · {row['page_count']} pages · text {row['text_status']}")


def command_read(arguments) -> None:
    connection = connect()
    document = find_document(connection, arguments.document)
    print(f"{describe_heading(document)}\n{document['key']} (document {document['document_id']})")
    if document["served"]:
        print(f"site copy: {copy_address(document)}")
    print()
    rows = connection.execute("SELECT * FROM pages WHERE document_id = ? ORDER BY sequence",
                              (document["document_id"],)).fetchall()
    chosen = list(range(len(rows)))
    if arguments.document.startswith("passage:"):
        target = int(arguments.document.split(":", 1)[1])
        chosen = [index for index, row in enumerate(rows) if row["passage_id"] == target]
    elif arguments.page is not None:
        chosen = [index for index, row in enumerate(rows) if row["page"] == arguments.page]
    elif arguments.label is not None:
        chosen = [index for index, row in enumerate(rows) if str(row["label"]) == arguments.label]
    elif arguments.find:
        words = [word.lower() for word in arguments.find.split()]
        chosen = [index for index, row in enumerate(rows) if all(word in row["text"].lower() for word in words)]
    if not chosen:
        sys.exit("Nothing on that page or passage. `library.py document` lists the pages.")
    around = arguments.around
    indexes = sorted({index + offset for index in chosen for offset in range(-around, around + 1)
                      if 0 <= index + offset < len(rows)})
    if len(indexes) > arguments.max_passages:
        print(f"(Showing {arguments.max_passages} of {len(indexes)} passages; use --page, --find or --max-passages.)\n")
        indexes = indexes[: arguments.max_passages]
    for index in indexes:
        row = rows[index]
        print(f"--- {page_name(row)} · passage:{row['passage_id']} · {row['method']} ---")
        print(row["text"])
        print()


def command_document(arguments) -> None:
    connection = connect()
    row = find_document(connection, arguments.document)
    print(describe_heading(row))
    for field in ("key", "document_id", "topic", "format", "media_type", "link", "captured", "obtained",
                  "nations", "records", "record_kinds", "rights", "redistribution"):
        if row[field] not in (None, ""):
            print(f"  {field}: {row[field]}")
    print(f"  pages: {row['page_count']} · characters: {row['characters']} · text: {row['text_status']}"
          f" · read by OCR: {row['ocr_pages']} pages · pages with no text: {row['empty_pages']}")
    if row["served"]:
        print(f"  site copy: {copy_address(row)}")
    if row["other_keys"]:
        print(f"  same file also at: {', '.join(json.loads(row['other_keys']))}")
    labels = connection.execute(
        "SELECT page, label FROM pages WHERE document_id = ? AND part = 1 ORDER BY sequence LIMIT 400",
        (row["document_id"],)).fetchall()
    printed = [f"{item['page']}={item['label']}" for item in labels if item["label"] and item["page"] is not None]
    if printed:
        print("  printed page labels (PDF page=label): " + ", ".join(printed[:60]) + (" …" if len(printed) > 60 else ""))


def command_nation(arguments) -> None:
    connection = connect()
    rows = connection.execute(
        """SELECT d.* FROM documents d JOIN document_nations n USING (document_id)
           WHERE n.nation = ? ORDER BY d.topic, d.title""", (arguments.nation,)).fetchall()
    if not rows:
        sys.exit(f"No documents list the nation {arguments.nation!r}. Nation ids are profile ids, such as navajo-nation.")
    topic = None
    for row in rows:
        if row["topic"] != topic:
            topic = row["topic"]
            print(f"\n{topic}")
        print(f"  {row['document_id']:>6}  {describe_heading(row)[:110]}  [{row['key']}] text {row['text_status']}")


def command_record(arguments) -> None:
    connection = connect()
    rows = connection.execute(
        """SELECT d.* FROM documents d JOIN citing_records c USING (document_id) WHERE c.record = ?
           ORDER BY d.key""", (arguments.record,)).fetchall()
    if not rows:
        sys.exit(f"No document in the library is cited by {arguments.record!r}.")
    for row in rows:
        print(f"{row['document_id']:>6}  {describe_heading(row)}\n        {row['key']} · {row['page_count']} pages · text {row['text_status']}")


def command_original(arguments) -> None:
    connection = connect()
    row = find_document(connection, arguments.document)
    output = Path(arguments.out).expanduser() / row["key"]
    output.parent.mkdir(parents=True, exist_ok=True)
    bucket_client().download_file(bucket_name(), row["key"], str(output))
    print(output)


def command_stats(arguments) -> None:
    connection = connect()
    meta = dict(connection.execute("SELECT name, value FROM meta").fetchall())
    print(f"Built {meta.get('built')}: {meta.get('documents')} documents, {meta.get('passages')} passages "
          f"({meta.get('not_yet_read')} files not yet read).\n")
    print(f"{'topic':<28}{'documents':>10}{'full':>8}{'partial':>9}{'none':>7}{'OCR pages':>11}{'site':>7}")
    for row in connection.execute(
            """SELECT topic, COUNT(*) AS documents, SUM(text_status = 'full') AS full,
                      SUM(text_status = 'partial') AS partial, SUM(text_status = 'none') AS none,
                      SUM(ocr_pages) AS ocr, SUM(served) AS served
               FROM documents GROUP BY topic ORDER BY documents DESC"""):
        print(f"{row['topic']:<28}{row['documents']:>10}{row['full']:>8}{row['partial']:>9}{row['none']:>7}"
              f"{row['ocr']:>11}{row['served']:>7}")


def command_sql(arguments) -> None:
    connection = connect()
    cursor = connection.execute(arguments.query)
    names = [column[0] for column in cursor.description or []]
    print("\t".join(names))
    for row in cursor.fetchmany(arguments.limit):
        print("\t".join("" if value is None else str(value) for value in row))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)

    def add_filters(command):
        command.add_argument("--nation", help="a nation's profile id, such as navajo-nation")
        command.add_argument("--topic", help="the bucket folder, such as constitutions, tribal-law, gaming, "
                                             "caselaw-access-project, govinfo, cited-pages, westlaw, articles")
        command.add_argument("--format", choices=["pdf", "html", "plain", "word"])
        command.add_argument("--record", help="only documents this source record or profile cites")
        command.add_argument("--served", action="store_true", help="only documents the website serves")

    search = commands.add_parser("search")
    search.add_argument("query")
    add_filters(search)
    search.add_argument("--limit", type=int, default=10, help="documents to show")
    search.add_argument("--per-document", type=int, default=3, help="passages per document")
    search.add_argument("--words", type=int, default=40, help="words per excerpt (at most 64)")
    search.add_argument("--json", action="store_true")
    titles = commands.add_parser("titles")
    titles.add_argument("query")
    add_filters(titles)
    titles.add_argument("--limit", type=int, default=25)
    read = commands.add_parser("read")
    read.add_argument("document")
    read.add_argument("--page", type=int)
    read.add_argument("--label")
    read.add_argument("--find")
    read.add_argument("--around", type=int, default=0)
    read.add_argument("--max-passages", type=int, default=20)
    for name in ("document", "original"):
        command = commands.add_parser(name)
        command.add_argument("document")
        if name == "original":
            command.add_argument("--out", default=str(cache_folder() / "originals"))
    nation = commands.add_parser("nation")
    nation.add_argument("nation")
    record = commands.add_parser("record")
    record.add_argument("record")
    commands.add_parser("stats")
    sql = commands.add_parser("sql")
    sql.add_argument("query")
    sql.add_argument("--limit", type=int, default=200)
    fetch_command = commands.add_parser("fetch")
    fetch_command.add_argument("--force", action="store_true")
    arguments = parser.parse_args()
    if arguments.command == "fetch":
        fetch(arguments.force)
        return
    if arguments.command == "search":
        arguments.words = max(1, min(arguments.words, 64))
    {"search": command_search, "titles": command_titles, "read": command_read, "document": command_document,
     "nation": command_nation, "record": command_record, "original": command_original,
     "stats": command_stats, "sql": command_sql}[arguments.command](arguments)


if __name__ == "__main__":
    main()
