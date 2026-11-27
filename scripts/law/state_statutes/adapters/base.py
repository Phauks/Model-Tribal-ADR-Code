"""The port every state adapter fills. Subclass State, set the class attributes, and write fetch() and parse()."""
from __future__ import annotations

import concurrent.futures
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Iterable, Iterator

from core import Section

USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'


class State:
    STATE = ''          # two-letter code, as jurisdictions[].state holds it
    NAME = ''           # "Washington"
    CODE_NAME = ''      # the code's name as the citation's container: "Revised Code of Washington"
    CODE_SHORT = ''     # the Indigo Book abbreviation: "Wash. Rev. Code"
    AUTHOR = ''         # "Washington State Legislature"
    EDITION = 0         # the year of the edition read, for the Indigo Book citation
    RETRIEVED = ''      # the date the code was read, YYYY-MM-DD
    KEY_PREFIX = ''     # record keys are <KEY_PREFIX>-<section number slug>
    SOURCE_NOTE = ''    # one sentence on where and when the text was read, for each record's notes
    NATION_NAMES: tuple[str, ...] = ()  # the state's nations' distinctive names, added to the weak terms
    PLACE_NAMES: tuple[str, ...] = ()   # counties and towns named for nations, taken out before the weak terms match
    HELD: dict[str, str] = {}           # section number -> key of a record kept as it is, when its key differs from key()
    CITE_VOLUME = False  # put the title in citation.volume (codes cited by title, like Oklahoma's)
    WORKERS = 6          # parallel downloads: keep it polite

    def fetch(self, raw: Path) -> None:
        """Download the official code into `raw`. Re-running skips files already there."""
        raise NotImplementedError

    def parse(self, raw: Path) -> Iterator[Section]:
        """Split the downloaded code into sections, in code order."""
        raise NotImplementedError

    def short_citation(self, number: str) -> str:
        return f'{self.CODE_SHORT} § {number}'

    def key(self, number: str) -> str:
        return f"{self.KEY_PREFIX}-{re.sub(r'[^a-z0-9]+', '-', number.lower()).strip('-')}"

    # Helpers for fetch().
    @staticmethod
    def get(url: str, tries: int = 4, timeout: int = 90) -> bytes:
        for attempt in range(tries):
            try:
                request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
                return urllib.request.urlopen(request, timeout=timeout).read()
            except urllib.error.HTTPError as error:
                if error.code in (403, 404, 410) or attempt == tries - 1:
                    raise
                time.sleep(2 * (attempt + 1))
            except Exception:
                if attempt == tries - 1:
                    raise
                time.sleep(2 * (attempt + 1))
        raise RuntimeError('unreachable')

    def download_all(self, pairs: Iterable[tuple[str, Path]]) -> list[str]:
        """Download each (url, path) not already on disk. Returns the URLs that failed."""
        todo = [(url, path) for url, path in pairs if not path.exists()]
        failed = []

        def one(pair):
            url, path = pair
            try:
                data = self.get(url)
            except Exception:
                return url
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            return None

        with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
            for done, result in enumerate(pool.map(one, todo), 1):
                if result:
                    failed.append(result)
                if done % 200 == 0:
                    print(f'  {done} of {len(todo)} downloaded', flush=True)
        return failed
