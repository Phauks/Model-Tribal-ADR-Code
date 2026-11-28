"""Vermont: the Vermont Statutes, read from the General Assembly's full-chapter pages (legislature.vermont.gov/statutes/fullchapter/<title>/<chapter>),
listed on each title's page. Sections are numbered within a title, so a section's number here is `<title>:<section>` ("1:853a"), cited
"Vt. Stat. Ann. tit. 1, § 853a"."""
from __future__ import annotations

import concurrent.futures
import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://legislature.vermont.gov'
# "Added 2005, No. 125 (Adj. Sess.), § 1" or "1959, No. 329 (Adj. Sess.), § 39": a session law at the head of the history line.
LAW = re.compile(r'^(?:Added\s+)?(\d{4}),\s*No\.\s*(\d+)')
GONE = re.compile(r'^[\d.,\s-]*\[?\s*(?:Repealed|Reserved|Recodified|Renumbered|Transferred|Expired|Omitted|Deleted)\b', re.I)
HEAD = re.compile(r'^§+\s*([0-9]+[a-zA-Z]*(?:-[0-9a-zA-Z]+)?)\.?\s*(.*)$', re.S)


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


def split_number(number: str) -> tuple[str, str]:
    title, _, section = number.partition(':')
    return title, section


def title_label(code: str) -> str:
    """"03APPENDIX" -> "3 App.", "09A" -> "9A", "01" -> "1"."""
    match = re.match(r'0*(\d+[A-Z]?)(APPENDIX)?$', code)
    if not match:
        return code
    return match.group(1) + (' App.' if match.group(2) else '')


class Vermont(State):
    STATE = 'VT'
    NAME = 'Vermont'
    CODE_NAME = 'Vermont Statutes Annotated'
    CODE_SHORT = 'Vt. Stat. Ann.'
    AUTHOR = 'Vermont General Assembly'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'vermont-statutes'
    SOURCE_NOTE = "Text read from the Vermont General Assembly's full-chapter page for the section in the Vermont Statutes Online (legislature.vermont.gov/statutes) on Nov. 27, 2026."
    NATION_NAMES = ('Abenaki', 'Abnaki', 'Missisquoi', 'Nulhegan', 'Koasek', 'Coosuk', 'Elnu', 'Cowasuck', 'Sokoki', 'Wabanaki', 'Mohican')
    PLACE_NAMES = ('Missisquoi River', 'Missisquoi Bay', 'Missisquoi National Wildlife Refuge', 'Missisquoi Valley', 'Nulhegan Basin',
                   'Nulhegan River', 'Indian Brook', 'Indian River', 'Indian Point')
    HELD = {'1:853a': 'vermont-statutes-1-853a'}
    WORKERS = 6

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'chapters.json'
        if not listing.exists():
            index = self.get(SITE + '/statutes/').decode('utf-8', 'replace')
            titles = list(dict.fromkeys(re.findall(r'href="/statutes/title/([0-9A-Z]+)"', index)))

            def chapters_of(title):
                page = self.get(f'{SITE}/statutes/title/{title}').decode('utf-8', 'replace')
                name = re.search(r'<h2[^>]*class="statute-title"[^>]*>(.*?)</h2>', page, re.S) or re.search(r'Title\s*<span[^>]*>[^<]*</span>\s*:\s*(.*?)</', page, re.S)
                rows = []
                for match in re.finditer(r'href="/statutes/chapter/' + re.escape(title) + r'/([0-9A-Za-z]+)"[^>]*>(.*?)</a>', page, re.S):
                    rows.append({'title': title, 'chapter': match.group(1), 'name': text_of(match.group(2)), 'title_name': text_of(name.group(1)) if name else ''})
                return rows

            with concurrent.futures.ThreadPoolExecutor(self.WORKERS) as pool:
                chapters = [row for rows in pool.map(chapters_of, titles) for row in rows]
            seen, unique = set(), []
            for row in chapters:
                if (row['title'], row['chapter']) not in seen:
                    seen.add((row['title'], row['chapter']))
                    unique.append(row)
            listing.write_text(json.dumps(unique))
            print(f'VT: {len(titles)} titles, {len(unique)} chapters')
        chapters = json.loads(listing.read_text())
        failed = self.download_all((f"{SITE}/statutes/fullchapter/{row['title']}/{row['chapter']}", raw / 'chapters' / f"{row['title']}-{row['chapter']}.html")
                                   for row in chapters)
        print(f'VT: {len(chapters)} chapters, {len(failed)} failed', *failed[:10])

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for row in json.loads((raw / 'chapters.json').read_text()):
            path = raw / 'chapters' / f"{row['title']}-{row['chapter']}.html"
            if not path.exists():
                raise SystemExit(f"VT chapter {row['title']}/{row['chapter']} was not downloaded: run fetch again")
            page = path.read_text(errors='replace')
            start = page.find('statutes-detail')
            if start < 0:
                continue
            end = page.find('<footer', start)
            body = page[start:end if end > 0 else len(page)]
            head = re.search(r'<h3 class="statute-chapter">(.*?)</h3>', page, re.S)
            chapter_name = text_of(head.group(1)) if head else row['name']
            title_name = f"Title {title_label(row['title'])}: {row['title_name']} / {chapter_name}".replace(':  ', ': ')
            for item in re.split(r'<li>', body)[1:]:
                paragraphs = [text_of(p).replace('\u2014', '-').replace('\u2013', '-').replace('\u2011', '-') if i == 0 else text_of(p)
                              for i, p in enumerate(re.findall(r'<p[^>]*>(.*?)</p>', item, re.S))]
                paragraphs = [p for p in paragraphs if p]
                if not paragraphs:
                    continue
                match = HEAD.match(paragraphs[0])
                if not match:
                    continue
                section, rest = match.group(1), match.group(2).strip()
                # Appendix titles (municipal charters, executive orders) number sections within each chapter: "24App:3-101".
                appendix = row['title'].endswith('APPENDIX')
                number = f"{title_label(row['title']).replace(' App.', 'App')}:{row['chapter'].lstrip('0') + '-' if appendix else ''}{section}"
                if number in seen:
                    continue
                seen.add(number)
                heading, text_parts = rest, paragraphs[1:]
                # A repealed section prints as one paragraph: "§ 12. Repealed. 2009, No. 3, § 2."
                gone = GONE.match(heading)
                tail = section.split('-')[-1]  # the Uniform Commercial Code's "9-101" is page 00101 of chapter 9
                url = f"{SITE}/statutes/section/{row['title']}/{row['chapter']}/{tail.zfill(5 + len(re.sub(r'^[0-9]+', '', tail)))}"
                common = dict(number=number, url=url, title=f"{row['title']}/{row['chapter']}", title_name=title_name)
                if gone and not text_parts:
                    yield Section(heading=heading.rstrip('.'), text='', status='repealed', **common)
                    continue
                text = ' '.join(text_parts)
                # The history line is the last parenthesis of the last paragraph: "(Added 2005, No. 125 (Adj. Sess.), § 1, eff. May 3, 2006.)"
                history = ''
                hist = re.search(r'\(((?:Added|Amended|\d{4},|[0-9]{4} No\.|V\.S\.|P\.S\.|G\.L\.|R\.L\.|G\.S\.|R\.S\.|Formerly)[^()]*(?:\([^()]*\)[^()]*)*)\)\s*$', text)
                if hist:
                    history = hist.group(1).strip()
                    text = text[:hist.start()].strip()
                status = 'live'
                if not text or (GONE.match(text) and len(text) < 300):
                    status = 'repealed' if text or gone else 'reserved'
                law = LAW.match(history.split(';')[0].strip())
                yield Section(heading=heading.rstrip('.').strip(), text=text, history=history, status=status,
                              act=f'{law.group(1)}-{law.group(2)}' if law else '', enacted=[int(law.group(1))] if law else None, **common)

    def short_citation(self, number: str) -> str:
        title, section = split_number(number)
        if title.endswith('App'):
            chapter, _, section = section.partition('-')
            return f'Vt. Stat. Ann. tit. {title[:-3]} app. ch. {chapter}, § {section}'
        return f'Vt. Stat. Ann. tit. {title}, § {section}'

    def key(self, number: str) -> str:
        title, section = split_number(number)
        slug = lambda text: re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
        return f'vermont-statutes-title-{slug(title)}-section-{slug(section)}'


ADAPTER = Vermont()
