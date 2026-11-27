"""Record each Supreme Court Justice's life and each appointing President.

Builds content/supreme-court/people.yaml from:

- content/supreme-court/justices.yaml (built by supreme_court_justices.py from
  the Court's own list), for who served and who appointed them;
- the Federal Judicial Center's Biographical Directory of Article III Federal
  Judges (fjc.gov: judges.csv, education.csv, professional-career.csv), for
  birth, death, schooling, career before the Court, other federal judicial
  service, each Supreme Court nomination and confirmation, and the party of
  the appointing President;
- the Library of Congress, "Presidents of the United States: Chronological
  List" (guides.loc.gov), for the years each President served.

Pictures of each person are not taken from here: each is checked by hand
against the record of the library, archive or museum that holds the original
and kept in content/supreme-court/pictures.yaml
(scripts/law/supreme_court_pictures.py).

Run from the repository root:

    python3 scripts/law/supreme_court_people.py [--cache DIRECTORY]
"""

from __future__ import annotations

import argparse
import csv
import datetime
import html
import io
import pathlib
import re
import sys
import time
import urllib.request

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
JUSTICES = ROOT / "content" / "supreme-court" / "justices.yaml"
OUTPUT = ROOT / "content" / "supreme-court" / "people.yaml"
DIRECTORY = "https://www.fjc.gov/sites/default/files/history/"
PRESIDENT_LIST = "https://guides.loc.gov/presidents-portraits/chronological"
INAUGURATIONS = "https://www.inaugural.senate.gov/past-inaugural-ceremonies/"
AGENT = "model-tribal-adr-code research script (supreme_court_people.py)"
STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California", "CO": "Colorado",
    "CT": "Connecticut", "DE": "Delaware", "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia",
    "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts",
    "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri", "MT": "Montana",
    "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico",
    "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota",
    "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington",
    "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
}


def fetch(url: str, cache: pathlib.Path | None, name: str | None = None) -> str:
    if cache and name and (cache / name).exists():
        return (cache / name).read_bytes().decode("utf-8-sig")
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": AGENT})
            with urllib.request.urlopen(request, timeout=180) as response:
                content = response.read()
            break
        except Exception as problem:  # rate limits and dropped connections: wait and try again
            if attempt == 3:
                raise
            print(f"retrying {url[:80]}: {problem}", file=sys.stderr)
            time.sleep(30 * (attempt + 1) if "429" in str(problem) else 5 * (attempt + 1))
    if cache and name:
        cache.mkdir(parents=True, exist_ok=True)
        (cache / name).write_bytes(content)
    return content.decode("utf-8-sig")


def csv_rows(name: str, cache: pathlib.Path | None) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(fetch(DIRECTORY + name, cache, name))))


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower().replace("'", "")).strip("-")


def day(year: str, month: str, dayof: str) -> str | None:
    if not clean(year):
        return None
    if not clean(month):
        return clean(year)
    if not clean(dayof):
        return f"{int(year):04d}-{int(month):02d}"
    return f"{int(year):04d}-{int(month):02d}-{int(dayof):02d}"


def place(city: str, state: str) -> str | None:
    city, state = clean(city), clean(state)
    state = STATES.get(state, state)
    return ", ".join(part for part in (city, state) if part) or None


def plain(markup: str) -> str:
    return clean(html.unescape(re.sub(r"<[^>]+>", " ", markup or "")))


def president_years(cache: pathlib.Path | None) -> dict[str, list[list[int]]]:
    """Each President's years in office, from the Library of Congress list (a row per Vice President)."""
    page = fetch(PRESIDENT_LIST, cache, "loc-presidents.html")
    spans: dict[str, list[list[int]]] = {}
    for row in re.findall(r"<tr>(.*?)</tr>", page, flags=re.S):
        cells = [plain(cell) for cell in re.findall(r"<td[^>]*>(.*?)</td>", row, flags=re.S)]
        match = re.fullmatch(r"(\d{4})(?:-(\d{4}))?", cells[0]) if len(cells) >= 2 else None
        if not match:
            continue
        start, end, name = int(match.group(1)), int(match.group(2) or match.group(1)), re.sub(r"\s*\d+$", "", cells[1])
        runs = spans.setdefault(name, [])
        if runs and start <= runs[-1][1]:
            runs[-1][1] = max(runs[-1][1], end)
        else:
            runs.append([start, end])
    return spans


def latest_inauguration(cache: pathlib.Path | None) -> tuple[str, str]:
    """The President most recently sworn in and the day, from the Joint Congressional Committee on Inaugural Ceremonies."""
    text = plain(fetch(INAUGURATIONS, cache, "inaugurations.html"))
    match = re.search(r"\d+(?:st|nd|rd|th) Inaugural Ceremonies President (.+?) and Vice President .+? ((?:January|March) \d{1,2}, \d{4})", text)
    if not match:
        raise SystemExit("no inauguration found in the Committee's list")
    return match.group(1), datetime.datetime.strptime(match.group(2), "%B %d, %Y").date().isoformat()


def name_parts(name: str) -> tuple[str, str, str]:
    """First name, middle initials and surname: "George H.W. Bush" -> ("george", "hw", "bush")."""
    words = re.sub(r",?\s+(?:Jr\.|Sr\.)$", "", name).replace(".", ". ").split()
    words = [word.strip(".").lower() for word in words if word.strip(".")]
    return words[0], "".join(word[0] for word in words[1:-1]), words[-1]


# Names the Court's list gives that the other sources spell another way.
PRESIDENT_ALIASES = {
    "William J. Clinton": ["Bill Clinton"],
    "Joseph R. Biden": ["Joe Biden"],
    "Gerald Ford": ["Gerald R. Ford"],
    "Ulysses Grant": ["Ulysses S. Grant"],
    "Harry S Truman": ["Harry S. Truman"],
    "Franklin D. Roosevelt": ["Franklin Delano Roosevelt"],
    "Ronald Reagan": ["Ronald W. Reagan"],
    "William H. Taft": ["William Howard Taft"],
    "Donald J. Trump": ["Donald Trump"],
    "Richard M. Nixon": ["Richard Nixon"],
    "Herbert Hoover": ["Herbert C. Hoover"],
}


def same_president(court_name: str, other: str) -> bool:
    for candidate in [court_name, *PRESIDENT_ALIASES.get(court_name, [])]:
        first, middle, last = name_parts(candidate)
        other_first, other_middle, other_last = name_parts(other)
        if first == other_first and last == other_last and (middle == other_middle or not middle or not other_middle):
            if {first, last} == {"john", "adams"} and (middle or other_middle) and middle != other_middle:
                continue
            if last in ("bush", "harrison", "johnson", "roosevelt") and middle != other_middle:
                continue
            return True
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache", type=pathlib.Path, help="keep downloads here and reuse them")
    arguments = parser.parse_args()
    cache = arguments.cache

    court = yaml.safe_load(JUSTICES.read_text(encoding="utf-8"))
    judges = csv_rows("judges.csv", cache)
    education = csv_rows("education.csv", cache)
    careers = csv_rows("professional-career.csv", cache)

    # The Directory's person for each of the Court's appointments, by seat.
    by_seat: dict[str, dict] = {}
    for judge in judges:
        for number in range(1, 7):
            seat = clean(judge.get(f"Seat ID ({number})"))
            if seat.startswith("SCT"):
                by_seat[seat] = judge

    people: list[dict] = []
    for appointment in court["justices"]:
        judge = by_seat[appointment["seat"]]
        person = next((entry for entry in people if entry["directory"] == judge["nid"]), None)
        if not person:
            person = {"name": appointment["name"], "directory": judge["nid"], "judge": judge, "seats": []}
            people.append(person)
        person["seats"].append(appointment["seat"])

    names = [person["name"] for person in people]
    justices: list[dict] = []
    for person in people:
        judge = person["judge"]
        born = day(judge["Birth Year"], judge["Birth Month"], judge["Birth Day"])
        key = slug(person["name"]) if names.count(person["name"]) == 1 else f"{slug(person['name'])}-{born[:4]}"
        appointments = []
        other_service = []
        for number in range(1, 7):
            court_name = clean(judge.get(f"Court Name ({number})"))
            if not court_name:
                continue
            seat = clean(judge.get(f"Seat ID ({number})"))
            if seat.startswith("SCT"):
                # The Directory gives John Rutledge's 1795 vote as "10//14"; the Senate's
                # record of Supreme Court nominations has the roll call as 10-14
                # (rejected Dec. 15, 1795), so a doubled slash is read as one.
                ayes = re.sub(r"/+", "/", clean(judge.get(f"Ayes/Nays ({number})")))
                appointments.append({
                    "seat": seat,
                    "title": clean(judge.get(f"Appointment Title ({number})")),
                    "recess_appointment": clean(judge.get(f"Recess Appointment Date ({number})")) or None,
                    "nominated": clean(judge.get(f"Nomination Date ({number})")) or None,
                    "hearing": clean(judge.get(f"Hearing Date ({number})")) or None,
                    "confirmed": clean(judge.get(f"Confirmation Date ({number})")) or None,
                    "senate_vote": clean(judge.get(f"Senate Vote Type ({number})")) or None,
                    "ayes_nays": ayes or None,
                    "commissioned": clean(judge.get(f"Commission Date ({number})")) or None,
                    "party_of_president": clean(judge.get(f"Party of Appointing President ({number})")) or None,
                })
            else:
                other_service.append({
                    "court": court_name,
                    "title": clean(judge.get(f"Appointment Title ({number})")),
                    "appointed_by": clean(judge.get(f"Appointing President ({number})")) or None,
                    "commissioned": clean(judge.get(f"Commission Date ({number})")) or None,
                    "ended": clean(judge.get(f"Termination Date ({number})")) or None,
                    "ending": clean(judge.get(f"Termination ({number})")) or None,
                })
        for number in range(1, 5):
            text = clean(judge.get(f"Other Federal Judicial Service ({number})"))
            if text:
                other_service.append({"text": text})
        justices.append({
            "key": key,
            "name": person["name"],
            "directory": judge["nid"],
            "directory_name": ", ".join(part for part in (clean(judge["Last Name"]), " ".join(filter(None, (clean(judge["First Name"]), clean(judge["Middle Name"])))), clean(judge["Suffix"])) if part),
            "born": {key2: value for key2, value in (("date", born), ("place", place(judge["Birth City"], judge["Birth State"]))) if value},
            "died": {key2: value for key2, value in (("date", day(judge["Death Year"], judge["Death Month"], judge["Death Day"])), ("place", place(judge["Death City"], judge["Death State"]))) if value} or None,
            "education": [
                {k: v for k, v in (("school", clean(row["School"])), ("degree", clean(row["Degree"]) or None), ("year", clean(row["Degree Year"]) or None)) if v}
                for row in sorted((row for row in education if row["nid"] == judge["nid"]), key=lambda row: int(row["Sequence"]))
            ],
            "career": [
                clean(row["Professional Career"])
                for row in sorted((row for row in careers if row["nid"] == judge["nid"]), key=lambda row: int(row["Sequence"]))
                if clean(row["Professional Career"])
            ],
            "appointments": [{k: v for k, v in entry.items() if v} for entry in appointments],
            "other_federal_service": [{k: v for k, v in entry.items() if v} for entry in other_service],
        })

    # Presidents, in the order they first appointed a Justice.
    years = president_years(cache)
    sworn, sworn_on = latest_inauguration(cache)
    presidents: list[dict] = []
    for appointment in sorted(court["justices"], key=lambda entry: entry["oath"]):
        name = appointment["appointed_by"]
        if any(entry["name"] == name for entry in presidents):
            continue
        spans = next((value for other, value in years.items() if same_president(name, other)), None)
        if not spans:
            raise SystemExit(f"no years in the Library of Congress list for {name}")
        party = next(
            (entry["party_of_president"] for justice in justices for entry in justice["appointments"]
             if entry.get("party_of_president") and next(item for item in court["justices"] if item["seat"] == entry["seat"])["appointed_by"] == name),
            None,
        )
        entry = {"key": slug(name), "name": name, "years": spans, "party": party}
        if same_president(name, sworn) and int(sworn_on[:4]) > spans[-1][1]:
            # The Library of Congress list stops before the present term.
            entry["serving_since"] = sworn_on
        presidents.append(entry)

    header = (
        "# Generated by scripts/law/supreme_court_people.py from the Federal Judicial Center's Biographical Directory,\n"
        "# the Library of Congress list of Presidents and the inaugural committee's list of ceremonies. Do not edit by hand.\n"
    )
    document = {
        "sources": {
            "biography": "federal-judicial-center-biographical-directory-judges",
            "presidents": "library-of-congress-presidents-chronological-list",
            "inaugurations": "joint-congressional-committee-past-inaugural-ceremonies",
        },
        "checked": datetime.date.today().isoformat(),
        "justices": justices,
        "presidents": presidents,
    }
    OUTPUT.write_text(header + yaml.safe_dump(document, sort_keys=False, allow_unicode=True, width=1000), encoding="utf-8")
    print(f"{len(justices)} Justices, {len(presidents)} Presidents", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
