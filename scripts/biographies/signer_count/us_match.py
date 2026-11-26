import json, re, unicodedata, collections, sys
W = sys.argv[1]
M = json.load(open(f"{W}/us-mentions.json"))
AB = dict(wm='william', willm='william', jno='john', jn='john', jas='james', thos='thomas', geo='george', chas='charles', robt='robert', benj='benjamin', saml='samuel', jos='joseph', richd='richard', danl='daniel', edwd='edward', alexr='alexander', alex='alexander', nathl='nathaniel', jona='jonathan', fras='francis', isc='isaac', hy='henry', sam='samuel')
DROP = set('jr sr esq col gen general colonel major capt captain hon governor gov brig lieut lieutenant dr maj brevet u s commissioner'.split())
def ascii(s): return unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode()
def norm(n):
    n = re.split(r',', ascii(n))[0]
    w = [x for x in re.findall(r"[a-z]+", n.lower().replace("'", ''))]
    w = [AB.get(x, x) for x in w if x not in DROP]
    return w
for m in M:
    w = norm(m['name']); m['w'] = w
    m['full'] = ' '.join(w); m['sur'] = w[-1] if w else ''; m['fi'] = (w[0][0] if len(w) > 1 else '')
class UF:
    def __init__(s, n): s.p = list(range(n))
    def f(s, x):
        while s.p[x] != x: s.p[x] = s.p[s.p[x]]; x = s.p[x]
        return x
    def u(s, a, b): s.p[s.f(a)] = s.f(b)
def run(keyf, window):
    uf = UF(len(M)); by = collections.defaultdict(list)
    for i, m in enumerate(M):
        k = keyf(m)
        if k: by[k].append(i)
    for g in by.values():
        g.sort(key=lambda i: M[i]['year'])
        for a, b in zip(g, g[1:]):
            if M[b]['year'] - M[a]['year'] <= window: uf.u(a, b)
    groups = collections.defaultdict(list)
    for i in range(len(M)): groups[uf.f(i)].append(i)
    return list(groups.values())
res = {}
for name, kf, win in [('exact full name', lambda m: m['full'], 99), ('surname + first initial, 40 yrs', lambda m: (m['sur'], m['fi']), 40), ('surname only, 15 yrs', lambda m: m['sur'], 15)]:
    g = run(kf, win)
    multi = [x for x in g if len({M[i]['key'] for i in x}) > 1]
    res[name] = dict(people=len(g), multi=len(multi), top=sorted(((len({M[i]['key'] for i in x}), M[x[0]]['name']) for x in g), reverse=True)[:15])
    print(name, res[name]['people'], res[name]['multi']); print('  ', res[name]['top'])
    json.dump(g, open(f"{W}/us-groups-{name.split()[0]}.json", 'w'))
# merges at level 2 whose full names differ
g2 = run(lambda m: (m['sur'], m['fi']), 40)
diff = [sorted({M[i]['name'] for i in x}) for x in g2 if len({M[i]['full'] for i in x}) > 1]
print('L2 groups mixing full names', len(diff)); print(diff[:40])
g3 = run(lambda m: m['sur'], 15)
d3 = [sorted({M[i]['name'] for i in x}) for x in g3 if len({M[i]['fi'] for i in x if M[i]['fi']}) > 1]
print('L3 groups mixing first initials', len(d3)); print(d3[:25])
