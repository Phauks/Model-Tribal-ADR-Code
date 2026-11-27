#!/usr/bin/env python3
"""Source records and stored copies for the Indian Affairs Manual (data tier
2; thread "Close the tier 2 data gaps", Nov. 27, 2026): every chapter the
Bureau of Indian Affairs lists on its manual page
(https://www.bia.gov/policy-forms/manual), part by part, with the chapter's
number, title and issued date from that page (233 chapters with a file,
counted Nov. 26, 2026). The manual is Indian Affairs' own policy for its
offices: delegations of authority, trust land and real estate services,
probate, self-determination contracting, education, law enforcement and the
rest.

Every chapter is a work of the United States government, so the project
keeps its own copy in the bucket under indian-affairs-manual/<file> and
serves it. A chapter the page lists without a file (most of them "Reserved")
gets no record. The handbooks and national policy memoranda are on pages of
their own and are not part of this set.

Steps:
  fetch    Read the manual page and download every chapter into --work.
           Writes --work/chapters.json.
  file     Store each chapter in the bucket and add it to the capture index.
  records  Write content/sources/i/indian-affairs-manual-<part>-<chapter>.yaml.

Usage:
  python3 scripts/law/indian_affairs_manual.py fetch --work DIR
  python3 scripts/law/indian_affairs_manual.py file --work DIR
  python3 scripts/law/indian_affairs_manual.py records --work DIR
"""
from __future__ import annotations

import argparse
import concurrent.futures
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
SOURCES = ROOT / "content/sources"
SESSION = "2026-11-27-indian-affairs-manual"
SCRIPT = "scripts/law/indian_affairs_manual.py"
PAGE = "https://www.bia.gov/policy-forms/manual"
AUTHOR = "U.S. Department of the Interior, Indian Affairs"
GENRE = "Indian Affairs Manual chapter"
UA = {"User-Agent": "Mozilla/5.0 (research script)"}
MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
RIGHTS = {"status": "no-permission-needed", "basis": "us-government-work",
          "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105).",
          "redistribution": True}
MEDIA = {".pdf": "application/pdf", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".doc": "application/msword"}


def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def get(url: str) -> bytes:
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as response:
                return response.read()
        except Exception:  # noqa: BLE001 - retried, then raised
            if attempt == 4:
                raise
            time.sleep(5 * (attempt + 1))


def text_of(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def issued(value: str) -> str | None:
    """"10/17/24" or "4/23/2008" as 2024-10-17; anything else (such as "(Continually Updated)") as None."""
    match = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{2}|\d{4})", value.strip())
    if not match:
        return None
    month, day, year = (int(part) for part in match.groups())
    if year < 100:
        year += 2000 if year < 50 else 1900
    return dt.date(year, month, day).isoformat()


def chapters_on(page: str) -> list[dict]:
    found = []
    for table in re.findall(r'<table class="usa-table.*?</table>', page, re.S):
        caption = re.search(r"<caption>(.*?)</caption>", table, re.S)
        heading = text_of(caption.group(1)) if caption else ""
        part = re.match(r"Part (\d+)\s+(.*)", heading)
        if not part:
            continue
        part_number, part_name = int(part.group(1)), re.sub(r"\s*\*.*$|\s*\(.*$", "", part.group(2)).strip()
        for row in re.findall(r"<tr>(.*?)</tr>", table, re.S):
            cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
            if len(cells) < 3:
                continue
            link = re.search(r'<a href="([^"]+)"[^>]*>(.*?)</a>', cells[1], re.S)
            if not link:
                continue
            chapter = text_of(cells[0])
            found.append({"part": part_number, "part_name": part_name, "chapter": chapter, "title": text_of(link.group(2)) or text_of(cells[1]),
                          "url": urllib.parse.urljoin(PAGE, html.unescape(link.group(1))), "issued_text": text_of(cells[2]), "issued": issued(text_of(cells[2]))})
    return found


def record_key(item: dict) -> str:
    return "indian-affairs-manual-" + re.sub(r"[^a-z0-9]+", "-", f"{item['part']}-{item['chapter']}".lower()).strip("-")


def file_name(item: dict) -> str:
    """The stored file's name: the chapter's own number, then the page's file name, so two chapters sharing a name stay apart."""
    original = urllib.parse.unquote(urllib.parse.urlparse(item["url"]).path.rsplit("/", 1)[-1])
    return f"{record_key(item).removeprefix('indian-affairs-manual-')}-" + re.sub(r"[^A-Za-z0-9._-]+", "_", original)


def fetch(args) -> None:
    work = Path(args.work)
    (work / "files").mkdir(parents=True, exist_ok=True)
    chapters = chapters_on(get(PAGE).decode("utf-8", "replace"))
    seen: dict[str, int] = {}
    for item in chapters:
        key = record_key(item)
        seen[key] = seen.get(key, 0) + 1
        if seen[key] > 1:  # the page lists a chapter number twice (an old and a new version): keep both
            item["chapter"] = f"{item['chapter']}-{seen[key]}"

    def download(item: dict) -> str | None:
        target = work / "files" / file_name(item)
        if not (target.exists() and target.stat().st_size > 0):
            try:
                target.write_bytes(get(item["url"]))
            except Exception as problem:  # noqa: BLE001 - reported
                return f"{item['url']}: {problem}"
        data = target.read_bytes()
        suffix = Path(target.name).suffix.lower()
        if suffix == ".pdf" and not data.startswith(b"%PDF"):
            target.unlink()
            return f"{item['url']}: not a PDF"
        item.update({"file": target.name, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "media": MEDIA.get(suffix, "application/octet-stream")})
        return None

    with concurrent.futures.ThreadPoolExecutor(6) as pool:
        problems = [problem for problem in pool.map(download, chapters) if problem]
    for problem in problems:
        print("FAILED", problem, file=sys.stderr)
    (work / "chapters.json").write_text(json.dumps(chapters, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"{len(chapters)} chapters with a file; {len(problems)} downloads failed")


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    chapters = json.loads((work / "chapters.json").read_text(encoding="utf-8"))
    rows = mirror_captures.load_index()
    filed = {row["key"] for row in rows}
    s3 = mirror_captures.client()
    bucket = mirror_captures.bucket_name()

    def put(item: dict):
        key = f"indian-affairs-manual/{item['file']}"
        path = work / "files" / item["file"]
        if key in filed:
            return None
        if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, item["sha256"]):
            s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": item["media"], "Metadata": {"sha256": item["sha256"], "captured": dt.date.today().isoformat()}})
            if mirror_captures.remote_state(s3, bucket, key) != (path.stat().st_size, item["sha256"]):
                return ("failed", key)
        return ("ok", mirror_captures.index_row(
            key=key, size=path.stat().st_size, digest=item["sha256"], media=item["media"], topic="indian-affairs-manual", title=title_of(item), nations="",
            obtained="downloaded from the Bureau of Indian Affairs' Indian Affairs Manual page by script", links=[item["url"]],
            record=record_key(item), redistribution="yes", rights="United States government work (17 U.S.C. § 105).", existing_keys=filed))

    added = 0
    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        for result in pool.map(put, [item for item in chapters if item.get("file")]):
            if not result:
                continue
            if result[0] == "failed":
                print("verification failed", result[1], file=sys.stderr)
                continue
            rows.append(result[1])
            added += 1
    mirror_captures.write_index(rows)
    print(f"filed {added}")


def title_of(item: dict) -> str:
    return f"{item['part']} IAM {item['chapter']}: {item['title']}"


def record_for(item: dict) -> dict:
    citation = {"type": "report", "title": title_of(item), "author": [{"literal": AUTHOR}], "genre": GENRE,
                "number": f"{item['part']} IAM {item['chapter']}", "collection-title": "Indian Affairs Manual",
                "section": f"Part {item['part']}, {item['part_name']}"}
    when = ""
    if item["issued"]:
        year, month, day = (int(part) for part in item["issued"].split("-"))
        citation["issued"] = {"date-parts": [[year, month, day]]}
        when = f"{MONTHS[month - 1]} {day}, {year}"
    citation.update({"URL": item["url"], "accessed": {"date-parts": [[int(part) for part in item["retrieved"].split("-")]]}})
    cite = f"{AUTHOR.replace('U.S. Department of the Interior', 'U.S. Dep’t of the Interior')}, Indian Affairs Manual pt. {item['part']}, ch. {item['chapter']}, {item['title']}" + (f" ({when})" if when else "")
    notes = (f"Indigo Book citation: {cite}. Chapter {item['chapter']} of Part {item['part']} ({item['part_name']}) of the Indian Affairs Manual, "
             f"as listed on the Bureau of Indian Affairs' manual page ({PAGE}), issued date given there as \"{item['issued_text']}\". "
             f"Title, part, chapter and date from that page. Generated by {SCRIPT}; not yet read by a person (Unverified).")
    record = {"key": record_key(item), "kind": "federal-agency-document", "citation": citation, "original_link": item["url"], "retrieved": item["retrieved"]}
    if item.get("file"):
        record["file"] = {"storage_key": f"indian-affairs-manual/{item['file']}", "checksum": item["sha256"], "media_type": item["media"], "bytes": item["bytes"]}
    record["rights"] = RIGHTS
    record["jurisdictions"] = [{"level": "federal"}]
    record.update({"access": {"open": True, "pull_from": ["free-web"]}, "found_in": [SESSION], "notes": notes,
                   "review": {"status": "unverified", "by": SCRIPT, "date": item["retrieved"],
                              "checks": [{"check": "listing", "result": "missing", "detail": f"Only the manual page was read: {PAGE}"}]}})
    return record


def records(args) -> None:
    work = Path(args.work)
    chapters = json.loads((work / "chapters.json").read_text(encoding="utf-8"))
    written = 0
    for item in chapters:
        if not item.get("file"):
            continue
        item.setdefault("retrieved", args.retrieved)
        path = SOURCES / "i" / f"{record_key(item)}.yaml"
        if path.exists() and SESSION not in path.read_text(encoding="utf-8"):
            print("key taken by another record, skipped:", path.stem, file=sys.stderr)
            continue
        path.write_text(dump(record_for(item)), encoding="utf-8")
        written += 1
    print(f"wrote {written} records")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "file", "records"):
        sub.add_parser(name).add_argument("--work", required=True)
    sub.choices["records"].add_argument("--retrieved", default=dt.date.today().isoformat(), help="the date the page was read (default today)")
    args = parser.parse_args()
    {"fetch": fetch, "file": file, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
