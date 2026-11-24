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
  - each search log (research/search-logs/, decision record 0025) sits at
    <topic>/<letter>/<profile id>.yaml, names an existing Tribe profile, and
    its last_searched date is the latest search date, and its status is
    'found' exactly when one of its searches found something
  - each data table the website or the scripts read (TABLES: the tribal law
    provisions, the gaming compact tables and the tribal court opinions) has the
    columns its schema lists, each row validates against it with empty cells
    left out, its key columns are unique, and the nations and source records it
    names exist
  - the Supreme Court files (content/supreme-court/): each Court's chief is a
    Chief Justice in justices.yaml, every seat and appointing President there
    is in people.yaml, and every source they name exists
  - (warning only) every tribe profile forum 'kind' names a method record
  - (warning only) every record pattern and data table matches at least one
    file, so a folder that is missing or renamed is not skipped in silence

Run from the repository root:  python3 scripts/validate_records.py
Requires the packages in scripts/requirements.txt.
"""

import csv
import datetime
import hashlib
import json
import pathlib
import re
import sys
import unicodedata
from typing import NamedTuple

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
    "search-log.example.yaml": "search-log.schema.json",
}
RECORD_FOLDERS = [
    ("content/sources/*/*.yaml", "source.schema.json"),
    ("content/glossary/*.yaml", "glossary.schema.json"),
    ("content/tribes/*/*.yaml", "tribe.schema.json"),
    ("content/methods/*.yaml", "method.schema.json"),
    ("content/documents/*/*.yaml", "document-history.schema.json"),
    ("content/stories/*/*.yaml", "story.schema.json"),
    ("content/biographies/*.yaml", "biography.schema.json"),
    ("content/variables/*.yaml", "variable.schema.json"),
    # No provision or commentary files exist yet. The patterns stay for the model
    # code's text; until it is written, the run warns that they match nothing.
    ("content/provisions/*.md", "provision.schema.json"),
    ("content/commentary/*.md", "commentary.schema.json"),
    ("content/supreme-court/courts.yaml", "supreme-court-courts.schema.json"),
    ("content/supreme-court/justices.yaml", "supreme-court-justices.schema.json"),
    ("content/supreme-court/people.yaml", "supreme-court-people.schema.json"),
    ("research/sessions/*/*.md", "research-session.schema.json"),
    ("research/outreach/*.yaml", "outreach-organization.schema.json"),
    ("research/legal-help/providers/*.yaml", "legal-help-provider.schema.json"),
    ("research/search-logs/*/*/*.yaml", "search-log.schema.json"),
    ("research/reading-links/sites.yaml", "reading-link-sites.schema.json"),
]


class Table(NamedTuple):
    """A CSV data table, whose schema describes one row. 'key' is the columns that
    together tell rows apart; 'nations' and 'sources' are the columns that name
    Tribe profiles (several separated by ';') and source records."""
    path: str
    schema: str
    key: tuple[str, ...]
    nations: tuple[str, ...] = ()
    sources: tuple[str, ...] = ()


TABLES = [
    Table("research/tribal-law/provisions.csv", "tribal-law-provisions.schema.json", ("id",), nations=("nation",)),
    Table("research/gaming/compact-documents.csv", "compact-documents.schema.json", ("id",),
          nations=("nations",), sources=("federal_register.source",)),
    Table("research/gaming/compact-clauses.csv", "compact-clauses.schema.json", ("id",), nations=("nations",)),
    # A document two nations share is listed once for each.
    Table("research/gaming/compact-history-versions.csv", "compact-history-versions.schema.json", ("nation", "id"),
          nations=("nation",), sources=("source",)),
    Table("research/gaming/compact-context.csv", "compact-context.schema.json", ("id",), sources=("source",)),
    Table("research/tribal-court-opinions/opinions.csv", "tribal-court-opinions.schema.json", ("case_id",),
          nations=("nations",)),
]


def load_record(path: pathlib.Path):
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".md":
        match = FRONT_MATTER.match(text)
        if not match:
            raise ValueError("has no YAML front matter")
        text = match.group(1)
    return dates_as_text(yaml.safe_load(text))


def load_table(path: pathlib.Path) -> tuple[list[str], list[dict]]:
    """A CSV table's columns and its rows. Empty cells are left out of each row, so
    a schema's 'required' means the cell may not be empty."""
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = list(reader.fieldnames or [])
        rows = []
        for number, row in enumerate(reader, 1):
            if None in row:
                raise ValueError(f"row {number} has more cells than the header")
            if None in row.values():
                raise ValueError(f"row {number} has fewer cells than the header")
            rows.append({column: value for column, value in row.items() if value != ""})
    return columns, rows


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
LAW_DICTIONARY_WORDS = 20  # a short phrase from a copyrighted law dictionary entry, cited, never the full entry


def check_stories(stories: list, sources: set, tribe_ids: set, sessions: set, methods: dict,
                  errors: list[str], source_records: dict | None = None) -> None:
    """Links inside and out of story records (content/stories/, decision records 0019 and 0034)."""
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
        full_text = record.get("full_text")
        if full_text:
            check_story_full_text(path, record, full_text, levels, source_records or {}, errors)


# A nation's own law may be shown in full under decision record 0031.
NATION_LAW_SOURCE_KINDS = {"tribal-code", "tribal-constitution", "tribal-court-rule", "tribal-case"}


def check_story_full_text(path, record: dict, full_text: dict, levels: dict, source_records: dict,
                          errors: list[str]) -> None:
    """A story's full text: who may be reproduced in full, and its count and fingerprint (decision records 0034 and 0035)."""
    name = f"{path}: full_text"
    telling_id = full_text.get("telling")
    telling = next((t for t in record.get("tellings", []) if t.get("id") == telling_id), None)
    if telling is None:
        errors.append(f"{name} names a telling '{telling_id}' this record does not list")
        return
    source = source_records.get(telling.get("source") or "")
    basis = full_text.get("basis")
    if basis == "public-domain":
        if not source or (source.get("rights") or {}).get("basis") != "public-domain":
            errors.append(f"{name} says public-domain but the telling's source record's rights basis is not public-domain")
    elif basis == "nation-law":
        if not source or source.get("kind") not in NATION_LAW_SOURCE_KINDS:
            errors.append(f"{name} says nation-law but the telling's source record is not a nation's law")
    elif basis == "permission":
        if levels.get(telling_id) != "publish-in-full":
            errors.append(f"{name} says permission but the telling's permitted_uses level is not publish-in-full")
    texts = [paragraph for paragraph in full_text.get("paragraphs", []) if isinstance(paragraph, str)]
    normalized = [" ".join(unicodedata.normalize("NFC", text).split()) for text in texts]
    words = sum(len(text.split()) for text in normalized)
    if words != full_text.get("words"):
        errors.append(f"{name} has {words} words but says {full_text.get('words')}")
    if hashlib.sha256("\n\n".join(normalized).encode("utf-8")).hexdigest() != full_text.get("sha256"):
        errors.append(f"{name}: sha256 does not match its text")


def check_search_logs(logs: list, errors: list[str]) -> None:
    """Place, profile link and dates of each search log (research/search-logs/, decision record 0025)."""
    for path, record in logs:
        profile = record.get("profile") or ""
        topic = record.get("topic")
        if path.parent.parent.name != topic:
            errors.append(f"{path}: topic '{topic}' does not match the folder '{path.parent.parent.name}/'")
        if path.parent.name != letter_folder(path.stem):
            errors.append(f"{path}: belongs in the folder '{letter_folder(path.stem)}/'")
        if pathlib.PurePosixPath(profile).stem != path.stem:
            errors.append(f"{path}: the file name does not match the profile '{profile}'")
        if not (ROOT / profile).is_file():
            errors.append(f"{path}: profile names a missing Tribe profile '{profile}'")
        found = any(search.get("outcome") == "found" for search in record.get("searches", []))
        if (record.get("status") == "found") != found:
            errors.append(f"{path}: status is '{record.get('status')}' but "
                          + ("a search found something" if found else "no search found anything"))
        dates = [search.get("date") for search in record.get("searches", []) if search.get("date")]
        if dates and record.get("last_searched") != max(dates):
            errors.append(f"{path}: last_searched is {record.get('last_searched')} but the latest search is {max(dates)}")


def check_table(table: Table, columns: list[str], rows: list[dict], schema: dict, validator,
                nation_ids: set, sources: set, errors: list[str]) -> None:
    """One data table: its columns, each row against the schema, unique keys, and
    the nations and source records it names."""
    path = table.path
    expected = list(schema.get("properties", {}))
    missing = [column for column in expected if column not in columns]
    extra = [column for column in columns if column not in expected]
    if missing:
        errors.append(f"{path}: the header lacks the column(s) {', '.join(missing)} that {table.schema} lists")
    if extra:
        errors.append(f"{path}: the column(s) {', '.join(extra)} are not in {table.schema}")
    if missing or extra:
        return
    seen: dict[tuple, int] = {}
    for number, row in enumerate(rows, 1):
        key = tuple(row.get(column, "") for column in table.key)
        name = f"{path}: row {number} ({' '.join(key)})"
        for error in validator.iter_errors(row):
            location = "/".join(str(part) for part in error.absolute_path) or "(row)"
            errors.append(f"{name}: {location}: {error.message}")
        if key in seen:
            errors.append(f"{name}: {', '.join(table.key)} repeats row {seen[key]}")
        else:
            seen[key] = number
        for column in table.nations:
            for nation in (part.strip() for part in row.get(column, "").split(";")):
                if nation and nation not in nation_ids:
                    errors.append(f"{name}: {column} names a missing Tribe profile '{nation}'")
        for column in table.sources:
            if row.get(column) and row[column] not in sources:
                errors.append(f"{name}: {column} names a missing source record '{row[column]}'")


def check_supreme_court(courts: list, justices: list, people: list, sources: set, errors: list[str]) -> None:
    """Links between the files in content/supreme-court/ that the site's Court,
    Justice and President pages join (site/src/lib/server/supreme-courts.ts,
    supreme-court-people.ts), and the source records they name."""
    for path, record in courts + justices + people:
        for key in (record.get("sources") or {}).values():
            if key not in sources:
                errors.append(f"{path}: sources names a missing source record '{key}'")
    appointments = [entry for _, record in justices for entry in record.get("justices", [])]
    chiefs = {entry.get("name") for entry in appointments if entry.get("role") == "Chief Justice"}
    names = {entry.get("name") for entry in appointments}
    for path, record in courts:
        for court in record.get("courts", []):
            if court.get("chief") not in chiefs:
                errors.append(f"{path}: {court.get('key')}: chief '{court.get('chief')}' is not a Chief Justice in justices.yaml")
    for path, record in justices:
        for entry in record.get("justices", []):
            if entry.get("follows") and entry["follows"] not in names:
                errors.append(f"{path}: {entry.get('name')}: follows names no one in justices.yaml ('{entry['follows']}')")
    for path, record in people:
        seats = {appointment.get("seat") for person in record.get("justices", []) for appointment in person.get("appointments", [])}
        presidents = {president.get("name") for president in record.get("presidents", [])}
        for entry in appointments:
            if entry.get("seat") not in seats:
                errors.append(f"{path}: no one holds seat {entry.get('seat')} ({entry.get('name')} in justices.yaml)")
            if entry.get("appointed_by") not in presidents:
                errors.append(f"{path}: no President named '{entry.get('appointed_by')}', who appointed {entry.get('name')} in justices.yaml")


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

    warnings: list[str] = []
    records: dict[str, list[tuple[pathlib.Path, dict]]] = {}
    for pattern, schema_name in RECORD_FOLDERS:
        paths = sorted(ROOT.glob(pattern))
        if not paths:
            warnings.append(f"{pattern} matches no files, so nothing there is checked against {schema_name}")
        for path in paths:
            record = validate(path, schema_name)
            if isinstance(record, dict):
                records.setdefault(schema_name, []).append((path, record))

    sources = {path.stem for path, _ in records.get("source.schema.json", [])}
    glossary = {path.stem for path, _ in records.get("glossary.schema.json", [])}
    provisions = {path.stem for path, _ in records.get("provision.schema.json", [])}
    sessions = {path.stem for path, _ in records.get("research-session.schema.json", [])}
    for path, record in records.get("biography.schema.json", []):
        if record.get("key") != path.stem:
            errors.append(f"{path}: key does not match the file name")
        cited = [*record.get("names", []), *record.get("nations", []), *record.get("events", [])]
        for fact in cited:
            if fact.get("source") not in sources:
                errors.append(f"{path}: names a missing source record '{fact.get('source')}'")
        for entry in record.get("cases", []):
            if entry.get("case") not in sources:
                errors.append(f"{path}: cases names a missing source record '{entry.get('case')}'")
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

    nation_ids = {path.stem for path, _ in records.get("tribe.schema.json", [])}

    def check_nations_in_case(path: pathlib.Path, record: dict) -> None:
        """Every court case says which nations it names, each a nation record, and 'tribes' lists the same ones."""
        if not str(record.get("kind", "")).endswith("-case"):
            return
        block = record.get("nations_in_case")
        if not block:
            errors.append(f"{path}: a court case needs nations_in_case (the nations it names, or none)")
            return
        named = [entry["nation"] for entry in block.get("named", [])]
        for nation in named:
            if nation not in nation_ids:
                errors.append(f"{path}: nations_in_case names a missing nation record '{nation}'")
        if list(dict.fromkeys(named)) != list(record.get("tribes", [])):
            errors.append(f"{path}: tribes must list the nations in nations_in_case, in the same order")

    def check_record_box(path: pathlib.Path, record: dict) -> None:
        """A case or law box on the record cites only sources that have records, and a case box only on a case."""
        if record.get("case_box") and record.get("citation", {}).get("type") != "legal_case":
            errors.append(f"{path}: case_box is only for court cases; a law uses law_box")
        for field in ("case_box", "law_box"):
            for key in re.findall(r"@([a-z0-9]+(?:-[a-z0-9]+)*)", json.dumps(record.get(field) or {}, ensure_ascii=False)):
                if key not in sources:
                    errors.append(f"{path}: {field} cites a missing source record '{key}'")

    for path, record in records.get("source.schema.json", []):
        if record.get("key") != path.stem:
            errors.append(f"{path}: key does not match the file name")
        check_record_box(path, record)
        for session in record.get("found_in", []):
            if session not in sessions:
                errors.append(f"{path}: found_in names a missing research session '{session}'")
        check_methods(path, "methods", record.get("methods"))
        check_nations_in_case(path, record)

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
        if record.get("code_definition") and record["code_definition"] not in provisions:
            errors.append(f"{path}: code_definition names a missing provision '{record['code_definition']}'")
        for key in record.get("sources", []):
            if key not in sources:
                errors.append(f"{path}: sources names a missing source record '{key}'")
        for quotation in record.get("law_dictionary", []):
            if quotation["source"] not in sources:
                errors.append(f"{path}: law_dictionary names a missing source record '{quotation['source']}'")
            if len(quotation["quote"].split()) > LAW_DICTIONARY_WORDS:
                errors.append(f"{path}: a law_dictionary quote is longer than {LAW_DICTIONARY_WORDS} words; quote a short phrase only")

    for path, record in records.get("tribe.schema.json", []):
        if record.get("id") != path.stem:
            errors.append(f"{path}: id does not match the file name")
        for key in sorted(set(cited_source_keys(record))):
            if key not in sources:
                errors.append(f"{path}: cites a missing source record '{key}'")
        check_official_images(path, record, errors)

    # A merged profile's old id redirects to the profile that absorbed it, so no live profile may use it
    # and no two profiles may claim it.
    live_ids = {record.get("id") for _, record in records.get("tribe.schema.json", [])}
    former_owner: dict[str, pathlib.Path] = {}
    for path, record in records.get("tribe.schema.json", []):
        for former in record.get("former_ids", []):
            if former in live_ids:
                errors.append(f"{path}: former id '{former}' is still a live profile id")
            if former in former_owner:
                errors.append(f"{path}: former id '{former}' is also claimed by {former_owner[former]}")
            former_owner[former] = path

    check_outreach(records.get("outreach-organization.schema.json", []), errors)
    check_supreme_court(
        records.get("supreme-court-courts.schema.json", []), records.get("supreme-court-justices.schema.json", []),
        records.get("supreme-court-people.schema.json", []), sources, errors,
    )

    table_rows = 0
    for table in TABLES:
        path = ROOT / table.path
        if not path.exists():
            warnings.append(f"{table.path} does not exist, so it is not checked against {table.schema}")
            continue
        try:
            columns, rows = load_table(path)
        except (ValueError, csv.Error, UnicodeDecodeError) as problem:
            errors.append(f"{table.path}: {problem}")
            continue
        validator = Draft202012Validator(schemas[table.schema], registry=registry)
        check_table(table, columns, rows, schemas[table.schema], validator, nation_ids, sources, errors)
        table_rows += len(rows)
    check_search_logs(records.get("search-log.schema.json", []), errors)

    tribe_ids = {record.get("id") for _, record in records.get("tribe.schema.json", [])}
    for path, record in records.get("tribe.schema.json", []):
        if record.get("part_of") and record["part_of"] not in tribe_ids:
            errors.append(f"{path}: part_of names a missing profile '{record['part_of']}'")
        # A court's appeals_to names another court in the same profile, so the
        # nation page can show the path of appeal (site/src/lib/nation-services.ts).
        institutions = record.get("justice_institutions") or []
        names = [institution.get("name", "") for institution in institutions]
        for institution in institutions:
            # A court's part_of names its group, another entry in the same
            # profile, so the page can list the court under the group.
            group = institution.get("part_of")
            if group is not None:
                if group == institution.get("name"):
                    errors.append(f"{path}: {institution.get('name')} part_of names itself")
                elif group not in names:
                    errors.append(
                        f"{path}: {institution.get('name')} part_of names '{group}', "
                        "which is not an entry in justice_institutions"
                    )
            appeal = institution.get("appeals_to")
            if not appeal:
                continue
            if appeal.get("court") == institution.get("name"):
                errors.append(f"{path}: {institution.get('name')} appeals_to names itself")
            elif appeal.get("court") not in names:
                errors.append(
                    f"{path}: {institution.get('name')} appeals_to names '{appeal.get('court')}', "
                    "which is not a court in justice_institutions"
                )

    check_documents(
        records.get("document-history.schema.json", []), sources, tribe_ids, sessions, methods,
        records.get("source.schema.json", []) + records.get("tribe.schema.json", []), errors,
    )

    check_stories(
        records.get("story.schema.json", []), sources, tribe_ids, sessions, methods, errors,
        {record.get("key"): record for _, record in records.get("source.schema.json", [])},
    )

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
    # Each Court's history on the Supreme Court pages cites source records.
    texts += [(path, court.get("history", "")) for path, record in records.get("supreme-court-courts.schema.json", [])
              for court in record.get("courts", [])]
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
    for warning in warnings:
        # A warning, not an error: a pattern may wait for content not written yet.
        print(f"warning: {warning}")
    for error in errors:
        print(error)
    if errors:
        print(f"\n{len(errors)} problem(s).")
        return 1
    counted = sum(len(items) for items in records.values())
    print(f"All {len(schemas)} schemas, {len(EXAMPLES)} examples, {counted} records and {table_rows} rows "
          f"in {len(TABLES)} data tables are valid; all links resolve.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
