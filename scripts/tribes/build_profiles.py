#!/usr/bin/env python3
"""Build tribe profiles and source records from the raw research files.

Reads every research/raw/<date>/*.json file (cited facts gathered by
scripts/tribes/federal_facts.py and by research assistants; the shape is described in
research/raw/README.md), and writes:

  content/tribes/<letter>/<id>.yaml     one profile per Native nation or community
  content/sources/<letter>/<key>.yaml   one record per new source (existing records are kept)
  research/raw/<date>/build-report.json   what was merged, dropped and why

Every value keeps its source key and confidence level. A fact that does not fit the
schema is dropped and listed in the build report rather than repaired by guesswork.

This script made the first edition of the dataset. Once profiles are edited by hand,
do not rerun it over them: add new facts by hand or in a new raw file and review the diff.

Usage: python3 scripts/tribes/build_profiles.py research/raw/2026-11-21
"""
import collections
import datetime
import json
import pathlib
import re
import sys
import unicodedata

import yaml
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
TODAY = "2026-11-21"
SESSION_FOR_AGENT = {"federal-list-and-directory": "2026-11-21-federal-list-import"}

CONTACT_FIELDS = {"website", "physical-address", "mailing-address", "phone", "fax", "email-general"}
LIST_FIELDS = {
    "recognition": "recognition",
    "state-presence": "states",
    "census-area": "census_areas",
    "population": "population",
    "language": "languages",
    "government-structure": "government_structure",
    "governing-document": "governing_documents",
    "justice-institution": "justice_institutions",
    "jurisdiction": "jurisdiction",
    "membership": "memberships",
    "related-entity": "related_entities",
}
NAME_FIELDS = {"name-self-designation": "self_designation", "name-alternate": "alternate", "name-former": "former"}
DISPUTE_FIELDS = {
    "dispute-resolution-forum": "forums",
    "dispute-resolution-provision": "provisions",
    "dispute-resolution-clause": "clauses",
    "dispute-resolution-training": "training_programs",
    "dispute-resolution-material": "published_materials",
}
GAMING_FIELDS = {"gaming-ordinance": "ordinances", "gaming-compact": "compacts", "gaming-entity": "entities"}
SOURCE_KINDS = {
    "tribal-code", "tribal-constitution", "tribal-court-rule", "tribal-case", "federal-statute",
    "federal-regulation", "federal-register-notice", "federal-case", "state-statute", "state-case",
    "uniform-act", "model-law", "book", "book-chapter", "journal-article", "report", "web-page",
    "dataset", "interview", "other",
}
CITATION_TYPES = {
    "web-page": "webpage", "dataset": "dataset", "report": "report", "book": "book",
    "book-chapter": "chapter", "journal-article": "article-journal", "federal-case": "legal_case",
    "state-case": "legal_case", "tribal-case": "legal_case",
}
KEY_ORDER = [
    "id", "entity_type", "names", "recognition", "states", "census_areas", "population", "contacts", "languages",
    "federal_administration", "government_structure", "governing_documents", "justice_institutions",
    "dispute_resolution", "dispute_resolution_law", "gaming", "jurisdiction", "memberships",
    "related_entities", "consultation", "review", "sensitivity",
]


def nfc(value):
    if isinstance(value, str):
        return unicodedata.normalize("NFC", value).strip()
    if isinstance(value, dict):
        return {nfc(k): nfc(v) for k, v in value.items()}
    if isinstance(value, list):
        return [nfc(v) for v in value]
    return value


def norm_name(text):
    text = unicodedata.normalize("NFKD", text.lower()).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", text.replace("&", " and "))).strip()


def slug(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", text.replace("'", "")).strip("-")


def date_parts(value):
    if not value or not re.match(r"^\d{4}(-\d{2}(-\d{2})?)?$", str(value)):
        return None
    return [[int(part) for part in str(value).split("-")]]


def letter_folder(name):
    """First letter of an id or key, or 'other' for any other first character."""
    return name[:1] if "a" <= name[:1] <= "z" else "other"


def source_path(key):
    return ROOT / "content" / "sources" / letter_folder(key) / f"{key}.yaml"


def contact_key(item):
    value = str(item.get("value", "")).lower().strip()
    if item["kind"] == "website":
        value = re.sub(r"^https?://(www\.)?", "", value).rstrip("/")
    elif item["kind"] in ("phone", "fax"):
        value = re.sub(r"\D", "", value)[-10:]
    else:
        value = re.sub(r"[^a-z0-9]", "", value)
    return item["kind"], value


def load_registry():
    registry = Registry()
    for path in (ROOT / "schemas").glob("*.schema.json"):
        schema = json.loads(path.read_text(encoding="utf-8"))
        resource = Resource.from_contents(schema)
        registry = registry.with_resource(schema["$id"], resource).with_resource(path.name, resource)
    return registry


def cited(fact):
    out = {"source": fact["source"], "confidence": fact["confidence"]}
    if fact.get("as_of"):
        out["as_of"] = str(fact["as_of"])
    for key in ("locator", "note"):
        if fact.get(key):
            out[key] = fact[key]
    return out


def fact_item(fact):
    """The profile item for one fact: its value fields plus the citation."""
    value = dict(fact["value"]) if isinstance(fact["value"], dict) else {"value": fact["value"]}
    if "url" in value:
        value["link"] = value.pop("url")
    field = fact["field"]
    if field == "population" and value.get("kind") == "enrolled-citizens":
        value["kind"] = "citizens"
    if field == "population" and isinstance(value.get("count"), str):
        digits = value["count"].replace(",", "")
        value["count"] = int(digits) if digits.isdigit() else value["count"]
    if field in CONTACT_FIELDS:
        value = {"kind": field, "value": value.get("value"), **({"label": value["label"]} if value.get("label") else {})}
    if field == "gaming-operation":
        value = {"value": value.get("operates_gaming", value.get("value"))}
    if field == "recognition" and value.get("since") is not None:
        value["since"] = str(value["since"])
    if field == "governing-document" and value.get("year") is not None:
        value["year"] = str(value["year"])
    if field == "gaming-compact" and value.get("approved") is not None:
        value["approved"] = str(value["approved"])
    value = {k: v for k, v in value.items() if v not in (None, "", [])}
    return {**value, **cited(fact)}


def main(raw_directory):
    raw_directory = pathlib.Path(raw_directory)
    registry = load_registry()
    tribe_schema = json.loads((ROOT / "schemas" / "tribe.schema.json").read_text(encoding="utf-8"))
    source_schema = json.loads((ROOT / "schemas" / "source.schema.json").read_text(encoding="utf-8"))
    tribe_validator = Draft202012Validator(tribe_schema, registry=registry)
    source_validator = Draft202012Validator(source_schema, registry=registry)

    report = {"raw_files": [], "dropped_facts": [], "unknown_nations": collections.Counter(),
              "renamed_sources": [], "merged_entities": [], "skipped_profiles": [], "invalid_sources": []}
    entities, by_name, facts, sources = {}, {}, [], {}
    source_sessions = collections.defaultdict(set)
    files = sorted(p for p in raw_directory.glob("*.json") if p.name not in ("build-report.json", "entity-merges.json"))
    # The federal list comes first so its ids win when another file names the same nation.
    files.sort(key=lambda p: p.stem != "federal-list-and-directory")
    for path in files:
        data = json.loads(path.read_text(encoding="utf-8"))
        agent = data.get("agent", path.stem)
        session = SESSION_FOR_AGENT.get(agent, f"2026-11-21-{agent}")
        report["raw_files"].append({"file": path.name, "session": session,
                                    "facts": len(data.get("facts", [])), "sources": len(data.get("sources", []))})
        id_map = {}
        for entity in data.get("entities", []):
            name_key = norm_name(entity["official_name"])
            entity_id = slug(entity["id"])
            if entity_id in entities or name_key in by_name:
                existing = entities.get(entity_id) or by_name[name_key]
                id_map[entity["id"]] = existing["id"]
                if existing["id"] != entity["id"]:
                    report["merged_entities"].append(f"{agent}: {entity['id']} -> {existing['id']}")
                continue
            record = {"id": entity_id, "official_name": entity["official_name"],
                      "entity_type": entity.get("entity_type", "native-nation"), "agent": agent}
            entities[entity_id] = record
            by_name[name_key] = record
            id_map[entity["id"]] = entity_id
        key_map = {}
        for source in data.get("sources", []):
            key = slug(source.get("key", ""))
            if not key:
                continue
            if key in sources and sources[key].get("url") != source.get("url"):
                new_key = f"{key}-{slug(agent)}"
                report["renamed_sources"].append(f"{agent}: {key} -> {new_key}")
                key_map[source["key"]] = new_key
                key = new_key
            else:
                key_map[source["key"]] = key
            if key not in sources:
                sources[key] = {**source, "key": key}
            source_sessions[key].add(session)
        for fact in data.get("facts", []):
            fact = dict(fact)
            fact["nation"] = id_map.get(fact.get("nation"), fact.get("nation"))
            fact["source"] = key_map.get(fact.get("source"), fact.get("source"))
            fact["agent"] = agent
            source_sessions[fact.get("source")].add(session)
            facts.append(fact)

    # Merge entities that two lists name differently (research/raw/<date>/entity-merges.json).
    merges_path = raw_directory / "entity-merges.json"
    merges = json.loads(merges_path.read_text(encoding="utf-8"))["merges"] if merges_path.exists() else []
    renames = {r["from"]: r["into"] for r in (json.loads(merges_path.read_text(encoding="utf-8")).get("renames", [])
                                              if merges_path.exists() else [])}
    for fact in facts:
        fact["nation"] = renames.get(fact.get("nation"), fact.get("nation"))
    for merge in merges:
        source_entity = entities.pop(merge["from"], None)
        if not source_entity or merge["into"] not in entities:
            report["merged_entities"].append(f"merge skipped, id missing: {merge}")
            continue
        moved = [f for f in facts if f.get("nation") == merge["from"]]
        for fact in moved:
            fact["nation"] = merge["into"]
        if moved:
            facts.append({"nation": merge["into"], "field": "name-alternate",
                          "value": {"name": source_entity["official_name"]}, "source": moved[0]["source"],
                          "confidence": "medium", "as_of": moved[0].get("as_of"), "agent": source_entity["agent"],
                          "note": "Name used for this group in the cited source; matched to this record by name and state."})
        report["merged_entities"].append(f"{merge['from']} -> {merge['into']}")

    # Assemble profiles.
    profiles = {}
    for entity in entities.values():
        profiles[entity["id"]] = {
            "id": entity["id"], "entity_type": entity["entity_type"],
            "names": {"official": entity["official_name"]},
        }
    seen = set()
    cited_by = collections.defaultdict(set)
    for fact in facts:
        nation = fact.get("nation")
        if nation not in profiles:
            report["unknown_nations"][f"{fact['agent']}: {nation}"] += 1
            continue
        if not fact.get("source") or fact.get("confidence") not in ("high", "medium", "low"):
            report["dropped_facts"].append({"fact": fact, "reason": "missing source or confidence"})
            continue
        if not isinstance(fact.get("value"), (dict, str, int, bool)):
            report["dropped_facts"].append({"fact": fact, "reason": "value has no usable shape"})
            continue
        signature = json.dumps([nation, fact["field"], fact["value"], fact["source"]], sort_keys=True)
        if signature in seen:
            continue
        seen.add(signature)
        profile = profiles[nation]
        field = fact["field"]
        item = fact_item(fact)
        if field in CONTACT_FIELDS:
            # The same website or phone number from a second source is kept once (first source wins).
            key = contact_key(item)
            if key in profile.setdefault("_contact_keys", set()):
                continue
            profile["_contact_keys"].add(key)
            profile["contacts"] = profile.get("contacts", []) + [item]
        elif field in LIST_FIELDS:
            profile.setdefault(LIST_FIELDS[field], []).append(item)
        elif field in NAME_FIELDS:
            profile["names"].setdefault(NAME_FIELDS[field], []).append(item)
        elif field in DISPUTE_FIELDS:
            profile.setdefault("dispute_resolution", {}).setdefault(DISPUTE_FIELDS[field], []).append(item)
        elif field in GAMING_FIELDS:
            profile.setdefault("gaming", {}).setdefault(GAMING_FIELDS[field], []).append(item)
        elif field == "gaming-operation":
            profile.setdefault("gaming", {}).setdefault("operates_gaming", item)
        elif field == "federal-administration":
            profile.setdefault("federal_administration", item)
        else:
            report["dropped_facts"].append({"fact": fact, "reason": f"unknown field {field}"})
            continue
        cited_by[fact["source"]].add(nation)

    written, skipped = 0, []
    out_directory = ROOT / "content" / "tribes"
    out_directory.mkdir(parents=True, exist_ok=True)
    for nation, profile in sorted(profiles.items()):
        # A state named only in the listed name adds nothing when another fact gives that state.
        # A state given without a kind of presence adds nothing when another fact gives one.
        states = profile.get("states", [])
        with_presence = {s["state"] for s in states if s.get("presence")}
        profile["states"] = [s for s in states if s.get("presence") or s["state"] not in with_presence]
        if not profile["states"]:
            profile.pop("states")
        recognition = profile.get("recognition", [])
        if recognition:
            profile["names"]["official_source"] = (
                "bia-recognized-entities-2026"
                if any(r["source"] == "bia-recognized-entities-2026" for r in recognition)
                else recognition[0]["source"])
        profile["review"] = {
            "status": "drafted-from-public-sources",
            "last_verified": TODAY,
            "note": "Drafted from public sources on 2026-11-21 and not yet sent to the nation for review.",
        }
        profile["sensitivity"] = {"tribal_review_required": False, "restricted": False}
        profile.pop("_contact_keys", None)
        profile = nfc(profile)
        # Drop items the schema rejects, one at a time, and record why.
        for _ in range(200):
            errors = list(tribe_validator.iter_errors(profile))
            if not errors:
                break
            error = errors[0]
            path = list(error.absolute_path)
            if len(path) >= 2 and isinstance(path[1], int) and isinstance(profile.get(path[0]), list):
                removed = profile[path[0]].pop(path[1])
                if not profile[path[0]]:
                    profile.pop(path[0])
            elif len(path) >= 3 and isinstance(path[2], int) and path[0] in ("names", "gaming", "dispute_resolution"):
                removed = profile[path[0]][path[1]].pop(path[2])
                if not profile[path[0]][path[1]]:
                    profile[path[0]].pop(path[1])
            elif len(path) >= 2 and path[0] in ("gaming", "federal_administration") or path[:1] == ["federal_administration"]:
                removed = profile[path[0]].pop(path[1]) if path[0] == "gaming" else profile.pop(path[0])
            else:
                break
            report["dropped_facts"].append({"nation": nation, "item": removed, "reason": error.message})
        errors = list(tribe_validator.iter_errors(profile))
        if errors:
            skipped.append({"nation": nation, "errors": [e.message for e in errors[:5]]})
            continue
        ordered = {key: profile[key] for key in KEY_ORDER if key in profile}
        text = yaml.safe_dump(ordered, allow_unicode=True, sort_keys=False, width=100)
        (out_directory / letter_folder(nation)).mkdir(exist_ok=True)
        (out_directory / letter_folder(nation) / f"{nation}.yaml").write_text(text, encoding="utf-8")
        written += 1
    report["skipped_profiles"] = skipped

    # Source records for keys the profiles cite.
    new_sources = 0
    for key, source in sorted(sources.items()):
        path = source_path(key)
        if path.exists() or key not in cited_by:
            continue
        kind = source.get("kind") if source.get("kind") in SOURCE_KINDS else "other"
        citation = {"type": CITATION_TYPES.get(kind, "legislation" if "statute" in kind or "regulation" in kind
                                                 or "notice" in kind or kind.startswith("tribal-") else "document"),
                    "title": source.get("title") or key}
        if source.get("author"):
            citation["author"] = [{"literal": source["author"]}]
        if source.get("container_title"):
            citation["container-title"] = source["container_title"]
        if source.get("url"):
            citation["URL"] = source["url"]
        if date_parts(source.get("issued")):
            citation["issued"] = {"date-parts": date_parts(source["issued"])}
        accessed = source.get("accessed") if date_parts(source.get("accessed")) and len(str(source.get("accessed"))) == 10 else TODAY
        citation["accessed"] = {"date-parts": date_parts(accessed)}
        record = {"key": key, "kind": kind, "citation": citation}
        if source.get("url", "").startswith(("http://", "https://")):
            record["original_link"] = source["url"]
        record["retrieved"] = accessed
        archive = source.get("archive_url") or ""
        captured = str(source.get("archive_captured") or "")
        if archive.startswith("http") and re.match(r"^\d{4}-\d{2}-\d{2}$", captured):
            record["archives"] = [{"service": "wayback", "link": archive, "captured": captured}]
        else:
            record["archives"] = []
        record["history"] = {"status": "live", "last_checked": accessed}
        record["rights"] = {
            "status": "no-permission-needed", "basis": "fact-only",
            "basis_note": "Only facts are recorded from this source; it is cited and linked, not quoted or reproduced.",
            "redistribution": False,
        }
        if len(cited_by[key]) <= 25:
            record["tribes"] = sorted(cited_by[key])
        record["found_in"] = sorted(s for s in source_sessions[key] if s)
        if source.get("notes"):
            record["notes"] = source["notes"]
        record = nfc(record)
        errors = [e.message for e in source_validator.iter_errors(record)]
        if errors:
            report["invalid_sources"].append({"key": key, "errors": errors[:5]})
            continue
        path.parent.mkdir(exist_ok=True)
        path.write_text(yaml.safe_dump(record, allow_unicode=True, sort_keys=False, width=100), encoding="utf-8")
        new_sources += 1

    missing = sorted(k for k in cited_by if not source_path(k).exists())
    report["missing_sources"] = {k: sorted(cited_by[k])[:5] for k in missing}
    report["unknown_nations"] = dict(report["unknown_nations"])
    report["counts"] = {"profiles_written": written, "profiles_skipped": len(skipped),
                        "new_sources": new_sources, "facts_read": len(facts),
                        "facts_dropped": len(report["dropped_facts"]), "sources_missing": len(missing)}
    (raw_directory / "build-report.json").write_text(
        json.dumps(nfc(report), indent=1, ensure_ascii=False, default=str) + "\n", encoding="utf-8")
    print(json.dumps(report["counts"]))


if __name__ == "__main__":
    main(sys.argv[1])
