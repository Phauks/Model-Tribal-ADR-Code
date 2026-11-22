"""Copy Wayback Machine captures from an archive report into source records.

scripts/find_archived_copies.py --report FILE lists, for each source record it
tried, the capture it made or found. This script writes each capture into its
record's empty 'archives' list, replacing only the line `archives: []` (and any
comment on it), or adding the list where a record has none, so the rest of the
record is left exactly as it was. A record
that already has an archived copy, or a report row with no capture, is left
alone. The archive workflow's catch-up job runs it and opens a pull request,
so every change stays reviewable.

Run from the repository root:
  python3 scripts/apply_archive_report.py archive-report.json [more reports ...]
Uses only the Python standard library.
"""

import json
import pathlib
import re
import sys

EMPTY = re.compile(r"^archives: \[\][^\n]*$", re.MULTILINE)


def main(arguments: list[str]) -> int:
    if not arguments:
        print(__doc__)
        return 2
    written = 0
    for report in arguments:
        for row in json.loads(pathlib.Path(report).read_text(encoding="utf-8")):
            capture = row.get("capture")
            path = pathlib.Path(row.get("path") or "")
            if not capture or not path.is_file():
                continue
            text = path.read_text(encoding="utf-8")
            block = (
                "archives:\n"
                f"- service: {capture['service']}\n"
                f"  link: {capture['link']}\n"
                f"  captured: '{capture['captured']}'"
            )
            if EMPTY.search(text):
                text = EMPTY.sub(lambda _: block, text, count=1)
            elif not re.search(r"^archives:", text, re.MULTILINE):
                # A few records have no 'archives' key at all: add it before 'history'.
                if re.search(r"^history:", text, re.MULTILINE):
                    text = re.sub(r"^history:", lambda _: block + "\nhistory:", text, count=1, flags=re.MULTILINE)
                else:
                    text = text.rstrip("\n") + "\n" + block + "\n"
            else:
                continue
            path.write_text(text, encoding="utf-8")
            written += 1
    print(f"Wrote captures into {written} source records.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
