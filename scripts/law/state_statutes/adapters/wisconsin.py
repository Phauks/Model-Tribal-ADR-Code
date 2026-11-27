"""Wisconsin: the Wisconsin Statutes, read from the Legislative Reference Bureau's whole-chapter PDFs (docs.legis.wisconsin.gov/document/statutes/<chapter>.pdf),
for the chapters listed on the statutes' table of contents. The chapter web pages show only the first few sections and load the rest as the reader scrolls,
so the PDF is the one copy of a whole chapter. The site refuses connections from cloud sessions, so the download runs on GitHub
(.github/workflows/fetch-state-code.yml) and the session parses what it brings back."""
from __future__ import annotations

import collections
import re
import subprocess
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section

SITE = 'https://docs.legis.wisconsin.gov'
INDEXES = ('/statutes/prefaces/toc', '/statutes/statutes')
# Each PDF page's running head and foot: the edition line, the page head with the chapter name and page number, and the three-line currency note.
FURNITURE = re.compile(r'Published and certified under s\. 35\.18\. November|Updated \d\d\D\d\d Wis\. Stats\.|Wisconsin Statutes updated through|'
                       r'^\s*stances Board Orders filed|^\s*after November \d+, \d{4}, are designated by NOTES')
NUMBER = r'\d+\.\d+[a-z]?'
ENTRY = re.compile(rf'^({NUMBER})\s+(\S.*)$')  # a contents line, or a section's first line: the number, then the catchline
HISTORY = re.compile(r'^\s*History:\s*(.*)$')


def columns(page: str) -> list[str]:
    """pdftotext -layout prints the two columns of a page side by side; return the left column's lines, then the right's.

    Most lines put the right column at one place, but a row set in the smaller annotation type puts it further right, so a line with no
    gap at the main place is cut at its gap nearest the main place among the places where at least three of the page's gaps end."""
    lines = [line for line in page.split('\n') if not FURNITURE.search(line)]
    gap = re.compile(r'(?:^|(?<=\S)) {2,}(?=\S)')
    starts = collections.Counter()
    for line in lines:
        for match in gap.finditer(line):
            if 55 <= match.end() <= 110:
                starts[match.end()] += 1
    if not starts:
        return lines
    counts = {c: starts[c - 1] + starts[c] + starts[c + 1] for c in starts}
    best = max(counts.values())
    if best < 3:  # a one-column page
        return lines
    # The main place is the leftmost well-used one (a contents page also lines up its catchlines a few places further right).
    cut = min(c for c, count in counts.items() if count >= best / 2 and starts[c] >= starts[c - 1] and starts[c] >= starts[c + 1])
    places = {c for c, count in counts.items() if count >= 3}
    left, right = [], []
    for line in lines:
        at = len(line)
        if len(line) > cut - 2:
            ends = [match.end() for match in gap.finditer(line)]
            main = [end for end in ends if abs(end - cut) <= 1]
            other = [end for end in ends if end in places]
            if main:
                at = main[0]
            elif line[cut - 1:cut] == ' ' and line[cut - 2:cut - 1] == ' ':
                at = cut
            elif other:
                at = min(other, key=lambda end: abs(end - cut))
            else:
                near = [end for end in ends if abs(end - cut) <= 12]
                if near:
                    at = min(near, key=lambda end: abs(end - cut))
                elif line[cut - 1:cut] == ' ':
                    at = cut
        left.append(line[:at].rstrip())
        right.append(line[at:].rstrip())
    return left + right


def join(lines: list[str]) -> str:
    """One line of text: line-end hyphens before a lowercase letter are taken out, other breaks become spaces."""
    text = ''
    for line in (line.strip() for line in lines):
        if not line:
            continue
        if text.endswith('-') and not text.endswith(' -') and (line[:1].islower() or (text[-2:-1].isupper() and line[:1].isupper())):
            text = text[:-1] + line
        else:
            text = f'{text} {line}' if text else line
    return re.sub(r'\s+', ' ', text).strip()


SMALL = {'a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with'}


def title_case(name: str) -> str:
    parts = name.lower().split()
    return ' '.join(part if index and part in SMALL else part[:1].upper() + part[1:] for index, part in enumerate(parts))


def words(text: str) -> str:
    return re.sub(r'[^a-z0-9]', '', text.lower())


class Wisconsin(State):
    STATE = 'WI'
    NAME = 'Wisconsin'
    CODE_NAME = 'Wisconsin Statutes'
    CODE_SHORT = 'Wis. Stat.'
    AUTHOR = 'Wisconsin Legislative Reference Bureau'
    EDITION = '2023-24'  # the biennial edition, updated through 2025 Wisconsin Act 247 and published Nov. 4, 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'wisconsin-statutes'
    SOURCE_NOTE = ("Text read from the Wisconsin Legislative Reference Bureau's PDF of the section's chapter of the 2023-24 Wisconsin Statutes, updated "
                   "through 2025 Wisconsin Act 247 and published Nov. 4, 2026 (docs.legis.wisconsin.gov/statutes), on Nov. 27, 2026.")
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
        files = sorted((raw / 'text').glob('*.txt'), key=lambda path: (int(re.match(r'\d+', path.stem).group(0)), path.stem))
        if not files:
            raise SystemExit('WI: no chapter text: unpack the download from GitHub into raw/text')
        for path in files:
            yield from self.chapter(path.stem, path.read_text())

    def chapter(self, chapter: str, text: str) -> Iterator[Section]:
        lines = [line for page in text.split('\f') for line in columns(page)]
        # The chapter's name is printed in capitals under "CHAPTER <n>".
        name = ''
        for index, line in enumerate(lines):
            if re.fullmatch(rf'\s*CHAPTER {re.escape(chapter.upper())}\s*', line):
                name = ' '.join(part.strip() for part in lines[index + 1:index + 3] if part.strip() and part.strip() == part.strip().upper()
                                and not ENTRY.match(part.strip()) and 'SUBCHAPTER' not in part)
                break
        title_name = f'Chapter {chapter}' + (f', {title_case(name)}' if name else '')
        # Every section's number and catchline are printed first in the chapter's contents and again where the section starts. The contents
        # can run in two columns beside the first sections, so a number's first printing is taken for its contents line and any later
        # printing with the same catchline for the section's start.
        contents: dict[str, str] = {}
        listed: set[int] = set()  # the lines of the contents, which can fall inside the first sections' text
        starts = []
        last = None
        for index, line in enumerate(lines):
            match = ENTRY.match(line)
            if match and match.group(1).split('.')[0] == chapter:  # a line that opens with another chapter's section number is a cross-reference
                number, rest = match.group(1), match.group(2).strip()
                last = None
                if number not in contents:
                    contents[number] = rest
                    listed.add(index)
                    last = number
                    continue
                catchline = words(contents[number])[:12]
                if words(rest).startswith(catchline) or catchline.startswith(words(rest)[:12]):
                    starts.append((index, number))
            elif last and line.startswith(' ') and line.strip() and not contents[last].endswith('.') and line.strip() != line.strip().upper():
                contents[last] += ' ' + line.strip()
                listed.add(index)
            elif line.strip():
                last = None
        # The contents' subchapter headings (capitals only) sit between contents lines; take them out with the contents.
        def capitals(line: str) -> bool:
            return bool(line.strip()) and not re.search(r'[a-z]', line) and not re.match(r'\s*\(', line)
        changed = True
        while changed:
            changed = False
            for index, line in enumerate(lines):
                if index in listed or not capitals(line):
                    continue
                before = next((k for k in range(index - 1, -1, -1) if lines[k].strip()), None)
                after = next((k for k in range(index + 1, len(lines)) if lines[k].strip()), None)
                if before in listed or after in listed:
                    listed.add(index)
                    changed = True
        listed |= {index for index, line in enumerate(lines) if re.fullmatch(rf'\s*CHAPTER {re.escape(chapter.upper())}\s*', line)}
        # A number can start more than one block: chapter 20's schedule prints each agency's number and name before its section does. The
        # block with a history line is the section; failing that, the longest.
        chosen: dict[str, tuple[int, str, str]] = {}
        for position, (index, number) in enumerate(starts):
            end = starts[position + 1][0] if position + 1 < len(starts) else len(lines)
            body, history = [], []
            in_history = False
            for line in (lines[k] for k in range(index, end) if k not in listed):
                match = HISTORY.match(line)
                if match and not in_history and not history:
                    in_history = True
                    history.append(match.group(1))
                    continue
                if in_history:
                    if not line.strip() or line.startswith(' '):  # a blank line or a new indented paragraph ends the history
                        in_history = False
                        body.append(None)  # everything after the history is editorial
                        break
                    history.append(line)
                    continue
                body.append(line)
            body = [line for line in body if line is not None]
            full = join(body)
            heading = contents[number].rstrip('.').strip()
            # Take the number and catchline off the front of the text, word by word.
            pattern = r'\s*-?\s*'.join(re.escape(char) for char in re.sub(r'\s+', '', f'{number}{contents[number]}'))
            match = re.match(pattern, full)
            section_text = full[match.end():].strip() if match else full[len(number):].strip()
            best = chosen.get(number)
            if best is None or (bool(history), len(section_text)) > (bool(best[2]), len(best[1])):
                chosen[number] = (index, section_text, join(history))
        for number, (index, section_text, history) in sorted(chosen.items(), key=lambda item: item[1][0]):
            heading = contents[number].rstrip('.').strip()
            status = 'repealed' if re.match(r'^(?:\[?Repealed|Renumbered)', section_text) and len(section_text) < 300 else 'live'
            yield Section(number=number, heading=heading, text=section_text, url=f'{SITE}/document/statutes/{number}', title=chapter,
                          title_name=title_name, history=history, status=status)


ADAPTER = Wisconsin()
