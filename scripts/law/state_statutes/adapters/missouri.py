"""Missouri: the Revised Statutes of Missouri, read from the Revisor of Statutes' section pages (revisor.mo.gov/main/PageSelect.aspx),
listed with their catchlines on each chapter's page. The chapter pages list only sections in force; a section with more than one
version in force (one that expires and one that takes its place) is listed once per version, and the first listed is read."""
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

SITE = 'https://revisor.mo.gov'
STOP_AFTER = 25  # failures in a row before a run stops asking (the site's block page answers every request)
PAUSE = 1.5  # seconds between one worker's requests: the site blocks scripts that ask faster (it did at eight workers with no pause)
# A session law at the head of the history line: "L. 1990 H.B. 1070", "L. 2021 S.B. 26 merged with ...", "L. 1993 1st Ex. Sess. S.B. 1".
LAW = re.compile(r'L\. (\d{4})\s*(?:(\d\w*) Ex\. Sess\.\s*)?((?:[HS]\.(?:C\.)?(?:C\.)?(?:S\.)?(?:B\.|J\.R\.))\s*(?:Nos?\.\s*)?\d+|p\. \d+)?')


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' ').replace('\xad', ''))


class Missouri(State):
    STATE = 'MO'
    NAME = 'Missouri'
    CODE_NAME = 'Revised Statutes of Missouri'
    CODE_SHORT = 'Mo. Rev. Stat.'
    AUTHOR = 'Missouri Revisor of Statutes'
    EDITION = 2026
    RETRIEVED = '2026-11-28'
    KEY_PREFIX = 'revised-statutes-of-missouri'
    SOURCE_NOTE = "Text read from the Missouri Revisor of Statutes' page for the section in the Revised Statutes of Missouri (revisor.mo.gov) on Nov. 27 or 28, 2026."
    NATION_NAMES = ('Osage Nation', 'Osage Tribe', 'Missouria', 'Otoe', 'Ioway', 'Shawnee Tribe', 'Delaware Nation', 'Kickapoo', 'Sac and Fox', 'Quapaw')
    PLACE_NAMES = ('Osage Beach', 'Osage County', 'Osage River', 'Lake of the Ozarks', 'Shawnee Bend', 'Miami County', 'Kansas City', 'Cherokee Place',
                   'Seneca', 'Neosho', 'Indian Creek', 'Indian Trail', 'Arrow Rock', 'Sac River', 'Pemiscot')
    WORKERS = 2

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'sections.json'
        if not listing.exists():
            home = self.get(SITE + '/main/Home.aspx').decode('utf-8', 'replace')
            chapters = list(dict.fromkeys(re.findall(r'OneChapter\.aspx\?chapter=([0-9A-Za-z]+)', home)))

            def sections_of(chapter):
                page = self.get(f'{SITE}/main/OneChapter.aspx?chapter={chapter}').decode('utf-8', 'replace')
                name = re.search(r'Chapter\s+' + re.escape(chapter) + r'\s*</[^>]+>\s*(?:<[^>]+>\s*)*([^<]+)', page)
                title = re.search(r'(Title [IVXLC]+\s+[^<]+)<', page)
                rows = []
                for number, bid, cell in re.findall(r'PageSelect\.aspx\?section=([^&"]+)&amp;bid=(\d+)[^>]*>.*?</a>\s*</td>\s*<td[^>]*>(.*?)</td>', page, re.S):
                    heading = text_of(re.sub(r'<span[^>]*>\s*\([0-9/]+\)\s*</span>', '', cell))
                    rows.append({'number': number, 'bid': bid, 'heading': heading, 'chapter': chapter,
                                 'title_name': ' / '.join(part for part in (text_of(title.group(1)) if title else '', f'Chapter {chapter}') if part)})
                return rows

            with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
                sections = [row for rows in pool.map(sections_of, chapters) for row in rows]
            listing.write_text(json.dumps(sections))
            print(f'MO: {len(chapters)} chapters, {len(sections)} section versions')
        sections = json.loads(listing.read_text())
        (raw / 'sections').mkdir(exist_ok=True)
        todo = [row for row in sections if not (raw / 'sections' / f"{row['number']}-{row['bid']}.html").exists()]

        misses = [0]  # failures in a row: past STOP_AFTER the site is taken to be blocking us, and the run stops asking

        def one(row):
            if misses[0] >= STOP_AFTER:
                return row['number']
            try:
                page = self.get(f"{SITE}/main/PageSelect.aspx?section={row['number']}&bid={row['bid']}").decode('utf-8', 'replace')
            except Exception:
                page = ''
            start, end = page.find('id="effdt"'), page.find('use this link to bookmark')
            time.sleep(PAUSE)
            if start < 0:  # the site's robot block page, or an error page: keep nothing, so the next run asks again
                misses[0] += 1
                return row['number']
            misses[0] = 0
            (raw / 'sections' / f"{row['number']}-{row['bid']}.html").write_text(page[start:end])
            return None

        failed = []
        with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
            for done, result in enumerate(pool.map(one, todo), 1):
                if result:
                    failed.append(result)
                if done % 1000 == 0:
                    print(f'  {done} of {len(todo)} downloaded', flush=True)
        print(f'MO: {len(sections)} section versions, {len(todo)} asked for now, {len(failed)} failed', *failed[:10])
        if misses[0] >= STOP_AFTER:
            print(f'MO: stopped after {STOP_AFTER} failures in a row; the site may be blocking this machine')

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for row in json.loads((raw / 'sections.json').read_text()):
            number = row['number']
            if number in seen:
                continue
            seen.add(number)
            page = (raw / 'sections' / f"{number}-{row['bid']}.html").read_text(errors='replace')
            if not page:
                raise SystemExit(f'MO section {number} was not downloaded: run fetch again')
            url = f'{SITE}/main/OneSection.aspx?section={number}'
            foot = re.search(r'<div class="foot".*?</div>', page, re.S)
            history = ''
            if foot:
                notes = [text_of(note) for note in re.findall(r'<p class="norm">(.*?)</p>', foot.group(0), re.S)]
                history = next((note for note in notes if note.startswith('(')), '').strip('() ')
            body = page[:foot.start()] if foot else page
            body = body[body.find('<div class="norm"'):] if '<div class="norm"' in body else body
            heading = row['heading'].rstrip('.').strip()
            text = text_of(body)
            # Take the number and catchline off the front: "21.010. Meeting of the general assembly. — The general assembly ..."
            text = re.sub(r'^' + re.escape(number) + r'\.\s*', '', text)
            # A catchline may hold dashes of its own ("... by director, when — purposes of corporation. — 1. The director ..."), and the
            # chapter page cuts it at the first, so the catchline runs to the first dash the text goes on from with a capital, a number
            # or a quotation mark (a catchline's own parts go on in lower case), and the page's whole catchline is the heading.
            caption = re.match(r'(.{0,600}?)\s+—\s+(?=[A-Z0-9"“(\[*§])', text) or re.match(r'(.{0,400}?)\s+—\s+', text)
            if caption:
                if caption.group(1).rstrip('.').startswith(heading[:20]):
                    heading = clean(caption.group(1).rstrip('.'))
                text = text[caption.end():]
            status = 'repealed' if re.match(r'^\(?(?:Repealed|Transferred)\b', text, re.I) and len(text) < 300 else ('reserved' if not text else 'live')
            law = LAW.match(history.split(',')[0].strip())
            act = ''
            if law and law.group(3):
                act = f"{law.group(1)}-{(law.group(2) or '')}{re.sub(r'[^A-Za-z0-9]', '', law.group(3))}"
            yield Section(number=number, heading=heading, text=text, url=url, title=row['chapter'], title_name=row['title_name'], history=history,
                          status=status, act=act, enacted=[int(law.group(1))] if law else None)


ADAPTER = Missouri()
