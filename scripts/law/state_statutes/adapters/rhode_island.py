"""Rhode Island: the General Laws of Rhode Island, read from the General Assembly's pages, one per section
(webserver.rilegislature.gov/Statutes/TITLE<n>/<chapter>/<section>.htm), found by walking its title and chapter indexes."""
from __future__ import annotations

import concurrent.futures
import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

BASE = 'https://webserver.rilegislature.gov/Statutes/'
LAW = re.compile(r'P\.L\. (\d{4}), ch\. (\d+)')


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


class RhodeIsland(State):
    STATE = 'RI'
    NAME = 'Rhode Island'
    CODE_NAME = 'General Laws of Rhode Island'
    CODE_SHORT = 'R.I. Gen. Laws'
    AUTHOR = 'Rhode Island General Assembly'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'rhode-island-general-laws'
    SOURCE_NOTE = "Text read from the Rhode Island General Assembly's page for the section in the General Laws (webserver.rilegislature.gov/Statutes) on Nov. 27, 2026."
    NATION_NAMES = ('Narragansett', 'Wampanoag', 'Niantic', 'Pequot', 'Mohegan')
    PLACE_NAMES = ('Narragansett Bay', 'town of Narragansett', 'Town of Narragansett', 'Narragansett Bay Commission', 'Narragansett Electric',
                   'Narragansett Bay Water Quality', 'Narragansett Pier', 'Narragansett school', 'Narragansett Avenue', 'Pawcatuck', 'Pawtucket',
                   'Woonsocket', 'Wakefield', 'Misquamicut', 'Quonset', 'Weekapaug', 'Mohegan Bluffs', 'Niantic Avenue', 'Narragansett, Rhode Island',
                   'Narragansett Indian Reservation Road')
    WORKERS = 16

    def links(self, url: str) -> tuple[list[str], list[str]]:
        page = self.get(url).decode('utf-8', 'replace')
        root = url.rsplit('/', 1)[0] + '/'
        indexes, sections = [], []
        for href in re.findall(r'href="([^"#]+)"', page, re.I):
            href = href.strip()
            if href.startswith(('http', '/', '..', 'mailto')):
                continue
            (indexes if re.search(r'INDEX\.htm$', href, re.I) else sections).append(root + href)
        return list(dict.fromkeys(indexes)), [s for s in dict.fromkeys(sections) if s.lower().endswith('.htm')]

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'sections.json'
        if not listing.exists():
            front = self.get(BASE).decode('utf-8', 'replace')
            todo = [BASE + href for href in dict.fromkeys(re.findall(r'HREF="(TITLE[0-9A-Z.]+/INDEX\.HTM)"', front, re.I))]
            seen, sections = set(), []
            with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
                while todo:
                    seen |= set(todo)
                    results = list(pool.map(self.links, todo))
                    todo = []
                    for indexes, found in results:
                        sections += found
                        todo += [link for link in indexes if link not in seen and link not in todo]
            listing.write_text(json.dumps(list(dict.fromkeys(sections))))
            print(f'RI: {len(seen)} index pages, {len(sections)} sections')
        sections = json.loads(listing.read_text())
        failed = self.download_all((url, raw / 'sections' / url[len(BASE):].replace('/', '_')) for url in sections)
        print(f'RI: {len(sections)} sections, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for url in json.loads((raw / 'sections.json').read_text()):
            path = raw / 'sections' / url[len(BASE):].replace('/', '_')
            if not path.exists():
                raise SystemExit(f'RI section {url} was not downloaded: run fetch again')
            page = path.read_text(errors='replace')
            body = page.split('<body', 1)[-1]
            names = [text_of(name.replace('<br>', ': ')) for name in re.findall(r'<h[12]>\s*<center>(.*?)</center>\s*</h[12]>', body, re.S)]
            history_match = re.search(r'<p>\s*History of Section\.\s*<br>(.*?)</p>', body, re.S)
            history = text_of(history_match.group(1)) if history_match else ''
            if history_match:
                body = body[:history_match.start()]
            head = re.search(r'<p[^>]*>\s*<b>\s*§(?:&nbsp;|\s)*([0-9A-Z]+-[0-9A-Za-z.]+-[0-9A-Za-z.]+)\.?(?:&nbsp;|\s)*(.*?)</b>', body, re.S)
            if not head:
                continue
            number, heading = head.group(1).rstrip('.'), text_of(head.group(2)).rstrip('.')
            text = ' '.join(text_of(p) for p in re.findall(r'<p[^>]*>(.*?)</p>', body[head.end():], re.S))
            if number in seen:
                continue
            seen.add(number)
            gone = r'^\[?(?:Repealed|Reserved|Transferred|Renumbered|Expired|Superseded|Obsolete)\b'
            status = 'repealed' if re.match(gone, heading, re.I) or re.match(gone, text, re.I) else ('reserved' if not text else 'live')
            law = LAW.search(history)
            chapter = '-'.join(number.split('-')[:2])
            yield Section(number=number, heading=heading, text=text, url=url, title=chapter, title_name=' / '.join(names), history=history,
                          status=status, act=f'{law.group(1)}-{law.group(2)}' if law else '', enacted=[int(law.group(1))] if law else None)


ADAPTER = RhodeIsland()
