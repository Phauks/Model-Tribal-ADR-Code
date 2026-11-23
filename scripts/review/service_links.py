"""Give every listed service a link where an official page exists (the lead
author's rule of Nov. 22, 2026: "If we list a service, it should have a
link").

A service is an entry in a profile's `justice_institutions` or
`dispute_resolution.forums`. The link is, in this order:

1. own-page: the service's own official page, on the nation's site or the
   court's or program's site, fetched with status 200 and naming the service;
2. directory: only where no own page was found, the official directory entry
   that lists the service (a state court system's tribal court directory, the
   Bureau of Indian Affairs list of Courts of Indian Offenses, or an
   intertribal court's list of the nations it serves), said to be a directory
   in the fact's note;
3. none-found: the link stays empty and the search is logged. No service is
   ever deleted.

    python3 scripts/review/service_links.py gather WORK_DIRECTORY [--reuse CACHE_DIRECTORY ...]
    python3 scripts/review/service_links.py merge WORK_DIRECTORY
    python3 scripts/review/service_links.py apply [--check]
    python3 scripts/review/service_links.py second WORK_DIRECTORY

`gather` lists every service with no link and what earlier reviews already
fetched for it (research/reviews/2026-11-21-court-listings.json, whose
`pages_fetched` give each address's status, and
research/reviews/2026-11-22-court-listings-second-pass.json with its
`evidence_kind` and `evidence_checked`), and the linked entries of the same
profile that the reviews confirmed. Where those give no own page, it fetches
the pages earlier reviews named but did not record as fetched, the nation's
website (robots.txt obeyed, sitemap, up to five pages whose link or address
mentions a court, judiciary, justice or peacemaking, with the helpers of
scripts/review/court_listings_second_pass.py) and, for peacemaking and other
forums, the court pages the profile links to. Pages already fetched by the
second pass are read from its cache (`--reuse`), not fetched again. A site
that refuses the request (401, 403, 406, 429 or a challenge page) is
recorded as blocked; nothing is done to get around it. It writes
WORK_DIRECTORY/evidence.json and WORK_DIRECTORY/fetch-log.json.

`merge` decides each service from that evidence with the rules below and the
hand decisions in DECISIONS (Claude read each page named there on
2026-11-22), checks that every link chosen was fetched with status 200, and
writes research/reviews/2026-11-22-service-links.{json,csv} (empty
`lead_author_decision` column) and a search log entry for every place looked,
under research/search-logs/courts/ (courts) or
research/search-logs/dispute-resolution/ (peacemaking programs and forums).

`apply` sets `link` on each service the review linked, adding to its note
where the link came from and the date it was checked; it keeps the old note
text and never changes `verification`. Only the profiles it changes are
rewritten, in the form the profiles are kept in (PyYAML, width 100), so the
diff shows only the new lines. With `--check` it reports what it would do.
A service that already has the review's link is left alone, so `apply` can be
run again after `second`.

`second` records the second, deeper search of Nov. 23, 2026 for the services
the first pass left with no link. Claude ran web searches (at most 150) and
fetched the candidate pages with this review's fetch helper
(court_listings_second_pass.fetch, cache and fetch log in WORK_DIRECTORY); it
also read the state judicial branch tribal court lists the search turned up.
WORK_DIRECTORY/searches.tsv holds one row per place looked (the services it
was for, method, kind of place, address, query, outcome and reason), and
WORK_DIRECTORY/fetch-log.json the status of each page fetched. `second`
checks that every link in SECOND_DECISIONS was fetched with status 200,
updates the review rows those decisions change (rule, link, evidence, note,
question for the lead author), rewrites the review's CSV, and adds every
search to the nation's search log with a closing entry per service. Run
`apply` after it to set the links.
"""

import collections
import csv
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys
import time
import urllib.parse

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "scripts" / "review"))
import record_facts  # noqa: E402
import court_listings_second_pass as second_pass  # noqa: E402

REVIEWS = ROOT / "research" / "reviews"
FIRST_PASS = REVIEWS / "2026-11-21-court-listings.json"
SECOND_PASS = REVIEWS / "2026-11-22-court-listings-second-pass.json"
REVIEW = REVIEWS / "2026-11-22-service-links"
SEARCH_LOGS = ROOT / "research" / "search-logs"
REVIEW_DATE = "2026-11-22"
SCRIPT = "scripts/review/service_links.py"
SEARCHED_BY = "Claude (AI assistant)"
SECTIONS = ("justice_institutions", "dispute_resolution.forums")
POSITIVE_FIRST = ("confirmed", "confirmed-other-name", "link-dead-court-found")
POSITIVE_SECOND = ("confirmed", "confirmed-other-name", "link-dead-court-found", "served-by-intertribal-court",
                   "served-by-court-of-indian-offenses")
OWN_KINDS = ("nation-website", "court-website")
DIRECTORY_KINDS = ("state-court-directory", "bureau-of-indian-affairs-list", "intertribal-organization")
COURT_KINDS = ("tribal-court", "court-of-appeals", "court-of-indian-offenses", "healing-to-wellness-court", "other")
SERVICE_WORDS = re.compile(r"peacemak|peace\s*giv|peacegiv|wellness|circle|traditional\s+court|wodakota|"
                           r"h[óo]zh[óo]{1,2}j[ií]|mediation", re.IGNORECASE)
# Intertribal court systems: a page of theirs is a directory entry (rule 2)
# unless it is about the one nation's court.
INTERTRIBAL_HOSTS = ("tribalcourt.org", "nics.ws", "intertribalcourt.org", "tananachiefs.org", "kawerak.org")
# Directory labels for the review's `evidence_url` addresses (from
# scripts/review/court_listings_second_pass.py DIRECTORIES).
DIRECTORY_LABELS = {d["url"]: d["label"] for d in second_pass.DIRECTORIES}
NAVAJO_PEACEMAKING = "https://courts.navajo-nsn.gov/indexpeacemaking.htm"
NAVAJO_PLAN = "https://courts.navajo-nsn.gov/Peacemaking/Plan/peace.html"
# Claude's own tries at the Navajo page on 2026-11-22, before `gather`.
NAVAJO_TRIES = ("Fetched by hand six times with growing pauses: two tries returned status 200 with the title "
                "“The Navajo Nation Peacemaking Program” and four were cut off by the proxy (curl exit 35); the "
                "page's main frame, Peacemaking/peacemain.htm, also loaded with status 200")
# Pages that show the service although another page is its link.
ALSO_SHOWS = {
    "https://courts.navajo-nsn.gov/Peacemaking/peacemain.htm":
        "the main frame of the linked page, headed “Peacemaking Program of the Navajo Nation”",
}


# --------------------------------------------------------------------------- services


def topic_of(service):
    """The search log topic: courts, or dispute-resolution for peacemaking
    programs, traditional forums and dispute resolution forums."""
    if service["section"] == "dispute_resolution.forums" or service["kind"] not in COURT_KINDS:
        return "dispute-resolution"
    return "courts"


def services_without_link(tree):
    found = []
    for file, profile in sorted(tree.profiles.items()):
        facts = [("justice_institutions", f) for f in profile.get("justice_institutions") or []]
        facts += [("dispute_resolution.forums", f) for f in (profile.get("dispute_resolution") or {}).get("forums")
                  or []]
        for section, fact in facts:
            if fact.get("link"):
                continue
            found.append({
                "profile": file, "nation": profile["names"]["official"], "section": section,
                "kind": fact.get("kind"), "name": fact.get("name") or fact.get("own_term", {}).get("name")
                or fact.get("kind"), "source": fact["source"], "verification": fact.get("verification"),
                "note": fact.get("note"),
                "nation_sites": [c["value"] for c in profile.get("contacts") or [] if c.get("kind") == "website"],
            })
    for number, service in enumerate(found, 1):
        service["item_id"] = f"service-{number:03d}"
        service["topic"] = topic_of(service)
    return found


def linked_siblings(tree, profile_path):
    profile = tree.profiles[profile_path]
    facts = [("justice_institutions", f) for f in profile.get("justice_institutions") or []]
    facts += [("dispute_resolution.forums", f) for f in (profile.get("dispute_resolution") or {}).get("forums") or []]
    return [{"section": s, "kind": f.get("kind"), "name": f.get("name"), "source": f["source"], "link": f["link"]}
            for s, f in facts if f.get("link")]


def first_pass_page(row):
    """The page the Nov. 21 review confirmed a court on, if it was fetched with
    status 200 (its `pages_fetched`), else None."""
    if not row or row["verdict"] not in POSITIVE_FIRST:
        return None
    statuses = {p["url"]: p["status"] for p in row["pages_fetched"]}
    for url in (row.get("working_link"), row.get("evidence_url")):
        if url and statuses.get(url) == 200:
            return url
    # The listed link redirected to the evidence page and was fetched with 200.
    if row.get("listed_link") and statuses.get(row["listed_link"]) == 200 and row.get("evidence_url"):
        return row["evidence_url"] if record_facts.normalized_link(row["evidence_url"]) == \
            record_facts.normalized_link(row["listed_link"]) else None
    return None


def is_root(url):
    return urllib.parse.urlsplit(url).path in ("", "/")


def host_of(url):
    return urllib.parse.urlsplit(url).netloc.lower().removeprefix("www.")


# --------------------------------------------------------------------------- gather

# Evidence pages of the Nov. 21 review that are not the court's own page (a
# news story, a job list), so they are not used as links and the service is
# searched further.
NOT_OWN_PAGE = {
    "https://www.choctawnation.com/news/news-releases/choctaw-nation-opens-expanded-judicial-center-in-durant-oklahoma/":
        "a news release about the Judicial Center",
    "https://tojc-nsn.gov/job-opportunities/": "the job list of the Judicial Courts site",
}
# More pages to read for a service, by profile: the home page of a court's own
# site whose Nov. 21 evidence page was one of the above, and the pages that
# the court pages read in a first run of `gather` link to under the program's
# name (seen by Claude on 2026-11-22).
EXTRA_PAGES = {
    "content/tribes/t/tohono-oodham-nation-of-arizona.yaml": ["https://tojc-nsn.gov/"],
    "content/tribes/p/pueblo-of-santa-ana.yaml": ["https://santaana-nsn.gov/tribalcourt-front-page/"],
    "content/tribes/c/confederated-tribes-of-the-colville-reservation.yaml": [
        "https://www.cct-pmc.com/peacemaker-circle", "https://www.cct-pmc.com/purpose",
        "https://www.cct-pmc.com/authority"],
    "content/tribes/l/leech-lake-band.yaml": ["https://www.llojibwe.org/court/bamenim.html"],
    "content/tribes/o/oneida-nation.yaml": ["https://oneida-nsn.gov/judiciary/peacemaking/"],
    "content/tribes/t/the-chickasaw-nation.yaml": ["https://judicial.chickasaw.net/Courts/Peacemaking-Court.aspx"],
    "content/tribes/p/pueblo-of-isleta.yaml": ["https://www.isletapueblo.com/government/tribal-court/",
                                             "https://www.isletapueblo.com/tribal-court-peacemaking-program/"],
}


def fetch_with_retries(url, tries=5):
    """The Navajo Nation Judicial Branch site drops many connections through
    the proxy; try a few times with growing pauses."""
    entry = None
    for attempt in range(tries):
        entry = second_pass.fetch(url)
        if entry["status"]:
            return entry, attempt + 1
        with second_pass._lock:
            second_pass._log.pop(url, None)
        (second_pass._cache_directory / cache_name(url)).unlink(missing_ok=True)
        time.sleep(3 * (attempt + 1))
    return entry, tries


# Cache files copied from earlier reviews (`--reuse`): a page read from one of
# them was not fetched again.
SEEDED = set()


def cache_name(url):
    return hashlib.sha256(url.encode()).hexdigest()[:24] + ".json"


def page_record(url, entry, service):
    text, links, title = second_pass.page_text(entry)
    name_words = [w for w in re.findall(r"[\w’']+", service["name"] or "") if w.lower() not in second_pass.GENERIC
                  and len(w) > 3]
    return {
        "url": url, "status": entry["status"], "final": entry["final"], "outcome": entry["outcome"],
        "title": title, "earlier_fetch": cache_name(url) in SEEDED,
        "name_on_page": bool(service["name"]) and (service["name"].lower() in text.lower()),
        "name_words_on_page": [w for w in name_words if w.lower() in text.lower()],
        "service_passages": second_pass.passages(text, SERVICE_WORDS, limit=4, width=300)
        if service["topic"] == "dispute-resolution" else [],
        "court_passages": second_pass.passages(text, limit=3, width=250),
        "service_links": [(l, h) for l, h in links if SERVICE_WORDS.search(l) or SERVICE_WORDS.search(h)][:10],
        "court_links": [(l, h) for l, h in links if second_pass.COURT_WORDS.search(l)][:10],
    }


def gather(work, reuse):
    work.mkdir(parents=True, exist_ok=True)
    cache = work / "cache"
    cache.mkdir(exist_ok=True)
    # Seed the cache with the pages earlier reviews fetched, so they are read
    # again from disk instead of fetched again.
    for directory in reuse:
        for path in pathlib.Path(directory).glob("*.json"):
            SEEDED.add(path.name)
            target = cache / path.name
            if not target.exists():
                shutil.copyfile(path, target)
    second_pass._cache_directory = cache
    tree = record_facts.Tree(ROOT)
    first = {(r["profile"], r["source"], r["name"]): r for r in json.loads(FIRST_PASS.read_text(encoding="utf-8"))}
    second = {(r["profile"], r["source"], r["name"]): r for r in json.loads(SECOND_PASS.read_text(encoding="utf-8"))}
    services = services_without_link(tree)
    searched_sites = {}
    for service in services:
        key = (service["profile"], service["source"], service["name"])
        one, two = first.get(key), second.get(key)
        service["first_pass"] = one and {k: one[k] for k in ("verdict", "evidence_url", "working_link",
                                                             "name_on_page", "reason", "pages_fetched")}
        service["second_pass"] = two and {k: two[k] for k in ("item_id", "verdict", "evidence_kind", "evidence_url",
                                                              "working_link", "name_on_page", "reason",
                                                              "evidence_checked", "supporting_urls")}
        siblings = []
        for sibling in linked_siblings(tree, service["profile"]):
            skey = (service["profile"], sibling["source"], sibling["name"])
            sone, stwo = first.get(skey), second.get(skey)
            sibling["first_pass_verdict"] = sone and sone["verdict"]
            sibling["confirmed_page"] = first_pass_page(sone)
            if stwo and stwo["verdict"] in POSITIVE_SECOND and stwo["evidence_kind"] in OWN_KINDS \
                    and stwo["evidence_checked"]:
                sibling["confirmed_page"] = stwo["working_link"] or stwo["evidence_url"]
            sibling["second_pass_verdict"] = stwo and stwo["verdict"]
            siblings.append(sibling)
        service["siblings"] = siblings
        service["pages"] = []
        service["site_search"] = []

        for url in EXTRA_PAGES.get(service["profile"], []):
            if second_pass.allowed(url)[0]:
                service["pages"].append(page_record(url, second_pass.fetch(url), service))
        own = first_pass_page(one)
        settled = (two and two["verdict"] in POSITIVE_SECOND and two["evidence_kind"] in OWN_KINDS
                   and two["evidence_checked"]) or (own and not is_root(own) and own not in NOT_OWN_PAGE
                                                    and service["topic"] == "courts")
        if settled and not service["profile"].endswith("navajo-nation.yaml"):
            continue
        # Pages to read: the Nov. 21 evidence page when its status was not
        # recorded or it is a home page, and the pages confirmed for the
        # profile's other services.
        urls = []
        if one and one.get("evidence_url") and one["verdict"] in POSITIVE_FIRST:
            urls.append(one["evidence_url"])
        urls += [s["confirmed_page"] or s["link"] for s in siblings
                 if s["section"] == "justice_institutions" and not s["link"].startswith("https://www.bia.gov")]
        for url in dict.fromkeys(urls):
            if host_of(url) in ("codepublishing.com",) or url in [p["url"] for p in service["pages"]]:
                continue
            ok, _ = second_pass.allowed(url)
            if not ok:
                service["pages"].append({"url": url, "status": None, "outcome": "robots", "title": None})
                continue
            service["pages"].append(page_record(url, second_pass.fetch(url), service))
        # The nation's website, searched as in the second pass (cached pages
        # are not fetched again).
        for site in service["nation_sites"][:2]:
            if site not in searched_sites:
                searched_sites[site] = second_pass.deep_search(site)
            record = searched_sites[site]
            service["site_search"].append({
                "site": site, "earlier_fetch": cache_name(site) in SEEDED, "home": {k: record["home"][k] for k in ("status", "final", "outcome", "title")},
                "pages": [{k: p[k] for k in ("url", "status", "final", "outcome", "title")} for p in record["pages"]],
                "skipped_by_robots": record["skipped_by_robots"],
                "sitemap_court_urls": record["sitemap_court_urls"][:10]})
            if service["topic"] == "dispute-resolution":
                home = second_pass.fetch(site)
                _, links, _ = second_pass.page_text(home)
                extra = [h for l, h in links if (SERVICE_WORDS.search(l) or SERVICE_WORDS.search(h))
                         and host_of(h) == host_of(home["final"] or site)]
                for url in list(dict.fromkeys(extra))[:3]:
                    if url not in [p["url"] for p in service["pages"]] and second_pass.allowed(url)[0]:
                        service["pages"].append(page_record(url, second_pass.fetch(url), service))
            for page in record["pages"]:
                if page["status"] == 200 and page["url"] not in [p["url"] for p in service["pages"]]:
                    service["pages"].append(page_record(page["url"], second_pass.fetch(page["url"]), service))
        if service["profile"].endswith("navajo-nation.yaml") and service["kind"] == "peacemaking-program":
            entry, tries = fetch_with_retries(NAVAJO_PEACEMAKING)
            record = page_record(NAVAJO_PEACEMAKING, entry, service)
            record["tries"] = tries
            service["pages"] = [p for p in service["pages"] if p["url"] != NAVAJO_PEACEMAKING] + [record]
            frame = "https://courts.navajo-nsn.gov/Peacemaking/peacemain.htm"
            entry, tries = fetch_with_retries(frame)
            record = page_record(frame, entry, service)
            record["tries"] = tries
            service["pages"].append(record)
    (work / "evidence.json").write_text(json.dumps(services, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    log = [{k: v for k, v in e.items() if not k.startswith("_")} for e in second_pass._log.values()]
    (work / "fetch-log.json").write_text(json.dumps(log, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(services)} services without a link; {sum(1 for s in services if s['pages'] or s['site_search'])} "
          f"searched further; {len(log)} addresses read: {dict(collections.Counter(e['outcome'] for e in log))}")


# --------------------------------------------------------------------------- decide

# Hand decisions, keyed by (profile, source, name). Claude read each page named
# here on 2026-11-22 (from WORK_DIRECTORY/evidence.json, or the Nov. 21 and
# Nov. 22 reviews' fetched pages). `rule` is own-page, directory or none-found;
# `link` must appear in a fetch log with status 200.
AK_DIRECTORY = "https://courts.alaska.gov/courtdir/docs/tribal-court-directory.pdf"
REVIEW_FILE = "research/reviews/2026-11-22-service-links.json"


def own(link, evidence, page, flag=None, extra=""):
    """A hand decision for the service's own page; `page` says what the page
    is, for the note."""
    return {"rule": "own-page", "link": link, "basis": "manual", "evidence": evidence, "flag": flag,
            "note": f"Link added {REVIEW_DATE}: {page} (fetched with status 200 on {REVIEW_DATE}).{extra}"}


def listed(link, evidence, flag=None):
    return {"rule": "directory", "link": link, "basis": "manual", "evidence": evidence, "flag": flag,
            "note": f"Link is the entry in the {DIRECTORY_LABELS[link]}; no page of the court's own was found "
                    f"({REVIEW_DATE})."}


def none_found(evidence, flag=None):
    return {"rule": "none-found", "basis": "manual", "evidence": evidence, "flag": flag}


T = "content/tribes/"
TLPI = "tribal-law-policy-institute-justice-systems"
NARF = "narf-ipi-tribal-peacemaking-laws"
DECISIONS = {
    (T + "n/navajo-nation.yaml", NARF, "Navajo Nation Peacemaking Program (Hózhóójí Naat’áanii)"): own(
        NAVAJO_PEACEMAKING,
        "The Judicial Branch site's sidebar links indexpeacemaking.htm; it loaded on a retry (the proxy cut off "
        "other tries) with the title “The Navajo Nation Peacemaking Program”, and its main frame "
        "(Peacemaking/peacemain.htm) is headed “Peacemaking Program of the Navajo Nation” and describes Hózhóji "
        "Naat’aah.",
        "the Peacemaking Program page of the Navajo Nation Judicial Branch, linked from the Judicial Branch "
        "sidebar and titled “The Navajo Nation Peacemaking Program”",
        extra=f" The program's Plan of Operations ({NAVAJO_PLAN}) is linked from it."),
    (T + "b/blue-lake-rancheria.yaml", TLPI, "Blue Lake Rancheria Tribal Court"): own(
        "https://www.bluelakerancheria-nsn.gov/departments/tribal-court/",
        "The Nov. 21 review named this page but logged no status for it; fetched again with status 200, titled "
        "“Tribal Court - Blue Lake Rancheria”, with the court's ordinances and orders.",
        "the Tribal Court page on the nation's website"),
    (T + "c/confederated-tribes-of-the-colville-reservation.yaml", "narf-ipi-youth-family-peacemaking-laws",
     "Peacemaking Circle (juvenile)"): own(
        "https://www.cct-pmc.com/peacemaker-circle",
        "The Colville Tribes' website links “Peacemaker Circle” to this site, which names the Peacemaker Circle "
        "program and its staff; none of its pages read says whether it covers the juvenile circle of the code.",
        "the Peacemaker Circle program's own site, linked as “Peacemaker Circle” from the Colville Tribes' website; "
        "the page does not say whether it covers the juvenile circle named in the code",
        flag="Same program? The page names the Peacemaker Circle, not a juvenile circle."),
    (T + "c/confederated-tribes-of-the-coos-lower-umpqua-and-siuslaw-indians.yaml", NARF, "Peacegiving Court"): own(
        "https://ctclusi.org/tribal-court-peacegiving/",
        "Page titled “Tribal Court & Peacegiving Court”, with a Peacegiver nomination form.",
        "the Tribal Court & Peacegiving Court page on the nation's website"),
    (T + "h/healy-lake-village.yaml", "national-indian-law-library-healy-lake", "Tribal Court"): listed(
        AK_DIRECTORY,
        "The nation's home page only lists “Tribal Court” in its menu, with no page of its own; the Alaska Tribal "
        "Court Directory entry for Healy Lake Village answers Yes for an active court (type: Tribal court)."),
    (T + "h/hopland-band-of-pomo-indians.yaml", "national-indian-law-library-hopland-pomo", "Tribal Court"): own(
        "https://www.tribalcourt.org/",
        "The nation's website links its Tribal Court to the Northern California Intertribal Court System's site "
        "(Nov. 21 review, confirmed-other-name); that site describes the court system serving its member Tribes "
        "but does not name Hopland on its home page.",
        "the site of the Northern California Intertribal Court System, to which the nation's website links its "
        "Tribal Court",
        flag="Intertribal court's site, linked by the nation as its Tribal Court; it does not name Hopland."),
    (T + "h/hopland-band-of-pomo-indians.yaml", TLPI, "Hopland Tribal Court"): own(
        "https://www.tribalcourt.org/",
        "As for the profile's “Tribal Court”: the nation's website links its Tribal Court to this site.",
        "the site of the Northern California Intertribal Court System, to which the nation's website links its "
        "Tribal Court",
        flag="Intertribal court's site, linked by the nation as its Tribal Court; it does not name Hopland."),
    (T + "j/jamestown-sklallam-tribe.yaml", TLPI, "Jamestown S’Klallam Tribal Court"): own(
        "https://jamestowntribe.org/program-staff/public-safety-justice/",
        "The nation's Public Safety & Justice page (status 200) has a Tribal Court section: “The Mission of the "
        "Jamestown S’Klallam Tribal Court is to ensure Civil and Criminal Justice ...”, with its address.",
        "the Public Safety & Justice page on the nation's website, which has a Tribal Court section"),
    (T + "l/lac-du-flambeau-band-of-lake-superior-chippewa-indians-of-the-lac-du-flambeau-reservation-of-wisconsin"
         ".yaml", "national-indian-law-library-lac-du-flambeau-chippewa", "Tribal Court"): own(
        "https://ldftribe.com/tribal-operations/tribal-courts/",
        "The Nov. 21 review named this page but logged no status for it; fetched with status 200, titled “Tribal "
        "Courts”, with the court office's telephone and court ordinances.",
        "the Tribal Courts page on the nation's website"),
    (T + "l/lac-du-flambeau-band-of-lake-superior-chippewa-indians-of-the-lac-du-flambeau-reservation-of-wisconsin"
         ".yaml", TLPI, "Lac du Flambeau Tribal Courts"): own(
        "https://ldftribe.com/tribal-operations/tribal-courts/",
        "As for the profile's “Tribal Court”: the nation's Tribal Courts page, status 200.",
        "the Tribal Courts page on the nation's website"),
    (T + "l/leech-lake-band.yaml", NARF, "Peacemaker Tribunal (BaMeNim Anishinaabeg Program), Leech Lake Band"): own(
        "https://www.llojibwe.org/court/bamenim.html",
        "The Tribal Court page says the court's second component is the Bamenim Anishinabeg program and links "
        "this page, headed “Tribal Court • Bamenim Anishinaabeg Program”.",
        "the Bamenim Anishinaabeg Program page of the Leech Lake Tribal Court on the nation's website"),
    (T + "n/native-village-of-mekoryuk.yaml", "national-indian-law-library-native-mekoryuk", "Tribal Court"): listed(
        AK_DIRECTORY,
        "The nation's home page describes a Judicial branch of three judges but has no court page; the Alaska "
        "Tribal Court Directory entry for Mekoryuk answers Yes for an active court (type: Tribal Court)."),
    (T + "n/native-village-of-mekoryuk.yaml", TLPI, "Mekoryuk Tribal Court"): listed(
        AK_DIRECTORY,
        "As for the profile's “Tribal Court”: the Alaska Tribal Court Directory lists an active court."),
    (T + "o/oneida-nation.yaml", NARF, "Peacemaking and Mediation Division"): own(
        "https://oneida-nsn.gov/judiciary/peacemaking/",
        "The Judiciary page links “Peacemaking and Mediation” to this page, titled “Oneida Nation | Peacemaking and "
        "Mediation”, with forms and answers on requesting peacemaking.",
        "the Peacemaking and Mediation page of the Oneida Nation Judiciary"),
    (T + "p/pueblo-of-isleta.yaml", NARF, "Pueblo of Isleta Peacemaking Program"): own(
        "https://www.isletapueblo.com/tribal-court-peacemaking-program/",
        "The Tribal Court page links “Tribal Court Peacemaking Program” to this page, which names the program and "
        "links its rules and request form.",
        "the Tribal Court Peacemaking Program page on the nation's website"),
    (T + "p/pueblo-of-taos.yaml", TLPI, "Pueblo of Taos Tribal Court"): own(
        "https://taospueblo-nsn.gov/tribal-court/",
        "The profile's linked “Tribal Court” page (taospueblo.org/tribal-court/) redirects here, titled “Tribal "
        "Court – Taos Pueblo”; status 200.",
        "the Tribal Court page on the nation's website"),
    (T + "s/seneca-nation-of-indians.yaml", TLPI,
     "Seneca Nation of New York – Cattaraugus Reservation Court of Appeals"): own(
        "https://sni.org/about-our-government/judicial/",
        "The nation's Judicial page has a Court of Appeals section: “The Court of Appeals is comprised of six judges "
        "who hear appeals from the Peacemakers and Surrogates Courts”.",
        "the Judicial page on the nation's website, which has a Court of Appeals section"),
    (T + "s/spirit-lake-tribe.yaml", NARF, "Wodakota: Traditional Court"): own(
        "https://www.spiritlakenation.com/programs/spirit-lake-tribal-court/",
        "The Tribal Court page lists the court's divisions, among them “Traditional Court”; it does not use the "
        "name Wodakota.",
        "the Spirit Lake Tribal Court page on the nation's website, which lists a Traditional Court among the "
        "court's divisions"),
    (T + "s/st-croix-chippewa-indians-of-wisconsin.yaml", "national-indian-law-library-st-croix-chippewa",
     "Tribal Court"): own(
        "https://stcroixojibwe-nsn.gov/",
        "The profile already links “St. Croix Chippewa Tribal Court” to the nation's home page (court review, "
        "link-dead-court-found), which says the nation has “a dedicated court system”; no court page of its own "
        "was found.",
        "the nation's home page, which the profile already uses for the same court (“St. Croix Chippewa Tribal "
        "Court”); no court page of its own was found",
        flag="Home page, not a court page; the same link the profile already gives the same court."),
    (T + "t/the-chickasaw-nation.yaml", "narf-ipi-other-tribal-materials", "Chickasaw Nation Peacemaking Court"): own(
        "https://judicial.chickasaw.net/Courts/Peacemaking-Court.aspx",
        "The Judicial Department site links “Peacemaking Court” to this page: “The Chickasaw Nation Peacemaking "
        "Court is a forum for resolving conflicts using Chickasaw traditions ...”.",
        "the Peacemaking Court page of the Chickasaw Nation Judicial Department"),
    (T + "t/the-chickasaw-nation.yaml", NARF, "Chickasaw Nation Peacemaking Court"): own(
        "https://judicial.chickasaw.net/Courts/Peacemaking-Court.aspx",
        "As for the other entry of the same name: the Judicial Department's Peacemaking Court page.",
        "the Peacemaking Court page of the Chickasaw Nation Judicial Department"),
    (T + "t/tohono-oodham-nation-of-arizona.yaml", TLPI, "Tohono O’odham Nation Judicial Court"): own(
        "https://tojc-nsn.gov/",
        "The Nov. 21 review's evidence was the job list of this site; its home page (status 200) is titled "
        "“Tohono O'odham Judicial Courts”, with the courts' telephone, fees, forms and schedule.",
        "the home page of the Tohono O'odham Judicial Courts' own website"),
    (T + "u/ute-mountain-ute-tribe.yaml", "national-indian-law-library-ute-mtn-ute", "Tribal Court"): own(
        "https://www.utemountainutetribe.com/CFR%20courts.html",
        "The Nov. 21 review named this page but logged no status for it; fetched with status 200, titled “CFR "
        "COURTS”, with the court's forms and dockets. The court is a Court of Indian Offenses (CFR court).",
        "the CFR Courts page on the nation's website; the court it shows is a Court of Indian Offenses",
        flag="The page shows a CFR court (Court of Indian Offenses); the entry's kind says tribal-court."),
    (T + "w/wilton-rancheria.yaml", "national-center-on-restorative-justice-restorative-justice-tribal-laws-database",
     "Wilton Rancheria Traditional Court"): own(
        "https://wiltonrancheria-nsn.gov/tribal-government/tribal-court/traditional-court/",
        "The Tribal Court page says the Judicial Branch consists of the Tribal Court, the Appellate Panel and the "
        "Traditional Court, and links this page, titled “Traditional Court – Wilton Rancheria”.",
        "the Traditional Court page on the nation's website"),
    (T + "p/pueblo-of-santa-ana.yaml", "national-indian-law-library-pueblo-santa-ana", "Tribal Court"): own(
        "https://santaana-nsn.gov/tribalcourt-front-page/",
        "The Nov. 22 court review confirmed the court from a post on the nation's site; the nation's site also has "
        "this page, titled “TribalCourt Front page”, read from that review's saved copy.",
        "the Tribal Court front page on the nation's website"),
    (T + "p/pueblo-of-santa-ana.yaml", TLPI, "Pueblo of Santa Ana Tribal Court"): own(
        "https://santaana-nsn.gov/tribalcourt-front-page/",
        "As for the profile's “Tribal Court”: the Tribal Court front page on the nation's website.",
        "the Tribal Court front page on the nation's website"),
    # Looked for and not found, where the reason is worth recording. The Nov.
    # 22 court review confirmed these courts from a news post or notice on the
    # nation's site; a post is not the court's own page, and no official
    # directory lists the court.
    (T + "c/cow-creek-band-of-umpqua-tribe-of-indians.yaml", TLPI, "Cow Creek Tribal Court"): none_found(
        "The only page naming the court is a 2024 post on the nation's site about a peacemaker training session.",
        flag="Use the post https://www.cowcreek-nsn.gov/mark-your-calendars-peacemaker-training-session/?"),
    (T + "m/mescalero-apache-tribe-of-the-mescalero-reservation.yaml", "national-indian-law-library-mescalero-apache",
     "Tribal Court"): none_found(
        "Only notices on the nation's site name the court (hours, hearings); the profile's other Mescalero court "
        "entry keeps its own link.",
        flag="Use the notice https://mescaleroapachetribe.com/13435/mescalero-tribal-court-public-notice/?"),
    (T + "m/mississippi-band-of-choctaw-indians.yaml", "national-indian-law-library-mississippi-choctaw",
     "Tribal Court"): none_found(
        "Only a 2025 job post for a court clerk and the Supreme Court opinions page name the courts.",
        flag="Use https://www.choctaw.org/supreme-court-opinions/ or the job post?"),
    (T + "m/mississippi-band-of-choctaw-indians.yaml", TLPI, "Mississippi Band of Choctaw Indians Tribal Court"):
        none_found("As for the profile's “Tribal Court”: only a job post and the Supreme Court opinions page.",
                   flag="Use https://www.choctaw.org/supreme-court-opinions/ or the job post?"),
    (T + "o/omaha-tribe-of-nebraska.yaml", "national-indian-law-library-omaha-of-nebraska", "Tribal Court"):
        none_found("Only posts on the nation's site name the court (an order of March 23, 2026, new court dates).",
                   flag="Use the post https://www.omahatribe.com/omaha-tribal-court/?"),
    (T + "t/turtle-mountain-band-of-chippewa-indians-of-north-dakota.yaml", "national-indian-law-library-turtle-mountain",
     "Tribal Court"): none_found(
        "Only a June 2026 notice putting Tribal Code amendments on the court's clerk and judges out for comment.",
        flag="Use the notice on tmchippewa.com?"),
    (T + "t/turtle-mountain-band-of-chippewa-indians-of-north-dakota.yaml", TLPI,
     "Turtle Mountain Chippewa Tribal Court"): none_found(
        "As for the profile's “Tribal Court”: only a notice on the nation's site.",
        flag="Use the notice on tmchippewa.com?"),
    (T + "w/winnemucca-indian-colony-of-nevada.yaml", "national-indian-law-library-winnemucca", "Tribal Court"):
        none_found(
            "The nation's home page names the court (court information, procedures and fees) but there is no court "
            "page, and no official directory of Nevada tribal courts was found.",
            flag="Use the nation's home page (https://winnemuccaindiancolony.org/), which names the court?"),
    (T + "t/three-affiliated-tribes-of-the-fort-berthold-reservation.yaml",
     "national-indian-law-library-three-affiliated-fort-berthold", "Tribal Court:-"): none_found(
        "The nation's home page links “Fort Berthold District Court” to https://fbdcourt.com/, which refused the "
        "request (403); no official directory entry was found.",
        flag="Open https://fbdcourt.com/ in a browser; if it shows the court, it is the court's own page."),
    (T + "t/three-affiliated-tribes-of-the-fort-berthold-reservation.yaml", TLPI,
     "Three Affiliated Tribes of the Fort Berthold Tribal Court"): none_found(
        "As for the profile's other entry: the court's own site, https://fbdcourt.com/, refused the request (403).",
        flag="Open https://fbdcourt.com/ in a browser; if it shows the court, it is the court's own page."),
    (T + "c/confederated-tribes-of-the-coos-lower-umpqua-and-siuslaw-indians.yaml",
     "narf-ipi-youth-family-peacemaking-laws", "Wellness Court"): none_found(
        "The Tribal Court & Peacegiving Court page does not name a wellness court; the nation's other pages read "
        "do not either."),
    (T + "c/chitimacha-tribe-of-louisiana.yaml", NARF, "Peacemaker Court"): none_found(
        "The Tribal Courts page does not name the Peacemaker Court; the nation's code page lists “CCCJ Title IA - "
        "Peacemaker Court”, a law, not a page of the court's own."),
    (T + "m/mashantucket-pequot-indian-tribe.yaml", NARF, "Peacemakers Council"): none_found(
        "The nation's website refused the request (403), as it did for the court reviews.",
        flag="Open the nation's site (https://www.mptn-nsn.gov/) in a browser."),
    (T + "s/snoqualmie-indian-tribe.yaml", NARF, "Peacemaker Court"): none_found(
        "The nation's website refused the request (a challenge page), as it did for the court reviews.",
        flag="Open the nation's site (https://snoqualmietribe.us/) in a browser."),
}


GENERIC_NAME = re.compile(r"^(tribal[- ]courts?|tribal court:-|court|courts|judicial (branch|services))$", re.IGNORECASE)


def same_court(service, sibling):
    """A linked entry of the same profile that is clearly the same court: both
    are tribal courts and one of the two names is only "Tribal Court" or the
    names share their distinctive words."""
    if service["section"] != "justice_institutions" or sibling["section"] != "justice_institutions":
        return False
    if service["kind"] != "tribal-court" or sibling["kind"] != "tribal-court":
        return False
    if GENERIC_NAME.match(service["name"].strip()) or GENERIC_NAME.match(sibling["name"].strip()):
        return True
    words = lambda name: {w.lower().strip("’'") for w in re.findall(r"[\w’']+", name)} - second_pass.GENERIC
    return words(service["name"]) == words(sibling["name"])


def fetched_pages(work):
    """Every address known to have been fetched with status 200: this review's
    fetch log and the Nov. 21 and Nov. 22 reviews' fetched pages."""
    ok = {}
    for entry in json.loads((work / "fetch-log.json").read_text(encoding="utf-8")):
        if entry["status"] == 200 and entry["outcome"] == "ok":
            ok[entry["url"]] = entry["fetched"]
            if entry.get("final"):
                ok.setdefault(entry["final"], entry["fetched"])
    for row in json.loads(FIRST_PASS.read_text(encoding="utf-8")):
        for page in row["pages_fetched"]:
            if page["status"] == 200:
                ok.setdefault(page["url"], "2026-11-21")
    for row in json.loads(SECOND_PASS.read_text(encoding="utf-8")):
        if row["evidence_checked"] and row.get("evidence_url"):
            ok.setdefault(row["evidence_url"], "2026-11-22")
    return ok


def decide(service):
    """(rule, link, basis, evidence) for one service."""
    key = (service["profile"], service["source"], service["name"])
    if key in DECISIONS:
        d = DECISIONS[key]
        return d["rule"], d.get("link"), d["basis"], d["evidence"]
    one, two = service["first_pass"], service["second_pass"]
    if two and two["verdict"] in POSITIVE_SECOND and two["evidence_kind"] in OWN_KINDS and two["evidence_checked"]:
        link = two["working_link"] or two["evidence_url"]
        return ("own-page", link, "second-pass",
                f"The Nov. 22 court review ({two['item_id']}, {two['verdict']}) found the court on "
                f"{'its own website' if two['evidence_kind'] == 'court-website' else 'the nation’s website'}"
                + (f", named “{two['name_on_page']}”" if two.get("name_on_page") else "") + ".")
    own = first_pass_page(one) if one else None
    if own and own not in NOT_OWN_PAGE and host_of(own) not in INTERTRIBAL_HOSTS and (
            not is_root(own) or re.search(r"court|judic|justice", host_of(own))):
        return ("own-page", own, "first-pass",
                f"The Nov. 21 court review ({one['verdict']}) fetched this page with status 200 and found the court "
                f"named “{one['name_on_page']}”.")
    for sibling in service["siblings"]:
        if sibling.get("confirmed_page") and same_court(service, sibling) and sibling["confirmed_page"] \
                not in NOT_OWN_PAGE and (not is_root(sibling["confirmed_page"])
                                         or re.search(r"court|judic|justice", host_of(sibling["confirmed_page"]))):
            return ("own-page", sibling["confirmed_page"], "same-court",
                    f"The profile lists the same court as “{sibling['name']}” ({sibling['source']}), whose page the "
                    f"court review confirmed (first pass {sibling['first_pass_verdict']}"
                    + (f", second pass {sibling['second_pass_verdict']}" if sibling["second_pass_verdict"] else "")
                    + ").")
    if two and two["verdict"] in POSITIVE_SECOND and two["evidence_kind"] in DIRECTORY_KINDS and two["evidence_checked"]:
        label = DIRECTORY_LABELS.get(two["evidence_url"], two["evidence_url"])
        return ("directory", two["evidence_url"], "second-pass",
                f"The Nov. 22 court review ({two['item_id']}, {two['verdict']}) found the court listed in the {label}"
                + (f" as “{two['name_on_page']}”" if two.get("name_on_page") else "")
                + "; it found no page of the court's own.")
    reason = "No page of the service's own and no official directory entry listing it was found."
    if two:
        reason = (f"The Nov. 22 court review ({two['item_id']}) ended {two['verdict']}: no page of the court's own and "
                  "no official directory entry listing it.")
    return "none-found", None, "searched", reason


# --------------------------------------------------------------------------- merge


def note_for(service, rule, link, basis, evidence, fetched):
    date = fetched.get(link, REVIEW_DATE)
    if basis == "manual":
        return DECISIONS[(service["profile"], service["source"], service["name"])]["note"]
    if rule == "own-page" and basis == "same-court":
        sibling = next(s for s in service["siblings"] if s.get("confirmed_page") == link and same_court(service, s))
        review = ("research/reviews/2026-11-22-court-listings-second-pass.json" if sibling["second_pass_verdict"]
                  in POSITIVE_SECOND else "research/reviews/2026-11-21-court-listings.json")
        return (f"Link added {REVIEW_DATE}: the page of the same court this profile also lists as “{sibling['name']}”, "
                f"which the court review confirmed ({review}); see research/reviews/2026-11-22-service-links.json, "
                f"{service['item_id']}.")
    if rule == "own-page":
        where = "the court's own website" if re.search(r"court|judic|justice", host_of(link)) else "the nation's website"
        review = ("research/reviews/2026-11-21-court-listings.json" if basis == "first-pass"
                  else "research/reviews/2026-11-22-court-listings-second-pass.json")
        return (f"Link added {REVIEW_DATE}: the court's page on {where}, fetched with status 200 on {date} by the court "
                f"review ({review}); see research/reviews/2026-11-22-service-links.json, {service['item_id']}.")
    if rule == "directory":
        label = DIRECTORY_LABELS.get(link, link)
        return (f"Link is the entry in the {label}; no page of the court's own was found ({REVIEW_DATE}; "
                f"research/reviews/2026-11-22-service-links.json, {service['item_id']}).")
    return None


def merge(work):
    services = json.loads((work / "evidence.json").read_text(encoding="utf-8"))
    fetched = fetched_pages(work)
    rows, problems = [], []
    for service in services:
        rule, link, basis, evidence = decide(service)
        if (service["profile"], service["source"], service["name"]) in DECISIONS:
            basis = "manual"
        if link and link not in fetched:
            problems.append(f"{service['item_id']} {service['name']}: {link} was not fetched with status 200")
        rows.append({
            "item_id": service["item_id"], "profile": service["profile"], "nation": service["nation"],
            "section": service["section"], "kind": service["kind"], "name": service["name"],
            "source": service["source"], "verification": service["verification"], "old_link": None,
            "new_link": link, "rule": rule, "basis": basis, "evidence": evidence,
            "fetched": fetched.get(link) if link else None,
            "note_added": note_for(service, rule, link, basis, evidence, fetched) if link else None,
            "topic": service["topic"], "evidence_checked": not link or link in fetched,
            "for_lead_author": (DECISIONS.get((service["profile"], service["source"], service["name"])) or {}).get(
                "flag"),
        })
    keys = {(s["profile"], s["source"], s["name"]) for s in services}
    problems += [f"hand decision matches no service: {key}" for key in DECISIONS if key not in keys]
    columns = ["item_id", "profile", "nation", "section", "kind", "name", "source", "old_link", "new_link", "rule",
               "basis", "evidence", "fetched", "note_added", "evidence_checked", "for_lead_author"]
    REVIEW.with_suffix(".json").write_text(json.dumps(rows, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    with open(REVIEW.with_suffix(".csv"), "w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(columns + ["lead_author_decision"])
        for row in rows:
            writer.writerow(["" if row[c] is None else row[c] for c in columns] + [""])
    logs = write_search_logs(services, {r["item_id"]: r for r in rows})
    counts = collections.Counter((r["rule"], r["topic"]) for r in rows)
    print(f"{len(rows)} services: {dict(counts)}; {logs} search logs written")
    for line in problems:
        print("problem:", line)


# --------------------------------------------------------------------------- search logs


def status_outcome(status, outcome):
    if outcome == "blocked" or status in second_pass.BLOCKED_STATUSES:
        return "blocked"
    if outcome == "robots":
        return "blocked"
    if not status:
        return "error"
    if status in (404, 410):
        return "dead-link"
    return None if status == 200 else "error"


def searches_for(service, row):
    """Every place looked for one service, as search log entries."""
    entries = []
    link = row["new_link"]

    def add(place_kind, address, method, outcome, reason, query=None, records=None):
        entry = {"date": REVIEW_DATE, "searched_by": SEARCHED_BY, "method": method, "place_kind": place_kind,
                 "address": address, "query": query, "outcome": outcome, "reason": reason, "records": records}
        entries.append({k: v for k, v in entry.items() if v is not None})

    one, two = service["first_pass"], service["second_pass"]
    if one:
        add("project-capture", "research/reviews/2026-11-21-court-listings.json", "ai-review",
            "found" if row["basis"] == "first-pass" else "not-found",
            f"Read the Nov. 21 court review's result for this court (verdict {one['verdict']}"
            + (f", page {one['evidence_url']}" if one.get("evidence_url") else "") + ")"
            + ("; its page is now the service's link." if row["basis"] == "first-pass" else
               "; it gives no page of the court's own fetched with status 200." if not first_pass_page(one) else
               "; its page is not used as the link (see this review's evidence)."))
    if two:
        used = row["basis"] == "second-pass"
        add("project-capture", "research/reviews/2026-11-22-court-listings-second-pass.json", "ai-review",
            "found" if used else "not-found",
            f"Read the Nov. 22 court review's result ({two['item_id']}, verdict {two['verdict']}"
            + (f", {two['evidence_kind']} {two['evidence_url']}" if two.get("evidence_url") else "") + ")"
            + ("; it is now the service's link." if used else "; it gives no page or directory entry to link."))
    if row["basis"] == "same-court":
        add("project-capture", service["profile"], "ai-review", "found",
            f"The profile lists the same court with a link the court review confirmed: {link}.")
    for page in service["pages"]:
        outcome = status_outcome(page["status"], page["outcome"])
        found = link and (page["url"] == link or page.get("final") == link)
        kind = "court-website" if re.search(r"court|judic|justice|peacemak", page["url"], re.IGNORECASE) \
            else "nation-website"
        if host_of(page["url"]) in INTERTRIBAL_HOSTS:
            kind = "intertribal-organization"
        earlier = " (read from the Nov. 22 court review's saved copy, not fetched again)" if page.get(
            "earlier_fetch") else ""
        shows = page["url"] in ALSO_SHOWS
        if outcome == "blocked":
            reason = f"The site refused the request (status {page['status']}){earlier}; not worked around."
        elif outcome:
            reason = (f"Status {page['status']}" if page["status"] else "No answer (the connection failed)") + \
                f"{earlier}; not read."
        elif found:
            reason = f"Status 200{earlier}; the page shows the service, and it is now the service's link."
        elif page["url"] in ALSO_SHOWS:
            reason = f"Status 200{earlier}; {ALSO_SHOWS[page['url']]}."
        else:
            reason = f"Status 200{earlier}; not used as the link: it does not name the service or is not its own page."
        add(kind, page["url"], "script", "found" if found or shows else (outcome or "not-found"), reason,
            query=f"{SCRIPT}: the service's name and words for a court or peacemaking")
    if service["item_id"] and service["profile"].endswith("navajo-nation.yaml") and \
            service["kind"] == "peacemaking-program":
        add("court-website", NAVAJO_PEACEMAKING, "by-hand", "found", NAVAJO_TRIES,
            query="curl, six tries with growing pauses")
    for search in service["site_search"]:
        home = search["home"]
        outcome = status_outcome(home["status"], home["outcome"])
        earlier = "; read from the Nov. 22 court review's saved copy, not fetched again" if search.get(
            "earlier_fetch") else ""
        add("nation-website", search["site"], "script", outcome or "not-found",
            f"Home page status {home['status']}{earlier}; {len(search['pages'])} linked pages mentioning a court, "
            f"judiciary, justice or peacemaking were read"
            + (f"; robots.txt disallows {len(search['skipped_by_robots'])} more" if search["skipped_by_robots"] else "")
            + ".", query=f"{SCRIPT}: words for a court, judiciary, justice or peacemaking")
    if not service["nation_sites"] and (service["pages"] or row["rule"] == "none-found"):
        add("nation-website", "No website on record in the profile", "script", "no-site",
            "The profile lists no official website for the nation.")
    add("project-capture", "research/reviews/2026-11-22-service-links.json", "ai-review",
        "found" if link else "not-found",
        f"Claude weighed the evidence against the lead author's order (own page, then directory entry): {row['rule']}"
        + (f", {link}." if link else "; the link stays empty and the service stays listed."),
        records=[f"research/reviews/2026-11-22-service-links.json#{service['item_id']}"])
    for entry in entries:
        entry["service"] = service["name"]
    return entries


def write_search_logs(services, rows):
    by_log = collections.defaultdict(list)
    for service in services:
        by_log[(service["topic"], service["profile"])].append(service)
    for (topic, profile), group in sorted(by_log.items()):
        path = SEARCH_LOGS / topic / pathlib.PurePosixPath(profile).parent.name / pathlib.PurePosixPath(profile).name
        names = list(dict.fromkeys(s["name"] for s in group))
        keyed, order = collections.defaultdict(list), []
        for service in group:
            for entry in searches_for(service, rows[service["item_id"]]):
                key = (entry["method"], entry["place_kind"], entry["address"], entry["outcome"], entry["reason"],
                       tuple(entry.get("records", [])))
                if key not in keyed:
                    order.append((key, entry))
                if entry["service"] not in keyed[key]:
                    keyed[key].append(entry["service"])
        searches = []
        for key, entry in order:
            entry = {k: v for k, v in entry.items() if k != "service"}
            listed = keyed[key]
            prefix = ("Every service without a link listed for this nation" if len(names) > 1
                      and len(listed) == len(names) else " and ".join(f"“{n}”" for n in listed))
            entry["reason"] = f"{prefix}: {entry['reason']}"
            searches.append(entry)
        old = {}
        if path.exists():
            old = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            # Entries are added, never removed; a rerun replaces only its own.
            kept = [e for e in old.get("searches", []) if not (str(e.get("date")) == REVIEW_DATE and SCRIPT in str(
                e.get("query", "")) + str(e.get("records", "")) + str(e.get("reason", "")))
                and "2026-11-22-service-links" not in str(e.get("records", "")) + str(e.get("address", ""))]
            searches = kept + searches
        blocked = sorted({s["address"] for s in searches if s["outcome"] == "blocked"
                          and s["place_kind"] in ("nation-website", "court-website")})
        if any(s["outcome"] == "found" for s in searches):
            status = "found"
        elif blocked:
            status = "partly-searched"
        elif old.get("status") in ("partly-searched",):
            status = old["status"]
        else:
            status = "none-found"
        log = {"profile": profile, "topic": topic, "status": status,
               "last_searched": max(str(s["date"]) for s in searches), "searches": searches}
        unlinked = [s["name"] for s in group if not rows[s["item_id"]]["new_link"]]
        steps = old.get("next_steps")
        if unlinked:
            extra = ("No page or official directory entry was found on 2026-11-22 for "
                     + "; ".join(f"“{n}”" for n in unlinked) + " (research/reviews/2026-11-22-service-links.json)"
                     + (". A person could open in a browser the pages that refused the project's link checker: "
                        + ", ".join(blocked[:5]) if blocked else "") + ".")
            steps = f"{steps} {extra}" if steps and extra not in steps else (steps or extra)
        if steps:
            log["next_steps"] = steps
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(yaml.dump(log, sort_keys=False, allow_unicode=True, width=100), encoding="utf-8")
    return len(by_log)


# --------------------------------------------------------------------------- apply


def dumped(profile):
    return yaml.safe_dump(profile, allow_unicode=True, sort_keys=False, width=100)


def patch_text(original, base, new):
    """Apply the change from `base` to `new` (two dumps of the profile) to the
    file's own text, so lines the dump would reflow elsewhere stay as they
    are."""
    if original == base:
        return new
    base_lines, new_lines = base.splitlines(True), new.splitlines(True)
    result = original
    matcher = __import__("difflib").SequenceMatcher(a=base_lines, b=new_lines, autojunk=False)
    for tag, i1, i2, j1, j2 in reversed(matcher.get_opcodes()):
        if tag == "equal":
            continue
        context = "".join(base_lines[max(0, i1 - 3):i2])
        replacement = "".join(base_lines[max(0, i1 - 3):i1] + new_lines[j1:j2])
        if result.count(context) != 1:
            raise SystemExit(f"cannot place a change in the file's own text: {context[:80]!r}")
        result = result.replace(context, replacement)
    return result


def with_link(fact, link, note):
    """The fact with `link` placed right after `name` (or `kind`), and the note
    extended."""
    ordered = {}
    for key, value in fact.items():
        ordered[key] = value
        if key == "name" or (key == "kind" and "name" not in fact):
            ordered["link"] = link
    ordered.setdefault("link", link)
    ordered["note"] = f"{fact['note']} {note}" if fact.get("note") else note
    return ordered


def apply(check):
    rows = [r for r in json.loads(REVIEW.with_suffix(".json").read_text(encoding="utf-8"))
            if r["new_link"] and r["evidence_checked"]]
    by_profile = collections.defaultdict(list)
    for row in rows:
        by_profile[row["profile"]].append(row)
    changed, skipped = collections.Counter(), []
    for relative, group in sorted(by_profile.items()):
        path = ROOT / relative
        original = path.read_text(encoding="utf-8")
        profile = record_facts.load_yaml(original)
        base = dumped(profile)
        for row in group:
            if row["section"] == "justice_institutions":
                facts = profile.get("justice_institutions") or []
            else:
                facts = (profile.get("dispute_resolution") or {}).get("forums") or []
            same = [f for f in facts if f["source"] == row["source"]
                    and (f.get("name") or f.get("own_term", {}).get("name") or f.get("kind")) == row["name"]]
            if any(f.get("link") == row["new_link"] for f in same):
                continue
            matches = [i for i, f in enumerate(facts) if f in same and not f.get("link")]
            if len(matches) != 1:
                skipped.append(f"{row['item_id']} {relative} {row['name']}: {len(matches)} matching facts")
                continue
            facts[matches[0]] = with_link(facts[matches[0]], row["new_link"], row["note_added"])
            changed[row["rule"]] += 1
        if not check:
            path.write_text(patch_text(original, base, dumped(profile)), encoding="utf-8")
    print(f"{'would link' if check else 'linked'} {sum(changed.values())} services in {len(by_profile)} profiles: "
          f"{dict(changed)}")
    for line in skipped:
        print("skipped", line)


# --------------------------------------------------------------------------- second search (Nov. 23)

SECOND_DATE = "2026-11-23"
SD_LIST = "https://ujs.sd.gov/tribal-courts/"
ND_LIST = "https://www.ndcourts.gov/other-courts/tribal"
NE_LIST = ("https://nebraskajudicial.gov/administration/committees-commissions/access-justice-commission-committees/"
           "consortium-tribal-state-and-federal-courts")
NM_LIST = "https://tribalstate.nmcourts.gov/contact/"
OR_LIST = "https://www.courts.oregon.gov/programs/jcip/Documents/Tribal%20contact%20info.pdf"
BIA_SOUTHERN_PLAINS = "https://www.bia.gov/CFRCourts/southern-plains-cfr-court"
SECOND_LABELS = {
    SD_LIST: "South Dakota Unified Judicial System's Tribal Courts list (“South Dakota Tribal Court Contact "
             "Information”)",
    ND_LIST: "North Dakota Court System's Tribal Courts list",
    NE_LIST: "Nebraska Judicial Branch's member list of the Consortium of Tribal, State, and Federal Courts",
    NM_LIST: "New Mexico Tribal-State Judicial Consortium's list of tribal courts (its Contact page)",
    OR_LIST: "Oregon Judicial Department's “Oregon Tribal Court Contact Information” list",
    BIA_SOUTHERN_PLAINS: "Bureau of Indian Affairs list of the Tribes the Southern Plains CFR Court (a Court of "
                         "Indian Offenses) serves",
}
SD_FLAG = ("Directory entry to confirm: the South Dakota court system's Tribal Courts page lists the nation under "
           "“South Dakota Tribal Court Contact Information” with the Tribe's own address, telephone and website, "
           "not a court office.")
ND_FLAG = ("Directory entry to confirm: the North Dakota court system's Tribal Courts page gives only the nation's "
           "name and website.")
# Claude read each page on 2026-11-23; `seen` is what the page shows.
SECOND_DECISIONS = {
    "service-086": {"rule": "own-page", "link": "https://ftbelknap.org/courts",
                    "seen": "the nation's page headed “Courts”, with the Law and Order Code and the court's filing "
                            "forms (petitions, filing schedule, request for court document)",
                    "flag": "Own page to confirm: the page is headed “Courts” and holds the court's forms, with no "
                            "description or contact details of the court."},
    "service-159": {"rule": "own-page", "link": "https://www.choctaw.org/about-us/tribal-government/",
                    "seen": "the “Judicial System” section of the nation's Tribal Government page, which describes "
                            "the Choctaw Tribal Courts (Criminal, Civil, Domestic Violence, Youth and Peacemaker "
                            "courts) and the Choctaw Supreme Court",
                    "flag": "Own page to confirm: the court is described in a section of the nation's Tribal "
                            "Government page; the nation has no page for the court alone."},
    "service-146": {"rule": "own-page", "link": "https://mashpeewampanoagtribe-nsn.gov/about-peacemakers-court",
                    "seen": "the nation's page “About Peacemakers Court”, which says the Peacemakers Court of the "
                            "Mashpee Wampanoag Tribe is part of the Tribal Judiciary"},
    "service-061": {"rule": "own-page", "link": "https://ctclusi.org/tribal-court-peacegiving/",
                    "seen": "the nation's “Tribal Court & Peacegiving Court” page, which names the Healing to "
                            "Wellness Court as one of the court's problem-solving programs and says who may take part"},
    "service-153": {"rule": "own-page", "link": "https://mescaleroapachetribe.com/mtc/",
                    "seen": "the nation's page “Mescalero Tribal Court”, with the court's address, telephone, email "
                            "and mission statement"},
    "service-080": {"rule": "own-page", "link": "https://www.elyshoshonetribe.com/departments",
                    "seen": "the nation's Departments page, whose Judicial Center entry gives the court's address, "
                            "telephone and fax and its tribal judge and court clerk",
                    "flag": "Own page to confirm: the court is an entry (Judicial Center) on the nation's Departments "
                            "page; the nation has no page for the court alone."},
    "service-271": {"rule": "directory", "link": SD_LIST, "seen": "lists the Oglala Sioux Tribe", "flag": SD_FLAG},
    "service-138": {"rule": "directory", "link": SD_LIST, "seen": "lists the Lower Brule Sioux Tribe",
                    "flag": SD_FLAG},
    "service-072": {"rule": "directory", "link": SD_LIST, "seen": "lists the Crow Creek Sioux Tribe", "flag": SD_FLAG},
    "service-358": {"rule": "directory", "link": ND_LIST, "seen": "lists the Standing Rock Sioux Tribe",
                    "flag": ND_FLAG + " The South Dakota court system's list names the Tribe too."},
    "service-372": {"rule": "directory", "link": ND_LIST, "seen": "lists “Three Affiliated - MHA Nation”",
                    "flag": ND_FLAG + " The court's own site, https://fbdcourt.com/, refused the project's requests; "
                                      "if a person opens it and it shows the court, it should replace this link."},
    "service-386": {"rule": "directory", "link": ND_LIST, "seen": "lists the Turtle Mountain Band of Chippewa",
                    "flag": ND_FLAG},
    "service-274": {"rule": "directory", "link": NE_LIST, "seen": "names the “Omaha Tribal Court, Omaha Tribe of "
                                                                  "Nebraska” among its members"},
    "service-341": {"rule": "directory", "link": NE_LIST, "seen": "names the “Santee Sioux Nation Tribal Court” among "
                                                                  "its members"},
    "service-315": {"rule": "directory", "link": NM_LIST, "seen": "lists “Pueblo of Sandia – Tribal Court” under "
                                                                  "“Tribal Courts”, with its address, telephone, court "
                                                                  "handbook and website"},
    "service-313": {"rule": "directory", "link": NM_LIST,
                    "seen": "lists “Pueblo of San Ildefonso – San Ildefonso” under “Tribal Courts”, with its address, "
                            "telephone and court handbook",
                    "flag": "Directory entry to confirm: the entry sits under “Tribal Courts” and links the Pueblo's "
                            "court handbook, but its heading names the Pueblo, not a court."},
    "service-070": {"rule": "directory", "link": OR_LIST,
                    "seen": "lists the Cow Creek Band of Umpqua Tribe of Indians with its court's judge, court "
                            "administrator and address"},
    "service-020": {"rule": "directory", "link": BIA_SOUTHERN_PLAINS,
                    "seen": "names the Apache Tribe of Oklahoma among the Tribes located in the Southern Plains CFR "
                            "Court",
                    "flag": "Kind to check: the link is a Court of Indian Offenses that serves the Tribe, while the "
                            "entry's kind is tribal-court."},
}
# The second entry of a nation listed twice takes the same decision.
for first, second in (("service-086", "service-087"), ("service-159", "service-160"),
                      ("service-138", "service-139"), ("service-072", "service-073"), ("service-358", "service-359"),
                      ("service-372", "service-373"), ("service-386", "service-387"), ("service-341", "service-342"),
                      ("service-315", "service-316"), ("service-313", "service-314")):
    SECOND_DECISIONS[second] = SECOND_DECISIONS[first]
# Services still without a link whose Alaska Tribal Court Directory entry the
# lead author could accept as the directory link, though it does not say the
# court is active (Claude read the entries on 2026-11-23).
AK_QUESTION = ("Directory entry the lead author could accept: the 2022 Alaska Tribal Court Directory "
               "(https://courts.alaska.gov/courtdir/docs/tribal-court-directory.pdf) has an entry for the village that ")
SECOND_QUESTIONS = {
    "service-210": AK_QUESTION + "leaves the active-court question blank but gives a telephone and email to open a "
                                 "case; it is left without a link.",
    "service-284": AK_QUESTION + "leaves the active-court question blank and names the Council as the type of justice "
                                 "system; it is left without a link.",
    "service-175": AK_QUESTION + "answers “Currently developing. Check with Tribe on current status”; it is left "
                                 "without a link.",
}
# Services another change on `main` linked after the first pass, with the link
# the second search would have chosen; the review row records it and `apply`
# leaves the profile as it is.
SECOND_ALREADY = {
    "service-272": {"rule": "directory", "link": SD_LIST,
                    "why": "The individual courts review (pull request #173, research/reviews/"
                           "2026-11-22-individual-courts.json) had already linked this entry, now of kind "
                           "judicial-branch, to the same South Dakota Unified Judicial System list, with its own note"},
}
SECOND_FIELDS = ("items", "method", "place_kind", "address", "query", "outcome", "reason")


def second_note(item_id, decision):
    review = f"research/reviews/2026-11-22-service-links.json, {item_id}"
    if decision["rule"] == "own-page":
        return (f"Link added {SECOND_DATE} after a second search: {decision['seen']}, fetched with status 200 on "
                f"{SECOND_DATE}; see {review}.")
    return (f"Link is the entry in the {SECOND_LABELS[decision['link']]}; no page of the court's own was found in a "
            f"second search ({SECOND_DATE}; {review}).")


def read_searches(work):
    rows = []
    for line in (work / "searches.tsv").read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        rows.append(dict(zip(SECOND_FIELDS, line.split("\t"))))
    return rows


def second(work):
    fetched = json.loads((work / "fetch-log.json").read_text(encoding="utf-8"))
    rows = json.loads(REVIEW.with_suffix(".json").read_text(encoding="utf-8"))
    by_id = {r["item_id"]: r for r in rows}
    problems = []
    for item_id, decision in sorted(SECOND_DECISIONS.items()):
        row = by_id[item_id]
        entry = fetched.get(decision["link"]) or {}
        if entry.get("status") != 200:
            problems.append(f"{item_id}: {decision['link']} was not fetched with status 200")
        if row["rule"] != "none-found" and row["basis"] != "second-search":
            problems.append(f"{item_id}: the first pass already decided {row['rule']}")
            continue
        earlier = row["evidence"].split(" Earlier: ", 1)[1] if row["basis"] == "second-search" else row["evidence"]
        where = "the court's or the nation's own site" if decision["rule"] == "own-page" else \
            f"the {SECOND_LABELS[decision['link']]}"
        row.update({
            "new_link": decision["link"], "rule": decision["rule"], "basis": "second-search",
            "evidence": f"Second search, {SECOND_DATE}: {where}, fetched with status 200, "
                        + (f"is {decision['seen']}." if decision["rule"] == "own-page" else f"{decision['seen']}.")
                        + f" Earlier: {earlier}",
            "fetched": SECOND_DATE, "note_added": second_note(item_id, decision), "evidence_checked": True,
            "for_lead_author": decision.get("flag"),
        })
    for item_id, already in SECOND_ALREADY.items():
        row = by_id[item_id]
        earlier = row["evidence"].split(" Earlier: ", 1)[1] if row["basis"] == "second-search" else row["evidence"]
        if (fetched.get(already["link"]) or {}).get("status") != 200:
            problems.append(f"{item_id}: {already['link']} was not fetched with status 200")
        row.update({"new_link": already["link"], "rule": already["rule"], "basis": "second-search",
                    "evidence": f"Second search, {SECOND_DATE}: {already['why']}; the second search found the same "
                                f"list. Earlier: {earlier}",
                    "fetched": SECOND_DATE, "note_added": None, "evidence_checked": True, "for_lead_author": None})
    for item_id, question in SECOND_QUESTIONS.items():
        if by_id[item_id]["rule"] == "none-found":
            by_id[item_id]["for_lead_author"] = question
    REVIEW.with_suffix(".json").write_text(json.dumps(rows, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    columns = ["item_id", "profile", "nation", "section", "kind", "name", "source", "old_link", "new_link", "rule",
               "basis", "evidence", "fetched", "note_added", "evidence_checked", "for_lead_author"]
    with open(REVIEW.with_suffix(".csv"), "w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(columns + ["lead_author_decision"])
        for row in rows:
            writer.writerow(["" if row[c] is None else row[c] for c in columns] + [""])
    logs = second_search_logs(work, rows)
    counts = collections.Counter((r["rule"], r["kind"]) for r in rows if r["basis"] == "second-search")
    left = collections.Counter(r["kind"] for r in rows if r["rule"] == "none-found")
    print(f"second search: {sum(counts.values())} linked {dict(counts)}; still none {dict(left)}; {logs} logs")
    for line in problems:
        print("problem:", line)


def second_search_logs(work, rows):
    searches = read_searches(work)
    targets = [r for r in rows if r["rule"] == "none-found" or r["basis"] == "second-search"]
    by_id = {r["item_id"]: r for r in targets}
    by_log = collections.defaultdict(list)
    for row in targets:
        by_log[(row["topic"], row["profile"])].append(row)
    written = 0
    for (topic, profile), group in sorted(by_log.items()):
        path = SEARCH_LOGS / topic / pathlib.PurePosixPath(profile).parent.name / pathlib.PurePosixPath(profile).name
        old = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else {}
        kept = [e for e in old.get("searches", []) if str(e.get("date")) != SECOND_DATE
                or "second search" not in str(e.get("reason", "")).lower()]
        alaska = any("courts.alaska.gov" in str(e.get("address")) for e in kept)
        ids = {r["item_id"] for r in group}
        names = list(dict.fromkeys(r["name"] for r in group))
        entries = []
        for search in searches:
            wanted = set(search["items"].split(","))
            if (search["items"] == "ALL" or search["items"] == "ALASKA" and alaska) and topic == "courts":
                wanted = ids
            hit = [by_id[i]["name"] for i in sorted(wanted & ids)]
            if not hit:
                continue
            hit = list(dict.fromkeys(hit))
            web = search["method"] == "web-search"
            prefix = ("Every service listed for this nation that the first pass left without a link"
                      if len(names) > 1 and len(hit) == len(names) else " and ".join(f"“{n}”" for n in hit))
            entry = {"date": SECOND_DATE, "searched_by": SEARCHED_BY, "method": "ai-review" if web else "script",
                     "place_kind": search["place_kind"], "address": "web search" if web else search["address"],
                     "query": search["query"] if web else f"{SCRIPT} second: {search['query']}",
                     "outcome": search["outcome"], "reason": f"Second search: {prefix}: {search['reason']}"}
            entries.append(entry)
        for row in group:
            entries.append({
                "date": SECOND_DATE, "searched_by": SEARCHED_BY, "method": "ai-review", "place_kind": "project-capture",
                "address": "research/reviews/2026-11-22-service-links.json",
                "outcome": "found" if row["new_link"] else "not-found",
                "reason": f"Second search: “{row['name']}”: Claude weighed what the second search found against the "
                          f"lead author's order (own page, then directory entry): {row['rule']}"
                          + (f", {row['new_link']}." if row["new_link"] else
                             "; the link stays empty and the service stays listed."),
                "records": [f"research/reviews/2026-11-22-service-links.json#{row['item_id']}"]})
        all_searches = kept + entries
        blocked = sorted({s["address"] for s in all_searches if s["outcome"] == "blocked"
                          and s["place_kind"] in ("nation-website", "court-website")})
        if any(s["outcome"] == "found" for s in all_searches):
            status = "found"
        elif blocked or old.get("status") == "partly-searched":
            status = "partly-searched"
        else:
            status = "none-found"
        log = {"profile": profile, "topic": topic, "status": status,
               "last_searched": max(str(s["date"]) for s in all_searches), "searches": all_searches}
        steps = old.get("next_steps") or ""
        unlinked = [r["name"] for r in group if not r["new_link"]]
        linked = [r["name"] for r in group if r["new_link"]]
        extra = ""
        if linked:
            extra += (f" The second search of {SECOND_DATE} linked " + "; ".join(f"“{n}”" for n in linked)
                      + " (research/reviews/2026-11-22-service-links.json).")
        if unlinked:
            extra += (f" The second search of {SECOND_DATE} (web searches and state court lists) found no page or "
                      "official directory entry for " + "; ".join(f"“{n}”" for n in unlinked)
                      + "; a call to the nation's office could say whether the court has a page.")
        if extra.strip() and extra.strip() not in steps:
            steps = f"{steps}{extra}".strip()
        if steps:
            log["next_steps"] = steps
        write_appended(path, log, entries, kept)
        written += 1
    return written


def write_appended(path, log, entries, kept):
    """Add the new entries to the log's own text and set its status, date and
    next steps, so the earlier entries' lines stay exactly as they were."""
    if not path.exists() or not kept:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(yaml.dump(log, sort_keys=False, allow_unicode=True, width=100), encoding="utf-8")
        return
    text = path.read_text(encoding="utf-8")
    head, _, rest = text.partition("\nsearches:\n")
    body, steps_marker, _ = rest.partition("\nnext_steps:")
    if not steps_marker:
        body = rest.rstrip("\n")
    else:
        body = body.rstrip("\n")
    # Drop this command's own entries from an earlier run (they are rebuilt).
    items = re.split(r"(?m)^(?=- date: )", body + "\n")
    items = [i for i in items if i and not (f"date: '{SECOND_DATE}'" in i and "Second search" in i)]
    added = yaml.dump(entries, sort_keys=False, allow_unicode=True, width=100) if entries else ""
    head = re.sub(r"(?m)^status: .*$", f"status: {log['status']}", head)
    head = re.sub(r"(?m)^last_searched: .*$", f"last_searched: '{log['last_searched']}'", head)
    out = head + "\nsearches:\n" + "".join(items) + added
    if log.get("next_steps"):
        out += yaml.dump({"next_steps": log["next_steps"]}, sort_keys=False, allow_unicode=True, width=100)
    path.write_text(out, encoding="utf-8")


if __name__ == "__main__":
    arguments = sys.argv[1:]
    if len(arguments) >= 2 and arguments[0] == "gather":
        reuse = [arguments[i + 1] for i, a in enumerate(arguments) if a == "--reuse"]
        gather(pathlib.Path(arguments[1]), reuse)
    elif len(arguments) == 2 and arguments[0] == "merge":
        merge(pathlib.Path(arguments[1]))
    elif len(arguments) == 2 and arguments[0] == "second":
        second(pathlib.Path(arguments[1]))
    elif arguments[:1] == ["apply"]:
        apply(check="--check" in arguments)
    else:
        sys.exit(__doc__)
