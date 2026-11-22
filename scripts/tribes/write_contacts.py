"""Add each nation's own contact page and general office email to its profile, with sources and search logs.

Reads two files of findings, both kept in research/raw/2026-11-22/:

- contact-pages.json, from scripts/tribes/find_contacts.py: what the nation's own website
  links as its contact page, and the email addresses on its pages;
- contact-searches.json: what web searches by AI reviewers found for the nations with no
  website on file (the nation's own site, its contact page and general email, and for nations
  with nothing on file its main phone and addresses), each value with the page it was read
  on and a short quote. Every value there was checked by Claude before it was added to the
  file (decision rules below).

Rules (Trevor asked for every nation's email, or at least its contact page, on Nov. 22, 2026):

- Only official sources: the nation's own website, or an official government directory.
- A contact page counts only on the nation's own website: not on a site the profile shares
  with other nations (a regional consortium's community pages) or a social media page.
- An email is added only when it is a general office address (info@, contact@, office@,
  frontdesk@ and the like, or an account named for the tribe, village or council) found on
  the nation's own site, at most one per nation, and only when the profile has none. A
  department's address (enrollment@, hr@) or one that names a person is never added, and
  the findings only count them (schemas/tribe.schema.json, "contacts").
- A profile's existing contacts are never changed or removed.

Each page used becomes a source in content/sources/ (or reuses the source that already
cites that address), and every nation searched gets an entry in
research/search-logs/contacts/.

    python3 scripts/tribes/write_contacts.py [--check]
"""

import collections
import glob
import json
import pathlib
import re
import sys
import urllib.parse

import yaml

TODAY = "2026-11-22"
SESSION = "2026-11-22-nation-contacts"
RAW = pathlib.Path("research/raw/2026-11-22")
CRAWL = RAW / "contact-pages.json"
SEARCHES = RAW / "contact-searches.json"
LOGS = pathlib.Path("research/search-logs/contacts")
BY = "Claude (AI assistant)"

GENERAL = re.compile(
    r"^(info|information|contact|contactus|contact-us|contact_us|office|mainoffice|frontdesk|front\.desk|front_desk|"
    r"reception|receptionist|admin|administration|tribaloffice|tribal\.office|tribaladmin|tribal\.admin|general|"
    r"mail|hello|inquiries|inquiry|questions|tribe|tribal|council|tribalcouncil|tribalclerk|villageclerk|"
    r"tribalsecretary|secretary|clerk|office\.manager|officemanager|tribaladministrator|administrator)$"
)
ORG_WORDS = re.compile(r"(tribe|tribal|village|council|nation|band|rancheria|pueblo|community|traditional)")
NOT_THE_TRIBE = re.compile(
    r"(city|school|casino|resort|hotel|clinic|health|housing|corp|webmaster|design|donat|court|tourism|beading|art\b|"
    r"enroll|election|police|media|news|communications)"
)
# Read by Claude on Nov. 22, 2026 from the addresses the finder kept but the rules above did not
# take: each is the nation's own general office or council account, shown on its own site
# (an acronym of the nation's name, a reception desk, or an address on a second domain the
# nation uses). Nothing else is added by hand.
HAND_EMAILS = {
    "alutiiq-tribe-of-old-harbor": "atoh@alutiiqtribe.org",
    "assiniboine-and-sioux-tribes-of-the-fort-peck-indian-reservation": "info@fortpecktribes.net",
    "berry-creek-rancheria-of-maidu-indians-of-california": "tribalcouncil@bcr-nsn.gov",
    "bois-forte-band": "receptionist@boisforte-nsn.gov",
    "choctaw-apache-tribe-of-ebarb": "achoctaw@yahoo.com",
    "eastern-pequot-tribal-nation": "eptn1683@yahoo.com",
    "fort-sill-chiricahua-warm-springs-apache-tribe": "fsat@fortsillapache-nsn.gov",
    "grand-caillou-dulac-band-of-biloxi-chitimacha-choctaw": "gcdbcc1@gmail.com",
    "grand-portage-band": "rtcreception@grandportage.com",
    "hoonah-indian-association": "info@hiatribe.org",
    "la-posta-band-of-diegueno-mission-indians-of-the-la-posta-indian-reservation": "laposta@lptribe.net",
    "ma-chis-lower-creek-indian-tribe-of-alabama": "machis@centurytel.net",
    "match-e-be-nash-she-wish-band-of-pottawatomi": "info@glt-nsn.gov",
    "mechoopda-indian-tribe-of-chico-rancheria": "mit@mechoopda-nsn.gov",
    "mesa-grande-band-of-diegueno-mission-indians-of-the-mesa-grande-reservation": "mgbomi@mesagrandeband-nsn.gov",
    "moapa-band-of-paiute-indians-of-the-moapa-river-indian-reservation": "receptionist@moapabandofpaiutes.org",
    "mowa-band-of-choctaw-indians": "office@mowachoctaw.org",
    "northfork-rancheria-of-mono-indians-of-california": "nfrancheria@nfr-nsn.gov",
    "pointe-au-chien-indian-tribe": "pacitp2@gmail.com",
    "pokagon-band-of-potawatomi-indians": "office.of.tribal.council@pokagonband-nsn.gov",
    "potter-valley-tribe": "pvtsecretary@pottervalleytribe.com",
    "redwood-valley-or-little-river-band-of-pomo-indians-of-the-redwood-valley-rancheria-california": "admin@rvrtribe.com",
    "rosebud-sioux-tribe-of-the-rosebud-indian-reservation": "info@rst-nsn.gov",
    "sappony": "sappony@msn.com",
    "shingle-springs-band-of-miwok-indians-shingle-springs-rancheria": "info@ssband.org",
    "skull-valley-band-of-goshute-indians-of-utah": "info@skullvalleygoshutetribe.org",
    "the-chickasaw-nation": "citizensupport@chickasaw.net",
    "united-cherokee-ani-yun-wiya-nation": "ucanonline@aol.com",
    "white-earth-band": "contact.wen@whiteearth-nsn.gov",
    "winnemucca-indian-colony-of-nevada": "admin.wic@winnemuccaindiancolony.org",
}
# Taken by the rules above but not the nation's own general address (Claude, Nov. 22, 2026).
HAND_REJECTED = {"wellsbandmf@yahoo.com"}
FREE_MAIL = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "msn.com", "live.com", "icloud.com",
             "gci.net", "ak.net", "acsalaska.net", "alaska.net", "starband.net", "hughes.net", "frontiernet.net",
             "att.net", "comcast.net", "centurylink.net", "earthlink.net", "verizon.net", "sbcglobal.net"}
SHARED_LABEL = re.compile(r"shared|consortium|social media|regional", re.I)
# Sites the federal directory lists for some nations that belong to someone else: regional
# consortia, boroughs and cities, corporations, casinos, federal agencies. Their contact pages
# and addresses are not the nation's own.
OTHERS_SITES = {
    "tananachiefs.org", "caltribalfamilies.org", "bbna.com", "rmtlc.org", "sctca.net", "lakeandpen.com",
    "cityofemmonak.org", "north-slope.org", "nwabor.org", "kawerak.org", "apiai.org", "itcaonline.com",
    "mintodevelopmentcorp.com", "chenega.com", "jacksoncasino.com", "doi.gov", "cnmicao.com", "curarpaluk.com",
}
CHALLENGE_TITLE = re.compile(r"one moment|just a moment|attention required|access denied|captcha|are you human", re.I)
# A contact page counts when it is the nation's own general one, not a department's.
DEPARTMENT = re.compile(
    r"\b(farm\w*|health|housing|enroll\w*|courts?|tribal-court|police|education|epa|environment\w*|casino|clinic|"
    r"library|museum|faqs?|language|gaming|employment|jobs|careers?|store|shop|donate|donations?)\b", re.I)


def bare_host(address: str) -> str:
    return urllib.parse.urlparse(address).netloc.lower().split(":")[0].removeprefix("www.")


def registrable(host: str) -> str:
    parts = host.split(".")
    return ".".join(parts[-3:]) if len(parts) >= 3 and parts[-2] in {"co", "com", "org", "net", "gov"} and len(parts[-1]) == 2 else ".".join(parts[-2:])


def rank(local: str) -> int | None:
    """Lower is better; None when the address is not a general office address."""
    if NOT_THE_TRIBE.search(local):
        return None
    if local in ("info", "information"):
        return 0
    if local.startswith("contact"):
        return 1
    if GENERAL.match(local):
        return 2 if re.match(r"(front|recep|office|mainoffice|tribaloffice|general|mail|hello|inquir|questions)", local) else 3
    letters = re.sub(r"[^a-z]", "", local)
    if ORG_WORDS.search(letters) and "." not in local and "_" not in local:
        return 4
    return None


def email_ok(email: str, site_host: str) -> bool:
    domain = email.split("@", 1)[1]
    return registrable(domain) == registrable(site_host) or domain in FREE_MAIL


def best_email(emails: list[dict], site_hosts: set[str]) -> dict | None:
    choices = []
    for email in emails:
        value = email["value"].lower()
        page_host = bare_host(email.get("page") or email.get("evidence_url") or "")
        if page_host not in site_hosts:
            continue
        if not any(email_ok(value, host) for host in site_hosts):
            continue
        place = rank(value.split("@", 1)[0])
        if place is not None:
            choices.append((place, value, email))
    return min(choices, key=lambda choice: choice[:2])[2] if choices else None


def general_contact_page(candidate: dict) -> bool:
    address = candidate.get("final", candidate["link"])
    title = "" if CHALLENGE_TITLE.search(candidate.get("title") or "") else candidate.get("title") or ""
    return not DEPARTMENT.search(urllib.parse.urlparse(address).path + " " + title + " " + candidate.get("words", ""))


def slug(text: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-")


class Sources:
    """Finds the source that already cites an address, or writes a new one."""

    def __init__(self, check: bool):
        self.check = check
        self.by_link: dict[str, str] = {}
        self.keys: set[str] = set()
        self.new: dict[str, dict] = {}
        for path in glob.glob("content/sources/*/*.yaml"):
            record = yaml.safe_load(open(path, encoding="utf-8"))
            self.keys.add(record["key"])
            for address in (record.get("original_link"), (record.get("citation") or {}).get("URL")):
                if address:
                    self.by_link.setdefault(self.normal(address), record["key"])

    @staticmethod
    def normal(address: str) -> str:
        parts = urllib.parse.urlparse(address.strip())
        return bare_host(address) + parts.path.rstrip("/") + ("?" + parts.query if parts.query else "")

    def key_for(self, address: str, title: str, publisher: str, nation: str) -> str:
        known = self.by_link.get(self.normal(address))
        if known:
            if known in self.new and nation not in self.new[known]["tribes"]:
                self.new[known]["tribes"].append(nation)
            return known
        host = bare_host(address)
        stem = slug(host.split(".")[0] if not host.startswith(("tribal", "tribe")) else host.rsplit(".", 1)[0])
        path = slug(urllib.parse.urlparse(address).path) or "home-page"
        key = f"{stem}-{path}"[:80].strip("-")
        number = 2
        while key in self.keys:
            key = f"{stem}-{path}"[:76].strip("-") + f"-{number}"
            number += 1
        self.keys.add(key)
        self.by_link[self.normal(address)] = key
        self.new[key] = {
            "key": key,
            "kind": "web-page",
            "citation": {
                "type": "webpage",
                "title": title or "Contact",
                "author": [{"literal": publisher}],
                "URL": address,
                "accessed": {"date-parts": [[2026, 11, 22]]},
            },
            "original_link": address,
            "retrieved": TODAY,
            "archives": [],
            "history": {"status": "live", "last_checked": TODAY},
            "rights": {
                "status": "no-permission-needed",
                "basis": "fact-only",
                "basis_note": "Only facts are recorded from this source; it is cited and linked, not quoted or reproduced.",
                "redistribution": False,
            },
            "tribes": [nation],
            "found_in": [SESSION],
        }
        return key

    def write(self) -> None:
        for key, record in self.new.items():
            folder = key[0] if key[0].isalpha() else "_other"
            path = pathlib.Path("content/sources") / folder / f"{key}.yaml"
            if not self.check:
                path.write_text(dump(record), encoding="utf-8")


def fact(kind: str, value: str, label: str, source: str, verification: str, note: str, locator: str | None = None) -> dict:
    entry = {"kind": kind, "value": value, "label": label, "source": source, "confidence": "high",
             "verification": verification, "as_of": TODAY}
    if locator:
        entry["locator"] = locator
    entry["note"] = note
    return entry


# Keys that come after contacts in a profile, for a profile that has no contacts yet.
AFTER_CONTACTS = ("tribal_insignia_database_entries", "official_images", "federal_administration", "governing_documents",
                  "justice_institutions", "dispute_resolution", "gaming", "jurisdiction", "memberships", "review", "sensitivity")


def dump(value) -> str:
    """YAML with no line breaks inside a value (the project does not hard-wrap prose)."""
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def splice(text: str, entries: list[dict]) -> str:
    """Adds the new contact facts at the end of the profile's contacts list, leaving every other line as it was."""
    lines = text.splitlines(keepends=True)
    block = dump(entries)
    top = [index for index, line in enumerate(lines) if re.match(r"[a-z_]+:", line)]
    start = next((index for index in top if re.match(r"contacts:", lines[index])), None)
    if start is not None and lines[start].strip() in ("contacts: []", "contacts: null", "contacts:"):
        if lines[start].strip() != "contacts:":
            lines[start] = "contacts:\n"
        end = next((index for index in top if index > start), len(lines))
        return "".join(lines[:end]) + block + "".join(lines[end:])
    if start is not None:
        raise ValueError(f"unexpected contacts line: {lines[start]!r}")
    before = next((index for index in top if lines[index].split(":")[0] in AFTER_CONTACTS), len(lines))
    return "".join(lines[:before]) + "contacts:\n" + block + "".join(lines[before:])


def site_key(address: str) -> str:
    """The host, or for a site on a shared host (Google Sites, Wix) the host and the site's own path."""
    host = bare_host(address)
    if host in ("sites.google.com",) or host.endswith(".wixsite.com"):
        return host + "/" + "/".join(urllib.parse.urlparse(address).path.strip("/").split("/")[:2])
    return host


def own_sites(profile: dict, host_counts: collections.Counter) -> set[str]:
    hosts = set()
    for contact in profile.get("contacts") or []:
        if contact.get("kind") != "website" or contact.get("link_status") == "lapsed":
            continue
        if SHARED_LABEL.search(contact.get("label") or "") or SHARED_LABEL.search(contact.get("note") or ""):
            continue
        host = bare_host(contact["value"])
        if host_counts[site_key(contact["value"])] == 1 and registrable(host) not in OTHERS_SITES and not re.search(r"facebook|instagram|twitter|x\.com|youtube|linkedin", host):
            hosts.add(host)
    return hosts


def log_entry(method: str, place_kind: str, address: str, query: str, outcome: str, reason: str) -> dict:
    return {"date": TODAY, "searched_by": BY, "method": method, "place_kind": place_kind, "address": address,
            "query": query, "outcome": outcome, "reason": reason}


def main() -> None:
    check = "--check" in sys.argv
    profiles = {}
    paths = {}
    for path in sorted(glob.glob("content/tribes/*/*.yaml")):
        profile = yaml.safe_load(open(path, encoding="utf-8"))
        profiles[profile["id"]] = profile
        paths[profile["id"]] = path
    host_counts = collections.Counter()
    for profile in profiles.values():
        for host in {site_key(c["value"]) for c in profile.get("contacts") or []
                     if c.get("kind") == "website" and c.get("link_status") != "lapsed"}:
            host_counts[host] += 1

    sources = Sources(check)
    changed: set[str] = set()
    logs: dict[str, list[dict]] = collections.defaultdict(list)
    found: dict[str, bool] = {}
    counts = collections.Counter()

    added: dict[str, list[dict]] = collections.defaultdict(list)

    def add(nation: str, entry: dict) -> None:
        if profiles[nation].get("contacts") is None:
            profiles[nation]["contacts"] = []
        profiles[nation]["contacts"].append(entry)
        added[nation].append(entry)
        changed.add(nation)
        counts[entry["kind"]] += 1

    def has(nation: str, kind: str) -> bool:
        return any(c.get("kind") == kind for c in profiles[nation].get("contacts") or [])

    # 1. The contact pages and emails on the websites already on file.
    for result in json.load(open(CRAWL, encoding="utf-8")):
        nation = result["id"]
        profile = profiles[nation]
        name = profile["names"]["official"]
        hosts = own_sites(profile, host_counts)
        found[nation] = False
        for site in result["websites"]:
            if site in result["unreachable"]:
                logs[nation].append(log_entry("script", "nation-website", site, "links whose words or address say contact; mailto links and email addresses",
                                              "error", "The site did not answer the project's contact finder (no page, a refusal or a timeout); a person could try it in a browser."))
        if not hosts:
            if result["websites"] and not all(s in result["unreachable"] for s in result["websites"]):
                logs[nation].append(log_entry("script", "nation-website", result["websites"][0], "contact page and general email",
                                              "not-found", "The website on file is shared with other nations or is a social media page, so its contact page is not this nation's own."))
            continue
        pages = [c for c in result["contact_pages"] if c.get("fetched") and c["score"] >= 3
                 and bare_host(c.get("final", c["link"])) in hosts
                 and urllib.parse.urlparse(c.get("final", c["link"])).path.strip("/")
                 and general_contact_page(c)]
        page = pages[0] if pages else None
        if page and not has(nation, "contact-page"):
            address = page["final"]
            refused = bool(CHALLENGE_TITLE.search(page.get("title") or ""))
            title = f"{page['words'] or 'Contact'} – {name}" if refused or not page.get("title") else page["title"]
            key = sources.key_for(address, title, name, nation)
            seen = ("The page answered with a bot check, so only the link was read." if refused
                    else f"Its title is \"{page['title']}\"." if page.get("title") else "")
            add(nation, fact("contact-page", address, "Contact page on the nation's website", key, "title-only",
                             f"The nation's own website links this page as \"{page['words'] or 'Contact'}\". {seen} Found by scripts/tribes/find_contacts.py.".replace("  ", " ")))
            found[nation] = True
        email = best_email([e for e in result["emails"] if e["value"] not in HAND_REJECTED], hosts)
        if not email and nation in HAND_EMAILS:
            email = next((e for e in result["emails"] if e["value"] == HAND_EMAILS[nation]), None)
        if email and not has(nation, "email-general"):
            key = sources.key_for(email["page"], page.get("title") if page and email["page"] == page.get("final") else "", name, nation) \
                if sources.normal(email["page"]) in sources.by_link else sources.key_for(email["page"], f"{name}", name, nation)
            how = "a mailto link" if email["how"] == "mailto" else "text"
            add(nation, fact("email-general", email["value"], "General office email shown on the nation's website", key, "read-in-full",
                             f"General office address, shown as {how} on the page. Found by scripts/tribes/find_contacts.py."))
            found[nation] = True
        # Found when the site shows a contact page or general email, whether or not the profile already had it.
        found[nation] = bool(page or email)
        outcome = "found" if found[nation] else "not-found"
        what = []
        if page:
            what.append(f"contact page {page['final']}")
        if email:
            what.append(f"general email {email['value']}")
        others = result.get("other_addresses", 0) + len([e for e in result["emails"] if not email or e["value"] != email["value"]])
        reason = ("Found " + " and ".join(what) + "." if what else "No page linked as a contact page on the nation's own site and no general office email.")
        if others:
            reason += f" {others} other addresses (departments, people or other sites) were found and not added."
        logs[nation].append(log_entry("script", "nation-website", sorted(hosts)[0], "links whose words or address say contact; mailto links and email addresses", outcome, reason))

    # 2. What the web searches found for the nations with no website on file.
    if SEARCHES.exists():
        for result in json.load(open(SEARCHES, encoding="utf-8")):
            nation = result["id"]
            profile = profiles[nation]
            name = profile["names"]["official"]
            publisher = result.get("source_publisher") or name
            place = {"nation-website": "nation-website", "state-directory": "state-directory",
                     "federal-directory": "federal-directory"}.get(result.get("source_kind"), "other")
            for search in result.get("searches") or []:
                logs[nation].append(log_entry("ai-review", "web-search", "WebSearch", search["query"],
                                              "found" if result["accepted"] else "not-found", search["result"]))
            found.setdefault(nation, False)
            if not result["accepted"]:
                continue
            site = result.get("website")
            if site and not has(nation, "website"):
                key = sources.key_for(site["evidence_url"], site.get("title") or name, publisher, nation)
                add(nation, fact("website", site["value"], "Official website", key, "read-in-full",
                                 "The nation's own website, found by web search and opened to confirm it is the nation's."))
            contact_page = result.get("contact_page")
            if contact_page and not has(nation, "contact-page"):
                key = sources.key_for(contact_page["value"], contact_page.get("title") or f"Contact – {name}", publisher, nation)
                add(nation, fact("contact-page", contact_page["value"], "Contact page on the nation's website", key, "read-in-full",
                                 "Opened to confirm it is the nation's own contact page."))
            for email in result.get("emails") or []:
                if email.get("personal_looking") or has(nation, "email-general"):
                    continue
                key = sources.key_for(email["evidence_url"], email.get("title") or name, publisher, nation)
                add(nation, fact("email-general", email["value"], "General office email shown on the nation's website", key, "read-in-full",
                                 "General office address as shown on the page."))
            for kind in ("phone", "physical-address", "mailing-address"):
                value = result.get(kind.replace("-", "_"))
                if value and not has(nation, kind):
                    key = sources.key_for(value["evidence_url"], value.get("title") or name, publisher, nation)
                    add(nation, fact(kind, value["value"], "Tribal government office", key, "read-in-full",
                                     "As listed for the tribe in the state's directory." if place == "state-directory"
                                     else "Main office contact as shown on the nation's website."))
            found[nation] = True
            logs[nation].append(log_entry("ai-review", place, (site or contact_page or {}).get("value") or result.get("evidence_url", "WebSearch"),
                                          "official website, contact page, general email", "found",
                                          result.get("summary") or "Claude opened the page and confirmed it is the nation's own or an official directory entry."))

    # 3. Write.
    sources.write()
    for nation in sorted(changed):
        if not check:
            path = pathlib.Path(paths[nation])
            path.write_text(splice(path.read_text(encoding="utf-8"), added[nation]), encoding="utf-8")
    for nation, entries in logs.items():
        profile_path = paths[nation]
        letter = pathlib.Path(profile_path).parent.name
        path = LOGS / letter / f"{nation}.yaml"
        log = {"profile": profile_path, "topic": "contacts",
               "status": "found" if found.get(nation) else ("partly-searched" if any(e["outcome"] in ("error", "blocked") for e in entries) else "none-found"),
               "last_searched": TODAY, "searches": entries}
        if log["status"] == "partly-searched":
            log["next_steps"] = "A person could open the nation's website in a browser and look for its contact page and a general office email."
        if not check:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(dump(log), encoding="utf-8")
    print(f"profiles changed: {len(changed)}; facts added: {dict(counts)}; new sources: {len(sources.new)}; search logs: {len(logs)}")


if __name__ == "__main__":
    main()
