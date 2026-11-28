#!/usr/bin/env python3
"""Fetch a source used as removal evidence and keep its plain text in a local cache.

Usage: python3 scripts/removals/fetch_source.py URL [URL ...] [--cache DIR] [--refresh]

Each URL is saved as <cache>/<sha1 of url>.txt (plain text) with <sha1>.url beside it, so the
quote checker (check_evidence_quotes.py) can match every quotation against exactly the text that
was read. PDFs go through pdftotext (plain, and with -layout as <sha1>.layout.txt); HTML is reduced to text; static.case.law JSON gives the
opinion text. The cache defaults to $REMOVAL_SOURCE_CACHE or ~/.cache/removal-sources.
Prints one line per URL: the text file's path and its length in characters.
"""

import argparse
import hashlib
import html
import json
import os
import re
import subprocess
import sys
import tempfile
from html.parser import HTMLParser

USER_AGENT = "Mozilla/5.0 (compatible; research-quote-check/1.0)"


def cache_dir(arg):
    return arg or os.environ.get("REMOVAL_SOURCE_CACHE") or os.path.expanduser("~/.cache/removal-sources")


def key(url):
    return hashlib.sha1(url.encode("utf-8")).hexdigest()


class TextOnly(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "head"}
    BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "blockquote", "td", "th", "dd", "dt", "pre"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.skipping = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skipping += 1
        elif tag in self.BLOCK:
            self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skipping:
            self.skipping -= 1
        elif tag in self.BLOCK:
            self.out.append("\n")

    def handle_data(self, data):
        if not self.skipping:
            self.out.append(data)


def html_text(raw):
    parser = TextOnly()
    parser.feed(raw.decode("utf-8", errors="replace"))
    text = "".join(parser.out)
    return re.sub(r"\n\s*\n+", "\n\n", text)


def case_law_text(raw):
    data = json.loads(raw)
    body = data.get("casebody", data)
    parts = []
    if isinstance(body, dict):
        for k in ("head_matter",):
            if body.get(k):
                parts.append(body[k])
        for op in body.get("opinions", []) or []:
            parts.append(op.get("text", ""))
    if not parts:
        parts.append(json.dumps(data))
    return "\n\n".join(parts)


def fetch(url, directory, refresh=False):
    os.makedirs(directory, exist_ok=True)
    k = key(url)
    text_path = os.path.join(directory, k + ".txt")
    if os.path.exists(text_path) and not refresh:
        return text_path
    with tempfile.NamedTemporaryFile(delete=False, dir=directory, suffix=".raw") as tmp:
        raw_path = tmp.name
    try:
        result = subprocess.run(
            ["curl", "-sSL", "--fail", "-m", "600", "-A", USER_AGENT, "-o", raw_path, url],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"curl failed ({result.returncode}): {result.stderr.strip()}")
        with open(raw_path, "rb") as f:
            raw = f.read()
        if raw[:5] == b"%PDF-":
            out = subprocess.run(["pdftotext", "-enc", "UTF-8", raw_path, "-"], capture_output=True)
            text = out.stdout.decode("utf-8", errors="replace")
            # A second reading keeps each line's columns apart, for pages with marginal notes
            # (Statutes at Large) where the plain reading interleaves the note with the text.
            out = subprocess.run(["pdftotext", "-layout", "-enc", "UTF-8", raw_path, "-"], capture_output=True)
            with open(os.path.join(directory, k + ".layout.txt"), "w", encoding="utf-8") as f:
                f.write(out.stdout.decode("utf-8", errors="replace"))
        elif "static.case.law" in url and url.endswith(".json"):
            text = case_law_text(raw)
        elif re.search(rb"<(html|body|div|p)[\s>]", raw[:20000], re.I):
            text = html_text(raw)
        else:
            text = raw.decode("utf-8", errors="replace")
        text = html.unescape(text) if "&#" in text or "&amp;" in text else text
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(text)
        with open(os.path.join(directory, k + ".url"), "w", encoding="utf-8") as f:
            f.write(url + "\n")
        return text_path
    finally:
        if os.path.exists(raw_path):
            os.remove(raw_path)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("urls", nargs="+")
    parser.add_argument("--cache")
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    directory = cache_dir(args.cache)
    status = 0
    for url in args.urls:
        try:
            path = fetch(url, directory, args.refresh)
            with open(path, encoding="utf-8") as f:
                n = len(f.read())
            print(f"{path}\t{n}\t{url}")
        except Exception as exc:  # report and continue with the other URLs
            print(f"FAILED\t{exc}\t{url}", file=sys.stderr)
            status = 1
    sys.exit(status)


if __name__ == "__main__":
    main()
