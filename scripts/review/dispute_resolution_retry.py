"""Second try at the nations whose dispute resolution search stayed partly done
(row 2 of the dataset gap audit; decision record 0025; first pass in
research/reviews/2026-11-22-dispute-resolution-coverage.md).

    python3 scripts/review/dispute_resolution_retry.py build --data FILE
    python3 scripts/review/dispute_resolution_retry.py apply

build    Reads the private work file FILE: for each nation, every place
         looked on Nov. 23, 2026 (web searches, archived copies fetched from
         the Wayback Machine by the "fetch archived copies" workflow, and the
         2022 Alaska Tribal Court Directory read in full), plus the
         candidates the lead session recorded from them. Writes
         research/reviews/2026-11-23-dispute-resolution-retry.json (searches
         and candidates), a CSV of the candidates with an empty
         lead_author_decision column, and a counts file. The work file holds
         only addresses, outcomes and the lead session's notes; fetched text
         stays private.

apply    Appends each nation's searches from the review file to its search log
         under research/search-logs/dispute-resolution/ (an entry already
         there with the same date, place and address is not added again),
         and sets the status: found when any search in the log found
         something; partly-searched when a place in this retry still failed
         (error, blocked, scanned and not read); none-found otherwise. It never
         removes an entry and never changes a profile. A nation that already
         holds a dispute resolution record has no search log and is skipped.
"""

import argparse
import collections
import csv
import json
import pathlib
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
TODAY = "2026-11-23"
SEARCHER = "Claude (AI assistant)"
REVIEW = ROOT / "research/reviews/2026-11-23-dispute-resolution-retry"
LOGS = ROOT / "research/search-logs/dispute-resolution"
FAILED = {"error", "blocked", "scanned-unreadable", "dead-link"}
COLUMNS = ["candidate_id", "nation", "profile", "region", "origin", "place_kind", "field", "kind", "name", "source", "summary",
           "evidence_url", "first_reader", "confidence", "verification", "note", "lead_author_decision"]


def letter(name):
    return name[0] if "a" <= name[0] <= "z" else "_other"


def profile_path(nation):
    return f"content/tribes/{letter(nation)}/{nation}.yaml"


def region_of(nation):
    data = yaml.safe_load((ROOT / profile_path(nation)).read_text())
    return (data.get("federal_administration") or {}).get("bureau_of_indian_affairs_region") or ""


def build(args):
    data = json.loads(pathlib.Path(args.data).read_text())
    searches = {}
    for nation, entries in sorted(data["entries"].items()):
        searches[nation] = [{"date": TODAY, "searched_by": SEARCHER, "method": e.get("method", "script"),
                             "place_kind": e["place_kind"], "address": e["address"],
                             **({"query": e["query"]} if e.get("query") else {}),
                             "outcome": e["outcome"], "reason": e["reason"],
                             **({"not_for_this_nation": True} if e.get("not_for_this_nation") else {})} for e in entries]
    candidates = []
    for c in data["candidates"]:
        candidates.append({"candidate_id": c["candidate_id"], "nation": c["nation"], "profile": profile_path(c["nation"]),
                           "region": region_of(c["nation"]), "origin": c["origin"], "place_kind": c["place_kind"],
                           "field": c["field"], "kind": c["kind"], "name": c["name"], "source": c.get("source", ""),
                           "summary": c["summary"], "evidence_url": c["evidence_url"], "first_reader": c["first_reader"],
                           "confidence": c["confidence"], "verification": c["verification"], "note": c.get("note", ""),
                           "lead_author_decision": ""})
        if c["nation"] not in searches:
            searches[c["nation"]] = []
        for e in c.get("log_entries", []):
            searches[c["nation"]].append({"date": TODAY, "searched_by": SEARCHER, "method": e.get("method", "script"),
                                          "place_kind": e["place_kind"], "address": e["address"], "query": e["query"],
                                          "outcome": e["outcome"], "reason": e["reason"]})
    for c in candidates:
        for s in searches[c["nation"]]:
            if s["outcome"] == "found" and s["address"] == c["evidence_url"]:
                s.setdefault("records", []).append(f"{REVIEW.relative_to(ROOT)}.json#{c['candidate_id']}")
    review = {"date": TODAY, "retried_nations": sorted(data["entries"]), "searches": searches, "candidates": candidates}
    REVIEW.with_suffix(".json").write_text(json.dumps(review, indent=1, ensure_ascii=False) + "\n")
    with open(REVIEW.with_suffix(".csv"), "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(candidates)
    outcomes = collections.Counter(s["outcome"] for entries in searches.values() for s in entries)
    counts = {"retried_nations": len(data["entries"]), "nations_with_searches": len(searches),
              "searches": sum(len(v) for v in searches.values()), "outcomes": dict(sorted(outcomes.items())),
              "methods": dict(collections.Counter(s["method"] for v in searches.values() for s in v)),
              "candidates": len(candidates), "candidates_by_confidence": dict(collections.Counter(c["confidence"] for c in candidates)),
              "candidates_by_kind": dict(collections.Counter(c["kind"] for c in candidates)),
              "nations_with_candidates": len({c["nation"] for c in candidates})}
    pathlib.Path(str(REVIEW) + "-counts.json").write_text(json.dumps(counts, indent=1) + "\n")
    print(json.dumps(counts))


def apply(args):
    review = json.loads(REVIEW.with_suffix(".json").read_text())
    retried = set(review["retried_nations"])
    changes = collections.Counter()
    after = collections.Counter()
    for nation, entries in sorted(review["searches"].items()):
        path = LOGS / letter(nation) / f"{nation}.yaml"
        if not path.exists():
            # Nations that already hold a dispute resolution record were not coverage targets and have no log.
            changes["no search log (profile already has a dispute resolution record)"] += 1
            continue
        log = yaml.safe_load(path.read_text())
        before = log["status"]
        seen = {(s["date"], s["place_kind"], s["address"]) for s in log["searches"]}
        added = [{k: v for k, v in s.items() if k != "not_for_this_nation"} for s in entries
                 if (s["date"], s["place_kind"], s["address"]) not in seen]
        log["searches"] += added
        log["last_searched"] = TODAY
        # A failed capture index query does not hold a nation back: the pages it would list were fetched directly.
        # A place that turned out to belong to another community does not either.
        failed = [s["address"] for s in entries if s["outcome"] in FAILED and "web.archive.org/cdx" not in s["address"]
                  and not s.get("not_for_this_nation")]
        if any(s["outcome"] == "found" for s in log["searches"]):
            retry_step = ("Lead author's review of the candidates in research/reviews/2026-11-23-dispute-resolution-retry.csv "
                          "(Gate 1) before any record goes into the profile.")
            if before == "found" and log.get("next_steps") and "2026-11-23" not in log["next_steps"]:
                retry_step = log["next_steps"] + " Also the candidates in research/reviews/2026-11-23-dispute-resolution-retry.csv."
            log["status"] = "found"
            log["next_steps"] = retry_step
        elif nation in retried and failed:
            log["status"] = "partly-searched"
            log["next_steps"] = ("Try again later, or open by hand in a browser: " + "; ".join(sorted(set(failed))[:6]) + ".")
        else:
            log["status"] = "none-found"
            log["next_steps"] = ("Ask the nation's court or government office whether it has a peacemaking, mediation or other "
                                 "dispute resolution program, and check law library holdings of its code.")
        ordered = {k: log[k] for k in ("profile", "topic", "status", "last_searched", "searches", "next_steps") if k in log}
        path.write_text(yaml.dump(ordered, sort_keys=False, allow_unicode=True, width=100), encoding="utf-8")
        changes[f"{before} -> {log['status']}"] += 1
        after[log["status"]] += 1
    counts_path = pathlib.Path(str(REVIEW) + "-counts.json")
    counts = json.loads(counts_path.read_text())
    counts["search_logs_changed"] = dict(sorted(changes.items()))
    counts["search_logs_after"] = dict(sorted(after.items()))
    counts_path.write_text(json.dumps(counts, indent=1) + "\n")
    print(json.dumps({"changes": changes, "after": after}))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    command = sub.add_parser("build")
    command.add_argument("--data", required=True)
    sub.add_parser("apply")
    args = parser.parse_args()
    {"build": build, "apply": apply}[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
