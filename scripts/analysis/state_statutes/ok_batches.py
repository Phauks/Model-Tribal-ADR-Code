"""Build blind reading batches for the Oklahoma pilot.

Pools: A = strong-term hits (all), B = weak-term-only hits (all), C = non-hits in the same enacting law as a strong hit or within two
sections of one (sample), D = every other live section (random sample). Readers are not told the pool.

  python3 -I ok_batches.py sections.jsonl txt_dir out_dir
"""
import json, re, sys, random, collections, pathlib
from ok_parse import STRONG, WEAK

random.seed(20261126)
rows = [json.loads(l) for l in open(sys.argv[1])]
txt, out = pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]); out.mkdir(exist_ok=True)
names = {}
for p in txt.glob('os*.txt'):
    for ln in open(p, errors='replace'):
        m = re.match(r'^\s*TITLE (\w+)\. (.+?)\s*$', ln)
        if m: names[m.group(1)] = m.group(2).title(); break
live = [r for r in rows if r['status'] == 'live']
LAW = re.compile(r'(?:Added by|From) (?:Laws|L\.) ?(\d{4}),? (?:(?:\d+\w* )?(?:Ex\.\s?Sess\.|E\.S\.),? )?(?:c\.|p\.) ?(\d+)', re.I)
for i, r in enumerate(live):
    m = LAW.search(r['text']); r['act'] = f"{m.group(1)}-{m.group(2)}" if m else None; r['i'] = i
hit = lambda r: bool(r['strong'] or r['weak'])
acts = collections.defaultdict(list)
for r in live:
    if r['act']: acts[r['act']].append(r)
C = set()
for a, rs in acts.items():
    if any(x['strong'] for x in rs) and len(rs) <= 60: C |= {x['i'] for x in rs if not hit(x)}
for r in live:
    if r['strong']:
        for j in range(r['i'] - 2, r['i'] + 3):
            if 0 <= j < len(live) and live[j]['title'] == r['title'] and not hit(live[j]): C.add(j)
A = [r['i'] for r in live if r['strong']]; B = [r['i'] for r in live if not r['strong'] and r['weak']]
D = [r['i'] for r in live if not hit(r) and r['i'] not in C]
Cs = random.sample(sorted(C), 500); Ds = random.sample(D, 700)
pools = {**{i: 'A' for i in A}, **{i: 'B' for i in B}, **{i: 'C' for i in Cs}, **{i: 'D' for i in Ds}}
meta = {'A': len(A), 'B': len(B), 'C': len(C), 'C_sample': len(Cs), 'D': len(D), 'D_sample': len(Ds), 'live': len(live)}


def excerpt(r, cap=380):
    w = r['text'].split()
    if len(w) <= cap: return ' '.join(w)
    spans = [m.start() for m in (list(STRONG.finditer(r['text'])) + list(WEAK.finditer(r['text'])))][:4]
    if not spans: return ' '.join(w[:cap]) + ' […]'
    keep = set(range(60))
    for s in spans:
        k = len(r['text'][:s].split()); keep |= set(range(max(0, k - 50), k + 50))
    ks = sorted(k for k in keep if k < len(w))[:cap]
    outw, last = [], -1
    for k in ks:
        if k != last + 1: outw.append('[…]')
        outw.append(w[k]); last = k
    return ' '.join(outw)


items = []
for i, pool in pools.items():
    r = live[i]
    sib = [x['heading'] for x in acts.get(r['act'], []) if x['i'] != i][:3]
    items.append({'id': f"s{i}", 'cite': r['cite'], 'title_name': names.get(r['title'], ''), 'heading': r['heading'],
                  'same_law_headings': sib, 'text': excerpt(r)})
random.shuffle(items)
key = {f"s{i}": p for i, p in pools.items()}
(out / 'pool-key.json').write_text(json.dumps({'meta': meta, 'key': key}, indent=0))
n = 10; size = -(-len(items) // n)
for b in range(n):
    with open(out / f'batch-{b+1:02d}.jsonl', 'w') as f:
        for it in items[b * size:(b + 1) * size]: f.write(json.dumps(it) + '\n')
print(meta, 'items', len(items), 'per batch', size)
