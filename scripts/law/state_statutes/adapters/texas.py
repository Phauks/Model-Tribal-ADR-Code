"""Texas: the Texas statutes (the codes, Vernon's Civil Statutes and the uncodified Insurance Code articles), read from the Texas
Legislative Council's download of each code as zipped HTML, one file per chapter (tcss.legis.texas.gov/resources/Zips/<code>.htm.zip,
the files the Download page of statutes.capitol.texas.gov hands out). Section numbers here are `<code>:<section>` ("GV:751.001"),
since each code numbers its own sections; the Constitution is not read. Where a section is printed twice (two bills each added or
changed it, "Text of section as added by ..."), the versions are read together as one section."""
from __future__ import annotations

import html
import re
import zipfile
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

DOWNLOAD = 'https://tcss.legis.texas.gov/resources/Zips/{code}.htm.zip'
# code: (name, Indigo Book abbreviation, cited by article)
CODES = {
    'AG': ('Agriculture Code', 'Tex. Agric. Code Ann.', False),
    'AL': ('Alcoholic Beverage Code', 'Tex. Alco. Bev. Code Ann.', False),
    'BC': ('Business & Commerce Code', 'Tex. Bus. & Com. Code Ann.', False),
    'BO': ('Business Organizations Code', 'Tex. Bus. Orgs. Code Ann.', False),
    'CP': ('Civil Practice and Remedies Code', 'Tex. Civ. Prac. & Rem. Code Ann.', False),
    'CR': ('Code of Criminal Procedure', 'Tex. Code Crim. Proc. Ann.', True),
    'ED': ('Education Code', 'Tex. Educ. Code Ann.', False),
    'EL': ('Election Code', 'Tex. Elec. Code Ann.', False),
    'ES': ('Estates Code', 'Tex. Est. Code Ann.', False),
    'FA': ('Family Code', 'Tex. Fam. Code Ann.', False),
    'FI': ('Finance Code', 'Tex. Fin. Code Ann.', False),
    'GV': ('Government Code', "Tex. Gov't Code Ann.", False),
    'HS': ('Health and Safety Code', 'Tex. Health & Safety Code Ann.', False),
    'HR': ('Human Resources Code', 'Tex. Hum. Res. Code Ann.', False),
    'IN': ('Insurance Code', 'Tex. Ins. Code Ann.', False),
    'I1': ('Insurance Code (articles not codified)', 'Tex. Ins. Code Ann.', True),
    'LA': ('Labor Code', 'Tex. Lab. Code Ann.', False),
    'LG': ('Local Government Code', "Tex. Loc. Gov't Code Ann.", False),
    'NR': ('Natural Resources Code', 'Tex. Nat. Res. Code Ann.', False),
    'OC': ('Occupations Code', 'Tex. Occ. Code Ann.', False),
    'PW': ('Parks and Wildlife Code', 'Tex. Parks & Wild. Code Ann.', False),
    'PE': ('Penal Code', 'Tex. Penal Code Ann.', False),
    'PR': ('Property Code', 'Tex. Prop. Code Ann.', False),
    'SD': ('Special District Local Laws Code', 'Tex. Spec. Dist. Code Ann.', False),
    'TX': ('Tax Code', 'Tex. Tax Code Ann.', False),
    'TN': ('Transportation Code', 'Tex. Transp. Code Ann.', False),
    'UT': ('Utilities Code', 'Tex. Util. Code Ann.', False),
    'WA': ('Water Code', 'Tex. Water Code Ann.', False),
    'CV': ("Vernon's Texas Civil Statutes", 'Tex. Rev. Civ. Stat. Ann.', True),
    'WL': ("Vernon's Texas Civil Statutes (auxiliary water laws)", 'Tex. Rev. Civ. Stat. Ann.', True),
}
ANCHOR = re.compile(r'<p class="left"><a name="([^"]+)"></a>(?:<a name="[^"]*"></a>)*</p>')
HEAD = re.compile(r'<a target="_blank" href="([^"]+)" style="color:inherit;font-weight:bold;">\s*(?:Sec\.|Art\.)\s*([^<]*?)</a>')
HISTORY = re.compile(r'^(?:Added by|Acts \d{4}|Amended by|Renumbered|Transferred|Redesignated|Reenacted|Text of|Derived from|Repealed by Acts|Expired)', re.I)
LAW = re.compile(r'^(?:Added by )?Acts (\d{4}), (\d+)(?:st|nd|rd|th) Leg\.(?:, ([0-9A-Za-z.]+ ?(?:C\.S\.|R\.S\.)?))?.*?\bch\. ?(\d+)', re.I)
GONE = re.compile(r'^(?:Repealed|Expired|Transferred|Renumbered|Redesignated)\b', re.I)
SMALL = {'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with', 'upon', 'under', 'nor', 'than', 'via'}
ACRONYMS = {'hub', 'hubs', 'hiv', 'aids', 'tanf', 'ems', 'u.s.', 'ii', 'iii', 'iv', 'vi', 'dna', 'gps', 'id', 'atm', 'atms', 'dwi', 'ccr', 'chip', 'ercot',
            'nafta', 'ueta', 'pace', 'cpr', 'ged', 'hmo', 'ppo', 'snap', 'wic', 'llc', 'llp', 'ihs', 'icwa', 'ad', 'faa', 'fbi', 'bnb', 'idea'}


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


def title_case(text: str) -> str:
    """The Council prints catchlines in capitals ("SALES BY OR TO INDIAN TRIBES"): give them title case, small words lower."""
    out = []
    for index, word in enumerate(text.lower().split(' ')):
        bare = word.strip('();,:."\'')
        if bare in ACRONYMS:
            out.append(word.upper())
        elif index and bare in SMALL and not out[-1].endswith((';', ':')):
            out.append(word)
        else:
            out.append('-'.join(re.sub(r'[a-z]', lambda m: m.group(0).upper(), part, count=1) for part in word.split('-')))
    return ' '.join(out)


def split_number(number: str) -> tuple[str, str]:
    code, section = number.split(':', 1)
    return code, section


def chapter_order(name: str) -> tuple:
    parts = name.split('.')[1:-1]
    return tuple((int(re.match(r'\d*', part).group(0) or 0), part) for part in parts)


class Texas(State):
    STATE = 'TX'
    NAME = 'Texas'
    CODE_NAME = 'Texas Statutes'
    CODE_SHORT = 'Tex.'
    AUTHOR = 'Texas Legislative Council'
    EDITION = 2025
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'texas'
    SOURCE_NOTE = "Text read from the Texas Legislative Council's download of the code as HTML (statutes.capitol.texas.gov) on Nov. 27, 2026."
    NATION_NAMES = ('Alabama-Coushatta', 'Ysleta del Sur', 'Tigua', 'Kickapoo Traditional Tribe', 'Kickapoo Tribe', 'Lipan Apache', 'Caddo', 'Tonkawa',
                    'Wichita and Affiliated', 'Karankawa', 'Coahuiltecan')
    PLACE_NAMES = ('Comanche County', 'Cherokee County', 'Wichita County', 'Wichita Falls', 'Caddo Lake', 'Caddo Mills', 'Kiowa County', 'Indian Creek',
                   'Indian Lake', 'Indian Springs', 'Indian Hills', 'Navajo Street', 'Apache Shores', 'Tonkawa Falls', 'Comanche Peak',
                   'Comanche Trail', 'Kickapoo Creek', 'Wichita River', 'city of Comanche', 'City of Comanche', 'Shawnee Trail', 'Cheyenne')
    HELD: dict[str, str] = {}

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        failed = self.download_all((DOWNLOAD.format(code=code), raw / f'{code}.htm.zip') for code in CODES)
        print(f'TX: {len(CODES)} codes, {len(failed)} failed', *failed)

    def parse(self, raw: Path) -> Iterator[Section]:
        for code, (code_name, _short, _article) in CODES.items():
            archive = zipfile.ZipFile(raw / f'{code}.htm.zip')
            versions: dict[str, Section] = {}
            order: list[str] = []
            for name in sorted(archive.namelist(), key=chapter_order):
                page = archive.read(name).decode('utf-8-sig', 'replace')
                body = page[page.find('<pre'):]
                headings, title_name = {}, []
                anchors = list(ANCHOR.finditer(body))
                for index, anchor in enumerate(anchors):
                    # Title, chapter and subchapter lines printed before this section.
                    before = body[(anchors[index - 1].end() if index else 0):anchor.start()]
                    for line in re.findall(r'<p class="center"[^>]*>(.*?)</p>', before, re.S):
                        line = text_of(line)
                        level = line.split(' ')[0].upper()
                        if level in ('TITLE', 'SUBTITLE', 'CHAPTER', 'SUBCHAPTER', 'ARTICLE', 'PART'):
                            headings[level] = line
                            for lower in {'TITLE': ('SUBTITLE', 'CHAPTER', 'SUBCHAPTER', 'PART'), 'SUBTITLE': ('CHAPTER', 'SUBCHAPTER', 'PART'),
                                          'CHAPTER': ('SUBCHAPTER', 'PART'), 'ARTICLE': ('SUBCHAPTER', 'PART'), 'SUBCHAPTER': ('PART',)}.get(level, ()):
                                headings.pop(lower, None)
                    chunk = body[anchor.end():anchors[index + 1].start() if index + 1 < len(anchors) else len(body)]
                    head = HEAD.search(chunk)
                    if not head:
                        continue
                    label = text_of(head.group(2))
                    match = re.match(r'([0-9A-Za-z.()\-]+?)\.\s+(.*)$', label)
                    if not match:
                        continue
                    section, heading = match.group(1), title_case(match.group(2).rstrip('.').strip())
                    paragraphs = [text_of(part) for part in re.findall(r'<p[^>]*>(.*?)</p>', chunk[chunk.rfind('<p', 0, head.start()):], re.S)]
                    paragraphs = [part for part in paragraphs if part]
                    first = paragraphs[0] if paragraphs else ''
                    first = first[len(text_of(head.group(0))):].strip() if first.startswith(text_of(head.group(0))) else re.sub(r'^(?:Sec\.|Art\.)\s*\S+\s*', '', first)
                    paragraphs = [first] + paragraphs[1:] if paragraphs else []
                    text_parts, history_parts = [], []
                    for part in paragraphs:
                        (history_parts if history_parts or HISTORY.match(part) and part is not paragraphs[0] else text_parts).append(part)
                    text = ' '.join(text_parts).strip()
                    history = ' '.join(history_parts).strip()
                    number = f'{code}:{section}'
                    chapter = headings.get('CHAPTER') or headings.get('ARTICLE') or ''
                    title_name = ' / '.join(part for part in (code_name, headings.get('TITLE', ''), headings.get('SUBTITLE', ''), chapter,
                                                               headings.get('SUBCHAPTER', '')) if part)
                    status = 'repealed' if GONE.match(text or heading) and len(text) < 400 else ('reserved' if not text else 'live')
                    law = LAW.match(history)
                    act = f'{law.group(1)}-{law.group(2)}-{law.group(4)}' if law else ''
                    current = Section(number=number, heading=heading, text=text, url=head.group(1).replace('http://', 'https://'),
                                      title=f"{code}:{re.sub(r'^CHAPTER ', '', chapter.split('.')[0]) if chapter else ''}",
                                      title_name=title_name, history=history, status=status, act=act, enacted=[int(law.group(1))] if law else None)
                    if number in versions:
                        earlier = versions[number]
                        if earlier.status != 'live' and current.status == 'live':
                            versions[number] = current
                        elif current.status == 'live':
                            earlier.text = f'{earlier.text} [Another version:] {current.text}'
                            earlier.history = f'{earlier.history} {current.history}'.strip()
                        continue
                    versions[number] = current
                    order.append(number)
            for number in order:
                yield versions[number]

    def short_citation(self, number: str) -> str:
        code, section = split_number(number)
        _name, short, article = CODES[code]
        return f"{short} {'art.' if article else '§'} {section}"

    def key(self, number: str) -> str:
        code, section = split_number(number)
        slug = lambda text: re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
        name, _short, article = CODES[code]
        name = {'CV': 'civil statutes', 'WL': 'civil statutes', 'I1': 'insurance code'}.get(code, name)
        return f"texas-{slug(name)}-{'article' if article else 'section'}-{slug(section)}"

    def citation_parts(self, row: dict) -> dict:
        code, section = split_number(row['number'])
        name, short, _article = CODES[code]
        return {'container-title': name if code not in ('CV', 'WL') else "Vernon's Texas Civil Statutes", 'container-title-short': short,
                'section': section}


ADAPTER = Texas()
