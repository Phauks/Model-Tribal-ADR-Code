"""Write the Wayback Worker's list of links to save, and turn its captures into an archive report.

The Wayback Worker (site/wayback, site/WAYBACK.md) saves links with the
project's archive.org keys, which live only in Cloudflare. It reads its list
from research/wayback-queue.tsv on main, and lists what it captured at
https://model-tribal-adr-code-wayback.trevordgoldsmith.workers.dev/captures.json.

  python3 scripts/captures/wayback_queue.py --write
      Rewrites research/wayback-queue.tsv: every source record with an
      'original_link' and no archived copy, except links already on
      archive.org and Federal Register pages (federalregister.gov refuses
      Save Page Now; scripts/find_archived_copies.py reuses older copies of
      those).

  python3 scripts/captures/wayback_queue.py --report WORKER_JSON OUT_JSON
      Turns the Worker's captures.json into the report format
      scripts/apply_archive_report.py reads, for records that still have no
      archived copy and whose link has not changed.

Run from the repository root. Uses the Python standard library and PyYAML.
"""

import json
import pathlib
import sys
import urllib.parse

import yaml

QUEUE = pathlib.Path("research/wayback-queue.tsv")
SKIPPED_HOSTS = ("archive.org", "federalregister.gov")


def on_hosts(link: str, hosts) -> bool:
    host = (urllib.parse.urlsplit(link).hostname or "").removeprefix("www.")
    return any(host == known or host.endswith("." + known) for known in hosts)


def records_without_copies():
    for path in sorted(pathlib.Path("content/sources").glob("*/*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        link = str(record.get("original_link") or "").strip()
        if link and not record.get("archives"):
            yield path, link


def write_queue() -> int:
    rows = [(path.stem, link) for path, link in records_without_copies() if not on_hosts(link, SKIPPED_HOSTS) and "\t" not in link]
    QUEUE.write_text("record\tlink\n" + "".join(f"{key}\t{link}\n" for key, link in rows), encoding="utf-8")
    print(f"Wrote {len(rows)} links to {QUEUE}.")
    return 0


def write_report(worker_json: str, out_json: str) -> int:
    try:
        captures = json.loads(pathlib.Path(worker_json).read_text(encoding="utf-8")).get("captures", [])
    except (OSError, ValueError, AttributeError):
        captures = []
    waiting = {path.stem: (path, link) for path, link in records_without_copies()}
    rows = []
    for row in captures:
        found = waiting.get(row.get("key"))
        if not found or found[1] != row.get("original_link") or not row.get("capture"):
            continue
        path, link = found
        rows.append({"key": path.stem, "path": str(path), "original_link": link, "capture": row["capture"], "problem": None})
    pathlib.Path(out_json).write_text(json.dumps(rows, indent=1) + "\n", encoding="utf-8")
    print(f"{len(rows)} Worker captures to write into records.")
    return 0


def main(arguments: list[str]) -> int:
    if arguments == ["--write"]:
        return write_queue()
    if len(arguments) == 3 and arguments[0] == "--report":
        return write_report(arguments[1], arguments[2])
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
