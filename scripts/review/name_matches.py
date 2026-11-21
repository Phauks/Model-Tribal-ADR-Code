"""List every profile fact that was joined to a nation by name, beside the
label its source uses, so a reviewer can confirm or reject the join (row 7 of
the dataset gap audit, research/analyses/2026-11-21-dataset-gap-audit.md).

    python3 scripts/review/name_matches.py gather OUTPUT.json

Writes one entry per fact: the profile, the fact's position (its section path
and its number among the profile's cited facts, in the order
scripts/record_facts.py walks them), a fingerprint of the fact, the source's
label for the row, the nation's names, and `match`:

- `exact`: the label equals one of the nation's names once case, punctuation,
  "the" and "of", and a trailing state name are ignored. Recorded as
  confirmed without review.
- `review`: anything else, which goes to a reviewer.

Facts whose join a later decision covers are left out: Public Law 280 status
(row 9), Alaska place-name languages (row 13) and community affiliations
(row 14). Never writes to a profile.
"""

import hashlib
import json
import pathlib
import re
import sys
import unicodedata

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import record_facts  # noqa: E402

LEFT_OUT_SOURCES = {
    "us-code-title-18-section-1162", "revised-code-of-washington-37-12-010",
    "idaho-code-67-5101", "florida-statutes-285-16",
    "alaska-dcra-native-place-names", "alaska-dcra-community-regions-overview",
}

# Where each kind of note or locator gives the source's own label.
LABEL_PATTERNS = [
    ("locator", re.compile(r"iteration \d+ \((.+?) alone or in any combination\)")),
    ("locator", re.compile(r"row '([^']+)'")),
    ("locator", re.compile(r"row \"([^\"]+)\"")),
    ("locator", re.compile(r"row T\d+ '([^']+)'")),
    ("note", re.compile(r"list's Tribe column: \"([^\"]+)\"")),
    ("note", re.compile(r"Census area with land in this state: (.+?) \(code")),
    ("note", re.compile(r"Census area: (.+?) \(code")),
    ("note", re.compile(r"lists the nation as \"([^\"]+)\"")),
    ("note", re.compile(r"\) as \"([^\"]+)\"")),
    ("note", re.compile(r"Listed as \"([^\"]+)\"")),
    ("note", re.compile(r"Listed as: (.+?) Confidence lowered")),
    ("note", re.compile(r"Matched by former name \(([^)]+)\)")),
    ("note", re.compile(r"Petitioner names? (?:on the 2013 list)?: ?(.+?);")),
    ("note", re.compile(r"Petitioner name: (.+?);")),
    ("note", re.compile(r"to letter-of-intent petitioner #\d+ \"([^\"]+)\"")),
    ("detail", re.compile(r"Listed as \"([^\"]+)\"")),
    ("name", re.compile(r"(.+)")),
]

STATES = ("alabama alaska arizona arkansas california colorado connecticut delaware florida georgia "
          "hawaii idaho illinois indiana iowa kansas kentucky louisiana maine maryland massachusetts "
          "michigan minnesota mississippi missouri montana nebraska nevada new hampshire new jersey "
          "new mexico new york north carolina north dakota ohio oklahoma oregon pennsylvania "
          "rhode island south carolina south dakota tennessee texas utah vermont virginia washington "
          "west virginia wisconsin wyoming").split(" ")
STATE_NAMES = {"new hampshire", "new jersey", "new mexico", "new york", "north carolina",
               "north dakota", "rhode island", "south carolina", "south dakota", "west virginia"}
STATE_NAMES |= {s for s in STATES if s not in {"new", "north", "rhode", "south", "west", "hampshire",
                                                "jersey", "mexico", "york", "carolina", "dakota",
                                                "island", "virginia"}} | {"virginia"}


def normalized(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    words = [w for w in text.split() if w not in ("the", "of", "and", "inc")]
    joined = " ".join(words)
    for state in sorted(STATE_NAMES, key=len, reverse=True):
        if joined.endswith(" " + state):
            joined = joined[: -len(state) - 1]
            break
    return joined.strip()


def fingerprint(path, fact):
    return hashlib.sha256(record_facts.fact_identity(path, fact).encode()).hexdigest()[:16]


def label_of(fact):
    for field, pattern in LABEL_PATTERNS:
        if field == "name" and "geographic_identifier" not in fact:
            continue
        match = pattern.search(str(fact.get(field, "")))
        if match:
            return match.group(1).strip()
    return None


def nation_names(profile):
    names = profile.get("names") or {}
    found = [names.get("official")]
    for group in ("alternate", "former", "self_designation"):
        for entry in names.get(group) or []:
            found.append(entry.get("name") if isinstance(entry, dict) else entry)
    return [n for n in found if n]


def gather(root="."):
    tree = record_facts.Tree(root)
    bulk = tree.bulk_sources()
    entries = []
    for file, profile in tree.profiles.items():
        names = nation_names(profile)
        normal_names = {normalized(n) for n in names}
        for number, (path, fact) in enumerate(record_facts.profile_facts(profile)):
            if fact.get("verification") or fact["source"] in LEFT_OUT_SOURCES:
                continue
            if record_facts.level_from_note(fact, bulk) != "inferred":
                continue
            if record_facts.section_of(path) in ("languages", "related_entities", "dispute_resolution.forums"):
                continue
            if "nation-specific text not checked" in str(fact.get("note", "")):
                continue  # compact clauses copied from another nation: row 1
            label = label_of(fact)
            match = "exact" if label and normalized(label) in normal_names else "review"
            entries.append({
                "profile": file, "fact_number": number, "path": path,
                "fingerprint": fingerprint(path, fact), "source": fact["source"],
                "label": label, "nation": names[0] if names else None, "other_names": names[1:],
                "locator": fact.get("locator"), "note": fact.get("note"), "match": match,
            })
    return entries


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] != "gather":
        sys.exit(__doc__)
    found = gather()
    pathlib.Path(sys.argv[2]).write_text(json.dumps(found, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    exact = sum(1 for e in found if e["match"] == "exact")
    print(f"{len(found)} facts joined by name: {exact} exact, {len(found) - exact} to review, "
          f"{sum(1 for e in found if not e['label'])} with no label found")
