"""Connecticut: the General Statutes of Connecticut, read from the General Assembly's chapter pages for the revision of Jan. 1, 2025
(cga.ct.gov/current/pub/chap_<n>.htm), each section replaced or joined by its text in the 2026 Supplement (cga.ct.gov/2026/sup), which
prints only the sections changed or added in 2025. Each record links to the section's anchor on the page it was read from.

The site's certificate is sent without its issuer (Go Daddy Secure Certificate Authority - G2), so fetch() downloads that intermediate
certificate from Go Daddy's repository and adds it to the trusted set, as a browser does."""
from __future__ import annotations

import html
import json
import re
import ssl
import time
import urllib.request
from pathlib import Path
from typing import Iterator

import adapters.base as base
from adapters.base import State
from core import Section, clean

SITE = 'https://www.cga.ct.gov'
BASE, SUPPLEMENT = '/current/pub/', '/2026/sup/'
INTERMEDIATE = 'https://certs.godaddy.com/repository/gdig2.crt.pem'
SECTION = re.compile(r'<span class="catchln" id="(secs?_[^"]+)">(.*?)</span>(.*?)(?=<table class="nav_tbl"|<span class="catchln"|<hr class="chaps_pg_bar"|$)', re.S)
# "(P.A. 73-660, S. 1, 2; ...)" or "(1949 Rev., S. 7168; ...)": the session law at the head of the source note is the enactment.
LAW = re.compile(r'^\(?\s*(?:(\d{4}), )?P\.A\. (?:(\d{2})-)?(\d+)')
GONE = re.compile(r'^\s*(?:Sections? .*? (?:is|are) repealed|Transferred|Repealed|Reserved|Expired)\b', re.I)


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


def year_of(two: str) -> int:
    value = int(two)
    return 1900 + value if value >= 50 else 2000 + value


class Connecticut(State):
    STATE = 'CT'
    NAME = 'Connecticut'
    CODE_NAME = 'General Statutes of Connecticut'
    CODE_SHORT = 'Conn. Gen. Stat.'
    AUTHOR = 'Connecticut General Assembly'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'connecticut-general-statutes'
    SOURCE_NOTE = "Text read from the Connecticut General Assembly's chapter page for the section in the General Statutes of Connecticut, revised to Jan. 1, 2025, or in its 2026 Supplement (cga.ct.gov), on Nov. 27, 2026."
    NATION_NAMES = ('Mashantucket', 'Pequot', 'Mohegan', 'Schaghticoke', 'Paugussett', 'Golden Hill', 'Paucatuck', 'Nipmuc', 'Quinnipiac', 'Mohican')
    PLACE_NAMES = ('Pequot Avenue', 'Pequot River', 'Mohegan Avenue', 'Mohegan-Pequot Bridge', 'Mohegan Pequot Bridge', 'Quinnipiac University',
                   'Quinnipiac River', 'Quinnipiac Valley', 'Quinnipiack Valley', 'Quinnipiac College', 'Pequotsepos', 'Indian Neck', 'Indian River',
                   'Indian Hill', 'Indian Well', 'Indian Lake', 'Indian Field', 'Golden Hill Road', 'Golden Hill Street')
    WORKERS = 4

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        pem = raw / 'gdig2.crt.pem'
        if not pem.exists():
            pem.write_bytes(self.get(INTERMEDIATE))
        context = ssl.create_default_context()
        context.load_verify_locations(cadata=pem.read_text())
        opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=context), urllib.request.ProxyHandler())

        def get(url, tries=4, timeout=90):
            for attempt in range(tries):
                try:
                    return opener.open(urllib.request.Request(url, headers={'User-Agent': base.USER_AGENT}), timeout=timeout).read()
                except urllib.error.HTTPError as error:
                    if error.code in (403, 404, 410) or attempt == tries - 1:
                        raise
                except Exception:
                    if attempt == tries - 1:
                        raise
                time.sleep(2 * (attempt + 1))

        self.get = get  # download_all uses self.get
        listing = raw / 'chapters.json'
        if not listing.exists():
            rows = []
            for edition in (BASE, SUPPLEMENT):
                titles = list(dict.fromkeys(re.findall(r'href="(title_[0-9a-z]+\.htm)"', get(SITE + edition + 'titles.htm').decode('utf-8', 'replace'))))
                for title in titles:
                    page = get(SITE + edition + title).decode('utf-8', 'replace')
                    name = re.search(r'<title>(.*?)</title>', page, re.S)
                    for chapter in dict.fromkeys(re.findall(r'href="(chap_[0-9a-z]+\.htm)"', page)):
                        rows.append({'edition': edition, 'title': title[6:-4], 'title_name': text_of(name.group(1)) if name else '', 'chapter': chapter[5:-4]})
            listing.write_text(json.dumps(rows))
            print(f'CT: {sum(r["edition"] == BASE for r in rows)} chapters, {sum(r["edition"] == SUPPLEMENT for r in rows)} in the supplement')
        rows = json.loads(listing.read_text())
        failed = self.download_all((f"{SITE}{row['edition']}chap_{row['chapter']}.htm", raw / row['edition'].strip('/').replace('/', '-') / f"chap_{row['chapter']}.htm")
                                   for row in rows)
        print(f'CT: {len(rows)} chapter pages, {len(failed)} failed', *failed[:10])

    def sections_of(self, path: Path, url: str, row: dict) -> list[Section]:
        page = path.read_text(errors='replace')
        name = re.search(r'<title>(.*?)</title>', page, re.S)
        chapter_name = text_of(name.group(1)) if name else f"Chapter {row['chapter']}"
        out = []
        for anchor, head, body in SECTION.findall(page):
            head_text = text_of(head)
            match = re.match(r'^Secs?\.\s*(.+?)\.\s*(.*)$', head_text)
            if not match:
                continue
            numbers, heading = match.group(1), match.group(2)
            # Editorial prefixes printed before some catchlines: "*(See end of section for ...)." and "(Formerly Sec. 17-314a).".
            heading = re.sub(r'^(?:\*?\((?:See|Note)\b.*?\.\)\s*|\(Formerly [^)]*\)\.?\s*)+', '', heading)
            number = numbers.split(' and ')[0].split(' to ')[0].split(', ')[0].strip() if anchor.startswith('secs_') else anchor[4:]
            # The source note is the first "source" paragraph; history, annotations and cross references follow and are left out.
            source = re.search(r'<p class="source(?:-first)?">(.*?)</p>', body, re.S)
            history = text_of(source.group(1)).strip('()') if source else ''
            body = re.split(r'<p class="(?:source|source-first|history|history-first|annotation|annotation-first|cross-ref|cross-ref-first)"', body)[0]
            text = text_of(body)
            status = 'live'
            if anchor.startswith('secs_') or GONE.match(text) and len(text) < 400 or GONE.match(heading):
                status = 'repealed'
            elif not text:
                status = 'reserved'
            law = LAW.match(history.split(';')[0].strip())
            enacted = None
            act = ''
            if law:
                year = int(law.group(1)) if law.group(1) else year_of(law.group(2)) if law.group(2) else None
                if year:
                    act, enacted = f'{year}-{law.group(3)}', [year]
            out.append(Section(number=number, heading=heading.rstrip('.').strip(), text=text, history=history, status=status, url=f'{url}#{anchor}',
                               title=row['chapter'], title_name=f"{row['title_name']} / {chapter_name}", act=act, enacted=enacted))
        return out

    def parse(self, raw: Path) -> Iterator[Section]:
        rows = json.loads((raw / 'chapters.json').read_text())
        supplement = {}
        for row in rows:
            if row['edition'] != SUPPLEMENT:
                continue
            path = raw / '2026-sup' / f"chap_{row['chapter']}.htm"
            if path.exists():
                for section in self.sections_of(path, f"{SITE}{SUPPLEMENT}chap_{row['chapter']}.htm", row):
                    supplement.setdefault(section.number, section)
        seen = set()
        for row in rows:
            if row['edition'] != BASE:
                continue
            path = raw / 'current-pub' / f"chap_{row['chapter']}.htm"
            if not path.exists():
                raise SystemExit(f"CT chapter {row['chapter']} was not downloaded: run fetch again")
            for section in self.sections_of(path, f"{SITE}{BASE}chap_{row['chapter']}.htm", row):
                if section.number in seen:
                    continue
                seen.add(section.number)
                yield supplement.pop(section.number, section)
        for number, section in supplement.items():  # sections the 2026 Supplement adds
            if number not in seen:
                seen.add(number)
                yield section


ADAPTER = Connecticut()
