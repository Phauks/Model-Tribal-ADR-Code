"""Pull passages about rules of evidence out of the captured Tribal law texts.

Used by the evidence spike, research/analyses/2026-11-21-tribal-rules-of-evidence.md.
It reads the text layers of the private captures (research/captures/tribal-law/
documents/*.txt in the project's working files) and the catalog
research/tribal-law/documents.json, and writes, for each capture and pattern,
up to four passages of about 700 characters around a match. The output holds
quotations, so it stays in the private working files, never in this repository.

Usage:
    python3 scripts/law/evidence_spike_extract.py CAPTURE_TEXT_DIR OUTPUT.json

The patterns are deliberately loose; a reader (machine or person) decides what
each passage actually says. Standard library only.
"""

import collections
import json
import os
import re
import sys

PATTERNS = {
    "fre": r"federal rules of evidence",
    "state_rules": (
        r"(?:arizona|california|washington|wisconsin|oklahoma|minnesota|michigan|"
        r"new mexico|montana|oregon|nevada|south dakota|north dakota|idaho|kansas|"
        r"nebraska|alaska|new york|utah|colorado|wyoming|iowa|maine|connecticut|"
        r"massachusetts|texas|florida|north carolina|mississippi|louisiana)"
        r"(?: state)? rules of evidence"
    ),
    "not_bound": (
        r"not (?:be )?bound by (?:the )?(?:formal |technical |strict |common law )?"
        r"(?:rules of evidence|evidence rules|evidentiary rules)"
        r"|rules of evidence (?:shall|do|will) not (?:strictly )?apply"
    ),
    "custom_proof": (
        r"(?:custom|tradition)s?[^.]{0,120}(?:elder|expert|testimony|judicial notice|"
        r"proven|proof|established by|advice of)|(?:elder|expert)s?[^.]{0,80}(?:custom|tradition)"
    ),
    "spiritual_priv": (
        r"spiritual advis|spiritual leader|medicine (?:man|woman|person|people)|"
        r"traditional healer|indian doctor|roadman"
    ),
    "compromise": (
        r"offers? (?:of|to) compromise|compromise negotiations|"
        r"compromise (?:of|a) (?:disputed )?claim"
    ),
}


def main(text_dir: str, out_path: str) -> None:
    repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    catalog = json.load(open(os.path.join(repo, "research/tribal-law/documents.json")))
    by_capture = {}
    for doc in catalog:
        capture = doc.get("capture") or ""
        if capture:
            by_capture[os.path.splitext(os.path.basename(capture))[0]] = doc
    records = []
    files = collections.Counter()
    nations = collections.defaultdict(set)
    for name in sorted(os.listdir(text_dir)):
        if not name.endswith(".txt"):
            continue
        meta = by_capture.get(name[:-4])
        if not meta or meta.get("duplicate_of"):
            continue
        text = re.sub(r"\s+", " ", open(os.path.join(text_dir, name), errors="ignore").read())
        for key, pattern in PATTERNS.items():
            matches = list(re.finditer(pattern, text, re.I))
            if not matches:
                continue
            files[key] += 1
            nations[key].update(meta["nations"])
            records.append({
                "capture": name[:-4],
                "url": meta["url"],
                "nations": meta["nations"],
                "title": meta.get("page_title"),
                "pattern": key,
                "snippets": [text[max(0, m.start() - 350):m.end() + 350] for m in matches[:4]],
            })
    with open(out_path, "w") as handle:
        json.dump(records, handle, indent=1)
    print("captures per pattern:", dict(files))
    print("nations per pattern:", {k: len(v) for k, v in nations.items()})
    print("records:", len(records))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
