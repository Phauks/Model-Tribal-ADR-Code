"""Split the read documents into batches for AI reviewers, and merge their answers.

  python3 scripts/constitutions/review_batches.py split READ.json SEEDS.json FOLDER [SIZE] [REVIEWED.json]
  python3 scripts/constitutions/review_batches.py merge OUTPUT.json FOLDER [FOLDER ...]

`split` writes FOLDER/batch-NNN.json, each holding up to SIZE documents
(default 30) with what a reviewer needs to classify them: the nation's name,
the link and its link text, the title line, the first and last text of the
document and the article headings. University of Oklahoma Law Library pages
are left out: their file names already say whether a page is a constitution
or a charter, and their certificates are read by rule in build_catalog.py.
Documents already answered in REVIEWED.json (an earlier merge) are left out
too, so a later run sends reviewers only what is new.

Reviewers write FOLDER/batch-NNN.answers.json; `merge` joins them.
"""

import glob
import json
import os
import sys


def document_key(document):
    return f"{document['nation']}:{document['sha256'][:16]}"


def split(read_path, seeds_path, folder, size=30, reviewed_path=None):
    with open(read_path, encoding="utf-8") as handle:
        documents = json.load(handle)
    with open(seeds_path, encoding="utf-8") as handle:
        names = {row["nation"]: row["name"] for row in json.load(handle)}
    reviewed = {}
    if reviewed_path:
        with open(reviewed_path, encoding="utf-8") as handle:
            reviewed = json.load(handle)
    os.makedirs(folder, exist_ok=True)
    items = []
    for document in documents:
        if "ou.edu" in document["url"] or document_key(document) in reviewed:
            continue
        items.append(
            {
                "key": document_key(document),
                "nation": document["nation"],
                "nation_name": names.get(document["nation"], ""),
                "link": document["url"],
                "link_text": document["anchor"],
                "wayback_capture": document.get("wayback_timestamp"),
                "pages": document["pages"],
                "text_method": document["text_method"],
                "text_characters": document["text_characters"],
                "title_line": document["title_line"],
                "opening": document["opening"][:2200],
                "closing": document["closing"][-1600:],
                "article_headings": [f"{article['label']}: {article['heading']}"[:90] for article in document["articles"]][:40],
            }
        )
    for start in range(0, len(items), size):
        path = os.path.join(folder, f"batch-{start // size + 1:03d}.json")
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(items[start: start + size], handle, indent=1, ensure_ascii=False)
    print(f"{len(items)} documents in {(len(items) + size - 1) // size} batches")


def merge(output_path, folders):
    answers = {}
    paths = [path for folder in folders for path in sorted(glob.glob(os.path.join(folder, "batch-*.answers.json")))]
    for path in paths:
        with open(path, encoding="utf-8") as handle:
            for answer in json.load(handle):
                answers[answer["key"]] = answer
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(answers, handle, indent=1, ensure_ascii=False)
    print(f"{len(answers)} answers")


if __name__ == "__main__":
    if sys.argv[1] == "split":
        split(
            sys.argv[2],
            sys.argv[3],
            sys.argv[4],
            int(sys.argv[5]) if len(sys.argv) > 5 else 30,
            sys.argv[6] if len(sys.argv) > 6 else None,
        )
    else:
        merge(sys.argv[2], sys.argv[3:])
