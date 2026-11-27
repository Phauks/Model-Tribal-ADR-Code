"""Pennsylvania: the Pennsylvania Consolidated Statutes, read from the General Assembly's whole-title pages
(palegis.us/statutes/consolidated/view-statute?txtType=HTM&ttl=<title>, the text the site loads into its viewer). Sections are
numbered within a title, so a section's number here is `<title>:<section>` ("1:1991"), cited "1 Pa. Cons. Stat. § 1991". Each
record links to the section's own page, as the title's table of contents lists it.

Only the Consolidated Statutes are read. Much Pennsylvania law is still in unconsolidated acts (Purdon's), which the General Assembly
publishes act by act, not by section; they are not part of this sweep."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://www.palegis.us'
MARK = re.compile(r'<div class="Comment">([0-9A-Za-z.]+?)([shvcx])</div>')
HEAD = re.compile(r'^§\s*([0-9]+(?:\.[0-9]+)*(?:-[A-Z0-9]+)?)\.\s*(.*)$', re.S)
# "(Dec. 10, 1974, P.L.816, No.271, eff. imd.)" or "Enactment. Chapter 15 was added December 6, 1972, P.L.1339, No.290"
LAW = re.compile(r'(\d{4}),\s*P\.\s?L\.\s?[0-9A-Z]+,\s*No\.\s?(\d+)')
GONE = re.compile(r'^\[?\s*(?:Repealed|Reserved|Expired|Deleted|Renumbered|Transferred|Suspended|Omitted)\b', re.I)


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


def split_number(number: str) -> tuple[str, str]:
    title, _, section = number.partition(':')
    return title, section


class Pennsylvania(State):
    STATE = 'PA'
    NAME = 'Pennsylvania'
    CODE_NAME = 'Pennsylvania Consolidated Statutes'
    CODE_SHORT = 'Pa. Cons. Stat.'
    AUTHOR = 'Pennsylvania General Assembly'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'pennsylvania-consolidated-statutes'
    SOURCE_NOTE = "Text read from the Pennsylvania General Assembly's page for the title of the Pennsylvania Consolidated Statutes (palegis.us/statutes/consolidated) on Nov. 27, 2026."
    NATION_NAMES = ('Lenape', 'Lenni-Lenape', 'Delaware Nation', 'Delaware Tribe', 'Susquehannock', 'Seneca Nation', 'Shawnee Tribe', 'Haudenosaunee',
                    'Iroquois Confederacy')
    PLACE_NAMES = ('Indiana County', 'Indian Creek', 'Indian Run', 'Lenape Heights', 'Susquehannock State', 'Susquehannock High', 'Seneca Valley',
                   'Shawnee on Delaware', 'Shawnee State Park')
    WORKERS = 3

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'titles.json'
        if not listing.exists():
            index = self.get(SITE + '/statutes/consolidated').decode('utf-8', 'replace')
            titles = list(dict.fromkeys(re.findall(r'view-statute\?txtType=HTM&amp;ttl=([0-9A-Z]+)"', index)))
            titles = [title for title in titles if title not in ('0', '00')]
            listing.write_text(json.dumps(titles))
        titles = json.loads(listing.read_text())
        failed = self.download_all((f'{SITE}/statutes/consolidated/view-statute?iFrame=true&txtType=HTM&ttl={title}', raw / 'titles' / f'{title}.html')
                                   for title in titles)
        print(f'PA: {len(titles)} titles, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for title in json.loads((raw / 'titles.json').read_text()):
            path = raw / 'titles' / f'{title}.html'
            if not path.exists():
                raise SystemExit(f'PA title {title} was not downloaded: run fetch again')
            page = path.read_text(errors='replace')
            label = title.lstrip('0') or '0'
            # The table of contents links each section to its own page.
            links = {}
            for href, number in re.findall(r'<a target="_parent" href="(/statutes/consolidated/view-statute\?[^"]*sctn=[^"]*)">&#167;\s*([0-9.A-Z-]+?)\.?</a>', page):
                links.setdefault(number, SITE + html.unescape(href))
            title_name = f'Title {label}'
            marks = list(MARK.finditer(page))
            state = {'chapter_name': '', 'chapter_law': None, 'title_name': title_name}
            pending = None  # (number, heading, text) of the section whose notes may follow

            def split(chunk):
                """A chunk's own paragraphs, then the centered headings (TITLE, PART, CHAPTER, SUBCHAPTER) and what follows them."""
                own, rest, in_heading = [], [], False
                for style, body in re.findall(r'<p style="([^"]*)"[^>]*>(.*?)</p>', chunk, re.S):
                    text = text_of(body)
                    if not text:
                        continue
                    if 'text-align:center' in style:
                        in_heading = True
                    (rest if in_heading else own).append((style, text))
                return [text for _, text in own], rest

            def take_headings(rest):
                centered = [text for style, text in rest if 'text-align:center' in style]
                for index, text in enumerate(centered):
                    following = centered[index + 1] if index + 1 < len(centered) else ''
                    if re.match(r'^TITLE \S+$', text) and following and not re.match(r'^(?:PART|CHAPTER|SUBCHAPTER|ARTICLE)\b', following):
                        state['title_name'] = f'Title {label}: {following.title()}'
                    if re.match(r'^CHAPTER \S+$', text):
                        state['chapter_name'] = f'{text.title()}' + (f': {following.title()}' if following and not re.match(r'^(?:SUBCHAPTER|Sec\.)', following) else '')
                        enactment = next((t for _, t in rest if t.startswith('Enactment.')), '')
                        state['chapter_law'] = LAW.search(enactment) if enactment else None

            def emit(entry, notes):
                number, heading, text = entry
                history = notes
                law = None
                head = re.match(r'\(([^()]*)\)', history)
                if head:
                    law = LAW.search(head.group(1))
                law = law or state['chapter_law']
                status = 'live'
                if GONE.match(heading) or (GONE.match(text) and len(text) < 300):
                    status = 'repealed'
                elif not text:
                    status = 'reserved'
                name = state['title_name'] + (f" / {state['chapter_name']}" if state['chapter_name'] else '')
                return Section(number=f'{label}:{number}', heading=heading.rstrip('.').strip(), text=text, history=history, status=status,
                               url=links.get(number, f'{SITE}/statutes/consolidated/view-statute?txtType=HTM&ttl={title}'), title=label,
                               title_name=name, act=f'{law.group(1)}-{law.group(2)}' if law else '', enacted=[int(law.group(1))] if law else None)

            def flush(notes=''):
                nonlocal pending
                if not pending:
                    return None
                section = emit(pending, notes)
                pending = None
                if section.number in seen:
                    return None
                seen.add(section.number)
                return section

            for index, mark in enumerate(marks):
                end = marks[index + 1].start() if index + 1 < len(marks) else len(page)
                own, rest = split(page[mark.end():end])
                kind = mark.group(2)
                if kind == 's':
                    section = flush()
                    if section:
                        yield section
                    match = HEAD.match(own[0]) if own else None
                    if match:
                        pending = (match.group(1), clean(match.group(2)), ' '.join(own[1:]))
                elif kind == 'v':
                    section = flush(' '.join(own))
                    if section:
                        yield section
                else:
                    section = flush()
                    if section:
                        yield section
                    rest = [('text-align:center', text) for text in own] + rest if kind == 'h' else rest
                # Headings printed after this chunk's own text start the next chapter; the section before is done.
                if rest:
                    section = flush()
                    if section:
                        yield section
                    take_headings(rest)
            section = flush()
            if section:
                yield section

    def short_citation(self, number: str) -> str:
        title, section = split_number(number)
        return f'{title} Pa. Cons. Stat. § {section}'

    def key(self, number: str) -> str:
        title, section = split_number(number)
        slug = lambda text: re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
        return f'pennsylvania-consolidated-statutes-title-{slug(title)}-section-{slug(section)}'


ADAPTER = Pennsylvania()
