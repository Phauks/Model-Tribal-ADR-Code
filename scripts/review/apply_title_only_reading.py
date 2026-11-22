"""Apply the Nov. 22, 2026 reading of provisions known only by their section titles.

Review queue item 2 (docs/roadmap.md): 225 provision records came from headings
in National Indian Law Library tables of contents and had never been read.
Helpers read each section from the nation's own text (or a copy the library or
the Native American Rights Fund hosts), a second reader re-checked flagged
records and a random sample, and a second search looked again for the ones not
found. This script applies that reading, kept in
research/reviews/2026-11-22-title-only-provisions.json:

- read: title, citation, kind, locator and link follow the printed text; a
  one-sentence summary is added; verification becomes read-in-full and the
  source becomes the document read (a new source record when the project had
  none for that address).
- duplicate: removed, and its heading noted on the record it repeats.
- not a dispute resolution provision: removed.
- a record the provision review (pull request #98) already removed: only its
  searches are logged.
- not found: verification becomes title-only and the note points to the
  nation's search log.

Every search, found or not, is appended to the nation's search log under
research/search-logs/dispute-resolution/ (decision record 0025).

Usage: python3 scripts/review/apply_title_only_reading.py
"""

import collections
import json
import pathlib
import re
import sys
import urllib.parse

import yaml

TODAY = "2026-11-22"
SESSION = "2026-11-22-title-only-provision-reading"
REVIEW = pathlib.Path("research/reviews/2026-11-22-title-only-provisions.json")
SEARCH_LOGS = pathlib.Path("research/search-logs/dispute-resolution")
SECONDARY_HOSTS = {
    "peacemaking.narf.org": "Indigenous Peacemaking Initiative (Native American Rights Fund) document library",
    "peacemaker.narf.org": "Indigenous Peacemaking Initiative (Native American Rights Fund) document library",
    "narf.org": "National Indian Law Library Tribal Law Gateway",
    "www.narf.org": "National Indian Law Library Tribal Law Gateway",
    "nill.narf.org": "National Indian Law Library Tribal Law Gateway",
    "www.nigc.gov": "National Indian Gaming Commission",
    "ncorj.org": "National Center on Restorative Justice database",
}
PLACE_KIND = {
    "captured copy": "project-capture",
    "nill page": "national-indian-law-library",
    "nation website": "nation-website",
    "web search": "web-search",
}
OUTCOME = {
    "found": "found",
    "not-found": "not-found",
    "blocked": "blocked",
    "dead-link": "dead-link",
    "no-text-online": "not-public",
}
STOP = {
    "tribe", "tribes", "of", "the", "indian", "indians", "band", "bands", "community", "nation",
    "reservation", "confederated", "and", "colony", "rancheria", "tribal", "pueblo",
}


def dump(data):
    return yaml.safe_dump(data, allow_unicode=True, sort_keys=False, width=100)


def slug(text, limit=50):
    text = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if len(text) > limit:
        text = text[:limit].rsplit("-", 1)[0]
    return text


def short_name(nation):
    words = [word for word in nation.split("-") if word not in STOP]
    return "-".join(words[:2]) or nation.split("-")[0]


def host(url):
    return urllib.parse.urlparse(url).netloc.lower()


def source_index():
    by_url = {}
    keys = set()
    for path in pathlib.Path("content/sources").glob("*/*.yaml"):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        keys.add(record["key"])
        for url in (record.get("original_link"), (record.get("citation") or {}).get("URL")):
            if url:
                by_url.setdefault(url.rstrip("/"), record["key"])
    return by_url, keys


def source_kind(title):
    lowered = title.lower()
    if "constitution" in lowered:
        return "tribal-constitution", "legislation"
    if "compact" in lowered:
        return "intergovernmental-agreement", "legislation"
    return "tribal-code", "legislation"


def new_source(key, result, nation, official_name):
    url = result["text_url"]
    kind, citation_type = source_kind(result["document_title"])
    citation = {
        "type": citation_type,
        "title": result["document_title"],
        "author": [{"literal": official_name}],
    }
    if host(url) in SECONDARY_HOSTS:
        citation["container-title"] = SECONDARY_HOSTS[host(url)]
    citation["URL"] = url
    citation["accessed"] = {"date-parts": [[2026, 11, 22]]}
    notes = []
    if re.search(r"\bOCR\b|tesseract", json.dumps(result), re.IGNORECASE):
        notes.append("Scanned document read by OCR.")
    if result.get("as_of"):
        notes.append(f"Latest date printed for the section read: {result['as_of']}.")
    record = {
        "key": key,
        "kind": kind,
        "citation": citation,
        "original_link": url,
        "retrieved": TODAY,
        "archives": [],
        "history": {"status": "live", "last_checked": TODAY},
        "rights": {
            "status": "no-permission-needed",
            "basis": "fact-only",
            "basis_note": "Only facts are recorded from this source; it is cited and linked, not quoted or reproduced.",
            "redistribution": False,
        },
        "tribes": [nation],
        "found_in": [SESSION],
    }
    if notes:
        record["notes"] = " ".join(notes)
    return record


def confidence(result, url):
    if result.get("confidence") == "low":
        return "low"
    year = int(str(result.get("as_of") or "0")[:4] or 0)
    if result.get("confidence") == "high" and host(url) not in SECONDARY_HOSTS and (not year or year >= 2021):
        return "high"
    return "medium"


def same_link(left, right):
    def plain(url):
        return re.sub(r"^https?://(www\\.)?", "", (url or "").rstrip("/")).lower()
    return plain(left) == plain(right)


def exact(provisions, original):
    """The provision this reading was about, matched by title, citation and link."""
    for fact in provisions:
        if (
            fact.get("title") == original["title"]
            and (fact.get("citation") or "") == (original.get("citation") or "")
            and same_link(fact.get("link"), original.get("link"))
        ):
            return fact
    return None


def plain(text):
    return re.sub(r"[^a-z0-9]+", "", (text or "").lower())


def match_all(provisions, entries):
    """Match each reading to its provision by content, not position.

    Pull request #98 removed duplicates (keeping one of each pair, sometimes
    with a merged citation) and repaired damaged characters in some titles. So
    after exact matches, a reading falls back on its title alone, ignoring
    punctuation, only when that names one record still listed by section title
    that no other reading has claimed. A record already read in full is the
    kept partner of a removed duplicate and is left alone.
    """
    found = {entry["index"]: exact(provisions, entry["original"]) for entry in entries}
    claimed = {id(fact) for fact in found.values() if fact is not None}
    for entry in entries:
        if found[entry["index"]] is not None:
            continue
        candidates = [
            fact for fact in provisions
            if plain(fact.get("title")) == plain(entry["original"]["title"])
            and fact.get("verification") != "read-in-full"
            and id(fact) not in claimed
        ]
        if len(candidates) == 1:
            found[entry["index"]] = candidates[0]
            claimed.add(id(candidates[0]))
    return found


def main():
    review = json.loads(REVIEW.read_text(encoding="utf-8"))
    records = {entry["record_id"]: entry for entry in review["records"]}
    by_url, keys = source_index()
    created = {}
    profiles = collections.defaultdict(list)
    for entry in records.values():
        profiles[entry["profile"]].append(entry)
    counts = collections.Counter()
    logs = collections.defaultdict(list)

    for profile_path, entries in sorted(profiles.items()):
        path = pathlib.Path(profile_path)
        profile = yaml.safe_load(path.read_text(encoding="utf-8"))
        nation = profile["id"]
        provisions = (profile.get("dispute_resolution") or {}).get("provisions") or []
        # Records are matched by content, not position: the provision review
        # (pull request #98) removed records after this reading began.
        facts = match_all(provisions, entries)
        remove = []
        for entry in sorted(entries, key=lambda item: (item["decision"] == "duplicate", item["index"])):
            fact = facts[entry["index"]]
            decision = entry["decision"]
            if fact is None:
                counts["already-removed"] += 1
                entry_searches_only = True
            else:
                counts[decision] += 1
                entry_searches_only = False
            if entry_searches_only:
                pass
            elif decision in {"duplicate", "not-dispute-resolution"}:
                remove.append(fact)
                target = facts.get(entry.get("duplicate_of")) if decision == "duplicate" else None
                if target is not None and all(target is not gone for gone in remove):
                    target["note"] = (
                        (target.get("note") or "").rstrip()
                        + f" The table of contents also lists this section as \"{entry['original']['title']}\"; "
                        f"that record was folded into this one on {TODAY}."
                    ).strip()
            elif decision in {"read", "read-different"}:
                result = entry["result"]
                url = result["text_url"]
                key = by_url.get(url.rstrip("/")) or created.get(url)
                if not key:
                    base = f"{short_name(nation)}-{slug(result['document_title'])}"
                    key, number = base, 2
                    while key in keys:
                        key, number = f"{base}-{number}", number + 1
                    keys.add(key)
                    created[url] = key
                    source_path = pathlib.Path("content/sources") / key[0] / f"{key}.yaml"
                    source_path.write_text(
                        dump(new_source(key, result, nation, profile["names"]["official"])), encoding="utf-8"
                    )
                fact["kind"] = result["kind"]
                fact["title"] = result["title_as_printed"]
                fact["citation"] = f"{result['document_title']}, {result['section']}"
                fact["link"] = url
                fact["summary"] = result["summary"]
                fact["source"] = key
                fact["confidence"] = confidence(result, url)
                fact["verification"] = "read-in-full"
                if result.get("as_of"):
                    fact["as_of"] = result["as_of"]
                else:
                    fact.pop("as_of", None)
                fact["locator"] = result["section"]
                note = [f"Read in full on {TODAY} (review queue item 2)."]
                if decision == "read-different":
                    note.append(
                        f"The National Indian Law Library table of contents lists it as \"{entry['original']['title']}\"; "
                        "the printed heading, number or version differs (see "
                        "research/reviews/2026-11-22-title-only-provisions.json)."
                    )
                if result.get("scope") == "borderline":
                    note.append("Whether this is a dispute resolution provision is left for the lead author's review.")
                if re.search(r"\bOCR\b|tesseract", json.dumps(result), re.IGNORECASE):
                    note.append("Read from a scanned copy by OCR.")
                fact["note"] = " ".join(note)
            else:  # not-found or located-unread
                fact["verification"] = "title-only"
                letter = nation[0] if nation[0].isalpha() else "_other"
                extra = (" " + entry["extra_note"]) if entry.get("extra_note") else ""
                if decision == "located-unread":
                    extra += (
                        f" A copy was located at {entry['result']['text_url']}, but only an automated summary of it "
                        "could be seen, so the section is not recorded as read."
                    )
                fact["note"] = (
                    fact.get("note", "").rstrip()
                    + f" Searched for the text on {TODAY} and not read.{extra} Places searched: "
                    f"research/search-logs/dispute-resolution/{letter}/{nation}.yaml."
                ).strip()
            for search in entry["result"].get("searches") or []:
                outcome = OUTCOME.get(search.get("outcome"), "not-found")
                item = {
                    "date": TODAY,
                    "searched_by": "Claude (AI assistant)",
                    "method": "script",
                    "place_kind": PLACE_KIND.get((search.get("place") or "").lower(), "other"),
                    "address": search.get("address") or "unknown",
                }
                if search.get("query"):
                    item["query"] = search["query"]
                item["outcome"] = outcome
                item["reason"] = search.get("reason") or "No reason recorded."
                if outcome == "found" and not entry_searches_only and decision in {"read", "read-different"}:
                    item["records"] = [f"{profile_path}#dispute_resolution.provisions"]
                logs[(nation, profile_path)].append(item)
        if remove:
            profile["dispute_resolution"]["provisions"] = [fact for fact in provisions if all(fact is not gone for gone in remove)]
            if not profile["dispute_resolution"]["provisions"]:
                del profile["dispute_resolution"]["provisions"]
        path.write_text(dump(profile), encoding="utf-8")

    for (nation, profile_path), searches in sorted(logs.items()):
        letter = nation[0] if nation[0].isalpha() else "_other"
        log_path = SEARCH_LOGS / letter / f"{nation}.yaml"
        if log_path.exists():
            log = yaml.safe_load(log_path.read_text(encoding="utf-8"))
        else:
            log = {"profile": profile_path, "topic": "dispute-resolution", "status": "not-searched", "searches": []}
        seen = {json.dumps(item, sort_keys=True) for item in log["searches"]}
        for item in searches:
            marker = json.dumps(item, sort_keys=True)
            if marker not in seen:
                log["searches"].append(item)
                seen.add(marker)
        if any(item["outcome"] == "found" for item in log["searches"]):
            log["status"] = "found"
        else:
            log["status"] = "partly-searched"
            log.setdefault(
                "next_steps",
                "The provisions this nation's profile lists by section title are still unread. A person could open "
                "the blocked code sites in a browser, or ask the nation's court clerk or law library for the text.",
            )
        log["last_searched"] = TODAY
        ordered = {key: log[key] for key in ("profile", "topic", "status", "last_searched", "searches", "next_steps") if key in log}
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text(dump(ordered), encoding="utf-8")

    print(dict(counts), "new sources:", len(created), "search logs:", len(logs))
    return 0


if __name__ == "__main__":
    sys.exit(main())
