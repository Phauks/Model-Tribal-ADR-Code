"""Order every compact document into a version history for each nation and state, and record
how the dispute resolution and renegotiation clauses changed from one version to the next.

    python3 scripts/gaming/build_histories.py pairs CAPTURES WORK_DIRECTORY
    python3 scripts/gaming/build_histories.py check CAPTURES WORK_DIRECTORY
    python3 scripts/gaming/build_histories.py merge CAPTURES WORK_DIRECTORY

`pairs` orders the documents and writes comparison batches (WORK_DIRECTORY/change-batches/)
pairing each amendment or replacement with the version in force before it; reviewers write
answers to WORK_DIRECTORY/change-answers/. `check` keeps an answer's quotations only where they
are found word for word in the document text. `merge` writes research/gaming/compact-history-versions.*
from the catalog, the clause rows (research/gaming/compact-clauses.json plus the checked answers for
older versions in WORK_DIRECTORY/checked-history.json) and the checked change answers.

The order and the kind of each event are inferred by rule (`verification: inferred`); the change
summaries are the reviewers' reading of excerpts. Never changes a profile.
"""

import collections
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from clause_evidence import normalize, sections  # noqa: E402
from build_catalog import write_table  # noqa: E402

OUT = pathlib.Path("research/gaming")
CATALOG = OUT / "compact-documents.json"
CLAUSES = OUT / "compact-clauses.json"
FULL_PAGES = 20
SUBJECTS = ("dispute_resolution", "renegotiation")
EXCERPT = 9000
# List rows no profile cites (see compact-documents flags): the nation named at the start of the title.
TITLE_NATIONS = [
    (r"^Enterprise Rancheria", "enterprise-rancheria-of-maidu-indians-of-california"),
    (r"^Chitimacha Tribe", "chitimacha-tribe-of-louisiana"),
    (r"^Fond du Lac Band", "fond-du-lac-band"),
    (r"^Grand Portage Band", "grand-portage-band"),
    (r"^Leech Lake Band", "leech-lake-band"),
    (r"^Lower Sioux Indian Community", "lower-sioux-indian-community-in-the-state-of-minnesota"),
    (r"^Mille Lacs Band", "mille-lacs-band"),
    (r"^White Earth Band", "white-earth-band"),
    (r"^Burns Paiute Tribe", "burns-paiute-tribe"),
    (r"^Suquamish Indian Tribe", "suquamish-indian-tribe-of-the-port-madison-reservation"),
    (r"^Oneida Nation and State of Wisconsin", "oneida-nation"),
]
OFF_TRACK = re.compile(r"off-track wagering\)? compact|compact for off-track wagering", re.I)
MINNESOTA_TITLE = re.compile(r"compact\s+(?:for|governing)\s+(?:the\s+)?control\s+of\s+class\s+iii\s+"
                             r"(blackjack|video\s+games?\s+of\s+chance)", re.I)
MINNESOTA_GAMES = re.compile(r"blackjack|video games? of chance", re.I)
MONTHS = {m: i for i, m in enumerate(
    ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."], start=1)}


def published(record):
    """Publication date of the Federal Register notice, from its Indigo Book citation. A notice dated
    more than a year from the listed date (one row: a 2019 notice linked to a 2000 compact) is not used."""
    notice = record.get("federal_register") or {}
    match = re.search(r"\((\w+\.?) (\d+), (\d{4})\)", notice.get("citation") or "")
    if not match or match.group(1) not in MONTHS:
        return None
    date = f"{match.group(3)}-{MONTHS[match.group(1)]:02d}-{int(match.group(2)):02d}"
    listed = record.get("listed_date")
    if listed and abs(int(date[:4]) - int(listed[:4])) > 1:  # a mismatched notice
        return None
    return date


def clause_rows(work):
    rows = {row["id"]: row for row in json.loads(CLAUSES.read_text(encoding="utf-8"))}
    older = work / "checked-history.json"
    if older.exists():
        for row in json.loads(older.read_text(encoding="utf-8")):
            for subject in SUBJECTS:
                clause = row.get(subject)
                if isinstance(clause, dict) and clause.get("quote") and not clause.get("quote_found"):
                    clause["quote"] = None  # not found word for word in the document text
            row["reviewer"] = "small model, older version"
            row["needs_review"] = row.get("difficulty") == "hard"
            rows.setdefault(row["id"], row)
    return rows


def event_of(record, earlier, clause):
    """Kind of event, from the list decision, the title and, where a reviewer read it, the text."""
    title = record["title"].lower()
    if record["decision"] == "disapproved":
        return "disapproval"
    if record["document_kind"] in ("secretarial-procedures", "extension", "letter"):
        return record["document_kind"]
    is_ = (clause or {}).get("document_is")
    if record["document_kind"] == "amendment" or is_ == "amendment" or re.search(r"amend|addend", title) and "restat" not in title:
        return "amendment"
    pages = (record.get("capture") or {}).get("pages") or 0
    full = is_ == "full-compact" or (is_ is None and pages >= FULL_PAGES)
    if not any(e["event"] in ("original", "replacement", "secretarial-procedures") for e in earlier):
        return "original" if full or not earlier else "amendment"
    return "replacement" if full else "amendment"


def track_of(record, captures):
    """Some nations hold more than one compact with a state under the same list title, each with its own
    amendments: Oklahoma's off-track wagering compacts beside the gaming compact, and Minnesota's
    separate compacts for video games of chance (1989-1990) and for blackjack (1991). The document's
    own text says which it is: the first pages for Oklahoma, the first compact title for Minnesota."""
    if not record.get("capture") or record["state"] not in ("OK", "MN"):
        return "gaming"
    path = (captures / record["capture"]["capture"]).with_suffix(".txt")
    text = re.sub(r"\s+", " ", path.read_text(encoding="utf-8", errors="replace")[:20000]) if path.exists() else ""
    if record["state"] == "OK":
        return "off-track-wagering" if OFF_TRACK.search(text[:2500]) else "gaming"
    match = MINNESOTA_TITLE.search(text) or MINNESOTA_GAMES.search(text)
    if not match:
        return "gaming"
    return "blackjack" if "black" in match.group(0).lower() else "video-games-of-chance"


def histories(catalog, clauses, captures):
    groups = collections.defaultdict(list)
    for record in catalog:
        by_title = [nation for pattern, nation in TITLE_NATIONS if re.search(pattern, record["title"])]
        for nation in record["nations"] or by_title or [f"unmatched:{record['list_tribes_column']}"]:
            groups[(nation, record["state"], track_of(record, captures))].append(record)
    result = []
    for (nation, state, track), records in sorted(groups.items()):
        records.sort(key=lambda r: (published(r) or r["listed_date"] or "9999", r["listed_date"] or "9999", r["title"]))
        versions = []
        for record in records:
            clause = clauses.get(record["id"])
            event = event_of(record, versions, clause)
            in_force = [v for v in versions if v["event"] in ("original", "replacement", "secretarial-procedures")]
            version = {
                "id": record["id"],
                "event": event,
                "title": record["title"],
                "decision": record["decision"],
                "dates": {"listed": record["listed_date"], "published": published(record)},
                "status": "disapproved" if event == "disapproval" else "approved-or-in-effect",
                "amends": in_force[-1]["id"] if event in ("amendment", "extension") and in_force else None,
                "supersedes": in_force[-1]["id"] if event in ("replacement", "secretarial-procedures") and in_force else None,
                "approval_source": (record.get("federal_register") or {}).get("source"),
                "approval_citation": (record.get("federal_register") or {}).get("citation"),
                "document_link": record["document_link"],
                "capture": record.get("capture"),
                "clauses": {subject: (clause or {}).get(subject) for subject in SUBJECTS} if clause else None,
                "clause_reviewer": (clause or {}).get("reviewer") or ("small model, older version" if clause else None),
                "source": record["source"],
                "confidence": "medium",
                "verification": "inferred",
            }
            versions.append(version)
        superseded = {v["supersedes"] for v in versions if v["supersedes"]}
        for version in versions:
            if version["id"] in superseded:
                version["status"] = "superseded"
        result.append({"nation": nation, "state": state, "track": track, "versions": versions})
    return result


def text_of(captures, version):
    if not version.get("capture"):
        return ""
    path = (captures / version["capture"]["capture"]).with_suffix(".txt")
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def excerpt(captures, version):
    text = text_of(captures, version)
    found = sections(text)
    passages = {s: found.get(s) for s in SUBJECTS}
    if version["event"] == "amendment" or not any(passages.values()):
        passages["whole_text_start"] = re.sub(r"[ \t]+", " ", text[:EXCERPT])
    return passages


def pairs(captures, work, batch_size=8):
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    built = histories(catalog, clause_rows(work), captures)
    (work / "histories.json").write_text(json.dumps(built, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    by_id = {v["id"]: v for h in built for v in h["versions"]}
    items, seen = [], set()
    for history in built:
        for version in history["versions"]:
            earlier = version["amends"] or version["supersedes"]
            if version["event"] not in ("amendment", "replacement", "secretarial-procedures") or not earlier:
                continue
            key = (earlier, version["id"])
            if key in seen:  # a document shared by several nations is compared once
                continue
            seen.add(key)
            before, after = by_id[earlier], version
            if not text_of(captures, before).strip() or len(re.sub(r"\s", "", text_of(captures, after))) < 500:
                continue
            items.append({
                "pair": f"{earlier}--{version['id']}",
                "state": history["state"],
                "event": version["event"],
                "earlier": {"id": before["id"], "title": before["title"], "listed_date": before["dates"]["listed"],
                            "excerpts": excerpt(captures, before)},
                "later": {"id": after["id"], "title": after["title"], "listed_date": after["dates"]["listed"],
                          "excerpts": excerpt(captures, after)},
            })
    folder = work / "change-batches"
    folder.mkdir(parents=True, exist_ok=True)
    for number in range(0, len(items), batch_size):
        path = folder / f"batch-{number // batch_size + 1:03d}.json"
        path.write_text(json.dumps(items[number:number + batch_size], indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    counts = collections.Counter(v["event"] for h in built for v in h["versions"])
    print(f"{len(built)} histories; events {dict(counts)}; {len(items)} pairs in "
          f"{(len(items) + batch_size - 1) // batch_size} batches")


def check(captures, work):
    """Check the reviewers' quotations against the text. A second-pass answer (WORK_DIRECTORY/second/
    answers-*.json, a larger model reading both full texts) replaces the first-pass dispute resolution
    answer for the same pair."""
    by_id = {r["id"]: r for r in json.loads(CATALOG.read_text(encoding="utf-8"))}
    second = {}
    for path in sorted((work / "second").glob("answers-*.json")) if (work / "second").exists() else []:
        for answer in json.loads(path.read_text(encoding="utf-8")):
            second[answer["pair"]] = answer
    checked, found, total, replaced = [], 0, 0, 0
    for path in sorted((work / "change-answers").glob("batch-*.json")):
        for answer in json.loads(path.read_text(encoding="utf-8")):
            earlier, later = answer["pair"].split("--", 1)
            texts = {"earlier": normalize(text_of(captures, by_id[earlier])),
                     "later": normalize(text_of(captures, by_id[later]))}
            answer["reviewers"] = {subject: "small model, version comparison" for subject in SUBJECTS}
            if answer["pair"] in second:
                review = second[answer["pair"]]
                first = answer.get("dispute_resolution") or {}
                answer["dispute_resolution"] = {key: review.get(key) for key in (
                    "change", "summary", "earlier_locator", "later_locator", "earlier_quote", "later_quote")}
                answer["dispute_resolution"]["first_pass"] = {"change": first.get("change"),
                                                              "verdict": review.get("first_pass_verdict")}
                answer["reviewers"]["dispute_resolution"] = "larger model, second pass on the full text"
                if review.get("note"):
                    answer["note"] = review["note"]
                answer["difficulty"] = "checked"
                replaced += 1
            for subject in SUBJECTS:
                change = answer.get(subject) or {}
                for side in ("earlier", "later"):
                    quote = change.get(f"{side}_quote")
                    if quote:
                        total += 1
                        if normalize(quote) in texts[side]:
                            found += 1
                        else:
                            change[f"{side}_quote"] = None
            checked.append(answer)
    (work / "checked-changes.json").write_text(json.dumps(checked, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(checked)} change answers ({replaced} dispute answers from the second pass); "
          f"{found} of {total} quotations found")


def merge(captures, work):
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    built = histories(catalog, clause_rows(work), captures)
    changes_file = work / "checked-changes.json"
    changes = {a["pair"]: a for a in json.loads(changes_file.read_text(encoding="utf-8"))} if changes_file.exists() else {}
    rows = []
    for history in built:
        for version in history["versions"]:
            earlier = version["amends"] or version["supersedes"]
            answer = changes.get(f"{earlier}--{version['id']}") if earlier else None
            version["changes"] = [
                {"topic": subject, "compared_with": earlier, **{k: v for k, v in (answer.get(subject) or {}).items()}}
                for subject in SUBJECTS if answer and answer.get(subject)
            ] or None
            if answer:
                version["change_note"] = answer.get("note")
                version["change_difficulty"] = answer.get("difficulty")
            dispute = (version["clauses"] or {}).get("dispute_resolution") or {}
            dispute_change = next((c for c in version["changes"] or [] if c["topic"] == "dispute_resolution"), {})
            rows.append({
                "nation": history["nation"], "state": history["state"], "track": history["track"], "id": version["id"], "event": version["event"],
                "listed_date": version["dates"]["listed"], "published": version["dates"]["published"],
                "status": version["status"], "amends": version["amends"], "supersedes": version["supersedes"],
                "approval_citation": version["approval_citation"],
                "dispute_steps": dispute.get("steps") or [],
                "dispute_summary": dispute.get("summary"),
                "dispute_change": dispute_change.get("change"),
                "dispute_change_summary": dispute_change.get("summary"),
                "source": version["source"], "confidence": version["confidence"],
                "verification": version["verification"],
            })
    write_table("compact-history-versions", rows, list(rows[0]))
    changed = collections.Counter(r["dispute_change"] for r in rows if r["dispute_change"])
    print(f"{len(built)} histories, {len(rows)} versions; dispute clause changes {dict(changed)}")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "pairs" and len(sys.argv) == 4:
        pairs(pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]))
    elif command == "check" and len(sys.argv) == 4:
        check(pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]))
    elif command == "merge" and len(sys.argv) == 4:
        merge(pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]))
    else:
        sys.exit(__doc__)
