"""Store the text of every state statute the project lists (Trevor, Nov. 28, 2026; decision record 0068).

For each state with `state-statute` records, the state's adapter downloads its code again (`fetch`) into a work folder and splits it
into sections (`parse`). Each record is matched to its section by key (the adapter's `key()` of the section number), or else by its
exact `original_link` when one section alone has that address. The script writes one UTF-8 text per record (the catchline, the
section's text and its history line, as the adapter splits them: no publisher annotations or editor's notes), uploads it to the
private bucket at `state-statutes/<state>/<record key>.txt`, checks its size and SHA-256 there, and keeps the capture index rows
for the `index` step, which adds them to research/capture-index.csv through capture_index.write_rows.

  python3 scripts/law/state_statutes/texts.py run WA          # fetch, parse, match, write, upload and check one state
  python3 scripts/law/state_statutes/texts.py run WA --full   # the same, reading the whole code (no narrowing)
  python3 scripts/law/state_statutes/texts.py index           # add every state's checked rows to the capture index
  python3 scripts/law/state_statutes/texts.py status          # records with a stored text, by state

Downloads go to /tmp/state-statute-texts/<state>/ (`--work`, or `STATE_STATUTE_TEXTS_WORK`). Every step can be run again: fetch skips
files already downloaded, a text already in the bucket with the same size and SHA-256 is not sent again, and the index step replaces
its own rows. To spare the legislatures' sites, a state whose adapter lists sections or chapters before downloading them reads only
the entries its records need (see NARROWED); `--full` reads the whole code, as the sweep did.

Many records share one address: a chapter page, a title's PDF or a page that differs only by its anchor (Oregon, Colorado, Alaska,
Oklahoma). The site finds such a record's text by the record key in the index row's `records` column, and does not match a link
that two stored texts share (site/src/lib/server/content.ts, `storedStatuteText`).
"""
from __future__ import annotations

import argparse
import concurrent.futures
import contextlib
import datetime
import hashlib
import io
import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path, PosixPath
from urllib.parse import urlsplit

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import adapters
import core

sys.path.insert(0, str(core.ROOT / 'scripts' / 'captures'))
import capture_index

SOURCES = core.ROOT / 'content/sources'
SCRIPT = 'scripts/law/state_statutes/texts.py'
FOLDER = 'state-statutes'
RIGHTS = ("Public domain statutory text: the text of a state's statutes has no copyright (Georgia v. Public.Resource.Org, Inc., "
          "590 U.S. 255 (2020)). The section's text and history line only, without publisher annotations or editor's notes.")
TODAY = datetime.datetime.now(datetime.UTC).date().isoformat()
WORK = Path(os.environ.get('STATE_STATUTE_TEXTS_WORK', '/tmp/state-statute-texts'))

# States whose adapters walk hundreds of index pages to list the code's sections: their listing is written from the records' own
# links, which are the section pages the adapter would have listed.
SEEDED = {'MT': 'sections.json', 'VA': 'sections.json', 'RI': 'sections.json'}
# States whose adapter lists sections or chapters in a JSON file before downloading them: only the entries the records need are read.
NARROWED = {'AZ': 'sections.json', 'ID': 'sections.json', 'KS': 'sections.json', 'HI': 'sections.json', 'KY': 'sections.json',
            'LA': 'sections.json', 'MO': 'sections.json', 'MA': 'sections.json', 'NE': 'chapters.json', 'ME': 'chapters.json',
            'WA': 'chapters.json', 'MN': 'chapters.json', 'FL': 'chapters.json', 'NC': 'chapters.json', 'SC': 'chapters.json',
            'NV': 'chapters.json', 'SD': 'chapters.json', 'DE': 'pages.json'}


def state_of_key(key: str) -> str:
    """The state whose adapter writes keys like this one, for a record made by hand that names no state ("?" when none does)."""
    for state in adapters.NAMES:
        if key.startswith(adapters.load(state).KEY_PREFIX + '-'):
            return state
    return '?'


def records_by_state() -> dict[str, list[dict]]:
    """Every state-statute record, by its state's two-letter code (or, when it names none, its key's)."""
    found = defaultdict(list)
    for path in sorted(SOURCES.glob('*/*.yaml')):
        text = path.read_text()
        if 'kind: state-statute' not in text:
            continue
        record = yaml.safe_load(text)
        if record.get('kind') != 'state-statute':
            continue
        states = [entry.get('state') for entry in record.get('jurisdictions') or [] if entry.get('level') == 'state' and entry.get('state')]
        found[states[0] if states else state_of_key(record['key'])].append({
            'key': record['key'], 'link': record.get('original_link') or '', 'url': (record.get('citation') or {}).get('URL') or '',
            'title': (record.get('citation') or {}).get('title') or '', 'short': (record.get('citation') or {}).get('title-short') or ''})
    return dict(found)


def bounded_in(value: str, text: str) -> bool:
    """Whether `value` appears in `text` with no letter or digit on either side ("28A.320" in "cite=28A.320.126", not in "128A.3201")."""
    start = text.find(value)
    while start >= 0:
        before = text[start - 1] if start else ''
        after = text[start + len(value)] if start + len(value) < len(text) else ''
        if not before.isalnum() and not after.isalnum():
            return True
        start = text.find(value, start + 1)
    return False


class Needed:
    """What one state's records need from its adapter's listing."""

    def __init__(self, adapter, records: list[dict]):
        self.adapter = adapter
        self.links = {record['link'] for record in records if record['link']}
        self.keys = {record['key'] for record in records}
        self.ends = set()
        for link in self.links:
            for cut in re.finditer(r'[/=]', link):
                self.ends.add(link[cut.end():])
        self.pages = {link.split('#')[0] for link in self.links}

    def wants_key(self, number) -> bool:
        return isinstance(number, str) and bool(number) and self.adapter.key(number) in self.keys

    def wants_text(self, value: str) -> bool:
        return bool(value) and (value in self.links or value in self.ends or value in self.pages or any(bounded_in(value, link) for link in self.pages))

    def narrow(self, entries: list | dict) -> list | dict:
        state = self.adapter.STATE
        if isinstance(entries, dict):  # a listing by chapter number (South Dakota's chapter -> title name)
            return {name: value for name, value in entries.items() if self.wants_text(name)}
        if state == 'NE':  # a chapter row lists its sections as [number, catchline]
            out = []
            for row in entries:
                sections = [pair for pair in row['sections'] if self.wants_key(pair[0])]
                if sections:
                    out.append({**row, 'sections': sections})
            return out
        if state == 'ME':  # a chapter row lists its section pages; a section with versions has pages <section>-1, <section>-2
            wanted = set()
            for link in self.links:
                match = re.search(r'/statutes/([^/]+)/title\1sec([^/]+)\.html$', link)
                if match:
                    wanted.add((match.group(1), match.group(2)))
            out = []
            for row in entries:
                sections = [page for page in row['sections'] if (row['title'], page) in wanted or (row['title'], re.sub(r'-\d+$', '', page)) in wanted]
                if sections:
                    out.append({**row, 'sections': sections})
            return out
        if state == 'MA':
            # The site writes a fraction's slash as "~" in a section's address ("Section13B3~4").
            return [row for row in entries if f"Chapter{row['chapter']}/Section{re.sub(r'[\s/]+', lambda m: '~' if '/' in m.group(0) else '', row['section'])}" in self.ends]
        out = []
        for entry in entries:
            if isinstance(entry, str):
                keep = self.wants_text(entry)
            elif isinstance(entry, dict):
                keep = (self.wants_key(entry.get('number')) or any(self.wants_text(entry.get(name) or '') for name in ('url', 'doc'))
                        or (state == 'LA' and f"Law.aspx?d={entry.get('doc')}" in self.ends))
            else:
                keep = True
            if keep:
                out.append(entry)
        return out


def narrowed_path(raw: Path, name: str, needed: Needed, log) -> Path:
    """`raw` as a path whose listing file, read by the adapter's fetch and parse, holds only the entries the records need."""
    root = str(raw)

    class NarrowedPath(PosixPath):
        def read_text(self, *args, **kwargs):
            text = super().read_text(*args, **kwargs)
            if self.name != name or str(self.parent) != root:
                return text
            entries = json.loads(text)
            kept = needed.narrow(entries)
            if not kept:
                log(f'  narrowing {name} kept nothing of {len(entries)}: reading it whole')
                return text
            log(f'  narrowing {name}: {len(kept)} of {len(entries)} entries')
            return json.dumps(kept)

    return NarrowedPath(raw)


# An editor's note printed inside the text, as Colorado prints one before a subsection not yet in force
# ("[Editor's note: Subsection (2) is effective (see editor's note following this section)]"), or Minnesota's pointer to the Revisor's notes ("[See Note.]"): not part of the statute.
EDITORS_NOTE = re.compile(r"\[(?:Editor['’]s note:|See Note\b)[^\]]*\]\s*", re.IGNORECASE)


def text_of_section(adapter, section: core.Section) -> str:
    heading = section.heading.strip().rstrip('.').strip()
    body = EDITORS_NOTE.sub('', section.text).strip()
    lines = [f'{adapter.short_citation(section.number)}. {heading}.' if heading else f'{adapter.short_citation(section.number)}.', '', body]
    if section.history.strip():
        lines += ['', f'History: {section.history.strip()}']
    return '\n'.join(lines) + '\n'


def plain(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', ' ', text.lower()).strip()


def match(adapter, records: list[dict], sections: list[core.Section]) -> tuple[dict[str, core.Section], Counter]:
    """Each record's section: by key, or by the record's exact link when one section alone has it."""
    by_key, by_link = {}, defaultdict(list)
    held = {key: number for number, key in getattr(adapter, 'HELD', {}).items()}
    for section in sections:
        key = adapter.key(section.number)
        # A number printed in more than one version keeps its first live one, as the records' writer did.
        if key not in by_key or (by_key[key].status != 'live' and section.status == 'live'):
            by_key[key] = section
        by_link[section.url].append(section)
    numbers = {section.number: section for section in sections}
    found, counts = {}, Counter()
    for record in records:
        section = by_key.get(record['key'])
        if section is None and record['key'] in held:
            section = numbers.get(held[record['key']])
        if section is None and len({item.number for item in by_link.get(record['link'], [])}) == 1:
            section = by_link[record['link']][0]
            counts['matched by link'] += 1
        if section is None:
            counts['no section'] += 1
            continue
        if not section.text.strip():
            counts['empty text'] += 1
            continue
        if record['title'] and plain(record['title']) != plain(section.heading) and not record['title'].startswith('Section '):
            counts['catchline differs'] += 1
        found[record['key']] = section
    return found, counts


def upload_all(state: str, texts: dict[str, bytes], log) -> dict[str, str]:
    """Send each text to the bucket unless it is there already, then check its size, SHA-256 and MD5 there. Returns key -> problem."""
    from mirror_captures import (
        bucket_name,
        client,
        remote_state,
    )
    storage, bucket = client(), bucket_name()

    def one(item):
        key, body = item
        digest = hashlib.sha256(body).hexdigest()
        try:
            if remote_state(storage, bucket, key) != (len(body), digest):
                storage.put_object(Bucket=bucket, Key=key, Body=body, ContentType='text/plain; charset=utf-8',
                              Metadata={'sha256': digest, 'captured': TODAY, 'records': key.rsplit('/', 1)[1].removesuffix('.txt')})
            head = storage.head_object(Bucket=bucket, Key=key)
            if (head['ContentLength'], head.get('Metadata', {}).get('sha256')) != (len(body), digest):
                return key, 'size or SHA-256 differs in the bucket'
            if head.get('ETag', '').strip('"') != hashlib.md5(body).hexdigest():
                return key, 'MD5 differs in the bucket'
        except Exception as error:  # noqa: BLE001  (reported and retried on the next run)
            return key, f'{type(error).__name__}: {error}'
        return key, ''

    problems = {}
    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        for done, (key, problem) in enumerate(pool.map(one, texts.items()), 1):
            if problem:
                problems[key] = problem
            if done % 1000 == 0:
                log(f'  {state}: {done} of {len(texts)} checked in the bucket')
    return problems


def index_row(adapter, record: dict, key: str, body: bytes, link: str) -> dict:
    host = urlsplit(link).netloc or adapter.AUTHOR
    row = dict.fromkeys(capture_index.FIELDS, '')
    row.update({
        'key': key, 'bytes': str(len(body)), 'sha256': hashlib.sha256(body).hexdigest(), 'media_type': 'text/plain', 'topic': FOLDER,
        'title': f"{record['short']}: {record['title']}" if record['short'] and record['title'] else (record['title'] or record['short'] or record['key']),
        'obtained': f"downloaded from the {adapter.AUTHOR} ({host}) by {SCRIPT}, {TODAY}: the section's text and history line as the state's adapter splits them",
        'link': link, 'captured': TODAY, 'records': record['key'],
        'record_kinds': 'source', 'rights': RIGHTS, 'redistribution': 'yes', 'keep_local': 'no', 'orphan': 'no'})
    return row


def run(state: str, work_root: Path, full: bool, skip_fetch: bool) -> int:
    adapter = adapters.load(state)
    code = adapter.STATE.lower()
    work = work_root / code
    work.mkdir(parents=True, exist_ok=True)
    log_file = (work / 'texts.log').open('a')

    def log(message: str) -> None:
        print(message, flush=True)
        log_file.write(message + '\n')
        log_file.flush()

    records = records_by_state().get(adapter.STATE, [])
    if not records:
        log(f'{adapter.STATE}: no records')
        return 0
    needed = Needed(adapter, records)
    raw = work / 'raw'
    raw.mkdir(exist_ok=True)
    if not full and adapter.STATE in SEEDED:  # written again each run, so a record added since is listed too
        (raw / SEEDED[adapter.STATE]).write_text(json.dumps(sorted(needed.links)))
        log(f'{adapter.STATE}: listing written from {len(needed.links)} record links')
    reading = raw if full or adapter.STATE not in NARROWED else narrowed_path(raw, NARROWED[adapter.STATE], needed, log)
    started = datetime.datetime.now(datetime.UTC)
    if not skip_fetch:
        with contextlib.redirect_stdout(log_file):  # the adapter's own progress lines go to the log
            adapter.fetch(reading)
        log(f'{adapter.STATE}: fetch done in {(datetime.datetime.now(datetime.UTC) - started).seconds // 60} min')
    with contextlib.redirect_stdout(io.StringIO()):
        sections = list(adapter.parse(reading))
    found, counts = match(adapter, records, sections)
    texts_dir = work / 'texts'
    texts_dir.mkdir(exist_ok=True)
    texts, rows = {}, []
    by_key = {record['key']: record for record in records}
    for record_key, section in sorted(found.items()):
        body = text_of_section(adapter, section).encode('utf-8')
        (texts_dir / f'{record_key}.txt').write_bytes(body)
        key = f'{FOLDER}/{code}/{record_key}.txt'
        texts[key] = body
        rows.append(index_row(adapter, by_key[record_key], key, body, section.url or by_key[record_key]['link']))
    problems = upload_all(adapter.STATE, texts, log) if texts else {}
    checked = [row for row in rows if row['key'] not in problems]
    (work / 'rows.json').write_text(json.dumps(checked, ensure_ascii=False, indent=0))
    missing = sorted(set(by_key) - set(found))
    (work / 'missing.json').write_text(json.dumps(missing, indent=0))
    log(f"{adapter.STATE}: {len(sections)} sections parsed; {len(records)} records, {len(found)} matched "
        f"({', '.join(f'{name} {count}' for name, count in sorted(counts.items())) or 'all by key'}); "
        f"{len(checked)} stored and checked, {len(problems)} upload problems{' (' + '; '.join(list(problems.values())[:3]) + ')' if problems else ''}")
    return 0 if not problems else 1


def index(work_root: Path) -> int:
    rows = capture_index.read_rows()
    fieldnames = list(rows[0].keys()) if rows else capture_index.FIELDS
    ours = {}
    for path in sorted(work_root.glob('*/rows.json')):
        for row in json.loads(path.read_text()):
            ours[row['key']] = row
    kept = [row for row in rows if row['key'] not in ours]
    replaced = len(rows) - len(kept)
    capture_index.write_rows(kept + list(ours.values()), fieldnames)
    print(f'capture index: {len(ours)} state statute texts ({len(ours) - replaced} new, {replaced} replaced); {len(kept) + len(ours)} rows')
    return 0


def status() -> int:
    stored = Counter(row['key'].split('/')[1] for row in capture_index.read_rows() if row['key'].startswith(FOLDER + '/'))
    records = records_by_state()
    total = sum(len(value) for value in records.values())
    for state in sorted(records, key=lambda name: (len(name) != 2, name)):
        print(f'{state}: {stored.get(state.lower(), 0)} of {len(records[state])}')
    print(f'all: {sum(stored.values())} of {total}')
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('step', choices=['run', 'index', 'status'])
    parser.add_argument('state', nargs='?', help='two-letter code, such as WA (run only)')
    parser.add_argument('--work', type=Path, default=WORK, help='where downloads and texts go (not in git)')
    parser.add_argument('--full', action='store_true', help='read the whole code, not only the entries the records need')
    parser.add_argument('--skip-fetch', action='store_true', help='parse what is already downloaded')
    args = parser.parse_args()
    if args.step == 'run':
        if not args.state:
            parser.error('run needs a state')
        return run(args.state, args.work, args.full, args.skip_fetch)
    if args.step == 'index':
        return index(args.work)
    return status()


if __name__ == '__main__':
    sys.exit(main())
