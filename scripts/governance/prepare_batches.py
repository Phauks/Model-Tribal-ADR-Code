#!/usr/bin/env python3
"""Pick each nation's newest constitution text and split them into reading batches.

For every document history in content/documents/*/<nation>-constitution.yaml
the script picks one version to read for governance facts: the version marked
in-effect, else the newest dated full text (not an amendment, not a
proposal), else any full text; a version whose extract has under 2,000
characters (a scan with no text layer) gives way to the next one. Its text extract is the capture's .txt beside
the capture path, under the private captures folder.

  python3 scripts/governance/prepare_batches.py CAPTURES_FOLDER OUT_FOLDER [MAX_CHARACTERS]

Writes OUT_FOLDER/picked.json (one row per nation) and OUT_FOLDER/batch-NNN.json,
each holding nations whose texts add up to at most MAX_CHARACTERS
(default 240000). The AI readers follow scripts/governance/reader-brief.md and
write OUT_FOLDER/batch-NNN.answers.json.
"""

import glob
import json
import os
import sys

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FULL_TEXT_EVENTS = {"original", "edition", "revision"}
MINIMUM_TEXT = 2000


def version_date(version):
    dates = version.get("dates") or {}
    values = [str(value) for value in dates.values() if value]
    return max(values) if values else ""


def ranked(history):
    """The versions in the order they should be read: in effect, newest dated full text, undated, the rest."""
    versions = [version for version in history["versions"] if version.get("capture", {}).get("path")]
    full = [v for v in versions if v.get("event") in FULL_TEXT_EVENTS and v.get("status") != "proposed"]
    order = [v for v in full if v.get("status") == "in-effect"]
    order += sorted((v for v in full if version_date(v) and v not in order), key=version_date, reverse=True)
    order += [v for v in full if v not in order]
    order += [v for v in versions if v not in order and v.get("status") != "proposed"]
    return order


def text_of(captures, version):
    relative = version["capture"]["path"].removeprefix("research/captures/")
    text_path = os.path.join(captures, os.path.splitext(relative)[0] + ".txt")
    return text_path if os.path.exists(text_path) else None


def pick(history, captures):
    """The first version in reading order whose text extract has enough text to read."""
    order = ranked(history)
    for version in order:
        text_path = text_of(captures, version)
        if text_path and os.path.getsize(text_path) >= MINIMUM_TEXT:
            return version, text_path
    return (order[0], None) if order else (None, None)


def main():
    captures, out = sys.argv[1], sys.argv[2]
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 240000
    os.makedirs(out, exist_ok=True)
    picked = []
    for path in sorted(glob.glob(os.path.join(ROOT, "content/documents/*/*-constitution.yaml"))):
        with open(path, encoding="utf-8") as handle:
            history = yaml.safe_load(handle)
        version, text_path = pick(history, captures)
        if not version:
            continue
        characters = os.path.getsize(text_path) if text_path else 0
        tribe = history["nations"][0]
        profile = glob.glob(os.path.join(ROOT, f"content/tribes/*/{tribe}.yaml"))
        name = ""
        if profile:
            with open(profile[0], encoding="utf-8") as handle:
                name = yaml.safe_load(handle)["names"]["official"]
        picked.append(
            {
                "nation": tribe,
                "nation_name": name,
                "document": history["id"],
                "version": version["id"],
                "version_label": version.get("label", ""),
                "status": version.get("status"),
                "event": version.get("event"),
                "date": version_date(version),
                "source": version.get("source"),
                "text_path": text_path,
                "characters": characters,
            }
        )
    with open(os.path.join(out, "picked.json"), "w", encoding="utf-8") as handle:
        json.dump(picked, handle, indent=1, ensure_ascii=False)
    readable = [row for row in picked if row["text_path"] and row["characters"] >= MINIMUM_TEXT]
    batches, current, size = [], [], 0
    for row in readable:
        if current and size + row["characters"] > limit:
            batches.append(current)
            current, size = [], 0
        current.append(row)
        size += row["characters"]
    if current:
        batches.append(current)
    for index, batch in enumerate(batches, 1):
        with open(os.path.join(out, f"batch-{index:03d}.json"), "w", encoding="utf-8") as handle:
            json.dump(batch, handle, indent=1, ensure_ascii=False)
    print(f"{len(picked)} nations picked, {len(readable)} readable, {len(batches)} batches")
    print("total characters", sum(row["characters"] for row in readable))


if __name__ == "__main__":
    main()
