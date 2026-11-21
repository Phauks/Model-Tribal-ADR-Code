"""Validate every content record against its JSON Schema and check links between records.

Checks:
  - each schema is a valid draft 2020-12 schema
  - each example in schemas/examples/ and each record in content/ and
    research/sessions/ validates against its schema
  - file names match record ids and keys, and tribe profiles and source records
    sit in the folder named for their first character
  - every [@key] and every glossary 'sources' entry names a source record
  - every [[id]], 'see_also', 'use_instead' and 'redirect_to' names a glossary entry
  - every 'found_in' names a research session
  - every source a tribe profile cites names a source record

Run from the repository root:  python3 scripts/validate_records.py
Requires the packages in scripts/requirements.txt.
"""

import datetime
import json
import pathlib
import re
import sys

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
}
RECORD_FOLDERS = [
    ("content/sources/*/*.yaml", "source.schema.json"),
    ("content/glossary/*.yaml", "glossary.schema.json"),
    ("content/tribes/*/*.yaml", "tribe.schema.json"),
    ("content/variables/*.yaml", "variable.schema.json"),
    ("content/provisions/*.md", "provision.schema.json"),
    ("content/commentary/*.md", "commentary.schema.json"),
    ("research/sessions/*/*.md", "research-session.schema.json"),
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

    for path, record in records.get("source.schema.json", []) + records.get("tribe.schema.json", []):
        if path.parent.name != path.stem[:1]:
            errors.append(f"{path}: belongs in the folder '{path.stem[:1]}/' (first character of its name)")

    for path, record in records.get("source.schema.json", []):
        if record.get("key") != path.stem:
            errors.append(f"{path}: key does not match the file name")
        for session in record.get("found_in", []):
            if session not in sessions:
                errors.append(f"{path}: found_in names a missing research session '{session}'")

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

    text_files = list(ROOT.glob("content/**/*.md")) + list(ROOT.glob("content/glossary/*.yaml"))
    for path in sorted(text_files):
        text = CODE.sub("", path.read_text(encoding="utf-8"))  # ignore code examples
        for key in CITATION_KEY.findall(text):
            if key not in sources:
                errors.append(f"{path}: [@{key}] does not match any source record")
        for term in TERM_LINK.findall(text):
            if term not in glossary:
                errors.append(f"{path}: [[{term}]] does not match any glossary entry")

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
