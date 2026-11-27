"""California: the 29 California codes, read from the Legislative Counsel's bulk database dump (downloads.leginfo.legislature.ca.gov,
pubinfo_2025.zip: LAW_SECTION_TBL with one content file per section, LAW_TOC_TBL and LAW_TOC_SECTIONS_TBL for the order and the
headings). The leginfo site refuses scripts, so the dump is the only way in; each record links to the section's page there.

A section's number here is '<code>:<section>' ("WIC:224.1"), since every code numbers its own sections."""
from __future__ import annotations

import html
import re
import zipfile
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

DUMP = 'https://downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip'
DISPLAY = 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml'
TODAY = '2026-11-27'

# The Indigo Book (and Bluebook table T1) forms of the code names.
CODES = {
    'BPC': ('Business and Professions Code', 'Cal. Bus. & Prof. Code'),
    'CCP': ('Code of Civil Procedure', 'Cal. Civ. Proc. Code'),
    'CIV': ('Civil Code', 'Cal. Civ. Code'),
    'COM': ('Commercial Code', 'Cal. Com. Code'),
    'CORP': ('Corporations Code', 'Cal. Corp. Code'),
    'EDC': ('Education Code', 'Cal. Educ. Code'),
    'ELEC': ('Elections Code', 'Cal. Elec. Code'),
    'EVID': ('Evidence Code', 'Cal. Evid. Code'),
    'FAM': ('Family Code', 'Cal. Fam. Code'),
    'FIN': ('Financial Code', 'Cal. Fin. Code'),
    'FGC': ('Fish and Game Code', 'Cal. Fish & Game Code'),
    'FAC': ('Food and Agricultural Code', 'Cal. Food & Agric. Code'),
    'GOV': ('Government Code', "Cal. Gov't Code"),
    'HNC': ('Harbors and Navigation Code', 'Cal. Harb. & Nav. Code'),
    'HSC': ('Health and Safety Code', 'Cal. Health & Safety Code'),
    'INS': ('Insurance Code', 'Cal. Ins. Code'),
    'LAB': ('Labor Code', 'Cal. Lab. Code'),
    'MVC': ('Military and Veterans Code', 'Cal. Mil. & Vet. Code'),
    'PEN': ('Penal Code', 'Cal. Penal Code'),
    'PROB': ('Probate Code', 'Cal. Prob. Code'),
    'PCC': ('Public Contract Code', 'Cal. Pub. Cont. Code'),
    'PRC': ('Public Resources Code', 'Cal. Pub. Res. Code'),
    'PUC': ('Public Utilities Code', 'Cal. Pub. Util. Code'),
    'RTC': ('Revenue and Taxation Code', 'Cal. Rev. & Tax. Code'),
    'SHC': ('Streets and Highways Code', 'Cal. Sts. & High. Code'),
    'UIC': ('Unemployment Insurance Code', 'Cal. Unemp. Ins. Code'),
    'VEH': ('Vehicle Code', 'Cal. Veh. Code'),
    'WAT': ('Water Code', 'Cal. Water Code'),
    'WIC': ('Welfare and Institutions Code', 'Cal. Welf. & Inst. Code'),
}


def field(value: str) -> str:
    value = value.strip()
    return '' if value == 'NULL' else value.strip('`')


def rows(path: Path) -> Iterator[list[str]]:
    with path.open(encoding='utf-8', errors='replace') as file:
        for line in file:
            yield [field(value) for value in line.rstrip('\n').split('\t')]


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


def split_number(number: str) -> tuple[str, str]:
    code, section = number.split(':', 1)
    return code, section


class California(State):
    STATE = 'CA'
    NAME = 'California'
    CODE_NAME = 'California Codes'
    CODE_SHORT = 'Cal.'
    AUTHOR = 'California Legislative Counsel'
    EDITION = 2026
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'california-code'
    SOURCE_NOTE = ("Text read from the California Legislative Counsel's database of the codes (pubinfo_2025.zip, updated Nov. 23, 2026, "
                   "downloads.leginfo.legislature.ca.gov) on Nov. 27, 2026.")
    NATION_NAMES = ('Yurok', 'Hoopa', 'Hupa', 'Karuk', 'Karok', 'Pomo', 'Miwok', 'Me-Wuk', 'Chumash', 'Cahuilla', 'Luiseño', 'Luiseno',
                    'Kumeyaay', 'Washoe', 'Maidu', 'Wintun', 'Wiyot', 'Tolowa', 'Chemehuevi', 'Quechan', 'Tongva', 'Gabrieleño', 'Gabrielino',
                    'Ohlone', 'Esselen', 'Yokut', 'Yokuts', 'Paiute', 'Shoshone', 'Achomawi', 'Mechoopda', 'Tachi', 'Agua Caliente', 'Morongo',
                    'Pechanga', 'Sycuan', 'Viejas', 'Barona', 'Tule River Tribe', 'Pit River Tribe', 'Round Valley', 'Hupa', 'Wailaki',
                    'Juaneño', 'Acjachemen', 'Amah Mutsun', 'Mono Tribe', 'Timbisha', 'Kashia', 'Coyote Valley', 'Dry Creek')
    PLACE_NAMES = ('Paiute Pass', 'Round Valley Reservoir', 'Round Valley Unified', 'Agua Caliente Springs', 'Cahuilla Creek',
                   'Dry Creek Road', 'Pomona', 'Indian Wells', 'Indian Valley', 'Indian Creek', 'Indian Head')
    WORKERS = 1

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        dump = raw / 'pubinfo_2025.zip'
        if not dump.exists():
            print(f'CA: download {DUMP} (about 1.3 GB) into {raw} first, with curl -C - to resume; it is cut off now and then')
            raise SystemExit(1)
        law = raw / 'law'
        if not (law / 'LAW_SECTION_TBL.dat').exists():
            with zipfile.ZipFile(dump) as archive:
                names = [name for name in archive.namelist() if name.startswith(('CODES_TBL', 'LAW_SECTION_TBL', 'LAW_TOC'))]
                archive.extractall(law, names)
        print(f'CA: {sum(1 for _ in law.iterdir())} files in {law}')

    def parse(self, raw: Path) -> Iterator[Section]:
        law = raw / 'law'
        # Every version of each section; keep the one in force today (a later one waits on an operative date).
        versions = {}
        for row in rows(law / 'LAW_SECTION_TBL.dat'):
            (_, code, number, year, chapter, _, effective, version, *_rest) = row
            if code not in CODES:
                continue
            history, content, active = row[13], row[14], row[15]
            if active != 'Y':
                continue
            number = number.rstrip('.')
            item = {'code': code, 'number': number, 'year': year, 'chapter': chapter, 'effective': effective[:10], 'version': version,
                    'history': history, 'content': content}
            versions.setdefault((code, number), []).append(item)
        chosen = {}
        for pair, items in versions.items():
            now = [item for item in items if not item['effective'] or item['effective'] <= TODAY]
            chosen[pair] = max(now, key=lambda item: item['effective']) if now else min(items, key=lambda item: item['effective'])
        headings = {}
        for row in rows(law / 'LAW_TOC_TBL.dat'):
            code, heading, treepath = row[0], row[6], row[13]
            headings[(code, treepath)] = re.sub(r'\s*\[[^\]]*\]\s*$', '', text_of(heading))
        order = []
        for row in rows(law / 'LAW_TOC_SECTIONS_TBL.dat'):
            code, treepath, number, position = row[1], row[2], row[3].rstrip('.'), row[4]
            if code in CODES:
                order.append((code, treepath, number, int(position or 0)))
        code_rank = {code: index for index, code in enumerate(CODES)}
        tree_key = lambda path: [int(part) if part.isdigit() else part for part in re.split(r'[.]', path)]
        order.sort(key=lambda item: (code_rank[item[0]], tree_key(item[1]), item[3]))
        seen = set()
        placed = {}
        for code, treepath, number, _ in order:
            if (code, number) in chosen and (code, number) not in placed:
                placed[(code, number)] = treepath
        # Sections the table of contents does not list go last in their code, by number.
        rest = sorted((pair for pair in chosen if pair not in placed), key=lambda pair: (code_rank[pair[0]], pair[1]))
        sequence = [(pair, placed[pair]) for pair in placed] + [(pair, '') for pair in rest]
        for (code, number), treepath in sequence:
            if (code, number) in seen:
                continue
            seen.add((code, number))
            item = chosen[(code, number)]
            content_path = law / item['content']
            text = text_of(content_path.read_text(errors='replace')) if item['content'] and content_path.exists() else ''
            parts = treepath.split('.') if treepath else []
            names = [headings.get((code, '.'.join(parts[:depth])), '') for depth in range(1, len(parts) + 1)]
            names = [name for name in names if name]
            code_name = CODES[code][0]
            title_name = ' / '.join([code_name] + names[-2:])
            history = re.sub(r'\s+', ' ', item['history']).strip().strip('()').strip()
            added = re.match(r'(?:Added|Enacted) by Stats\. (\d{4}), Ch\. (\d+)', history)
            status = 'live'
            if not text or re.match(r'^(?:Repealed|Renumbered)\b', text) and len(text) < 200:
                status = 'repealed'
            yield Section(number=f'{code}:{number}', heading=f'{code_name} section {number}', text=text,
                          url=f'{DISPLAY}?lawCode={code}&sectionNum={number}.', title=f'{code}:{".".join(parts[:3])}',
                          title_name=title_name, history=history, status=status,
                          act=f"{item['year']}-{item['chapter']}" if item['year'] and item['chapter'] else '',
                          enacted=[int(added.group(1))] if added else None)

    def short_citation(self, number: str) -> str:
        code, section = split_number(number)
        return f'{CODES[code][1]} § {section}'

    def key(self, number: str) -> str:
        code, section = split_number(number)
        slug = lambda text: re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
        return f"california-{slug(CODES[code][0])}-section-{slug(section)}"

    def citation_parts(self, row: dict) -> dict:
        code, section = split_number(row['number'])
        return {'section': section, 'container-title': f'California {CODES[code][0]}', 'container-title-short': CODES[code][1]}


ADAPTER = California()
