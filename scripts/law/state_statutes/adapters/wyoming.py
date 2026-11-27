"""Wyoming: the Wyoming Statutes, read from the Legislative Service Office's title PDFs (wyoleg.gov/statutes/compress/title<nn>.pdf).
The PDFs print no history lines, so the records carry no enactment year and the near sample is drawn only from sections printed
next to a strong hit. Each record links to its title's PDF at the page where the section starts."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://wyoleg.gov'
TITLES = [f'{number:02d}' for number in range(1, 43)]
START = re.compile(r'^ {3,}(\d+-\d+(?:\.\d+)?-\d+(?:\.\d+)?)\.\s+(.*)$')
GONE = re.compile(r'^\[?(?:Repealed|Renumbered|Transferred|Expired|Reserved|Omitted|Obsolete|Superseded)\b', re.I)


class Wyoming(State):
    STATE = 'WY'
    NAME = 'Wyoming'
    CODE_NAME = 'Wyoming Statutes'
    CODE_SHORT = 'Wyo. Stat. Ann.'
    AUTHOR = 'Wyoming Legislative Service Office'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'wyoming-statutes'
    SOURCE_NOTE = "Text read from the Wyoming Legislative Service Office's PDF of the section's title of the Wyoming Statutes (wyoleg.gov/statutes) on Nov. 27, 2026."
    NATION_NAMES = ('Shoshone', 'Arapaho', 'Eastern Shoshone', 'Northern Arapaho', 'Wind River', 'Crow Tribe', 'Sioux', 'Cheyenne Tribe',
                    'Northern Cheyenne')
    PLACE_NAMES = ('Shoshone National Forest', 'Shoshone River', 'Shoshone Canyon', 'Shoshone Lake', 'town of Shoshoni', 'Shoshoni',
                   'Wind River Range', 'Wind River Canyon', 'Wind River Mountains', 'Wind River Basin', 'Arapahoe', 'Indian Paintbrush',
                   'Sioux City')
    WORKERS = 4

    def fetch(self, raw: Path) -> None:
        failed = self.download_all((f'{SITE}/statutes/compress/title{number}.pdf', raw / 'pdfs' / f'title{number}.pdf') for number in TITLES)
        print(f'WY: {len(TITLES)} title PDFs, {len(failed)} failed', *failed[:10])

    def short_citation(self, number: str) -> str:
        return f'{self.CODE_SHORT} § {number}'

    def pages(self, path: Path) -> list[str]:
        cache = path.with_suffix('.txt')
        if not cache.exists():
            cache.write_text(subprocess.run(['pdftotext', '-layout', '-enc', 'UTF-8', str(path), '-'], capture_output=True, text=True).stdout)
        return cache.read_text().split('\f')

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for number in TITLES:
            path = raw / 'pdfs' / f'title{number}.pdf'
            if not path.exists():
                raise SystemExit(f'WY title {number} was not downloaded: run fetch again')
            title_name, chapter_name, article_name = '', '', ''
            current = None  # [number, heading lines, text lines, page, heading done, chapter label]
            url = f'{SITE}/statutes/compress/title{number}.pdf'

            def finish(item):
                if item is None or item[0] in seen:
                    return None
                seen.add(item[0])
                heading = clean(' '.join(item[1])).rstrip('.').strip()
                text = clean(' '.join(item[2]))
                status = 'repealed' if GONE.match(heading) or (GONE.match(text) and len(text) < 300) else ('live' if text else 'reserved')
                return Section(number=item[0], heading=heading, text=text, url=f'{url}#page={item[3]}', title=number,
                               title_name=item[5], status=status, extra={'page': item[3]})

            for page_number, page in enumerate(self.pages(path), 1):
                for line in page.split('\n'):
                    stripped = line.strip()
                    heading = re.match(r'^(TITLE|CHAPTER|ARTICLE) [0-9A-Z.]+ - (.*)$', stripped)
                    if heading and stripped == stripped.upper():
                        if heading.group(1) == 'TITLE':
                            title_name = stripped.title()
                        elif heading.group(1) == 'CHAPTER':
                            chapter_name, article_name = stripped.title(), ''
                        else:
                            article_name = stripped.title()
                        continue
                    start = START.match(line)
                    if start:
                        section = finish(current)
                        if section:
                            yield section
                        label = ' / '.join(part for part in (title_name, chapter_name, article_name) if part)
                        current = [start.group(1), [start.group(2)], [], page_number, False, label]
                        if start.group(2).rstrip().endswith('.'):
                            current[4] = True
                        continue
                    if current is None:
                        continue
                    if not current[4]:
                        if stripped:
                            current[1].append(stripped)
                            if stripped.endswith('.'):
                                current[4] = True
                        else:
                            current[4] = True
                        continue
                    if stripped:
                        current[2].append(stripped)
            section = finish(current)
            if section:
                yield section


ADAPTER = Wyoming()
