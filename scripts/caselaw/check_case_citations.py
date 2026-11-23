#!/usr/bin/env python3
"""Check every case source record's citation against CourtListener's public bulk data.

For each record of a case (kind federal-case, state-case, territorial-case or
tribal-case), the script takes the citation in its `citation` block and any
other citations its notes give (parallel cites such as "612 N.W.2d 709"),
looks each one up in CourtListener's citations table, and compares the case
CourtListener files under that citation with the record: the case name and
the year. It uses the quarterly bulk files (no account or key; Public Domain
Mark), and picks the newest release on its own, so it can be re-run each
quarter or whenever case records are added.

Outputs:

- research/reviews/YYYY-MM-DD-case-citations-courtlistener.csv (the run's
  date): one row per record, with status `matched`, `name-differs`,
  `year-differs`, `not-found` or `no-citation`, what CourtListener has, and
  the release checked. A later run sits beside earlier ones.
- With --apply, a `courtlistener` block in each matched record (schema:
  schemas/source.schema.json), placed before `rights:`, replacing any older
  block. Records whose name or year differs are never written; they wait for
  a person to read them.

The CourtListener identifier in that block is what later uses build on:
links to CourtListener, the citation graph and its parentheticals.

Run from the repository root (about 3 GB of downloads the first time; later
runs reuse the cache while the release is unchanged):

    python3 scripts/caselaw/check_case_citations.py --cache ~/caselaw-cache [--apply] [--release YYYY-MM-DD]
    python3 scripts/caselaw/check_case_citations.py --apply-report   # write the blocks from the last report, no downloads
"""

from __future__ import annotations

import argparse
import csv
import datetime
import json
import re
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from caselaw_sources import (  # noqa: E402
    bulk_url, download, latest_release, names_agree, read_bulk_csv, record_citations,
)

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "content" / "sources"
REVIEWS = ROOT / "research" / "reviews"
REPORT_NAME = "case-citations-courtlistener.csv"  # prefixed with the run date, as every review file is
CASE_KINDS = {"federal-case", "state-case", "territorial-case", "tribal-case"}
FIELDS = ["key", "kind", "title", "year", "citations_tried", "status", "matched_citation",
          "courtlistener_cluster", "courtlistener_name", "courtlistener_date", "courtlistener_link", "release", "checked"]


def case_records() -> list[tuple[Path, dict]]:
    records = []
    for path in sorted(SOURCES.rglob("*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if record and record.get("kind") in CASE_KINDS:
            records.append((path, record))
    return records


def record_year(record: dict) -> int | None:
    parts = (((record.get("citation") or {}).get("issued") or {}).get("date-parts") or [[None]])[0]
    return int(parts[0]) if parts and parts[0] else None


def block_yaml(row: dict) -> str:
    return "\n".join([
        "courtlistener:",
        f"  cluster: {row['courtlistener_cluster']}",
        f"  citation: {json.dumps(row['matched_citation'], ensure_ascii=False)}",
        f"  case_name: {json.dumps(row['courtlistener_name'], ensure_ascii=False)}",
        f"  link: {row['courtlistener_link']}",
        f"  release: '{row['release']}'",
        f"  checked: '{row['checked']}'",
    ]) + "\n"


def write_block(path: Path, row: dict) -> None:
    """Put the courtlistener block before `rights:`, replacing an older one."""
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"(?m)^courtlistener:\n(?:  .*\n)*", "", text)
    if "\nrights:\n" in text:
        text = text.replace("\nrights:\n", "\n" + block_yaml(row) + "rights:\n", 1)
    else:
        text = text.rstrip("\n") + "\n" + block_yaml(row)
    path.write_text(text, encoding="utf-8")


def apply_report() -> int:
    """Write the blocks for the matched rows of the last report, after a person has read it."""
    reports = sorted(REVIEWS.glob(f"*-{REPORT_NAME}"))
    if not reports:
        sys.exit("no report yet: run the check first")
    report = reports[-1]
    paths = {record["key"]: path for path, record in case_records()}
    written = 0
    with report.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if row["status"] == "matched" and row["key"] in paths:
                write_block(paths[row["key"]], row)
                written += 1
    print(f"wrote {written} courtlistener blocks from {report.relative_to(ROOT)}", file=sys.stderr)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache", type=Path, help="folder for the downloaded bulk files (outside the repository)")
    parser.add_argument("--release", help="a release date such as 2026-09-30 (default: the newest)")
    parser.add_argument("--apply", action="store_true", help="write a courtlistener block into each matched record")
    parser.add_argument("--apply-report", action="store_true", help="only write the blocks from the last report, without downloading")
    arguments = parser.parse_args()
    if arguments.apply_report:
        return apply_report()
    if not arguments.cache:
        parser.error("--cache is needed to check citations")

    release = arguments.release or latest_release(["citations", "opinion-clusters"])
    today = datetime.date.today().isoformat()
    print(f"CourtListener release {release}", file=sys.stderr)

    records = case_records()
    wanted: dict[tuple[str, str, str], list[str]] = {}
    tried: dict[str, list[tuple[str, str, str]]] = {}
    for _, record in records:
        cites = record_citations(record)
        tried[record["key"]] = cites
        for cite in cites:
            wanted.setdefault(cite, []).append(record["key"])

    # Pass 1: citations table (volume, reporter, page -> cluster).
    citations_file = download(bulk_url("citations", release), arguments.cache / f"citations-{release}.csv.bz2")
    clusters_for: dict[tuple[str, str, str], set[int]] = {}
    for row in read_bulk_csv(citations_file):
        cite = (row["volume"], row["reporter"], row["page"])
        if cite in wanted:
            clusters_for.setdefault(cite, set()).add(int(row["cluster_id"]))
    print(f"{len(clusters_for)} of {len(wanted)} citations found in the citations table", file=sys.stderr)

    # Pass 2: opinion clusters (cluster -> name, date, slug).
    needed = set().union(*clusters_for.values()) if clusters_for else set()
    clusters_file = download(bulk_url("opinion-clusters", release), arguments.cache / f"opinion-clusters-{release}.csv.bz2")
    cluster_info: dict[int, dict] = {}
    for row in read_bulk_csv(clusters_file):
        if row["id"].isdigit() and int(row["id"]) in needed:
            cluster_info[int(row["id"])] = {
                "name": row["case_name"] or row["case_name_full"] or row["case_name_short"],
                "date": row["date_filed"], "slug": row["slug"],
            }
            if len(cluster_info) == len(needed):
                break

    rows = []
    for path, record in records:
        title = (record.get("citation") or {}).get("title") or record["key"]
        year = record_year(record)
        row = {"key": record["key"], "kind": record["kind"], "title": title, "year": year or "",
               "citations_tried": "; ".join(" ".join(c) for c in tried[record["key"]]),
               "status": "no-citation" if not tried[record["key"]] else "not-found",
               "matched_citation": "", "courtlistener_cluster": "", "courtlistener_name": "",
               "courtlistener_date": "", "courtlistener_link": "", "release": release, "checked": today}
        best = None
        for cite in tried[record["key"]]:
            for cluster in sorted(clusters_for.get(cite, ())):
                info = cluster_info.get(cluster)
                if not info:
                    continue
                name_ok = names_agree(title, info["name"])
                year_ok = not year or not info["date"] or abs(int(info["date"][:4]) - year) <= 1
                rank = (name_ok and year_ok, name_ok, year_ok)
                if best is None or rank > best[0]:
                    best = (rank, cite, cluster, info)
        if best:
            (both, name_ok, year_ok), cite, cluster, info = best
            row.update({
                "status": "matched" if both else ("name-differs" if not name_ok else "year-differs"),
                "matched_citation": " ".join(cite), "courtlistener_cluster": cluster,
                "courtlistener_name": info["name"], "courtlistener_date": info["date"],
                "courtlistener_link": f"https://www.courtlistener.com/opinion/{cluster}/{info['slug']}/",
            })
        rows.append(row)
        if arguments.apply and row["status"] == "matched":
            write_block(path, row)

    report = REVIEWS / f"{today}-{REPORT_NAME}"
    with report.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    counts: dict[str, int] = {}
    for row in rows:
        counts[row["status"]] = counts.get(row["status"], 0) + 1
    print(", ".join(f"{k} {v}" for k, v in sorted(counts.items())), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
