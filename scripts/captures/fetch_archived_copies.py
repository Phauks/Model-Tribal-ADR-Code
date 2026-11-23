"""Fetch archived copies from the Wayback Machine on a GitHub runner, for a session that cannot reach it.

Cloud sessions reach archive.org's lookup service but not web.archive.org
itself, so they can find a capture and still not read it. This script runs in
the "fetch archived copies" workflow (.github/workflows/fetch-archived-copies.yml):
a session commits a request file, the workflow fetches each capture, and the
files come back to the session in an encrypted workflow artifact that only the
requesting session can open (it holds the private key; the request carries the
public key). Nothing fetched is ever committed.

Only Internet Archive addresses are fetched (web.archive.org and archive.org).
The script does not fetch nations' own sites: a site that refused the
project's link checker stays refused (research/search-logs/README.md).

Request file (JSON):

  {
    "public_key": "-----BEGIN PUBLIC KEY----- ...",   # RSA, PEM
    "items": [
      {"id": "1e-tolowa", "url": "https://web.archive.org/web/20161229065324id_/http://..."},
      {"id": "3a-hunkin", "save": "https://pacliirms.austlii.edu.au/as/cases/ASLawRp/2004/30.html"}
    ]
  }

An item with "url" downloads that capture (use the id_ form to get the
original bytes without the Wayback banner). An item with "save" asks Save Page
Now for a new capture of the page and records the capture address it reports.
Results go to OUT/manifest.json (id, address, HTTP status, bytes, SHA-256,
media type, file name or capture address) and the files to OUT/files/.

Run: python3 scripts/captures/fetch_archived_copies.py REQUEST.json OUT
Uses only the Python standard library.
"""

import concurrent.futures
import hashlib
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ALLOWED_HOSTS = {"web.archive.org", "archive.org"}
HEADERS = {"User-Agent": "model-tribal-adr-code archived-copy fetcher (GitHub Actions)"}
WORKERS = 4
SECONDS_BETWEEN_SAVES = 20
MAX_BYTES = 60_000_000


def allowed(url: str) -> bool:
    return urllib.parse.urlsplit(url).hostname in ALLOWED_HOSTS


def fetch(url: str) -> tuple[int, bytes, str, str]:
    last = None
    for attempt in range(2):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as response:
                return response.status, response.read(MAX_BYTES + 1), response.headers.get("content-type", ""), response.url
        except urllib.error.HTTPError as error:
            if error.code in (404, 403, 410):
                return error.code, b"", "", url
            last = error
        except Exception as error:  # network trouble: wait and try again
            last = error
        time.sleep(5)
    raise RuntimeError(str(last))


def save(url: str) -> dict:
    status, _, _, final = fetch("https://web.archive.org/save/" + url)
    match = re.search(r"/web/(\d{14})[a-z_]*/", final or "")
    if status == 200 and match:
        return {"capture": final, "timestamp": match.group(1)}
    return {"error": f"Save Page Now answered {status} ({final})"}


def fetch_one(item: dict, out: pathlib.Path) -> dict:
    entry = {"id": item["id"], "address": item.get("url") or item.get("save")}
    try:
        if item.get("save"):
            entry.update(save(item["save"]))
        elif not allowed(item["url"]):
            entry["error"] = "not an Internet Archive address; skipped"
        else:
            status, body, media, final = fetch(item["url"])
            entry.update({"status": status, "final": final, "media_type": media, "bytes": len(body)})
            if len(body) > MAX_BYTES:
                entry["error"] = "larger than the size limit; not kept"
            elif status == 200 and body:
                name = re.sub(r"[^A-Za-z0-9._-]+", "-", item["id"])[:120]
                (out / "files" / name).write_bytes(body)
                entry.update({"file": name, "sha256": hashlib.sha256(body).hexdigest()})
    except Exception as error:
        entry["error"] = str(error)[:300]
    print(json.dumps(entry), flush=True)
    return entry


def main() -> None:
    request = json.loads(pathlib.Path(sys.argv[1]).read_text())
    out = pathlib.Path(sys.argv[2])
    (out / "files").mkdir(parents=True, exist_ok=True)
    manifest = []
    saves = [item for item in request["items"] if item.get("save")]
    fetches = [item for item in request["items"] if not item.get("save")]
    # Captures are read a few at a time; Save Page Now requests go one at a time, spaced out.
    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        for entry in pool.map(lambda item: fetch_one(item, out), fetches):
            manifest.append(entry)
            (out / "manifest.json").write_text(json.dumps(manifest, indent=1))
    for item in saves:
        manifest.append(fetch_one(item, out))
        (out / "manifest.json").write_text(json.dumps(manifest, indent=1))
        time.sleep(SECONDS_BETWEEN_SAVES)


if __name__ == "__main__":
    main()
