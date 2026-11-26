#!/usr/bin/env python3
"""Source records and stored copies for the federal acknowledgment petitions
(25 C.F.R. part 83; data tier 2; Trevor, Nov. 26, 2026: "Start with tier 2.
Work to completion").

The Bureau of Indian Affairs' Office of Federal Acknowledgment lists each
resolved petition (https://www.bia.gov/as-ia/ofa/resolved) and each petition
in process (https://www.bia.gov/as-ia/ofa/petitions-in-process). Each
petition's page gives its number, state and decision or status, the
Department's documents (proposed findings, final determinations,
reconsidered determinations, technical assistance letters and the like),
the petitioner's own documents (letters of intent, responses), and links to
the Federal Register notices and the Interior Board of Indian Appeals
decisions about it.

The Department's documents are works of the United States government, so
the project keeps each PDF in the bucket under
acknowledgment/<petition>/<file> and serves it, with a record of its own.
A petitioner's own documents are not government works: they are stored
privately (not served) and get no record.

The title and year come from the petition's page. The nation is matched by
name (scripts/law/nation_names.py) for petitioners that were acknowledged.

Steps:
  fetch    Read both lists and every petition's page, and download each PDF.
           Writes --work/petitions.json.
  file     Store each PDF in the bucket and add it to the capture index.
  records  Write content/sources/a/acknowledgment-<number>-<document>.yaml
           for each of the Department's documents.

Usage:
  python3 scripts/law/acknowledgment_petitions.py fetch --work DIR
  python3 scripts/law/acknowledgment_petitions.py file --work DIR
  python3 scripts/law/acknowledgment_petitions.py records --work DIR
"""
from __future__ import annotations

import argparse
import concurrent.futures
import csv
import datetime as dt
import hashlib
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
CAPTURE_INDEX = ROOT / "research/capture-index.csv"
SOURCES = ROOT / "content/sources"
SESSION = "2026-11-26-acknowledgment-petitions"
SCRIPT = "scripts/law/acknowledgment_petitions.py"
SITE = "https://www.bia.gov"
LISTS = {"resolved": f"{SITE}/as-ia/ofa/resolved", "in-process": f"{SITE}/as-ia/ofa/petitions-in-process"}
OFFICE = "U.S. Department of the Interior, Office of Federal Acknowledgment"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) research script"}
# Acknowledged petitioners the list names by an older name than any the nation's profile gives (each checked by hand against the profile).
PETITIONER_NATIONS = {"013": "poarch-band-of-creek-indians", "014": "samish-indian-nation", "015": "mashpee-wampanoag-tribe",
                      "019": "jamestown-sklallam-tribe", "020": "snoqualmie-indian-tribe", "051": "timbisha-shoshone-tribe",
                      "076": "wampanoag-tribe-of-gay-head"}
RIGHTS = {"status": "no-permission-needed", "basis": "us-government-work",
          "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105).",
          "redistribution": True}


def dump(value) -> str:
    return yaml.safe_dump(value, sort_keys=False, allow_unicode=True, width=10_000)


def get(url: str) -> tuple[bytes, str, str]:
    url = urllib.parse.quote(url, safe=":/?&=%#+,;@~")
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as response:
                return response.read(), response.geturl(), response.headers.get_content_type()
        except Exception:  # noqa: BLE001 - retried, then raised
            if attempt == 3:
                raise
            time.sleep(4 * (attempt + 1))


def text_of(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def slug(text: str) -> str:
    text = text.replace("’", "").replace("'", "").replace("&", " and ")
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-")


def petition_page(page: str) -> dict:
    """The documents of one petition's page, by the heading they sit under."""
    main = page[page.find("<main"):page.find("</main>")]
    out = {"documents": [], "additional": []}
    for field in ("petitioner-number", "state", "decision", "current-status", "status"):
        match = re.search(rf'id="{field}">[^<]*</div>.*?<div class="font-sans-md text-bold">\s*(.*?)\s*</div>', main, re.S)
        if match:
            out[field.replace("-", "_")] = text_of(match.group(1))
    sections = re.split(r'<h[23] id="([a-z0-9-]+)"', main)
    for heading, body in zip(sections[1::2], sections[2::2]):
        for link, label in re.findall(r'<a href="([^"]+)"[^>]*>(.*?)</a>', body, re.S):
            entry = {"label": text_of(label), "link": urllib.parse.urljoin(SITE, html.unescape(link))}
            if heading == "additional-information":
                out["additional"].append(entry)
            elif link.lower().endswith(".pdf") or "media_document" in link:
                entry["by"] = "department" if heading == "office-of-federal-acknowledgment" else "petitioner" if heading == "petitioner" else heading
                out["documents"].append(entry)
    return out


def fetch(args) -> None:
    work = Path(args.work)
    (work / "pages").mkdir(parents=True, exist_ok=True)
    petitions = []
    for status, url in LISTS.items():
        page = get(url)[0].decode("utf-8", "replace")
        (work / "pages" / f"list-{status}.html").write_text(page, encoding="utf-8")
        for row in re.findall(r"(?s)<tr[^>]*>(.*?)</tr>", page):
            cells = [text_of(cell) for cell in re.findall(r"(?s)<td[^>]*>(.*?)</td>", row)]
            links = re.findall(r'href="(/as-ia/ofa/[^"?]+)"', row)
            if len(cells) >= 4 and links:
                petitions.append({"number": cells[0], "name": cells[1], "state": cells[2], "outcome": cells[3], "list": status,
                                  "page": urllib.parse.urljoin(SITE, links[0])})

    def read(petition: dict) -> None:
        page = get(petition["page"])[0].decode("utf-8", "replace")
        (work / "pages" / f"{petition['number']}.html").write_text(page, encoding="utf-8")
        petition.update(petition_page(page))
        folder = work / "files" / petition["number"]
        folder.mkdir(parents=True, exist_ok=True)
        for document in petition["documents"]:
            try:
                data, final, media = get(document["link"])
            except Exception as problem:  # noqa: BLE001 - reported in the entry
                document["problem"] = str(problem)
                continue
            if not data.startswith(b"%PDF") and media != "application/pdf":
                document["problem"] = f"not a PDF ({media})"
                continue
            name = re.sub(r"[^A-Za-z0-9._-]+", "-", urllib.parse.unquote(final.rsplit("/", 1)[-1]).split("?")[0])
            if not name.lower().endswith(".pdf"):
                name += ".pdf"
            document.update(final=final, file=name, sha256=hashlib.sha256(data).hexdigest(), bytes=len(data))
            (folder / name).write_bytes(data)

    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        list(pool.map(read, petitions))
    (work / "petitions.json").write_text(json.dumps(petitions, indent=1, ensure_ascii=False), encoding="utf-8")
    documents = [document for petition in petitions for document in petition["documents"]]
    for petition in petitions:
        for document in petition["documents"]:
            if document.get("problem"):
                print("FAILED", petition["number"], document["label"], document["problem"], file=sys.stderr)
    print(f"{len(petitions)} petitions; {sum(1 for d in documents if d.get('file'))} of {len(documents)} documents downloaded, "
          f"{sum(d.get('bytes', 0) for d in documents) / 1e9:.2f} GB")


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    petitions = json.loads((work / "petitions.json").read_text(encoding="utf-8"))
    rows = mirror_captures.load_index()
    filed = {row["key"] for row in rows}
    by_digest = {row["sha256"]: row["key"] for row in rows}
    s3 = mirror_captures.client()
    bucket = mirror_captures.bucket_name()
    work_items = []
    for petition in petitions:
        for document in petition["documents"]:
            key = f"acknowledgment/{petition['number']}/{document.get('file', '')}"
            if document.get("file") and key not in filed and document["sha256"] not in by_digest:
                work_items.append((petition, document, key))
                by_digest[document["sha256"]] = key

    def put(item):
        petition, document, key = item
        path = work / "files" / petition["number"] / document["file"]
        if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, document["sha256"]):
            s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": "application/pdf", "Metadata": {
                "sha256": document["sha256"], "captured": dt.date.today().isoformat()}})
            if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, document["sha256"]):
                return None
        return item

    added = 0
    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        for result in pool.map(put, work_items):
            if not result:
                print("verification failed", file=sys.stderr)
                continue
            petition, document, key = result
            public = document["by"] == "department"
            rows.append(mirror_captures.index_row(
                key=key, size=document["bytes"], digest=document["sha256"], media="application/pdf", topic="acknowledgment",
                title=f"{document['label']}: {petition['name']} (petitioner {petition['number']})", nations="",
                obtained="downloaded from the Office of Federal Acknowledgment's petition pages (bia.gov) by script",
                links=[document["final"], petition["page"]], record=record_key(petition, document) if public else "",
                redistribution="yes" if public else "no",
                rights="United States government work (17 U.S.C. § 105)." if public else
                "The petitioner's own document, not a government work: kept privately, not served.", existing_keys=filed))
            filed.add(key)
            added += 1
    mirror_captures.write_index(rows)
    print(f"filed {added}")


def record_key(petition: dict, document: dict) -> str:
    """acknowledgment-016-cowlitz-indian-tribe-final-determination-2000."""
    name = slug(petition["name"])
    if len(name) > 48:
        name = name[:48].rsplit("-", 1)[0]
    return f"acknowledgment-{petition['number'].lower()}-{name}-{slug(document['label'])[:60].strip('-')}"


def year_of(label: str) -> int | None:
    years = re.findall(r"\b(1[89]\d\d|20\d\d)\b", label)
    return int(years[-1]) if years else None


def record_for(petition: dict, document: dict, copy: dict | None, nations: list[str]) -> dict:
    # The label's own parenthesis ("(2000)", "(45 FR 19321 (1980))") goes in the date and the notes, not the title.
    kind = re.sub(r"\s*\((?:[^()]|\([^()]*\))*\)\s*$", "", document["label"]).strip()
    title = f"{kind or document['label']}: {petition['name']} (Petitioner #{petition['number']})"
    year = year_of(document["label"])
    citation = {"type": "report", "title": title, "author": [{"literal": OFFICE}], "genre": kind or "Acknowledgment document",
                "number": f"Petitioner #{petition['number']}", "URL": document["final"], "accessed": {"date-parts": [[2026, 11, 26]]}}
    if year:
        citation["issued"] = {"date-parts": [[year]]}
    outcome = (f"{'decision' if petition['list'] == 'resolved' else 'status'}: {petition['outcome']}" if petition["outcome"]
               else "listed as resolved, with no decision given")
    related = "; ".join(entry["label"] for entry in petition.get("additional", []))
    notes = (f"Indigo Book citation: Office of Federal Acknowledgment, {title}{f' ({year})' if year else ''}. "
             f"A document of the Department of the Interior in federal acknowledgment petition #{petition['number']} ({petition['name']}, {petition['state']}; {outcome}), "
             f"listed on the petition's page ({petition['page']}) as \"{document['label']}\". "
             + (f"The page also lists: {related}. " if related else "")
             + f"Title and year from that page; nations matched by name. Generated by {SCRIPT}; not yet read by a person (Unverified).")
    record = {"key": record_key(petition, document), "kind": "federal-agency-document", "citation": citation,
              "original_link": document["final"], "retrieved": "2026-11-26"}
    if copy:
        record["file"] = copy
    record["rights"] = RIGHTS
    record["jurisdictions"] = [{"level": "federal"}]
    if nations:
        record["tribes"] = nations
    record.update({"topics": ["federal-recognition"], "access": {"open": True, "pull_from": ["free-web"]}, "found_in": [SESSION], "notes": notes,
                   "review": {"status": "unverified", "by": SCRIPT, "date": "2026-11-26",
                              "checks": [{"check": "listing", "result": "missing",
                                          "detail": f"Only the petition's page was read: {petition['page']}" + ("" if year else "; it gives no year")}]}})
    return record


def records(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/law"))
    from nation_names import NationNames  # noqa: E402

    work = Path(args.work)
    petitions = json.loads((work / "petitions.json").read_text(encoding="utf-8"))
    names = NationNames()
    copies = {}
    for row in csv.DictReader(CAPTURE_INDEX.open(encoding="utf-8")):
        copies[row["sha256"]] = {"storage_key": row["key"], "checksum": row["sha256"], "media_type": row["media_type"], "bytes": int(row["bytes"])}
    # Petitions decided together (the three Southeastern Cherokee Confederacy groups) link one finding: each keeps a record, listing the others.
    by_link: dict[str, list[str]] = {}
    for petition in petitions:
        for document in petition["documents"]:
            if document["by"] == "department" and document.get("file"):
                by_link.setdefault(document["final"], []).append(record_key(petition, document))
    written = 0
    for petition in petitions:
        # Only an acknowledged petitioner is a nation with a profile; a denied or pending group is named but not linked.
        nations = names.find(petition["name"]) if petition["outcome"].lower().startswith("acknowledged") else []
        if petition["outcome"].lower().startswith("acknowledged") and not nations and petition["number"] in PETITIONER_NATIONS:
            nations = [PETITIONER_NATIONS[petition["number"]]]
        for document in petition["documents"]:
            if document["by"] != "department" or not document.get("file"):
                continue
            key = record_key(petition, document)
            path = SOURCES / "a" / f"{key}.yaml"
            record = record_for(petition, document, copies.get(document["sha256"]), nations)
            others = [other for other in by_link[document["final"]] if other != key]
            if others:
                record = {**{name: value for name, value in record.items() if name in ("key", "kind", "citation", "original_link", "retrieved", "file")},
                          "shares_link_with": others, **record}
            path.write_text(dump(record), encoding="utf-8")
            written += 1
    print(f"wrote {written} records")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "file", "records"):
        sub.add_parser(name).add_argument("--work", required=True)
    args = parser.parse_args()
    {"fetch": fetch, "file": file, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
