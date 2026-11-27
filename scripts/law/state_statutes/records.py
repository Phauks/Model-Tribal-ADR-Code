"""Write one link-only source record per Indian law section on a state's list (research/state-statutes/<state>/indian-law-sections.csv).

The record shape is the one the Oklahoma build set (PR #561, whose writer this replaced): kind `state-statute`, a
`state_law` block with the relevance label and the Indigo Book citation, Unverified, linked and not served. The adapter supplies
the citation form, the key and the note on where the text was read.
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import yaml

from core import ROOT, read_list

SOURCES = ROOT / 'content/sources'
SCRIPT = 'scripts/law/state_statutes/run.py'


def slug(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def path_for(key: str) -> Path:
    first = key[0]
    return SOURCES / (first if first.isalpha() else '_other') / f'{key}.yaml'


def held_records(adapter) -> set[str]:
    """Records the project already holds for a section of this state's code under the adapter's key that this script did not
    write. They are left as they are: most were made by hand for a nation page and carry facts this script does not know."""
    held = set()
    for path in SOURCES.glob(f'*/{adapter.KEY_PREFIX}-*.yaml'):
        record = yaml.safe_load(path.read_text())
        if (record.get('review') or {}).get('by') not in (SCRIPT, *getattr(adapter, 'EARLIER_WRITERS', ())):
            held.add(record['key'])
    return held


def record(adapter, row: dict, session: str) -> dict:
    number = row['number']
    short = adapter.short_citation(number)
    heading = row['heading'].strip().rstrip('.').strip() or f'Section {number}'
    citation = {
        'type': 'legislation',
        'title': heading,
        'title-short': short,
        'container-title': adapter.CODE_NAME,
        'container-title-short': adapter.CODE_SHORT,
        **(adapter.citation_parts(row) if hasattr(adapter, 'citation_parts') else {'section': number}),
        'author': [{'literal': adapter.AUTHOR}],
    }
    if row['enacted']:
        citation['issued'] = {'date-parts': [json.loads(row['enacted'])]}
    year, month, day = (int(part) for part in adapter.RETRIEVED.split('-'))
    citation.update({'URL': row['url'], 'accessed': {'date-parts': [[year, month, day]]}})
    terms = row['terms_found'].strip()
    notes = [f'Indigo Book citation: {short} ({adapter.EDITION}).']
    if row['history']:
        history = row['history'].strip()
        notes.append(f"History: {history}{'.' if history[-1].isalnum() or history[-1] in ')]' else ''}")
    notes.append(adapter.source_note(row) if hasattr(adapter, 'source_note') else adapter.SOURCE_NOTE)
    if terms:
        found = f'terms: {terms}'
    elif row.get('pool') == 'E':
        found = "no keyword; read because its chapter's name is Indian law"
    else:
        found = 'no keyword; found in a random reading of other sections'
    notes.append(f"Found by {getattr(adapter, 'FOUND_BY', 'the state statutes sweep')} ({found}); {"the session's verdict" if row.get('pool') == 'E' else "AI reader's verdict"} {row['relevance']}: {row['reader_reason'].rstrip('.')}. Unverified.")
    state_law = {'relevance': row['relevance'], 'citation': f'{short} ({adapter.EDITION})'}
    act = adapter.act_name(row) if hasattr(adapter, 'act_name') else None
    if act:
        state_law['act'] = act
    if hasattr(adapter, 'state_law_extra'):
        state_law.update(adapter.state_law_extra(row))
    return {
        'key': adapter.key(number),
        'kind': 'state-statute',
        'citation': citation,
        'original_link': row['url'],
        'retrieved': adapter.RETRIEVED,
        'archives': [],
        'history': {'status': 'live', 'last_checked': adapter.RETRIEVED},
        'state_law': state_law,
        'rights': {
            'status': 'no-permission-needed',
            'basis': 'government-edict',
            'basis_note': 'Official state statutes are not copyrightable under the government edicts doctrine (Georgia v. Public.Resource.Org, Inc., 590 U.S. 255 (2020)). Linked, not served: state statutes stay link only.',
            'redistribution': False,
        },
        'jurisdictions': [{'level': 'state', 'state': adapter.STATE}],
        'topics': ['state-indian-law'],
        'found_in': [getattr(adapter, 'SESSION', None) or session],
        'notes': ' '.join(notes),
        'review': {
            'status': 'unverified',
            'by': SCRIPT,
            'date': adapter.RETRIEVED,
            'checks': [{
                'check': f"Indian law section: {getattr(adapter, 'CHECK_BY', "the sweep's keyword pass")} and an AI reader's verdict (core, incidental or none)",
                'result': 'agree' if terms else 'settled',
                'detail': f"{row['relevance']}; terms: {terms}" if terms else f"{row['relevance']}; no keyword, found by the reader alone",
            }],
        },
    }


def share_links(records: list[dict]) -> None:
    """Sections printed on one official page (a whole-chapter page) are different documents at one address: each lists the others
    in `shares_link_with`, after `history`, as scripts/lint_records.py asks."""
    by_page = defaultdict(list)
    for entry in records:
        by_page[entry['original_link'].split('#')[0]].append(entry['key'])
    for entry in records:
        others = sorted(key for key in by_page[entry['original_link'].split('#')[0]] if key != entry['key'])
        if not others:
            continue
        ordered = {}
        for name, value in entry.items():
            ordered[name] = value
            if name == 'history':
                ordered['shares_link_with'] = others
        entry.clear()
        entry.update(ordered)


def write(adapter, list_path: Path, session: str, check: bool) -> int:
    rows = {}
    for row in read_list(list_path):
        rows.setdefault(row['number'], row)  # a section printed in more than one version keeps its first
    held = held_records(adapter)
    records, skipped = [], []
    for number, row in rows.items():
        key = adapter.key(number)
        if key in held or number in getattr(adapter, 'HELD', {}):
            skipped.append(key)
            continue
        records.append(record(adapter, row, session))
    keys = [entry['key'] for entry in records]
    if len(keys) != len(set(keys)):
        print('two sections would share a key:', sorted({key for key in keys if keys.count(key) > 1}), file=sys.stderr)
        return 1
    if hasattr(adapter, 'finish'):
        adapter.finish(records)
    else:
        share_links(records)
    # Records this script wrote before for sections no longer on the list are removed.
    wanted = {entry['key'] for entry in records}
    stale = [path for path in SOURCES.glob(f'*/{adapter.KEY_PREFIX}-*.yaml')
             if path.stem not in wanted and any(f'by: {by}' in path.read_text() for by in (SCRIPT, *getattr(adapter, 'EARLIER_WRITERS', ())))]
    written = 0
    for entry in records:
        path = path_for(entry['key'])
        text = yaml.safe_dump(entry, sort_keys=False, allow_unicode=True, width=10**9)
        if path.exists() and path.read_text() == text:
            continue
        written += 1
        if not check:
            path.parent.mkdir(exist_ok=True)
            path.write_text(text)
    if not check:
        for path in stale:
            path.unlink()
    core = sum(entry['state_law']['relevance'] == 'core' for entry in records)
    print(f"{adapter.STATE}: {len(records)} records ({core} core, {len(records) - core} incidental); {len(skipped)} held as they are"
          f"{' (' + ', '.join(skipped) + ')' if skipped else ''}; {'would write' if check else 'wrote'} {written}, "
          f"{'would remove' if check else 'removed'} {len(stale)}")
    return 0
