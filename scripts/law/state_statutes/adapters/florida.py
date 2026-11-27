"""Florida: the Florida Statutes, read from the Legislature's whole-chapter pages (leg.state.fl.us/statutes, Display_Statute
<range>/<chapter>/<chapter>.html), with the chapters listed on each title's index page. Each record links to the section's own page."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

BASE = 'https://www.leg.state.fl.us/statutes/index.cfm?'
LAW = re.compile(r'^s{1,2}\. [^;]*?ch\. (\d{2,4}-\d+|\d+), (\d{4})')
NEW_LAW = re.compile(r'^s{1,2}\. [^;]*?ch\. (\d{2}|\d{4})-(\d+)')


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' ').replace(' ', ' '))


def capitals(text: str) -> str:
    """Chapter names are printed in capitals ("INDIAN RESERVATIONS AND AFFAIRS"): give them title case, small words lower."""
    small = {'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with'}
    words = text.lower().split(' ')
    return ' '.join(word if index and word in small else word[:1].upper() + word[1:] for index, word in enumerate(words))


class Florida(State):
    STATE = 'FL'
    NAME = 'Florida'
    CODE_NAME = 'Florida Statutes'
    CODE_SHORT = 'Fla. Stat.'
    AUTHOR = 'Florida Legislature'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'florida-statutes'
    SOURCE_NOTE = "Text read from the Florida Legislature's page for the section's chapter in the 2026 Florida Statutes (leg.state.fl.us/statutes) on Nov. 27, 2026."
    NATION_NAMES = ('Seminole', 'Seminoles', 'Miccosukee', 'Muscogee', 'Creek Indians', 'Poarch')
    PLACE_NAMES = ('Seminole County', 'City of Seminole', 'city of Seminole', 'Seminole State College', 'Seminole Community College',
                   'Seminole Boulevard', 'Lake Seminole', 'Seminole-Orange', 'Indian River', 'Indian River County', 'Indian River Lagoon',
                   'Indian River State College', 'Indian Rocks Beach', 'Indian Creek', 'Indian Harbour Beach', 'Indian Shores',
                   'Indian Key', 'Indian Prairie', 'Indian Trail', 'Lake Miccosukee')
    WORKERS = 6

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'chapters.json'
        if not listing.exists():
            front = self.get(f'{BASE}Mode=View%20Statutes&Submenu=1&Tab=statutes').decode('utf-8', 'replace')
            titles = list(dict.fromkeys(re.findall(r'Title_Request=([IVXL]+)', front)))
            chapters = []
            for title in titles:
                page = self.get(f'{BASE}App_mode=Display_Index&Title_Request={title}').decode('utf-8', 'replace')
                for folder, chapter in re.findall(r'URL=(\d{4}-\d{4})/(\d{4}[A-Z]?)/\2ContentsIndex\.html', page):
                    chapters.append([title, folder, chapter])
            chapters = [list(row) for row in dict.fromkeys(tuple(row) for row in chapters)]
            listing.write_text(json.dumps(chapters))
            print(f'FL: {len(titles)} titles, {len(chapters)} chapters')
        chapters = json.loads(listing.read_text())
        failed = self.download_all((f'{BASE}App_mode=Display_Statute&URL={folder}/{chapter}/{chapter}.html', raw / 'chapters' / f'{chapter}.html')
                                   for title, folder, chapter in chapters)
        print(f'FL: {len(chapters)} chapters, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for title, folder, chapter in json.loads((raw / 'chapters.json').read_text()):
            path = raw / 'chapters' / f'{chapter}.html'
            if not path.exists():
                raise SystemExit(f'FL chapter {chapter} was not downloaded: run fetch again')
            page = path.read_text(errors='replace')
            name = re.search(r'<div class="ChapterName">(.*?)</div>', page, re.S)
            title_name = f"Chapter {chapter.lstrip('0')}: {capitals(text_of(name.group(1)))}" if name else f"Chapter {chapter.lstrip('0')}"
            starts = [match.start() for match in re.finditer(r'<div class="Section">', page)]
            for index, start in enumerate(starts):
                end = starts[index + 1] if index + 1 < len(starts) else len(page)
                chunk = page[start:end]
                number_match = re.search(r'<span class="SectionNumber">(.*?)</span>', chunk, re.S)
                if not number_match:
                    continue
                number = text_of(number_match.group(1)).rstrip('.')
                if number in seen:
                    continue
                seen.add(number)
                head = re.search(r'<span[^>]*class="CatchlineText"[^>]*>(.*?)</span>', chunk, re.S)
                heading = text_of(head.group(1)).rstrip('.').strip() if head else ''
                history_match = re.search(r'<div class="History">(.*?)</div>', chunk, re.S)
                history = text_of(history_match.group(1)) if history_match else ''
                history = re.sub(r'^History\s*\.?\s*[—-]\s*', '', history).strip()
                body = re.search(r'<span class="SectionBody">(.*)', chunk, re.S)
                main = body.group(1) if body else ''
                if history_match and body:
                    main = chunk[body.start(1):history_match.start()]
                main = re.sub(r'<div class="Note">.*?</div>', ' ', main, flags=re.S)
                text = text_of(main)
                status = 'repealed' if re.match(r'^(?:Repealed|Transferred|Renumbered|Expired)\b', text) and len(text) < 300 else 'live'
                law = LAW.match(history)
                new = NEW_LAW.match(history)
                year = (int(new.group(1)) + (1900 if len(new.group(1)) == 2 else 0)) if new else None
                act = f'{year}-{new.group(2)}' if new else (f'{law.group(2)}-{law.group(1)}' if law else '')
                folder_section = f'{folder}/{chapter}/Sections/{chapter}.{number.split(".", 1)[1]}.html' if '.' in number else ''
                yield Section(number=number, heading=heading, text=text,
                              url=f'{BASE}App_mode=Display_Statute&URL={folder_section}' if folder_section else f'{BASE}App_mode=Display_Statute&URL={folder}/{chapter}/{chapter}.html',
                              title=chapter, title_name=title_name, history=history, status=status, act=act,
                              enacted=[int(law.group(2))] if law else ([year] if new else None))


ADAPTER = Florida()
