"""Virginia: the Code of Virginia, read from the Division of Legislative Systems' pages, one per section
(law.lis.virginia.gov/vacode/title<t>/chapter<c>/section<n>/), found by walking its title and chapter pages."""
from __future__ import annotations

import concurrent.futures
import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://law.lis.virginia.gov'
LAW = re.compile(r'(\d{4})(?:, Sp\. Sess\. [IVX]+)?, cc?\. (\d+)')


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


class Virginia(State):
    STATE = 'VA'
    NAME = 'Virginia'
    CODE_NAME = 'Code of Virginia'
    CODE_SHORT = 'Va. Code Ann.'
    AUTHOR = 'Virginia General Assembly'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'code-of-virginia'
    SOURCE_NOTE = "Text read from the Virginia Division of Legislative Systems' page for the section in the Code of Virginia (law.lis.virginia.gov) on Nov. 27, 2026."
    NATION_NAMES = ('Pamunkey', 'Mattaponi', 'Chickahominy', 'Rappahannock Tribe', 'Rappahannock Indian', 'Monacan', 'Nansemond', 'Nottoway',
                    'Cheroenhaka', 'Patawomeck', 'Upper Mattaponi', 'Powhatan Confederacy')
    PLACE_NAMES = ('Pamunkey River', 'Mattaponi River', 'Chickahominy River', 'Rappahannock River', 'Rappahannock County', 'Rappahannock Community College',
                   'Rappahannock-Rapidan', 'Rappahannock Area', 'Rappahannock Electric', 'Nansemond River', 'Nottoway County', 'Nottoway River',
                   'Powhatan County', 'Appomattox', 'Chesapeake', 'Occoquan', 'Potomac', 'Shenandoah', 'Accomack', 'Chickahominy Parkway',
                   'Upper Rappahannock', 'Middle Peninsula', 'Northern Neck')
    WORKERS = 12

    def hrefs(self, url: str, pattern: str) -> list[str]:
        page = self.get(url).decode('utf-8', 'replace')
        return list(dict.fromkeys(SITE + href for href in re.findall(r"href='(" + pattern + r")'", page)))

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'sections.json'
        if not listing.exists():
            titles = self.hrefs(SITE + '/vacode/', r'/vacode/title[0-9A-Z.]+/')
            with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
                chapters = [c for cs in pool.map(lambda url: self.hrefs(url, r'/vacode/title[0-9A-Z.]+/chapter[0-9A-Z.]+/'), titles) for c in cs]
                chapters = list(dict.fromkeys(chapters))
                sections = [s for ss in pool.map(lambda url: self.hrefs(url, r'/vacode/title[0-9A-Z.]+/chapter[0-9A-Z.]+/section[0-9A-Za-z.:\-]+/'), chapters) for s in ss]
            listing.write_text(json.dumps(list(dict.fromkeys(sections))))
            print(f'VA: {len(titles)} titles, {len(chapters)} chapters, {len(sections)} sections')
        sections = json.loads(listing.read_text())
        failed = self.download_all((url, raw / 'sections' / (url.rstrip('/').rsplit('/', 1)[1] + '.html')) for url in sections)
        print(f'VA: {len(sections)} sections, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for url in json.loads((raw / 'sections.json').read_text()):
            path = raw / 'sections' / (url.rstrip('/').rsplit('/', 1)[1] + '.html')
            if not path.exists():
                raise SystemExit(f'VA section {url} was not downloaded: run fetch again')
            page = path.read_text(errors='replace')
            if "id='va_code'" not in page:
                continue
            crumbs = re.search(r'id="breadcrumbs"><p>(.*?)</p>', page, re.S)
            trail = [text_of(a) for a in re.findall(r'<a [^>]*>(.*?)</a>', crumbs.group(1), re.S)][1:] if crumbs else []
            title_name = ' / '.join(name for name in trail if re.match(r'^(?:Title|Chapter|Article|Part)\b', name))
            body = page.split("id='va_code'", 1)[1].split('</article>', 1)[0]
            # A page may hold more than one version of the section (one in force now, one from a later date): read them as one text.
            versions = re.split(r"<h2>\s*<span id='v\d+'>", body)[1:]
            if not versions:
                continue
            first = versions[0]
            head = re.match(r'(§§?[^<]*)</span>\.?\s*(.*?)</h2>', first, re.S)
            if not head:
                continue
            label, heading = text_of(head.group(1)), text_of(head.group(2)).rstrip('.')
            number_match = re.search(r'§§?\s*([0-9A-Z.]+-[0-9A-Za-z.:]+)', label)
            if not number_match:
                continue
            number = number_match.group(1).rstrip('.')
            texts, history = [], ''
            for version in versions:
                paragraphs = [text_of(p) for p in re.findall(r'<p[^>]*>(.*?)</p>', version, re.S)]
                if paragraphs and re.match(r'^(?:\d{4}|Code \d{4}|Acts \d{4}|\(Code)', paragraphs[-1]):
                    history = history or paragraphs[-1]
                    paragraphs = paragraphs[:-1]
                texts.append(' '.join(p for p in paragraphs if p))
            text = ' '.join(t for t in texts if t)
            if number in seen:
                continue
            seen.add(number)
            gone = r'^(?:Repealed|Reserved|Expired|Not set out|Transferred|Renumbered|Omitted)\b'
            status = 'repealed' if label.startswith('§§') or re.match(gone, heading, re.I) else ('reserved' if not text else 'live')
            law = LAW.search(history)
            yield Section(number=number, heading=heading, text=text, url=url, title=number.split('-')[0], title_name=title_name,
                          history=history, status=status, act=f'{law.group(1)}-{law.group(2)}' if law else '',
                          enacted=[int(law.group(1))] if law else None)


ADAPTER = Virginia()
