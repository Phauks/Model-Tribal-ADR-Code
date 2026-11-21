"""Report the colour operators and colour spaces a PDF uses, including inside form XObjects
(Typst places each SVG image in a form XObject). Usage: python3 -I tools/measure_pdf_color.py file.pdf
"""
import re, sys
from pypdf import PdfReader

reader = PdfReader(sys.argv[1])
operators, spaces, transparency = {}, set(), 0

def walk(resources, seen):
    global transparency
    resources = resources or {}
    for name, space in (resources.get("/ColorSpace") or {}).items():
        space = space.get_object()
        if isinstance(space, list) and str(space[0]) == "/ICCBased":
            spaces.add(f"/ICCBased with {space[1].get_object().get('/N')} components ({name})")
        else:
            spaces.add(str(space[0]) if isinstance(space, list) else str(space))
    for state in (resources.get("/ExtGState") or {}).values():
        state = state.get_object()
        if state.get("/SMask") not in (None, "/None") or float(state.get("/ca", 1)) < 1 or float(state.get("/CA", 1)) < 1:
            transparency += 1
    for xobject in (resources.get("/XObject") or {}).values():
        xobject = xobject.get_object()
        if id(xobject) in seen or xobject.get("/Subtype") != "/Form":
            continue
        seen.add(id(xobject))
        yield xobject.get_data().decode("latin-1")
        yield from walk(xobject.get("/Resources"), seen)

for page in reader.pages:
    streams = [page.get_contents().get_data().decode("latin-1")] if page.get_contents() is not None else []
    streams += list(walk(page.get("/Resources"), set()))
    for stream in streams:
        for operator in re.findall(r"(?<![\w.])(?:[\d.]+ ){1,4}(?:rg|RG|g|G|k|K|sc|SC|scn|SCN)\b|/\w+ (?:cs|CS)\b", stream):
            key = re.sub(r"[\d.]+", "n", operator.strip())
            operators[key] = operators.get(key, 0) + 1

print("pages:", len(reader.pages))
print("colour operators (numbers replaced by n):", operators)
print("colour spaces in resources:", sorted(spaces))
print("transparency (soft masks or alpha < 1):", transparency)
