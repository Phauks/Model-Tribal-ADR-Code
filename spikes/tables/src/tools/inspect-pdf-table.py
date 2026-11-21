"""Reports what a PDF's table looks like to a reader and to a printer.

For each PDF given: page count; the structure tags that assistive technology
reads (Table, TR, TH, TD, and how many TH cells carry Scope Row or Column);
and every color space used, to confirm the page is grayscale for Lulu.

Run: python3 -I tools/inspect-pdf-table.py <file.pdf> [...]
Prints JSON.
"""

import collections
import json
import sys

import pypdf
from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject, NameObject


def resolve(value):
    return value.get_object() if isinstance(value, IndirectObject) else value


def walk_structure(node, counts, scopes, seen):
    node = resolve(node)
    if isinstance(node, ArrayObject):
        for child in node:
            walk_structure(child, counts, scopes, seen)
        return
    if not isinstance(node, DictionaryObject):
        return
    if id(node) in seen:
        return
    seen.add(id(node))
    tag = node.get("/S")
    if tag is not None:
        tag = str(tag).lstrip("/")
        counts[tag] += 1
        if tag == "TH":
            attributes = resolve(node.get("/A"))
            attribute_list = attributes if isinstance(attributes, ArrayObject) else [attributes]
            scope = "none"
            for attribute in attribute_list:
                attribute = resolve(attribute)
                if isinstance(attribute, DictionaryObject) and "/Scope" in attribute:
                    scope = str(attribute["/Scope"]).lstrip("/")
            scopes[scope] += 1
    if "/K" in node:
        walk_structure(node["/K"], counts, scopes, seen)


def color_spaces(reader):
    found = collections.Counter()
    for page in reader.pages:
        resources = resolve(page.get("/Resources")) or {}
        spaces = resolve(resources.get("/ColorSpace")) or {}
        for name, space in spaces.items():
            space = resolve(space)
            if isinstance(space, ArrayObject):
                kind = str(space[0])
                if kind == "/ICCBased":
                    components = resolve(space[1]).get("/N")
                    kind = f"/ICCBased with {components} component(s)"
            else:
                kind = str(space)
            found[kind] += 1
        content = page.get_contents()
        data = content.get_data() if content is not None else b""
        for operator in (b" rg", b" RG", b" k", b" K"):
            if operator + b"\n" in data or operator + b" " in data:
                found[f"device color operator{operator.decode()}"] += 1
    return dict(found)


def inspect(path):
    reader = pypdf.PdfReader(path)
    root = reader.trailer["/Root"]
    counts = collections.Counter()
    scopes = collections.Counter()
    tree = resolve(root.get("/StructTreeRoot"))
    if tree is not None:
        walk_structure(tree.get("/K"), counts, scopes, set())
    return {
        "file": path,
        "pages": len(reader.pages),
        "tagged": tree is not None,
        "structure": {tag: counts[tag] for tag in ("Table", "THead", "TBody", "TR", "TH", "TD", "Caption") if counts[tag]},
        "header_cell_scopes": dict(scopes),
        "color_spaces": color_spaces(reader),
    }


if __name__ == "__main__":
    print(json.dumps([inspect(path) for path in sys.argv[1:]], indent=2))
