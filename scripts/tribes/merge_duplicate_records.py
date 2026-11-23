"""Merge nation records that name the same group, the second record into the first.

The lead author chose on Nov. 22, 2026 to merge seven pairs of records that the federal
petition lists and a state list, the 2020 Census or GAO-12-348 each named separately
(research/sessions/2026/2026-11-22-nation-contacts.md). For each pair the script:

- adds the merged record's name to the kept record's other names (or earlier names), cited to
  the list that used it, and copies its other names;
- copies the merged record's recognition, states and contacts facts that the kept record does not
  already have, as written, so the layout of both files is kept;
- moves the merged record's searches into the kept record's search logs (where the kept record has
  no log for a topic, its search found something, and the merged record's empty search is dropped);
- points sources, the capture index and the build's merge list (entity-merges.json) at the kept record;
- deletes the merged record and its search logs.

It edits files by inserting text, never by re-dumping a whole file, so prose is not re-wrapped.
Run once from the repository root: python3 scripts/tribes/merge_duplicate_records.py
"""

import csv
import glob
import json
import pathlib
import re

import yaml

TODAY = "2026-11-23"

# (merged record, kept record, kind of name the merged record's name becomes)
PAIRS = [
    ("meherrin-tribe", "meherrin-tribe-of-north-carolina", "alternate"),
    ("mobile-washington-county-band-of-choctaw-indians-of-south-alabama", "mowa-band-of-choctaw-indians", "alternate"),
    ("amah-mutsun-band-of-ohlone-costanoan-indians", "amah-mutsun-tribal-band-of-mission-san-juan-bautista", "alternate"),
    ("coharie-intra-tribal-council-inc", "coharie-tribe-of-north-carolina", "alternate"),
    ("duwamish-tribe", "duwamish-tribal-organization", "alternate"),
    ("mattaponi-indian-tribe-and-reservation", "mattaponi-indian-tribe", "alternate"),
    ("the-chicora-waccamaw-indian-people", "waccamaw-indian-people", "former"),
]
LISTS = ["recognition", "states", "contacts"]
TOP_KEY = re.compile(r"^[a-z_]+:")
STATUS_RANK = {"not-searched": 0, "none-found": 1, "partly-searched": 2, "found": 3}


def profile_path(record: str) -> pathlib.Path:
    return pathlib.Path(glob.glob(f"content/tribes/*/{record}.yaml")[0])


def block(lines: list[str], key: str) -> tuple[int, int] | None:
    """Start (the key line) and end (exclusive) of a top-level key's block."""
    for start, line in enumerate(lines):
        if line.startswith(f"{key}:"):
            end = start + 1
            while end < len(lines) and not TOP_KEY.match(lines[end]):
                end += 1
            return start, end
    return None


def items(lines: list[str], indent: str = "") -> list[list[str]]:
    """Split the lines of a YAML list into its items' lines."""
    found: list[list[str]] = []
    for line in lines:
        if line.startswith(indent + "- "):
            found.append([line])
        elif found:
            found[-1].append(line)
    return found


def parse(item_lines: list[str], indent: str = ""):
    return yaml.safe_load("\n".join(line[len(indent):] for line in item_lines))[0]


def dump_item(value: dict, indent: str) -> list[str]:
    text = yaml.dump([value], sort_keys=False, allow_unicode=True, width=float("inf"))
    return [indent + line for line in text.splitlines()]


def same(a: dict, b: dict) -> bool:
    if "kind" in a and "value" in a:  # contacts: same kind and value, ignoring a trailing slash and www.
        norm = lambda v: re.sub(r"^https?://(www\.)?", "", str(v).lower()).rstrip("/")
        return a.get("kind") == b.get("kind") and norm(a["value"]) == norm(b["value"])
    return a == b


def insert_list(lines: list[str], key: str, new_items: list[list[str]], before: str) -> list[str]:
    span = block(lines, key)
    if span:
        start, end = span
        return lines[:end] + [line for item in new_items for line in item] + lines[end:]
    at = block(lines, before)[0]
    return lines[:at] + [f"{key}:"] + [line for item in new_items for line in item] + lines[at:]


def add_names(lines: list[str], kind: str, entries: list[dict]) -> list[str]:
    """Add entries to names.<kind>, a list indented under names:."""
    start, end = block(lines, "names")
    names = yaml.safe_load("\n".join(lines[start:end]))["names"]
    have = {entry["name"].lower() for group in ("alternate", "former") for entry in names.get(group) or []}
    have.add(names["official"].lower())
    new = [line for entry in entries if entry["name"].lower() not in have for line in dump_item(entry, "  ")]
    if not new:
        return lines
    sub = next((i for i in range(start + 1, end) if lines[i].startswith(f"  {kind}:")), None)
    if sub is not None:
        stop = sub + 1
        while stop < end and (lines[stop].startswith("  - ") or lines[stop].startswith("    ")):
            stop += 1
        return lines[:stop] + new + lines[stop:]
    official_source = next(i for i in range(start + 1, end) if lines[i].startswith("  official_source:"))
    return lines[:official_source] + [f"  {kind}:"] + new + lines[official_source:]


def merge_profile(merged: str, kept: str, name_kind: str) -> None:
    merged_path, kept_path = profile_path(merged), profile_path(kept)
    merged_lines = merged_path.read_text(encoding="utf-8").splitlines()
    kept_lines = kept_path.read_text(encoding="utf-8").splitlines()
    merged_data = yaml.safe_load("\n".join(merged_lines))
    kept_data = yaml.safe_load("\n".join(kept_lines))

    for key in LISTS:
        span = block(merged_lines, key)
        if not span:
            continue
        have = kept_data.get(key) or []
        new = [item for item in items(merged_lines[span[0] + 1 : span[1]]) if not any(same(parse(item), old) for old in have)]
        if new:
            kept_lines = insert_list(kept_lines, key, new, before="official_images" if block(kept_lines, "official_images") else "review")

    names = merged_data["names"]
    basis = next((fact for fact in merged_data["recognition"] if fact["source"] == names["official_source"]), merged_data["recognition"][0])
    entry = {"name": names["official"], "source": basis["source"], "confidence": basis["confidence"], "verification": basis["verification"], "as_of": basis["as_of"]}
    if basis.get("locator"):
        entry["locator"] = basis["locator"]
    entry["note"] = f"Name of a second record for the same group (id {merged}), merged into this one on Nov. 23, 2026; the match is by name and state, not a source that says the two are the same."
    kept_lines = add_names(kept_lines, name_kind, [entry])
    for group in ("alternate", "former"):
        if names.get(group):
            kept_lines = add_names(kept_lines, group, names[group])

    kept_path.write_text("\n".join(kept_lines) + "\n", encoding="utf-8")
    yaml.safe_load(kept_path.read_text(encoding="utf-8"))  # still valid YAML
    merged_path.unlink()


def merge_logs(merged: str, kept: str) -> None:
    for merged_log in glob.glob(f"research/search-logs/*/*/{merged}.yaml"):
        merged_log = pathlib.Path(merged_log)
        topic = merged_log.parts[2]
        kept_log = pathlib.Path("research/search-logs", topic, kept[0], f"{kept}.yaml")
        merged_lines = merged_log.read_text(encoding="utf-8").splitlines()
        merged_data = yaml.safe_load("\n".join(merged_lines))
        if not kept_log.exists():
            # The kept record has no log for this topic because its search found something (logs record
            # empty searches); the merged record's empty search is superseded by that result.
            merged_log.unlink()
            continue
        kept_lines = kept_log.read_text(encoding="utf-8").splitlines()
        kept_data = yaml.safe_load("\n".join(kept_lines))
        span = block(merged_lines, "searches")
        if span:
            moved = []
            for item in items(merged_lines[span[0] + 1 : span[1]]):
                search = parse(item)
                search["reason"] = (search.get("reason", "") + f" Searched for {merged}, a second record for the same group, merged into this one on Nov. 23, 2026.").strip()
                moved.append(dump_item(search, ""))
            kept_lines = insert_list(kept_lines, "searches", moved, before="next_steps")
        if STATUS_RANK[merged_data["status"]] > STATUS_RANK[kept_data["status"]]:
            kept_lines = [f"status: {merged_data['status']}" if line.startswith("status:") else line for line in kept_lines]
        if str(merged_data.get("last_searched", "")) > str(kept_data.get("last_searched", "")):
            kept_lines = [f"last_searched: '{merged_data['last_searched']}'" if line.startswith("last_searched:") else line for line in kept_lines]
        kept_log.write_text("\n".join(kept_lines) + "\n", encoding="utf-8")
        yaml.safe_load(kept_log.read_text(encoding="utf-8"))
        merged_log.unlink()


def repoint_sources(merged: str, kept: str) -> None:
    for path in glob.glob("content/sources/*/*.yaml"):
        path = pathlib.Path(path)
        text = path.read_text(encoding="utf-8")
        if f"\n- {merged}\n" not in text:
            continue
        lines = text.splitlines()
        start, end = block(lines, "tribes")
        listed = [line[2:] for line in lines[start + 1 : end]]
        result = []
        for record in listed:
            record = kept if record == merged else record
            if record not in result:
                result.append(record)
        lines = lines[: start + 1] + [f"- {record}" for record in result] + lines[end:]
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def repoint_captures(renames: dict[str, str]) -> None:
    for name in ("research/capture-index.csv", "research/capture-orphans.csv"):
        path = pathlib.Path(name)
        with path.open(encoding="utf-8", newline="") as handle:
            rows = list(csv.reader(handle))
        changed = False
        for row in rows:
            for i, cell in enumerate(row):
                parts = cell.split(";") if ";" in cell else [cell]
                new = [renames.get(part.strip(), part.strip()) if part.strip() in renames else part for part in parts]
                if new != parts:
                    row[i] = ";".join(new)
                    changed = True
        if changed:
            with path.open("w", encoding="utf-8", newline="") as handle:
                csv.writer(handle, lineterminator="\n").writerows(rows)


def record_merges() -> None:
    path = pathlib.Path("research/raw/2026-11-21/entity-merges.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    known = {(m["from"], m["into"]) for m in data["merges"]}
    for merged, kept, _ in PAIRS:
        if (merged, kept) not in known:
            data["merges"].append({"from": merged, "into": kept, "date": TODAY, "reason": "Same group listed twice, once from the federal petition lists and once from a state list, the 2020 Census or GAO-12-348; the lead author chose to merge on Nov. 22, 2026 (research/sessions/2026/2026-11-22-nation-contacts.md)."})
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    for merged, kept, name_kind in PAIRS:
        if not glob.glob(f"content/tribes/*/{merged}.yaml"):
            continue
        merge_profile(merged, kept, name_kind)
        merge_logs(merged, kept)
        repoint_sources(merged, kept)
    repoint_captures({merged: kept for merged, kept, _ in PAIRS})
    record_merges()


if __name__ == "__main__":
    main()
