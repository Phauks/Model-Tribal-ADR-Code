"""Give the six component bands of the Minnesota Chippewa Tribe their own profiles.

The Federal Register list of recognized entities names the Minnesota Chippewa
Tribe with six component reservations in parentheses, so the first build put
every band's records on one profile. The lead author decided on Nov. 21, 2026
that each band gets its own profile, linked to the Tribe by `part_of`, and that
records about one band move to that band's profile.

A fact moves when the fields that identify it (name, title, citation, detail,
link, locator and the like) name exactly one band, or, failing that, its note
does once the list's standard parenthetical naming all six is set aside. Facts
about the Tribe's own documents (links to mnchippewatribe.org) and facts that
name several bands or none stay on the Tribe's profile.

Usage: python3 scripts/tribes/split_component_bands.py [--check]
"""

import argparse
import copy
import json
import pathlib
import re
import sys

import yaml

TRIBE = pathlib.Path("content/tribes/m/minnesota-chippewa-tribe.yaml")
TODAY = "2026-11-21"
LIST_ENTRY = (
    "Minnesota Chippewa Tribe, Minnesota (Six component reservations: Bois Forte Band (Nett Lake); "
    "Fond du Lac Band; Grand Portage Band; Leech Lake Band; Mille Lacs Band; White Earth Band)"
)

# id: (name as the list gives it, census code, pattern that names the band)
BANDS = {
    "bois-forte-band": ("Bois Forte Band (Nett Lake)", "0335", r"Bois Forte|Nett Lake|boisforte"),
    "fond-du-lac-band": ("Fond du Lac Band", "1125", r"Fond du Lac|Nagaajiwanaang|fdlband|fdlrez|fond_du_lac"),
    "grand-portage-band": ("Grand Portage Band", "1355", r"Grand[-_ ]Portage|grandportage"),
    "leech-lake-band": ("Leech Lake Band", "1940", r"Leech[-_ ]Lake|llojibwe"),
    "mille-lacs-band": ("Mille Lacs Band", "2270", r"Mille[-_ ]Lacs|Misi-zaaga|millelacs"),
    "white-earth-band": ("White Earth Band", "4595", r"White[-_ ]Earth|whiteearth"),
}
STANDARD_TEXT = [
    r"\(the 2026 list names six component reservations:.*?White Earth\)",
    r"Six component reservations:.*?White Earth Band\)?",
    re.escape(LIST_ENTRY),
]
IDENTIFYING_FIELDS = [
    "name", "title", "citation", "detail", "link", "value", "organization", "legal_basis",
    "locator", "source", "label", "own_term", "description",
]
TRIBE_DOCUMENT = re.compile(r"mnchippewatribe\.org", re.IGNORECASE)


def without_standard_text(text):
    for pattern in STANDARD_TEXT:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)
    return text


def bands_named(text):
    return {band for band, (_, _, pattern) in BANDS.items() if re.search(pattern, text, re.IGNORECASE)}


def band_of(fact):
    """The one band a fact is about, or None."""
    if TRIBE_DOCUMENT.search(str(fact.get("link") or "")):
        return None
    identifying = without_standard_text(" ".join(str(fact.get(field) or "") for field in IDENTIFYING_FIELDS))
    named = bands_named(identifying)
    if len(named) == 1:
        return named.pop()
    if named:
        return None
    named = bands_named(without_standard_text(str(fact.get("note") or "")))
    return named.pop() if len(named) == 1 else None


def schema_order():
    schema = json.loads(pathlib.Path("schemas/tribe.schema.json").read_text(encoding="utf-8"))
    return list(schema["properties"])


def ordered(profile, order):
    return {key: profile[key] for key in order if key in profile} | {
        key: value for key, value in profile.items() if key not in order
    }


def new_profile(band, tribe):
    name, code, _ = BANDS[band]
    recognition = copy.deepcopy(tribe["recognition"][0])
    recognition["note"] = (
        f"Named in the notice as one of the six component reservations of the Minnesota Chippewa Tribe, "
        f"Minnesota, not as a separate entity: {LIST_ENTRY}."
    )
    land = next(fact for fact in tribe["states"] if fact.get("presence") == "land" and fact.get("state") == "MN")
    area = next(fact for fact in tribe["census_areas"] if fact.get("geographic_identifier") == code)
    state = copy.deepcopy(land)
    state["locator"] = f"tab20_aiannh20_county20_natl.txt rows for GEOID_AIANNH_20 {code}"
    state["note"] = f"Census area with land in this state: {area['name']} (code {code}). Area matched to the band by name."
    administration = copy.deepcopy(tribe["federal_administration"])
    administration["verification"] = "inferred"
    administration["note"] = (
        "The Tribal Leaders Directory lists only the Minnesota Chippewa Tribe; the region and agency are "
        "taken from its entry."
    )
    return {
        "id": band,
        "entity_type": "native-nation",
        "part_of": "minnesota-chippewa-tribe",
        "names": {"official": name, "official_source": tribe["names"]["official_source"]},
        "recognition": [recognition],
        "states": [state],
        "federal_administration": administration,
        "review": {
            "status": "drafted-from-public-sources",
            "last_verified": TODAY,
            "note": (
                f"Created on {TODAY} from records first kept on the Minnesota Chippewa Tribe profile; "
                "not yet sent to the band for review."
            ),
        },
        "sensitivity": copy.deepcopy(tribe.get("sensitivity") or {"tribal_review_required": False, "restricted": False}),
    }


def add(profile, path, fact):
    """Append a list fact, or set an object fact, at a dotted path."""
    parts = path.split(".")
    target = profile
    for part in parts[:-1]:
        target = target.setdefault(part, {})
    if isinstance(fact, list):
        target.setdefault(parts[-1], []).extend(fact)
    else:
        target[parts[-1]] = fact


def split(tribe):
    bands = {band: new_profile(band, tribe) for band in BANDS}
    moved = {band: 0 for band in BANDS}
    for key in list(tribe):
        value = tribe[key]
        containers = []
        if isinstance(value, list):
            containers.append((key, tribe, key))
        elif isinstance(value, dict):
            for inner in list(value):
                if isinstance(value[inner], list):
                    containers.append((f"{key}.{inner}", value, inner))
                elif isinstance(value[inner], dict) and "source" in value[inner]:
                    band = band_of(value[inner])
                    if band:
                        add(bands[band], f"{key}.{inner}", value.pop(inner))
                        moved[band] += 1
        for path, parent, field in containers:
            kept = []
            for fact in parent[field]:
                band = band_of(fact) if isinstance(fact, dict) and "source" in fact else None
                if band:
                    add(bands[band], path, [fact])
                    moved[band] += 1
                else:
                    kept.append(fact)
            if kept:
                parent[field] = kept
            else:
                del parent[field]
        if isinstance(value, dict) and not value:
            del tribe[key]
    tribe["review"]["note"] = (
        tribe["review"].get("note", "").rstrip()
        + f" Records about a single component band were moved to that band's profile on {TODAY}."
    ).strip()
    return bands, moved


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="report counts without writing")
    arguments = parser.parse_args()

    tribe = yaml.safe_load(TRIBE.read_text(encoding="utf-8"))
    bands, moved = split(tribe)
    order = schema_order()
    for band, count in moved.items():
        print(f"{band}: {count} facts")
    if arguments.check:
        return 0
    TRIBE.write_text(yaml.safe_dump(tribe, allow_unicode=True, sort_keys=False, width=100), encoding="utf-8")
    for band, profile in bands.items():
        path = pathlib.Path("content/tribes") / band[0] / f"{band}.yaml"
        if path.exists():
            sys.exit(f"{path} already exists")
        path.write_text(yaml.safe_dump(ordered(profile, order), allow_unicode=True, sort_keys=False, width=100), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
