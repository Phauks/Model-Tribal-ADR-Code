"""Maryland: the Annotated Code of Maryland, read from the General Assembly's HTML file of each article (mgaleg.maryland.gov/<year>RS/
Statute_Web/<article>/<article>.html). Section numbers here are `<article>:<section>` ("gsg:9.5-301"), since each article numbers its own
sections. The official text prints no catchlines and no history lines (the publishers add those), so each record is named by its
citation and carries no enactment year; each links to the section's page (mgaleg.maryland.gov/mgawebsite/Laws/StatuteText)."""
from __future__ import annotations

import html
import re
from pathlib import Path
from typing import Iterator

from adapters.base import State
from core import Section, clean

YEAR = 2026
FILE = 'https://mgaleg.maryland.gov/{year}RS/Statute_Web/{article}/{article}.html'
PAGE = 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article={article}&section={section}&enactments=false'
# article code: (name, Indigo Book article abbreviation)
ARTICLES = {
    'gag': ('Agriculture', 'Agric.'), 'gab': ('Alcoholic Beverages and Cannabis', 'Alc. Bev. & Cannabis'),
    'gbo': ('Business Occupations and Professions', 'Bus. Occ. & Prof.'), 'gbr': ('Business Regulation', 'Bus. Reg.'),
    'gcl': ('Commercial Law', 'Com. Law'), 'gca': ('Corporations and Associations', "Corps. & Ass'ns"),
    'gcs': ('Correctional Services', 'Corr. Servs.'), 'gcj': ('Courts and Judicial Proceedings', 'Cts. & Jud. Proc.'),
    'gcr': ('Criminal Law', 'Crim. Law'), 'gcp': ('Criminal Procedure', 'Crim. Proc.'), 'gec': ('Economic Development', 'Econ. Dev.'),
    'ged': ('Education', 'Educ.'), 'gel': ('Election Law', 'Elec. Law'), 'gen': ('Environment', "Env't"),
    'get': ('Estates and Trusts', 'Est. & Trusts'), 'gfl': ('Family Law', 'Fam. Law'), 'gfi': ('Financial Institutions', 'Fin. Inst.'),
    'ggp': ('General Provisions', 'Gen. Provis.'), 'ghg': ('Health - General', 'Health–Gen.'), 'gho': ('Health Occupations', 'Health Occ.'),
    'ghs': ('Housing and Community Development', 'Hous. & Cmty. Dev.'), 'ghu': ('Human Services', 'Hum. Servs.'), 'gin': ('Insurance', 'Ins.'),
    'gle': ('Labor and Employment', 'Lab. & Empl.'), 'glu': ('Land Use', 'Land Use'), 'glg': ('Local Government', "Local Gov't"),
    'gnr': ('Natural Resources', 'Nat. Res.'), 'gps': ('Public Safety', 'Pub. Safety'), 'gpu': ('Public Utilities', 'Pub. Util.'),
    'grp': ('Real Property', 'Real Prop.'), 'gsf': ('State Finance and Procurement', 'State Fin. & Proc.'),
    'gsg': ('State Government', "State Gov't"), 'gsp': ('State Personnel and Pensions', 'State Pers. & Pens.'),
    'gtg': ('Tax - General', 'Tax–Gen.'), 'gtp': ('Tax - Property', 'Tax–Prop.'), 'gtr': ('Transportation', 'Transp.'),
}
MARK = re.compile(r'(?:<br>|<html>)\s*§\s*([0-9]+(?:\.[0-9]+)?[A-Z]?–[0-9A-Za-z.–]+?)\.\s*(?=<br>)')
GONE = re.compile(r'^(?:\[?Repealed|Reserved|Expired|Transferred|Renumbered|Abrogated|Omitted)\b', re.I)


def text_of(fragment: str) -> str:
    return clean(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).replace('\xa0', ' '))


def split_number(number: str) -> tuple[str, str]:
    article, section = number.split(':', 1)
    return article, section


class Maryland(State):
    STATE = 'MD'
    NAME = 'Maryland'
    CODE_NAME = 'Annotated Code of Maryland'
    CODE_SHORT = 'Md. Code Ann.'
    AUTHOR = 'Maryland General Assembly'
    EDITION = YEAR
    RETRIEVED = '2026-11-27'
    KEY_PREFIX = 'maryland-code'
    SOURCE_NOTE = "Text read from the Maryland General Assembly's HTML file of the article of the Annotated Code of Maryland (mgaleg.maryland.gov) on Nov. 27, 2026."
    NATION_NAMES = ('Piscataway', 'Nanticoke', 'Accohannock', 'Pocomoke Indian', 'Assateague People', 'Youghiogheny', 'Susquehannock', 'Lenape')
    PLACE_NAMES = ('Nanticoke River', 'Pocomoke River', 'Pocomoke City', 'Piscataway Creek', 'Piscataway Park', 'Youghiogheny River', 'Indian Head',
                   'Indian Creek', 'Indian Springs', 'Assateague Island', 'Susquehanna', 'Patuxent', 'Choptank', 'Wicomico', 'Potomac')

    def fetch(self, raw: Path) -> None:
        raw.mkdir(parents=True, exist_ok=True)
        failed = self.download_all((FILE.format(year=YEAR, article=article), raw / f'{article}.html') for article in ARTICLES)
        print(f'MD: {len(ARTICLES)} articles, {len(failed)} failed', *failed)

    def parse(self, raw: Path) -> Iterator[Section]:
        for article, (name, _short) in ARTICLES.items():
            page = (raw / f'{article}.html').read_text(encoding='utf-8', errors='replace').replace('&sect;', '§').replace('&ndash;', '–')
            marks = list(MARK.finditer(page))
            seen = set()
            for index, mark in enumerate(marks):
                section = mark.group(1).replace('–', '-')
                number = f'{article}:{section}'
                if number in seen:
                    continue
                seen.add(number)
                text = text_of(page[mark.end():marks[index + 1].start() if index + 1 < len(marks) else len(page)])
                status = ('repealed' if not text.lower().startswith('reserved') else 'reserved') if GONE.match(text) and len(text) < 300 else ('live' if text else 'reserved')
                title = section.split('-')[0]
                yield Section(number=number, heading=self.short_citation(number), text=text, url=PAGE.format(article=article, section=section), title=f'{article}:{title}',
                              title_name=f'Article - {name} / Title {title}', status=status)

    def short_citation(self, number: str) -> str:
        article, section = split_number(number)
        return f'Md. Code Ann., {ARTICLES[article][1]} § {section}'

    def key(self, number: str) -> str:
        article, section = split_number(number)
        slug = lambda text: re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
        return f'maryland-code-{slug(ARTICLES[article][0])}-section-{slug(section)}'

    def citation_parts(self, row: dict) -> dict:
        article, section = split_number(row['number'])
        return {'container-title': f'Annotated Code of Maryland, {ARTICLES[article][0]} Article', 'section': section}


ADAPTER = Maryland()
