"""Estimate how many published court opinions are about Indian law, by sampling Caselaw Access Project volumes.

The Caselaw Access Project (https://static.case.law/) publishes every volume of the official and West reporters it scanned as a zip of JSON cases, with no key. This script reads every Nth volume of each reporter, scores each case by how often it uses Indian law terms, and scales the sample up to the whole reporter.

  python3 scripts/analysis/indian_law_case_sample.py sample OUTDIR f3d:20,p2d:15,okla:4:150
  python3 scripts/analysis/indian_law_case_sample.py estimate OUTDIR OUT.json [--before YEAR]

Each reporter spec is reporter:step[:last_volume]. `sample` writes OUTDIR/<reporter>.jsonl (one row per case with any term) and OUTDIR/<reporter>.vols.json (case totals per sampled volume). `estimate` prints and writes the scaled counts; `--before YEAR` keeps only cases decided before that year (used for official state reports that overlap a regional reporter).

Scores and bands: a case's score is the number of term matches in its head matter and opinions. The `weighted` figure counts a case as 0.1 (score 1-2), 0.6 (score 3-4) or 0.85 (score 5 or more): the share of real Indian law cases found when 30 sampled F.3d cases were read by hand on Nov. 26, 2026. It is an estimate, not a list; a build should read each candidate case.
"""
import sys, os, re, json, zipfile, io, urllib.request, concurrent.futures as cf, time, glob, collections

MARKERS = {
    'indian_term': re.compile(r"\bIndian (?:country|tribes?|nations?|reservations?|lands?|affairs|child welfare|gaming|commerce|claims commission|civil rights act|reorganization|allotments?|allottees?|trust|self-determination|agent|agency|title|treaty|treaties|band|health service|police|tribal)\b", re.I),
    'tribal': re.compile(r"\btribal (?:courts?|sovereign\w*|governments?|members?|membership|lands?|councils?|nations?|jurisdiction|law|ordinance|code|police|officials?|immunity|enterprises?|casino)", re.I),
    'usc25': re.compile(r"\b25 U\.\s?S\.\s?C"),
    'bia': re.compile(r"Bureau of Indian Affairs|Commissioner of Indian Affairs|Office of Indian Affairs", re.I),
    'native': re.compile(r"\bNative Americans?\b|\bAlaska Natives?\b|\bAmerican Indians?\b|\bNative Hawaiians?\b", re.I),
    'acts': re.compile(r"\bICWA\b|\bIGRA\b|\bISDEAA\b|\bANCSA\b|\bNAGPRA\b|Public Law 280|P\.\s?L\.\s?280|Indian Civil Rights Act|General Allotment Act|Dawes Act", re.I),
}
BANDS = [(1, 2, 0.1), (3, 4, 0.6), (5, 10**9, 0.85)]


def weight(score):
    return next(w for lo, hi, w in BANDS if lo <= score <= hi)


def fetch(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 research script'})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(3 * (i + 1))


def volumes(rep):
    page = fetch(f'https://static.case.law/{rep}/').decode()
    return sorted({int(v) for v in re.findall(rf"static\.case\.law/{re.escape(rep)}/(\d+)\.zip", page)})


def read_volume(rep, vol):
    z = zipfile.ZipFile(io.BytesIO(fetch(f'https://static.case.law/{rep}/{vol}.zip')))
    rows, total, years = [], 0, []
    for name in z.namelist():
        if not (name.startswith('json/') and name.endswith('.json')):
            continue
        total += 1
        case = json.loads(z.read(name))
        body = case.get('casebody') or {}
        text = (body.get('head_matter') or '') + '\n' + '\n'.join((o.get('text') or '') for o in body.get('opinions', []))
        hits = {k: len(m.findall(text)) for k, m in MARKERS.items()}
        date = case.get('decision_date') or ''
        years.append(date[:4])
        if sum(hits.values()):
            rows.append({'rep': rep, 'vol': vol, 'id': case.get('id'), 'name': case.get('name_abbreviation'), 'date': date,
                         'court': (case.get('court') or {}).get('name'), 'jur': (case.get('jurisdiction') or {}).get('name'),
                         'cite': (case.get('citations') or [{}])[0].get('cite'), 'score': sum(hits.values()), 'hits': hits})
    years = [y for y in years if y]
    return vol, total, rows, (min(years), max(years)) if years else ('', ''), years


def sample(outdir, spec):
    os.makedirs(outdir, exist_ok=True)
    for part in spec.split(','):
        rep, step, last = (part.split(':') + ['1000000'])[:3]
        allv = [v for v in volumes(rep) if v <= int(last)]
        info = {'reporter': rep, 'volumes': len(allv), 'first': allv[0], 'last': allv[-1], 'sampled': {}}
        with open(f'{outdir}/{rep}.jsonl', 'w') as out, cf.ThreadPoolExecutor(8) as ex:
            for fut in cf.as_completed([ex.submit(read_volume, rep, v) for v in allv[::int(step)]]):
                try:
                    vol, total, rows, span, years = fut.result()
                except Exception as e:
                    print('failed', rep, e, flush=True)
                    continue
                info['sampled'][str(vol)] = {'cases': total, 'years': span, 'by_year': dict(collections.Counter(years))}
                for row in rows:
                    out.write(json.dumps(row) + '\n')
        open(f'{outdir}/{rep}.vols.json', 'w').write(json.dumps(info, indent=1) + '\n')
        print(rep, len(allv), 'volumes; sampled', len(info['sampled']), flush=True)


def estimate(outdir, outfile, before=None):
    result = {}
    for vf in sorted(glob.glob(os.path.join(outdir, '*.vols.json'))):
        info = json.load(open(vf))
        rep, n = info['reporter'], len(info['sampled'])
        if not n:
            continue
        scale = info['volumes'] / n
        rows = [json.loads(line) for line in open(vf.replace('.vols.json', '.jsonl'))]
        if before:
            rows = [r for r in rows if r['date'][:4] and int(r['date'][:4]) < before]
        cases = sum(v['cases'] for v in info['sampled'].values())
        count = lambda lo: round(sum(1 for r in rows if r['score'] >= lo) * scale)
        by_jur = collections.Counter()
        for r in rows:
            by_jur[r['jur']] += weight(r['score'])
        result[rep] = {'volumes': info['volumes'], 'sampled': n, 'all_cases': round(cases * scale),
                       'any_term': count(1), 'score_3_plus': count(3), 'score_5_plus': count(5), 'score_10_plus': count(10),
                       'weighted': round(sum(weight(r['score']) for r in rows) * scale),
                       'weighted_by_jurisdiction': {k: round(v * scale) for k, v in by_jur.most_common()}}
        r = result[rep]
        print(f"{rep:12} volumes {r['volumes']:4} sampled {n:3} cases~{r['all_cases']:7} any {r['any_term']:6} 3+ {r['score_3_plus']:5} 5+ {r['score_5_plus']:5} 10+ {r['score_10_plus']:5} weighted {r['weighted']:5}")
    keys = ['all_cases', 'any_term', 'score_3_plus', 'score_5_plus', 'score_10_plus', 'weighted']
    result['_total'] = {k: sum(r[k] for k in [k] for r in result.values() if k in r) for k in keys}
    print('total', result['_total'])
    open(outfile, 'w').write(json.dumps(result, indent=1) + '\n')


if __name__ == '__main__':
    if sys.argv[1] == 'sample':
        sample(sys.argv[2], sys.argv[3])
    else:
        before = int(sys.argv[sys.argv.index('--before') + 1]) if '--before' in sys.argv else None
        estimate(sys.argv[2], sys.argv[3], before)
