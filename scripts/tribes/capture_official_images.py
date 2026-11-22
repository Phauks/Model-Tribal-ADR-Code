"""File the private copies of the second collection's nation images in the captures and the bucket.

Reads research/raw/2026-11-22/official-images-second-pass.json. For every chosen image it takes the
reviewed file from a local folder (named <sha256>.<extension>, as the review downloaded it), checks
its SHA-256, and:

- copies it to <captures>/<private_copy> (the private research captures, never this repository);
- uploads it to the private bucket under the same key, with its SHA-256 as metadata, and checks
  the upload (skipped when the bucket already holds the same file);
- adds an entry to <captures>/nation-images/manifest.json and a row to research/capture-index.csv.

The Worker serves an image only when the bucket copy matches the SHA-256 in the profile
(docs/official-images.md), so filing the copy here is what lets images from Wikimedia Commons or
an unreachable nation website show without the Worker fetching them.

Run from the repository root:
    python3 scripts/tribes/capture_official_images.py --captures /mnt/project-files/research/captures \
        --files <folder of reviewed downloads>
Needs boto3 and R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID in the environment;
without them it files the copies locally and the next mirror_captures.py upload sends them.
"""

import argparse
import datetime as dt
import hashlib
import importlib.util
import json
import pathlib
import shutil

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW = ROOT / "research/raw/2026-11-22/official-images-second-pass.json"

_spec = importlib.util.spec_from_file_location("mirror_captures", ROOT / "scripts/captures/mirror_captures.py")
mirror = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mirror)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--captures", required=True)
    parser.add_argument("--files", required=True)
    args = parser.parse_args()
    captures, files = pathlib.Path(args.captures), pathlib.Path(args.files)
    data = json.loads(RAW.read_text(encoding="utf-8"))
    s3 = mirror.client() if mirror.have_credentials() else None
    bucket = mirror.os.environ.get("R2_BUCKET", mirror.DEFAULT_BUCKET)
    manifest_path = captures / "nation-images" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    in_manifest = {item["path"] for item in manifest}
    rows = mirror.load_index()
    in_index = {row["key"] for row in rows}
    today = dt.date.today().isoformat()
    filed = uploaded = 0
    for nation in data["images"]:
        image = nation["image"]
        key = image["private_copy"]
        extension = pathlib.Path(key).suffix
        local = files / f"{image['sha256']}{extension}"
        digest = hashlib.sha256(local.read_bytes()).hexdigest()
        if digest != image["sha256"]:
            raise SystemExit(f"{local} does not match the reviewed SHA-256 for {nation['id']}")
        target = captures / key
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            shutil.copyfile(local, target)
        if s3 is not None and mirror.remote_state(s3, bucket, key) != (local.stat().st_size, digest):
            s3.upload_file(str(local), bucket, key, ExtraArgs={
                "ContentType": image["media_type"], "Metadata": {"sha256": digest, "captured": nation["retrieved"]}})
            if mirror.remote_state(s3, bucket, key) != (local.stat().st_size, digest):
                raise SystemExit(f"upload check failed for {key}")
            uploaded += 1
        if key not in in_manifest:
            entry = {"path": key, "nation": nation["id"], "kind": image["kind"], "image_link": image["image_link"],
                     "found_on": image["page"], "retrieved": nation["retrieved"], "sha256": digest}
            if image.get("credit"):
                entry["credit"] = image["credit"]
            manifest.append(entry)
            in_manifest.add(key)
        if key not in in_index:
            rows.append({
                "key": key, "bytes": local.stat().st_size, "sha256": digest, "media_type": image["media_type"],
                "topic": "nation-images", "title": f"{image['kind']} of {nation['id']}", "nations": nation["id"],
                "obtained": "downloaded by the project's collection scripts", "link": image["image_link"],
                "captured": nation["retrieved"], "records": nation["id"], "record_kinds": "tribe-profile",
                "listed_in": "", "catalog": "research/captures/nation-images/manifest.json", "derived_from": "",
                "rights": mirror.TOPIC_RIGHTS["nation-images"], "redistribution": "no", "keep_local": "no",
                "orphan": "no",
            })
            in_index.add(key)
            filed += 1
    manifest_path.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    mirror.write_index(rows)
    print(f"{filed} images filed; {uploaded} uploaded to {bucket}" + ("" if s3 else " (no R2 keys: local only)")
          + f"; checked {today}")


if __name__ == "__main__":
    main()
