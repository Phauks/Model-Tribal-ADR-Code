"""Second pass on the directory-listed courts that the Nov. 21, 2026 review
could not confirm (row 11 of the dataset gap audit; first pass in
research/reviews/2026-11-21-court-listings.json, verdicts `not-found` and
`cannot-tell`).

    python3 scripts/review/court_listings_second_pass.py gather WORK_DIRECTORY
    python3 scripts/review/court_listings_second_pass.py merge WORK_DIRECTORY
    python3 scripts/review/court_listings_second_pass.py apply [--check]

`gather` looks in more places for each court and writes
WORK_DIRECTORY/evidence.json (one item per court) and
WORK_DIRECTORY/fetch-log.json (every address fetched, with its HTTP status):

- the nation's own website, more deeply than the first pass: its robots.txt
  (whose rules are obeyed), its sitemaps, and the links on its home page whose
  text or address mentions a court, judiciary, justice, peacemaking or a
  judge, reading up to five of those pages;
- the court directories in DIRECTORIES (state court systems, the Bureau of
  Indian Affairs list of Courts of Indian Offenses, intertribal court systems,
  the Tribal Court Clearinghouse and the National Indian Law Library nation
  page), keeping the passages that name the nation;
- the law codes and court rules already collected in
  research/tribal-law/documents.json (private captures under
  /mnt/project-files), keeping the passages that establish a court.

A site that refuses an automated request (401, 403, 429, a challenge page) is
recorded as blocked; nothing is done to get around it.

`merge` reads the reviewers' verdicts in WORK_DIRECTORY/out/*.json (brief:
research/reviews/briefs/2026-11-22-court-listings-second-pass.md) and the
second reader's in WORK_DIRECTORY/second/*.json, checks that every evidence
address was fetched with status 200, and writes
research/reviews/2026-11-22-court-listings-second-pass.{json,csv} (empty
`lead_author_decision` column) and one search log per nation,
research/search-logs/courts/<letter>/<profile id>.yaml (decision record 0025:
every place looked for each court, what it found or why it failed). Searches
dated REVIEW_DATE in an existing log are replaced; earlier ones are kept.

`apply` makes the one clear fix: a court whose listed link no longer reaches
it, where the review found the court's page on the nation's own site or the
court's own site (fetched with status 200), gets that page as its link; its
note keeps the listed link. Nothing is deleted. With `--check` it reports what
it would change.
"""

import collections
import concurrent.futures
import csv
import glob
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.robotparser

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import record_facts  # noqa: E402

REVIEWS = ROOT / "research" / "reviews"
FIRST_PASS = REVIEWS / "2026-11-21-court-listings.json"
PREFIX = "2026-11-22-"
SEARCH_LOGS = ROOT / "research" / "search-logs" / "courts"
SEARCHED_BY = "Claude (AI assistant)"
SCRIPT = "scripts/review/court_listings_second_pass.py"
POSITIVE = ("confirmed", "confirmed-other-name", "served-by-intertribal-court", "served-by-court-of-indian-offenses",
            "link-dead-court-found")
REVIEW_DATE = "2026-11-22"
PRIVATE = pathlib.Path("/mnt/project-files")
USER_AGENT = "Mozilla/5.0 (research link check)"
COURT_WORDS = re.compile(r"\bcourts?\b|judicia|judiciary|\bjustice\b|peacemak|\bjudges?\b|magistrate",
                         re.IGNORECASE)
COURT_PATH = re.compile(r"court|judic|justice|peacemak|judge", re.IGNORECASE)
SIGNALS = {
    "phone": re.compile(r"\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b"),
    "judge": re.compile(r"\bjudges?\b|\bmagistrate", re.IGNORECASE),
    "clerk": re.compile(r"\bclerk\b|court administrator", re.IGNORECASE),
    "hours": re.compile(r"\bhours\b|monday|\bm-f\b", re.IGNORECASE),
    "filing": re.compile(r"\bfil(e|ing)\b|petition|forms?\b|docket|hearing", re.IGNORECASE),
}
BLOCKED_STATUSES = {401, 403, 406, 429}
CHALLENGE = re.compile(r"cf-chl|challenge-platform|Just a moment\.\.\.|Attention Required|captcha", re.IGNORECASE)


def classify(entry):
    """ok, blocked (refused or a challenge page) or error."""
    status, text = entry["status"], entry.get("_text") or ""
    if status in BLOCKED_STATUSES or (entry["_kind"] == "html" and len(text) < 20000
                                      and CHALLENGE.search(text[:5000])):
        return "blocked"
    return "ok" if status == 200 else "error"
THIRD_PARTY_HOSTS = ("narf.org", "tribal-institute.org", "tananachiefs.org", "facebook.com", "wikipedia.org",
                     "borough", "commerce.alaska.gov", "dot.alaska.gov", "city", "census.gov")
MAX_PAGES = 5

# Directories that name tribal courts. `confirms` is true for an official
# directory (a state court system, the Bureau of Indian Affairs) or the
# intertribal court's own list of the nations it serves; the others only
# support what a nation's own page shows.
DIRECTORIES = [
    {"key": "alaska-court-system-tribal-court-directory", "place_kind": "state-court-directory", "state": "AK",
     "url": "https://courts.alaska.gov/courtdir/docs/tribal-court-directory.pdf", "format": "pdf",
     "confirms": True,
     "label": "Alaska Court System court directory: 2022 Alaska Tribal Court Directory (prepared by Alaska Legal "
              "Services Corporation)"},
    {"key": "california-courts-tribal-courts-directory", "place_kind": "state-court-directory", "state": "CA",
     "url": "https://www.courts.ca.gov/programs-initiatives/tribalstate-programs/tribal-justice-systems/"
            "california-tribal-courts-directory", "format": "html", "confirms": True,
     "label": "Judicial Branch of California, California Tribal Courts Directory"},
    {"key": "washington-courts-tribal-court-directory", "place_kind": "state-court-directory", "state": "WA",
     "url": "https://www.courts.wa.gov/court_dir/orgs/134.html", "format": "html", "confirms": True,
     "label": "Washington State Court Directory: Tribal Courts"},
    {"key": "washington-tribal-state-court-consortium-directory", "place_kind": "state-court-directory",
     "state": "WA", "url": "https://www.courts.wa.gov/subsite/tscc/docs/TSCC%20WA%20State%20Tribal%20Court%20"
                           "Directory.pdf", "format": "pdf", "confirms": True,
     "label": "Washington Tribal State Court Consortium, Washington State Tribal Court Directory"},
    {"key": "new-mexico-tribal-state-judicial-consortium-roster", "place_kind": "state-court-directory",
     "state": "NM", "url": "https://supremecourt.nmcourts.gov/wp-content/uploads/sites/2/2026/02/2026-Public-"
                           "TSJC-Roster-1.2.26.pdf", "format": "pdf", "confirms": True,
     "label": "Supreme Court of New Mexico, Tribal-State Judicial Consortium roster (Jan. 2, 2026)"},
    {"key": "michigan-supreme-court-tribal-courts", "place_kind": "state-court-directory", "state": "MI",
     "url": "https://courts.michigan.gov/4ab19d/siteassets/msc-learning-center/justitia_tribalcourts.pdf",
     "format": "pdf", "confirms": True, "label": "Michigan Supreme Court Learning Center, Tribal Courts in Michigan"},
    {"key": "wisconsin-state-tribal-justice-forum", "place_kind": "state-court-directory", "state": "WI",
     "url": "https://www.wicourts.gov/courts/committees/tribal.htm", "format": "html", "confirms": True,
     "label": "Wisconsin Court System, State-Tribal Justice Forum"},
    {"key": "minnesota-tribal-court-state-court-forum", "place_kind": "state-court-directory", "state": "MN",
     "url": "https://www.mncourts.gov/mncourtsgov/media/scao_library/CJI/TCSCF-Members-Tribal-Court-Judges-"
            "(website-December-2022).pdf", "format": "pdf", "confirms": True,
     "label": "Minnesota Judicial Branch, Tribal Court/State Court Forum members"},
    {"key": "arizona-state-tribal-federal-court-forum", "place_kind": "state-court-directory", "state": "AZ",
     "url": "https://www.azcourts.gov/stfcf", "format": "html", "confirms": True,
     "label": "Arizona Judicial Branch, State, Tribal and Federal Court Forum"},
    {"key": "arizona-health-care-cost-containment-tribal-court-contacts", "place_kind": "other", "state": "AZ",
     "url": "https://www.azahcccs.gov/AmericanIndians/Downloads/Procedures/tribal-court-contact-list.pdf",
     "format": "pdf", "confirms": False,
     "label": "Arizona Health Care Cost Containment System, tribal court contact list (a state agency, not the "
              "court system)"},
    {"key": "bia-courts-of-indian-offenses", "place_kind": "bureau-of-indian-affairs-list", "state": None,
     "url": "https://bia.gov/CFRCourts", "format": "html", "confirms": True,
     "label": "Bureau of Indian Affairs, Court of Indian Offenses: list of CFR Courts and the Tribes they serve"},
    {"key": "federal-register-2020-courts-of-indian-offenses", "place_kind": "bureau-of-indian-affairs-list",
     "state": None, "url": "https://www.govinfo.gov/content/pkg/FR-2020-01-07/html/2019-27997.htm",
     "format": "html", "confirms": True,
     "label": "List of Courts of Indian Offenses, 85 Fed. Reg. 645 (Jan. 7, 2020)"},
    {"key": "intertribal-court-of-southern-california-members", "place_kind": "intertribal-organization",
     "state": "CA", "url": "https://www.intertribalcourt.org/member-tribes", "format": "html", "confirms": True,
     "label": "Intertribal Court of Southern California, Member Tribes"},
    {"key": "northwest-intertribal-court-system-tribes", "place_kind": "intertribal-organization", "state": None,
     "url": "https://www.nics.ws/tribal-courts.html", "format": "html", "confirms": True,
     "label": "Northwest Intertribal Court System, Tribal Courts"},
    {"key": "southwest-intertribal-court-of-appeals", "place_kind": "intertribal-organization", "state": None,
     "url": "https://www.ailc-inc.org/switca/", "format": "html", "confirms": False,
     "label": "American Indian Law Center, Southwest Intertribal Court of Appeals (appellate only)"},
    {"key": "tanana-chiefs-conference-services", "place_kind": "intertribal-organization", "state": "AK",
     "url": "https://www.tananachiefs.org/services/", "format": "html", "confirms": False,
     "label": "Tanana Chiefs Conference, services (Tribal Court and Governance)"},
    {"key": "tribal-court-clearinghouse-tribal-courts", "place_kind": "other", "state": None,
     "url": "https://tribal-institute.org/lists/justice.htm", "format": "html", "confirms": False,
     "label": "Tribal Court Clearinghouse (Tribal Law and Policy Institute), Tribal Courts list"},
    {"key": "tribal-court-clearinghouse-alaska", "place_kind": "other", "state": "AK",
     "url": "https://tribal-institute.org/lists/alaska.htm", "format": "html", "confirms": False,
     "label": "Tribal Court Clearinghouse (Tribal Law and Policy Institute), Alaska tribal courts"},
]

# States searched for an official tribal court directory where none was
# found; recorded in each court's search attempts.
NO_DIRECTORY_FOUND = {
    "OK": "No Oklahoma state court system list of tribal courts was found by web search on 2026-11-22.",
}

# A nation website on record whose home page says the site has moved; the new
# address is searched too (seen by the reviewer on 2026-11-22).
SITE_MOVED = {
    "https://www.lvpaiutetribe.com/": "https://www.lvpaiute.gov/",
}

GENERIC = {"the", "of", "and", "tribe", "tribes", "tribal", "band", "bands", "indian", "indians", "nation",
           "nations", "native", "village", "community", "reservation", "rancheria", "colony", "pueblo",
           "california", "alaska", "oklahoma", "nevada", "arizona", "washington", "new", "mexico", "minnesota",
           "montana", "dakota", "north", "south", "oregon", "utah", "idaho", "wyoming", "texas", "court",
           "traditional", "council", "government", "association", "inc", "corporation", "confederated",
           "federated", "united", "mission", "s", "st", "at", "in", "on", "de", "la", "del", "san", "santa",
           "creek", "river", "valley", "lake", "point", "island", "islands", "bay", "city", "county", "area",
           "chippewa", "sioux", "paiute", "shoshone", "apache", "pomo", "cahuilla", "band", "western",
           "eastern", "southern", "northern", "upper", "lower", "fort", "mount", "aka", "formerly", "known",
           "as", "also", "or", "its", "their", "people", "kumeyaay", "luiseno", "luiseño", "miwok", "me",
           "wuk", "ojibwe", "potawatomi", "band's", "nooksack", "inupiat", "yup'ik", "eskimo", "aleut",
           "organized", "cooperative", "tribe's", "communities"}

# Words too common to find a nation by on their own.
SINGLE_STOP = {"white", "black", "mountain", "rocky", "grand", "little", "great", "lakes", "springs", "earth",
               "cooperative", "affiliated", "consolidated", "center", "services", "system", "intertribal",
               "northwest", "judicial", "courts", "lower", "upper", "beaver", "eagle", "salmon", "elders"}

# --------------------------------------------------------------------------- fetching

_lock = threading.Lock()
_host_locks = collections.defaultdict(threading.Lock)
_log = {}
_robots = {}


def curl(url, binary=False, timeout=40):
    """Fetch with curl (the proxy's CA bundle is in the environment). Returns
    status, final address, content type and body; retries once on a dropped
    connection."""
    for attempt in range(2):
        process = subprocess.run(
            ["curl", "-s", "-L", "--max-redirs", "8", "--max-time", str(timeout), "-A", USER_AGENT,
             "-o", "-", "-w", "\n__META__%{http_code}\t%{content_type}\t%{url_effective}", url],
            capture_output=True)
        body = process.stdout
        meta_at = body.rfind(b"\n__META__")
        meta = body[meta_at + 9:].decode("utf-8", "replace").split("\t", 2) if meta_at >= 0 else ["000", "", url]
        body = body[:meta_at] if meta_at >= 0 else b""
        status = int(meta[0]) if meta[0].isdigit() else 0
        if status or attempt:
            break
        time.sleep(2)
    content_type = meta[1] if len(meta) > 1 else ""
    final = meta[2] if len(meta) > 2 else url
    return status, final, content_type, body, process.returncode


_cache_directory = None


def fetch(url, binary=False):
    with _lock:
        if url in _log:
            return _log[url]
    cached = _cache_directory / (hashlib.sha256(url.encode()).hexdigest()[:24] + ".json") if _cache_directory else None
    if cached and cached.exists():
        entry = json.loads(cached.read_text(encoding="utf-8"))
        if entry.get("final") and " " in entry["final"]:
            # Written before the fields were tab-separated: the content type's
            # parameter ran into the final address.
            extra, entry["final"] = entry["final"].rsplit(" ", 1)
            entry["content_type"] = f"{entry['content_type']} {extra}"
        entry["outcome"] = classify(entry)
        with _lock:
            _log[url] = entry
        return entry
    host = urllib.parse.urlsplit(url).netloc
    with _host_locks[host]:
        with _lock:
            if url in _log:
                return _log[url]
        status, final, content_type, body, code = curl(url, binary)
        time.sleep(0.5)
    text = ""
    if "pdf" in content_type or url.lower().endswith(".pdf"):
        if status == 200 and body:
            text = subprocess.run(["pdftotext", "-layout", "-", "-"], input=body, capture_output=True).stdout.decode(
                "utf-8", "replace")
        kind = "pdf"
    else:
        text = body.decode("utf-8", "replace")
        kind = "xml" if "xml" in content_type else "html"
    entry = {"url": url, "status": status or None, "final": final, "content_type": content_type,
             "outcome": None, "curl_exit": code, "fetched": REVIEW_DATE, "_text": text, "_kind": kind}
    entry["outcome"] = classify(entry)
    with _lock:
        _log[url] = entry
    if cached:
        cached.write_text(json.dumps(entry, ensure_ascii=False), encoding="utf-8")
    return entry


def allowed(url):
    parts = urllib.parse.urlsplit(url)
    base = f"{parts.scheme}://{parts.netloc}"
    with _lock:
        parser = _robots.get(base)
    if parser is None:
        page = fetch(base + "/robots.txt")
        parser = urllib.robotparser.RobotFileParser()
        if page["status"] == 200 and "html" not in page["content_type"]:
            parser.parse(page["_text"].splitlines())
        else:
            parser.parse([])
        parser.sitemaps = re.findall(r"(?im)^\s*sitemap:\s*(\S+)", page["_text"]) if page["status"] == 200 else []
        with _lock:
            _robots[base] = parser
    return parser.can_fetch(USER_AGENT, url), parser


def page_text(entry):
    if entry["_kind"] == "pdf":
        return re.sub(r"\s+", " ", entry["_text"]), [], None
    if entry["_kind"] != "html" or not entry["_text"]:
        return "", [], None
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(entry["_text"], "html.parser")
    title = soup.title.get_text(" ", strip=True)[:150] if soup.title else None
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    links = []
    for anchor in soup.find_all("a", href=True):
        label = anchor.get_text(" ", strip=True)[:80]
        href = urllib.parse.urljoin(entry["final"] or entry["url"], anchor["href"].strip())
        links.append((label, href.split("#")[0]))
    return re.sub(r"\s+", " ", soup.get_text(" ")), links, title


def passages(text, pattern=COURT_WORDS, limit=6, width=300):
    found, last = [], -10 ** 9
    for match in pattern.finditer(text):
        if match.start() >= last + width:
            found.append(text[max(0, match.start() - 120):match.start() + width].strip())
            last = match.start()
            if len(found) >= limit:
                break
    return found


def signals(text):
    near = " ".join(passages(text, limit=12, width=400))
    return sorted(name for name, pattern in SIGNALS.items() if pattern.search(near))


# --------------------------------------------------------------------------- items


def items_to_check():
    tree = record_facts.Tree(ROOT)
    first = [r for r in json.loads(FIRST_PASS.read_text(encoding="utf-8"))
             if r["verdict"] in ("not-found", "cannot-tell")]
    items = []
    for number, row in enumerate(first, 1):
        profile = tree.profiles.get(row["profile"])
        item = {"item_id": f"court-{number:03d}", "profile": row["profile"], "nation": row["nation"],
                "source": row["source"], "kind": row["kind"], "name": row["name"],
                "listed_link": row["listed_link"], "listed_as_of": row["listed_as_of"],
                "first_pass_verdict": row["verdict"], "first_pass_reason": row["reason"],
                "first_pass_pages": row["pages_fetched"]}
        if profile is None:
            item.update(profile_missing=True, nation_sites=[], states=[], names=[row["nation"]], profile_id=None)
            items.append(item)
            continue
        matches = [f for f in profile.get("justice_institutions", []) if f["source"] == row["source"]
                   and f.get("name") == row["name"] and f.get("link") == row["listed_link"]]
        if not matches:
            # The fact may have moved to another profile since the first pass
            # (the Minnesota Chippewa Tribe bands, decision record 0016).
            moved = [(file, p) for file, p in tree.profiles.items()
                     for f in p.get("justice_institutions", []) if f["source"] == row["source"]
                     and f.get("name") == row["name"] and f.get("link") == row["listed_link"]]
            if len(moved) == 1:
                item["moved_from"], item["profile"] = row["profile"], moved[0][0]
                profile, matches = moved[0][1], [None]
                item["nation"] = profile["names"]["official"]
        item["fact_matches"] = len(matches)
        item["profile_id"] = profile["id"]
        item["nation_sites"] = [c["value"] for c in profile.get("contacts") or [] if c.get("kind") == "website"]
        item["states"] = sorted({s["state"] for s in profile.get("states") or []
                                 if s.get("presence") == "government-office"}) or sorted(
            {s["state"] for s in profile.get("states") or []})
        names = [profile["names"]["official"]] + [a["name"] for a in profile["names"].get("alternate") or []]
        item["names"] = names
        source = tree.sources.get(row["source"]) or {}
        item["source_link"] = source.get("original_link") or (source.get("links") or [None])[0]
        items.append(item)
    return items


def name_keys(item):
    """Distinctive words from the nation's names and the listed court name,
    used to find the nation in a directory's text (analysis aid only; every
    match is read by a reviewer)."""
    keys = []
    for name in item["names"][:6]:
        name = re.sub(r"\(.*?\)", " ", name)
        tokens = re.findall(r"[\w'’.-]+", name)
        distinctive = [t.lower().strip(".'’") not in GENERIC and len(t) > 2 for t in tokens]
        words = [t for t, keep in zip(tokens, distinctive) if keep]
        if words:
            # The first run of distinctive words, keeping short joining words
            # inside it ("Fond du Lac").
            start = distinctive.index(True)
            end = start
            while end + 1 < len(tokens) and (distinctive[end + 1] or (
                    len(tokens[end + 1]) <= 3 and end + 2 < len(tokens) and distinctive[end + 2]
                    and tokens[end + 1].lower() not in ("of", "and", "the"))):
                end += 1
            phrase = " ".join(tokens[start:end + 1])
            if phrase.lower() not in [k.lower() for k in keys]:
                keys.append(phrase)
            for word in words:
                if len(word) >= 5 and word.lower() not in SINGLE_STOP and word.lower() not in [k.lower() for k in keys]:
                    keys.append(word)
    return keys[:8]


# --------------------------------------------------------------------------- nation sites


def is_third_party(url):
    host = urllib.parse.urlsplit(url).netloc.lower()
    return any(part in host for part in THIRD_PARTY_HOSTS)


def sitemap_urls(base, parser):
    found, tried, queue = [], [], list(dict.fromkeys(
        (parser.sitemaps or []) + [base + "/sitemap.xml", base + "/sitemap_index.xml", base + "/wp-sitemap.xml"]))
    while queue and len(tried) < 8:
        url = queue.pop(0)
        if url in tried:
            continue
        tried.append(url)
        ok, _ = allowed(url)
        if not ok:
            continue
        entry = fetch(url)
        if entry["status"] != 200 or "<loc" not in entry["_text"][:200000]:
            continue
        locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", entry["_text"])
        for loc in locs:
            loc = loc.replace("&amp;", "&")
            if re.search(r"\.xml(\.gz)?$|sitemap", loc, re.IGNORECASE):
                if re.search(r"page|post|court|depart|program|service|gov|sitemap\d|sitemap\.xml", loc,
                             re.IGNORECASE):
                    queue.append(loc)
            else:
                found.append(loc)
    return found, tried


def rank(url, label=""):
    text = (urllib.parse.urlsplit(url).path + " " + label).lower()
    for score, word in enumerate(("court", "judicia", "judiciary", "justice", "peacemak", "judge")):
        if word in text:
            return score
    return 9


def deep_search(site):
    """Search one nation website; returns a record shared by every court of
    that nation."""
    record = {"site": site, "robots": None, "sitemaps_tried": [], "sitemap_court_urls": [],
              "home": None, "pages": [], "skipped_by_robots": []}
    home = fetch(site)
    parts = urllib.parse.urlsplit(home["final"] if home["status"] == 200 and home["final"] else site)
    base = f"{parts.scheme}://{parts.netloc}"
    ok, parser = allowed(site)
    record["robots"] = {"url": base + "/robots.txt", "status": _log.get(base + "/robots.txt", {}).get("status")}
    text, links, title = page_text(home)
    record["home"] = {"url": site, "status": home["status"], "final": home["final"], "outcome": home["outcome"],
                      "title": title, "court_links": [(l, h) for l, h in links
                                                      if COURT_WORDS.search(l) or COURT_PATH.search(
                                                          urllib.parse.urlsplit(h).path)][:20],
                      "court_snippets": passages(text, limit=4)}
    if home["status"] != 200 and home["outcome"] != "ok":
        # Try the site's own address without a path, then give up.
        pass
    locs, tried = sitemap_urls(base, parser)
    record["sitemaps_tried"] = [{"url": u, "status": _log.get(u, {}).get("status")} for u in tried]
    host = parts.netloc.lower().removeprefix("www.")
    court_locs = [u for u in locs if COURT_PATH.search(urllib.parse.urlsplit(u).path)]
    record["sitemap_court_urls"] = court_locs[:30]
    candidates = [(rank(u), u) for u in court_locs]
    for label, href in record["home"]["court_links"]:
        if not href.startswith("http") or href.lower().endswith((".jpg", ".png")):
            continue
        link_host = urllib.parse.urlsplit(href).netloc.lower().removeprefix("www.")
        if link_host == host or (COURT_PATH.search(link_host) and not is_third_party(href)):
            candidates.append((rank(href, label), href))
    seen = {site, home["final"]}
    for _, url in sorted(candidates, key=lambda c: c[0]):
        if url in seen or len(record["pages"]) >= MAX_PAGES:
            continue
        seen.add(url)
        ok, _ = allowed(url)
        if not ok:
            record["skipped_by_robots"].append(url)
            continue
        entry = fetch(url)
        text, page_links, title = page_text(entry)
        record["pages"].append({
            "url": url, "status": entry["status"], "final": entry["final"], "outcome": entry["outcome"],
            "title": title, "court_snippets": passages(text, limit=5), "signals": signals(text),
            "court_links": [(l, h) for l, h in page_links if COURT_WORDS.search(l)][:8]})
    return record


# --------------------------------------------------------------------------- directories


def alaska_entries(text):
    """Split the Alaska Tribal Court Directory into one entry per Tribe and
    keep only the court fields (no names, telephone numbers or emails)."""
    lines = text.splitlines()
    entries = []
    starts = [i for i, line in enumerate(lines) if line.startswith("Phone:")]
    for number, start in enumerate(starts):
        head = start - 1
        while head > 0 and not lines[head].strip():
            head -= 1
        name = lines[head].strip()
        end = starts[number + 1] - 2 if number + 1 < len(starts) else len(lines)
        block = "\n".join(lines[start:end])

        def field(label, nxt):
            match = re.search(label + r"(.*?)" + nxt, block, re.DOTALL)
            if not match:
                return None
            value = re.sub(r"\s+", " ", re.sub(r"(?m)^\s*\d+\s*$", "", match.group(1))).strip()
            value = re.sub(r"^System\s*|\s*\bSystem\s*$", "", value)
            return value or None

        entries.append({
            "entry": name,
            "active_court": field(r"Active Court or Tribal Justice", r"Type of Justice System"),
            "type_of_justice_system": field(r"Type of Justice System", r"Contact to Open Case"),
            "years_active": field(r"Years Active", r"# of Judges"),
            "types_of_cases": field(r"Types of Cases Heard", r"# of Cases"),
            "inter_tribal_court": field(r"Inter-Tribal Court", r"ICWA Worker"),
            "directory_note": field(r"Tribal Court and Law Information", r"Active Court or Tribal Justice"),
        })
    return entries


def load_directories():
    loaded = []
    for directory in DIRECTORIES:
        entry = fetch(directory["url"])
        record = dict(directory, status=entry["status"], outcome=entry["outcome"], final=entry["final"])
        if entry["_kind"] == "pdf":
            record["text"] = entry["_text"]
        else:
            text, _, title = page_text(entry)
            record["text"], record["title"] = text, title
        if directory["key"] == "alaska-court-system-tribal-court-directory" and entry["status"] == 200:
            record["entries"] = alaska_entries(entry["_text"])
        loaded.append(record)
    return loaded


# Spellings a directory uses that differ from the profile's names.
DIRECTORY_SPELLINGS = {"Algaaciq": "Algaacig"}


def key_pattern(key):
    """Match a name with either apostrophe form."""
    key = re.escape(key.replace("’", "'")).replace("'", "['’]")
    return re.compile(r"\b" + key + r"\b", re.IGNORECASE)


def directory_hits(item, directories):
    keys = name_keys(item)
    keys += [DIRECTORY_SPELLINGS[k] for k in keys if k in DIRECTORY_SPELLINGS]
    hits = []
    for directory in directories:
        if directory["state"] and directory["state"] not in item["states"] and item["states"]:
            continue
        hit = {"directory": directory["key"], "label": directory["label"], "url": directory["url"],
               "place_kind": directory["place_kind"], "confirms": directory["confirms"],
               "status": directory["status"], "outcome": directory["outcome"], "matched_key": None,
               "passages": []}
        if directory["outcome"] == "ok":
            if "entries" in directory:
                for key in keys:
                    pattern = key_pattern(key)
                    found = [e for e in directory["entries"] if pattern.search(e["entry"])]
                    if found:
                        # Of the entries naming the key, the one sharing most
                        # words with the nation's name ("Chignik Lake", not
                        # "Chignik Bay").
                        wanted = set(re.findall(r"\w+", " ".join(item["names"][:3]).lower().replace("’", "'")))
                        weak = {"native", "village", "of", "the", "tribe", "tribal", "council", "community",
                                "traditional", "government", "aka"}
                        found.sort(key=lambda e: -sum(0.1 if word in weak else 1 for word in wanted & set(
                            re.findall(r"\w+", e["entry"].lower().replace("’", "'")))))
                        hit["matched_key"], hit["entries"] = key, found[:3]
                        break
            else:
                for key in keys:
                    pattern = key_pattern(key)
                    found = passages(directory["text"], pattern, limit=3, width=250)
                    if found:
                        hit["matched_key"], hit["passages"] = key, found
                        break
        hits.append(hit)
    return hits


def nill_page(item):
    link = item.get("source_link") or ""
    if "narf.org/nill" not in link:
        return None
    entry = fetch(link)
    text, _, title = page_text(entry)
    return {"url": link, "status": entry["status"], "outcome": entry["outcome"], "title": title,
            "court_snippets": passages(text, limit=4)}


# --------------------------------------------------------------------------- law texts

ESTABLISH = re.compile(
    r"(?:(?i:hereby\s+(?:established|created|constituted))[^.;]{0,80}?\bCourt\b(?!['’])"
    r"|\bCourt\b(?!['’])[^.;]{0,60}?(?i:(?:is|are|shall\s+be)\s+(?:hereby\s+)?(?:established|created|constituted))"
    r"|(?i:establishment\s+of\s+(?:the\s+)?)[A-Z][\w'’ -]{0,50}?Court\b"
    r"|(?i:judicial\s+(?:power|authority))[^.;]{0,100}?(?i:vested\s+in)[^.;]{0,80}?Court\b)")


def law_documents(directory_profile_ids):
    documents = json.loads((ROOT / "research" / "tribal-law" / "documents.json").read_text(encoding="utf-8"))
    by_nation = collections.defaultdict(list)
    for document in documents:
        for nation in document.get("nations") or []:
            if nation in directory_profile_ids:
                by_nation[nation].append(document)
    found = {}
    for nation, documents in by_nation.items():
        results = []
        for document in documents:
            titles = " ".join([document.get("page_title") or ""] + [c.get("title") or ""
                                                                     for c in document.get("cited_by") or []])
            capture = document.get("capture")
            text = ""
            if capture:
                txt = PRIVATE / pathlib.Path(capture).with_suffix(".txt")
                if txt.exists():
                    text = txt.read_text(encoding="utf-8", errors="replace")
            matches = [re.sub(r"\s+", " ", text[max(0, m.start() - 80):m.end() + 80])
                       for m in ESTABLISH.finditer(text)][:2]
            if matches or (COURT_PATH.search(titles) and text):
                results.append({"url": document["url"], "final_url": document.get("final_url"),
                                "http_status": document.get("http_status"), "fetched": document.get("fetched"),
                                "title": titles.strip()[:200], "kinds": sorted({str(c.get("kind")) for c in
                                                                                 document.get("cited_by") or []}),
                                "establishing_passages": matches})
        if results:
            results.sort(key=lambda r: (not r["establishing_passages"], r["url"]))
            found[nation] = results[:4]
    return found


# --------------------------------------------------------------------------- gather


def sites_for(item):
    """The nation websites searched for one court: the first two on record,
    plus the new address of a site that says it has moved."""
    sites = list(item["nation_sites"][:2])
    sites += [SITE_MOVED[s] for s in sites if s in SITE_MOVED]
    return sites


def gather(work):
    global _cache_directory
    work.mkdir(parents=True, exist_ok=True)
    # Fetched pages are kept in WORK_DIRECTORY/cache so a rerun reads them
    # instead of fetching again.
    _cache_directory = work / "cache"
    _cache_directory.mkdir(exist_ok=True)
    items = items_to_check()
    directories = load_directories()
    sites = sorted({site for item in items for site in sites_for(item)})
    # The listed link's own site, when it is not a third-party directory page.
    extra = sorted({f"{urllib.parse.urlsplit(i['listed_link']).scheme}://{urllib.parse.urlsplit(i['listed_link']).netloc}/"
                    for i in items if i["listed_link"] and not is_third_party(i["listed_link"])} - set(sites))
    with concurrent.futures.ThreadPoolExecutor(12) as pool:
        searched = dict(zip(sites + extra, pool.map(deep_search, sites + extra)))
    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        nill = dict(zip([i["item_id"] for i in items], pool.map(nill_page, items)))
    laws = law_documents({i["profile_id"] for i in items if i.get("profile_id")})
    for item in items:
        item["listed_link_now"] = None
        if item["listed_link"]:
            entry = fetch(item["listed_link"])
            text, _, title = page_text(entry)
            item["listed_link_now"] = {"url": item["listed_link"], "status": entry["status"],
                                       "final": entry["final"], "outcome": entry["outcome"], "title": title,
                                       "court_snippets": passages(text, limit=3)}
        item["site_search"] = [searched[s] for s in sites_for(item)]
        if item["listed_link"] and not is_third_party(item["listed_link"]):
            parts = urllib.parse.urlsplit(item["listed_link"])
            own = f"{parts.scheme}://{parts.netloc}/"
            if own in searched and own not in sites_for(item):
                item["site_search"].append(searched[own])
        item["directories"] = directory_hits(item, directories)
        item["no_directory_found"] = {s: NO_DIRECTORY_FOUND[s] for s in item["states"] if s in NO_DIRECTORY_FOUND}
        item["national_indian_law_library"] = nill[item["item_id"]]
        item["law_documents"] = laws.get(item.get("profile_id"), [])
    (work / "evidence.json").write_text(json.dumps(items, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    log = [{k: v for k, v in entry.items() if not k.startswith("_")} for entry in _log.values()]
    (work / "fetch-log.json").write_text(json.dumps(log, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    summary = collections.Counter(entry["outcome"] for entry in log)
    print(f"{len(items)} courts, {len(sites) + len(extra)} sites searched, {len(log)} addresses fetched: "
          f"{dict(summary)}")


# --------------------------------------------------------------------------- merge

VERDICTS = ("confirmed", "confirmed-other-name", "served-by-intertribal-court", "served-by-court-of-indian-offenses",
            "link-dead-court-found", "not-found-after-search", "cannot-tell")


def read_arrays(pattern):
    found = []
    for path in sorted(glob.glob(str(pattern))):
        found.extend(json.loads(pathlib.Path(path).read_text(encoding="utf-8")))
    return found


def attempts_for(item, verdict):
    """Every place looked for one court, with the outcome and a one-sentence
    reason."""
    attempts = []

    def add(place_kind, address, method, outcome, reason, query=None, date=REVIEW_DATE):
        entry = {"date": date, "searched_by": SEARCHED_BY, "method": method, "place_kind": place_kind,
                 "address": address or "No address", "query": query or (
                     f"{SCRIPT}: words for a court, judiciary, justice, peacemaking or a judge"
                     if method == "script" else None),
                 "outcome": outcome, "reason": reason, "court": item["name"]}
        attempts.append({k: v for k, v in entry.items() if v is not None})

    def status_outcome(status, outcome):
        if outcome == "blocked" or status in BLOCKED_STATUSES:
            return "blocked"
        if status is None:
            return "error"
        if status in (404, 410):
            return "dead-link"
        return "error" if status != 200 else None

    first = item["first_pass_pages"]
    for page in first:
        add("court-website" if COURT_PATH.search(page["url"]) else "nation-website", page["url"], "script",
            status_outcome(page.get("status"), None) or "not-found",
            f"The first pass of the court review (research/reviews/2026-11-21-court-listings.json) fetched this "
            f"page with status {page.get('status')}; its reviewer found {item['first_pass_verdict']}.",
            query="scripts/review/court_listings.py: words for a court", date="2026-11-21")
    # Only a verdict that the court operates (or that another court serves the
    # nation) makes the places it cites "found"; a directory saying the nation
    # has no active court is recorded as not-found, with the verdict's reason.
    evidence = ({verdict.get("evidence_url"), verdict.get("working_link")} | set(verdict.get("supporting_urls") or [])
                if verdict.get("verdict") in POSITIVE else set()) - {None}
    listed = item.get("listed_link_now")
    if listed:
        found = listed["url"] in evidence
        kind = "court-website" if COURT_PATH.search(listed["url"]) else "nation-website"
        if is_third_party(listed["url"]):
            kind = "other"
        add(kind, listed["url"], "script",
            "found" if found else (status_outcome(listed["status"], listed["outcome"]) or "not-found"),
            "The listed link answered with status "
            f"{listed['status']}" + (f" and redirected to {listed['final']}" if listed["final"] and
                                     listed["final"].rstrip("/") != listed["url"].rstrip("/") else "")
            + ("; the reviewer used it as evidence." if found else "; it does not show this court."))
    if not item["nation_sites"]:
        add("nation-website", "No website on record in the profile", "script", "no-site",
            "The profile lists no official website for the nation (Tribal Leaders Directory contact).")
    for search in item["site_search"]:
        home = search["home"]
        outcome = status_outcome(home["status"], home["outcome"])
        add("nation-website", search["site"], "script", outcome or ("found" if search["site"] in evidence
                                                                    else "not-found"),
            f"Home page status {home['status']}; {len(home['court_links'])} links mention a court"
            + ("." if not outcome else "; the site refused or failed the request."))
        sitemap_ok = [s for s in search["sitemaps_tried"] if s["status"] == 200]
        if not outcome:
            add("nation-website", (sitemap_ok or search["sitemaps_tried"] or [{"url": search["site"] + " (sitemap)"}])[0][
                "url"], "script",
                "found" if any(u in evidence for u in search["sitemap_court_urls"]) else
                ("not-found" if sitemap_ok else "error"),
                (f"Sitemap read; {len(search['sitemap_court_urls'])} addresses mention a court or judiciary."
                 if sitemap_ok else "No sitemap could be read at the usual addresses."))
        for page in search["pages"]:
            outcome = status_outcome(page["status"], page["outcome"])
            kind = "court-website" if COURT_PATH.search(page["url"]) else "nation-website"
            add(kind, page["url"], "script",
                "found" if page["url"] in evidence or page.get("final") in evidence else (outcome or "not-found"),
                f"Court-related page on the nation's site, status {page['status']}"
                + ("; the reviewer used it as evidence." if page["url"] in evidence else
                   "; it does not show that this court operates now." if not outcome else "."))
        for url in search["skipped_by_robots"]:
            add("nation-website", url, "script", "blocked", "The site's robots.txt disallows this address.")
    for hit in item["directories"]:
        if hit["outcome"] != "ok":
            add(hit["place_kind"], hit["url"], "script", "blocked" if hit["outcome"] == "blocked" else "error",
                f"{hit['label']}: status {hit['status']}; not read.")
            continue
        found = hit["url"] in evidence
        named = hit["matched_key"] is not None
        add(hit["place_kind"], hit["url"], "ai-review" if named else "script",
            "found" if found else "not-found",
            f"{hit['label']}: " + ("lists this nation; the reviewer used it as evidence." if found else
                                   "names this nation; it is a supporting source that cannot confirm a court."
                                   if named and not hit["confirms"] else
                                   "names this nation, but the reviewer did not find it shows this court "
                                   "operating (see the review's reason)." if named else
                                   "does not name this nation."),
            query=f"{SCRIPT}: the nation's names" + (f" (matched “{hit['matched_key']}”)" if named else ""))
    for state, reason in item.get("no_directory_found", {}).items():
        add("state-court-directory", f"No {state} state court directory of tribal courts found", "ai-review",
            "not-found", reason)
    nill = item.get("national_indian_law_library")
    if nill:
        add("national-indian-law-library", nill["url"], "script",
            status_outcome(nill["status"], nill["outcome"]) or ("found" if nill["url"] in evidence else "not-found"),
            "The National Indian Law Library nation page is the directory the listing came from or a directory "
            "like it; it cannot confirm that the court operates now.")
    for document in item.get("law_documents") or []:
        found = document["url"] in evidence or document.get("final_url") in evidence
        add("project-capture", document["url"], "script", "found" if found else "not-found",
            "Law code or court rules collected on " + str(document.get("fetched")) + " (research/tribal-law/"
            "documents.json): " + ("establishes a court in law, which does not show it operates now."
                                   if document["establishing_passages"] else
                                   "mentions a court in its title; no passage establishing a court was found."))
    add("project-capture", f"research/reviews/{PREFIX}court-listings-second-pass.json", "ai-review",
        "found" if verdict.get("verdict") in POSITIVE else "not-found",
        f"Claude read the gathered evidence against the review brief; verdict {verdict.get('verdict')}"
        + (f", from {verdict['evidence_url']}" if verdict.get("evidence_url") else "") + ".")
    attempts[-1]["records"] = [f"research/reviews/{PREFIX}court-listings-second-pass.json#{item['item_id']}"]
    return attempts


def write_search_logs(courts):
    """One search log per nation for the topic `courts` (decision record 0025)."""
    by_profile = collections.defaultdict(list)
    for court in courts:
        by_profile[court["profile"]].append(court)
    for profile, group in sorted(by_profile.items()):
        # The letter folder is the profile's own (content/tribes/<letter>/).
        path = SEARCH_LOGS / pathlib.PurePosixPath(profile).parent.name / pathlib.PurePosixPath(profile).name
        # The same place searched for several courts of one nation is one
        # entry naming the courts it was searched for.
        courts_for, order = collections.defaultdict(list), []
        for court in group:
            for entry in court["attempts"]:
                key = (entry["date"], entry["method"], entry["place_kind"], entry["address"], entry["outcome"],
                       entry["reason"], tuple(entry.get("records", [])))
                if key not in courts_for:
                    order.append((key, entry))
                if entry["court"] not in courts_for[key]:
                    courts_for[key].append(entry["court"])
        names = list(dict.fromkeys(c["court_name"] for c in group))
        searches = []
        for key, entry in order:
            entry = {k: v for k, v in entry.items() if k != "court"}
            listed = courts_for[key]
            prefix = ("Every court listed for this nation" if len(names) > 1 and len(listed) == len(names)
                      else " and ".join(f"“{n}”" for n in listed))
            entry["reason"] = f"{prefix}: {entry['reason']}"
            searches.append(entry)
        ours = {(str(e["date"]), e["address"], e["reason"]) for e in searches}
        if path.exists():
            # Keep every search logged by other work; replace only this review's.
            old = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            searches = [e for e in old.get("searches", []) if str(e.get("date")) != REVIEW_DATE
                        and (str(e.get("date")), e.get("address"), e.get("reason")) not in ours] + searches
        unresolved = [c for c in group if c["verdict"] not in POSITIVE]
        blocked = sorted({s["address"] for s in searches if s["date"] == REVIEW_DATE and s["outcome"] == "blocked"
                          and s["place_kind"] in ("nation-website", "court-website")})
        if any(s["outcome"] == "found" for s in searches):
            status = "found"
        elif blocked or any(c["verdict"] == "cannot-tell" for c in unresolved):
            status = "partly-searched"
        else:
            status = "none-found"
        steps = []
        if unresolved:
            steps.append("Not confirmed in the Nov. 22, 2026 court review (the lead author decides): " + "; ".join(
                f"{c['court_name']} ({c['item_id']}, {c['verdict']})" for c in unresolved) + ".")
            if blocked:
                steps.append("A person could open in a browser the pages that refused the project's link checker: "
                             + ", ".join(blocked[:5]) + ".")
            if not any(s["place_kind"] == "nation-website" and s["outcome"] in ("found", "not-found")
                       for s in searches):
                steps.append("No website of the nation's own could be read; the Tribe's office could be asked "
                             "whether it runs a court.")
        log = {"profile": profile, "topic": "courts", "status": status,
               "last_searched": max(str(s["date"]) for s in searches), "searches": searches}
        if steps:
            log["next_steps"] = " ".join(steps)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(yaml.dump(log, sort_keys=False, allow_unicode=True, width=100), encoding="utf-8")
    return len(by_profile)


def merge(work):
    items = json.loads((work / "evidence.json").read_text(encoding="utf-8"))
    log = {e["url"]: e for e in json.loads((work / "fetch-log.json").read_text(encoding="utf-8"))}
    finals = {e["final"]: e for e in log.values() if e.get("final")}
    documents = {d["url"]: d for d in json.loads((ROOT / "research" / "tribal-law" / "documents.json").read_text(
        encoding="utf-8"))}
    first = {v["item_id"]: v for v in read_arrays(work / "out" / "*.json")}
    second = {v["item_id"]: v for v in read_arrays(work / "second" / "*.json")}

    def fetched_ok(url):
        if not url:
            return None
        entry = log.get(url) or finals.get(url)
        if entry:
            return entry["status"] == 200 and entry["outcome"] == "ok"
        document = documents.get(url)
        return bool(document and str(document.get("http_status")) == "200")

    records, attempts = [], []
    for item in items:
        one = first.get(item["item_id"], {})
        two = second.get(item["item_id"])
        final = dict(two or one)
        for url_key in ("evidence_url", "working_link"):
            if final.get(url_key) and not fetched_ok(final[url_key]):
                final.setdefault("problems", []).append(f"{url_key} {final[url_key]} was not fetched with status 200")
        unverified = [u for u in final.get("supporting_urls") or [] if not fetched_ok(u)]
        if unverified:
            final.setdefault("problems", []).append(f"supporting addresses not fetched with status 200: {unverified}")
        if final.get("verdict") not in VERDICTS:
            final.setdefault("problems", []).append(f"unknown verdict {final.get('verdict')}")
        records.append({
            "item_id": item["item_id"], "profile": item["profile"], "nation": item["nation"],
            "source": item["source"], "kind": item["kind"], "name": item["name"],
            "listed_link": item["listed_link"], "listed_as_of": item["listed_as_of"],
            "first_pass_verdict": item["first_pass_verdict"],
            "verdict": final.get("verdict"), "evidence_kind": final.get("evidence_kind"),
            "evidence_url": final.get("evidence_url"), "supporting_urls": final.get("supporting_urls") or [],
            "name_on_page": final.get("name_on_page"), "working_link": final.get("working_link"),
            "court_in_law": final.get("court_in_law"), "confidence": final.get("confidence"),
            "reason": final.get("reason"),
            "first_reader_verdict": one.get("verdict"),
            "second_reader_verdict": two.get("verdict") if two else None,
            "second_reader_note": two.get("second_reader_note") if two else None,
            "readers_agree": (one.get("verdict") == two.get("verdict")) if two else None,
            "evidence_checked": not final.get("problems"), "problems": final.get("problems") or [],
        })
        attempts.append({"item_id": item["item_id"], "profile": item["profile"], "nation": item["nation"],
                         "court_name": item["name"], "verdict": final.get("verdict"),
                         "attempts": attempts_for(item, final)})
    columns = ["item_id", "profile", "nation", "source", "kind", "name", "first_pass_verdict", "verdict",
               "evidence_kind", "evidence_url", "supporting_urls", "name_on_page", "working_link", "court_in_law",
               "confidence", "listed_link", "listed_as_of", "reason", "first_reader_verdict",
               "second_reader_verdict", "second_reader_note", "readers_agree", "evidence_checked", "problems"]
    (REVIEWS / f"{PREFIX}court-listings-second-pass.json").write_text(
        json.dumps(records, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    with open(REVIEWS / f"{PREFIX}court-listings-second-pass.csv", "w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(columns + ["lead_author_decision"])
        for record in records:
            row = []
            for column in columns:
                value = record.get(column)
                if isinstance(value, (list, dict)):
                    value = json.dumps(value, ensure_ascii=False)
                row.append("" if value is None else value)
            writer.writerow(row + [""])
    logs = write_search_logs(attempts)
    counts = collections.Counter(r["verdict"] for r in records)
    print(f"{len(records)} courts: {dict(counts)}; "
          f"{sum(1 for r in records if r['problems'])} with evidence problems; "
          f"{sum(len(a['attempts']) for a in attempts)} search attempts in {logs} search logs")


# --------------------------------------------------------------------------- apply


def dump(path, record):
    path.write_text(yaml.safe_dump(record, allow_unicode=True, sort_keys=False, width=100), encoding="utf-8")


def apply(check):
    tree = record_facts.Tree(ROOT)
    rows = [r for r in json.loads((REVIEWS / f"{PREFIX}court-listings-second-pass.json").read_text(encoding="utf-8"))
            if r["verdict"] == "link-dead-court-found" and r["working_link"] and r["evidence_checked"]
            and r["evidence_kind"] in ("nation-website", "court-website")]
    changed, skipped, count = set(), [], 0
    for row in rows:
        profile = tree.profiles[row["profile"]]
        matches = [f for f in profile.get("justice_institutions", [])
                   if f["source"] == row["source"] and f.get("name") == row["name"]
                   and f.get("link") == row["listed_link"]]
        if len(matches) != 1:
            skipped.append(f"{row['item_id']} {row['profile']} {row['name']}: {len(matches)} matching facts")
            continue
        fact = matches[0]
        fact["link"] = row["working_link"]
        moved = (f"The listed link ({row['listed_link']}) no longer reached the court on {REVIEW_DATE}; the link "
                 f"is the court's page found in the second pass of the court review "
                 f"(research/reviews/{PREFIX}court-listings-second-pass.json, {row['item_id']}).")
        fact["note"] = f"{fact['note']} {moved}" if fact.get("note") else moved
        count += 1
        changed.add(row["profile"])
    if not check:
        for relative in changed:
            profile = {k: v for k, v in tree.profiles[relative].items() if not k.startswith("_")}
            dump(ROOT / relative, profile)
    print(f"{'would relink' if check else 'relinked'} {count} courts in {len(changed)} profiles")
    for line in skipped:
        print(f"skipped {line}")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "gather":
        gather(pathlib.Path(sys.argv[2]))
    elif len(sys.argv) == 3 and sys.argv[1] == "merge":
        merge(pathlib.Path(sys.argv[2]))
    elif len(sys.argv) in (2, 3) and sys.argv[1] == "apply":
        apply(check="--check" in sys.argv)
    else:
        sys.exit(__doc__)
