"""Join the public outreach records with the private outreach plan into one readable list.

The plan holds named people, suggested asks, priority and contact history, and is
kept outside git (docs/decisions/0012-outreach-list-split-public-and-private.md).
This script checks the plan against schemas/outreach-plan.schema.json, checks
that every plan entry names an outreach record, and writes a Markdown overview
next to the plan. Never write the overview into this repository.

Run from the repository root:
  python3 scripts/build_outreach_overview.py /path/to/private/plan.yaml
Requires the packages in scripts/requirements.txt.
"""

import datetime
import json
import pathlib
import sys

import yaml
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

ROOT = pathlib.Path(".")
PRIORITY_HEADINGS = {
    1: "Priority 1: approach first",
    2: "Priority 2: approach once drafts exist",
    3: "Priority 3: later or optional",
}


def as_text(value):
    """YAML reads 2026-11-21 as a date; the schemas expect a string."""
    if isinstance(value, dict):
        return {key: as_text(item) for key, item in value.items()}
    if isinstance(value, list):
        return [as_text(item) for item in value]
    if isinstance(value, datetime.date):
        return value.isoformat()
    return value


def load_validator() -> Draft202012Validator:
    registry = Registry()
    for schema_path in (ROOT / "schemas").glob("*.schema.json"):
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        resource = Resource.from_contents(schema)
        registry = registry.with_resource(schema["$id"], resource).with_resource(schema_path.name, resource)
    plan_schema = json.loads((ROOT / "schemas" / "outreach-plan.schema.json").read_text(encoding="utf-8"))
    return Draft202012Validator(plan_schema, registry=registry)


def cell(text: str) -> str:
    return (text or "").replace("|", "\\|").replace("\n", " ")


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    plan_path = pathlib.Path(sys.argv[1])
    plan = as_text(yaml.safe_load(plan_path.read_text(encoding="utf-8")))
    problems = [f"{'/'.join(map(str, error.absolute_path))}: {error.message}" for error in load_validator().iter_errors(plan)]
    records = {path.stem: as_text(yaml.safe_load(path.read_text(encoding="utf-8"))) for path in sorted((ROOT / "research" / "outreach").glob("*.yaml"))}
    for entry in plan.get("entries", []):
        if entry.get("organization") not in records:
            problems.append(f"plan names a missing outreach record '{entry.get('organization')}'")
    planned = {entry.get("organization") for entry in plan.get("entries", [])}
    for missing in sorted(set(records) - planned):
        problems.append(f"outreach record '{missing}' has no plan entry")
    if problems:
        print("\n".join(problems))
        return 1

    lines = [
        "# Outreach overview (private)",
        "",
        f"Generated from the public records in `research/outreach/` and the private plan `{plan_path.name}` "
        f"(checked {plan['checked']}). Do not commit this file. Each organization's sources are in its record.",
        "",
    ]
    for priority, heading in PRIORITY_HEADINGS.items():
        entries = [entry for entry in plan["entries"] if entry["priority"] == priority]
        if not entries:
            continue
        lines += [f"## {heading} ({len(entries)})", "", "| Organization | Why | Suggested ask | People | Contact | Status |", "| --- | --- | --- | --- | --- | --- |"]
        for entry in sorted(entries, key=lambda item: (records[item["organization"]]["category"], records[item["organization"]]["name"])):
            record = records[entry["organization"]]
            people = "; ".join(f"[{person['name']}]({person['profile_link']}), {person['title']}" + (" (advisor)" if person.get("relationship") == "advisor" else "") for person in entry.get("people", []))
            if record.get("tribe_profile"):
                contact = f"Tribe profile `{record['tribe_profile']}`"
            else:
                contact = "; ".join(f"{item['kind']}: {item['value']}" for item in record.get("contacts", [])[:3])
            lines.append(
                f"| **{cell(record['name'])}** ({record['category']}; {', '.join(record['possible_roles'])}) "
                f"| {cell(record['relevance']['text'])} | {cell(entry.get('suggested_ask', ''))} | {cell(people)} | {cell(contact)} | {entry['status']} |"
            )
        lines.append("")
    output = plan_path.with_name("overview.md")
    output.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {output} ({len(plan['entries'])} entries).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
