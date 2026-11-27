"""North Dakota: the North Dakota Century Code, read from the Legislative Branch's chapter PDFs (ndlegis.gov/cencode/t<title>c<chapter>.pdf),
listed with every section's number and name on its Century Code page. The PDFs print no source notes, so the records carry no
enactment year and the near sample is drawn only from sections printed next to a strong hit."""
from __future__ import annotations

import html
import json
import re
import subprocess
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://ndlegis.gov'
INDEX = SITE + '/general-information/north-dakota-century-code'


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' ').replace('‑', '-'))


class NorthDakota(State):
    STATE = 'ND'
    NAME = 'North Dakota'
    CODE_NAME = 'North Dakota Century Code'
    CODE_SHORT = 'N.D. Cent. Code'
    AUTHOR = 'North Dakota Legislative Branch'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'north-dakota-century-code'
    SOURCE_NOTE = "Text read from the North Dakota Legislative Branch's PDF of the section's chapter of the Century Code (ndlegis.gov/cencode) on Nov. 27, 2026."
    NATION_NAMES = ('Sioux', 'Lakota', 'Dakota Sioux', 'Nakota', 'Mandan', 'Hidatsa', 'Arikara', 'Three Affiliated', 'Turtle Mountain',
                    'Chippewa', 'Ojibwe', 'Standing Rock', 'Spirit Lake', 'Sisseton', 'Wahpeton Oyate', 'Fort Berthold', 'Trenton Indian')
    PLACE_NAMES = ('Sioux County', 'Sioux Falls', 'Big Sioux', 'Mandan city', 'city of Mandan', 'City of Mandan', 'Lake Sakakawea',
                   'Turtle Mountain Community College', 'Spirit Lake Casino', 'city of Wahpeton', 'City of Wahpeton', 'Mandan, North Dakota')
    WORKERS = 6

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        index = raw / 'index.html'
        if not index.exists():
            index.write_bytes(self.get(INDEX))
        pdfs = list(dict.fromkeys(re.findall(r'href="(/cencode/t[0-9a-z.-]+\.pdf)', index.read_text(errors='replace'))))
        failed = self.download_all((SITE + pdf, raw / 'pdfs' / pdf.rsplit('/', 1)[1]) for pdf in pdfs)
        print(f'ND: {len(pdfs)} chapter PDFs, {len(failed)} failed', *failed[:10])

    def listing(self, raw: Path) -> list[dict]:
        page = (raw / 'index.html').read_text(errors='replace')
        rows, title_name, chapter_name = [], '', ''
        for match in re.finditer(r'<h2>(.*?)</h2>|<h3>(.*?)</h3>|<td class="no-wrap"><a href="(/cencode/[^"#]+)#nameddest=([^"]+)">([^<]+)</a></td>\s*<td>(.*?)</td>', page, re.S):
            if match.group(1):
                title_name = text_of(match.group(1))
            elif match.group(2):
                chapter_name = text_of(match.group(2))
            else:
                rows.append({'pdf': match.group(3), 'dest': match.group(4), 'number': text_of(match.group(5)), 'heading': text_of(match.group(6)),
                             'title_name': f'{title_name} / {chapter_name}', 'chapter': chapter_name.split(' - ')[0].replace('Chapter ', '')})
        return rows

    def pdf_text(self, path: Path) -> str:
        cache = path.with_suffix('.txt')
        if not cache.exists():
            cache.write_text(subprocess.run(['pdftotext', '-enc', 'UTF-8', str(path), '-'], capture_output=True, text=True).stdout)
        text = cache.read_text()
        return re.sub(r'\n\s*Page No\. \d+\s*\n', '\n', text).replace('\f', '\n')

    def parse(self, raw: Path) -> Iterator[Section]:
        rows = self.listing(raw)
        by_pdf: dict[str, list[dict]] = {}
        for row in rows:
            by_pdf.setdefault(row['pdf'], []).append(row)
        seen = set()
        for pdf, members in by_pdf.items():
            path = raw / 'pdfs' / pdf.rsplit('/', 1)[1]
            if not path.exists():
                raise SystemExit(f'ND chapter {pdf} was not downloaded: run fetch again')
            text = self.pdf_text(path)
            # Find each listed section's start in order, so a number quoted inside another section is not taken for a start.
            starts, at = [], 0
            for row in members:
                match = re.compile(r'(?:^|\n)\s*' + re.escape(row['number']) + r'\.\s').search(text, at)
                starts.append(match.start() if match else None)
                if match:
                    at = match.end()
            for index, row in enumerate(members):
                if row['number'] in seen:
                    continue
                seen.add(row['number'])
                start = starts[index]
                later = [s for s in starts[index + 1:] if s is not None]
                body = text[start:later[0] if later else len(text)] if start is not None else ''
                body = clean(body)
                body = re.sub(r'^' + re.escape(row['number']) + r'\.\s*', '', body)
                heading = row['heading'].rstrip('.').strip()
                # The PDF prints the catchline first; take it off by its length in words (the PDF's line breaks fall anywhere).
                words = len(heading.replace('-', ' - ').split())
                lead = body.split()
                if heading and lead:
                    cut = 0
                    for count in range(max(1, words - 3), min(len(lead), words + 6) + 1):
                        if lead[count - 1].endswith('.') and re.sub(r'\W', '', ' '.join(lead[:count])).lower().startswith(re.sub(r'\W', '', heading).lower()[:40]):
                            cut = count
                            break
                    body = ' '.join(lead[cut:])
                gone = r'^\[?(?:Repealed|Superseded|Transferred|Renumbered|Expired|Omitted|Obsolete|Reserved|Effective through)\b'
                status = 'live'
                if re.match(gone, heading, re.I) or re.match(r'^(?:Repealed|Superseded|Renumbered|Transferred)\b', body, re.I) and len(body) < 400:
                    status = 'repealed'
                elif not body:
                    status = 'missing'
                url = f"{SITE}{pdf}#nameddest={row['dest']}"
                yield Section(number=row['number'], heading=heading, text=body, url=url, title=row['chapter'], title_name=row['title_name'],
                              status=status)


ADAPTER = NorthDakota()
