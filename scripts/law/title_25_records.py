#!/usr/bin/env python3
"""Source records for Title 25 of the United States Code ("Indians"), one per
chapter, and Title 25 of the Code of Federal Regulations ("Indians"), one per
part (data tier 1; Trevor, Nov. 24, 2026), with a refresh check.

Sources, all United States government works:

- The Code: the latest annual edition on GovInfo
  (https://www.govinfo.gov/content/pkg/USCODE-<year>-title25/html/USCODE-<year>-title25.htm),
  read for its chapters and sections, and each chapter's PDF from the same
  package, stored in the bucket under united-states-code/<year>/title-25-chapter-<n>.pdf.
- The regulations: the eCFR structure of Title 25
  (https://www.ecfr.gov/api/versioner/v1/structure/current/title-25.json) for
  the parts in force and the agency that issued each, the eCFR versions list
  for each part's last amendment, and each part's PDF from the latest annual
  edition on GovInfo (https://www.govinfo.gov/link/cfr/25/<part>?year=mostrecent&link-type=pdf),
  stored under code-of-federal-regulations/<year>/title-25-part-<n>.pdf.

Steps:
  fetch    Read both titles and download the PDFs into --work. Writes
           research/raw/2026-11-24/title-25.json.
  file     Store the PDFs in the bucket with scripts/captures/mirror_captures.py.
  records  Write content/sources/u/usc-25-chapter-<n>.yaml and
           content/sources/c/cfr-25-part-<n>.yaml. The existing part records
           (cfr-25-part-11-courts-of-indian-offenses, cfr-25-part-291 and
           cfr-25-part-293) keep their text and gain the stored copy.
  check    The refresh check: compare the records with the current eCFR and
           the newest Code edition on GovInfo, and list parts added, removed
           or amended since their stored copy, and whether a newer Code
           edition exists. Writes research/reviews/title-25-refresh.csv and
           exits 1 when anything changed, so it can run on a schedule. To
           refresh, run fetch, file and records again.

Usage:
  python3 scripts/law/title_25_records.py fetch --work DIR
  python3 scripts/law/title_25_records.py file --work DIR --captures /mnt/project-files/research/captures
  python3 scripts/law/title_25_records.py records
  python3 scripts/law/title_25_records.py check
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import html
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "research/raw/2026-11-24/title-25.json"
INDEX = ROOT / "research/capture-index.csv"
REFRESH = ROOT / "research/reviews/title-25-refresh.csv"
SOURCES = ROOT / "content/sources"
SESSION = "2026-11-24-title-25-records"
GOVINFO = "https://www.govinfo.gov/content/pkg"
ECFR = "https://www.ecfr.gov/api/versioner/v1"
RIGHTS = {"status": "no-permission-needed", "basis": "us-government-work",
          "basis_note": "Federal statutes and regulations are works of the U.S. government (17 U.S.C. § 105).",
          "redistribution": True}
MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
SMALL = {"a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with", "under"}
GONE = re.compile(r"^(Repealed|Transferred|Omitted|Renumbered|Vacant|Reserved)\b", re.I)


def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def get(url: str, path: Path | None = None) -> str:
    for attempt in range(3):
        command = ["curl", "-gsfL", "-m", "180", "-A", "Mozilla/5.0", url]
        if path:
            command[1:1] = ["-o", str(path)]
        result = subprocess.run(command, capture_output=True, text=not path)
        if result.returncode == 0:
            return "" if path else result.stdout
        time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"could not fetch {url}")


def exists(url: str) -> bool:
    result = subprocess.run(["curl", "-sIL", "-m", "60", "-A", "Mozilla/5.0", "-o", "/dev/null", "-w", "%{http_code}", url],
                            capture_output=True, text=True)
    return result.stdout.strip() == "200"


def long_date(value: str) -> str:
    year, month, day = (int(part) for part in value.split("-"))
    return f"{MONTHS[month - 1]} {day}, {year}"


def title_case(text: str) -> str:
    def cap(word: str, first: bool) -> str:
        return word if not first and word in SMALL else word[:1].upper() + word[1:]

    words = text.lower().split(" ")
    return " ".join("-".join(cap(piece, not index and not part) for part, piece in enumerate(word.split("-")))
                    if "-" in word else cap(word, not index) for index, word in enumerate(words))


def latest_code_edition() -> tuple[int, str]:
    """The newest annual edition of Title 25 on GovInfo that has its chapters, and its HTML."""
    year = dt.date.today().year
    while year > 2020:
        try:
            page = get(f"{GOVINFO}/USCODE-{year}-title25/html/USCODE-{year}-title25.htm")
        except RuntimeError:
            page = ""
        if 'class="chapter-head"' in page:
            return year, page
        year -= 1
    raise RuntimeError("no Title 25 edition found on GovInfo")


def code_chapters(page: str) -> list[dict]:
    """Each chapter of the Code's Title 25 with its sections, from the GovInfo HTML."""
    chapters = []
    for block in re.split(r"(?=<!-- documentid:25_-ch[0-9A-Z]+ )", page)[1:]:
        head = re.search(r'<h3 class="chapter-head"><strong>CHAPTER ([0-9A-Z]+)&mdash;(.*?)</strong></h3>', block)
        if not head:
            continue
        sections = []
        for raw in re.findall(r'<h3 class="section-head">(.*?)</h3>', block):
            text = html.unescape(re.sub(r"<[^>]+>", "", raw)).replace("–", "-")
            match = re.match(r"§+\s*([^.]+?)\.\s*(.*)$", text)
            if match:
                sections.append({"number": match.group(1).strip(), "heading": match.group(2).strip(), "live": not GONE.match(match.group(2).strip())})
        name = html.unescape(re.sub(r"<[^>]+>", "", head.group(2))).strip()
        chapters.append({"chapter": head.group(1), "name": title_case(name) if name.isupper() else name, "sections": sections})
    return chapters


def regulation_parts() -> list[dict]:
    structure = json.loads(get(f"{ECFR}/structure/current/title-25.json"))
    parts = []

    def walk(node: dict, chapter: dict | None) -> None:
        if node.get("type") == "chapter":
            chapter = node
        if node.get("type") == "part":
            if not node.get("reserved"):
                parts.append({"part": node["identifier"], "name": node.get("label_description", ""),
                              "chapter": chapter["identifier"], "agency": chapter.get("label_description", "")})
            return
        for child in node.get("children") or []:
            walk(child, chapter)

    walk(structure, None)
    return parts


def last_amended(part: str) -> str:
    versions = json.loads(get(f"{ECFR}/versions/title-25.json?part={part}"))["content_versions"]
    dates = [version["amendment_date"] for version in versions if version.get("substantive", True)]
    return max(dates) if dates else ""


def fetch(args) -> None:
    work = Path(args.work)
    (work / "code").mkdir(parents=True, exist_ok=True)
    (work / "regulations").mkdir(parents=True, exist_ok=True)
    year, page = latest_code_edition()
    through = re.search(r"currentthrough:(\d{8})", page)
    chapters = code_chapters(page)
    for chapter in chapters:
        url = f"{GOVINFO}/USCODE-{year}-title25/pdf/USCODE-{year}-title25-chap{chapter['chapter']}.pdf"
        path = work / "code" / f"title-25-chapter-{chapter['chapter'].lower()}.pdf"
        chapter["pdf"] = url
        if not path.exists():
            try:
                get(url, path)
            except RuntimeError:
                chapter["pdf"] = ""
            time.sleep(0.5)
    parts = regulation_parts()
    for part in parts:
        part["last_amended"] = last_amended(part["part"])
        path = work / "regulations" / f"title-25-part-{part['part']}.pdf"
        result = subprocess.run(["curl", "-gsL", "-m", "180", "-A", "Mozilla/5.0", "-o", str(path), "-w", "%{http_code} %{url_effective}",
                                 f"https://www.govinfo.gov/link/cfr/25/{part['part']}?year=mostrecent&link-type=pdf"],
                                capture_output=True, text=True)
        code, final = result.stdout.split(" ", 1)
        if code == "200" and final.endswith(".pdf"):
            part["pdf"] = final
            part["edition"] = int(re.search(r"CFR-(\d{4})-", final).group(1))
        else:
            path.unlink(missing_ok=True)
            part["pdf"], part["edition"] = "", None
        time.sleep(0.5)
    RAW.write_text(json.dumps({
        "generated": dt.date.today().isoformat(),
        "code": {"edition": year, "current_through": f"{through.group(1)[:4]}-{through.group(1)[4:6]}-{through.group(1)[6:]}" if through else "",
                 "source": f"{GOVINFO}/USCODE-{year}-title25/html/USCODE-{year}-title25.htm", "chapters": chapters},
        "regulations": {"source": f"{ECFR}/structure/current/title-25.json", "parts": parts},
    }, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Code {year}: {len(chapters)} chapters, {sum(len(c['sections']) for c in chapters)} sections; "
          f"regulations: {len(parts)} parts, {sum(1 for p in parts if p['pdf'])} with an annual-edition PDF")


def chapter_key(chapter: dict) -> str:
    return f"usc-25-chapter-{chapter['chapter'].lower()}"


def existing_parts() -> dict[str, Path]:
    """Part-level regulation records not written by this script, by part number."""
    found = {}
    for path in (SOURCES / "c").glob("cfr-25-part-*.yaml"):
        if SESSION not in path.read_text(encoding="utf-8"):
            found[re.match(r"cfr-25-part-(\d+)", path.stem).group(1)] = path
    return found


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    raw = json.loads(RAW.read_text(encoding="utf-8"))
    work = Path(args.work)
    filed = {row["key"] for row in csv.DictReader(INDEX.open(encoding="utf-8"))}
    year = raw["code"]["edition"]
    existing = existing_parts()
    jobs = []
    for chapter in raw["code"]["chapters"]:
        name = f"title-25-chapter-{chapter['chapter'].lower()}.pdf"
        jobs.append((work / "code" / name, f"united-states-code/{year}", name, chapter_key(chapter),
                     f"25 U.S.C. ch. {chapter['chapter']} ({chapter['name']}), {year} edition", chapter.get("pdf", ""),
                     "downloaded from GovInfo (United States Code) by script"))
    for part in raw["regulations"]["parts"]:
        if not part["pdf"]:
            continue
        name = f"title-25-part-{part['part']}.pdf"
        key = existing[part["part"]].stem if part["part"] in existing else f"cfr-25-part-{part['part']}"
        jobs.append((work / "regulations" / name, f"code-of-federal-regulations/{part['edition']}", name, key,
                     f"25 C.F.R. pt. {part['part']} ({part['name']}), {part['edition']} edition", part["pdf"],
                     "downloaded from GovInfo (Code of Federal Regulations, annual edition) by script"))
    for local, topic, name, record, title, link, obtained in jobs:
        if f"{topic}/{name}" in filed or not local.exists():
            continue
        mirror_captures.add(argparse.Namespace(
            captures=args.captures, files=[str(local)], topic=topic, name=name, record=record, obtained=obtained,
            title=title, link=[link] if link else [], redistribution="yes", nations="",
            rights="United States government work (17 U.S.C. § 105).", keep_local=False))


def stored_copies() -> dict[str, dict]:
    copies = {}
    for row in csv.DictReader(INDEX.open(encoding="utf-8")):
        if row["key"].startswith(("united-states-code/", "code-of-federal-regulations/")) and "/title-25-" in row["key"]:
            copies[row["key"]] = {"storage_key": row["key"], "checksum": row["sha256"],
                                  "media_type": row["media_type"], "bytes": int(row["bytes"])}
    return copies


def section_range(sections: list[dict]) -> str:
    if not sections:
        return "no sections"
    first = re.split(r",| to ", sections[0]["number"])[0].strip()
    last = re.split(r",| to ", sections[-1]["number"])[-1].strip()
    return f"§ {first}" if first == last else f"§§ {first}-{last}"


def chapter_record(chapter: dict, code: dict, copy: dict | None) -> dict:
    year = code["edition"]
    live = [section for section in chapter["sections"] if section["live"]]
    link = f"https://www.govinfo.gov/app/details/USCODE-{year}-title25/USCODE-{year}-title25-chap{chapter['chapter']}"
    record = {
        "key": chapter_key(chapter), "kind": "federal-statute",
        "citation": {"type": "legislation", "title": chapter["name"], "container-title": "United States Code",
                     "container-title-short": "U.S.C.", "volume": "25", "section": f"ch. {chapter['chapter']}",
                     "author": [{"literal": "United States Congress"}], "URL": link,
                     "issued": {"date-parts": [[year]]}, "accessed": {"date-parts": [[2026, 11, 24]]}},
        "original_link": link, "retrieved": "2026-11-24", "archives": [],
    }
    if copy:
        record["file"] = copy
    record["rights"] = RIGHTS
    record["jurisdictions"] = [{"level": "federal"}]
    record["found_in"] = [SESSION]
    through = f", current through {long_date(code['current_through'])}" if code.get("current_through") else ""
    gone = len(chapter["sections"]) - len(live)
    record["notes"] = (f"Indigo Book citation: 25 U.S.C. ch. {chapter['chapter']} ({year}). Chapter {chapter['chapter']} of Title 25 (Indians), "
                       f"{section_range(chapter['sections'])}: {len(chapter['sections'])} section numbers, {len(live)} in force"
                       + (f" and {gone} repealed, transferred, omitted or renumbered" if gone else "")
                       + f" ({year} edition on GovInfo{through}). "
                       + ("The stored copy is the chapter's PDF from that edition. " if copy else "No copy is stored. ")
                       + "Generated by scripts/law/title_25_records.py from the official edition; individual sections are cited by their own records (usc-25-<section>). Unverified.")
    return record


def agency(label: str) -> str:
    """The issuing agency without its department: "Bureau of Indian Affairs and Indian Health Service"."""
    return re.sub(r",? Department of [A-Za-z ]+?(?=,|$)", "", label).replace(", and ", " and ").removeprefix("The ").strip(" ,")


def part_record(part: dict, copy: dict | None) -> dict:
    link = f"https://www.ecfr.gov/current/title-25/part-{part['part']}"
    year = int(part["last_amended"][:4]) if part.get("last_amended") else 2026
    record = {
        "key": f"cfr-25-part-{part['part']}", "kind": "federal-regulation",
        "citation": {"type": "legislation", "title": part["name"], "container-title": "Code of Federal Regulations",
                     "volume": "25", "section": f"pt. {part['part']}", "author": [{"literal": agency(part["agency"])}],
                     "URL": link, "issued": {"date-parts": [[year]]}, "accessed": {"date-parts": [[2026, 11, 24]]}},
        "original_link": link, "retrieved": "2026-11-24", "archives": [],
    }
    if copy:
        record["file"] = copy
    record["rights"] = RIGHTS
    record["jurisdictions"] = [{"level": "federal"}]
    record["found_in"] = [SESSION]
    amended = f" Last amended {long_date(part['last_amended'])} (eCFR)." if part.get("last_amended") else ""
    stored = (f" The stored copy is the part's PDF from the {part['edition']} annual edition on GovInfo ({part['pdf']}); amendments after that edition are on the eCFR."
              if copy else " No annual-edition PDF on GovInfo yet (the part is newer than the latest edition), so no copy is stored.")
    record["notes"] = (f"Indigo Book citation: 25 C.F.R. pt. {part['part']} ({part['edition'] or year}). Issued by the {agency(part['agency'])} "
                       f"(25 C.F.R. chapter {part['chapter']}).{amended}{stored} Generated by scripts/law/title_25_records.py from the eCFR structure; Unverified.")
    return record


def add_file_block(path: Path, block: dict) -> bool:
    text = path.read_text(encoding="utf-8")
    if "\nfile:\n" in text:
        return False
    text = text.replace("\nrights:\n", "\n" + dump({"file": block}) + "rights:\n", 1)
    text = re.sub(r"\nfound_in:\n((?:- .*\n)+)", lambda m: f"\nfound_in:\n{m.group(1)}- {SESSION}\n", text, count=1)
    path.write_text(text, encoding="utf-8")
    return True


def ours(path: Path) -> bool:
    return not path.exists() or SESSION in path.read_text(encoding="utf-8")


def records(args) -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    copies = stored_copies()
    code = raw["code"]
    written = updated = 0
    for chapter in code["chapters"]:
        path = SOURCES / "u" / f"{chapter_key(chapter)}.yaml"
        if not ours(path):
            sys.exit(f"key in use by another record: {path.stem}")
        copy = copies.get(f"united-states-code/{code['edition']}/title-25-chapter-{chapter['chapter'].lower()}.pdf")
        path.write_text(dump(chapter_record(chapter, code, copy)), encoding="utf-8")
        written += 1
    existing = existing_parts()
    for part in raw["regulations"]["parts"]:
        copy = copies.get(f"code-of-federal-regulations/{part['edition']}/title-25-part-{part['part']}.pdf") if part["edition"] else None
        if part["part"] in existing:
            updated += bool(copy and add_file_block(existing[part["part"]], copy))
            continue
        path = SOURCES / "c" / f"cfr-25-part-{part['part']}.yaml"
        if not ours(path):
            sys.exit(f"key in use by another record: {path.stem}")
        path.write_text(dump(part_record(part, copy)), encoding="utf-8")
        written += 1
    print(f"Title 25: {written} records written, {updated} existing part records given their copy")


def check(args) -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    rows = []
    recorded = {part["part"]: part for part in raw["regulations"]["parts"]}
    current = {part["part"]: part for part in regulation_parts()}
    for number in sorted(set(current) - set(recorded), key=lambda n: int(n)):
        rows.append({"item": f"25 C.F.R. pt. {number}", "change": "new part", "detail": current[number]["name"]})
    for number in sorted(set(recorded) - set(current), key=lambda n: int(n)):
        rows.append({"item": f"25 C.F.R. pt. {number}", "change": "removed or reserved", "detail": recorded[number]["name"]})
    for number in sorted(set(recorded) & set(current), key=lambda n: int(n)):
        amended = last_amended(number)
        if amended and amended > (recorded[number].get("last_amended") or ""):
            rows.append({"item": f"25 C.F.R. pt. {number}", "change": "amended", "detail": f"last amended {amended}; recorded {recorded[number].get('last_amended')}"})
        time.sleep(0.3)
    newest, _ = latest_code_edition()
    if newest > raw["code"]["edition"]:
        rows.append({"item": "25 U.S.C.", "change": "new edition", "detail": f"{newest} edition on GovInfo; records use {raw['code']['edition']}"})
    REFRESH.parent.mkdir(parents=True, exist_ok=True)
    with REFRESH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["item", "change", "detail"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"{len(rows)} changes since the records were generated; see {REFRESH.relative_to(ROOT)}")
    sys.exit(1 if rows else 0)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "file", "records", "check"):
        p = sub.add_parser(name)
        if name in ("fetch", "file"):
            p.add_argument("--work", required=True)
        if name == "file":
            p.add_argument("--captures", required=True)
    args = parser.parse_args()
    {"fetch": fetch, "file": file, "records": records, "check": check}[args.command](args)


if __name__ == "__main__":
    main()
