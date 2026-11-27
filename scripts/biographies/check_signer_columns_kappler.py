"""Check which group heading each Native treaty signer is printed under in Kappler, reading its columns in order.

The Oklahoma State University Tribal Treaties Database prints Kappler's signature blocks as HTML tables, one cell per printed line and one table column per printed column. Read column by column (left column top to bottom, then the next), a heading cell ("Wyandots:", "Senekas:") applies to the names below it until the next heading. A heading that names only a rank ("Chiefs:", "Warriors:") does not change the group; "Attest:", "Witnesses:" and the like start a run of witnesses. This is a second printing to set against the Statutes at Large check (check_signer_columns.py).

Usage: python3 scripts/biographies/check_signer_columns_kappler.py <folder of OSU treaty pages named <treaty key>.html> <output.csv>
"""
import collections, csv, difflib, html, json, os, re, sys

repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
pages, out_path = sys.argv[1], sys.argv[2]
NOISE = re.compile(r',?\s*(his|her)\s*x?\s*-?\s*mark\b.*|\[\s*l\.\s*s\.?\s*\]|\[\s*seal\.?\s*\]', re.I)
WITNESS = re.compile(r'^(attest|witness|witnesses|in (the )?presence|signed,? sealed|interpreter)', re.I)
RANK = set('chief chiefs head headmen men man warriors warrior braves brave soldiers soldier council councillors counsellors delegates delegate captains principal second first the and of proper medal mingoes young old'.split())


def norm(t):
    return re.sub(r'[^a-z0-9]', '', (t or '').lower())


def cells(page):
    for tb in re.findall(r'<table.*?</table>', page, re.S):
        grid = [[html.unescape(re.sub(r'<[^>]+>', '', c)).replace('\xa0', ' ').strip() for c in re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)] for r in re.findall(r'<tr.*?</tr>', tb, re.S)]
        for c in range(max((len(g) for g in grid), default=0)):
            for g in grid:
                if c < len(g) and g[c]:
                    yield g[c]


def heading(text):
    t = text.strip()
    if not t.endswith(':') or len(t) > 80 or re.search(r'mark|\[l', t, re.I):
        return None
    t = t.rstrip(':').strip()
    if WITNESS.match(t):
        return 'WITNESS'
    if not [w for w in re.findall(r'[a-z]+', t.lower()) if w not in RANK]:
        return 'RANK'
    return t


rows = [dict(s, list='stat', index=i) for i, s in enumerate(json.load(open(f"{repo}/research/biographies/2026-11-24/treaty-signers.json")))]
rows += [dict(s, list='kappler', index=i) for i, s in enumerate(json.load(open(f"{repo}/research/biographies/2026-11-26/treaty-signers-kappler-fill.json")))]
by_treaty = collections.defaultdict(list)
for r in rows:
    by_treaty[r['key']].append(r)
out, stats = [], collections.Counter()
for key, group in sorted(by_treaty.items()):
    path = f"{pages}/{key}.html"
    if not os.path.exists(path):
        stats['no page'] += 1
        continue
    current, seen, headings = None, [], set()
    for text in cells(open(path).read()):
        h = heading(text)
        if h == 'RANK':
            continue
        if h:
            current = h
            if h != 'WITNESS':
                headings.add(h)
            continue
        name = NOISE.sub('', text)
        seen.append((norm(name.split(',')[0]), norm(name), current))
    for s in group:
        p = norm(s['printed'])
        if len(p) < 3:
            continue
        best, ratio = None, 0
        for a, b, cur in seen:
            for cand in (a, b):
                r = 1.0 if cand == p else (difflib.SequenceMatcher(None, cand, p).ratio() if cand else 0)
                if r > ratio:
                    ratio, best = r, cur
        if ratio < 0.85:
            stats['not found'] += 1
            continue
        stats['found'] += 1
        out.append({'key': key, 'list': s['list'], 'index': s['index'], 'printed': s['printed'], 'recorded_nation': s['nation'], 'kappler_heading': best or '', 'kappler_headings': ' | '.join(sorted(headings)), 'match': round(ratio, 2)})
with open(out_path, 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(out[0]))
    w.writeheader()
    w.writerows(out)
print(dict(stats))
