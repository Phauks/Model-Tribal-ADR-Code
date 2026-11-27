"""Nevada: the Nevada Revised Statutes, read from the Legislature's whole-chapter pages (leg.state.nv.us/nrs/NRS-<chapter>.html),
listed on its index page."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

BASE = 'https://www.leg.state.nv.us/nrs/'


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace(' ', ' ').replace('\xa0', ' '))


class Nevada(State):
    STATE = 'NV'
    NAME = 'Nevada'
    CODE_NAME = 'Nevada Revised Statutes'
    CODE_SHORT = 'Nev. Rev. Stat.'
    AUTHOR = 'Nevada Legislature'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'nevada-revised-statutes'
    SOURCE_NOTE = "Text read from the Nevada Legislature's chapter page for the section (leg.state.nv.us/nrs) on Nov. 27, 2026."
    NATION_NAMES = ('Paiute', 'Shoshone', 'Washoe Tribe', 'Washoe Indian', 'Goshute', 'Pyramid Lake', 'Walker River', 'Moapa', 'Duck Valley',
                    'Te-Moak', 'Ely Shoshone', 'Yerington', 'Fallon Paiute', 'Reno-Sparks Indian', 'Las Vegas Paiute', 'Summit Lake', 'Winnemucca Indian',
                    'Lovelock Paiute', 'Fort McDermitt', 'Duckwater', 'Yomba', 'Timbisha')
    PLACE_NAMES = ('Washoe County', 'Washoe County School District', 'Washoe Valley', 'Washoe Lake', 'Shoshone County', 'Walker River Basin',
                   'Walker Lake', 'Pyramid Lake Highway', 'city of Yerington', 'City of Yerington', 'Winnemucca Lake', 'City of Winnemucca',
                   'city of Winnemucca', 'Moapa Valley', 'Moapa Valley Water District', 'Lovelock')

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'chapters.json'
        if not listing.exists():
            index = self.get(BASE).decode('windows-1252', 'replace')
            listing.write_text(json.dumps(list(dict.fromkeys(re.findall(r'href="NRS-([0-9A-Z]+)\.html"', index)))))
        chapters = json.loads(listing.read_text())
        failed = self.download_all((f'{BASE}NRS-{chapter}.html', raw / 'chapters' / f'{chapter}.html') for chapter in chapters)
        print(f'NV: {len(chapters)} chapters, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        for chapter in json.loads((raw / 'chapters.json').read_text()):
            path = raw / 'chapters' / f'{chapter}.html'
            if not path.exists():
                raise SystemExit(f'NV chapter {chapter} was not downloaded: run fetch again')
            page = path.read_bytes().decode('windows-1252', 'replace')
            name_match = re.search(r'<p class="Chapter">(.*?)</p>', page, re.S)
            name = re.sub(r'^Chapter [0-9A-Z]+ - ', '', text_of(name_match.group(1)), flags=re.I) if name_match else ''
            parts = re.split(r'<a name=(NRS\w+Sec[0-9A-Za-z]+)></a>', page)
            for index in range(1, len(parts) - 1, 2):
                anchor, block = parts[index], parts[index + 1]
                block = re.split(r'<p class="(?:DocHeading|COHead\d?|Chapter|Article)"', block)[0]
                number_match = re.search(r'<span\s+class="Section">([^<]+)</span>', block)
                if not number_match:
                    continue
                number = clean(number_match.group(1))
                lead = re.search(r'<span\s+class="Leadline">(.*?)</span>', block, re.S)
                heading = text_of(lead.group(1)).rstrip('.') if lead else ''
                notes = re.findall(r'<p class="SourceNote">(.*?)</p>', block, re.S)
                history = ' '.join(text_of(note) for note in notes)
                body = re.split(r'<p class="(?:SourceNote|NoteToBill|Note)\w*">', block)[0]
                body = re.sub(r'<span\s+class="Leadline">.*?</span>', ' ', body, count=1, flags=re.S)
                text = text_of(body)
                text = re.sub(r'^NRS\s*' + re.escape(number) + r'\s*', '', text)
                if heading.count('”') > heading.count('“') and text.startswith('“'):  # an opening quote printed outside the catchline
                    heading, text = '“' + heading, text[1:].strip()
                law = re.search(r'\[\d+[a-z]?:(\d+):(\d{4})[\];]', history) or re.search(r'Added to NRS by (\d{4}), (\d+)', history)
                if law and law.re.pattern.startswith('Added'):
                    act, year = f'{law.group(1)}-p{law.group(2)}', law.group(1)
                elif law:
                    act, year = f'{law.group(2)}-{law.group(1)}', law.group(2)
                else:
                    act, year = '', None
                dead = r'^\[?(?:Repealed|Renumbered|Replaced|Expired|Superseded)\b'
                status = 'repealed' if re.match(dead, heading, re.I) or re.match(r'^\[?(?:Repealed|Renumbered|Replaced|Expired|Superseded)\b', text, re.I) else 'live'
                yield Section(number=number, heading=heading, text=text, url=f'{BASE}NRS-{chapter}.html#{anchor}', title=chapter,
                              title_name=f'NRS chapter {chapter.lstrip("0") or "0"}: {name.title()}' if name else f'NRS chapter {chapter}',
                              history=history, status=status, act=act, enacted=[int(year)] if year else None)


ADAPTER = Nevada()
