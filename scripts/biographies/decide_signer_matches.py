"""Settle the review list of possible treaty signer matches from two AI readers' verdicts.

Trevor asked on Nov. 26, 2026 for best effort on the 1,128 closer calls in
research/reviews/2026-11-26-treaty-signer-matches.csv instead of reading them
himself. Two Haiku readers judged each pair separately with
research/biographies/2026-11-26/signer-match-judge-instructions.md; their
inputs and verdicts are in research/biographies/2026-11-26/signer-match-readers
(pair p0123 is row 123 of the review list, counted from 0). A pair is "same"
only when both readers said same and at least one was highly confident, or both
when the spellings are far apart (an English-name match whose sound keys are
under 50% alike). Pairs already on one page are left out. The result,
research/reviews/2026-11-26-treaty-signer-match-decisions.csv, is read by
make_repeat_signer_records.py.

Usage: python3 scripts/biographies/decide_signer_matches.py <repo>
"""
import csv, json, sys, collections
repo = sys.argv[1]
judge = f"{repo}/research/biographies/2026-11-26/signer-match-readers"
rows = list(csv.DictReader(open(f"{repo}/research/reviews/2026-11-26-treaty-signer-matches.csv")))
verdicts = collections.defaultdict(dict)
for batch in range(1, 5):
    for reader in 'ab':
        for v in json.load(open(f"{judge}/reader-{batch}{reader}.json")):
            verdicts[v['id']][reader] = v
out = []
tally = collections.Counter()
missing = 0
for n, r in enumerate(rows):
    pid = f"p{n:04d}"
    if r['a_page'] and r['a_page'] == r['b_page']:
        decision, ra, rb = 'already one page', {}, {}
    else:
        ra, rb = verdicts[pid].get('a', {}), verdicts[pid].get('b', {})
        if not ra or not rb:
            missing += 1
        both_same = ra.get('verdict') == 'same' and rb.get('verdict') == 'same'
        # Spellings far apart (an English-name match, sound keys under 50% alike) need both readers sure.
        sure = (ra.get('confidence'), rb.get('confidence')) == ('high', 'high') if 0 < float(r['similarity']) < 0.5 else 'high' in (ra.get('confidence'), rb.get('confidence'))
        decision = 'same' if both_same and sure else 'different' if ra.get('verdict') == 'different' and rb.get('verdict') == 'different' else 'not joined'
    # My own reading over the two readers: "Tuckabatchee Micco" is the title of the Tuckabatchee town chief, held in turn.
    if 'micco' in r['a_name'].lower() and {r['a_year'], r['b_year']} == {'1827', '1854'}:
        decision = 'not joined'
    tally[(r['rule'], decision)] += 1
    out.append([r['a'], r['b'], decision, f"{ra.get('verdict','')} {ra.get('confidence','')}".strip(), ra.get('reason', ''), f"{rb.get('verdict','')} {rb.get('confidence','')}".strip(), rb.get('reason', '')])
with open(f"{repo}/research/reviews/2026-11-26-treaty-signer-match-decisions.csv", 'w', newline='') as h:
    w = csv.writer(h, lineterminator='\n')
    w.writerow(['a', 'b', 'decision', 'reader_1', 'reader_1_reason', 'reader_2', 'reader_2_reason'])
    w.writerows(out)
print('missing', missing)
for k, v in sorted(tally.items()):
    print(k, v)
