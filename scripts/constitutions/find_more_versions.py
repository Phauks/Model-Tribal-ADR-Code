"""Find older versions and lost copies of constitutions through the Wayback Machine.

Second pass after fetch_documents.py:

1. reads the Tribal Law and Policy Institute list of constitutions
   (https://www.tribal-institute.org/lists/constitutions.htm), matches each
   entry to a federally recognized nation by name, and fetches entries the
   first pass did not visit;
2. for every cited or listed link that is now dead, takes the closest
   Wayback Machine capture;
3. for every document the first pass saved from a nation's site or the
   National Indian Law Library, asks the Wayback Machine for each distinct
   file it captured at that address over the years, and saves up to six of
   them (first, last and evenly spaced between), so that earlier versions of
   a constitution can be compared with the current one.

Each saved document records the capture it came from. Requests to the Wayback
Machine are spaced two seconds apart; other hosts one second.

Usage:
  python3 scripts/constitutions/find_more_versions.py SEEDS.json FETCHED.json CAPTURE_DIR OUTPUT.json listed
  python3 scripts/constitutions/find_more_versions.py SEEDS.json FETCHED.json CAPTURE_DIR OUTPUT.json versions TARGETS.json

`listed` runs steps 1 and 2. `versions` runs step 3 for the documents in
TARGETS.json (a list of {nation, url, via, anchor}), normally the documents
the reviewers classified as constitutions.
"""

import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(__file__))
import fetch_documents as first_pass  # noqa: E402

LIST_LINK = "https://www.tribal-institute.org/lists/constitutions.htm"
WAYBACK_CDX = "https://web.archive.org/cdx/search/cdx"
STOP_WORDS = {
    "the", "of", "and", "in", "tribe", "tribes", "indian", "indians", "band", "nation", "constitution",
    "bylaws", "by", "laws", "by-laws", "community", "reservation", "california", "oklahoma", "a", "de",
    "amended", "revised", "tribal", "&", "-", "–", "pueblo", "muni", "code", "constitutions",
}
MAXIMUM_VERSIONS = 6


def words(name):
    name = re.sub(r"['’ʼ‘]", "", name)
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    name = re.sub(r"[^a-z0-9 ]+", " ", name)
    return {word for word in name.split() if word not in STOP_WORDS and len(word) > 1}


def match_nation(label, nations):
    label_words = words(re.sub(r"\([^)]*\)", " ", re.split(r"constitution|–|- muni|by-?laws", label, flags=re.I)[0]))
    if not label_words:
        return None, 0.0
    best, best_key = None, (0.0, 0.0)
    for nation in nations:
        nation_words = words(nation["name"])
        if not nation_words:
            continue
        overlap = len(label_words & nation_words)
        # Share of the label's words found in the nation's name, then overall overlap.
        key = (overlap / len(label_words), overlap / len(label_words | nation_words))
        if key > best_key:
            best, best_key = nation, key
    return best, best_key[0]


UNREACHABLE = {"web.archive.org": 0}


def wayback_get(session, address, **parameters):
    """Fetch from the Wayback Machine, giving up on a host after five
    straight connection failures (some networks reset these connections)."""
    host = urllib.parse.urlsplit(address).hostname
    if UNREACHABLE.get(host, 0) >= 5:
        return None
    time.sleep(2)
    for attempt in range(3):
        try:
            response = session.get(address, params=parameters or None, timeout=90)
            if response.status_code == 429:
                time.sleep(30 * (attempt + 1))
                continue
            UNREACHABLE[host] = 0
            return response
        except requests.RequestException:
            UNREACHABLE[host] = UNREACHABLE.get(host, 0) + 1
            if UNREACHABLE[host] >= 5:
                print(f"giving up on {host}: connections keep failing", flush=True)
                return None
            time.sleep(5)
    return None


def closest_capture(session, url):
    response = wayback_get(session, "https://archive.org/wayback/available", url=url)
    if not response or response.status_code != 200:
        return None
    closest = response.json().get("archived_snapshots", {}).get("closest")
    if closest and closest.get("available") and closest.get("status") == "200":
        return closest["timestamp"]
    return None


def distinct_captures(session, url):
    response = wayback_get(
        session,
        WAYBACK_CDX,
        url=url,
        output="json",
        fl="timestamp,digest,mimetype",
        filter="statuscode:200",
        collapse="digest",
    )
    if not response or response.status_code != 200 or not response.text.strip():
        return []
    rows = response.json()[1:]
    if len(rows) <= MAXIMUM_VERSIONS:
        return rows
    step = (len(rows) - 1) / (MAXIMUM_VERSIONS - 1)
    return [rows[round(index * step)] for index in range(MAXIMUM_VERSIONS)]


def save_capture(session, nation, url, timestamp, capture_dir, via, anchor, known):
    archived = f"https://web.archive.org/web/{timestamp}id_/{url}"
    response = wayback_get(session, archived)
    if not response or response.status_code != 200:
        return None
    result = {
        "url": archived,
        "final_url": archived,
        "status": 200,
        "content_type": response.headers.get("content-type", "").split(";")[0].strip().lower(),
        "body": response.content,
    }
    kind = first_pass.kind_of(result)
    if kind not in ("pdf", "doc", "docx", "rtf", "html"):
        return None
    if kind == "html":
        title, text = first_pass.html_text(result["body"])
        if not first_pass.looks_like_full_text(title, text):
            return None
    record = first_pass.save(capture_dir, nation, result, kind)
    if record["sha256"] in known:
        return None
    known.add(record["sha256"])
    record.update(
        {
            "url": url,
            "final_url": archived,
            "via": via,
            "anchor": anchor,
            "format": kind,
            "wayback_timestamp": timestamp,
        }
    )
    return record


def main(seeds_path, fetched_path, capture_dir, output_path, mode="listed", targets_path=None):
    with open(seeds_path, encoding="utf-8") as handle:
        nations = json.load(handle)
    with open(fetched_path, encoding="utf-8") as handle:
        fetched = {row["nation"]: row for row in json.load(handle)}
    session = requests.Session()
    session.headers["User-Agent"] = first_pass.USER_AGENT
    results = {}
    if os.path.exists(output_path):
        with open(output_path, encoding="utf-8") as handle:
            results = {row["nation"]: row for row in json.load(handle)}

    def entry(nation):
        return results.setdefault(nation, {"nation": nation, "documents": [], "visited": [], "list_matches": []})

    def write():
        with open(output_path, "w", encoding="utf-8") as handle:
            json.dump(sorted(results.values(), key=lambda row: row["nation"]), handle, indent=1)

    known = {}
    for nation, row in fetched.items():
        known[nation] = {document["sha256"] for document in row["documents"]}
        for document in results.get(nation, {}).get("documents", []):
            known[nation].add(document["sha256"])
    visited = {visit["url"] for row in fetched.values() for visit in row["visited"]}

    if mode == "versions":
        with open(targets_path, encoding="utf-8") as handle:
            targets = [(item["nation"], item["url"], item["via"], item["anchor"]) for item in json.load(handle)]
        earlier_versions(session, targets, results, entry, write, known, capture_dir)
        return

    # 1. The Tribal Law and Policy Institute list.
    if not any(row.get("list_matches") for row in results.values()):
        listing = session.get(LIST_LINK, timeout=60)
        soup = BeautifulSoup(listing.content, "lxml")
        for anchor in soup.find_all("a", href=True):
            label = anchor.get_text(" ", strip=True)
            link = urllib.parse.urljoin(LIST_LINK, anchor["href"].strip())
            if not re.search(r"constitut|by-?laws|articles", label, re.I) or not link.startswith("http"):
                continue
            nation, score = match_nation(label, nations)
            if not nation or score < 0.6:
                entry("_unmatched")["list_matches"].append({"label": label, "link": link, "score": round(score, 2)})
                continue
            entry(nation["nation"])["list_matches"].append({"label": label, "link": link, "score": round(score, 2)})
        write()

    # 2. Fetch listed links not yet visited; dead ones and dead seeds go to the Wayback Machine.
    dead = []
    for nation, row in sorted(results.items()):
        if nation == "_unmatched":
            continue
        for match in row["list_matches"]:
            if match["link"] in visited or match.get("checked"):
                continue
            match["checked"] = True
            response = first_pass.fetch(session, match["link"])
            ok = "error" not in response and response["status"] < 400
            if ok:
                kind = first_pass.kind_of(response)
                if kind in ("pdf", "doc", "docx", "rtf") or (
                    kind == "html" and first_pass.looks_like_full_text(*first_pass.html_text(response["body"]))
                ):
                    record = first_pass.save(capture_dir, nation, response, kind)
                    if record["sha256"] not in known.setdefault(nation, set()):
                        known[nation].add(record["sha256"])
                        record.update({"url": match["link"], "final_url": response["final_url"],
                                       "via": ["tribal-law-and-policy-institute-constitutions-list"],
                                       "anchor": match["label"], "format": kind})
                        row["documents"].append(record)
            else:
                dead.append((nation, match["link"], ["tribal-law-and-policy-institute-constitutions-list"], match["label"]))
        write()
    for nation, row in fetched.items():
        for visit in row["visited"]:
            failed = visit.get("error") or (visit.get("status") or 0) >= 400
            if failed and visit["depth"] <= 1 and re.search(r"constitut|by-?laws|\.pdf", visit["url"], re.I):
                dead.append((nation, visit["url"], visit["via"], visit.get("anchor", "")))
    print(f"{len(dead)} dead links to look up", flush=True)
    done_dead = {(row["nation"], document["url"]) for row in results.values() for document in row["documents"]}
    for count, (nation, url, via, anchor) in enumerate(dead, 1):
        if (nation, url) in done_dead:
            continue
        timestamp = closest_capture(session, url)
        entry(nation)["visited"].append({"url": url, "wayback_closest": timestamp})
        if timestamp:
            record = save_capture(session, nation, url, timestamp, capture_dir, via + ["wayback-closest"], anchor,
                                  known.setdefault(nation, set()))
            if record:
                entry(nation)["documents"].append(record)
        if count % 20 == 0:
            write()
            print(f"dead {count}/{len(dead)}", flush=True)
    write()

    print("done", flush=True)


def earlier_versions(session, targets, results, entry, write, known, capture_dir):
    """3. Earlier versions of each target document, from the Wayback Machine."""
    asked = {visit["url"] for row in results.values() for visit in row["visited"] if "versions" in visit}
    print(f"{len(targets)} documents to look up for earlier versions", flush=True)
    for count, (nation, url, via, anchor) in enumerate(targets, 1):
        if url in asked or "web.archive.org" in url:
            continue
        asked.add(url)
        captures = distinct_captures(session, url)
        entry(nation)["visited"].append({"url": url, "versions": [row[0] for row in captures]})
        for timestamp, _digest, _mimetype in captures:
            record = save_capture(session, nation, url, timestamp, capture_dir, via + ["wayback-version"], anchor,
                                  known.setdefault(nation, set()))
            if record:
                entry(nation)["documents"].append(record)
        if count % 20 == 0:
            write()
            print(f"versions {count}/{len(targets)}", flush=True)
    write()
    print("done", flush=True)


if __name__ == "__main__":
    main(*sys.argv[1:7])
