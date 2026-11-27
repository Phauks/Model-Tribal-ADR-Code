"""Oregon: the Oregon Revised Statutes, 2025 edition, read from the Legislature's whole-chapter pages
(oregonlegislature.gov/bills_laws/ors/ors<NNN>.html). There is no chapter index to script, so fetch tries every number from 1 to
838 with and without a letter, as the tier 2 and 3 study did (scripts/analysis/oregon_statutes_count.py)."""
from __future__ import annotations

import html
import re
import urllib.error
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

PAGE = 'https://www.oregonlegislature.gov/bills_laws/ors/ors{}.html'
HEAD = re.compile(r'^(\d{1,3}[A-C]?\.\d{3}[0-9]*)\s+(.*)$')
LAW = re.compile(r'(\d{4})(?: (?:s\.s\.\d?|\d\w* s\.s\.))? c\.(\d+)')


class Oregon(State):
    STATE = 'OR'
    NAME = 'Oregon'
    CODE_NAME = 'Oregon Revised Statutes'
    CODE_SHORT = 'Or. Rev. Stat.'
    AUTHOR = 'Oregon Legislative Assembly'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'oregon-revised-statutes'
    SOURCE_NOTE = "Text read from the Oregon Legislature's 2025 edition chapter page for the section (oregonlegislature.gov/bills_laws/ors) on Nov. 27, 2026."
    NATION_NAMES = ('Warm Springs', 'Umatilla', 'Siletz', 'Grand Ronde', 'Klamath Tribes', 'Coquille', 'Burns Paiute', 'Paiute',
                    'Cow Creek', 'Umpqua', 'Coos', 'Lower Umpqua', 'Siuslaw', 'Cayuse', 'Walla Walla')
    PLACE_NAMES = ('Klamath County', 'Klamath Falls', 'Umatilla County', 'Coos County', 'Coos Bay', 'Douglas County', 'Siuslaw River',
                   'Umpqua River', 'city of Umatilla', 'Walla Walla, Washington', 'Siletz River', 'Klamath River', 'Coquille River',
                   'city of Coquille', 'Warm Springs Avenue')

    def fetch(self, raw: Path) -> None:
        names = [f'{number:03d}{letter}' for number in range(1, 839) for letter in ('', 'A', 'B', 'C')]
        todo = [name for name in names if not (raw / 'chapters' / f'{name}.html').exists() and not (raw / 'missing' / name).exists()]
        (raw / 'missing').mkdir(parents=True, exist_ok=True)
        (raw / 'chapters').mkdir(parents=True, exist_ok=True)
        import concurrent.futures

        def one(name):
            try:
                data = self.get(PAGE.format(name), tries=2)
            except urllib.error.HTTPError as error:
                if error.code == 404:
                    (raw / 'missing' / name).touch()
                    return None
                return name
            except Exception:
                return name
            (raw / 'chapters' / f'{name}.html').write_bytes(data)
            return None

        with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
            failed = [name for name in pool.map(one, todo) if name]
        print(f"OR: {len(list((raw / 'chapters').glob('*.html')))} chapters, {len(failed)} failed", *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        order = lambda path: (int(path.stem[:3]), path.stem[3:])
        for path in sorted((raw / 'chapters').glob('*.html'), key=order):
            page = path.read_bytes().decode('windows-1252', 'replace')
            chapter = str(int(path.stem[:3])) + path.stem[3:]
            flat = clean(html.unescape(re.sub(r'<[^>]+>', ' ', page))).replace('\xa0', ' ')
            name_match = re.search(r'Chapter ' + re.escape(chapter) + r' [—-] (.*?) (?:ORS sections|\d{4} EDITION)', flat)
            name = clean(name_match.group(1)) if name_match else ''
            current, body, editorial = None, [], False
            for block in re.findall(r'<p[ >].*?</p>', page, re.S):
                paragraph = clean(html.unescape(re.sub(r'<[^>]+>', ' ', block)).replace('\xa0', ' '))
                head = HEAD.match(paragraph)
                # A section starts with its number and catchline in bold; the chapter's table of contents is not bold.
                if head and head.group(1).split('.')[0] == chapter and re.match(r'<p[^>]*>\s*<b>', block):
                    if current:
                        yield self.section(current, body, path.stem, chapter, name)
                    current, body, editorial = head, [], False
                elif paragraph.startswith(('Note:', 'Note 1:', 'Note 2:', 'Note 3:', '_____')):
                    editorial = True
                elif paragraph and not re.search(r'[a-z]', paragraph) and len(paragraph) < 160:
                    continue  # a group heading in capitals ("INDIAN CHILD WELFARE") belongs to the sections after it
                elif current is not None and paragraph and not editorial:
                    body.append(paragraph)
            if current:
                yield self.section(current, body, path.stem, chapter, name)

    def section(self, head, body: list[str], stem: str, chapter: str, name: str) -> Section:
        number, rest = head.group(1), head.group(2)
        if rest.startswith('['):  # "1.010 [Repealed by 1981 s.s. c.3 §141]"
            return Section(number=number, heading='', text=rest, url=PAGE.format(stem), title=chapter, status='repealed')
        # The catchline ends at its first period that is followed by the text (or by the end, for a short section).
        split = re.match(r'^(.*?\.)(?:\s+(.*))?$', rest)
        heading, first = (split.group(1), split.group(2) or '') if split else (rest, '')
        text = clean(' '.join([first] + body))
        history = ''
        tail = re.search(r'\[([^\[\]]*\d{4}[^\[\]]*)\]\s*$', text)
        if tail:
            history, text = f'[{tail.group(1)}]', text[:tail.start()].strip()
        laws = LAW.findall(history)
        return Section(number=number, heading=heading.rstrip('.'), text=text, url=PAGE.format(stem), title=chapter,
                       title_name=f'ORS chapter {chapter}: {name}' if name else f'ORS chapter {chapter}', history=history,
                       act=f'{laws[0][0]}-{laws[0][1]}' if laws else '', enacted=[int(laws[0][0])] if laws else None)


ADAPTER = Oregon()
