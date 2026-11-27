"""Massachusetts: the General Laws of Massachusetts, read from the Legislature's open data service (malegislature.gov/api), which
answers one call per chapter (its sections) and one per section (its catchline and text). The Legislature's own chapter lists
(malegislature.gov/Laws/GeneralLaws) give each chapter's part and title, which the section's page address needs. The General
Laws print no history lines, so the records carry no enactment year."""
from __future__ import annotations

import concurrent.futures
import html
import json
import re
import urllib.parse
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://malegislature.gov'
PARTS = ('I', 'II', 'III', 'IV', 'V')


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


def split_number(number: str) -> tuple[str, str]:
    chapter, section = number.split(':', 1)
    return chapter, section


class Massachusetts(State):
    STATE = 'MA'
    NAME = 'Massachusetts'
    CODE_NAME = 'General Laws of Massachusetts'
    CODE_SHORT = 'Mass. Gen. Laws'
    AUTHOR = 'Massachusetts General Court'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'massachusetts-general-laws'
    SOURCE_NOTE = "Text read from the Massachusetts Legislature's open data service for the section of the General Laws (malegislature.gov/api) on Nov. 27, 2026."
    NATION_NAMES = ('Wampanoag', 'Mashpee', 'Aquinnah', 'Gay Head', 'Nipmuc', 'Massachusett', 'Mohican', 'Stockbridge-Munsee', 'Herring Pond')
    PLACE_NAMES = ('Mashpee River', 'town of Mashpee', 'Town of Mashpee', 'Mashpee Commons', 'town of Aquinnah', 'Town of Aquinnah', 'Gay Head Light',
                   'Nipmuck Pond', 'Natick', 'Indian Head', 'Indian Orchard', 'Indian Pond', 'Indian Lake', 'Indian Hill')
    WORKERS = 12

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'sections.json'
        if not listing.exists():
            chapters = []
            for part_id, part in enumerate(PARTS, 1):
                page = self.get(f'{SITE}/Laws/GeneralLaws/Part{part}').decode('utf-8', 'replace')
                for title_id, title_code in dict.fromkeys(re.findall(r"accordionAjaxLoad\('\d+', '(\d+)', '([IVXLC]+)'\)", page)):
                    query = urllib.parse.urlencode({'partId': part_id, 'titleId': title_id, 'code': title_code})
                    block = self.get(f'{SITE}/Laws/GeneralLaws/GetChaptersForTitle?{query}').decode('utf-8', 'replace')
                    for path, chapter, name in re.findall(r'href="(/Laws/GeneralLaws/Part[IVX]+/Title[IVXLC]+/Chapter([0-9A-Z]+))"[^>]*>(.*?)</a>', block, re.S):
                        chapters.append({'part': part, 'title': title_code, 'chapter': chapter, 'path': path, 'name': text_of(name)})
            chapters = list({row['chapter']: row for row in chapters}.values())

            def sections_of(row):
                data = json.loads(self.get(f"{SITE}/api/Chapters/{row['chapter']}"))
                return [{**row, 'section': item['Code']} for item in data.get('Sections') or []]

            with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
                sections = [item for items in pool.map(sections_of, chapters) for item in items]
            listing.write_text(json.dumps(sections))
            print(f'MA: {len(chapters)} chapters, {len(sections)} sections')
        sections = json.loads(listing.read_text())
        (raw / 'sections').mkdir(exist_ok=True)

        def path_of(row):
            return raw / 'sections' / f"{row['chapter']}-{re.sub(r'[^0-9A-Za-z]+', '_', row['section'])}.json"

        todo = [row for row in sections if not path_of(row).exists()]

        def one(row):
            try:
                data = self.get(f"{SITE}/api/Chapters/{row['chapter']}/Sections/{urllib.parse.quote(row['section'].replace('/', '~'))}/")
                json.loads(data)
            except Exception:
                return f"{row['chapter']} § {row['section']}"
            path_of(row).write_bytes(data)
            return None

        failed = []
        with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
            for done, result in enumerate(pool.map(one, todo), 1):
                if result:
                    failed.append(result)
                if done % 1000 == 0:
                    print(f'  {done} of {len(todo)} downloaded', flush=True)
        print(f'MA: {len(sections)} sections, {len(todo)} fetched now, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for row in json.loads((raw / 'sections.json').read_text()):
            number = f"{row['chapter']}:{row['section']}"
            if number in seen:
                continue
            seen.add(number)
            common = dict(number=number, url=f"{SITE}{row['path']}/Section{row['section'].replace(' ', '').replace('/', '~')}", title=row['chapter'],
                          title_name=f"Part {row['part']}, Title {row['title']} / Chapter {row['chapter']}: {re.sub(r'^Chapter \S+\s+', '', row['name'])}")
            path = raw / 'sections' / f"{row['chapter']}-{re.sub(r'[^0-9A-Za-z]+', '_', row['section'])}.json"
            if not path.exists():
                raise SystemExit(f'MA {number} was not downloaded: run fetch again')
            data = json.loads(path.read_text())
            heading = clean(data.get('Name') or '').rstrip('.').strip()
            text = clean(html.unescape(data.get('Text') or '').replace('\xa0', ' '))
            text = re.sub(r'^Section\s+' + re.escape(row['section']) + r'\.\s*', '', text)
            if data.get('IsRepealed') or re.match(r'^(?:Repealed|Expired|Transferred|Struck)\b', heading, re.I) and len(text) < 200:
                yield Section(heading=heading, text='', status='repealed', **common)
                continue
            if ' to ' in row['section']:  # a range of numbers is always a repeal or a reservation
                yield Section(heading=heading, text=text, status='reserved', **common)
                continue
            yield Section(heading=heading, text=text, status='live' if text else 'reserved', **common)

    def short_citation(self, number: str) -> str:
        chapter, section = split_number(number)
        return f'Mass. Gen. Laws ch. {chapter}, § {section}'

    def key(self, number: str) -> str:
        chapter, section = split_number(number)
        slug = lambda text: re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
        return f'massachusetts-general-laws-chapter-{slug(chapter)}-section-{slug(section)}'

    def citation_parts(self, row: dict) -> dict:
        chapter, section = split_number(row['number'])
        return {'chapter-number': chapter, 'section': section}


ADAPTER = Massachusetts()
