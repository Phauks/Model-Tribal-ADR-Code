"""Add the offices and positions of treaty signers to their biographies.

Trevor asked on Nov. 27, 2026 that signer pages say what position of power a
signer held, not only that they signed ("Commissioner"). Three sources, each
cited on the page:

1. United States signers, the treaty's own words: Haiku read each treaty's
   opening and signature section in Kappler's text and listed the offices the
   text gives each U.S. signer ("Governor of Missouri Territory"); only an
   office printed word for word in that treaty is kept
   (research/biographies/2026-11-27/us-signer-offices.json). It becomes the
   signing's "listed as", cited to the treaty.
2. United States signers who sat in Congress: the terms in the Biographical
   Directory of the United States Congress, for the 51 signers matched to a
   member by hand (research/biographies/2026-11-27/us-signer-congress-matches.csv,
   terms in congress-terms.json). Each becomes a life event cited to the
   directory with the member's Bioguide ID.
3. Native signers: the title the treaty prints with the signature ("head
   chief", "headman"), already on the signing, now leads the page.

Leads written by the signer scripts are written again to open with the
position. Running it again changes nothing.

Usage: python3 scripts/biographies/add_signer_offices.py <repo>
"""
import csv, json, os, re, sys, unicodedata
import yaml

repo = sys.argv[1]
folder = f"{repo}/content/biographies"
CHECKED = '2026-11-27'
DIRECTORY = 'biographical-directory-of-the-united-states-congress'
STATES = dict(AL='Alabama', AK='Alaska', AZ='Arizona', AR='Arkansas', CA='California', CO='Colorado', CT='Connecticut', DE='Delaware', FL='Florida', GA='Georgia', HI='Hawaii', ID='Idaho', IL='Illinois', IN='Indiana', IA='Iowa', KS='Kansas', KY='Kentucky', LA='Louisiana', ME='Maine', MD='Maryland', MA='Massachusetts', MI='Michigan', MN='Minnesota', MS='Mississippi', MO='Missouri', MT='Montana', NE='Nebraska', NV='Nevada', NH='New Hampshire', NJ='New Jersey', NM='New Mexico', NY='New York', NC='North Carolina', ND='North Dakota', OH='Ohio', OK='Oklahoma', OR='Oregon', PA='Pennsylvania', RI='Rhode Island', SC='South Carolina', SD='South Dakota', TN='Tennessee', TX='Texas', UT='Utah', VT='Vermont', VA='Virginia', WA='Washington', WV='West Virginia', WI='Wisconsin', WY='Wyoming', DK='Dakota', OL='Orleans')
# The year each state joined the Union, for telling a territory's delegate from a representative.
ADMITTED = dict(VT=1791, KY=1792, TN=1796, OH=1803, LA=1812, IN=1816, MS=1817, IL=1818, AL=1819, ME=1820, MO=1821, AR=1836, MI=1837, FL=1845, TX=1845, IA=1846, WI=1848, CA=1850, MN=1858, OR=1859, KS=1861, WV=1863, NV=1864, NE=1867, CO=1876, ND=1889, SD=1889, MT=1889, WA=1889, ID=1890, WY=1890, UT=1896, OK=1907, NM=1912, AZ=1912, AK=1959, HI=1959, DK=9999, OL=9999)
WORDS = {2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine'}
MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']
MONTH_NUMBER = {m: n for n, m in enumerate(MONTHS, 1)}
SIGNING = re.compile(r'^Signed the (.+?, \d{4}(?:, [A-Z][a-z]{2,4}\.? \d{1,2})?), for (?:the )*(.+?)(?:, listed as (.+?))?\.?$')


def fold(text):
    return re.sub(r'[^a-z0-9]+', ' ', unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode().lower()).strip()


def day(text):
    match = re.match(r'^(?:([A-Z][a-z]+\.?) (?:(\d{1,2}), )?)?(\d{4})$', str(text))
    return (int(match.group(3)), MONTH_NUMBER.get(match.group(1), 0), int(match.group(2) or 0)) if match else None


ROLE = re.compile(r'^(special |sole |united states |specially appointed )?commissioners?\b(?! of indian affairs| of indian treaties)', re.I)
VAGUE = re.compile(r'\bsaid\b|that purpose|duly appointed|^(major|general|genl|colonel|col|captain|capt)\.?$', re.I)
LINK_WORDS = {'the', 'of', 'for', 'and', 'a', 'in'}


def distinct(found):
    """Offices without repeats: one spelling of each, and no office whose words another holds ("Governor and superintendent of Indian affairs" inside "... for the Territory of Washington")."""
    letters = lambda o: re.sub(r'[^a-z]', '', o.lower())
    words = lambda o: set(re.findall(r'[a-z]+', o.lower())) - LINK_WORDS
    kept = []
    for office in sorted(found, key=lambda o: -len(o)):
        if any(letters(office) == letters(k) or words(office) <= words(k) for k in kept):
            continue
        kept.append(office)
    return sorted(kept, key=found.index)


def offices_for_label(found):
    """The treaty's offices for a signing: the commissioner role once, then every other office."""
    role = [o for o in found if ROLE.match(o)][:1]
    return role + [o for o in found if not ROLE.match(o)]


def joined(items):
    items = list(items)
    return items[0] if len(items) == 1 else ', '.join(items[:-1]) + (',' if len(items) > 2 else '') + ' and ' + items[-1]


keymap = json.load(open(f"{repo}/research/biographies/2026-11-24/treaty-keymap.json"))
short_of = {long: short for long, short in keymap.items()}

# 1. Offices each treaty's text gives its U.S. signers, kept only where printed word for word.
office_file = f"{repo}/research/biographies/2026-11-27/us-signer-offices.json"
offices = {}  # (treaty source key, folded signer name) -> [office]
if os.path.exists(office_file):
    for item in json.load(open(office_file)):
        for signer in item['signers']:
            offices[(short_of.get(item['key'], item['key']), fold(signer['name']))] = signer['offices']

# 2. Terms in Congress.
terms = json.load(open(f"{repo}/research/biographies/2026-11-27/congress-terms.json"))
members = {row['biography']: row['bioguide'] for row in csv.DictReader(open(f"{repo}/research/biographies/2026-11-27/us-signer-congress-matches.csv")) if row['bioguide']}


def service(bioguide):
    """A member's terms as runs of one seat: (house, state, first year, last year, delegate)."""
    runs = []
    for t in terms[bioguide]['terms']:
        start, end = int(t['start'][:4]), int(t['end'][:4])
        delegate = t['type'] == 'rep' and start < ADMITTED.get(t['state'], 0)
        if runs and runs[-1][0] == t['type'] and runs[-1][1] == t['state'] and runs[-1][4] == delegate and start <= runs[-1][3] + 1:
            runs[-1][3] = max(runs[-1][3], end)
        else:
            runs.append([t['type'], t['state'], start, end, delegate])
    return runs


def seat(run, short=False):
    house, state, first, last, delegate = run
    name = STATES.get(state, state)
    if delegate and state == 'OH':
        name = 'the Northwest'
    if short:
        return f"Delegate to Congress from {name} Territory" if delegate else f"U.S. {'Senator' if house == 'sen' else 'Representative'} from {name}"
    span = f"{first}–{last}"
    if delegate:
        return f"Served as delegate to the U.S. House of Representatives from {name} Territory during the terms {span}."
    return f"Served in the U.S. {'Senate' if house == 'sen' else 'House of Representatives'} for {name} during the term{'s' if last - first > 2 else ''} {span}."


changed = 0
for file in sorted(os.listdir(folder)):
    path = f"{folder}/{file}"
    record = yaml.safe_load(open(path))
    before = yaml.safe_dump(record, sort_keys=False, allow_unicode=True, width=10000)
    signings = [(e, SIGNING.match(e['text'])) for e in record.get('events', []) if e['text'].startswith('Signed the ')]
    signings = [(e, m) for e, m in signings if m]
    if not signings:
        continue
    united_states = all(m.group(2) == 'United States' for _, m in signings)
    treaty_only = len(signings) == len(record['events']) or all(e['text'].startswith('Signed the ') or e['source'] == DIRECTORY for e in record['events'])
    named = [record['name']] + [n['name'] for n in record.get('names', [])]
    positions = []
    if united_states:
        # The treaty's own words for the signer's office replace the signature line's title.
        for event, match in signings:
            found = next((offices[(event['source'], fold(n))] for n in named if (event['source'], fold(n)) in offices), None)
            if found:
                event['text'] = f"Signed the {match.group(1)}, for the United States, listed as {joined(offices_for_label(found))}."
                positions += [o for o in found if fold(o) not in {fold(p) for p in positions}]
        bioguide = members.get(record['key'])
        if bioguide:
            have = {e['text'] for e in record['events']}
            for run in service(bioguide):
                text = seat(run)
                if text not in have:
                    record['events'].append({'when': str(run[2]), 'text': text, 'source': DIRECTORY, 'where': f"Bioguide ID {bioguide}"})
            if all(day(e['when']) for e in record['events']):
                record['events'].sort(key=lambda e: day(e['when']))
        if treaty_only:
            count = len({e['source'] for e, _ in signings})
            years = sorted({day(e['when'])[0] for e, _ in signings if day(e['when'])})
            span = f"{years[0]}" if len(years) == 1 else f"{years[0]}–{years[-1]}"
            title = signings[0][1].group(1)
            congress = [seat(run, True) for run in service(bioguide)] if bioguide else []
            congress = [c for n, c in enumerate(congress) if c not in congress[:n]]
            # "commissioner" is the treaty role itself; it leads only when the text gives no other office.
            other = distinct([p for p in positions if not ROLE.match(p) and not VAGUE.search(p)])
            opening = []
            if congress:
                opening.append(joined(congress) + '.')
            if other:
                other = [o[:1].upper() + o[1:] for o in other[:3]]
                opening.append(f"Named in {'the treaty' if count == 1 else 'the treaties'} as {joined(other)}.")
            signed = f"Signed the {title}, for the United States." if count == 1 else f"Signed {WORDS.get(count, count)} treaties with Native nations for the United States, {span}."
            record['lead'] = ' '.join(opening + [signed])
    elif treaty_only:
        # A Native signer's title as the treaty prints it, from the latest signing that gives one.
        # A short title only ("head chief", "2d chief", "sachem"); a longer line is a reading slip ("First Chief Seneca nation").
        titled = [(e, m) for e, m in signings if m.group(3) and len(m.group(3).split()) <= 3 and not any(w[:1].isupper() for w in m.group(3).split()[1:])]
        if titled and re.match(r'^Signed (the |\w+ treaties with the United States for )', record['lead']):
            event, match = titled[-1]
            count = len({e['source'] for e, _ in signings})
            years = sorted({day(e['when'])[0] for e, _ in signings if day(e['when'])})
            span = f"{years[0]}" if len(years) == 1 else f"{years[0]}–{years[-1]}"
            position = match.group(3)
            position = position[:1].upper() + position[1:]
            lead = f"{position} of the {match.group(2)}, as listed in the {match.group(1)}."
            if count > 1:
                lead += f" Signed {WORDS.get(count, count)} treaties with the United States, {span}."
            record['lead'] = lead
    after = yaml.safe_dump(record, sort_keys=False, allow_unicode=True, width=10000)
    if after != before:
        record['checked'] = CHECKED
        with open(path, 'w') as handle:
            yaml.safe_dump(record, handle, sort_keys=False, allow_unicode=True, width=10000)
        changed += 1
print('pages changed', changed, 'offices read', len(offices), 'members', len(members))
