"""Run the state statutes sweep for one state, a step at a time. See README.md in this folder.

  python3 scripts/law/state_statutes/run.py fetch WA      # download the official code (to --work, default /tmp/state-statutes)
  python3 scripts/law/state_statutes/run.py parse WA      # split it into sections and run the keyword pass
  python3 scripts/law/state_statutes/run.py batches WA    # blind reading batches for the small-model readers
  # readers write answers-NN.jsonl beside each batch-NN.jsonl, following research/state-statutes/reading-instructions.md
  python3 scripts/law/state_statutes/run.py review WA     # strong hits a reader marked none, for the session to read again
  python3 scripts/law/state_statutes/run.py merge WA      # join the verdicts: research/state-statutes/<state>/indian-law-sections.csv
  python3 scripts/law/state_statutes/run.py write WA [--check]   # one record per section, content/sources/
  python3 scripts/law/state_statutes/run.py seed OK      # Oklahoma only: the pilot's list becomes this pipeline's list
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import adapters  # noqa: E402
import core  # noqa: E402
import records  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('step', choices=['fetch', 'parse', 'batches', 'review', 'merge', 'write', 'seed'])
    parser.add_argument('state', help='two-letter code, such as WA')
    parser.add_argument('--work', type=Path, default=Path(os.environ.get('STATE_STATUTES_WORK', '/tmp/state-statutes')),
                        help='where downloads, sections and batches go (not in git)')
    parser.add_argument('--near-sample', type=int, default=300, help='non-hits near a strong hit to read for recall')
    parser.add_argument('--other-sample', type=int, default=300, help='other non-hits to read for recall')
    parser.add_argument('--batch-size', type=int, default=150)
    parser.add_argument('--session', default='2026-11-27-state-statutes-sweep', help='research session the records name')
    parser.add_argument('--extend', action='store_true', help='batches: keep what was read and add only new A, B and E sections')
    parser.add_argument('--check', action='store_true', help='write: report what would change and write nothing')
    args = parser.parse_args()
    adapter = adapters.load(args.state)
    code = adapter.STATE.lower()
    work = args.work / code
    research = core.RESEARCH / code
    sections_path = work / 'sections.jsonl'
    batch_dir = work / 'batches'
    if args.step == 'fetch':
        adapter.fetch(work / 'raw')
    elif args.step == 'parse':
        terms = core.Terms(adapter.NATION_NAMES, adapter.PLACE_NAMES)
        counts = core.write_sections((terms.tag(section) for section in adapter.parse(work / 'raw')), sections_path)
        research.mkdir(parents=True, exist_ok=True)
        (research / 'sweep.json').write_text(json.dumps({'state': adapter.STATE, 'code': adapter.CODE_NAME, 'edition': adapter.EDITION,
                                                         'read': adapter.RETRIEVED, 'keyword_pass': counts}, indent=2) + '\n')
        print(adapter.STATE, counts)
    elif args.step == 'batches':
        terms = core.Terms(adapter.NATION_NAMES, adapter.PLACE_NAMES)
        sections = list(core.read_sections(sections_path))
        seed = int(adapter.RETRIEVED.replace('-', '')) + sum(map(ord, adapter.STATE))
        meta = core.batches(sections, terms, batch_dir, args.near_sample, args.other_sample, args.batch_size, seed, args.extend)
        print(adapter.STATE, meta)
    elif args.step == 'review':
        # Small-model readers mark about one strong hit in twenty "none" when it is not (the sweep of Nov. 27, 2026): every one is
        # read again, and the session's verdicts go in settled.json.
        settled_path = research / 'settled.json'
        settled = json.loads(settled_path.read_text()) if settled_path.exists() else {}
        key = json.loads((batch_dir / 'pool-key.json').read_text())
        verdicts = core.read_verdicts(batch_dir)
        live = {section.number: section for section in core.read_sections(sections_path) if section.status == 'live'}
        for item, pool in key['key'].items():
            number = key['cite'][item]
            if pool == 'A' and verdicts.get(item, {}).get('verdict') == 'none' and number in live and number not in settled:
                section = live[number]
                match = core.STRONG.search(section.text)
                around = section.text[max(0, match.start() - 150):match.end() + 150] if match else section.heading
                print(f"{number} | {section.heading} | reader: {verdicts[item].get('reason', '')} | …{around}…")
    elif args.step == 'merge':
        sections = list(core.read_sections(sections_path))
        settled_path = research / 'settled.json'
        settled = json.loads(settled_path.read_text()) if settled_path.exists() else {}
        result = core.merge(sections, batch_dir, settled, lambda section: adapter.short_citation(section.number),
                            research / 'indian-law-sections.csv')
        # Keep the readers' answers and the pool key with the list, so the recall figures can be checked from git.
        shutil.copy(batch_dir / 'pool-key.json', research / 'pool-key.json')
        with (research / 'readings.jsonl').open('w') as out:
            for path in sorted(batch_dir.glob('answers-*.jsonl')):
                out.write(path.read_text().rstrip('\n') + '\n')
        sweep = json.loads((research / 'sweep.json').read_text())
        sweep['reading'] = result
        (research / 'sweep.json').write_text(json.dumps(sweep, indent=2) + '\n')
        print(adapter.STATE, json.dumps(result))
    elif args.step == 'seed':  # a state read before this pipeline existed (Oklahoma): its earlier list becomes this pipeline's list
        print(adapter.STATE, adapter.seed(list(core.read_sections(sections_path)), research / 'indian-law-sections.csv'))
    elif args.step == 'write':
        return records.write(adapter, research / 'indian-law-sections.csv', args.session, args.check)
    return 0


if __name__ == '__main__':
    sys.exit(main())
