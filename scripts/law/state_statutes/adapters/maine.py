"""Maine: the Maine Revised Statutes, read from the Revisor of Statutes' section pages (legislature.maine.gov/statutes/<title>/
title<title>sec<section>.html), listed on each chapter's page. The statutes are cited by title (Me. Rev. Stat. tit. 30, § 6203), so a
section's number here is '<title>:<section>'."""
from __future__ import annotations

import concurrent.futures
import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

BASE = 'https://legislature.maine.gov/statutes/'
LAW = re.compile(r'(?:PL|P&SL|RR) (\d{4}), c\. (\d+)')


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


def split_number(number: str) -> tuple[str, str]:
    title, section = number.split(':', 1)
    return title, section


def capitals(text: str) -> str:
    """Chapter and title names are printed in capitals: give them title case."""
    small = {'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with'}
    words = text.lower().split(' ')
    return ' '.join(word if index and word in small else word[:1].upper() + word[1:] for index, word in enumerate(words))


class Maine(State):
    STATE = 'ME'
    NAME = 'Maine'
    CODE_NAME = 'Maine Revised Statutes'
    CODE_SHORT = 'Me. Rev. Stat.'
    AUTHOR = "Maine Legislature, Office of the Revisor of Statutes"
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'maine-revised-statutes'
    SOURCE_NOTE = "Text read from the Maine Revisor of Statutes' page for the section (legislature.maine.gov/statutes) on Nov. 27, 2026."
    NATION_NAMES = ('Penobscot', 'Passamaquoddy', 'Maliseet', 'Houlton Band', "Mi'kmaq", 'Micmac', 'Micmacs', 'Wabanaki', 'Indian Township',
                    'Pleasant Point', 'Sipayik', 'Motahkomikuk')
    PLACE_NAMES = ('Penobscot County', 'Penobscot River', 'Penobscot Bay', 'Penobscot Narrows', 'Passamaquoddy Bay', 'Penobscot Valley',
                   'Penobscot Judicial Center', 'Penobscot Marine', 'Indian Pond', 'Indian Stream')
    WORKERS = 8

    def chapters_of(self, title: str) -> list[list[str]]:
        page = self.get(f'{BASE}{title}/title{title}ch0sec0.html').decode('utf-8', 'replace')
        return [[title, chapter] for chapter in dict.fromkeys(re.findall(rf'href="\./title{re.escape(title)}ch([0-9A-Z\-]+)sec0\.html"', page)) if chapter != '0']

    def sections_of(self, pair: list[str]) -> dict:
        title, chapter = pair
        page = self.get(f'{BASE}{title}/title{title}ch{chapter}sec0.html').decode('utf-8', 'replace')
        name = re.search(r'<div class="MRSChapter[^"]*">(.*?)</div>', page, re.S)
        title_name = re.search(r'<div class="MRSTitle[^"]*">(.*?)</div>', page, re.S)
        return {'title': title, 'chapter': chapter, 'name': text_of(name.group(1)) if name else '',
                'title_name': text_of(title_name.group(1)) if title_name else '',
                'sections': list(dict.fromkeys(re.findall(rf'href="\./title{re.escape(title)}sec([0-9A-Z\-]+)\.html"', page)))}

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'chapters.json'
        if not listing.exists():
            index = self.get(BASE).decode('utf-8', 'replace')
            titles = list(dict.fromkeys(re.findall(r'href="([0-9A-Z\-]+)/title\1ch0sec0\.html"', index)))
            with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
                pairs = [pair for found in pool.map(self.chapters_of, titles) for pair in found]
                rows = list(pool.map(self.sections_of, pairs))
            listing.write_text(json.dumps(rows))
            print(f'ME: {len(titles)} titles, {len(rows)} chapters, {sum(len(row["sections"]) for row in rows)} sections listed')
        rows = json.loads(listing.read_text())
        pairs = [(f'{BASE}{row["title"]}/title{row["title"]}sec{section}.html', raw / 'sections' / row['title'] / f'{section}.html')
                 for row in rows for section in row['sections']]
        failed = self.download_all(pairs)
        print(f'ME: {len(pairs)} section pages, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        # A section with more than one version (text effective until or from a date or a contingency, or two conflicting amendments)
        # has one page per version, named <section>-1, <section>-2 and so on; the heading prints the section's own number. Keep the
        # version in force on the retrieval date, or the first in force when two conflict.
        chosen = {}
        for row in json.loads((raw / 'chapters.json').read_text()):
            title, chapter = row['title'], row['chapter']
            for page_number in row['sections']:
                path = raw / 'sections' / title / f'{page_number}.html'
                if not path.exists():
                    raise SystemExit(f'ME section {title}:{page_number} was not downloaded: run fetch again')
                found = self.read_page(path.read_text(errors='replace'), title, chapter, page_number)
                if not found:
                    continue
                section, in_force = found
                held = chosen.get(section.number)
                if held is None or (in_force and not held[1]):
                    chosen[section.number] = (section, in_force)
        for section, in_force in chosen.values():
            if not in_force:
                section.status = 'repealed'
            yield section

    def read_page(self, page: str, title: str, chapter: str, page_number: str) -> tuple[Section, bool] | None:
        block = re.search(r'<div class="col-sm-12 MRSSection ([a-z_]+)">(.*)', page, re.S)
        if not block:
            return None
        state, body = block.group(1), block.group(2)
        names = [text_of(match) for match in re.findall(r'<div class="MRS(?:Title|Chapter) toc">(.*?)</div>', page, re.S)]
        title_name = ' / '.join(re.sub(r'^((?:Title|Chapter) [^:]+: )(.*)$', lambda m: m.group(1) + capitals(m.group(2)), name) for name in names)
        body = body.split('<div class="footer">', 1)[0]
        head = re.search(r'<h3 class="heading_section">(.*?)</h3>', body, re.S)
        heading = text_of(head.group(1)) if head else ''
        own = re.match(r'^§\s*([0-9A-Z\-]+)\.\s*', heading)
        section = own.group(1) if own and re.fullmatch(re.escape(own.group(1)) + r'(?:-\d+)?', page_number) else page_number
        heading = heading[own.end():].strip().rstrip('.') if own else heading.strip().rstrip('.')
        number = f'{title}:{section}'
        history_match = re.search(r'<div class="qhistory">(.*?)</div>\s*</div>', body, re.S)
        history = text_of(history_match.group(1)).removeprefix('SECTION HISTORY').strip() if history_match else ''
        main = body[head.end() if head else 0:history_match.start() if history_match else len(body)]
        main = re.sub(r'<span class="bhistory">.*?</span>', ' ', main, flags=re.S)
        flag_pattern = r'<div class="(?:note|headnote_blip)">\s*(\([^<]*?\))\s*</div>'
        flags = [text_of(flag) for flag in re.findall(flag_pattern, main)]
        whole = text_of(main)
        text = text_of(re.sub(flag_pattern, ' ', main))
        # Repealed and reallocated sections keep their pages, with only "(REPEALED)" or "(REALLOCATED FROM ...)" as text.
        gone = re.match(r'^\((?:REPEALED|REALLOCATED|RESERVED|TRANSFERRED)\b', whole) and len(whole) < 300
        status = 'repealed' if gone or state != 'status_current' else 'live'
        in_force = status == 'live' and all(self.in_force(flag) for flag in flags)
        # The session law that made the section (NEW) or last replaced it whole (RPR), for the readers' recall pool.
        law = re.search(r'(?:PL|P&SL) (\d{4}), c\. (\d+)[^()]*\((?:NEW|RPR)\)', history) or LAW.search(history)
        enacted = re.match(r'\s*(?:PL|P&SL) (\d{4}), c\. \d+[^()]*\(NEW\)', history)
        return Section(number=number, heading=heading, text=text, url=f'{BASE}{title}/title{title}sec{page_number}.html', title=f'{title}-{chapter}',
                       title_name=title_name, history=history, status=status,
                       act=f'{law.group(1)}-{law.group(2)}' if law else '', enacted=[int(enacted.group(1))] if enacted else None), in_force

    def in_force(self, flag: str) -> bool:
        """Whether a version's note ("WHOLE SECTION TEXT EFFECTIVE UNTIL 7/1/27", "... EFFECTIVE ON CONTINGENCY") puts it in force on the
        retrieval date."""
        date = re.search(r'(\d{1,2})/(\d{1,2})/(\d{2,4})', flag)
        when = ''
        if date:
            year = int(date.group(3)) + (2000 if len(date.group(3)) == 2 else 0)
            when = f'{year:04d}-{int(date.group(1)):02d}-{int(date.group(2)):02d}'
        if 'EFFECTIVE ON CONTINGENCY' in flag or 'WHEN EFFECTIVE' in flag:
            return False
        if 'EFFECTIVE UNTIL' in flag and when:
            return when > self.RETRIEVED
        if 'REPEALED' in flag and when:
            return when > self.RETRIEVED
        if 'TEXT EFFECTIVE' in flag and when:
            return when <= self.RETRIEVED
        return True

    def short_citation(self, number: str) -> str:
        title, section = split_number(number)
        return f'Me. Rev. Stat. tit. {title}, § {section}'

    def key(self, number: str) -> str:
        title, section = split_number(number)
        slug = lambda text: re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
        return f'maine-revised-statutes-title-{slug(title)}-section-{slug(section)}'

    def citation_parts(self, row: dict) -> dict:
        title, section = split_number(row['number'])
        return {'volume': title, 'section': section}


ADAPTER = Maine()
