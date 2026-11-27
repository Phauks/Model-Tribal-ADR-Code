"""Write the list of treaty signers recorded under the wrong group heading (research/reviews/2026-11-27-treaty-signer-headings.csv), read by fix_signer_headings.py.

Trevor, Nov. 27, 2026: Austin E. Quinny was listed "for Munsee" in the 1839 Stockbridge and Munsee treaty, though the Munsee heading heads the other column. The signer lists were read line by line across two printed columns, so names at the top of a column were often given the heading printed at the top of the next column.

Rows marked "fixed" come from research/biographies/2026-11-27/signer-heading-hand-checks.json: each flagged treaty was checked by hand against the laid-out Statutes at Large page (and Kappler's printing), reading each column from top to bottom. Rows marked "unverified" are left as recorded: signers the column checks (statutes-columns.csv, kappler-columns.csv) or both readers (signer-heading-readers/) flag in a treaty that was not settled by hand.
"""
import collections, csv, json, os, re

repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
R = f"{repo}/research/biographies/2026-11-27"
LISTS = {'stat': json.load(open(f"{repo}/research/biographies/2026-11-24/treaty-signers.json")), 'kappler': json.load(open(f"{repo}/research/biographies/2026-11-26/treaty-signers-kappler-fill.json"))}
RANK = set('chief chiefs head headmen men man warriors warrior braves brave soldiers soldier council councillors counsellors delegates delegate commissioners commissioner captains principal second first the and of proper medal mingoes young old'.split())


def norm(t):
    return re.sub(r'[^a-z0-9]', '', (t or '').lower())


hand = json.load(open(f"{R}/signer-heading-hand-checks.json"))
out, seen, stats = [], set(), collections.Counter()
for lst, treaties in ((k, v) for k, v in hand.items() if k != 'checked_no_change'):
    for key, decisions in treaties.items():
        for d in decisions:
            for i in d['ids']:
                s = LISTS[lst][i]
                assert s['key'] == key, (lst, i, key)
                seen.add((lst, i))
                if s['nation'] == d['group'] and d['group'] != 'NOT A SIGNER':
                    continue
                stats['fixed'] += 1
                out.append(dict(key=key, list=lst, index=i, printed=s['printed'], english=s['english'] or '', recorded_group=s['nation'], corrected_group=d['group'], status='fixed', basis=d['note']))
settled = {key for treaties in hand.values() for key in treaties}  # includes checked_no_change: treaties read by hand and found right

# Flags left for a later check, in treaties not settled by hand: either column check naming another heading above the name (or the Statutes at Large check finding the recorded heading borrowed from another column), or both readers agreeing on another group. These are leads, not findings: Kappler's online tables do not always keep its printed columns, and a group named below its names reads as the heading of the next group.
flags = collections.defaultdict(list)
for row in csv.DictReader(open(f"{R}/statutes-columns.csv")):
    if row['borrowed_from_other_column'] == 'True':
        flags[int(row['index'])].append(f"Statutes at Large column check: {row['heading_above_in_column'] or 'no heading above'}")
kap = {int(r['index']): r for r in csv.DictReader(open(f"{R}/kappler-columns.csv")) if r['list'] == 'stat'}
stat = {int(r['index']): r for r in csv.DictReader(open(f"{R}/statutes-columns.csv"))}
for i, row in stat.items():
    k = kap.get(i)
    if k and row['heading_above_in_column'] and norm(row['heading_above_in_column'])[:6] == norm(k['kappler_heading'])[:6] and norm(row['heading_above_in_column']) != norm(row['recorded_nation']):
        flags[i].append(f"both printings: {row['heading_above_in_column']}")
for i, k in kap.items():
    h = k['kappler_heading']
    if h and h != 'WITNESS' and norm(h)[:6] != norm(k['recorded_nation'])[:6] and norm(h) not in norm(k['recorded_nation']):
        flags[i].append(f"Kappler column check: {h}")
for i, row in stat.items():
    h = row['heading_above_in_column']
    if h and h != row['recorded_nation'] and not any(x.startswith('both printings') for x in flags[i]):
        flags[i].append(f"Statutes at Large column check: {h}")
readers = collections.defaultdict(dict)
for x in 'ab':
    for f in os.listdir(f"{R}/signer-heading-readers/{x}"):
        for s in json.load(open(f"{R}/signer-heading-readers/{x}/{f}"))['signers']:
            g = s[1]
            if g and g != 'NOT A SIGNER' and not [w for w in re.findall(r'[a-z]+', g.lower()) if w not in RANK]:
                g = None
            readers[int(s[0])][x] = g
for i, got in readers.items():
    if len(got) == 2 and got['a'] and norm(got['a']) == norm(got['b']) and norm(got['a']) != norm(LISTS['stat'][i]['nation']):
        flags[i].append(f"both readers: {got['a']}")
for i, why in sorted(flags.items()):
    s = LISTS['stat'][i]
    if ('stat', i) in seen or s['key'] in settled:
        continue
    stats['unverified'] += 1
    out.append(dict(key=s['key'], list='stat', index=i, printed=s['printed'], english=s['english'] or '', recorded_group=s['nation'], corrected_group='', status='unverified', basis='; '.join(why)))
with open(f"{repo}/research/reviews/2026-11-27-treaty-signer-headings.csv", 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=['key', 'list', 'index', 'printed', 'english', 'recorded_group', 'corrected_group', 'status', 'basis'])
    w.writeheader()
    w.writerows(out)
print(dict(stats), 'treaties fixed', len({r['key'] for r in out if r['status'] == 'fixed'}), 'treaties with unverified flags', len({r['key'] for r in out if r['status'] == 'unverified'}))
