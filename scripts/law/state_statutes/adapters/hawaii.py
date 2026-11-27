"""Hawaii: the Hawaii Revised Statutes, read from the State Legislature's page for each section, found by walking its folder
listings (data.capitol.hawaii.gov/hrscurrent/<volume>/HRS<chapter>/HRS_<chapter>-<section>.htm). capitol.hawaii.gov refuses
cloud addresses; its data host serves the same files. Only the Revised Statutes' chapter folders are read: the volume's copies of
the United States Constitution, the Organic Act, the Admission Act, the state constitution and the Hawaiian Homes Commission Act,
1920 (a federal act the project holds as its own record) are left out.

Native Hawaiians are Native people, not a tribe: the readers are told so, and the records say "Native Hawaiian", never "tribe"."""
from __future__ import annotations

import concurrent.futures
import html
import json
import re
import time
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://data.capitol.hawaii.gov'
ROOT = SITE + '/hrscurrent/'
# The first session law in the bracketed source note: "[L 1892, c 57, §5; am ...]", "[L Sp 1993, c 1, pt of §2]".
LAW = re.compile(r'^L (?:Sp |2d Sp |3d Sp )?(\d{4}), c (\d+)')


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


def number_of(name: str) -> str:
    """HRS_0006E-0043_0005.htm -> 6E-43.5"""
    match = re.match(r'HRS_0*([0-9]+[A-Z]*)-([0-9A-Z_]+)\.htm$', name)
    if not match:
        return ''
    return f"{match.group(1)}-{'.'.join(part.lstrip('0') or '0' for part in match.group(2).split('_'))}"


class Hawaii(State):
    STATE = 'HI'
    NAME = 'Hawaii'
    CODE_NAME = 'Hawaii Revised Statutes'
    CODE_SHORT = 'Haw. Rev. Stat.'
    AUTHOR = 'Hawaii State Legislature'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'hawaii-revised-statutes'
    SOURCE_NOTE = "Text read from the Hawaii State Legislature's page for the section in the Hawaii Revised Statutes (data.capitol.hawaii.gov/hrscurrent) on Nov. 27, 2026."
    # Native Hawaiian terms, not nation names (there are no federally recognized tribes in Hawaii).
    NATION_NAMES = ('Hawaiian', 'Hawaiians', 'kanaka maoli', 'kanaka ʻōiwi', 'aboriginal', 'Office of Hawaiian Affairs', 'Hawaiian home lands',
                    'Hawaiian Homes', 'iwi kupuna', 'kuleana', "ali`i", 'aliʻi', 'Kamehameha Schools', 'public land trust', 'ceded lands',
                    'native tenants', 'traditional and customary', 'Papahānaumokuākea', 'Kahoolawe', "Kaho`olawe", 'Hawaiian Kingdom', 'Kingdom of Hawaii',
                    'Hawaiian language', "`ōlelo Hawai`i", 'ʻōlelo Hawaiʻi', 'Native Hawaiian Roll', 'hula', 'heiau', 'loko i`a', 'ahupua`a', 'ahupuaʻa')
    PLACE_NAMES = ('Hawaiian Electric', 'Hawaiian Islands', 'Hawaiian Telcom', 'Hawaiian Airlines', 'Hawaiian Standard Time', 'Hawaiian waters',
                   'Hawaiian Archipelago', 'Hawaiian archipelago', 'Hawaiian Volcano', 'Hawaiian Tel', 'Hawaiian Humane', 'Hawaiian Ocean View',
                   'Northwestern Hawaiian Islands', 'Hawaiian Acres', 'Hawaiian Paradise Park', 'Hawaiian Beaches', 'Hawaiian Gardens')
    WORKERS = 4
    LAW_NAME = 'Native Hawaiian or Indian law'  # records' notes say this, not "Indian law": Native Hawaiians are not a tribe

    def listing_links(self, url: str, raw: Path | None = None) -> list[str]:
        cache = raw / 'listings' / (re.sub(r'[^A-Za-z0-9]+', '_', url[len(ROOT):]) or 'root') if raw else None
        if cache and cache.exists():
            page = cache.read_text()
        else:
            for attempt in range(6):
                try:
                    page = self.get(url).decode('utf-8', 'replace')
                    break
                except Exception:
                    if attempt == 5:
                        raise
                    time.sleep(10 * (attempt + 1))
            if cache:
                cache.parent.mkdir(parents=True, exist_ok=True)
                cache.write_text(page)
        return [SITE + href for href in re.findall(r'HREF="(/hrscurrent/[^"]+)"', page, re.I) if href.startswith(url[len(SITE):]) and href != url[len(SITE):]]

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'sections.json'
        if not listing.exists():
            volumes = [link for link in self.listing_links(ROOT, raw) if re.search(r'/Vol\d+_[^/]+/$', link)]
            with concurrent.futures.ThreadPoolExecutor(3) as pool:
                folders = [link for links in pool.map(lambda url: self.listing_links(url, raw), volumes) for link in links if re.search(r'/HRS\d+[A-Z]*/$', link)]
                rows = []
                for folder, links in zip(folders, pool.map(lambda url: self.listing_links(url, raw), folders)):
                    chapter = [link for link in links if re.search(r'HRS_[0-9A-Z]+-\.htm$', link)]
                    for link in links:
                        name = link.rsplit('/', 1)[1]
                        if number_of(name):
                            rows.append({'url': link, 'number': number_of(name), 'chapter_page': chapter[0] if chapter else ''})
            listing.write_text(json.dumps(rows))
            print(f'HI: {len(volumes)} volumes, {len(folders)} chapters, {len(rows)} sections')
        rows = json.loads(listing.read_text())
        pages = {row['chapter_page'] for row in rows if row['chapter_page']}
        failed = self.download_all([(row['url'], self.path(raw, row['url'])) for row in rows] + [(page, self.path(raw, page)) for page in pages])
        print(f'HI: {len(rows)} sections, {len(failed)} failed', *failed[:10])

    @staticmethod
    def path(raw: Path, url: str) -> Path:
        return raw / 'pages' / url.rsplit('/', 1)[1]

    def chapter_name(self, raw: Path, url: str, cache: dict) -> str:
        if url not in cache:
            path = self.path(raw, url)
            name = ''
            if path.exists():
                page = path.read_text(errors='replace')
                body = page[page.find('<body'):]
                found = re.search(r'CHAPTER\s+([0-9A-Z]+)\s*</?[^>]*>?\s*(.*?)</p>', body, re.S)
                parts = [text_of(p) for p in re.findall(r'<p[^>]*>(.*?)</p>', body, re.S)]
                parts = [p for p in parts if p]
                at = next((i for i, p in enumerate(parts) if re.match(r'^CHAPTER\s+[0-9A-Z]+$', p)), None)
                if at is not None and at + 1 < len(parts):
                    name = f'{parts[at].title()} {parts[at + 1].title()}'
                elif found:
                    name = f'Chapter {found.group(1)} {text_of(found.group(2)).title()}'
            cache[url] = name
        return cache[url]

    def parse(self, raw: Path) -> Iterator[Section]:
        seen, names = set(), {}
        for row in json.loads((raw / 'sections.json').read_text()):
            number = row['number']
            if number in seen:
                continue
            seen.add(number)
            path = self.path(raw, row['url'])
            if not path.exists():
                raise SystemExit(f"HI section {row['url']} was not downloaded: run fetch again")
            page = path.read_text(errors='replace')
            body = page[page.find('<body'):]
            notes = re.search(r'<p class="XNotes', body)
            if notes:
                body = body[:notes.start()]
            paragraphs = re.findall(r'<p[^>]*>(.*?)</p>', body, re.S)
            first = next((i for i, p in enumerate(paragraphs) if '§' in text_of(p)[:12]), None)
            if first is None:
                continue
            bold = text_of(' '.join(re.findall(r'<b>(.*?)</b>', paragraphs[first], re.S)))
            heading = re.sub(r'^§\s*[0-9A-Z]+\s*-?\s*[0-9A-Z.]*\s*', '', bold).strip()
            heading = re.sub(r'^-\s*[0-9A-Z.]+\s*', '', heading).strip()
            text = ' '.join(text_of(p) for p in paragraphs[first:])
            at = text.find(heading) if heading else -1
            text = text[at + len(heading):].strip() if at >= 0 else re.sub(r'^§\s*\S+\s*', '', text)
            history = ''
            source = re.search(r'\[([^\[\]]*)\]\s*$', text)
            if source and re.match(r'^(?:L |RL |PC |CC |HRS |RLH |Gen\. Laws|\w+ \d{4})', source.group(1)):
                history = source.group(1)
                text = text[:source.start()].strip()
            heading = heading.rstrip('.').strip()
            gone = r'^\[?(?:REPEALED|Repealed|Reserved|Renumbered|Transferred|Expired|Obsolete)\b'
            status = 'repealed' if re.match(gone, heading) or (re.match(gone, text, re.I) and len(text) < 300) else ('reserved' if not text else 'live')
            law = LAW.search(history)
            chapter = number.split('-')[0]
            yield Section(number=number, heading=heading, text=text, url=row['url'], title=chapter,
                          title_name=self.chapter_name(raw, row['chapter_page'], names) if row['chapter_page'] else f'Chapter {chapter}',
                          history=history, status=status, act=f'{law.group(1)}-{law.group(2)}' if law else '',
                          enacted=[int(law.group(1))] if law else None)


ADAPTER = Hawaii()
