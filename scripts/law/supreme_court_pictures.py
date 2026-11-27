"""Download and measure the pictures on the Supreme Court pages.

content/supreme-court/pictures.yaml lists one picture for each Justice and
appointing President (people.yaml) and for each Court that has one
(courts.yaml). Each entry is written by hand from the record of the library,
archive or museum that holds the original: what it shows, who made it and
when, the source and its number for it, and why it is in the public domain or
may be shown under an open license. Nothing is copied from a copy's
description page (Wikimedia Commons' pages carry template text that is no
use to readers).

For each entry this script downloads the file named by `copy`, checks that it
is a JPEG or PNG no larger than the site serves, and writes its media type,
width, height, SHA-256 and bucket key back into the entry. With R2_ACCESS_KEY_ID,
R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID set, it puts each copy in the
bucket under supreme-court/portraits/<subject>-<first 12 digits of the
SHA-256>.jpg (or .png), so a new picture never overwrites the copy the live
site serves for an older one; `key` records where it is. The site serves
that copy only if its SHA-256 matches the one recorded here; if the bucket
has none, the Worker fetches `copy` and keeps it only if it matches.

Entries that already have a SHA-256 are skipped unless --refresh is given, so
a run touches only new or changed pictures.

Run from the repository root:

    python3 scripts/law/supreme_court_pictures.py [--refresh] [--folder DIRECTORY]
"""

from __future__ import annotations

import argparse
import hashlib
import os
import pathlib
import struct
import sys
import time
import urllib.request

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
PICTURES = ROOT / "content" / "supreme-court" / "pictures.yaml"
AGENT = "Tribal Law Project research script (supreme_court_pictures.py)"
BUCKET_PREFIX = "supreme-court/portraits/"
LARGEST = 5 * 1024 * 1024  # the Worker refuses anything larger


def download(link: str) -> bytes:
    for attempt in range(4):
        try:
            request = urllib.request.Request(link, headers={"User-Agent": AGENT})
            with urllib.request.urlopen(request, timeout=120) as response:
                return response.read()
        except Exception as problem:  # rate limits and dropped connections: wait and try again
            if attempt == 3:
                raise
            print(f"retrying {link[:80]}: {problem}", file=sys.stderr)
            time.sleep(30 * (attempt + 1) if "429" in str(problem) else 5 * (attempt + 1))
    raise AssertionError("unreachable")


def measure(data: bytes) -> tuple[str, int, int]:
    """The media type, width and height of a JPEG or PNG."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        width, height = struct.unpack(">II", data[16:24])
        return "image/png", width, height
    if data.startswith(b"\xff\xd8"):
        offset = 2
        while offset < len(data):
            if data[offset] != 0xFF:
                offset += 1
                continue
            marker = data[offset + 1]
            length = struct.unpack(">H", data[offset + 2 : offset + 4])[0]
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                height, width = struct.unpack(">HH", data[offset + 5 : offset + 9])
                return "image/jpeg", width, height
            offset += 2 + length
    raise ValueError("not a JPEG or PNG")


def bucket_client():
    keys = (os.environ.get("R2_ACCESS_KEY_ID"), os.environ.get("R2_SECRET_ACCESS_KEY"), os.environ.get("CLOUDFLARE_ACCOUNT_ID"))
    if not all(keys):
        return None
    import boto3

    return boto3.client(
        "s3", endpoint_url=f"https://{keys[2]}.r2.cloudflarestorage.com",
        aws_access_key_id=keys[0], aws_secret_access_key=keys[1], region_name="auto",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--refresh", action="store_true", help="download every picture again, not only new ones")
    parser.add_argument("--folder", type=pathlib.Path, help="keep a copy of each download here")
    arguments = parser.parse_args()

    text = PICTURES.read_text(encoding="utf-8")
    header = "".join(line + "\n" for line in text.splitlines() if line.startswith("#"))
    document = yaml.safe_load(text)
    client = bucket_client()
    bucket = os.environ.get("R2_BUCKET", "tribal-law-project-files")
    if not client:
        print("no R2 keys: the Worker will fill the bucket from each copy", file=sys.stderr)

    changed = 0
    for entry in document["pictures"]:
        if entry.get("sha256") and not arguments.refresh:
            continue
        data = download(entry["copy"])
        if len(data) > LARGEST:
            raise SystemExit(f"{entry['subject']}: {entry['copy']} is larger than the site serves; pick a smaller copy")
        media_type, width, height = measure(data)
        digest = hashlib.sha256(data).hexdigest()
        extension = ".png" if media_type == "image/png" else ".jpg"
        entry.update({
            "media_type": media_type, "width": width, "height": height, "sha256": digest,
            "key": f"{BUCKET_PREFIX}{entry['subject']}-{digest[:12]}{extension}",
        })
        if arguments.folder:
            arguments.folder.mkdir(parents=True, exist_ok=True)
            (arguments.folder / (entry["subject"] + extension)).write_bytes(data)
        if client:
            client.put_object(
                Bucket=bucket, Key=entry["key"], Body=data, ContentType=media_type,
                Metadata={"source": entry["source_link"], "license": entry["license"]},
            )
        changed += 1
        time.sleep(3)  # Wikimedia and the Library of Congress both ask automated clients to go slowly

    PICTURES.write_text(header + yaml.safe_dump(document, sort_keys=False, allow_unicode=True, width=1000), encoding="utf-8")
    print(f"{len(document['pictures'])} pictures; {changed} downloaded", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
