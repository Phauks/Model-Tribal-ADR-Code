#!/usr/bin/env python3
"""The opinions in each case the website can show in full on the case's page.

Trevor asked on Nov. 27, 2026 that readers "be able to directly read the majority
and minority opinions of cases on our website". The case page shows each opinion
in a folding section of its own (design/case-opinion-reader/ in the project files,
mockup B). The text is read, when a reader opens the page, from the copy of the
opinion this site already serves at /copies/<key>, so whatever governs that copy
(a redaction, a privacy hold, a nation's choice) governs the page too. Only the
list of opinions, with their writers, pages and lengths, is kept in git:

    research/case-opinions/opinions.csv   one row per opinion: the case record, the
                                          copy, its place in the copy, its kind, its
                                          writer, its first and last page, its words

Commands:

    python3 scripts/caselaw/case_opinion_texts.py supreme-court --cache DIR --out DIR [--keys K ...]
        Builds a copy of each Supreme Court case's opinions from the Caselaw Access
        Project's HTML of the United States Reports (volumes 1 to 572), the same way
        the state court copies are built (state_court_opinions.opinion_page, with
        citation links, copy_links.py). The Library of Congress scan stays the
        official copy; this is its text, read by OCR, split into its opinions.

    python3 scripts/caselaw/case_opinion_texts.py file --out DIR [--upload]
        Adds the Supreme Court copies built in --out to research/capture-index.csv
        (topic supreme-court-opinions) and, with --upload, puts them in the bucket.
        Upload as the site deploys with the new index: the Worker serves a copy only
        when the bucket's file matches the index it was built with.

    python3 scripts/caselaw/case_opinion_texts.py index --pages DIR [DIR ...]
        Reads every served HTML opinion copy of a case record (state, federal and
        Supreme Court) from the folders given, laid out by copy key, or from the
        bucket for a copy not found there, and writes opinions.csv.
"""

from __future__ import annotations

import argparse
import csv
import datetime
import hashlib
import html as html_lib
import json
import os
import re
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(ROOT / "scripts" / "captures"))

CAPTURE_INDEX = ROOT / "research" / "capture-index.csv"
SOURCES = ROOT / "content" / "sources"
OUTPUT = ROOT / "research" / "case-opinions" / "opinions.csv"
FIELDS = ["record", "copy", "position", "kind", "author", "first_page", "last_page", "words"]
STATIC = "https://static.case.law"
SUPREME_COURT_TOPIC = "supreme-court-opinions"
# The topics of the HTML opinion copies built from the Caselaw Access Project that belong to a case record.
CASE_COPY_TOPICS = {"state-court-opinions", "federal-court-opinions", SUPREME_COURT_TOPIC}
# The last volume of the United States Reports in the Caselaw Access Project's files.
LAST_PROJECT_VOLUME = 572

OPINION = re.compile(r'<article class="opinion" data-type="([^"]*)">(.*?)</article>', re.S)
PAGE_LABEL = re.compile(r'<a [^>]*class="page-label"[^>]*>')
LABEL_VALUE = re.compile(r'data-label="([^"]+)"')
AUTHOR = re.compile(r'<p class="author"[^>]*>(.*?)</p>', re.S)
TAG = re.compile(r"<[^>]+>")

# The Caselaw Access Project's opinion types, as the kinds the site names (site/src/lib/case-opinions.ts).
PROJECT_KINDS = {
    "majority": "majority",
    "plurality": "plurality",
    "concurrence": "concurrence",
    "dissent": "dissent",
    "concurring-in-part-and-dissenting-in-part": "concurrence in part and dissent in part",
    "concurrence-in-part-and-dissent-in-part": "concurrence in part and dissent in part",
    "rehearing": "rehearing",
    "on-the-merits": "on the merits",
    "per-curiam": "per curiam",
    "unanimous": "majority",
}

# Words of a writer's line that are not the writer's name.
TITLE_WORDS = {
    "mr", "mrs", "ms", "miss", "chief", "justice", "justices", "judge", "judges", "associate", "presiding", "president",
    "senior", "district", "circuit", "acting", "special", "pro", "tem", "tempore", "commissioner", "honorable", "hon",
    "the", "of", "court", "and", "j", "jj", "cj", "c", "p", "pj", "a", "aj", "delivered", "opinion", "concurring",
    "dissenting", "specially", "in", "part", "result", "judgment", "with", "whom", "joins", "join", "concur", "concurs",
    "dissents", "dissent", "also", "for", "majority", "who", "after", "stating", "case", "above", "as", "follows",
    # "Mr." as the reports' OCR sometimes reads it, and suffixes that are not the surname.
    "me", "mb", "mk", "mii", "jr", "sr", "ii", "iii", "iv",
}


PAGE_LABEL_LINK = re.compile(r'<a [^>]*class="page-label"[^>]*>[^<]*</a>')


def plain(fragment: str) -> str:
    """The words of a piece of a copy, without its page labels ("*282")."""
    return html_lib.unescape(TAG.sub(" ", PAGE_LABEL_LINK.sub(" ", fragment)))


def word_count(fragment: str) -> int:
    return len(re.findall(r"[^\W_][\w'’.-]*", plain(fragment)))


def writer(line: str) -> str:
    """The writer's surname from the Project's line, such as "MR. JUSTICE HASWELL" or "BOYUM, Chief Justice."; "" for
    per curiam or a line that names no one."""
    text = re.sub(r"\s+", " ", plain(line)).strip()
    if not text or re.search(r"per\s+curiam", text, re.I):
        return ""
    text = re.split(r"\b(?:delivered|announced|concurring|dissenting|with whom|stated)\b", text, maxsplit=1, flags=re.I)[0]
    # "BOYUM, Chief Justice." names the writer before the comma.
    if "," in text:
        before = text.split(",")[0]
        if any(word.lower().strip(".’'") not in TITLE_WORDS for word in before.split()):
            text = before
    words = [word.strip(".,:;’'()") for word in text.split()]
    words = [word for word in words if word and word.lower().replace(".", "") not in TITLE_WORDS and not re.fullmatch(r"[A-Z]\.?", word)
             and re.fullmatch(r"[^\W\d_][\w'’-]*", word)]
    if not words or len(words) > 3:
        return ""
    return " ".join(title_case(word) for word in words)


def title_case(word: str) -> str:
    """HASWELL is Haswell, M'LEAN and McLEAN are McLean, O'NEILL is O'Neill; a name already in mixed case stays."""
    if re.fullmatch(r"Ma?c[A-Z]{2,}", word):
        return word[: word.index("c") + 1] + word[word.index("c") + 1].upper() + word[word.index("c") + 2:].lower()
    if not word.isupper():
        return word.replace("M’L", "McL").replace("M'L", "McL")
    lower = word.lower()
    for prefix in ("mc", "m'", "m’"):
        if lower.startswith(prefix) and len(lower) > len(prefix):
            return "Mc" + lower[len(prefix)].upper() + lower[len(prefix) + 1:]
    for prefix in ("o'", "o’"):
        if lower.startswith(prefix) and len(lower) > 2:
            return "O'" + lower[2].upper() + lower[3:]
    return "-".join(part[:1].upper() + part[1:] for part in lower.split("-"))


def labels_in(fragment: str) -> list[tuple[int, int]]:
    """Each page label's place and page number: "*282" starts page 282."""
    found = []
    for match in PAGE_LABEL.finditer(fragment):
        value = LABEL_VALUE.search(match.group(0))
        if value and value.group(1).isdigit():
            found.append((match.start(), int(value.group(1))))
    return found


def opinions_of(page: str, first_page: int | None) -> list[dict]:
    """The opinions in a served copy, in order: kind, writer, first and last page, words."""
    main = page.split("<main>", 1)[-1].split("</main>", 1)[0]
    labels = labels_in(main)
    found = []
    for match in OPINION.finditer(main):
        start, end = match.start(2), match.end(2)
        body = match.group(2)
        # The page the opinion starts on: a label before its first words, else the page the text before it is on.
        leading = PAGE_LABEL.match(body.lstrip()) or re.match(r'\s*<p[^>]*>\s*(<a [^>]*class="page-label"[^>]*>)', body)
        before = [number for at, number in labels if at < start]
        first = None
        if leading:
            value = LABEL_VALUE.search(leading.group(0))
            first = int(value.group(1)) if value and value.group(1).isdigit() else None
        if first is None:
            first = before[-1] if before else first_page
        inside = [number for at, number in labels if start <= at < end]
        last = max([first or 0, *inside]) or None
        kind_of_project = match.group(1)
        author_line = AUTHOR.search(body)
        author = writer(author_line.group(1)) if author_line else ""
        kind = PROJECT_KINDS.get(kind_of_project, kind_of_project.replace("-", " "))
        if author_line and re.search(r"per\s+curiam", plain(author_line.group(1)), re.I):
            kind = "per curiam"
        found.append({"kind": kind, "author": author, "first_page": first or "", "last_page": last or "", "words": word_count(body)})
    return found


# ------------------------------------------------------------------ records


def case_records() -> dict[str, dict]:
    import yaml  # noqa: PLC0415
    loader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)
    records = {}
    for path in sorted(SOURCES.rglob("*.yaml")):
        text = path.read_text(encoding="utf-8")
        if "type: legal_case" not in text:
            continue
        record = yaml.load(text, Loader=loader)
        if isinstance(record, dict) and (record.get("citation") or {}).get("type") == "legal_case":
            records[record["key"]] = record
    return records


def index_rows() -> list[dict]:
    with open(CAPTURE_INDEX, newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def is_supreme_court(record: dict) -> bool:
    return bool(record.get("supreme_court")) or (record.get("citation") or {}).get("authority") == "Supreme Court of the United States"


# ------------------------------------------------------------ supreme court


def cached(url: str, path: Path) -> bytes:
    from caselaw_sources import fetch_bytes  # noqa: PLC0415
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        for attempt in range(4):
            try:
                data = fetch_bytes(url)
                break
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(5 * (attempt + 1))
        path.write_bytes(data)
    return path.read_bytes()


def project_case(volume: int, page: str, cache: Path) -> dict | None:
    """The Caselaw Access Project's case at this page of the United States Reports."""
    metadata = json.loads(cached(f"{STATIC}/us/{volume}/CasesMetadata.json", cache / "us" / str(volume) / "CasesMetadata.json"))
    wanted = f"{volume} U.S. {page}"
    matches = [case for case in metadata if any(citation.get("cite") == wanted for citation in case.get("citations", []))]
    if len(matches) != 1:
        return None
    return matches[0]


def supreme_court(args: argparse.Namespace) -> int:
    import state_court_opinions as state_script  # noqa: PLC0415
    from copy_links import CitationLinks  # noqa: PLC0415  (scripts/caselaw/copy_links.py, PR #569)
    cache, out = Path(args.cache), Path(args.out)
    links = CitationLinks(external=True)
    built, skipped = [], []
    for key, record in sorted(case_records().items()):
        if not is_supreme_court(record) or (args.keys and key not in args.keys):
            continue
        citation = record["citation"]
        volume, page = str(citation.get("volume", "")), str(citation.get("page", ""))
        if not volume.isdigit() or not page.isdigit() or int(volume) > LAST_PROJECT_VOLUME:
            skipped.append((key, "not in the Project's volumes 1 to 572"))
            continue
        case = project_case(int(volume), page, cache)
        if not case:
            skipped.append((key, f"no single Project case at {volume} U.S. {page}"))
            continue
        name = case["file_name"]
        fragment = cached(f"{STATIC}/us/{volume}/html/{name}.html", cache / "us" / volume / "html" / f"{name}.html").decode("utf-8")
        if '<article class="opinion"' not in fragment:
            skipped.append((key, "the Project's page has no opinions"))
            continue
        copy = f"caselaw-access-project/us/{volume}/{name}.html"
        link = f"{STATIC}/us/{volume}/html/{name}.html"
        data = state_script.opinion_page(case, copy, link, fragment=fragment, links=links)
        target = out / copy
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        built.append({"record": key, "copy": copy, "link": link, "title": citation["title"], "nations": ";".join(record.get("tribes") or [])})
    (out / "supreme-court.json").write_text(json.dumps({"built": built, "skipped": skipped}, indent=1), encoding="utf-8")
    print(f"built {len(built)} Supreme Court copies; {len(skipped)} skipped", file=sys.stderr)
    for key, why in skipped:
        print(f"  {key}: {why}", file=sys.stderr)
    return 0


def file_copies(args: argparse.Namespace) -> int:
    import mirror_captures  # noqa: PLC0415
    out = Path(args.out)
    built = json.loads((out / "supreme-court.json").read_text(encoding="utf-8"))["built"]
    rows = mirror_captures.load_index()
    by_key = {row["key"]: row for row in rows}
    s3 = bucket = None
    if args.upload:
        if not mirror_captures.have_credentials():
            sys.exit("Uploading needs R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID in the environment.")
        s3 = mirror_captures.client()
        bucket = os.environ.get("R2_BUCKET", mirror_captures.DEFAULT_BUCKET)
    today = datetime.date.today().isoformat()
    changed = 0
    for item in built:
        data = (out / item["copy"]).read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        existing = by_key.get(item["copy"])
        if s3 is not None and mirror_captures.remote_state(s3, bucket, item["copy"]) != (len(data), digest):
            with tempfile.NamedTemporaryFile(suffix=".html") as handle:
                handle.write(data)
                handle.flush()
                s3.upload_file(handle.name, bucket, item["copy"], ExtraArgs={"ContentType": "text/html; charset=utf-8", "Metadata": {"sha256": digest, "captured": today}})
            if mirror_captures.remote_state(s3, bucket, item["copy"]) != (len(data), digest):
                sys.exit(f"verification failed for {item['copy']}")
        if existing and existing["sha256"] == digest:
            continue
        new = {field: "" for field in mirror_captures.FIELDS}
        new.update(key=item["copy"], bytes=len(data), sha256=digest, media_type="text/html", topic=SUPREME_COURT_TOPIC,
                   title=item["title"], nations=item["nations"], obtained=f"built from the Caselaw Access Project's files, {today}",
                   link=item["link"], captured=today, records=item["record"], record_kinds="source",
                   rights=mirror_captures.TOPIC_RIGHTS[SUPREME_COURT_TOPIC], redistribution="yes", keep_local="no", orphan="no")
        if existing:
            existing.update(new)
        else:
            rows.append(new)
            by_key[item["copy"]] = new
        changed += 1
    if changed:
        mirror_captures.write_index(rows)
    print(f"{changed} index rows added or changed{'; uploaded' if s3 is not None else ''}", file=sys.stderr)
    return 0


# -------------------------------------------------------------------- index


def read_copy(key: str, folders: list[Path], remote) -> str | None:
    for folder in folders:
        path = folder / key
        if path.exists():
            return path.read_text(encoding="utf-8")
    return remote(key) if remote else None


def index(args: argparse.Namespace) -> int:
    folders = [Path(folder) for folder in args.pages]
    remote = None
    if args.bucket:
        import mirror_captures  # noqa: PLC0415
        s3 = mirror_captures.client()
        bucket = os.environ.get("R2_BUCKET", mirror_captures.DEFAULT_BUCKET)

        def remote(key: str) -> str | None:
            try:
                return s3.get_object(Bucket=bucket, Key=key)["Body"].read().decode("utf-8")
            except Exception:
                return None

    records = case_records()
    found, missing = [], []
    for row in index_rows():
        if row["topic"] not in CASE_COPY_TOPICS or row["media_type"] != "text/html" or row["redistribution"] != "yes":
            continue
        for key in filter(None, (part.strip() for part in row["records"].split(";"))):
            record = records.get(key)
            if not record:
                continue
            page = read_copy(row["key"], folders, remote)
            if page is None:
                missing.append(row["key"])
                continue
            first = str((record.get("citation") or {}).get("page", ""))
            opinions = opinions_of(page, int(first) if first.isdigit() else None)
            if is_supreme_court(record):
                justices = (record.get("supreme_court") or {}).get("justices") or []
                opinions = with_record_writers(opinions, (record.get("opinions") or {}).get("list") or [], [justice["name"] for justice in justices])
                # An opinion of the Court the OCR line does not name: the Justice the record's bench says wrote it, if only one did.
                writers = [justice["name"] for justice in justices if justice.get("opinion") in ("majority", "plurality", "judgment")]
                for opinion in opinions:
                    if opinion["kind"] in ("majority", "plurality", "judgment") and not opinion["author"] and len(writers) == 1:
                        opinion["author"] = surname_of(writers[0])
            for position, opinion in enumerate(opinions):
                found.append({"record": key, "copy": row["key"], "position": position, **opinion})
    found.sort(key=lambda row: (row["record"], row["position"]))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", newline="", encoding="utf-8") as handle:
        writer_ = csv.DictWriter(handle, FIELDS, lineterminator="\n")
        writer_.writeheader()
        writer_.writerows(found)
    cases = len({row["record"] for row in found})
    print(f"{len(found)} opinions in {cases} cases written to {OUTPUT.relative_to(ROOT)}; {len(missing)} copies not found", file=sys.stderr)
    for key in missing[:20]:
        print(f"  not found: {key}", file=sys.stderr)
    return 0


def bench_name(read: str, bench: list[str]) -> str:
    """The Justice on the case's bench whose surname the OCR line comes closest to ("Me Van Devantee" is Van Devanter);
    "" when none is close, rather than a misread name."""
    import difflib  # noqa: PLC0415
    if not read or not bench:
        return read if not bench else ""
    surnames = {surname_of(name): name for name in bench}
    best = difflib.get_close_matches(read, list(surnames), n=1, cutoff=0.7) or difflib.get_close_matches(read.split()[-1], list(surnames), n=1, cutoff=0.7)
    return best[0] if best else ""


def surname_of(name: str) -> str:
    """"Willis Van Devanter" is "Van Devanter"; "John Marshall Harlan" is "Harlan"."""
    words = re.sub(r",?\s+(?:Jr\.|Sr\.|II|III)$", "", name).split()
    if len(words) >= 3 and words[-2].lower() in ("van", "de", "la", "le"):
        return " ".join(words[-2:])
    return words[-1] if words else name


def with_record_writers(opinions: list[dict], listed: list[dict], bench: list[str] | None = None) -> list[dict]:
    """A Supreme Court case's record names each writer from the official report (its opinions block); where the
    Project's opinions start on the same pages, the record's kinds and Justices are used instead of the OCR line."""
    bench = bench or []
    by_page = {}
    for entry in listed:
        by_page.setdefault(int(entry["page"]), []).append(entry)
    for opinion in opinions:
        entries = by_page.get(int(opinion["first_page"])) if str(opinion["first_page"]).isdigit() else None
        if not entries:
            opinion["author"] = bench_name(opinion["author"], bench)
            continue
        entry = entries.pop(0)
        opinion["kind"] = entry["kind"]
        opinion["author"] = "" if entry["kind"] == "per curiam" else surname_of(entry["justice"]) if entry["justice"] else opinion["author"]
    return opinions


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    court = commands.add_parser("supreme-court")
    court.add_argument("--cache", required=True)
    court.add_argument("--out", required=True)
    court.add_argument("--keys", nargs="*")
    filing = commands.add_parser("file")
    filing.add_argument("--out", required=True)
    filing.add_argument("--upload", action="store_true")
    listing = commands.add_parser("index")
    listing.add_argument("--pages", nargs="*", default=[])
    listing.add_argument("--bucket", action="store_true", help="read a copy not found in --pages from the bucket")
    args = parser.parse_args()
    return {"supreme-court": supreme_court, "file": file_copies, "index": index}[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
