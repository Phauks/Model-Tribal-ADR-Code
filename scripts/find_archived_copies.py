"""List existing Wayback Machine captures for source records that have none.

For every content/sources/*.yaml record with an 'original_link' and an empty
'archives' list, ask the Internet Archive's availability service for the
capture closest to the record's 'retrieved' date, and print a YAML snippet to
paste into the record. It never edits records and never requests a new
capture; to make one, open https://web.archive.org/save/ in a browser.

Availability service documentation: https://archive.org/help/wayback_api.php

Run from the repository root:  python3 scripts/find_archived_copies.py [key ...]
Uses only the Python standard library, plus PyYAML from requirements.txt.
"""

import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

import yaml

AVAILABILITY_SERVICE = "https://archive.org/wayback/available"


def closest_capture(link: str, near_date: str):
    query = urllib.parse.urlencode({"url": link, "timestamp": near_date.replace("-", "")})
    with urllib.request.urlopen(f"{AVAILABILITY_SERVICE}?{query}", timeout=60) as response:
        answer = json.load(response)
    closest = answer.get("archived_snapshots", {}).get("closest")
    if not closest or not closest.get("available") or closest.get("status") != "200":
        return None
    stamp = closest["timestamp"]
    snapshot_link = closest["url"].replace("http://web.archive.org", "https://web.archive.org", 1)
    return {"service": "wayback", "link": snapshot_link, "captured": f"{stamp[0:4]}-{stamp[4:6]}-{stamp[6:8]}"}


def main(keys: list[str]) -> int:
    paths = sorted(pathlib.Path("content/sources").glob("*.yaml"))
    if keys:
        paths = [path for path in paths if path.stem in keys]
    for path in paths:
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if record.get("archives") or not record.get("original_link"):
            continue
        retrieved = str(record.get("retrieved", ""))
        try:
            capture = closest_capture(record["original_link"], retrieved)
        except OSError as problem:
            print(f"# {path.stem}: lookup failed ({problem})")
            continue
        if capture is None:
            print(f"# {path.stem}: no capture found")
        else:
            print(f"# {path.stem}\narchives:\n  - service: wayback\n    link: {capture['link']}\n    captured: {capture['captured']}")
        time.sleep(1)  # be polite to the service
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
