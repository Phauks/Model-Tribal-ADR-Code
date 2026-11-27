"""South Carolina: the Code of Laws of South Carolina 1976 (unannotated), read from the Legislative Services Agency's chapter pages
(scstatehouse.gov/code/t<title>c<chapter>.php), listed on each title's page. The pages have no anchor for a section, so each record
links to its chapter's page."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://www.scstatehouse.gov'
LAW = re.compile(r'(\d{4}) Act No\. (\d+)')


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


class SouthCarolina(State):
    STATE = 'SC'
    NAME = 'South Carolina'
    CODE_NAME = 'Code of Laws of South Carolina 1976'
    CODE_SHORT = 'S.C. Code Ann.'
    AUTHOR = 'South Carolina General Assembly'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'south-carolina-code'
    SOURCE_NOTE = "Text read from the South Carolina Legislative Services Agency's page for the section's chapter of the Code of Laws (scstatehouse.gov/code) on Nov. 27, 2026."
    NATION_NAMES = ('Catawba', 'Pee Dee', 'Edisto', 'Santee', 'Waccamaw', 'Wassamasaw', 'Beaver Creek', 'Sumter Tribe', 'Chicora', 'Natchez',
                    'Cherokee Indian', 'Yamasee', 'Piedmont American Indian')
    PLACE_NAMES = ('Catawba River', 'Catawba Lake', 'Lake Catawba', 'Catawba-Wateree', 'Catawba Wateree', 'Santee Cooper', 'Santee River',
                   'Santee-Cooper', 'Lake Santee', 'Town of Santee', 'town of Santee', 'Edisto River', 'Edisto Island', 'Edisto Beach',
                   'North Edisto', 'South Edisto', 'Pee Dee River', 'Great Pee Dee', 'Little Pee Dee', 'Pee Dee region', 'Pee Dee Regional',
                   'Waccamaw River', 'Waccamaw Neck', 'Cherokee County', 'Beaver Creek Road', 'Chicora Avenue')
    WORKERS = 6

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'chapters.json'
        if not listing.exists():
            master = self.get(SITE + '/code/statmast.php').decode('utf-8', 'replace')
            titles = list(dict.fromkeys(re.findall(r'/code/(title\d+)\.php', master)))
            chapters = []
            for title in titles:
                page = self.get(f'{SITE}/code/{title}.php').decode('utf-8', 'replace')
                chapters += [c for c in dict.fromkeys(re.findall(r'/code/(t\d+c\d+[A-Z]?)\.php', page)) if c not in chapters]
            listing.write_text(json.dumps(chapters))
            print(f'SC: {len(titles)} titles, {len(chapters)} chapters')
        chapters = json.loads(listing.read_text())
        failed = self.download_all((f'{SITE}/code/{chapter}.php', raw / 'chapters' / f'{chapter}.html') for chapter in chapters)
        print(f'SC: {len(chapters)} chapters, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for chapter in json.loads((raw / 'chapters.json').read_text()):
            path = raw / 'chapters' / f'{chapter}.html'
            if not path.exists():
                raise SystemExit(f'SC chapter {chapter} was not downloaded: run fetch again')
            page = path.read_text(errors='replace')
            if 'id="contentsection"' not in page:
                continue
            body = page.split('id="contentsection"', 1)[1].split('<!-- mainwidepanel -->', 1)[0]
            title_line = re.search(r'<div style="font-weight: bold; text-align: center;">(.*?)</div>', body, re.S)
            title_name = text_of(title_line.group(1)) if title_line else ''
            centers = [text_of(c) for c in re.findall(r'<div style="text-align: center;">(.*?)</div>', body.split('SECTION', 1)[0], re.S)]
            chapter_name = ' '.join(centers[:2]) if centers else ''
            pieces = re.split(r'<span style="font-weight: bold;">\s*(SECTIONS?\s+[0-9A-Z.\-]+(?:\s+(?:to|through|and)\s+[0-9A-Z.\-]+)?\.?)\s*</span>', body)
            article = ' '.join(centers[2:4])
            for index in range(1, len(pieces) - 1, 2):
                label, block = pieces[index], pieces[index + 1]
                number = re.search(r'([0-9A-Z]+-[0-9A-Z.]+-[0-9A-Z.]+)', label).group(1).rstrip('.')
                # A heading for the next article sits at the end of this block.
                headers = re.findall(r'<div style="text-align: center;">(.*?)</div>', block, re.S)
                block_main = re.split(r'<div style="text-align: center;">', block)[0]
                parts = block_main.split('<br /><br />')
                heading = text_of(parts[0]).rstrip('.')
                history_at = next((i for i, part in enumerate(parts) if text_of(part).startswith('HISTORY:')), None)
                text_parts = parts[1:history_at] if history_at is not None else parts[1:]
                text = ' '.join(text_of(part) for part in text_parts if text_of(part))
                history = text_of(parts[history_at]).removeprefix('HISTORY:').strip() if history_at is not None else ''
                if number in seen:
                    continue
                seen.add(number)
                gone = r'^(?:Repealed|Reserved|Omitted|Transferred|Renumbered|Recodified|Expired|Deleted)\b'
                status = 'repealed' if label.startswith('SECTIONS') or re.match(gone, heading, re.I) else ('reserved' if not text else 'live')
                law = LAW.search(history)
                yield Section(number=number, heading=heading, text=text, url=f'{SITE}/code/{chapter}.php', title=chapter,
                              title_name=' / '.join(name for name in (title_name, chapter_name, article) if name), history=history, status=status,
                              act=f'{law.group(1)}-{law.group(2)}' if law else '', enacted=[int(law.group(1))] if law else None)
                if headers:
                    article = ' '.join(text_of(h) for h in headers[-2:])


ADAPTER = SouthCarolina()
