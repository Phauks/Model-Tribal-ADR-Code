"""Build the language registry, content/languages/<tag>.yaml, one file for each
language tag the nation records use.

Trevor approved the language pages on Nov. 27, 2026 (project thread "Link each
nation to its language resources"; research/analyses/2026-11-27-language-resources.md,
approach A): every language the nation records name gets a page with its
ISO 639-3 code and its Glottolog entry, and the page lists the nations that
name it. This script writes the facts those pages show. Nothing in it is
written by hand except the Alaska Native Language Center addresses below.

Inputs, downloaded into one folder given as the second argument:

- glottolog-cldf-v5.4.zip, unzipped: Glottolog 5.4 as CLDF (Zenodo record
  24101243, Creative Commons Attribution 4.0). languages.csv gives each
  languoid's name, level and family; names.csv the names other catalogs give
  it; values.csv its place in the tree and the references linked to it;
  sources.bib the references.
- iso-639-3.tab and iso-639-3_Name_Index.tab from
  https://iso639-3.sil.org/code_tables/download_tables (SIL International,
  the registration authority for ISO 639-3).
- glottolog-json/<glottocode>.json: Glottolog's own page data for each
  languoid (https://glottolog.org/resource/languoid/id/<glottocode>.json),
  fetched by this script when missing, for the most extensive descriptions
  with their kinds and pages, and the Endangered Languages Project link.

What is kept, and why:

- Other names: only the name Glottolog's catalogs tag with the language's
  own code (the language's name for itself, as Lexvo gives it). Glottolog's
  long list of English alternative names is left out: it mixes old misnomers
  ("Iroquois" for Cherokee) with real names (mockup v2, approved).
- Grammars and dictionaries: the most extensive descriptions that are a
  grammar or a long grammar (not sketches or word lists), and every
  reference Glottolog classes as a dictionary. A class Glottolog's software
  guessed from a title is kept only when the title word is "dictionary" in
  some language; guesses from "lexicon", "lexique" or "slovar" are left out,
  since a paper about a lexicon is not a dictionary.

Nothing about endangerment is written: that waits for the Indigenous advisory
council and Trevor (docs/indigenous-advisory-council.md).

Running it again with the same inputs changes nothing.

Usage: python3 scripts/languages/build_registry.py <repo> <download folder>
"""
import csv
import glob
import json
import os
import re
import sys
import time
import urllib.request

import yaml

repo, downloads = sys.argv[1], sys.argv[2]
RETRIEVED = '2026-11-27'
GLOTTOLOG = 'glottolog-5-4'
ISO = 'iso-639-3-code-tables'
ANLC = 'alaska-native-language-center-languages'

# BCP 47 uses the two-letter ISO 639-1 code where one exists (RFC 5646
# § 2.2.1), so three record tags are two letters; the catalogs use three.
TWO_TO_THREE = {'ch': 'cha', 'oj': 'oji', 'sm': 'smo'}
# A record tag whose ISO 639-3 code was retired, and the code that took its
# place (iso-639-3_Retirements.tab): "wya" was split on Jan. 20, 2022 into
# Wyandot (wyn) and Wendat (wdt); the Wyandotte Nation's language is Wyandot.
# Glottolog 5.4 still files Huron-Wyandot under "wya".
RETIRED = {'wya': ('wyn', '2022-01-20', 'Split into Wyandot [wyn] and Wendat [wdt]')}
# Glottolog gives the ISO macrolanguage "oji" to no languoid; its Ojibwa
# family (ojib1241) is the same group of languages.
GLOTTOCODE_FOR = {'oji': 'ojib1241'}

# The Alaska Native Language Center's page for each of the 20 Alaska Native
# languages (https://www.uaf.edu/anlc/languages-move/languages.php, read
# Nov. 27, 2026), by the ISO 639-3 code of the language the page is about.
ANLC_PAGES = {
    'aht': 'ahtna', 'ale': 'aleut', 'ems': 'alutiiq', 'esu': 'centralakyupik', 'ing': 'degxinag',
    'tfn': 'denaina', 'eya': 'eyak', 'gwi': 'gwichin', 'hai': 'haida', 'haa': 'han',
    'hoi': 'holikachuk', 'ipk': 'inupiaq', 'koy': 'koyukon', 'ess': 'siberianyupik', 'tcb': 'tanacross',
    'taa': 'tanana', 'tli': 'tlingit', 'tsi': 'tsimshian', 'kuu': 'upperkuskokwim', 'tau': 'uppertanana',
}

DICTIONARY_GUESSES = ('dictionary', 'dictionnaire', 'diccionario', 'dicionario', 'dicionário', 'worterbuch', 'wörterbuch', 'woordenboek', 'dizionario')


def read_csv(name):
    path = glob.glob(f'{downloads}/cldf/*/cldf/{name}')[0]
    with open(path, newline='', encoding='utf-8') as handle:
        return list(csv.DictReader(handle))


def read_tab(name):
    with open(f'{downloads}/{name}', newline='', encoding='utf-8') as handle:
        return list(csv.DictReader(handle, delimiter='\t'))


def record_tags():
    tags = set()
    for path in glob.glob(f'{repo}/content/tribes/*/*.yaml'):
        with open(path, encoding='utf-8') as handle:
            record = yaml.safe_load(handle)
        for fact in (record or {}).get('languages') or []:
            if fact.get('language_tag'):
                tags.add(fact['language_tag'])
    return sorted(tags)


def glottolog_json(glottocode):
    folder = f'{downloads}/glottolog-json'
    os.makedirs(folder, exist_ok=True)
    path = f'{folder}/{glottocode}.json'
    if not os.path.exists(path):
        request = urllib.request.Request(f'https://glottolog.org/resource/languoid/id/{glottocode}.json', headers={'User-Agent': 'tribal-law-project language registry'})
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read()
        with open(path, 'wb') as handle:
            handle.write(data)
        time.sleep(0.5)
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)


def read_references(wanted):
    """The sources.bib entries with the wanted ids, as dicts of their fields."""
    path = glob.glob(f'{downloads}/cldf/*/cldf/sources.bib')[0]
    found, current, lines = {}, None, []
    with open(path, encoding='utf-8') as handle:
        for line in handle:
            start = re.match(r'^@(\w+)\{([^,]+),', line)
            if start:
                current = start.group(2) if start.group(2) in wanted else None
                lines = [f'type = {{{start.group(1)}}}']
                continue
            if current is None:
                continue
            if line.startswith('}'):
                fields = {}
                for field in lines:
                    match = re.match(r'\s*([\w-]+) = \{(.*)\},?$', field)
                    if match:
                        fields[match.group(1)] = match.group(2)
                found[current] = fields
                current = None
            else:
                lines.append(line.rstrip('\n'))
    return found


def person(name):
    """"King, Duane Harold" as "Duane Harold King"."""
    name = name.strip()
    if ',' in name:
        family, given = [part.strip() for part in name.split(',', 1)]
        return f'{given} {family}'.strip()
    return name


def authors(text):
    people = [person(name) for name in re.split(r'\s+and\s+', text) if name.strip()]
    if len(people) <= 2:
        return ' and '.join(people)
    return ', '.join(people[:-1]) + ' and ' + people[-1]


def clean(text):
    text = re.sub(r'\{\\?([^{}]*)\}', r'\1', text or '')
    return re.sub(r'\s+', ' ', text.replace('{', '').replace('}', '')).strip()


def page_count(text):
    numbers = [int(number) for number in re.findall(r'\d+', text or '')]
    return max(numbers) if numbers else None


def kinds_of(hhtype):
    """Glottolog's classes for a reference, keeping a guessed dictionary only when guessed from a word for dictionary."""
    kinds = []
    for part in (hhtype or '').split(';'):
        part = part.strip()
        guess = re.match(r'^(\w+) \(computerized assignment from "(.+)"\)$', part)
        if guess:
            part = guess.group(1) if guess.group(1) != 'dictionary' or guess.group(2).lower() in DICTIONARY_GUESSES else ''
        if part in ('grammar', 'long_grammar') and 'grammar' not in kinds:
            kinds.append('grammar')
        elif part == 'dictionary':
            kinds.append('dictionary')
    return kinds


def main():
    tags = record_tags()
    languoids = {row['ID']: row for row in read_csv('languages.csv')}
    # A language carries its ISO code; for an ISO macrolanguage, such as
    # "del" (Common Delaware), Glottolog can give the code to a family.
    by_iso = {}
    for row in sorted(languoids.values(), key=lambda row: row['Level'] != 'language'):
        if row['ISO639P3code']:
            by_iso.setdefault(row['ISO639P3code'], row['ID'])
    iso_rows = {row['Id']: row for row in read_tab('iso-639-3.tab')}
    iso_names = {}
    for row in read_tab('iso-639-3_Name_Index.tab'):
        iso_names.setdefault(row['Id'], []).append(row['Print_Name'])
    names = {}
    for row in read_csv('names.csv'):
        names.setdefault(row['Language_ID'], []).append(row)
    values = {}
    parents = {}
    for row in read_csv('values.csv'):
        if row['Parameter_ID'] in ('bib', 'classification'):
            values[(row['Language_ID'], row['Parameter_ID'])] = row
            if row['Parameter_ID'] == 'classification' and row['Value']:
                parents[row['Language_ID']] = row['Value'].split('/')[-1]
    children = {}
    for code, parent in parents.items():
        children.setdefault(parent, []).append(code)

    entries = {}
    wanted = set()
    for tag in tags:
        iso = TWO_TO_THREE.get(tag, tag)
        if iso not in iso_rows and iso not in RETIRED:
            sys.exit(f'{tag}: not an ISO 639-3 code')
        glottocode = GLOTTOCODE_FOR.get(iso) or by_iso.get(iso)
        if not glottocode:
            sys.exit(f'{tag}: no Glottolog language for {iso}')
        languoid = languoids[glottocode]
        data = glottolog_json(glottocode)
        family = languoids.get(languoid['Family_ID']) if languoid['Family_ID'] else None
        meds = [med for med in (data.get('jsondata') or {}).get('meds') or [] if med[1] in ('grammar', 'long_grammar')]
        bib = values.get((glottocode, 'bib'))
        references = [reference.split('[')[0] for reference in (bib['Source'].split(';') if bib and bib['Source'] else [])]
        wanted.update(med[0] for med in meds)
        wanted.update(references)
        entries[tag] = dict(iso=iso, glottocode=glottocode, languoid=languoid, data=data, family=family, meds=meds, references=references)

    found = read_references(wanted)
    written = 0
    for tag, entry in entries.items():
        iso, glottocode, languoid, data = entry['iso'], entry['glottocode'], entry['languoid'], entry['data']
        retired = RETIRED.get(iso)
        current = retired[0] if retired else iso
        name = languoid['Name']
        own = []
        for row in names.get(glottocode, []):
            if row['Provider'] == 'lexvo' and row['lang'] in (tag, iso) and row['Name'] != name and row['Name'] not in [item['name'] for item in own]:
                own.append({'name': row['Name'], 'language': tag, 'source': GLOTTOLOG})
        iso_other = [other for other in dict.fromkeys(iso_names.get(current, [])) if other != name]
        elp = next((link['url'] for link in (data.get('jsondata') or {}).get('links') or [] if 'endangeredlanguages.com' in link['url']), None)

        # Dialects: Glottolog's languoids one step below this one. For a
        # family-level entry (Ojibwa), the languages in it instead.
        if languoid['Level'] == 'family':
            below = [code for code, row in languoids.items() if row['Level'] == 'language' and glottocode in (values.get((code, 'classification')) or {}).get('Value', '').split('/')]
        else:
            below = [code for code in children.get(glottocode, []) if languoids.get(code, {}).get('Level') == 'dialect']
        dialects = sorted(({'name': languoids[code]['Name'], 'glottocode': code} for code in below), key=lambda item: item['name'].lower())

        works = []
        seen = set()
        med_pages = {med[0]: med[3] for med in entry['meds']}
        for reference in [med[0] for med in entry['meds']] + entry['references']:
            if reference in seen or reference not in found:
                continue
            fields = found[reference]
            kinds = kinds_of(fields.get('hhtype'))
            if reference not in med_pages and 'dictionary' not in kinds:
                continue
            if not kinds:
                kinds = ['grammar']
            seen.add(reference)
            year = page_count(fields.get('year')) if re.search(r'\d{4}', fields.get('year', '')) else None
            publisher = clean(fields.get('school') if fields.get('type') in ('phdthesis', 'mastersthesis') and fields.get('school') else fields.get('publisher') or fields.get('school') or fields.get('journal') or '')
            publisher = re.sub(r'^[^:]{1,40}: ', '', publisher) if ': ' in publisher else publisher
            work = {'glottolog_reference': reference, 'title': clean(fields.get('title')), 'kinds': kinds}
            if fields.get('author') or fields.get('editor'):
                work['author'] = authors(clean(fields.get('author') or fields.get('editor')))
            if year:
                work['year'] = int(re.search(r'\d{4}', fields['year']).group(0))
            if publisher:
                work['publisher'] = publisher
            pages = med_pages.get(reference) or page_count(fields.get('pages') or fields.get('numberofpages'))
            if pages:
                work['pages'] = pages
            if reference in med_pages:
                work['most_extensive_description'] = True
            works.append(work)
        works.sort(key=lambda work: (-(work.get('year') or 0), work['title'].lower()))

        record = {
            'tag': tag,
            'name': name,
            'iso_639_3': {'code': current, 'reference_name': iso_rows[current]['Ref_Name'], 'scope': {'I': 'individual', 'M': 'macrolanguage'}.get(iso_rows[current]['Scope'], iso_rows[current]['Scope']), 'source': ISO},
            'glottolog': {'glottocode': glottocode, 'level': languoid['Level'], 'source': GLOTTOLOG},
        }
        if retired:
            record['iso_639_3']['retired_code'] = {'code': iso, 'effective': retired[1], 'remedy': retired[2]}
        if entry['family'] and entry['family']['ID'] != glottocode:
            record['family'] = {'name': entry['family']['Name'], 'glottocode': entry['family']['ID'], 'source': GLOTTOLOG}
        else:
            record['family'] = None
        if own:
            record['own_names'] = own
        if iso_other:
            record['iso_names'] = [{'name': other, 'source': ISO} for other in iso_other]
        if elp:
            record['endangered_languages_project'] = {'link': elp, 'source': GLOTTOLOG}
        if current in ANLC_PAGES:
            record['alaska_native_language_center'] = {'link': f'https://www.uaf.edu/anlc/languages-move/{ANLC_PAGES[current]}.php', 'source': ANLC}
        record['dialects'] = [{**dialect, 'source': GLOTTOLOG} for dialect in dialects]
        record['works'] = [{**work, 'source': GLOTTOLOG} for work in works]
        record['retrieved'] = RETRIEVED

        os.makedirs(f'{repo}/content/languages', exist_ok=True)
        with open(f'{repo}/content/languages/{tag}.yaml', 'w', encoding='utf-8') as handle:
            handle.write('# Written by scripts/languages/build_registry.py from Glottolog 5.4 and the ISO 639-3 code tables; do not edit by hand.\n')
            yaml.safe_dump(record, handle, allow_unicode=True, sort_keys=False, width=100000)
        written += 1
    print(f'{written} language files written')


main()
