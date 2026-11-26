"""Cut the signature section out of each OSU (Kappler) treaty page: from the first signing clause to the end of the text, one line per printed line."""
import glob, html, json, os, re, sys
src, out = sys.argv[1], sys.argv[2]
CLAUSE = re.compile(r'in\s+(testimony|witness|faith)\s+(where|of\s+which)|have\s+hereunto\s+(set|sett|signed|subscribed|affixed|placed)|hereunto\s+(set|subscribed|affixed)|^\s*done\s+(at|in|by)\b', re.I)
SIGNY = re.compile(r'mark|seal|l\.\s*s\.|commission|witness|presence|attest|interpreter|chief', re.I)
res = {}
for p in sorted(glob.glob(f"{src}/*.html")):
    t = open(p, errors='ignore').read()
    i = t.find('id="treaty-content"'); j = t.find('</section>', i)
    body = re.sub(r'<aside.*?</aside>', '', t[i:j], flags=re.S)
    body = re.sub(r'<(br|/p|/h\d|/li|/div|/tr)[^>]*>', '\n', body)
    body = re.sub(r'<strong>', '#', body)
    lines = [re.sub(r'\s+', ' ', x).strip() for x in html.unescape(re.sub(r'<[^>]+>', '', body)).replace('\xa0', ' ').split('\n')]
    lines = [x for x in lines if x and x != '#']
    k = next((n for n, x in enumerate(lines) if CLAUSE.search(x)), None)
    seg = lines[k:] if k is not None else lines[-120:]
    # drop long article paragraphs that are not signature material, keep the first (clause) line
    seg = seg[:1] + [x for x in seg[1:] if len(x) < 400 or SIGNY.search(x)]
    key = os.path.basename(p)[:-5]
    res[key] = {'clause_found': k is not None, 'lines': seg}
json.dump(res, open(out, 'w'), indent=0, ensure_ascii=False)
print(len(res), 'no clause', sum(1 for v in res.values() if not v['clause_found']), 'chars', sum(len('\n'.join(v['lines'])) for v in res.values()))
