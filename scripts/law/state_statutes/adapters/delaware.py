"""Delaware: the Delaware Code, read from the Legislative Council's pages (delcode.delaware.gov), one per chapter or subchapter,
found by walking each title's index pages. The Code is cited by title (Del. Code Ann. tit. 25, § 101), so a section's number here
is '<title>:<section>'."""
from __future__ import annotations

import concurrent.futures
import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

BASE = 'https://delcode.delaware.gov/'
LAW = re.compile(r'(\d+) Del\. Laws, c\. (\d+)')


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


def split_number(number: str) -> tuple[str, str]:
    title, section = number.split(':', 1)
    return title, section


class Delaware(State):
    STATE = 'DE'
    NAME = 'Delaware'
    CODE_NAME = 'Delaware Code Annotated'
    CODE_SHORT = 'Del. Code Ann.'
    AUTHOR = 'Delaware General Assembly'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'delaware-code'
    SOURCE_NOTE = "Text read from the Delaware Legislative Council's page for the section's chapter in the Delaware Code (delcode.delaware.gov) on Nov. 27, 2026."
    NATION_NAMES = ('Nanticoke', 'Lenape', 'Lenni-Lenape', 'Delaware Tribe', 'Delaware Nation')
    PLACE_NAMES = ('Nanticoke River', 'Nanticoke Hundred', 'Indian River', 'Indian River School District', 'Indian River Inlet',
                   'Indian River Bay', 'Indian River Hundred', 'Lenape Trail')
    WORKERS = 8

    def links(self, url: str) -> list[str]:
        page = self.get(url).decode('utf-8', 'replace')
        found = []
        for href in re.findall(r'href="\s*([^"#]*?index\.html)\s*"', html.unescape(page)):
            absolute = re.sub(r'/[^/]+/\.\./', '/', url.rsplit('/', 1)[0] + '/' + href.strip())
            while '/../' in absolute:
                absolute = re.sub(r'/[^/]+/\.\./', '/', absolute, count=1)
            absolute = absolute.replace('/./', '/')
            if absolute.startswith(url.rsplit('/', 1)[0] + '/') and absolute != url:
                found.append(absolute)
        return list(dict.fromkeys(found))

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'pages.json'
        if not listing.exists():
            front = html.unescape(self.get(BASE).decode('utf-8', 'replace'))
            titles = list(dict.fromkeys(BASE + t.strip() for t in re.findall(r'href="\s*(title\d+/index\.html)\s*"', front)))
            pages, todo = [], titles
            with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
                while todo:
                    pages += todo
                    todo = [link for links in pool.map(self.links, todo) for link in links if link not in pages]
            listing.write_text(json.dumps(pages))
            print(f'DE: {len(titles)} titles, {len(pages)} index pages')
        pages = json.loads(listing.read_text())
        failed = self.download_all((url, raw / 'pages' / (url[len(BASE):].replace('/', '_'))) for url in pages)
        print(f'DE: {len(pages)} pages, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for url in json.loads((raw / 'pages.json').read_text()):
            path = raw / 'pages' / url[len(BASE):].replace('/', '_')
            if not path.exists():
                raise SystemExit(f'DE page {url} was not downloaded: run fetch again')
            page = path.read_text(errors='replace')
            if 'id="CodeBody"' not in page:
                continue
            title = re.search(r'/title(\d+)/', url).group(1)
            head = page.split('id="TitleHead"', 1)[1].split('id="CodeBody"', 1)[0] if 'id="TitleHead"' in page else ''
            names = [text_of(name) for name in re.findall(r'<h[1-4][^>]*>(.*?)</h[1-4]>', head, re.S)]
            names = [name for name in names if name and not re.match(r'^TITLE \d+$', name, re.I)]
            title_name = f'Title {title}: ' + ' / '.join(re.sub(r'\bIi\b', 'II', name.title()) if name.isupper() else name for name in names)
            body = page.split('id="CodeBody"', 1)[1].split('<footer', 1)[0]
            for block in re.split(r'<div class="Section">', body)[1:]:
                head_match = re.search(r'<div class="SectionHead" id="([^"]*)">(.*?)</div>', block, re.S)
                if not head_match:
                    continue
                anchor, head_text = head_match.group(1), text_of(head_match.group(2))
                number_match = re.match(r'§+\s*([0-9A-Za-z.\-–]+?)\.?\s+(.*)$', head_text) or re.match(r'§+\s*([0-9A-Za-z.\-–]+)\.?$', head_text)
                if not number_match:
                    continue
                section = number_match.group(1).rstrip('.')
                heading = (number_match.group(2) if number_match.lastindex and number_match.lastindex > 1 else '').strip().rstrip('.')
                rest = block[head_match.end():]
                paragraphs = re.findall(r'<p[^>]*>(.*?)</p>', rest, re.S)
                text = ' '.join(text_of(p) for p in paragraphs)
                tail = re.split(r'</p>', rest)[-1] if paragraphs else rest
                history = text_of(tail).rstrip(';').strip()
                number = f'{title}:{section}'
                if number in seen:
                    continue
                seen.add(number)
                gone = r'^\[?(?:Repealed|Reserved|Transferred|Renumbered|Redesignated|Expired)\b'
                status = 'repealed' if re.match(gone, heading, re.I) or (not text and re.search(r'Repealed|Reserved|Transferred', heading + history, re.I)) else 'live'
                if not text.strip():
                    status = 'repealed' if status == 'repealed' else 'reserved'
                law = LAW.search(history)
                yield Section(number=number, heading=heading, text=text, url=f'{url}#{anchor}', title=title, title_name=title_name,
                              history=history, status=status, act=f'{law.group(1)}-{law.group(2)}' if law else '', enacted=None)

    def short_citation(self, number: str) -> str:
        title, section = split_number(number)
        return f'Del. Code Ann. tit. {title}, § {section}'

    def key(self, number: str) -> str:
        title, section = split_number(number)
        slug = lambda text: re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
        return f'delaware-code-title-{slug(title)}-section-{slug(section)}'

    def citation_parts(self, row: dict) -> dict:
        title, section = split_number(row['number'])
        return {'volume': title, 'section': section}


ADAPTER = Delaware()
