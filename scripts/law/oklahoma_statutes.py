"""Write a source record for each Oklahoma statute section the state statutes pilot found to be Indian law.

The pilot (research/analyses/2026-11-26-state-statutes-pilot.md) read Oklahoma's whole code and listed 381 sections in
research/data-roadmap/2026-11-26-state-statutes/oklahoma-indian-law-sections.csv, each labeled core or incidental. Trevor chose on
Nov. 26, 2026 to give every one of them a record, labeled. This script joins that list with the sections file that
scripts/analysis/state_statutes/ok_parse.py makes from the official title PDFs (for each section's history line) and writes one
link-only record per section to content/sources/o/.

  python3 scripts/analysis/state_statutes/ok_parse.py TXT_DIR sections.jsonl   # after pdftotext -layout on each title PDF
  python3 scripts/law/oklahoma_statutes.py sections.jsonl [--check]

--check writes nothing and reports what would change. Records the project already holds for a section (by citation) are left alone.
"""
import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
LIST = ROOT / 'research/data-roadmap/2026-11-26-state-statutes/oklahoma-indian-law-sections.csv'
OUT = ROOT / 'content/sources/o'
SESSION = '2026-11-26-state-statutes-pilot'
RETRIEVED = '2026-11-26'
EDITION = 2026
# Sections that already have a record of their own, kept as they are: citation -> key.
HELD = {'3A O.S. § 281': 'oklahoma-model-tribal-gaming-compact-3a-281'}
MONTHS = {'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7, 'aug': 8, 'sept': 9, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12}


def slug(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def enacted(history: str) -> list[int] | None:
    """The date the section was first enacted, from the first clause of its history line ("Added by Laws 1992, c. 384, § 1, eff. Sept. 1, 1992.")."""
    first = re.split(r'\s(?:Amended|Renumbered|Repealed|Recodified)\b', history)[0]
    match = re.search(r'eff\.\s+([A-Z][a-z]{2,4})\.?\s+(\d{1,2}),\s+(\d{4})', first)
    if match and match.group(1).lower() in MONTHS:
        return [int(match.group(3)), MONTHS[match.group(1).lower()], int(match.group(2))]
    year = re.search(r'\b(1[89]\d\d|20[0-2]\d)\b', first)
    return [int(year.group(1))] if year else None


def heading_of(printed: list[dict]) -> str:
    """The section's heading, from whichever printed version has it whole: the official heading ends at its first period, and a
    heading the PDF wrapped onto a second line can be cut short in one version and whole in another."""
    candidates = []
    for row in printed:
        text = re.sub(r'\s+', ' ', row['heading']).strip()
        whole = re.match(r'^(.*?\.)(?=\s+(?:[A-Z0-9(“"]|$)|$)', text)
        candidates.append((bool(whole), whole.group(1) if whole else text))
    ended = [text for done, text in candidates if done and not text.startswith('See the following versions')]
    return max(ended or [text for _, text in candidates], key=len)


def record(row: dict, versions: list[dict], pages: list[int], heading: str) -> dict:
    title, section = row['title'], row['section']
    heading = heading.rstrip('.').strip() or f'Section {section}'
    short = f'Okla. Stat. tit. {title}, § {section}'
    page = pages[0]
    link = f'https://www.oklegislature.gov/OK_Statutes/CompleteTitles/os{title}.pdf#page={page}'
    history = ' '.join(dict.fromkeys(version['history'].strip() for version in versions if version['history'].strip()))
    date = enacted(versions[0]['history'])
    citation = {
        'type': 'legislation',
        'title': heading,
        'title-short': short,
        'container-title': 'Oklahoma Statutes',
        'container-title-short': 'Okla. Stat.',
        'volume': title,
        'section': section,
        'author': [{'literal': 'Oklahoma Legislature'}],
    }
    if date:
        citation['issued'] = {'date-parts': [date]}
    citation.update({'URL': link, 'accessed': {'date-parts': [[2026, 11, 26]]}})
    terms = row['terms_found'].strip()
    notes = [f'Indigo Book citation: {short} ({EDITION}).']
    if history:
        notes.append(f'History: {history}')
    where = f'page {page}' if len(pages) == 1 else f'pages {", ".join(map(str, pages[:-1]))} and {pages[-1]} (the official text prints the section in {len(pages)} versions)'
    notes.append(f"Text read from the Legislative Service Bureau's Title {title} PDF (updated Nov. 12, 2026), {where}.")
    notes.append(f"Found by the state statutes pilot ({'terms: ' + terms if terms else 'no keyword; found in a random reading of other sections'}); AI reader's verdict {row['relevance']}: {row['reader_reason'].rstrip('.')}. Unverified.")
    return {
        'key': f'oklahoma-statutes-title-{slug(title)}-section-{slug(section)}',
        'kind': 'state-statute',
        'citation': citation,
        'original_link': link,
        'retrieved': RETRIEVED,
        'archives': [],
        'history': {'status': 'live', 'last_checked': RETRIEVED},
        'state_law': {'relevance': row['relevance'], 'citation': f'{short} ({EDITION})', 'page': page},
        'rights': {
            'status': 'no-permission-needed',
            'basis': 'government-edict',
            'basis_note': 'Official state statutes are not copyrightable under the government edicts doctrine (Georgia v. Public.Resource.Org, Inc., 590 U.S. 255 (2020)). Linked, not served: state statutes stay link only.',
            'redistribution': False,
        },
        'jurisdictions': [{'level': 'state', 'state': 'OK'}],
        'topics': ['state-indian-law'],
        'found_in': [SESSION],
        'notes': ' '.join(notes),
        'review': {
            'status': 'unverified',
            'by': 'scripts/law/oklahoma_statutes.py',
            'date': RETRIEVED,
            'checks': [{
                'check': "Indian law section: the pilot's keyword pass and an AI reader's verdict (core, incidental or none)",
                'result': 'agree' if terms else 'settled',
                'detail': f"{row['relevance']}; terms: {terms}" if terms else f"{row['relevance']}; no keyword, found by the reader alone",
            }],
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('sections', type=Path, help='sections.jsonl from scripts/analysis/state_statutes/ok_parse.py')
    parser.add_argument('--check', action='store_true', help='report what would change and write nothing')
    args = parser.parse_args()
    parsed = defaultdict(list)
    with args.sections.open() as file:
        for line in file:
            section = json.loads(line)
            parsed[section['cite']].append(section)
    rows = defaultdict(list)
    with LIST.open(newline='') as file:
        for row in csv.DictReader(file):
            rows[row['citation']].append(row)
    records, missing = [], []
    for cite, printed in rows.items():
        if cite in HELD:
            continue
        versions = [section for section in parsed.get(cite, []) if section['status'] == 'live'] or parsed.get(cite, [])
        if not versions:
            missing.append(cite)
            continue
        pages = [int(row['official_pdf_page'].rsplit('=', 1)[1]) for row in printed]
        records.append(record(printed[0], versions, sorted(set(pages)), heading_of(printed)))
    keys = [entry['key'] for entry in records]
    if len(keys) != len(set(keys)):
        print('two sections would share a key:', sorted({key for key in keys if keys.count(key) > 1}), file=sys.stderr)
        return 1
    if missing:
        print('not in the sections file:', missing, file=sys.stderr)
        return 1
    # Every section of a title is linked to a page of the same title PDF: the records are different documents at one address.
    by_title = defaultdict(list)
    for entry in records:
        by_title[entry['citation']['volume']].append(entry['key'])
    for entry in records:
        others = sorted(key for key in by_title[entry['citation']['volume']] if key != entry['key'])
        if others:
            entry['shares_link_with'] = others
            ordered = {}
            for name, value in entry.items():
                if name != 'shares_link_with':
                    ordered[name] = value
                if name == 'history':
                    ordered['shares_link_with'] = others
            entry.clear()
            entry.update(ordered)
    written = 0
    for entry in records:
        path = OUT / f"{entry['key']}.yaml"
        text = yaml.safe_dump(entry, sort_keys=False, allow_unicode=True, width=10**9)
        if path.exists() and path.read_text() == text:
            continue
        written += 1
        if not args.check:
            path.write_text(text)
    core = sum(entry['state_law']['relevance'] == 'core' for entry in records)
    print(f"{len(records)} records ({core} core, {len(records) - core} incidental), {len(HELD)} held as they are; {'would write' if args.check else 'wrote'} {written}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
