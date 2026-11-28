"""Ohio: the Ohio Revised Code, read from the Legislative Service Commission's chapter pages (codes.ohio.gov/ohio-revised-code/chapter-<n>),
which print every section of the chapter in full, listed on each title's page. The pages print each section's effective date and
latest bill, but no history line, so the records carry no enactment year."""
from __future__ import annotations

import html
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://codes.ohio.gov/ohio-revised-code'


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


class Ohio(State):
    STATE = 'OH'
    NAME = 'Ohio'
    CODE_NAME = 'Ohio Revised Code'
    CODE_SHORT = 'Ohio Rev. Code Ann.'
    AUTHOR = 'Ohio Legislative Service Commission'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'ohio-revised-code'
    SOURCE_NOTE = "Text read from the Ohio Legislative Service Commission's chapter page of the Ohio Revised Code (codes.ohio.gov) on Nov. 27, 2026."
    NATION_NAMES = ('Shawnee Tribe', 'Wyandotte Nation', 'Wyandot Nation', 'Miami Tribe', 'Delaware Tribe', 'Delaware Nation', 'Ottawa Tribe',
                    'Seneca-Cayuga', 'Eastern Shawnee')
    PLACE_NAMES = ('Wyandot County', 'Miami County', 'Miami University', 'Miami River', 'Great Miami', 'Little Miami', 'Miami Valley',
                   'Miami Township', 'Miamisburg', 'Ottawa County', 'Ottawa Hills', 'Seneca County', 'Delaware County', 'city of Delaware',
                   'City of Delaware', 'Shawnee State', 'Shawnee Township', 'Tuscarawas', 'Muskingum', 'Huron', 'Erie', 'Indian Lake',
                   'Indian Hill', 'Indian Creek', 'Chillicothe', 'Cuyahoga', 'Mohican', 'Mingo', 'Coshocton', 'Hocking', 'Scioto',
                   'Sandusky', 'Hopewell Township', 'Hopewell Culture')
    WORKERS = 6

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'chapters.txt'
        if not listing.exists():
            index = self.get(SITE).decode('utf-8', 'replace')
            titles = list(dict.fromkeys(re.findall(r'href="(?:/)?ohio-revised-code/((?:title-\d+)|general-provisions)"', index)))
            rows = []
            for title in titles:
                page = self.get(f'{SITE}/{title}').decode('utf-8', 'replace')
                name = re.search(r'<h1[^>]*>(.*?)</h1>', page, re.S)
                for chapter, chapter_name in re.findall(r'<a href="chapter-([0-9A-Za-z.]+)">Chapter [^<]*<span[^>]*>\|</span>\s*(.*?)</a>', page, re.S):
                    rows.append('\t'.join((text_of(name.group(1)) if name else title, chapter, text_of(chapter_name))))
            listing.write_text('\n'.join(rows) + '\n')
            print(f'OH: {len(titles)} titles, {len(rows)} chapters')
        chapters = [line.split('\t') for line in listing.read_text().splitlines()]
        failed = self.download_all((f'{SITE}/chapter-{chapter}', raw / 'chapters' / f'{chapter}.html') for _title, chapter, _name in chapters)
        print(f'OH: {len(chapters)} chapters, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        for title, chapter, chapter_name in (line.split('\t') for line in (raw / 'chapters.txt').read_text().splitlines()):
            path = raw / 'chapters' / f'{chapter}.html'
            if not path.exists():
                raise SystemExit(f'OH chapter {chapter} was not downloaded: run fetch again')
            page = path.read_text(errors='replace')
            heads = list(re.finditer(r'<span class="content-head-text">\s*<a href="section-([^"]+)">Section [^<]*<span[^>]*>\|</span>\s*(.*?)</a>', page, re.S))
            for index, head in enumerate(heads):
                number = head.group(1)
                chunk = page[head.end():heads[index + 1].start() if index + 1 < len(heads) else len(page)]
                body = re.search(r'<section class="laws-body">(.*?)(?:<div class="laws-notice">|</section>)', chunk, re.S)
                text = text_of(body.group(1)) if body else ''
                info = {text_of(label).rstrip(':'): text_of(value) for label, value in
                        re.findall(r'<div class="label">(.*?)</div>\s*<div class="value">(.*?)</div>', chunk, re.S)}
                history = '; '.join(f'{label}: {value}' for label, value in info.items() if label in ('Effective', 'Latest Legislation'))
                heading = text_of(head.group(2)).rstrip('.').strip()
                status = 'repealed' if re.match(r'^(?:Repealed|Expired|Renumbered|Transferred)\b', heading or text, re.I) and len(text) < 300 else ('live' if text else 'reserved')
                yield Section(number=number, heading=heading, text=text, url=f'{SITE}/section-{number}', title=chapter,
                              title_name=f'{title} / Chapter {chapter}: {chapter_name}', history=history, status=status)


ADAPTER = Ohio()
