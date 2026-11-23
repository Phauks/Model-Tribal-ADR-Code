#!/usr/bin/env python3
"""Add reviewed jurisdiction and federal-relationship facts to nation profiles.

Reads one or more batch files from research/jurisdiction/ and writes their
facts into content/tribes/<letter>/<id>.yaml and their searches into
research/search-logs/<topic>/<letter>/<id>.yaml. A batch file is JSON:

  {
    "session": "2026-11-23-jurisdiction-and-federal-ties",
    "facts": [{"profile": "<id>", "key": "jurisdiction", "fact": {...}}, ...],
    "objects": [{"profile": "<id>", "key": "indian_health_service", "value": {...}}, ...],
    "searches": [{"profile": "<id>", "topic": "jurisdiction", "status": "found",
                  "entry": {...search entry...}}, ...]
  }

`facts` go at the end of a top-level list (created in schema order when the
profile has none); a fact already in the list is skipped, so a batch can be
applied twice. `objects` set a top-level mapping. Every other line of the
profile keeps its layout, and each written file is read back and compared
with the intended record.

Usage: python3 scripts/jurisdiction/apply.py research/jurisdiction/<batch>.json ...
"""
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
TRIBES = ROOT / "content" / "tribes"
LOGS = ROOT / "research" / "search-logs"

# Top-level keys of a profile, in the order the schema lists them.
ORDER = list(json.loads((ROOT / "schemas" / "tribe.schema.json").read_text())["properties"])


def dump(value) -> str:
    """YAML with no line breaks inside a value (the project does not hard-wrap prose)."""
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def letter(identifier: str) -> str:
    return identifier[0] if identifier[0].isalpha() else "_other"


def profile_path(identifier: str) -> Path:
    path = TRIBES / letter(identifier) / f"{identifier}.yaml"
    if not path.exists():
        raise SystemExit(f"no profile {identifier}")
    return path


def top_level(lines: list[str]) -> list[int]:
    return [index for index, line in enumerate(lines) if re.match(r"[a-z_]+:", line)]


def insertion_point(lines: list[str], key: str) -> int:
    """The line before which a missing top-level key goes, by schema order."""
    later = set(ORDER[ORDER.index(key) + 1:])
    return next((index for index in top_level(lines) if lines[index].split(":")[0] in later), len(lines))


def add_items(text: str, key: str, items: list[dict]) -> str:
    lines = text.splitlines(keepends=True)
    tops = top_level(lines)
    start = next((index for index in tops if lines[index].split(":")[0] == key), None)
    block = dump(items)
    if start is None:
        at = insertion_point(lines, key)
        return "".join(lines[:at]) + f"{key}:\n" + block + "".join(lines[at:])
    if lines[start].strip() != f"{key}:":
        if lines[start].strip() in (f"{key}: []", f"{key}: null"):
            lines[start] = f"{key}:\n"
        else:
            raise SystemExit(f"unexpected line {lines[start]!r}")
    end = next((index for index in tops if index > start), len(lines))
    return "".join(lines[:end]) + block + "".join(lines[end:])


def add_nested_items(text: str, parent: str, key: str, items: list[dict]) -> str:
    """Append items to the list `key` inside the top-level mapping `parent`, leaving the rest of the block as written."""
    lines = text.splitlines(keepends=True)
    tops = top_level(lines)
    start = next((index for index in tops if lines[index].split(":")[0] == parent), None)
    block = "".join("  " + line for line in dump(items).splitlines(keepends=True))
    if start is None:
        at = insertion_point(lines, parent)
        return "".join(lines[:at]) + f"{parent}:\n  {key}:\n" + block + "".join(lines[at:])
    end = next((index for index in tops if index > start), len(lines))
    child = next((index for index in range(start + 1, end) if lines[index].rstrip() == f"  {key}:"), None)
    if child is None:
        return "".join(lines[:end]) + f"  {key}:\n" + block + "".join(lines[end:])
    after = next((index for index in range(child + 1, end) if re.match(r"  [a-z_]+:", lines[index])), end)
    return "".join(lines[:after]) + block + "".join(lines[after:])


def set_object(text: str, key: str, value: dict) -> str:
    lines = text.splitlines(keepends=True)
    tops = top_level(lines)
    start = next((index for index in tops if lines[index].split(":")[0] == key), None)
    block = dump({key: value})
    if start is None:
        at = insertion_point(lines, key)
        return "".join(lines[:at]) + block + "".join(lines[at:])
    end = next((index for index in tops if index > start), len(lines))
    return "".join(lines[:start]) + block + "".join(lines[end:])


def apply_profiles(batch: dict) -> int:
    by_profile: dict[str, list] = {}
    for entry in batch.get("facts", []):
        by_profile.setdefault(entry["profile"], []).append(("fact", entry))
    for entry in batch.get("objects", []):
        by_profile.setdefault(entry["profile"], []).append(("object", entry))
    changed = 0
    for identifier, entries in sorted(by_profile.items()):
        path = profile_path(identifier)
        text = path.read_text(encoding="utf-8")
        record = yaml.safe_load(text)
        expected = yaml.safe_load(text)
        new_items: dict[str, list] = {}
        for kind, entry in entries:
            key = entry["key"]
            if kind == "fact" and "." in key:
                parent, child = key.split(".")
                existing = ((expected.get(parent) or {}).get(child) or []) + new_items.get(key, [])
                if entry["fact"] in existing:
                    continue
                new_items.setdefault(key, []).append(entry["fact"])
            elif kind == "fact":
                existing = (expected.get(key) or []) + new_items.get(key, [])
                if entry["fact"] in existing:
                    continue
                new_items.setdefault(key, []).append(entry["fact"])
            else:
                if record.get(key) == entry["value"]:
                    continue
                text = set_object(text, key, entry["value"])
                expected[key] = entry["value"]
        for key, items in new_items.items():
            if "." in key:
                parent, child = key.split(".")
                text = add_nested_items(text, parent, child, items)
                expected.setdefault(parent, {})
                expected[parent][child] = (expected[parent].get(child) or []) + items
            else:
                text = add_items(text, key, items)
                expected[key] = (expected.get(key) or []) + items
        if text == path.read_text(encoding="utf-8"):
            continue
        if yaml.safe_load(text) != expected:
            raise SystemExit(f"{path}: written text does not match the intended record")
        path.write_text(text, encoding="utf-8")
        changed += 1
    return changed


STATUS_RANK = {"not-searched": 0, "partly-searched": 1, "none-found": 2, "found": 3}


def apply_searches(batch: dict) -> int:
    changed = 0
    grouped: dict[tuple, list] = {}
    for entry in batch.get("searches", []):
        grouped.setdefault((entry["topic"], entry["profile"]), []).append(entry)
    for (topic, identifier), entries in sorted(grouped.items()):
        profile = profile_path(identifier)
        path = LOGS / topic / letter(identifier) / f"{identifier}.yaml"
        if path.exists():
            log = yaml.safe_load(path.read_text(encoding="utf-8"))
        else:
            log = {"profile": str(profile.relative_to(ROOT)), "topic": topic, "status": "not-searched", "searches": []}
        before = dump(log)
        for entry in entries:
            if entry["entry"] not in log["searches"]:
                log["searches"].append(entry["entry"])
            status = entry["status"]
            if STATUS_RANK[status] > STATUS_RANK.get(log["status"], 0) or log["status"] == "not-searched":
                log["status"] = status
        log["last_searched"] = max(search["date"] for search in log["searches"])
        ordered = {key: log[key] for key in ("profile", "topic", "status", "last_searched") if key in log}
        ordered.update({key: value for key, value in log.items() if key not in ordered})
        if dump(ordered) != before:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(dump(ordered), encoding="utf-8")
            changed += 1
    return changed


def main() -> None:
    for name in sys.argv[1:]:
        batch = json.loads(Path(name).read_text(encoding="utf-8"))
        profiles = apply_profiles(batch)
        logs = apply_searches(batch)
        print(f"{name}: {profiles} profiles and {logs} search logs changed")


if __name__ == "__main__":
    main()
