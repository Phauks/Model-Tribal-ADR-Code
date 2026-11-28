"""New Jersey: the New Jersey Statutes, read from the Legislature's plain-text download of the general and permanent statutes
(pub.njleg.state.nj.us/statutes/STATUTES-TEXT.zip, updated every weekday). The Legislature's statutes database (a Folio gateway at
lis.njleg.state.nj.us) has no stable address for one section, so each record links to that database's search for the section's
number, which lists the section first."""
from __future__ import annotations

import io
import re
import urllib.parse
import zipfile
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

ZIP = 'https://pub.njleg.state.nj.us/statutes/STATUTES-TEXT.zip'
SEARCH = ('https://lis.njleg.state.nj.us/nxt/gateway.dll?f=xhitlist$xhitlist_x=Advanced$xhitlist_vpc=first$xhitlist_xsl=xhitlist.xsl'
          '$xhitlist_sel=title;path;content-type;home-title;item-bookmark$xhitlist_d=%7Bstatutes%7D$xhitlist_q=')
TITLE = re.compile(r'^TITLE\s+(\S+)\s+(.*)$')
HEAD = re.compile(r'^(\d+[A-Z]*:\d+[A-Z]*-\d+[0-9a-zA-Z.]*?)\.?(?:\s+(.*))?$')
HISTORY = re.compile(r'^(?:L\.\s?\d{4}|R\.S\.|[Aa]mended\b|[Ss]ource\b|Repealed\b|Supplementing\b|Supersed|Formerly\b|Derived\b|N\.J\.S\.|Expired\b|Deleted\b)')
LAW = re.compile(r'^L\.\s?(\d{4}),\s*c\.\s?(\d+)')
GONE = re.compile(r'^\[?\s*(?:Repealed|Reserved|Expired|Deleted|Superseded|Omitted)\b', re.I)


class NewJersey(State):
    STATE = 'NJ'
    NAME = 'New Jersey'
    CODE_NAME = 'New Jersey Statutes Annotated'
    CODE_SHORT = 'N.J. Stat. Ann.'
    AUTHOR = 'New Jersey Legislature'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'new-jersey-statutes'
    SOURCE_NOTE = "Text read from the New Jersey Legislature's plain-text file of the general and permanent statutes, updated through P.L.2026, c.70 (pub.njleg.state.nj.us/statutes), on Nov. 27, 2026; the link opens the Legislature's statutes database at a search for the section's number."
    NATION_NAMES = ('Lenape', 'Lenni-Lenape', 'Lenni Lenape', 'Nanticoke', 'Powhatan Renape', 'Ramapough', 'Rankokus', 'Delaware Nation', 'Delaware Tribe')
    PLACE_NAMES = ('Lenape Regional', 'Lenape Valley', 'Lenape Lake', 'Lenape Park', 'Lenape Trail', 'Lenape Road', 'Indian Mills', 'Indian Lake',
                   'Indian Head', 'Indian Run', 'Indian River', 'Indian Brook', 'Indian Avenue')

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        if not (raw / 'STATUTES.TXT').exists():
            data = self.get(ZIP, timeout=600)
            (raw / 'STATUTES-TEXT.zip').write_bytes(data)
            zipfile.ZipFile(io.BytesIO(data)).extract('STATUTES.TXT', raw)
        print('NJ: STATUTES.TXT', (raw / 'STATUTES.TXT').stat().st_size, 'bytes')

    def parse(self, raw: Path) -> Iterator[Section]:
        lines = (raw / 'STATUTES.TXT').read_text(encoding='latin-1').replace('\r\n', '\n').split('\n')
        title, title_name = '', ''
        current: list | None = None
        seen = set()

        def finish(entry):
            number, heading, body = entry
            paragraphs = [clean(line) for line in body if clean(line)]
            history_parts = []
            while paragraphs and HISTORY.match(paragraphs[-1]):
                history_parts.insert(0, paragraphs.pop())
            history = ' '.join(history_parts)
            text = ' '.join(paragraphs)
            # Most section texts repeat the session law's own section number and catchline first: "4. Application to Indian Tribes."
            status = 'live'
            if GONE.match(heading) or (GONE.match(text) and len(text) < 300):
                status = 'repealed'
            elif not text:
                status = 'reserved'
            law = LAW.match(history)
            chapter = number.split('-')[0]
            return Section(number=number, heading=heading.rstrip('.').strip(), text=text, history=history, status=status,
                           url=SEARCH + urllib.parse.quote(f'"{number}"'), title=chapter, title_name=f'Title {title}: {title_name}',
                           act=f'{law.group(1)}-{law.group(2)}' if law else '', enacted=[int(law.group(1))] if law else None)

        for line in lines:
            match_title = TITLE.match(line)
            if match_title:
                if current:
                    section = finish(current)
                    if section.number not in seen:
                        seen.add(section.number)
                        yield section
                    current = None
                title, title_name = match_title.group(1), clean(match_title.group(2))
                continue
            match = HEAD.match(line) if line[:1].isdigit() else None
            if match:
                if current:
                    section = finish(current)
                    if section.number not in seen:
                        seen.add(section.number)
                        yield section
                current = [match.group(1), clean(match.group(2) or ''), []]
                continue
            if current is not None:
                current[2].append(line)
        if current:
            section = finish(current)
            if section.number not in seen:
                yield section


ADAPTER = NewJersey()
