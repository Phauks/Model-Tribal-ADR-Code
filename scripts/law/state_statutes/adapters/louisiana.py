"""Louisiana: the Louisiana Revised Statutes and the Children's Code, read from the State Legislature's page for each section
(legis.la.gov/Legis/Law.aspx?d=<document number>), listed on each title's table of contents (Laws_Toc.aspx?folder=<n>). The
Revised Statutes' front page names its titles' folders only inside its page state, so the folder numbers are read from there."""
from __future__ import annotations

import base64
import html
import json
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

SITE = 'https://legis.la.gov/Legis/'
STATUTES = 75   # the Revised Statutes' folder
CHILDREN = 71   # the Children's Code's folder
# The first session law in the history paragraph: "Acts 1991, No. 235, §7." or "Added by Acts 2008, No. 1".
LAW = re.compile(r'Acts (\d{4}),(?: \d(?:st|nd|rd|th) Ex\. Sess\.,)? No\. (\d+)')


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


class Louisiana(State):
    STATE = 'LA'
    NAME = 'Louisiana'
    CODE_NAME = 'Louisiana Revised Statutes'
    CODE_SHORT = 'La. Stat. Ann.'
    AUTHOR = 'Louisiana State Legislature'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'louisiana-revised-statutes'
    SOURCE_NOTE = "Text read from the Louisiana State Legislature's page for the section (legis.la.gov/Legis/Law.aspx) on Nov. 27, 2026."
    NATION_NAMES = ('Chitimacha', 'Coushatta', 'Tunica', 'Biloxi', 'Choctaw', 'Houma', 'Caddo', 'Adai', 'Clifton Choctaw', 'Atakapa',
                    'Ishak', 'Natchitoches', 'Opelousas', 'Avoyel', 'Bayougoula', 'Washa', 'Chawasha', 'Pointe-au-Chien', 'Grand Caillou', 'Dulac')
    PLACE_NAMES = ('Caddo Parish', 'parish of Caddo', 'Parish of Caddo', 'Caddo Lake', 'Caddo-Bossier', 'Natchitoches Parish', 'parish of Natchitoches',
                   'Parish of Natchitoches', 'city of Natchitoches', 'City of Natchitoches', 'Natchitoches Parish School', 'city of Opelousas',
                   'city of Houma', 'Avoyelles', 'Tunica-Biloxi Indian Reservation Road', 'Biloxi Marsh', 'Coushatta, Louisiana', 'town of Coushatta',
                   'Town of Coushatta', 'Bayou Lafourche', 'Pointe-au-Chien Wildlife', 'Caddo Levee', 'Ouachita', 'Tensas',
                   'Atchafalaya', 'Catahoula', 'Tangipahoa', 'Natchitoches Parish Port')
    WORKERS = 14

    def titles(self, raw: Path) -> list[tuple[int, str]]:
        front = raw / 'statutes.html'
        if not front.exists():
            front.write_bytes(self.get(f'{SITE}Laws_Toc.aspx?folder={STATUTES}&level=Parent'))
        state = re.search(r'id="__VIEWSTATE" value="([^"]+)"', front.read_text(errors='replace')).group(1)
        strings = [s.decode() for s in re.findall(rb'[\x20-\x7e]{2,}', base64.b64decode(state))]
        titles = []
        for index, value in enumerate(strings[:-3]):
            # The page state holds each title as: <folder>, "TITLE <n>dd", <folder>, "<name>dd" (a length byte can lead the name).
            if value.isdigit() and strings[index + 1].startswith('TITLE ') and strings[index + 2] == value:
                titles.append((int(value), strings[index + 1][:-2] + ': ' + re.sub(r'^\W', '', strings[index + 3])[:-2]))
        return titles

    def folders(self, raw: Path) -> list[tuple[int, str]]:
        return [(folder, name) for folder, name in self.titles(raw)] + [(CHILDREN, "Children's Code")]

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'sections.json'
        if not listing.exists():
            rows = []
            for folder, name in self.folders(raw):
                page = self.get(f'{SITE}Laws_Toc.aspx?folder={folder}').decode('utf-8', 'replace')
                for row in re.findall(r'<tr[^>]*valign="top"[^>]*>(.*?)</tr>', page, re.S):
                    cells = re.findall(r'href="Law\.aspx\?d=(\d+)"[^>]*>(.*?)</a>', row, re.S)
                    if len(cells) == 2:
                        rows.append({'doc': cells[0][0], 'label': text_of(cells[0][1]), 'heading': text_of(cells[1][1]), 'folder': folder, 'folder_name': name})
            listing.write_text(json.dumps(rows))
            print(f'LA: {len(rows)} table of contents rows')
        rows = json.loads(listing.read_text())
        failed = self.download_all((f"{SITE}Law.aspx?d={row['doc']}", raw / 'docs' / f"{row['doc']}.html") for row in rows if self.number(row['label']))
        print(f'LA: {len(rows)} rows, {len(failed)} failed', *failed[:10])

    @staticmethod
    def number(label: str) -> str:
        """ "RS 1:1" -> "1:1"; "CHC 725.1" -> "art. 725.1"; a title's own row ("RS 1") -> ''."""
        match = re.match(r'RS (\d+[A-Z]?:\S+)$', label)
        if match:
            return match.group(1)
        match = re.match(r'CHC (\d+\S*)$', label)
        return f'art. {match.group(1)}' if match else ''

    def short_citation(self, number: str) -> str:
        if number.startswith('art. '):
            return f'La. Child. Code Ann. {number}'
        return f'{self.CODE_SHORT} § {number}'

    def key(self, number: str) -> str:
        if number.startswith('art. '):
            return 'louisiana-childrens-code-art-' + re.sub(r'[^a-z0-9]+', '-', number[5:].lower()).strip('-')
        return super().key(number)

    def parse(self, raw: Path) -> Iterator[Section]:
        seen = set()
        for row in json.loads((raw / 'sections.json').read_text()):
            number = self.number(row['label'])
            if not number or number in seen:
                continue
            seen.add(number)
            path = raw / 'docs' / f"{row['doc']}.html"
            if not path.exists():
                raise SystemExit(f"LA section {row['label']} was not downloaded: run fetch again")
            page = path.read_text(errors='replace')
            document = re.search(r'id="ctl00_PageBody_LabelDocument">(.*?)</span>\s*</div>', page, re.S)
            paragraphs = [text_of(p) for p in re.findall(r'<P[^>]*>(.*?)</P>', document.group(1) if document else '', re.S | re.I)]
            paragraphs = [p for p in paragraphs if p]
            # Skip the centered heading lines (code, title, chapter, part) and the section's own number line.
            start = next((i for i, p in enumerate(paragraphs) if re.match(r'^(?:§\s*[\d.A-Z:-]+|Art\. [\d.A-Z-]+)\.', p)), None)
            heads = paragraphs[:start] if start is not None else []
            body = paragraphs[start + 1:] if start is not None else paragraphs
            history = []
            while body and re.match(r'^(?:Acts|Added by Acts|Amended by Acts|Redesignated|Repealed by Acts|Source:|\{\{NOTE)', body[-1]):
                history.insert(0, body.pop())
            history_text = ' '.join(history)
            text = ' '.join(body)
            heading = row['heading'].rstrip('.').strip()
            gone = r'^\[?(?:Repealed|Blank|Reserved|Redesignated|Expired|Transferred|Renumbered|Obsolete)\b'
            status = 'repealed' if re.match(gone, heading, re.I) or (re.match(gone, text, re.I) and len(text) < 300) else ('reserved' if not text else 'live')
            law = LAW.search(history_text)
            chapter = ' / '.join(h for h in heads if not h.startswith('LOUISIANA ') and h != "CHILDREN'S CODE")
            title = number.split(':')[0] if ':' in number else 'ChC'
            yield Section(number=number, heading=heading, text=text, url=f"{SITE}Law.aspx?d={row['doc']}", title=title,
                          title_name=chapter or row['folder_name'], history=history_text, status=status,
                          act=f'{law.group(1)}-{law.group(2)}' if law else '', enacted=[int(law.group(1))] if law else None)


ADAPTER = Louisiana()
