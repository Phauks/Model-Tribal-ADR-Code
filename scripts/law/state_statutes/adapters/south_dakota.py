"""South Dakota: the South Dakota Codified Laws, read from the Legislature's statutes service (sdlegislature.gov/api/Statutes), one
call per chapter. Each title's answer lists its chapters and sections; each chapter's answer holds every section's text."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

API = 'https://sdlegislature.gov/api/Statutes/Statute/'
PAGE = 'https://sdlegislature.gov/Statutes/'
LAW = re.compile(r'SL (\d{4}), ch (\d+)')
NUMBER = re.compile(r'^(\d+[A-Z]?-\d+[A-Z]?-[\d.]+[A-Z]?)$')


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


class SouthDakota(State):
    STATE = 'SD'
    NAME = 'South Dakota'
    CODE_NAME = 'South Dakota Codified Laws'
    CODE_SHORT = 'S.D. Codified Laws'
    AUTHOR = 'South Dakota Legislature'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'south-dakota-codified-laws'
    SOURCE_NOTE = "Text read from the South Dakota Legislature's statutes service for the section's chapter (sdlegislature.gov/Statutes) on Nov. 27, 2026."
    NATION_NAMES = ('Oglala', 'Lakota', 'Nakota', 'Sioux', 'Rosebud', 'Pine Ridge', 'Cheyenne River', 'Standing Rock', 'Crow Creek',
                    'Lower Brule', 'Ihanktonwan', 'Sisseton', 'Wahpeton', 'Flandreau Santee', 'Santee', 'Sicangu', 'Oceti Sakowin')
    PLACE_NAMES = ('Sioux Falls', 'Big Sioux', 'Sioux City', 'Little Sioux', 'Sioux Valley', 'Sioux Empire', 'Pine Ridge Road')
    WORKERS = 8

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'chapters.json'
        if not listing.exists():
            import concurrent.futures

            def title(number: int):
                try:
                    answer = json.loads(self.get(API + str(number)))
                except Exception:
                    return number, None
                return number, answer

            chapters = {}
            with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
                for number, answer in pool.map(title, range(1, 70)):
                    if not answer or answer.get('Type') != 'Title':
                        continue
                    found = re.findall(r'Statute=([0-9A-Z.-]+)"', answer.get('Html') or '')
                    for statute in found:
                        parts = statute.split('-')
                        if len(parts) >= 2:
                            chapters.setdefault('-'.join(parts[:2]), (answer.get('CatchLine') or '').strip().title().replace("'S ", "'s "))
            listing.write_text(json.dumps(chapters))
            print(f'SD: {len(chapters)} chapters')
        chapters = json.loads(listing.read_text())
        failed = self.download_all((API + chapter, raw / 'chapters' / f'{chapter}.json') for chapter in chapters)
        print(f'SD: {len(chapters)} chapters, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for chapter, title_name in json.loads((raw / 'chapters.json').read_text()).items():
            path = raw / 'chapters' / f'{chapter}.json'
            if not path.exists():  # the service answers 500 for a few chapters repealed whole (47-31)
                print(f'SD: chapter {chapter} not downloaded; skipped')
                continue
            answer = json.loads(path.read_text())
            docs = re.split(r'<html', answer.get('Html') or '')
            chapter_name = (answer.get('CatchLine') or '').strip().title().replace("'S ", "'s ")
            for doc in docs[1:]:
                body = re.sub(r'<style.*?</style>', '', doc.split('<body', 1)[-1], flags=re.S)
                paragraphs = [text_of(p) for p in re.findall(r'<p[^>]*>(.*?)</p>', body, re.S)]
                paragraphs = [p for p in paragraphs if p]
                if not paragraphs:
                    continue
                head = re.match(r'^(\S+)\s*\.\s*(.*)$', paragraphs[0])
                if not head or not NUMBER.match(head.group(1)):
                    continue
                number, heading = head.group(1), head.group(2).strip().rstrip('.').strip()
                if number in seen:
                    continue
                seen.add(number)
                history, text_parts = '', []
                for paragraph in paragraphs[1:]:
                    if paragraph.startswith('Source:'):
                        history = paragraph.removeprefix('Source:').strip()
                        break
                    text_parts.append(paragraph)
                text = ' '.join(text_parts)
                gone = r'^\[?(?:Repealed|Superseded|Transferred|Renumbered|Expired|Omitted|Executed|Obsolete|Reserved)\b'
                status = 'repealed' if re.match(gone, heading, re.I) or re.match(gone, text, re.I) else ('reserved' if not text else 'live')
                law = LAW.search(history)
                yield Section(number=number, heading=heading, text=text, url=PAGE + number, title=chapter,
                              title_name=f'Title {chapter.split("-")[0]}: {title_name} / Chapter {chapter}: {chapter_name}', history=history, status=status,
                              act=f'{law.group(1)}-{law.group(2)}' if law else '', enacted=[int(law.group(1))] if law else None)


ADAPTER = SouthDakota()
