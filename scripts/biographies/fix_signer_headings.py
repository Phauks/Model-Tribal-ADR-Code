"""Apply the corrected group headings for treaty signers to the signer lists and the biography pages.

Reads research/reviews/2026-11-27-treaty-signer-headings.csv (one row per signer whose group was misread: key, list, index, printed, recorded_group, corrected_group, status, basis), written by decide_signer_headings.py. For each row with status "fixed" it:

- sets the signer's group in research/biographies/2026-11-24/treaty-signers.json (list "stat") or research/biographies/2026-11-26/treaty-signers-kappler-fill.json (list "kappler"), or marks the row not ok (left out everywhere) when the corrected group is "NOT A SIGNER";
- rewrites "for the <old group>" in that signing's life event on the signer's biography page, the lead when it names the old group, and the nation the page links for that signing.

A signing whose corrected nation falls outside the nation family of the person's other signings was joined to that person on the old group, so it is taken off the page and listed in the review file instead.

Rerunning it changes nothing.
"""
import collections, csv, json, os, re, sys
import yaml

repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(repo, 'scripts', 'biographies', 'signer_count'))
from matching import fams  # noqa: E402

CHECKED = '2026-11-27'
REVIEW = f"{repo}/research/reviews/2026-11-27-treaty-signer-headings.csv"
LISTS = {'stat': f"{repo}/research/biographies/2026-11-24/treaty-signers.json", 'kappler': f"{repo}/research/biographies/2026-11-26/treaty-signers-kappler-fill.json"}
STOP = set('part on behalf the of and band bands tribe tribes nation nations indians indian chiefs chief headmen head men warriors great little upper lower confederated united signers signed for in on by a mississippi river lake'.split())

raw = json.load(open(f"{repo}/research/raw/2026-11-23/treaties.json"))
treaties = {t['treaty_key']: t for t in raw['treaties']}
links = collections.defaultdict(list)
for link in raw['links']:
    links[link['treaty_key']].append(link)
keymap = json.load(open(f"{repo}/research/biographies/2026-11-24/treaty-keymap.json"))
roster = {f[:-5] for d in os.listdir(f"{repo}/content/tribes") for f in os.listdir(f"{repo}/content/tribes/{d}") if f.endswith('.yaml')}


def norm(text):
    return re.sub(r'[^a-z0-9]', '', (text or '').lower())


def tokens(text):
    return [w.rstrip('s') for w in re.findall(r'[a-z]+', (text or '').lower()) if w not in STOP and len(w) > 2]


def stripped(nation):
    """The group as biography events print it (make_treaty_records.py drops "on the part of", "chiefs of" and the like)."""
    return re.sub(r'^(on (the )?(part|behalf) of (the )?|for (the )?|chiefs (and \w+ )?of (the )?)', '', (nation or '').strip(' :.,'), flags=re.I) or nation


def nation_ids(treaty_key, printed):
    want = set(tokens(printed))
    return sorted({l['roster_id'] for l in links[treaty_key] if l['confidence'] == 'high' and l['roster_id'] in roster and want & set(tokens(l['signatory_name_in_treaty']))})


def display(name):
    name = re.sub(r'\s+', ' ', (name or '').strip(' ,.;:'))
    if name.isupper() or name.islower():
        name = ' '.join(w[:1].upper() + w[1:] for w in name.lower().split(' '))
    return name


rows = [r for r in csv.DictReader(open(REVIEW)) if r['status'] == 'fixed']
lists = {name: json.load(open(path)) for name, path in LISTS.items()}

# 1. The signer lists.
for r in rows:
    entry = lists[r['list']][int(r['index'])]
    assert norm(entry['printed']) == norm(r['printed']) and entry['key'] == r['key'], r
    if r['corrected_group'] == 'NOT A SIGNER':
        entry['ok'] = False  # kept for the record, left out of every count and page
    else:
        entry['nation'] = r['corrected_group']
for name, path in LISTS.items():
    with open(path, 'w') as fh:
        fh.write(json.dumps(lists[name], indent=0, ensure_ascii=(name == 'kappler')) + '\n')

# 2. The biography pages.
pages = {}
for f in sorted(os.listdir(f"{repo}/content/biographies")):
    if f.endswith('.yaml'):
        pages[f[:-5]] = yaml.safe_load(open(f"{repo}/content/biographies/{f}"))

changed, taken_off = set(), []
for r in rows:
    t = treaties[r['key']]
    source = keymap[r['key']]
    old, new = stripped(r['recorded_group']), r['corrected_group']
    new_shown = stripped(new) if new != 'NOT A SIGNER' else None
    entry_names = {norm(display(r['printed']))} | ({norm(display(r['english']))} if r.get('english') else set())
    prefix = f"Signed the {t['title']}, for the {old}"
    for key, page in pages.items():
        names = {norm(page['name'])} | {norm(n['name']) for n in page.get('names', [])}
        if not names & entry_names:
            continue
        events = [e for e in page.get('events', []) if e.get('source') == source and (e['text'] == prefix + '.' or e['text'].startswith(prefix + ','))]
        if not events:
            continue
        others = [e for e in page['events'] if e.get('source') != source and e['text'].startswith('Signed the ')]
        other_fams = set().union(*[fams(e['text']) for e in others]) if others else set()
        if new_shown is None or (other_fams and fams(new_shown) and not (fams(new_shown) & other_fams)):
            for e in events:
                page['events'].remove(e)
            page['nations'] = [n for n in page.get('nations', []) if n.get('source') != source]
            taken_off.append((key, r['key'], r['printed'], new or ''))
        else:
            for e in events:
                e['text'] = e['text'].replace(prefix, f"Signed the {t['title']}, for the {new_shown}", 1)
            kept = [n for n in page.get('nations', []) if not (n.get('source') == source and n.get('named_as') == old)]
            where = events[0].get('where')
            for nation in nation_ids(r['key'], new_shown):
                if nation not in {n['nation'] for n in kept}:
                    kept.append({'nation': nation, 'named_as': new_shown, 'source': source, 'where': where})
            page['nations'] = kept
            page['lead'] = page['lead'].replace(f" of the {old}, as listed in the {t['title']}", f" of the {new_shown}, as listed in the {t['title']}")
            if not any(f"for the {old}" in e['text'] for e in page['events']):
                page['lead'] = page['lead'].replace(f" for the {old},", f" for the {new_shown},").replace(f" for the {old}.", f" for the {new_shown}.")
        if not page.get('nations'):
            page.pop('nations', None)
        changed.add(key)

for key in sorted(changed):
    page = pages[key]
    page['checked'] = CHECKED
    with open(f"{repo}/content/biographies/{key}.yaml", 'w') as fh:
        yaml.safe_dump(page, fh, sort_keys=False, allow_unicode=True, width=10000)
print('signers corrected', len(rows), 'pages changed', len(changed))
for item in taken_off:
    print('signing taken off page (nation family no longer matches):', *item)
