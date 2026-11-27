#!/usr/bin/env python3
"""Collect the Oklahoma Secretary of State's register of tribal compacts and agreements.

The Secretary of State files the "Tribal Compacts & Agreements executed by the
Governor's Office and Tribal Cross-Deputization Agreements"
(https://oklahoma.gov/sos/executive-legislative-records/executive-branch/tribal.html).
Its data file, https://execleg.sos.ok.gov/json/dataTribal.json, lists every
filing (document id, file number, filing date, title and a one-line
description), and each filing's scan is at
https://execleg.sos.ok.gov/documents/filelog/<id>.pdf.

Subcommands, in the order they are run:

  fetch     Download the data file to research/state-agreements/oklahoma/register.json
            and every filing's PDF into --pdfs (resumable; skips files already held).
            A filing the State's site has no file for is listed in
            research/state-agreements/oklahoma/missing-files.json, so its record says so.
  classify  Read the register (and, where given, research/state-agreements/oklahoma/
            readings.json, the parties and titles read from each description) and write
            research/state-agreements/oklahoma/filings.csv: subject, kind of filing,
            the file it adds to, the nations it names and the other parties.
  write     Write one source record per filing (content/sources/o/oklahoma-filing-<file>.yaml),
            the nation-page facts (jurisdiction_agreements) for each agreement, and the
            gaming filings' matches to the compacts the project already holds.
            Then apply the facts: python3 scripts/jurisdiction/apply.py research/state-agreements/oklahoma/nation-facts.json
  file-copies  Upload each filed PDF to the bucket (oklahoma-secretary-of-state/file-<file>.pdf)
            and add it to research/capture-index.csv with redistribution "yes" (decision record 0060).

Run from the repository root:

    python3 scripts/agreements/oklahoma_register.py fetch --pdfs DIR [--jobs 4]
    python3 scripts/agreements/oklahoma_register.py classify
    python3 scripts/agreements/oklahoma_register.py write
    python3 scripts/jurisdiction/apply.py research/state-agreements/oklahoma/nation-facts.json
    python3 scripts/agreements/oklahoma_register.py file-copies --pdfs DIR
"""

from __future__ import annotations

import argparse
import concurrent.futures
import csv
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "research" / "state-agreements" / "oklahoma"
REGISTER_URL = "https://execleg.sos.ok.gov/json/dataTribal.json"
PDF_URL = "https://execleg.sos.ok.gov/documents/filelog/{id}.pdf"
AGENT = "Mozilla/5.0 (compatible; tribal-law-research-script)"


def get(url: str, attempts: int = 4) -> bytes:
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": AGENT})
            with urllib.request.urlopen(request, timeout=90) as response:
                return response.read()
        except Exception:
            if attempt == attempts - 1:
                raise
            time.sleep(2 ** attempt * 3)
    raise RuntimeError(url)


MISSING = DATA / "missing-files.json"


def missing_files() -> dict[str, dict]:
    """The filings, by document id, whose PDF the State's site does not have: the register lists them, but their address answers "not found"."""
    return json.loads(MISSING.read_text(encoding="utf-8")) if MISSING.exists() else {}


def register() -> list[dict]:
    return json.loads((DATA / "register.json").read_text(encoding="utf-8"))


def fetch(args: argparse.Namespace) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    rows = json.loads(get(REGISTER_URL))
    rows.sort(key=lambda row: row["DOC_ID"])
    (DATA / "register.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(rows)} filings in the register")
    pdfs = Path(args.pdfs)
    pdfs.mkdir(parents=True, exist_ok=True)

    def one(row: dict) -> str:
        path = pdfs / f"{row['DOC_ID']}.pdf"
        if path.exists() and path.stat().st_size > 0:
            return "held"
        try:
            body = get(PDF_URL.format(id=row["DOC_ID"]))
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return f"missing {row['DOC_ID']}"
            return f"failed {row['DOC_ID']}: {error}"
        except Exception as error:  # noqa: BLE001
            return f"failed {row['DOC_ID']}: {error}"
        if not body.startswith(b"%PDF"):
            return f"not a PDF {row['DOC_ID']}"
        path.write_bytes(body)
        return "fetched"

    import datetime  # noqa: PLC0415
    results: dict[str, int] = {}
    missing = missing_files()
    with concurrent.futures.ThreadPoolExecutor(args.jobs) as pool:
        for row, result in zip(rows, pool.map(one, rows)):
            key = result.split(" ")[0]
            results[key] = results.get(key, 0) + 1
            if key in ("failed", "not", "missing"):
                print(result, file=sys.stderr)
            document = str(row["DOC_ID"])
            if key == "missing":
                missing.setdefault(document, {"file": row["DOC_NUM"]})["checked"] = datetime.date.today().isoformat()
            elif key in ("held", "fetched"):
                missing.pop(document, None)
    MISSING.write_text(json.dumps(dict(sorted(missing.items(), key=lambda item: int(item[0]))), indent=1) + "\n", encoding="utf-8")
    print(results)


# The nations the register names, as it spells them, matched to nation records.
# Order matters: the first pattern that matches a name wins.
NATION_PATTERNS = [
    (r"keetoowah|\bUKB\b", "united-keetoowah-band-of-cherokee-indians-in-oklahoma"),
    (r"cherokee", "cherokee-nation"),
    (r"chick?asaw|chikasaw", "the-chickasaw-nation"),
    (r"\bch[oa]c?taw|chotaw", "the-choctaw-nation-of-oklahoma"),
    (r"mus[ck]?ogee|mvskoke|\(creek\)|\bcreek (?:nation|tribe|indian)|\bcreek(?:,| and) ", "the-muscogee-nation"),
    (r"seminole", "the-seminole-nation-of-oklahoma"),
    (r"\bosage", "the-osage-nation"),
    (r"absentee", "absentee-shawnee-tribe-of-indians-of-oklahoma"),
    (r"eastern shawnee", "eastern-shawnee-tribe-of-oklahoma"),
    (r"\bshawnee tribe|loyal shawnee", "shawnee-tribe"),
    (r"potawatomi|pottawatomi(?:e)? nation|citizen band", "citizen-potawatomi-nation"),
    (r"f(?:or)?t\.? sill|\bsill apache", "fort-sill-chiricahua-warm-springs-apache-tribe"),
    (r"apache", "apache-tribe-of-oklahoma"),
    (r"comm?anche", "comanche-nation"),
    (r"kiowa", "kiowa-tribe"),
    (r"wichita", "wichita-and-affiliated-tribes"),
    (r"caddo", "caddo-nation-of-oklahoma"),
    (r"delaware nation|western delaware", "delaware-nation"),
    (r"delaware", "delaware-tribe-of-indians"),
    (r"cheyenne|arapaho", "cheyenne-and-arapaho-tribes"),
    (r"\biowa", "iowa-tribe-of-oklahoma"),
    (r"\bkaw\b|kansa", "kaw-nation"),
    (r"kickap", "kickapoo-tribe-of-oklahoma"),
    (r"\bmiami", "miami-tribe-of-oklahoma"),
    (r"modoc", "modoc-nation"),
    (r"otoe|missouria", "otoe-missouria-tribe-of-indians"),
    (r"ottawa", "ottawa-tribe-of-oklahoma"),
    (r"pawnee", "pawnee-nation-of-oklahoma"),
    (r"peoria", "peoria-tribe-of-indians-of-oklahoma"),
    (r"ponca", "ponca-tribe-of-indians-of-oklahoma"),
    (r"quapaw", "quapaw-nation"),
    (r"sac (?:and|&) fox|sac-and-fox", "sac-and-fox-nation"),
    (r"seneca", "seneca-cayuga-nation"),
    (r"thlopthlocco", "thlopthlocco-tribal-town"),
    (r"tonkawa", "tonkawa-tribe-of-indians-of-oklahoma"),
    (r"wyandott?e", "wyandotte-nation"),
    (r"alabama[- ]?quassarte|quassarte", "alabama-quassarte-tribal-town"),
    (r"kialegee", "kialegee-tribal-town"),
]
# Places named for nations ("Pottawatomie County", "City of Seminole", "Town of Apache") are not the nations.
PLACES = [
    re.compile(r"\b(?:city|town|county|village|district|board of county commissioners)\s+of\s+[A-Z][\w]*(?:\s+[A-Z][\w]*)?", re.I),
    re.compile(r"\b(?:cities|counties) of (?:[A-Z][\w.]*(?: [A-Z][\w]*)?,?\s+(?:and\s+)?)+"),
    re.compile(r"\b(?:[A-Z][\w]*,?\s+(?:and\s+)?)+(?i:counties)\b"),
    re.compile(r"\b[A-Z][\w]*\s+(?:county|co\.|city|public schools|school district|isd|police department|fire department|technology center|superfund|pd)\b", re.I),
    re.compile(r"\btar creek\b|\bbeaver creek\b", re.I),
]


def nations_named(text: str) -> list[str]:
    """Nation records named in a register line, places named after nations left out."""
    for place in PLACES:
        text = place.sub(" ", text)
    # Names with "and" in them, kept whole before the line is split at "and".
    text = re.sub(r"sac\s+(?:and|&)\s+fox", "sac-and-fox", text, flags=re.I)
    text = re.sub(r"(cheyenne|wichita|otoe)\s+(?:and|&)\s+", r"\1-", text, flags=re.I)
    found = []
    for phrase in re.split(r"[/;,]| and the | and |\.(?:\s|$)(?<!ft\. )", text):
        for pattern, nation in NATION_PATTERNS:
            if re.search(pattern, phrase, re.I):
                if nation not in found:
                    found.append(nation)
                break
    return found


SUBJECTS = [
    ("off-track-wagering", r"off[- ]track"),
    ("gaming", r"gaming|racing|horse"),
    ("tobacco-tax", r"tobacco|cigarette"),
    ("motor-fuel-tax", r"motor fuel|fuels? contract|fuel tax"),
    ("motor-vehicle-registration", r"vehicle|license tag|car tag"),
    ("hunting-and-fishing", r"hunting|fishing|wildlife"),
    ("child-welfare", r"child|icwa|foster|juvenile"),
    ("social-services", r"\btanf\b|temporary assistance|social service"),
    ("detention", r"detention|jail|incarcerat"),
    ("boxing-and-combat-sports", r"boxing|combat|athletic"),
    ("fire-management", r"burn ban|fire"),
    ("housing", r"housing"),
    ("transportation", r"transportation|road|highway|bridge"),
    ("cross-deputization", r"deputi|deputa|law enforcement|police|peace officer|sheriff|drug task"),
    ("water", r"\bwater"),
    ("environment", r"environment"),
    ("health", r"health|hospital"),
    ("education", r"education|school|universit|college"),
]


def subject_of(name: str, text: str) -> str:
    """The subject from the register's title first, then its description."""
    for field in (name, text):
        for subject, pattern in SUBJECTS:
            if re.search(pattern, field, re.I):
                return subject
    return "other"


def iso(date: str) -> str:
    month, day, year = date.split("/")
    return f"{year}-{int(month):02d}-{int(day):02d}"


FIELDS = ["file", "document", "filed", "register_title", "description", "subject", "filing", "parent", "nations",
          "other_parties", "title", "checks", "unsure"]


def classify(args: argparse.Namespace) -> None:
    """Join the script's reading of each line with the AI reader's, and mark where they differ."""
    readings = {}
    path = DATA / "readings.json"
    if path.exists():
        readings = {row["file"]: row for row in json.loads(path.read_text(encoding="utf-8"))}
    overrides = {}
    path = DATA / "settled.json"
    if path.exists():
        overrides = {int(key): value for key, value in json.loads(path.read_text(encoding="utf-8")).items()}
    rows, seen = [], set()
    for entry in register():
        number = entry["DOC_NUM"]
        if number in seen:
            continue  # the register lists a few filings twice
        seen.add(number)
        name, text = " ".join(entry["DOC_NAME"].split()), " ".join(entry["DOC_TEXT"].split())
        reading = readings.get(number, {})
        nations = nations_named(f"{name} / {text}")
        read_nations = []
        for named in reading.get("nations", []):
            for nation in nations_named(named):
                if nation not in read_nations:
                    read_nations.append(nation)
        subject = subject_of(name, text)
        checks = []
        if reading:
            checks.append("nations agree" if sorted(nations) == sorted(read_nations) else f"nations differ: script {nations}, reader {read_nations}")
            checks.append("subject agrees" if subject == reading.get("subject") else f"subject differs: script {subject}, reader {reading.get('subject')}")
        settled = overrides.get(number, {})
        if "nations" in settled:
            nations = settled["nations"]
            checks.append("nations settled by a person reading the register line")
        elif reading and sorted(nations) != sorted(read_nations):
            nations = read_nations  # checked by hand on Nov. 26, 2026: the reader was right in every case but one, settled in settled.json
        if reading and subject != reading.get("subject") and "subject" not in settled:
            subject = reading["subject"]  # checked by hand on Nov. 26, 2026: the reader's subject was the better one each time
        if "subject" in settled:
            subject = settled["subject"]
            checks.append("subject settled by a person reading the register line")
        rows.append({
            "file": number, "document": entry["DOC_ID"], "filed": iso(entry["DOC_SDATE"]), "register_title": name,
            "description": text, "subject": subject, "filing": settled.get("filing", reading.get("filing", "")),
            "parent": reading.get("parent", ""), "nations": ";".join(nations),
            "other_parties": ";".join(settled.get("other_parties", reading.get("other_parties", []))),
            "title": settled.get("title", reading.get("title", "")), "checks": "; ".join(checks), "unsure": reading.get("unsure", ""),
        })
    rows.sort(key=lambda row: row["file"])
    with open(DATA / "filings.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    differ = [row for row in rows if "differ" in row["checks"]]
    print(f"{len(rows)} filings; {len(differ)} where the script and the reader differ")


SESSION = "2026-11-26-oklahoma-state-tribal-agreements"
TODAY = "2026-11-26"
TOPIC = "oklahoma-secretary-of-state"
COLLECTION_TOPIC = "oklahoma-state-tribal-agreement"
CONTAINER = "Oklahoma Secretary of State, Tribal Compacts and Agreements"
SOURCES = ROOT / "content" / "sources"
# The nation-page heading each subject falls under (schemas/tribe.schema.json, jurisdiction_agreements).
FACT_KINDS = {"cross-deputization": "cross-deputization", "detention": "cross-deputization", "tobacco-tax": "tax-agreement",
              "motor-fuel-tax": "tax-agreement", "motor-vehicle-registration": "tax-agreement", "child-welfare": "child-welfare-agreement"}
# Filings that are agreements in their own right, as opposed to addenda, letters, approvals and notices.
FACT_FILINGS = {"agreement", "amendment", "extension"}
FILING_WORDS = {"addendum": "an addendum adding a party to an existing agreement", "amendment": "an amendment or supplement to an existing compact or agreement",
                "extension": "an extension of an existing compact or agreement", "termination": "a notice of termination or withdrawal",
                "letter": "a letter or notice, such as a notice of intent to negotiate", "approval": "an approval of another agreement",
                "rejected": "a compact the register marks rejected", "agreement": "an agreement or compact", "other": "a filing of another kind"}


def dump(value) -> str:
    import yaml  # noqa: PLC0415
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def readable(date: str) -> str:
    year, month, day = (int(part) for part in date.split("-"))
    months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
    return f"{months[month - 1]} {day}, {year}"


def nation_names() -> dict[str, str]:
    import yaml  # noqa: PLC0415
    names = {}
    for path in (ROOT / "content" / "tribes").rglob("*.yaml"):
        record = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if isinstance(record, dict) and record.get("id"):
            names[record["id"]] = (record.get("names") or {}).get("official") or record["id"]
    return names


def held_gaming_compacts() -> dict[str, list[tuple[str, str]]]:
    """The Oklahoma class III compacts the project already holds (from the Office of Indian Gaming), by nation."""
    import yaml  # noqa: PLC0415
    held: dict[str, list[tuple[str, str]]] = {}
    for path in sorted((SOURCES / "c").glob("compact-ok-*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        parts = record["citation"].get("issued", {}).get("date-parts", [[None]])[0]
        if len(parts) < 3:
            continue
        date = f"{parts[0]:04d}-{parts[1]:02d}-{parts[2]:02d}"
        for nation in record.get("tribes") or []:
            held.setdefault(nation, []).append((date, record["key"]))
    return held


def days(a: str, b: str) -> int:
    import datetime  # noqa: PLC0415
    return (datetime.date.fromisoformat(a) - datetime.date.fromisoformat(b)).days


def gaming_match(row: dict, held: dict[str, list[tuple[str, str]]]) -> str | None:
    """The held compact a class III gaming filing is the state's copy of: same nation, listed by the Office of
    Indian Gaming between 60 days before and 270 days after the state filed it (approval usually follows filing;
    the 2018 supplements were listed 52 days before the state filed them)."""
    if row["subject"] != "gaming" or row["filing"] not in ("agreement", "amendment"):
        return None
    nations = [n for n in row["nations"].split(";") if n]
    if len(nations) != 1:
        return None
    candidates = [(abs(days(date, row["filed"])), key) for date, key in held.get(nations[0], []) if -60 <= days(date, row["filed"]) <= 270]
    return min(candidates)[1] if candidates else None


def pdf_link(document: str) -> str:
    return PDF_URL.format(id=document)


def write(args: argparse.Namespace) -> None:
    import csv as csv_module  # noqa: PLC0415
    rows = list(csv_module.DictReader(open(DATA / "filings.csv", encoding="utf-8")))
    names = nation_names()
    held = held_gaming_compacts()
    missing = missing_files()
    matches, written, facts = [], 0, []
    used_matches: set[str] = set()
    for row in rows:
        number, link = int(row["file"]), pdf_link(row["document"])
        nations = [n for n in row["nations"].split(";") if n]
        match = gaming_match(row, held)
        if match and match not in used_matches:
            used_matches.add(match)
            matches.append({"file": number, "filed": row["filed"], "nation": nations[0], "held_record": match, "state_copy": link,
                            "register_title": row["register_title"], "description": row["description"]})
            continue
        key = f"oklahoma-filing-{number}"
        others = [party for party in row["other_parties"].split(";") if party]
        authors = [names.get(nation, nation) for nation in nations] + others
        title = row["title"] or row["register_title"]
        checks = []
        for check in row["checks"].split("; "):
            if not check:
                continue
            what = "nations" if check.startswith("nations") else "subject"
            label = ("Nations named in the register line: the script's reading and an AI reader's" if what == "nations"
                     else "Subject: the script's reading of the register title and an AI reader's")
            if "settled" in check:
                checks = [c for c in checks if c["check"] != label]
                checks.append({"check": label, "result": "settled", "detail": "Settled by a person reading the register line."})
            elif "differ" in check:
                checks.append({"check": label, "result": "differs", "detail": check.split(": ", 1)[1] + ". The AI reader's reading is used; checked by hand on Nov. 26, 2026."})
            else:
                checks.append({"check": label, "result": "agree"})
        kind_words = FILING_WORDS.get(row["filing"], "a filing")
        gone = missing.get(row["document"])
        copy_words = (f"The State's site has no file at this filing's address, which answered “not found” when checked on {readable(gone['checked'])}, so no copy is held or served; "
                      "this record's facts come from the register's own title and description, read by script and by an AI reader. " if gone else
                      "The filed copy is a scan with no text layer; this record's facts come from the register's own title and description, read by script and by an AI reader, not from the scan. ")
        notes = (f"Oklahoma Secretary of State file {number}, filed {readable(row['filed'])}. The register's title reads “{row['register_title']}” and its description “{row['description'].rstrip('.')}”. "
                 f"The register line reads as {kind_words}" + (f" (it names {row['parent']})" if row["parent"] else "") + ". "
                 + copy_words + "The date is the filing date, not the signing date.")
        if row["unsure"]:
            notes += f" The reader noted: {row['unsure'].rstrip('.')}."
        record = {
            "key": key,
            "kind": "intergovernmental-agreement",
            "citation": {
                "type": "document",
                "title": title,
                "author": [{"literal": author} for author in authors] or [{"literal": "State of Oklahoma"}],
                "container-title": CONTAINER,
                "number": f"File {number}",
                "URL": link,
                "accessed": {"date-parts": [[2026, 11, 26]]},
                "issued": {"date-parts": [[int(part) for part in row["filed"].split("-")]]},
            },
            "original_link": link,
            "retrieved": TODAY,
            "archives": [],
            "history": {"status": "removed", "last_checked": gone["checked"]} if gone else {"status": "live", "last_checked": TODAY},
            "rights": {
                "status": "no-permission-needed",
                "basis": "fact-only",
                "basis_note": ("Facts are recorded from the register. The State's site has no filed copy to serve." if gone else
                               "Facts are recorded from the register. The State's filed copy, a public record of the Oklahoma Secretary of State, is served on this site (decision record 0060); a nation can ask to have it taken down."),
                "redistribution": True,
            },
            **({"tribes": nations} if nations else {}),
            "jurisdictions": [{"level": "multiple", "note": "Agreement filed with the Oklahoma Secretary of State."}],
            "topics": [COLLECTION_TOPIC, row["subject"]],
            "found_in": [SESSION],
            "notes": notes,
            "review": {"status": "unverified", "by": "scripts/agreements/oklahoma_register.py", "date": TODAY,
                       "checks": checks or [{"check": "Nations and subject read from the register line", "result": "missing", "detail": "No second reading."}]},
        }
        path = SOURCES / "o" / f"{key}.yaml"
        if path.exists():
            import yaml  # noqa: PLC0415
            old = yaml.safe_load(path.read_text(encoding="utf-8"))
            if (old.get("review") or {}).get("status") == "reviewed":
                continue  # a person has read it; never written over
        path.write_text(dump(record), encoding="utf-8")
        written += 1
        if row["filing"] in FACT_FILINGS and row["subject"] not in ("gaming", "off-track-wagering"):
            for nation in nations:
                parties = [party for party in others if party] or ["State of Oklahoma"]
                fact = {"kind": FACT_KINDS.get(row["subject"], "other"), "other_party": "; ".join(parties), "agreement": title.split(": ", 1)[-1][:1].upper() + title.split(": ", 1)[-1][1:],
                        "state": "OK", "status": "unknown",
                        "detail": f"Filed with the Oklahoma Secretary of State on {readable(row['filed'])} (file {number}).",
                        "source": key, "confidence": "medium", "verification": "title-only", "locator": f"Register entry, file {number}",
                        "note": f"From the register line: “{row['description'].rstrip('.')}”. Whether it is still in force is not recorded."}
                facts.append({"profile": nation, "key": "jurisdiction_agreements", "fact": fact})
    with open(DATA / "gaming-matches.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv_module.DictWriter(handle, ["file", "filed", "nation", "held_record", "state_copy", "register_title", "description"])
        writer.writeheader()
        writer.writerows(matches)
    (DATA / "nation-facts.json").write_text(json.dumps({"session": SESSION, "facts": facts, "searches": []}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    note_matches(matches)
    print(f"{written} records written; {len(matches)} gaming filings matched to compacts already held; {len(facts)} nation-page facts")


def note_matches(matches: list[dict]) -> None:
    """Add the State's filed copy to the notes of each gaming compact already held, once."""
    for match in matches:
        path = SOURCES / "c" / f"{match['held_record']}.yaml"
        text = path.read_text(encoding="utf-8")
        if f"file {match['file']}" in text:
            continue
        sentence = (f" The State of Oklahoma's filed copy is Oklahoma Secretary of State file {match['file']}, filed {readable(match['filed'])} "
                    f"({match['state_copy']}), matched by nation and date by scripts/agreements/oklahoma_register.py and not yet compared page by page.")
        lines = text.splitlines(keepends=True)
        start = next(i for i, line in enumerate(lines) if line.startswith("notes:"))
        end = next((i for i in range(start + 1, len(lines)) if not lines[i].startswith(" ")), len(lines))
        block = "".join(lines[start:end]).rstrip("\n")
        import yaml  # noqa: PLC0415
        value = yaml.safe_load(block)["notes"] + sentence
        lines[start:end] = [dump({"notes": value})]
        path.write_text("".join(lines), encoding="utf-8")


COPY_RIGHTS = ("A state-tribal compact or agreement as filed with the Oklahoma Secretary of State, a public record: "
               "served on the website under decision record 0060; a nation can ask for removal or redaction.")


def file_copies(args: argparse.Namespace) -> None:
    """Upload each filed PDF to the bucket at oklahoma-secretary-of-state/file-<file>.pdf and add it to the capture index."""
    import csv as csv_module  # noqa: PLC0415
    import datetime  # noqa: PLC0415
    import os  # noqa: PLC0415
    sys.path.insert(0, str(ROOT / "scripts" / "captures"))
    import mirror_captures  # noqa: PLC0415
    if not mirror_captures.have_credentials():
        sys.exit("Filing copies needs R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID in the environment.")
    s3 = mirror_captures.client()
    bucket = os.environ.get("R2_BUCKET", mirror_captures.DEFAULT_BUCKET)
    rows = mirror_captures.load_index()
    by_key = {row["key"]: row for row in rows}
    overrides_path = ROOT / "research" / "capture-index-overrides.json"
    overrides = json.loads(overrides_path.read_text(encoding="utf-8")) if overrides_path.exists() else {}
    matched = {int(m["file"]): m["held_record"] for m in csv_module.DictReader(open(DATA / "gaming-matches.csv", encoding="utf-8"))}
    filings = list(csv_module.DictReader(open(DATA / "filings.csv", encoding="utf-8")))
    pdfs = Path(args.pdfs)
    today = datetime.date.today().isoformat()

    def one(row: dict):
        path = pdfs / f"{row['document']}.pdf"
        if not path.exists():
            return None
        key = f"{TOPIC}/file-{row['file']}.pdf"
        data = path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        existing = by_key.get(key)
        if not (existing and existing["sha256"] == digest):
            if mirror_captures.remote_state(s3, bucket, key) != (len(data), digest):
                s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": "application/pdf", "Metadata": {"sha256": digest, "captured": today}})
                if mirror_captures.remote_state(s3, bucket, key) != (len(data), digest):
                    raise SystemExit(f"verification failed for {key}")
        number = int(row["file"])
        record = matched.get(number, f"oklahoma-filing-{number}")
        new = {field: "" for field in mirror_captures.FIELDS}
        new.update(key=key, bytes=len(data), sha256=digest, media_type="application/pdf", topic=TOPIC,
                   title=(row["title"] or row["register_title"]) + f" (Oklahoma Secretary of State file {number})",
                   nations=row["nations"], obtained=f"Oklahoma Secretary of State register (execleg.sos.ok.gov), {TODAY}",
                   link=pdf_link(row["document"]), captured=TODAY, records=record, record_kinds="source",
                   rights=COPY_RIGHTS, redistribution="yes", keep_local="no", orphan="no")
        for field in ("redistribution", "rights"):
            if overrides.get(key, {}).get(field):
                new[field] = overrides[key][field]
        return key, new

    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        results = [result for result in pool.map(one, filings) if result]
    for key, new in results:
        if key in by_key:
            by_key[key].update(new)
        else:
            rows.append(new)
            by_key[key] = new
    mirror_captures.write_index(rows)
    print(f"{len(results)} filed copies in the bucket and the capture index")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("fetch")
    p.add_argument("--pdfs", required=True)
    p.add_argument("--jobs", type=int, default=4)
    sub.add_parser("classify")
    sub.add_parser("write")
    p = sub.add_parser("file-copies")
    p.add_argument("--pdfs", required=True)
    args = parser.parse_args()
    {"fetch": fetch, "classify": classify, "write": write, "file-copies": file_copies}[args.command](args)


if __name__ == "__main__":
    main()
