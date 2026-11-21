"""Combine the documents every finding step saved into one list per nation.

  python3 scripts/constitutions/combine_found.py OUTPUT.json FETCHED.json ARCHIVE.json [MORE.json ...]

FETCHED.json and MORE.json are in fetch_documents.py's shape; ARCHIVE.json
is fetch_archive_collection.py's output. Documents the archive collection
could not match to a nation are kept under "_unmatched" so the reviewers can
name the nation.
"""

import json
import sys


def main(output_path, fetched_path, archive_path, *more_paths):
    combined = {}

    def add(nation, document):
        row = combined.setdefault(nation, {"nation": nation, "documents": [], "visited": []})
        if all(existing["sha256"] != document["sha256"] for existing in row["documents"]):
            row["documents"].append(document)

    for path in (fetched_path, *more_paths):
        with open(path, encoding="utf-8") as handle:
            for row in json.load(handle):
                if row["nation"] == "_unmatched":
                    continue
                for document in row["documents"]:
                    add(row["nation"], document)
                combined.setdefault(row["nation"], {"nation": row["nation"], "documents": [], "visited": []})
                combined[row["nation"]]["visited"].extend(row.get("visited", []))
    with open(archive_path, encoding="utf-8") as handle:
        for row in json.load(handle):
            if "document" in row:
                add(row["nation"], row["document"])
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(sorted(combined.values(), key=lambda row: row["nation"]), handle, indent=1, ensure_ascii=False)
    print(f"{sum(len(row['documents']) for row in combined.values())} documents for {len(combined)} nations")


if __name__ == "__main__":
    main(*sys.argv[1:])
