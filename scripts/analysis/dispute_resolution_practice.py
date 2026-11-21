"""Summarize the dispute resolution practice recorded in the Native nation profiles.

Reads every profile in content/tribes/ and every source record in
content/sources/, and writes counts to a JSON file that the provisional
analysis in research/analyses/ quotes. Nothing in content/ is changed.

The counts describe what the project's sources document. They are not a
measure of what any nation practices: a nation with no record may simply not
publish its law online, or may not appear in the sources searched.

Run from the repository root:
    python3 scripts/analysis/dispute_resolution_practice.py \
        research/analyses/2026-11-21-dispute-resolution-practice.json
Requires the packages in scripts/requirements.txt.
"""

import collections
import json
import pathlib
import re
import sys

import yaml

ROOT = pathlib.Path(".")
BULK_DATABASE_SOURCE = "national-center-on-restorative-justice-restorative-justice-tribal-laws-database"
SECTIONS = ["forums", "provisions", "clauses", "training_programs", "published_materials", "database_listings"]

# Recurring design features, found by keyword in the description,
# relationship_to_court, enforcement and participation fields of each forum.
# The keywords are the project's own coding choice (project analysis).
FORUM_FEATURES = {
    "agreement_entered_or_enforced_by_court": r"judgment|court order|order of the|entered|endorsed|incorporat|stipulation|confirmed",
    "consent_of_parties_required_for_referral_or_transfer": r"consent|agree|stipulation|concurrence",
    "case_returns_to_court_if_unresolved": r"return|continue in (tribal )?court|not precluded|proceed|back to",
    "sanction_for_failure_to_attend_or_comply": r"contempt|fine",
    "neutral_may_decide_only_with_consent": r"decide a matter only|decide .*only (if|with|on)|agreed arbitration|issue a decision",
    "no_appeal_from_agreement_or_decision": r"no appeal|not appealable|non-appealable|without appeal|cannot appeal|may not be appealed",
    "domestic_violence_addressed": r"domestic",
    "confidentiality": r"confidential",
    "attorneys_excluded": r"no attorney|attorneys or lay|no attorneys",
}

COMPACT_TERMS = {
    "notice_and_meeting_or_negotiation": r"meet|confer|negotiat",
    "arbitration": r"arbitrat",
    "mediation": r"mediat",
    "federal_court": r"federal (district )?court|United States District Court",
    "state_court": r"state court",
    "sovereign_immunity_or_waiver": r"immunit|waive",
    "american_arbitration_association_rules": r"American Arbitration|AAA",
}


def load_yaml_files(pattern):
    return [yaml.safe_load(path.read_text(encoding="utf-8")) for path in sorted(ROOT.glob(pattern))]


def evidence_tier(item):
    """How closely the underlying text was read, from the fact's own note.

    Entries in `database_listings` are bulk database records by definition
    (decision record 0015); older notes named the tier in words.
    """
    note = item.get("note") or ""
    if item.get("verification") == "bulk-import" or "Bulk record from the NCORJ" in note:
        return "bulk_database_record"
    lowered = note.lower()
    if "section title" in lowered or "section headings" in lowered or "section or chapter title" in lowered:
        return "section_title_only"
    return "text_read"


def recognition_label(profile):
    if profile.get("part_of"):
        return "component-of-" + profile["part_of"]
    kinds = sorted({entry["type"] for entry in profile.get("recognition", [])})
    return "+".join(kinds) or "none"


def bureau_region(profile):
    return (profile.get("federal_administration") or {}).get("bureau_of_indian_affairs_region") or "none"


def as_of_period(item):
    year = str(item.get("as_of", ""))[:4]
    if not year:
        return "undated"
    if year < "2000":
        return "before_2000"
    if year < "2010":
        return "2000_to_2009"
    if year < "2020":
        return "2010_to_2019"
    return "2020_or_later"


def database_taxonomy(value):
    return [part.strip() for part in (value or "").split(";") if part.strip()]


def counter_to_sorted_dictionary(counter):
    return dict(sorted(counter.items(), key=lambda pair: (-pair[1], str(pair[0]))))


def main(output_path):
    profiles = load_yaml_files("content/tribes/*/*.yaml")
    sources = load_yaml_files("content/sources/*/*.yaml")
    method_identifiers = sorted(path.stem for path in ROOT.glob("content/methods/*.yaml"))

    with_practice = [profile for profile in profiles if profile.get("dispute_resolution")]
    # Component bands (part_of) are counted apart so that a recognized entity is not counted twice.
    federal = [
        profile for profile in profiles
        if any(entry["type"] == "federal" for entry in profile.get("recognition", [])) and not profile.get("part_of")
    ]

    result = {
        "profiles": len(profiles),
        "profiles_with_any_dispute_resolution_record": len(with_practice),
        "federally_recognized_profiles": len(federal),
        "federally_recognized_profiles_with_any_record": sum(1 for profile in federal if profile.get("dispute_resolution")),
        "component_profiles": sum(1 for profile in profiles if profile.get("part_of")),
        "component_profiles_with_any_record": sum(1 for profile in with_practice if profile.get("part_of")),
        "profiles_with_a_record_besides_database_listings": sum(
            1 for profile in with_practice if any(key != "database_listings" for key in profile["dispute_resolution"])
        ),
    }

    # Coverage by recognition and by Bureau of Indian Affairs region.
    all_by_recognition = collections.Counter(recognition_label(profile) for profile in profiles)
    practice_by_recognition = collections.Counter(recognition_label(profile) for profile in with_practice)
    result["coverage_by_recognition"] = {
        label: {"profiles": count, "with_record": practice_by_recognition[label]}
        for label, count in counter_to_sorted_dictionary(all_by_recognition).items()
    }
    region_rows = {}
    for profile in federal:
        row = region_rows.setdefault(bureau_region(profile), {"federally_recognized": 0, "with_any_record": 0, "with_forum": 0})
        row["federally_recognized"] += 1
        practice = profile.get("dispute_resolution") or {}
        row["with_any_record"] += bool(practice)
        row["with_forum"] += bool(practice.get("forums"))
    result["coverage_by_bureau_region"] = dict(sorted(region_rows.items()))

    # Each section: items, nations, kinds, confidence, dates.
    sections = {}
    for section in SECTIONS:
        items = [(profile, item) for profile in with_practice for item in profile["dispute_resolution"].get(section, [])]
        sections[section] = {
            "items": len(items),
            "nations": len({profile["id"] for profile, _ in items}),
            "kinds": counter_to_sorted_dictionary(collections.Counter(str(item.get("kind")) for _, item in items)),
            "confidence": counter_to_sorted_dictionary(collections.Counter(item.get("confidence") for _, item in items)),
            "as_of_period": counter_to_sorted_dictionary(collections.Counter(as_of_period(item) for _, item in items)),
        }
    result["sections"] = sections

    # Provisions by evidence tier.
    provisions = [(profile, item) for profile in with_practice for item in profile["dispute_resolution"].get("provisions", [])]
    result["provisions_by_evidence_tier"] = counter_to_sorted_dictionary(collections.Counter(evidence_tier(item) for _, item in provisions))
    result["provisions_by_evidence_tier_and_kind"] = counter_to_sorted_dictionary(
        collections.Counter(f"{evidence_tier(item)}/{item.get('kind')}" for _, item in provisions)
    )
    result["provisions_with_summary"] = sum(1 for _, item in provisions if item.get("summary"))

    # Nations by the strongest evidence behind any of their records.
    strongest = collections.Counter()
    for profile in with_practice:
        practice = profile["dispute_resolution"]
        tiers = {evidence_tier(item) for section in ("provisions", "database_listings") for item in practice.get(section, [])}
        curated = [section for section in SECTIONS if section not in ("provisions", "database_listings")]
        if any(practice.get(section) for section in curated) or "text_read" in tiers:
            strongest["has_text_read_or_curated_record"] += 1
        elif tiers == {"bulk_database_record"}:
            strongest["bulk_database_records_only"] += 1
        elif tiers == {"section_title_only"}:
            strongest["section_titles_only"] += 1
        else:
            strongest["bulk_database_records_and_section_titles_only"] += 1
    result["nations_by_strongest_evidence"] = counter_to_sorted_dictionary(strongest)

    # The bulk database's own taxonomy, now kept in database_listings.
    listings = [(profile, item) for profile in with_practice for item in profile["dispute_resolution"].get("database_listings", [])]
    areas, phases = collections.Counter(), collections.Counter()
    for _, item in listings:
        areas.update(database_taxonomy(item.get("practice_area")))
        phases.update(database_taxonomy(item.get("phase")))
    result["bulk_database_practice_area"] = counter_to_sorted_dictionary(areas)
    result["bulk_database_phase_top"] = dict(list(counter_to_sorted_dictionary(phases).items())[:6])

    # Forums in detail.
    forums = [(profile, item) for profile in with_practice for item in profile["dispute_resolution"].get("forums", [])]
    nations_by_kind = collections.defaultdict(set)
    for profile, item in forums:
        nations_by_kind[item["kind"]].add(profile["id"])
    result["forums"] = {
        "nations_by_kind": {kind: len(ids) for kind, ids in sorted(nations_by_kind.items(), key=lambda pair: -len(pair[1]))},
        "from_bulk_database": sum(1 for _, item in forums if item.get("source") == BULK_DATABASE_SOURCE),
        "with_own_term": sum(1 for _, item in forums if item.get("own_term")),
        "with_legal_basis": sum(1 for _, item in forums if item.get("legal_basis")),
        "with_enforcement_recorded": sum(1 for _, item in forums if item.get("enforcement")),
        "participation": counter_to_sorted_dictionary(collections.Counter(str(item.get("participation")) for _, item in forums)),
        "case_types": counter_to_sorted_dictionary(collections.Counter(case for _, item in forums for case in item.get("case_types") or [])),
        "features": {},
    }
    for feature, pattern in FORUM_FEATURES.items():
        hits = [profile["id"] for profile, item in forums
                if re.search(pattern, " ".join(str(item.get(field) or "") for field in ("description", "relationship_to_court", "enforcement", "participation")), re.IGNORECASE)]
        result["forums"]["features"][feature] = {"forums": len(hits), "nations": len(set(hits))}

    # Clauses.
    clauses = [(profile, item) for profile in with_practice for item in profile["dispute_resolution"].get("clauses", [])]
    result["clauses_by_kind_and_context"] = counter_to_sorted_dictionary(
        collections.Counter(f"{item.get('kind')}/{item.get('context')}" for _, item in clauses)
    )

    # Gaming compact dispute resolution clauses.
    compacts = [(profile, compact) for profile in profiles for compact in (profile.get("gaming") or {}).get("compacts", [])]
    summarized = [(profile, compact) for profile, compact in compacts if compact.get("dispute_resolution_summary")]
    distinct_texts = sorted({compact["dispute_resolution_summary"] for _, compact in summarized})
    result["gaming_compacts"] = {
        "compact_records": len(compacts),
        "with_dispute_resolution_summary": len(summarized),
        "nations_with_summary": len({profile["id"] for profile, _ in summarized}),
        "distinct_summary_texts": len(distinct_texts),
        "read_from_the_nations_own_compact": sum(1 for _, compact in summarized if "read from this nation" in (compact.get("note") or "")),
        "taken_from_a_state_model_compact": sum(1 for _, compact in summarized if "state model compact" in (compact.get("note") or "")),
        "states": counter_to_sorted_dictionary(collections.Counter(compact.get("state") for _, compact in summarized)),
        "terms_in_distinct_texts": {
            term: sum(1 for text in distinct_texts if re.search(pattern, text, re.IGNORECASE))
            for term, pattern in COMPACT_TERMS.items()
        },
    }

    # Data quality checks for review.
    repeated_titles = 0
    for profile in with_practice:
        titles = collections.Counter(
            (item.get("title") or "").strip().lower().lstrip("0123456789. ")
            for item in profile["dispute_resolution"].get("provisions", [])
        )
        repeated_titles += sum(count - 1 for count in titles.values() if count > 1)
    urls = collections.defaultdict(list)
    for source in sources:
        url = (source.get("citation") or {}).get("URL")
        if url:
            urls[url.rstrip("/")].append(source.get("key"))
    used_kinds = set(sections["forums"]["kinds"]) | set(sections["provisions"]["kinds"])
    result["review_flags"] = {
        "provisions_repeating_a_title_within_one_profile": repeated_titles,
        "urls_with_more_than_one_source_record": sum(1 for keys in urls.values() if len(keys) > 1),
        "source_records_without_an_archived_copy": sum(1 for source in sources if not source.get("archives")),
        "source_records": len(sources),
        "method_records_found": len(method_identifiers),
        "record_kinds_without_a_method_record": sorted(kind for kind in used_kinds if kind not in method_identifiers and kind != "other"),
    }

    pathlib.Path(output_path).write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
