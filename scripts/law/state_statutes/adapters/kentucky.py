"""Kentucky: the Kentucky Revised Statutes, read from the Legislative Research Commission's PDF of each section
(apps.legislature.ky.gov/law/statutes/statute.aspx?id=<n>), listed on each chapter's page, which the statutes' front page lists."""
from __future__ import annotations

import concurrent.futures
import html
import json
import re
import subprocess
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

BASE = 'https://apps.legislature.ky.gov/law/statutes/'
# The origin of a section: "Created 1974 Ky. Acts ch. 315, sec. 1" or "Enacted 1942 Ky. Acts ch. 208, sec. 1", the last piece of the history.
ORIGIN = re.compile(r'(?:Created|Enacted) (\d{4})(?: \(\w+ Extra\. Sess\.\))? Ky\. Acts ch\. (\d+)')


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


class Kentucky(State):
    STATE = 'KY'
    NAME = 'Kentucky'
    CODE_NAME = 'Kentucky Revised Statutes'
    CODE_SHORT = 'Ky. Rev. Stat. Ann.'
    AUTHOR = 'Kentucky Legislative Research Commission'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'kentucky-revised-statutes'
    SOURCE_NOTE = "Text read from the Kentucky Legislative Research Commission's PDF of the section (apps.legislature.ky.gov/law/statutes) on Nov. 27, 2026."
    NATION_NAMES = ('Shawnee', 'Cherokee', 'Chickasaw', 'Yuchi', 'Osage', 'Miami')
    PLACE_NAMES = ('Cherokee Park', 'Shawnee Park', 'Shawnee Golf', 'Chickasaw Park', 'Miami Valley', 'Shawnee State', 'Cherokee Triangle')
    WORKERS = 8

    def chapter(self, url: str) -> tuple[str, list[tuple[str, str]], list[str]]:
        page = self.get(url).decode('utf-8', 'replace')
        name = re.search(r'id="Banner1_lblPageTitle">(.*?)</span>', page, re.S)
        sections = [(BASE + href, text_of(label)) for href, label in re.findall(r'href="(statute\.aspx\?id=\d+)">(.*?)</a>', page, re.S)]
        chapters = [BASE + href.rsplit('/', 1)[-1] for href in re.findall(r'href="((?:https://apps\.legislature\.ky\.gov/law/statutes/)?chapter\.aspx\?id=\d+)"', page)]
        return text_of(name.group(1)) if name else '', sections, chapters

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'sections.json'
        if not listing.exists():
            front = self.get(BASE).decode('utf-8', 'replace')
            names = {}
            for href, label in re.findall(r'href="(?:https://apps\.legislature\.ky\.gov/law/statutes/)?(chapter\.aspx\?id=\d+)">(.*?)</a>', front, re.S):
                names.setdefault(BASE + href, text_of(label))
            names.pop(BASE + 'chapter.aspx?id=39344', None)  # the note that catchlines are not law, not a chapter
            todo, seen, rows = list(names), set(), []
            with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
                while todo:
                    seen |= set(todo)
                    results = list(pool.map(self.chapter, todo))
                    found = []
                    for url, (title, sections, chapters) in zip(todo, results):
                        rows += [{'url': s, 'label': label, 'chapter_url': url, 'chapter': names.get(url) or title} for s, label in sections]
                        found += [c for c in chapters if c not in seen and c not in found and not c.endswith('id=39344')]
                    todo = found
            unique = list({row['url']: row for row in rows}.values())
            listing.write_text(json.dumps(unique))
            print(f'KY: {len(seen)} chapter pages, {len(unique)} sections')
        rows = json.loads(listing.read_text())
        failed = self.download_all((row['url'], raw / 'pdfs' / (row['url'].rsplit('=', 1)[1] + '.pdf')) for row in rows)
        print(f'KY: {len(rows)} sections, {len(failed)} failed', *failed[:10])

    def pdf_text(self, path: Path) -> str:
        cache = path.with_suffix('.txt')
        if not cache.exists():
            cache.write_text(subprocess.run(['pdftotext', '-raw', '-enc', 'UTF-8', str(path), '-'], capture_output=True, text=True).stdout)
        return cache.read_text().replace('\f', '\n')

    def parse(self, raw: Path) -> Iterator[Section]:
        rows = json.loads((raw / 'sections.json').read_text())
        seen = set()
        for row in rows:
            path = raw / 'pdfs' / (row['url'].rsplit('=', 1)[1] + '.pdf')
            if not path.exists():
                raise SystemExit(f"KY section {row['url']} was not downloaded: run fetch again")
            text = self.pdf_text(path)
            head = re.match(r'\s*([0-9]+[A-Z]?\.[0-9]+[0-9A-Za-z.-]*)\s+(.*)', text)
            if not head:
                continue
            number = head.group(1).rstrip('.')
            if number in seen:
                continue
            seen.add(number)
            # The catchline is the chapter page's label (the PDF wraps it anywhere); the body starts after it.
            label = re.sub(r'^\.\S+\s+', '', row['label']).strip()
            body = text[head.start(2):]
            history = ''
            parts = re.split(r'\n(?=Effective:|History:|Legislative Research Commission Note|Catchline at repeal:)', body)
            body = parts[0]
            for part in parts[1:]:
                if part.startswith('History:'):
                    history = clean(part[len('History:'):])
            flat = clean(body)
            squeezed_label = re.sub(r'\s+', '', label).lower()
            if label:
                words = flat.split()
                for count in range(1, min(len(words), 80) + 1):
                    if re.sub(r'\s+', '', ' '.join(words[:count])).lower() == squeezed_label:
                        flat = ' '.join(words[count:])
                        break
            heading = label.rstrip('.').strip()
            gone = r'^\[?(?:Repealed|Renumbered|Recodified|Expired|Reserved|Transferred|Obsolete)\b'
            status = 'repealed' if re.match(gone, heading, re.I) or (re.match(gone, flat, re.I) and len(flat) < 400) else ('reserved' if not flat else 'live')
            origin = ORIGIN.findall(history)
            act, enacted = '', None
            if origin:
                year, chapter = origin[-1]
                act, enacted = f'{year}-{chapter}', [int(year)]
            chapter_name = row['chapter']
            chapter_number = number.split('.')[0]
            yield Section(number=number, heading=heading, text=flat, url=row['url'], title=chapter_number, title_name=chapter_name,
                          history=history, status=status, act=act, enacted=enacted)


ADAPTER = Kentucky()
