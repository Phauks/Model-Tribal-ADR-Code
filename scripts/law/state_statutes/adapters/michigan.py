"""Michigan: the Michigan Compiled Laws, read from the Legislature's whole-chapter pages (legislature.mi.gov/Home/RenderDoc?objectName=mcl-chap<n>),
listed on its chapter index. Chapter 1 is the state constitution and is not read. Each section sits inside the public act that
enacted it, so a section's act is that public act; each record links to the section's own page (legislature.mi.gov/Laws/MCL?objectName=mcl-<number>)."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://legislature.mi.gov'
GONE = re.compile(r'^(?:Repealed|Transferred|Expired|Reserved|Renumbered|Obsolete|Omitted|Superseded|Compiler)\b', re.I)
LAW = re.compile(r'^(?:Add\. )?(\d{4}),')


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


class Michigan(State):
    STATE = 'MI'
    NAME = 'Michigan'
    CODE_NAME = 'Michigan Compiled Laws'
    CODE_SHORT = 'Mich. Comp. Laws'
    AUTHOR = 'Michigan Legislature'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'michigan-compiled-laws'
    SOURCE_NOTE = "Text read from the Michigan Legislature's page for the section's chapter of the Michigan Compiled Laws (legislature.mi.gov), complete through Public Act 114 of 2026, on Nov. 27, 2026."
    NATION_NAMES = ('Chippewa', 'Ottawa', 'Odawa', 'Potawatomi', 'Pottawatomi', 'Anishinaabe', 'Anishinabe', 'Ojibwe', 'Ojibwa', 'Bay Mills',
                    'Hannahville', 'Keweenaw Bay Indian', 'Lac Vieux Desert', 'Pokagon', 'Gun Lake', 'Match-E-Be-Nash-She-Wish',
                    'Sault Ste. Marie Tribe', 'Grand Traverse Band', 'Little Traverse Bay', 'Little River Band', 'Nottawaseppi', 'Saginaw Chippewa',
                    'Huron Potawatomi', 'Menominee Tribe', 'Wyandot', 'Wyandotte Nation')
    PLACE_NAMES = ('Chippewa County', 'Ottawa County', 'Chippewa River', 'Ottawa Street', 'city of Wyandotte', 'City of Wyandotte', 'Wyandotte',
                   'Menominee County', 'Menominee River', 'Ottawa Lake', 'Chippewa Lake', 'Chippewa Township', 'Pokagon Township',
                   'Bay Mills Township', 'Potawatomi Trail', 'Indian River', 'Indian Lake', 'Indian Trail', 'Indian Creek')
    WORKERS = 4

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        index = raw / 'index.html'
        if not index.exists():
            index.write_bytes(self.get(SITE + '/Laws/ChapterIndex'))
        chapters = [name for name in dict.fromkeys(re.findall(r'objectName=(mcl-chap[0-9A-Za-z]+)"', index.read_text(errors='replace'))) if name != 'mcl-chap1']
        failed = self.download_all((f'{SITE}/Home/RenderDoc?objectName={name}', raw / 'chapters' / f'{name}.html') for name in chapters)
        print(f'MI: {len(chapters)} chapters, {len(failed)} failed', *failed[:10])

    def chapter_names(self, raw: Path) -> dict[str, str]:
        page = (raw / 'index.html').read_text(errors='replace')
        return {name: text_of(label) for name, label in
                re.findall(r'objectName=(mcl-chap[0-9A-Za-z]+)">\s*Chapter [^<]*</a>\s*</td>\s*<td[^>]*>(.*?)</td>', page, re.S)}

    def parse(self, raw: Path) -> Iterator[Section]:
        names = self.chapter_names(raw)
        chapters = [name for name in dict.fromkeys(re.findall(r'objectName=(mcl-chap[0-9A-Za-z]+)"', (raw / 'index.html').read_text(errors='replace'))) if name != 'mcl-chap1']
        seen = set()
        for name in chapters:
            path = raw / 'chapters' / f'{name}.html'
            if not path.exists():
                raise SystemExit(f'MI {name} was not downloaded: run fetch again')
            page = path.read_text(errors='replace')
            chapter = name.removeprefix('mcl-chap')
            chapter_name = f"Chapter {chapter}. {names.get(name, '').title()}".strip()
            act_name, act_key = '', ''
            # Walk the act headings and the sections in page order: each piece runs to the next act heading or section.
            for piece in re.split(r'(?=<div class="statuteHeading"|<div class="sectionWrapper">)', page):
                if piece.startswith('<div class="statuteHeading"'):
                    heading_block = piece[:piece.find('</div>')]
                    parts = [text_of(part) for part in re.findall(r'<h[12][^>]*>(.*?)</h[12]>', heading_block, re.S)]
                    act_name = ' / '.join(part for part in parts if part)
                    found = re.search(r'Act (\d+) of (\d{4})', act_name)
                    act_key = f'{found.group(2)}-{found.group(1)}' if found else act_name
                    continue
                if not piece.startswith('<div class="sectionWrapper">'):
                    continue
                body = re.split(r'<div class="divisionWrapper"|<div class="divisionHeading"', piece)[0]
                head = re.search(r'<h1 class="h4"[^>]*>(.*?)</h1>', body, re.S)
                if not head:
                    continue
                line = text_of(head.group(1))
                number_match = re.match(r'^(\d+[a-z]*\.\d+[a-z]*(?:\.\d+[a-z]*)?)\s*(.*)$', line)
                if not number_match:
                    continue
                number, heading = number_match.group(1), number_match.group(2).rstrip('.').strip()
                if number in seen:
                    continue
                seen.add(number)
                history_match = re.search(r'<span style="font-weight:bold;?">History:</span>(.*?)</p>', body, re.S)
                history = clean(re.sub(r'\s*;--\s*', '; ', text_of(history_match.group(1)))) if history_match else ''
                history = re.split(r"\s*(?:Compiler's Notes|Popular Name|Constitutionality|Former Law|Transfer of powers|Rendered)\s*:", history)[0].strip()
                rest = body[head.end():]
                rest = re.sub(r'<div class="editorials[^"]*"[^>]*>.*?</div>', ' ', rest, flags=re.S)
                text = text_of(rest)
                text = re.sub(r'^Sec\. [0-9a-z.]+\.\s*', '', text)
                status = 'repealed' if GONE.match(heading) or (not text and GONE.match(line.split(' ', 1)[-1])) else ('live' if text else 'reserved')
                law = LAW.match(history)
                yield Section(number=number, heading=heading, text=text, history=history, status=status,
                              url=f'{SITE}/Laws/MCL?objectName=mcl-{number}', title=chapter, title_name=f'{chapter_name} / {act_name}',
                              act=act_key, enacted=[int(law.group(1))] if law else None)


ADAPTER = Michigan()
