"""Kansas: the Kansas Statutes Annotated, read from the Revisor of Statutes' section pages (ksrevisor.gov/statutes/chapters/ch<n>/<file>.html),
listed with their catchlines on each chapter's page. Sections the list marks repealed, transferred or expired are not downloaded, and
only the statute part of each page is kept (not the case annotations)."""
from __future__ import annotations

import concurrent.futures
import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://ksrevisor.gov'
LAW = re.compile(r'L\. (\d{4}), ch\. (\d+)')
GONE = re.compile(r'^\[?\s*(?:Repealed|Transferred|Expired|Reserved|Renumbered|Obsolete|Omitted|Superseded)\b', re.I)


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


class Kansas(State):
    STATE = 'KS'
    NAME = 'Kansas'
    CODE_NAME = 'Kansas Statutes Annotated'
    CODE_SHORT = 'Kan. Stat. Ann.'
    AUTHOR = 'Kansas Office of Revisor of Statutes'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'kansas-statutes-annotated'
    SOURCE_NOTE = "Text read from the Kansas Revisor of Statutes' page for the section in the Kansas Statutes Annotated (ksrevisor.gov/statutes) on Nov. 27, 2026."
    NATION_NAMES = ('Kickapoo', 'Potawatomi', 'Prairie Band', 'Iowa Tribe', 'Sac and Fox', 'Kaw Nation', 'Kanza', 'Wyandot Nation', 'Delaware Tribe',
                    'Shawnee Tribe', 'Haskell Indian')
    PLACE_NAMES = ('Wyandotte County', 'Shawnee County', 'Pottawatomie County', 'Osage County', 'Cherokee County', 'Kiowa County', 'Comanche County',
                   'Cheyenne County', 'Miami County', 'Ottawa County', 'Wichita County', 'Shawnee Mission', 'city of Shawnee', 'City of Shawnee',
                   'Kickapoo township', 'Kickapoo Township', 'Kansas City', 'Osage City', 'city of Ottawa', 'City of Ottawa', 'Ottawa University',
                   'Arkansas City', 'Cheyenne Bottoms', 'Indian Hills', 'Indian Creek')
    WORKERS = 10

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'sections.json'
        if not listing.exists():
            index = self.get(SITE + '/ksa.html').decode('utf-8', 'replace')
            chapters = list(dict.fromkeys(re.findall(r'href="(/statutes/ksa_ch[0-9a-z]+\.html)"', index)))

            def sections_of(path):
                page = self.get(SITE + path).decode('utf-8', 'replace')
                name = re.search(r'<h2>\s*(Chapter .*?)\s*</h2>', page, re.S)
                chapter_name = text_of(name.group(1)) if name else ''
                rows, article = [], ''
                for match in re.finditer(r'class="collapsed"[^>]*>\s*(Article .*?)\s*</a>|<li>\s*([0-9a-z-]+)\s*<a href="([^"]+)">\s*(.*?)\s*</a>', page, re.S):
                    if match.group(1):
                        article = text_of(match.group(1))
                    else:
                        rows.append({'number': match.group(2), 'url': SITE + match.group(3), 'heading': text_of(match.group(4)),
                                     'chapter': path.split('ksa_ch')[1].removesuffix('.html'), 'title_name': f'{chapter_name} / {article}'})
                return rows

            with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
                sections = [row for rows in pool.map(sections_of, chapters) for row in rows]
            listing.write_text(json.dumps(sections))
            print(f'KS: {len(chapters)} chapters, {len(sections)} sections')
        sections = json.loads(listing.read_text())
        (raw / 'sections').mkdir(exist_ok=True)
        todo = [row for row in sections if not GONE.match(row['heading']) and not (raw / 'sections' / f"{row['number']}.html").exists()]

        def one(row):
            try:
                page = self.get(row['url']).decode('utf-8', 'replace')
            except Exception:
                return row['url']
            start, end = page.find('<p class="ksa_stat'), page.find('id="prev2"')
            (raw / 'sections' / f"{row['number']}.html").write_text(page[start:end] if start >= 0 else '')
            return None

        failed = []
        with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
            for done, result in enumerate(pool.map(one, todo), 1):
                if result:
                    failed.append(result)
                if done % 1000 == 0:
                    print(f'  {done} of {len(todo)} downloaded', flush=True)
        print(f'KS: {len(sections)} sections, {len(todo)} fetched now, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for row in json.loads((raw / 'sections.json').read_text()):
            number = row['number']
            if number in seen:
                continue
            seen.add(number)
            common = dict(number=number, url=row['url'], title=row['chapter'], title_name=row['title_name'])
            heading = row['heading'].rstrip('.').strip()
            if GONE.match(heading):
                yield Section(heading=heading, text='', status='repealed', **common)
                continue
            path = raw / 'sections' / f'{number}.html'
            if not path.exists():
                raise SystemExit(f'KS section {number} was not downloaded: run fetch again')
            page = path.read_text(errors='replace')
            history_match = re.search(r'<p class="ksa_stat_hist">(.*?)</p>', page, re.S)
            history = text_of(history_match.group(1)).removeprefix('History:').strip() if history_match else ''
            body = page[:history_match.start()] if history_match else page
            caption = re.search(r'<span class="stat_caption">(.*?)</span>', body, re.S)
            if caption:
                heading = text_of(caption.group(1)).rstrip('.').strip() or heading
            body = re.sub(r'<span class="(?:stat_number|stat_caption)">.*?</span>', ' ', body, flags=re.S)
            text = text_of(body)
            status = 'repealed' if GONE.match(text) and len(text) < 300 else ('reserved' if not text else 'live')
            # Only a session law at the head of the history line is the enactment ("G.S. 1868, ch. 25, § 1; L. 1911 ..." names amendments).
            law = LAW.match(history.split(';')[0].strip())
            yield Section(heading=heading, text=text, history=history, status=status, act=f'{law.group(1)}-{law.group(2)}' if law else '',
                          enacted=[int(law.group(1))] if law else None, **common)


ADAPTER = Kansas()
