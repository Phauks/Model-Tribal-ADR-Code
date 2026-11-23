"""Intake of files sent through the website's Intake page (docs/uploads.md, "Intake").

Run through mirror_captures.py, which does all filing:

  python3 scripts/captures/mirror_captures.py intake --captures /mnt/project-files/research/captures
      Plan. Reads the notes the Worker leaves at intake/waiting/<reference>.json
      in the bucket, downloads each waiting file, hashes it, and checks the
      capture index for the same SHA-256 (people send files twice). For a new
      file it reads the first pages and matches them to an open item of
      research/documents-to-get.md (in project files), suggesting a topic,
      bucket key, record, title and link. Anything that matches nothing is
      general intake: give it a topic and name by hand. Writes the plan to
      research/intake-plan.json next to the captures folder and prints it.

  python3 scripts/captures/mirror_captures.py intake --captures ... --apply PLAN
      Carry out a plan checked by a person. For each entry:
        file      copy the upload to its key in the bucket (a copy inside the
                  bucket, so nothing is downloaded again), check the copy by
                  size, SHA-256 metadata and its bytes, add the index row, fill
                  the record's `file` field, and answer the Worker with
                  intake/filed/<reference>.json;
        held      answer with the key already in the index;
        decline   answer with intake/declined/<reference>.json and the reason
                  (the sender sees it; the bytes go after 30 days);
        skip      do nothing yet.
      The Worker settles each upload the next time Uploads or Your uploads is
      opened, and deletes its own copy of a filed file.

The notes in the bucket carry everything between the Worker and this script,
so the script needs only the R2 keys it already uses, not the database.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import urllib.parse
from pathlib import Path

import mirror_captures as captures_tool

SOURCES = captures_tool.REPO / "content" / "sources"

# The topic (first folder of the bucket key) for items in each part of the pull
# list; westlaw prints are recognized from their text wherever they come from.
SECTION_TOPICS = {
    "1d": "constitutions", "1e": "tribal-law", "1f": "articles", "1g": "articles", "1h": "tribal-law",
    "2b": "tribal-law", "2c": "stories", "2d": "tribal-law", "2f": "cited-pages", "2g": "tribal-law",
    "2h": "tribal-law", "2i": "tribal-law", "4b": "books", "4d": "books", "4e": "articles",
    "4f": "tribal-court-forms", "4g": "gaming", "5a": "westlaw", "5b": "westlaw", "5c": "westlaw",
}
WESTLAW_MARKS = ("for educational use only", "thomson reuters. no claim to original u.s. government works")
EXTENSIONS = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "text/plain": ".txt", "text/csv": ".csv", "text/markdown": ".md",
    "image/jpeg": ".jpg", "image/png": ".png", "image/tiff": ".tif", "image/webp": ".webp",
}
STOP_WORDS = set("""a an and are as at be by for from in into is it its of on or the this to with
    v vs pdf download open save page click done when have send item record none yet""".split())
MATCH_AT = 0.8


# ---------------------------------------------------------------- pull list

def slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:120] or "file"


def words(text: str) -> list[str]:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return [w for w in re.findall(r"[a-z0-9]+", text) if len(w) >= 4 and w not in STOP_WORDS]


def record_title(key: str) -> str | None:
    """The citation title of a source record, if the key names one."""
    path = SOURCES / key[0] / f"{key}.yaml"
    if not path.exists():
        return None
    match = re.search(r"^  title: (.+)$", path.read_text(encoding="utf-8"), re.M)
    return match.group(1).strip().strip("'\"") if match else None


def open_items(pull_list: Path) -> list[dict]:
    """Every open item (`- [ ]`) of the pull list, with its part, links, record keys and title words."""
    items, section = [], ""
    for number, line in enumerate(pull_list.read_text(encoding="utf-8").splitlines(), 1):
        heading = re.match(r"^### (\d[a-z])\.", line)
        if heading:
            section = heading.group(1)
            continue
        if line.startswith("## Done"):
            break
        if not line.startswith("- [ ]"):
            continue
        links = re.findall(r"\]\((https?://[^)\s]+)\)", line)
        records = [key for key in re.findall(r"`([a-z0-9][a-z0-9#.-]+)`", line) if "-" in key and "/" not in key]
        plain = re.sub(r"\]\([^)]*\)", "]", line)
        plain = re.sub(r"`[^`]*`", " ", plain)
        source_keys = [key for key in records if "#" not in key and (SOURCES / key[0] / f"{key}.yaml").exists()]
        title = record_title(source_keys[0]) if source_keys else None
        if not title:
            emphasis = re.search(r"\*([^*]{8,})\*", plain) or re.search(r"\[([^\]]{8,})\]", plain)
            title = emphasis.group(1) if emphasis else plain[6:120]
        items.append({
            "part": section, "line": number, "text": re.sub(r"\s+", " ", plain[6:]).strip()[:240],
            "links": links, "records": records, "source_records": source_keys, "title": re.sub(r"<[^>]+>", "", title).strip(),
            "words": sorted(set(words(title))),
        })
    return items


def url_stem(link: str) -> str:
    path = urllib.parse.unquote(urllib.parse.urlparse(link).path)
    return Path(path).stem.lower()


def file_stem(name: str) -> str:
    return re.sub(r"\s*\(\d+\)$", "", Path(name).stem).lower()


def best_item(items: list[dict], text: str, file_name: str) -> tuple[dict | None, float]:
    """The open item whose title words best appear in the file's first pages, or whose link names the file."""
    found = set(words(text))
    best, best_score = None, 0.0
    stem = file_stem(file_name)
    for item in items:
        # A title of one or two words ("tribal law page") would match almost anything.
        score = len(found & set(item["words"])) / len(item["words"]) if len(item["words"]) >= 3 else 0.0
        if stem and stem not in ("viewcontent", "download", "document", "file") and any(url_stem(link) == stem for link in item["links"]):
            score = max(score, 1.0)
        if score > best_score:
            best, best_score = item, score
    return (best, round(best_score, 2)) if best_score >= MATCH_AT else (None, round(best_score, 2))


# ---------------------------------------------------------------- reading files

def first_pages_text(path: Path, media_type: str) -> str:
    if media_type == "application/pdf" and shutil.which("pdftotext"):
        result = subprocess.run(["pdftotext", "-l", "3", "-q", str(path), "-"], capture_output=True, text=True, timeout=120)
        return result.stdout
    if media_type.startswith("text/"):
        return path.read_text(encoding="utf-8", errors="replace")[:40000]
    return ""


def sha256_of(path: Path) -> str:
    return captures_tool.sha256_of(path)


# ---------------------------------------------------------------- bucket notes

def list_notes(s3, bucket: str, stage: str) -> list[str]:
    keys, token = [], None
    while True:
        extra = {"ContinuationToken": token} if token else {}
        page = s3.list_objects_v2(Bucket=bucket, Prefix=f"intake/{stage}/", **extra)
        keys += [item["Key"] for item in page.get("Contents", [])]
        if not page.get("IsTruncated"):
            return keys
        token = page["NextContinuationToken"]


def read_note(s3, bucket: str, key: str) -> dict:
    return json.loads(s3.get_object(Bucket=bucket, Key=key)["Body"].read())


def write_note(s3, bucket: str, stage: str, reference: str, body: dict) -> None:
    s3.put_object(Bucket=bucket, Key=f"intake/{stage}/{reference}.json", Body=json.dumps(body).encode(),
                  ContentType="application/json")


def deep_hash(s3, bucket: str, key: str) -> str:
    body = s3.get_object(Bucket=bucket, Key=key)["Body"]
    digest = hashlib.sha256()
    for block in iter(lambda: body.read(1 << 20), b""):
        digest.update(block)
    return digest.hexdigest()


# ---------------------------------------------------------------- plan

def plan(args) -> None:
    s3, bucket = captures_tool.client(), captures_tool.bucket_name()
    captures = Path(args.captures)
    pull_list = Path(args.pull_list) if args.pull_list else captures.parent / "documents-to-get.md"
    items = open_items(pull_list) if pull_list.exists() else []
    if not items:
        print(f"No open items read from {pull_list}; every file will be general intake.", file=sys.stderr)
    work = Path(args.work or Path(tempfile.gettempdir()) / "capture-intake")
    work.mkdir(parents=True, exist_ok=True)
    index = captures_tool.load_index() if captures_tool.INDEX_CSV.exists() else []
    known = {row["sha256"]: row["key"] for row in index}
    answered = {Path(key).stem for stage in ("filed", "declined") for key in list_notes(s3, bucket, stage)}
    entries, seen = [], {}
    for note_key in sorted(list_notes(s3, bucket, "waiting")):
        offer = read_note(s3, bucket, note_key)
        reference = offer["reference"]
        if reference in answered:
            continue
        local = work / reference / captures_tool.safe_name(offer.get("fileName") or "file")
        local.parent.mkdir(parents=True, exist_ok=True)
        if not local.exists() or local.stat().st_size != offer.get("sizeBytes"):
            s3.download_file(bucket, offer["key"], str(local))
        digest = sha256_of(local)
        media = offer.get("mediaType") or "application/octet-stream"
        entry = {
            "reference": reference, "upload_key": offer["key"], "file_name": offer.get("fileName"),
            "bytes": local.stat().st_size, "sha256": digest, "media_type": media, "local": str(local),
            "note": offer.get("note"), "received": offer.get("receivedAt"),
        }
        if digest in known:
            entry.update(action="held", key=known[digest])
        elif digest in seen:
            entry.update(action="held", key=seen[digest], same_as=seen[digest])
        else:
            text = first_pages_text(local, media)
            westlaw = any(mark in text.lower() for mark in WESTLAW_MARKS)
            # A Westlaw print answers a Westlaw item (part 5), and nothing else does.
            candidates = [item for item in items if item["part"].startswith("5") == westlaw]
            item, score = best_item(candidates, text, offer.get("fileName") or "")
            topic = "westlaw" if westlaw else (SECTION_TOPICS.get(item["part"]) if item else None)
            record = item["source_records"][0] if item and item["source_records"] else None
            extension = EXTENSIONS.get(media) or Path(offer.get("fileName") or "").suffix.lower()
            name = f"{record or slug(file_stem(offer.get('fileName') or reference))}{extension}"
            entry.update(
                action="file" if topic else "skip",
                topic=topic, key=f"{topic}/{name}" if topic else None,
                record=record, title=(item["title"] if item else None),
                link=(item["links"][:1] if item else []), nations=None, redistribution="unknown",
                pull_list_item={"part": item["part"], "line": item["line"], "text": item["text"], "score": score} if item else None,
                match_score=score, text_found=bool(text.strip()),
            )
            if entry["key"]:
                seen[digest] = entry["key"]
        entries.append(entry)
    out = Path(args.plan or captures.parent / "intake-plan.json")
    out.write_text(json.dumps({"made": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                               "pull_list": str(pull_list), "entries": entries}, indent=1, ensure_ascii=False) + "\n",
                   encoding="utf-8")
    for entry in entries:
        matched = entry.get("pull_list_item")
        where = f"{matched['part']} line {matched['line']} ({matched['score']})" if matched else ("" if entry["action"] == "held" else "general intake")
        print(f"{entry['reference']}  {entry['action']:<7} {entry.get('key') or '(choose a topic and name)'}  {where}  <- {entry['file_name']}")
    print(f"{len(entries)} waiting. Plan: {out}. Check it (topic, key, record, title, link, action), then run with --apply {out}.")


# ---------------------------------------------------------------- apply

def attach_file_to_record(record: str, row: dict) -> str:
    """Fills the record's `file` field from the index row; leaves a record that already has one."""
    path = SOURCES / record[0] / f"{record}.yaml"
    if not path.exists():
        return f"no source record {record}"
    text = path.read_text(encoding="utf-8")
    if re.search(r"^file:", text, re.M):
        return f"{record} already has a file field; left as it is"
    block = (f"file:\n  storage_key: {row['key']}\n  checksum: {row['sha256']}\n"
             f"  media_type: {row['media_type']}\n  bytes: {row['bytes']}\n")
    anchor = re.search(r"^(found_in|notes):", text, re.M)
    text = text[: anchor.start()] + block + text[anchor.start():] if anchor else text.rstrip("\n") + "\n" + block
    path.write_text(text, encoding="utf-8")
    return f"{record}: file field filled"


def apply(args) -> None:
    s3, bucket = captures_tool.client(), captures_tool.bucket_name()
    entries = json.loads(Path(args.apply).read_text(encoding="utf-8"))["entries"]
    rows = captures_tool.load_index() if captures_tool.INDEX_CSV.exists() else []
    known = {row["sha256"]: row["key"] for row in rows}
    keys = {row["key"] for row in rows}
    today = dt.date.today().isoformat()
    report, changed = [], False
    for entry in entries:
        reference, action = entry["reference"], entry.get("action")
        if action == "decline":
            write_note(s3, bucket, "declined", reference, {"reference": reference, "reason": entry.get("reason") or "Not needed."})
            report.append(f"- {reference} ({entry['file_name']}): not used. {entry.get('reason') or ''}".rstrip())
            continue
        if action == "held":
            key = known.get(entry["sha256"]) or entry.get("key")
            state = captures_tool.remote_state(s3, bucket, key) if key else None
            if not state or state[0] != entry["bytes"]:
                print(f"{reference}: {key} is not in the bucket at that size; skipped", file=sys.stderr)
                continue
            write_note(s3, bucket, "filed", reference, {"reference": reference, "captureKey": key, "sha256": entry["sha256"], "alreadyHeld": True})
            report.append(f"- {reference} ({entry['file_name']}): already held as `{key}`.")
            continue
        if action != "file":
            continue
        key, topic = entry.get("key"), entry.get("topic")
        if not key or not topic or not key.startswith(f"{topic}/") or key.startswith(("uploads/", "intake/")) or ".." in key.split("/"):
            print(f"{reference}: give a topic and a key under it; skipped", file=sys.stderr)
            continue
        if entry["sha256"] in known:
            print(f"{reference}: already filed as {known[entry['sha256']]}; mark it held", file=sys.stderr)
            continue
        if key in keys or captures_tool.remote_state(s3, bucket, key):
            print(f"{reference}: {key} is taken by another file; choose another name", file=sys.stderr)
            continue
        metadata = {"sha256": entry["sha256"], "captured": today}
        if entry.get("record"):
            metadata["records"] = entry["record"][:1000]
        s3.copy_object(Bucket=bucket, Key=key, CopySource={"Bucket": bucket, "Key": entry["upload_key"]},
                       MetadataDirective="REPLACE", ContentType=entry["media_type"],
                       Metadata={k: v.encode("ascii", "ignore").decode() for k, v in metadata.items()})
        if captures_tool.remote_state(s3, bucket, key) != (entry["bytes"], entry["sha256"]) or deep_hash(s3, bucket, key) != entry["sha256"]:
            sys.exit(f"{reference}: the copy at {key} failed its check; nothing answered for it")
        row = captures_tool.index_row(
            key=key, size=entry["bytes"], digest=entry["sha256"], media=entry["media_type"], topic=topic,
            title=entry.get("title") or "", nations=entry.get("nations") or "",
            obtained=f"{args.obtained}, {today}", links=entry.get("link") or [], record=entry.get("record") or "",
            redistribution=entry.get("redistribution") or "unknown", rights=entry.get("rights"),
            existing_keys=keys,
        )
        rows.append(row)
        keys.add(key)
        known[entry["sha256"]] = key
        changed = True
        record_note = attach_file_to_record(entry["record"], row) if entry.get("record") else "no record"
        write_note(s3, bucket, "filed", reference, {"reference": reference, "captureKey": key, "sha256": entry["sha256"]})
        item = entry.get("pull_list_item")
        where = f" Pull list {item['part']}, line {item['line']}." if item else " General intake."
        report.append(f"- {reference} ({entry['file_name']}): filed as `{key}` ({entry['sha256'][:16]}).{where} {record_note}.")
    if changed:
        captures_tool.write_index(rows)
    print("\n".join(report) if report else "Nothing to do.")
    print("\nNext: move the matched items to Done in documents-to-get.md, write the batch up in research/pull-results/, "
          "and open Uploads in the workspace so the site settles the files.")
