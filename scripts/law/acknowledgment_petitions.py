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
A petitioner's own documents and the public comments on a petition are not
government works: they are stored privately (not served), and each gets a
record that cites and links the Office's copy.

The title and year come from the petition's page. The nation is matched by
name (scripts/law/nation_names.py) for petitioners that were acknowledged.

Steps:
  fetch    Read both lists and every petition's page, and download each PDF.
           Writes --work/petitions.json.
  file     Store each PDF in the bucket and add it to the capture index.
  records  Write content/sources/a/acknowledgment-<number>-<document>.yaml
           for each of the Department's documents.
  link     Link every petition's records to the nation's profile (matched by
           petition number), so the nation page can list them (Trevor,
           Nov. 27, 2026: "if petitioning, we should show petitioning
           documents"): the Department's documents, the Federal Register
           notices and Interior Board of Indian Appeals decisions the
           petition's page lists, and a record for each of the petitioner's
           documents and public comments. --pages is the petition pages file
           (research/raw/2026-11-27/acknowledgment-petition-pages.json).

Usage:
  python3 scripts/law/acknowledgment_petitions.py fetch --work DIR
  python3 scripts/law/acknowledgment_petitions.py file --work DIR
  python3 scripts/law/acknowledgment_petitions.py records --work DIR
  python3 scripts/law/acknowledgment_petitions.py link --pages FILE
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


# Petitions the Office numbers differently from the nation's profile (each checked by hand against the profile).
PETITION_PROFILES = {"158": "fernandeno-tataviam-band-of-mission-indians"}
LINK_SESSION = "2026-11-27-petition-documents"
PRIVATE_RIGHTS = {"status": "no-permission-needed", "basis": "link-only",
                  "basis_note": "Not a government work: cited and linked to the Office of Federal Acknowledgment's copy; the project's copy is kept privately, not served.",
                  "redistribution": False}


def petition_key(number: str) -> str:
    """'057' and '57' are one petition; '9A' and '009A' too."""
    return number.lstrip("0").upper() or "0"


def petition_profiles() -> dict[str, list[str]]:
    """Each petition number's profiles, from the profiles' recognition facts."""
    found: dict[str, set[str]] = {}
    for path in sorted((ROOT / "content/tribes").glob("*/*.yaml")):
        profile = yaml.safe_load(path.read_text(encoding="utf-8"))
        for fact in profile.get("recognition") or []:
            if fact.get("petition_number"):
                found.setdefault(petition_key(str(fact["petition_number"])), set()).add(profile["id"])
    for number, nation in PETITION_PROFILES.items():
        found.setdefault(petition_key(number), set()).add(nation)
    return {number: sorted(nations) for number, nations in found.items()}


def source_files() -> dict[str, Path]:
    return {path.stem: path for path in SOURCES.glob("*/*.yaml")}


def add_links(path: Path, nations: list[str]) -> bool:
    """Add the nations to the record's tribes and federal-recognition to its topics, editing only those lines."""
    text = path.read_text(encoding="utf-8")
    record = yaml.safe_load(text)
    tribes = [nation for nation in nations if nation not in (record.get("tribes") or [])]
    topic = "federal-recognition" not in (record.get("topics") or [])
    if not tribes and not topic:
        return False
    lines = text.split("\n")

    def block_end(name: str) -> int | None:
        """The line after a top-level block, or None when the record has none."""
        start = next((index for index, line in enumerate(lines) if line == f"{name}:"), None)
        if start is None:
            return None
        end = start + 1
        while end < len(lines) and (lines[end].startswith("- ") or lines[end].startswith("  ")):
            end += 1
        return end

    def insert(name: str, items: list[str], after: tuple[str, ...]) -> None:
        end = block_end(name)
        if end is not None:
            lines[end:end] = [f"- {item}" for item in items]
            return
        place = next((block_end(other) for other in after if block_end(other) is not None), None)
        if place is None:
            raise SystemExit(f"{path}: no place for {name}")
        lines[place:place] = [f"{name}:"] + [f"- {item}" for item in items]

    if tribes:
        insert("tribes", tribes, ("jurisdictions", "rights", "file", "retrieved"))
    # A Board decision names the nations it is about (nations_in_case), in the order tribes lists them: the petitioner is a party.
    named = []
    if tribes and "nations_in_case" in record:
        found = re.search(r"Federal Acknowledgment of (?:the )?(.+?)\s*$", record["citation"].get("title", ""), re.I)
        named = [{"nation": nation, "named_as": found.group(1) if found else record["citation"]["title"], "role": "party"} for nation in tribes]
        start = lines.index("nations_in_case:")
        at = next(index for index in range(start + 1, len(lines)) if lines[index].startswith("  named:"))
        if lines[at] == "  named: []":
            lines[at] = "  named:"
        end = at + 1
        while end < len(lines) and (lines[end].startswith("  - ") or lines[end].startswith("    ")):
            end += 1
        lines[end:end] = [line for entry in named for line in
                          (f"  - nation: {entry['nation']}", f"    named_as: {yaml.safe_dump(entry['named_as'], width=10_000).strip().removesuffix(chr(10) + '...')}", "    role: party")]
    if topic:
        insert("topics", ["federal-recognition"], ("tribes", "nations_in_case", "jurisdictions", "rights", "retrieved"))
    expected = dict(record)
    expected["tribes"] = (record.get("tribes") or []) + tribes
    expected["topics"] = (record.get("topics") or []) + (["federal-recognition"] if topic else [])
    if named:
        expected["nations_in_case"] = {**record["nations_in_case"], "named": record["nations_in_case"]["named"] + named}
    edited = "\n".join(lines)
    if yaml.safe_load(edited) != expected:
        raise SystemExit(f"{path}: the edit changed more than tribes, topics and nations_in_case")
    path.write_text(edited, encoding="utf-8")
    return True


def commenter(label: str) -> tuple[str, str]:
    """'Duchesne County Commission, Public Comment on Petition #409' is ('Duchesne County Commission', 'Public Comment on Petition #409')."""
    match = re.match(r"^(.*?),\s*(Public Comments?\b.*)$", label)
    return (match.group(1).strip(), match.group(2).strip()) if match else ("", label)


def private_record(petition: dict, document: dict, copy: dict | None, nations: list[str]) -> dict:
    """A record for one of the petitioner's documents or one public comment: cited and linked, not served."""
    comment = document["by"] == "public-comments"
    author, label = commenter(document["label"]) if comment else (petition["name"], document["label"])
    kind = re.sub(r"\s*\((?:[^()]|\([^()]*\))*\)\s*$", "", label).strip() or label
    year = year_of(document["label"])
    # The file name the Office gave the document often carries a year ("cor-2025-09-26-inc-...", "409_narr_2025_0.pdf"); only the year is used.
    logged = None if year else re.search(r"[/_-]((?:19|20)\d\d)(?:[_-]|\.pdf$)", "/" + document["link"].rsplit("/", 1)[-1])
    if logged:
        year = int(logged.group(1))
    title = f"{kind}: {petition['name']} (Petitioner #{petition['number']})" if not comment else f"{kind}: {petition['name']}"
    citation = {"type": "document", "title": title, "author": [{"literal": author}] if author else [],
                "genre": "Public comment" if comment else "Petitioner's document", "number": f"Petitioner #{petition['number']}",
                "publisher": OFFICE, "URL": document["link"], "accessed": {"date-parts": [[2026, 11, 26]]}}
    if not citation["author"]:
        del citation["author"]
    if year:
        citation["issued"] = {"date-parts": [[year]]}
    whose = f"A public comment on federal acknowledgment petition #{petition['number']}" if comment else f"A document the petitioner filed in federal acknowledgment petition #{petition['number']}"
    year_note = " The year is the one in the file name the Office gave the document." if logged else ""
    notes = (f"{whose} ({petition['name']}, {petition['state']}), listed on the petition's page ({petition['page']}) as \"{document['label']}\". "
             f"Not a government work: the project's copy is kept privately and the record links the Office's copy.{year_note} "
             f"Title from that page. Generated by {SCRIPT}; not yet read by a person (Unverified).")
    record = {"key": record_key(petition, document), "kind": "other", "citation": citation, "original_link": document["link"], "retrieved": "2026-11-26"}
    if copy:
        record["file"] = copy
    record.update({"rights": PRIVATE_RIGHTS, "jurisdictions": [{"level": "federal"}], "tribes": nations, "topics": ["federal-recognition"],
                   "access": {"open": True, "pull_from": ["free-web"]}, "found_in": [LINK_SESSION], "notes": notes,
                   "review": {"status": "unverified", "by": SCRIPT, "date": "2026-11-27",
                              "checks": [{"check": "listing", "result": "missing", "detail": f"Only the petition's page was read: {petition['page']}"}]}})
    return record


def link(args) -> None:
    petitions = json.loads(Path(args.pages).read_text(encoding="utf-8"))
    profiles = petition_profiles()
    files = source_files()
    by_address: dict[str, str] = {}
    for key, path in files.items():
        if "ibia" not in key:
            continue
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        for address in (record.get("original_link"), record.get("citation", {}).get("URL")):
            if address:
                by_address[address.lower()] = key
    copies = {}
    for row in csv.DictReader(CAPTURE_INDEX.open(encoding="utf-8")):
        if row["key"].startswith("acknowledgment/"):
            for address in row["link"].split():
                copies.setdefault(address, {"storage_key": row["key"], "checksum": row["sha256"], "media_type": row["media_type"], "bytes": int(row["bytes"])})
    # One letter or notice filed in several petitions (the Southeastern Cherokee Confederacy groups, the 1978 Federal Register list of letters of intent) keeps a record in each, listing the others.
    # A key cut short can repeat (two parts of one narrative, two comments under one name): the second is numbered, in the page's order.
    keys: dict[tuple[str, str], str] = {}
    used: dict[str, int] = {}
    shared: dict[str, list[str]] = {}
    for petition in petitions:
        for document in petition["documents"]:
            if document["by"] != "department":
                key = record_key(petition, document)
                used[key] = used.get(key, 0) + 1
                keys[(petition["number"], document["link"])] = key if used[key] == 1 else f"{key}-{used[key]}"
                shared.setdefault(document["link"], []).append(keys[(petition["number"], document["link"])])
    linked = written = 0
    missing: list[str] = []
    for petition in petitions:
        nations = profiles.get(petition_key(petition["number"]), [])
        if not nations:
            missing.append(f"{petition['number']} {petition['name']}: no profile")
            continue
        prefix = f"acknowledgment-{petition['number'].lower()}-"
        for document in petition["documents"]:
            key = keys.get((petition["number"], document["link"])) or record_key(petition, document)
            if document["by"] == "department":
                if key in files:
                    linked += add_links(files[key], nations)
                else:
                    missing.append(f"{petition['number']} {document['label']}: no record {key}")
                continue
            path = SOURCES / "a" / f"{key}.yaml"
            record = {**private_record(petition, document, copies.get(document["link"]), nations), "key": key}
            others = [other for other in shared[document["link"]] if other != key]
            if others:
                record = {**{name: value for name, value in record.items() if name in ("key", "kind", "citation", "original_link", "retrieved", "file")},
                          "shares_link_with": others, **record}
            path.write_text(dump(record), encoding="utf-8")
            written += 1
        for entry in petition.get("additional", []):
            address = entry["link"]
            if not re.search(r"federalregister\.gov/documents/|/IBIA/|ibia", address, re.I):
                continue
            number = re.search(r"federalregister\.gov/documents/\d{4}/\d\d/\d\d/([^/]+)", address)
            decision = re.search(r"/(\d+)ibia(\d+)\.pdf$", address, re.I)
            if number:
                key = f"federal-register-{number.group(1).lower()}"
            else:
                key = by_address.get(address.lower()) or next(
                    (key for key in files if decision and key.startswith("in-re-federal-acknowledgment") and key.endswith(f"-{decision.group(1)}-ibia-{decision.group(2)}")), None)
            if key in files:
                linked += add_links(files[key], nations)
            else:
                missing.append(f"{petition['number']} {entry['label']}: no record for {address}")
        # Department records the page no longer lists, from an earlier reading, still belong to the petition.
        for key in [key for key in files if key.startswith(prefix)]:
            linked += add_links(files[key], nations)
    print(f"linked {linked} records, wrote {written} petitioner and comment records")
    for line in missing:
        print("missing:", line)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "file", "records"):
        sub.add_parser(name).add_argument("--work", required=True)
    sub.add_parser("link").add_argument("--pages", required=True)
    args = parser.parse_args()
    {"fetch": fetch, "file": file, "records": records, "link": link}[args.command](args)


if __name__ == "__main__":
    main()
