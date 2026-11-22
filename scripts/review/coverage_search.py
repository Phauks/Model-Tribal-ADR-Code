"""Search for dispute resolution records for every federally recognized nation
that has none, and log every place looked (row 2 of the dataset gap audit,
research/analyses/2026-11-21-dataset-gap-audit.md; decision record 0025).

    python3 scripts/review/coverage_search.py gather  --work WORK [--nation ID ...] [--region NAME]
    python3 scripts/review/coverage_search.py batches --work WORK
    python3 scripts/review/coverage_search.py merge   --work WORK

gather   For each target nation (federally recognized, no record in any
         `dispute_resolution` field), first reads what the project already
         holds (project captures): the tribal law text collection
         (research/tribal-law/), the constitutions catalog's article readings
         (private work files), the profile's own justice institutions, raw
         research facts, sources found by the peacemaking research, and the
         Alaska Court System's list of restorative justice referral plans.
         Then it fetches, with an honestly named link checker that obeys
         robots.txt, waits a second between requests to one site and never
         tries to get past bot protection: the National Indian Law Library
         page the profile cites, the nation's own website (home page,
         sitemap, WordPress site search, and up to 14 linked pages or PDFs
         whose link mentions a code, ordinance, law, court, judiciary,
         justice, peacemaking, mediation or disputes), court pages the
         profile lists, and law code links on other sites. It keeps short
         passages around dispute resolution terms. One JSON file per nation
         goes to WORK/gathered/; fetched files stay private in WORK/cache/.

batches  Writes review batches (WORK/batches/) of every nation with passages,
         for reviewers following
         research/reviews/briefs/2026-11-22-dispute-resolution-coverage.md,
         and a fixed random sample of the other nations for a second look.

merge    Combines the gathered places, the candidates built from project
         captures and the reviewers' verdicts (WORK/verdicts/*.json) into
         research/reviews/2026-11-22-dispute-resolution-coverage.{json,csv}
         (empty lead_author_decision column), a counts file, and one search
         log per profile under research/search-logs/dispute-resolution/
         (profiles not searched are logged as not-searched). It never changes
         a profile.

Requires scripts/requirements.txt plus requests and beautifulsoup4, and
pdftotext for PDFs.
"""

import argparse
import collections
import concurrent.futures
import csv
import datetime
import glob
import hashlib
import json
import pathlib
import random
import re
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.robotparser

import yaml

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from record_facts import Tree, profile_facts  # noqa: E402

TODAY = "2026-11-22"
SEARCHER = "Claude (AI assistant)"
USER_AGENT = "model-tribal-adr-code link checker (research; one request per second per site)"
REVIEW = "research/reviews/2026-11-22-dispute-resolution-coverage"
LOG_FOLDER = pathlib.Path("research/search-logs/dispute-resolution")
PRIVATE = pathlib.Path("/mnt/project-files/research")
RJP_INDEX = "https://courts.alaska.gov/trialcourts/rjp.htm"
SAMPLE_SEED = 20261122
# Plan labels on the Alaska Court System list that do not match a profile name (project analysis).
PLAN_LABELS = {"traditional council of togiak": "traditional-village-of-togiak",
               "nenana peacemaking circle": "nenana-native-association"}

DISPUTE_TERMS = re.compile(
    r"\bmediat(?:ion|ions|or|ors|e|ed|ing)\b|\barbitrat\w*|\bpeace\s?-?mak\w*|\bpeacekeep\w*|"
    r"\btalking circles?\b|\bhealing circles?\b|\bsentencing circles?\b|\bcircle (?:sentencing|process|keep\w*)\b|"
    r"\bfamily group (?:decision[- ]making|conferenc\w*)|\bfamily (?:group )?conferenc\w*|"
    r"\balternative dispute resolution\b|\bdispute resolution\b|\bresol\w+ (?:of )?disputes?\b|"
    r"\belders?['’]? (?:council|panel|court)\b|\bcouncil of elders\b|\bpanel of elders\b|"
    r"\btraditional (?:court|dispute|justice|law)\b|\brestorative justice\b|\bcustomary (?:law|court)\b",
    re.IGNORECASE,
)
STRONG_LINK = re.compile(r"peace\s?-?mak|mediat|dispute|arbitrat|restorative|talking.circle|elders?.council", re.I)
COURT_LINK = re.compile(r"court|judicia|justice|judge", re.I)
LAW_LINK = re.compile(r"\bcodes?\b|ordinance|\blaws?\b|legal|constitution|statute|tribal.code|law.and.order", re.I)
SKIP_LINK = re.compile(r"facebook|twitter|instagram|youtube|linkedin|mailto:|tel:|\.(?:jpe?g|png|gif|svg|zip|docx?|xlsx?|mp[34])(?:$|\?)", re.I)
CODE_HOSTS = ("municode.com", "ecode360.com", "amlegal.com", "codepublishing.com", "tribalcourtclearinghouse", "tribal-institute.org")
LIBRARY_HOSTS = ("narf.org", "thorpe.law.ou.edu", "thorpe.ou.edu", "loc.gov", "gpo.gov", "federalregister.gov",
                 "archive.org", "nigc.gov", "bia.gov", "indianaffairs.gov")
CHALLENGE = re.compile(r"just a moment\.\.\.|attention required|cf-browser-verification|captcha|are you a robot|"
                       r"access denied|request unsuccessful\. incapsula|enable javascript and cookies to continue", re.I)
PAGE_LIMIT = 14
PDF_LIMIT = 4
PDF_BYTES = 25_000_000


# ---------------------------------------------------------------- fetching

_host_locks = collections.defaultdict(threading.Lock)
_host_last = {}
_robots = {}
_robots_lock = threading.Lock()


def cache_name(url):
    return hashlib.sha256(url.encode()).hexdigest()[:20]


def robots_allows(url):
    parts = urllib.parse.urlsplit(url)
    root = f"{parts.scheme}://{parts.netloc}"
    with _robots_lock:
        parser = _robots.get(root)
    if parser is None:
        parser = urllib.robotparser.RobotFileParser()
        try:
            response = raw_get(root + "/robots.txt", timeout=15)
            if response and response["status"] == 200 and "text" in response["type"]:
                parser.parse(response["body"].decode("utf-8", "replace").splitlines())
            else:
                parser.parse([])
        except Exception:  # an unreadable robots file allows everything
            parser.parse([])
        with _robots_lock:
            _robots[root] = parser
    return parser.can_fetch(USER_AGENT, url)


def raw_get(url, timeout=25, limit=PDF_BYTES):
    """One GET, paced per host, with two retries on connection failures."""
    import requests

    host = urllib.parse.urlsplit(url).netloc
    for attempt in range(3):
        with _host_locks[host]:
            wait = 1.0 - (time.time() - _host_last.get(host, 0))
            if wait > 0:
                time.sleep(wait)
            _host_last[host] = time.time()
        try:
            with requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=timeout,
                              allow_redirects=True, stream=True) as response:
                body = b""
                for chunk in response.iter_content(65536):
                    body += chunk
                    if len(body) > limit:
                        break
                return {"status": response.status_code, "final": response.url, "body": body,
                        "type": response.headers.get("content-type", "").lower()}
        except requests.exceptions.ConnectionError as error:
            text = str(error)
            if "NameResolution" in text or "Name or service not known" in text or "getaddrinfo" in text:
                return {"status": None, "error": "name-not-resolved", "final": url, "body": b"", "type": ""}
            if attempt == 2:
                return {"status": None, "error": "connection-failed", "final": url, "body": b"", "type": ""}
            time.sleep(2 + attempt * 3)
        except requests.exceptions.SSLError:
            return {"status": None, "error": "certificate-error", "final": url, "body": b"", "type": ""}
        except requests.exceptions.Timeout:
            if attempt == 2:
                return {"status": None, "error": "timeout", "final": url, "body": b"", "type": ""}
        except requests.RequestException as error:
            return {"status": None, "error": type(error).__name__, "final": url, "body": b"", "type": ""}
    return {"status": None, "error": "failed", "final": url, "body": b"", "type": ""}


def fetch(url, work, honor_robots=True):
    """Fetch a page or PDF into the private cache; return its status, outcome and text."""
    meta_path = work / "cache" / (cache_name(url) + ".json")
    if meta_path.exists():
        return json.loads(meta_path.read_text(encoding="utf-8"))
    page = {"url": url, "fetched": TODAY}
    if honor_robots and not robots_allows(url):
        page.update(status=None, outcome="blocked", why="robots.txt asks automated clients not to fetch this address",
                    text="", links=[])
    else:
        response = raw_get(url)
        page.update(status=response["status"], final=response["final"], content_type=response["type"],
                    error=response.get("error"))
        body = response["body"]
        text, links, title = "", [], None
        if response["status"] == 200 and body:
            if "pdf" in response["type"] or body[:5] == b"%PDF-":
                pdf = work / "cache" / (cache_name(url) + ".pdf")
                pdf.write_bytes(body)
                result = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, timeout=180)
                text = result.stdout.decode("utf-8", "replace")
                page["file_kind"] = "pdf"
            elif "html" in response["type"] or "xml" in response["type"] or body.lstrip()[:1] == b"<":
                text, links, title = read_html(body, response["final"])
                page["file_kind"] = "html"
            page["sha256"] = hashlib.sha256(body).hexdigest()
        page.update(title=title, text=re.sub(r"\s+", " ", text).strip(), links=links)
        page["outcome"], page["why"] = classify(page, body)
    (work / "cache" / (cache_name(url) + ".txt")).write_text(page.get("text", ""), encoding="utf-8")
    meta_path.write_text(json.dumps(page, ensure_ascii=False), encoding="utf-8")
    return page


def read_html(body, base):
    from bs4 import BeautifulSoup

    import warnings
    from bs4 import XMLParsedAsHTMLWarning

    warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)
    soup = BeautifulSoup(body, "html.parser")
    title = soup.title.get_text(" ", strip=True)[:150] if soup.title else None
    links = []
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        if not href or href.startswith("#") or SKIP_LINK.search(href):
            continue
        links.append([anchor.get_text(" ", strip=True)[:100], urllib.parse.urljoin(base, href).split("#")[0]])
    for loc in soup.find_all("loc"):  # sitemaps
        links.append(["", loc.get_text(strip=True)])
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    return soup.get_text(" "), links, title


def classify(page, body):
    status, kind = page.get("status"), page.get("file_kind")
    error = page.get("error")
    if status is None:
        if error == "name-not-resolved":
            return "dead-link", "the address's domain name does not resolve"
        return "error", f"the request failed ({error})"
    if status in (401, 403, 429) or (status == 503 and CHALLENGE.search(body[:20000].decode("utf-8", "replace"))):
        return "blocked", f"the site returned HTTP {status} to the project's link checker"
    if status in (404, 410):
        return "dead-link", f"the address returned HTTP {status}"
    if status >= 400:
        return "error", f"the site returned HTTP {status}"
    if kind == "html" and len(page["text"]) < 3000 and CHALLENGE.search(page["text"] + (page.get("title") or "")):
        return "blocked", "the site answered with a bot challenge page"
    if kind == "pdf" and len(page["text"]) < 200:
        return "scanned-unreadable", "the PDF has no text layer"
    if not kind:
        return "error", f"the site returned an unreadable {page.get('content_type') or 'file'}"
    return "read", "read"


def passages(text, limit=6, width=550):
    found, last = [], -10 ** 9
    for match in DISPUTE_TERMS.finditer(text):
        if match.start() < last + width:
            continue
        found.append({"term": match.group(0), "text": text[max(0, match.start() - 220):match.start() + width - 220]})
        last = match.start()
        if len(found) >= limit:
            break
    return found


def same_site(url, roots):
    host = urllib.parse.urlsplit(url).netloc.lower().removeprefix("www.")
    return any(host == r or host.endswith("." + r) or r.endswith("." + host) for r in roots)


def link_score(text, url):
    words = f"{text} {urllib.parse.unquote(urllib.parse.urlsplit(url).path)}"
    if STRONG_LINK.search(words):
        return 3
    if COURT_LINK.search(words):
        return 2
    if LAW_LINK.search(words):
        return 1
    return 0


# ---------------------------------------------------------------- targets and captures

def load_targets(tree, regions=None, only=None):
    targets = []
    for file, profile in sorted(tree.profiles.items()):
        facts = profile_facts(profile)
        if any(path.startswith("dispute_resolution") for path, _ in facts):
            continue
        if "federal" not in {item.get("type") for item in profile.get("recognition") or []}:
            continue
        region = (profile.get("federal_administration") or {}).get("bureau_of_indian_affairs_region")
        if regions and region not in regions:
            continue
        if only and profile["id"] not in only:
            continue
        targets.append((file, profile, region))
    return targets


class Captures:
    """What the project already holds, indexed by nation."""

    def __init__(self, tree):
        self.tree = tree
        self.provisions = collections.defaultdict(list)
        for item in json.load(open("research/tribal-law/provisions.json", encoding="utf-8")):
            self.provisions[item["nation"]].append(item)
        self.documents = collections.defaultdict(list)
        for item in json.load(open("research/tribal-law/documents.json", encoding="utf-8")):
            for nation in item.get("nations") or []:
                self.documents[nation].append(item)
        self.no_provision = collections.Counter()
        for item in json.load(open("research/tribal-law/no-provision-passages.json", encoding="utf-8")):
            for nation in item.get("nations") or []:
                self.no_provision[nation] += 1
        self.constitution_texts = collections.defaultdict(list)
        self.constitution_articles = collections.defaultdict(list)
        read_path = PRIVATE / "constitutions/read-all.json"
        if read_path.exists():
            documents = {}
            for item in json.load(open(read_path, encoding="utf-8")):
                if item.get("text_characters"):
                    self.constitution_texts[item["nation"]].append(item)
                documents[(item["nation"], item["sha256"][:16])] = item
            summaries = json.load(open(PRIVATE / "constitutions/summaries-all.json", encoding="utf-8"))
            for key, value in summaries.items():
                nation_hash, label, line, topic = key.split("|")
                nation, short = nation_hash.split(":")
                if topic in ("dispute-resolution", "peacemaking") and value.get("confirmed") and value.get("summary"):
                    document = documents.get((nation, short)) or {}
                    self.constitution_articles[nation].append(
                        {"article": label, "topic": topic, "summary": value["summary"], "methods": value.get("methods") or [],
                         "url": document.get("final_url") or document.get("url"), "sha256": document.get("sha256"),
                         "anchor": document.get("anchor") or document.get("page_title")})
        self.raw = collections.defaultdict(list)
        for path in sorted(glob.glob("research/raw/*/*.json")):
            data = json.load(open(path, encoding="utf-8"))
            if isinstance(data, dict):
                for fact in data.get("facts") or []:
                    if str(fact.get("field", "")).startswith("dispute-resolution"):
                        self.raw[fact.get("nation")].append((path, fact))
        self.research_sources = collections.defaultdict(list)
        for key, source in tree.sources.items():
            if key.startswith(("compact-", "secretarial-procedures-")):
                continue
            sessions = source.get("found_in") or []
            if not any(re.search(r"peacemaking|stories|restorative", s) for s in sessions):
                continue
            text = json.dumps(source, default=str)
            for nation in re.findall(r'"([a-z0-9]+(?:-[a-z0-9]+)+)"', text):
                self.research_sources[nation].append(key)

    def for_nation(self, file, profile, rjp_plans):
        nation = profile["id"]
        places, candidates = [], []

        def place(kind, address, outcome, reason, query=None, method="script", records=None):
            entry = {"place_kind": kind, "address": address, "outcome": outcome, "reason": reason, "method": method}
            if query:
                entry["query"] = query
            if records:
                entry["records"] = records
            places.append(entry)

        # Tribal law text collection (PR #54).
        provisions = [p for p in self.provisions.get(nation, []) if not p.get("duplicate_of")
                      and (p.get("second_pass") or {}).get("verdict") != "drop" and p.get("scope") != "out-of-scope"]
        documents = self.documents.get(nation, [])
        readable = [d for d in documents if d.get("characters")]
        if provisions:
            for p in provisions:
                candidates.append({
                    "origin": "tribal-law-provision", "place_kind": "project-capture",
                    "kind": p.get("method") or "other", "name": p.get("locator"), "citation": p.get("citation"),
                    "summary": p.get("summary"), "evidence_url": p.get("url"), "sha256": p.get("sha256"),
                    "first_reader": "research/tribal-law/provisions.json (small-model reading, quote checked: "
                                    f"{p.get('quote_check')}; second pass: {(p.get('second_pass') or {}).get('verdict') or 'not sampled'})",
                    "record": f"research/tribal-law/provisions.json#{p.get('id')}",
                    "scope": p.get("scope"), "confidence": p.get("confidence")})
            place("project-capture", "research/tribal-law/provisions.json", "found",
                  f"The tribal law text collection lists {len(provisions)} dispute resolution provision(s) read from "
                  "this nation's own law texts, not yet in the profile.", query=f"nation {nation}",
                  records=[f"research/tribal-law/provisions.json#{p.get('id')}" for p in provisions][:20])
        elif documents:
            unread = len(documents) - len(readable)
            reason = (f"The tribal law text collection fetched {len(documents)} document(s) linked from this nation's profile "
                      f"({len(readable)} with text) and found no dispute resolution provision in them")
            if self.no_provision.get(nation):
                reason += f"; {self.no_provision[nation]} passage(s) with dispute resolution words were judged not to be provisions"
            reason += "." if not unread else f"; {unread} could not be read (no text layer, blocked or failed)."
            place("project-capture", "research/tribal-law/documents.json",
                  "not-found" if readable else "scanned-unreadable", reason, query=f"nation {nation}")
        else:
            place("project-capture", "research/tribal-law/documents.json", "not-found",
                  "The tribal law text collection holds no document for this nation, because its profile cites no law "
                  "code, court rules or dispute resolution link.", query=f"nation {nation}")

        # Constitutions catalog (private article readings).
        texts = self.constitution_texts.get(nation, [])
        articles = self.constitution_articles.get(nation, [])
        if articles:
            for a in articles:
                candidates.append({
                    "origin": "constitution-article", "place_kind": "project-capture",
                    "kind": "peacemaking" if a["topic"] == "peacemaking" else "constitutional-provision",
                    "name": f"{a['article']} of {a.get('anchor') or 'the constitution'}", "citation": a["article"],
                    "summary": a["summary"], "evidence_url": a["url"], "sha256": a["sha256"],
                    "methods": a["methods"],
                    "first_reader": "constitutions catalog article reading (small-model reading, confirmed by a second reading)",
                    "record": "private constitutions catalog summaries-all.json"})
            place("project-capture", "constitutions catalog (private article readings)", "found",
                  f"The constitutions catalog's readings mark {len(articles)} article(s) of this nation's constitution "
                  "as concerning dispute resolution or peacemaking.", query="topics dispute-resolution, peacemaking")
        elif texts:
            place("project-capture", "constitutions catalog (private article readings)", "not-found",
                  f"The constitutions catalog read {len(texts)} constitution text(s) for this nation and marked no article "
                  "as concerning dispute resolution or peacemaking (election disputes and judicial power not counted).",
                  query="topics dispute-resolution, peacemaking")
        else:
            place("project-capture", "constitutions catalog (private article readings)", "not-found",
                  "The constitutions catalog holds no constitution text for this nation.")

        # The profile's own justice institutions.
        programs = [j for j in profile.get("justice_institutions") or []
                    if re.search(r"peacemak|mediat|elder|tradition|restorative", f"{j.get('kind')} {j.get('name')}", re.I)]
        for j in programs:
            candidates.append({
                "origin": "profile-justice-institution", "place_kind": "project-capture", "kind": j.get("kind"),
                "name": j.get("name"), "summary": "Listed in the profile's justice institutions, not in dispute_resolution.",
                "evidence_url": j.get("link"), "first_reader": f"profile fact cited to {j.get('source')} ({j.get('verification')})",
                "record": file})
        if programs:
            place("project-capture", file, "found",
                  f"The profile lists {len(programs)} peacemaking or traditional program(s) under justice_institutions "
                  "but nothing under dispute_resolution.", query="justice_institutions")

        # Raw research facts never carried into the profile.
        for path, fact in self.raw.get(nation, []):
            value = fact.get("value") or {}
            candidates.append({
                "origin": "raw-fact", "place_kind": "project-capture", "kind": value.get("kind") or fact["field"],
                "name": value.get("name") or value.get("title"), "summary": value.get("description") or value.get("summary"),
                "evidence_url": value.get("url") or value.get("link"), "first_reader": f"{path} (source {fact.get('source')})",
                "record": path})
        if self.raw.get(nation):
            place("project-capture", "research/raw/", "found",
                  f"Raw research files hold {len(self.raw[nation])} dispute resolution fact(s) for this nation that are not in the profile.")

        # Sources found by the peacemaking research.
        keys = sorted(set(self.research_sources.get(nation, [])))
        for key in keys:
            source = self.tree.sources[key]
            candidates.append({
                "origin": "research-source", "place_kind": "project-capture", "kind": "source-record",
                "name": (source.get("citation") or {}).get("title"), "summary": source.get("annotation") or source.get("notes"),
                "evidence_url": source.get("original_link"), "first_reader": f"source record {key}", "record": key})
        if keys:
            place("project-capture", "content/sources/ (peacemaking and stories research)", "found",
                  f"Source records from the peacemaking and stories research name this nation: {', '.join(keys[:5])}.",
                  records=keys[:10])

        # Alaska Court System restorative justice referral plans.
        if (profile.get("federal_administration") or {}).get("bureau_of_indian_affairs_region") == "Alaska":
            plan = rjp_plans.get(nation)
            if plan:
                candidates.append({
                    "origin": "alaska-restorative-justice-plan", "place_kind": "state-court-directory",
                    "kind": "restorative-justice", "name": plan["label"],
                    "summary": "Listed by the Alaska Court System among plans adopted with a Tribe for restorative "
                               "justice referral of criminal cases (Alaska Criminal Rule 11(i)).",
                    "evidence_url": plan["url"], "first_reader": "coverage_search.py (list entry matched by name)",
                    "record": RJP_INDEX})
                place("state-court-directory", RJP_INDEX, "found",
                      f"The Alaska Court System lists a restorative justice referral plan for '{plan['label']}'.",
                      query="restorative justice plans")
            elif rjp_plans:
                place("state-court-directory", RJP_INDEX, "not-found",
                      "The Alaska Court System's list of restorative justice referral plans has no plan for this nation.",
                      query="restorative justice plans")
        return places, candidates


def web_targets(profile, tree):
    sites = []
    for contact in profile.get("contacts") or []:
        if contact.get("kind") == "website" and contact.get("value") not in sites:
            sites.append(contact["value"])
    libraries, courts, codes = [], [], []
    for path, fact in profile_facts(profile):
        source = tree.sources.get(fact.get("source")) or {}
        link = source.get("original_link") or ""
        if fact["source"].startswith("national-indian-law-library") and "/nill/tribes/" in link and link not in libraries:
            libraries.append(link)
    for item in profile.get("justice_institutions") or []:
        link = item.get("link")
        if link and link not in courts and not any(h in link for h in LIBRARY_HOSTS) and not same_site(link, roots(sites)):
            courts.append(link)
    for item in profile.get("governing_documents") or []:
        link = item.get("link")
        if item.get("kind") in ("law-code", "court-rules", "other") and link and link not in codes \
                and not any(h in link for h in LIBRARY_HOSTS):
            codes.append(link)
    return sites[:2], libraries[:1], courts[:3], codes[:4]


def roots(urls):
    return {urllib.parse.urlsplit(u).netloc.lower().removeprefix("www.") for u in urls if u}


def search_site(start, work, limit=PAGE_LIMIT, site_roots=None):
    """Read a site from one address: the page, its sitemap and search, and its linked law and court pages."""
    site_roots = site_roots or roots([start])
    home = fetch(start, work)
    pages, seen = [home], {start, home.get("final")}
    if home.get("outcome") != "read":
        return pages
    queue = [(link_score(t, u), t, u) for t, u in home.get("links", [])]
    base = f"{urllib.parse.urlsplit(home.get('final') or start).scheme}://{urllib.parse.urlsplit(home.get('final') or start).netloc}"
    for sitemap in (base + "/sitemap.xml", base + "/wp-sitemap.xml"):
        page = fetch(sitemap, work)
        if page.get("outcome") == "read":
            locs = page.get("links", [])
            children = [u for _, u in locs if u.endswith(".xml")]
            if children:
                for child in sorted(children, key=lambda u: ("page" not in u, u))[:3]:
                    sub = fetch(child, work)
                    locs += sub.get("links", []) if sub.get("outcome") == "read" else []
            queue += [(link_score("", u), "", u) for _, u in locs if not u.endswith(".xml")]
            break
    if b"wp-content" in (work / "cache" / (cache_name(start) + ".json")).read_bytes() or "wp-content" in json.dumps(home.get("links", [])):
        for term in ("peacemaking", "mediation"):
            result = fetch(f"{base}/?s={term}", work)
            result["search_term"] = term
            pages.append(result)
            if result.get("outcome") == "read":
                queue += [(max(link_score(t, u), 1), t, u) for t, u in result.get("links", []) if "?s=" not in u]
    queue = [q for q in queue if q[0] > 0 and same_site(q[2], site_roots) and q[2].startswith("http")]
    queue.sort(key=lambda q: (-q[0], len(q[2])))
    html_count = pdf_count = 0
    while queue and html_count + pdf_count < limit:
        score, text, url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        is_pdf = url.lower().split("?")[0].endswith(".pdf")
        if is_pdf and pdf_count >= PDF_LIMIT:
            continue
        page = fetch(url, work)
        page["link_text"] = text
        pages.append(page)
        if is_pdf or page.get("file_kind") == "pdf":
            pdf_count += 1
        else:
            html_count += 1
        if page.get("outcome") == "read" and score >= 2:
            extra = [(link_score(t, u), t, u) for t, u in page.get("links", [])]
            extra = [q for q in extra if q[0] > 0 and same_site(q[2], site_roots) and q[2] not in seen]
            queue = sorted(queue + extra, key=lambda q: (-q[0], len(q[2])))
    return pages


def summarize_site(kind, address, pages, query):
    read = [p for p in pages if p.get("outcome") == "read"]
    found = [(p, x) for p in read for x in passages(p.get("text", ""))]
    first = pages[0] if pages else {}
    entry = {"place_kind": kind, "address": address, "query": query, "method": "script",
             "pages": [{"url": p["url"], "status": p.get("status"), "outcome": p.get("outcome"), "why": p.get("why"),
                        "title": p.get("title"), "passages": passages(p.get("text", ""))} for p in pages]}
    if found:
        entry["outcome"] = "found"
        entry["reason"] = (f"{len(found)} passage(s) with dispute resolution words on {len({p['url'] for p, _ in found})} "
                           f"of {len(read)} pages read; see the review for what they show.")
    elif read:
        entry["outcome"] = "not-found"
        entry["reason"] = (f"Read {len(read)} page(s) (home page, sitemap and linked law, court and justice pages); "
                           "none mentions mediation, arbitration, peacemaking, circles, elders' panels or dispute resolution.")
    else:
        entry["outcome"] = first.get("outcome") or "error"
        entry["reason"] = f"The address could not be read: {first.get('why') or 'no response'}."
    return entry


def gather_one(target, captures, rjp_plans, work):
    file, profile, region = target
    out_path = work / "gathered" / f"{profile['id']}.json"
    if out_path.exists():
        return profile["id"], "cached"
    places, candidates = captures.for_nation(file, profile, rjp_plans)
    sites, libraries, courts, codes = web_targets(profile, captures.tree)
    query = "code, ordinance, law, court, judicial, justice, peacemaking, mediation, dispute (links, sitemap, site search)"
    for link in libraries:
        page = fetch(link, work, honor_robots=False)
        if page.get("outcome") == "read":
            places.append(summarize_site("national-indian-law-library", link, [page], "dispute resolution words"))
        else:
            outcome = "blocked" if page.get("status") in (403, 404, 406) else page.get("outcome")
            places.append({"place_kind": "national-indian-law-library", "address": link, "method": "script",
                           "outcome": outcome,
                           "reason": (f"The library page returned HTTP {page.get('status')} to the project's honestly named "
                                      "link checker although the profile was built from it on 2026-11-21; the library refuses "
                                      "scripts it does not recognize, so this is recorded as blocked.")
                           if outcome == "blocked" else f"The library page could not be read: {page.get('why')}."})
    if not libraries:
        places.append({"place_kind": "national-indian-law-library", "address": "https://narf.org/nill/tribes/index.html",
                       "method": "script", "outcome": "not-found",
                       "reason": "No profile fact cites a National Indian Law Library page for this nation, so the "
                                 "library's tribal law index read on 2026-11-21 had no page for it."})
    if not sites:
        places.append({"place_kind": "nation-website", "address": "contacts (kind website) in the profile",
                       "method": "script", "outcome": "no-site",
                       "reason": "The profile lists no official website for the nation."})
    for site in sites:
        pages = search_site(site, work)
        places.append(summarize_site("nation-website", site, pages, query))
    for link in courts:
        pages = search_site(link, work, limit=4)
        places.append(summarize_site("tribal-court-site", link, pages, query))
    for link in codes:
        if same_site(link, roots(sites)):
            page = fetch(link, work)
            places.append(summarize_site("nation-code-site", link, [page], "dispute resolution words"))
            continue
        kind = "nation-code-site"
        pages = search_site(link, work, limit=4)
        places.append(summarize_site(kind, link, pages, "dispute resolution words"))
    record = {"nation": profile["id"], "profile": file, "name": profile["names"]["official"], "region": region,
              "places": places, "candidates": candidates}
    out_path.write_text(json.dumps(record, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return profile["id"], "done"


def alaska_plans(work, tree):
    """Match the Alaska Court System's restorative justice plans to profiles by name."""
    page = fetch(RJP_INDEX, work)
    if page.get("outcome") != "read":
        return {}
    names = {}
    for file, profile in tree.profiles.items():
        if (profile.get("federal_administration") or {}).get("bureau_of_indian_affairs_region") == "Alaska":
            names[normalize(profile["names"]["official"])] = profile["id"]
            for other in (profile.get("names") or {}).get("self_designations") or []:
                if isinstance(other, dict) and other.get("name"):
                    names[normalize(other["name"])] = profile["id"]
    plans = {}
    for label, url in page.get("links", []):
        if "/rjp/" not in url or not url.lower().endswith(".pdf"):
            continue
        key = normalize(label)
        nation = PLAN_LABELS.get(label.lower().strip()) or names.get(key) or next((n for k, n in names.items() if key and (k.startswith(key) or key.startswith(k))), None)
        if nation:
            plans[nation] = {"label": label, "url": url}
    (work / "alaska-plans.json").write_text(json.dumps(plans, indent=1) + "\n", encoding="utf-8")
    return plans


def normalize(name):
    name = re.sub(r"\(.*?\)", "", name.lower())
    name = re.sub(r"[^a-z0-9 ]", " ", name)
    return " ".join(w for w in name.split() if w not in ("the", "of", "tribe", "tribal"))


def gather(arguments):
    work = pathlib.Path(arguments.work)
    (work / "cache").mkdir(parents=True, exist_ok=True)
    (work / "gathered").mkdir(exist_ok=True)
    tree = Tree(".")
    targets = load_targets(tree, arguments.region, arguments.nation)
    captures = Captures(tree)
    plans = alaska_plans(work, tree)
    print(f"{len(targets)} target nations; {len(plans)} Alaska restorative justice plans matched")
    done = 0
    with concurrent.futures.ThreadPoolExecutor(arguments.threads) as pool:
        futures = [pool.submit(gather_one, t, captures, plans, work) for t in targets]
        for future in concurrent.futures.as_completed(futures):
            try:
                nation, state = future.result()
            except Exception as error:  # report and keep going
                print("failed:", repr(error)[:200], flush=True)
                continue
            done += 1
            if done % 20 == 0:
                print(done, "nations gathered", flush=True)


# ---------------------------------------------------------------- batches

SEARCH_ECHO = re.compile(r"(?:search results for|you searched for|results for):?\s*[“\"']?\s*(?:peacemaking|mediation)\s*[”\"']?", re.I)
NO_RESULTS = re.compile(r"nothing found|couldn.t find|nothing matched|no results|did not match any|no posts were found|sorry, no", re.I)


def clean(record):
    """Drop passages that only echo the site search words, and settle each web place's outcome."""
    for place in record["places"]:
        pages = place.get("pages")
        if not pages:
            continue
        for page in pages:
            found = page.get("passages") or []
            if "?s=" in page["url"]:
                term = page["url"].rsplit("=", 1)[-1].lower()
                joined = " ".join(p["text"] for p in found)
                others = [m.group(0) for m in DISPUTE_TERMS.finditer(joined) if m.group(0).lower() != term]
                if NO_RESULTS.search(joined) or (joined.lower().count(term) <= 3 and not others):
                    found = []  # the page only repeats the search words
            page["passages"] = [p for p in found if DISPUTE_TERMS.search(SEARCH_ECHO.sub("", p["text"]))]
        read = [p for p in pages if p.get("outcome") == "read"]
        found = [p for p in read if p["passages"]]
        if place["outcome"] == "found" and not found:
            place["outcome"] = "not-found"
            place["reason"] = (f"Read {len(read)} page(s) (home page, sitemap, site search and linked law, court and justice "
                               "pages); none mentions mediation, arbitration, peacemaking, circles, elders' panels or "
                               "dispute resolution.")
    return record

def batches(arguments):
    work = pathlib.Path(arguments.work)
    (work / "batches").mkdir(exist_ok=True)
    with_passages, without = [], []
    for path in sorted((work / "gathered").glob("*.json")):
        record = clean(json.loads(path.read_text(encoding="utf-8")))
        items = []
        for place in record["places"]:
            for page in place.get("pages") or []:
                for number, passage in enumerate(page.get("passages") or []):
                    items.append({"ref": f"{cache_name(page['url'])}-{number}", "place_kind": place["place_kind"],
                                  "url": page["url"], "status": page.get("status"), "title": page.get("title"),
                                  "text": passage["text"]})
        entry = {"nation": record["nation"], "name": record["name"], "region": record["region"],
                 "capture_candidates": [{k: c.get(k) for k in ("origin", "kind", "name", "summary", "evidence_url")}
                                        for c in record["candidates"]],
                 "passages": items}
        if items:
            with_passages.append(entry)
        elif not record["candidates"]:
            without.append(entry)  # nothing at all to review
    size = 12
    for start in range(0, len(with_passages), size):
        batch = with_passages[start:start + size]
        (work / "batches" / f"batch-{start // size + 1:03d}.json").write_text(
            json.dumps(batch, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    random.seed(SAMPLE_SEED)
    sample = sorted(random.sample([e["nation"] for e in without], max(1, round(len(without) / 10)))) if without else []
    (work / "batches" / "none-found-sample.json").write_text(json.dumps(sample, indent=1) + "\n", encoding="utf-8")
    print(f"{len(with_passages)} nations with passages in {(len(with_passages) + size - 1) // size} batches; "
          f"{len(without)} with nothing to review; sample of {len(sample)}")


# ---------------------------------------------------------------- merge

CSV_FIELDS = ["candidate_id", "nation", "profile", "region", "origin", "place_kind", "field", "kind", "name", "citation",
              "summary", "evidence_url", "evidence_status", "first_reader", "first_verdict", "first_note",
              "second_reader", "second_verdict", "second_note", "confidence", "lead_author_decision"]
ORIGIN_PLACES = {"tribal-law-provision": "research/tribal-law/provisions.json",
                 "constitution-article": "constitutions catalog (private article readings)",
                 "raw-fact": "research/raw/",
                 "research-source": "content/sources/ (peacemaking and stories research)",
                 "alaska-restorative-justice-plan": RJP_INDEX}
FAILED = ("blocked", "error", "scanned-unreadable", "paywalled", "dead-link")
KEY_TERMS = re.compile(r"peace\s?-?mak\w*|mediat\w*|arbitrat\w*|circle\w*|elders?\b|restorative|dispute resolution|"
                       r"resol\w+ (?:of )?disputes?|traditional court|grievance|settlement", re.I)


def load_verdicts(folder):
    verdicts = {}
    for path in sorted(folder.glob("*.json")):
        for item in json.loads(path.read_text(encoding="utf-8")):
            verdicts.setdefault(item["nation"], {}).update(item)
    return verdicts


def candidate_key(candidate):
    return f"{candidate.get('origin')}|{candidate.get('name')}|{candidate.get('evidence_url')}"


def assemble(record, verdict):
    """Every candidate for one nation with its first verdict, in a stable order."""
    out = []
    for index, c in enumerate(record["candidates"]):
        decided = (verdict.get("capture_verdicts") or {}).get(str(index)) or verdict.get("all_captures") \
            or {"first_verdict": "candidate", "first_note": "not reviewed"}
        field = {"tribal-law-provision": "provisions", "constitution-article": "provisions",
                 "alaska-restorative-justice-plan": "forums", "profile-justice-institution": "forums"}.get(c["origin"])
        out.append(dict(c, field=c.get("field") or field, **decided))
    for c in verdict.get("candidates") or []:
        out.append(dict(c, origin="web-passage"))
    seen = collections.Counter()
    for c in out:
        key = candidate_key(c)
        seen[key] += 1
        c["key"] = key if seen[key] == 1 else f"{key}|{seen[key]}"  # two provisions can share a locator
    return out


def shared_hosts(records):
    """Websites listed for three or more nations belong to a regional organization, not one nation."""
    counts = collections.Counter()
    for record in records:
        for place in record["places"]:
            if place["place_kind"] == "nation-website" and place["address"].startswith("http"):
                counts[urllib.parse.urlsplit(place["address"]).netloc.lower().removeprefix("www.")] += 1
    return {host for host, count in counts.items() if count >= 3}


def second(arguments):
    """Write the second reader's input: every first-pass candidate with its evidence page checked again,
    and the fixed sample of nations with nothing to review."""
    work = pathlib.Path(arguments.work)
    verdicts = load_verdicts(work / "verdicts")
    sample = json.loads((work / "batches" / "none-found-sample.json").read_text(encoding="utf-8"))
    items, sampled = [], []
    for path in sorted((work / "gathered").glob("*.json")):
        record = clean(json.loads(path.read_text(encoding="utf-8")))
        for c in assemble(record, verdicts.get(record["nation"], {})):
            if c.get("first_verdict") != "candidate" or not c.get("evidence_url"):
                continue
            page = fetch(c["evidence_url"], work)
            text = page.get("text", "")
            words = [w for w in re.findall(r"[A-Za-z]{5,}", f"{c.get('name')} {c.get('kind')}")][:6]
            hits = [m for m in KEY_TERMS.finditer(text)]
            focus = next((m for m in hits if any(w.lower() in text[max(0, m.start() - 600):m.end() + 600].lower()
                                                 for w in words)), hits[0] if hits else None)
            items.append({"nation": record["nation"], "key": c["key"], "origin": c["origin"], "kind": c.get("kind"),
                          "name": c.get("name"), "summary": c.get("summary"), "evidence_url": c["evidence_url"],
                          "status": page.get("status"), "outcome": page.get("outcome"),
                          "matches": len(hits),
                          "snippet": text[max(0, focus.start() - 350):focus.end() + 450] if focus else ""})
        if record["nation"] in sample:
            sampled.append({"nation": record["nation"], "places": [
                {"place_kind": p["place_kind"], "address": p["address"], "outcome": p["outcome"],
                 "pages": [(pg["url"], pg.get("status"), pg.get("title")) for pg in p.get("pages") or []]}
                for p in record["places"]]})
    (work / "second-input.json").write_text(json.dumps({"candidates": items, "sample": sampled}, ensure_ascii=False,
                                                       indent=1) + "\n", encoding="utf-8")
    print(len(items), "candidates to re-read;", len(sampled), "sampled nations")


def merge(arguments):
    work = pathlib.Path(arguments.work)
    tree = Tree(".")
    verdicts = load_verdicts(work / "verdicts")
    seconds = {}
    for path in sorted((work / "second").glob("*.json")):
        seconds.update(json.loads(path.read_text(encoding="utf-8")))
    evidence = {c["key"]: c for c in json.loads((work / "second-input.json").read_text(encoding="utf-8"))["candidates"]}
    sample_path = work / "second-sample.json"
    sample = json.loads(sample_path.read_text(encoding="utf-8")) if sample_path.exists() else {}
    records = [clean(json.loads(p.read_text(encoding="utf-8"))) for p in sorted((work / "gathered").glob("*.json"))]
    regional = shared_hosts(records)
    rows, logs = [], {}
    counts = collections.defaultdict(collections.Counter)
    for record in records:
        nation, verdict = record["nation"], verdicts.get(record["nation"], {})
        kept, dropped = [], []
        for c in assemble(record, verdict):
            if c.get("first_verdict") != "candidate":
                continue
            check = seconds.get(c["key"]) or {}
            c.update({k: v for k, v in check.items() if k in ("second_reader", "second_verdict", "second_note", "summary",
                                                               "kind", "field", "confidence")})
            c["evidence_status"] = (evidence.get(c["key"]) or {}).get("status")
            if c.get("second_verdict") == "not-dispute-resolution":
                counts["second pass"]["dropped"] += 1
                dropped.append(c)
                continue
            kept.append(c)
        ids = []
        for number, c in enumerate(kept, start=1):
            candidate_id = f"{nation}-{number}"
            ids.append(f"{REVIEW}.json#{candidate_id}")
            c["candidate_id"] = candidate_id
            row = {f: c.get(f) for f in CSV_FIELDS}
            row.update(candidate_id=candidate_id, nation=nation, profile=record["profile"], region=record["region"],
                       place_kind=c.get("place_kind"), lead_author_decision="")
            rows.append(row)
        searches, failed_web = [], []
        for place in record["places"]:
            kind, outcome, reason = place["place_kind"], place["outcome"], place["reason"]
            host = urllib.parse.urlsplit(place["address"]).netloc.lower().removeprefix("www.")
            if kind == "nation-website" and host in regional:
                kind = "intertribal-organization"
                reason = reason.rstrip(".") + "; this address is the website of a regional organization listed for several nations."
            records_found = []
            if kind == "project-capture" or kind == "state-court-directory":
                origins = [o for o, a in ORIGIN_PLACES.items() if a == place["address"]]
                mine = [c for c in kept if c["origin"] in origins or (c["origin"] == "profile-justice-institution"
                                                                       and place["address"] == record["profile"])]
                if outcome == "found" and not mine:
                    outcome = "not-found"
                    notes = {c.get("second_note") for c in dropped if c["origin"] in origins} or \
                        {c.get("first_note") for c in assemble(record, verdict) if c["origin"] in origins and c.get("first_note")}
                    reason = reason.rstrip(".") + ". On review none is a dispute resolution forum or provision of this nation" + \
                        (f" ({sorted(notes)[0].rstrip('.')})." if notes else ".")
                records_found = [f"{REVIEW}.json#{c['candidate_id']}" for c in mine]
            else:
                urls = {p["url"] for p in place.get("pages") or []} | {place["address"]}
                mine = [c for c in kept if c["origin"] == "web-passage" and c.get("evidence_url") in urls]
                if mine:
                    outcome = "found"
                    reason = (f"Found {len(mine)} candidate(s) for review: "
                              + "; ".join(str(c.get("name")) for c in mine)[:300] + ".")
                    records_found = [f"{REVIEW}.json#{c['candidate_id']}" for c in mine]
                elif outcome == "found":
                    outcome = "not-found"
                    reason = (verdict.get("reasons") or {}).get(place["address"]) or verdict.get("none_found_reason") or (
                        "Pages mention dispute resolution words, but on reading none describes a dispute resolution "
                        "forum, program or provision of this nation.")
                if kind in ("nation-website", "intertribal-organization") and outcome == "not-found":
                    read = [p for p in place.get("pages") or [] if p.get("outcome") == "read"
                            and "?s=" not in p["url"] and "sitemap" not in p["url"]]
                    if len(read) <= 1:
                        home = work / "cache" / (cache_name(place["address"]) + ".json")
                        links = len(json.loads(home.read_text(encoding="utf-8")).get("links", [])) if home.exists() else 0
                        if links < 5:
                            reason = ("Read the home page only: it offered fewer than five links to follow and no sitemap, "
                                      "so its menu may be built by scripts the link checker does not run.")
                            failed_web.append(place["address"])
                if outcome in FAILED:
                    failed_web.append(place["address"])
            entry = {"date": TODAY, "searched_by": SEARCHER, "method": place.get("method", "script"),
                     "place_kind": kind, "address": place["address"]}
            if place.get("query"):
                entry["query"] = place["query"]
            entry.update(outcome=outcome, reason=reason)
            if outcome == "found":
                entry["records"] = (records_found or place.get("records") or [])[:20] or None
                if entry["records"] is None:
                    del entry["records"]
            searches.append(entry)
            counts["searches"][f"{kind} | {outcome}"] += 1
        if kept:
            searches.append({"date": TODAY, "searched_by": SEARCHER, "method": "ai-review",
                             "place_kind": "other", "address": f"{REVIEW}.json",
                             "query": "first and second reading (Claude (AI assistant)) of the gathered passages and leads",
                             "outcome": "found",
                             "reason": f"{len(kept)} candidate(s) kept for the lead author's review (Gate 1); none is in the profile yet.",
                             "records": ids[:20]})
            status = "found"
        else:
            reviewed = verdict.get("none_found_reason")
            if dropped:
                reviewed = (f"{len(dropped)} lead(s) kept on the first reading were set aside on the second: "
                            + " ".join(sorted({str(c.get('second_note')) for c in dropped}))[:600])
            searches.append({"date": TODAY, "searched_by": SEARCHER, "method": "ai-review",
                             "place_kind": "other", "address": f"{REVIEW}.json",
                             "query": "reading (Claude (AI assistant)) of the gathered passages and leads",
                             "outcome": "not-found",
                             "reason": reviewed or "No passage on any page read mentioned a dispute resolution term, and "
                                                   "the project's own captures held no lead."})
            if nation in sample:
                check = sample[nation]
                searches.append({"date": TODAY, "searched_by": SEARCHER, "method": "ai-review",
                                 "place_kind": "other", "address": f"{REVIEW}.md",
                                 "query": "second reading of a fixed 10 percent sample of nations with nothing found "
                                          f"(seed {SAMPLE_SEED})",
                                 "outcome": "not-found", "reason": f"Second reading: {check['second_verdict']}. {check['second_note']}"})
                counts["none-found sample"][check["second_verdict"]] += 1
            status = "partly-searched" if failed_web else "none-found"
        log = {"profile": record["profile"], "topic": "dispute-resolution", "status": status, "last_searched": TODAY,
               "searches": searches}
        log["next_steps"] = next_steps(failed_web, status)
        logs[record["profile"]] = log
        region = record["region"]
        counts["regions"][f"{region} | searched"] += 1
        counts["regions"][f"{region} | {status}"] += 1
        counts["regions"][f"{region} | candidates"] += len(kept)
        if any(s["outcome"] == "blocked" for s in searches):
            counts["regions"][f"{region} | with a blocked place"] += 1
    for file, profile in tree.profiles.items():
        if file in logs:
            continue
        if any(path.startswith("dispute_resolution") for path, _ in profile_facts(profile)):
            continue  # has a record already; the searches that found it predate the logs
        existing = LOG_FOLDER / letter(profile["id"]) / f"{profile['id']}.yaml"
        if existing.exists() and "not-searched" not in existing.read_text(encoding="utf-8"):
            continue
        logs[file] = {"profile": file, "topic": "dispute-resolution", "status": "not-searched", "searches": [],
                      "next_steps": "Not searched in the Nov. 22, 2026 coverage search, which covered federally recognized "
                                    "nations only. Start with the group's own website and the state's recognition records."}
        counts["other"]["not-searched"] += 1
    for file, log in logs.items():
        nation = pathlib.PurePosixPath(file).stem
        out = LOG_FOLDER / letter(nation) / f"{nation}.yaml"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(yaml.dump(log, sort_keys=False, allow_unicode=True, width=100), encoding="utf-8")
    pathlib.Path(REVIEW + ".json").write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    with open(REVIEW + ".csv", "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    summary = {name: dict(sorted(c.items())) for name, c in counts.items()}
    summary["candidates"] = len(rows)
    summary["candidates_by_origin"] = dict(sorted(collections.Counter(r["origin"] for r in rows).items()))
    summary["candidates_by_field"] = dict(sorted(collections.Counter(str(r["field"]) for r in rows).items()))
    summary["second_verdicts"] = dict(sorted(collections.Counter(str(r["second_verdict"]) for r in rows).items()))
    pathlib.Path(REVIEW + "-counts.json").write_text(json.dumps(summary, indent=1) + "\n", encoding="utf-8")
    print(len(rows), "candidates;", len(logs), "logs")


def next_steps(failed, status):
    if status == "found":
        return "Lead author's review of the candidates (Gate 1) before any record goes into the profile."
    if failed:
        return ("Open by hand in a browser, or ask the nation's office for: " + "; ".join(sorted(set(failed))[:6]) + ".")
    return ("Ask the nation's court or government office whether it has a peacemaking, mediation or other dispute "
            "resolution program, and check law library holdings of its code.")


def letter(name):
    return name[0] if "a" <= name[0] <= "z" else "_other"


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("step", choices=["gather", "batches", "second", "merge"])
    parser.add_argument("--work", required=True, help="private work folder, outside the repository")
    parser.add_argument("--region", action="append", help="only nations in this Bureau of Indian Affairs region")
    parser.add_argument("--nation", action="append", help="only this profile id")
    parser.add_argument("--threads", type=int, default=16)
    arguments = parser.parse_args()
    {"gather": gather, "batches": batches, "second": second, "merge": merge}[arguments.step](arguments)


if __name__ == "__main__":
    main()
