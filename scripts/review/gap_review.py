"""Merge the reviewers' verdicts from the Nov. 21, 2026 data gap review into
research/reviews/, and fill in `verification` on profile facts that have none.

    python3 scripts/review/gap_review.py merge WORK_DIRECTORY
    python3 scripts/review/gap_review.py levels [--check]

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
"""

import collections
import csv
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


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "merge":
        merge(pathlib.Path(sys.argv[2]))
    elif len(sys.argv) in (2, 3) and sys.argv[1] == "levels":
        levels(check="--check" in sys.argv)
    else:
        sys.exit(__doc__)
