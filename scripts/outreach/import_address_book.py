"""Write SQL that seeds the private address book (site/migrations/0012_address_book.sql).

The lead author asked on Nov. 23, 2026 for the outreach list to become "the basis of our address book". This script reads
that list and the nation profiles and writes INSERT statements, one organization contact per nation and one person
contact per leader named in the federal Tribal Leaders Directory, each with the emails and phones found for it.

The output holds leaders' own addresses, so it must never be committed: write it outside the repository and load it into
the D1 database directly. The script itself holds no addresses.

Run from the repository root:

    python3 scripts/outreach/import_address_book.py \\
        --outreach /mnt/project-files/outreach/nation-emails.csv \\
        --federal federal-directory.json --alaska alaska-directory.json \\
        --out address-book.sql

--federal and --alaska are the full ArcGIS query answers (f=json, all fields) of the two directories named in
site/src/lib/server/address-book.ts, read the same day. They give each leader's directory name and the nation's next
election, which a refresh needs. Identifiers are derived from the rows, so running the output twice adds nothing.
"""

from __future__ import annotations

import argparse
import csv
import glob
import json
import re
import urllib.parse
import uuid

import yaml

NAMESPACE = uuid.UUID("6f1d7c64-5b0e-4f7a-9a7e-2d0c1a3e8b55")
FEDERAL_SOURCE = "bia-tribal-leaders-directory-2026"
ALASKA_SOURCES = {"alaska-dcra-federally-recognized-tribes-contacts"}
FEDERAL_LINK = "https://services1.arcgis.com/UxqqIfhng71wUT9x/arcgis/rest/services/TribalLeadership_Directory/FeatureServer/0"
ALASKA_LINK = "https://maps.commerce.alaska.gov/server/rest/services/Contacts/CDO_Contacts_Federally_Recognized_Tribes/MapServer/0"
STATE_HOSTS = re.compile(r"(\.gov$|\.state\.[a-z]{2}\.us$|georgiaindiancouncil\.com$)")
EMAIL = re.compile(r"^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$")


def ident(*parts: str) -> str:
    return str(uuid.uuid5(NAMESPACE, "|".join(parts)))


def sql(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def host(address: str) -> str:
    return urllib.parse.urlsplit(address).hostname or ""


def registrable(name: str) -> str:
    return ".".join(name.lower().removeprefix("www.").split(".")[-2:])


def split_emails(text: str | None) -> list[str]:
    found = []
    for part in re.split(r"[;,\s]+", (text or "").lower()):
        part = part.removeprefix("mailto:")
        if EMAIL.match(part) and part not in found:
            found.append(part)
    return found


def load_sources() -> dict[str, dict]:
    sources = {}
    for path in glob.glob("content/sources/*/*.yaml"):
        record = yaml.safe_load(open(path, encoding="utf-8"))
        citation = record.get("citation") or {}
        sources[record["key"]] = {
            "title": citation.get("title") or record["key"],
            "publisher": citation.get("publisher"),
            "link": record.get("original_link") or citation.get("URL"),
        }
    return sources


def load_profiles() -> dict[str, dict]:
    profiles = {}
    for path in glob.glob("content/tribes/*/*.yaml"):
        record = yaml.safe_load(open(path, encoding="utf-8"))
        profiles[record["id"]] = record
    return profiles


class Writer:
    def __init__(self, day: str):
        self.day = day
        self.lines: list[str] = []
        self.methods: set[tuple[str, str, str]] = set()
        self.preferred: set[tuple[str, str]] = set()
        self.counts = {"contacts": 0, "emails": 0, "phones": 0}

    def contact(self, identifier: str, kind: str, name: str, nation: str, organization: str | None, role: str | None, notes: str | None, tags: list[str]) -> None:
        stamp = f"{self.day}T00:00:00.000Z"
        self.lines.append(
            "INSERT OR IGNORE INTO contacts (identifier, kind, name, organization_identifier, nation_identifier, role, notes, created_at, updated_at, updated_by) VALUES "
            f"({sql(identifier)}, {sql(kind)}, {sql(name[:300])}, {sql(organization)}, {sql(nation)}, {sql(role)}, {sql(notes)}, {sql(stamp)}, {sql(stamp)}, NULL);"
        )
        for tag in tags:
            self.lines.append(f"INSERT OR IGNORE INTO contact_tags (contact_identifier, tag) VALUES ({sql(identifier)}, {sql(tag)});")
        self.lines.append(
            "INSERT OR IGNORE INTO contact_changes (identifier, contact_identifier, method_identifier, change, before, person_identifier, created_at) VALUES "
            f"({sql(ident('change', identifier))}, {sql(identifier)}, NULL, 'Imported from the outreach list', NULL, NULL, {sql(stamp)});"
        )
        self.counts["contacts"] += 1

    def method(self, contact: str, method: str, value: str, label: str, source_kind: str, source_label: str, source_link: str | None, directory_name: str | None, recorded: str, verified: str, election: str | None, note: str | None) -> None:
        value = value.strip().lower() if method == "email" else value.strip()
        key = (contact, method, value)
        if not value or key in self.methods:
            return
        self.methods.add(key)
        preferred = (contact, method) not in self.preferred
        self.preferred.add((contact, method))
        identifier = ident("method", contact, method, value)
        stamp = f"{self.day}T00:00:00.000Z"
        self.lines.append(
            "INSERT OR IGNORE INTO contact_methods (identifier, contact_identifier, method, value, label, source_kind, source_label, source_link, directory_name, first_recorded_on, verified_on, next_election_on, status, preferred, note, updated_at, updated_by) VALUES "
            f"({sql(identifier)}, {sql(contact)}, {sql(method)}, {sql(value)}, {sql(label)}, {sql(source_kind)}, {sql(source_label)}, {sql(source_link)}, {sql(directory_name)}, "
            f"{sql(recorded)}, {sql(verified)}, {sql(election)}, 'current', {sql(preferred)}, {sql(note)}, {sql(stamp)}, NULL);"
        )
        self.counts["emails" if method == "email" else "phones"] += 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--outreach", required=True)
    parser.add_argument("--federal", required=True)
    parser.add_argument("--alaska", required=True)
    parser.add_argument("--day", required=True, help="the day the directories were read, YYYY-MM-DD")
    parser.add_argument("--out", required=True)
    arguments = parser.parse_args()

    sources = load_sources()
    profiles = load_profiles()
    federal = [feature["attributes"] for feature in json.load(open(arguments.federal))["features"]]
    alaska = [feature["attributes"] for feature in json.load(open(arguments.alaska))["features"]]
    writer = Writer(arguments.day)

    def federal_row(email: str, locators: set[str]) -> dict | None:
        rows = [row for row in federal if email in split_emails(row.get("email"))]
        return next((row for row in rows if row.get("tribefullname") in locators), rows[0] if rows else None)

    def alaska_row(email: str, locators: set[str]) -> dict | None:
        rows = [row for row in alaska if email in split_emails(row.get("Email"))]
        return next((row for row in rows if row.get("EntityName") in locators), rows[0] if rows else None)

    for row in csv.DictReader(open(arguments.outreach, encoding="utf-8")):
        nation = row["id"]
        profile = profiles.get(nation, {})
        contacts = profile.get("contacts") or []
        locators = {fact.get("locator") for fact in contacts if fact.get("locator")}
        locators |= {match.group(1) for fact in contacts for match in [re.match(r'record "([^"]+)"', fact.get("locator") or "")] if match}
        site_hosts = {registrable(host(fact["value"])) for fact in contacts if fact["kind"] in ("website", "contact-page")}
        recognition = row["recognition"].split(";")[0]
        tags = ["nation-government"] + ({"federal": ["federally-recognized"], "state": ["state-recognized"]}.get(recognition, []))
        notes = " ".join(
            part
            for part in [
                f"Website: {row['website']}" if row["website"] else "",
                f"Contact page: {row['contact_page']}" if row["contact_page"] else "",
                row["notes"],
            ]
            if part
        ) or None
        office = ident("contact", nation, "government")
        writer.contact(office, "organization", row["name"], nation, None, "Government", notes, tags)

        # The nation's public office emails and phones, as its profile cites them.
        for fact in contacts:
            if fact["kind"] not in ("email-general", "phone"):
                continue
            source = sources.get(fact["source"], {"title": fact["source"], "publisher": None, "link": None})
            directory_name = None
            if fact["source"] == FEDERAL_SOURCE:
                kind, link = "federal-directory", FEDERAL_LINK
                directory_name = fact.get("locator")
            elif fact["source"] in ALASKA_SOURCES:
                kind, link = "alaska-directory", ALASKA_LINK
                match = re.match(r'record "([^"]+)"', fact.get("locator") or "")
                directory_name = match.group(1) if match else fact.get("locator")
            else:
                link = source["link"]
                source_host = registrable(host(link or ""))
                kind = "nation-website" if source_host in site_hosts else "state-directory" if STATE_HOSTS.search(host(link or "")) else "other"
            label = " / ".join(part for part in [source["publisher"], source["title"]] if part)
            as_of = str(fact.get("as_of") or arguments.day)
            writer.method(office, "email" if fact["kind"] == "email-general" else "phone", fact["value"], "general-office", kind, label, link, directory_name, as_of, as_of, None, None)

        # An address a state lists for the group, often a leader's; kept here only.
        for other in split_emails(row["other_official_email"]):
            if row["other_source"].startswith("State of Alaska"):
                found = alaska_row(other, locators)
                writer.method(office, "email", other, "state-listed", "alaska-directory", "State of Alaska, tribal contacts list", ALASKA_LINK, found.get("EntityName") if found else None, arguments.day, arguments.day, None, "The list's rows date from April 2026.")
            else:
                link = row["other_source"]
                kind = "nation-website" if registrable(host(link)) in site_hosts else "state-directory" if STATE_HOSTS.search(host(link)) else "other"
                writer.method(office, "email", other, "state-listed", kind, host(link) or "State list", link or None, None, arguments.day, arguments.day, None, row["notes"] or None)

        # The leader named in the federal directory, with their own address.
        # The directory field can hold several addresses; the first is the one listed first.
        leader_emails = split_emails(row["leader_email"])
        if row["leader_name"] or leader_emails:
            found = federal_row(leader_emails[0], locators) if leader_emails else None
            election = (found or {}).get("nextelection")
            election = election if election and re.match(r"^\d{4}-\d{2}-\d{2}$", election) else None
            person = ident("contact", nation, "leader")
            writer.contact(person, "person", row["leader_name"] or row["leader_title"] or "Leader", nation, office, row["leader_title"] or None, None, ["leader"])
            for leader_email in leader_emails:
                writer.method(person, "email", leader_email, "leader", "federal-directory", "Bureau of Indian Affairs / Tribal Leaders Directory", FEDERAL_LINK, (found or {}).get("tribefullname"), arguments.day, arguments.day, election, None)

    with open(arguments.out, "w", encoding="utf-8") as output:
        output.write("\n".join(writer.lines) + "\n")
    print(json.dumps(writer.counts))


if __name__ == "__main__":
    main()
