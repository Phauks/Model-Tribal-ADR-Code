"""Count Revised Code of Washington sections that use Indian law terms, reading each chapter's full-text page (app.leg.wa.gov, &full=true).

  python3 -I wa_count.py CHAPTER_LIST OUT.jsonl
"""
import re, sys, json, html, urllib.request, concurrent.futures as cf, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from ok_parse import STRONG, WEAK
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
def chapters(path):
    for l in open(path):
        m = re.search(r'RCW(?:%20)+([0-9A-Z]+)(?:%20)*\.(?:%20)*([0-9A-Z]+)(?:%20)+CHAPTER/$', l.strip())
        if m: yield f"{m.group(1)}.{m.group(2)}"
def get(ch):
    url = f'https://app.leg.wa.gov/RCW/default.aspx?cite={ch}&full=true'
    for _ in range(3):
        try:
            t = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=90).read().decode('utf-8', 'replace'); break
        except Exception: t = None
    if t is None: return ch, None
    x = re.sub(r'\s+', ' ', html.unescape(re.sub(r'(?s)<(script|style).*?</\1>|<[^>]+>', ' ', t)))
    parts = re.split(r'PDF RCW (\d+[A-Z]?\.\d+[A-Z]?\.\d+[0-9A-Z]*) ', x)
    out = []
    for i in range(1, len(parts) - 1, 2):
        body = parts[i + 1].split('Legislative questions or comments')[0]
        dead = bool(re.match(r'^(?:Repealed|Recodified|Decodified|Expired)\b', body.strip(), re.I))
        out.append({'cite': f'RCW {parts[i]}', 'status': 'dead' if dead else 'live', 'heading': body[:160],
                    'strong': sorted({m.group(0).lower() for m in STRONG.finditer(body)}), 'weak': sorted({m.group(0).lower() for m in WEAK.finditer(body)}), 'words': len(body.split())})
    return ch, out
chs = list(chapters(sys.argv[1]))
with open(sys.argv[2], 'w') as f, cf.ThreadPoolExecutor(8) as ex:
    for ch, out in ex.map(get, chs):
        f.write(json.dumps({'chapter': ch, 'sections': out}) + '\n')
