"""Build the constitution catalog, version histories and source records.

Joins what read_documents.py found in each captured document with the AI
reviewers' classification (review_batches.py) and article summaries
(summarize_articles.py), then writes:

- research/constitutions/documents.{json,csv}: every captured document the
  reviewers classed as a constitution, bylaws, amendment, articles of
  association, proposed constitution or corporate charter;
- research/constitutions/articles.{json,csv}: every article of those
  documents that a word match tied to a tracked topic;
- research/constitutions/coverage.{json,csv}: one row per federally
  recognized nation, with what was found and where it was looked for;
- content/documents/<letter>/<nation>-constitution.yaml: one version history
  per nation with two or more dated constitution texts (decision record 0018:
  a single version needs no history, its source record is enough);
- content/sources/<letter>/constitution-<nation>-<date>.yaml: a source record
  for each version's text, unless a record for that address already exists.

Usage:
  python3 scripts/constitutions/build_catalog.py READ.json REVIEWS.json SUMMARIES.json SEEDS.json CAPTURE_DIR
"""

import csv
import glob
import json
import os
import re
import sys
import urllib.parse

import yaml

sys.path.insert(0, os.path.dirname(__file__))
from find_more_versions import match_nation  # noqa: E402

TODAY = "2026-11-21"
SESSION = "2026-11-21-constitutions"
CAPTURE_PREFIX = "research/captures/constitutions"
OUTPUT = "research/constitutions"
GOVERNING_TYPES = {
    "constitution",
    "constitution-and-bylaws",
    "bylaws",
    "amendment",
    "articles-of-association",
    "proposed-constitution",
    "corporate-charter",
}
# Separate bylaws (often of a district or community council) stay in the
# catalog but out of the constitution history.
HISTORY_TYPES = GOVERNING_TYPES - {"corporate-charter", "bylaws"}
FULL_TEXT_TYPES = {"constitution", "constitution-and-bylaws", "articles-of-association"}
TOPIC_NAMES = {"judicial": "judicial-power"}
CLAUSE_TOPICS = [
    "judicial-power",
    "dispute-resolution",
    "peacemaking",
    "election-disputes",
    "removal-and-recall",
    "sovereign-immunity",
]
# Indian Reorganization Act (June 18, 1934), its Alaska amendment (May 1,
# 1936) and the Oklahoma Indian Welfare Act (June 26, 1936).
ACT_DATES = {"1934-06-18", "1936-05-01", "1936-06-26"}
# The words a version's name uses for each kind of text, e.g. "1969
# constitution and bylaws, as amended".
TYPE_NOUNS = {
    "constitution": "constitution",
    "constitution-and-bylaws": "constitution and bylaws",
    "articles-of-association": "articles of association",
    "amendment": "amendment",
    "proposed-constitution": "proposed constitution",
}
SMALL_WORDS = {"a", "an", "and", "as", "at", "for", "in", "of", "on", "or", "the", "to", "under", "with"}
DANGLING = re.compile(r"\b(of|the|of the|for|and|to)$", re.I)
AI_REVIEWER = "AI reviewer (Claude Haiku), not yet checked by the lead author"
LIBRARY = "national-indian-law-library"
UNIVERSITY = "university-of-oklahoma-law-library"
FEDERAL_FILES = "bureau-of-indian-affairs-files"
CONGRESS_LIBRARY = "library-of-congress"
ARCHIVAL = (UNIVERSITY, FEDERAL_FILES, CONGRESS_LIBRARY)
SCANNED = {"optical-character-recognition", "internet-archive-optical-character-recognition"}
# Where a copy came from, to tell apart two texts of the same year and dates.
COPY_NAMES = {
    UNIVERSITY: "University of Oklahoma copy",
    LIBRARY: "National Indian Law Library copy",
    CONGRESS_LIBRARY: "Library of Congress copy",
    FEDERAL_FILES: "Bureau of Indian Affairs file",
    "tribal-law-and-policy-institute": "Tribal Law and Policy Institute copy",
    "code-publisher": "code publisher's copy",
    "nation-or-other-site": "website copy",
}


class Dumper(yaml.SafeDumper):
    pass


def string_presenter(dumper, value):
    if "\n" in value:
        return dumper.represent_scalar("tag:yaml.org,2002:str", value, style="|")
    return dumper.represent_scalar("tag:yaml.org,2002:str", value)


Dumper.add_representer(str, string_presenter)


def write_yaml(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        yaml.dump(data, handle, Dumper=Dumper, sort_keys=False, allow_unicode=True, width=100)


def letter(identifier):
    first = identifier[0]
    return first if first.isalpha() else "_other"


def normal_link(link):
    parts = urllib.parse.urlsplit(link.strip())
    host = (parts.hostname or "").lower().removeprefix("www.")
    path = re.sub(r"/(index\.html?)?$", "", parts.path)
    return f"{host}{path}{'?' + parts.query if parts.query else ''}".lower()


def clean_title(title, nation_name):
    """A printed title fit for a citation: title case for an all-capitals
    title, scan breaks such as "BY- LAWS" joined, and the nation's name added
    in brackets when the printed line stops short of it."""
    title = " ".join((title or "").split())
    visible = title.replace(" ", "")
    garbled = visible and (
        sum(character.isalpha() for character in visible) / len(visible) < 0.75 or re.search(r"[\[\]~{}|]", title)
    )
    if not title or garbled:
        # No title, or one the scan's text garbled: a supplied title, in
        # brackets as the citation rules ask.
        return f"[Constitution of the {nation_name}]"
    title = re.sub(r"(\w)- (\w)", r"\1-\2", title)
    letters = [character for character in title if character.isalpha()]
    if letters and sum(character.isupper() for character in letters) / len(letters) > 0.6:
        words = []
        for index, word in enumerate(title.lower().split(" ")):
            parts = word.split("-")
            if index > 0 and word in SMALL_WORDS:
                words.append(word)
            else:
                words.append("-".join(part[:1].upper() + part[1:] for part in parts))
        title = " ".join(words)
    title = title.strip(" ,;:-")
    if DANGLING.search(title):
        title = f"{title} [{nation_name}]"
    return title


def version_label(row):
    """A plain name for a version, e.g. "1969 constitution and bylaws, as
    amended" or "Undated constitution". The printed title stays in the
    source record's citation."""
    noun = TYPE_NOUNS.get(row["document_type"], "constitution")
    year = row["sort_date"][:4]
    label = f"{year} {noun}" if year else f"Undated {noun}"
    compiled = row["version"]["latest_amendment"] or row["version"]["amendments_named"]
    if compiled and row["document_type"] in FULL_TEXT_TYPES:
        label += ", as amended"
    return label


def partial_date(value):
    """Keep YYYY, YYYY-MM or YYYY-MM-DD; drop anything else."""
    if not value or not isinstance(value, str):
        return None
    match = re.match(r"^(1[6-9]\d\d|20[0-2]\d)(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$", value.strip())
    return match.group(0) if match else None


def date_in(text):
    if not text:
        return None
    match = re.search(r"(1[6-9]\d\d|20[0-2]\d)(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?", text)
    return match.group(0) if match else None


MONTH_NUMBERS = {
    name: index
    for index, name in enumerate(
        ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1
    )
}


def iso_from_words(text):
    match = re.match(r"([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})", text)
    if not match:
        return None
    month = MONTH_NUMBERS.get(match.group(1)[:3].lower())
    if not month:
        return None
    return f"{match.group(3)}-{month:02d}-{int(match.group(2)):02d}"


def university_classification(document):
    """University of Oklahoma pages are named for what they hold."""
    name = urllib.parse.urlsplit(document["url"]).path.rsplit("/", 1)[-1].lower()
    title = document["title_line"].lower()
    if re.search(r"ch(a)?rt|charter", name) or "charter" in title and "constitution" not in title:
        document_type = "corporate-charter"
    elif re.search(r"con|const", name) or "constitution" in title:
        document_type = "constitution-and-bylaws" if "by-law" in title or "bylaw" in title else "constitution"
    else:
        document_type = "other"
    approved = adopted = None
    # The certificates come last; earlier dated phrases are often the act the
    # nation organized under, so the last date of each kind is kept and the
    # acts' own dates are skipped.
    for phrase in document["dated_phrases"]:
        iso = iso_from_words(phrase.get("date", "")) if phrase.get("date") else None
        if not iso or iso <= "1934-06-18" or iso in ACT_DATES:
            continue
        if phrase["word"] == "approved":
            approved = iso
        elif phrase["word"] in ("ratified", "adopted"):
            adopted = iso
    return {
        "document_type": document_type,
        "belongs_to_nation": "yes",
        "printed_title": document["title_line"] or None,
        "completeness": "full-text",
        "adopted": adopted,
        "approved": approved,
        "effective": None,
        "latest_amendment": None,
        "amendments_named": [],
        "secretarial_approval": "not-stated",
        "is_proposed_or_draft": False,
        "evidence": None,
        "note": "Classified from the library's file name and title line; dates read by rule from the certificates.",
        "classified_by": "rule",
    }


def publisher_kind(document):
    host = (urllib.parse.urlsplit(document["url"]).hostname or "").lower()
    if "ou.edu" in host:
        return UNIVERSITY
    if "narf.org" in host:
        return LIBRARY
    if host == "www.loc.gov" or host == "tile.loc.gov":
        return CONGRESS_LIBRARY
    if host == "archive.org" and "tribal-constitutions" in document["url"]:
        return FEDERAL_FILES
    if "tribal-institute.org" in host:
        return "tribal-law-and-policy-institute"
    if re.search(r"municode|codepublishing|amlegal|sterlingcodifiers", host):
        return "code-publisher"
    return "nation-or-other-site"


def sort_date(row):
    candidates = [row["version"].get(field) for field in ("adopted", "approved", "effective")]
    candidates.append(date_in(row["version"].get("latest_amendment") or ""))
    candidates = [value for value in candidates if value]
    if candidates:
        return max(candidates)
    return row["version"].get("file_name_date") or ""


def shingles(text):
    """Every run of three words of three or more letters (robust to scanning errors)."""
    words = re.findall(r"[a-z]{3,}", text.lower())
    return {" ".join(words[index: index + 3]) for index in range(max(0, len(words) - 2))}


def word_similarity(before, after):
    """Share of three-word runs the two texts have in common (0 to 1)."""
    def runs(text):
        words = re.findall(r"[a-z0-9]+", text.lower())
        return {" ".join(words[index: index + 3]) for index in range(max(0, len(words) - 2))}

    first, second = runs(before), runs(after)
    if not first or not second:
        return 0.0
    return len(first & second) / len(first | second)


def load_text(capture_dir, capture):
    base = os.path.join(capture_dir, capture).rsplit(".", 1)[0]
    for path in (base + ".ocr.txt", base + ".txt"):
        if os.path.exists(path) and os.path.getsize(path) > 200:
            with open(path, encoding="utf-8", errors="replace") as handle:
                return handle.read()
    return ""


def article_bodies(text, articles):
    lines = text.splitlines()
    bodies = {}
    starts = [article["line"] for article in articles] + [len(lines) + 1]
    for index, article in enumerate(articles):
        bodies[article["label"] + "|" + str(article["line"])] = "\n".join(lines[article["line"] - 1: starts[index + 1] - 1])
    return bodies


def main(read_path, reviews_path, summaries_path, seeds_path, capture_dir):
    with open(read_path, encoding="utf-8") as handle:
        documents = json.load(handle)
    with open(reviews_path, encoding="utf-8") as handle:
        reviews = json.load(handle)
    summaries = {}
    if os.path.exists(summaries_path):
        with open(summaries_path, encoding="utf-8") as handle:
            summaries = json.load(handle)
    with open(seeds_path, encoding="utf-8") as handle:
        seeds = {row["nation"]: row for row in json.load(handle)}

    existing_sources = {}
    for path in glob.glob("content/sources/*/*.yaml"):
        with open(path, encoding="utf-8") as handle:
            record = yaml.safe_load(handle)
        for link in (record.get("original_link"), (record.get("citation") or {}).get("URL")):
            if link:
                existing_sources.setdefault(normal_link(link), record["key"])

    # 1. Classify every document.
    rows = []
    for document in documents:
        key = f"{document['nation']}:{document['sha256'][:16]}"
        if "ou.edu" in document["url"]:
            review = university_classification(document)
        else:
            review = reviews.get(key)
            if not review:
                continue
            review = dict(review, classified_by="ai-reviewer")
        nation = document["nation"]
        if review.get("belongs_to_nation") == "no" or nation == "_unmatched":
            # Move the document to the nation the reviewer named, when that
            # name matches one federally recognized nation closely.
            named, score = match_nation(review.get("other_nation") or "", list(seeds.values())) if review.get("other_nation") else (None, 0)
            if not named or score < 0.8:
                continue
            nation = named["nation"]
            review = dict(review, belongs_to_nation="yes", note=" ".join(filter(None, [
                review.get("note"),
                f"Saved while searching for {document['nation']}; the reviewer named {review['other_nation']}, "
                f"matched by name to {nation}.",
            ])))
        if review.get("document_type") == "other" and re.search(
            r"\barticles of (association|organization)\b", review.get("printed_title") or document["title_line"] or "", re.I
        ):
            # The reviewer instructions defined articles of association for
            # Alaska villages only; some reviewers typed a California or
            # Arizona community's articles as "other".
            review = dict(review, document_type="articles-of-association")
        if review.get("document_type") not in GOVERNING_TYPES:
            continue
        if review.get("completeness") in ("table-of-contents-only", "not-the-text"):
            continue
        document_type = review["document_type"]
        if review.get("is_proposed_or_draft") and document_type != "corporate-charter":
            document_type = "proposed-constitution"
        version = {
            "adopted": partial_date(review.get("adopted")),
            "approved": partial_date(review.get("approved")),
            "effective": partial_date(review.get("effective")),
            "latest_amendment": review.get("latest_amendment"),
            "amendments_named": review.get("amendments_named") or [],
        }
        if publisher_kind(document) == FEDERAL_FILES:
            # The Bureau's files are named "YYYY-MM-DD <nation> <document>";
            # that date is used only when the scan's own text gives none.
            named_date = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})\b", document["anchor"] or "")
            if named_date and "1934" <= named_date.group(1) <= "2026":
                year, month, day = named_date.groups()
                version["file_name_date"] = f"{year}-{int(month):02d}-{int(day):02d}"
        rows.append(
            {
                "key": key,
                "nation": nation,
                "nation_name": seeds[nation]["name"],
                "document_type": document_type,
                "printed_title": review.get("printed_title") or document["title_line"],
                "completeness": review.get("completeness"),
                "version": version,
                "secretarial_approval": review.get("secretarial_approval", "not-stated"),
                "link": document["url"],
                "fetched_from": document["final_url"],
                "wayback_timestamp": document.get("wayback_timestamp"),
                "found_via": document["via"],
                "link_text": document["anchor"],
                "publisher": publisher_kind(document),
                "capture": {
                    "path": f"{CAPTURE_PREFIX}/{document['capture']}",
                    "sha256": document["sha256"],
                    "pages": document["pages"],
                    "bytes": document["bytes"],
                    "format": document["format"],
                    "text_method": document["text_method"],
                },
                "classified_by": review["classified_by"],
                "reviewer_note": review.get("note"),
                "belongs_to_nation": review.get("belongs_to_nation"),
                "articles": document["articles"],
                "same_text_as": [],
                "flags": [],
            }
        )
    for row in rows:
        row["sort_date"] = sort_date(row)
        if row["capture"]["text_method"] in SCANNED:
            row["flags"].append("read by optical character recognition; quotations need checking against the scan")
        if row["belongs_to_nation"] == "unsure":
            row["flags"].append("the text does not name the nation; matched by the link that led to it")
        if not row["sort_date"]:
            row["flags"].append("no adoption, approval, effective or amendment date found in the text")
        elif row["version"].get("file_name_date") and not any(
            row["version"].get(field) for field in ("adopted", "approved", "effective", "latest_amendment")
        ):
            row["flags"].append("no legible date in the scan's text; dated by the Bureau's file name")

    # 2. Group copies of the same text (same version) within each nation.
    by_nation = {}
    for row in rows:
        by_nation.setdefault(row["nation"], []).append(row)
    texts = {}
    for nation, group in by_nation.items():
        for row in group:
            texts[row["key"]] = load_text(capture_dir, row["capture"]["path"].removeprefix(CAPTURE_PREFIX + "/"))
        marks = {row["key"]: shingles(texts[row["key"]]) for row in group}
        for index, row in enumerate(group):
            for other in group[:index]:
                a, b = marks[row["key"]], marks[other["key"]]
                if not a or not b:
                    continue
                overlap = len(a & b) / max(1, min(len(a), len(b)))
                same_kind = row["document_type"] == other["document_type"] or (
                    row["document_type"] in FULL_TEXT_TYPES and other["document_type"] in FULL_TEXT_TYPES
                )
                # Same text, same year: copies read differently (one copy's
                # certificate legible, another's not) are still one version.
                if overlap >= 0.9 and row["sort_date"][:4] == other["sort_date"][:4] and same_kind:
                    row["same_text_as"].append(other["key"])
                    other["same_text_as"].append(row["key"])

    def preference(row):
        live = 0 if not row["wayback_timestamp"] else 1
        own = {"nation-or-other-site": 0, LIBRARY: 1, "code-publisher": 2, UNIVERSITY: 3, CONGRESS_LIBRARY: 4, FEDERAL_FILES: 5}.get(row["publisher"], 6)
        layer = 0 if row["capture"]["text_method"] not in SCANNED else 1
        return (live, own, layer, row["key"])

    # 3. Version histories.
    histories = {}
    source_records = {}
    article_rows = []
    for nation, group in sorted(by_nation.items()):
        chosen, taken = [], set()
        for row in sorted(group, key=preference):
            if row["key"] in taken:
                continue
            taken.add(row["key"])
            taken.update(row["same_text_as"])
            row["primary"] = True
            # A copy may print a date this copy's scan or page lacks.
            by_key = {other["key"]: other for other in group}
            filled = []
            for field in ("adopted", "approved", "effective"):
                if row["version"][field]:
                    continue
                for other_key in row["same_text_as"]:
                    value = by_key[other_key]["version"][field]
                    if value and value[:4] == row["sort_date"][:4]:
                        row["version"][field] = value
                        filled.append(f"{field} {value}")
                        break
            if filled:
                row["dates_from_copy"] = filled
                row["sort_date"] = sort_date(row)
            chosen.append(row)
        for row in group:
            row.setdefault("primary", False)
        versions_rows = [
            row for row in chosen if row["document_type"] in HISTORY_TYPES and row["sort_date"]
        ]
        # On the same date, archival copies come before a live one, so the
        # live copy stays the newest version.
        versions_rows.sort(
            key=lambda row: (
                row["sort_date"],
                row["document_type"] == "amendment",
                row["publisher"] not in ARCHIVAL,
                row["key"],
            )
        )
        undated = False
        if not versions_rows:
            # A nation whose texts carry no legible date still has them
            # listed, undated and in no order.
            versions_rows = sorted(
                (row for row in chosen if row["document_type"] in HISTORY_TYPES), key=lambda row: row["key"]
            )
            undated = True
        if not versions_rows:
            continue
        history_id = f"{nation}-constitution"
        versions = []
        ids = set()
        previous_full = None
        full_rows = [row for row in versions_rows if row["document_type"] in FULL_TEXT_TYPES]
        newest_full = full_rows[-1] if full_rows else None
        for row in versions_rows:
            year = row["sort_date"][:4] or "undated"
            kind_word = {
                "amendment": "amendment",
                "proposed-constitution": "proposed",
                "bylaws": "bylaws",
            }.get(row["document_type"], "text")
            version_id = f"{year}-{kind_word}"
            count = 2
            while version_id in ids:
                version_id = f"{year}-{kind_word}-{count}"
                count += 1
            ids.add(version_id)
            row["version_id"] = version_id
            row["history"] = history_id
            if undated:
                event = "other" if len(versions_rows) > 1 else "original"
            elif row["document_type"] == "amendment":
                event = "amendment"
            elif row["document_type"] == "proposed-constitution":
                event = "revision"
            elif previous_full is None:
                event = "edition" if (row["version"]["latest_amendment"] or row["version"]["amendments_named"]) else "original"
            elif (
                row["version"]["adopted"]
                and previous_full["version"]["adopted"]
                and row["version"]["adopted"][:4] != previous_full["version"]["adopted"][:4]
            ):
                event = "revision"
            else:
                event = "edition"
            printed = {field: row["version"][field] for field in ("adopted", "approved", "effective") if row["version"][field]}
            note_parts = []
            if printed.get("approved") and printed.get("adopted") and printed["approved"] < printed["adopted"]:
                note_parts.append(
                    f"The text prints an approval date ({printed.pop('approved')}) before the adoption date; it may "
                    "be the approval to hold the election, so it is left out of dates."
                )
            if (event in ("edition", "revision") and (previous_full or row["version"]["latest_amendment"])) or (
                event == "amendment" and row["version"]["latest_amendment"]
            ):
                # A compiled text prints the original adoption and approval
                # dates; those belong to an earlier text, not to this version.
                floor = previous_full["sort_date"] if previous_full else ""
                newest_year = row["sort_date"][:4]
                earlier = {
                    field: value for field, value in printed.items()
                    if value <= floor or (event in ("edition", "amendment") and value[:4] < newest_year)
                }
                dates = {field: value for field, value in printed.items() if field not in earlier}
                if earlier:
                    note_parts.append(
                        "The text also prints "
                        + ", ".join(f"{field} {value}" for field, value in earlier.items())
                        + ", which belong to the earlier text it compiles."
                    )
            else:
                dates = dict(printed)
            if undated:
                dates = {}
                note_parts.append("No adoption, approval, effective or amendment date could be read from the text.")
            elif not dates and not printed and row["version"].get("file_name_date") == row["sort_date"]:
                dates = {"listed": row["sort_date"]}
                note_parts.append(
                    "The scan's text gives no legible date; the date recorded as listed is the one in the Bureau of "
                    "Indian Affairs' file name."
                )
            elif not dates:
                dates = {"listed": row["sort_date"]}
                note_parts.append(
                    "The date recorded as listed is that of the latest amendment the text says it includes."
                )
            label = version_label(row)
            if row["document_type"] == "proposed-constitution":
                status = "proposed"
            elif row["document_type"] == "amendment":
                status = "unknown"
            elif undated:
                status = "unknown"
            elif row is newest_full:
                status = (
                    "in-effect"
                    if row["publisher"] == "nation-or-other-site" and not row["wayback_timestamp"]
                    else "unknown"
                )
            else:
                status = "superseded"
            version = {
                "id": version_id,
                "label": label,
                "event": event,
                "status": status,
            }
            if dates:
                version["dates"] = dates
            if dates.get("approved"):
                version["approval"] = {
                    "authority": "secretary-of-the-interior",
                    "action": "approved",
                    "locator": "approval certificate",
                }
            elif row["secretarial_approval"] in ("not-required", "removed"):
                version["approval"] = {"authority": "secretary-of-the-interior", "action": "not-required"}
            if undated:
                pass
            elif event == "amendment" and previous_full:
                version["amends"] = [previous_full["version_id"]]
            elif event in ("revision", "edition") and previous_full and status != "proposed":
                version["supersedes"] = [previous_full["version_id"]]
            source_key = existing_sources.get(normal_link(row["link"])) if not row["wayback_timestamp"] else None
            if not source_key:
                source_key = f"constitution-{nation}-{version_id}"
                source_records[source_key] = row
            row["source"] = source_key
            version["source"] = source_key
            version["confidence"] = "medium"
            version["verification"] = "read-in-full" if row["classified_by"] == "ai-reviewer" else "inferred"
            version["capture"] = {
                "path": row["capture"]["path"],
                "sha256": row["capture"]["sha256"],
            }
            if row["capture"]["pages"]:
                version["capture"]["pages"] = row["capture"]["pages"]
            if status == "in-effect":
                note_parts.append(
                    "Marked in effect because it is the newest dated text found, on the nation's own site, on "
                    f"{TODAY}; a later amendment may not be posted."
                )
            elif status == "superseded":
                note_parts.append("Marked superseded because a later dated text was found (project inference).")
            if row.get("dates_from_copy"):
                note_parts.append(
                    "Dates read from another copy of the same text: " + ", ".join(row["dates_from_copy"]) + "."
                )
            if row["classified_by"] == "ai-reviewer":
                note_parts.append(f"Type and dates read from the text by an {AI_REVIEWER}.")
            else:
                note_parts.append("Dates read by rule from the certificates on the library page.")
            version["note"] = " ".join(note_parts)

            # Clauses from the flagged articles.
            clauses = []
            bodies = article_bodies(texts[row["key"]], row["articles"])
            row["topic_bodies"] = {}
            for article in row["articles"]:
                for topic_name in article["topics"]:
                    topic = TOPIC_NAMES.get(topic_name, topic_name)
                    if topic not in CLAUSE_TOPICS:
                        continue
                    # Drop table-of-contents dot leaders and page numbers.
                    heading = re.sub(r"\s*(\.\s*){3,}.*$", "", article["heading"] or "").strip(" .,;:")
                    locator = f"{article['label']} ({heading[:80]})" if heading else article["label"]
                    summary_key = f"{row['key']}|{article['label']}|{article['line']}|{topic}"
                    summary = summaries.get(summary_key)
                    article_row = {
                        "document": row["key"],
                        "nation": nation,
                        "version": version_id,
                        "article": article["label"],
                        "heading": article["heading"],
                        "line": article["line"],
                        "topic": topic,
                        "found_by": "heading" if article["topics"][topic_name]["heading"] else "words-in-text",
                        "word_matches": article["topics"][topic_name]["matches"],
                        "confirmed": summary.get("confirmed") if summary else None,
                        "verification": "read-in-full" if summary else "inferred",
                    }
                    article_rows.append(article_row)
                    if summary and summary.get("confirmed") is False:
                        if not article["topics"][topic_name]["heading"]:
                            continue
                        # The heading names the topic but the reviewer saw no
                        # provision (often a table-of-contents line or cut-off
                        # text): keep it as a heading-only lead.
                        summary = None
                    row["topic_bodies"].setdefault(topic, []).append(bodies.get(article["label"] + "|" + str(article["line"]), ""))
                    if not summary and not article["topics"][topic_name]["heading"]:
                        # Words in the body alone, not yet read: a lead kept
                        # in articles.json, too weak to list as a clause.
                        continue
                    # No AI summaries of constitutions are kept (lead author,
                    # Nov. 22, 2026): a clause names the article and topic only.
                    if summary and summary.get("summary"):
                        named = f"Article headed \"{heading[:100]}\"" if heading else f"{article['label']}"
                        clause = {
                            "topic": topic,
                            "locator": locator,
                            "summary": f"{named}; an AI reviewer confirmed it covers this topic.",
                            "verification": "read-in-full",
                            "reviewer": AI_REVIEWER,
                        }
                    else:
                        clause = {
                            "topic": topic,
                            "locator": locator,
                            "summary": f"Article headed \"{heading[:100]}\"; found by its heading and not yet read.",
                            "verification": "title-only",
                        }
                    clauses.append(clause)
            if clauses:
                version["clauses"] = clauses
            versions.append(version)
            if row["document_type"] in FULL_TEXT_TYPES:
                previous_full = row

        # Changes between each version and the one it amends or supersedes.
        by_id = {row["version_id"]: row for row in versions_rows}
        for version in versions:
            earlier = (version.get("supersedes") or version.get("amends") or [None])[0]
            if not earlier:
                continue
            newer_row, older_row = by_id[version["id"]], by_id[earlier]
            older_topics = {clause["topic"] for clause in next(v for v in versions if v["id"] == earlier).get("clauses", [])}
            newer_topics = {clause["topic"] for clause in version.get("clauses", [])}
            changes = []
            split_failed = min(len(newer_row["articles"]), len(older_row["articles"])) < 5
            for topic in [topic for topic in CLAUSE_TOPICS if topic in older_topics | newer_topics]:
                change = {"topic": topic, "compared_with": earlier}
                if split_failed and version["event"] != "amendment":
                    change.update(change="not-compared", verification="inferred",
                                  note="The script could not split one of the two texts into articles; compare by hand.")
                elif version["event"] == "amendment":
                    change.update(change="not-compared", verification="inferred",
                                  note="An amendment changes only what it names; compare by hand.")
                elif topic in newer_topics and topic not in older_topics:
                    change.update(change="added", verification="inferred",
                                  note="A word match found an article on this topic in this text and none in the earlier one.")
                elif topic in older_topics and topic not in newer_topics:
                    change.update(change="removed", verification="inferred",
                                  note="A word match found an article on this topic in the earlier text and none in this one.")
                else:
                    before = "\n".join(older_row["topic_bodies"].get(topic, []))
                    after = "\n".join(newer_row["topic_bodies"].get(topic, []))
                    ratio = word_similarity(before, after)
                    if ratio >= 0.97:
                        change.update(change="unchanged", verification="inferred",
                                      note=f"The article texts match (word-run overlap {ratio:.2f}, by script).")
                    else:
                        change.update(change="not-compared", verification="inferred",
                                      note=f"The article texts differ (word-run overlap {ratio:.2f}, by script); not yet read side by side.")
                changes.append(change)
            if changes:
                version["changes"] = changes
        # Tell apart versions that would share a name: by their dates, then
        # by where the copy came from, then by number.
        def disambiguate(versions, describe):
            seen = {}
            for version in versions:
                seen.setdefault(version["label"], []).append(version)
            for same in seen.values():
                if len(same) < 2:
                    continue
                words = [describe(version) for version in same]
                if all(words) and len(set(words)) == len(words):
                    for version, word in zip(same, words):
                        version["label"] += f" ({word})"

        def when(version):
            dated = version.get("dates") or {}
            return dated.get("adopted") or dated.get("approved") or next(iter(dated.values()), None)

        disambiguate(versions, when)
        disambiguate(versions, lambda version: COPY_NAMES.get(by_id[version["id"]]["publisher"]))
        seen = {}
        for version in versions:
            seen.setdefault(version["label"], []).append(version)
        for same in seen.values():
            if len(same) > 1:
                for index, version in enumerate(same, start=1):
                    version["label"] += f" (text {index})"
        first_name = seeds[nation]["name"]

        def first_date(version):
            dated = version.get("dates") or {}
            return dated.get("adopted") or dated.get("approved") or next(iter(dated.values()))

        if undated:
            found = f"{len(versions)} text{'s' if len(versions) != 1 else ''} with no legible date"
        elif len(versions) == 1:
            found = f"one dated version, of {first_date(versions[0])}"
        else:
            found = f"{len(versions)} dated versions, from {first_date(versions[0])} to {first_date(versions[-1])}"
        histories[history_id] = {
            "id": history_id,
            "kind": "constitution",
            "title": f"Constitution of the {first_name}" if not first_name.lower().startswith("the ") else f"Constitution of {first_name}",
            "nations": [nation],
            "jurisdictions": [{"level": "tribal", "tribe": nation}],
            "summary": (
                f"Texts of the nation's constitution found online on {TODAY}: {found}. "
                "Versions are only those found; others may exist."
            ),
            "versions": versions,
            "found_in": [SESSION],
            "notes": (
                "Built by scripts/constitutions/build_catalog.py from research/constitutions/documents.json. "
                "Statuses, events and changes are project inferences from the texts found; see the catalog README."
            ),
        }

    # 4. Write the history records and source records. Every nation with a
    # constitution text found gets a history record, even with one version or
    # none dated, so its page lists the constitution (lead author, Nov. 22,
    # 2026; an exception to decision record 0018's single-version rule).
    written = set(histories)
    for history_id in sorted(written):
        write_yaml(f"content/documents/{letter(history_id)}/{history_id}.yaml", histories[history_id])
    by_link = {}
    for key, row in source_records.items():
        by_link.setdefault(normal_link(row["link"]), []).append(key)
    for key, row in source_records.items():
        date = row["sort_date"]
        parts = [int(part) for part in date.split("-")] if date else []
        citation = {
            "type": "legislation",
            "title": clean_title(row["printed_title"], seeds[row["nation"]]["name"]),
            "author": [{"literal": seeds[row["nation"]]["name"]}],
        }
        if row["publisher"] == LIBRARY:
            citation["container-title"] = "National Indian Law Library Tribal Law Gateway (Native American Rights Fund)"
        elif row["publisher"] == UNIVERSITY:
            citation["container-title"] = "Native American Constitution and Law Digitization Project (University of Oklahoma Law Library)"
        elif row["publisher"] == CONGRESS_LIBRARY:
            citation["container-title"] = "Library of Congress"
        elif row["publisher"] == FEDERAL_FILES:
            citation["container-title"] = (
                "US Tribal Constitutions (Bureau of Indian Affairs records released under the Freedom of Information "
                "Act, Internet Archive)"
            )
        citation["URL"] = row["link"]
        if parts:
            citation["issued"] = {"date-parts": [parts]}
        citation["accessed"] = {"date-parts": [[2026, 11, 21]]}
        record = {
            "key": key,
            "kind": "tribal-constitution",
            "citation": citation,
            "original_link": row["link"],
            "retrieved": TODAY,
            "archives": [],
            "history": {"status": "live", "last_checked": TODAY},
        }
        if row["wayback_timestamp"]:
            stamp = row["wayback_timestamp"]
            record["archives"] = [
                {
                    "service": "wayback",
                    "link": f"https://web.archive.org/web/{stamp}/{row['link']}",
                    "captured": f"{stamp[:4]}-{stamp[4:6]}-{stamp[6:8]}",
                }
            ]
            record["history"] = {"status": "unknown", "last_checked": TODAY}
        others = [other for other in by_link[normal_link(row["link"])] if other != key]
        if others:
            record["shares_link_with"] = sorted(others)
        record["rights"] = {
            "status": "no-permission-needed",
            "basis": "fact-only",
            "basis_note": "Only facts are recorded from this source; it is cited and linked, not quoted or reproduced.",
            "redistribution": False,
        }
        record["tribes"] = [row["nation"]]
        if row["history"] in written:
            record["document_version"] = {"document": row["history"], "version": row["version_id"]}
        record["found_in"] = [SESSION]
        notes = [
            f"Constitution catalog row {row['key']}; private copy {row['capture']['path']} "
            f"(SHA-256 {row['capture']['sha256'][:16]}...)."
        ]
        if row["wayback_timestamp"]:
            notes.append("This version was read from the Wayback Machine capture listed under archives.")
        if row["publisher"] == FEDERAL_FILES:
            notes.append(
                "A scan from the Bureau of Indian Affairs' own files, released under the Freedom of Information Act "
                "and posted by The Memory Hole 2 (Public Domain Mark); read from the Internet Archive's text."
            )
        elif row["capture"]["text_method"] in SCANNED:
            notes.append("Scanned; read from text made by optical character recognition.")
        record["notes"] = " ".join(notes)
        write_yaml(f"content/sources/{letter(key)}/{key}.yaml", record)

    # 5. Catalog files.
    os.makedirs(OUTPUT, exist_ok=True)
    document_out = []
    for row in sorted(rows, key=lambda row: (row["nation"], row["sort_date"], row["key"])):
        document_out.append(
            {
                "key": row["key"],
                "nation": row["nation"],
                "nation_name": row["nation_name"],
                "document_type": row["document_type"],
                "printed_title": row["printed_title"],
                "completeness": row["completeness"],
                "adopted": row["version"]["adopted"],
                "approved": row["version"]["approved"],
                "effective": row["version"]["effective"],
                "latest_amendment": row["version"]["latest_amendment"],
                "amendments_named": row["version"]["amendments_named"],
                "secretarial_approval": row["secretarial_approval"],
                "history": row.get("history") if row.get("history") in written else None,
                "version": row.get("version_id"),
                "primary_copy": row["primary"],
                "same_text_as": row["same_text_as"],
                "source": row.get("source"),
                "link": row["link"],
                "wayback_timestamp": row["wayback_timestamp"],
                "publisher": row["publisher"],
                "found_via": row["found_via"],
                "link_text": row["link_text"],
                "capture": row["capture"]["path"],
                "sha256": row["capture"]["sha256"],
                "pages": row["capture"]["pages"],
                "format": row["capture"]["format"],
                "text_method": row["capture"]["text_method"],
                "classified_by": row["classified_by"],
                "confidence": "medium",
                "verification": "read-in-full" if row["classified_by"] == "ai-reviewer" else "inferred",
                "reviewer_note": row["reviewer_note"],
                "flags": row["flags"],
            }
        )
    # A document in which the nation itself says it has no written
    # constitution (a reviewer's note says so); recorded, not guessed.
    no_written = {
        key.split(":")[0]: key
        for key, review in reviews.items()
        if re.search(r"\bno written constitution\b", review.get("note") or "", re.I)
        and review.get("belongs_to_nation") != "no"
    }
    coverage = []
    for nation, seed in sorted(seeds.items()):
        group = by_nation.get(nation, [])
        history = histories.get(f"{nation}-constitution")
        constitution_rows = [row for row in group if row["document_type"] in HISTORY_TYPES]
        newest = history["versions"][-1] if history else None
        in_effect = [version for version in (history or {}).get("versions", []) if version["status"] == "in-effect"]
        if history and not any(version.get("dates") for version in history["versions"]):
            status = "undated-text-only"
        elif in_effect:
            status = "current-text-found"
        elif history and any(row["publisher"] not in ARCHIVAL for row in constitution_rows):
            status = "text-found-currency-unknown"
        elif history:
            # Only the university library's pages, the Library of Congress
            # copies or the Bureau's own files:
            # texts as the federal government holds them, often decades old.
            status = "archival-copies-only"
        elif constitution_rows:
            status = "undated-text-only"
        elif nation in no_written:
            status = "nation-says-no-written-constitution"
        elif seed["seeds"]:
            status = "listed-but-not-retrieved"
        else:
            status = "none-found"
        topics = sorted({clause["topic"] for clause in (in_effect[-1] if in_effect else newest or {}).get("clauses", [])})
        coverage.append(
            {
                "nation": nation,
                "nation_name": seed["name"],
                "states": seed["states"],
                "status": status,
                "history": history["id"] if history and history["id"] in written else None,
                "versions_found": len(history["versions"]) if history else 0,
                "newest_version": newest["id"] if newest else None,
                "newest_version_label": newest["label"] if newest else None,
                "newest_version_status": newest["status"] if newest else None,
                "documents_captured": len(group),
                "corporate_charters": sum(1 for row in group if row["document_type"] == "corporate-charter"),
                "topics_in_newest": topics,
                "links_cited_before": len(seed["seeds"]),
                "website_searched": bool(seed["websites"]),
                "statement_document": no_written.get(nation) if status == "nation-says-no-written-constitution" else None,
                "verification": "inferred",
            }
        )
    with open(f"{OUTPUT}/documents.json", "w", encoding="utf-8") as handle:
        json.dump(document_out, handle, indent=1, ensure_ascii=False)
        handle.write("\n")
    with open(f"{OUTPUT}/articles.json", "w", encoding="utf-8") as handle:
        json.dump(article_rows, handle, indent=1, ensure_ascii=False)
        handle.write("\n")
    with open(f"{OUTPUT}/coverage.json", "w", encoding="utf-8") as handle:
        json.dump(coverage, handle, indent=1, ensure_ascii=False)
        handle.write("\n")
    for name, table in (("documents", document_out), ("articles", article_rows), ("coverage", coverage)):
        with open(f"{OUTPUT}/{name}.csv", "w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(table[0].keys()), lineterminator="\n")
            writer.writeheader()
            for item in table:
                writer.writerow(
                    {
                        field: "; ".join(map(str, value)) if isinstance(value, list) else ("" if value is None else value)
                        for field, value in item.items()
                    }
                )
    print(
        f"{len(document_out)} documents, {len(histories)} histories, "
        f"{sum(len(history['versions']) for history in histories.values())} versions, "
        f"{len(source_records)} new source records, {len(article_rows)} article rows"
    )


if __name__ == "__main__":
    main(*sys.argv[1:6])
