#!/usr/bin/env python3
"""Find the lower federal court opinions about Indian law (data tier 2; Trevor,
Nov. 26, 2026: "Start with tier 2. Work to completion").

The Caselaw Access Project (https://static.case.law/) publishes every volume
of the federal reporters it scanned, to about 2019, as a zip of JSON cases.
The tier 2 study (research/analyses/2026-11-26-tier-2-and-3-data-sources.md,
section 2.1) sampled them and estimated about 8,500 Indian law opinions among
1.2 million. This script reads every volume, scores each case with the
study's Indian law terms (scripts/analysis/indian_law_case_sample.py), and
keeps each case that uses any term: its metadata and score in
--work/<reporter>.jsonl and its full JSON in --work/cases/<reporter>.jsonl.gz,
so that a reader can decide which are Indian law cases without downloading
the volumes again.

Steps:
  scan     Read every volume of each federal reporter (resumable: a volume
           already in --work/<reporter>.done is skipped).
  prepare  Lay the results out the way scripts/caselaw/state_court_opinions.py
           reads them (--into/candidates.jsonl and --into/cases/<reporter>/
           <volume>/<file>), so the federal opinions go through the same
           reading, privacy holds, records and copies as the state ones, with
           that script's --courts federal.

Usage:
  python3 scripts/caselaw/federal_indian_law_cases.py scan --work DIR [--reporters f3d,f2d]
  python3 scripts/caselaw/federal_indian_law_cases.py prepare --work DIR --into DIR
"""
from __future__ import annotations

import argparse
import concurrent.futures
import gzip
import io
import json
import sys
import threading
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "analysis"))
from indian_law_case_sample import MARKERS, fetch, volumes  # noqa: E402

# The federal reporters the Caselaw Access Project holds (the study's table).
REPORTERS = ["f3d", "f2d", "f", "f-supp", "f-supp-2d", "f-supp-3d", "f-appx", "f-cas", "us-ct-cl", "cl-ct", "fed-cl"]


def scan_volume(reporter: str, volume: int) -> tuple[int, int, list[dict], list[str]]:
    archive = zipfile.ZipFile(io.BytesIO(fetch(f"https://static.case.law/{reporter}/{volume}.zip")))
    rows, kept, total = [], [], 0
    for name in archive.namelist():
        if not (name.startswith("json/") and name.endswith(".json")):
            continue
        total += 1
        raw = archive.read(name)
        case = json.loads(raw)
        body = case.get("casebody") or {}
        text = (body.get("head_matter") or "") + "\n" + "\n".join((opinion.get("text") or "") for opinion in body.get("opinions", []))
        hits = {key: len(pattern.findall(text)) for key, pattern in MARKERS.items()}
        if not sum(hits.values()):
            continue
        rows.append({"reporter": reporter, "volume": volume, "id": case.get("id"), "name": case.get("name_abbreviation"),
                     "date": case.get("decision_date") or "", "court": (case.get("court") or {}).get("name"),
                     "cite": (case.get("citations") or [{}])[0].get("cite"), "file": name, "score": sum(hits.values()), "hits": hits})
        kept.append(raw.decode("utf-8"))
    return volume, total, rows, kept


def scan(args) -> None:
    work = Path(args.work)
    (work / "cases").mkdir(parents=True, exist_ok=True)
    for reporter in (args.reporters.split(",") if args.reporters else REPORTERS):
        done_file = work / f"{reporter}.done"
        done = {int(line.split()[0]) for line in done_file.read_text().splitlines()} if done_file.exists() else set()
        todo = [volume for volume in volumes(reporter) if volume not in done]
        lock = threading.Lock()
        with open(work / f"{reporter}.jsonl", "a", encoding="utf-8") as rows_out, \
                gzip.open(work / "cases" / f"{reporter}.jsonl.gz", "at", encoding="utf-8") as cases_out, \
                open(done_file, "a", encoding="utf-8") as done_out, concurrent.futures.ThreadPoolExecutor(8) as pool:
            futures = [pool.submit(scan_volume, reporter, volume) for volume in todo]
            for future in concurrent.futures.as_completed(futures):
                try:
                    volume, total, rows, kept = future.result()
                except Exception as problem:  # noqa: BLE001 - the volume stays to do; a rerun tries it again
                    print("failed", reporter, problem, flush=True)
                    continue
                with lock:
                    for row in rows:
                        rows_out.write(json.dumps(row) + "\n")
                    for raw in kept:
                        cases_out.write(raw.replace("\n", " ") + "\n")
                    done_out.write(f"{volume} {total} {len(rows)}\n")
                    done_out.flush()
                    rows_out.flush()
        print(reporter, "done", len(todo), "volumes read", flush=True)


def prepare(args) -> None:
    """Write candidates.jsonl and one JSON file per case in --into, in state_court_opinions.py's layout."""
    work, into = Path(args.work), Path(args.into)
    into.mkdir(parents=True, exist_ok=True)
    count = 0
    with open(into / "candidates.jsonl", "w", encoding="utf-8") as out:
        for reporter in REPORTERS:
            rows = {}
            for line in open(work / f"{reporter}.jsonl", encoding="utf-8"):
                row = json.loads(line)
                rows[row["id"]] = row
            for line in gzip.open(work / "cases" / f"{reporter}.jsonl.gz", "rt", encoding="utf-8"):
                case = json.loads(line)
                row = rows.get(case.get("id"))
                if not row:
                    continue
                file = row["file"].split("/")[-1]
                path = into / "cases" / reporter / str(row["volume"]) / file
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(case), encoding="utf-8")
                out.write(json.dumps({
                    "reporter": reporter, "volume": str(row["volume"]), "file": file, "id": row["id"], "name": row["name"],
                    "date": row["date"], "court": row["court"], "jurisdiction": (case.get("jurisdiction") or {}).get("name"),
                    "citations": [c.get("cite") for c in case.get("citations") or []], "score": row["score"], "hits": row["hits"],
                }) + "\n")
                count += 1
    print(count, "cases laid out in", into)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    command = sub.add_parser("scan")
    command.add_argument("--work", required=True)
    command.add_argument("--reporters")
    command = sub.add_parser("prepare")
    command.add_argument("--work", required=True)
    command.add_argument("--into", required=True)
    args = parser.parse_args()
    {"scan": scan, "prepare": prepare}[args.command](args)


if __name__ == "__main__":
    main()
