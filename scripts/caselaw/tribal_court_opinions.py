#!/usr/bin/env python3
"""Index the tribal court opinions in the Caselaw Access Project's free files.

Reads the reporters, courts and topics in research/tribal-court-opinions/sources.yaml,
downloads each volume's zip from static.case.law (no account or key; released
without restriction in March 2024), and writes:

- research/tribal-court-opinions/opinions.csv: one row per tribal court opinion
  (federal and state decisions reprinted in these reporters are left out) with
  its citation, court, date, the Native nations the court belongs to, topic
  tags and where the private copy is.
- research/tribal-court-opinions/cites-to-records.csv: each time an opinion
  cites a case that has a source record in content/sources/, for "cited by
  tribal courts" lists.
- research/tribal-court-opinions/counts.json: totals by nation, court and topic.
- With --private FOLDER, snippets.json there: a few lines around each topic
  word, for reading without opening every opinion. Opinion text stays out of
  the repository.

With --file-captures, each volume zip is also filed as a private capture in the
R2 bucket through scripts/captures/mirror_captures.py (topic
caselaw-access-project, redistribution "no" until the lead author decides
whether the website shows these opinions). Filing skips a zip already filed
with the same SHA-256, so the script can be re-run whenever the Caselaw Access
Project updates a volume or a reporter is added to the settings.

Run from the repository root:

    python3 scripts/caselaw/tribal_court_opinions.py --cache ~/caselaw-cache \
        [--private /mnt/project-files/research/tribal-court-opinions] \
        [--file-captures --captures /mnt/project-files/research/captures]
"""

from __future__ import annotations

import argparse
import csv
import datetime
import hashlib
import json
import re
import subprocess
import sys
import zipfile
from collections import Counter
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from caselaw_sources import cap_case_link, cap_volume_zip, cap_volumes, record_citations  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / "research" / "tribal-court-opinions"
SETTINGS = FOLDER / "sources.yaml"
SOURCES = ROOT / "content" / "sources"
TRIBES = ROOT / "content" / "tribes"
CAPTURE_INDEX = ROOT / "research" / "capture-index.csv"
CAPTURE_TOPIC = "caselaw-access-project"
OPINION_FIELDS = ["case_id", "citation", "other_citations", "name", "decision_date", "court", "nations",
                  "docket_number", "words", "topics", "reporter", "volume", "capture_key", "link"]
CITE_FIELDS = ["case_id", "citation", "name", "decision_date", "nations", "cites", "record", "times"]
SNIPPET_CHARS = 240


def load_settings() -> dict:
    settings = yaml.safe_load(SETTINGS.read_text(encoding="utf-8"))
    known = {p.stem for p in TRIBES.rglob("*.yaml")}
    for rule in settings["courts"]:
        rule["regex"] = re.compile(rule["court"], re.I)
        missing = [n for n in rule["nations"] if n not in known]
        if missing:
            sys.exit(f"sources.yaml names nations with no profile: {', '.join(missing)}")
    for topic in settings["topics"]:
        topic["regex"] = re.compile(topic["pattern"], re.I)
    return settings


def nations_for(court: str, settings: dict) -> list[str]:
    for rule in settings["courts"]:
        if rule["regex"].match(court):
            return rule["nations"]
    return []


def is_tribal(case: dict, settings: dict) -> bool:
    """Tribal court opinions only: the reporters also reprint federal and state decisions."""
    court = case["court"]["name"]
    if nations_for(court, settings):
        return True
    return not re.search(r"\b(United States|Supreme Court of the United States|Circuit|District of|State of)\b", court)


def record_index() -> dict[str, str]:
    """'volume reporter page' -> source record key, for every case record."""
    index = {}
    for path in SOURCES.rglob("*.yaml"):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if record and str(record.get("kind", "")).endswith("case"):
            for cite in record_citations(record):
                index.setdefault(" ".join(cite), record["key"])
    return index


def filed_captures() -> dict[str, str]:
    """SHA-256 -> capture key, from the capture index."""
    if not CAPTURE_INDEX.exists():
        return {}
    with CAPTURE_INDEX.open(encoding="utf-8", newline="") as handle:
        return {row["sha256"]: row["key"] for row in csv.DictReader(handle)}


def file_capture(zip_path: Path, reporter: dict, volume: dict, captures: Path, filed: dict[str, str]) -> str:
    digest = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    if digest in filed:
        return filed[digest]
    name = f"{reporter['slug']}/{volume['volume_folder']}.zip"
    if f"{CAPTURE_TOPIC}/{name}" in filed.values():  # same volume, changed since: keep both
        name = f"{reporter['slug']}/{volume['volume_folder']}-{datetime.date.today().isoformat()}.zip"
    link = f"https://static.case.law/{reporter['slug']}/{volume['volume_folder']}.zip"
    subprocess.run([sys.executable, str(ROOT / "scripts" / "captures" / "mirror_captures.py"), "add",
                    "--captures", str(captures), "--topic", CAPTURE_TOPIC, "--name", name,
                    "--obtained", "Caselaw Access Project static files (static.case.law)",
                    "--title", f"{reporter['name']}, volume {volume['volume_number']} (Caselaw Access Project)",
                    "--link", link, "--redistribution", "no",
                    "--rights", "Released by the Harvard Library Innovation Lab without restriction (Mar. 2024); "
                                "publisher headnotes removed. Private until the lead author decides on display.",
                    str(zip_path)], check=True)
    key = f"{CAPTURE_TOPIC}/{name}"
    filed[digest] = key
    return key


def opinion_text(case: dict) -> str:
    return "\n\n".join(o.get("text", "") for o in (case.get("casebody") or {}).get("opinions", []))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache", required=True, type=Path, help="folder for the downloaded volume zips (outside the repository)")
    parser.add_argument("--private", type=Path, help="folder for snippets.json (outside the repository)")
    parser.add_argument("--file-captures", action="store_true", help="file each zip in the private R2 captures")
    parser.add_argument("--captures", type=Path, help="the research/captures folder, needed with --file-captures")
    arguments = parser.parse_args()
    if arguments.file_captures and not arguments.captures:
        parser.error("--file-captures needs --captures")

    settings = load_settings()
    records = record_index()
    filed = filed_captures()
    opinions, cites, snippets = [], [], []
    unmapped: Counter = Counter()

    for reporter in settings["reporters"]:
        for volume in sorted(cap_volumes(reporter["slug"]), key=lambda v: int(re.sub(r"\D", "", v["volume_number"]) or 0)):
            zip_path = cap_volume_zip(reporter["slug"], volume["volume_folder"], arguments.cache)
            capture_key = ""
            if arguments.file_captures:
                capture_key = file_capture(zip_path, reporter, volume, arguments.captures, filed)
            else:
                capture_key = filed.get(hashlib.sha256(zip_path.read_bytes()).hexdigest(), "")
            with zipfile.ZipFile(zip_path) as archive:
                for member in sorted(n for n in archive.namelist() if n.startswith("json/") and n.endswith(".json")):
                    case = json.loads(archive.read(member))
                    if not is_tribal(case, settings):
                        continue
                    court = case["court"]["name"]
                    nations = nations_for(court, settings)
                    if not nations:
                        unmapped[court] += 1
                    text = opinion_text(case)
                    citations = [c["cite"] for c in case.get("citations", [])]
                    topics = []
                    for topic in settings["topics"]:
                        hits = list(topic["regex"].finditer(text))
                        if not hits:
                            continue
                        topics.append(topic["tag"])
                        for hit in hits[:3]:
                            start = max(0, hit.start() - SNIPPET_CHARS)
                            snippets.append({"case_id": case["id"], "citation": citations[0] if citations else "",
                                             "topic": topic["tag"],
                                             "text": re.sub(r"\s+", " ", text[start:hit.end() + SNIPPET_CHARS]).strip()})
                    file_name = Path(member).stem
                    row = {
                        "case_id": case["id"], "citation": citations[0] if citations else "",
                        "other_citations": "; ".join(citations[1:]), "name": case.get("name_abbreviation") or case.get("name"),
                        "decision_date": case.get("decision_date", ""), "court": court, "nations": "; ".join(nations),
                        "docket_number": case.get("docket_number", ""), "words": len(text.split()),
                        "topics": "; ".join(topics), "reporter": reporter["slug"], "volume": volume["volume_number"],
                        "capture_key": capture_key,
                        "link": cap_case_link(reporter["slug"], volume["volume_folder"], file_name),
                    }
                    opinions.append(row)
                    seen: Counter = Counter()
                    for cited in case.get("cites_to", []):
                        key = records.get(re.sub(r"\s+", " ", cited.get("cite", "")))
                        if key:
                            seen[(cited["cite"], key)] += 1
                    for (cite, key), times in sorted(seen.items()):
                        cites.append({"case_id": case["id"], "citation": row["citation"], "name": row["name"],
                                      "decision_date": row["decision_date"], "nations": row["nations"],
                                      "cites": cite, "record": key, "times": times})

    opinions.sort(key=lambda r: (r["decision_date"], r["citation"]))
    cites.sort(key=lambda r: (r["record"], r["decision_date"], r["citation"]))
    FOLDER.mkdir(parents=True, exist_ok=True)
    for name, fields, rows in (("opinions.csv", OPINION_FIELDS, opinions), ("cites-to-records.csv", CITE_FIELDS, cites)):
        with (FOLDER / name).open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)

    by_nation: Counter = Counter()
    for row in opinions:
        for nation in row["nations"].split("; ") if row["nations"] else ["(no nation)"]:
            by_nation[nation] += 1
    counts = {
        "generated": datetime.date.today().isoformat(),
        "reporters": [r["slug"] for r in settings["reporters"]],
        "opinions": len(opinions),
        "date_range": [opinions[0]["decision_date"], opinions[-1]["decision_date"]] if opinions else [],
        "nations": dict(by_nation.most_common()),
        "courts": dict(Counter(r["court"] for r in opinions).most_common()),
        "topics": dict(Counter(t for r in opinions for t in r["topics"].split("; ") if t).most_common()),
        "records_cited": dict(Counter(c["record"] for c in cites).most_common()),
        "courts_with_no_nation": dict(unmapped.most_common()),
    }
    (FOLDER / "counts.json").write_text(json.dumps(counts, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if arguments.private:
        arguments.private.mkdir(parents=True, exist_ok=True)
        (arguments.private / "snippets.json").write_text(json.dumps(snippets, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(opinions)} opinions from {len(by_nation)} nations; {len(cites)} citations of {len(counts['records_cited'])} case records",
          file=sys.stderr)
    if unmapped:
        print("courts with no nation (add a rule to sources.yaml): " + ", ".join(unmapped), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
