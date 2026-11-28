#!/usr/bin/env python3
"""How clean the words of each served text are: the share of its words that
are not English words, as a rough measure of OCR damage (thread "Put full
document text on the site", Nov. 28, 2026; Trevor found the Caselaw Access
Project's text of The Kansas Indians, 72 U.S. 737 (1867), badly misread).

A word counts as misread when it has three or more letters, no capital
letter after its first, and a frequency of zero in the wordfreq English list.
Names, Latin and old spellings count too, so a clean 1860s text still scores
a few percent; the measure is for ranking texts against each other, not for
proof. The texts are read from the bucket; nothing is changed.

Usage:
  python3 scripts/review/text_quality.py --topics caselaw-access-project,treaties --out research/reviews/2026-11-28-text-quality.csv [--sample N]
"""
from __future__ import annotations

import argparse
import concurrent.futures
import csv
import html
import random
import re
import sys
from pathlib import Path

from wordfreq import zipf_frequency

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts" / "captures"))
import capture_index  # noqa: E402
import mirror_captures  # noqa: E402

WORD = re.compile(r"[A-Za-z]+")


def words_of(raw: bytes, media_type: str) -> str:
    text = raw.decode("utf-8", errors="replace")
    if media_type == "text/html":
        text = re.sub(r"(?is)<(script|style)\b.*?</\1>", " ", text)
        text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    return text


def misread_share(text: str) -> tuple[int, float]:
    words = [word for word in WORD.findall(text) if len(word) >= 3 and not any(letter.isupper() for letter in word[1:])]
    checked = [word for word in words if not word[0].isupper()]
    if not checked:
        return 0, 0.0
    bad = sum(1 for word in checked if zipf_frequency(word.lower(), "en") == 0)
    return len(checked), bad / len(checked)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--topics", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--sample", type=int, default=0)
    parser.add_argument("--workers", type=int, default=16)
    args = parser.parse_args()
    topics = set(args.topics.split(","))
    rows = [row for row in capture_index.read_rows()
            if row["media_type"] in ("text/plain", "text/html") and row["redistribution"] == "yes"
            and (row["key"].split("/")[0] in topics or row["topic"] in topics)]
    if args.sample and len(rows) > args.sample:
        rows = random.Random(1).sample(rows, args.sample)
    s3, bucket = mirror_captures.client(), mirror_captures.bucket_name()

    def score(row: dict) -> list:
        body = s3.get_object(Bucket=bucket, Key=row["key"])["Body"].read()
        count, share = misread_share(words_of(body, row["media_type"]))
        return [row["key"], row["topic"], row["records"], count, f"{share:.4f}"]

    results = []
    with concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
        for future in concurrent.futures.as_completed([pool.submit(score, row) for row in rows]):
            try:
                results.append(future.result())
            except Exception as error:  # a file that cannot be read is listed with no score, not dropped
                print(f"unread: {error}", file=sys.stderr)
    results.sort(key=lambda result: -float(result[4]))
    with open(args.out, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["key", "topic", "records", "words_checked", "misread_share"])
        writer.writerows(results)
    shares = sorted(float(result[4]) for result in results if int(result[3]) >= 200)
    if shares:
        bands = [(0.02, "under 2%"), (0.05, "2-5%"), (0.10, "5-10%"), (1.01, "10% or more")]
        low = 0.0
        for high, label in bands:
            print(f"{label}: {sum(1 for share in shares if low <= share < high):,}")
            low = high
        print(f"median {shares[len(shares) // 2]:.3f} of {len(shares):,} texts with 200+ words")


if __name__ == "__main__":
    main()
