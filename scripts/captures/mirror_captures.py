#!/usr/bin/env python3
"""Index, upload, verify and prune the project's private research captures.

The captures are the project's private copies of documents (constitutions,
Tribal law, gaming compacts, nation images, hand-pulled Westlaw prints and
others). They live in the project's working files under research/captures/
and, after the move decided on 2026-11-22, in the private R2 bucket
`model-tribal-adr-code-sources`, under the same paths: the object key is the
path below research/captures/ (for example
`constitutions/caddo-nation-of-oklahoma/45f8a88c34c9cb61.pdf`). They are never
committed to git (decision record 0004).

Subcommands, in the order they are run:

  index    Hash every file under the captures folder and write the capture
           index (research/capture-index.csv in the repository):
           key, size, SHA-256, how the file was obtained, capture date, title,
           nations, topic, the records that cite it, rights and whether the
           local copy is kept. Also writes research/capture-orphans.csv, the
           captures that no source record, document history, profile or story
           cites.
  upload   Put every indexed file in the bucket. Skips objects already there
           with the same size and SHA-256 (stored as object metadata), so it
           can be re-run after an interruption.
  verify   Check every object in the bucket against the index by size and
           SHA-256 metadata. With --deep, also downloads each object and hashes
           its bytes. Writes capture-verification.json next to the captures folder.
  prune    Delete local copies that the last verification passed, except text
           extracts (.txt, .json, .raw) and other files marked keep_local in the
           index. Needs --confirm; without it, prints what it would delete.
  add      File new hand-pulled documents: copy each into the captures folder
           under a topic, upload it, verify it, and append it to the index.
  intake   File what was sent on the website's Intake page (docs/uploads.md,
           "Intake"; scripts/captures/intake_uploads.py): without --apply, plan
           (download, hash, match to the pull list); with --apply PLAN, copy
           each file to its key inside the bucket, check it, index it and tell
           the website it is filed.

Credentials come from the environment and never from a file in the
repository: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and CLOUDFLARE_ACCOUNT_ID
(or R2_ACCOUNT_ID). The bucket name can be changed with R2_BUCKET.

Usage:
  python3 scripts/captures/mirror_captures.py index --captures /mnt/project-files/research/captures
  python3 scripts/captures/mirror_captures.py upload --captures ...
  python3 scripts/captures/mirror_captures.py verify --captures ... [--deep]
  python3 scripts/captures/mirror_captures.py prune --captures ... [--confirm]
  python3 scripts/captures/mirror_captures.py add --captures ... --topic westlaw FILE... \
      [--record KEY] [--obtained "hand pull by Trevor Goldsmith"] [--title TITLE] [--link URL]
  python3 scripts/captures/mirror_captures.py intake --captures ... [--apply PLAN]
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import mimetypes
import os
import re
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
INDEX_CSV = REPO / "research" / "capture-index.csv"
ORPHANS_CSV = REPO / "research" / "capture-orphans.csv"
DEFAULT_BUCKET = "model-tribal-adr-code-sources"
TEXT_SUFFIXES = (".txt", ".json", ".raw")
HAND_PULLER = "Trevor Goldsmith"

FIELDS = [
    "key", "bytes", "sha256", "media_type", "topic", "title", "nations",
    "obtained", "link", "captured", "records", "record_kinds", "listed_in",
    "catalog", "derived_from", "rights", "redistribution", "keep_local", "orphan",
]

# Rights notes used when no source record states the rights. Project analysis
# from the data model's permission statuses and decision records 0004 and 0017.
# Copies that are never served, whatever the cited record says: a Westlaw
# print carries Thomson Reuters headnotes and formatting, and an article copy
# belongs to its publisher, even when the opinion or statute itself is public.
NEVER_SERVED = {"westlaw", "articles"}

TOPIC_RIGHTS = {
    "tribal-law": "A nation's law: served on the website under decision record 0031; the nation can ask for removal or redaction.",
    "constitutions": "A nation's governing document: served on the website under decision record 0031; the nation can ask for removal or redaction.",
    "gaming": "Compact or ordinance as published by the Bureau of Indian Affairs or the National Indian Gaming Commission: private research copy; redistribution not cleared.",
    "nation-images": "A nation's seal or logo: reuse status is in the tribe profile's official_images; served only as decision record 0017 allows.",
    "westlaw": "Westlaw printout: subscription content for the lead author's educational use; never redistributed.",
    "articles": "Journal article: copyright held by the author or journal; private copy, not redistributed.",
    "oklahoma-secretary-of-state": ("A state-tribal compact or agreement as filed with the Oklahoma Secretary of State, a public record: "
                                    "served on the website under decision record 0060; a nation can ask for removal or redaction."),
    "state-court-opinions": ("A state or territorial court's published opinion, from the Caselaw Access Project (released without restriction, 2024): "
                             "no copyright in the text; publisher's headnotes and editorial matter left out; served under decision record 0060."),
    "federal-court-opinions": ("A federal court's published opinion, from the Caselaw Access Project (released without restriction, 2024): "
                               "no copyright in the text; publisher's headnotes and editorial matter left out; served under decision record 0060."),
}
DEFAULT_RIGHTS = "Private research copy; not redistributed."

# Decision record 0031 (Trevor Goldsmith, 2026-11-22): the website serves the
# project's copies of nations' constitutions and laws, whatever the citing
# record's link-only status, except copies taken from commercial code
# publishers, whose compilations carry their own copyright and terms. A
# nation's removal request is carried out by setting "redistribution": "no"
# for the key in research/capture-index-overrides.json, which wins.
NATION_LAW_TOPICS = {"constitutions", "tribal-law"}
CODE_PUBLISHERS = ("ecode360.com", "municode.com", "codepublishing.com", "amlegal.com")
PUBLISHER_RIGHTS = ("Tribal law as compiled by a commercial code publisher: private research copy; "
                    "the publisher's compilation and terms apply (decision record 0031).")
# Decision record 0043 (Trevor Goldsmith, 2026-11-22): copies taken from the
# National Indian Law Library stay in the bucket but are not served. NILL says a
# nation's permission to NILL "does not serve as implied consent" to use the
# materials elsewhere, so pages link to NILL's copy until the nation itself
# agrees; that consent is recorded with "redistribution": "yes" in
# research/capture-index-overrides.json. A copy also published at an address
# that is not NILL's (such as the nation's own site) is not affected.
NATIONAL_INDIAN_LAW_LIBRARY = ("narf.org/nill/", "nill.narf.org/")
LIBRARY_RIGHTS = ("Copy taken from the National Indian Law Library: private research copy, "
                  "not served until the nation consents; pages link to NILL (decision record 0043).")


# Files under govinfo/ come from GovInfo, the Government Publishing Office's
# site: federal statutes and Federal Register documents, works of the United
# States government with no copyright (17 U.S.C. 105), whatever the rights
# note of a record that cites the same act says (site/tools/fetch-public-copies.mjs).
GOVERNMENT_TOPICS = {"govinfo"}
GOVERNMENT_RIGHTS = "Work of the United States government; no copyright (17 U.S.C. § 105). Served on the website (decision record 0031)."


def nation_law_policy(topic: str, link: str) -> tuple[str, str] | None:
    """(redistribution, rights) for a federal document or a nation's constitution or law; None for other topics."""
    if topic in GOVERNMENT_TOPICS:
        return "yes", GOVERNMENT_RIGHTS
    if topic not in NATION_LAW_TOPICS:
        return None
    if any(publisher in link for publisher in CODE_PUBLISHERS):
        return "no", PUBLISHER_RIGHTS
    addresses = link.split()
    if addresses and all(any(library in address for library in NATIONAL_INDIAN_LAW_LIBRARY) for address in addresses):
        return "no", LIBRARY_RIGHTS
    return "yes", TOPIC_RIGHTS[topic]


# ---------------------------------------------------------------- helpers

def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def load_cache(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def hashed_files(root: Path, cache_path: Path) -> list[dict]:
    """Every file under root with its size and SHA-256 (cached by size and mtime)."""
    cache = load_cache(cache_path)
    out = []
    changed = 0
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        key = path.relative_to(root).as_posix()
        stat = path.stat()
        entry = cache.get(key)
        if not entry or entry["bytes"] != stat.st_size or entry["mtime"] != int(stat.st_mtime):
            entry = {"bytes": stat.st_size, "mtime": int(stat.st_mtime), "sha256": sha256_of(path)}
            cache[key] = entry
            changed += 1
            if changed % 500 == 0:
                cache_path.write_text(json.dumps(cache), encoding="utf-8")
                print(f"  hashed {changed} files...", file=sys.stderr)
        out.append({"key": key, **entry})
    cache_path.write_text(json.dumps(cache), encoding="utf-8")
    return out


def read_yaml_key(path: Path) -> str:
    for line in path.read_text(encoding="utf-8").splitlines()[:5]:
        match = re.match(r"^(key|id):\s*['\"]?([^'\"\s]+)", line)
        if match:
            return match.group(2)
    return path.stem


def record_kind(path: Path) -> str:
    part = path.relative_to(REPO / "content").parts[0]
    return {"sources": "source", "documents": "document-history", "tribes": "tribe-profile",
            "stories": "story"}.get(part, part)


def content_references() -> tuple[dict, dict, dict, set]:
    """Map capture paths, SHA-256 values and file names to the records that mention them."""
    by_path, by_sha, by_name = {}, {}, {}
    source_keys = set()
    sha_re = re.compile(r"\b[a-f0-9]{64}\b")
    path_re = re.compile(r"research/captures/([^\s'\"`)\]]+)")
    loose_re = re.compile(r"\b((?:canada|westlaw|articles|congress|peacemaking|stories|state-court-rules|tribal-court-decisions|uniform-law-commission|american-bar-association|nation-images|gaming|constitutions|tribal-law)/[^\s'\"`)\],]+\.(?:pdf|png|txt|html|jpg|docx))")
    for path in sorted((REPO / "content").rglob("*.yaml")):
        text = path.read_text(encoding="utf-8")
        ref = (read_yaml_key(path), record_kind(path))
        if ref[1] == "source":
            source_keys.add(ref[0])
        for match in path_re.findall(text) + loose_re.findall(text):
            by_path.setdefault(match.rstrip(".,;"), set()).add(ref)
        for match in sha_re.findall(text):
            by_sha.setdefault(match, set()).add(ref)
        for match in re.findall(r"[\w.-]+\.(?:pdf|png|jpg|webp|svg|gif|html|docx)", text):
            by_name.setdefault(match, set()).add(ref)
    return by_path, by_sha, by_name, source_keys


def catalog_rows(captures: Path) -> dict:
    """Metadata from the research catalogs, keyed by capture key."""
    rows = {}

    def put(key, **values):
        row = rows.setdefault(key, {})
        for name, value in values.items():
            if value and not row.get(name):
                row[name] = value

    research = REPO / "research"
    constitutions = research / "constitutions" / "documents.json"
    if constitutions.exists():
        for item in json.loads(constitutions.read_text(encoding="utf-8")):
            capture = item.get("capture") or ""
            capture = capture.split("research/captures/")[-1]
            if not capture:
                nation, digest = item["key"].split(":")
                capture = f"constitutions/{nation}/{digest}.{item.get('format') or 'pdf'}"
            put(capture, title=item.get("printed_title") or item.get("link_text"),
                nations=[item.get("nation")], link=item.get("link"),
                records=[item["source"]] if item.get("source") else [],
                catalog=f"research/constitutions/documents.json#{item['key']}",
                captured=item.get("wayback_timestamp") and item["wayback_timestamp"][:8])
    for name, folder in (("compact-documents.json", "gaming/compacts/"), ("ordinance-documents.json", "gaming/ordinances/")):
        catalog = research / "gaming" / name
        if not catalog.exists():
            continue
        for item in json.loads(catalog.read_text(encoding="utf-8")):
            capture = (item.get("capture") or {}).get("capture")
            if not capture:
                continue
            capture = capture.split("research/captures/")[-1]
            if not capture.startswith("gaming/"):
                capture = folder + capture
            put(capture, title=item.get("title") or f"{item.get('kind', 'ordinance')} {item.get('listed_date', '')}".strip(),
                nations=item.get("nations"), link=item.get("final_link") or item.get("document_link") or item.get("link"),
                listed_in=[item["source"]] if item.get("source") else [],
                catalog=f"research/gaming/{name}#{item['id']}")
    tribal = research / "tribal-law" / "documents.json"
    if tribal.exists():
        for item in json.loads(tribal.read_text(encoding="utf-8")):
            capture = item.get("capture")
            if not capture:
                continue
            capture = capture.split("research/captures/")[-1]
            titles = [c.get("title") for c in item.get("cited_by", []) if c.get("title")]
            put(capture, title=item.get("page_title") or (titles[0] if titles else None),
                nations=item.get("nations"), link=item.get("final_url") or item.get("url"),
                captured=item.get("fetched"), catalog=f"research/tribal-law/documents.json#{item.get('sha256', '')[:16]}")
    manifest = captures / "nation-images" / "manifest.json"
    if manifest.exists():
        for item in json.loads(manifest.read_text(encoding="utf-8")):
            put(item["path"], title=f"{item.get('kind', 'image')} of {item.get('nation')}",
                nations=[item.get("nation")], link=item.get("image_link"), captured=item.get("retrieved"),
                records=[item.get("nation")], catalog="research/captures/nation-images/manifest.json")
    # Per-file JSON sidecars written by the Tribal law collector.
    for sidecar in (captures / "tribal-law" / "documents").glob("*.json"):
        try:
            item = json.loads(sidecar.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if item.get("file"):
            put(f"tribal-law/documents/{item['file']}", link=item.get("final_url") or item.get("url"),
                captured=item.get("fetched"))
    return rows


def main_file_for(key: str, keys: set) -> str | None:
    """For a text extract or sidecar, the file it was made from."""
    for suffix in (".ocr.txt", ".txt", ".json", ".raw"):
        if key.endswith(suffix):
            stem = key[: -len(suffix)]
            for ext in (".pdf", ".html", ".docx", ".png", ".jpg", ""):
                if stem + ext in keys and stem + ext != key:
                    return stem + ext
    return None


def guess_records(key: str, source_keys: set) -> list[str]:
    """Match hand-pulled files named after their record (westlaw/johnson-v-mintosh-1823-westlaw.pdf)."""
    stem = Path(key).name.split(".")[0]
    stem = re.sub(r"-(westlaw|supreme-court-reporter|federal-reporter|superior-court-westlaw|keycite-[0-9-]+|scr|partial-print|wayback-[0-9-]+|[0-9]{4}-[0-9]{2}-[0-9]{2})$", "", stem)
    if stem in source_keys:
        return [stem]
    candidates = [s for s in source_keys if stem.startswith(s) and len(s) > 12]
    candidates += [s for s in source_keys if s.startswith(stem) and len(stem) > 12]
    return sorted(set(candidates))[:3]


# ---------------------------------------------------------------- index

def build_index(args) -> None:
    captures = Path(args.captures)
    cache = Path(args.cache) if args.cache else captures.parent / "tools" / "capture-hash-cache.json"
    files = hashed_files(captures, cache)
    # Files already moved to the bucket (local copy pruned) keep their row.
    local = {f["key"] for f in files}
    # The previous index is the fallback for what can't be derived again,
    # such as the title, link and rights given to `add`.
    previous = {row["key"]: row for row in load_index()} if INDEX_CSV.exists() else {}
    if previous:
        for old in previous.values():
            if old["key"] not in local:
                files.append({"key": old["key"], "bytes": int(old["bytes"]), "sha256": old["sha256"],
                              "mtime": None, "captured_before": old["captured"]})
    files.sort(key=lambda f: f["key"])
    keys = {f["key"] for f in files}
    by_path, by_sha, by_name, source_keys = content_references()
    catalogs = catalog_rows(captures)
    sources_dir = REPO / "content" / "sources"
    overrides = {}
    overrides_path = REPO / "research" / "capture-index-overrides.json"
    if overrides_path.exists():
        overrides = json.loads(overrides_path.read_text(encoding="utf-8"))

    rows = []
    for item in files:
        key = item["key"]
        prev = previous.get(key, {})
        topic = key.split("/")[0]
        parent = main_file_for(key, keys)
        lookup = parent or key
        cat = dict(catalogs.get(lookup, {}))
        refs = set(by_path.get(key, set())) | set(by_path.get(lookup, set()))
        refs |= by_sha.get(item["sha256"], set())
        name = Path(lookup).name
        if topic not in ("tribal-law", "gaming", "constitutions") and name in by_name:
            refs |= by_name[name]
        record_ids = {r[0] for r in refs}
        kinds = {r[1] for r in refs}
        for rec in cat.get("records") or []:
            record_ids.add(rec)
            kinds.add("source" if rec in source_keys else "tribe-profile" if topic == "nation-images" else "catalog-source")
        if not record_ids and topic not in ("tribal-law", "gaming", "constitutions", "nation-images"):
            for rec in guess_records(lookup, source_keys):
                record_ids.add(rec)
                kinds.add("source")
        extra = overrides.get(lookup, {})
        record_ids |= set(extra.get("records", []))
        record_ids |= {r for r in prev.get("records", "").split(";") if r}
        kinds |= {k for k in prev.get("record_kinds", "").split(";") if k}
        if extra.get("records"):
            kinds.add("source")
        rights = prev.get("rights") or TOPIC_RIGHTS.get(topic, DEFAULT_RIGHTS)
        # yes only when a citing source record says rights.redistribution: true
        # (or an override says so); the website serves nothing else.
        redistributable = extra.get("redistribution") or prev.get("redistribution") or "unknown"
        never_served = topic in NEVER_SERVED
        title = extra.get("title") or cat.get("title")
        for rec in sorted(record_ids):
            src = sources_dir / rec[0] / f"{rec}.yaml"
            if src.exists():
                text = src.read_text(encoding="utf-8")
                status = re.search(r"^  status:\s*(\S+)", text, re.M)
                basis = re.search(r"^  basis:\s*(\S+)", text, re.M)
                redistribution = re.search(r"^  redistribution:\s*(\S+)", text, re.M)
                if redistribution and "redistribution" not in extra:
                    redistributable = "yes" if redistribution.group(1).lower() == "true" else "no"
                if status:
                    rights = f"From source record {rec}: status {status.group(1)}" + (
                        f", basis {basis.group(1)}" if basis else "") + (
                        f", redistribution {redistribution.group(1)}" if redistribution else "") + "."
                if not title:
                    found = re.search(r"^  title:\s*(?:>-\n\s+)?['\"]?(.+?)['\"]?$", text, re.M)
                    title = found.group(1).strip() if found else None
                break
        title = title or prev.get("title")
        captured = cat.get("captured") or extra.get("captured") or (
            prev.get("captured") if prev.get("captured") and "(file date)" not in prev.get("captured") else None)
        if captured and re.fullmatch(r"\d{8}", captured):
            captured = f"{captured[:4]}-{captured[4:6]}-{captured[6:]}"
        if not captured and item.get("mtime") is None:
            before = item["captured_before"]
            captured = before.replace(" (file date)", "")
            captured_note = " (file date)" if "(file date)" in before else ""
        elif not captured:
            captured = dt.datetime.fromtimestamp(item["mtime"], dt.timezone.utc).date().isoformat()
            captured_note = " (file date)"
        else:
            captured_note = ""
        obtained = extra.get("obtained") or (prev.get("obtained") if prev.get("obtained") not in (
            None, "", "unknown", "fetched during research", "downloaded by the project's collection scripts") else None) or (
            "downloaded by the project's collection scripts" if cat.get("link") and topic in ("tribal-law", "gaming", "constitutions", "nation-images")
            else f"hand pull by {HAND_PULLER}" if topic in ("westlaw", "articles", "canada", "congress", "peacemaking", "stories", "state-court-rules", "tribal-court-decisions")
            else "fetched during research" if cat.get("link") else "unknown")
        media = mimetypes.guess_type(key)[0] or ("text/plain" if key.endswith(".raw") else "application/octet-stream")
        orphan = not ({"source", "document-history", "story", "tribe-profile"} & kinds)
        link = " ".join(extra["link"]) if isinstance(extra.get("link"), list) else (extra.get("link") or cat.get("link") or prev.get("link") or "")
        policy = nation_law_policy(topic, link) if parent is None and "redistribution" not in extra else None
        if policy:
            redistributable, rights = policy
        rows.append({
            "key": key, "bytes": item["bytes"], "sha256": item["sha256"], "media_type": media,
            "topic": topic, "title": (title or "")[:300],
            "nations": ";".join(n for n in (cat.get("nations") or extra.get("nations")
                                            or prev.get("nations", "").split(";")) if n),
            "obtained": obtained, "link": link,
            "captured": captured + captured_note,
            "records": ";".join(sorted(record_ids)), "record_kinds": ";".join(sorted(kinds)),
            "listed_in": ";".join(cat.get("listed_in") or []), "catalog": cat.get("catalog", ""),
            "derived_from": parent or "", "rights": extra.get("rights") or rights,
            "redistribution": "no" if never_served else redistributable,
            "keep_local": "yes" if key.endswith(TEXT_SUFFIXES) or key == "nation-images/manifest.json" else "no",
            "orphan": "yes" if orphan else "no",
        })

    write_index(rows)


def write_index(rows: list[dict]) -> None:
    """Write the index (CSV and JSON) and the orphans list."""
    INDEX_CSV.parent.mkdir(parents=True, exist_ok=True)
    with INDEX_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    orphans = [r for r in rows if r["orphan"] == "yes" and not r["derived_from"]]
    with ORPHANS_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["key", "topic", "title", "link", "catalog", "listed_in", "nations"],
                                extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(orphans)
    total = sum(int(r["bytes"]) for r in rows)
    print(f"{len(rows)} files, {total / 1e9:.2f} GB; {len(orphans)} main files with no citing record.")


# ---------------------------------------------------------------- bucket

def have_credentials() -> bool:
    return bool((os.environ.get("R2_ACCOUNT_ID") or os.environ.get("CLOUDFLARE_ACCOUNT_ID"))
                and os.environ.get("R2_ACCESS_KEY_ID") and os.environ.get("R2_SECRET_ACCESS_KEY"))


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
    return boto3.client("s3", endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
                        aws_access_key_id=key_id, aws_secret_access_key=secret, region_name="auto",
                        config=Config(retries={"max_attempts": 5, "mode": "standard"}))


def bucket_name() -> str:
    return os.environ.get("R2_BUCKET", DEFAULT_BUCKET)


def safe_name(name: str) -> str:
    """A file name with no folders or odd characters, for a local copy."""
    cleaned = re.sub(r"[^A-Za-z0-9._ ()-]", "_", Path(name).name).strip(" .")
    return cleaned[-150:] or "file"


def index_row(*, key: str, size: int, digest: str, media: str, topic: str, title: str, nations: str,
              obtained: str, links: list[str], record: str, redistribution: str, rights: str | None,
              existing_keys: set) -> dict:
    """A new capture index row, with the rights and redistribution rules every filing follows."""
    rights_note = rights or TOPIC_RIGHTS.get(topic, DEFAULT_RIGHTS)
    policy = nation_law_policy(topic, " ".join(links)) if redistribution == "unknown" else None
    if policy:
        redistribution, rights_note = policy[0], rights or policy[1]
    today = dt.date.today().isoformat()
    return {
        "key": key, "bytes": size, "sha256": digest, "media_type": media,
        "topic": topic, "title": title, "nations": nations,
        "obtained": obtained, "link": " ".join(links), "captured": today,
        "records": record, "record_kinds": "source" if record else "", "listed_in": "",
        "catalog": "", "derived_from": main_file_for(key, existing_keys | {key}) or "", "rights": rights_note,
        "redistribution": "no" if topic in NEVER_SERVED else redistribution,
        "keep_local": "yes" if key.endswith(TEXT_SUFFIXES) else "no",
        "orphan": "no" if record else "yes",
    }


def load_index() -> list[dict]:
    with INDEX_CSV.open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def remote_state(s3, bucket: str, key: str):
    from botocore.exceptions import ClientError
    try:
        head = s3.head_object(Bucket=bucket, Key=key)
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
            return None
        raise
    return head["ContentLength"], head.get("Metadata", {}).get("sha256")


def upload(args) -> None:
    s3, bucket, captures = client(), os.environ.get("R2_BUCKET", DEFAULT_BUCKET), Path(args.captures)
    rows = load_index()
    done = skipped = 0
    for row in rows:
        path = captures / row["key"]
        state = remote_state(s3, bucket, row["key"])
        if state == (int(row["bytes"]), row["sha256"]):
            skipped += 1
            continue
        if not path.exists():
            print(f"missing locally and not in bucket: {row['key']}", file=sys.stderr)
            continue
        metadata = {"sha256": row["sha256"], "captured": row["captured"][:10]}
        if row.get("records"):
            metadata["records"] = row["records"][:1000]
        s3.upload_file(str(path), bucket, row["key"], ExtraArgs={
            "ContentType": row["media_type"], "Metadata": {k: v.encode("ascii", "ignore").decode() for k, v in metadata.items()}})
        done += 1
        if done % 200 == 0:
            print(f"  uploaded {done}...", file=sys.stderr)
    print(f"uploaded {done}, already there {skipped}, of {len(rows)}")


def verify(args) -> None:
    s3, bucket, captures = client(), os.environ.get("R2_BUCKET", DEFAULT_BUCKET), Path(args.captures)
    rows = load_index()
    report, failures = [], 0
    for row in rows:
        state = remote_state(s3, bucket, row["key"])
        ok = state == (int(row["bytes"]), row["sha256"])
        if ok and args.deep:
            body = s3.get_object(Bucket=bucket, Key=row["key"])["Body"]
            digest = hashlib.sha256()
            for block in iter(lambda: body.read(1 << 20), b""):
                digest.update(block)
            ok = digest.hexdigest() == row["sha256"]
        failures += not ok
        report.append({"key": row["key"], "ok": ok, "remote": state})
    out = captures.parent / "capture-verification.json"
    out.write_text(json.dumps({"checked": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                               "deep": bool(args.deep), "failures": failures, "objects": report}, indent=1) + "\n",
                   encoding="utf-8")
    print(f"verified {len(rows) - failures} of {len(rows)}; {failures} failed. Report: {out}")


def prune(args) -> None:
    captures = Path(args.captures)
    report_path = captures.parent / "capture-verification.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    passed = {o["key"] for o in report["objects"] if o["ok"]}
    rows = {r["key"]: r for r in load_index()}
    freed = count = 0
    for key, row in rows.items():
        path = captures / key
        if row["keep_local"] == "yes" or key not in passed or not path.exists():
            continue
        if path.stat().st_size != int(row["bytes"]):
            print(f"local file changed since indexing, kept: {key}", file=sys.stderr)
            continue
        freed += path.stat().st_size
        count += 1
        if args.confirm:
            path.unlink()
    verb = "deleted" if args.confirm else "would delete"
    print(f"{verb} {count} local copies, {freed / 1e9:.2f} GB")


def add(args) -> None:
    captures = Path(args.captures)
    bucket = os.environ.get("R2_BUCKET", DEFAULT_BUCKET)
    s3 = client() if have_credentials() else None
    if s3 is None:
        print("No R2 keys in this session: filing locally only. Run upload, verify and prune "
              "from a session that has R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.", file=sys.stderr)
    rows = load_index() if INDEX_CSV.exists() else []
    known = {r["sha256"]: r["key"] for r in rows}
    for name in args.files:
        source = Path(name)
        digest = sha256_of(source)
        if digest in known:
            print(f"already filed as {known[digest]}: {source.name}")
            continue
        key = f"{args.topic}/{args.name or source.name}"
        target = captures / key
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        media = mimetypes.guess_type(key)[0] or "application/octet-stream"
        if s3 is not None:
            s3.upload_file(str(target), bucket, key, ExtraArgs={"ContentType": media, "Metadata": {
                "sha256": digest, "captured": dt.date.today().isoformat()}})
            if remote_state(s3, bucket, key) != (target.stat().st_size, digest):
                sys.exit(f"verification failed for {key}; local copy kept")
        rows.append(index_row(
            key=key, size=target.stat().st_size, digest=digest, media=media, topic=args.topic,
            title=args.title or "", nations=args.nations or "",
            obtained=f"{args.obtained}, {dt.date.today().isoformat()}", links=args.link or [],
            record=args.record or "", redistribution=args.redistribution, rights=args.rights,
            existing_keys={r["key"] for r in rows},
        ))
        if s3 is not None and not args.keep_local:
            target.unlink()
        print(f"filed {key} ({digest[:16]})" + ("" if s3 is not None else ", local only until the next upload"))
    write_index(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("index", "upload", "verify", "prune", "add", "intake"):
        p = sub.add_parser(name)
        p.add_argument("--captures", required=True, help="the research/captures folder in the project's working files")
        if name == "index":
            p.add_argument("--cache", help="hash cache file (default: ../tools/capture-hash-cache.json)")
        if name == "verify":
            p.add_argument("--deep", action="store_true", help="download each object and hash its bytes")
        if name == "prune":
            p.add_argument("--confirm", action="store_true", help="actually delete; otherwise a dry run")
        if name == "add":
            p.add_argument("files", nargs="+")
            p.add_argument("--topic", required=True)
            p.add_argument("--name", help="file name to use in the bucket (one file only)")
            p.add_argument("--record", help="source record key(s), separated by ;")
            p.add_argument("--obtained", default=f"hand pull by {HAND_PULLER}")
            p.add_argument("--title")
            p.add_argument("--link", action="append", help="source address; repeat for more than one (stored space-separated)")
            p.add_argument("--redistribution", choices=["yes", "no", "unknown"], default="unknown",
                           help="yes only when the copy may be served publicly (for example a U.S. government work)")
            p.add_argument("--nations")
            p.add_argument("--rights")
            p.add_argument("--keep-local", action="store_true")
        if name == "intake":
            p.add_argument("--apply", metavar="PLAN", help="carry out a checked plan; without it, make the plan")
            p.add_argument("--plan", help="where to write the plan (default: intake-plan.json next to the captures folder)")
            p.add_argument("--pull-list", help="the pull list (default: documents-to-get.md next to the captures folder)")
            p.add_argument("--work", help="folder for the downloaded files (default: a temporary folder)")
            p.add_argument("--obtained", default=f"hand pull by {HAND_PULLER}, sent through the website")
    args = parser.parse_args()
    if args.command == "intake":
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import intake_uploads
        (intake_uploads.apply if args.apply else intake_uploads.plan)(args)
        return
    {"index": build_index, "upload": upload, "verify": verify, "prune": prune, "add": add}[args.command](args)


if __name__ == "__main__":
    main()
