"""Write content/biographies/<key>.yaml for the checked case-party drafts.

Inputs: drafts/checked-good.json (verify_drafts.py), the case-key join table from the
case-records branch, and nation-map.json (nation as the opinion names it -> roster id).
"""
import csv, json, os, re, sys, unicodedata
import yaml

S = os.environ.get('BIOGRAPHY_WORK', os.path.dirname(os.path.abspath(__file__)))  # the working folder with cases/, drafts/, treaty-drafts/ and the map files
repo, join_csv = sys.argv[1], sys.argv[2]
LIVING_FROM = 1945  # a case decided from this year on: treat the person as possibly living or recently dead (public role only)

keys = {r['citation']: r['key'] for r in csv.DictReader(open(join_csv))}
nation_map = json.load(open(f"{S}/nation-map.json")) if os.path.exists(f"{S}/nation-map.json") else {}
roster = {f[:-5] for d in os.listdir(f"{repo}/content/tribes") for f in os.listdir(f"{repo}/content/tribes/{d}") if f.endswith('.yaml')}
existing = {}
for f in os.listdir(f"{repo}/content/biographies"):
    rec = yaml.safe_load(open(f"{repo}/content/biographies/{f}"))
    existing[rec['name'].lower()] = rec['key']


def slug(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def where(cite, page):
    vol = cite.split()[0]
    return f"{vol} U.S. at {page}"


def year_of(cite):
    m = re.search(r'\((\d{4})\)', cite)
    return int(m.group(1)) if m else None


people, skipped = {}, []
terms = {r['citation']: int(r['decided'].split('/')[-1]) for r in csv.DictReader(open(f"{repo}/research/supreme-court-coverage/native-cases-scdb.csv")) if r['decided']}
for p in json.load(open(f"{S}/drafts/checked-good.json")):
    case_key = keys.get(p['cite'])
    if not case_key:
        skipped.append((p['name'], p['cite'], 'no case record yet')); continue
    if p['name'].lower() in existing:
        skipped.append((p['name'], p['cite'], 'already has a page')); continue
    year = terms.get(p['cite'])
    living = year is None or year >= LIVING_FROM
    name = p['name'].strip()
    entry = people.setdefault((name.lower(), (p.get('nation_as_named') or '').lower()), {
        'key': None, 'name': name, 'lead': p['lead'].strip(), 'living': living,
        'names': [], 'nations': [], 'cases': [], 'events': [], 'checked': '2026-11-24'})
    entry['living'] = entry['living'] or living
    for other in p.get('other_names') or []:
        if other['name'].strip().lower() != name.lower():
            entry['names'].append({'name': other['name'].strip(), 'note': other.get('note') or 'as the opinion also prints it', 'source': case_key, 'where': where(p['cite'], other['page'])})
    nation_id = nation_map.get(p.get('nation_as_named') or '')
    if nation_id and nation_id in roster and not any(n['nation'] == nation_id for n in entry['nations']):
        q = p['nation'] if 'nation' not in p['problems'] else p['native']
        entry['nations'].append({'nation': nation_id, 'named_as': p['nation_as_named'], 'source': case_key, 'where': where(p['cite'], q['page'])})
    case = {'case': case_key, 'role': p['role'], 'where': where(p['cite'], p['role_quote']['page'])}
    if p.get('result') and 'result_quote' not in p['problems']:
        case['result'] = p['result'].strip()
        case['where'] = where(p['cite'], p['role_quote']['page']) + (f", {p['result_quote']['page']}" if p['result_quote']['page'] != p['role_quote']['page'] else '')
    entry['cases'].append(case)
    if not living:
        for e in p.get('events') or []:
            entry['events'].append({'when': e['when'], 'text': e['text'].strip(), 'source': case_key, 'where': where(p['cite'], e['page'])})

taken = set(existing.values())
written = 0
for entry in people.values():
    key = slug(entry['name'])
    if key in taken:
        key = f"{key}-{slug(entry['nations'][0]['nation']) if entry['nations'] else entry['cases'][0]['case']}"
    taken.add(key)
    entry['key'] = key
    if not entry['names']: del entry['names']
    if entry['living']: entry['events'] = []
    out = {k: entry[k] for k in ('key', 'name', 'lead', 'living', 'names', 'nations', 'cases', 'events', 'checked') if k in entry}
    with open(f"{repo}/content/biographies/{key}.yaml", 'w') as fh:
        yaml.safe_dump(out, fh, sort_keys=False, allow_unicode=True, width=10000)
    written += 1
print('written', written, 'skipped', len(skipped))
for s in skipped: print('  skipped', s)
