"""Batches of flagged articles for AI reviewers to confirm and summarize.

  python3 scripts/constitutions/summarize_articles.py split READ.json CAPTURE_DIR FOLDER [SIZE] [SUMMARIES.json]
  python3 scripts/constitutions/summarize_articles.py merge OUTPUT.json FOLDER [FOLDER ...]

`split` takes the newest version of each nation's constitution from
research/constitutions/documents.json (built once without summaries) and
writes the text of each of its articles that a word match tied to judicial
power, dispute resolution, peacemaking, election disputes or sovereign
immunity, at most 3,500 characters each, to FOLDER/articles-NNN.json.
Articles already summarized in SUMMARIES.json (an earlier merge) are left out.

Reviewers confirm whether the article really deals with the topic and write
a one-sentence neutral summary to FOLDER/articles-NNN.answers.json; `merge`
joins them into OUTPUT.json keyed the way build_catalog.py expects.
"""

import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from build_catalog import TOPIC_NAMES, article_bodies, load_text  # noqa: E402

TOPICS = {"judicial-power", "dispute-resolution", "peacemaking", "election-disputes", "sovereign-immunity"}


def split(read_path, capture_dir, folder, size=40, summaries_path=None):
    done = set()
    if summaries_path:
        with open(summaries_path, encoding="utf-8") as handle:
            done = {key.rsplit("|", 1)[0] for key in json.load(handle)}
    with open(read_path, encoding="utf-8") as handle:
        read = {f"{item['nation']}:{item['sha256'][:16]}": item for item in json.load(handle)}
    with open("research/constitutions/documents.json", encoding="utf-8") as handle:
        documents = json.load(handle)
    with open("research/constitutions/coverage.json", encoding="utf-8") as handle:
        newest = {(row["nation"], row["newest_version"]) for row in json.load(handle) if row["newest_version"]}
    items = []
    for document in documents:
        if not document["primary_copy"] or (document["nation"], document["version"]) not in newest:
            continue
        source = read[document["key"]]
        text = load_text(capture_dir, source["capture"])
        bodies = article_bodies(text, source["articles"])
        for article in source["articles"]:
            topics = sorted({TOPIC_NAMES.get(name, name) for name in article["topics"]} & TOPICS)
            if not topics:
                continue
            if f"{document['key']}|{article['label']}|{article['line']}" in done:
                continue
            body = bodies.get(article["label"] + "|" + str(article["line"]), "")
            items.append(
                {
                    "key": f"{document['key']}|{article['label']}|{article['line']}",
                    "nation_name": document["nation_name"],
                    "article": f"{article['label']}: {article['heading']}",
                    "topics": topics,
                    "text_method": document["text_method"],
                    "text": body[:3500],
                }
            )
    os.makedirs(folder, exist_ok=True)
    for start in range(0, len(items), size):
        with open(os.path.join(folder, f"articles-{start // size + 1:03d}.json"), "w", encoding="utf-8") as handle:
            json.dump(items[start: start + size], handle, indent=1, ensure_ascii=False)
    print(f"{len(items)} articles in {(len(items) + size - 1) // size} batches")


def merge(output_path, folders):
    merged = {}
    paths = [path for folder in folders for path in sorted(glob.glob(os.path.join(folder, "articles-*.answers.json")))]
    for path in paths:
        with open(path, encoding="utf-8") as handle:
            for answer in json.load(handle):
                for topic in answer.get("topics", []):
                    merged[f"{answer['key']}|{topic['topic']}"] = {
                        "confirmed": topic.get("confirmed"),
                        "summary": topic.get("summary"),
                        "methods": topic.get("methods") or [],
                    }
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(merged, handle, indent=1, ensure_ascii=False)
    print(f"{len(merged)} article topics")


if __name__ == "__main__":
    if sys.argv[1] == "split":
        split(
            sys.argv[2],
            sys.argv[3],
            sys.argv[4],
            int(sys.argv[5]) if len(sys.argv) > 5 else 40,
            sys.argv[6] if len(sys.argv) > 6 else None,
        )
    else:
        merge(sys.argv[2], sys.argv[3:])
