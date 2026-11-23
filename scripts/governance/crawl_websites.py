#!/usr/bin/env python3
"""Fetch the government pages of each nation's own website, for the governance readers.

Second pass of decision record 0042: for nations whose governance facts came
only from an old library copy of a constitution, or from the federal directory,
or are missing, look at the nation's own website. From the home page listed in
the profile's `contacts` (kind `website`), follow links whose address or words
name the government, the council, the constitution, the officers, elections or
the courts, one more level down from the best of those, and save each page as
plain text for the readers in scripts/governance/website-brief.md.

Pages are fetched politely: one request at a time per site, a pause between
requests, a short time limit, and at most PAGE_LIMIT pages per nation. Nothing is
sent but a plain GET with a generic user agent.

Usage, from the repository root:

  python3 scripts/governance/crawl_websites.py TARGETS.json OUTPUT_FOLDER [--workers 6]

A site that refuses the request or answers with a "checking your browser"
page is left as it is and logged as blocked; the crawler does not try to get
past such checks.

TARGETS.json is a list of {id, name, sites} rows (see the session record for
how it was built). OUTPUT_FOLDER/<id>/ gets the raw files, a .txt for each and
manifest.json listing each page: link, final link, title, media type, SHA-256,
file names and the score that chose it. A nation already holding a manifest is
skipped, so an interrupted run can be continued.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse, urldefrag

import requests
from bs4 import BeautifulSoup

USER_AGENT = 'Mozilla/5.0 (compatible; research reader; +plain GET only)'
TIME_LIMIT = 20
PAUSE = 1.0
PAGE_LIMIT = 10
SIZE_LIMIT = 20_000_000

# Words that mark a link as likely to lead to how the government is set up.
STRONG = re.compile(r'constitution|by-?laws|governing[ -]?doc|articles[ -]of[ -](association|organization)|charter', re.I)
GOVERNMENT = re.compile(
    r'government|governance|tribal[ -]?council|business[ -]?committee|executive[ -]?committee|general[ -]?council|'
    r'council|leadership|elected|officials|officers|chairman|chairperson|chairwoman|president|chief|'
    r'election|legislat|executive|judicial|judiciary|tribal[ -]?court|court|branches|administration|about[ -]?us|about|history|board',
    re.I,
)
SKIP = re.compile(
    r'\.(jpe?g|png|gif|svg|webp|mp4|mp3|zip|docx?|xlsx?|pptx?)(\?|$)|facebook|twitter|instagram|youtube|linkedin|'
    r'mailto:|tel:|javascript:|/wp-login|/cart|/shop|calendar|/events?/|/news/|/jobs?|employment|career|casino|resort|hotel|golf',
    re.I,
)


def score(link: str, words: str) -> int:
    text = f'{link} {words}'
    total = 0
    if STRONG.search(text):
        total += 10
    if GOVERNMENT.search(words):
        total += 4
    if GOVERNMENT.search(urlparse(link).path):
        total += 3
    if re.search(r'council|government|governance|constitution', text, re.I):
        total += 2
    return total


def same_site(home: str, link: str) -> bool:
    a = urlparse(home).netloc.lower().removeprefix('www.')
    b = urlparse(link).netloc.lower().removeprefix('www.')
    return bool(b) and (a == b or b.endswith('.' + a) or a.endswith('.' + b))


def page_text(raw: bytes, media: str, path: Path) -> tuple[str, str]:
    """Return (title, plain text) for an HTML page or a PDF."""
    if 'pdf' in media or raw[:5] == b'%PDF-':
        result = subprocess.run(['pdftotext', '-layout', str(path), '-'], capture_output=True, timeout=120)
        return '', result.stdout.decode('utf-8', 'replace')
    soup = BeautifulSoup(raw, 'html.parser')
    title = (soup.title.string or '').strip() if soup.title and soup.title.string else ''
    for tag in soup(['script', 'style', 'noscript', 'svg', 'form', 'iframe']):
        tag.decompose()
    for tag in soup.find_all(['nav', 'footer']):
        tag.decompose()
    text = soup.get_text('\n')
    lines = [re.sub(r'[ \t ]+', ' ', line).strip() for line in text.splitlines()]
    return title, '\n'.join(line for line in lines if line)


def links_of(raw: bytes, base: str) -> list[tuple[str, str]]:
    soup = BeautifulSoup(raw, 'html.parser')
    found = []
    for anchor in soup.find_all('a', href=True):
        link = urldefrag(urljoin(base, anchor['href'].strip()))[0]
        if not link.startswith('http') or SKIP.search(link):
            continue
        words = ' '.join(anchor.get_text(' ').split())[:120]
        found.append((link, words))
    return found


def fetch(session: requests.Session, link: str) -> requests.Response | None:
    try:
        response = session.get(link, timeout=TIME_LIMIT, stream=True, allow_redirects=True)
        body = b''
        for chunk in response.iter_content(65536):
            body += chunk
            if len(body) > SIZE_LIMIT:
                return None
        response._content = body
        return response
    except (requests.RequestException, UnicodeError):
        return None
    finally:
        time.sleep(PAUSE)


def crawl(target: dict, output: Path) -> dict:
    folder = output / target['id']
    manifest_path = folder / 'manifest.json'
    if manifest_path.exists():
        return json.loads(manifest_path.read_text())
    folder.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers['User-Agent'] = USER_AGENT
    pages: list[dict] = []
    seen: set[str] = set()
    failures: list[dict] = []

    def keep(link: str, chosen_by: int, depth: int) -> bytes | None:
        if link in seen or len(pages) >= PAGE_LIMIT:
            return None
        seen.add(link)
        response = fetch(session, link)
        if response is None or response.status_code >= 400:
            failures.append({'link': link, 'status': getattr(response, 'status_code', None)})
            return None
        raw = response.content
        media = response.headers.get('content-type', '').split(';')[0].strip().lower()
        if response.url != link:
            seen.add(response.url)
        sha = hashlib.sha256(raw).hexdigest()
        if any(page['sha256'] == sha for page in pages):
            return None
        number = len(pages) + 1
        extension = '.pdf' if ('pdf' in media or raw[:5] == b'%PDF-') else '.html'
        raw_path = folder / f'{number:02d}{extension}'
        raw_path.write_bytes(raw)
        try:
            title, text = page_text(raw, media, raw_path)
        except Exception as error:  # a broken page should not stop the run
            title, text = '', ''
            failures.append({'link': link, 'error': str(error)[:200]})
        (folder / f'{number:02d}.txt').write_text(text)
        pages.append({
            'number': number, 'link': link, 'final_link': response.url, 'title': title, 'media_type': media or extension[1:],
            'sha256': sha, 'bytes': len(raw), 'raw': raw_path.name, 'text': f'{number:02d}.txt', 'characters': len(text),
            'score': chosen_by, 'depth': depth,
        })
        return raw if extension == '.html' else None

    for home in target['sites'][:1]:
        raw = keep(home, 0, 0)
        if raw is None and pages:
            continue
        if raw is None:
            continue
        candidates = [(score(link, words), link) for link, words in links_of(raw, pages[-1]['final_link']) if same_site(home, link)]
        candidates = sorted({(s, l) for s, l in candidates if s >= 4}, key=lambda item: -item[0])
        first = []
        for value, link in candidates[:6]:
            body = keep(link, value, 1)
            if body is not None:
                first.append((value, body, pages[-1]['final_link']))
        # One level further down from the best government pages, for council and constitution pages.
        deeper = []
        for value, body, base in sorted(first, key=lambda item: -item[0])[:3]:
            for link, words in links_of(body, base):
                if same_site(home, link) and link not in seen:
                    s = score(link, words)
                    if s >= 4:
                        deeper.append((s, link))
        for value, link in sorted(set(deeper), key=lambda item: -item[0])[:PAGE_LIMIT]:
            if len(pages) >= PAGE_LIMIT:
                break
            keep(link, value, 2)

    manifest = {'id': target['id'], 'name': target['name'], 'sites': target['sites'], 'fetched': time.strftime('%Y-%m-%d'), 'pages': pages, 'failures': failures}
    manifest_path.write_text(json.dumps(manifest, indent=1))
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('targets', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--workers', type=int, default=6)
    arguments = parser.parse_args()
    targets = [target for target in json.loads(arguments.targets.read_text()) if target.get('sites')]
    arguments.output.mkdir(parents=True, exist_ok=True)
    done = 0
    with concurrent.futures.ThreadPoolExecutor(arguments.workers) as pool:
        futures = {pool.submit(crawl, target, arguments.output): target['id'] for target in targets}
        for future in concurrent.futures.as_completed(futures):
            done += 1
            try:
                manifest = future.result()
                print(f'{done}/{len(targets)} {futures[future]}: {len(manifest["pages"])} pages', flush=True)
            except Exception as error:
                print(f'{done}/{len(targets)} {futures[future]}: error {error}', flush=True)


if __name__ == '__main__':
    sys.exit(main())
