"""Fetch the pages needed to check whether each court listed from a directory
still operates (row 11 of the dataset gap audit,
research/analyses/2026-11-21-dataset-gap-audit.md).

    python3 scripts/review/court_listings.py gather OUTPUT.json

Covers `justice_institutions` facts cited to the Tribal Law and Policy
Institute directory (2022) or a National Indian Law Library nation page. For
each, fetches the listing's own link and the nation's official website (its
`contacts` entry of kind `website`), plus up to two pages that website links
to whose link text or address mentions a court, judiciary, justice,
peacemaking or a judge, and keeps short passages around those words.
Reviewers read the output; their verdicts are merged into research/reviews/
by scripts/review/gap_review.py. Never writes to a profile.
"""

import concurrent.futures
import hashlib
import json
import pathlib
import re
import sys
import urllib.parse

import requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import record_facts  # noqa: E402

DIRECTORY_SOURCES = ("tribal-law-policy-institute-justice-systems",)
DIRECTORY_PREFIXES = ("national-indian-law-library-",)
COURT_WORDS = re.compile(r"court|judicia|justice|peacemak|judge", re.IGNORECASE)
HEADERS = {"User-Agent": "Mozilla/5.0 (research link check)"}
_cache = {}


def listings(tree):
    found = []
    for file, profile in tree.profiles.items():
        sites = [c["value"] for c in profile.get("contacts") or [] if c.get("kind") == "website"]
        for number, (path, fact) in enumerate(record_facts.profile_facts(profile)):
            source = fact["source"]
            if not path.startswith("justice_institutions"):
                continue
            if source not in DIRECTORY_SOURCES and not source.startswith(DIRECTORY_PREFIXES):
                continue
            identity = record_facts.fact_identity(path, fact)
            found.append({"profile": file, "fact_number": number,
                          "fingerprint": hashlib.sha256(identity.encode()).hexdigest()[:16],
                          "nation": profile["names"]["official"], "source": source, "kind": fact.get("kind"),
                          "name": fact.get("name"), "link": fact.get("link"), "as_of": str(fact.get("as_of")),
                          "nation_sites": sites})
    return found


def fetch(url):
    if url not in _cache:
        try:
            response = requests.get(url, headers=HEADERS, timeout=25, allow_redirects=True)
            html = response.text if "html" in response.headers.get("content-type", "") else ""
            _cache[url] = {"status": response.status_code, "final": response.url, "html": html}
        except requests.RequestException as error:
            _cache[url] = {"status": None, "error": type(error).__name__, "html": ""}
    return _cache[url]


def read(page):
    if not page.get("html"):
        return "", [], None
    soup = BeautifulSoup(page["html"], "html.parser")
    title = soup.title.get_text(strip=True)[:120] if soup.title else None
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    links = [(a.get_text(" ", strip=True)[:80], urllib.parse.urljoin(page["final"], a["href"]))
             for a in soup.find_all("a", href=True)
             if COURT_WORDS.search(a.get_text(" ", strip=True)) or COURT_WORDS.search(a["href"])]
    return re.sub(r"\s+", " ", soup.get_text(" ")), links, title


def passages(text, limit=4, width=350):
    found, last = [], -10 ** 9
    for match in COURT_WORDS.finditer(text):
        if match.start() >= last + width:
            found.append(text[max(0, match.start() - 150):match.start() + width])
            last = match.start()
            if len(found) >= limit:
                break
    return found


def check(item):
    pages, tried = [], []
    for url in ([item["link"]] if item["link"] else []) + item["nation_sites"][:1]:
        if url in tried:
            continue
        tried.append(url)
        page = fetch(url)
        text, links, title = read(page)
        pages.append({"url": url, "status": page.get("status"), "final": page.get("final"),
                      "error": page.get("error"), "title": title, "court_snippets": passages(text),
                      "court_links": links[:12]})
        if url != item["link"]:
            for _, linked in links[:2]:
                if linked in tried or not linked.startswith("http"):
                    continue
                tried.append(linked)
                second = fetch(linked)
                text, _, _ = read(second)
                pages.append({"url": linked, "via": url, "status": second.get("status"),
                              "final": second.get("final"), "error": second.get("error"),
                              "court_snippets": passages(text)})
    item["pages"] = pages
    return item


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] != "gather":
        sys.exit(__doc__)
    with concurrent.futures.ThreadPoolExecutor(16) as pool:
        checked = list(pool.map(check, listings(record_facts.Tree("."))))
    pathlib.Path(sys.argv[2]).write_text(json.dumps(checked, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(checked)} directory court listings checked")
