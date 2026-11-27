"""Montana: the Montana Code Annotated 2025, read from the Legislature's static pages, one per section (mca.legmt.gov/bills/mca),
found by walking its title, chapter and part indexes."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

BASE = 'https://mca.legmt.gov/bills/mca/'
LAW = re.compile(r'Ch\. (\d+), (?:Sp\. )?L\. (\d{4})')


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)))


class Montana(State):
    STATE = 'MT'
    NAME = 'Montana'
    CODE_NAME = 'Montana Code Annotated'
    CODE_SHORT = 'Mont. Code Ann.'
    AUTHOR = 'Montana Legislature'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'montana-code-annotated'
    SOURCE_NOTE = "Text read from the Montana Legislature's page for the section in the Montana Code Annotated 2025 (mca.legmt.gov) on Nov. 27, 2026."
    NATION_NAMES = ('Blackfeet', 'Crow Tribe', 'Crow Indian', 'Northern Cheyenne', 'Assiniboine', 'Sioux', 'Gros Ventre', 'Chippewa Cree',
                    'Rocky Boy', "Rocky Boy's", 'Salish', 'Kootenai', 'Little Shell', 'Fort Peck', 'Fort Belknap', 'Flathead Reservation',
                    'Pend d\'Oreille')
    PLACE_NAMES = ('Flathead County', 'Flathead Lake', 'Flathead River', 'Flathead Valley', 'Kootenai River', 'Kootenai National Forest',
                   'Fort Peck Lake', 'Fort Peck Dam', 'Fort Peck Reservoir', 'Sioux Falls')
    WORKERS = 20

    def index_links(self, url: str, pattern: str) -> list[str]:
        page = self.get(url).decode('utf-8', 'replace')
        root = url.rsplit('/', 1)[0] + '/'
        return [root + href[2:] if href.startswith('./') else root + href for href in re.findall(r'href="(' + pattern + r')"', page)]

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'sections.json'
        if not listing.exists():
            import concurrent.futures
            titles = self.index_links(BASE + 'index.html', r'\./title_\d+/chapters_index\.html')
            with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
                chapters = [link for links in pool.map(lambda url: self.index_links(url, r'\./chapter_\d+/parts_index\.html'), titles) for link in links]
                parts = [link for links in pool.map(lambda url: self.index_links(url, r'\./part_\d+/sections_index\.html'), chapters) for link in links]
                sections = [link for links in pool.map(lambda url: self.index_links(url, r'\./section_\d+/[\d-]+\.html'), parts) for link in links]
            listing.write_text(json.dumps(sections))
            print(f'MT: {len(titles)} titles, {len(chapters)} chapters, {len(parts)} parts, {len(sections)} sections')
        sections = json.loads(listing.read_text())
        failed = self.download_all((url, raw / 'sections' / url.rsplit('/', 1)[1]) for url in sections)
        print(f'MT: {len(sections)} sections, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        for url in json.loads((raw / 'sections.json').read_text()):
            path = raw / 'sections' / url.rsplit('/', 1)[1]
            if not path.exists():
                raise SystemExit(f'MT section {url} was not downloaded: run fetch again')
            page = path.read_text(errors='replace')
            titles = {name: text_of(value) for name, value in re.findall(r'<h\d class="section-(title|chapter|part)-title">(.*?)</h\d>', page, re.S)}
            contents = re.findall(r'<div class="section-content">(.*?)</div>', page, re.S)
            history = re.search(r'<div class="history-content">(.*?)</div>', page, re.S)
            history_text = text_of(history.group(1)).removeprefix('History:').strip() if history else ''
            # A section printed in more than one version (temporary and effective-later) is read as one text.
            text = ' '.join(text_of(content) for content in contents)
            number_match = re.search(r'<span class="citation">([\dA-Z-]+)</span>', contents[0] if contents else page)
            number = number_match.group(1) if number_match else path.stem
            crumb = re.search(r'<li class="active"><span title="([^"]*)"', page)
            heading = html.unescape(crumb.group(1)) if crumb else ''
            heading = re.sub(r'^' + re.escape(number) + r'\s+', '', heading).rstrip('.').strip()
            body = re.sub(r'^' + re.escape(number) + r'\s*\.\s*', '', text)
            body = re.sub(r'^(?:\((?:Temporary|Effective[^)]*)\)\s*)?' + re.escape(heading) + r'\.?\s*', '', body) if heading else body
            status = 'repealed' if re.match(r'^(?:\(\w+\)\s*)?(?:Repealed|Renumbered|Terminated|Omitted|Transferred)\b', heading or body) else 'live'
            laws = LAW.findall(history_text)
            enacted = laws[0] if laws else None
            yield Section(number=number, heading=heading, text=body, url=url, title='-'.join(number.split('-')[:2]),
                          title_name=' / '.join(titles[key].title() for key in ('title', 'chapter', 'part') if key in titles),
                          history=history_text, status=status, act=f'{enacted[1]}-{enacted[0]}' if enacted else '',
                          enacted=[int(enacted[1])] if enacted else None)


ADAPTER = Montana()
