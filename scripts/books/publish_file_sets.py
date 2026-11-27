#!/usr/bin/env python3
"""Upload the prepared editions of the printed book to the private bucket.

The print build writes one file set per size and binding
(`npm run build:editions` in pdf/):

  pdf/output/editions/current/<size>/<binding>/interior.pdf
  pdf/output/editions/current/<size>/<binding>/cover.pdf
  pdf/output/editions/current/<size>/<binding>/details.json

This script puts each file in the bucket at books/<file set>/<file>, where
the website's order routes read them (docs/book-orders.md). details.json goes
up last, after both PDFs, because the website treats a file set as ready once
details.json is there. Files already in the bucket with the same SHA-256
(stored as object metadata) are skipped.

Without --confirm it only lists what it would upload.

Credentials come from the environment, never from a file in the repository:
R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID (or
R2_ACCOUNT_ID). R2_BUCKET changes the bucket.

Usage:
  python3 scripts/books/publish_file_sets.py                 # list the plan
  python3 scripts/books/publish_file_sets.py --confirm       # upload
  python3 scripts/books/publish_file_sets.py --editions DIR  # another folder
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

REPOSITORY = Path(__file__).resolve().parents[2]
DEFAULT_EDITIONS = REPOSITORY / "pdf" / "output" / "editions"
DEFAULT_BUCKET = "tribal-law-project-files"
BINDINGS = {"paperback", "hardcover"}
# Upload order: details.json last (see the module description).
FILES = [("interior.pdf", "application/pdf"), ("cover.pdf", "application/pdf"), ("details.json", "application/json")]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def file_sets(editions: Path) -> list[tuple[str, Path, dict]]:
    """Every complete file set under the editions folder, with its details. Exits on a broken one."""
    found, problems = [], []
    for details_path in sorted(editions.rglob("details.json")):
        directory = details_path.parent
        identifier = directory.relative_to(editions).as_posix()
        details = json.loads(details_path.read_text(encoding="utf-8"))
        for name, _ in FILES:
            if not (directory / name).is_file():
                problems.append(f"{identifier}: {name} is missing")
        if not isinstance(details.get("title"), str) or not isinstance(details.get("pages"), int) or not isinstance(details.get("size"), str):
            problems.append(f"{identifier}: details.json needs title, pages and size")
        if details.get("binding") not in BINDINGS:
            problems.append(f"{identifier}: binding must be paperback or hardcover")
        if not identifier.endswith(f"/{details.get('size')}/{details.get('binding')}"):
            problems.append(f"{identifier}: the folder does not match the size and binding in details.json")
        found.append((identifier, directory, details))
    if problems:
        sys.exit("\n".join(problems))
    if not found:
        sys.exit(f"No file sets under {editions}. Run `npm run build:editions` in pdf/ first.")
    return found


def client():
    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        sys.exit("Install boto3 first: pip install boto3")
    account = os.environ.get("R2_ACCOUNT_ID") or os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    key_id = os.environ.get("R2_ACCESS_KEY_ID")
    secret = os.environ.get("R2_SECRET_ACCESS_KEY")
    if not (account and key_id and secret):
        sys.exit("Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID in the environment.")
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
        aws_access_key_id=key_id,
        aws_secret_access_key=secret,
        region_name="auto",
        config=Config(retries={"max_attempts": 5, "mode": "standard"}),
    )


def remote_sha256(s3, bucket: str, key: str) -> str | None:
    from botocore.exceptions import ClientError

    try:
        head = s3.head_object(Bucket=bucket, Key=key)
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
            return None
        raise
    return head.get("Metadata", {}).get("sha256")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--editions", type=Path, default=DEFAULT_EDITIONS)
    parser.add_argument("--confirm", action="store_true", help="upload; without it, only list the plan")
    args = parser.parse_args()

    sets = file_sets(args.editions)
    if not args.confirm:
        for identifier, _, details in sets:
            print(f"books/{identifier}/  {details['pages']} pages  {details['binding']}")
        print(f"{len(sets)} file sets. Run again with --confirm to upload.")
        return 0

    s3, bucket = client(), os.environ.get("R2_BUCKET", DEFAULT_BUCKET)
    uploaded = skipped = 0
    for identifier, directory, _ in sets:
        for name, media_type in FILES:
            path, key = directory / name, f"books/{identifier}/{name}"
            digest = sha256(path)
            if remote_sha256(s3, bucket, key) == digest:
                skipped += 1
                continue
            s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": media_type, "Metadata": {"sha256": digest}})
            if remote_sha256(s3, bucket, key) != digest:
                sys.exit(f"{key} did not arrive intact; nothing after it was uploaded")
            uploaded += 1
        print(f"books/{identifier}/ ready")
    print(f"Uploaded {uploaded} files, {skipped} already there, in {len(sets)} file sets.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
