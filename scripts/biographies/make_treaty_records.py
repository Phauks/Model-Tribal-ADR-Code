"""Write biography records for treaty leaders from the checked signer lists.

A leader is a Native signer whom the treaty itself labels as a chief, head man,
principal chief and the like, or who signed two or more ratified treaties for
the same nation under the same printed name with no more than 30 years between signings.
"""
import collections, json, os, re, sys, unicodedata
import yaml

S = os.environ.get('BIOGRAPHY_WORK', os.path.dirname(os.path.abspath(__file__)))  # the working folder with cases/, drafts/, treaty-drafts/ and the map files
repo = sys.argv[1]
WINDOW = 30
WORDS = {2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine'}
MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']
COMMON = set('john william charley charles james george joseph thomas peter jack jim tom sam samuel henry robert david daniel isaac jacob louis louison antoine pierre francis frank paul richard edward billy bill joe captain chief'.split())
LEADER = re.compile(r'chief|head\s*-?\s*man|principal|president|speaker|king|governor|sachem', re.I)
STOP = set('part on behalf the of and band bands tribe tribes nation nations indians indian chiefs chief headmen head men warriors great little upper lower confederated united signers signed for in on by a mississippi river lake'.split())

treaties = {t['treaty_key']: t for t in json.load(open(f"{repo}/research/raw/2026-11-23/treaties.json"))['treaties']}
links = collections.defaultdict(list)
for l in json.load(open(f"{repo}/research/raw/2026-11-23/treaties.json"))['links']:
    links[l['treaty_key']].append(l)
keymap = json.load(open(f"{S}/treaty-keymap.json"))
roster = {f[:-5] for d in os.listdir(f"{repo}/content/tribes") for f in os.listdir(f"{repo}/content/tribes/{d}") if f.endswith('.yaml')}
taken = {f[:-5] for f in os.listdir(f"{repo}/content/biographies")}


def slug(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def tokens(text):
    return [w.rstrip('s') for w in re.findall(r'[a-z]+', unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode().lower()) if w not in STOP and len(w) > 2]


def display(name):
    name = re.sub(r'\s+', ' ', name.strip(' ,.;:'))
    if name.isupper() or name.islower():
        name = ' '.join(w[:1].upper() + w[1:] for w in name.lower().split(' '))
    return name


def when(date):
    y, m, d = (int(x) for x in date.split('-'))
    return f"{MONTHS[m - 1]} {d}, {y}"


def nation_ids(treaty_key, printed):
    want = set(tokens(printed))
    found = []
    for l in links[treaty_key]:
        if l['confidence'] != 'high' or l['roster_id'] not in roster:
            continue
        if want & set(tokens(l['signatory_name_in_treaty'])):
            found.append(l['roster_id'])
    return sorted(set(found))


signers = [s for s in json.load(open(f"{S}/treaty-drafts/signers.json")) if s['ok']]
for s in signers:
    s['nation'] = re.sub(r'^(on (the )?(part|behalf) of (the )?|for (the )?|chiefs (and \w+ )?of (the )?)', '', (s['nation'] or '').strip(' :.,'), flags=re.I) or s['nation']
by_person = collections.defaultdict(list)
for s in signers:
    t = treaties[s['key']]
    name = display(s['english'] or s['printed'])
    core = re.sub(r'[^a-z]', '', name.lower())
    if len(core) < 3 or core in COMMON or re.search(r'\d', name):
        continue
    tribe = (tokens(s['nation']) or tokens(t['title']) or ['?'])[0]
    s = dict(s, name=name, year=int(t['date_signed'][:4]), tribe=tribe)
    by_person[(core, tribe)].append(s)

people = []
for (core, tribe), rows in by_person.items():
    rows.sort(key=lambda r: r['year'])
    # Split a name where two signings are more than the window apart, so one title held over generations is not one person.
    runs, run = [], [rows[0]]
    for r in rows[1:]:
        (run.append(r) if r['year'] - run[-1]['year'] <= WINDOW else (runs.append(run), run := [r]))
    runs.append(run)
    for run in runs:
        distinct = {r['key'] for r in run}
        labelled = [r for r in run if r['label'] and LEADER.search(r['label'])]
        if len(distinct) >= 2 or labelled:
            people.append(run)

written = 0
for run in people:
    first = run[0]
    name = first['name']
    key = slug(name)
    if key in taken:
        key = f"{key}-{first['tribe']}"
    if key in taken:
        key = f"{key}-{first['year']}"
    if key in taken:
        continue
    taken.add(key)
    seen, names, nations, events = set(), [], [], []
    for r in run:
        t = treaties[r['key']]
        source = keymap[r['key']]
        vol = t['statutes_at_large'].split()[0]
        where = f"{vol} Stat. {r['page']}"
        if (r['key'], r['nation']) in seen:
            continue
        seen.add((r['key'], r['nation']))
        printed = display(r['printed'])
        if r['english'] and printed.lower() != name.lower() and printed.lower() not in {n['name'].lower() for n in names}:
            names.append({'name': printed, 'note': f"as the {t['title']} prints it", 'source': source, 'where': where})
        for nation in nation_ids(r['key'], r['nation']):
            if nation not in {n['nation'] for n in nations}:
                nations.append({'nation': nation, 'named_as': r['nation'], 'source': source, 'where': where})
        label = f", listed as {r['label']}" if r['label'] else ''
        events.append({'when': when(t['date_signed']), 'text': f"Signed the {t['title']}, for the {r['nation']}{label}.", 'source': source, 'where': where})
    years = sorted({r['year'] for r in run})
    span = f"{years[0]}" if len(years) == 1 else f"{years[0]}–{years[-1]}"
    count = len(events)
    group = first['nation']
    label = next((r['label'] for r in run if r['label'] and LEADER.search(r['label'])), None)
    if count == 1:
        lead = f"Signed the {treaties[first['key']]['title']}, for the {group}" + (f" as {label}" if label else '') + '.'
    else:
        lead = f"Signed {WORDS.get(count, count)} treaties with the United States for the {group}, {span}" + (f", listed in one as {label}" if label else '') + '.'
    record = {'key': key, 'name': name, 'lead': lead, 'living': False}
    if names:
        record['names'] = names
    if nations:
        record['nations'] = nations
    record['cases'] = []
    record['events'] = events
    record['checked'] = '2026-11-24'
    with open(f"{repo}/content/biographies/{key}.yaml", 'w') as fh:
        yaml.safe_dump(record, fh, sort_keys=False, allow_unicode=True, width=10000)
    written += 1
print('leaders', len(people), 'written', written)
