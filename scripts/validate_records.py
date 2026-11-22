"""Validate every content record against its JSON Schema and check links between records.

Checks:
  - each schema is a valid draft 2020-12 schema
  - each example in schemas/examples/ and each record in content/ and
    research/sessions/ validates against its schema
  - file names match record ids and keys, and tribe profiles and source records
    sit in the folder named for their first letter ('_other' for any other first character)
  - every [@key] and every glossary 'sources' entry names a source record
  - every [[id]], 'see_also', 'use_instead' and 'redirect_to' names a glossary entry
  - every 'found_in' names a research session
  - each outreach record's source ids resolve within the record, 'part_of'
    names another outreach record, and a Native nation record names a Tribe
    profile (checked against content/tribes/ once profiles exist)
  - every source a tribe profile cites names a source record
  - every method id (in 'methods' lists and in a method's 'broader', 'combines',
    'related' and 'redirect_to') names a method record, and no method is a
    broader kind of itself
  - each official image's reuse status follows from its signals (docs/official-images.md),
    its private copy sits in the nation's own folder, and each tribal insignia database
    signal names an entry listed in the profile
  - each document history's versions have unique ids; 'amends', 'supersedes' and
    'compared_with' name versions in the same record; every version, approval and
    'related' entry names an existing source record or document history; and every
    'document_version' (on a source record or a profile fact) names an existing
    document history and one of its versions (decision record 0018)
  - each story's tellings have unique ids and name existing source records; its
    nations, methods, protocol sources and anthology telling exist; the
    story's access is at least as restrictive as its most restrictive telling;
    and each excerpt quotes a telling that allows quotation, within the word
    limit, with a fingerprint that matches its words (decision record 0019)
  - (warning only) every tribe profile forum 'kind' names a method record

Run from the repository root:  python3 scripts/validate_records.py
Requires the packages in scripts/requirements.txt.
"""

import datetime
import hashlib
import json
import pathlib
import re
import sys
import unicodedata

import yaml
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

ROOT = pathlib.Path(".")
SCHEMA_DIRECTORY = ROOT / "schemas"
CITATION_KEY = re.compile(r"\[@([a-z0-9]+(?:-[a-z0-9]+)*)")
TERM_LINK = re.compile(r"\[\[([a-z0-9]+(?:-[a-z0-9]+)*)(?:\|[^\]]*)?\]\]")
FRONT_MATTER = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
CODE = re.compile(r"`[^`\n]*`")  # inline code only; fenced blocks hold provision alternatives

EXAMPLES = {
    "source.example.yaml": "source.schema.json",
    "tribe.example.yaml": "tribe.schema.json",
    "provision.example.md": "provision.schema.json",
    "variables.example.yaml": "variable.schema.json",
    "research-session.example.md": "research-session.schema.json",
    "glossary.example.yaml": "glossary.schema.json",
    "outreach-organization.example.yaml": "outreach-organization.schema.json",
    "outreach-plan.example.yaml": "outreach-plan.schema.json",
    "method.example.yaml": "method.schema.json",
    "document-history.example.yaml": "document-history.schema.json",
    "story.example.yaml": "story.schema.json",
    "contribution-filing.example.yaml": "contribution-filing.schema.json",
}
RECORD_FOLDERS = [
    ("content/sources/*/*.yaml", "source.schema.json"),
    ("content/glossary/*.yaml", "glossary.schema.json"),
    ("content/tribes/*/*.yaml", "tribe.schema.json"),
    ("content/methods/*.yaml", "method.schema.json"),
    ("content/documents/*/*.yaml", "document-history.schema.json"),
    ("content/stories/*/*.yaml", "story.schema.json"),
    ("content/variables/*.yaml", "variable.schema.json"),
    ("content/provisions/*.md", "provision.schema.json"),
    ("content/commentary/*.md", "commentary.schema.json"),
    ("research/sessions/*/*.md", "research-session.schema.json"),
    ("research/outreach/*.yaml", "outreach-organization.schema.json"),
]


def load_record(path: pathlib.Path):
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".md":
        match = FRONT_MATTER.match(text)
        if not match:
            raise ValueError("has no YAML front matter")
        text = match.group(1)
    return dates_as_text(yaml.safe_load(text))


def dates_as_text(value):
    """YAML reads 2026-11-20 as a date; the schemas expect a string."""
    if isinstance(value, dict):
        return {key: dates_as_text(item) for key, item in value.items()}
    if isinstance(value, list):
        return [dates_as_text(item) for item in value]
    if isinstance(value, datetime.date):
        return value.isoformat()
    return value


def letter_folder(name: str) -> str:
    """Folder for a tribe profile or source record: its first letter, or '_other' when
    the name starts with anything else (ids and keys allow only a-z and 0-9, so in
    practice a digit)."""
    first = name[:1]
    return first if "a" <= first <= "z" else "_other"


def cited_source_keys(value):
    """Every source key a tribe profile cites: each fact's 'source', the official name's
    'official_source', and the keys listed in 'dispute_resolution_law'."""
    if isinstance(value, dict):
        for field, item in value.items():
            if field in ("source", "official_source") and isinstance(item, str):
                yield item
            elif field == "dispute_resolution_law":
                yield from item
            else:
                yield from cited_source_keys(item)
    elif isinstance(value, list):
        for item in value:
            yield from cited_source_keys(item)


# Statuses a nation's own answer sets; every other status follows from the signals.
NATION_DECIDED_STATUSES = {"permission-granted", "permission-denied", "withdrawn-at-request"}


def expected_reuse_status(signals: list) -> str:
    """The display rule in docs/official-images.md: a block wins, then anything
    unchecked, then conditions; with none of these the image may be shown."""
    effects = {signal.get("effect") for signal in signals}
    if "blocks-reuse" in effects:
        return "restricted"
    if "unverified" in effects:
        return "needs-checking"
    if "allows-with-conditions" in effects:
        return "conditions-apply"
    return "no-restriction-found"


def check_official_images(path: pathlib.Path, record: dict, errors: list[str]) -> None:
    """Reuse status, private copy folders and database links in one tribe profile."""
    nation = record.get("id")
    serials = {entry.get("serial_number") for entry in record.get("tribal_insignia_database_entries", [])}
    items = record.get("official_images", []) + record.get("tribal_insignia_database_entries", [])
    for item in items:
        copy = item.get("private_copy")
        if copy and not copy.startswith(f"nation-images/{nation}/"):
            errors.append(f"{path}: private copy '{copy}' is not in the folder nation-images/{nation}/")
    for index, image in enumerate(record.get("official_images", [])):
        reuse = image.get("reuse", {})
        signals = reuse.get("signals", [])
        status = reuse.get("status")
        if status not in NATION_DECIDED_STATUSES and status != expected_reuse_status(signals):
            errors.append(
                f"{path}: official_images/{index}: reuse status '{status}' should be "
                f"'{expected_reuse_status(signals)}' given its signals"
            )
        if status == "withdrawn-at-request" and image.get("private_copy"):
            errors.append(f"{path}: official_images/{index}: a withdrawn image keeps no private copy")
        for signal in signals:
            if signal.get("kind") == "tribal-insignia-database" and signal.get("serial_number") not in serials:
                errors.append(
                    f"{path}: official_images/{index}: database entry {signal.get('serial_number')} "
                    "is not listed in tribal_insignia_database_entries"
                )


def document_version_links(value):
    """Every 'document_version' link in a record, with where it sits."""
    if isinstance(value, dict):
        for field, item in value.items():
            if field == "document_version" and isinstance(item, dict):
                yield item
            else:
                yield from document_version_links(item)
    elif isinstance(value, list):
        for item in value:
            yield from document_version_links(item)


def check_documents(documents: list, sources: set, tribe_ids: set, sessions: set, methods: dict,
                    linked: list, errors: list[str]) -> None:
    """Links inside and out of document histories (content/documents/, decision record 0018).
    `linked` holds (path, record) for every record that may carry a document_version link."""
    versions_by_document = {}
    for path, record in documents:
        versions_by_document[record.get("id")] = [version.get("id") for version in record.get("versions", [])]
    for path, record in documents:
        if record.get("id") != path.stem:
            errors.append(f"{path}: id does not match the file name")
        for session in record.get("found_in", []):
            if session not in sessions:
                errors.append(f"{path}: found_in names a missing research session '{session}'")
        for nation in record.get("nations", []):
            if nation not in tribe_ids:
                errors.append(f"{path}: nations names a missing Tribe profile '{nation}'")
        for entry in record.get("related", []):
            if entry.get("document") not in versions_by_document:
                errors.append(f"{path}: related names a missing document history '{entry.get('document')}'")
        identifiers = versions_by_document[record.get("id")]
        for identifier in {i for i in identifiers if identifiers.count(i) > 1}:
            errors.append(f"{path}: version id '{identifier}' is used more than once")
        for version in record.get("versions", []):
            name = f"{path}: version '{version.get('id')}'"
            keys = [version.get("source"), (version.get("approval") or {}).get("source")]
            for key in filter(None, keys):
                if key not in sources:
                    errors.append(f"{name} cites a missing source record '{key}'")
            for field in ("amends", "supersedes"):
                for other in version.get(field, []):
                    if other not in identifiers:
                        errors.append(f"{name}: {field} names a version '{other}' this record does not list")
                    elif other == version.get("id"):
                        errors.append(f"{name}: {field} names the version itself")
            for change in version.get("changes", []):
                if change.get("compared_with") not in identifiers:
                    errors.append(f"{name}: a change is compared with a version '{change.get('compared_with')}' this record does not list")
            for clause in version.get("clauses", []):
                for method in clause.get("methods", []):
                    if method not in methods:
                        errors.append(f"{name}: a clause names a missing method record '{method}'")
    for path, record in linked:
        for link in document_version_links(record):
            document, version = link.get("document"), link.get("version")
            if document not in versions_by_document:
                errors.append(f"{path}: document_version names a missing document history '{document}'")
            elif version not in versions_by_document[document]:
                errors.append(f"{path}: document_version names a version '{version}' that {document} does not list")


ACCESS_ORDER = ["public", "nation-review-first", "embargoed", "restricted"]
STORY_EXCERPT_WORDS = 50  # a short passage, quoted without permission (decision record 0019)


def check_stories(stories: list, sources: set, tribe_ids: set, sessions: set, methods: dict,
                  errors: list[str]) -> None:
    """Links inside and out of story records (content/stories/, decision record 0019)."""
    for path, record in stories:
        if record.get("id") != path.stem:
            errors.append(f"{path}: id does not match the file name")
        for session in record.get("found_in", []):
            if session not in sessions:
                errors.append(f"{path}: found_in names a missing research session '{session}'")
        for nation in record.get("nations", []):
            if nation not in tribe_ids:
                errors.append(f"{path}: nations names a missing Tribe profile '{nation}'")
        for method in record.get("methods", []):
            if method not in methods:
                errors.append(f"{path}: methods names a missing method record '{method}'")
        identifiers = [telling.get("id") for telling in record.get("tellings", [])]
        for identifier in {i for i in identifiers if identifiers.count(i) > 1}:
            errors.append(f"{path}: telling id '{identifier}' is used more than once")
        keys = [telling.get("source") for telling in record.get("tellings", [])]
        keys += [protocol.get("source") for protocol in record.get("protocols", [])]
        keys += [title.get("source") for title in record.get("titles_in_language", [])]
        for key in filter(None, keys):
            if key not in sources:
                errors.append(f"{path}: cites a missing source record '{key}'")
        chosen = (record.get("anthology") or {}).get("telling")
        if chosen and chosen not in identifiers:
            errors.append(f"{path}: anthology names a telling '{chosen}' this record does not list")
        story_level = (record.get("access") or {}).get("level", "public")
        for telling in record.get("tellings", []):
            level = (telling.get("access") or {}).get("level", "public")
            if ACCESS_ORDER.index(level) > ACCESS_ORDER.index(story_level):
                errors.append(f"{path}: telling '{telling.get('id')}' is '{level}', more restricted than the story's access '{story_level}'")
        if (record.get("sensitivity") or {}).get("restricted") and story_level != "restricted":
            errors.append(f"{path}: sensitivity says restricted but access is '{story_level}'")
        levels = {telling.get("id"): (telling.get("permitted_uses") or {}).get("level") for telling in record.get("tellings", [])}
        for number, excerpt in enumerate(record.get("excerpts", []), start=1):
            name = f"{path}: excerpt {number}"
            if excerpt.get("telling") not in levels:
                errors.append(f"{name} names a telling '{excerpt.get('telling')}' this record does not list")
                continue
            text = excerpt.get("text")
            if text is None:
                if not excerpt.get("held_privately"):
                    errors.append(f"{name} has no text and is not marked held_privately")
                continue
            if excerpt.get("held_privately"):
                errors.append(f"{name} is marked held_privately but carries its text")
            level = levels[excerpt["telling"]]
            if level not in ("quote", "publish-in-full"):
                errors.append(f"{name} quotes a telling whose permitted_uses level is '{level}'")
            normalized = " ".join(unicodedata.normalize("NFC", text).split())
            words = len(normalized.split())
            if words != excerpt.get("words"):
                errors.append(f"{name} has {words} words but says {excerpt.get('words')}")
            if words > STORY_EXCERPT_WORDS and level != "publish-in-full":
                errors.append(f"{name} is {words} words; without permission to publish in full an excerpt is at most {STORY_EXCERPT_WORDS}")
            if hashlib.sha256(normalized.encode("utf-8")).hexdigest() != excerpt.get("sha256"):
                errors.append(f"{name}: sha256 does not match its text")


def check_outreach(outreach: list, errors: list[str]) -> None:
    """Links inside and between outreach records (research/outreach/)."""
    outreach_ids = {path.stem for path, _ in outreach}
    tribe_ids = {path.stem for path in ROOT.glob("content/tribes/**/*.yaml")}
    for path, record in outreach:
        if record.get("id") != path.stem:
            errors.append(f"{path}: id does not match the file name")
        source_ids = [source.get("id") for source in record.get("sources", [])]
        if len(source_ids) != len(set(source_ids)):
            errors.append(f"{path}: source ids are not unique")
        cited = list(record.get("relevance", {}).get("sources", [])) + list(record.get("notes_sources", []))
        for contact in record.get("contacts", []):
            cited.extend(contact.get("sources", []))
        for source_id in cited:
            if source_id not in source_ids:
                errors.append(f"{path}: cites a missing source id '{source_id}'")
        for source_id in set(source_ids) - set(cited):
            errors.append(f"{path}: source '{source_id}' is listed but never cited")
        if record.get("part_of") and record["part_of"] not in outreach_ids:
            errors.append(f"{path}: part_of names a missing outreach record '{record['part_of']}'")
        if record.get("category") == "native-nation":
            profile = record.get("tribe_profile")
            if not profile:
                errors.append(f"{path}: a Native nation record needs tribe_profile")
            elif tribe_ids and profile not in tribe_ids:
                errors.append(f"{path}: tribe_profile names a missing Tribe profile '{profile}'")


def main() -> int:
    errors: list[str] = []
    registry = Registry()
    schemas = {}
    for schema_path in sorted(SCHEMA_DIRECTORY.glob("*.schema.json")):
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        schemas[schema_path.name] = schema
        resource = Resource.from_contents(schema)
        registry = registry.with_resource(schema["$id"], resource).with_resource(schema_path.name, resource)

    def validate(path: pathlib.Path, schema_name: str):
        try:
            record = load_record(path)
        except Exception as problem:  # report and continue
            errors.append(f"{path}: {problem}")
            return None
        validator = Draft202012Validator(schemas[schema_name], registry=registry)
        for error in validator.iter_errors(record):
            location = "/".join(str(part) for part in error.absolute_path) or "(top level)"
            errors.append(f"{path}: {location}: {error.message}")
        return record

    for example_name, schema_name in EXAMPLES.items():
        validate(SCHEMA_DIRECTORY / "examples" / example_name, schema_name)

    records: dict[str, list[tuple[pathlib.Path, dict]]] = {}
    for pattern, schema_name in RECORD_FOLDERS:
        for path in sorted(ROOT.glob(pattern)):
            record = validate(path, schema_name)
            if isinstance(record, dict):
                records.setdefault(schema_name, []).append((path, record))

    sources = {path.stem for path, _ in records.get("source.schema.json", [])}
    glossary = {path.stem for path, _ in records.get("glossary.schema.json", [])}
    sessions = {path.stem for path, _ in records.get("research-session.schema.json", [])}
    methods = {path.stem: record for path, record in records.get("method.schema.json", [])}

    def check_methods(path: pathlib.Path, field: str, identifiers) -> None:
        for identifier in identifiers or []:
            if identifier not in methods:
                errors.append(f"{path}: {field} names a missing method record '{identifier}'")

    for path, record in (records.get("source.schema.json", []) + records.get("tribe.schema.json", [])
                         + records.get("document-history.schema.json", [])
                         + records.get("story.schema.json", [])):
        if path.parent.name != letter_folder(path.stem):
            errors.append(f"{path}: belongs in the folder '{letter_folder(path.stem)}/'")

    for path, record in records.get("source.schema.json", []):
        if record.get("key") != path.stem:
            errors.append(f"{path}: key does not match the file name")
        for session in record.get("found_in", []):
            if session not in sessions:
                errors.append(f"{path}: found_in names a missing research session '{session}'")
        check_methods(path, "methods", record.get("methods"))

    for path, record in records.get("method.schema.json", []):
        if record.get("id") != path.stem:
            errors.append(f"{path}: id does not match the file name")
        for field in ("broader", "combines", "related"):
            check_methods(path, field, record.get(field))
        if record.get("redirect_to"):
            check_methods(path, "redirect_to", [record["redirect_to"]])
        for key in record.get("sources", []):
            if key not in sources:
                errors.append(f"{path}: sources names a missing source record '{key}'")
        if record.get("glossary") and record["glossary"] not in glossary:
            errors.append(f"{path}: glossary names a missing glossary entry")
        seen, waiting = set(), list(record.get("broader", []))
        while waiting:
            identifier = waiting.pop()
            if identifier == record.get("id"):
                errors.append(f"{path}: the method is listed as a broader kind of itself")
                break
            if identifier in seen or identifier not in methods:
                continue
            seen.add(identifier)
            waiting.extend(methods[identifier].get("broader", []))

    for path, record in records.get("provision.schema.json", []):
        check_methods(path, "methods", record.get("methods"))

    for path, record in records.get("glossary.schema.json", []):
        if record.get("id") != path.stem:
            errors.append(f"{path}: id does not match the file name")
        for field in ("see_also", "use_instead"):
            for entry in record.get(field, []):
                if entry not in glossary:
                    errors.append(f"{path}: {field} names a missing glossary entry '{entry}'")
        if record.get("redirect_to") and record["redirect_to"] not in glossary:
            errors.append(f"{path}: redirect_to names a missing glossary entry")
        for key in record.get("sources", []):
            if key not in sources:
                errors.append(f"{path}: sources names a missing source record '{key}'")

    for path, record in records.get("tribe.schema.json", []):
        if record.get("id") != path.stem:
            errors.append(f"{path}: id does not match the file name")
        for key in sorted(set(cited_source_keys(record))):
            if key not in sources:
                errors.append(f"{path}: cites a missing source record '{key}'")
        check_official_images(path, record, errors)

    check_outreach(records.get("outreach-organization.schema.json", []), errors)

    tribe_ids = {record.get("id") for _, record in records.get("tribe.schema.json", [])}
    for path, record in records.get("tribe.schema.json", []):
        if record.get("part_of") and record["part_of"] not in tribe_ids:
            errors.append(f"{path}: part_of names a missing profile '{record['part_of']}'")

    check_documents(
        records.get("document-history.schema.json", []), sources, tribe_ids, sessions, methods,
        records.get("source.schema.json", []) + records.get("tribe.schema.json", []), errors,
    )

    check_stories(records.get("story.schema.json", []), sources, tribe_ids, sessions, methods, errors)

    unmatched_kinds: dict[str, int] = {}
    for path, record in records.get("tribe.schema.json", []):
        for forum in (record.get("dispute_resolution") or {}).get("forums", []):
            kind = forum.get("kind")
            if kind and kind not in methods:
                unmatched_kinds[kind] = unmatched_kinds.get(kind, 0) + 1

    text_files = (
        list(ROOT.glob("content/**/*.md"))
        + list(ROOT.glob("content/glossary/*.yaml"))
        + list(ROOT.glob("content/methods/*.yaml"))
    )
    texts = [(path, path.read_text(encoding="utf-8")) for path in sorted(text_files)]
    # In source records only the annotation is prose; citation data such as
    # date-parts: [[2021]] would look like a term link.
    texts += [(path, record["annotation"]) for path, record in records.get("source.schema.json", []) if record.get("annotation")]
    for path, raw_text in texts:
        text = CODE.sub("", raw_text)  # ignore code examples
        for key in CITATION_KEY.findall(text):
            if key not in sources:
                errors.append(f"{path}: [@{key}] does not match any source record")
        for term in TERM_LINK.findall(text):
            if term not in glossary:
                errors.append(f"{path}: [[{term}]] does not match any glossary entry")

    for kind, count in sorted(unmatched_kinds.items()):
        # A warning, not an error: forum kinds are an open vocabulary, so an
        # unknown method still passes (decision record 0012).
        print(f"warning: forum kind '{kind}' ({count} profile(s)) has no method record in content/methods/")
    for error in errors:
        print(error)
    if errors:
        print(f"\n{len(errors)} problem(s).")
        return 1
    counted = sum(len(items) for items in records.values())
    print(f"All {len(schemas)} schemas, {len(EXAMPLES)} examples and {counted} records are valid; all links resolve.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
