import json, re, glob, os, sys
from collections import Counter
S = os.environ.get('BIOGRAPHY_WORK', os.path.dirname(os.path.abspath(__file__)))  # the working folder with cases/, drafts/, treaty-drafts/ and the map files
def norm(t): return re.sub(r'[^a-z0-9]', '', t.lower())
out, stats = [], Counter()
for f in sorted(glob.glob(f"{S}/treaty-drafts/batch-*.json")):
    for t in json.load(open(f)):
        ex = f"{S}/treaty-excerpts/{t['key']}.txt"
        if not os.path.exists(ex): stats['no excerpt'] += 1; continue
        text = open(ex, errors='ignore').read()
        pages = {int(m.group(1)): norm(m.group(2)) for m in re.finditer(r'=== PAGE \d+ Stat\. (\d+) ===\n(.*?)(?==== PAGE|\Z)', text, re.S)}
        allt = ''.join(pages.values())
        for g in t.get('groups', []):
            for printed, english, label in g['signers']:
                stats['signers'] += 1
                ok_p = norm(printed) in pages.get(g['page'], '') or norm(printed) in allt
                ok_e = english is None or norm(english) in allt
                ok_l = label is None or norm(label) in allt
                if ok_p and ok_e and ok_l: stats['ok'] += 1
                else: stats['bad'] += 1
                out.append(dict(key=t['key'], nation=g['nation_as_printed'], page=g['page'], printed=printed, english=english, label=label, ok=ok_p and ok_e and ok_l))
json.dump(out, open(f"{S}/treaty-drafts/signers.json", 'w'), indent=0)
print(stats)
print(Counter(s['label'] for s in out if s['ok']).most_common(15))
