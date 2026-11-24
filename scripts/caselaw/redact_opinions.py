#!/usr/bin/env python3
"""Build, check and file the redacted Tribal court opinions.

The opinions held back for a privacy review (research/capture-index-overrides.json,
PR #472) are shown again only as redacted pages, under the policy in
research/analyses/2026-11-24-redaction-practices-for-opinions.md. The names map
that drives the redaction is private (scripts/caselaw/redaction.py): it is kept in
the R2 bucket and the project's private files, never in git.

    merge   Join the name finders' files (one JSON per opinion) and any hand
            corrections into the names map. Adds each protected person's first
            name and surname on their own, unless the opinion also uses the word
            in lower case (an ordinary word, left for a person to check).
    check   Build every redacted page from the Caselaw Access Project volumes and
            check that no protected full name, listed form of a name or listed
            detail remains. Writes a private report for spot checks.
    file    For the opinions that pass: upload the redacted page under its own
            key, update the capture index and opinions.csv with the initials
            caption, lift the privacy hold, and record the opinion in
            research/tribal-court-opinions/redacted.csv. Also uploads the names
            map to the bucket's private key.

Run from the repository root, for example:

    python3 scripts/caselaw/redact_opinions.py merge --found FOLDER --map MAP.json [--fixes FIXES.json]
    python3 scripts/caselaw/redact_opinions.py check --map MAP.json --cache ~/caselaw-cache --report REPORT.json
    python3 scripts/caselaw/redact_opinions.py file --map MAP.json --cache ~/caselaw-cache --report REPORT.json [--keys K ...]

A nation's own restriction (Show, Cite only, Hide) is applied on top by the
website and the stricter rule wins; filing a redacted page never loosens it.
"""

from __future__ import annotations

import argparse
import csv
import datetime
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from caselaw_sources import cap_case_link, cap_volume_zip  # noqa: E402
from redaction import NAMES_MAP_KEY, Redactor, leftovers, name_words, normalize, unlisted_words, visible_text  # noqa: E402
import tribal_court_opinions as opinions_script  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OVERRIDES = ROOT / "research" / "capture-index-overrides.json"
OPINIONS = ROOT / "research" / "tribal-court-opinions" / "opinions.csv"
REDACTED = ROOT / "research" / "tribal-court-opinions" / "redacted.csv"
REDACTED_FIELDS = ["key", "case_id", "status", "replaced", "checked"]
HOLD_RIGHTS = "Held back for a privacy review"
ORIGINALS_PREFIX = "private/redaction/originals/"


def held_keys() -> list[str]:
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    return sorted(k for k, v in overrides.items() if HOLD_RIGHTS in v.get("rights", ""))


def opinion_source(key: str, cache: Path) -> tuple[dict, str, str]:
    """The case JSON, its HTML fragment and its case.law link, from the cached volume zip."""
    _, reporter, volume, file_name = key.split("/")
    stem = file_name.removesuffix(".html")
    with zipfile.ZipFile(cap_volume_zip(reporter, volume, cache)) as archive:
        case = json.loads(archive.read(f"json/{stem}.json"))
        fragment = archive.read(f"html/{stem}.html").decode("utf-8")
    return case, fragment, cap_case_link(reporter, volume, stem)


# ------------------------------------------------------------------ merge

def merge(args) -> None:
    names = {}
    texts = Path(args.texts) if args.texts else None
    for path in sorted(Path(args.found).glob("*.json")):
        found = json.loads(path.read_text(encoding="utf-8"))
        key = found["key"]
        text = (texts / f"{path.stem}.txt").read_text(encoding="utf-8") if texts else ""
        for person in found.get("people", []):
            listed = {normalize(v) for v in person.get("variants", [])}
            words = name_words(person.get("full_name") or "")
            if len(words) >= 2:
                for word in (words[0], words[-1]):
                    bare = word.strip(".,")
                    if len(bare) < 3 or bare in listed or not text:
                        continue
                    # The word used in lower case too ("little") is left for a person to check.
                    if re.search(r"(?<![\w])" + re.escape(bare.lower()) + r"(?![\w])", text):
                        continue
                    person.setdefault("variants", []).append(bare)
                    if bare.upper() != bare:
                        person["variants"].append(bare.upper())
        names[key] = {"people": found.get("people", []), "keep": found.get("keep", []),
                      "details": found.get("details", []), "child_centered": found.get("child_centered"),
                      "reviewed": datetime.date.today().isoformat()}
    if args.fixes:
        for key, fix in json.loads(Path(args.fixes).read_text(encoding="utf-8")).items():
            entry = names.setdefault(key, {"people": [], "keep": [], "details": []})
            for field in ("people", "keep", "details"):
                entry[field] = entry.get(field, []) + fix.get(f"add_{field}", [])
            for person in fix.get("add_variants", []):
                for existing in entry["people"]:
                    if existing.get("full_name") == person["full_name"] or existing.get("court_initials") == person.get("court_initials"):
                        existing["variants"] = existing.get("variants", []) + person["variants"]
            if "replace" in fix:
                entry.update(fix["replace"])
    Path(args.map).write_text(json.dumps(names, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(names)} opinions in the names map", file=sys.stderr)


# ------------------------------------------------------------------ check

KIN = re.compile(r"\b(child(?:ren)?|minor|son|daughter|mother|father|grand(?:mother|father|son|daughter|child(?:ren)?|parents?)|aunt|uncle|niece|nephew|sister|brother|sibling|baby|infant|juvenile|youth|ward|born|step(?:mother|father|son|daughter)|guardian|custod\w+|paternity|victim|protected)\b", re.I)
PERSON = re.compile(r"\b([A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?)\b")
NOT_PEOPLE = re.compile(r"\b(Nation|Tribe|Tribal|Court|Courts|Code|Rules?|Department|Division|Services|Office|Council|Supreme|District|Family|Appeals?|Chapter|County|State|United|States|Act|Law|Indian|Navajo|Hopi|Children|Child|Trust|Fund|Justice|Judge|Section|Title|Social|Health|Program|Reservation|Agency|Bureau|Affairs|Center|School|Police|Peacemaking|Ordinance|Resolution|Constitution|Article|American|Window|Rock|Juvenile|Mental|Mr|Ms|Mrs|Dr|The|In|See|Id|But|And|On|At|For|If|When|After|Before|This|That|Under|While|Because)\b")


def suspects(text: str, entry: dict) -> list[str]:
    """Two-word capitalized names near a family or child word that the map does not mention: for a person to check."""
    known = {normalize(k).lower() for k in entry.get("keep", [])}
    for person in entry.get("people", []):
        known |= {normalize(v).lower() for v in person.get("variants", [])}
    found = set()
    for hit in KIN.finditer(text):
        window = text[max(0, hit.start() - 90):hit.end() + 90]
        for name in PERSON.findall(window):
            if NOT_PEOPLE.search(name) or normalize(name).lower() in known:
                continue
            found.add(normalize(name))
    return sorted(found)


ADJACENT = re.compile(r"(?:\b[A-Z][a-z]{2,}\s+\[[^\]]+\]|\[[^\]]+\]\s+[A-Z][a-z]{2,}\b)")


def check(args) -> None:
    names = json.loads(Path(args.map).read_text(encoding="utf-8"))
    report = {}
    passed = 0
    for key in held_keys():
        entry = names.get(key)
        if entry is None:
            report[key] = {"status": "not in map"}
            continue
        case, fragment, link = opinion_source(key, Path(args.cache))
        redactor = Redactor(entry)
        page = opinions_script.opinion_page(case, fragment, key, link, redactor).decode("utf-8")
        text = visible_text(page)
        problems = leftovers(text, entry)
        # A bracket next to a capitalized word can mean a first name of someone who keeps their name was replaced.
        adjacent = sorted({m.group(0) for m in ADJACENT.finditer(text)})
        report[key] = {
            "status": "pass" if not problems else "fail",
            "problems": problems,
            "replaced": redactor.count,
            "people": len(entry.get("people", [])),
            "unlisted": unlisted_words(text, entry),
            "adjacent": adjacent[:40],
            "skipped": sorted(set(redactor.skipped))[:40],
            "suspects": suspects(text, entry)[:40],
            "caption": Redactor(entry).caption(case.get("name_abbreviation") or case.get("name") or "", case.get("name") or ""),
        }
        passed += not problems
        if args.pages:
            out = Path(args.pages) / (key.replace("/", "__"))
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(page, encoding="utf-8")
    Path(args.report).write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{passed} of {len(report)} pass", file=sys.stderr)


# ------------------------------------------------------------------ file

def file(args) -> None:
    names = json.loads(Path(args.map).read_text(encoding="utf-8"))
    report = json.loads(Path(args.report).read_text(encoding="utf-8"))
    wanted = set(args.keys) if args.keys else None
    filer = opinions_script.CaptureFiler()
    filer.s3.put_object(Bucket=filer.bucket, Key=NAMES_MAP_KEY, ContentType="application/json",
                        Body=json.dumps(names, ensure_ascii=False).encode("utf-8"))
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    with OPINIONS.open(encoding="utf-8", newline="") as handle:
        opinion_rows = list(csv.DictReader(handle))
    by_key = {row["copy_key"]: row for row in opinion_rows}
    done = {}
    if REDACTED.exists():
        with REDACTED.open(encoding="utf-8", newline="") as handle:
            done = {row["key"]: row for row in csv.DictReader(handle)}
    today = datetime.date.today().isoformat()
    filed = 0
    for key in held_keys():
        if wanted is not None and key not in wanted:
            continue
        if report.get(key, {}).get("status") != "pass":
            continue
        entry = names[key]
        case, fragment, link = opinion_source(key, Path(args.cache))
        redactor = Redactor(entry)
        data = opinions_script.opinion_page(case, fragment, key, link, redactor)
        problems = leftovers(visible_text(data.decode("utf-8")), entry)
        if problems:  # checked again on the exact bytes that are filed
            print(f"not filed, still fails: {key}", file=sys.stderr)
            continue
        citations = [c["cite"] for c in case.get("citations", [])]
        court = case["court"]["name"]
        caption = Redactor(entry).caption(case.get("name_abbreviation") or case.get("name") or "", case.get("name") or "")
        row = by_key[key]
        title = f"{caption}, {citations[0] if citations else ''} ({court}, {case.get('decision_date', '')[:4]})"
        # The redacted page replaces the original under the same key, so the
        # original is first kept under a private key that the site never serves.
        original = ORIGINALS_PREFIX + key
        try:
            filer.s3.head_object(Bucket=filer.bucket, Key=original)
        except filer.s3.exceptions.ClientError:
            filer.s3.copy_object(Bucket=filer.bucket, Key=original, CopySource={"Bucket": filer.bucket, "Key": key})
        # The filer copies the override's hold into the row; the hold is lifted first.
        overrides.pop(key, None)
        filer.overrides.pop(key, None)
        filer.file(key, data, {"topic": opinions_script.CAPTURE_TOPIC, "title": title[:300], "nations": row["nations"].replace("; ", ";"),
                               "link": link, "catalog": f"research/tribal-court-opinions/opinions.csv#{case['id']}",
                               "rights": opinions_script.OPINION_RIGHTS, "redistribution": "yes"})
        row["name"] = caption
        done[key] = {"key": key, "case_id": str(case["id"]), "status": "redacted" if redactor.replacements else "nothing to replace",
                     "replaced": str(redactor.count), "checked": today}
        filed += 1
    filer.close()
    OVERRIDES.write_text(json.dumps(overrides, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    with OPINIONS.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=opinions_script.OPINION_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(opinion_rows)
    with REDACTED.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=REDACTED_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(sorted(done.values(), key=lambda r: r["key"]))
    print(f"filed {filed} redacted opinions", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    m = sub.add_parser("merge")
    m.add_argument("--found", required=True, help="folder of the name finders' JSON files (private)")
    m.add_argument("--texts", help="folder of the opinions' plain text, <stem>.txt (private)")
    m.add_argument("--fixes", help="hand corrections, keyed by copy key (private)")
    m.add_argument("--map", required=True, help="where to write the names map (private)")
    c = sub.add_parser("check")
    c.add_argument("--map", required=True)
    c.add_argument("--cache", required=True)
    c.add_argument("--report", required=True, help="private report for spot checks")
    c.add_argument("--pages", help="folder to write the redacted pages to, for reading (private)")
    f = sub.add_parser("file")
    f.add_argument("--map", required=True)
    f.add_argument("--cache", required=True)
    f.add_argument("--report", required=True)
    f.add_argument("--keys", nargs="*", help="only these copy keys")
    args = parser.parse_args()
    {"merge": merge, "check": check, "file": file}[args.command](args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
