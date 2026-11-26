"""Name matching shared by the signer count and the repeat signer pages: letters-only names, sound keys, English renderings and nation families."""
import difflib, re, unicodedata

def ascii(s): return unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode()
JUNK = re.compile(r"\b(his|her)\s*x?\s*mark\b|\[?\s*(seal|l\.?\s*s)\s*\.?\]?|\bx\b", re.I)
def core(s): return re.sub(r'[^a-z]', '', ascii(JUNK.sub(' ', s)).lower())
def phon(s):
    s = core(s)
    for a, b in [('ph', 'f'), ('ck', 'k'), ('qu', 'kw'), ('c', 'k'), ('q', 'k'), ('x', 'ks'), ('gh', 'g'), ('tch', 'ch'), ('sh', 'S'), ('ch', 'C'), ('ee', 'i'), ('oo', 'u'), ('ou', 'u'), ('y', 'i'), ('w', 'u'), ('v', 'b'), ('z', 's'), ('d', 't'), ('g', 'k'), ('p', 'b')]:
        s = s.replace(a, b)
    s = re.sub(r'([aeiou])h', r'\1', s)
    s = re.sub(r'(.)\1+', r'\1', s)
    return s
ENGSTOP = {'the', 'a', 'an', 'or', 'of', 'his', 'her', 'mark', 'x'}
def eng(s):
    w = [x.rstrip('s') for x in re.findall(r'[a-z]+', ascii(s).lower()) if x not in ENGSTOP]
    return ' '.join(w)

FAMILIES = {
 'sioux': 'sioux yankton yanktonai yancton oglala ogallalah hunkpapa uncpapa teton santee santie mdewakanton medaywakanton wahpekuta wahpekute wahpeton wahpaton sisseton sissiton brule miniconjou minneconjou kettle arc arcs cuthead dakota sioune',
 'chippewa': 'chippewa chippeway chipewa ojibwe pillager pembina mississippi superior winnibigoshish saginaw ontonagon flambeau pointe',
 'pawnee': 'pawnee pawnees', 'osage': 'osage osages', 'sac and fox': 'sac sacs sauk sauks fox foxes', 'ottawa': 'ottawa ottawas ottoway',
 'potawatomi': 'potawatomi potawatomie pottawatomie potawatamie', 'shoshoni': 'shoshoni shoshone shoshonee goship', 'ute': 'ute utah utes tabeguache muache capote weeminuche yampa uintah',
 'seneca': 'seneca seneka senecas tonawanda', 'oneida': 'oneida oneidea oneidas', 'miami': 'miami miamis miamies', 'wea': 'wea weas', 'piankashaw': 'piankishaw piankeshaw piankashaw',
 'delaware': 'delaware delawares', 'shawnee': 'shawnee shawanee shawanoe shawnese', 'wyandot': 'wyandot wyandots wyandott', 'kickapoo': 'kickapoo kickapoos',
 'creek': 'creek creeks muscogee muskogee', 'cherokee': 'cherokee cherokees', 'choctaw': 'choctaw choctaws', 'chickasaw': 'chickasaw chickasaws', 'seminole': 'seminole seminoles',
 'winnebago': 'winnebago winnebagoe', 'menominee': 'menominee menomonee menomonie', 'iowa': 'iowa ioway iowas', 'otoe': 'otoe ottoe ottoes otto', 'missouri': 'missouri missouria',
 'kansa': 'kansa kanza kanzas kansas', 'cheyenne': 'cheyenne cheyennes', 'arapaho': 'arapaho arapahoe arapahoes', 'comanche': 'comanche comanches', 'kiowa': 'kiowa kioway',
 'apache': 'apache apaches', 'omaha': 'omaha omahas maha mahas', 'ponca': 'ponca poncas', 'quapaw': 'quapaw quapaws', 'kaskaskia': 'kaskaskia kaskaskias', 'peoria': 'peoria peorias',
 'stockbridge': 'stockbridge', 'munsee': 'munsee munsees', 'crow': 'crow crows', 'blackfeet': 'blackfeet piegan blood', 'nez perce': 'nez perce', 'navajo': 'navajo navajoe',
}
FAMWORD = {w: f for f, ws in FAMILIES.items() for w in ws.split()}
FAMLIST = list(FAMWORD)
WORDSTOP = set('of the and tribe tribes nation nations band bands indians indian confederated on part behalf said united chiefs chief head men headmen warriors great little upper lower in by for river lake'.split())
def fams(s):
    out = set()
    for w in re.findall(r'[a-z]+', ascii(s).lower()):
        if w in WORDSTOP or len(w) < 3: continue
        if w in FAMWORD: out.add(FAMWORD[w]); continue
        m = difflib.get_close_matches(w, FAMLIST, 1, 0.8)
        if m: out.add(FAMWORD[m[0]])
    return out
def tagfam(tag):
    f = fams(tag)
    return f or {ascii(tag).lower()}

