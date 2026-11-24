"""Match legal help providers to the Native nations they serve.

Reads research/legal-help/providers/*.yaml and content/tribes/*/*.yaml and writes
research/legal-help/nation-matches.csv: one row per nation and provider, with the
basis of the match and the source that supports it.

Bases:
- named: the source names the nation or its reservation.
- members: the provider serves the nation's own members (a tribal program).
- statewide: the source says the provider serves Native people in every county of
  a state; every nation with a page and a presence in that state is matched.

Scopes "region", "topic" and "unclassified" are not matched to nations.

Usage: python3 scripts/legal-help/match_nations.py [--check]
--check validates (every named nation exists) and fails when nation-matches.csv
is not what the records give, since nation pages read it (site/src/lib/server/legal-help.ts).
"""
import csv, glob, io, os, sys
import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROVIDERS = os.path.join(ROOT, 'research', 'legal-help', 'providers')
OUT = os.path.join(ROOT, 'research', 'legal-help', 'nation-matches.csv')


def load_nations():
    nations = {}
    for path in glob.glob(os.path.join(ROOT, 'content', 'tribes', '*', '*.yaml')):
        with open(path) as f:
            d = yaml.safe_load(f)
        states = sorted({s['state'] for s in d.get('states') or []})
        recognition = sorted({r.get('type') for r in d.get('recognition') or [] if r.get('type')})
        nations[d['id']] = {'states': states, 'recognition': recognition}
    return nations


def main():
    check = '--check' in sys.argv
    nations = load_nations()
    rows, problems = [], []
    providers = []
    for path in sorted(glob.glob(os.path.join(PROVIDERS, '*.yaml'))):
        with open(path) as f:
            p = yaml.safe_load(f)
        providers.append(p)
        source_ids = {s['id'] for s in p.get('sources') or []}
        for serve in p.get('serves') or []:
            if serve.get('source') not in source_ids:
                problems.append(f"{p['id']}: source {serve.get('source')} is not in its sources")
            named = serve.get('nations') or []
            for n in named + (serve.get('except_nations') or []):
                if n not in nations:
                    problems.append(f"{p['id']}: no nation page {n}")
            scope = serve['scope']
            areas = ';'.join(x['service_area'] for x in p.get('lsc') or [] if x['service_area'].lower() in serve['source'])
            def add(n, state, basis):
                rows.append({'nation': n, 'state': state, 'provider': p['id'], 'kind': p['kind'], 'basis': basis,
                             'status': p.get('status', 'open'), 'lsc_service_area': areas, 'link': serve.get('link') or p.get('link', ''), 'source': serve['source']})
            if scope in ('named-nations', 'members'):
                for n in named:
                    if n in nations:
                        state = next((s for s in serve['states'] if s in nations[n]['states']), serve['states'][0])
                        add(n, state, 'named' if scope == 'named-nations' else 'members')
            elif scope == 'statewide':
                for n, info in nations.items():
                    if n in (serve.get('except_nations') or []):
                        continue
                    for state in serve['states']:
                        if state in info['states']:
                            add(n, state, 'named' if n in named else 'statewide')
    # one row per nation, provider and basis
    seen, unique = set(), []
    for r in sorted(rows, key=lambda r: (r['nation'], r['provider'], r['basis'] != 'named')):
        key = (r['nation'], r['provider'])
        if key in seen:
            continue
        seen.add(key)
        unique.append(r)
    for msg in problems:
        print('PROBLEM', msg)
    matched = {r['nation'] for r in unique}
    native_specific = {r['nation'] for r in unique if r['kind'] in ('legal-aid', 'tribal-legal-aid', 'self-help-center') and r['status'] != 'to-classify'}
    federal = {n for n, i in nations.items() if 'federal' in i['recognition']}
    print(f"{len(providers)} providers, {len(unique)} nation matches, {len(matched)} of {len(nations)} nations matched")
    print(f"federally recognized nations with a Native legal aid or self-help match: {len(native_specific & federal)} of {len(federal)}")
    if problems:
        sys.exit(1)
    buffer = io.StringIO(newline='')
    w = csv.DictWriter(buffer, fieldnames=list(unique[0].keys()))
    w.writeheader()
    w.writerows(unique)
    if check:
        current = open(OUT, newline='').read() if os.path.exists(OUT) else ''
        if current != buffer.getvalue():
            print(f'{os.path.relpath(OUT, ROOT)} is out of date: run python3 scripts/legal-help/match_nations.py')
            sys.exit(1)
        return
    with open(OUT, 'w', newline='') as f:
        f.write(buffer.getvalue())
    print('wrote', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
