"""For the individual courts review (research/reviews/briefs/2026-11-22-individual-courts.md):
fetch a web page and print its status, title, visible text and links.

Usage: python3 -I fetch.py URL [--find WORD ...] [--max N]

--find prints only the lines of text that contain one of the words (case
insensitive), plus every link whose text or address contains one. Pages are
cached in $COURTS_CACHE (default ../cache/) so the merge step can re-check quotes.
"""
import hashlib
import json
import os
import pathlib
import re
import sys

import requests
from bs4 import BeautifulSoup

CACHE = pathlib.Path(os.environ.get("COURTS_CACHE", pathlib.Path(__file__).resolve().parent.parent / "cache"))
CACHE.mkdir(exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    url = argv[0]
    finds, limit = [], 12000
    rest = argv[1:]
    while rest:
        flag = rest.pop(0)
        if flag == "--find":
            while rest and not rest[0].startswith("--"):
                finds.append(rest.pop(0).lower())
        elif flag == "--max":
            limit = int(rest.pop(0))
    try:
        response = requests.get(
            url,
            timeout=25,
            verify=CA if pathlib.Path(CA).exists() else True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; research link checker)"},
        )
    except Exception as error:  # noqa: BLE001
        print(f"FETCH FAILED: {type(error).__name__}: {error}")
        return 1
    print(f"STATUS {response.status_code}  FINAL URL {response.url}")
    kind = response.headers.get("content-type", "")
    if "pdf" in kind:
        print("This is a PDF; text is not extracted here.")
        return 0
    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    text = re.sub(r"\n\s*\n+", "\n", soup.get_text("\n", strip=True))
    links = []
    for anchor in soup.find_all("a", href=True):
        href = requests.compat.urljoin(response.url, anchor["href"])
        label = anchor.get_text(" ", strip=True)
        links.append((label, href))
    key = hashlib.sha1(url.encode()).hexdigest()[:16]
    (CACHE / f"{key}.json").write_text(
        json.dumps({"url": url, "final_url": response.url, "status": response.status_code, "title": title, "text": text}),
        encoding="utf-8",
    )
    print(f"TITLE {title}")
    frames = [requests.compat.urljoin(response.url, f.get("src")) for f in soup.find_all(["frame", "iframe"]) if f.get("src")]
    if frames:
        print("FRAMES " + " ".join(frames))
    if finds:
        lines = [line for line in text.split("\n") if any(word in line.lower() for word in finds)]
        print("--- MATCHING TEXT ---")
        print("\n".join(lines)[:limit])
        print("--- MATCHING LINKS ---")
        for label, href in links:
            if any(word in (label + " " + href).lower() for word in finds):
                print(f"{label} -> {href}")
    else:
        print("--- TEXT ---")
        print(text[:limit])
        print("--- LINKS ---")
        seen = set()
        for label, href in links:
            if href in seen:
                continue
            seen.add(href)
            print(f"{label} -> {href}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
