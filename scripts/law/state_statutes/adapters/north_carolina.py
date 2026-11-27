"""North Carolina: the General Statutes of North Carolina, read from the General Assembly's whole-chapter pages
(ncleg.gov/EnactedLegislation/Statutes/HTML/ByChapter/Chapter_<n>.html), listed on its table of contents. Each record links to the
General Assembly's page for the one section."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://www.ncleg.gov'
CHAPTER = SITE + '/EnactedLegislation/Statutes/HTML/ByChapter/Chapter_{}.html'
SECTION = SITE + '/EnactedLegislation/Statutes/HTML/BySection/Chapter_{}/GS_{}.html'
START = re.compile(r'^§§?\s*([0-9A-Z]+-[0-9A-Za-z.]+)(?:\s+(?:through|and|to)\s+[0-9A-Z]+-[0-9A-Za-z.]+)?\s*[.:]\s*(.*)$')
DIVISION = re.compile(r'^(?:Article|Part|Subpart|Subchapter)\s+[0-9A-Za-z.\-]+\.(?:\s+[A-Z(].*)?$', re.I)
LAW = re.compile(r'(\d{4})(?:,\s*(?:\d\w*|Extra|Ex\.)\s*(?:Extra\s*)?Sess\.)?,\s*c\.\s*(\d+)')


def paragraphs(page: str) -> list[str]:
    out = []
    for fragment in re.findall(r'<(?:p|h\d)\b[^>]*>(.*?)</(?:p|h\d)>', page, re.S):
        text = clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))
        if text:
            out.append(text)
    return out


class NorthCarolina(State):
    STATE = 'NC'
    NAME = 'North Carolina'
    CODE_NAME = 'General Statutes of North Carolina'
    CODE_SHORT = 'N.C. Gen. Stat.'
    AUTHOR = 'North Carolina General Assembly'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'north-carolina-general-statutes'
    SOURCE_NOTE = "Text read from the North Carolina General Assembly's page for the section's chapter of the General Statutes (ncleg.gov) on Nov. 27, 2026."
    NATION_NAMES = ('Cherokee', 'Eastern Band', 'Lumbee', 'Haliwa-Saponi', 'Saponi', 'Coharie', 'Meherrin', 'Waccamaw Siouan', 'Waccamaw-Siouan',
                    'Sappony', 'Occaneechi', 'Tuscarora', 'Croatan')
    PLACE_NAMES = ('Cherokee County', 'Cherokee County Board', 'town of Cherokee', 'Cherokee, North Carolina', 'Tuscarora Road', 'Waccamaw River',
                   'Lake Waccamaw', 'Town of Lake Waccamaw', 'Coharie Creek', 'Meherrin River', 'Eno River', 'Catawba County', 'Catawba River',
                   'Catawba College', 'Catawba Valley', 'Pasquotank County', 'Pasquotank River', 'Currituck County', 'Currituck Sound',
                   'Hatteras', 'Roanoke Island', 'Roanoke River', 'Roanoke Rapids', 'Chowan County', 'Chowan River', 'Chowan University',
                   'Perquimans County', 'Watauga County', 'Yadkin County', 'Yadkin River', 'Cheoah', 'Nantahala', 'Swannanoa', 'Tuckasegee',
                   'Hiwassee', 'Oconaluftee')

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'chapters.json'
        if not listing.exists():
            index = self.get(SITE + '/Laws/GeneralStatutesTOC').decode('utf-8', 'replace')
            chapters = list(dict.fromkeys(re.findall(r'/HTML/ByChapter/Chapter_([0-9A-Z]+)\.html', index)))
            listing.write_text(json.dumps(chapters))
        chapters = json.loads(listing.read_text())
        failed = self.download_all((CHAPTER.format(chapter), raw / 'chapters' / f'{chapter}.html') for chapter in chapters)
        print(f'NC: {len(chapters)} chapters, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for chapter in json.loads((raw / 'chapters.json').read_text()):
            path = raw / 'chapters' / f'{chapter}.html'
            if not path.exists():
                raise SystemExit(f'NC chapter {chapter} was not downloaded: run fetch again')
            lines = paragraphs(path.read_text(errors='replace'))
            chapter_name, article_name, part_name = '', '', ''
            if len(lines) > 1 and lines[0].startswith('Chapter'):
                chapter_name = lines[1].rstrip('.')
            current, body = None, []
            expect_article_name = False

            def finish():
                if current is None:
                    return None
                number, heading, division = current
                text = ' '.join(body)
                history_match = re.search(r'\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$', text)
                if history_match and not re.search(r'\b(?:c|s|ss)\.\s*\d|C\.S\.|Rev\.|Code|C\.C\.P\.', history_match.group(1)):
                    history_match = None
                history = history_match.group(1) if history_match else ''
                if history_match:
                    text = text[:history_match.start()].strip()
                law = LAW.search(history)
                gone = r'^(?:Repealed|Recodified|Reserved|Expired|Transferred|Renumbered|Recodifed)\b'
                status = 'repealed' if re.match(gone, heading, re.I) else ('reserved' if not text and not history else 'live')
                return Section(number=number, heading=heading.rstrip('.'), text=text, url=SECTION.format(chapter, number), title=chapter,
                               title_name=f'Chapter {chapter}: {chapter_name}' + (f' / {division}' if division else ''), history=history,
                               status=status, act=f'{law.group(1)}-{law.group(2)}' if law else '', enacted=[int(law.group(1))] if law else None)

            for line in lines[2 if chapter_name else 0:]:
                if expect_article_name:
                    expect_article_name = False
                    article_name, part_name = line.rstrip('.'), ''
                    continue
                if re.match(r'^Article\s+[0-9A-Za-z.\-]+\.?$', line, re.I):
                    expect_article_name = True
                    continue
                start = START.match(line)
                if start:
                    section = finish()
                    if section and section.number not in seen:
                        seen.add(section.number)
                        yield section
                    current, body = (start.group(1), start.group(2), ' / '.join(name for name in (article_name, part_name) if name)), []
                    continue
                if DIVISION.match(line) and len(line) < 160 and not line.endswith(')'):
                    if re.match(r'^(?:Part|Subpart)\b', line, re.I):
                        part_name = re.sub(r'^\w+\s+[0-9A-Za-z.\-]+\.\s*', '', line).rstrip('.')
                    continue
                body.append(line)
            section = finish()
            if section and section.number not in seen:
                seen.add(section.number)
                yield section


ADAPTER = NorthCarolina()
