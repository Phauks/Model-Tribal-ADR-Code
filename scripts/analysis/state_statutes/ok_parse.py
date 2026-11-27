"""Split the Oklahoma Statutes title PDFs (pdftotext -layout output) into sections and tag Indian law terms.

  python3 -I ok_parse.py TXT_DIR OUT.jsonl
"""
import re, sys, json, pathlib

HEAD = re.compile(r'^§(\d+[A-Z]?)-(\d+[A-Za-z0-9.\-]*?)\.\s+(.*)$')
FOOT = re.compile(r'^\s*Oklahoma Statutes - Title .*Page \d+\s*$')
HIST = re.compile(r'^(?:Added by|Amended by|From |Laws |R\.L\.|St\.Supp|Renumbered|Repealed|Codified|Formerly|Source:|Derived)', re.I)

# Term families. STRONG = unmistakable Indian law phrases. WEAK = any other Native signal worth a reader's look.
STRONG = re.compile(r"\bIndian (?:tribes?|nations?|country|reservations?|child(?:ren)?|lands?|allotments?|affairs|trust|gaming|health|education|territory)\b"
                    r"|\bfederally[- ]recognized (?:Indian )?(?:tribes?|nations?|bands?)\b|\btribal (?:governments?|courts?|nations?|lands?|members(?:hip)?|councils?|gaming|compacts?|police|law enforcement|jurisdiction|sovereign)"
                    r"|\b(?:Native American|American Indian|Alaska Native)s?\b|\bIndian Child Welfare\b|\bFive Civilized Tribes\b|\bInter-?Tribal\b"
                    r"|\b(?:Bureau|Commissioner) of Indian Affairs\b|\btribal-state\b|\bstate-tribal\b|\btribe(?:s)? of Indians\b|\bIndian Gaming Regulatory\b", re.I)
WEAK = re.compile(r"\bIndians?\b|\btribes?\b|\btribal(?:ly)?\b|\bNative\b|\bsovereign nations?\b|\bNation\b|\brestricted (?:lands?|Indian|heirs?|allottees?)\b|\ballot(?:ted|tee|ment)s?\b|\breservations?\b"
                  r"|\b(?:Cherokee|Choctaw|Chickasaw|Muscogee|Creek Nation|Seminole Nation|Osage Nation|Osage Minerals|Osage tribe|Kiowa|Comanche|Apache|Caddo|Delaware|Wichita|Pawnee|Ponca|Otoe|Sac and Fox|Potawatomi|Shawnee|Quapaw|Kickapoo|Cheyenne|Arapaho|Kaw|Tonkawa|Seneca|Wyandotte|Modoc|Ottawa|Peoria|Miami|Iowa Tribe|Euchee|Yuchi|Chickasaw)\b", re.I)
COUNTY = re.compile(r"\b(?:Cherokee|Choctaw|Creek|Seminole|Osage|Delaware|Kiowa|Comanche|Caddo|Pawnee|Ottawa|Kay|Seminole|Pottawatomie|Cimarron|Muskogee)\s+(?:County|counties)\b", re.I)


def sections(path):
    title = path.stem[2:]
    lines = path.read_text(errors='replace').splitlines()
    # The table of contents lines end in dot leaders and a page number; the body starts at the first heading with no leader.
    cur = None
    for ln in lines:
        if FOOT.match(ln):
            continue
        m = HEAD.match(ln)
        if m and not re.search(r'\.{5,}\s*\d+\s*$', ln):
            if cur: yield cur
            cur = {'title': m.group(1), 'section': m.group(2), 'heading': m.group(3).strip(), 'lines': []}
            continue
        if cur is not None:
            # Chapter tables of contents sit between sections: entries end in dot leaders and a page number, and wrapped entries are indented.
            if re.search(r'\.{5,}\s*\d+\s*$', ln) or re.match(r'^\s*§\d+[A-Z]?-\S+\.\s', ln):
                continue
            cur['lines'].append(ln.rstrip())
    if cur: yield cur


def main(txt_dir, out):
    n = 0
    with open(out, 'w') as f:
        for p in sorted(pathlib.Path(txt_dir).glob('os*.txt')):
            for s in sections(p):
                body = s.pop('lines')
                # The heading can wrap onto the first line(s) until the first indented body line.
                while body and body[0] and not body[0].startswith('    ') and not HIST.match(body[0]):
                    s['heading'] += ' ' + body.pop(0).strip()
                hist = [l for l in body if HIST.match(l.strip())]
                text = re.sub(r'\s+', ' ', ' '.join(body)).strip()
                status = 'live'
                if re.match(r'^(Repealed|Renumbered|Expired|Superseded)\b', s['heading'], re.I): status = re.match(r'^(\w+)', s['heading']).group(1).lower()
                full = s['heading'] + ' ' + text
                full_nocounty = COUNTY.sub(' ', full)
                s.update(cite=f"{s['title']} O.S. § {s['section']}", status=status, words=len(text.split()),
                         strong=sorted({m.group(0).lower() for m in STRONG.finditer(full)}),
                         weak=sorted({m.group(0).lower() for m in WEAK.finditer(full_nocounty)}),
                         history=' '.join(h.strip() for h in hist)[:600], text=text)
                f.write(json.dumps(s) + '\n'); n += 1
    print('sections', n)


if __name__ == '__main__':
    main(*sys.argv[1:])
