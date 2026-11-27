"""Alaska: the Alaska Statutes, read from the Legislature's print view of each title
(akleg.gov/basis/statutes.asp?media=print&secStart=<title>&secEnd=<title>.99.999). The print view has no history lines."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

BASE = 'https://www.akleg.gov/basis/statutes.asp'
TITLES = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
          37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47]


def text_of(fragment: str) -> str:
    fragment = re.sub(r'<br\s*/?>', ' ', fragment, flags=re.I)
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


class Alaska(State):
    STATE = 'AK'
    NAME = 'Alaska'
    CODE_NAME = 'Alaska Statutes'
    CODE_SHORT = 'Alaska Stat.'
    AUTHOR = 'Alaska State Legislature'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'alaska-statutes'
    SOURCE_NOTE = "Text read from the Alaska State Legislature's print view of the Alaska Statutes 2025 (akleg.gov/basis/statutes.asp) on Nov. 27, 2026."
    NATION_NAMES = ('Tlingit', 'Haida', 'Tsimshian', 'Metlakatla', 'Annette Island', 'Athabascan', 'Athabaskan', 'Yupik', "Yup'ik", 'Inupiat',
                    'Inupiaq', 'Aleut', 'Alutiiq', 'Eyak', 'Gwich', 'Native village', 'Native corporation', 'Native corporations',
                    'regional corporation', 'village corporation', 'Alaska Native Claims Settlement', 'ANCSA', 'Eskimo')
    PLACE_NAMES = ('Haida Gwaii', 'Aleutian Islands', 'Aleutians East', 'Aleutians West', 'Aleutian Chain', 'Aleutian', 'Annette Island Reserve airport')
    WORKERS = 3

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        (raw / 'titles.json').write_text(json.dumps(TITLES))
        failed = self.download_all((f'{BASE}?media=print&secStart={title}&secEnd={title}.99.999', raw / 'titles' / f'{title:02d}.html')
                                   for title in TITLES)
        print(f'AK: {len(TITLES)} titles, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for title in json.loads((raw / 'titles.json').read_text()):
            page = (raw / 'titles' / f'{title:02d}.html').read_bytes().decode('windows-1252', 'replace')
            title_name, chapter_name, article_name = '', '', ''
            pieces = re.split(r'(<b>(?:<a name="[0-9.]+">\s*</a>)?(?:<h[5-7]>.*?</h[5-7]>|Sec\.\s*[0-9A-Z.]+\..*?</b>))', page, flags=re.S)
            current = None

            def finish():
                if current is None:
                    return None
                number, heading, names, body = current
                text = text_of(body)
                gone = r'^\[?(?:Repealed|Renumbered|Reserved|Expired|Omitted)\b'
                status = 'repealed' if re.match(gone, heading, re.I) or re.match(r'^\[(?:Repealed|Renumbered)', text, re.I) else ('reserved' if not text else 'live')
                return Section(number=number, heading=heading, text=text, url=f'{BASE}#{number}', title='.'.join(number.split('.')[:2]),
                               title_name=names, status=status)

            for index, piece in enumerate(pieces):
                if index % 2 == 0:
                    if current is not None:
                        current[3] += piece
                    continue
                head = re.search(r'<h([5-7])>(.*?)</h\1>', piece, re.S)
                if head:
                    name = text_of(head.group(2)).rstrip('.')
                    if head.group(1) == '5':
                        title_name, chapter_name, article_name = name, '', ''
                    elif head.group(1) == '6':
                        chapter_name, article_name = name, ''
                    else:
                        article_name = name
                    continue
                section = finish()
                if section and section.number not in seen:
                    seen.add(section.number)
                    yield section
                match = re.search(r'Sec\.\s*([0-9A-Z.]+?)\.\s+(.*?)</b>', piece, re.S)
                heading = text_of(match.group(2)).rstrip('.') if match else ''
                names = ' / '.join(name for name in (title_name, chapter_name, article_name) if name)
                current = [match.group(1), heading, names, ''] if match else None
            section = finish()
            if section and section.number not in seen:
                yield section


ADAPTER = Alaska()
