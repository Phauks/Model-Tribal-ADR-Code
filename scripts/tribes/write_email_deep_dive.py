"""Write the general office emails found in the Nov. 23, 2026 email deep dive into nation profiles.

Input: research/raw/2026-11-23/email-deep-dive.json, built from
- scripts/tribes/find_emails_deep.mjs, which read 303 nations' own websites in a browser;
- the Bureau of Indian Affairs Tribal Leaders Directory (email field);
- the State of Alaska's list of federally recognized tribes (Community Database Online contacts);
- state government pages and nations' own sites found by web search for state-recognized groups.

Claude chose one general office address per nation (an office, reception, council or
administration account, never a person's own address). The lead author decided on Nov. 23, 2026
that general office addresses are published on nation pages and that leaders' own addresses are
kept only in the private outreach list in project files, never in the repository.

For each chosen address the script adds an email-general fact (and a website fact where the
search found the nation's own site), writes the sources it needs, and adds the searches to every
searched nation's contacts search log. It inserts text and never re-dumps a profile, so prose is
not re-wrapped. Running it again adds nothing twice.

Run from the repository root: python3 scripts/tribes/write_email_deep_dive.py
"""

import glob
import json
import pathlib
import sys

import yaml

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import write_contacts as contacts  # noqa: E402  (shared helpers: sources, splice, dump)

TODAY = "2026-11-23"
SESSION = "2026-11-23-nation-email-deep-dive"
FINDINGS = pathlib.Path("research/raw/2026-11-23/email-deep-dive.json")
LOGS = pathlib.Path("research/search-logs/contacts")
BY = "Claude (AI assistant)"
FEDERAL_SOURCE = "bia-tribal-leaders-directory-2026"
ALASKA_SOURCE = "alaska-dcra-federally-recognized-tribes-contacts"
ALASKA_LINK = "https://maps.commerce.alaska.gov/server/rest/services/Contacts/CDO_Contacts_Federally_Recognized_Tribes/MapServer/0"
STATE_SEARCH = {  # state-recognized groups with no website on file, searched on the web on Nov. 23, 2026
    "cher-o-creek-intratribal-indians", "golden-hill-paugussett", "schaghticoke-tribe", "nanticoke-indian-tribe-of-delaware",
    "cherokee-of-georgia-tribal-council", "lower-muscogee-creek-tribe", "four-winds-cherokee-tribe", "louisiana-band-of-choctaw-indians",
    "hassanamisco-nipmuc-tribe", "accohannock-indian-tribe", "piscataway-indian-nation", "grand-river-band-of-ottawa-indians",
    "mackinaw-bands-of-chippewa-and-ottawa-indians", "nanticoke-lenni-lenape-tribal-nation", "powhatan-renape-nation",
    "ramapough-lenape-nation", "poospatuck-indian-nation", "chaloklowa-chickasaw-indian-people",
    "eastern-cherokee-southern-iroquois-and-united-tribes-of-south-carolina", "pee-dee-indian-nation-of-upper-south-carolina",
    "koasek-abenaki-of-the-koas", "nulhegan-band-of-the-coosuk-abenaki-nation",
}
# What the state-groups search found where it added nothing (Claude's reading of the search results).
STATE_REASONS = {
    "nanticoke-indian-tribe-of-delaware": "Found nanticokeindians.org (info@nanticokeindians.org), already the website of nanticoke-indian-association; not added, since the two records may name the same group.",
    "schaghticoke-tribe": "Found schaghticoke.com, the Schaghticoke Tribal Nation's site; Connecticut has two Schaghticoke groups and the record does not say which, so nothing was added.",
    "nulhegan-band-of-the-coosuk-abenaki-nation": "The band's site (abenakitribe.org) shows only committee addresses, and its contact page hides its address from scripts.",
    "koasek-abenaki-of-the-koas": "Found only the Koasek Traditional Band's site, run from New Hampshire, a look-alike group; the Vermont commission pages list no contacts.",
    "ramapough-lenape-nation": "Found rmlncc.org, a community center of a differently named Ramapough group; not added, since it may not be the same body.",
    "nanticoke-lenni-lenape-tribal-nation": "The group's site (nlltribalnation.org) shows an email form link with no address; the New Jersey commission lists no tribal emails.",
    "grand-river-band-of-ottawa-indians": "The only address is in Michigan's 2017 Indian directory, which could not be confirmed as current, and the website it lists now shows unrelated content.",
}
LABELS = {
    "nation-website": "General office email shown on the nation's website",
    "federal-directory": "General office email listed in the federal Tribal Leaders Directory",
}


def log_entry(method: str, place_kind: str, address: str, query: str, outcome: str, reason: str) -> dict:
    return {"date": TODAY, "searched_by": BY, "method": method, "place_kind": place_kind, "address": address,
            "query": query, "outcome": outcome, "reason": reason}


def append_log(nation: str, entries: list[dict], found: bool) -> None:
    path = LOGS / nation[0] / f"{nation}.yaml"
    text = path.read_text(encoding="utf-8")
    log = yaml.safe_load(text)
    known = {(s.get("date"), s.get("address"), s.get("query")) for s in log.get("searches") or []}
    entries = [e for e in entries if (e["date"], e["address"], e["query"]) not in known]
    if not entries:
        return
    lines = text.splitlines()
    start = next(i for i, line in enumerate(lines) if line.startswith("searches:"))
    if lines[start].strip() == "searches: []":
        lines[start] = "searches:"
    end = next((i for i in range(start + 1, len(lines)) if lines[i][:1].isalpha()), len(lines))
    lines = lines[:end] + contacts.dump(entries).rstrip("\n").splitlines() + lines[end:]
    status = log["status"]
    if found:
        status = "found"
    elif status == "not-searched":
        status = "none-found"
    lines = [f"status: {status}" if line.startswith("status:") else line for line in lines]
    lines = [f"last_searched: '{TODAY}'" if line.startswith("last_searched:") else line for line in lines]
    if not any(line.startswith("last_searched:") for line in lines):
        at = next(i for i, line in enumerate(lines) if line.startswith("status:"))
        lines.insert(at + 1, f"last_searched: '{TODAY}'")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    contacts.TODAY = TODAY
    contacts.SESSION = SESSION
    findings = json.loads(FINDINGS.read_text(encoding="utf-8"))
    paths = {pathlib.Path(p).stem: pathlib.Path(p) for p in glob.glob("content/tribes/*/*.yaml")}
    profiles = {nation: yaml.safe_load(path.read_text(encoding="utf-8")) for nation, path in paths.items()}
    sources = contacts.Sources(check=False)
    logs: dict[str, list[dict]] = {}
    found: set[str] = set()
    added = 0

    def has(nation: str, kind: str, value: str | None = None) -> bool:
        return any(c.get("kind") == kind and (value is None or c.get("value", "").lower().rstrip("/") == value.lower().rstrip("/"))
                   for c in profiles[nation].get("contacts") or [])

    for choice in findings["chosen"]:
        nation, email, kind = choice["id"], choice["email"], choice["place_kind"]
        found.add(nation)
        entries = []
        if kind == "federal-directory":
            source, verification = FEDERAL_SOURCE, "bulk-import"
            note = "A general office address (not a leader's own) in the directory's email field, read on Nov. 23, 2026."
            label = LABELS[kind]
        elif choice["page"] == ALASKA_LINK:
            source, verification = ALASKA_SOURCE, "bulk-import"
            note = "A general office address (not a person's own) in the state's email field for the tribe, read on Nov. 23, 2026."
            label = "General office email listed by the State of Alaska"
        else:
            publisher = choice.get("publisher") or profiles[nation]["names"]["official"]
            source = sources.key_for(choice["page"], choice.get("page_title", ""), publisher, nation)
            if source in sources.new:
                sources.new[source]["citation"]["accessed"] = {"date-parts": [[2026, 11, 23]]}
            verification = "read-in-full"
            how = {"mailto": "a mailto link", "text": "text", "cloudflare-protected": "an address the page hides from scripts and shows to readers"}.get(choice["how"], "text")
            if kind == "state-directory":
                label = f"General office email listed by the {publisher}"
                note = f"Shown as {how} on the state's page for the group."
            else:
                label = LABELS["nation-website"]
                note = f"General office address, shown as {how} on the page. Found by scripts/tribes/find_emails_deep.mjs." if nation not in STATE_SEARCH else f"General office address, shown as {how} on the page; the site was found by web search."
        if choice.get("website") and not has(nation, "website"):
            site_source = sources.key_for(choice["website"], choice.get("page_title", ""), profiles[nation]["names"]["official"], nation)
            entries.append(contacts.fact("website", choice["website"], "Official website", site_source, "read-in-full",
                                         "The nation's own website, found by web search and opened to confirm it is the nation's."))
        if not has(nation, "email-general"):
            entries.append(contacts.fact("email-general", email, label, source, verification, note, choice.get("locator")))
        if entries:
            path = paths[nation]
            path.write_text(contacts.splice(path.read_text(encoding="utf-8"), entries), encoding="utf-8")
            profiles[nation].setdefault("contacts", []).extend(entries)
            added += sum(1 for e in entries if e["kind"] == "email-general")

    chosen = {c["id"]: c for c in findings["chosen"]}
    for crawl in findings["crawl"]:
        nation = crawl["id"]
        for site in crawl["sites"]:
            if site["unreachable"] and not site["read"]:
                outcome, reason = "error", "The site did not answer."
            elif site["challenge"] and not crawl["chosen"]:
                outcome, reason = "blocked", "At least one page answered with a bot check, which was not worked around; no general office address on the pages that loaded."
            elif crawl["chosen"]:
                outcome, reason = "found", f"Read {crawl['pages_read']} pages; chose the general office address {crawl['chosen']}."
            elif crawl["addresses_seen"]:
                outcome, reason = "not-found", f"Read {crawl['pages_read']} pages; they showed {crawl['addresses_seen']} addresses, none a general office account (department or staff addresses, not copied)."
            else:
                outcome, reason = "not-found", f"Read {crawl['pages_read']} pages in a browser; none showed an email address" + (" (the site offers a contact form)." if crawl["forms"] else ".")
            logs.setdefault(nation, []).append(log_entry(
                "browser", "nation-website", site["site"],
                "general office email on the nation's own site: home, contact, about, government, council, office and staff pages, read in a browser",
                outcome, reason))

    directory = {c["id"] for c in findings["chosen"] if c["place_kind"] == "federal-directory"}
    alaska = {c["id"] for c in findings["chosen"] if c["page"] == ALASKA_LINK}
    for nation, profile in profiles.items():
        if has(nation, "email-general") and nation not in found:
            continue
        types = {r.get("type") for r in profile.get("recognition") or []}
        if "federal" in types:
            if nation in directory:
                logs.setdefault(nation, []).append(log_entry("script", "official-directory", contacts_link(),
                    "email field for the nation in the federal Tribal Leaders Directory", "found",
                    f"Lists the general office address {chosen[nation]['email']}."))
            elif nation not in found:
                logs.setdefault(nation, []).append(log_entry("script", "official-directory", contacts_link(),
                    "email field for the nation in the federal Tribal Leaders Directory", "not-found",
                    "The directory lists only a leader's own address or none; leaders' addresses are kept out of the public record (lead author's decision, Nov. 23, 2026)."))
        if any(s.get("state") == "AK" for s in profile.get("states") or []) and "federal" in types and nation not in found | alaska:
            logs.setdefault(nation, []).append(log_entry("script", "official-directory", ALASKA_LINK,
                "email field for the tribe in the State of Alaska's list of federally recognized tribes", "not-found",
                "The state lists an address that names a person, or none."))
        elif nation in alaska:
            logs.setdefault(nation, []).append(log_entry("script", "official-directory", ALASKA_LINK,
                "email field for the tribe in the State of Alaska's list of federally recognized tribes", "found",
                f"Lists the general office address {chosen[nation]['email']}."))
        if nation in STATE_SEARCH:
            outcome = "found" if nation in found else "not-found"
            logs.setdefault(nation, []).append(log_entry("ai-review", "web-search", "WebSearch",
                "the group's name and state, with official website, contact, or the state commission on Indian affairs",
                outcome, f"Found {chosen[nation]['email']} on {chosen[nation]['page']}." if outcome == "found"
                else STATE_REASONS.get(nation, "No general office address on the group's own site or a state government page; addresses that name a person were not copied.")))

    for nation, entries in logs.items():
        append_log(nation, entries, nation in found)
    sources.write()
    print(f"{added} emails added; {len(logs)} search logs updated; {len(sources.new)} new sources")


def contacts_link() -> str:
    return "https://www.bia.gov/service/tribal-leaders-directory"


if __name__ == "__main__":
    main()
