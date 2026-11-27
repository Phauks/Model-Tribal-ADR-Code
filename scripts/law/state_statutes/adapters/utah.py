"""Utah: the Utah Code, read from the Legislature's XML file for each title (le.utah.gov/xcode/Title<n>/<version>.xml), the
version named on the title's page."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

BASE = 'https://le.utah.gov/xcode/'
SECTION = re.compile(r'<section number="([^"]+)">(.*?)</section>', re.S)
LAW = re.compile(r'Chapter\s*<modchap sess="(\d{4})(\w+)">(\d+)</modchap>')


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


class Utah(State):
    STATE = 'UT'
    NAME = 'Utah'
    CODE_NAME = 'Utah Code Annotated'
    CODE_SHORT = 'Utah Code Ann.'
    AUTHOR = 'Utah State Legislature'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'utah-code'
    SOURCE_NOTE = "Text read from the Utah Legislature's XML file of the section's title in the Utah Code (le.utah.gov/xcode) on Nov. 27, 2026."
    NATION_NAMES = ('Ute', 'Utes', 'Navajo', 'Diné', 'Goshute', 'Gosiute', 'Paiute', 'Shoshone', 'Uintah and Ouray', 'Skull Valley',
                    'Ute Mountain', 'Northwestern Band')
    PLACE_NAMES = ('Navajo Lake', 'Navajo Mountain', 'Paiute ATV Trail', 'Paiute Trail', 'Ute Lake')
    WORKERS = 6

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'titles.json'
        if not listing.exists():
            index = self.get(f'{BASE}C_1800010118000101.html').decode('utf-8', 'replace')
            titles = []
            for number in dict.fromkeys(re.findall(r'href="Title([0-9A-Z]+)/\1\.html', index)):
                page = self.get(f'{BASE}Title{number}/{number}.html').decode('utf-8', 'replace')
                version = re.search(r"var versionDefault=\"([^\"]+)\"", page)
                titles.append([number, version.group(1)])
            listing.write_text(json.dumps(titles))
            print(f'UT: {len(titles)} titles')
        titles = json.loads(listing.read_text())
        failed = self.download_all((f'{BASE}Title{number}/{version}.xml', raw / 'titles' / f'{number}.xml') for number, version in titles)
        print(f'UT: {len(titles)} title files, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for number, version in json.loads((raw / 'titles.json').read_text()):
            page = (raw / 'titles' / f'{number}.xml').read_text(errors='replace')
            names = {match.group(1): text_of(match.group(2)) for match in
                     re.finditer(r'<chapter number="([^"]+)"><catchline>(.*?)</catchline>', page, re.S)}
            title_name = text_of(re.search(r'<catchline>(.*?)</catchline>', page, re.S).group(1))
            for match in SECTION.finditer(page):
                section_number, body = match.group(1), match.group(2)
                if section_number in seen:
                    continue
                seen.add(section_number)
                histories = re.search(r'<histories>(.*?)</histories>', body, re.S)
                history_xml = histories.group(1) if histories else ''
                history = '; '.join(text_of(item) for item in re.findall(r'<history>(.*?)</history>', history_xml, re.S))
                rest = body[histories.end():] if histories else body
                head = re.search(r'<catchline>(.*?)</catchline>', rest, re.S)
                heading = text_of(head.group(1)).rstrip('.').strip() if head else ''
                # Subsection numbers ("9-1-102(3)(a)") are attributes, so the printed "(3)(a)" labels are gone: put them back.
                text = text_of(re.sub(r'<subsection number="[^"(]+((?:\([^)]+\))*?(\([^)]+\)))">', r' \2 ', rest[head.end():] if head else rest))
                chapter = '-'.join(section_number.split('-')[:2])
                law = LAW.search(history_xml)
                enacted = re.search(r'Enacted by Chapter\s*<modchap sess="(\d{4})', history_xml)
                status = 'repealed' if re.match(r'^(?:Repealed|Renumbered|Superseded)\b', heading + ' ' + text) and len(text) < 300 else 'live'
                title, part = chapter.split('-')[0], chapter.split('-')[1]
                yield Section(number=section_number, heading=heading, text=text,
                              url=f'{BASE}Title{title}/Chapter{part}/{chapter}-S{section_number.split("-", 2)[2]}.html',
                              title=chapter, title_name=f'Title {number}: {title_name} / Chapter {chapter}: {names.get(chapter, "")}',
                              history=history, status=status,
                              act=f'{law.group(1)}{law.group(2)}-{law.group(3)}' if law else '',
                              enacted=[int(enacted.group(1))] if enacted else None)


ADAPTER = Utah()
