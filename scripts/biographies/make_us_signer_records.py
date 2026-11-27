"""Write biography records for the people who signed ratified treaties for the United States.

Trevor chose on Nov. 26, 2026 to give the United States commissioners pages in
Biographies. The signers were read from Kappler's text of the 370 ratified
treaties (research/biographies/2026-11-26/treaty-us-signers.json, every name
checked against the text); names the reader could not place ("unsure") get no
page. Two signings are one person when the family names are the same, the
given names agree ("Wm." is William, "H." is Henry, and two middle initials
must not differ), and the treaties are no more than 40 years apart. JOINS and
SPLITS hold the calls read by hand in the signer count
(research/analyses/2026-11-26-treaty-signer-count.md, section 3).

Each signing cites the treaty's signature page in the Statutes at Large: the
page where its first Native signer is printed (treaty-signers.json), or the
treaty's first page when that is not known.

Usage: python3 scripts/biographies/make_us_signer_records.py <repo>
"""
import collections, json, os, re, sys, unicodedata
import yaml

repo = sys.argv[1]
WINDOW = 40
CHECKED = '2026-11-26'
WORDS = {2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine'}
MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']
SHORT = dict(wm='william', willm='william', jno='john', jn='john', jas='james', thos='thomas', geo='george', go='george', chas='charles', robt='robert', benj='benjamin', saml='samuel', jos='joseph', richd='richard', danl='daniel', edwd='edward', alexr='alexander', alex='alexander', nathl='nathaniel', jona='jonathan', fras='francis', hy='henry', lew='lewis', aug='auguste', august='auguste', andw='andrew', ar='arthur')
TITLES = set('jr sr esq col gen general colonel major capt captain hon governor gov brig lieut lieutenant dr maj brevet commissioner'.split())
# Read by hand (section 3 of the signer count): the same person spelled two ways, and two people the rule would join.
JOINS = [('minian edwards', 'ninian edwards')]
SPLITS = [('auguste chouteau', 'a p chouteau')]

raw = json.load(open(f"{repo}/research/raw/2026-11-23/treaties.json"))
treaties = {t['treaty_key']: t for t in raw['treaties']}
keymap = json.load(open(f"{repo}/research/biographies/2026-11-24/treaty-keymap.json"))
signature_page = {}
for row in json.load(open(f"{repo}/research/biographies/2026-11-24/treaty-signers.json")):
    if row['ok'] and row.get('page'):
        signature_page[row['key']] = min(signature_page.get(row['key'], row['page']), row['page'])
folder = f"{repo}/content/biographies"
taken = {f[:-5] for f in os.listdir(folder)}


def ascii(text):
    return unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode()


def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', ascii(text).lower()).strip('-')


def words(name):
    name = re.sub(r'\bU\.\s*S\.', ' ', re.split(r',', ascii(name))[0]).replace("'", '').replace('’', '')
    return [SHORT.get(w, w) for w in re.findall(r'[a-z]+', name.lower()) if w not in TITLES]


def display(name):
    name = re.split(r',', name)[0].strip(' .;:')
    name = re.sub(r"^(col|gen|maj|capt|brig|hon|dr|gov)\.?\s+", '', name, flags=re.I).replace("'", '’')
    name = re.sub(r'\s+', ' ', name)
    return ' '.join(w[:1].upper() + w[1:].lower() if w.isupper() and len(w) > 2 and '.' not in w else w for w in name.split(' '))


def agree(a, b):
    """Two given-name lists can be one person: each pair of names or initials agrees, and no two middle initials differ."""
    if not a or not b:
        return False
    for x, y in zip(a, b):
        if len(x) > 1 and len(y) > 1:
            if x != y:
                return False
        elif x[0] != y[0]:
            return False
    return True


def when(date):
    y, m, d = (int(x) for x in date.split('-'))
    return f"{MONTHS[m - 1]} {d}, {y}"


signers = []
for row in json.load(open(f"{repo}/research/biographies/2026-11-26/treaty-us-signers.json"))['signers']:
    w = words(row['name'])
    if len(w) < 2:
        continue
    signers.append(dict(row, i=len(signers), surname=w[-1], given=w[:-1], full=' '.join(w)))

# Complete linkage: a signing joins a person only when it agrees with every signing already given to that person,
# so "J. Calhoun" cannot chain "J. C. Calhoun" to "James S. Calhoun".
split = {frozenset(pair) for pair in SPLITS}
joined = {frozenset(pair) for pair in JOINS}
by_surname = collections.defaultdict(list)
for s in signers:
    by_surname[s['surname']].append(s)
people = []
for group in by_surname.values():
    clusters = []
    for s in sorted(group, key=lambda s: (s['year'], -len(s['given']), s['i'])):
        for cluster in clusters:
            if all(abs(s['year'] - c['year']) <= WINDOW and (agree(s['given'], c['given']) or s['full'] == c['full']) and frozenset((s['full'], c['full'])) not in split for c in cluster):
                cluster.append(s)
                break
        else:
            clusters.append([s])
    people.extend(clusters)
for pair in joined:
    parts = [c for c in people if any(s['full'] in pair for s in c)]
    if len(parts) > 1:
        people = [c for c in people if c not in parts] + [[s for c in parts for s in c]]

written = 0
for group in sorted(people, key=lambda g: min(s['year'] for s in g)):
    group.sort(key=lambda s: (treaties[s['key']]['date_signed'], s['i']))
    # The fullest spelling names the page: "William Clark" over "Wm. Clark".
    shown = collections.Counter(display(s['name']) for s in group)
    name = max(shown, key=lambda n: (sum(1 for w in n.split(' ')[:-1] if len(w.strip('.')) > 1 and not w.endswith('.')), len(n.split(' ')), shown[n]))
    key = slug(name)
    for candidate in (key, f"{key}-united-states", f"{key}-united-states-{group[0]['year']}"):
        if candidate not in taken:
            key = candidate
            break
    else:
        continue
    taken.add(key)
    seen, names, events = set(), [], []
    for s in group:
        t = treaties[s['key']]
        if s['key'] in seen:
            continue
        seen.add(s['key'])
        source = keymap[s['key']]
        page = signature_page.get(s['key'])
        where = f"{t['statutes_at_large'].split()[0]} Stat. {page}" if page else t['statutes_at_large']
        printed = display(s['name'])
        if printed != name and printed not in {n['name'] for n in names}:
            names.append({'name': printed, 'note': f"as the {t['title']} prints it", 'source': source, 'where': where})
        title = (s.get('title') or '').strip(' ,.;')
        label = f", listed as {title}" if title else ''
        events.append({'when': when(t['date_signed']), 'text': f"Signed the {t['title']}, for the United States{label}.", 'source': source, 'where': where})
    years = sorted({int(treaties[s['key']]['date_signed'][:4]) for s in group})
    span = f"{years[0]}" if len(years) == 1 else f"{years[0]}–{years[-1]}"
    count = len(events)
    if count == 1:
        lead = f"Signed the {treaties[group[0]['key']]['title']}, for the United States."
    else:
        lead = f"Signed {WORDS.get(count, count)} treaties with Native nations for the United States, {span}."
    record = {'key': key, 'name': name, 'lead': lead, 'living': False}
    if names:
        record['names'] = names
    record['cases'] = []
    record['events'] = events
    record['checked'] = CHECKED
    with open(f"{folder}/{key}.yaml", 'w') as handle:
        yaml.safe_dump(record, handle, sort_keys=False, allow_unicode=True, width=10000)
    written += 1
print('people', len(people), 'written', written)
