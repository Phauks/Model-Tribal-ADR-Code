#!/usr/bin/env python3
"""The official text of every Title 25 section in force, from the 2024 edition
of the United States Code on GovInfo, stored in the bucket so each section's
page (/laws/usc-25/<section>) shows its own words in the Text card (thread
"Show every Title 25 section's text", Nov. 28, 2026).

Why: every section of Title 25 has a page (content/law/title-25-outline.json,
site/src/lib/server/code-outline.ts), but only the sections with an older
source record had a copy of their own (scripts/law/us_code_sections.py, about
ten, each a PDF). The rest linked to the PDF of their whole chapter and to
GovInfo. The Code is a work of the United States government (17 U.S.C. § 105).

What it stores, for each section in force:
  united-states-code/2024/title-25-section-<s>.html  the section's HTML granule, the words the card shows
  united-states-code/2024/title-25-section-<s>.pdf   the section's PDF granule, shown beside them as the scan
Both are GovInfo's own files, byte for byte (GovInfo's link service,
https://www.govinfo.gov/link/uscode/25/<s>?year=2024&link-type=html, answers
with the HTML granule, such as USCODE-2024-title25-chap44A-sec4352.htm; the PDF
granule has the same name under pdf/). A key already in the bucket is not
uploaded again: the PDFs us_code_sections.py stored for the older records stay
as they are.

Steps:
  store  Download each section's HTML and PDF, check that GovInfo answered with
         that section of the 2024 edition, upload each file the bucket lacks,
         check its size and SHA-256 there, and add a line to
         <work>/results.jsonl. Resumable: a section already stored is skipped.
         Writes <work>/failures.csv with the sections that could not be stored.
  index  Add a capture index row for each stored file (capture_index.write_rows
         keeps the rows in key order).

Usage:
  python3 scripts/law/title_25_section_texts.py store --work DIR [--workers 5] [--limit N]
  python3 scripts/law/title_25_section_texts.py index --work DIR

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
import re
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts" / "captures"))
import capture_index  # noqa: E402
import mirror_captures  # noqa: E402

OUTLINE = REPO / "content/law/title-25-outline.json"
EDITION = 2024
TOPIC = f"united-states-code/{EDITION}"
LINK = "https://www.govinfo.gov/link/uscode/25/{section}?year={year}&link-type=html"
RIGHTS = "United States government work (17 U.S.C. § 105)."
TOOL = "scripts/law/title_25_section_texts.py"
MEDIA = {"html": "text/html", "pdf": "application/pdf"}


def sections_in_force() -> list[str]:
    outline = json.loads(OUTLINE.read_text(encoding="utf-8"))
    if outline["edition"] != EDITION:
        sys.exit(f"the outline is of the {outline['edition']} edition, not {EDITION}")
    return [row["number"] for row in outline["items"]
            if row["level"] == "section" and row.get("status") == "in force" and not row.get("range")]


def key_of(section: str, extension: str) -> str:
    return f"{TOPIC}/title-25-section-{section.lower()}.{extension}"


def download(url: str, path: Path) -> str:
    """Download url to path, following redirects, trying four times; gives back the final address."""
    problem = ""
    for attempt in range(4):
        result = subprocess.run(["curl", "-gsSfL", "-m", "120", "-A", "Mozilla/5.0", "-o", str(path),
                                 "-w", "%{url_effective}", url], capture_output=True, text=True)
        if result.returncode == 0 and path.exists() and path.stat().st_size > 0:
            return result.stdout.strip()
        problem = result.stderr.strip()[:200]
        time.sleep(4 * (attempt + 1))
    raise RuntimeError(f"could not download {url}: {problem}")


def store_one(s3, bucket: str, section: str) -> dict:
    granule_name = re.escape(section)
    with tempfile.TemporaryDirectory() as folder:
        html = Path(folder) / "section.html"
        final = download(LINK.format(section=section, year=EDITION), html)
        match = re.fullmatch(rf"https://www\.govinfo\.gov/content/pkg/USCODE-{EDITION}-title25/html/(USCODE-{EDITION}-title25-[A-Za-z0-9-]*-sec{granule_name})\.htm", final, flags=re.I)
        if not match:
            return {"section": section, "status": "other-granule", "link": final}
        body = html.read_bytes()
        try:
            words = body.decode("utf-8")
        except UnicodeDecodeError:
            return {"section": section, "status": "not-utf-8", "link": final}
        if f"documentid:25_{section} " not in words.replace("\t", " "):
            return {"section": section, "status": "other-section", "link": final}
        if 'class="statutory-body' not in words and 'class="section-head"' not in words:
            return {"section": section, "status": "no-text", "link": final}
        granule = match.group(1)
        pdf = Path(folder) / "section.pdf"
        pdf_link = f"https://www.govinfo.gov/content/pkg/USCODE-{EDITION}-title25/pdf/{granule}.pdf"
        download(pdf_link, pdf)
        if pdf.read_bytes()[:5] != b"%PDF-":
            return {"section": section, "status": "pdf-not-a-pdf", "link": pdf_link}
        files = {}
        for extension, path, link in (("html", html, final), ("pdf", pdf, pdf_link)):
            data = path.read_bytes()
            digest = hashlib.sha256(data).hexdigest()
            key = key_of(section, extension)
            state = mirror_captures.remote_state(s3, bucket, key)
            if state is None:
                metadata = {"sha256": digest, "captured": dt.date.today().isoformat()}
                s3.upload_file(str(path), bucket, key, ExtraArgs={
                    "ContentType": MEDIA[extension] + ("; charset=utf-8" if extension == "html" else ""), "Metadata": metadata})
                if mirror_captures.remote_state(s3, bucket, key) != (len(data), digest):
                    return {"section": section, "status": "upload-check-failed", "key": key}
                files[extension] = {"key": key, "bytes": len(data), "sha256": digest, "link": link, "uploaded": True}
            else:
                # Already in the bucket (an older record's copy): never replaced; its own row stands.
                files[extension] = {"key": key, "bytes": state[0], "sha256": state[1], "link": link, "uploaded": False,
                                    "same": state == (len(data), digest)}
        return {"section": section, "status": "ok", "granule": granule, "files": files}


def read_results(path: Path) -> dict[str, dict]:
    latest: dict[str, dict] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                result = json.loads(line)
                latest[result["section"]] = result
    return latest


def store(args) -> None:
    work = Path(args.work)
    work.mkdir(parents=True, exist_ok=True)
    results_path = work / "results.jsonl"
    done = {section for section, result in read_results(results_path).items() if result["status"] == "ok"}
    sections = [section for section in sections_in_force() if section not in done]
    if args.limit:
        sections = sections[: args.limit]
    print(f"{len(sections)} sections to store ({len(done)} stored before)", file=sys.stderr)
    s3, bucket = mirror_captures.client(), mirror_captures.bucket_name()
    lock = threading.Lock()
    counts: dict[str, int] = {}
    with results_path.open("a", encoding="utf-8") as results, concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
        futures = {pool.submit(store_one, s3, bucket, section): section for section in sections}
        for number, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            section = futures[future]
            try:
                result = future.result()
            except Exception as error:  # one section that fails does not stop the run; it is written down and tried again next time
                result = {"section": section, "status": "error", "error": f"{type(error).__name__}: {error}"[:300]}
            with lock:
                results.write(json.dumps(result) + "\n")
                results.flush()
                counts[result["status"]] = counts.get(result["status"], 0) + 1
            if number % 100 == 0:
                print(f"  {number}/{len(sections)} {counts}", file=sys.stderr)
    print(json.dumps(counts))
    latest = read_results(results_path)
    with (work / "failures.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["section", "status", "detail"])
        for section in sections_in_force():
            result = latest.get(section)
            if not result or result["status"] != "ok":
                writer.writerow([section, result["status"] if result else "not tried",
                                 (result or {}).get("error") or (result or {}).get("link") or ""])


def index(args) -> None:
    rows = capture_index.read_rows()
    by_key = {row["key"]: row for row in rows}
    today = dt.date.today().isoformat()
    added = 0
    for section, result in read_results(Path(args.work) / "results.jsonl").items():
        if result["status"] != "ok":
            continue
        # The section's older record, when it has one, as its stored PDF names it.
        records = (by_key.get(key_of(section, "pdf")) or {}).get("records", "")
        for extension, stored in result["files"].items():
            if stored["key"] in by_key or not stored["uploaded"]:
                continue
            row = {field: "" for field in capture_index.FIELDS}
            row.update({
                "key": stored["key"], "bytes": str(stored["bytes"]), "sha256": stored["sha256"], "media_type": MEDIA[extension],
                "topic": TOPIC, "title": f"25 U.S.C. § {section}, {EDITION} edition",
                "obtained": f"downloaded from GovInfo (United States Code) by {TOOL}, {today}",
                "link": stored["link"], "captured": today, "records": records, "record_kinds": "source" if records else "",
                "rights": RIGHTS, "redistribution": "yes", "keep_local": "no", "orphan": "no" if records else "yes",
            })
            rows.append(row)
            by_key[row["key"]] = row
            added += 1
    capture_index.write_rows(rows)
    print(f"added {added} rows to the capture index")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="step", required=True)
    one = sub.add_parser("store")
    one.add_argument("--work", required=True)
    one.add_argument("--workers", type=int, default=5)
    one.add_argument("--limit", type=int, default=0)
    one.set_defaults(func=store)
    two = sub.add_parser("index")
    two.add_argument("--work", required=True)
    two.set_defaults(func=index)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
