"""Write biography records for Native signers of two or more treaties who have no page yet.

The first pages (make_treaty_records.py, Nov. 24, 2026) joined signings only
when the printed name and the first word of the nation matched. This finds the
repeat signers that rule missed, with the strict threshold from the signer
count (research/analyses/2026-11-26-treaty-signer-count.md, section 4c):
two signings are one person only when they come from different treaties, the
nations share a nation family, the treaties are no more than 30 years apart,
and the printed names are the same letters or have the same sound key. Closer
calls (sound keys 85% or more alike, or only the English name the same) are
never joined here; they go to the review list,
research/reviews/2026-11-26-treaty-signer-matches.csv, for a person to decide.

Usage: python3 scripts/biographies/make_repeat_signer_records.py <repo>
"""
import collections, csv, difflib, json, os, re, sys, unicodedata
import yaml

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'signer_count'))
from matching import core, phon, eng, fams, tagfam  # noqa: E402

repo = sys.argv[1]
WINDOW = 30
CHECKED = '2026-11-26'
WORDS = {2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine'}
MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']
# Christian names and titles many signers shared, left out as make_treaty_records.py leaves them out.
COMMON = set('john william charley charles james george joseph thomas peter jack jim tom sam samuel henry robert david daniel isaac jacob louis louison antoine pierre francis frank paul richard edward billy bill joe captain chief'.split())
STOP = set('part on behalf the of and band bands tribe tribes nation nations indians indian chiefs chief headmen head men warriors great little upper lower confederated united signers signed for in on by a mississippi river lake said'.split())

raw = json.load(open(f"{repo}/research/raw/2026-11-23/treaties.json"))
treaties = {t['treaty_key']: t for t in raw['treaties']}
links = collections.defaultdict(list)
for link in raw['links']:
    links[link['treaty_key']].append(link)
keymap = json.load(open(f"{repo}/research/biographies/2026-11-24/treaty-keymap.json"))
roster = {f[:-5] for d in os.listdir(f"{repo}/content/tribes") for f in os.listdir(f"{repo}/content/tribes/{d}") if f.endswith('.yaml')}
biography_folder = f"{repo}/content/biographies"
taken = {f[:-5] for f in os.listdir(biography_folder)}


def ascii(text):
    return unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode()


def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', ascii(text).lower()).strip('-')


def tokens(text):
    return [w.rstrip('s') for w in re.findall(r'[a-z]+', ascii(text).lower()) if w not in STOP and len(w) > 2]


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
    found = [l['roster_id'] for l in links[treaty_key] if l['confidence'] == 'high' and l['roster_id'] in roster and want & set(tokens(l['signatory_name_in_treaty']))]
    return sorted(set(found))


def clean_nation(text):
    return re.sub(r'^(on (the )?(part|behalf) of (the )?|for (the )?|chiefs (and \w+ )?of (the )?)', '', (text or '').strip(' :.,'), flags=re.I) or text


# Signer lines: the Statutes at Large reading (checked against each page), and Kappler's text for 17 treaties that reading lacks.
rows = [r for r in json.load(open(f"{repo}/research/biographies/2026-11-24/treaty-signers.json")) if r['ok']]
rows += json.load(open(f"{repo}/research/biographies/2026-11-26/treaty-signers-kappler-fill.json"))
mentions = []
for r in rows:
    t = treaties[r['key']]
    tf = set().union(*[tagfam(x) for x in t['osu_signatory_tags']]) if t['osu_signatory_tags'] else set()
    gf = fams(r['nation'])
    mentions.append(dict(r, i=len(mentions), year=int(t['date_signed'][:4]), fam=(gf & tf) or gf or tf, core=core(r['printed']), phon=phon(r['printed']), eng=eng(r['english']) if r['english'] else None))


def compatible(a, b):
    return a['key'] != b['key'] and abs(a['year'] - b['year']) <= WINDOW and bool(a['fam'] & b['fam'])


# Signings already on a page: a biography's treaty event names the treaty, and its name or other names match the line.
reverse = collections.defaultdict(set)
for long_key, short in keymap.items():
    reverse[short].add(long_key)
by_treaty = collections.defaultdict(list)
for m in mentions:
    by_treaty[m['key']].append(m)
page_of = {}
for file in sorted(os.listdir(biography_folder)):
    record = yaml.safe_load(open(f"{biography_folder}/{file}"))
    names = {core(record['name'])} | {core(n['name']) for n in record.get('names', [])}
    for event in record.get('events', []):
        if not event['text'].startswith('Signed the'):
            continue
        for long_key in reverse.get(event['source'], ()):
            for m in by_treaty[long_key]:
                if core(m['printed']) in names or (m['english'] and core(m['english']) in names):
                    page_of[m['i']] = record['key']

parent = list(range(len(mentions)))


def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x


for field in ('core', 'phon'):
    buckets = collections.defaultdict(list)
    for m in mentions:
        if len(m[field]) >= (3 if field == 'core' else 4):
            buckets[m[field]].append(m)
    for group in buckets.values():
        for x, a in enumerate(group):
            for b in group[x + 1:]:
                if compatible(a, b):
                    parent[find(a['i'])] = find(b['i'])

groups = collections.defaultdict(list)
for m in mentions:
    groups[find(m['i'])].append(m)
people = [g for g in groups.values() if len({m['key'] for m in g}) >= 2 and not any(m['i'] in page_of for m in g) and not all(m['core'] in COMMON for m in g)]

# Review list: joins this script does not make, for a person to decide.
review = []
group_of = {m['i']: find(m['i']) for m in mentions}
seen_pairs = set()
by_family = collections.defaultdict(list)
for m in mentions:
    for f in m['fam']:
        by_family[f].append(m)
for members in by_family.values():
    for x, a in enumerate(members):
        for b in members[x + 1:]:
            if group_of[a['i']] == group_of[b['i']] or not compatible(a, b):
                continue
            pair = tuple(sorted((group_of[a['i']], group_of[b['i']])))
            if pair in seen_pairs:
                continue
            same_english = a['eng'] and a['eng'] == b['eng'] and len(a['eng']) >= 3
            ratio = difflib.SequenceMatcher(None, a['phon'], b['phon']).ratio() if min(len(a['phon']), len(b['phon'])) >= 4 and abs(len(a['phon']) - len(b['phon'])) <= 4 else 0
            if not same_english and ratio < 0.85:
                continue
            seen_pairs.add(pair)
            review.append(dict(rule='same English name' if same_english else 'sound keys 85% or more alike', similarity=round(ratio, 2), a=a, b=b))


def describe(m):
    t = treaties[m['key']]
    return [display(m['printed']), m['english'] or '', clean_nation(m['nation']), t['title'], t['date_signed'][:4], page_of.get(m['i'], '')]


os.makedirs(f"{repo}/research/reviews", exist_ok=True)
with open(f"{repo}/research/reviews/2026-11-26-treaty-signer-matches.csv", 'w', newline='') as handle:
    out = csv.writer(handle, lineterminator='\n')
    out.writerow(['rule', 'similarity', 'a_name', 'a_english', 'a_signed_for', 'a_treaty', 'a_year', 'a_page', 'b_name', 'b_english', 'b_signed_for', 'b_treaty', 'b_year', 'b_page', 'decision'])
    for item in sorted(review, key=lambda r: (r['rule'], -r['similarity'], display(r['a']['printed']))):
        out.writerow([item['rule'], item['similarity'], *describe(item['a']), *describe(item['b']), ''])

written = 0
for group in sorted(people, key=lambda g: min(m['year'] for m in g)):
    group.sort(key=lambda m: (treaties[m['key']]['date_signed'], m['i']))
    # An English rendering names the page unless it only names a nation ("a Chippeway").
    english = collections.Counter(display(m['english']) for m in group if m['english'] and not fams(m['english']))
    printed = collections.Counter(display(m['printed']) for m in group)
    name = english.most_common(1)[0][0] if english else printed.most_common(1)[0][0]
    name = name[:1].upper() + name[1:]
    first = group[0]
    tribe = (tokens(first['nation']) or tokens(treaties[first['key']]['title']) or ['nation'])[0]
    key = slug(name)
    for candidate in (key, f"{key}-{tribe}", f"{key}-{tribe}-{first['year']}"):
        if candidate not in taken:
            key = candidate
            break
    else:
        continue
    taken.add(key)
    seen, names, nations, events = set(), [], [], []
    for m in group:
        t = treaties[m['key']]
        source = keymap[m['key']]
        where = f"{t['statutes_at_large'].split()[0]} Stat. {m['page']}" if m.get('page') else t['statutes_at_large']
        nation = clean_nation(m['nation']) or ', '.join(t['osu_signatory_tags'])
        if m['key'] in seen:
            continue
        seen.add(m['key'])
        shown = display(m['printed'])
        if shown.lower() != name.lower() and shown.lower() not in {n['name'].lower() for n in names}:
            names.append({'name': shown, 'note': f"as the {t['title']} prints it", 'source': source, 'where': where})
        for nation_id in nation_ids(m['key'], m['nation']):
            if nation_id not in {n['nation'] for n in nations}:
                nations.append({'nation': nation_id, 'named_as': nation, 'source': source, 'where': where})
        label = f", listed as {m['label']}" if m.get('label') else ''
        events.append({'when': when(t['date_signed']), 'text': f"Signed the {t['title']}, for the {nation}{label}.", 'source': source, 'where': where})
    if len({e['source'] for e in events}) < 2:
        continue
    years = sorted({int(treaties[m['key']]['date_signed'][:4]) for m in group})
    span = f"{years[0]}" if len(years) == 1 else f"{years[0]}–{years[-1]}"
    count = len({e['source'] for e in events})
    lead = f"Signed {WORDS.get(count, count)} treaties with the United States for the {clean_nation(first['nation']) or ', '.join(treaties[first['key']]['osu_signatory_tags'])}, {span}."
    record = {'key': key, 'name': name, 'lead': lead, 'living': False}
    if names:
        record['names'] = names
    if nations:
        record['nations'] = nations
    record['cases'] = []
    record['events'] = events
    record['checked'] = CHECKED
    with open(f"{biography_folder}/{key}.yaml", 'w') as handle:
        yaml.safe_dump(record, handle, sort_keys=False, allow_unicode=True, width=10000)
    written += 1
print('repeat signers with no page', len(people), 'written', written, 'review rows', len(review))
