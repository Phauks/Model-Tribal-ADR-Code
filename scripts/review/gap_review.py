"""Merge the reviewers' verdicts from the Nov. 21, 2026 data gap review into
research/reviews/, and fill in `verification` on profile facts that have none.

    python3 scripts/review/gap_review.py merge WORK_DIRECTORY
    python3 scripts/review/gap_review.py levels [--check]
    python3 scripts/review/gap_review.py apply [--check]
    python3 scripts/review/gap_review.py rewrite-compacts [--check]

`merge` reads the reviewers' output in WORK_DIRECTORY (names/, compacts/,
courts/, levels/, as written by the briefs in research/reviews/briefs/) and
writes, for the lead author's review:

- research/reviews/2026-11-21-name-joins.{json,csv}: facts joined to a nation
  by name (gap audit row 7);
- research/reviews/2026-11-21-compact-clauses.{json,csv}: compact dispute
  clauses copied from another nation's compact (row 1);
- research/reviews/2026-11-21-court-listings.{json,csv}: courts listed from
  directories (row 11);
- research/reviews/2026-11-21-verification-levels.{json,csv}: the level given
  to each group of facts whose note does not say how it was checked;
- research/reviews/2026-11-21-data-gap-review-counts.json.

Every spreadsheet has an empty `lead_author_decision` column. `merge` never
edits a profile.

`levels` sets `verification` on every profile fact that has none, except
dispute resolution provisions (their level follows the lead author's
decisions on the provision pre-review). The level is the one the fact's own
note implies (`NOTE_LEVELS` in scripts/record_facts.py); failing that, the
level recorded for its group in 2026-11-21-verification-levels.json; failing
that, the fact is left alone. Only the `verification` key is added; nothing
else in a profile changes. With `--check` it reports what it would change.

`apply` makes the two clear fixes from the review that need no decision:

- a copied compact dispute clause that both reviewers, with high confidence,
  found the same in substance as the nation's own compact is cited to that
  compact instead (a new source record, unless one already has its address),
  with the reviewers' pinpoint; its summary is not changed;
- a court whose listed link no longer reaches it, where the review found the
  court's page on the nation's own site (fetched during the review), gets
  that page as its link, and its note keeps the listed link.

Everything else in the review waits for the lead author. With `--check` it
reports what it would change.

`rewrite-compacts` (Nov. 22, 2026, approved by the lead author) finishes gap
audit row 1 for the clauses that are clear:

- a copied compact dispute clause that both reviewers, with high confidence,
  found different from the nation's own compact gets the reviewers' proposed
  summary (`SUMMARY_OVERRIDES` where the wording needed fixing) and is cited to
  that compact with the reviewers' pinpoint;
- research/reviews/2026-11-22-compact-clauses-recheck.json, a third reading of
  the clauses the first review left undecided: rows with outcome `rewritten`
  get the third reading's summary, rows with outcome `repointed` keep their
  summary and are cited to the nation's own compact; rows with outcome `left`
  wait for the lead author.

Each changed fact's note says what was wrong with the copied summary
(`REWRITE_REASONS`, or the recheck row's `copied_text_problem`). The governing
document must already have a source record (matched by address); no source
record is created. With `--check` it reports what it would change.
"""

import collections
import csv
import urllib.parse
import re
import glob
import json
import pathlib
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "scripts" / "review"))
import record_facts  # noqa: E402
import name_matches  # noqa: E402

REVIEWS = ROOT / "research" / "reviews"
PREFIX = "2026-11-21-"
SKIPPED_SECTIONS = ("dispute_resolution.provisions",)


def read_arrays(pattern):
    found = []
    for path in sorted(glob.glob(str(pattern))):
        found.extend(json.loads(pathlib.Path(path).read_text(encoding="utf-8")))
    return found


def write(name, records, columns):
    (REVIEWS / f"{PREFIX}{name}.json").write_text(
        json.dumps(records, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    with open(REVIEWS / f"{PREFIX}{name}.csv", "w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(columns + ["lead_author_decision"])
        for record in records:
            row = []
            for column in columns:
                value = record.get(column)
                if isinstance(value, (list, dict)):
                    value = json.dumps(value, ensure_ascii=False)
                row.append("" if value is None else value)
            writer.writerow(row + [""])


# Source keys merged into another key (pull request #15) after the groups were
# drawn up: the group under the earlier key still applies.
EARLIER_KEYS = {
    "north-carolina-commission-of-indian-affairs-tribal-communities": "north-carolina-tribal-communities-2026",
    "revised-constitution-american-samoa-1967": "american-samoa-revised-constitution",
}


def group_key(section, source):
    if source.startswith("national-indian-law-library-"):
        source = "national-indian-law-library-*"
    elif source.startswith("university-of-oklahoma"):
        source = "university-of-oklahoma-*"
    return f"{section} | {source}"


# Groups where the lead session overrode the first-pass level, with the reason.
LEVEL_OVERRIDES = {
    "justice_institutions | national-indian-law-library-*": (
        "bulk-import",
        "A contact listing on a National Indian Law Library nation page: a directory entry. The court "
        "itself was not checked (see 2026-11-21-court-listings)."),
}


def merge_names(work):
    entries = name_matches.gather(ROOT)
    first = {v["pair_id"]: v for v in read_arrays(work / "names" / "out" / "*.json")}
    second = {v["pair_id"]: v for v in json.loads((work / "names" / "second-pass-output.json").read_text())}
    second.update({v["pair_id"]: v for v in read_arrays(work / "names" / "third" / "output-*.json")})
    pairs = json.loads((work / "names" / "pairs.json").read_text())
    pair_ids = {(p["label"], p["nation"]): p["pair_id"] for p in pairs}
    grouped = collections.OrderedDict()
    for entry in entries:
        key = (entry["label"], entry["profile"], entry["source"])
        record = grouped.setdefault(key, {
            "profile": entry["profile"], "nation": entry["nation"], "source": entry["source"],
            "label": entry["label"], "match": entry["match"], "facts": 0, "paths": []})
        record["facts"] += 1
        if entry["path"] not in record["paths"]:
            record["paths"].append(entry["path"])
    records = []
    for record in grouped.values():
        if record["match"] == "exact":
            record["verdict"] = "same"
            record["decided_by"] = "script (exact match after normalizing)"
        else:
            pair = pair_ids.get((record["label"], record["nation"]))
            one, two = first.get(pair), second.get(pair)
            record["pair_id"] = pair
            record["first_pass"] = one and one["verdict"]
            record["first_pass_reason"] = one and one["reason"]
            record["second_pass"] = two and two["verdict"]
            record["second_pass_reason"] = two and two["reason"]
            record["suggested_fix"] = two and two.get("suggested_fix")
            record["verdict"] = (two or one or {}).get("verdict")
            record["decided_by"] = "second pass" if two else "first pass"
        records.append(record)
    columns = ["profile", "nation", "source", "label", "match", "facts", "verdict", "decided_by",
               "first_pass", "first_pass_reason", "second_pass", "second_pass_reason", "suggested_fix", "paths"]
    write("name-joins", records, columns)
    return records


def merge_compacts(work):
    candidates = json.loads((work / "compacts" / "candidates.json").read_text())
    first = {v["item_id"]: v for v in read_arrays(work / "compacts" / "out2" / "*.json")}
    second = {v["item_id"]: v for v in read_arrays(work / "compacts" / "second" / "*.json")}
    records = []
    for number, item in enumerate(candidates, start=1):
        one, two = first.get(number, {}), second.get(number, {})
        final = two or one
        records.append({
            "item_id": number, "profile": item["profile"], "nation": item["name"], "state": item["state"],
            "current_summary": item["summary"], "copied_from": item["copied_from"],
            "documents_checked": len(item["documents"]),
            "verdict": final.get("verdict"), "confidence": final.get("confidence"),
            "governing_document": final.get("governing_document"), "locator": final.get("locator"),
            "quote": final.get("quote"), "differences": final.get("differences"),
            "proposed_summary": final.get("proposed_summary"), "note": final.get("note"),
            "first_pass": one.get("verdict"), "second_pass": two.get("verdict"),
            "passes_agree": (one.get("verdict") == two.get("verdict")) if one and two else None,
        })
    columns = ["item_id", "profile", "nation", "state", "verdict", "confidence", "passes_agree", "first_pass",
               "second_pass", "governing_document", "locator", "quote", "current_summary", "proposed_summary",
               "differences", "copied_from", "documents_checked", "note"]
    write("compact-clauses", records, columns)
    return records


def merge_courts(work):
    evidence = json.loads((work / "courts" / "evidence.json").read_text())
    verdicts = {(v["profile"], v["fact_number"]): v for v in read_arrays(work / "courts" / "out" / "*.json")}
    records = []
    for item in evidence:
        verdict = verdicts.get((item["profile"], item["fact_number"]), {})
        records.append({
            "profile": item["profile"], "nation": item["nation"], "source": item["source"], "kind": item["kind"],
            "name": item["name"], "listed_link": item["link"], "listed_as_of": item["as_of"],
            "verdict": verdict.get("verdict"), "evidence_url": verdict.get("evidence_url"),
            "name_on_page": verdict.get("name_on_page"), "working_link": verdict.get("working_link"),
            "reason": verdict.get("reason"),
            "pages_fetched": [{"url": p["url"], "status": p.get("status")} for p in item.get("pages", [])],
        })
    columns = ["profile", "nation", "source", "kind", "name", "verdict", "evidence_url", "name_on_page",
               "working_link", "listed_link", "listed_as_of", "reason", "pages_fetched"]
    write("court-listings", records, columns)
    return records


def merge_levels(work):
    groups = {g["group"]: g for g in json.loads((work / "levels" / "groups.json").read_text())}
    records = []
    for verdict in read_arrays(work / "levels" / "out" / "*.json"):
        group = groups[verdict["group"]]
        record = {"group": verdict["group"], "section": group["section"], "source": group["source"],
                  "facts": group["facts"], "profiles_citing_source": group["profiles_citing_source"],
                  "level": verdict["level"], "mixed": verdict.get("mixed"), "reason": verdict["reason"],
                  "decided_by": "first pass"}
        if verdict["group"] in LEVEL_OVERRIDES:
            record["level"], record["reason"] = LEVEL_OVERRIDES[verdict["group"]]
            record["decided_by"] = "lead session (overrode the first pass)"
        records.append(record)
    columns = ["group", "section", "source", "facts", "profiles_citing_source", "level", "mixed", "reason",
               "decided_by"]
    write("verification-levels", records, columns)
    return records


def count(records, *fields):
    return dict(collections.Counter(" / ".join(str(r.get(f)) for f in fields) for r in records).most_common())


def merge(work):
    names = merge_names(work)
    compacts = merge_compacts(work)
    courts = merge_courts(work)
    levels = merge_levels(work)
    counts = {
        "name_joins": {"pairs": len(names), "facts": sum(r["facts"] for r in names),
                       "by_match_and_verdict": count(names, "match", "verdict")},
        "compact_clauses": {"items": len(compacts), "by_verdict": count(compacts, "verdict"),
                            "by_verdict_and_confidence": count(compacts, "verdict", "confidence"),
                            "passes_agree": count(compacts, "passes_agree")},
        "court_listings": {"items": len(courts), "by_verdict": count(courts, "verdict"),
                           "by_source_and_verdict": count(
                               [dict(r, source=("national-indian-law-library-*"
                                                if r["source"].startswith("national-indian-law-library-")
                                                else r["source"])) for r in courts], "source", "verdict")},
        "verification_levels": {"groups": len(levels), "facts_by_level": dict(collections.Counter(
            {lv: sum(r["facts"] for r in levels if r["level"] == lv)
             for lv in record_facts.VERIFICATION_LEVELS}))},
    }
    (REVIEWS / f"{PREFIX}data-gap-review-counts.json").write_text(
        json.dumps(counts, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(counts, indent=1))


def with_level(fact, level):
    """The fact with `verification` placed right after `confidence`."""
    ordered = {}
    for key, value in fact.items():
        ordered[key] = value
        if key == "confidence":
            ordered["verification"] = level
    if "verification" not in ordered:
        ordered["verification"] = level
    return ordered


def fill(value, path, decide, changes):
    if isinstance(value, dict):
        if isinstance(value.get("source"), str) and not value.get("verification"):
            level = decide(path, value)
            if level:
                changes[level] += 1
                value = with_level(value, level)
        return {k: fill(v, f"{path}.{k}" if path else k, decide, changes) for k, v in value.items()}
    if isinstance(value, list):
        return [fill(item, path, decide, changes) for item in value]
    return value


def levels(check):
    tree = record_facts.Tree(ROOT)
    bulk = tree.bulk_sources()
    groups = {r["group"]: r["level"] for r in json.loads(
        (REVIEWS / f"{PREFIX}verification-levels.json").read_text(encoding="utf-8"))}
    changes, missing = collections.Counter(), collections.Counter()

    def decide(path, fact):
        section = record_facts.section_of(path)
        if section in SKIPPED_SECTIONS:
            return None
        source = fact["source"]
        level = (record_facts.level_from_note(fact, bulk) or groups.get(group_key(section, source))
                 or groups.get(group_key(section, EARLIER_KEYS.get(source, source))))
        if not level:
            missing[group_key(section, fact["source"])] += 1
        return level

    files = 0
    for relative, profile in tree.profiles.items():
        updated = {}
        before = sum(changes.values())
        for key, value in profile.items():
            updated[key] = value if key in ("id", "entity_type", "review", "sensitivity") else fill(
                value, key, decide, changes)
        if sum(changes.values()) != before:
            files += 1
            if not check:
                (ROOT / relative).write_text(
                    yaml.safe_dump(updated, allow_unicode=True, sort_keys=False, width=100), encoding="utf-8")
    print(f"{'would set' if check else 'set'} verification on {sum(changes.values())} facts in {files} profiles: "
          + ", ".join(f"{n} {lv}" for lv, n in changes.most_common()))
    if missing:
        print(f"left {sum(missing.values())} facts without a level (no note wording and no group level): "
              + ", ".join(f"{g} ({n})" for g, n in missing.most_common(10)))


REVIEW_DATE = "2026-11-21"
SESSION = "2026-11-21-data-gap-review"


def dump(path, record):
    path.write_text(yaml.safe_dump(record, allow_unicode=True, sort_keys=False, width=100), encoding="utf-8")


def compact_source(document, state, nation):
    year, month, day = (int(part) for part in document["date"].split("-"))
    slug = re.sub(r"[^a-z0-9]+", "-", nation.lower().replace("'", "")).strip("-")[:40].strip("-")
    return {
        "key": f"compact-{state.lower()}-{slug}-{year}",
        "kind": "other",
        "citation": {
            "type": "document",
            "title": f"{document['title']} (document posted by the Office of Indian Gaming)",
            "author": [{"literal": "Parties to the compact: the named Native nation and the State; posted by "
                                   "U.S. Department of the Interior, Office of Indian Gaming"}],
            "container-title": "Indian Affairs (bia.gov), Gaming Compacts list",
            "URL": document["link"],
            "issued": {"date-parts": [[year, month, day]]},
            "accessed": {"date-parts": [[2026, 11, 21]]},
        },
        "original_link": document["link"],
        "retrieved": REVIEW_DATE,
        "archives": [],
        "history": {"status": "live", "last_checked": REVIEW_DATE},
        "rights": {"status": "no-permission-needed", "basis": "fact-only",
                   "basis_note": "Only facts are recorded from this source; it is cited and linked, not quoted "
                                 "or reproduced.",
                   "redistribution": False},
        "found_in": [SESSION],
        "notes": "Compact PDF downloaded with curl; text extracted with pdftotext and the dispute resolution "
                 "section read in the data gap review. Date is the date shown in the Office of Indian Gaming list.",
    }


def repoint_compact(fact, row, key):
    status = re.search(r"Status copied from .*", str(fact.get("note", "")))
    fact["source"] = key
    fact["dispute_resolution_locator"] = row["locator"]
    fact["locator"] = row["locator"]
    fact["confidence"] = "high"
    fact["verification"] = "read-in-full"
    fact["as_of"] = row["governing_document"]["date"]
    fact["note"] = (f"Checked on {REVIEW_DATE} against this nation's own compact, which the summary was first "
                    f"copied from {row['copied_from']} without reading; two reviewers found the clause the same in "
                    f"substance (research/reviews/{PREFIX}compact-clauses.json, item {row['item_id']})."
                    + (f" {status.group(0)}" if status else ""))


def apply(check):
    tree = record_facts.Tree(ROOT)
    by_link = {}
    for key, source in tree.sources.items():
        for link in record_facts.source_links(source):
            by_link[link] = key
    compacts = [r for r in json.loads((REVIEWS / f"{PREFIX}compact-clauses.json").read_text(encoding="utf-8"))
                if r["verdict"] == "same" and r["confidence"] == "high" and r["passes_agree"]]
    courts = [r for r in json.loads((REVIEWS / f"{PREFIX}court-listings.json").read_text(encoding="utf-8"))
              if r["verdict"] == "link-dead-court-found" and r["working_link"]
              and record_facts.normalized_link(r["working_link"]) in
              {record_facts.normalized_link(p["url"]) for p in r["pages_fetched"] if p.get("status") == 200}]
    new_sources, changed, skipped = {}, set(), []

    for row in compacts:
        profile = tree.profiles[row["profile"]]
        matches = [f for f in profile.get("gaming", {}).get("compacts", [])
                   if f.get("state") == row["state"] and "nation-specific text not checked" in str(f.get("note", ""))]
        if len(matches) != 1:
            skipped.append(f"compact item {row['item_id']}: {len(matches)} matching facts")
            continue
        document = row["governing_document"]
        key = by_link.get(record_facts.normalized_link(document["link"]))
        if not key:
            source = compact_source(document, row["state"], row["nation"])
            key = source["key"]
            if key in tree.sources or (key in new_sources and new_sources[key]["original_link"] != document["link"]):
                skipped.append(f"compact item {row['item_id']}: key {key} already used for another document")
                continue
            new_sources[key] = source
            by_link[record_facts.normalized_link(document["link"])] = key
        repoint_compact(matches[0], row, key)
        changed.add(row["profile"])

    court_count = 0
    for row in courts:
        profile = tree.profiles[row["profile"]]
        matches = [f for f in profile.get("justice_institutions", [])
                   if f["source"] == row["source"] and f.get("name") == row["name"]
                   and f.get("link") == row["listed_link"]]
        if len(matches) != 1:
            skipped.append(f"court {row['profile']} {row['name']}: {len(matches)} matching facts")
            continue
        fact = matches[0]
        fact["link"] = row["working_link"]
        moved = (f"The listed link ({row['listed_link']}) no longer reached the court on {REVIEW_DATE}; the link "
                 f"is the court's page on the nation's own site, found in the data gap review "
                 f"(research/reviews/{PREFIX}court-listings.json).")
        fact["note"] = f"{fact['note']} {moved}" if fact.get("note") else moved
        court_count += 1
        changed.add(row["profile"])

    if not check:
        for key, source in new_sources.items():
            dump(ROOT / "content" / "sources" / key[0] / f"{key}.yaml", source)
        for relative in changed:
            profile = {k: v for k, v in tree.profiles[relative].items() if not k.startswith("_")}
            dump(ROOT / relative, profile)
    repointed = sum(1 for r in compacts) - sum(1 for s in skipped if s.startswith("compact"))
    print(f"{'would repoint' if check else 'repointed'} {repointed} compact clauses ({len(new_sources)} new source "
          f"records) and {'would relink' if check else 'relinked'} {court_count} courts in {len(changed)} profiles")
    for line in skipped:
        print(f"skipped {line}")


REWRITE_DATE = "2026-11-22"
RECHECK = "2026-11-22-compact-clauses-recheck"

_CA_ARB = "it left out the optional arbitration step that comes before court"
_CA_STATE_COURT = _CA_ARB + " and limited the state-court route to cases the federal court cannot hear"
_CA_2000 = "it gave the newer compacts' written-response and meeting deadlines and left out the arbitration step"
_WA_OLD = ("it described the newer Washington clause (meeting within 20 business days, mediation and arbitration only "
           "by agreement, court after mediation), but this compact has a 10-day meeting and lets either party take the "
           "dispute to final arbitration")
_WI_1992 = "it described the 1992 compact's clause, which a later amendment replaced"
_OK_2020 = ("it described the 2004-05 model compact's arbitration, which this 2020 compact replaced with mediation "
            "followed by federal court")
_SECRETARIAL = ("it described a tribe-state process of notice, meeting and court that these Secretarial Procedures do "
                "not contain")

# What was wrong with each copied summary, by item of 2026-11-21-compact-clauses.json.
REWRITE_REASONS = {
    **{i: _CA_ARB for i in (2, 8, 12, 16, 18, 49, 53, 72, 77, 82, 95, 110, 117, 118, 126, 135, 137, 140, 167, 189,
                            196, 212, 214, 230, 232, 233, 235, 236, 241, 245, 247, 252, 253, 254)},
    **{i: _CA_STATE_COURT for i in (45, 59, 62, 67, 86, 143, 170)},
    **{i: _CA_2000 for i in (76, 108, 113)},
    **{i: _WA_OLD for i in (103, 106, 119, 124)},
    **{i: _WI_1992 for i in (7, 57, 70, 97, 98, 132, 171, 204)},
    **{i: _OK_2020 for i in (33, 89, 133, 237)},
    39: "it named only a state court as the fallback forum, where the clause also allows a Tribal court",
    40: "it required 90 days to pass before suit, a wait the clause does not have",
    43: ("it gave a 30-day meeting and a 90-day wait, where the clause sets a 20-day meeting, allows mediation or "
         "non-binding arbitration before court and has a separate expedited process"),
    56: ("it had the arbitration board also decide license-suitability findings, where this compact gives the board "
         "only gaming device disputes"),
    131: ("it gave a 14-day meeting, three arbitrators and no money damages, where the clause gives five days, one "
          "arbitrator from an agreed list and relief in law or equity"),
    154: "it limited the procedure to violations found within two years, a limit this clause does not have",
    157: ("it gave a two-year limit and a 20-day notice period, where this clause has no time limit, a 30-day meeting "
          "and 90 days before a notice to cease"),
    175: _SECRETARIAL,
    180: "it added mediation and American Arbitration Association rules that the clause does not have",
    198: ("it gave other deadlines, arbitrators chosen by the American Arbitration Association and no court review, "
          "where the compact gives 10 and 30 days, arbitrators chosen by the parties and federal court review"),
    240: ("it said the arbitrators may enjoin conduct and left out that arbitration binds both parties and bars a court "
          "case"),
    242: ("it gave 90 days to cure, a Washoe County federal venue, limited relief and a limited immunity waiver, where "
          "this compact gives 60 days and any lawful remedy in any competent court"),
    246: "it added mediation and American Arbitration Association rules that Section 20 does not have",
}

# Proposed summaries whose wording had to change before going into a profile.
SUMMARY_OVERRIDES = {
    57: ("Disputes under the Compact, including claims that a provision is invalid, that a party has failed to "
         "comply, or about interpretation, are resolved by binding arbitration under the Rules for Non-Administered "
         "Arbitration of the International Institute for Conflict Prevention and Resolution (using a last-best-offer "
         "format unless a party opts out) unless the parties agree to negotiation, mediation or court, and listed "
         "disputes go to a court of competent jurisdiction."),
    175: ("These Secretarial Procedures, issued by the Secretary of the Interior in place of a tribal-state compact, "
          "set out no dispute resolution process between the Tribe and the State; their dispute resolution section "
          "(Sec. 9.0.1) says only that National Indian Gaming Commission enforcement must be consistent with the "
          "Indian Gaming Regulatory Act and Commission regulations and that Commission decisions or actions are not "
          "subject to arbitration."),
}


def compact_note(fact, row, review, rewritten, reason=None, extra=None):
    status = re.search(r"Status copied from .*", str(fact.get("note", "")))
    document = row["governing_document"]
    kind = "Secretarial Procedures" if "Secretarial Procedures" in document["title"] else "compact"
    if rewritten:
        note = (f"Rewritten on {REWRITE_DATE} from this nation's own {kind} (data gap review item {row['item_id']}, "
                f"research/reviews/{review}.json); the summary had been copied from {row['copied_from']} without "
                f"reading, and {reason}.")
    else:
        note = (f"Checked on {REWRITE_DATE} against this nation's own {kind}, which the summary was first copied from "
                f"{row['copied_from']} without reading; a third reading found the clause the same in substance "
                f"(research/reviews/{review}.json, item {row['item_id']}).")
    for part in (extra, status.group(0) if status else None):
        if part:
            note += f" {part}"
    return note


def rewrite_compacts(check):
    tree = record_facts.Tree(ROOT)
    by_link = {}
    for key, source in tree.sources.items():
        for link in record_facts.source_links(source):
            by_link.setdefault(link, set()).add(key)
            by_link.setdefault(urllib.parse.unquote(link).lower(), set()).add(key)

    def source_for(link):
        normalized = record_facts.normalized_link(link)
        keys = by_link.get(normalized) or by_link.get(urllib.parse.unquote(normalized).lower()) or set()
        return next(iter(keys)) if len(keys) == 1 else None

    first = [(r, f"{PREFIX}compact-clauses", True, REWRITE_REASONS.get(r["item_id"]), None)
             for r in json.loads((REVIEWS / f"{PREFIX}compact-clauses.json").read_text(encoding="utf-8"))
             if r["verdict"] == "differs" and r["confidence"] == "high" and r["passes_agree"]]
    recheck = [(r, RECHECK, r["outcome"] == "rewritten", r["copied_text_problem"], r["note"])
               for r in json.loads((REVIEWS / f"{RECHECK}.json").read_text(encoding="utf-8"))
               if r["outcome"] in ("rewritten", "repointed")]
    changed, skipped, counts = set(), [], collections.Counter()
    for row, review, rewritten, reason, extra in first + recheck:
        item = f"{review} item {row['item_id']}"
        profile = tree.profiles[row["profile"]]
        matches = [f for f in profile.get("gaming", {}).get("compacts", [])
                   if f.get("state") == row["state"] and "nation-specific text not checked" in str(f.get("note", ""))]
        key = source_for(row["governing_document"]["link"])
        if len(matches) != 1 or not key or (rewritten and not reason):
            skipped.append(f"{item}: {len(matches)} matching facts, source {key}, reason {bool(reason)}")
            continue
        fact = matches[0]
        note = compact_note(fact, row, review, rewritten, reason, extra)
        if rewritten:
            overrides = SUMMARY_OVERRIDES if review != RECHECK else {}
            fact["dispute_resolution_summary"] = overrides.get(row["item_id"], row["proposed_summary"])
        fact["source"] = key
        fact["dispute_resolution_locator"] = row["locator"]
        fact["locator"] = row["locator"]
        fact["confidence"] = "high"
        fact["verification"] = "read-in-full"
        fact["as_of"] = row["governing_document"]["date"]
        fact["note"] = note
        counts["rewrote" if rewritten else "repointed"] += 1
        changed.add(row["profile"])

    if not check:
        for relative in changed:
            profile = {k: v for k, v in tree.profiles[relative].items() if not k.startswith("_")}
            dump(ROOT / relative, profile)
    print(f"{'would rewrite' if check else 'rewrote'} {counts['rewrote']} compact clauses and "
          f"{'would repoint' if check else 'repointed'} {counts['repointed']} in {len(changed)} profiles")
    for line in skipped:
        print(f"skipped {line}")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "merge":
        merge(pathlib.Path(sys.argv[2]))
    elif len(sys.argv) in (2, 3) and sys.argv[1] == "levels":
        levels(check="--check" in sys.argv)
    elif len(sys.argv) in (2, 3) and sys.argv[1] == "apply":
        apply(check="--check" in sys.argv)
    elif len(sys.argv) in (2, 3) and sys.argv[1] == "rewrite-compacts":
        rewrite_compacts(check="--check" in sys.argv)
    else:
        sys.exit(__doc__)
