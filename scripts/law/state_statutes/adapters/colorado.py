"""Colorado: the Colorado Revised Statutes, read from the Office of Legislative Legal Services' 2026 download of every title in HTML
(olls.info/crs/crs2026-htm.zip, listed on content.leg.colorado.gov's "2026 CRS Titles for Download" page). Each title's file
prints its tables of contents first and then the sections; a section's start is a heading line followed by its text or its
source note, so the contents lines (one heading after another) are not taken for sections. Each record links to its title's PDF
on the same download page; the free online code is LexisNexis's, which does not take scripts."""
from __future__ import annotations

import html
import re
import zipfile
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

ZIP = 'https://olls.info/crs/crs2026-htm.zip'
PDF = 'https://olls.info/crs/crs2026-title-{title}.pdf'
HEADING = re.compile(r'^(\d+(?:\.\d+)?-\d+(?:\.\d+)?-\d+(?:\.\d+)?)\.\s+(.*)$')
GONE = re.compile(r'\((?:Repealed|Transferred|Renumbered|Expired|Reserved)\)\s*$|^(?:Repealed|Transferred|Renumbered)\b', re.I)
# The head of the source note: "Source: L. 76: ...", "Source: Added, L. 2013: ...", "Source: R & RE, L. 79: ..." (an older code's
# citation first, such as "Source: G.L. § 1; ... CRS 53", means the section is older than its first session law here).
LAW = re.compile(r'^Source:\s*(?:(?:R & RE|Added|RC|Entire [a-z ]+ added)[,:]?\s*)?L\.\s*(\d{2,4})\b(?:[^.]*?\((?:[HS]B|HJR|SJR) (\d+-\d+)\))?')
PAGE = re.compile(r'^Source:[^;]*?\bp\.\s*(\d+)')


def lines_of(markup: str) -> list[str]:
    paragraphs = re.findall(r'<p\b[^>]*>(.*?)</p>', markup, re.S)
    out = [clean(html.unescape(re.sub(r'<[^>]+>', '', paragraph)).replace('\xa0', ' ')) for paragraph in paragraphs]
    return [line for line in out if line]


class Colorado(State):
    STATE = 'CO'
    NAME = 'Colorado'
    CODE_NAME = 'Colorado Revised Statutes'
    CODE_SHORT = 'Colo. Rev. Stat.'
    AUTHOR = 'Colorado Office of Legislative Legal Services'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'colorado-revised-statutes'
    SOURCE_NOTE = ("Text read from the Colorado Office of Legislative Legal Services' 2026 download of the Colorado Revised Statutes "
                   "(content.leg.colorado.gov, 2026 CRS Titles for Download) on Nov. 27, 2026.")
    NATION_NAMES = ('Ute', 'Utes', 'Southern Ute', 'Ute Mountain', 'Ute Mountain Ute', 'Arapaho', 'Cheyenne', 'Comanche', 'Kiowa', 'Navajo',
                    'Apache', 'Shoshone', 'Lakota', 'Sioux', 'Pawnee')
    PLACE_NAMES = ('Pueblo County', 'county of Pueblo', 'city of Pueblo', 'City of Pueblo', 'Pueblo West', 'Pueblo Community College',
                   'Colorado State University-Pueblo', 'Colorado State University - Pueblo', 'University of Southern Colorado', 'Pueblo depot',
                   'Pueblo Chemical Depot', 'Pueblo Reservoir', 'Pueblo, Colorado', 'Pueblo Army Depot', 'Pueblo Union Depot', 'Pueblo regional',
                   'Arapahoe County', 'Arapahoe', 'Cheyenne County', 'Cheyenne Wells', 'Cheyenne Mountain', 'Kiowa County', 'Kiowa Creek',
                   'Ute Pass', 'Ute Creek', 'Ute Water', 'Navajo Reservoir', 'Navajo River', 'Comanche National Grassland', 'Comanche Peak',
                   'Apache Creek', 'Shoshone power plant', 'Indian Peaks', 'Indian Hills', 'Indian Creek')

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        archive = raw / 'crs2026-htm.zip'
        if not archive.exists():
            archive.write_bytes(self.get(ZIP, timeout=600))
        with zipfile.ZipFile(archive) as bundle:
            names = [name for name in bundle.namelist() if re.fullmatch(r'crs2026-title-[0-9.]+\.htm', name)]
            bundle.extractall(raw / 'htm', members=names)
        print(f'CO: {len(names)} title files')

    @staticmethod
    def titles(raw: Path) -> list[str]:
        found = [path.name.removeprefix('crs2026-title-').removesuffix('.htm') for path in (raw / 'htm').glob('crs2026-title-*.htm')]
        return sorted((name for name in found if name != '00'), key=lambda name: float(name))

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for title in self.titles(raw):
            lines = lines_of((raw / 'htm' / f'crs2026-title-{title}.htm').read_text(encoding='cp1252', errors='replace'))
            title_name, article_name, part_name = '', '', ''
            starts = []
            for index, line in enumerate(lines):
                if HEADING.match(line) and not (index + 1 < len(lines) and HEADING.match(lines[index + 1])):
                    starts.append(index)
            start_set = set(starts)
            current: list | None = None
            sections: list[Section] = []

            def finish(item):
                if item is None:
                    return
                number, heading, body, history, label = item
                text = clean(' '.join(body))
                status = 'repealed' if GONE.search(heading) or (GONE.match(text) and len(text) < 300) else ('live' if text else 'reserved')
                heading = re.sub(r'\s*\((?:Repealed|Transferred|Renumbered|Expired|Reserved)\)\s*$', '', heading).rstrip('.').strip()
                law = LAW.match(history)
                year = None
                if law:
                    year = int(law.group(1))
                    year = year + 1900 if year < 100 else year
                act = ''
                if law and law.group(2):
                    act = f'{year}-{law.group(2)}'
                elif law:
                    page = PAGE.match(history)
                    act = f'{year}-p{page.group(1)}' if page else ''
                sections.append(Section(number=number, heading=heading, text=text, history=history, status=status, url=PDF.format(title=title),
                                        title=title, title_name=label, act=act, enacted=[year] if year else None))

            for index, line in enumerate(lines):
                if index < 3 and line.upper().startswith('TITLE') and not title_name:
                    title_name = f"Title {title}. {lines[index + 1].title() if index + 1 < len(lines) else ''}".strip()
                if re.fullmatch(r'ARTICLE \d+(?:\.\d+)?', line) and index + 1 < len(lines):
                    article_name, part_name = f'{line.title()}. {lines[index + 1]}', ''
                    continue
                if re.fullmatch(r'PART \d+(?:\.\d+)?', line) and index + 1 < len(lines):
                    part_name = f'{line.title()}. {lines[index + 1]}'
                    continue
                if index in start_set:
                    finish(current)
                    match = HEADING.match(line)
                    label = ' / '.join(part for part in (title_name, article_name, part_name) if part)
                    current = [match.group(1), match.group(2), [], '', label]
                    continue
                if current is None:
                    continue
                if current[3]:  # past the source note: editor's notes and cross references are not the section's text
                    continue
                if line.startswith('Source:'):
                    current[3] = line
                    continue
                if re.fullmatch(r'(?:ARTICLE|PART) \d+(?:\.\d+)?', line) or HEADING.match(line):
                    continue
                current[2].append(line)
            finish(current)
            # A contents line followed by a part heading looks like a section start; a number printed twice (a contents line, or a
            # section with a version in force until a date and one from that date) keeps the first printing with a source note.
            chosen: dict[str, Section] = {}
            for section in sections:
                held = chosen.get(section.number)
                if held is None or (not held.history and section.history):
                    chosen[section.number] = section
            for section in sections:
                if chosen.get(section.number) is section and section.number not in seen:
                    seen.add(section.number)
                    yield section


ADAPTER = Colorado()
