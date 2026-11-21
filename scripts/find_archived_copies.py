"""Find or make Wayback Machine captures for source records that have none.

For every content/sources/<letter>/<key>.yaml record with an 'original_link'
and an empty 'archives' list:

  - with --save, ask Save Page Now (https://web.archive.org/save/) for a new
    capture; then
  - ask the availability service for the capture closest to today (or, without
    --save, closest to the record's 'retrieved' date).

It prints a YAML snippet per record and, with --report FILE, writes the
results as JSON. It never edits records: a person or a later commit copies the
links in, so every change to a record stays reviewable.

Service documentation: https://archive.org/help/wayback_api.php and
https://web.archive.org/save/ (anonymous Save Page Now is rate limited, so the
script waits between requests).

Run from the repository root:
  python3 scripts/find_archived_copies.py [--save] [--limit N] [--report FILE] [key ...]

--limit N stops after N records, so a large backlog is worked through over
several runs instead of one very long one.
Uses only the Python standard library, plus PyYAML from requirements.txt.
"""

import datetime
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

import yaml

AVAILABILITY_SERVICE = "https://archive.org/wayback/available"
SAVE_SERVICE = "https://web.archive.org/save/"
CAPTURE_LINK = re.compile(r"/web/(\d{14})/")
HEADERS = {"User-Agent": "source-archiver/1.0"}
SECONDS_BETWEEN_SAVES = 20


def as_capture(link: str, stamp: str) -> dict:
    return {
        "service": "wayback",
        "link": link.replace("http://web.archive.org", "https://web.archive.org", 1),
        "captured": f"{stamp[0:4]}-{stamp[4:6]}-{stamp[6:8]}",
    }


def closest_capture(link: str, near_date: str):
    query = urllib.parse.urlencode({"url": link, "timestamp": near_date.replace("-", "")})
    request = urllib.request.Request(f"{AVAILABILITY_SERVICE}?{query}", headers=HEADERS)
    with urllib.request.urlopen(request, timeout=60) as response:
        answer = json.load(response)
    closest = answer.get("archived_snapshots", {}).get("closest")
    if not closest or not closest.get("available") or closest.get("status") != "200":
        return None
    return as_capture(closest["url"], closest["timestamp"])


def save_capture(link: str):
    """Request a new capture. Returns it when the service names one, otherwise None."""
    request = urllib.request.Request(SAVE_SERVICE + link, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=300) as response:
        final_link = response.geturl()
        location = response.headers.get("Content-Location", "")
    for candidate in (final_link, location):
        match = CAPTURE_LINK.search(candidate or "")
        if match:
            if candidate.startswith("/"):
                candidate = "https://web.archive.org" + candidate
            return as_capture(candidate, match.group(1))
    return None


def main(arguments: list[str]) -> int:
    save = "--save" in arguments
    report_path, limit = None, None
    if "--report" in arguments:
        report_path = arguments[arguments.index("--report") + 1]
    if "--limit" in arguments:
        limit = int(arguments[arguments.index("--limit") + 1])
    option_values = {report_path, str(limit)}
    keys = [argument for argument in arguments if not argument.startswith("--") and argument not in option_values]

    paths = sorted(pathlib.Path("content/sources").glob("*/*.yaml"))
    if keys:
        paths = [path for path in paths if path.stem in keys]
    today = datetime.date.today().isoformat()
    results = []
    for path in paths:
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if record.get("archives") or not record.get("original_link"):
            continue
        if limit is not None and len(results) >= limit:
            print(f"Stopped at --limit {limit}; run again for the rest.")
            break
        link = record["original_link"]
        capture, problem = None, None
        if save:
            try:
                capture = save_capture(link)
            except OSError as error:
                problem = f"save failed ({error})"
            time.sleep(SECONDS_BETWEEN_SAVES)
        if capture is None:
            try:
                capture = closest_capture(link, today if save else str(record.get("retrieved", today)))
            except OSError as error:
                problem = (problem + "; " if problem else "") + f"lookup failed ({error})"
            time.sleep(1)
        results.append({"key": path.stem, "path": str(path), "original_link": link, "capture": capture, "problem": problem})
        if capture:
            print(f"# {path.stem}\narchives:\n  - service: wayback\n    link: {capture['link']}\n    captured: {capture['captured']}", flush=True)
        else:
            print(f"# {path.stem}: no capture ({problem or 'none found'})", flush=True)
    if report_path:
        pathlib.Path(report_path).write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    found = sum(1 for result in results if result["capture"])
    print(f"\n{found} of {len(results)} records have a capture.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
