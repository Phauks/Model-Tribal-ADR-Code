"""Compare the Indian Child Welfare Act designated agent facts in the profiles
with the list in 91 Fed. Reg. 30,665 (May 26, 2026), pages 30,667-30,722
(row 8 of the dataset gap audit, research/analyses/2026-11-21-dataset-gap-audit.md).

    python3 scripts/review/child_welfare_agents.py compare TABLE.csv OUTPUT.json
    python3 scripts/review/child_welfare_agents.py apply TABLE.csv [--date YYYY-MM-DD]

The notice prints its table only as page images; the govinfo PDF
(https://www.govinfo.gov/content/pkg/FR-2026-05-26/pdf/2026-10420.pdf) has no
text layer for it, and pdftotext returns only the notice's opening and closing
text. TABLE.csv is a transcription of the table's Tribe column, read by hand
from the page images (rendered with `pdftoppm -r 110 -gray`), one row per
entry with the printed page. It holds no agent names, telephone numbers or
email addresses.

`compare` matches the name each fact's note says the nation is "Listed as"
with the transcription (ignoring case, punctuation and "&" against "and") and
writes one record per fact with the page it is on, plus every table entry that
no fact matches. `apply` sets each matched fact's `locator` to its page and
adds one sentence to its note saying the row was re-read from the page image.
Where the second gap review (research/reviews/2026-11-22-icwa-agents.csv)
also found the name word for word in its OCR text of the pages, it sets
`verification: read-in-full`, since two readings agree on the exact text;
otherwise it leaves the level as it is.
Facts whose name does not match are left for review, except where the
transcription row is listed in FIXES below (a clear misreading of the
printed name in the note), which `apply` corrects.
"""

import csv
import datetime
import glob
import json
import pathlib
import re
import sys
import unicodedata

import yaml

SOURCE = "federal-register-2026-indian-child-welfare-act-designated-tribal-agents"
# The second gap review (pull request #73) read the page images with OCR and marked each fact.
OCR_REVIEW = "research/reviews/2026-11-22-icwa-agents.csv"
# profile id: (name in the note, name the table prints)
FIXES = {
    "native-village-of-chenega": ("Native Village of Chenega (aka Chanega)", "Native Village of Chenega (aka Chenega)"),
}


def normal(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower().replace("&", " and ")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", text)).strip()


def read_table(path):
    with open(path, encoding="utf-8") as handle:
        return [(row["page"], row["tribe"]) for row in csv.DictReader(handle)]


def listed_names(note):
    match = re.match(r"Listed as: (.*?)(?: Confidence lowered|$)", note or "", re.S)
    if not match:
        return []
    text = re.sub(r"\s+", " ", match.group(1)).strip()
    text = re.sub(r" \(entry is the .*\)$", "", text)
    # Several entries are joined with "; " except inside a parenthesis.
    parts, depth, current = [], 0, ""
    for char in text:
        depth += char == "("
        depth -= char == ")"
        if char == ";" and depth == 0:
            parts.append(current.strip())
            current = ""
        else:
            current += char
    parts.append(current.strip())
    return [part for part in parts if part]


def facts():
    for path in sorted(glob.glob("content/tribes/*/*.yaml")):
        profile = yaml.safe_load(pathlib.Path(path).read_text(encoding="utf-8"))
        for number, fact in enumerate(profile.get("jurisdiction") or []):
            if fact.get("source") == SOURCE:
                yield path, profile, number, fact


def compare(table_path, output):
    table = read_table(table_path)
    index = {}
    for page, tribe in table:
        index.setdefault(normal(tribe), []).append(page)
    records, used = [], set()
    for path, profile, number, fact in facts():
        names = listed_names(fact.get("note"))
        found = [(name, index.get(normal(name))) for name in names]
        for name, pages in found:
            if pages:
                used.add(normal(name))
        fixed = FIXES.get(profile["id"])
        records.append({
            "profile": path, "nation": profile["id"], "fact_number": number,
            "listed_as_in_note": names,
            "pages": sorted({page for _, pages in found for page in (pages or [])}),
            "outcome": ("same" if names and all(pages for _, pages in found)
                        else "misread-fixed" if fixed else "not-found"),
            "table_prints": fixed[1] if fixed else None,
            "verification": fact.get("verification")})
    for page, tribe in table:
        if normal(tribe) not in used and not any(f[1] == tribe for f in FIXES.values()):
            records.append({"profile": None, "nation": None, "fact_number": None, "listed_as_in_note": [],
                            "pages": [page], "outcome": "table-entry-without-fact", "table_prints": tribe,
                            "verification": None})
    pathlib.Path(output).write_text(json.dumps(records, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    tally = {}
    for record in records:
        tally[record["outcome"]] = tally.get(record["outcome"], 0) + 1
    print(json.dumps({"table_entries": len(table), "facts": sum(1 for r in records if r["profile"]),
                      "outcomes": tally}, indent=1))
    return records


def page_locator(pages):
    pages = sorted(set(pages), key=int)
    where = f"91 FR {pages[0]}" if len(pages) == 1 else "91 FR " + ", ".join(pages)
    return f"{where} (Tribe column of the designated agent table)"


def apply(table_path, today):
    records = {(r["profile"], r["fact_number"]): r for r in compare(table_path, "/dev/null") if r["profile"]}
    table = read_table(table_path)
    exact = set()
    if pathlib.Path(OCR_REVIEW).exists():
        with open(OCR_REVIEW, encoding="utf-8") as handle:
            exact = {row["profile"] for row in csv.DictReader(handle)
                     if row["kind"] == "ICWA fact" and row["ocr"] == "exact"}
    changed = upgraded = 0
    for path in sorted({p for p, _ in records}):
        text = pathlib.Path(path).read_text(encoding="utf-8")
        profile = yaml.safe_load(text)
        if yaml.safe_dump(profile, allow_unicode=True, sort_keys=False, width=100) != text:
            print(f"skipped (does not round-trip, edit by hand): {path}", file=sys.stderr)
            continue
        for number, fact in enumerate(profile.get("jurisdiction") or []):
            record = records.get((path, number))
            if not record or record["outcome"] == "not-found":
                continue
            note = fact.get("note", "").rstrip()
            if note and not note.endswith((".", ")", "\"")):
                note += "."
            if "re-read on" in note:
                continue
            pages = record["pages"]
            if record["outcome"] == "misread-fixed":
                wrong, printed = FIXES[profile["id"]]
                pages = [page for page, tribe in table if tribe == printed]
                note = note.replace(f"Listed as: {wrong}", f"Listed as: {printed}")
                note += (f" Corrected on {today}: the table prints \"{printed}\"; the earlier note gave the"
                         f" roster spelling \"{wrong}\".")
            fact["locator"] = page_locator(pages)
            if profile["id"] in exact and record["outcome"] == "same":
                fact["note"] = (note + f" Row re-read on {today} from the page image, and the name was found word"
                                " for word in the notice's machine-read (OCR) text by the second gap review"
                                f" ({OCR_REVIEW}).")
                fact["verification"] = "read-in-full"
                upgraded += 1
            else:
                fact["note"] = (note + f" Row re-read on {today} from the page image (the govinfo PDF has no text"
                                " layer for the table); verification level unchanged because the name was not"
                                " matched word for word in machine-read text.")
            changed += 1
        pathlib.Path(path).write_text(yaml.safe_dump(profile, allow_unicode=True, sort_keys=False, width=100),
                                      encoding="utf-8")
    print(f"facts updated: {changed}; set to read-in-full: {upgraded}")


def main(argv):
    if len(argv) < 2:
        sys.exit(__doc__)
    if argv[0] == "compare":
        compare(argv[1], argv[2])
    elif argv[0] == "apply":
        today = argv[argv.index("--date") + 1] if "--date" in argv else datetime.date.today().isoformat()
        apply(argv[1], today)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
