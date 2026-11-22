"""List where each federally recognized nation's constitution might be found.

Reads the nation profiles (content/tribes) and writes one row per nation with
the links the profiles already cite for a constitution, articles of
association or bylaws, plus the nation's website. Nothing is fetched here.

Usage: python3 scripts/constitutions/collect_seeds.py OUTPUT.json
"""

import glob
import json
import re
import sys

import yaml

DOCUMENT_KINDS = {"constitution", "articles-of-association", "other"}
CONSTITUTION_WORDS = re.compile(r"constitut|by-?laws|articles of association|charter", re.I)


def main(output_path):
    rows = []
    for path in sorted(glob.glob("content/tribes/*/*.yaml")):
        with open(path, encoding="utf-8") as handle:
            profile = yaml.safe_load(handle)
        recognition = profile.get("recognition") or []
        if not any(fact.get("type") == "federal" for fact in recognition):
            continue
        seeds = []
        for fact in profile.get("governing_documents") or []:
            if fact.get("kind") not in DOCUMENT_KINDS and fact.get("kind") != "corporate-charter":
                continue
            if fact.get("kind") == "other" and not CONSTITUTION_WORDS.search(fact.get("title", "")):
                continue
            if not fact.get("link"):
                continue
            seeds.append(
                {
                    "link": fact["link"],
                    "kind": fact["kind"],
                    "title": fact.get("title"),
                    "year": fact.get("year"),
                    "source": fact.get("source"),
                }
            )
        websites = [
            contact["value"]
            for contact in profile.get("contacts") or []
            if contact.get("kind") == "website" and contact.get("link_status") != "lapsed"
        ]
        states = sorted({fact["state"] for fact in profile.get("states") or [] if fact.get("state")})
        rows.append(
            {
                "nation": profile["id"],
                "name": profile["names"]["official"],
                "states": states,
                "websites": list(dict.fromkeys(websites)),
                "seeds": seeds,
                "sensitivity": profile.get("sensitivity") or {},
            }
        )
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(rows, handle, indent=1, ensure_ascii=False)
        handle.write("\n")
    print(f"{len(rows)} nations, {sum(len(row['seeds']) for row in rows)} seed links")


if __name__ == "__main__":
    main(sys.argv[1])
