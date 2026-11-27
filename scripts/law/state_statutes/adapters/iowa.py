"""Iowa: the Iowa Code, read from the Legislative Services Agency's XML file for each chapter (legis.iowa.gov/docs/publications/ICC/<year>/
attachments/<chapter>_slim.xml), listed on each title's chapter page (legis.iowa.gov/law/iowaCode). Each record links to the section's
own PDF, the Legislature's official form of the section."""
from __future__ import annotations

import html
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://www.legis.iowa.gov'
YEAR = 2026
TITLES = ('I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI')
# A session law: "86 Acts, ch 1245, §1201" (two-digit years are 19xx) or "2004 Acts, ch 1020, §2".
LAW = re.compile(r'^(\d{2}|\d{4}) Acts, ch (\d+)')
GONE = re.compile(r'^(?:Repealed|Transferred|Reserved|Expired|Rescinded|Omitted|Obsolete|Renumbered)\b', re.I)


def text_of(fragment: str) -> str:
    fragment = re.sub(r'<xhtml:span class="em-dash"\s*/>', ' — ', fragment)
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


def chapter_key(chapter: str) -> tuple:
    match = re.match(r'(\d+)(.*)', chapter)
    return (int(match.group(1)), match.group(2)) if match else (0, chapter)


class Iowa(State):
    STATE = 'IA'
    NAME = 'Iowa'
    CODE_NAME = 'Iowa Code'
    CODE_SHORT = 'Iowa Code'
    AUTHOR = 'Iowa Legislature'
    EDITION = YEAR
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'iowa-code'
    SOURCE_NOTE = "Text read from the Iowa Legislature's XML file for the chapter of the Iowa Code (2026 edition, legis.iowa.gov) on Nov. 27, 2026."
    NATION_NAMES = ('Meskwaki', 'Sac and Fox', 'Mesquakie', 'Tama Settlement', 'Omaha Tribe', 'Winnebago Tribe', 'Ho-Chunk', 'Ioway', 'Iowa Tribe',
                    'Ponca Tribe', 'Indian settlement')
    PLACE_NAMES = ('Sac County', 'Sac City', 'Winnebago County', 'Pottawattamie County', 'Pottawatomie County', 'Sioux County', 'Sioux City',
                   'Sioux Center', 'Cherokee County', 'Ida County', 'Osceola County', 'Black Hawk County', 'Black Hawk', 'Keokuk County',
                   'Keokuk', 'Wapello County', 'Mahaska County', 'Appanoose County', 'Poweshiek County', 'Winneshiek County', 'Tama County',
                   'city of Tama', 'Tama city', 'Indianola', 'Indian Creek', 'Big Sioux', 'Little Sioux', 'Iowa River', 'Iowa City',
                   'Ottumwa', 'Muscatine', 'Decorah', 'Oskaloosa', 'Cherokee', 'Missouri River')
    WORKERS = 6

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'chapters.txt'
        if not listing.exists():
            chapters = []
            for title in TITLES:
                page = self.get(f'{SITE}/law/iowaCode/chapters?title={title}&year={YEAR}').decode('utf-8', 'replace')
                chapters += [(title, chapter) for chapter in dict.fromkeys(re.findall(r'sections\?codeChapter=([0-9A-Za-z]+)&', page))]
            listing.write_text(''.join(f'{title}\t{chapter}\n' for title, chapter in chapters))
            print(f'IA: {len(chapters)} chapters')
        chapters = [line.split('\t') for line in listing.read_text().splitlines()]
        failed = self.download_all((f'{SITE}/docs/publications/ICC/{YEAR}/attachments/{chapter}_slim.xml', raw / 'xml' / f'{chapter}.xml')
                                   for _title, chapter in chapters)
        print(f'IA: {len(chapters)} chapters, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        for title, chapter in (line.split('\t') for line in (raw / 'chapters.txt').read_text().splitlines()):
            path = raw / 'xml' / f'{chapter}.xml'
            if not path.exists():
                raise SystemExit(f'IA chapter {chapter} was not downloaded: run fetch again')
            page = path.read_text(errors='replace')
            body = page[page.find('<slim:Body'):]
            name = re.search(r'<slim:Heading class="heading"><xhtml:span class="identifier">[^<]*</xhtml:span><xhtml:span class="headnote">(.*?)</xhtml:span></slim:Heading>', body, re.S)
            chapter_name = text_of(name.group(1)) if name else ''
            subchapter = ''
            for match in re.finditer(r'<slim:Level class="codeSubchapter"[^>]*><slim:Heading class="heading">(.*?)</slim:Heading>|<slim:Section class="codeSection" id="sec([^"]+)">(.*?)</slim:Section>', body, re.S):
                if match.group(1) is not None:
                    subchapter = text_of(match.group(1))
                    continue
                number, inner = match.group(2), match.group(3)
                head = re.match(r'\s*<xhtml:div class="heading"><xhtml:span class="identifier">[^<]*</xhtml:span>(?:<xhtml:span class="headnote"\s*/>|<xhtml:span class="headnote">(.*?)</xhtml:span>)?</xhtml:div>', inner, re.S)
                heading = text_of(head.group(1)).rstrip('.').strip() if head and head.group(1) else ''
                rest = inner[head.end():] if head else inner
                rest = re.sub(r'<xhtml:div class="footnotes".*$', '', rest, flags=re.S)
                start = rest.find('<xhtml:div class="history">')
                items = re.findall(r'<xhtml:div class="historyItem">(.*?)</xhtml:div>', rest[start:], re.S) if start >= 0 else []
                history = '; '.join(text_of(item) for item in items)
                rest = rest[:start] if start >= 0 else rest
                text = text_of(rest)
                status = 'live'
                if GONE.match(text) and len(text) < 300:
                    status = 'reserved' if text.lower().startswith('reserved') else 'repealed'
                elif not text:
                    status = 'reserved'
                # Only a session law at the head of the history line is the enactment (a line that opens "C93, §216A.1" or
                # "R60, §..." names an earlier code, and the session laws after it are amendments).
                law = LAW.match(history)
                year = None
                if law:
                    year = int(law.group(1)) if len(law.group(1)) == 4 else 1900 + int(law.group(1))
                yield Section(number=number, heading=heading, text=text, url=f'{SITE}/docs/code/{number}.pdf', title=chapter,
                              title_name=' / '.join(part for part in (f'Title {title}', f'Chapter {chapter}: {chapter_name.title()}', subchapter) if part),
                              history=history, status=status, act=f'{year}-{law.group(2)}' if law else '', enacted=[year] if year else None)


ADAPTER = Iowa()
