"""Renders chosen PDF pages to PNG for the report.

Run: python3 -I tools/render-pdf-pages.py <file.pdf> <output-prefix> <page numbers, from 1...>
"""

import sys

import pypdfium2

path, prefix, *numbers = sys.argv[1:]
document = pypdfium2.PdfDocument(path)
for number in numbers:
    page = document[int(number) - 1]
    image = page.render(scale=150 / 72).to_pil()
    image.save(f"{prefix}-page-{number}.png")
    print(f"{prefix}-page-{number}.png", image.size)
