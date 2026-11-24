import csv, re, os, sys, json
rows = list(csv.DictReader(open(sys.argv[1])))
src = sys.argv[2]; out = sys.argv[3]; os.makedirs(out, exist_ok=True)
inst = re.compile(r"\b(UNITED STATES|STATE OF|STATE|COUNTY|COMMISSION|TRIBES?|NATIONS?|INDIANS|BAND|COMPANY|CO\.|CORP|RAILROAD|RAILWAY|BANK|COMMUNITY|SECRETARY|BOARD|CITY|TOWN|DEPARTMENT|PUEBLO|COMMISSIONER|TERRITORY|DISTRICT|AUTHORITY|INC|ASSOCIATION|TRUST|CORPORATION|SCHOOL|CONFEDERATED|LLC|LTD|COMPANIES|GALLONS|WHISKEY|COLLECTOR|COURT|COUNCIL|VILLAGE|BUSINESS COMMITTEE|SHERIFF|WARDEN|AUDITOR|TREASURER|LESSEE|OLD SETTLERS|IRON|STEEL|LAND OFFICE)\b", re.I)
states = "ALABAMA ALASKA ARIZONA ARKANSAS CALIFORNIA COLORADO CONNECTICUT FLORIDA GEORGIA IDAHO KANSAS MAINE MASSACHUSETTS MICHIGAN MINNESOTA MISSISSIPPI MONTANA NEBRASKA NEVADA OKLAHOMA OREGON TENNESSEE TEXAS UTAH WASHINGTON WISCONSIN WYOMING".split()
cands = []
for r in rows:
    m = re.match(r'(\d+) U\.S\. (\d+)$', r['citation'].strip())
    if not m: continue
    v, p = int(m.group(1)), int(m.group(2))
    txt = f"{src}/{v}-{p}.txt"
    if not os.path.exists(txt): continue
    name = r['case_name']
    parts = re.split(r'\s+v[s]?\.\s+', re.sub(r'^(EX PARTE|IN RE|MATTER OF)\s+', '', name, flags=re.I))
    people = [x.strip(' ,.') for x in parts if x.strip(' ,.') and not inst.search(x) and x.strip(' ,.').upper() not in states and not x.upper().startswith(('NEW ','NORTH ','SOUTH ','WEST ','RHODE'))]
    if not people: continue
    pages = open(txt, errors='ignore').read().split('\f')
    keep = list(range(min(5, len(pages)))) + [i for i in range(max(5, len(pages)-2), len(pages))]
    body = "\n".join(f"\n=== PAGE {v} U.S. {p+i} ===\n{pages[i]}" for i in keep)
    fn = f"{out}/{v}-{p}.txt"
    open(fn, 'w').write(f"CASE: {name}\nCITATION: {v} U.S. {p} ({r['term']})\nSCDB: {r['scdb_case_id']}\nDECIDED: {r['decided']}\nCAPTION PEOPLE: {people}\n" + body)
    cands.append({"cite": f"{v} U.S. {p}", "file": fn, "name": name, "term": r['term'], "people": people, "pages": len(pages)})
json.dump(cands, open(f"{out}/candidates.json", 'w'), indent=1)
print(len(cands), sum(len(c['people']) for c in cands), sum(min(7, c['pages']) for c in cands))
