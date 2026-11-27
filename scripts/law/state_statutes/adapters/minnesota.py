"""Minnesota: the Minnesota Statutes, read from the Revisor of Statutes' full-text chapter pages (revisor.mn.gov/statutes/cite/<chapter>/full),
listed on the part pages linked from its index."""
from __future__ import annotations

import concurrent.futures
import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

BASE = 'https://www.revisor.mn.gov/statutes/'
LAW = re.compile(r'(\d{4}) c (\d+)')
SMALL = {'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with', 'upon', 'under', 'nor', 'du'}
ACRONYMS = {'mfip', 'hiv', 'aids', 'snap', 'cca', 'atv', 'atvs', 'tanf', 'ems', 'psap', 'icwa', 'dwi', 'pca', 'hmo', 'gps', 'ii', 'iii', 'iv', 'u.s.', 'mmiw', 'mmir', 'cdbg', 'wic', 'esst', 'ppe'}
START = re.compile(r'<div class="(section|sr|sr_by_subd)" id="stat\.([^"]+)">')


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


def title_case(text: str) -> str:
    """The Revisor prints catchlines in capitals ("INDIAN AFFAIRS COUNCIL."): give them title case, small words lower."""
    words = text.lower().split(' ')
    out = []
    for index, word in enumerate(words):
        bare = word.strip('();,:.')
        if bare in ACRONYMS:
            out.append(word.upper())
        elif index and bare in SMALL and not out[-1].endswith((';', ':')):
            out.append(word)
        else:
            out.append(re.sub(r"[a-z]", lambda m: m.group(0).upper(), word, count=1))
    return ' '.join(out)


class Minnesota(State):
    STATE = 'MN'
    NAME = 'Minnesota'
    CODE_NAME = 'Minnesota Statutes'
    CODE_SHORT = 'Minn. Stat.'
    AUTHOR = 'Minnesota Office of the Revisor of Statutes'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'minnesota-statutes'
    SOURCE_NOTE = "Text read from the Minnesota Revisor of Statutes' full-text chapter page for the section (revisor.mn.gov/statutes) on Nov. 27, 2026."
    NATION_NAMES = ('Ojibwe', 'Ojibwa', 'Chippewa', 'Anishinaabe', 'Dakota', 'Mdewakanton', 'Sioux', 'Mille Lacs Band', 'Leech Lake Band',
                    'Red Lake Band', 'Red Lake Nation', 'White Earth', 'Fond du Lac Band', 'Grand Portage Band', 'Bois Forte', 'Nett Lake',
                    'Prairie Island', 'Shakopee', 'Lower Sioux', 'Upper Sioux', 'Winnebago', 'Ho-Chunk')
    PLACE_NAMES = ('North Dakota', 'South Dakota', 'Dakota County', 'Dakota Territory', 'Sioux Falls', 'Big Sioux', 'Sioux City', 'Chippewa County',
                   'Chippewa River', 'Chippewa National Forest', 'Chippewa Falls', 'Shakopee Public Utilities', 'city of Shakopee', 'City of Shakopee',
                   'Shakopee School', 'Winnebago County', 'Prairie Island Nuclear', 'Prairie Island nuclear', 'Prairie Island Generating',
                   'Prairie Island generating', 'Prairie Island plant')
    WORKERS = 8

    def chapters_of(self, url: str) -> list[str]:
        page = self.get(url).decode('utf-8', 'replace')
        return re.findall(r'href="https://www\.revisor\.mn\.gov/statutes/cite/([0-9A-Z]+)"', page)

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'chapters.json'
        if not listing.exists():
            index = self.get(BASE).decode('utf-8', 'replace')
            parts = list(dict.fromkeys(re.findall(r'href="(https://www\.revisor\.mn\.gov/statutes/part/[^"]+)"', index)))
            with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
                chapters = list(dict.fromkeys(chapter for found in pool.map(self.chapters_of, parts) for chapter in found))
            listing.write_text(json.dumps(chapters))
            print(f'MN: {len(parts)} parts, {len(chapters)} chapters')
        chapters = json.loads(listing.read_text())
        failed = self.download_all((f'{BASE}cite/{chapter}/full', raw / 'chapters' / f'{chapter}.html') for chapter in chapters)
        print(f'MN: {len(chapters)} chapters, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for chapter in json.loads((raw / 'chapters.json').read_text()):
            path = raw / 'chapters' / f'{chapter}.html'
            if not path.exists():
                raise SystemExit(f'MN chapter {chapter} was not downloaded: run fetch again')
            page = path.read_text(errors='replace')
            name = re.search(r'<h2 class="chapter_title">(.*?)</h2>', page, re.S)
            chapter_name = 'Chapter ' + chapter + ': ' + title_case(re.sub(r'^CHAPTER \S+\s*', '', text_of(name.group(1)))) if name else ''
            starts = list(START.finditer(page))
            for index, start in enumerate(starts):
                end = starts[index + 1].start() if index + 1 < len(starts) else len(page)
                chunk = page[start.end():end]
                kind, number = start.group(1), start.group(2)
                if number in seen:
                    continue
                seen.add(number)
                history_match = re.search(r'<div class="history"[^>]*>(.*?)</div>', chunk, re.S)
                history = text_of(history_match.group(1)).removeprefix('History:').strip() if history_match else ''
                body = chunk[:history_match.start()] if history_match else chunk
                url = f'{BASE}cite/{number}'
                if kind == 'sr':  # "[Repealed, 1961 c 561 s 17]", "[Renumbered 3.99]"
                    yield Section(number=number, heading='', text=text_of(body), url=url, title=chapter, title_name=chapter_name, status='repealed')
                    continue
                head = re.search(r'<h1[^>]*>(.*?)</h1>', body, re.S)
                heading = text_of(head.group(1)) if head else ''
                heading = re.sub(r'^' + re.escape(number) + r'\s*', '', heading).rstrip('.').strip()
                text = text_of(body[head.end():] if head else body)
                text = re.sub(r'(?:^|\s)§(?=\s)', ' ', text).strip()
                gone = r'^\[?(?:Repealed|Renumbered|Expired|Obsolete|Reserved)\b'
                status = 'live'
                if kind == 'sr_by_subd' or re.match(gone, text, re.I) and len(text) < 300:
                    # Every subdivision repealed, or a section whose only text is a repeal note.
                    if not re.sub(r'(?:Subdivision|Subd\.) [0-9a-z]+\.\s*\[(?:Repealed|Renumbered|Expired)[^\]]*\]\s*', '', text).strip() or re.match(gone, text, re.I):
                        status = 'repealed'
                # Only a session law at the head of the history line is the enactment: "(10565) RL s 5224; 1983 c 359 s 110" was
                # first enacted before the Revised Laws of 1905, and 1983 c 359 only amended it.
                law = LAW.search(history.split(';')[0])
                yield Section(number=number, heading=title_case(heading), text=text, url=url, title=chapter, title_name=chapter_name, history=history,
                              status=status, act=f'{law.group(1)}-{law.group(2)}' if law else '', enacted=[int(law.group(1))] if law else None)


ADAPTER = Minnesota()
