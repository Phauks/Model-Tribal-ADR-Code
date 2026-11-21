"""Check a built interior PDF against Lulu's print requirements.

Usage:  python3 -I pdf/tools/check_interior.py interior.pdf layout.json

Checks (Lulu, Book Creation Guide and Retail Distribution Guide):
  - not password protected (Book Creation Guide, p. 23)
  - every page is the trim size plus 0.125 in bleed on each side, so the
    file is one page per sheet at the size Lulu expects (Book Creation
    Guide, pp. 10, 11 and 23)
  - every font is embedded (Book Creation Guide, p. 23; Retail
    Distribution Guide, p. 10)
  - only gray is used: no RGB or CMYK color, for standard black-and-white
    ink (Retail Distribution Guide, p. 11: the interior's color must match
    the ink chosen)
  - every character sits inside the 0.5 in safety margin (Book Creation
    Guide, pp. 8 and 23)
  - text keeps Lulu's recommended inside margin for the page count
    (Book Creation Guide, p. 9)
  - no more than two blank pages in a row (Retail Distribution Guide, p. 11)
Prints a JSON summary. Exits with status 1 if a check fails.
Requires the packages in pdf/requirements.txt.
"""

import json
import sys

import pypdfium2
from pypdf import PdfReader
from pypdf.generic import ContentStream

POINTS_PER_INCH = 72
COLOR_OPERATORS = {b"rg", b"RG", b"k", b"K", b"g", b"G", b"cs", b"CS", b"sc", b"SC", b"scn", b"SCN"}


def color_space_is_gray(space) -> bool:
    space = space.get_object() if hasattr(space, "get_object") else space
    if isinstance(space, list):
        kind = str(space[0])
        if kind == "/ICCBased":
            return int(space[1].get_object().get("/N", 0)) == 1
        if kind in ("/Indexed", "/Separation", "/DeviceN"):
            return False
        return kind in ("/DeviceGray", "/CalGray")
    return str(space) in ("/DeviceGray", "/CalGray", "/Pattern")


def color_problems(content, resources, where, seen, problems):
    resources = resources.get_object() if resources is not None else {}
    spaces = resources.get("/ColorSpace", {}) or {}
    spaces = spaces.get_object() if hasattr(spaces, "get_object") else spaces
    if content is not None:
        stream = content if hasattr(content, "operations") else ContentStream(content, None)
        for operands, operator in stream.operations:
            if operator not in COLOR_OPERATORS:
                continue
            if operator in (b"rg", b"RG", b"k", b"K"):
                problems.append(f"{where}: color operator {operator.decode()} (RGB or CMYK)")
            elif operator in (b"cs", b"CS"):
                name = str(operands[0])
                space = spaces.get(name, operands[0])
                if not color_space_is_gray(space):
                    problems.append(f"{where}: color space {name} is not gray")
            elif operator in (b"sc", b"SC", b"scn", b"SCN") and len([o for o in operands if not str(o).startswith("/")]) > 1:
                problems.append(f"{where}: color with {len(operands)} components")
    xobjects = resources.get("/XObject", {}) or {}
    for name, xobject in xobjects.items():
        xobject = xobject.get_object()
        if id(xobject) in seen:
            continue
        seen.add(id(xobject))
        if xobject.get("/Subtype") == "/Image":
            space = xobject.get("/ColorSpace")
            if space is not None and not color_space_is_gray(space):
                problems.append(f"{where}: image {name} is not grayscale")
        elif xobject.get("/Subtype") == "/Form":
            color_problems(xobject, xobject.get("/Resources"), where, seen, problems)


def fonts_in(resources, seen, found):
    resources = resources.get_object() if resources is not None else {}
    for font in (resources.get("/Font", {}) or {}).values():
        font = font.get_object()
        if id(font) in seen:
            continue
        seen.add(id(font))
        name = str(font.get("/BaseFont", "(unnamed)"))
        subtype = font.get("/Subtype")
        if subtype == "/Type3":
            found[name] = True
            continue
        descriptor_owner = font["/DescendantFonts"][0].get_object() if subtype == "/Type0" else font
        descriptor = descriptor_owner.get("/FontDescriptor")
        descriptor = descriptor.get_object() if descriptor is not None else {}
        found[name] = any(key in descriptor for key in ("/FontFile", "/FontFile2", "/FontFile3"))
    for xobject in (resources.get("/XObject", {}) or {}).values():
        xobject = xobject.get_object()
        if xobject.get("/Subtype") == "/Form" and id(xobject) not in seen:
            seen.add(id(xobject))
            fonts_in(xobject.get("/Resources"), seen, found)


def inside_margin_for(page_count: int, rows) -> float:
    for row in rows:
        if row["most_pages"] is None or page_count <= row["most_pages"]:
            return row["inches"]
    raise ValueError("no gutter row")


def main() -> int:
    pdf_path, layout_path = sys.argv[1], sys.argv[2]
    with open(layout_path, encoding="utf-8") as handle:
        layout = json.load(handle)
    failures: list[str] = []
    reader = PdfReader(pdf_path)
    page_count = len(reader.pages)
    if reader.is_encrypted:
        failures.append("the PDF is password protected")

    bleed = layout["bleed"] * POINTS_PER_INCH
    safety = layout["safety_margin"] * POINTS_PER_INCH
    expected_width = layout["page"]["width"] * POINTS_PER_INCH
    expected_height = layout["page"]["height"] * POINTS_PER_INCH

    fonts: dict[str, bool] = {}
    color: list[str] = []
    for number, page in enumerate(reader.pages, start=1):
        box = page.mediabox
        if abs(float(box.width) - expected_width) > 0.01 or abs(float(box.height) - expected_height) > 0.01:
            failures.append(f"page {number} is {float(box.width):.2f} x {float(box.height):.2f} pt, expected {expected_width:.2f} x {expected_height:.2f}")
        fonts_in(page.get("/Resources"), set(), fonts)
        color_problems(page.get_contents(), page.get("/Resources"), f"page {number}", set(), color)
    failures += [f"font {name} is not embedded" for name, embedded in fonts.items() if not embedded]
    failures += color[:20]

    # Character positions, from PDFium.
    gutter = inside_margin_for(page_count, layout["inside_margin_rows"]) * POINTS_PER_INCH
    closest_to_trim = None
    closest_to_spine = None
    blank_run = longest_blank_run = 0
    document = pypdfium2.PdfDocument(pdf_path)
    for index in range(len(document)):
        number = index + 1
        page = document[index]
        text_page = page.get_textpage()
        characters = text_page.count_chars()
        boxes = []
        for character in range(characters):
            if text_page.get_text_range(character, 1).strip():
                boxes.append(text_page.get_charbox(character))
        blank_run = blank_run + 1 if not boxes else 0
        longest_blank_run = max(longest_blank_run, blank_run)
        if not boxes:
            continue
        left = min(box[0] for box in boxes)
        bottom = min(box[1] for box in boxes)
        right = max(box[2] for box in boxes)
        top = max(box[3] for box in boxes)
        to_trim = min(left - bleed, bottom - bleed, expected_width - bleed - right, expected_height - bleed - top)
        closest_to_trim = to_trim if closest_to_trim is None else min(closest_to_trim, to_trim)
        if to_trim < safety - 0.01:
            failures.append(f"page {number}: text is {to_trim / POINTS_PER_INCH:.3f} in from the trim edge, inside the safety margin")
        # Recto (odd) pages bind on the left; verso pages on the right.
        to_spine = (left - bleed) if number % 2 == 1 else (expected_width - bleed - right)
        closest_to_spine = to_spine if closest_to_spine is None else min(closest_to_spine, to_spine)
        # Hanging punctuation may reach into the gutter by the allowance set in
        # book-sizes.yaml; the safety margin check above has no allowance.
        if to_spine < gutter - layout["overhang_allowance"] * POINTS_PER_INCH:
            failures.append(f"page {number}: text is {to_spine / POINTS_PER_INCH:.3f} in from the spine; Lulu recommends {gutter / POINTS_PER_INCH} in")
    if longest_blank_run > 2:
        failures.append(f"{longest_blank_run} blank pages in a row; Lulu allows two")

    summary = {
        "pages": page_count,
        "page_size_points": [round(expected_width, 2), round(expected_height, 2)],
        "fonts": sorted(fonts),
        "all_fonts_embedded": all(fonts.values()),
        "gray_only": not color,
        "closest_text_to_trim_inches": round(closest_to_trim / POINTS_PER_INCH, 3) if closest_to_trim is not None else None,
        "closest_text_to_spine_inches": round(closest_to_spine / POINTS_PER_INCH, 3) if closest_to_spine is not None else None,
        "recommended_inside_margin_inches": gutter / POINTS_PER_INCH,
        "longest_blank_run": longest_blank_run,
        "failures": failures,
    }
    print(json.dumps(summary, indent=2))
    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
