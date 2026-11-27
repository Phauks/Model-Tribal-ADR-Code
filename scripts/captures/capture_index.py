"""
The capture index (research/capture-index.csv): one row for each file the project keeps, kept in order of its key.

Every script that writes the index writes it through write_rows, which puts the rows in key order. Rows that were
once added at the end of the file put every open pull request that filed copies in the same place, so each one that
landed made the others conflict; in key order a new row goes beside its neighbors and two filings rarely touch the same
lines (Nov. 27, 2026). The site tools that add rows (site/tools/capture-index.mjs) keep the same order.

  python3 scripts/captures/capture_index.py --check   fail when the rows are out of key order or a key repeats
  python3 scripts/captures/capture_index.py --sort    put the rows in key order, changing nothing else
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections.abc import Iterable, Sequence
from itertools import pairwise
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
INDEX = REPO / "research" / "capture-index.csv"

FIELDS = [
    "key", "bytes", "sha256", "media_type", "topic", "title", "nations",
    "obtained", "link", "captured", "records", "record_kinds", "listed_in",
    "catalog", "derived_from", "rights", "redistribution", "keep_local", "orphan",
]


def read_rows(path: Path = INDEX) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def in_key_order(rows: Iterable[dict]) -> list[dict]:
    """The rows in order of their key, comparing keys character by character. Rows with the same key keep their order."""
    return sorted(rows, key=lambda row: row["key"])


def write_rows(rows: Iterable[dict], fieldnames: Sequence[str] = FIELDS, path: Path = INDEX) -> list[dict]:
    """Write the index with its rows in key order, and give back the rows in that order."""
    ordered = in_key_order(rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(fieldnames), lineterminator="\n")
        writer.writeheader()
        writer.writerows(ordered)
    return ordered


def order_problems(rows: Sequence[dict]) -> list[str]:
    """Each place where a row's key does not come after the key of the row above it (rows counted from 1, below the header)."""
    problems = []
    for number, (above, row) in enumerate(pairwise(rows), start=2):
        if row["key"] == above["key"]:
            problems.append(f"row {number}: {row['key']} is listed twice")
        elif row["key"] < above["key"]:
            problems.append(f"row {number}: {row['key']} comes before {above['key']}")
    return problems


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--check", action="store_true", help="fail when the rows are out of key order or a key repeats")
    action.add_argument("--sort", action="store_true", help="put the rows in key order")
    parser.add_argument("--index", type=Path, default=INDEX, help="the index file (default: research/capture-index.csv)")
    args = parser.parse_args()

    with args.index.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or FIELDS
        rows = list(reader)
    if args.sort:
        write_rows(rows, fieldnames, args.index)
        print(f"{len(rows)} rows in key order in {args.index.name}")
        return
    problems = order_problems(rows)
    if problems:
        shown = problems[:20]
        more = f"\n... and {len(problems) - len(shown)} more" if len(problems) > len(shown) else ""
        sys.exit(f"{args.index.name} is not in key order:\n" + "\n".join(shown) + more
                 + "\nRun python3 scripts/captures/capture_index.py --sort to fix it.")
    print(f"{len(rows)} rows in key order, each key once")


if __name__ == "__main__":
    main()
