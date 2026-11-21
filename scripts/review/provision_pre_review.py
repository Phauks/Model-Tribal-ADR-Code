"""Pre-review of the dispute resolution provision records in the Native nation profiles.

The lead author reviews every provision record before it is relied on. This
script prepares and collects a pre-review that helps with that work. It never
changes a profile.

Two steps:

  gather  Reads every provision in content/tribes/, fetches each cited page or
          PDF into a local cache (not committed), finds the passage that
          matches the provision's title or section number, and writes the
          evidence in batches for reviewers.

  merge   Combines the reviewers' verdict files with the provision records and
          writes the reviewable outputs: one JSON record and one spreadsheet
          row per provision, plus the counts used in the report.

Usage:
  python3 scripts/review/provision_pre_review.py gather --work WORK_DIRECTORY
  python3 scripts/review/provision_pre_review.py merge --work WORK_DIRECTORY --output OUTPUT_PREFIX

The brief that reviewers follow is in research/reviews/; the method and
limits are described in the report beside the outputs.
"""

import argparse
import collections
import concurrent.futures
import csv
import glob
import hashlib
import html
import json
import os
import re
import subprocess
import sys
import unicodedata

import yaml

BULK_DATABASE_NOTE = "Bulk record from the NCORJ"
DATABASE_HOST = "ncorj.org"
BATCH_RECORD_LIMIT = 60
BATCH_CHARACTER_LIMIT = 150_000
EXCERPT_LIMIT = 3_000
WINDOW_LIMIT = 1_500

VERDICTS = ["keep", "keep-relabel", "merge-duplicate", "scope-question", "drop-candidate", "check-source"]
VERDICT_FIELDS = [
    "verdict", "confidence", "exists", "accurate", "accuracy_issues", "is_dispute_resolution",
    "practice_category", "method", "suggested_kind", "duplicate_of", "evidence_quote",
    "evidence_location", "reason",
]


# Gathering ------------------------------------------------------------------

def evidence_tier(provision):
    """The same three tiers as scripts/analysis/dispute_resolution_practice.py."""
    note = provision.get("note") or ""
    lowered = note.lower()
    if BULK_DATABASE_NOTE in note:
        return "bulk_database_record"
    if "section title" in lowered or "section headings" in lowered or "section or chapter title" in lowered:
        return "section_title_only"
    return "text_read"


def read_provisions(repository_root):
    provisions = []
    for profile_path in sorted(glob.glob(os.path.join(repository_root, "content/tribes/*/*.yaml"))):
        with open(profile_path, encoding="utf-8") as profile_file:
            profile = yaml.safe_load(profile_file)
        profile_id = os.path.basename(profile_path)[: -len(".yaml")]
        practice = profile.get("dispute_resolution") or {}
        for index, provision in enumerate(practice.get("provisions") or []):
            record = {
                "id": f"{profile_id}#{index}",
                "nation": (profile.get("names") or {}).get("official"),
                "profile": os.path.relpath(profile_path, repository_root),
                "index": index,
                "tier": evidence_tier(provision),
            }
            record.update(provision)
            provisions.append(record)
    return provisions


def cache_path(cache_directory, url):
    folder = "ncorj" if DATABASE_HOST in url else "link"
    digest = hashlib.sha1(url.encode()).hexdigest()[:16]
    return os.path.join(cache_directory, folder, digest)


def fetch_to_cache(cache_directory, url):
    base = cache_path(cache_directory, url)
    if os.path.exists(base + ".txt"):
        return url, "cached"
    os.makedirs(os.path.dirname(base), exist_ok=True)
    completed = subprocess.run(
        ["curl", "-sL", "--max-time", "60", "-A", "Mozilla/5.0 (research review)",
         "-o", base + ".raw", "-w", "%{http_code} %{content_type}", url],
        capture_output=True, text=True,
    )
    status_code, _, content_type = completed.stdout.partition(" ")
    text = ""
    try:
        with open(base + ".raw", "rb") as raw_file:
            raw = raw_file.read()
        if raw[:4] == b"%PDF" or "pdf" in content_type:
            text = subprocess.run(["pdftotext", "-layout", base + ".raw", "-"],
                                  capture_output=True, text=True, timeout=120).stdout
        else:
            page = raw.decode("utf-8", "replace")
            page = re.sub(r"(?is)<(script|style|nav|header|footer|noscript)[^>]*>.*?</\1>", "", page)
            text = re.sub(r"\n\s*\n+", "\n", html.unescape(re.sub(r"<[^>]+>", "\n", page)))
    except (OSError, subprocess.SubprocessError):
        text = ""
    with open(base + ".txt", "w", encoding="utf-8") as text_file:
        text_file.write(f"URL: {url}\nHTTP: {status_code} {content_type}\n\n" + text)
    if os.path.exists(base + ".raw"):
        os.remove(base + ".raw")
    return url, status_code


def load_cached(cache_directory, url):
    if not url or not url.startswith("http"):
        return None
    path = cache_path(cache_directory, url) + ".txt"
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as text_file:
        return text_file.read()


def fetch_status(cached_text):
    match = re.search(r"HTTP: (\S*)", cached_text or "")
    return match.group(1) if match else "not fetched"


def body_of(cached_text):
    if cached_text and "\n\n" in cached_text:
        return cached_text.split("\n\n", 1)[1]
    return ""


def database_excerpt(cached_text):
    body = body_of(cached_text)
    start = body.find("Tribe:")
    end = body.find("Skip back to content")
    if start < 0:
        return body[:6000]
    return body[start: end if end > start else start + 6000][:6000].strip()


def normalized(text):
    return re.sub(r"\s+", " ", text).lower()


def find_window(text, provision, size=1800):
    """Return the passage nearest the provision's title or section number, and how it was found."""
    if not text:
        return None, "no text extracted"
    normalized_text = normalized(text)
    title = re.sub(r"^[\d\.\s§]+", "", provision.get("title") or "").strip()
    labels = []
    citation = (provision.get("citation") or "") + " " + (provision.get("title") or "")
    for match in re.finditer(r"(?:§+|sec(?:tion|\.)?|rule|chapter)\s*([0-9][0-9A-Za-z\.\-\(\)]*[0-9A-Za-z])", citation, re.I):
        labels.append(match.group(0))
    for match in re.finditer(r"\b(\d+[\.\-]\d+(?:[\.\-]\d+)*)\b", citation):
        labels.append(match.group(1))
    candidates = [("title", title)] if len(title) > 8 else []
    candidates += [("section", label) for label in labels]
    for candidate_kind, candidate in candidates:
        needle = normalized(candidate)
        position = normalized_text.find(needle)
        if position < 0 and candidate_kind == "section":
            number = re.sub(r"^(?:§+|sec(?:tion|\.)?|rule|chapter)\s*", "", needle)
            number_match = re.search(r"(?<![\w\.\-])" + re.escape(number) + r"(?![\w\-])", normalized_text)
            position = number_match.start() if number_match else -1
        if position >= 0:
            start = max(0, position - 300)
            return normalized_text[start: start + size], f'matched {candidate_kind} "{candidate[:80]}"'
    return None, f"no match for title or section number in {len(normalized_text)} characters of extracted text"


def title_key(text):
    return re.sub(r"[^a-z0-9 ]", "", (text or "").lower()).lstrip("0123456789 ").strip()


def build_evidence(provisions, cache_directory):
    records = []
    for provision in provisions:
        evidence = {}
        locator = provision.get("locator") or ""
        link = provision.get("link") or ""
        if provision["tier"] == "bulk_database_record":
            cached = load_cached(cache_directory, locator)
            evidence["database_page_status"] = fetch_status(cached)
            evidence["database_page_excerpt"] = database_excerpt(cached)[:EXCERPT_LIMIT] if cached else None
        elif locator.startswith("http"):
            cached = load_cached(cache_directory, locator)
            evidence["locator_status"] = fetch_status(cached)
            window, how = find_window(body_of(cached), provision, 1200)
            evidence["locator_match"] = how
            evidence["locator_window"] = window
        cached = load_cached(cache_directory, link)
        evidence["link_status"] = fetch_status(cached)
        body = body_of(cached)
        window, how = find_window(body, provision)
        evidence["link_match"] = how
        evidence["link_window"] = window[:WINDOW_LIMIT] if window else None
        if not window and body and provision["tier"] != "bulk_database_record":
            evidence["link_opening"] = normalized(body)[:1200]
        record = {key: provision.get(key) for key in
                  ["id", "nation", "tier", "kind", "title", "citation", "link", "locator", "source",
                   "confidence", "note", "summary"] if provision.get(key) is not None}
        record["evidence"] = evidence
        records.append(record)

    by_profile = collections.defaultdict(list)
    for record in records:
        by_profile[record["id"].split("#")[0]].append(record)
    for profile_records in by_profile.values():
        for record in profile_records:
            hints = []
            for other in profile_records:
                if other is record:
                    continue
                same_title = title_key(record["title"]) == title_key(other["title"])
                same_citation = title_key(record["citation"]) == title_key(other["citation"])
                same_page = (record.get("locator") or "").startswith("http") and record.get("locator") == other.get("locator")
                if same_title or same_citation or same_page:
                    hints.append(other["id"])
            if hints:
                record["duplicate_candidates"] = hints
    return records


def write_batches(records, batch_directory):
    """Keep each nation's records in one batch so reviewers can spot duplicates."""
    groups = collections.OrderedDict()
    for record in records:
        groups.setdefault(record["id"].split("#")[0], []).append(record)
    batches, current, current_size = [], [], 0
    for group in groups.values():
        group_size = sum(len(json.dumps(record, ensure_ascii=False)) for record in group)
        if current and (len(current) + len(group) > BATCH_RECORD_LIMIT or current_size + group_size > BATCH_CHARACTER_LIMIT):
            batches.append(current)
            current, current_size = [], 0
        current += group
        current_size += group_size
    batches.append(current)
    os.makedirs(batch_directory, exist_ok=True)
    for number, batch in enumerate(batches, 1):
        with open(os.path.join(batch_directory, f"batch-{number:02d}.json"), "w", encoding="utf-8") as batch_file:
            batch_file.write("[\n" + ",\n".join(json.dumps(record, ensure_ascii=False) for record in batch) + "\n]\n")
    return batches


def gather(arguments):
    provisions = read_provisions(arguments.repository)
    cache_directory = os.path.join(arguments.work, "cache")
    urls = sorted({provision.get(key) for provision in provisions for key in ("locator", "link")
                   if (provision.get(key) or "").startswith("http")})
    with concurrent.futures.ThreadPoolExecutor(12) as executor:
        results = list(executor.map(lambda url: fetch_to_cache(cache_directory, url), urls))
    print(len(urls), "pages", dict(collections.Counter(status for _, status in results)))
    records = build_evidence(provisions, cache_directory)
    with open(os.path.join(arguments.work, "evidence.json"), "w", encoding="utf-8") as evidence_file:
        json.dump(records, evidence_file, indent=1, ensure_ascii=False)
    batches = write_batches(records, os.path.join(arguments.work, "batches"))
    print(len(records), "provisions in", len(batches), "batches")


# Merging --------------------------------------------------------------------

def nfc(text):
    """The repository stores text in Unicode Normalization Form C (style guide, section 7)."""
    return unicodedata.normalize("NFC", text)


def load_verdicts(directory):
    verdicts = {}
    for path in sorted(glob.glob(os.path.join(directory, "batch-*.json"))):
        with open(path, encoding="utf-8") as verdict_file:
            for verdict in json.load(verdict_file):
                verdicts[verdict["id"]] = verdict
    return verdicts


def merge(arguments):
    provisions = read_provisions(arguments.repository)
    first_pass = load_verdicts(os.path.join(arguments.work, "verdicts"))
    second_pass = load_verdicts(os.path.join(arguments.work, "second-verdicts"))
    missing = [provision["id"] for provision in provisions if provision["id"] not in first_pass]
    if missing:
        sys.exit(f"{len(missing)} provisions have no first-pass verdict, for example {missing[:3]}")

    records = []
    for provision in provisions:
        first = first_pass[provision["id"]]
        second = second_pass.get(provision["id"])
        final = second or first
        records.append({
            "id": provision["id"],
            "nation": provision["nation"],
            "profile": provision["profile"],
            "index": provision["index"],
            "tier": provision["tier"],
            "record": {key: provision.get(key) for key in
                       ["kind", "title", "citation", "link", "locator", "source"] if provision.get(key) is not None},
            "pre_review": {field: final.get(field) for field in VERDICT_FIELDS},
            "reviewed_twice": second is not None,
            "first_pass": None if second is None else {field: first.get(field) for field in VERDICT_FIELDS},
            "second_pass_agrees": None if second is None else second.get("agrees_with_first"),
            "second_pass_note": None if second is None else second.get("second_review_note"),
            "lead_author_decision": None,
        })

    with open(arguments.output + ".json", "w", encoding="utf-8") as output_file:
        output_file.write(nfc(json.dumps(records, indent=1, ensure_ascii=False)) + "\n")

    columns = ["id", "nation", "tier", "current_kind", "title", "citation", "verdict", "confidence",
               "is_dispute_resolution", "practice_category", "method", "suggested_kind", "duplicate_of",
               "exists", "accurate", "accuracy_issues", "reason", "evidence_quote", "evidence_location",
               "reviewed_twice", "lead_author_decision"]
    with open(arguments.output + ".csv", "w", encoding="utf-8", newline="") as output_file:
        writer = csv.writer(output_file, lineterminator="\n")
        writer.writerow(columns)
        for record in records:
            review = record["pre_review"]
            writer.writerow([nfc(cell) if isinstance(cell, str) else cell for cell in [
                record["id"], record["nation"], record["tier"], record["record"].get("kind"),
                record["record"].get("title"), record["record"].get("citation"), review["verdict"],
                review["confidence"], review["is_dispute_resolution"], review["practice_category"],
                review["method"], review["suggested_kind"], review["duplicate_of"] or "", review["exists"],
                review["accurate"], review["accuracy_issues"], review["reason"], review["evidence_quote"],
                review["evidence_location"], "yes" if record["reviewed_twice"] else "no", "",
            ]])

    counts = summarize(records)
    with open(arguments.output + "-counts.json", "w", encoding="utf-8") as output_file:
        json.dump(counts, output_file, indent=1, ensure_ascii=False)
        output_file.write("\n")
    print(json.dumps(counts["verdict"], indent=1))


def summarize(records):
    def count(key_function, subset=None):
        counter = collections.Counter(key_function(record) for record in (subset if subset is not None else records))
        return dict(sorted(counter.items(), key=lambda item: (-item[1], str(item[0]))))

    reviews = lambda record: record["pre_review"]
    second = [record for record in records if record["reviewed_twice"]]
    return {
        "provisions": len(records),
        "verdict": count(lambda record: reviews(record)["verdict"]),
        "verdict_by_tier": {tier: count(lambda record: reviews(record)["verdict"],
                                        [record for record in records if record["tier"] == tier])
                            for tier in ["bulk_database_record", "section_title_only", "text_read"]},
        "confidence": count(lambda record: reviews(record)["confidence"]),
        "exists": count(lambda record: reviews(record)["exists"]),
        "accurate": count(lambda record: reviews(record)["accurate"]),
        "is_dispute_resolution": count(lambda record: reviews(record)["is_dispute_resolution"]),
        "practice_category": count(lambda record: reviews(record)["practice_category"]),
        "method_for_dispute_resolution_records": count(
            lambda record: reviews(record)["method"],
            [record for record in records if reviews(record)["is_dispute_resolution"] in ("yes", "borderline")]),
        "nations_with_a_kept_record": len({record["id"].split("#")[0] for record in records
                                          if reviews(record)["verdict"] in ("keep", "keep-relabel")}),
        "nations_with_any_record": len({record["id"].split("#")[0] for record in records}),
        "second_pass_records": len(second),
        "second_pass_agreed": sum(1 for record in second if record["second_pass_agrees"]),
        "second_pass_verdict": count(lambda record: reviews(record)["verdict"], second),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("step", choices=["gather", "merge"])
    parser.add_argument("--repository", default=".", help="repository root (default: current directory)")
    parser.add_argument("--work", required=True, help="working directory for the cache, batches and verdicts")
    parser.add_argument("--output", help="output path prefix for merge, without extension")
    arguments = parser.parse_args()
    if arguments.step == "gather":
        gather(arguments)
    else:
        if not arguments.output:
            parser.error("merge needs --output")
        merge(arguments)


if __name__ == "__main__":
    main()
