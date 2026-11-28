#!/usr/bin/env python3
"""The text of every served scan, taken from the scan's own words, so a page
shows the document's text and not only its PDF (thread "Put full document text
on the site", Nov. 28, 2026; Trevor: "getting all the text of these treaties
and documents onto the site").

Why: most records the site keeps a copy of show only a PDF in the Text card
(Nov. 28, 2026 count: 34,564 of 71,707 records, scripts/review/text_coverage.py).
Most of those PDFs already carry their printed words as a text layer (GovInfo's
Statutes at Large, Federal Register and Serial Set files, for example), so the
words can be taken out by script, with no OCR and no model.

What it writes: for each served PDF (capture index row with redistribution
"yes", no derived_from, a link) in the chosen topics, a UTF-8 text file in the
bucket beside it, `<the PDF's key without .pdf>.txt`, one page of the PDF per
form feed (src/lib/reading-text.ts starts a page at each form feed), and a
capture index row for it with derived_from set to the PDF's key. The site shows
that text in the Text card with the PDF as its scan (record-document.ts
textOfScan), labeled "Text from the scan, unchecked" (document-text.ts
trustOf). The PDF itself is never changed.

A PDF whose text layer is missing or too thin (fewer than --min-chars letters a
page on average) is listed in the work folder's needs-ocr.csv and gets no text.

Steps:
  extract  Download each PDF from the bucket, take its text with pdftotext,
           upload the text, check the upload's size and SHA-256, and add a line
           to <work>/results.jsonl. Resumable: a PDF already in results.jsonl
           or already given a text in the index is skipped.
  index    Add a capture index row for each text in results.jsonl
           (capture_index.write_rows keeps the rows in key order).

Usage:
  python3 scripts/law/scan_texts.py extract --topics treaties --work DIR [--workers 8] [--limit N]
  python3 scripts/law/scan_texts.py index --work DIR

Credentials: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID
from the environment, as scripts/captures/mirror_captures.py reads them.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import csv
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts" / "captures"))
import capture_index  # noqa: E402
import mirror_captures  # noqa: E402

TOOL = "scripts/law/scan_texts.py"


def served_pdfs(rows: list[dict], topics: set[str]) -> list[dict]:
    """The served PDFs in these topics (by the first folder of the key) that have no text taken from them yet."""
    taken = {row["derived_from"] for row in rows if row["derived_from"] and row["media_type"] == "text/plain"}
    keys = {row["key"] for row in rows}
    found = []
    for row in rows:
        if row["media_type"] != "application/pdf" or row["redistribution"] != "yes" or row["derived_from"]:
            continue
        if not row["link"].strip() or not re.fullmatch(r"[0-9a-f]{64}", row["sha256"]):
            continue
        if row["key"].split("/")[0] not in topics and row["topic"] not in topics:
            continue
        if row["key"] in taken or not row["key"].lower().endswith(".pdf"):
            continue
        if text_key(row["key"]) in keys:
            continue
        found.append(row)
    return found


def text_key(pdf_key: str) -> str:
    return re.sub(r"\.pdf$", "", pdf_key, flags=re.I) + ".txt"


def clean(text: str) -> str:
    """pdftotext's output with trailing spaces off each line and no run of more than two blank lines; pages stay apart by form feeds."""
    pages = []
    for page in text.split("\f"):
        lines = [line.rstrip() for line in page.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
        page_text = re.sub(r"\n{4,}", "\n\n\n", "\n".join(lines)).strip("\n")
        pages.append(page_text)
    while pages and not pages[-1].strip():
        pages.pop()
    return "\f".join(pages) + "\n"


def letters_per_page(text: str) -> float:
    pages = text.split("\f")
    return sum(len(re.findall(r"[A-Za-z]", page)) for page in pages) / max(len(pages), 1)


def extract_one(s3, bucket: str, row: dict, min_chars: int) -> dict:
    with tempfile.TemporaryDirectory() as folder:
        pdf = Path(folder) / "scan.pdf"
        s3.download_file(bucket, row["key"], str(pdf))
        digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
        if digest != row["sha256"]:
            return {"key": row["key"], "status": "checksum-mismatch", "got": digest}
        run = subprocess.run(["pdftotext", "-enc", "UTF-8", str(pdf), "-"], capture_output=True, timeout=600)
        if run.returncode != 0:
            return {"key": row["key"], "status": "pdftotext-failed", "error": run.stderr.decode(errors="replace")[:300]}
        text = clean(run.stdout.decode("utf-8", errors="replace"))
        density = letters_per_page(text)
        if density < min_chars:
            return {"key": row["key"], "status": "needs-ocr", "letters_per_page": round(density)}
        data = text.encode("utf-8")
        text_digest = hashlib.sha256(data).hexdigest()
        target = text_key(row["key"])
        out = Path(folder) / "text.txt"
        out.write_bytes(data)
        metadata = {"sha256": text_digest, "captured": dt.date.today().isoformat()}
        if row.get("records"):
            metadata["records"] = row["records"][:1000]
        s3.upload_file(str(out), bucket, target, ExtraArgs={
            "ContentType": "text/plain; charset=utf-8",
            "Metadata": {k: v.encode("ascii", "ignore").decode() for k, v in metadata.items()}})
        if mirror_captures.remote_state(s3, bucket, target) != (len(data), text_digest):
            return {"key": row["key"], "status": "upload-check-failed"}
        return {"key": row["key"], "status": "ok", "text_key": target, "bytes": len(data), "sha256": text_digest,
                "pages": text.count("\f") + 1, "letters_per_page": round(density)}


def extract(args) -> None:
    work = Path(args.work)
    work.mkdir(parents=True, exist_ok=True)
    results_path = work / "results.jsonl"
    done = set()
    if results_path.exists():
        for line in results_path.read_text().splitlines():
            if line.strip():
                result = json.loads(line)
                if result["status"] in ("ok", "needs-ocr"):
                    done.add(result["key"])
    rows = capture_index.read_rows()
    targets = [row for row in served_pdfs(rows, set(args.topics.split(","))) if row["key"] not in done]
    if args.limit:
        targets = targets[: args.limit]
    print(f"{len(targets)} PDFs to read ({len(done)} done before)", file=sys.stderr)
    s3, bucket = mirror_captures.client(), mirror_captures.bucket_name()
    lock = threading.Lock()
    counts: dict[str, int] = {}
    with results_path.open("a", encoding="utf-8") as results, concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
        futures = {pool.submit(extract_one, s3, bucket, row, args.min_chars): row for row in targets}
        for number, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            row = futures[future]
            try:
                result = future.result()
            except Exception as error:  # one bad file does not stop the run; it is written down and retried next time
                result = {"key": row["key"], "status": "error", "error": f"{type(error).__name__}: {error}"[:300]}
            with lock:
                results.write(json.dumps(result) + "\n")
                results.flush()
                counts[result["status"]] = counts.get(result["status"], 0) + 1
            if number % 100 == 0:
                print(f"  {number}/{len(targets)} {counts}", file=sys.stderr)
    print(json.dumps(counts))
    needs = [json.loads(line) for line in results_path.read_text().splitlines() if line.strip()]
    with (work / "needs-ocr.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["key", "letters_per_page"])
        for result in needs:
            if result["status"] == "needs-ocr":
                writer.writerow([result["key"], result["letters_per_page"]])


def index(args) -> None:
    rows = capture_index.read_rows()
    by_key = {row["key"]: row for row in rows}
    today = dt.date.today().isoformat()
    added = 0
    latest: dict[str, dict] = {}
    for line in (Path(args.work) / "results.jsonl").read_text().splitlines():
        if line.strip():
            result = json.loads(line)
            latest[result["key"]] = result
    for result in latest.values():
        if result["status"] != "ok" or result["text_key"] in by_key:
            continue
        pdf = by_key.get(result["key"])
        if not pdf:
            continue
        row = {field: "" for field in capture_index.FIELDS}
        row.update({
            "key": result["text_key"], "bytes": str(result["bytes"]), "sha256": result["sha256"], "media_type": "text/plain",
            "topic": pdf["topic"], "title": f"{pdf['title'] or pdf['key']} (text from the scan)", "nations": pdf["nations"],
            "obtained": f"text layer of the served scan {pdf['key']}, taken with pdftotext by {TOOL}, {today}",
            "link": pdf["link"], "captured": today, "records": pdf["records"], "record_kinds": pdf["record_kinds"],
            "listed_in": "", "catalog": "", "derived_from": pdf["key"], "rights": pdf["rights"],
            "redistribution": pdf["redistribution"], "keep_local": "no", "orphan": pdf["orphan"],
        })
        rows.append(row)
        by_key[row["key"]] = row
        added += 1
    capture_index.write_rows(rows)
    print(f"added {added} text rows to the capture index")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="step", required=True)
    one = sub.add_parser("extract")
    one.add_argument("--topics", required=True, help="comma-separated first folders of the keys, such as treaties,federal-register")
    one.add_argument("--work", required=True)
    one.add_argument("--workers", type=int, default=8)
    one.add_argument("--limit", type=int, default=0)
    one.add_argument("--min-chars", type=int, default=200, help="fewest letters a page, on average, for a usable text layer")
    one.set_defaults(func=extract)
    two = sub.add_parser("index")
    two.add_argument("--work", required=True)
    two.set_defaults(func=index)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
