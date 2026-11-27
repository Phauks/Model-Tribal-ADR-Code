#!/usr/bin/env python3
"""Name each saved constitution copy by its printed title, not by a sentence in its text.

The capture index (research/capture-index.csv) titles a constitution copy with
the catalog's printed_title (research/constitutions/documents.json). That title
came from read_documents.title_of, which took the first line naming a
constitution. For a corporate charter that line is a sentence of the charter
("a recognized tribe of Indians residing in Oklahoma, organized under a
Constitution"), and for a University of Oklahoma page whose heading runs over
several lines it was only the first of them ("CONSTITUTION AND BY-LAWS OF
THE"). Trevor Goldsmith found the Eastern Shawnee charter misnamed on
2026-11-27.

For every main constitution copy whose title looks wrong, this script reads
the copy's text extract and rebuilds the printed heading: the lines from the
one that names the document ("CORPORATE CHARTER", "CONSTITUTION AND BY-LAWS")
down to the ratification line, joined and put in title case. When the text has
no such heading, the title is supplied in brackets from the kind of document
and the nation's name, as the citation rules ask. Copies whose title already
reads as a title are left alone.

It writes research/constitutions/copy-titles.csv (key, old title, new title,
how it was found) for review. With --apply it also records each new title as a
"title" override in research/capture-index-overrides.json, which the index
build lets win (scripts/captures/mirror_captures.py), and puts it in the
title column of research/capture-index.csv, so the change holds when the index
is next rebuilt.

Usage:
  python3 scripts/constitutions/fix_copy_titles.py --captures /mnt/project-files/research/captures [--apply]
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts" / "constitutions"))
from build_catalog import SMALL_WORDS, clean_title  # noqa: E402

sys.path.insert(0, str(REPO / "scripts" / "captures"))
import capture_index  # noqa: E402

INDEX = capture_index.INDEX
OVERRIDES = REPO / "research" / "capture-index-overrides.json"
CATALOG = REPO / "research" / "constitutions" / "documents.csv"
REPORT = REPO / "research" / "constitutions" / "copy-titles.csv"

# A heading starts with the document's own name, perhaps after "Amended" or "Revised".
HEADING_START = re.compile(
    r"^((the|an?)\s+)?((\d{4}|amended|revised|restated|proposed|federal|corporate)\s+)*"
    r"(constitution|corporate\s+charter|charter|by-?\s?laws|articles\s+of\s+(association|incorporation|organization)|amendments?\s+to)\b",
    re.I,
)
# Lines above the heading on a federal printing or a University of Oklahoma page.
LETTERHEAD = re.compile(
    r"^(united\s+states|department\s+of\s+the\s+interior|(office|bureau)\s+of\s+indian\s+affairs|ira\s+home|"
    r"[a-z]{4,14}|c:\\\S+|\+|\.|[ivx]+|\d{1,3})$",
    re.I,
)
# Where the heading ends: the ratification or approval line, a date or the text itself.
HEADING_END = re.compile(
    r"^(ratified|approved|adopted|effective|as amended|a federal corporation|preamble|article\b|section\b|we,? the\b|whereas\b|"
    r"united\s+states\s+government|washington|amendment\s+[ivx]+\b|back\s+to\b|(parish|county)\s+of\b|\(|\d{1,2}/)",
    re.I,
)
# Words of a sentence in the text, in lower case, so "Organized Village of Kasaan" is not one.
SENTENCE_WORDS = re.compile(r"\b(organized|ratified|recognized|residing|pursuant|hereby|shall|do ordain)\b")
# Copies that are not a nation's governing document at all, read by hand (2026-11-27).
BY_HAND = {
    "constitutions/native-village-of-eek/d1c3842f2582e9fb.pdf":
        "[Letter of the Eek Traditional Council to the Bureau of Indian Affairs, Alaska Region, Apr. 24, 2013]",
}
NOUNS = {
    "corporate-charter": "Corporate Charter",
    "constitution-and-bylaws": "Constitution and Bylaws",
    "articles-of-association": "Articles of Association",
    "amendment": "Amendment to the Constitution",
    "proposed-constitution": "Proposed Constitution",
    "bylaws": "Bylaws",
}


def problem(title: str) -> str:
    """Why a copy's title does not read as a title, or "" when it does."""
    title = " ".join(title.split())
    if not title:
        return "empty"
    if not re.match(r"^[\[A-Z0-9\"]", title):
        return "starts mid-sentence"
    plain = sum(character.isalnum() or character in " .,;:'\"()-&/§" for character in title)
    if plain / len(title) < 0.95 or re.search(r"[\]\[~{}|^]", title.strip("[]")):
        return "garbled"
    if re.search(r"\b(of|the|and|by|for|a|an|to|under|with)\.?$", title, re.I):
        return "stops short"
    if not HEADING_START.match(title) and SENTENCE_WORDS.search(title):
        return "a sentence of the text"
    return ""


def heading_of(text: str) -> str:
    """The printed heading at the top of a text: the lines from the document's name to the ratification line."""
    lines = [" ".join(line.split()).strip(" |") for line in text.splitlines()]
    lines = [line for line in lines if line][:40]
    for start, line in enumerate(lines):
        if not HEADING_START.match(line):
            continue
        if start > 12 and not all(LETTERHEAD.match(earlier) for earlier in lines[:start]):
            break
        parts = [line]
        if start and re.fullmatch(r"amended|revised|restated", lines[start - 1], re.I):
            parts.insert(0, lines[start - 1])
        for following in lines[start + 1: start + 8]:
            joined = re.search(r"\b(and|of|of the|for|for the|the)$", parts[-1], re.I)
            if HEADING_END.match(following) or len(following) > 90 or HEADING_START.match(following) and not joined:
                break
            letters = [character for character in following if character.isalpha()]
            capitals = letters and sum(character.isupper() for character in letters) / len(letters) > 0.6
            if not capitals and not re.fullmatch(r"(of|of the|for|for the|and|in)( the)?", following, re.I):
                break
            parts.append(following)
            if re.search(r"\bInc\.$", following, re.I):
                break
        heading = " ".join(parts)
        if SENTENCE_WORDS.search(heading):
            continue
        if len(heading) > 220:
            continue
        return heading
    return ""


def small_words_lowered(title: str) -> str:
    """ "Charter Of The Citizen Potawatomi Nation" as "Charter of the Citizen Potawatomi Nation"."""
    words = title.split(" ")
    title = " ".join([words[0]] + [word.lower() if word.lower().rstrip(".") in SMALL_WORDS else word for word in words[1:]])
    # A scan's stray period after a word ("Tribe. of the"), and names that title case spoils ("Mcdermitt", "Lac Du Flambeau").
    title = re.sub(r"\b(\w+)\. (?=(of|the|[A-Z][a-z]+$))", r"\1 ", title)
    title = re.sub(r"\bthe\. ", "the ", title)
    title = re.sub(r"\bMc([a-z])", lambda found: "Mc" + found.group(1).upper(), title)
    return title.replace("Lac Du Flambeau", "Lac du Flambeau")


def supplied_title(document_type: str, nation_name: str) -> str:
    noun = NOUNS.get(document_type or "", "Constitution")
    nation_name = re.sub(r"^the\s+", "", nation_name, flags=re.I)
    return f"[{noun} of the {nation_name}]" if nation_name else ""


def official_name(nation: str) -> str:
    """A nation's official name from its record in content/tribes/, or "" when it has none."""
    path = REPO / "content" / "tribes" / nation[:1] / f"{nation}.yaml"
    if not nation or not path.exists():
        return ""
    found = re.search(r"^  official:\s*(.+)$", path.read_text(encoding="utf-8"), re.M)
    return found.group(1).strip().strip("'\"") if found else ""


def text_of(captures: Path, key: str) -> str:
    stem = key.rsplit(".", 1)[0]
    for suffix in (".txt", ".ocr.txt"):
        path = captures / f"{stem}{suffix}"
        if path.exists():
            return path.read_text(encoding="utf-8", errors="replace")
    return ""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--captures", required=True, help="the research/captures folder in the project's working files")
    parser.add_argument("--apply", action="store_true", help="record the new titles in the overrides and the index")
    args = parser.parse_args()
    captures = Path(args.captures)
    csv.field_size_limit(sys.maxsize)
    catalog = {row["key"]: row for row in csv.DictReader(CATALOG.open(encoding="utf-8"))}
    with INDEX.open(encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        fields = reader.fieldnames
        rows = list(reader)
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8")) if OVERRIDES.exists() else {}

    changes = []
    for row in rows:
        if row["topic"] != "constitutions" or row["derived_from"] or row["media_type"] == "text/plain":
            continue
        if "title" in overrides.get(row["key"], {}):
            continue
        why = problem(row["title"])
        if not why:
            continue
        entry = catalog.get(row["catalog"].split("#")[-1], {})
        nation = entry.get("nation") or (row["nations"].split(";")[0] if row["nations"] else row["key"].split("/")[1])
        nation_name = entry.get("nation_name") or official_name(nation)
        heading = heading_of(text_of(captures, row["key"]))
        title = small_words_lowered(clean_title(heading, nation_name)) if heading else ""
        basis = "printed heading"
        if row["key"] in BY_HAND:
            title, basis = BY_HAND[row["key"]], "read by hand"
        elif not title or problem(title):
            title, basis = supplied_title(entry.get("document_type", ""), nation_name), "supplied from the document's kind and nation"
        if not title or title == row["title"]:
            continue
        changes.append({"key": row["key"], "old_title": row["title"], "new_title": title, "problem": why, "basis": basis})

    with REPORT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["key", "old_title", "new_title", "problem", "basis"], lineterminator="\n")
        writer.writeheader()
        writer.writerows(changes)
    print(f"{len(changes)} titles to change; see {REPORT.relative_to(REPO)}")
    if not args.apply:
        return

    titles = {change["key"]: change["new_title"] for change in changes}
    for key, title in titles.items():
        overrides.setdefault(key, {})["title"] = title
    OVERRIDES.write_text(json.dumps(overrides, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    for row in rows:
        main_key = row["derived_from"] or row["key"]
        if main_key in titles:
            row["title"] = titles[main_key]
    capture_index.write_rows(rows, fields)
    print(f"recorded {len(titles)} title overrides and updated the index")


if __name__ == "__main__":
    main()
