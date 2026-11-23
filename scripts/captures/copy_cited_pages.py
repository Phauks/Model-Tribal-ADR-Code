#!/usr/bin/env python3
"""Keep a private copy in R2 of every page or file that a record directly cites.

Trevor Goldsmith (2026-11-22): "If we directly cite it. We should keep a copy."
A source record is directly cited when a tribe profile, document, essay,
bibliography, story, method or glossary entry names its key. The Wayback
Machine capture in a record's `archives` list stays; this adds the project's
own copy in the private bucket, so a cited page can still be read when both the
original and the Archive lose it.

Steps, in order:

  plan     List the directly cited source records with an original link and
           no capture in research/capture-index.csv. A record counts as having
           a capture when an index row names it under `records`, or when a row's
           `link` is the record's original link (those rows get the record added
           to `records` by `index`).
  fetch    Download each planned link, put it in the bucket under
           cited-pages/<first letter>/<record key>.<extension>, check the
           object's size and SHA-256 metadata, and log the result to a JSON
           Lines file. A file whose SHA-256 is already in the index is not
           uploaded again; the existing row gets the record. Re-running skips
           records already in the log, so an interrupted run can be continued.
  deep     Download every object the log uploaded and hash its bytes. With
           --blocked FILE, also list HTML copies that are a bot check or an
           access-denied page instead of the cited page.
  drop     Delete the objects listed in a file (such as deep's --blocked list)
           and log those records as failed.
  index    Add the log's results to research/capture-index.csv: one row per new
           object, and the record key on rows that already held the file.

A copy's `redistribution` follows its source record, as decision record 0030
sets out: "yes" only when the record's `rights.redistribution` is true, otherwise
"no", so most copies stay private (most cited pages are third-party web pages).
HTML pages are saved as the server sent them, without images or style sheets.

Credentials come from the environment, as for mirror_captures.py:
R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID (or R2_ACCOUNT_ID).

Usage, from the repository root:
  python3 scripts/captures/copy_cited_pages.py plan --out PLAN.json
  python3 scripts/captures/copy_cited_pages.py fetch --plan PLAN.json --log LOG.jsonl [--workers 8] [--limit N]
  python3 scripts/captures/copy_cited_pages.py deep --log LOG.jsonl [--blocked BLOCKED.txt]
  python3 scripts/captures/copy_cited_pages.py drop --log LOG.jsonl --keys BLOCKED.txt
  python3 scripts/captures/copy_cited_pages.py index --plan PLAN.json --log LOG.jsonl
"""

from __future__ import annotations

import argparse
import collections
import concurrent.futures
import csv
import datetime as dt
import hashlib
import json
import os
import re
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mirror_captures  # noqa: E402  (same folder)

import yaml  # noqa: E402

REPO = mirror_captures.REPO
CONTENT = REPO / "content"
TOPIC = "cited-pages"
LARGEST_FILE = 64 * 1024 * 1024
SECONDS_BETWEEN_REQUESTS_TO_ONE_HOST = 2
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; research-archiver/1.0)",
    "Accept": "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
}
# Signs that a server answered with a bot check or a refusal instead of the page.
BLOCK_PAGE = re.compile(r"Just a moment\.\.\.|cf-chl-|Attention Required|Access Denied|"
                        r"Request unsuccessful\. Incapsula|captcha-delivery|Please enable JavaScript and cookies|"
                        r"awsWafCookieDomainList|<title>One moment, please", re.I)
EXTENSIONS = {
    "application/pdf": "pdf", "text/html": "html", "application/xhtml+xml": "html", "text/plain": "txt",
    "application/msword": "doc", "application/rtf": "rtf", "text/rtf": "rtf", "application/json": "json",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls", "text/csv": "csv", "application/xml": "xml", "text/xml": "xml",
    "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/svg+xml": "svg",
    "application/zip": "zip",
}


def normalized(link: str) -> str:
    return re.sub(r"^https?://(www\.)?", "", (link or "").strip()).rstrip("/").lower()


def cited_keys(value, kind: str, cited: dict) -> None:
    """Collect source keys named by 'source', 'official_source', 'sources' and 'dispute_resolution_law'."""
    if isinstance(value, dict):
        for field, item in value.items():
            if field in ("source", "official_source") and isinstance(item, str):
                cited[item].add(kind)
            elif field in ("sources", "dispute_resolution_law") and isinstance(item, list):
                for entry in item:
                    if isinstance(entry, str):
                        cited[entry].add(kind)
                    else:
                        cited_keys(entry, kind, cited)
            else:
                cited_keys(item, kind, cited)
    elif isinstance(value, list):
        for item in value:
            cited_keys(item, kind, cited)


def plan(args) -> None:
    sources = {path.stem: path for path in CONTENT.glob("sources/*/*.yaml")}
    cited = collections.defaultdict(set)
    for path in CONTENT.rglob("*"):
        if path.is_dir() or path.parts[len(CONTENT.parts)] == "sources":
            continue
        kind = path.parts[len(CONTENT.parts)]
        text = path.read_text(encoding="utf-8", errors="ignore")
        try:
            if path.suffix in (".yaml", ".yml"):
                cited_keys(yaml.safe_load(text), kind, cited)
            elif path.suffix == ".json":
                cited_keys(json.loads(text), kind, cited)
            elif path.suffix == ".md":
                if text.startswith("---"):
                    cited_keys(yaml.safe_load(text.split("---", 2)[1]), kind, cited)
                for key in re.findall(r"@([a-z0-9][a-z0-9-]+)", text):
                    cited[key].add(kind)
        except (yaml.YAMLError, ValueError):
            continue
    rows = mirror_captures.load_index()
    named = {key for row in rows for key in (row["records"] or "").split(";") if key}
    by_link = {}
    for row in rows:
        for link in (row["link"] or "").split():
            by_link.setdefault(normalized(link), row["key"])
    planned, linked = [], []
    for key in sorted(set(cited) & set(sources)):
        if key in named:
            continue
        record = yaml.safe_load(sources[key].read_text(encoding="utf-8"))
        link = record.get("original_link")
        if not link:
            continue
        rights = record.get("rights") or {}
        entry = {
            "record": key, "link": link, "cited_by": sorted(cited[key]),
            "title": ((record.get("citation") or {}).get("title") or "")[:300],
            "rights": f"From source record {key}: status {rights.get('status')}, basis {rights.get('basis')}, "
                      f"redistribution {str(rights.get('redistribution')).lower()}.",
        }
        if normalized(link) in by_link:
            linked.append({**entry, "existing": by_link[normalized(link)]})
        else:
            planned.append(entry)
    Path(args.out).write_text(json.dumps({"fetch": planned, "already_held": linked}, indent=1) + "\n", encoding="utf-8")
    print(f"{len(set(cited) & set(sources))} directly cited source records; {len(linked)} already held under another key; "
          f"{len(planned)} to fetch. Plan written to {args.out}.")


class HostPacer:
    """At most one request per host every few seconds, across worker threads."""

    def __init__(self):
        self.lock = threading.Lock()
        self.locks = collections.defaultdict(threading.Lock)
        self.last = collections.defaultdict(float)

    def wait(self, host: str):
        with self.lock:
            host_lock = self.locks[host]
        host_lock.acquire()
        pause = self.last[host] + SECONDS_BETWEEN_REQUESTS_TO_ONE_HOST - time.monotonic()
        if pause > 0:
            time.sleep(pause)
        return host_lock

    def done(self, host: str, host_lock):
        self.last[host] = time.monotonic()
        host_lock.release()


def download(link: str, folder: str):
    request = urllib.request.Request(urllib.parse.quote(link.strip(), safe=":/?#[]@!$&'()*+,;=%~"), headers=HEADERS)
    with urllib.request.urlopen(request, timeout=90) as response:
        media = (response.headers.get_content_type() or "application/octet-stream").lower()
        final = response.geturl()
        digest, size = hashlib.sha256(), 0
        handle = tempfile.NamedTemporaryFile(dir=folder, delete=False)
        with handle:
            while chunk := response.read(1 << 16):
                size += len(chunk)
                if size > LARGEST_FILE:
                    raise ValueError("larger than 64 MB")
                digest.update(chunk)
                handle.write(chunk)
    return handle.name, media, final, size, digest.hexdigest()


def extension_for(media: str, link: str) -> str:
    if media in EXTENSIONS:
        return EXTENSIONS[media]
    suffix = Path(urllib.parse.urlsplit(link).path).suffix.lower().lstrip(".")
    return suffix if re.fullmatch(r"[a-z0-9]{1,5}", suffix or "") else "bin"


def fetch(args) -> None:
    entries = json.loads(Path(args.plan).read_text(encoding="utf-8"))["fetch"]
    log_path = Path(args.log)
    done = set()
    if log_path.exists():
        done = {json.loads(line)["record"] for line in log_path.read_text(encoding="utf-8").splitlines() if line.strip()}
    entries = [entry for entry in entries if entry["record"] not in done][: args.limit]
    known = {row["sha256"]: row["key"] for row in mirror_captures.load_index()}
    s3 = mirror_captures.client()
    bucket = os.environ.get("R2_BUCKET", mirror_captures.DEFAULT_BUCKET)
    pacer, write_lock = HostPacer(), threading.Lock()
    folder = tempfile.mkdtemp(prefix="cited-pages-")
    today = dt.date.today().isoformat()

    def one(entry):
        host = urllib.parse.urlsplit(entry["link"]).hostname or ""
        result = {"record": entry["record"], "link": entry["link"], "date": today}
        host_lock = pacer.wait(host)
        try:
            path, media, final, size, digest = download(entry["link"], folder)
        except Exception as error:  # any failure of one download is logged, never fatal
            result.update(outcome="failed", problem=str(getattr(error, "reason", error))[:200],
                          status=getattr(error, "code", None))
            return result
        finally:
            pacer.done(host, host_lock)
        try:
            result.update(media_type=media, final_link=final, bytes=size, sha256=digest)
            if size == 0:
                result.update(outcome="failed", problem="empty response")
            elif digest in known:
                result.update(outcome="already-held", key=known[digest])
            else:
                key = f"{TOPIC}/{entry['record'][0]}/{entry['record']}.{extension_for(media, final)}"
                s3.upload_file(path, bucket, key, ExtraArgs={"ContentType": media, "Metadata": {
                    "sha256": digest, "captured": today, "records": entry["record"]}})
                if mirror_captures.remote_state(s3, bucket, key) != (size, digest):
                    result.update(outcome="failed", problem="bucket check failed after upload")
                else:
                    result.update(outcome="uploaded", key=key)
        finally:
            os.unlink(path)
        return result

    counts = collections.Counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool, log_path.open("a", encoding="utf-8") as log:
        for result in pool.map(one, entries):
            with write_lock:
                log.write(json.dumps(result) + "\n")
                log.flush()
            counts[result["outcome"]] += 1
            if sum(counts.values()) % 100 == 0:
                print(dict(counts), flush=True)
    print(f"Done: {dict(counts)}")


def deep(args) -> None:
    results = [json.loads(line) for line in Path(args.log).read_text(encoding="utf-8").splitlines() if line.strip()]
    uploaded = [r for r in results if r.get("outcome") == "uploaded"]
    s3 = mirror_captures.client()
    bucket = os.environ.get("R2_BUCKET", mirror_captures.DEFAULT_BUCKET)
    failures, blocked = [], []
    for result in uploaded:
        body = s3.get_object(Bucket=bucket, Key=result["key"])["Body"].read()
        if len(body) != result["bytes"] or hashlib.sha256(body).hexdigest() != result["sha256"]:
            failures.append(result["key"])
        elif result["media_type"] in ("text/html", "application/xhtml+xml") and BLOCK_PAGE.search(body[:20000].decode("utf-8", "ignore")):
            blocked.append(result["key"])
    print(f"Deep check: {len(uploaded) - len(failures)} of {len(uploaded)} objects match their SHA-256.")
    for key in failures:
        print(f"  mismatch: {key}")
    print(f"{len(blocked)} HTML copies look like a bot check or an access-denied page, not the cited page:")
    for key in blocked:
        print(f"  block page?: {key}")
    if args.blocked:
        Path(args.blocked).write_text("\n".join(blocked) + ("\n" if blocked else ""), encoding="utf-8")
    sys.exit(1 if failures else 0)


def drop(args) -> None:
    """Delete objects that turned out not to be the cited page (see `deep --blocked`) and log them as failed."""
    keys = set(Path(args.keys).read_text(encoding="utf-8").split())
    results = [json.loads(line) for line in Path(args.log).read_text(encoding="utf-8").splitlines() if line.strip()]
    s3 = mirror_captures.client()
    bucket = os.environ.get("R2_BUCKET", mirror_captures.DEFAULT_BUCKET)
    with Path(args.log).open("a", encoding="utf-8") as log:
        for result in results:
            if result.get("outcome") == "uploaded" and result["key"] in keys:
                s3.delete_object(Bucket=bucket, Key=result["key"])
                log.write(json.dumps({"record": result["record"], "link": result["link"], "date": result["date"],
                                      "outcome": "failed", "problem": "the server answered with a bot check, not the page"}) + "\n")
                keys.discard(result["key"])
    print("Dropped and logged as failed." + (f" Not found in the log: {sorted(keys)}" if keys else ""))


def index(args) -> None:
    plan_data = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    entries = {entry["record"]: entry for entry in plan_data["fetch"]}
    # The last line for a record wins: `drop` appends a "failed" line for a copy it removed.
    latest = {}
    for line in Path(args.log).read_text(encoding="utf-8").splitlines():
        if line.strip():
            result = json.loads(line)
            latest[result["record"]] = result
    results = list(latest.values())
    rows = mirror_captures.load_index()
    by_key = {row["key"]: row for row in rows}

    def add_record(row, record):
        names = {name for name in (row["records"] or "").split(";") if name}
        names.add(record)
        row["records"] = ";".join(sorted(names))
        kinds = {kind for kind in (row["record_kinds"] or "").split(";") if kind}
        row["record_kinds"] = ";".join(sorted(kinds | {"source"}))
        row["orphan"] = "no"

    for held in plan_data["already_held"]:
        if held["existing"] in by_key:
            add_record(by_key[held["existing"]], held["record"])
    added = 0
    for result in results:
        if result["outcome"] == "already-held" and result["key"] in by_key:
            add_record(by_key[result["key"]], result["record"])
        elif result["outcome"] == "uploaded" and result["key"] not in by_key:
            entry = entries[result["record"]]
            links = [result["link"]] + ([result["final_link"]] if normalized(result["final_link"]) != normalized(result["link"]) else [])
            row = {
                "key": result["key"], "bytes": result["bytes"], "sha256": result["sha256"],
                "media_type": result["media_type"], "topic": TOPIC, "title": entry["title"], "nations": "",
                "obtained": f"downloaded from the original link by scripts/captures/copy_cited_pages.py, {result['date']}",
                "link": " ".join(links), "captured": result["date"], "records": result["record"],
                "record_kinds": "source", "listed_in": "", "catalog": "", "derived_from": "",
                "rights": entry["rights"], "redistribution": "yes" if entry["rights"].endswith("redistribution true.") else "no",
                "keep_local": "no", "orphan": "no",
            }
            rows.append(row)
            by_key[row["key"]] = row
            added += 1
    mirror_captures.write_index(rows)
    print(f"Added {added} rows; linked {len(plan_data['already_held'])} records to copies already held.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    steps = parser.add_subparsers(dest="step", required=True)
    step = steps.add_parser("plan")
    step.add_argument("--out", required=True)
    step = steps.add_parser("fetch")
    step.add_argument("--plan", required=True)
    step.add_argument("--log", required=True)
    step.add_argument("--workers", type=int, default=8)
    step.add_argument("--limit", type=int)
    step = steps.add_parser("deep")
    step.add_argument("--log", required=True)
    step.add_argument("--blocked", help="write the keys that look like block pages to this file")
    step = steps.add_parser("drop")
    step.add_argument("--log", required=True)
    step.add_argument("--keys", required=True, help="file listing the object keys to delete")
    step = steps.add_parser("index")
    step.add_argument("--plan", required=True)
    step.add_argument("--log", required=True)
    args = parser.parse_args()
    {"plan": plan, "fetch": fetch, "deep": deep, "drop": drop, "index": index}[args.step](args)


if __name__ == "__main__":
    main()
