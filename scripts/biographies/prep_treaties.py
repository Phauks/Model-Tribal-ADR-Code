import json, re, os, sys
S = os.environ.get('BIOGRAPHY_WORK', os.path.dirname(os.path.abspath(__file__)))  # the working folder with cases/, drafts/, treaty-drafts/ and the map files
d = json.load(open(sys.argv[1]))
os.makedirs(f"{S}/treaty-excerpts", exist_ok=True)
files = []
for t in d['treaties']:
    m = re.match(r'(\d+) Stat\. (\d+)', t.get('statutes_at_large') or '')
    path = f"{S}/treaties/{t['treaty_key']}.txt"
    if not m or not os.path.exists(path): continue
    v, p = int(m.group(1)), int(m.group(2))
    pages = open(path, errors='ignore').read().split('\f')
    start = None
    for i, pg in enumerate(pages):
        if re.search(r'in\s+(testimony|witness)\s+where\s*of|in\s+wi\s*tn\s*ess|have\s+hereunto\s+(set|sett|signed)', pg, re.I):
            start = i; break
    if start is None: start = max(0, len(pages) - 3)
    body = "\n".join(f"\n=== PAGE {v} Stat. {p + i} ===\n{pages[i]}" for i in range(start, len(pages)) if pages[i].strip())
    out = f"{S}/treaty-excerpts/{t['treaty_key']}.txt"
    open(out, 'w').write(f"TREATY: {t['title']}\nKEY: {t['treaty_key']}\nSIGNED: {t.get('date_signed')}\nCITATION: {t['statutes_at_large']}\n" + body)
    files.append((out, len(body)))
files.sort()
n = 16; size = -(-len(files) // n)
os.makedirs(f"{S}/treaty-batches", exist_ok=True)
for i in range(n):
    b = files[i*size:(i+1)*size]
    open(f"{S}/treaty-batches/batch-{i+1:02d}.txt", 'w').write("\n".join(f for f, _ in b) + "\n")
    print(i+1, len(b), sum(s for _, s in b)//1000, 'KB')
