"""Check a built cover PDF against Lulu's cover requirements.

Usage:  python3 -I pdf/tools/check_cover.py cover.pdf cover-layout.json

Checks (Lulu, Book Creation Guide, p. 25, and "Casewrap Books: The Basics"):
  - a single page: the back cover, spine and front cover in one spread
  - the page is the spread size in cover-layout.json
  - not password protected
  - every font is embedded
  - every character on a cover sits inside that cover's safe area, and
    every character on the spine sits inside the spine's safe area
Prints a JSON summary. Exits with status 1 if a check fails.
Requires the packages in pdf/requirements.txt.
"""

import json
import sys

import pypdfium2
from pypdf import PdfReader

POINTS_PER_INCH = 72
TOLERANCE = 0.01 * POINTS_PER_INCH


def fonts_in(resources, found):
    resources = resources.get_object() if resources is not None else None
    if not resources:
        return
    fonts = resources.get("/Font")
    for font in (fonts.get_object().values() if fonts else []):
        font = font.get_object()
        descendants = font.get("/DescendantFonts")
        target = descendants.get_object()[0].get_object() if descendants else font
        descriptor = target.get("/FontDescriptor")
        name = str(target.get("/BaseFont", font.get("/BaseFont")))
        embedded = bool(descriptor) and any(key in descriptor.get_object() for key in ("/FontFile", "/FontFile2", "/FontFile3"))
        found[name] = found.get(name, True) and embedded
    xobjects = resources.get("/XObject")
    for xobject in (xobjects.get_object().values() if xobjects else []):
        xobject = xobject.get_object()
        if xobject.get("/Subtype") == "/Form":
            fonts_in(xobject.get("/Resources"), found)


def inside(box, area, height):
    """Is a PDFium character box (points, origin bottom left) inside an area (inches, origin top left)?"""
    left, bottom, right, top = box
    area_left = area["x"] * POINTS_PER_INCH
    area_top = height - area["y"] * POINTS_PER_INCH
    area_right = area_left + area["width"] * POINTS_PER_INCH
    area_bottom = area_top - area["height"] * POINTS_PER_INCH
    return (
        left >= area_left - TOLERANCE
        and right <= area_right + TOLERANCE
        and bottom >= area_bottom - TOLERANCE
        and top <= area_top + TOLERANCE
    )


def main() -> int:
    pdf_path, layout_path = sys.argv[1], sys.argv[2]
    with open(layout_path, encoding="utf-8") as handle:
        layout = json.load(handle)
    failures: list[str] = []
    reader = PdfReader(pdf_path)
    if reader.is_encrypted:
        failures.append("the PDF is password protected")
    if len(reader.pages) != 1:
        failures.append(f"the cover has {len(reader.pages)} pages; Lulu needs one spread")
    width = layout["width"] * POINTS_PER_INCH
    height = layout["height"] * POINTS_PER_INCH
    box = reader.pages[0].mediabox
    if abs(float(box.width) - width) > TOLERANCE or abs(float(box.height) - height) > TOLERANCE:
        failures.append(f"the page is {float(box.width):.2f} x {float(box.height):.2f} pt, expected {width:.2f} x {height:.2f}")
    fonts: dict[str, bool] = {}
    fonts_in(reader.pages[0].get("/Resources"), fonts)
    failures += [f"font {name} is not embedded" for name, embedded in fonts.items() if not embedded]

    areas = {"back cover": layout["safe_back"], "spine": layout["safe_spine"], "front cover": layout["safe_front"]}
    counts = {name: 0 for name in areas}
    outside = 0
    document = pypdfium2.PdfDocument(pdf_path)
    text_page = document[0].get_textpage()
    for index in range(text_page.count_chars()):
        if not text_page.get_text_range(index, 1).strip():
            continue
        character = text_page.get_charbox(index)
        where = next((name for name, area in areas.items() if inside(character, area, height)), None)
        if where:
            counts[where] += 1
        else:
            outside += 1
    if outside:
        failures.append(f"{outside} characters are outside the safe areas of the covers and spine")
    if not counts["front cover"]:
        failures.append("the front cover has no text")
    if counts["spine"] and not layout["spine_text_allowed"]:
        failures.append("the spine has text, but the book is too thin for spine text")

    summary = {
        "binding": layout["binding"],
        "page_size_inches": [layout["width"], layout["height"]],
        "spine_width_inches": layout["spine"]["width"],
        "fonts": sorted(fonts),
        "all_fonts_embedded": all(fonts.values()),
        "characters": counts,
        "failures": failures,
    }
    print(json.dumps(summary, indent=2))
    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
