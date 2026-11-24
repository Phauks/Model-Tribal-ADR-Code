"""Save the National Indian Law Library Tribal Law Gateway pages the project has not read yet.

The National Indian Law Library (NILL) "will deny requests that appear to be frequent or systematic", so this script reads its pages slowly: one page at a time, with a pause between pages (default 6 seconds), each page fetched once (a saved page is never fetched again), under an honestly named user agent, obeying robots.txt. It never retries a refusal and stops at the first sign of blocking (HTTP 403 or 429, or a challenge page).

    python3 scripts/review/nill_gateway_fetch.py --work WORK [--pause 6] [--slug SLUG ...]

It reads the slugs with read_by_project = no from research/nill-coverage/gateway-nations.csv (or the --slug values) and saves each page as WORK/pages/<slug>.html with WORK/pages/<slug>.json (status, address, time, SHA-256). WORK is a private folder outside the repository: NILL's pages are read for facts and links and are not redistributed.
"""

import argparse
import csv
import datetime
import hashlib
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request
import urllib.robotparser

GATEWAY = "https://narf.org/nill/tribes/{slug}.html"
USER_AGENT = "model-tribal-adr-code page reader (research; one page at a time, several seconds apart)"
CHALLENGE = ("just a moment...", "attention required", "captcha", "are you a robot", "access denied")


def unread_slugs():
    with open("research/nill-coverage/gateway-nations.csv", encoding="utf-8") as handle:
        return [row["slug"] for row in csv.DictReader(handle) if row["read_by_project"] == "no"]


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--work", required=True, help="private work folder, outside the repository")
    parser.add_argument("--pause", type=float, default=6.0, help="seconds between pages (at least 3)")
    parser.add_argument("--slug", action="append", help="only this Gateway slug")
    arguments = parser.parse_args()
    pause = max(arguments.pause, 3.0)
    pages = pathlib.Path(arguments.work) / "pages"
    pages.mkdir(parents=True, exist_ok=True)

    robots = urllib.robotparser.RobotFileParser("https://narf.org/robots.txt")
    robots.read()
    slugs = arguments.slug or unread_slugs()
    fetched = 0
    for slug in slugs:
        meta_path = pages / f"{slug}.json"
        if meta_path.exists():
            continue
        url = GATEWAY.format(slug=urllib.parse.quote(slug))
        if not robots.can_fetch(USER_AGENT, url):
            print(f"{slug}: robots.txt asks automated clients not to fetch this page; stopping", file=sys.stderr)
            return 1
        if fetched:
            time.sleep(pause)
        fetched += 1
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        meta = {"slug": slug, "url": url, "fetched": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")}
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = response.read()
                meta.update(status=response.status, final=response.geturl())
        except urllib.error.HTTPError as error:
            body = b""
            meta.update(status=error.code, final=url)
        except Exception as error:  # network failure: record it and move on, no retry
            body = b""
            meta.update(status=None, error=type(error).__name__, final=url)
        if body:
            (pages / f"{slug}.html").write_bytes(body)
            meta["sha256"] = hashlib.sha256(body).hexdigest()
        meta_path.write_text(json.dumps(meta, indent=1), encoding="utf-8")
        print(f"{slug}: {meta.get('status')}", flush=True)
        text = body[:20000].decode("utf-8", "replace").lower()
        if meta.get("status") in (403, 429) or any(sign in text for sign in CHALLENGE):
            print("The library refused or challenged the request; stopping without retrying.", file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
