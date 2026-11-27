"""Arizona: the Arizona Revised Statutes, read from the Legislature's pages, one per section (azleg.gov/ars/<title>/<section>.htm),
listed on each title's page (azleg.gov/arsDetail/?title=<title>). The section pages have no history lines."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://www.azleg.gov'


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


class Arizona(State):
    STATE = 'AZ'
    NAME = 'Arizona'
    CODE_NAME = 'Arizona Revised Statutes'
    CODE_SHORT = 'Ariz. Rev. Stat. Ann.'
    AUTHOR = 'Arizona State Legislature'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'arizona-revised-statutes'
    SOURCE_NOTE = "Text read from the Arizona State Legislature's page for the section in the Arizona Revised Statutes (azleg.gov/ars) on Nov. 27, 2026."
    NATION_NAMES = ('Navajo Nation', 'Hopi', 'Tohono', "O'odham", 'Akimel', 'Pima', 'Maricopa Indian', 'Salt River Pima', 'Gila River Indian',
                    'Ak-Chin', 'Apache Tribe', 'San Carlos Apache', 'White Mountain Apache', 'Tonto Apache', 'Yavapai', 'Hualapai', 'Havasupai',
                    'Kaibab', 'Paiute', 'Cocopah', 'Quechan', 'Colorado River Indian', 'Fort Mojave', 'Pascua Yaqui', 'Zuni', 'Fort McDowell')
    PLACE_NAMES = ('Navajo County', 'Apache County', 'Apache Junction', 'Pima County', 'Maricopa County', 'city of Maricopa', 'Yavapai County',
                   'Mohave County', 'Yuma County', 'Cochise County', 'Pinal County', 'Gila County', 'Gila River', 'Salt River Project',
                   'Salt River Valley', 'Colorado River', 'Pima Community College', 'Yavapai College', 'Navajo Generating Station',
                   'Maricopa Association of Governments', 'Maricopa County Community College')
    WORKERS = 10

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'sections.json'
        if not listing.exists():
            front = self.get(SITE + '/arstitle/').decode('utf-8', 'replace')
            titles = list(dict.fromkeys(re.findall(r'arsDetail/?\?title=([0-9A-Z.]+)', front)))
            sections = []
            (raw / 'titles').mkdir(exist_ok=True)
            for title in titles:
                page = self.get(f'{SITE}/arsDetail/?title={title}').decode('utf-8', 'replace')
                (raw / 'titles' / f'{title}.html').write_text(page)
                sections += [s for s in dict.fromkeys(re.findall(r'ars/' + re.escape(title) + r'/[0-9A-Z-]+\.htm', page)) if s not in sections]
            listing.write_text(json.dumps(sections))
            print(f'AZ: {len(titles)} titles, {len(sections)} sections')
        sections = json.loads(listing.read_text())
        failed = self.download_all((f'{SITE}/{path}', raw / 'sections' / path.replace('/', '_')) for path in sections)
        print(f'AZ: {len(sections)} sections, {len(failed)} failed', *failed[:10])

    def names(self, raw: Path) -> dict[str, str]:
        """Each section page's title, chapter and article names, from the title pages."""
        out = {}
        for path in sorted((raw / 'titles').glob('*.html')):
            page = path.read_text()
            top = re.search(r'<h1 class="topTitle">(.*?)</h1>', page, re.S)
            title_name = text_of(top.group(1)) if top else ''
            chapter, article = '', ''
            for match in re.finditer(r'<h5[^>]*><a[^>]*>(Chapter [^<]+)</a><div[^>]*>(.*?)</div>|<a class="one-sixth first"[^>]*>(Article [^<]+)</a><span[^>]*>(.*?)</span>|docName=https://www\.azleg\.gov/(ars/[^"]+\.htm)', page, re.S):
                if match.group(1):
                    chapter, article = f'{text_of(match.group(1))} {text_of(match.group(2)).title()}', ''
                elif match.group(3):
                    article = f'{text_of(match.group(3))} {text_of(match.group(4))}'
                else:
                    out[match.group(5)] = ' / '.join(name for name in (title_name, chapter, article) if name)
        return out

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        names = self.names(raw)
        for path in json.loads((raw / 'sections.json').read_text()):
            file = raw / 'sections' / path.replace('/', '_')
            if not file.exists():
                raise SystemExit(f'AZ section {path} was not downloaded: run fetch again')
            page = file.read_bytes().decode('utf-8', 'replace')
            head = re.search(r'<font color=GREEN>([^<]+)</font>\.?\s*<font color=PURPLE>(.*?)</font>', page, re.S)
            if not head:
                continue
            number, heading = text_of(head.group(1)).rstrip('.'), text_of(head.group(2)).rstrip('.')
            body = page[head.end():].split('</BODY>', 1)[0]
            text = ' '.join(text_of(p) for p in re.findall(r'<p[^>]*>(.*?)</p>', body, re.S | re.I))
            if number in seen:
                continue
            seen.add(number)
            gone = r'^\[?(?:Repealed|Renumbered|Reserved|Transferred|Expired)\b'
            status = 'repealed' if re.match(gone, heading, re.I) or re.match(gone, text, re.I) else ('reserved' if not text else 'live')
            title = number.split('-')[0]
            yield Section(number=number, heading=heading, text=text, url=f'{SITE}/{path}', title=title, title_name=names.get(path, f'Title {title}'),
                          status=status)


ADAPTER = Arizona()
