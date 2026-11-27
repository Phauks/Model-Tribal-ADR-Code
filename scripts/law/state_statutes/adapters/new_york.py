"""New York: the Consolidated Laws, the court acts and the unconsolidated laws, read from the New York State Senate's Open
Legislation laws service (legislation.nysenate.gov/api/3/laws), one call per law. Each answer is the law's whole tree (chapter,
articles, parts, sections) with every section's text. The service prints no history lines, so no section has an enactment year.

The service needs a free key (NEW_YORK_SENATE_API_KEY), which it takes in the address. The key is read from the environment and
never printed: a failed download is reported by its law, not its address.

New York cites each consolidated law by its own name ("N.Y. Indian Law § 8"), so a section's number here is `<law id>:<section>`
("IND:8") and the citation and the record key are built from the law. The abbreviations are the Indigo Book's (T1, New York)."""
from __future__ import annotations

import json
import os
import re
from collections import defaultdict
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

API = 'https://legislation.nysenate.gov/api/3/laws'
PAGE = 'https://www.nysenate.gov/legislation/laws/'
SKIP = {'CMA', 'CMS', 'CNS'}  # the Assembly's and Senate's rules and the state Constitution: not statutes

# Indigo Book T1 (New York): "N.Y. <subject> Law § x (McKinney <year>)", with the subject abbreviations in its list. The court acts
# are cited as acts ("N.Y. Fam. Ct. Act § 115") and the Civil Practice Law and Rules by rule ("N.Y. C.P.L.R. 5225"). Laws the
# table does not name (Cannabis, Veterans' Services, Municipal Housing Authorities, Statute of Local Governments) use the same
# pattern with the law's own words (project choice).
SUBJECT = {
    'ABC': 'Alco. Bev. Cont. Law', 'ABP': 'Aband. Prop. Law', 'ACA': 'Arts & Cult. Aff. Law', 'ACG': 'Alt. County Gov’t Law',
    'AGM': 'Agric. & Mkts. Law', 'BNK': 'Banking Law', 'BSC': 'Bus. Corp. Law', 'BVO': 'Ben. Ord. Law', 'CAL': 'Canal Law',
    'CAN': 'Cannabis Law', 'CCO': 'Coop. Corp. Law', 'CNT': 'County Law', 'COM': 'Econ. Dev. Law', 'COR': 'Correct. Law',
    'CPL': 'Crim. Proc. Law', 'CVP': 'C.P.L.R.', 'CVR': 'Civ. Rights Law', 'CVS': 'Civ. Serv. Law', 'DCD': 'Debt. & Cred. Law',
    'DOM': 'Dom. Rel. Law', 'EDN': 'Educ. Law', 'EDP': 'Em. Dom. Proc. Law', 'ELD': 'Elder Law', 'ELN': 'Elec. Law',
    'EML': 'Empl’rs Liab. Law', 'ENG': 'Energy Law', 'ENV': 'Envtl. Conserv. Law', 'EPT': 'Est. Powers & Trusts Law',
    'EXC': 'Exec. Law', 'FIS': 'Fin. Serv. Law', 'GAS': 'Gen. Ass’ns Law', 'GBS': 'Gen. Bus. Law', 'GCN': 'Gen. Constr. Law',
    'GCT': 'Gen. City Law', 'GMU': 'Gen. Mun. Law', 'GOB': 'Gen. Oblig. Law', 'HAY': 'High. Law', 'IND': 'Indian Law',
    'ISC': 'Ins. Law', 'JUD': 'Jud. Law', 'LAB': 'Lab. Law', 'LEG': 'Legis. Law', 'LFN': 'Local Fin. Law', 'LIE': 'Lien Law',
    'LLC': 'Ltd. Liab. Co. Law', 'MDW': 'Mult. Dwell. Law', 'MHA': 'Mun. Hous. Auth. Law', 'MHR': 'Mun. Home Rule Law',
    'MHY': 'Mental Hyg. Law', 'MIL': 'Mil. Law', 'MRE': 'Mult. Resid. Law', 'NAV': 'Nav. Law', 'NPC': 'Not-for-Profit Corp. Law',
    'PAR': 'Parks Rec. & Hist. Preserv. Law', 'PBA': 'Pub. Auth. Law', 'PBB': 'Pub. Bldgs. Law', 'PBG': 'Pub. Hous. Law',
    'PBH': 'Pub. Health Law', 'PBL': 'Pub. Lands Law', 'PBO': 'Pub. Off. Law', 'PBS': 'Pub. Serv. Law', 'PEN': 'Penal Law',
    'PEP': 'Pers. Prop. Law', 'PML': 'Rac. Pari-Mut. Wag. & Breed. Law', 'PPD': 'State Print. & Pub. Docs. Law',
    'PTR': 'P’ship Law', 'PVH': 'Priv. Hous. Fin. Law', 'RAT': 'Rapid Trans. Law', 'RCO': 'Relig. Corp. Law',
    'REL': 'Rural Elec. Coop. Law', 'RPA': 'Real Prop. Acts. Law', 'RPP': 'Real Prop. Law', 'RPT': 'Real Prop. Tax Law',
    'RRD': 'R.R. Law', 'RSS': 'Retire. & Soc. Sec. Law', 'SAP': 'A.P.A.', 'SCC': 'Second Class Cities Law',
    'SLG': 'Stat. Local Gov’ts Law', 'SOS': 'Soc. Serv. Law', 'STF': 'State Fin. Law', 'STL': 'State Law',
    'STT': 'State Tech. Law', 'SWC': 'Soil & Water Conserv. Dist. Law', 'TAX': 'Tax Law', 'TCP': 'Transp. Corp. Law',
    'TRA': 'Transp. Law', 'TWN': 'Town Law', 'UCC': 'U.C.C.', 'VAT': 'Veh. & Traf. Law', 'VAW': 'Vol. Ambul. Workers’ Ben. Law',
    'VET': 'Veterans’ Servs. Law', 'VIL': 'Village Law', 'VOL': 'Vol. Fire. Ben. Law', 'WKC': 'Workers’ Comp. Law',
    'CCA': 'City Civ. Ct. Act', 'CRC': 'City Crim. Ct. Act', 'CTC': 'Ct. Cl. Act', 'FCT': 'Fam. Ct. Act', 'SCP': 'Surr. Ct. Proc. Act',
    'UCT': 'Uniform City Ct. Act', 'UDC': 'Uniform Dist. Ct. Act', 'UJC': 'Uniform Just. Ct. Act',
}
# The unconsolidated laws are acts McKinney's prints in its Unconsolidated Laws volumes under numbers of its own, which the
# service does not give; they are cited here by the act's name and its own section number, "N.Y. Urban Development Corporation
# Act § 3 (McKinney 2026)" (project choice). Names the service gives with a session law chapter ("174/68") are tidied here.
UNCONSOLIDATED = {'UDA': 'Urban Development Corporation Act', 'FDC': 'Facilities Development Corporation Act',
                  'MCF': 'Medical Care Facilities Finance Agency Act', 'DEA': 'Defense Emergency Act', 'PNY': 'Port of New York Authority Act'}
BY_RULE = {'CVP'}  # cited by rule or section number with no section sign


def split_number(number: str) -> tuple[str, str]:
    law, section = number.split(':', 1)
    return law, section


def title_of(name: str) -> str:
    """The law's name as New York titles it: "Indian" is the Indian Law, "Family Court Act" stays as it is."""
    return name if re.search(r'\b(?:Law|Act|Rules)\b', name) else f'{name} Law'


def key_from_env() -> str:
    key = os.environ.get('NEW_YORK_SENATE_API_KEY', '').strip()
    if not key:
        raise SystemExit('NY: set NEW_YORK_SENATE_API_KEY (a free key from legislation.nysenate.gov)')
    return key


class NewYork(State):
    STATE = 'NY'
    NAME = 'New York'
    CODE_NAME = 'Consolidated Laws of New York'
    CODE_SHORT = 'N.Y.'
    AUTHOR = 'New York State Legislature'
    EDITION = 'McKinney 2026'
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'new-york-laws'
    SOURCE_NOTE = "Text read from the New York State Senate's Open Legislation laws service (legislation.nysenate.gov) on Nov. 27, 2026."
    # Only the nations' distinctive names: Seneca, Oneida, Onondaga, Cayuga, Allegany, Cattaraugus and Mohawk are mostly county,
    # town, lake and river names in this code (and "Niagara Mohawk" a power company), and where the text means the nation it says
    # Nation, Indians, tribe or reservation, which the weak terms already catch.
    NATION_NAMES = ('Poospatuck', 'Unkechauge', 'Unkechaug', 'Akwesasne', 'Shinnecock', 'Tonawanda', 'Tuscarora', 'Haudenosaunee',
                    'Iroquois', 'Six Nations', 'Saint Regis', 'St. Regis', 'Montaukett', 'Ramapough', 'Lenape')
    PLACE_NAMES = ('Tonawanda Creek', 'city of Tonawanda', 'town of Tonawanda', 'North Tonawanda', 'Tonawandas', 'Shinnecock Hills',
                   'Shinnecock Bay', 'Shinnecock Canal', 'Shinnecock Inlet', 'Shinnecock inlets', 'Saint Regis River', 'St. Regis River',
                   'Saint Regis Falls', 'St. Regis Falls', 'Tuscarora town', 'town of Tuscarora', 'Tuscarora Road', 'Tuscarora path',
                   'Iroquois Gas', 'Iroquois Central', 'Iroquois Trail', 'Camp Iroquois', 'Iroquois agricultural society')
    WORKERS = 3

    def fetch(self, raw: Path) -> None:
        key = key_from_env()
        raw.mkdir(parents=True, exist_ok=True)
        listing = raw / 'laws.json'
        if not listing.exists():
            listing.write_bytes(self.get(f'{API}?limit=1000&key={key}'))
        laws = [law for law in json.loads(listing.read_text())['result']['items'] if law['lawId'] not in SKIP]
        failed = self.download_all((f"{API}/{law['lawId']}?full=true&key={key}", raw / 'laws' / f"{law['lawId']}.json") for law in laws)
        names = [re.search(r'/laws/([A-Z]+)\?', url).group(1) for url in failed]  # report the law, never the address with its key
        print(f'NY: {len(laws)} laws, {len(failed)} failed', *names)

    def parse(self, raw: Path) -> Iterator[Section]:
        for law in json.loads((raw / 'laws.json').read_text())['result']['items']:
            law_id = law['lawId']
            path = raw / 'laws' / f'{law_id}.json'
            if law_id in SKIP:
                continue
            if not path.exists():
                print(f'NY: law {law_id} not downloaded; skipped')
                continue
            answer = json.loads(path.read_text())
            if not answer.get('success'):
                print(f'NY: law {law_id} answered {answer.get("message")}; skipped')
                continue
            name = UNCONSOLIDATED.get(law_id) or title_of(law['name'].strip())
            printed = defaultdict(int)  # a number printed in two places in one law ("§ 31" of art. 3 and "§ 31" inside § 25-a)

            def count(node: dict) -> None:
                if node.get('docType') == 'SECTION':
                    printed[node['docLevelId']] += 1
                for child in (node.get('documents') or {}).get('items') or []:
                    count(child)

            count(answer['result']['documents'])

            def walk(node: dict, trail: list[str]) -> Iterator[Section]:
                kind = node.get('docType')
                if kind == 'SECTION':
                    # New York marks a second section with one number "*2" ("§ 6-o*2"); the service keeps a number printed in two
                    # places apart by its location, which then becomes the number here.
                    number = node['docLevelId'] if printed[node['docLevelId']] == 1 else node['locationId']
                    # "* NB Expires ..." notes, each on its own line, are the editor's, not the law's. A section printed in two
                    # versions (one until a date, one after) keeps both, each without its note.
                    text = re.sub(r'\*+\s*NB\s.*?(?=\\n|$)', ' ', node.get('text') or '').replace('\\n', ' ')
                    head = re.match(r'\s*\*?\s*§+\s*([\w.-]+?)\.?\s', text)
                    base, star, mark = number.partition('*')
                    if head and head.group(1).lower() == base.lower():
                        number = head.group(1) + star + mark  # as printed: "6-o", not the service's "6-O"
                    body = clean(text[head.end():] if head else text)
                    heading = clean(node.get('title') or '').rstrip('.')
                    if body.startswith(heading):
                        body = body[len(heading):].lstrip(' .')
                    gone = r'^\*?\[?(?:Repealed|Expired|Transferred|Renumbered|Omitted|Superseded)\b'
                    status = 'repealed' if node.get('repealed') or re.match(gone, body, re.I) or re.match(gone, heading, re.I) else 'live'
                    yield Section(number=f'{law_id}:{number}', heading=heading, text=body, url=f"{PAGE}{law_id}/{node['locationId']}",
                                  title=f'{law_id}:{trail[-1] if trail else ""}', title_name=' / '.join([name, *trail]),
                                  status=status, extra={'law': law_id, 'law_name': name})
                    return
                here = trail
                if kind not in ('CHAPTER', None):
                    label = f"{kind.title()} {node.get('docLevelId', '')}: {clean(node.get('title') or '')}".strip()
                    here = [*trail, label]
                for child in (node.get('documents') or {}).get('items') or []:
                    yield from walk(child, here)

            yield from walk(answer['result']['documents'], [])

    def short_citation(self, number: str) -> str:
        law, section = split_number(number)
        subject = SUBJECT.get(law)
        section = section.split('*')[0]  # "§ 6-o*2" is cited as New York prints it, "§ 6-o"
        if subject is None:  # an unconsolidated law
            return f'N.Y. {UNCONSOLIDATED.get(law, law)} § {section}'
        return f'N.Y. {subject} {section}' if law in BY_RULE else f'N.Y. {subject} § {section}'

    def key(self, number: str) -> str:
        law, section = split_number(number)
        slug = lambda text: re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
        return f'{self.KEY_PREFIX}-{slug(law)}-{slug(section)}'

    def citation_parts(self, row: dict) -> dict:
        law, section = split_number(row['number'])
        short = self.short_citation(row['number'])
        container = short.rsplit(' § ', 1)[0] if ' § ' in short else short.rsplit(' ', 1)[0]
        name = json.loads(row['extra']).get('law_name', '') if row.get('extra') else ''
        return {'container-title': f'New York {name}'.strip(), 'container-title-short': container, 'section': section.split('*')[0]}


ADAPTER = NewYork()
