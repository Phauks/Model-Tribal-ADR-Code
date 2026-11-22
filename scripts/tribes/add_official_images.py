"""Add seals, emblems, flags and logos for nations that still have none (second collection, 2026-11-22).

The first collection (scripts/tribes/write_official_images.py) took images only from each nation's
own website. Trevor Goldsmith asked on 2026-11-22 for every nation that still had no image to get
one, looking first at the nation's own website and then at other reliable copies: Wikimedia
Commons files and English Wikipedia files, and the nation's page on an intertribal organization's
website. The same reuse rule applies (docs/official-images.md).

Reads the reviewed research file:
    research/raw/2026-11-22/official-images-second-pass.json
        One image per nation, chosen by eye, with where it was found, who made the copy and its
        license when it is not the nation's own file, and every reuse signal, classified by hand.
        Its "insignia_comparisons" list updates design_compared on database entries that were
        compared with a chosen image.

Writes official_images in content/tribes/ for nations that have none (it never replaces an
image), updates design_compared on tribal_insignia_database_entries, and writes a source record
in content/sources/ for every page or file a value cites. The image files are kept privately
and never written here; scripts/tribes/capture_official_images.py files them in the bucket.

Run from the repository root:
    python3 scripts/tribes/add_official_images.py
Uses only the Python standard library and PyYAML (scripts/requirements.txt).
"""

import importlib.util
import json
import pathlib
import re
import urllib.parse

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW = ROOT / "research/raw/2026-11-22/official-images-second-pass.json"
SESSION = "2026-11-22-official-images-second-pass"
CHECKED = "2026-11-22"

# Reuse the first collection's source records, status rule and profile writer.
_spec = importlib.util.spec_from_file_location("write_official_images", ROOT / "scripts/tribes/write_official_images.py")
first = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(first)
first.SESSION = SESSION
first.CHECKED = CHECKED

NATION_PAGE_NOTE = (
    "Cited and linked for where the nation publishes its seal, emblem, flag or logo. A private copy of "
    "the image is kept for review and is not redistributed; whether it may be shown is recorded with "
    "the image in the nation's profile (official_images, reuse)."
)
OTHER_PAGE_NOTE = (
    "Cited and linked for where a copy of the nation's seal, emblem, flag or logo is published, because "
    "the nation's own website has none the project could use. A private copy of the image is kept for "
    "review and is not redistributed; whether it may be shown is recorded with the image in the nation's "
    "profile (official_images, reuse). The image belongs to the nation."
)


def commons_record(sources, image: dict, nation: str) -> str:
    """A source record for a Wikimedia Commons or Wikipedia file page."""
    link = image["page"]
    known = sources.by_link.get(first.normalize(link))
    if known:
        sources.note_use(known, nation)
        return known
    title = urllib.parse.unquote(link.rsplit("/wiki/", 1)[1]).replace("_", " ")
    host = urllib.parse.urlsplit(link).netloc
    container = "Wikimedia Commons" if host.startswith("commons.") else "Wikipedia"
    base = ("wikimedia-commons-" if container == "Wikimedia Commons" else "wikipedia-") + first.slug(
        re.sub(r"\.(svg|png|jpe?g|gif|webp)$", "", title.removeprefix("File:"), flags=re.I))
    key, number = base[:90].rstrip("-"), 2
    while key in sources.records:
        key, number = f"{base[:86]}-{number}", number + 1
    record = {
        "key": key,
        "kind": "web-page",
        "citation": {
            "type": "webpage",
            "title": title,
            "author": [{"literal": image.get("author") or container}],
            "container-title": container,
            "URL": link,
            "accessed": {"date-parts": first.date_parts(CHECKED)},
        },
        "original_link": link,
        "retrieved": CHECKED,
        "archives": [],
        "history": {"status": "live", "last_checked": CHECKED},
        "rights": {
            "status": "no-permission-needed",
            "basis": "link-only",
            "basis_note": OTHER_PAGE_NOTE,
            "redistribution": False,
        },
        "tribes": [nation],
        "found_in": [SESSION],
    }
    if image.get("license"):
        record["rights"]["license"] = image["license"]
    if image.get("file_description"):
        record["notes"] = image["file_description"]
    sources.records[key] = record
    sources.by_link[first.normalize(link)] = key
    sources.changed.add(key)
    return key


def main() -> None:
    data = json.loads(RAW.read_text(encoding="utf-8"))
    sources = first.Sources()
    profiles = {path.stem: path for path in first.TRIBES.glob("*/*.yaml")}
    written = 0

    for nation in data["images"]:
        path = profiles[nation["id"]]
        profile = yaml.safe_load(path.read_text(encoding="utf-8"))
        if profile.get("official_images"):
            raise SystemExit(f"{nation['id']} already has an image; this script only adds")
        author = profile["names"]["official"]
        image = nation["image"]
        where = image["found_on"]
        if where in ("wikimedia-commons", "wikipedia"):
            page_key = commons_record(sources, image, nation["id"])
        elif where == "nation-website":
            page_key = sources.web_page(image["page"], image.get("page_title"), nation["id"], author, NATION_PAGE_NOTE)
        else:
            page_key = sources.web_page(image["page"], image.get("page_title"), nation["id"],
                                        image.get("page_author") or author, OTHER_PAGE_NOTE)
        signals = []
        for found in nation.get("signals", []):
            signal = {"kind": found["kind"], "effect": found["effect"]}
            for field in ("quote", "link"):
                if found.get(field):
                    signal[field] = found[field]
            if found["kind"] in first.PAGE_SIGNALS and found.get("link"):
                signal["source"] = sources.web_page(
                    found["link"], found.get("page_title"), nation["id"], author,
                    "Cited and linked for what the nation's website says about reusing its content; "
                    "the relevant sentence is quoted briefly.",
                )
            elif found["kind"] == "tribal-insignia-database":
                signal["source"] = sources.database()
            if signal.get("source"):
                signal["verification"] = "read-in-full"
            for field in ("locator", "serial_number", "note"):
                if found.get(field):
                    signal[field] = found[field]
            signals.append(signal)
        item = {"kind": image["kind"]}
        if image.get("alternative_text"):
            item["alternative_text"] = image["alternative_text"]
        item["image_link"] = image["image_link"]
        if image.get("credit"):
            item["credit"] = image["credit"]
        item.update({
            "retrieved": nation["retrieved"],
            "media_type": image["media_type"],
            "sha256": image["sha256"],
            "private_copy": image["private_copy"],
            "reuse": {"status": first.reuse_status(signals), "checked": CHECKED, "signals": signals},
            "source": page_key,
            "confidence": "high" if where == "nation-website" else "medium",
            "as_of": nation["retrieved"],
            "verification": "read-in-full",
        })
        if image.get("note"):
            item["note"] = image["note"]
        profile = first.insert_after(profile, ["states", "census_areas", "population", "contacts"],
                                     {"official_images": [item]})
        path.write_text(first.dump(profile), encoding="utf-8")
        written += 1

    compared = 0
    for comparison in data.get("insignia_comparisons", []):
        path = profiles[comparison["id"]]
        profile = yaml.safe_load(path.read_text(encoding="utf-8"))
        for entry in profile.get("tribal_insignia_database_entries", []):
            if entry["serial_number"] == comparison["serial_number"]:
                entry["design_compared"] = comparison["design_compared"]
                compared += 1
        path.write_text(first.dump(profile), encoding="utf-8")
    sources.save()
    print(f"{written} images added; {compared} database entries compared; "
          f"{len(sources.changed)} source records written or updated")


if __name__ == "__main__":
    main()
