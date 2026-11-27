"""Oklahoma: the Oklahoma Statutes, read from the Legislative Service Bureau's title PDFs (oklegislature.gov/OK_Statutes/CompleteTitles),
converted with `pdftotext -layout`. OSCN, the other official site, blocks scripts.

Oklahoma was the pilot state (research/analyses/2026-11-26-state-statutes-pilot.md). Its readings were done before this pipeline
existed, so `run.py seed OK` turns the pilot's list (research/data-roadmap/2026-11-26-state-statutes/oklahoma-indian-law-sections.csv)
into this pipeline's list; after that, `write OK` keeps the records. A new edition can be swept with the usual steps.

The official PDFs print some sections in more than one version (one per enacting bill). Each is one section here: its text is the
versions' texts joined, and `extra.pages` lists the page where each version starts.
"""
from __future__ import annotations

import csv
import json
import re
import subprocess
from collections import defaultdict
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import FIELDS, ROOT, Section, clean

INDEX = 'https://www.oklegislature.gov/osStatuesTitle.html'
PDF = 'https://www.oklegislature.gov/OK_Statutes/CompleteTitles/os{}.pdf'
PILOT_LIST = ROOT / 'research/data-roadmap/2026-11-26-state-statutes/oklahoma-indian-law-sections.csv'
HEAD = re.compile(r'^§(\d+[A-Z]?)-(\d+[A-Za-z0-9.\-]*?)\.\s+(.*)$')
FOOT = re.compile(r'^\s*Oklahoma Statutes - Title .*Page \d+\s*$')
# History lines start with a capital; the pilot matched them in any case, which also took body lines that wrap at "from".
HIST = re.compile(r'^(?:Added by|Amended by|From |Laws |R\.L\.|St\.Supp|Renumbered|Repealed|Codified|Formerly|Source:|Derived)')
LAW = re.compile(r'(?:Added by|From) (?:Laws|L\.) ?(\d{4}),? (?:(?:\d+\w* )?(?:Ex\.\s?Sess\.|E\.S\.),? )?(?:c\.|p\.) ?(\d+)', re.I)
MONTHS = {'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7, 'aug': 8, 'sept': 9, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12}


def split_number(number: str) -> tuple[str, str]:
    """'10:40' -> ('10', '40'): the title, then the section within it."""
    title, section = number.split(':', 1)
    return title, section


def enacted(history: str) -> list[int] | None:
    """The date the section was first enacted, from the first clause of its history line ("Added by Laws 1992, c. 384, § 1, eff. Sept. 1, 1992.")."""
    first = re.split(r'\s(?:Amended|Renumbered|Repealed|Recodified)\b', history)[0]
    match = re.search(r'eff\.\s+([A-Z][a-z]{2,4})\.?\s+(\d{1,2}),\s+(\d{4})', first)
    if match and match.group(1).lower() in MONTHS:
        return [int(match.group(3)), MONTHS[match.group(1).lower()], int(match.group(2))]
    year = re.search(r'\b(1[89]\d\d|20[0-2]\d)\b', first)
    return [int(year.group(1))] if year else None


def heading_of(headings: list[str]) -> str:
    """The section's heading, from whichever printed version has it whole: the official heading ends at its first period, and a
    heading the PDF wrapped onto a second line can be cut short in one version and whole in another."""
    candidates = []
    for heading in headings:
        text = clean(heading)
        whole = re.match(r'^(.*?\.)(?=\s+(?:[A-Z0-9(“"]|$)|$)', text)
        candidates.append((bool(whole), whole.group(1) if whole else text))
    ended = [text for done, text in candidates if done and not text.startswith('See the following versions')]
    return max(ended or [text for _, text in candidates], key=len)


class Oklahoma(State):
    STATE = 'OK'
    NAME = 'Oklahoma'
    CODE_NAME = 'Oklahoma Statutes'
    CODE_SHORT = 'Okla. Stat.'
    AUTHOR = 'Oklahoma Legislature'
    EDITION = 2026
    RETRIEVED = '2026-11-26'
    KEY_PREFIX = 'oklahoma-statutes'
    SESSION = '2026-11-26-state-statutes-pilot'
    FOUND_BY = 'the state statutes pilot'
    CHECK_BY = "the pilot's keyword pass"
    # The pilot's writer, which this adapter replaces: records it wrote are this pipeline's own.
    EARLIER_WRITERS = ('scripts/law/oklahoma_statutes.py',)
    # 3A O.S. § 281 (the Model Tribal Gaming Compact) had a record of its own before the pilot; it was labeled by hand.
    HELD = {'3A:281': 'oklahoma-model-tribal-gaming-compact-3a-281'}
    NATION_NAMES = ('Cherokee', 'Choctaw', 'Chickasaw', 'Muscogee', 'Creek Nation', 'Seminole Nation', 'Osage Nation', 'Osage Minerals',
                    'Osage tribe', 'Kiowa', 'Comanche', 'Apache', 'Caddo', 'Delaware', 'Wichita', 'Pawnee', 'Ponca', 'Otoe', 'Sac and Fox',
                    'Potawatomi', 'Shawnee', 'Quapaw', 'Kickapoo', 'Cheyenne', 'Arapaho', 'Kaw', 'Tonkawa', 'Seneca', 'Wyandotte', 'Modoc',
                    'Ottawa', 'Peoria', 'Miami', 'Iowa Tribe', 'Euchee', 'Yuchi')
    PLACE_NAMES = ('Cherokee County', 'Choctaw County', 'Creek County', 'Seminole County', 'Osage County', 'Delaware County', 'Kiowa County',
                   'Comanche County', 'Caddo County', 'Pawnee County', 'Ottawa County', 'Kay County', 'Pottawatomie County', 'Cimarron County',
                   'Muskogee County')

    def fetch(self, raw: Path) -> None:
        index = self.get(INDEX).decode('utf-8', 'replace')
        titles = sorted(set(re.findall(r'CompleteTitles/os([0-9A-Z]+)\.pdf', index)), key=lambda t: (int(re.match(r'\d+', t).group(0)), t))
        failed = self.download_all((PDF.format(title), raw / 'pdf' / f'os{title}.pdf') for title in titles)
        (raw / 'txt').mkdir(parents=True, exist_ok=True)
        for title in titles:
            pdf, txt = raw / 'pdf' / f'os{title}.pdf', raw / 'txt' / f'os{title}.txt'
            if pdf.exists() and not txt.exists():
                subprocess.run(['pdftotext', '-layout', str(pdf), str(txt)], check=True)
        print(f'OK: {len(titles)} titles, {len(failed)} failed', *failed[:10])

    def printed(self, path: Path) -> Iterator[dict]:
        """Every printed section of one title file, with the PDF page it starts on (pdftotext ends each page with a form feed)."""
        title = path.stem[2:]
        name = ''
        current, page = None, 1
        for raw_line in path.read_text(errors='replace').split('\n'):
            pages_before = raw_line.count('\f')
            line = raw_line.replace('\f', '')
            if not name:
                found = re.match(r'^\s*TITLE (\w+)\. (.+?)\s*$', line)
                if found:
                    name = found.group(2).title()
            if FOOT.match(line):
                page += pages_before
                continue
            # Table of contents lines end in dot leaders and a page number; the body starts at the first heading with no leader.
            head = HEAD.match(line)
            if head and not re.search(r'\.{5,}\s*\d+\s*$', line):
                if current:
                    yield current
                current = {'title': head.group(1), 'section': head.group(2), 'heading': head.group(3).strip(), 'lines': [], 'page': page + pages_before, 'title_name': name}
            elif current is not None and not (re.search(r'\.{5,}\s*\d+\s*$', line) or re.match(r'^\s*§\d+[A-Z]?-\S+\.\s', line)):
                current['lines'].append(line.rstrip())
            page += pages_before
        if current:
            yield current

    def parse(self, raw: Path) -> Iterator[Section]:
        order = lambda path: (int(re.match(r'\d+', path.stem[2:]).group(0)), path.stem[2:])
        for path in sorted((raw / 'txt').glob('os*.txt'), key=order):
            versions = defaultdict(list)
            for printed in self.printed(path):
                body = printed.pop('lines')
                # The heading can wrap onto the first line(s) until the first indented body line.
                while body and body[0] and not body[0].startswith('    ') and not HIST.match(body[0]):
                    printed['heading'] += ' ' + body.pop(0).strip()
                printed['history'] = ' '.join(line.strip() for line in body if HIST.match(line.strip()))
                printed['text'] = clean(' '.join(line for line in body if not HIST.match(line.strip())))
                printed['status'] = 'live'
                if re.match(r'^(Repealed|Renumbered|Expired|Superseded)\b', printed['heading'], re.I):
                    printed['status'] = re.match(r'^(\w+)', printed['heading']).group(1).lower()
                versions[(printed['title'], printed['section'])].append(printed)
            for (title, section), printed in versions.items():
                live = [version for version in printed if version['status'] == 'live'] or printed
                history = ' '.join(dict.fromkeys(version['history'] for version in live if version['history']))
                law = LAW.search(live[0]['history'])
                pages = sorted({version['page'] for version in live})
                yield Section(number=f'{title}:{section}', heading=heading_of([version['heading'] for version in live]).rstrip('.'),
                              text=' '.join(version['text'] for version in live), url=PDF.format(title) + f'#page={pages[0]}',
                              title=title, title_name=live[0]['title_name'], history=history, status=live[0]['status'],
                              act=f'{law.group(1)}-{law.group(2)}' if law else '', enacted=enacted(live[0]['history']), extra={'pages': pages})

    def seed(self, sections: list[Section], out_csv: Path) -> dict:
        """Turn the pilot's list into this pipeline's list, with the pages the pilot found and the history this parse reads."""
        by_number = {section.number: section for section in sections if section.status == 'live'}
        by_number.update({section.number: section for section in sections if section.number not in by_number})
        pilot = defaultdict(list)
        with PILOT_LIST.open(newline='') as file:
            for row in csv.DictReader(file):
                pilot[f"{row['title']}:{row['section']}"].append(row)
        rows, missing = [], []
        for number, printed in pilot.items():
            section = by_number.get(number)
            if section is None:
                missing.append(number)
                continue
            pages = sorted({int(row['official_pdf_page'].rsplit('=', 1)[1]) for row in printed})
            first = printed[0]
            rows.append({'citation': self.short_citation(number), 'number': number, 'heading': heading_of([row['heading'] for row in printed]),
                         'relevance': first['relevance'], 'reader_reason': first['reader_reason'], 'pool': 'pilot',
                         'terms_found': first['terms_found'], 'title': section.title, 'act': section.act,
                         'enacted': json.dumps(section.enacted) if section.enacted else '', 'history': section.history,
                         'url': PDF.format(section.title) + f'#page={pages[0]}', 'extra': json.dumps({'pages': pages})})
        if missing:
            raise SystemExit(f'OK: not in the parsed sections: {missing}')
        out_csv.parent.mkdir(parents=True, exist_ok=True)
        with out_csv.open('w', newline='') as file:
            writer = csv.DictWriter(file, FIELDS)
            writer.writeheader()
            writer.writerows(rows)
        return {'rows': len(rows)}

    # The record's parts that differ from the shared shape.
    def short_citation(self, number: str) -> str:
        title, section = split_number(number)
        return f'Okla. Stat. tit. {title}, § {section}'

    def key(self, number: str) -> str:
        title, section = split_number(number)
        slug = lambda text: re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
        return f'oklahoma-statutes-title-{slug(title)}-section-{slug(section)}'

    def citation_parts(self, row: dict) -> dict:
        title, section = split_number(row['number'])
        return {'volume': title, 'section': section}

    def source_note(self, row: dict) -> str:
        pages = json.loads(row['extra'])['pages']
        where = f'page {pages[0]}' if len(pages) == 1 else f'pages {", ".join(map(str, pages[:-1]))} and {pages[-1]} (the official text prints the section in {len(pages)} versions)'
        return f"Text read from the Legislative Service Bureau's Title {row['title']} PDF (updated Nov. 12, 2026), {where}."

    def state_law_extra(self, row: dict) -> dict:
        return {'page': json.loads(row['extra'])['pages'][0]}

    def finish(self, records: list[dict]) -> None:
        """Every section of a title links to a page of the same title PDF: the records are different documents at one address."""
        by_title = defaultdict(list)
        for entry in records:
            by_title[entry['citation']['volume']].append(entry['key'])
        for entry in records:
            others = sorted(key for key in by_title[entry['citation']['volume']] if key != entry['key'])
            if not others:
                continue
            ordered = {}
            for name, value in entry.items():
                ordered[name] = value
                if name == 'history':
                    ordered['shares_link_with'] = others
            entry.clear()
            entry.update(ordered)


ADAPTER = Oklahoma()
