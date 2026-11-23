"""Write a document history record (content/documents/, decision record 0018) for every nation's gaming
compact with each state, and for every set of Secretarial Procedures, from the compact catalog, the
clause rows and the version comparisons. Each version gets a source record of its own text that names
the version back (`document_version`); an existing source record for the same file is reused.

    python3 scripts/gaming/build_documents.py CAPTURES WORK_DIRECTORY

WORK_DIRECTORY is the one build_histories.py used (checked-history.json, checked-changes.json).
Records that already exist are left alone. The order of versions and the kind of each event are
inferred by rule from the Office of Indian Gaming list; a version's status of "in-effect" means no
later document on that list took its place, not that its term was checked. Never changes a profile.
"""

import collections
import json
import pathlib
import re
import sys

import yaml

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import record_facts  # noqa: E402
from build_catalog import STATES, TODAY  # noqa: E402
from build_histories import CATALOG, OUT, clause_rows, histories  # noqa: E402

SESSION = "2026-11-21-gaming-compact-histories"
LIST_SOURCE = "office-of-indian-gaming-compacts-list-2026"
CAPTURES = "research/captures/gaming/compacts/"
STATE_NAMES = {code: name for name, code in STATES.items()}
TOPICS = {"dispute_resolution": "dispute-resolution", "renegotiation": "renegotiation"}
LABELS = {
    "original": "compact", "replacement": "compact", "amendment": "amendment", "extension": "extension",
    "disapproval": "compact (disapproved)", "restatement": "amended and restated compact", "other": "document",
}
ACTIONS = {"approved": "approved", "deemed-approved": "deemed-approved", "disapproved": "disapproved",
           "extension": "approved"}
METHODS = {"negotiation": "negotiation", "meet-and-confer": "negotiation", "mediation": "mediation"}
# Notes from reading a version's file that the list does not show.
VERSION_NOTES = {
    "2022-07-26-yavapai-prescott-indian-tribe-tribal-state-gaming-compact": (
        "The posted file holds only the approval letter of July 13, 2022 and the 2022 Agreement to Amend, not "
        "the amended and restated compact it amends; that text has not yet been obtained (project thread "
        "\"Build version history for all documents\")."),
}
RESTATED = re.compile(r"amended and restated|restated (?:tribal-state )?(?:gaming )?compact|this amended compact|"
                      r"review of this amended compact", re.I)
BASE_EVENTS = ("original", "replacement", "restatement")
PROCEDURE_KINDS = {"original": "original", "amendment": "amendment", "amended-and-restated": "restatement"}


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def methods_of(clause):
    found = []
    for step in clause.get("steps") or []:
        if step in METHODS:
            found.append(METHODS[step])
        elif step == "arbitration":
            found.append("nonbinding-arbitration" if clause.get("binding_arbitration") is False else "arbitration")
    return list(dict.fromkeys(found))


def clause_entries(row):
    entries = []
    for field, topic in TOPICS.items():
        clause = (row or {}).get(field)
        if not isinstance(clause, dict) or not clause.get("present") or not clause.get("summary"):
            continue
        entry = {"topic": topic}
        if clause.get("locator"):
            entry["locator"] = clause["locator"]
        entry["summary"] = clause["summary"]
        if topic == "dispute-resolution" and methods_of(clause):
            entry["methods"] = methods_of(clause)
        entry["verification"] = "read-in-full" if clause.get("quote_found") else "inferred"
        entry["reviewer"] = row.get("reviewer") or "small model"
        if row.get("needs_review"):
            entry["note"] = "A small model read excerpts of this document and marked it hard; check against the text."
        entries.append(entry)
    return entries


def change_entry(topic, compared_with, answer):
    change = (answer or {}).get(next(k for k, v in TOPICS.items() if v == topic)) or {}
    kind = change.get("change")
    if kind not in ("added", "removed", "changed", "reworded", "renumbered", "unchanged"):
        return {"topic": topic, "compared_with": compared_with, "change": "not-compared", "verification": "inferred"}
    entry = {"topic": topic, "compared_with": compared_with, "change": kind}
    if change.get("summary"):
        entry["summary"] = change["summary"]
    if change.get("earlier_locator"):
        entry["locator_before"] = change["earlier_locator"]
    if change.get("later_locator"):
        entry["locator_after"] = change["later_locator"]
    quotes = [change.get("earlier_quote"), change.get("later_quote")]
    entry["verification"] = "read-in-full" if all(quotes) else "inferred"
    field = next(k for k, v in TOPICS.items() if v == topic)
    entry["reviewer"] = (answer.get("reviewers") or {}).get(field) or "small model, version comparison"
    if (answer or {}).get("difficulty") == "hard":
        entry["note"] = "Marked hard by the reviewer" + (f": {answer['note']}" if answer.get("note") else ".")
    return entry


class Sources:
    """Source records of each version's text: reuse the record for the same link, or write a new one."""

    def __init__(self, tree):
        self.tree = tree
        self.by_link = {}
        for key, source in tree.sources.items():
            for link in record_facts.source_links(source):
                self.by_link[link] = key
        self.used = set(tree.sources)
        self.added, self.linked = [], []

    def key_for(self, record, prefix, nation, document_id, version_id, names, kind):
        # A version needs a source record of its own that names it back. A file shared by two nations'
        # histories, and a list row with no file, get a record without a link.
        joint = len(record["nations"]) > 1 and nation != sorted(record["nations"])[0]
        link = None if joint else record["document_link"]
        key = self.by_link.get(record_facts.normalized_link(link)) if link else None
        if key:
            path = pathlib.Path(self.tree.sources[key]["_file"])
            text = path.read_text(encoding="utf-8")
            if "\ndocument_version:" not in text:
                block = f"document_version:\n  document: {document_id}\n  version: {version_id}\n"
                text = re.sub(r"\nrights:", "\n" + block + "rights:", text, count=1)
                path.write_text(text, encoding="utf-8")
                self.linked.append(key)
            return key
        base = f"{prefix}-{record['state'].lower()}-{nation}-{record['listed_date'] or 'undated'}"
        key, number = base, 2
        while key in self.used:
            key, number = f"{base}-{number}", number + 1
        self.used.add(key)
        state = STATE_NAMES.get(record["state"], record["state"])
        source = {
            "key": key,
            "kind": "intergovernmental-agreement" if prefix == "compact" else "other",
            "citation": {
                "type": "document",
                "title": record["title"],
                "author": [{"literal": names[n]} for n in record["nations"] or [nation] if n in names]
                + ([{"literal": f"State of {state}"}] if prefix == "compact" else
                   [{"literal": "U.S. Department of the Interior, Assistant Secretary–Indian Affairs"}]),
                "container-title": "Indian Affairs (bia.gov), Gaming Compacts list",
                "URL": link,
                "accessed": {"date-parts": [[2026, 11, 21]]},
            },
            "original_link": link,
            "retrieved": TODAY,
            "archives": [],
            "document_version": {"document": document_id, "version": version_id},
            "history": {"status": "live", "last_checked": TODAY},
            "rights": {"status": "no-permission-needed", "basis": "fact-only",
                       "basis_note": "Only facts are recorded from this source; it is cited and linked, not reproduced.",
                       "redistribution": False},
            "tribes": sorted(set(record["nations"] or [nation])),
            "jurisdictions": [{"level": "multiple", "note": f"Class III gaming {kind} for the State of {state}."}],
            "topics": ["gaming", "tribal-state-compact"],
            "found_in": [SESSION],
            "notes": (f"Listed by the Office of Indian Gaming on {record['listed_date']} ({record['decision']}). "
                      "The project's private copy and its SHA-256 are in research/gaming/compact-documents.csv."),
        }
        if not link:
            for field in ("URL", "accessed"):
                source["citation"].pop(field)
            for field in ("original_link", "archives", "history"):
                source.pop(field)
            source["notes"] += (" The list row links no file." if not record["document_link"] else
                                f" The file, {record['document_link']}, is shared with the history of "
                                f"{sorted(record['nations'])[0]}, whose source record links it.")
        if record["listed_date"]:
            source["citation"]["issued"] = {"date-parts": [[int(p) for p in record["listed_date"].split("-")]]}
        path = pathlib.Path("content/sources") / key[0] / f"{key}.yaml"
        path.write_text(yaml.safe_dump(source, sort_keys=False, allow_unicode=True, width=110), encoding="utf-8")
        self.added.append(key)
        return key


def split(history, procedures):
    """Compact versions, then Secretarial Procedures and what amends them, as separate documents."""
    first = next((i for i, v in enumerate(history["versions"]) if v["event"] == "secretarial-procedures"), None)
    if first is None:
        return history["versions"], []
    return history["versions"][:first], history["versions"][first:]


TRACK_NAMES = {"gaming": "Gaming", "off-track-wagering": "Off-Track Wagering", "blackjack": "Blackjack",
               "video-games-of-chance": "Video Games of Chance"}


def document_id_for(nation, state, kind, track):
    noun = f"{track}-compact" if kind == "gaming-compact" else "secretarial-procedures"
    return f"{nation}-{slug(STATE_NAMES.get(state, state))}-{noun}"


def build(versions, kind, nation, state, names, catalog, clauses, changes, sources, procedures, joint_owner, track,
          restated):
    document_id = document_id_for(nation, state, kind, track)
    built, ids, by_document = [], collections.Counter(), {}
    for item in versions:
        record = catalog[item["id"]]
        event = item["event"]
        if kind == "secretarial-procedures":
            row = procedures.get(item["id"]) or {}
            event = PROCEDURE_KINDS.get(row.get("kind"), "amendment" if built else "original")
            if "courtesy-copy" in item["id"]:
                event = "other"
        elif event == "letter":
            event = "other"
        elif event == "replacement" and item["id"] in restated:
            event = "restatement"
        year = (item["dates"]["published"] or item["dates"]["listed"] or "undated")[:4]
        version_id = f"{year}-{event}"
        ids[version_id] += 1
        if ids[version_id] > 1:
            version_id = f"{version_id}-{ids[version_id]}"
        label = (f"{year} Secretarial Procedures" if kind == "secretarial-procedures" and event == "original"
                 else f"{year} amended and restated procedures" if kind == "secretarial-procedures" and event == "restatement"
                 else f"{year} {LABELS.get(event, event)}")
        version = {"id": version_id, "label": label, "event": event, "status": "in-effect"}
        bases = [v for v in built if v["event"] in BASE_EVENTS and v["status"] != "disapproved"]
        if event in ("amendment", "extension") and bases:
            version["amends"] = [bases[-1]["id"]]
        if event in ("replacement", "restatement") and built:
            replaced = [v["id"] for v in built if v["status"] not in ("disapproved", "superseded")]
            if replaced:
                version["supersedes"] = replaced
                for v in built:
                    if v["id"] in replaced:
                        v["status"] = "superseded"
        if event == "disapproval":
            version["status"] = "disapproved"
        dates = {"listed": item["dates"]["listed"]} if item["dates"]["listed"] else {}
        if item["dates"]["published"] and item.get("approval_source"):
            dates["published"] = item["dates"]["published"]
        version["dates"] = dates
        if kind == "gaming-compact" and record["decision"] in ACTIONS:
            approval = {"authority": "secretary-of-the-interior", "action": ACTIONS[record["decision"]]}
            if item.get("approval_source"):
                approval["source"] = item["approval_source"]
                approval["locator"] = item["approval_citation"]
            version["approval"] = approval
        version["source"] = sources.key_for(record, "compact" if kind == "gaming-compact" else "secretarial-procedures",
                                            nation, document_id, version_id, names,
                                            "compact" if kind == "gaming-compact" else "procedures")
        if joint_owner.get(item["id"]) and joint_owner[item["id"]] != nation:
            version["note"] = f"A joint document, also a version of the history of {joint_owner[item['id']]}."
        version["confidence"] = "high"
        version["verification"] = "bulk-import"
        if item["id"] in VERSION_NOTES:
            version["note"] = VERSION_NOTES[item["id"]]
        if record.get("flags"):
            version.setdefault("note", "List row flags: " + "; ".join(record["flags"]) + ".")
        if record.get("capture"):
            version["capture"] = {"path": CAPTURES + record["capture"]["capture"], "sha256": record["capture"]["sha256"],
                                  "pages": record["capture"]["pages"]}
        entries = clause_entries(clauses.get(item["id"]))
        if entries:
            version["clauses"] = entries
        earlier = (version.get("amends") or version.get("supersedes") or [None])[0]
        if earlier:
            earlier_version = next(v for v in built if v["id"] == earlier)
            topics = {c["topic"] for c in entries} | {c["topic"] for c in earlier_version.get("clauses") or []}
            answer = changes.get(f"{by_document[earlier]}--{item['id']}")
            if topics:
                version["changes"] = [change_entry(topic, earlier, answer) for topic in sorted(topics)]
        by_document[version_id] = item["id"]
        built.append(version)
    return document_id, built


NOUNS = {"original": ("original", "originals"), "replacement": ("replacement", "replacements"),
         "amendment": ("amendment", "amendments"), "extension": ("extension", "extensions"),
         "disapproval": ("disapproved compact", "disapproved compacts"), "restatement": ("restatement", "restatements"),
         "other": ("other document", "other documents")}


def count_words(counts):
    parts = [f"{n} {NOUNS[e][0] if n == 1 else NOUNS[e][1]}" for e, n in counts.items()]
    return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]


def write_record(document_id, kind, nation, state, names, versions, related, track):
    path = pathlib.Path("content/documents") / document_id[0] / f"{document_id}.yaml"
    if path.exists():
        return False
    state_name = STATE_NAMES.get(state, state)
    name = names.get(nation, nation)
    what = "Class III gaming compact" if kind == "gaming-compact" else "Secretarial Procedures for Class III gaming"
    if track != "gaming":
        what = f"Class III {TRACK_NAMES[track].lower()} compact"
    title = (f"{name}–State of {state_name} {TRACK_NAMES[track]} Compact"
             if kind == "gaming-compact" else f"Secretarial Procedures for {name} ({state_name})")
    counts = collections.Counter(v["event"] for v in versions)
    record = {
        "id": document_id,
        "kind": kind,
        "title": title,
        "nations": sorted({nation} | {n for v in versions for n in []}),
        "states": [state],
        "jurisdictions": [{"level": "multiple", "note": f"{what} for {name} and the State of {state_name} under "
                           "25 U.S.C. § 2710(d)."}],
        "summary": (f"The {what if kind == 'gaming-compact' else 'Secretarial Procedures'} documents the Office of Indian Gaming lists "
                    f"for {name} and the State of {state_name} as of Nov. 21, 2026: "
                    + count_words(counts) + ". The order, the kind of each event and "
                    "which version is in effect are inferred from the list (project analysis); clause summaries and "
                    "comparisons are a small model's reading of excerpts."),
        "versions": versions,
    }
    if related:
        record["related"] = related
    record["found_in"] = [SESSION]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(record, sort_keys=False, allow_unicode=True, width=110), encoding="utf-8")
    return True


def main(captures, work):
    tree = record_facts.Tree(".")
    names = {p["id"]: (p.get("names") or {}).get("official") or p["id"] for p in tree.profiles.values()}
    catalog = {r["id"]: r for r in json.loads(CATALOG.read_text(encoding="utf-8"))}
    clauses = clause_rows(work)
    changes_file = work / "checked-changes.json"
    changes = {a["pair"]: a for a in json.loads(changes_file.read_text(encoding="utf-8"))} if changes_file.exists() else {}
    procedures = {r["document"]: r for r in json.loads((OUT / "secretarial-procedures.json").read_text(encoding="utf-8"))
                  if r.get("document")}
    joint_owner = {r["id"]: sorted(r["nations"])[0] for r in catalog.values() if len(r["nations"]) > 1}
    sources = Sources(tree)
    restated = set()  # replacements whose first pages call them an amended (and restated) compact
    for record in catalog.values():
        path = (captures / record["capture"]["capture"]).with_suffix(".txt") if record.get("capture") else None
        if path and path.exists() and RESTATED.search(re.sub(r"\s+", " ", path.read_text(errors="replace")[:4000])):
            restated.add(record["id"])
    written, skipped, events = 0, [], collections.Counter()
    for history in histories(list(catalog.values()), clauses, captures):
        nation, state = history["nation"], history["state"]
        if nation.startswith("unmatched:"):
            skipped.append(f"{nation} {state}")
            continue
        compact, procedure = split(history, procedures)
        parts = []
        if compact:
            parts.append(("gaming-compact", compact))
        if procedure:
            parts.append(("secretarial-procedures", procedure))
        ids = {}
        for kind, versions in parts:
            ids[kind] = document_id_for(nation, state, kind, history["track"])
        for kind, versions in parts:
            if (pathlib.Path("content/documents") / ids[kind][0] / f"{ids[kind]}.yaml").exists():
                skipped.append(ids[kind])
                continue
            document_id, built = build(versions, kind, nation, state, names, catalog, clauses, changes, sources,
                                       procedures, joint_owner, history["track"], restated)
            related = []
            if kind == "gaming-compact" and procedure:
                related.append({"document": ids["secretarial-procedures"], "relation": "replaced-by",
                                "note": "Secretarial Procedures issued under 25 U.S.C. § 2710(d)(7)(B)(vii) took the "
                                        "place of the compact (research/gaming/secretarial-procedures.csv)."})
                # Not every compact here was superseded: many expired at the end of their last extension
                # before the procedures issued, and some procedures have no clause ending prior compacts. Whether
                # each ended by expiring or by the procedures' "null and void" clause is read from the texts
                # (thread "Fix gaming compact status labels", Nov. 23, 2026), so a new record starts unknown.
                for version in built:
                    if version["status"] == "in-effect":
                        version["status"] = "unknown"
            if kind == "secretarial-procedures" and compact:
                related.append({"document": ids["gaming-compact"], "relation": "replaces"})
            if write_record(document_id, kind, nation, state, names, built, related, history["track"]):
                written += 1
                events.update(v["event"] for v in built)
    print(f"{written} document histories; events {dict(events)}; {len(sources.added)} new version source records; "
          f"{len(sources.linked)} existing source records linked to their version; skipped {skipped}")
    (work / "sources-added.json").write_text(json.dumps({"added": sources.added, "linked": sources.linked}, indent=1)
                                             + "\n", encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]))
