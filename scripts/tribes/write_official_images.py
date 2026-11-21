"""Write nations' seals, emblems, flags and logos, with their reuse signals, into the profiles.

Reads two reviewed research files:
    research/raw/2026-11-21/official-images.json
        One image per nation, chosen by hand from the candidates that
        scripts/tribes/find_official_images.py found on the nation's own website, with every reuse
        signal found for it (terms of use, trademark notices, trademark symbols, the nation's laws,
        and the USPTO Native American Tribal Insignia database), each classified by hand.
    research/raw/2026-11-21/tribal-insignia-database.json
        Every database entry matched to a profile, with how its design compares with the image.

Writes official_images and tribal_insignia_database_entries in content/tribes/, and a source
record in content/sources/ for every page or law a value cites (reusing a record that already has
the same link). The reuse status of each image is worked out from its signals by the rule in
docs/official-images.md. The image files themselves are kept privately and never written here.

Run from the repository root:
    python3 scripts/tribes/write_official_images.py
Uses only the Python standard library and PyYAML (scripts/requirements.txt).
"""

import json
import pathlib
import re
import unicodedata
import urllib.parse

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW = ROOT / "research/raw/2026-11-21"
TRIBES = ROOT / "content/tribes"
SOURCES = ROOT / "content/sources"
SESSION = "2026-11-21-official-images"
CHECKED = "2026-11-21"
DATABASE_SOURCE = "uspto-native-american-tribal-insignia-database"
PAGE_SIGNALS = {"terms-of-use", "trademark-notice", "permission-required", "copyright-notice"}

LAWS = {
    "jamestown-sklallam-title-41": {
        "title": "Title 41 – Tribal Crest and Flag Code, Jamestown S’Klallam Tribal Code",
        "author": "Jamestown S’Klallam Tribe",
        "link": "https://jamestowntribe.org/wp-content/uploads/2025/11/Title-41-Tribal-Crest-and-Tribal-Flag-Code-10-30-25.pdf",
        "issued": [2025, 10, 30],
        "tribe": "jamestown-sklallam-tribe",
        "notes": "Date taken from the file name of the published copy.",
    },
    "little-river-band-tribal-seal-ordinance": {
        "title": "Tribal Seal Ordinance (Ordinance No. 96-0107-01)",
        "author": "Little River Band of Ottawa Indians",
        "link": "https://lrboi-nsn.gov/sites/default/files/pages/96-0107-01-Tribal-Seal_0.pdf",
        "tribe": "little-river-band-of-ottawa-indians",
        "notes": "A scanned copy; the text has scanning errors.",
    },
    "little-traverse-bay-bands-tribal-emblem-and-seal": {
        "title": "Chapter 21. The Tribal Emblem and Seal of the Waganakising Odawak Nation, Waganakising Odawak Statutes vol. 6, title VI (WOS 2016-004)",
        "author": "Little Traverse Bay Bands of Odawa Indians",
        "link": "https://ltbbodawa-nsn.gov/wp-content/uploads/2023/04/Vol-6-Title-VI-Chapter_21.pdf",
        "issued": [2016, 7, 15],
        "tribe": "little-traverse-bay-bands-of-odawa-indians",
    },
    "coquille-tribal-seal": {
        "title": "Chapter 196 – Tribal Seal, Coquille Indian Tribal Code",
        "author": "Coquille Indian Tribe",
        "link": "https://www.coquilletribe.org/wp-content/uploads/2018/09/196-Tribal-Seal-9_2018.pdf",
        "issued": [2018, 9],
        "tribe": "coquille-indian-tribe",
        "notes": "Date taken from the file name of the published copy.",
    },
    "mississippi-band-of-choctaw-title-36": {
        "title": "Title XXXVI – Tribal Government, Choctaw Tribal Code (chapter 3, Tribal emblems)",
        "author": "Mississippi Band of Choctaw Indians",
        "link": "https://www.choctaw.org/wp-content/uploads/2024/04/Title-36-Tribal-Government.pdf",
        "tribe": "mississippi-band-of-choctaw-indians",
    },
}


def dump(record: dict) -> str:
    return yaml.safe_dump(record, allow_unicode=True, sort_keys=False, width=100)


def folder(name: str) -> str:
    first = name[0]
    return first if first.isascii() and first.isalpha() else "_other"


def normalize(link: str) -> str:
    parts = urllib.parse.urlsplit(link.strip())
    host = parts.netloc.lower().removeprefix("www.")
    return f"{host}{parts.path.rstrip('/')}" + (f"?{parts.query}" if parts.query else "")


def slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def date_parts(text: str) -> list:
    return [[int(part) for part in text.split("-")]]


class Sources:
    """The source records, found by key or by link, with new ones written on save."""

    def __init__(self):
        self.records: dict[str, dict] = {}
        self.by_link: dict[str, str] = {}
        self.changed: set[str] = set()
        for path in sorted(SOURCES.glob("*/*.yaml")):
            record = yaml.safe_load(path.read_text(encoding="utf-8"))
            self.records[record["key"]] = record
            for link in (record.get("original_link"), (record.get("citation") or {}).get("URL")):
                if link:
                    self.by_link.setdefault(normalize(link), record["key"])

    def note_use(self, key: str, nation: str) -> None:
        record = self.records[key]
        if nation not in record.setdefault("tribes", []):
            record["tribes"].append(nation)
            self.changed.add(key)
        if SESSION not in record.setdefault("found_in", []):
            record["found_in"].append(SESSION)
            self.changed.add(key)

    def new_key(self, link: str) -> str:
        parts = urllib.parse.urlsplit(link)
        host = parts.netloc.lower().removeprefix("www.").split(":")[0]
        site = slug(host.rsplit(".", 1)[0])
        last = [segment for segment in parts.path.split("/") if segment]
        page = slug(re.sub(r"\.(html?|aspx|php)$", "", last[-1])) if last else "home-page"
        base = f"{site}-{page or 'home-page'}"
        key, number = base, 2
        while key in self.records:
            key, number = f"{base}-{number}", number + 1
        return key

    def web_page(self, link: str, title: str | None, nation: str, author: str, basis_note: str) -> str:
        known = self.by_link.get(normalize(link))
        if known:
            self.note_use(known, nation)
            return known
        key = self.new_key(link)
        record = {
            "key": key,
            "kind": "web-page",
            "citation": {
                "type": "webpage",
                "title": title or "Home page",
                "author": [{"literal": author}],
                "container-title": f"{author} website",
                "URL": link,
                "accessed": {"date-parts": date_parts(CHECKED)},
            },
            "original_link": link,
            "retrieved": CHECKED,
            "archives": [],
            "history": {"status": "live", "last_checked": CHECKED},
            "rights": {
                "status": "no-permission-needed",
                "basis": "link-only",
                "basis_note": basis_note,
                "redistribution": False,
            },
            "tribes": [nation],
            "found_in": [SESSION],
        }
        if not title:
            record["notes"] = "The page gave no title when it was read; 'Home page' stands in for one."
        self.records[key] = record
        self.by_link[normalize(link)] = key
        self.changed.add(key)
        return key

    def law(self, name: str) -> str:
        law = LAWS[name]
        known = self.by_link.get(normalize(law["link"]))
        if known:
            self.note_use(known, law["tribe"])
            return known
        citation = {"type": "legislation", "title": law["title"], "author": [{"literal": law["author"]}], "URL": law["link"]}
        if law.get("issued"):
            citation["issued"] = {"date-parts": [law["issued"]]}
        citation["accessed"] = {"date-parts": date_parts(CHECKED)}
        record = {
            "key": name,
            "kind": "tribal-code",
            "citation": citation,
            "original_link": law["link"],
            "retrieved": CHECKED,
            "archives": [],
            "history": {"status": "live", "last_checked": CHECKED},
            "rights": {
                "status": "no-permission-needed",
                "basis": "government-edict",
                "basis_note": "The nation's own law; the provision on using its seal or emblem is quoted briefly and the law is linked.",
                "redistribution": False,
            },
            "tribes": [law["tribe"]],
            "found_in": [SESSION],
        }
        if law.get("notes"):
            record["notes"] = law["notes"]
        self.records[name] = record
        self.by_link[normalize(law["link"])] = name
        self.changed.add(name)
        return name

    def database(self) -> str:
        if DATABASE_SOURCE not in self.records:
            self.records[DATABASE_SOURCE] = {
                "key": DATABASE_SOURCE,
                "kind": "dataset",
                "citation": {
                    "type": "dataset",
                    "title": "Native American Tribal Insignia Database",
                    "author": [{"literal": "United States Patent and Trademark Office"}],
                    "URL": "https://www.uspto.gov/trademarks/laws/native-american-tribal-insignia",
                    "accessed": {"date-parts": date_parts(CHECKED)},
                },
                "original_link": "https://www.uspto.gov/trademarks/laws/native-american-tribal-insignia",
                "retrieved": CHECKED,
                "archives": [],
                "history": {"status": "live", "last_checked": CHECKED},
                "rights": {
                    "status": "no-permission-needed",
                    "basis": "us-government-work",
                    "basis_note": "Records of a federal agency. Only the facts of each entry (serial number, words, filing date) are recorded; the insignia images belong to the nations.",
                    "redistribution": False,
                },
                "found_in": [SESSION],
                "notes": "Searched in the USPTO trademark search system with the query nonRegistration:\"Native American Tribal Insignia\" (185 entries on 2026-11-21). Each entry's record is at tsdr.uspto.gov under its serial number.",
            }
            self.changed.add(DATABASE_SOURCE)
        return DATABASE_SOURCE

    def save(self) -> None:
        for key in sorted(self.changed):
            path = SOURCES / folder(key) / f"{key}.yaml"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(dump(self.records[key]), encoding="utf-8")


def reuse_status(signals: list[dict]) -> str:
    """The rule in docs/official-images.md: any block wins, then anything unchecked, then conditions."""
    effects = {signal["effect"] for signal in signals}
    if "blocks-reuse" in effects:
        return "restricted"
    if "unverified" in effects:
        return "needs-checking"
    if "allows-with-conditions" in effects:
        return "conditions-apply"
    return "no-restriction-found"


def insert_after(record: dict, anchor_keys: list[str], new: dict) -> dict:
    """Return the record with new keys placed after the last present anchor key."""
    for key in new:
        record.pop(key, None)
    anchor = next((key for key in reversed(anchor_keys) if key in record), None)
    result = {}
    if anchor is None:
        result.update(new)
    for key, value in record.items():
        result[key] = value
        if key == anchor:
            result.update(new)
    return result


def main() -> None:
    images = json.loads((RAW / "official-images.json").read_text(encoding="utf-8"))
    entries = json.loads((RAW / "tribal-insignia-database.json").read_text(encoding="utf-8"))
    sources = Sources()
    profiles = {path.stem: path for path in TRIBES.glob("*/*.yaml")}
    updates: dict[str, dict] = {}

    for nation in images:
        path = profiles[nation["id"]]
        profile = yaml.safe_load(path.read_text(encoding="utf-8"))
        author = profile["names"]["official"]
        image = nation["image"]
        page_key = sources.web_page(
            image["page"], image.get("page_title"), nation["id"], author,
            "Cited and linked for where the nation publishes its seal, emblem, flag or logo. A private "
            "copy of the image is kept for review and is not redistributed; whether it may be shown is "
            "recorded with the image in the nation's profile (official_images, reuse).",
        )
        signals = []
        for found in nation["signals"]:
            signal = {"kind": found["kind"], "effect": found["effect"]}
            if found.get("quote"):
                signal["quote"] = found["quote"]
            if found.get("link"):
                signal["link"] = found["link"]
            if found["kind"] in PAGE_SIGNALS and found.get("link"):
                signal["source"] = sources.web_page(
                    found["link"], found.get("page_title"), nation["id"], author,
                    "Cited and linked for what the nation's website says about reusing its content; "
                    "the relevant sentence is quoted briefly.",
                )
            elif found["kind"] == "tribal-law" and found.get("law") in LAWS:
                signal["source"] = sources.law(found["law"])
                signal["link"] = LAWS[found["law"]]["link"]
            elif found["kind"] == "tribal-insignia-database":
                signal["source"] = sources.database()
            if signal.get("source"):
                signal["verification"] = "read-in-full"
            for field in ("locator", "serial_number", "note"):
                if found.get(field):
                    signal[field] = found[field]
            signals.append(signal)
        item = {
            "kind": image["kind"],
        }
        if image.get("alternative_text"):
            item["alternative_text"] = image["alternative_text"]
        item.update({
            "image_link": image["image_link"],
            "retrieved": nation["retrieved"],
            "media_type": image["media_type"],
            "sha256": image["sha256"],
            "private_copy": image["private_copy"],
            "reuse": {"status": reuse_status(signals), "checked": CHECKED, "signals": signals},
            "source": page_key,
            "confidence": "high",
            "as_of": nation["retrieved"],
            "verification": "read-in-full",
        })
        if image.get("found_by") == "browser":
            item["note"] = "Found by rendering the page in a browser; the page draws its logo with JavaScript."
        updates.setdefault(nation["id"], {})["official_images"] = [item]

    database_key = sources.database() if entries else None
    for entry in entries:
        fact = {"serial_number": entry["serial_number"]}
        if entry.get("wordmark"):
            fact["wordmark"] = entry["wordmark"]
        fact["filed"] = entry["filed"]
        fact["record_link"] = (
            f"https://tsdr.uspto.gov/#caseNumber={entry['serial_number']}&caseType=SERIAL_NO&searchType=statusSearch"
        )
        fact["design_compared"] = entry["design_compared"]
        if entry.get("private_copy"):
            fact["private_copy"] = entry["private_copy"]
        fact.update({"source": database_key, "confidence": "high", "as_of": CHECKED, "verification": "bulk-import",
                     "locator": f"Serial number {entry['serial_number']}"})
        updates.setdefault(entry["id"], {}).setdefault("tribal_insignia_database_entries", []).append(fact)
        sources.note_use(database_key, entry["id"])

    for nation, new in sorted(updates.items()):
        path = profiles[nation]
        profile = yaml.safe_load(path.read_text(encoding="utf-8"))
        ordered = {key: new[key] for key in ("official_images", "tribal_insignia_database_entries") if key in new}
        profile = insert_after(profile, ["states", "census_areas", "population", "contacts"], ordered)
        path.write_text(dump(profile), encoding="utf-8")
    sources.save()
    print(f"{len(updates)} profiles updated; {len(sources.changed)} source records written or updated")


if __name__ == "__main__":
    main()
