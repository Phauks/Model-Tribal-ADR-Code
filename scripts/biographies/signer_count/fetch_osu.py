import json, os, sys, time, urllib.request
repo, out = sys.argv[1], sys.argv[2]
t = json.load(open(f"{repo}/research/raw/2026-11-23/treaties.json"))['treaties']
for x in t:
    p = f"{out}/{x['treaty_key']}.html"
    if os.path.exists(p) and os.path.getsize(p) > 1000: continue
    for i in range(3):
        try:
            r = urllib.request.urlopen(urllib.request.Request(x['osu_url'], headers={'User-Agent': 'research-script'}), timeout=40)
            open(p, 'wb').write(r.read()); break
        except Exception as e:
            print('ERR', x['treaty_key'], e, flush=True); time.sleep(3)
    time.sleep(0.4)
print('done', len(os.listdir(out)))
