"""Idaho: the Idaho Statutes, read from the Legislature's section pages (legislature.idaho.gov/statutesrules/idstat/Title<n>/T<n>CH<m>/SECT<number>),
found by walking its title and chapter pages. Each chapter page lists its sections with their catchlines, so sections the list marks
repealed are not downloaded; only the statute part of each section page is kept."""
from __future__ import annotations

import concurrent.futures
import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://legislature.idaho.gov'
BASE = SITE + '/statutesrules/idstat/'
LAW = re.compile(r'(\d{4}), ch\. (\d+)')
GONE = re.compile(r'^\[?\s*(?:Repealed|Redesignated|Reserved|Expired|Null|Void|Obsolete|Transferred|Renumbered)\b', re.I)
SMALL = {'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with', 'upon', 'under', 'nor'}


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


def title_case(text: str) -> str:
    words = text.lower().split(' ')
    return ' '.join(word if index and word.strip('();,:.') in SMALL else re.sub(r'[a-z]', lambda m: m.group(0).upper(), word, count=1)
                    for index, word in enumerate(words))


class Idaho(State):
    STATE = 'ID'
    NAME = 'Idaho'
    CODE_NAME = 'Idaho Code'
    CODE_SHORT = 'Idaho Code'
    AUTHOR = 'Idaho Legislature'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'idaho-code'
    SOURCE_NOTE = "Text read from the Idaho Legislature's page for the section in the Idaho Statutes (legislature.idaho.gov/statutesrules/idstat) on Nov. 27, 2026."
    NATION_NAMES = ('Nez Perce Tribe', 'Nez Perce Indian', 'Coeur d\'Alene Tribe', 'Coeur d\'Alene Indian', 'Shoshone-Bannock', 'Shoshone-Paiute',
                    'Kootenai Tribe', 'Fort Hall', 'Duck Valley', 'Paiute', 'Shoshone Tribe', 'Bannock Tribe')
    PLACE_NAMES = ('Nez Perce County', 'Shoshone County', 'Bannock County', 'Kootenai County', 'Benewah County', 'Bonner County', 'city of Shoshone',
                   'City of Shoshone', 'Fort Hall Mine')
    WORKERS = 10

    def page(self, url: str) -> str:
        return self.get(url).decode('utf-8', 'replace')

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'sections.json'
        if not listing.exists():
            titles = list(dict.fromkeys(re.findall(r'href="(/statutesrules/idstat/Title[0-9A-Z]+)/?"', self.page(BASE))))
            with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
                def chapters_of(title):
                    page = self.page(SITE + title + '/')
                    name = re.search(r'<h1 class="lso-toc"><center>TITLE\s+[0-9A-Z]+\s+(.*?)</center>', page, re.S)
                    return [(SITE + href, text_of(name.group(1)) if name else '') for href in
                            dict.fromkeys(re.findall(r'href="(' + re.escape(title) + r'/T[0-9A-Z]+CH[0-9A-Z]+)/?"', page))]
                chapters = [item for found in pool.map(chapters_of, titles) for item in found]

                def sections_of(item):
                    url, title_name = item
                    page = self.page(url + '/')
                    chapter = re.search(r'<h2 class="lso-toc"><center>CHAPTER\s+[0-9A-Z]+\s+(.*?)</center>', page, re.S)
                    rows = re.findall(r'<a href="(/statutesrules/idstat/[^"]+/SECT[^"]+)">([^<]+)</a></td>\s*<td[^>]*>[^<]*</td>\s*<td[^>]*>(.*?)</td>', page, re.S)
                    return [{'url': SITE + href, 'number': text_of(number), 'heading': text_of(heading), 'chapter': url.rsplit('/', 1)[1],
                             'title_name': title_case(title_name), 'chapter_name': title_case(text_of(chapter.group(1))) if chapter else ''}
                            for href, number, heading in rows]
                sections = [row for found in pool.map(sections_of, chapters) for row in found]
            listing.write_text(json.dumps(sections))
            print(f'ID: {len(titles)} titles, {len(chapters)} chapters, {len(sections)} sections')
        sections = json.loads(listing.read_text())
        todo = [row for row in sections if not GONE.match(row['heading']) and not (raw / 'sections' / f"{row['number']}.html").exists()]
        (raw / 'sections').mkdir(exist_ok=True)

        def one(row):
            try:
                page = self.page(row['url'] + '/')
            except Exception:
                return row['url']
            start, end = page.find('class="pgbrk"'), page.find('How current is this law')
            (raw / 'sections' / f"{row['number']}.html").write_text(page[start:end] if start >= 0 else '')
            return None

        failed = []
        with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
            for done, result in enumerate(pool.map(one, todo), 1):
                if result:
                    failed.append(result)
                if done % 1000 == 0:
                    print(f'  {done} of {len(todo)} downloaded', flush=True)
        print(f'ID: {len(sections)} sections, {len(todo)} fetched now, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for row in json.loads((raw / 'sections.json').read_text()):
            number = row['number']
            if number in seen:
                continue
            seen.add(number)
            heading = row['heading'].rstrip('.').strip()
            title_name = f"Title {number.split('-')[0]}: {row['title_name']} / Chapter {row['chapter'].split('CH')[-1]}: {row['chapter_name']}"
            common = dict(number=number, url=row['url'], title=row['chapter'], title_name=title_name)
            if GONE.match(heading):
                yield Section(heading=heading, text='', status='repealed', **common)
                continue
            path = raw / 'sections' / f'{number}.html'
            if not path.exists():
                raise SystemExit(f'ID section {number} was not downloaded: run fetch again')
            page = path.read_text(errors='replace')
            history = ''
            split = re.search(r'History:\s*</span></div>', page)
            if split:
                history = text_of(page[split.end():])
                page = page[:split.start()]
            body = text_of(page[page.find(number + '.'):] if number + '.' in page else page)
            body = re.sub(r'^' + re.escape(number) + r'\.\s*', '', body)
            # The catchline is printed in the page's own case ("Council on Indian affairs created — Appointment of members.").
            lead = re.match(r'(.{0,600}?\.)\s', body)
            if lead and re.sub(r'\W', '', lead.group(1)).lower() == re.sub(r'\W', '', heading).lower():
                heading, body = lead.group(1).rstrip('.').strip(), body[lead.end():].strip()
            else:
                heading = title_case(heading)
            status = 'repealed' if GONE.match(body) and len(body) < 300 else ('reserved' if not body else 'live')
            law = LAW.search(history)
            yield Section(heading=heading, text=body, history=history.strip('[] '), status=status,
                          act=f'{law.group(1)}-{law.group(2)}' if law else '', enacted=[int(law.group(1))] if law else None, **common)


ADAPTER = Idaho()
