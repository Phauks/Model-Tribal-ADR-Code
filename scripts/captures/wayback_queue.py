"""Write the Wayback Worker's list of links to save, and turn its captures into an archive report.

The Wayback Worker (site/wayback, site/WAYBACK.md) saves links with the
project's archive.org keys, which live only in Cloudflare. It reads its list
from research/wayback-queue.tsv on main, and lists what it captured at
https://tribal-law-project-wayback.trevordgoldsmith.workers.dev/captures.json.

  python3 scripts/captures/wayback_queue.py --write
      Rewrites research/wayback-queue.tsv: every source record with an
      'original_link' and no archived copy, except links already on
      archive.org and Federal Register and eCFR pages (both send Save Page
      Now to unblock.federalregister.gov; scripts/find_archived_copies.py
      reuses older copies of those). The Worker works down the list in
      order, so the most important records come first (priority()).

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
SKIPPED_HOSTS = ("archive.org", "federalregister.gov", "ecfr.gov")

# The order the Worker saves links in. First: nations' own laws, constitutions, court rules and
# opinions, which live on nations' websites and are the likeliest to move or vanish, and the federal
# core (tier 1: Supreme Court cases, treaties and other federal agreements, statutes, executive orders,
# Federal Register notices). Then the rest of federal and state law and agencies' documents (tier 2).
# Last: state court opinions from the Caselaw Access Project's fixed copies, Oklahoma's state-tribal
# agreements (tier 3) and secondary sources such as articles and books.
FIRST_KINDS = {"tribal-constitution", "tribal-code", "tribal-court-rule", "tribal-case", "federal-statute", "executive-order", "federal-register-notice", "intergovernmental-agreement"}
LAST_KINDS = {"state-case", "territorial-case", "journal-article", "book"}
STATE_AGREEMENT_HOSTS = ("execleg.sos.ok.gov",)


def on_hosts(link: str, hosts) -> bool:
    host = (urllib.parse.urlsplit(link).hostname or "").removeprefix("www.")
    return any(host == known or host.endswith("." + known) for known in hosts)


def records_without_copies(with_records: bool = False):
    for path in sorted(pathlib.Path("content/sources").glob("*/*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        link = str(record.get("original_link") or "").strip()
        if link and not record.get("archives"):
            yield (path, link, record) if with_records else (path, link)


def priority(record: dict, link: str) -> int:
    kind = record.get("kind")
    if record.get("supreme_court") or (kind in FIRST_KINDS and not on_hosts(link, STATE_AGREEMENT_HOSTS)):
        return 0
    if kind in LAST_KINDS or on_hosts(link, STATE_AGREEMENT_HOSTS):
        return 2
    return 1


def write_queue() -> int:
    found = [(priority(record, link), path.stem, link) for path, link, record in records_without_copies(with_records=True) if not on_hosts(link, SKIPPED_HOSTS) and "\t" not in link]
    rows = [(key, link) for _, key, link in sorted(found)]
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
