"""Merge source records that describe the same document, and the repeated facts they caused.

Two research passes on 2026-11-21 recorded some pages twice under different
keys (for example a National Indian Law Library table of contents read once
with and once without "www." in its address). This script keeps one key per
document, folds the other record's research sessions and nations into it,
points every citation at the kept key, deletes the other record, and then
removes dispute resolution provisions that became exact repeats within one
profile. A provision is a repeat when it has the same source, title and
citation as one kept before it, ignoring case, spacing and leading section
numbers, and no section number or link that disagrees. The one with more
recorded fields is kept, with the section numbers from either.

Raw research files in research/raw/ are left as they were found.

Run from the repository root:  python3 scripts/tribes/merge_duplicate_sources.py
Requires the packages in scripts/requirements.txt.
"""

import pathlib
import re

import yaml

ROOT = pathlib.Path(".")
LIBRARY_INDEX_PREFIX = "national-indian-law-library-code-index-"
LIBRARY_CODES_PREFIX = "national-indian-law-library-code-codes-"

# Other documents recorded twice, as (key removed, key kept). Checked by hand:
# same address, same title and the same document.
OTHER_DUPLICATES = [
    ("narf-tribal-peacemaking-laws", "narf-ipi-tribal-peacemaking-laws"),
    ("narf-youth-family-peacemaking-laws", "narf-ipi-youth-family-peacemaking-laws"),
    ("narf-other-tribal-materials", "narf-ipi-other-tribal-materials"),
    ("north-carolina-tribal-communities-2026", "north-carolina-commission-of-indian-affairs-tribal-communities"),
    ("american-samoa-revised-constitution", "revised-constitution-american-samoa-1967"),
]
LIST_FIELDS_TO_COMBINE = ["found_in", "tribes", "jurisdictions", "methods", "topics"]


def dump(record):
    return yaml.safe_dump(record, allow_unicode=True, sort_keys=False, width=100)


def source_path(key):
    matches = list(ROOT.glob(f"content/sources/*/{key}.yaml"))
    return matches[0] if matches else None


def normalized_address(address):
    address = re.sub(r"^https?://(www\.)?", "", address or "")
    return re.sub(r"/(index\.html)?$", "", address)


def library_pairs():
    pairs = []
    for path in sorted(ROOT.glob(f"content/sources/n/{LIBRARY_INDEX_PREFIX}*.yaml")):
        kept = LIBRARY_CODES_PREFIX + path.stem[len(LIBRARY_INDEX_PREFIX):]
        kept_path = source_path(kept)
        if not kept_path:
            continue
        removed_record = yaml.safe_load(path.read_text(encoding="utf-8"))
        kept_record = yaml.safe_load(kept_path.read_text(encoding="utf-8"))
        if normalized_address(removed_record["citation"].get("URL")) == normalized_address(kept_record["citation"].get("URL")):
            pairs.append((path.stem, kept))
    return pairs


def fold_source(removed, kept):
    removed_path, kept_path = source_path(removed), source_path(kept)
    removed_record = yaml.safe_load(removed_path.read_text(encoding="utf-8"))
    kept_record = yaml.safe_load(kept_path.read_text(encoding="utf-8"))
    for field in LIST_FIELDS_TO_COMBINE:
        combined = list(kept_record.get(field) or [])
        for value in removed_record.get(field) or []:
            if value not in combined:
                combined.append(value)
        if combined:
            kept_record[field] = combined
    removed_notes, kept_notes = removed_record.get("notes"), kept_record.get("notes")
    if removed_notes and removed_notes not in (kept_notes or ""):
        kept_record["notes"] = f"{kept_notes} {removed_notes}" if kept_notes else removed_notes
    kept_path.write_text(dump(kept_record), encoding="utf-8")
    removed_path.unlink()


def repoint_citations(renames):
    pattern = re.compile(r"(?<![a-z0-9-])(" + "|".join(map(re.escape, renames)) + r")(?![a-z0-9-])")
    targets = list(ROOT.glob("content/**/*.yaml")) + list(ROOT.glob("content/**/*.md")) + list(ROOT.glob("research/sessions/*/*.md"))
    for path in targets:
        text = path.read_text(encoding="utf-8")
        updated = pattern.sub(lambda match: renames[match.group(1)], text)
        if updated != text:
            path.write_text(updated, encoding="utf-8")


def remove_repeated_list_entries_in_sessions():
    for path in ROOT.glob("research/sessions/*/*.md"):
        text = path.read_text(encoding="utf-8")
        lines, seen, output, in_list = text.split("\n"), set(), [], None
        for line in lines:
            header = re.match(r"^(sources_added|sources_updated):\s*$", line)
            if header:
                in_list, seen = header.group(1), set()
            elif in_list and not line.startswith("- "):
                in_list = None
            if in_list and line.startswith("- "):
                if line in seen:
                    continue
                seen.add(line)
            output.append(line)
        updated = "\n".join(output)
        if updated != text:
            path.write_text(updated, encoding="utf-8")


LEADING_NUMBER = re.compile(r"^\s*(section|sec\.|§)?\s*([0-9][0-9.\-a-z]*)\.?\s+", re.IGNORECASE)


def split_number(text):
    """Split a leading section number from a title or citation."""
    text = re.sub(r"\s+", " ", (text or "").strip().lower())
    match = LEADING_NUMBER.match(text)
    if match:
        return match.group(2).rstrip("."), text[match.end():]
    return "", text


def same_provision(first, second):
    """True when two provisions from one source name the same section.

    Titles and citations must match once leading section numbers are set
    aside, and any section numbers both give must agree, so that two
    different sections that share a heading such as "Dispute Resolution" stay
    separate.
    """
    if first.get("source") != second.get("source"):
        return False
    for field in ("title", "citation"):
        first_number, first_text = split_number(first.get(field))
        second_number, second_text = split_number(second.get(field))
        first_text = re.sub(r"(;\s*)[0-9][0-9.\-a-z]*\.?\s+", r"\1", first_text)
        second_text = re.sub(r"(;\s*)[0-9][0-9.\-a-z]*\.?\s+", r"\1", second_text)
        if first_text != second_text:
            return False
        if first_number and second_number and first_number != second_number:
            return False
    first_link = re.sub(r"^https?://(www\.)?", "", first.get("link") or "")
    second_link = re.sub(r"^https?://(www\.)?", "", second.get("link") or "")
    return not first_link or not second_link or first_link == second_link


def combine(first, second):
    """Keep the provision with more recorded fields, and keep section numbers either one gives."""
    richer, other = (second, first) if len(second) > len(first) else (first, second)
    combined = dict(richer)
    for field in ("title", "citation"):
        if split_number(other.get(field))[0] and not split_number(combined.get(field))[0]:
            combined[field] = other[field]
    return combined


def remove_repeated_provisions():
    removed = 0
    for path in sorted(ROOT.glob("content/tribes/*/*.yaml")):
        profile = yaml.safe_load(path.read_text(encoding="utf-8"))
        provisions = (profile.get("dispute_resolution") or {}).get("provisions")
        if not provisions:
            continue
        kept = []
        for provision in provisions:
            match = next((index for index, earlier in enumerate(kept) if same_provision(earlier, provision)), None)
            if match is None:
                kept.append(provision)
                continue
            kept[match] = combine(kept[match], provision)
            removed += 1
        if len(kept) != len(provisions):
            profile["dispute_resolution"]["provisions"] = kept
            path.write_text(dump(profile), encoding="utf-8")
    return removed


def main():
    pairs = library_pairs() + OTHER_DUPLICATES
    for removed, kept in pairs:
        fold_source(removed, kept)
    repoint_citations(dict(pairs))
    remove_repeated_list_entries_in_sessions()
    print(f"Merged {len(pairs)} duplicate source records; removed {remove_repeated_provisions()} repeated provisions.")


if __name__ == "__main__":
    main()
