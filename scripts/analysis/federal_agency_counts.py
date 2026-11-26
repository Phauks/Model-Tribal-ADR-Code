"""Count tier 2 federal agency sources: Interior Board of Indian Appeals decisions, National Indian Gaming Commission reading room items, and Federal Register documents from Indian affairs agencies.

  python3 scripts/analysis/federal_agency_counts.py ibia OUT.csv
  python3 scripts/analysis/federal_agency_counts.py nigc OUT.json
  python3 scripts/analysis/federal_agency_counts.py federal-register OUT.json

`ibia` reads the Board's chronological index (one page per calendar year since 1970) and writes one row per decision with its name, date, citation and PDF link; decisions whose name contains "Estate of" are probate appeals. `nigc` counts the rows of each reading room table. `federal-register` asks the Federal Register API (documents since 1994) for counts by agency, type and a few title phrases. Standard library only.
"""
import sys, re, html, json, csv, urllib.request, urllib.parse, collections, concurrent.futures as cf, time

UA = {'User-Agent': 'Mozilla/5.0 research script'}


def get(url):
    for i in range(3):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode('utf-8', 'replace')
        except Exception:
            if i == 2:
                raise
            time.sleep(3)


def table_rows(page):
    rows = []
    for tr in re.findall(r'(?s)<tr[^>]*>(.*?)</tr>', page):
        cells = [html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', c))).strip() for c in re.findall(r'(?s)<t[dh][^>]*>(.*?)</t[dh]>', tr)]
        rows.append((cells, re.findall(r'href="([^"]+)"', tr)))
    return rows


def ibia(out):
    base = 'https://www.doi.gov'
    index = get(base + '/oha/organization/ibia/Chronological-Index-of-Decisions')
    years = sorted(set(re.findall(r'href="(/oha/organization/ibia/cumulative-chronological-index-of-cases/[^"]+)"', index)))
    decisions = []
    with cf.ThreadPoolExecutor(6) as ex:
        for path, page in zip(years, ex.map(lambda p: get(base + p), years)):
            year = re.search(r'(\d{4})$', path).group(1)
            page = page[re.search(r'(?i)name of case', page).start():]
            page = page[:page.find('</table>')]
            for cells, links in table_rows(page):
                if len(cells) < 2 or cells[0].lower().startswith('name of case'):
                    continue
                decisions.append({'year': year, 'name': cells[0], 'decided': cells[1], 'citation': cells[2] if len(cells) > 2 else '',
                                  'probate': 'estate of' in cells[0].lower(), 'link': links[0] if links else ''})
    with open(out, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(decisions[0]))
        w.writeheader()
        w.writerows(decisions)
    by_year = collections.Counter(d['year'] for d in decisions)
    print('decisions', len(decisions), 'probate', sum(d['probate'] for d in decisions), 'years', min(by_year), '-', max(by_year))


NIGC = {
    'gaming_ordinances': 'office-of-general-counsel/gaming-ordinances',
    'declination_letters': 'office-of-general-counsel/legal-opinions/declination-letters',
    'game_classification_opinions': 'office-of-general-counsel/legal-opinions/game-classification-opinions',
    'indian_lands_opinions': 'office-of-general-counsel/legal-opinions/indian-lands-opinions',
    'enforcement_actions': 'commission/commission-actions/enforcement-actions',
    'commission_final_decisions': 'commission/commission-actions/commission-final-decisions',
    'bulletins': 'office-of-chief-of-staff/compliance/bulletins',
}


def nigc(out):
    result = {}
    for key, path in NIGC.items():
        rows = [(c, l) for c, l in table_rows(get(f'https://www.nigc.gov/{path}/')) if c and l]
        result[key] = {'url': f'https://www.nigc.gov/{path}/', 'rows': len(rows), 'documents': sum(len(l) for c, l in rows)}
        if key == 'enforcement_actions':
            result[key]['by_type'] = dict(collections.Counter(c[3] for c, l in rows if len(c) > 3))
        if key == 'commission_final_decisions':
            result[key]['by_type'] = dict(collections.Counter(c[-1] for c, l in rows))
        print(key, result[key])
    open(out, 'w').write(json.dumps(result, indent=1) + '\n')


AGENCIES = ['indian-affairs-bureau', 'national-indian-gaming-commission', 'indian-health-service', 'indian-arts-and-crafts-board',
            'navajo-and-hopi-indian-relocation-office', 'special-trustee-for-american-indians-office', 'indian-trust-transition-office']
PHRASES = {
    'gaming compact notices': '"Tribal-State Class III Gaming"',
    'liquor ordinances': 'liquor ordinance',
    'land acquisitions (trust land)': '"Land Acquisitions"',
    'reservation proclamations': '"Proclaiming Certain Lands"',
    'federal acknowledgment': '"Federal Acknowledgment"',
    'recognized entities lists': '"Indian Entities Recognized"',
}


def fr_count(params):
    q = urllib.parse.urlencode(dict(params, per_page=1), doseq=True)
    return json.loads(get('https://www.federalregister.gov/api/v1/documents.json?' + q))['count']


def federal_register(out):
    result = {'agencies': {}, 'phrases_in_bureau_of_indian_affairs_documents': {}}
    for a in AGENCIES:
        result['agencies'][a] = {'all': fr_count({'conditions[agencies][]': a})}
        for t in ['RULE', 'PRORULE', 'NOTICE']:
            result['agencies'][a][t] = fr_count({'conditions[agencies][]': a, 'conditions[type][]': t})
        print(a, result['agencies'][a])
    for k, term in PHRASES.items():
        result['phrases_in_bureau_of_indian_affairs_documents'][k] = fr_count({'conditions[term]': term, 'conditions[agencies][]': 'indian-affairs-bureau'})
        print(k, result['phrases_in_bureau_of_indian_affairs_documents'][k])
    result['nagpra_notices_national_park_service'] = fr_count({'conditions[term]': '"Native American Graves Protection and Repatriation"', 'conditions[agencies][]': 'national-park-service', 'conditions[type][]': 'NOTICE'})
    print('NAGPRA notices', result['nagpra_notices_national_park_service'])
    open(out, 'w').write(json.dumps(result, indent=1) + '\n')


if __name__ == '__main__':
    {'ibia': ibia, 'nigc': nigc, 'federal-register': federal_register}[sys.argv[1]](sys.argv[2])
