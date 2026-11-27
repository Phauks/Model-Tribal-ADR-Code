"""Keep only the U.S. signer offices printed word for word in the treaty.

Reads the readers' lists (one JSON array per batch, see
research/biographies/2026-11-27/us-signer-office-reader-instructions.md) and
the saved OSU treaty pages (signer_count/fetch_osu.py), and writes
research/biographies/2026-11-27/us-signer-offices.json with every office whose
words appear in that treaty's text, in order, ignoring case, spacing,
punctuation and a plural printed for a group ("Commissioners" for each of them). Dropped offices are listed in us-signer-offices-dropped.csv.

Usage: python3 scripts/biographies/check_signer_offices.py <repo> <osu pages dir> <reader output>...
"""
import csv, html, json, re, sys, unicodedata

repo, pages, outputs = sys.argv[1], sys.argv[2], sys.argv[3:]


def fold(text):
    text = unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode().lower()
    return ' ' + re.sub(r'[^a-z0-9]+', ' ', text).strip() + ' '


def printed(office, text):
    words = fold(office).split()
    return bool(words) and re.search(r' ' + r' '.join(re.escape(w) + r's?' for w in words) + r' ', text) is not None


def treaty_text(key):
    page = open(f"{pages}/{key}.html", errors='ignore').read()
    start = page.find('id="treaty-content"')
    body = re.sub(r'<aside.*?</aside>', '', page[start:page.find('</section>', start)], flags=re.S)
    return fold(html.unescape(re.sub(r'<[^>]+>', ' ', body)))


signed = {}
for s in json.load(open(f"{repo}/research/biographies/2026-11-26/treaty-us-signers.json"))['signers']:
    signed.setdefault(s['key'], set()).add(s['name'])
kept, dropped = [], []
for output in outputs:
    for item in json.load(open(output)):
        text = treaty_text(item['key'])
        signers = []
        for signer in item['signers']:
            if signer['name'] not in signed.get(item['key'], ()):
                dropped.append([item['key'], signer['name'], '', 'not a U.S. signer of this treaty'])
                continue
            good = []
            for office in signer.get('offices', []):
                office = re.sub(r'\s+', ' ', office).strip(' ,.;:')
                if len(fold(office).split()) == 0:
                    continue
                if printed(office, text) and fold(office) not in {fold(o) for o in good}:
                    good.append(office)
                else:
                    dropped.append([item['key'], signer['name'], office, 'not printed in the treaty text' if not printed(office, text) else 'repeated'])
            signers.append({'name': signer['name'], 'offices': good})
        kept.append({'key': item['key'], 'signers': signers})
kept.sort(key=lambda item: item['key'])
with open(f"{repo}/research/biographies/2026-11-27/us-signer-offices.json", 'w') as handle:
    json.dump(kept, handle, indent=1, ensure_ascii=False)
    handle.write('\n')
with open(f"{repo}/research/biographies/2026-11-27/us-signer-offices-dropped.csv", 'w', newline='') as handle:
    writer = csv.writer(handle, lineterminator='\n')
    writer.writerow(['treaty', 'signer', 'office', 'why'])
    writer.writerows(dropped)
print('treaties', len(kept), 'offices kept', sum(len(s['offices']) for i in kept for s in i['signers']), 'dropped', len(dropped))
