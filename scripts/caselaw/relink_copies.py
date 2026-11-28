#!/usr/bin/env python3
"""Rebuild the served opinion copies with working citation links (scripts/caselaw/copy_links.py).

Every opinion page this project built from the Caselaw Access Project's files and
serves at /copies/<key> is rebuilt from the Project's case JSON and HTML, by the
same builder that made it, now with links:

- Tribal court opinions (topic caselaw-access-project), by
  tribal_court_opinions.opinion_page, with the private names map for the redacted
  ones (redact_opinions.py; the map stays in the bucket, never in git). Their
  citations had case.law's relative links, which led nowhere on this site.
- State and federal court opinions from the state reporters (topics
  state-court-opinions and federal-court-opinions), by
  state_court_opinions.opinion_page, which now builds them from the Project's HTML
  rather than its plain text, so the citations, page numbers and footnotes come
  through.

Before a page is kept, its words are checked against the page now in the bucket:
the opinion text must read the same once the links and page numbers are set
aside. A page that differs is reported and not filed.

    python3 scripts/caselaw/relink_copies.py build --cache DIR --out DIR [--keys K ...] [--no-external]
    python3 scripts/caselaw/relink_copies.py file --out DIR --index      (with the pull request)
    python3 scripts/caselaw/relink_copies.py file --out DIR --upload     (as the site deploys)

build writes the new pages and report.json to --out. file --index writes the
changed pages' sizes and SHA-256 to research/capture-index.csv; file --upload
replaces the files in the bucket under the same keys. The website serves a copy
only when the bucket's file matches the index it was built with, so upload as
the site deploys with the new index.
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import csv
import datetime
import hashlib
import html
import json
import os
import re
import sys
import time
import urllib.parse
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from caselaw_sources import cap_case_link, fetch_bytes  # noqa: E402
from copy_links import CAPTURE_INDEX, COPY_TOPICS, CitationLinks  # noqa: E402
import state_court_opinions as state_script  # noqa: E402
import tribal_court_opinions as tribal_script  # noqa: E402

STATIC = "https://static.case.law"


def copy_rows(keys: list[str] | None) -> list[dict]:
    with open(CAPTURE_INDEX, newline="", encoding="utf-8") as handle:
        rows = [row for row in csv.DictReader(handle) if row["topic"] in COPY_TOPICS and row["media_type"] == "text/html"]
    return [row for row in rows if not keys or row["key"] in keys]


def cached(url: str, path: Path) -> bytes:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        for attempt in range(4):
            try:
                data = fetch_bytes(url)
                break
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(5 * (attempt + 1))
        path.write_bytes(data)
    return path.read_bytes()


def words(page: str) -> list[str]:
    """The words of the page's main part, without tags, page numbers ("*282") or footnote marks."""
    main = page.split("<main>", 1)[-1].split("</main>", 1)[0]
    # A page number can fall inside a word ("In<a class="page-label">*283</a>dian"), so it goes without a space.
    main = re.sub(r"<a [^>]*class=\"page-label\"[^>]*>.*?</a>", "", main, flags=re.S)
    main = re.sub(r"<a [^>]*(?:class=\"footnotemark\"|href=\"#ref_footnote[^\"]*\")[^>]*>.*?</a>", "", main, flags=re.S)
    # Inline tags join what is around them ("<a>118 U. S. 375</a>-382"); the others part words.
    main = re.sub(r"</?(?:a|em|i|b|strong|span|sup|sub|u)\b[^>]*>", "", main)
    main = re.sub(r"<[^>]+>", " ", main)
    return re.sub(r"[^\w§$%&'-]+", " ", html.unescape(main)).split()


def relink_served(page: str, key: str, links: CitationLinks) -> str:
    """A Tribal opinion page as served, with its citations linked and its header links opening outside the frame."""
    head, rest = page.split("<main>", 1)
    head = head.replace(tribal_script.PAGE_STYLE.split("a.external")[0], tribal_script.PAGE_STYLE, 1) if "a.external" not in head else head
    head = re.sub(r'<a href="(/requests[^"]*|/copies/view/[^"#]*#request[^"]*)">', r'<a href="\1" target="_top">', head)
    head = re.sub(r'<a href="(https://static\.case\.law/[^"]*)">', r'<a class="external" href="\1" target="_blank" rel="noopener">', head)
    return head + "<main>" + links.rewrite(rest, key)


def names_map(s3, bucket: str) -> dict:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from redaction import NAMES_MAP_KEY  # noqa: PLC0415
    return json.loads(s3.get_object(Bucket=bucket, Key=NAMES_MAP_KEY)["Body"].read())


def bucket_client():
    sys.path.insert(0, str(state_script.ROOT / "scripts" / "captures"))
    import mirror_captures  # noqa: PLC0415
    if not mirror_captures.have_credentials():
        sys.exit("Needs R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID in the environment.")
    return mirror_captures, mirror_captures.client(), os.environ.get("R2_BUCKET", mirror_captures.DEFAULT_BUCKET)


def build(args: argparse.Namespace) -> None:
    from redaction import Redactor  # noqa: PLC0415
    _, s3, bucket = bucket_client()
    links = CitationLinks(external=not args.no_external)
    names = json.loads(Path(args.names_map).read_text(encoding="utf-8")) if args.names_map else names_map(s3, bucket)
    rows = copy_rows(args.keys)
    out, cache = Path(args.out), Path(args.cache)
    report = {}

    def one(row: dict) -> tuple[str, dict]:
        key = row["key"]
        _, reporter, volume, file_name = key.split("/")
        stem = file_name.removesuffix(".html")
        name = urllib.parse.quote(stem)  # a few case files have spaces in their names ("Supp. 6-01")
        try:
            case = json.loads(cached(f"{STATIC}/{reporter}/{volume}/cases/{name}.json", cache / reporter / volume / f"{stem}.json"))
            fragment = cached(f"{STATIC}/{reporter}/{volume}/html/{name}.html", cache / reporter / volume / f"{stem}.html").decode("utf-8")
        except Exception as error:  # noqa: BLE001
            return key, {"status": "not built", "error": str(error)[:300]}
        link = cap_case_link(reporter, volume, stem)
        if row["topic"] == "caselaw-access-project":
            redactor = Redactor(names[key]) if key in names else None
            data = tribal_script.opinion_page(case, fragment, key, link, redactor, links)
        else:
            data = state_script.opinion_page(case, key, link, fragment, links)
        old = s3.get_object(Bucket=bucket, Key=key)["Body"].read()
        new_words, old_words = words(data.decode("utf-8")), words(old.decode("utf-8"))
        if new_words != old_words and row["topic"] == "caselaw-access-project":
            # A Tribal page as served still has the Project's citation marks; a redacted one may carry later
            # corrections than the names map gives. Link the served page itself, so its text stays exactly as it is.
            data = relink_served(old.decode("utf-8"), key, links).encode("utf-8")
            new_words = words(data.decode("utf-8"))
        status = "unchanged" if old == data else "changed" if new_words == old_words else "text differs"
        entry = {"status": status, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        if status == "text differs":
            first = next((i for i, (a, b) in enumerate(zip(new_words, old_words)) if a != b), min(len(new_words), len(old_words)))
            entry["at"] = {"new": " ".join(new_words[max(0, first - 8):first + 8]), "old": " ".join(old_words[max(0, first - 8):first + 8])}
        path = out / "pages" / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        (out / "before" / key).parent.mkdir(parents=True, exist_ok=True)
        (out / "before" / key).write_bytes(old)
        return key, entry

    with cf.ThreadPoolExecutor(args.jobs) as pool:
        for number, (key, entry) in enumerate(pool.map(one, rows), 1):
            report[key] = entry
            if number % 250 == 0:
                print(f"{number} of {len(rows)}", file=sys.stderr)
    summary = {"pages": len(report), "by_status": dict(Counter(e["status"] for e in report.values())), "links": dict(links.counts)}
    (out / "report.json").write_text(json.dumps({"summary": summary, "pages": report}, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=1))


def file(args: argparse.Namespace) -> None:
    """--index writes the new pages' sizes and SHA-256 to the capture index; --upload puts in the bucket each page
    the bucket does not already hold byte for byte. The website serves a copy only when the two agree, so upload
    when the site deploys with the new index (a copy that disagrees meanwhile sends readers to case.law)."""
    mirror, s3, bucket = bucket_client()
    out = Path(args.out)
    report = json.loads((out / "report.json").read_text(encoding="utf-8"))["pages"]
    changed = [key for key, entry in report.items() if entry["status"] == "changed"]
    today = datetime.date.today().isoformat()
    if args.index:
        index = mirror.load_index()
        by_key = {row["key"]: row for row in index}
        for key in changed:
            entry = report[key]
            if by_key[key]["sha256"] != entry["sha256"]:
                by_key[key].update(bytes=entry["bytes"], sha256=entry["sha256"], captured=today,
                                   obtained=f"built from the Caselaw Access Project's files, {today}")
        mirror.write_index(index)
        print(f"capture index: {len(changed)} pages")

    def upload(key: str) -> bool:
        entry = report[key]
        if mirror.remote_state(s3, bucket, key) == (entry["bytes"], entry["sha256"]):
            return False
        data = (out / "pages" / key).read_bytes()
        assert hashlib.sha256(data).hexdigest() == entry["sha256"], key
        s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType="text/html; charset=utf-8", Metadata={"sha256": entry["sha256"], "captured": today})
        if mirror.remote_state(s3, bucket, key) != (entry["bytes"], entry["sha256"]):
            raise SystemExit(f"verification failed for {key}")
        return True

    if args.upload:
        with cf.ThreadPoolExecutor(16) as pool:
            uploaded = sum(pool.map(upload, changed))
        print(f"uploaded {uploaded} pages; {len(changed) - uploaded} were already in the bucket")
    print(f"left as they are: {sum(1 for e in report.values() if e['status'] != 'changed')} pages whose text differs or were not built")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest="command", required=True)
    one = commands.add_parser("build")
    one.add_argument("--cache", required=True, help="folder for the Project's case files (outside the repository)")
    one.add_argument("--out", required=True)
    one.add_argument("--keys", nargs="*")
    one.add_argument("--jobs", type=int, default=8)
    one.add_argument("--names-map", help="a private copy of the names map to use instead of the bucket's (never in git)")
    one.add_argument("--no-external", action="store_true", help="link only to this site's pages; leave other citations as text")
    two = commands.add_parser("file")
    two.add_argument("--out", required=True)
    two.add_argument("--index", action="store_true", help="write the new sizes and SHA-256 to research/capture-index.csv")
    two.add_argument("--upload", action="store_true", help="upload the pages the bucket does not hold yet")
    arguments = parser.parse_args()
    {"build": build, "file": file}[arguments.command](arguments)


if __name__ == "__main__":
    main()
