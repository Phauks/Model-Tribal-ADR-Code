"""Record every Justice of the Supreme Court of the United States and when each served.

The Court's own list, "Justices 1789 to Present" (supremecourt.gov), gives
each Member's state, the President who appointed them, the date they took the
judicial oath (which the Court counts as the start of service) and the date
their service ended. The Federal Judicial Center's Biographical Directory of
Article III Federal Judges (fjc.gov, federal-judicial-service.csv) adds the
seat each appointment filled, so a Justice's predecessor can be named, the
statute that created a new seat, and how the service ended (death,
resignation, retirement, or becoming Chief Justice).

Dates come from the Court's list; where the Directory's termination date is
the start of retirement (senior status), the Court's date is kept and the
service is recorded as ending in retirement.

Writes content/supreme-court/justices.yaml. Run from the repository root:

    python3 scripts/law/supreme_court_justices.py
"""

from __future__ import annotations

import csv
import datetime
import html
import io
import pathlib
import re
import sys
import urllib.request

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "content" / "supreme-court" / "justices.yaml"
COURT_LIST = "https://www.supremecourt.gov/about/members_text.aspx"
DIRECTORY = "https://www.fjc.gov/sites/default/files/history/federal-judicial-service.csv"

ENDINGS = {
    "Death": "died",
    "Resignation": "resigned",
    "Retirement": "retired",
    "Appointment to Another Judicial Position": "became Chief Justice",
    "Recess Appointment-Not Confirmed": "not confirmed",
}


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "research-script"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8-sig")


def text(cell: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", cell))).strip()


def iso(date: str) -> str | None:
    date = date.strip().rstrip("*").strip()
    if not date:
        return None
    date = re.sub(r"(\w+ \d+)\s*,?\s*(\d{4})", r"\1, \2", date)
    return datetime.datetime.strptime(date, "%B %d, %Y").date().isoformat()


def display_name(listed: str) -> str:
    """ "Roberts, John G., Jr." -> "John G. Roberts, Jr." """
    family, *rest = [part.strip() for part in listed.split(",")]
    suffix = [part for part in rest if part in ("Jr.", "Sr.")]
    given = [part for part in rest if part not in ("Jr.", "Sr.")]
    return " ".join([*given, family]) + (f", {suffix[0]}" if suffix else "")


def court_list() -> list[dict]:
    page = fetch(COURT_LIST)
    members: list[dict] = []
    role = None
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", page, flags=re.S):
        cells = [text(cell) for cell in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, flags=re.S)]
        if cells and cells[0] == "":
            cells = cells[1:]
        if not cells:
            continue
        if cells[0] == "Name":
            role = "Chief Justice" if role is None else "Associate Justice"
            continue
        if role is None or len(cells) < 5:
            continue
        listed, state, president, oath, ended = cells[:5]
        note = re.search(r"\(([abc])\)", oath)
        members.append(
            {
                "listed": listed,
                "role": role,
                "state": state,
                "president": president,
                "oath": iso(re.sub(r"\([abc]\)", "", oath)),
                "oath_note": note.group(1) if note else None,
                "left": iso(ended),
                "elevated": ended.strip().endswith("*"),
            }
        )
    return members


def directory() -> list[dict]:
    rows = csv.DictReader(io.StringIO(fetch(DIRECTORY)))
    return [row for row in rows if row["Court Type"] == "Supreme Court"]


def match(member: dict, rows: list[dict]) -> dict | None:
    family = member["listed"].split(",")[0].strip()
    year = int(member["oath"][:4])
    found = []
    for row in rows:
        if row["Judge Name"].split(",")[0].strip() != family or row["Appointment Title"] != member["role"]:
            continue
        start = (row["Commission Date"] or row["Recess Appointment Date"]).strip()
        if start and abs(int(start[:4]) - year) <= 1:
            found.append(row)
    return found[0] if len(found) == 1 else None


def main() -> int:
    members = court_list()
    rows = directory()
    justices = []
    for member in members:
        row = match(member, rows)
        if row is None:
            print(f"no Directory match for {member['listed']} ({member['role']})", file=sys.stderr)
            return 1
        seat = row["Seat ID"].strip()
        ending = ENDINGS.get(row["Termination"].strip()) if member["left"] else None
        senior = row["Senior Status Date"].strip()
        if member["left"] and senior and abs((datetime.date.fromisoformat(senior) - datetime.date.fromisoformat(member["left"])).days) <= 31:
            ending = "retired"
        if member["elevated"]:
            ending = "became Chief Justice"
        statute = row["Statute Authorizing New Seat"].strip()
        justice = {
            "name": display_name(member["listed"]),
            "listed": member["listed"],
            "role": member["role"],
            "state": member["state"],
            "appointed_by": row["Appointing President"].strip(),
            "oath": member["oath"],
        }
        if member["oath_note"]:
            justice["oath_note"] = member["oath_note"]
        if member["left"]:
            justice["left"] = member["left"]
            justice["ending"] = ending
        justice["seat"] = seat
        if statute:
            justice["new_seat"] = statute
        justices.append(justice)
    # A seat's holders in order: the Directory numbers them (SCT0603 is the third holder of seat 06).
    for justice in justices:
        number, place = justice["seat"][3:5], int(justice["seat"][5:])
        before = [other for other in justices if other["seat"] == f"SCT{number}{place - 1:02d}"]
        if before:
            justice["follows"] = before[0]["name"]
    document = {
        "sources": {
            "service": "supreme-court-justices-1789-to-present",
            "seats": "federal-judicial-center-biographical-directory",
        },
        "checked": datetime.date.today().isoformat(),
        "justices": justices,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    header = "# Generated by scripts/law/supreme_court_justices.py from the Court's list and the Federal Judicial Center's Directory. Do not edit by hand.\n"
    OUTPUT.write_text(header + yaml.safe_dump(document, sort_keys=False, allow_unicode=True, width=1000), encoding="utf-8")
    print(f"wrote {len(justices)} appointments to {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
