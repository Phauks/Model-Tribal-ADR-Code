"""Check the readers' answers for one state and print a random sample of their verdicts for the session to read.

  python3 scripts/law/state_statutes/spot_check.py SD            # answer counts per batch, then 40 random A and B verdicts
  python3 scripts/law/state_statutes/spot_check.py SD --misses   # the C and D sections a reader called core or incidental

Each answers-NN.jsonl must hold one verdict for every line of its batch-NN.jsonl. The sample shows each verdict with the
section's heading and the words around its first term hit, which is what the session reads to agree or settle in settled.json.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import adapters  # noqa: E402
import core  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('state')
    parser.add_argument('--work', type=Path, default=Path(os.environ.get('STATE_STATUTES_WORK', '/tmp/state-statutes')))
    parser.add_argument('--sample', type=int, default=40)
    parser.add_argument('--seed', type=int, default=0)
    parser.add_argument('--misses', action='store_true', help='list C and D sections a reader called core or incidental')
    args = parser.parse_args()
    adapter = adapters.load(args.state)
    batch_dir = args.work / adapter.STATE.lower() / 'batches'
    key = json.loads((batch_dir / 'pool-key.json').read_text())
    items, problems = {}, 0
    for batch in sorted(batch_dir.glob('batch-*.jsonl')):
        lines = [json.loads(line) for line in batch.read_text().splitlines() if line.strip()]
        items.update({line['id']: line for line in lines})
        answers_path = batch.with_name(batch.name.replace('batch-', 'answers-'))
        answers = []
        if answers_path.exists():
            for line in answers_path.read_text().splitlines():
                try:
                    answers.append(json.loads(line))
                except json.JSONDecodeError:
                    if line.strip():
                        problems += 1
        ids = [line['id'] for line in lines]
        got = [answer.get('id') for answer in answers if answer.get('verdict') in ('core', 'incidental', 'none')]
        missing = [i for i in ids if i not in got]
        extra = [i for i in got if i not in ids]
        flag = 'ok' if not missing and not extra and len(got) == len(ids) else f'MISSING {len(missing)} {missing[:5]} EXTRA {len(extra)}'
        print(f'{batch.name}: {len(ids)} lines, {len(got)} answers {flag}')
    if problems:
        print(f'{problems} answer lines were not JSON')
    verdicts = core.read_verdicts(batch_dir)
    tally: dict[str, dict[str, int]] = {}
    for item, pool in key['key'].items():
        verdict = verdicts.get(item, {}).get('verdict', 'missing')
        tally.setdefault(pool, {}).setdefault(verdict, 0)
        tally[pool][verdict] += 1
    print('by pool:', json.dumps(dict(sorted(tally.items()))))

    def show(item: str) -> None:
        line, answer = items[item], verdicts.get(item, {})
        text = line['text']
        match = core.STRONG.search(text) or core.Terms(adapter.NATION_NAMES, adapter.PLACE_NAMES).weak.search(text)
        around = text[max(0, match.start() - 160):match.end() + 160] if match else text[:320]
        print(f"\n[{key['key'][item]}] {line['cite']} | {line['heading']} | {answer.get('verdict')}: {answer.get('reason', '')}\n    …{around}…")

    if args.misses:
        for item, pool in key['key'].items():
            if pool in ('C', 'D') and verdicts.get(item, {}).get('verdict') in ('core', 'incidental'):
                show(item)
        return 0
    rng = random.Random(args.seed)
    pool_ab = sorted(item for item, pool in key['key'].items() if pool in ('A', 'B') and item in verdicts)
    for item in rng.sample(pool_ab, min(args.sample, len(pool_ab))):
        show(item)
    return 0


if __name__ == '__main__':
    sys.exit(main())
