"""Wisconsin: the Wisconsin Statutes, read from the Legislative Reference Bureau's whole-chapter PDFs (docs.legis.wisconsin.gov/document/statutes/<chapter>.pdf),
for the chapters listed on the statutes' table of contents. The chapter web pages show only the first few sections and load the rest as the reader scrolls,
so the PDF is the one copy of a whole chapter. The site refuses connections from cloud sessions, so the download runs on GitHub
(.github/workflows/fetch-state-code.yml) and the session parses what it brings back."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section

SITE = 'https://docs.legis.wisconsin.gov'
INDEXES = ('/statutes/prefaces/toc', '/statutes/statutes')


class Wisconsin(State):
    STATE = 'WI'
    NAME = 'Wisconsin'
    CODE_NAME = 'Wisconsin Statutes'
    CODE_SHORT = 'Wis. Stat.'
    AUTHOR = 'Wisconsin Legislative Reference Bureau'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'wisconsin-statutes'
    SOURCE_NOTE = "Text read from the Wisconsin Legislative Reference Bureau's page for the section's chapter of the Wisconsin Statutes (docs.legis.wisconsin.gov/statutes) on Nov. 27, 2026."
    NATION_NAMES = ('Menominee', 'Oneida', 'Ho-Chunk', 'Winnebago', 'Potawatomi', 'Ojibwe', 'Chippewa', 'Stockbridge', 'Munsee', 'Mohican',
                    'Lac du Flambeau', 'Lac Courte Oreilles', 'Bad River', 'Red Cliff', 'Mole Lake', 'Sokaogon', 'St. Croix Chippewa')
    PLACE_NAMES = ('Menominee County', 'Oneida County', 'Winnebago County', 'Chippewa County', 'Chippewa Falls', 'Chippewa River', 'Lake Winnebago',
                   'Oneida Street', 'Stockbridge, town of', 'town of Stockbridge', 'village of Stockbridge', 'Lac du Flambeau, town of',
                   'town of Lac du Flambeau', 'Bad River watershed', 'Red Cliff, town of', 'Indian Creek', 'Indian Lake')
    WORKERS = 4

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        chapters: list[str] = []
        for index in INDEXES:
            path = raw / f"index-{index.strip('/').replace('/', '-')}.html"
            if not path.exists():
                try:
                    path.write_bytes(self.get(SITE + index))
                except Exception as error:  # keep going: the other index may answer
                    print(f'WI: {index} failed: {error}')
                    continue
            page = path.read_text(errors='replace')
            chapters += re.findall(r'href="/document/statutes/(\d+[a-z]?)"', page)
        chapters = list(dict.fromkeys(chapters))
        failed = self.download_all([(f'{SITE}/document/statutes/{chapter}.pdf', raw / 'pdf' / f'{chapter}.pdf') for chapter in chapters])
        (raw / 'text').mkdir(exist_ok=True)
        for pdf in sorted((raw / 'pdf').glob('*.pdf')):
            text = raw / 'text' / f'{pdf.stem}.txt'
            if not text.exists():
                text.write_text(subprocess.run(['pdftotext', '-layout', '-enc', 'UTF-8', str(pdf), '-'], capture_output=True, text=True).stdout)
        print(f'WI: {len(chapters)} chapters, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        raise SystemExit('WI: the parser is written once the download is back from GitHub')


ADAPTER = Wisconsin()
