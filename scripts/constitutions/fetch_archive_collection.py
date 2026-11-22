"""Fetch the "US Tribal Constitutions" collection from the Internet Archive.

Eleven Internet Archive items, one per Bureau of Indian Affairs region
("US Tribal Constitutions - Alaska", "- Pacific", and so on), hold scans of
constitutions, amendments, charters and agency memoranda. The National Indian
Law Library describes the set as documents The Memory Hole 2 obtained through
a Freedom of Information Act request
(https://narf.org/nill/triballaw/constitutions.html). The items carry the
Public Domain Mark.

For every scanned PDF in the items this script saves the PDF and the
Internet Archive's own text of it, matches the file name to a federally
recognized nation, and writes a file in the same shape as
fetch_documents.py's output so read_documents.py can read it.

Usage:
  python3 scripts/constitutions/fetch_archive_collection.py SEEDS.json CAPTURE_DIR OUTPUT.json
"""

import hashlib
import json
import os
import re
import sys
import time
import urllib.parse

import requests

sys.path.insert(0, os.path.dirname(__file__))
import fetch_documents as first_pass  # noqa: E402
from find_more_versions import match_nation  # noqa: E402

ITEMS = [
    "tribal-constitutions-alaska",
    "tribal-constitutions-eastern-OK",
    "tribal-constitutions-eastern-US",
    "tribal-constitutions-great-plains",
    "tribal-constitutions-midwest",
    "tribal-constitutions-northwest",
    "tribal-constitutions-pacific",
    "tribal-constitutions-rocky-mountains",
    "tribal-constitutions-southern-plains",
    "tribal-constitutions-southwest",
    "tribal-constitutions-western",
]


FILE_WORDS = re.compile(
    r"\b(constitution|const|amendments?|amended|amend|charter|draft|proposed|interim|final|approval|"
    r"memo|by-?laws|revised|revision|and|for|the|of|gov|formerly|ratified|election)\b\.?",
    re.I,
)


def clean_file_name(stem):
    """'Beaver Village_1995-04-20 Constitution' -> 'Beaver Village'."""
    text = re.sub(r"[_.]", " ", stem)
    text = re.sub(r"\b\d+\b", " ", text)
    text = FILE_WORDS.sub(" ", text)
    return " ".join(text.split())


def match_file(stem, nations):
    """Try the file name with and without its parenthesis; keep the better match."""
    cleaned = clean_file_name(stem)
    options = [re.sub(r"\([^)]*\)?", " ", cleaned)] + re.findall(r"\(([^)]*)\)?", cleaned)
    best, best_score = None, 0.0
    for option in options:
        if not option.strip():
            continue
        nation, score = match_nation(option + " constitution", nations)
        if nation and score > best_score:
            best, best_score = nation, score
    return best, best_score


def get(session, url):
    time.sleep(1)
    for attempt in range(4):
        try:
            response = session.get(url, timeout=180)
            if response.status_code == 200:
                return response
        except requests.RequestException:
            pass
        time.sleep(5 * (attempt + 1))
    return None


def main(seeds_path, capture_dir, output_path):
    with open(seeds_path, encoding="utf-8") as handle:
        nations = json.load(handle)
    session = requests.Session()
    session.headers["User-Agent"] = first_pass.USER_AGENT
    done = {}
    if os.path.exists(output_path):
        with open(output_path, encoding="utf-8") as handle:
            done = {(row["item"], row["file"]): row for row in json.load(handle)}
    rows = list(done.values())
    for item in ITEMS:
        metadata = get(session, f"https://archive.org/metadata/{item}").json()
        for entry in metadata["files"]:
            if entry.get("format") != "Text PDF" or (item, entry["name"]) in done:
                continue
            name = entry["name"]
            stem = name[:-4]
            nation, score = match_file(stem, nations)
            link = f"https://archive.org/download/{item}/{urllib.parse.quote(name)}"
            response = get(session, link)
            if not response:
                rows.append({"item": item, "file": name, "error": "download failed"})
                continue
            text_response = get(session, f"https://archive.org/download/{item}/{urllib.parse.quote(stem + '_djvu.txt')}")
            body = response.content
            digest = hashlib.sha256(body).hexdigest()
            folder_name = nation["nation"] if nation and score >= 0.6 else "_unmatched"
            folder = os.path.join(capture_dir, folder_name)
            os.makedirs(folder, exist_ok=True)
            path = os.path.join(folder, f"{digest[:16]}.pdf")
            with open(path, "wb") as handle:
                handle.write(body)
            text = text_response.text if text_response else ""
            if not text.strip():
                text, _pages = first_pass.pdf_text(path)
            with open(path[:-4] + ".txt", "w", encoding="utf-8") as handle:
                handle.write(text)
            _ignored, pages = first_pass.pdf_text(path)
            rows.append(
                {
                    "item": item,
                    "file": name,
                    "nation": folder_name,
                    "match_score": round(score, 2),
                    "document": {
                        "sha256": digest,
                        "capture": os.path.relpath(path, capture_dir),
                        "text_capture": os.path.relpath(path[:-4] + ".txt", capture_dir),
                        "bytes": len(body),
                        "pages": pages,
                        "page_title": stem,
                        "text_characters": len(text.strip()),
                        "url": link,
                        "final_url": link,
                        "via": [f"internet-archive:{item}"],
                        "anchor": stem,
                        "format": "pdf",
                        "text_source": "internet-archive-optical-character-recognition",
                    },
                }
            )
            if len(rows) % 20 == 0:
                with open(output_path, "w", encoding="utf-8") as handle:
                    json.dump(rows, handle, indent=1, ensure_ascii=False)
                print(f"{len(rows)} files", flush=True)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(rows, handle, indent=1, ensure_ascii=False)
    print(f"{len(rows)} files; {sum(1 for row in rows if row.get('nation') == '_unmatched')} unmatched")


if __name__ == "__main__":
    main(*sys.argv[1:4])
