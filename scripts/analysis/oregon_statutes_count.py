"""Count sections of the Oregon Revised Statutes that use Indian law terms, by reading every chapter page on the Legislature's site.

  python3 scripts/analysis/oregon_statutes_count.py OUT.json

One full count of one state's code, used as the basis for the tier 3 statute estimate (research/analyses/2026-11-26-tier-2-and-3-data-sources.md). Standard library only.
"""
import re, html, json, sys, urllib.request, concurrent.futures as cf
PAT = re.compile(r"\bIndian (?:tribes?|nations?|country|reservations?|lands?|child|affairs|trust)|\bAmerican Indians?\b|\bNative Americans?\b|\bfederally recognized\b|\btribal (?:government|court|lands?|members?|nation)s?\b|\bIndian\b", re.I)
STRONG = re.compile(r"\bIndian (?:tribes?|nations?|country|reservations?|child)|\bfederally recognized (?:Indian )?tribes?|\btribal (?:governments?|courts?)", re.I)
def get(n):
    url = f'https://www.oregonlegislature.gov/bills_laws/ors/ors{n}.html'
    try:
        t = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read().decode('windows-1252', 'replace')
    except Exception as e: return n, None
    t = html.unescape(re.sub(r'<[^>]+>', ' ', t)); t = re.sub(r'[ \t\xa0]+', ' ', t)
    parts = re.split(r'\n\s*(\d{1,3}[A-C]?\.\d{3})\s', t)
    secs = [(parts[i], parts[i+1]) for i in range(1, len(parts) - 1, 2)]
    return n, {'sections': len(secs), 'any': [s for s, b in secs if PAT.search(b)], 'strong': [s for s, b in secs if STRONG.search(b)]}
res = {}
with cf.ThreadPoolExecutor(8) as ex:
    names = [f'{n:03d}{x}' for n in range(1, 839) for x in ('', 'A', 'B', 'C')]
    for n, r in ex.map(get, names):
        if r: res[n] = r
open(sys.argv[1], 'w').write(json.dumps(res, indent=1) + '\n')
tot = sum(r['sections'] for r in res.values()); a = sum(len(r['any']) for r in res.values()); s = sum(len(r['strong']) for r in res.values())
print('chapters', len(res), 'sections', tot, 'any-term', a, 'strong', s)
print('top chapters', sorted(((len(r['strong']), n) for n, r in res.items()), reverse=True)[:12])
print('lettered chapters read', sum(1 for n in res if n[-1].isalpha()))
