"""Washington: the Revised Code of Washington, read from the Legislature's full-text chapter pages (app.leg.wa.gov/RCW,
`&full=true`), with the chapter list taken from the Code Reviser's file share (lawfilesext.leg.wa.gov/law/RCW)."""
from __future__ import annotations

import html
import json
import re
import urllib.parse
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SHARE = 'https://lawfilesext.leg.wa.gov/law/RCW/'
PAGE = 'https://app.leg.wa.gov/RCW/default.aspx?cite={}'
LAW = re.compile(r'(\d{4})(?: (?:\d+\w* )?(?:ex\.|sp\.) ?s\.)? c (\d+)', re.I)


class Washington(State):
    STATE = 'WA'
    NAME = 'Washington'
    CODE_NAME = 'Revised Code of Washington'
    CODE_SHORT = 'Wash. Rev. Code'
    AUTHOR = 'Washington State Legislature'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'revised-code-of-washington'
    SOURCE_NOTE = "Text read from the Washington State Legislature's full-text chapter page for the section (app.leg.wa.gov/RCW) on Nov. 27, 2026."
    NATION_NAMES = ('Yakama', 'Colville', 'Lummi', 'Tulalip', 'Puyallup', 'Muckleshoot', 'Makah', 'Quinault', 'Swinomish', 'Nisqually',
                    'Squaxin', 'Skokomish', 'Snoqualmie', 'Suquamish', 'Stillaguamish', 'Kalispel', 'Nooksack', 'Quileute', 'Samish',
                    'Sauk-Suiattle', 'Shoalwater', 'Cowlitz', 'Elwha', "S'Klallam", 'Klallam', 'Spokane Tribe', 'Chehalis Tribes', 'Hoh')
    PLACE_NAMES = ('Spokane County', 'Kalispel Street', 'Chehalis River', 'city of Chehalis', 'Skokomish River', 'Nisqually River',
                   'Puyallup River', 'Snoqualmie Pass', 'Snoqualmie River', 'city of Snoqualmie', 'city of Puyallup', 'Cowlitz County',
                   'Cowlitz River', 'Hoh River', 'Quinault River', 'Elwha River', 'Stillaguamish River', 'Nooksack River',
                   # Not places, but phrases that use a weak term in another sense in hundreds of sections.
                   'allotment procedures')

    def chapters(self) -> list[str]:
        """Every chapter, from the file share's title folders ("RCW  37 . 12  CHAPTER")."""
        top = self.get(SHARE).decode('utf-8', 'replace')
        titles = re.findall(r'HREF="(/law/RCW/RCW[^"]*TITLE/)"', top)
        found = []
        for title in titles:
            listing = self.get('https://lawfilesext.leg.wa.gov' + title).decode('utf-8', 'replace')
            for href in re.findall(r'HREF="([^"]*CHAPTER/)"', listing):
                name = urllib.parse.unquote(href).rstrip('/').rsplit('/', 1)[1]
                match = re.match(r'RCW\s+([0-9A-Z]+)\s*\.\s*([0-9A-Z]+)\s+CHAPTER$', name)
                if match:
                    found.append(f'{match.group(1)}.{match.group(2)}')
        return found

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'chapters.json'
        if not listing.exists():
            listing.write_text(json.dumps(self.chapters()))
        chapters = json.loads(listing.read_text())
        failed = self.download_all((PAGE.format(chapter) + '&full=true', raw / 'chapters' / f'{chapter}.html') for chapter in chapters)
        print(f'WA: {len(chapters)} chapters, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        chapters = json.loads((raw / 'chapters.json').read_text())
        key = lambda chapter: [(int(part) if part.isdigit() else 0, part) for part in re.findall(r'\d+|[A-Z]+', chapter)]
        for chapter in sorted(chapters, key=key):
            path = raw / 'chapters' / f'{chapter}.html'
            if not path.exists():
                raise SystemExit(f'WA chapter {chapter} was not downloaded: run fetch again')
            page = path.read_text(errors='replace')
            caption = re.search(r'<!-- field: CaptionsTitles -->(.*?)<!-- field: -->', page, re.S)
            name = clean(html.unescape(re.sub(r'<[^>]+>', ' ', caption.group(1)))) if caption else ''
            parts = re.split(r"<a name='([0-9A-Z.]+)' ></a>", page)
            for index in range(1, len(parts) - 1, 2):
                number, block = parts[index], parts[index + 1]
                headings = re.findall(r'<h3>(.*?)</h3>', block, re.S)
                heading = clean(html.unescape(re.sub(r'<[^>]+>', ' ', headings[1]))) if len(headings) > 1 else ''
                body = block.split('</h3></div>', 2)[-1]
                history_match = re.search(r'<div style="margin-top:15pt;margin-bottom:0pt;">\s*\[(.*?)\]\s*</div>', body, re.S)
                text_part = body[:history_match.start()] if history_match else body.split('<h3>NOTES:</h3>')[0]
                text = clean(html.unescape(re.sub(r'<[^>]+>', ' ', text_part)))
                history = clean(html.unescape(re.sub(r'<[^>]+>', ' ', history_match.group(1)))) if history_match else ''
                laws = LAW.findall(history)
                first = laws[-1] if laws else None
                status = 'live'
                if re.match(r'^\[?(?:Repealed|Recodified|Decodified|Expired)\b', f'{heading} {text}'.strip(), re.I):
                    status = 'repealed'
                yield Section(number=number, heading=heading, text=text, url=PAGE.format(number), title=chapter,
                              title_name=f'Chapter {chapter} RCW: {name.title()}' if name else f'Chapter {chapter} RCW',
                              history=f'[{history}]' if history else '', status=status,
                              act=f'{first[0]}-{first[1]}' if first else '', enacted=[int(first[0])] if first else None)

    def short_citation(self, number: str) -> str:
        return f'Wash. Rev. Code § {number}'


ADAPTER = Washington()
