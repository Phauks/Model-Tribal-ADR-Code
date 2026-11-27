"""Count Florida Statutes sections that use Indian law terms, reading each chapter's whole-chapter page on Online Sunshine (leg.state.fl.us).

  python3 -I fl_count.py FL_HOME_HTML OUT.jsonl
"""
import re, sys, json, html, urllib.request, concurrent.futures as cf, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from ok_parse import STRONG, WEAK
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
B = 'https://www.leg.state.fl.us/statutes/'
def get(u):
    for _ in range(3):
        try: return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA}), timeout=90).read().decode('utf-8', 'replace')
        except Exception: pass
    return ''
titles = sorted(set(re.findall(r'Title_Request=([IVXL]+)', open(sys.argv[1]).read())))
chap = set()
with cf.ThreadPoolExecutor(8) as ex:
    for t in ex.map(lambda r: get(B + f'index.cfm?App_mode=Display_Index&Title_Request={r}'), titles):
        chap |= set(re.findall(r'URL=(\d{4}-\d{4}/\d{4}[A-Z]?/\d{4}[A-Z]?)ContentsIndex\.html', t))
def chapter(c):
    t = get(B + f'index.cfm?App_mode=Display_Statute&URL={c}.html')
    parts = re.split(r'<span class="SectionNumber">\s*([\d.A-Za-z]+)', t)
    out = []
    for i in range(1, len(parts) - 1, 2):
        body = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', parts[i + 1])))
        out.append({'cite': f'Fla. Stat. § {parts[i].strip()}', 'status': 'dead' if re.match(r'^\s*\S*\s*(Repealed|Transferred|Renumbered)', body[:200]) else 'live',
                    'strong': sorted({m.group(0).lower() for m in STRONG.finditer(body)}), 'weak': sorted({m.group(0).lower() for m in WEAK.finditer(body)})})
    return c, out
with open(sys.argv[2], 'w') as f, cf.ThreadPoolExecutor(8) as ex:
    for c, out in ex.map(chapter, sorted(chap)):
        f.write(json.dumps({'chapter': c, 'sections': out}) + '\n')
print('titles', len(titles), 'chapters', len(chap))
