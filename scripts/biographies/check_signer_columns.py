"""Check which group heading each Native treaty signer was printed under, reading the Statutes at Large page by column.

The signer lists in research/biographies/2026-11-24/treaty-signers.json were read from page text in which two printed columns run together line by line, so a heading at the top of one column could be read as belonging to a name on the same line in the other column (Trevor, Nov. 27, 2026: Austin E. Quinny listed "for Munsee" in the 1839 Stockbridge and Munsee treaty). This script lays each signature page out with `pdftotext -layout`, splits the page into its printed columns, and walks each column from the top, so a heading applies only to the names printed below it in its own column (or in every column it spans). It writes one row per signer it finds on the page, with the heading printed above the name in its column (empty when none), whether the recorded group is itself printed as a heading on the page, and whether the recorded group is a heading printed in another column at or above the name's line while the name's own column has no heading above it (the misreading: a heading borrowed from the next column).

Usage: python3 scripts/biographies/check_signer_columns.py <folder of Statutes at Large PDFs named by treaty key> <output.csv>
"""
import collections, csv, json, os, re, subprocess, sys

repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
pdfs, out_path = sys.argv[1], sys.argv[2]
CLAUSE = re.compile(r'in\s+(testimony|witness)\s+where\s*of|have\s+hereunto\s+(set|sett|signed|subscribed)', re.I)
WITNESS = re.compile(r'(in\s+(the\s+)?presence\s+of|^witness(es)?\b|signed,?\s+sealed|interpreter|secretary)', re.I)
NOISE = re.compile(r'\b(his|her)\s*x?\s*mark\b|\[?\s*l\.\s*s\.?\s*\]?|\[\s*seal\.?\s*\]|\bseal\b', re.I)


def norm(t):
    return re.sub(r'[^a-z0-9]', '', (t or '').lower())


def segments(line):
    """Split a laid-out line into (start, end, text) runs separated by three or more spaces."""
    return [(m.start(), m.end(), m.group().strip()) for m in re.finditer(r'\S+(?: {1,2}\S+)*', line)]


def layout(path):
    return subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True).stdout.split('\f')


signers = json.load(open(f"{repo}/research/biographies/2026-11-24/treaty-signers.json"))
by_treaty = collections.defaultdict(list)
for i, s in enumerate(signers):
    s['index'] = i
    by_treaty[s['key']].append(s)
treaties = {t['treaty_key']: t for t in json.load(open(f"{repo}/research/raw/2026-11-23/treaties.json"))['treaties']}

rows, stats = [], collections.Counter()
for key, group in sorted(by_treaty.items()):
    nations = sorted({s['nation'] for s in group if s['nation']}, key=len, reverse=True)
    stats['treaties checked'] += 1
    path = f"{pdfs}/{key}.pdf"
    if not os.path.exists(path):
        stats['no pdf'] += 1
        continue
    pages = layout(path)
    lines = [(p, ln) for p, page in enumerate(pages) for ln in page.split('\n')]
    want = {norm(s['printed']): s for s in group if len(norm(s['printed'])) >= 3}
    # Signature regions: from each signing clause to the next one; keep those that hold this treaty's signers.
    starts = [i for i, (_, ln) in enumerate(lines) if CLAUSE.search(ln)] + [len(lines)]
    regions = []
    for a, b in zip(starts, starts[1:]):
        hits = sum(1 for _, ln in lines[a:b] for _, _, t in segments(ln) if norm(NOISE.sub('', t).split(',')[0]) in want)
        if hits >= 2:
            regions.append((a, b))
    if not regions:
        stats['no region found'] += 1
        continue

    def heading_of(text):
        t = NOISE.sub('', text).strip(' .,:;—-')
        if not t or len(t) > 70:
            return None
        n = norm(t)
        for nat in nations:
            m = norm(nat)
            if n == m or (len(n) >= 4 and (n in m or m in n) and min(len(n), len(m)) / max(len(n), len(m)) > 0.6):
                return nat
        return None

    found, printed_headings = {}, set()
    for a, b in regions:
        page_lines = collections.defaultdict(list)
        for p, ln in lines[a:b]:
            page_lines[p].append(ln)
        carried = None
        for p in sorted(page_lines):
            items, intervals = [], []
            witness = False
            for row, ln in enumerate(page_lines[p]):
                segs = segments(ln)
                if WITNESS.search(ln.strip()):
                    witness = True
                if not segs or witness:
                    continue
                if len(segs) == 1 and segs[0][1] - segs[0][0] > 60:
                    continue  # running text across the page
                for st, en, t in segs:
                    h = heading_of(t)
                    if h:
                        printed_headings.add(h)
                        items.append((row, st, en, 'heading', h))
                        intervals.append((st, en))
                        continue
                    name = NOISE.sub('', t).strip(' ,.;:')
                    core = norm(name.split(',')[0])
                    match = want.get(core) or want.get(norm(name))
                    if match:
                        items.append((row, st, en, 'signer', match))
                        intervals.append((st, en))
            if not items:
                continue
            # Columns: runs of character positions joined by overlapping names and headings.
            cols = []
            for st, en in sorted(intervals):
                if cols and st <= cols[-1][1] + 1:
                    cols[-1][1] = max(cols[-1][1], en)
                else:
                    cols.append([st, en])
            # A centred heading can bridge two columns of names; split columns again on signer positions only.
            name_cols = []
            for st, en in sorted((it[1], it[2]) for it in items if it[3] == 'signer'):
                if name_cols and st <= name_cols[-1][1] + 1:
                    name_cols[-1][1] = max(name_cols[-1][1], en)
                else:
                    name_cols.append([st, en])
            cols = name_cols or cols
            # Reading order: column by column, left to right; a heading applies to every column it overlaps from its row down.
            for ci, (cs, ce) in enumerate(cols):
                current, own = carried, False
                for row, st, en, kind, val in sorted(items, key=lambda it: it[0]):
                    overlaps = st <= ce and en >= cs
                    if kind == 'heading' and overlaps:
                        current, own = val, True
                    elif kind == 'signer' and overlaps and val['index'] not in found:
                        # Headings printed in another column at or above this name's line, when its own column has none above it on this page.
                        beside = set() if own else {v for r2, s2, e2, k2, v in items if k2 == 'heading' and r2 <= row + 1 and not (s2 <= ce and e2 >= cs)}
                        found[val['index']] = (current, p, beside)
                carried = current
    for s in group:
        if s['index'] not in found:
            stats['signer not located'] += 1
            continue
        stats['signers located'] += 1
        heading, _, beside = found[s['index']]
        borrowed = s['nation'] in beside and heading != s['nation']
        if borrowed:
            stats['recorded group borrowed from a heading in another column'] += 1
        if heading is None and s['nation'] not in printed_headings:
            stats['no heading, recorded group taken from the treaty text'] += 1
        elif heading != s['nation']:
            stats['differs'] += 1
        rows.append({'key': key, 'index': s['index'], 'printed': s['printed'], 'label': s['label'] or '', 'recorded_nation': s['nation'], 'heading_above_in_column': heading or '', 'recorded_is_printed_heading': s['nation'] in printed_headings, 'borrowed_from_other_column': borrowed, 'page': s['page']})

with open(out_path, 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=['key', 'index', 'printed', 'label', 'recorded_nation', 'heading_above_in_column', 'recorded_is_printed_heading', 'borrowed_from_other_column', 'page'])
    w.writeheader()
    w.writerows(rows)
print(dict(stats))
