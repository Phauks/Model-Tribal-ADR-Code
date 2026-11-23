"""Find and check the places a reader can read each case and law the site cites.

Reads every case, statute and regulation source record in content/sources/,
works out its citation (a reporter citation such as 436 U.S. 49, a U.S. Code
section, a Statutes at Large page, a public law number or a C.F.R. section or
part), builds a link for each site in research/reading-links/sites.yaml that
serves that kind of citation, and checks the link before keeping it:

- a site checked with "get" must answer 200 after redirects;
- a link service or a subscription site checked with "redirect" must answer
  with a redirect (Westlaw and Lexis send a reader without an account to sign
  in, so a redirect is all that can be checked);
- eCFR, the Library of Congress, Oyez and Wikipedia are checked through their
  own data services ("api"). A Wikipedia article is kept only when it gives
  the same citation, so a namesake is never linked;
- a site that turns away automated checks ("none": Justia, Google Scholar) is
  kept only because its address pattern is the site's own stable one, and is
  marked unchecked in the record.

It writes research/reviews/<date>-reading-links.csv (every link tried and what
the check found) and, with --apply, a `reading_links` block in each record,
placed before `rights:` and replacing an older one. The website shows the
block's links beside the citation (site/src/lib/reading-links.ts).

Run by hand, never in continuous integration. Re-run it when case or law
records are added, or every few months to catch moved pages:

    python3 scripts/caselaw/reading_links.py --apply

Requests go one at a time with a pause per site; a full run takes about
twenty minutes.
"""

from __future__ import annotations

import argparse
import csv
import datetime
import json
import re
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from caselaw_sources import record_citations  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "content" / "sources"
SETTINGS = ROOT / "research" / "reading-links" / "sites.yaml"
REVIEWS = ROOT / "research" / "reviews"
REPORT_NAME = "reading-links.csv"
USER_AGENT = "Mozilla/5.0 (compatible; model-tribal-adr-code link checker)"
PAUSE = 1.0
CASE_KINDS = {"federal-case", "state-case", "territorial-case"}
LAW_KINDS = {"federal-statute", "federal-regulation", "state-statute"}

last_request: dict[str, float] = {}


# ---------------------------------------------------------------- requests

def polite(url: str) -> None:
    host = urllib.parse.urlsplit(url).hostname or ""
    wait = last_request.get(host, 0) + PAUSE - time.monotonic()
    if wait > 0:
        time.sleep(wait)
    last_request[host] = time.monotonic()


def status_of(url: str, follow: bool) -> tuple[int, str]:
    """The HTTP status (after redirects when follow) and the redirect target, if any."""
    polite(url)
    command = ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code} %{redirect_url}", "-A", USER_AGENT, "--max-time", "30"]
    if follow:
        command.append("-L")
    result = subprocess.run([*command, url], capture_output=True, text=True)
    code, _, target = result.stdout.partition(" ")
    return (int(code) if code.isdigit() else 0), target.strip()


def get_json(url: str):
    polite(url)
    result = subprocess.run(["curl", "-sfL", "-A", USER_AGENT, "--max-time", "60", url], capture_output=True)
    if result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None


# ---------------------------------------------------------------- citations

def first(pattern: str, *texts: str, flags: int = 0) -> re.Match | None:
    for text in texts:
        match = re.search(pattern, text or "", flags)
        if match:
            return match
    return None


def year_of(citation: dict) -> int | None:
    parts = (citation.get("issued") or {}).get("date-parts") or [[None]]
    return parts[0][0] if parts and parts[0] else None


def identify(record: dict) -> dict:
    """What a record cites, as the placeholders of sites.yaml need it, and which kinds of link fit it."""
    citation = record.get("citation") or {}
    kind = record.get("kind")
    texts = [str(citation.get(field) or "") for field in ("number", "container-title", "title", "section")]
    texts.append(record.get("notes") or "")
    link = record.get("original_link") or citation.get("URL") or ""
    found: dict = {"kinds": set(), "year": year_of(citation), "name": str(citation.get("title") or "")}

    if kind in CASE_KINDS and citation.get("type") == "legal_case":
        cites = record_citations(record)
        if cites:
            volume, reporter, page = cites[0]
            found.update(volume=volume, reporter=reporter, page=page, cite=f"{volume} {reporter} {page}")
            found["kinds"].add("case")
        us = next((cite for cite in cites if cite[1] == "U.S."), None)
        authority = str(citation.get("authority") or "")
        if us or authority == "Supreme Court of the United States":
            found["kinds"].add("supreme-court")
        if us:
            found.update(volume=us[0], reporter="U.S.", page=us[2], cite=f"{us[0]} U.S. {us[2]}")
            found["kinds"].add("us-reports")
        docket = first(r"\b(\d{1,2}-\d{1,5}|\d+ Orig\.)", str(citation.get("number") or ""))
        lii = re.search(r"law\.cornell\.edu/supremecourt/text/(\d{1,2}-\d{1,5})", link)
        if docket or lii:
            found["docket"] = (docket or lii).group(1)
        return found

    if kind == "federal-statute":
        container = str(citation.get("container-title") or "")
        if container == "United States Code" and citation.get("volume") and citation.get("section"):
            section = re.search(r"(\d+[A-Za-z0-9-]*)", str(citation["section"]))
            if section:
                found.update(title=str(citation["volume"]), section=section.group(1))
        else:
            usc = first(r"\b(\d{1,2}) U\.S\.C\. §+ ?(\d+[A-Za-z0-9-]*)", *texts)
            if usc and re.match(r"^\d{1,2} U\.S\.C\.", found["name"]):
                found.update(title=usc.group(1), section=usc.group(2))
        if "section" in found:
            found["kinds"].add("usc")
            found["cite"] = f"{found['title']} U.S.C. § {found['section']}"
        if "Statutes at Large" in container and citation.get("volume") and citation.get("page"):
            found.update(volume=str(citation["volume"]), page=str(citation["page"]))
        else:
            statute = first(r"\b(\d{1,3}) Stat\. (\d+)", *texts) or first(r"link/statute/(\d+)/(\d+)|STATUTE-(\d+)/pdf/STATUTE-\d+-Pg(\d+)", link)
            if statute:
                groups = [group for group in statute.groups() if group]
                found.update(volume=groups[0], page=groups[1])
        if found.get("page") and str(found["page"]).isdigit():
            found["kinds"].add("statute")
            found.setdefault("cite", f"{found['volume']} Stat. {found['page']}")
        public_law = first(r"\bPub(?:lic)?\.? ?L(?:aw)?\.?(?: No\.)? ?(\d{2,3})[-–](\d{1,3})\b", *texts) or first(r"PLAW-(\d+)publ(\d+)|plaw/(\d+)/public/(\d+)", link)
        if public_law:
            groups = [group for group in public_law.groups() if group]
            found.update(congress=groups[0], law=groups[1])
            found["kinds"].add("public-law")
        return found

    if kind == "federal-regulation":
        title = str(citation.get("volume") or "")
        section = str(citation.get("section") or "")
        whole = first(r"(\d+)\.(\d+[a-z]?)", section)
        part = first(r"(?:pt\.|part)\s*(\d+)", section, flags=re.I)
        from_link = re.search(r"title-(\d+)/(?:.*/)?(?:section-(\d+)\.(\d+)|part-(\d+))", link) or re.search(r"cfr/text/(\d+)/(?:part-(\d+)|(\d+)\.(\d+))", link)
        if not title and from_link:
            title = from_link.group(1)
        if title and whole:
            found.update(title=title, part=whole.group(1), section=whole.group(2), cite=f"{title} C.F.R. § {whole.group(1)}.{whole.group(2)}")
            found["kinds"].add("cfr-section")
        elif title and part:
            found.update(title=title, part=part.group(1))
            found["kinds"].add("cfr-part")
        return found

    if kind == "state-statute":
        cite = first(r"^((?:[A-Z][\w.'()]*\s)+(?:Code|Stat\.|Statutes|Laws|Gen\. Laws|Comp\. Laws)(?: Ann\.)?(?: tit\. \d+,)? §+ ?[\w.:-]+[\w])", found["name"])
        if cite:
            found["cite"] = cite.group(1)
            found["kinds"].add("state-statute")
    return found


def fill(template: str, found: dict) -> str | None:
    values = {key: urllib.parse.quote(str(value), safe="") if key == "cite" else str(value) for key, value in found.items() if not isinstance(value, set)}
    if found.get("volume") and found.get("page") and str(found["page"]).isdigit():
        values["volume3"] = f"{int(found['volume']):03d}"
        values["page3"] = f"{int(found['page']):03d}"
    try:
        return template.format(**values)
    except (KeyError, ValueError):
        return None


# ---------------------------------------------------------------- the sites' own data services

oyez_terms: dict[int, list] = {}


def oyez_link(found: dict) -> str | None:
    year = found.get("year")
    if not year:
        return None
    for term in (year - 1, year, year - 2):
        if term not in oyez_terms:
            oyez_terms[term] = get_json(f"https://api.oyez.org/cases?per_page=0&filter=term:{term}") or []
        for case in oyez_terms[term]:
            cited = case.get("citation") or {}
            same_cite = found.get("reporter") == "U.S." and str(cited.get("volume")) == found.get("volume") and str(cited.get("page")) == found.get("page")
            same_docket = found.get("docket") and case.get("docket_number") == found["docket"]
            if same_cite or same_docket:
                return f"https://www.oyez.org/cases/{case['term']}/{case['docket_number']}"
    return None


def ecfr_exists(found: dict) -> bool:
    query = f"section={found['part']}.{found['section']}" if "section" in found else f"part={found['part']}"
    code, _ = status_of(f"https://www.ecfr.gov/api/versioner/v1/ancestry/current/title-{found['title']}.json?{query}", follow=True)
    return code == 200


def library_of_congress_exists(link: str) -> bool:
    data = get_json(f"{link}?fo=json")
    return bool(data and data.get("item"))


def wikipedia_articles(wanted: dict[str, dict]) -> dict[str, str]:
    """record key -> article link, for articles that give the record's citation."""
    by_title: dict[str, list[str]] = {}
    for key, found in wanted.items():
        title = re.sub(r",\s*\d+ [A-Z].*$", "", found["name"])
        title = re.sub(r"\s*\(.*?\)\s*$", "", title).strip()
        if title and len(title) < 120 and "§" not in title and not re.match(r"^\d", title):
            by_title.setdefault(title, []).append(key)
    articles: dict[str, str] = {}
    for title, keys in by_title.items():
        page = wikipedia_page(title)
        if not page:
            continue
        text = re.sub(r"\s+", " ", page["text"])
        if re.search(r"\{\{\s*disambiguation", text, re.I):
            continue
        for key in keys:
            if gives_citation(text, wanted[key]):
                articles[key] = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(page["title"].replace(" ", "_"), safe="():,'_-.")
    return articles


def wikipedia_page(title: str) -> dict | None:
    """The article with this title (after redirects) and its wikitext, asking again after a pause if Wikipedia is busy."""
    query = urllib.parse.urlencode({
        "action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main", "format": "json",
        "formatversion": "2", "redirects": "1", "titles": title})
    for attempt in range(4):
        data = get_json(f"https://en.wikipedia.org/w/api.php?{query}")
        if data is not None:
            pages = (data.get("query") or {}).get("pages") or []
            page = pages[0] if pages else {}
            if page.get("missing") or not page.get("revisions"):
                return None
            return {"title": page["title"], "text": page["revisions"][0]["slots"]["main"]["content"]}
        time.sleep(5 * (attempt + 1))
    print(f"Wikipedia did not answer for {title}", file=sys.stderr)
    return None


def gives_citation(text: str, found: dict) -> bool:
    """True when the article's text carries the record's own citation."""
    volume, page = found.get("volume"), found.get("page")
    if found.get("reporter") == "U.S.":
        infobox = re.search(rf"USVol\s*=\s*{volume}\b", text) and re.search(rf"USPage\s*=\s*{page}\b", text)
        return bool(infobox or f"{volume} U.S. {page}" in text)
    if found.get("reporter"):
        return f"{volume} {found['reporter']} {page}" in text
    if found.get("congress"):
        if re.search(rf"\b{found['congress']}\s*[-–]\s*{found['law']}\b", text) and re.search(r"Pub(lic)?\.?\s*L", text):
            return True
    if volume and page:
        return bool(re.search(rf"\b{volume}\s*Stat\.\s*{page}\b", text))
    return False


# ---------------------------------------------------------------- one record

def links_for(record: dict, found: dict, sites: dict, wikipedia: dict[str, str], log) -> list[dict]:
    kept: list[dict] = []
    original = (record.get("original_link") or "").rstrip("/")

    def keep(site: str, settings: dict, link: str | None, status: str) -> None:
        if not link:
            return
        log(record["key"], site, link, status)
        if status not in ("ok", "unchecked") or link.rstrip("/") == original:
            return
        entry = {"site": site, "label": settings.get("short", settings["label"]), "access": settings["access"], "link": link}
        if status == "unchecked":
            entry["unchecked"] = True
        kept.append(entry)

    for site, settings in sites.items():
        kinds = [kind for kind in settings["for"] if kind in found["kinds"]]
        if not kinds:
            continue
        templates = settings.get("links") or {}
        if site == "supremecourt":
            link = (record.get("supreme_court") or {}).get("source")
            if link and urllib.parse.urlsplit(link).hostname in ("www.supremecourt.gov", "supremecourt.gov"):
                code, _ = status_of(link, follow=True)
                keep(site, settings, link, "ok" if code == 200 else f"failed {code}")
        elif site == "courtlistener":
            keep(site, settings, (record.get("courtlistener") or {}).get("link"), "ok")
        elif site == "oyez":
            keep(site, settings, oyez_link(found), "ok")
        elif site == "wikipedia":
            keep(site, settings, wikipedia.get(record["key"]), "ok")
        elif site == "cornell" and "supreme-court" in kinds:
            for template in (templates.get("supreme-court"), templates.get("supreme-court-docket")):
                link = fill(template, found) if template else None
                if not link:
                    continue
                code, _ = status_of(link, follow=True)
                if code == 200:
                    keep(site, settings, link, "ok")
                    break
                log(record["key"], site, link, f"failed {code}")
        else:
            template_key = next((kind for kind in kinds if kind in templates), "any" if "any" in templates else None)
            if site in ("westlaw", "lexis") and not found.get("cite"):
                continue
            link = fill(templates[template_key], found) if template_key else None
            if not link:
                continue
            if template_key == "public-law" and int(found["congress"]) < 104:
                continue
            check = settings["check"]
            if check == "none":
                keep(site, settings, link, "unchecked")
            elif site == "ecfr":
                keep(site, settings, link, "ok" if ecfr_exists(found) else "not found")
            elif site == "library-of-congress":
                keep(site, settings, link, "ok" if library_of_congress_exists(link) else "not found")
            elif check == "redirect":
                code, target = status_of(link, follow=False)
                keep(site, settings, link, "ok" if code in (301, 302, 303, 307, 308) and target else f"failed {code}")
            else:
                code, _ = status_of(link, follow=True)
                keep(site, settings, link, "ok" if code == 200 else f"failed {code}")
    return kept


def block_yaml(links: list[dict], checked: str) -> str:
    lines = ["reading_links:", f"  checked: '{checked}'", "  links:"]
    for entry in links:
        lines.append(f"  - site: {entry['site']}")
        lines.append(f"    label: {json.dumps(entry['label'], ensure_ascii=False)}")
        lines.append(f"    access: {entry['access']}")
        lines.append(f"    link: {entry['link']}")
        if entry.get("unchecked"):
            lines.append("    unchecked: true")
    return "\n".join(lines) + "\n"


def write_block(path: Path, links: list[dict], checked: str) -> None:
    """Put the reading_links block before `rights:`, replacing an older one, or remove it when no link is left."""
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"(?m)^reading_links:\n(?:  .*\n)*", "", text)
    if links:
        block = block_yaml(links, checked)
        if "\nrights:\n" in text:
            text = text.replace("\nrights:\n", "\n" + block + "rights:\n", 1)
        else:
            text = text.rstrip("\n") + "\n" + block
    path.write_text(text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--apply", action="store_true", help="write a reading_links block into each record")
    parser.add_argument("--only", nargs="*", help="check only these record keys")
    arguments = parser.parse_args()

    sites = yaml.safe_load(SETTINGS.read_text(encoding="utf-8"))["sites"]
    records = []
    for path in sorted(SOURCES.glob("*/*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if record.get("kind") not in CASE_KINDS | LAW_KINDS:
            continue
        if arguments.only and record["key"] not in arguments.only:
            continue
        found = identify(record)
        if found["kinds"]:
            records.append((path, record, found))

    today = datetime.date.today().isoformat()
    REVIEWS.mkdir(parents=True, exist_ok=True)
    report = REVIEWS / f"{today}-{REPORT_NAME}"
    rows: list[dict] = []

    def log(key: str, site: str, link: str, status: str) -> None:
        rows.append({"key": key, "site": site, "link": link, "status": status})

    wanted = {record["key"]: found for _, record, found in records if found["kinds"] & {"case", "statute", "public-law"}}
    wikipedia = wikipedia_articles(wanted)
    written = 0
    for number, (path, record, found) in enumerate(records, 1):
        links = links_for(record, found, sites, wikipedia, log)
        if arguments.apply:
            write_block(path, links, today)
            written += 1
        if number % 25 == 0:
            print(f"{number} of {len(records)} records", file=sys.stderr)

    with report.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["key", "site", "link", "status"])
        writer.writeheader()
        writer.writerows(rows)
    shown = sum(1 for row in rows if row["status"] in ("ok", "unchecked"))
    print(f"{len(records)} records, {len(rows)} links tried, {shown} kept; report {report.relative_to(ROOT)}", file=sys.stderr)
    if arguments.apply:
        print(f"wrote {written} records", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
