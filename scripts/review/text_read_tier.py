"""Confirm the text-read tier of the records a draft is likely to rely on (Gate 1, item 3).

Roadmap Gate 1 item 3 (docs/roadmap.md) asks that every record a draft of the
model code is likely to rely on rest on the nation's own text, read, and that
records read by OCR or through a fetch-and-summarize tool be re-read where they
matter (review queue item 10 in the dispute resolution analysis). The records
in scope are the dispute resolution forums, provisions, clauses, published
materials and training programs in content/tribes/, and the dispute clause
summaries of gaming compacts. Database listings (decision record 0015) are not
in scope.

Subcommands:

  select   List the records in scope that are not yet confirmed: every one
           whose `verification` is not read-in-full; every read-in-full record
           whose own note says its text was not read (a description by the
           Native American Rights Fund, a dead link, a heading only, or a
           fetch-and-summarize tool); and every read-in-full record read by OCR
           or from a garbled text layer. Records this review has already read
           (their note points to the review) are skipped. For each, lists the
           project's captures
           (research/capture-index.csv) that may hold its text. Writes a JSON
           file of candidates.
  apply    Apply the final readings kept in
           research/reviews/2026-11-23-text-read-tier.json to the profiles and
           to the nations' dispute resolution search logs.

Profiles are changed by replacing only the lines of the record that changed,
so the rest of each file keeps its existing layout.

Usage:
  python3 scripts/review/text_read_tier.py select --out candidates.json
  python3 scripts/review/text_read_tier.py apply
"""

from __future__ import annotations

import argparse
import collections
import csv
import json
import pathlib
import re
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
REVIEW = ROOT / "research/reviews/2026-11-23-text-read-tier.json"
SEARCH_LOGS = ROOT / "research/search-logs/dispute-resolution"
SESSION = "2026-11-23-text-read-tier"
TODAY = "2026-11-23"
SECTIONS = ("forums", "provisions", "clauses", "published_materials", "training_programs")
NOT_READ = re.compile(
    r"provision itself not read|text not read|not reviewed|fetch-and-summarize|only through an automated summary|contents not reviewed",
    re.IGNORECASE,
)
OCR = re.compile(r"OCR|scanned|garbled|text layer", re.IGNORECASE)
REVIEWED = "Gate 1 item 3 review"  # pointer this review adds to every record it read


def dump_item(item: dict) -> str:
    return yaml.safe_dump([item], allow_unicode=True, sort_keys=False, width=10**9)


def item_span(lines: list[str], top: str, sub: str, index: int) -> tuple[int, int, str]:
    """Return the first and past-the-end line of list item `index` of `top.sub`, and its indent."""
    i = next(n for n, line in enumerate(lines) if line.rstrip("\n") == f"{top}:")
    sub_line = None
    for n in range(i + 1, len(lines)):
        line = lines[n]
        if line.strip() and not line.startswith(" ") and not line.startswith("-"):
            break
        if re.match(rf"^  {re.escape(sub)}:\s*$", line):
            sub_line = n
            break
    if sub_line is None:
        raise KeyError(f"{top}.{sub} not found")
    starts = []
    indent = None
    end = len(lines)
    for n in range(sub_line + 1, len(lines)):
        line = lines[n]
        m = re.match(r"^( *)- ", line)
        if m and (indent is None or len(m.group(1)) == indent):
            if indent is None:
                indent = len(m.group(1))
            starts.append(n)
            continue
        if line.strip() and indent is not None:
            lead = len(line) - len(line.lstrip(" "))
            if lead < indent + 2 and not line.lstrip().startswith("- "):
                end = n
                break
            if lead < indent:
                end = n
                break
    start = starts[index]
    stop = starts[index + 1] if index + 1 < len(starts) else end
    return start, stop, " " * indent


def replace_item(text: str, top: str, sub: str, index: int, item: dict) -> str:
    lines = text.splitlines(keepends=True)
    start, stop, indent = item_span(lines, top, sub, index)
    new = "".join(indent + line if line.strip() else line for line in dump_item(item).splitlines(keepends=True))
    return "".join(lines[:start]) + new + "".join(lines[stop:])


def category(fact: dict) -> str | None:
    note = fact.get("note") or ""
    if fact.get("verification") != "read-in-full":
        return "unread:" + str(fact.get("verification"))
    if REVIEWED in note:
        return None
    if NOT_READ.search(note):
        return "mislabeled"
    if OCR.search(note):
        return "ocr"
    return None


def records():
    for path in sorted((ROOT / "content/tribes").glob("*/*.yaml")):
        profile = yaml.safe_load(path.read_text(encoding="utf-8"))
        practice = profile.get("dispute_resolution") or {}
        for sub in SECTIONS:
            for index, fact in enumerate(practice.get(sub) or []):
                yield path, profile, "dispute_resolution", sub, index, fact
        for index, fact in enumerate((profile.get("gaming") or {}).get("compacts") or []):
            if "dispute_resolution_summary" in fact:
                yield path, profile, "gaming", "compacts", index, fact


def select(args) -> None:
    captures = list(csv.DictReader((ROOT / "research/capture-index.csv").open(encoding="utf-8")))
    by_record = collections.defaultdict(list)
    by_nation = collections.defaultdict(list)
    for row in captures:
        if row["key"].endswith((".json", ".raw")) or row["title"].startswith("Just a moment"):
            continue
        for key in filter(None, (s.strip() for s in row["records"].split(";"))):
            by_record[key].append(row)
        for nation in filter(None, (s.strip() for s in row["nations"].split(";"))):
            by_nation[nation].append(row)
    out = []
    for path, profile, top, sub, index, fact in records():
        kind = category(fact)
        if not kind:
            continue
        nation = profile["id"]
        seen, candidates = set(), []
        for row in by_record.get(fact.get("source") or "", []) + by_nation.get(nation, []):
            if row["key"] in seen or row["topic"] == "nation-images":
                continue
            if (sub == "compacts") != (row["topic"] == "gaming"):
                continue
            seen.add(row["key"])
            candidates.append({"key": row["key"], "title": row["title"], "topic": row["topic"], "captured": row["captured"][:10]})
        out.append({
            "profile": str(path.relative_to(ROOT)), "section": f"{top}.{sub}", "index": index,
            "category": kind, "record": fact, "candidates": candidates,
        })
    pathlib.Path(args.out).write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(collections.Counter(item["category"] for item in out))


def apply(args) -> None:
    review = json.loads(REVIEW.read_text(encoding="utf-8"))
    for source in review.get("new_sources", []):
        key = source["key"]
        folder = key[0] if key[0].isalpha() else "_other"
        path = ROOT / "content/sources" / folder / f"{key}.yaml"
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(yaml.safe_dump(source, allow_unicode=True, sort_keys=False, width=10**9), encoding="utf-8")
    by_profile = collections.defaultdict(list)
    for item in review["records"]:
        by_profile[item["profile"]].append(item)
    changed = 0
    for rel, items in sorted(by_profile.items()):
        path = ROOT / rel
        text = path.read_text(encoding="utf-8")
        profile = yaml.safe_load(text)
        for item in sorted(items, key=lambda it: (it["section"], it["index"]), reverse=True):
            top, sub = item["section"].split(".")
            fact = profile[top][sub][item["index"]]
            if fact.get("source") != item["record_before"].get("source") or (fact.get("title") or fact.get("name") or fact.get("citation")) != (
                item["record_before"].get("title") or item["record_before"].get("name") or item["record_before"].get("citation")
            ):
                sys.exit(f"{rel} {item['section']}[{item['index']}] changed since the review; re-run select")
            new = dict(fact)
            for field, value in (item.get("apply") or {}).items():
                if value is None:
                    new.pop(field, None)
                else:
                    new[field] = value
            if new != fact:
                text = replace_item(text, top, sub, item["index"], new)
                profile[top][sub][item["index"]] = new
                changed += 1
        check = yaml.safe_load(text)
        if check != profile:
            sys.exit(f"{rel}: splice changed more than the reviewed records")
        path.write_text(text, encoding="utf-8")
    print(f"records changed: {changed}")
    logs = 0
    for item in review["records"]:
        searches = item.get("searches") or []
        if not searches:
            continue
        profile_path = ROOT / item["profile"]
        nation = profile_path.stem
        letter = nation[0] if nation[0].isalpha() else "_other"
        log_path = SEARCH_LOGS / letter / f"{nation}.yaml"
        if log_path.exists():
            log = yaml.safe_load(log_path.read_text(encoding="utf-8"))
        else:
            log = {"profile": item["profile"], "topic": "dispute-resolution", "status": "not-searched", "last_searched": TODAY, "searches": []}
        seen = {json.dumps(entry, sort_keys=True) for entry in log["searches"]}
        for entry in searches:
            entry = {k: v for k, v in entry.items() if v not in (None, "")}
            marker = json.dumps(entry, sort_keys=True)
            if marker not in seen:
                log["searches"].append(entry)
                seen.add(marker)
        log["last_searched"] = TODAY
        if any(entry.get("outcome") == "found" for entry in log["searches"]):
            log["status"] = "found"
        elif log.get("status") == "not-searched":
            log["status"] = "partly-searched"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text(yaml.safe_dump(log, allow_unicode=True, sort_keys=False, width=100), encoding="utf-8")
        logs += 1
    print(f"search log updates: {logs}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("select")
    p.add_argument("--out", required=True)
    sub.add_parser("apply")
    args = parser.parse_args()
    {"select": select, "apply": apply}[args.command](args)


if __name__ == "__main__":
    main()
