#!/usr/bin/env python3
"""Self-governance and federal programs on nation profiles.

Turns the participant lists gathered in research/self-governance/<date>/
(research/analyses/2026-11-26-self-governance-programs.md) into
`federal_programs` facts on nation profiles and entries in each federal
nation's `federal-ties` search log. Steps:

  match    Write research/self-governance/crosswalk.csv: every name on every
           list, the profile it names (or none) and how that was decided.
           Rows already decided by a person or a review keep their decision.
  batch    Write research/self-governance/<date>-batch.json for
           scripts/jurisdiction/apply.py from the lists and the crosswalk.
  sources  Write the source records the facts cite and save private copies
           (SELF_GOVERNANCE_DOWNLOADS may name a folder of files already fetched).

Usage:
  python3 scripts/tribes/federal_programs.py match
  python3 scripts/tribes/federal_programs.py batch
  python3 scripts/tribes/federal_programs.py sources
  python3 scripts/jurisdiction/apply.py research/self-governance/2026-11-26-batch.json

Officials' names, titles and email addresses in Interior's 477 data service
are never read into the project (charter, commitment 1).
"""
import csv
import os
import difflib
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
DATE = "2026-11-26"
LISTS = ROOT / "research" / "self-governance" / DATE
CROSSWALK = ROOT / "research" / "self-governance" / "crosswalk.csv"
BATCH = ROOT / "research" / "self-governance" / f"{DATE}-batch.json"
SESSION = "2026-11-26-self-governance-programs"
CAPTURES = Path("/mnt/project-files/research/captures/self-governance")

# Each list: file, the column with the name, the source key its facts cite.
LIST_FILES = {
    "interior": ("doi-self-governance-tribes-2024-07-24.csv", "name"),
    "health": ("ihs-self-governance-tribes-2025-07-01.csv", "name"),
    "plan-477": ("pl-102-477-plans.csv", "name"),
    "housing": ("hud-ihbg-fy2026-formula-allocations.csv", "recipient"),
    "smaller": ("smaller-programs.csv", "name"),
    "spending-interior": ("usaspending-fy2025-15-022-doi-tribal-self-governance.csv", "recipient_name"),
    "spending-health-compacts": ("usaspending-fy2025-93-210-ihs-self-governance-compacts.csv", "recipient_name"),
    "spending-health-contracts": ("usaspending-fy2025-93-441-ihs-self-determination-contracts.csv", "recipient_name"),
}

# Words that carry no identity when two names are compared.
STOP = (r"\b(the|of|and|tribe|tribes|tribal|indians?|nation|band|bands|community|reservation|rancheria|incorporated|inc|"
        r"council|village|native|federally|recognized|government|traditional|"
        r"alabama|alaska|arizona|california|colorado|connecticut|florida|idaho|iowa|kansas|louisiana|maine|massachusetts|"
        r"michigan|minnesota|mississippi|montana|nebraska|nevada|new mexico|new york|north carolina|north dakota|oklahoma|"
        r"oregon|rhode island|south carolina|south dakota|texas|utah|virginia|washington|wisconsin|wyoming)\b")


def norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower()).encode("ascii", "ignore").decode()
    text = text.replace("&", " and ").replace("’", "'")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", text)).strip()


def loose(text: str) -> str:
    text = re.sub(r"\(.*?\)", " ", text)
    return re.sub(r"\s+", " ", re.sub(STOP, " ", norm(text))).strip()


def profiles() -> dict[str, dict]:
    found = {}
    for path in sorted((ROOT / "content" / "tribes").glob("*/*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if not any(fact.get("type") == "federal" for fact in record.get("recognition") or []):
            continue
        names = record.get("names") or {}
        all_names = [names.get("official", "")]
        all_names += [entry["name"] for entry in names.get("aliases") or [] if entry.get("name")]
        all_names += [entry["name"] for entry in names.get("former") or [] if entry.get("name")]
        states = sorted({fact.get("state") for fact in record.get("states") or [] if fact.get("state")})
        found[record["id"]] = {"names": [name for name in all_names if name], "states": states, "official": names.get("official", "")}
    return found


def housing_rows_2025() -> dict[str, str]:
    """Row names of HUD's fiscal year 2025 list already matched to profiles (population facts)."""
    known = {}
    for path in sorted((ROOT / "content" / "tribes").glob("*/*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        for fact in (record.get("population") or []):
            if fact.get("source") == "hud-indian-housing-block-grant-fy2025-final-allocation":
                match = re.search(r"row '([^']+)'", fact.get("locator", ""))
                if match:
                    known[norm(match.group(1))] = record["id"]
    return known


def read_list_file(file: str) -> list[dict]:
    with open(LISTS / file, encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def read_list(name: str) -> list[dict]:
    return read_list_file(LIST_FILES[name][0])


def match() -> None:
    people = profiles()
    exact, loose_index = {}, {}
    for identifier, entry in people.items():
        for name in entry["names"]:
            exact.setdefault(norm(name), identifier)
            loose_index.setdefault(loose(name), set()).add(identifier)
    housing_2025 = housing_rows_2025()
    previous = {}
    if CROSSWALK.exists():
        with open(CROSSWALK, encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                previous[(row["list"], row["name"])] = row
    rows = []
    for list_name, (file, column) in LIST_FILES.items():
        seen = set()
        for item in read_list(list_name):
            name = item[column]
            state = item.get("state", "")
            if name in seen:
                continue
            seen.add(name)
            old = previous.get((list_name, name))
            if old and old["decided_by"] != "script":
                rows.append(old)
                continue
            profile, method = "", "none"
            if norm(name) in exact:
                profile, method = exact[norm(name)], "exact"
            elif list_name == "housing" and norm(name) in housing_2025:
                profile, method = housing_2025[norm(name)], "housing-2025-row"
            else:
                candidates = loose_index.get(loose(name), set())
                if state:
                    candidates = {c for c in candidates if state in people[c]["states"]} or candidates
                if len(candidates) == 1 and loose(name):
                    profile, method = next(iter(candidates)), "loose"
                else:
                    close = difflib.get_close_matches(loose(name), list(loose_index), 1, 0.88) if loose(name) else []
                    if close and len(loose_index[close[0]]) == 1:
                        profile, method = next(iter(loose_index[close[0]])), "close"
            accept = "yes" if method in ("exact", "housing-2025-row") else ""
            rows.append({"list": list_name, "name": name, "state": state, "profile": profile,
                         "profile_name": people.get(profile, {}).get("official", ""), "method": method,
                         "accept": accept, "decided_by": "script", "note": ""})
    with open(CROSSWALK, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["list", "name", "state", "profile", "profile_name", "method", "accept", "decided_by", "note"], lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    counts = {}
    for row in rows:
        counts[(row["list"], row["method"])] = counts.get((row["list"], row["method"]), 0) + 1
    for key in sorted(counts):
        print(*key, counts[key])


# The source record each list's facts cite.
SOURCES = {
    "interior": "bia-office-of-self-governance-tribes-2024-07-24",
    "health": "indian-health-service-self-governance-tribes",
    "plan-477": "bia-pl-102-477-plan-directory",
    "housing": "hud-ihbg-fy2026-formula-allocations",
    "spending-interior": "usaspending-fy2025-assistance-listing-15-022",
    "spending-health-compacts": "usaspending-fy2025-assistance-listing-93-210",
    "spending-health-contracts": "usaspending-fy2025-assistance-listing-93-441",
}
SMALLER_SOURCES = {
    "https://www.fns.usda.gov/fdpir/self-determination": "fns-fdpir-self-determination-demonstration-projects",
    "https://govinfo.gov/content/pkg/FR-2024-12-19/pdf/2024-30252.pdf": "federal-register-2024-30252",
    "https://ictnews.org/news/potawatomi-tribe-signs-self-governing-compact-with-transportation-department": "ict-news-2024-08-20-potawatomi-transportation-compact",
    "https://www.potawatomi.org/blog/2024/05/27/cpn-signs-compact-with-u-s-department-of-transportation/": "citizen-potawatomi-nation-2024-05-27-transportation-compact",
    "https://www.wrhi.com/2025/02/catawba-nation-signs-historic-self-governance-compact-with-usdot-196558": "wrhi-2025-02-17-catawba-transportation-compact",
}
SMALLER_PROGRAMS = {"non-bia-funding-agreement": "interior-non-bia-funding-agreement"}
# FDPIR rounds as the Food and Nutrition Service dates them.
ROUND_START = {"Round 1": "2021-10", "Round 2": "2023-08"}
SPENDING_PROGRAM = {
    "spending-interior": "interior-self-governance-compact",
    "spending-health-compacts": "indian-health-service-self-governance-compact",
    "spending-health-contracts": "isdeaa-contract-indian-health-service",
}
LIST_WORDS = {
    "interior": "Office of Self-Governance list (July 24, 2024)",
    "health": "Indian Health Service self-governance list (July 1, 2025)",
    "plan-477": "477 Plan Directory",
    "housing": "HUD housing block grant allocations (fiscal year 2026)",
    "smaller": "transportation compacts, FDPIR projects or Interior funding agreements",
    "spending-interior": "USAspending, Assistance Listing 15.022 (fiscal year 2025)",
    "spending-health-compacts": "USAspending, Assistance Listing 93.210 (fiscal year 2025)",
    "spending-health-contracts": "USAspending, Assistance Listing 93.441 (fiscal year 2025)",
}
SMALL_WORDS = {"of", "and", "the", "for", "in", "on", "at", "de", "du"}


def title_case(name: str) -> str:
    """USAspending writes recipients in capitals; the page shows them in title case."""
    if name != name.upper():
        return name
    words = []
    for index, word in enumerate(name.lower().split()):
        if word.strip("(),") in ("inc", "inc.", "corp", "corp."):
            word = word.capitalize()
        elif index and word in SMALL_WORDS:
            pass
        elif re.fullmatch(r"\(?[a-z]{2,5}\)?", word) and word.strip("()") in ("kphc",):
            word = word.upper()
        else:
            word = "-".join(part[:1].upper() + part[1:] for part in word.split("-"))
            word = re.sub(r"'([a-z])", lambda found: "'" + found.group(1).upper() if found.start() > 1 else found.group(0), word)
        words.append(word)
    text = " ".join(words).replace("D'alene", "d'Alene")
    return re.sub(r"^The (.+), The$", r"The \1", text)


def accepted() -> dict[tuple[str, str], dict]:
    with open(CROSSWALK, encoding="utf-8") as handle:
        return {(row["list"], row["name"]): row for row in csv.DictReader(handle) if row["accept"] in ("yes", "through") and row["profile"]}


def cite(row: dict, source: str, as_of: str, locator: str) -> dict:
    exact = row["method"] in ("exact", "housing-2025-row") and row["accept"] == "yes"
    fact = {"source": source, "confidence": "high" if exact else "medium", "verification": "bulk-import", "as_of": as_of, "locator": locator}
    if not exact:
        fact["note"] = f"The list's name was matched to this nation by {'a person or AI review' if row['decided_by'] != 'script' else 'name'}; the list names '{row['name']}'."
    return fact


def program_fact(program: str, row: dict, fields: dict, citation: dict) -> dict:
    fact = {"program": program, **{key: value for key, value in fields.items() if value not in (None, "", [])}}
    if row["accept"] == "through":
        fact["through"] = title_case(row["name"])
    elif row["note"].startswith("community: "):
        fact.setdefault("detail", row["note"].removeprefix("community: "))
    return {**fact, **citation}


def batch() -> None:
    decided = accepted()
    people = profiles()
    facts: list[dict] = []
    found: dict[str, set[str]] = {identifier: set() for identifier in people}

    def add(list_name: str, row: dict, fact: dict) -> None:
        facts.append({"profile": row["profile"], "key": "federal_programs", "fact": fact})
        found[row["profile"]].add(list_name)

    for item in read_list("interior"):
        row = decided.get(("interior", item["name"]))
        if row:
            add("interior", row, program_fact("interior-self-governance-compact", row, {"since": int(item["initial_year"]) if item["initial_year"].isdigit() else None},
                                              cite(row, SOURCES["interior"], "2024-07-24", f"row '{item['name']}' ({item['bia_region']} Region)")))
    for item in read_list("health"):
        row = decided.get(("health", item["name"]))
        if row:
            year = item["fiscal_year_entered"]
            add("health", row, program_fact("indian-health-service-self-governance-compact", row, {"since": int(year) if year.isdigit() else None},
                                            cite(row, SOURCES["health"], "2025-07-01", f"{item['ihs_area']}, row '{item['name']}'")))
    included: dict[str, list[str]] = {}
    for item in read_list_file("pl-102-477-integrated-programs.csv"):
        if item["program"] not in included.setdefault(item["name"], []):
            included[item["name"]].append(item["program"])
    for item in read_list("plan-477"):
        row = decided.get(("plan-477", item["name"]))
        if row:
            kind = {"Self-Governance Compact Agreement": "Carried under a self-governance compact", "Self-Determination Contract Agreement": "Carried under a self-determination contract"}.get(item["agreement_type"])
            add("plan-477", row, program_fact("pl-102-477-plan", row, {"start": item["plan_start"], "end": item["plan_expiration"], "programs_included": included.get(item["name"], []), "detail": kind},
                                              cite(row, SOURCES["plan-477"], DATE, f"PL102_477_Contracts, plan '{item['name']}'; PL102_477_PartnerEnrollment, its {len(included.get(item['name'], []))} programs")))
    for item in read_list("housing"):
        row = decided.get(("housing", item["recipient"]))
        if row:
            add("housing", row, program_fact("indian-housing-block-grant", row, {"fiscal_year": 2026, "amount": int(item["allocation_usd"]), "amount_kind": "allocation"},
                                             cite(row, SOURCES["housing"], "2026", f"{item['state']}, row '{item['recipient']}' ({item['city']})")))
    for item in read_list("smaller"):
        row = decided.get(("smaller", item["name"]))
        if not row or "not yet a compact" in item["detail"]:
            continue
        program = SMALLER_PROGRAMS.get(item["program"], item["program"])
        source = SMALLER_SOURCES[item["source_url"]]
        fields: dict = {}
        if program == "interior-non-bia-funding-agreement":
            for agency in re.sub(r" \(fiscal year 2024\)$", "", item["detail"]).split("; also "):
                add("smaller", row, program_fact(program, row, {"agency": agency, "fiscal_year": 2024}, cite(row, source, "2024-12-19", f"89 Fed. Reg. 103858, 103859-60, {agency.split(' (')[0]} agreements, '{item['name']}'")))
            continue
        if program == "fdpir-self-determination-demonstration":
            round_name = item["detail"].split(" (")[0]
            fields = {"start": ROUND_START.get(round_name), "detail": item["detail"].replace("joint project", "a joint project")}
            locator = f"{round_name} projects, '{item['name']}'"
        else:
            years = re.findall(r"\b(20\d\d)\b", item["detail"])
            fields = {"since": int(years[0]) if years else None}
            locator = f"names '{item['name']}': {item['detail'].lower()}"
        citation = cite(row, source, item["as_of"], locator)
        if program == "tribal-transportation-self-governance-compact":
            citation["confidence"] = "medium"  # news reports, not the Department's own list
        add("smaller", row, program_fact(program, row, fields, citation))
    for list_name, program in SPENDING_PROGRAM.items():
        for item in read_list(list_name):
            row = decided.get((list_name, item["recipient_name"]))
            if row:
                add(list_name, row, program_fact(program, row, {"fiscal_year": 2025, "amount": round(float(item["obligations_usd"])), "amount_kind": "obligations"},
                                                 cite(row, SOURCES[list_name], "2025", f"Assistance Listing {item['assistance_listing']}, recipient '{item['recipient_name']}' (UEI {item['uei']}), Oct. 1, 2024 to Sept. 30, 2025")))
    searches = []
    for identifier in sorted(people):
        lists = [LIST_WORDS[name] for name in LIST_FILES if name in found[identifier]]
        searches.append({"profile": identifier, "topic": "federal-ties", "status": "found" if lists else "none-found", "entry": {
            "date": DATE, "searched_by": "Claude (AI assistant)", "method": "script", "place_kind": "official-list",
            "address": "research/self-governance/crosswalk.csv",
            "query": "Self-governance and federal program participant lists (scripts/tribes/federal_programs.py): " + "; ".join(LIST_WORDS.values()),
            "outcome": "found" if lists else "not-found",
            "reason": ("Named on: " + "; ".join(lists) + ".") if lists else "No list names the nation itself. A consortium or Tribal organization on a list may act for it; those are not credited to member nations.",
            **({"records": [f"research/self-governance/crosswalk.csv#{identifier}"]} if lists else {}),
        }})
    BATCH.write_text(json.dumps({"session": SESSION, "facts": facts, "searches": searches}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    counts: dict[str, int] = {}
    for entry in facts:
        counts[entry["fact"]["program"]] = counts.get(entry["fact"]["program"], 0) + 1
    for key in sorted(counts):
        print(key, counts[key])
    print("facts", len(facts), "nations", sum(1 for value in found.values() if value), "of", len(found))


# Files the study session downloaded, reused instead of fetching again when the
# environment variable names their folder.
STUDY_DOWNLOADS = Path(os.environ.get("SELF_GOVERNANCE_DOWNLOADS", "/nonexistent"))


def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def capture(key: str, url: str, suffix: str, study_file: str | None = None) -> str | None:
    """A private copy of the document under research/captures/self-governance/ in the project files."""
    CAPTURES.mkdir(parents=True, exist_ok=True)
    path = CAPTURES / f"{key}{suffix}"
    if not path.exists():
        study = STUDY_DOWNLOADS / study_file if study_file else None
        if study and study.exists():
            path.write_bytes(study.read_bytes())
        else:
            result = subprocess.run(["curl", "-sL", "-m", "90", "-A", "Mozilla/5.0", "-o", str(path), "-w", "%{http_code}", url], capture_output=True, text=True)
            if result.stdout.strip() != "200" or path.stat().st_size < 500:
                path.unlink(missing_ok=True)
                return None
    return f"research/captures/self-governance/{path.name}"


def write_source(key: str, kind: str, citation: dict, url: str, rights: str, notes: str, copy: str | None, archives: list | None = None) -> None:
    path = ROOT / "content" / "sources" / key[0] / f"{key}.yaml"
    if path.exists():
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if SESSION not in record.get("found_in", []):
            record.setdefault("found_in", []).append(SESSION)
            path.write_text(dump(record), encoding="utf-8")
        return
    government = rights == "us-government-work"
    record = {
        "key": key,
        "kind": kind,
        "citation": {**citation, "URL": url, "accessed": {"date-parts": [[2026, 11, 26]]}},
        "original_link": url,
        "retrieved": DATE,
        "archives": archives or [],
        "history": {"status": "live", "last_checked": DATE},
        "rights": {
            "status": "no-permission-needed",
            "basis": "us-government-work" if government else "fact-only",
            "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105)." if government
            else "Only facts are recorded from this source; it is cited and linked, not quoted or reproduced.",
            "redistribution": government,
        },
        "found_in": [SESSION],
        "notes": notes + (f" Private copy {copy}." if copy else ""),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dump(record), encoding="utf-8")


def sources() -> None:
    interior = "U.S. Department of the Interior, Bureau of Indian Affairs"
    osg = "https://www.bia.gov/sites/default/files/media_document/2024_self_governance_tribes_alphabetically_as_of_07.24.24.pdf"
    write_source("bia-office-of-self-governance-tribes-2024-07-24", "report",
                 {"type": "report", "title": "Self-Governance Tribes (Alphabetically) as of 07.24.24", "author": [{"literal": f"{interior}, Office of Self-Governance"}], "issued": {"date-parts": [[2024, 7, 24]]}},
                 osg, "us-government-work",
                 "The Office of Self-Governance's list of the 140 nations and consortia with Interior self-governance compacts, each with its first year and Bureau of Indian Affairs region, and the number of member governments of each consortium. Read with pdftotext.",
                 capture("bia-office-of-self-governance-tribes-2024-07-24", osg, ".pdf", "osg_alpha.pdf"))
    plans = "https://biamaps.geoplatform.gov/server/rest/services/Hosted/PL102_477_Contracts/FeatureServer/0"
    write_source("bia-pl-102-477-plan-directory", "dataset",
                 {"type": "dataset", "title": "477 Plan Directory (PL102_477_Contracts and PL102_477_PartnerEnrollment)", "author": [{"literal": f"{interior}, Office of Indian Services, Division of Workforce Development"}], "medium": "ArcGIS feature service"},
                 plans, "us-government-work",
                 "The two public map services behind the Bureau's 477 Plan Directory (https://www.bia.gov/bia/ois/dwd/477Initiative/477PlanDirectory): PL102_477_Contracts, one row per plan with its organization type, agreement type, region and plan dates (84 plans on Nov. 26, 2026), and PL102_477_PartnerEnrollment (https://biamaps.geoplatform.gov/server/rest/services/Hosted/PL102_477_PartnerEnrollment/FeatureServer/0), one row per federal program merged into a plan (686 rows). The services also hold names, titles and email addresses of Tribal and federal officials; those fields were never read into the project (charter, commitment 1), so no copy of the raw responses is kept. The plan and program fields are in research/self-governance/2026-11-26/.",
                 None)
    fns = "https://www.fns.usda.gov/fdpir/self-determination"
    write_source("fns-fdpir-self-determination-demonstration-projects", "web-page",
                 {"type": "webpage", "title": "FDPIR Self-Determination Demonstration Project", "author": [{"literal": "U.S. Department of Agriculture, Food and Nutrition Service"}]},
                 fns, "us-government-work",
                 "Names the Tribal organizations in each round of the demonstration (round 1 from October 2021, round 2 from August 2023), the foods each buys and its vendors. Read in full.",
                 capture("fns-fdpir-self-determination-demonstration-projects", fns, ".html", "fns_sd.html"))
    for listing, title, study in (("15.022", "Tribal Self-Governance", "usa_15.022.json"), ("93.210", "Tribal Self-Governance Program: IHS Compacts/Funding Agreements", "usa_93.210.json"), ("93.441", "Indian Self-Determination", "usa_93.441.json")):
        key = f"usaspending-fy2025-assistance-listing-{listing.replace('.', '-')}"
        write_source(key, "dataset",
                     {"type": "dataset", "title": f"Recipients of Assistance Listing {listing} ({title}), fiscal year 2025", "author": [{"literal": "U.S. Department of the Treasury, Bureau of the Fiscal Service, USAspending.gov"}], "medium": "API"},
                     "https://api.usaspending.gov/api/v2/search/spending_by_category/recipient/", "us-government-work",
                     f"Total obligations to each recipient under Assistance Listing {listing}, Oct. 1, 2024 to Sept. 30, 2025, from the USAspending API (spending_by_category/recipient, filtered by program number and period). Obligations as agencies reported them, which can differ from a program's own funding figures.",
                     capture(key, "", ".json", study))
    news = (
        ("ict-news-2024-08-20-potawatomi-transportation-compact", "https://ictnews.org/news/potawatomi-tribe-signs-self-governing-compact-with-transportation-department", "Potawatomi tribe signs self-governing compact with Transportation Department", "ICT News", [2024, 8, 20], "ict.html",
         "Names the four nations with Tribal Transportation Self-Governance Program compacts by August 2024: the Cherokee Nation (the first, 2022), Ohkay Owingeh, the Citizen Potawatomi Nation and the Forest County Potawatomi Community."),
        ("citizen-potawatomi-nation-2024-05-27-transportation-compact", "https://www.potawatomi.org/blog/2024/05/27/cpn-signs-compact-with-u-s-department-of-transportation/", "CPN signs compact with U.S. Department of Transportation", "Citizen Potawatomi Nation", [2024, 5, 27], None,
         "The nation's own news of its compact under the Tribal Transportation Self-Governance Program."),
        ("wrhi-2025-02-17-catawba-transportation-compact", "https://www.wrhi.com/2025/02/catawba-nation-signs-historic-self-governance-compact-with-usdot-196558", "Catawba Nation signs historic self-governance compact with USDOT", "WRHI", [2025, 2, 17], "catawba.html",
         "Reports the Catawba Nation's compact under the Tribal Transportation Self-Governance Program, the fifth."),
    )
    for key, url, title, author, issued, study, notes in news:
        write_source(key, "web-page", {"type": "article-newspaper" if author != "Citizen Potawatomi Nation" else "webpage", "title": title, "author": [{"literal": author}], "issued": {"date-parts": [issued]}},
                     url, "fact-only", notes + " The Department of Transportation's own program pages refused requests from the cloud (HTTP 403), so news reports stand in for its list.", capture(key, url, ".html", study))
    for key in ("indian-health-service-self-governance-tribes", "hud-ihbg-fy2026-formula-allocations", "federal-register-2024-30252"):
        write_source(key, "", {}, "", "", "", None)
    print("sources written")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "match":
        match()
    elif command == "batch":
        batch()
    elif command == "sources":
        sources()
    else:
        raise SystemExit(__doc__)
