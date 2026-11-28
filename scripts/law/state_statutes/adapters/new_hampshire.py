"""New Hampshire: the New Hampshire Revised Statutes Annotated, read from the General Court's merged chapter pages (gc.nh.gov/rsa/html/<title>/<chapter>/<chapter>-mrg.htm),
listed on each title's table of contents. Section numbers are `<chapter>:<section>` ("1:1", "5-B:4-a"), as the code prints them. The site refuses connections
from cloud sessions, so the download runs on GitHub (a temporary workflow on the branch) and the session parses what it brings back."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://gc.nh.gov/rsa/html'
TITLE_LINK = re.compile(r'href="[^"]*NHTOC-([IVXLC]+(?:-[A-Z])?)\.htm"[^>]*>(.*?)</a>', re.S | re.I)
# A session law at the head of a source note: "2000, 35:1, eff. Jan. 1, 2001." Older notes begin with the revisions ("RS 1:1. CS 1:1. ... RSA 1:1.").
LAW = re.compile(r'^\s*(\d{4}),\s*(\d+)(?::|\b)')
GONE = re.compile(r'^\s*(?:Repealed|Reserved|Recodified|Renumbered|Transferred|Expired|Omitted|Deleted)\b', re.I)


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


def name_case(text: str) -> str:
    """"THE STATE AND ITS GOVERNMENT" -> "The State and Its Government"."""
    small = {'and', 'or', 'of', 'the', 'to', 'in', 'for', 'on', 'by', 'a', 'an', 'at', 'with'}
    words = text.lower().split()
    return ' '.join(word if i and word in small else word[:1].upper() + word[1:] for i, word in enumerate(words))


class NewHampshire(State):
    STATE = 'NH'
    NAME = 'New Hampshire'
    CODE_NAME = 'New Hampshire Revised Statutes Annotated'
    CODE_SHORT = 'N.H. Rev. Stat. Ann.'
    AUTHOR = 'New Hampshire General Court'
    EDITION = 2026
    RETRIEVED = '2026-11-28'
    KEY_PREFIX = 'new-hampshire-statutes'
    SOURCE_NOTE = "Text read from the New Hampshire General Court's merged chapter page for the section in the online Revised Statutes (gc.nh.gov/rsa) on Nov. 28, 2026."
    NATION_NAMES = ('Abenaki', 'Abnaki', 'Pennacook', 'Cowasuck', 'Koasek', 'Sokoki', 'Wabanaki')
    PLACE_NAMES = ('Penacook', 'Ossipee', 'Pequawket', 'Indian Stream', 'Indian Head', 'Indian Pond', 'Indian River', 'Indian Brook')
    WORKERS = 4

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'chapters.json'
        if not listing.exists():
            index = self.get(f'{SITE}/nhtoc.htm').decode('utf-8', 'replace')
            (raw / 'index.html').write_text(index)
            titles = list(dict.fromkeys((m.group(1), text_of(m.group(2))) for m in TITLE_LINK.finditer(index)))
            rows = []
            for title, title_name in titles:
                page = self.get(f'{SITE}/NHTOC/NHTOC-{title}.htm').decode('utf-8', 'replace')
                (raw / 'toc').mkdir(exist_ok=True)
                (raw / 'toc' / f'{title}.htm').write_text(page)
                head = re.search(r'<h2>\s*' + re.escape(title) + r'\s*:\s*(.*?)</h2>', page, re.S)
                for match in re.finditer(r'href="NHTOC-' + re.escape(title) + r'-([0-9A-Za-z-]+)\.htm"[^>]*>(.*?)</a>', page, re.S):
                    name = text_of(match.group(2))
                    rows.append({'title': title, 'title_name': text_of(head.group(1)) if head else title_name, 'chapter': match.group(1),
                                 'name': re.sub(r'^CHAPTER\s+[0-9A-Za-z-]+\s*:\s*', '', name, flags=re.I)})
            listing.write_text(json.dumps(rows, indent=1))
            print(f'NH: {len(titles)} titles, {len(rows)} chapters')
        chapters = json.loads(listing.read_text())
        failed = self.download_all((f"{SITE}/{row['title']}/{row['chapter']}/{row['chapter']}-mrg.htm", raw / 'chapters' / f"{row['chapter']}.htm")
                                   for row in chapters)
        print(f'NH: {len(chapters)} chapters, {len(failed)} failed', *failed[:20])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for row in json.loads((raw / 'chapters.json').read_text()):
            path = raw / 'chapters' / f"{row['chapter']}.htm"
            title_name = f"Title {row['title']}: {name_case(row['title_name'])} / Chapter {row['chapter']}: {name_case(row['name'])}"
            common = dict(title=f"{row['title']}/{row['chapter']}", title_name=title_name)
            if not path.exists():
                # A chapter repealed whole has no merged page; its contents line says so.
                continue
            page = path.read_text(errors='replace')
            for part in re.split(r'<center>\s*<h3>\s*Section\s+[^<]*</h3>\s*</center>', page)[1:]:
                head = re.search(r'<b>(.*?)</b>', part, re.S)
                if not head:
                    continue
                line = text_of(head.group(1)).rstrip(' -–—').strip()
                match = re.match(r'^([0-9]+[A-Za-z-]*:[0-9A-Za-z.-]+)\s*(.*)$', line)
                if not match:
                    continue
                number, heading = match.group(1).rstrip('.'), match.group(2).strip()
                if number in seen:
                    continue
                seen.add(number)
                chapter, _, section = number.partition(':')
                url = f"{SITE}/{row['title']}/{chapter}/{chapter}-{section}.htm"
                body = re.search(r'<codesect>(.*?)</codesect>', part, re.S)
                text = text_of(body.group(1)) if body else ''
                note = re.search(r'<sourcenote>(.*?)</sourcenote>', part, re.S)
                history = re.sub(r'^Source\.\s*', '', text_of(note.group(1))) if note else ''
                status = 'live'
                if GONE.match(heading) or (not text and not heading):
                    status = 'repealed'
                elif not text:
                    status = 'reserved'
                law = LAW.match(history)
                yield Section(number=number, heading=heading.rstrip('.').strip(), text=text, url=url, history=history, status=status,
                              act=f'{law.group(1)}-{law.group(2)}' if law else '', enacted=[int(law.group(1))] if law else None, **common)


ADAPTER = NewHampshire()
