"""Group Native treaty signer mentions into people at several matching levels and report counts."""
import collections, difflib, json, re, sys, unicodedata
repo, out = sys.argv[1], sys.argv[2]
B = f"{repo}/research/biographies/2026-11-24"
rows = json.load(open(f"{B}/treaty-signers.json")) + json.load(open(f"{repo}/research/biographies/2026-11-26/treaty-signers-kappler-fill.json"))
T = {t['treaty_key']: t for t in json.load(open(f"{repo}/research/raw/2026-11-23/treaties.json"))['treaties']}

from matching import ascii, core, phon, eng, fams, tagfam  # noqa: E402

# one mention per (treaty, nation group, printed name): exact repeats in the same group are counted separately below
mentions = []
seen = collections.Counter()
for r in rows:
    if not r['ok']: continue
    t = T[r['key']]
    k = (r['key'], r['nation'], r['printed'])
    seen[k] += 1
    tf = set().union(*[tagfam(x) for x in t['osu_signatory_tags']]) if t['osu_signatory_tags'] else set()
    gf = fams(r['nation'])
    fam = (gf & tf) or gf or tf
    mentions.append(dict(r, i=len(mentions), year=int(t['date_signed'][:4]), tagw=fam,
                         core=core(r['printed']), phon=phon(r['printed']), eng=eng(r['english']) if r['english'] else None,
                         dup=seen[k] > 1))
print('ok mentions', len(mentions), 'same-group repeats', sum(m['dup'] for m in mentions))

class UF:
    def __init__(s, n): s.p = list(range(n))
    def f(s, x):
        while s.p[x] != x: s.p[x] = s.p[s.p[x]]; x = s.p[x]
        return x
    def u(s, a, b): s.p[s.f(a)] = s.f(b)

WINDOW = 30
def compatible(a, b):
    return a['key'] != b['key'] and abs(a['year'] - b['year']) <= WINDOW and (a['tagw'] & b['tagw'])

def cluster(level, thr=0.0):
    uf = UF(len(mentions))
    by = collections.defaultdict(list)
    for m in mentions:
        if len(m['core']) >= 3: by[m['core']].append(m)
    pairs = set()
    def link(a, b, why):
        if compatible(a, b): uf.u(a['i'], b['i']); pairs.add((min(a['i'], b['i']), max(a['i'], b['i']), why))
    for g in by.values():
        for a in g:
            for b in g:
                if a['i'] < b['i']: link(a, b, 'exact')
    if level >= 2:
        be = collections.defaultdict(list)
        for m in mentions:
            if m['eng'] and len(m['eng']) >= 3: be[m['eng']].append(m)
        for g in be.values():
            for a in g:
                for b in g:
                    if a['i'] < b['i'] and a['core'] != b['core']: link(a, b, 'english')
    if level >= 3:
        bp = collections.defaultdict(list)
        for m in mentions:
            if len(m['phon']) >= 4: bp[m['phon']].append(m)
        for g in bp.values():
            for a in g:
                for b in g:
                    if a['i'] < b['i'] and a['core'] != b['core']: link(a, b, 'phonetic')
    if level >= 4:
        # fuzzy: same tag word, within window, similar phonetic key
        byt = collections.defaultdict(list)
        for m in mentions:
            for w in m['tagw']: byt[w].append(m)
        for g in byt.values():
            for x in range(len(g)):
                a = g[x]
                for b in g[x + 1:]:
                    if a['core'] == b['core'] or a['phon'] == b['phon'] or len(a['phon']) < 4 or len(b['phon']) < 4: continue
                    if abs(len(a['phon']) - len(b['phon'])) > 4: continue
                    if difflib.SequenceMatcher(None, a['phon'], b['phon']).ratio() >= thr: link(a, b, f'fuzzy{thr}')
    groups = collections.defaultdict(list)
    for m in mentions: groups[uf.f(m['i'])].append(m['i'])
    return groups, pairs

res = {}
for name, lvl, thr in [('L1 exact printed name', 1, 0), ('L2 + same English name', 2, 0), ('L3 + same sound key', 3, 0), ('L4 + fuzzy 0.85', 4, 0.85), ('L4 + fuzzy 0.75', 4, 0.75)]:
    g, p = cluster(lvl, thr)
    multi = [v for v in g.values() if len({mentions[i]['key'] for i in v}) > 1]
    res[name] = dict(people=len(g), multi_treaty=len(multi), pairs=len(p))
    print(name, res[name])
    json.dump({'groups': list(g.values()), 'pairs': sorted(p)}, open(f"{out}/native-{lvl}-{thr}.json", 'w'))
json.dump(mentions, open(f"{out}/native-mentions.json", 'w'), default=list)
