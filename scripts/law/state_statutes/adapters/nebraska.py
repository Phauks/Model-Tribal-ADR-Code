"""Nebraska: the Nebraska Revised Statutes, read from the Legislature's printable section pages
(nebraskalegislature.gov/laws/statutes.php?statute=<number>&print=true), listed with their catchlines on each chapter's page."""
from __future__ import annotations

import concurrent.futures
import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

BASE = 'https://nebraskalegislature.gov/laws/'
LAW = re.compile(r'^Laws (\d{4}), (?:\w+ Spec\. Sess\., )?(?:LB ?(\d+[A-Z]?)|c\. (\d+))')
ROW = re.compile(r'statute=([0-9A-Z.\-]+)"><span class="sr-only">View Statute </span>[^<]*</a></span>\s*<span[^>]*>(.*?)</span>', re.S)
GONE = re.compile(r'^(?:Repealed|Transferred|Outright repeal|Terminated|Expired|Obsolete|Reserved)\b', re.I)


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


def capitals(text: str) -> str:
    """Chapter names are printed in capitals: give them title case, small words lower."""
    small = {'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with'}
    words = text.lower().split(' ')
    return ' '.join(word if index and word in small else word[:1].upper() + word[1:] for index, word in enumerate(words))


class Nebraska(State):
    STATE = 'NE'
    NAME = 'Nebraska'
    CODE_NAME = 'Revised Statutes of Nebraska'
    CODE_SHORT = 'Neb. Rev. Stat.'
    AUTHOR = 'Nebraska Legislature'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'nebraska-revised-statutes'
    SOURCE_NOTE = "Text read from the Nebraska Legislature's page for the section (nebraskalegislature.gov/laws) on Nov. 27, 2026."
    NATION_NAMES = ('Omaha Tribe', 'Omaha Nation', 'Winnebago', 'Ho-Chunk', 'Ponca', 'Santee', 'Sioux', 'Lakota', 'Dakota', 'Pawnee',
                    'Sac and Fox', 'Iowa Tribe', 'Otoe')
    PLACE_NAMES = ('Sioux County', 'Dakota County', 'Dakota City', 'South Dakota', 'North Dakota', 'Sioux City', 'Sioux Falls',
                   'Pawnee County', 'Pawnee City', 'Otoe County', 'village of Winnebago', 'Village of Winnebago', 'Ponca State Park',
                   'city of Ponca', 'City of Ponca', 'Ponca Creek', 'Big Sioux', 'Pawnee Lake')
    WORKERS = 8

    def chapter_rows(self, chapter: str) -> dict:
        page = self.get(f'{BASE}browse-chapters.php?chapter={chapter}').decode('utf-8', 'replace')
        name = re.search(r'Revised Statutes Chapter \S+ - ([^<]+)<', page)
        return {'chapter': chapter, 'name': text_of(name.group(1)) if name else '',
                'sections': [[number, text_of(catchline)] for number, catchline in ROW.findall(page)]}

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'chapters.json'
        if not listing.exists():
            index = self.get(f'{BASE}browse-statutes.php').decode('utf-8', 'replace')
            chapters = list(dict.fromkeys(re.findall(r'browse-chapters\.php\?chapter=([0-9A-Z]+)', index)))
            chapters.sort(key=lambda chapter: (int(re.match(r'\d+', chapter).group(0)), chapter))
            with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
                rows = list(pool.map(self.chapter_rows, chapters))
            listing.write_text(json.dumps(rows))
            print(f'NE: {len(rows)} chapters, {sum(len(row["sections"]) for row in rows)} sections listed')
        rows = json.loads(listing.read_text())
        pairs = [(f'{BASE}statutes.php?statute={number}&print=true', raw / 'sections' / f'{number}.html')
                 for row in rows for number, catchline in row['sections'] if not GONE.match(catchline)]
        failed = self.download_all(pairs)
        print(f'NE: {len(pairs)} section pages, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for row in json.loads((raw / 'chapters.json').read_text()):
            chapter = row['chapter']
            title_name = f"Chapter {chapter}: {capitals(row['name'])}"
            for number, catchline in row['sections']:
                if number in seen:
                    continue
                seen.add(number)
                url = f'{BASE}statutes.php?statute={number}'
                heading = catchline.rstrip('.').strip()
                if GONE.match(catchline):
                    yield Section(number=number, heading=heading, text='', url=url, title=chapter, title_name=title_name, status='repealed')
                    continue
                path = raw / 'sections' / f'{number}.html'
                if not path.exists():
                    raise SystemExit(f'NE section {number} was not downloaded: run fetch again')
                page = path.read_text(errors='replace')
                body = page.split('<body>', 1)[-1]
                source = re.search(r'<div class="source">(.*?)</div>', body, re.S)
                history = text_of(source.group(1)).removeprefix('Source:').strip() if source else ''
                main = body[:source.start()] if source else re.split(r'<div class="(?:cross|annotation)', body)[0]
                main = re.sub(r'^\s*<strong>.*?</strong>', '', main, count=1, flags=re.S)
                text = text_of(main)
                law = LAW.match(history)
                yield Section(number=number, heading=heading, text=text, url=url, title=chapter, title_name=title_name, history=history,
                              act=(f'{law.group(1)}-LB{law.group(2)}' if law.group(2) else f'{law.group(1)}-c{law.group(3)}') if law else '', enacted=[int(law.group(1))] if law else None)


ADAPTER = Nebraska()
