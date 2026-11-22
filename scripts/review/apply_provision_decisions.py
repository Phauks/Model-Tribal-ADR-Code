"""Apply the lead author's Gate 1 decisions on the provision pre-review.

On Nov. 22, 2026 the lead author accepted the pre-review's recommendations
(`research/reviews/2026-11-21-provision-pre-review.json`) and answered its
scope question: diversion to a consensual process and restorative justice
stay in the research base (decision record 0027). This script applies that to
the Native nation profiles and records the decision on every pre-review row.

The pre-review named records by profile and position. Positions have changed
since (decision records 0015 and 0016), so each row is matched again:

- a bulk database row to the `database_listings` entry with the same
  `locator` (the database entry's address), anywhere in the profiles;
- any other row to the `provisions` entry with the same title, citation and
  link (ignoring "www."), preferring the same profile, in order.

What each verdict does:

- drop-candidate: the record is removed, except in the restorative-sentencing
  category, which the scope answer keeps.
- merge-duplicate: the record is removed; the record it repeats stays. When a
  provision repeats a database listing, the provision stays and the listing
  goes, since a listing is only a lead (decision record 0015).
- keep, keep-relabel, scope-question: the record stays. A relabel changes a
  provision's `kind` only when the suggested kind is one of the schema's
  suggested terms and differs from the current one; other relabel notes
  (titles, citations, new terms) are left for the reading pass.
- check-source: the record stays unchanged until its source is pulled.

Surviving provisions without a `verification` level get one from the
pre-review's evidence tier: text read gives `read-in-full`, a section title
gives `title-only`. Listings already carry `bulk-import`.

Usage: python3 scripts/review/apply_provision_decisions.py [--check]
"""

import argparse
import collections
import csv
import glob
import json
import re
import sys

import yaml

REVIEW = "research/reviews/2026-11-21-provision-pre-review"
DECIDED = "2026-11-22"
SUGGESTED_KINDS = {"peacemaking", "mediation", "arbitration", "traditional-dispute-resolution", "other"}
TIER_LEVEL = {"text_read": "read-in-full", "section_title_only": "title-only"}
# Replacement characters left by an encoding error in two profiles' code titles.
REPLACEMENTS = {
    "kalispel-indian-community-of-the-kalispel-reservation": ("CHAPTER 22 � ARBITRATION", "CHAPTER 22 – ARBITRATION"),
    "menominee-indian-tribe-of-wisconsin": ("� 15-", "§ 15-"),
}


def dump(record):
    return yaml.safe_dump(record, allow_unicode=True, sort_keys=False, width=100)


def norm_link(link):
    return (link or "").replace("://www.", "://")


def norm_text(text):
    """Ignore a leading "Sec." or "Section", which a later cleanup removed from some titles."""
    return re.sub(r"^(sec\.|section)\s+", "", (text or "").strip(), flags=re.IGNORECASE)


def provision_key(record):
    return (norm_text(record.get("title")), norm_text(record.get("citation")), norm_link(record.get("link")))


OVERRIDES = {}


def plan_cross_tier(rows):
    """Keep a provision that repeats a database listing, and remove the listing.

    A listing is a lead, not a provision (decision record 0015), so when the
    pre-review paired a provision with a listing, the provision is the record to
    keep. Where several provisions repeat the same listing, the first stays.
    """
    by_id = {row["id"]: row for row in rows}
    seen = {}
    for row in rows:
        review = row["pre_review"]
        target = by_id.get(review.get("duplicate_of") or "")
        if review["verdict"] != "merge-duplicate" or row["tier"] == "bulk_database_record" or not target:
            continue
        if target["tier"] != "bulk_database_record":
            continue
        if target["id"] in seen:
            OVERRIDES[row["id"]] = ("remove", f"accepted: removed as a duplicate of {seen[target['id']]}")
            continue
        seen[target["id"]] = row["id"]
        OVERRIDES[row["id"]] = ("keep", f"kept: the provision stays and the database listing it repeats ({target['id']}) is removed")
        OVERRIDES[target["id"]] = ("remove", f"removed: the same law is recorded as provision {row['id']}")


def decide(row):
    if row["id"] in OVERRIDES:
        return OVERRIDES[row["id"]]
    verdict = row["pre_review"]["verdict"]
    category = row["pre_review"]["practice_category"]
    if verdict == "drop-candidate":
        if category == "restorative-sentencing":
            return "keep", "kept: restorative justice is in scope (decision record 0027)"
        return "remove", "accepted: removed, not dispute resolution"
    if verdict == "merge-duplicate":
        return "remove", f"accepted: removed as a duplicate of {row['pre_review']['duplicate_of']}"
    if verdict == "scope-question":
        return "keep", "kept: diversion to a consensual process and restorative justice are in scope (decision record 0027)"
    if verdict == "check-source":
        return "keep", "deferred: unchanged until the source is pulled (documents-to-get.md)"
    return "keep", "accepted: kept"


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="report what would change without writing")
    args = parser.parse_args()

    profiles = {}
    for path in sorted(glob.glob("content/tribes/*/*.yaml")):
        with open(path, encoding="utf-8") as handle:
            text = handle.read()
        record = yaml.safe_load(text)
        profiles[record["id"]] = {"path": path, "record": record, "text": text}

    listings = collections.defaultdict(list)
    provisions = collections.defaultdict(list)
    for profile_id, entry in profiles.items():
        section = entry["record"].get("dispute_resolution") or {}
        for index, item in enumerate(section.get("database_listings") or []):
            listings[item.get("locator")].append((profile_id, index))
        for index, item in enumerate(section.get("provisions") or []):
            provisions[provision_key(item)].append((profile_id, index))

    with open(REVIEW + ".json", encoding="utf-8") as handle:
        rows = json.load(handle)

    plan_cross_tier(rows)
    remove = collections.defaultdict(set)   # (profile_id, field) -> indexes
    tally = collections.Counter()
    unmatched = []
    relabels = []
    # Rows that keep a record claim their match first, so that a duplicate row
    # never takes the one record left after an earlier cleanup merged the pair.
    for row in sorted(rows, key=lambda r: decide(r)[0] == "remove"):
        action, decision = decide(row)
        if row["tier"] == "bulk_database_record":
            field, candidates = "database_listings", listings.get(row["record"].get("locator"), [])
        else:
            field, candidates = "provisions", provisions.get(provision_key(row["record"]), [])
        same = [c for c in candidates if c[0] == row["id"].split("#")[0]]
        match = (same or candidates)[:1]
        if not match:
            unmatched.append(row["id"])
            row["lead_author_decision"] = decision + "; record no longer in the profiles"
            continue
        target = match[0]
        candidates.remove(target)
        profile_id, index = target
        item = profiles[profile_id]["record"]["dispute_resolution"][field][index]
        if action == "remove":
            remove[(profile_id, field)].add(index)
        elif field == "provisions":
            suggested = row["pre_review"].get("suggested_kind")
            if row["pre_review"]["verdict"] == "keep-relabel" and suggested in SUGGESTED_KINDS and suggested != item.get("kind"):
                relabels.append((row["id"], item.get("kind"), suggested))
                item["kind"] = suggested
                decision = f"accepted: kept, kind changed from {relabels[-1][1]} to {suggested}"
            if "verification" not in item and row["tier"] in TIER_LEVEL:
                ordered = {}
                for key, value in item.items():
                    if key == "as_of":
                        ordered["verification"] = TIER_LEVEL[row["tier"]]
                    ordered[key] = value
                ordered.setdefault("verification", TIER_LEVEL[row["tier"]])
                item.clear()
                item.update(ordered)
                tally["verification set"] += 1
        row["lead_author_decision"] = f"{DECIDED} {decision}"
        if profile_id != row["id"].split("#")[0]:
            row["lead_author_decision"] += f" (now in {profile_id})"
        tally[f"{field}: {action}"] += 1

    for (profile_id, field), indexes in remove.items():
        section = profiles[profile_id]["record"]["dispute_resolution"]
        section[field] = [item for index, item in enumerate(section[field]) if index not in indexes]
        if not section[field]:
            del section[field]

    changed = []
    for profile_id, entry in profiles.items():
        text = dump(entry["record"])
        if profile_id in REPLACEMENTS:
            old, new = REPLACEMENTS[profile_id]
            text = text.replace(old, new)
        if text != entry["text"] and dump(yaml.safe_load(entry["text"])) != text:
            changed.append((entry["path"], text))

    print(f"profiles changed: {len(changed)}")
    for key, count in sorted(tally.items()):
        print(f"{key}: {count}")
    print(f"kinds changed: {len(relabels)}")
    print(f"rows with no matching record: {len(unmatched)} {unmatched[:10]}")
    if args.check:
        return 0

    for path, text in changed:
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(text)
    with open(REVIEW + ".json", "w", encoding="utf-8") as handle:
        json.dump(rows, handle, ensure_ascii=False, indent=1)
        handle.write("\n")
    with open(REVIEW + ".csv", encoding="utf-8", newline="") as handle:
        table = list(csv.DictReader(handle))
        fields = list(table[0].keys())
    decisions = {row["id"]: row["lead_author_decision"] for row in rows}
    for line in table:
        line["lead_author_decision"] = decisions.get(line["id"]) or ""
    with open(REVIEW + ".csv", "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(table)
    return 0


if __name__ == "__main__":
    sys.exit(main())
