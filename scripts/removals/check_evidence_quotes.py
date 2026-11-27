#!/usr/bin/env python3
"""Re-match every quotation in a removal evidence file against the source text it came from.

Usage: python3 scripts/removals/check_evidence_quotes.py EVIDENCE.json [--cache DIR] [--no-fetch]
       [--only JOURNEY ...] [--write] [--date "Nov. 27, 2026"]

EVIDENCE.json has the shape of research/historic-maps/removals/evidence.json:
{"journeys": {"<journey id>": [ {category, citation, url, quote, ...}, ... ]}}.

For each item with a quote, the text of its url (and alt_url, if any) is taken from the cache
written by fetch_source.py (fetched first unless --no-fetch). A quotation matches when it appears
in the text (or, for a PDF, its -layout reading) after normalizing Unicode quotes and dashes, whitespace, and hyphens (so a word split
across a line in a scan still matches). Omissions marked ". . ." (or "..." or the ellipsis
character) are allowed: each part must appear, in order. Nothing else is forgiven: a change of
case or wording is reported as a mismatch, with the longest part that did match. Up to three short
interruptions between words (a marginal note or running head printed inside the sentence, up to
40 characters each) are skipped and reported in the result.

With --write, each item's "checked" field is set to the result, and the file is rewritten.
Exit status is 1 if any quotation did not match.
"""

import argparse
import json
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_source import cache_dir, fetch, key  # noqa: E402

DASHES = "‐‑‒–—―−­¬"
ELLIPSIS = re.compile(r"\s*(?:\.\s\.\s\.|\.\.\.|…)\s*\.?\s*")


def normalize(text):
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"')
    text = text.replace("`", "'").replace("''", '"').replace(",,", '"')
    for d in DASHES:
        text = text.replace(d, "-")
    text = re.sub(r"\s*-+\s*", "", text)  # hyphens and dashes, including line-end hyphens
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def longest_matching_prefix(part, hay):
    lo, hi = 0, len(part)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if part[:mid] in hay:
            lo = mid
        else:
            hi = mid - 1
    return lo


MAX_GAP = 40  # characters of an interruption (a marginal note, a running head) inside a quote
MAX_GAPS = 3


def find_with_interruptions(part, hay, start):
    """Find the words of part in order in hay, allowing a few short interruptions between words.

    Returns (end, gaps) for the first such match at or after start, or None.
    """
    words = part.split(" ")
    if len(words) < 4:
        return None
    head = " ".join(words[:3])
    i = hay.find(head, start)
    while i >= 0:
        pos = i + len(head)
        gaps = []
        ok = True
        for w in words[3:]:
            if hay.startswith(" " + w, pos):
                pos += 1 + len(w)
                continue
            j = hay.find(w, pos, pos + MAX_GAP + len(w))
            if j < 0 or len(gaps) >= MAX_GAPS:
                ok = False
                break
            gaps.append(hay[pos:j].strip())
            pos = j + len(w)
        if ok:
            return pos, gaps
        i = hay.find(head, i + 1)
    return None


def match(quote, hay):
    """Return (ok, detail)."""
    parts = [normalize(p) for p in ELLIPSIS.split(quote)]
    parts = [p.strip(' "\'') for p in parts]
    parts = [p for p in parts if p]
    if not parts:
        return True, "empty"
    pos = 0
    interruptions = []
    for p in parts:
        i = hay.find(p, pos)
        if i < 0:
            found = find_with_interruptions(p, hay, pos)
            if found:
                pos, gaps = found
                interruptions.extend(gaps)
                continue
            j = hay.lower().find(p.lower(), pos)
            if j >= 0:
                return False, f"matches only if case is ignored: {p[:60]!r}"
            n = longest_matching_prefix(p, hay)
            return False, f"first {n} of {len(p)} characters of {p[:60]!r} found"
        pos = i + len(p)
    if interruptions:
        shown = "; ".join(repr(g) for g in interruptions)
        return True, f"matched, skipping text that interrupts the quotation in the source ({shown})"
    return True, "matched" if len(parts) == 1 else f"matched in {len(parts)} parts"


def load_texts(url, directory, allow_fetch):
    """The normalized readings of a source: the plain text and, for a PDF, the -layout text."""
    path = os.path.join(directory, key(url) + ".txt")
    if not os.path.exists(path):
        if not allow_fetch:
            return None
        path = fetch(url, directory)
    readings = []
    for p in (path, os.path.join(directory, key(url) + ".layout.txt")):
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                readings.append(normalize(f.read()))
    return readings


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("evidence")
    parser.add_argument("--cache")
    parser.add_argument("--no-fetch", action="store_true")
    parser.add_argument("--only", nargs="*")
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--date", default="Nov. 27, 2026")
    args = parser.parse_args()
    directory = cache_dir(args.cache)
    with open(args.evidence, encoding="utf-8") as f:
        data = json.load(f)
    texts = {}
    bad = good = skipped = 0
    for jid, items in data["journeys"].items():
        if args.only and jid not in args.only:
            continue
        for n, item in enumerate(items):
            quote = (item.get("quote") or "").strip()
            if not quote:
                skipped += 1
                if args.write:
                    item["checked"] = "no quotation"
                continue
            urls = [u for u in (item.get("url"), item.get("alt_url")) if u]
            result, detail = False, "no url"
            for url in urls:
                if url not in texts:
                    try:
                        texts[url] = load_texts(url, directory, not args.no_fetch)
                    except Exception as exc:
                        texts[url] = None
                        print(f"  fetch failed {url}: {exc}", file=sys.stderr)
                readings = texts[url]
                if not readings:
                    detail = "source text not available"
                    continue
                for hay in readings:
                    result, detail = match(quote, hay)
                    if result:
                        break
                if result:
                    break
            if result:
                good += 1
                if detail.startswith("matched, skipping"):
                    print(f"MATCHED WITH INTERRUPTION {jid}[{n}]: {detail}")
                if args.write:
                    note = "" if detail in ("matched",) or detail.startswith("matched in") else f"; {detail}"
                    item["checked"] = f"matched by script against the fetched text ({args.date}){note}"
            else:
                bad += 1
                print(f"NOT MATCHED {jid}[{n}] {item.get('category')}: {detail}\n    {item.get('citation', '')[:120]}\n    quote: {quote[:160]}")
                if args.write:
                    item["checked"] = f"not matched by script ({args.date}): {detail}"
    print(f"{good} matched, {bad} not matched, {skipped} without a quotation")
    if args.write:
        with open(args.evidence, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent="\t")
            f.write("\n")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
