"""Move the parts of each case and law box in the essays onto the source's record.

One-time move (Trevor, decision of Nov. 24, 2026): a case box's Background,
Question, Holding, Quotes, Treatment and Topics are facts about the case, so
they live in the case's record in content/sources/ as `case_box`, and a law
box's summary, quotes and treatment live in the law's record as `law_box`.
An essay keeps only the two-line marker

    :::: case <key>
    ::::

which the website (site/src/lib/essays/record-boxes.ts) and the print build
(pdf/pipeline/record-boxes.mjs) fill from the record. The essay's own
Analysis boxes stay in the essay.

The text moves unchanged: each part is copied character for character, and
each quotation keeps its pinpoint and any parenthetical such as
"(White, J., concurring)". A box that already is a bare marker is left alone,
and a record that already has `case_box` or `law_box` is never overwritten, so running the
script again changes nothing.

Usage: python3 scripts/move_record_boxes.py [essay.md ...]
"""

from __future__ import annotations

import json
import pathlib
import re
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCES = ROOT / "content" / "sources"
PART_ORDERS = {
    "case": ["background", "question", "holding", "quotes", "treatment", "topics"],
    "law": ["summary", "quotes", "treatment"],
}
BOX_OPEN = re.compile(r"^(:{4,})[ \t]*(case|law)[ \t]+([a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*$")
PART_OPEN = re.compile(r"^:::[ \t]*([a-z]+)[ \t]*$")
ATTRIBUTION = re.compile(r"^\[@([a-z0-9]+(?:-[a-z0-9]+)*)(?:,\s*([^\]]*))?\](?:\s*\(([^()]*)\))?$")


def record_path(key: str) -> pathlib.Path:
    first = key[0]
    return SOURCES / (first if "a" <= first <= "z" else "_other") / f"{key}.yaml"


def topics_in(text: str) -> list[str]:
    """As topicsIn in site/src/lib/essays/syntax.ts: semicolons between topics."""
    seen: list[str] = []
    for topic in text.split(";"):
        topic = re.sub(r"\s+", " ", topic).strip()
        topic = re.sub(r"\.$", "", topic)
        if topic and topic not in seen:
            seen.append(topic)
    return seen


def read_quotes(text: str, key: str) -> list[dict]:
    """Each quotation ("> ..." paragraph) and the attribution paragraph after it."""
    paragraphs = [paragraph for paragraph in re.split(r"\n\s*\n", text.strip()) if paragraph.strip()]
    quotes: list[dict] = []
    for index in range(0, len(paragraphs), 2):
        quotation, attribution = paragraphs[index], paragraphs[index + 1] if index + 1 < len(paragraphs) else ""
        lines = quotation.split("\n")
        if not all(line.startswith("> ") for line in lines) or len(lines) != 1:
            raise SystemExit(f"{key}: a quotation is not one '> ' line: {quotation[:60]!r}")
        match = ATTRIBUTION.match(attribution.strip())
        if not match or match.group(1) != key:
            raise SystemExit(f"{key}: a quotation's attribution does not cite the case itself: {attribution!r}")
        quote = {"text": lines[0][2:]}
        if match.group(2):
            quote["pinpoint"] = match.group(2).strip()
        if match.group(3):
            quote["parenthetical"] = match.group(3).strip()
        quotes.append(quote)
    return quotes


def read_box(lines: list[str], key: str, order: list[str]) -> dict:
    """A box's parts, each part's text exactly as written."""
    parts: dict = {}
    index = 0
    while index < len(lines):
        line = lines[index]
        if not line.strip():
            index += 1
            continue
        opening = PART_OPEN.match(line)
        if not opening or opening.group(1) not in order:
            raise SystemExit(f"{key}: unexpected line in the box: {line!r}")
        kind = opening.group(1)
        end = index + 1
        while lines[end].strip() != ":::":
            end += 1
        text = "\n".join(lines[index + 1 : end]).strip("\n")
        if kind in parts:
            raise SystemExit(f"{key}: the box has two {kind} parts")
        if kind == "quotes":
            parts[kind] = read_quotes(text, key)
        elif kind == "topics":
            parts[kind] = topics_in(text)
        else:
            parts[kind] = text
        index = end + 1
    return {kind: parts[kind] for kind in order if kind in parts}


def block_text(text: str, indent: str) -> str:
    if any(line != line.rstrip() for line in text.split("\n")) or "\t" in text:
        raise SystemExit(f"trailing spaces or tabs in {text[:60]!r}")
    return "|-\n" + "\n".join(f"{indent}{line}" if line else "" for line in text.split("\n"))


def as_yaml(field: str, box: dict) -> str:
    """The case_box or law_box block, appended to the record as written (no YAML library rewrites the file)."""
    out = [f"{field}:"]
    for kind, value in box.items():
        if kind == "quotes":
            out.append("  quotes:")
            for quote in value:
                out.append(f"  - text: {json.dumps(quote['text'], ensure_ascii=False)}")
                for field in ("pinpoint", "parenthetical"):
                    if field in quote:
                        out.append(f"    {field}: {json.dumps(quote[field], ensure_ascii=False)}")
        elif kind == "topics":
            out.append("  topics:")
            out.extend(f"  - {json.dumps(topic, ensure_ascii=False)}" for topic in value)
        else:
            out.append(f"  {kind}: {block_text(value, '    ')}")
    return "\n".join(out) + "\n"


def move(essay: pathlib.Path) -> int:
    lines = essay.read_text(encoding="utf-8").split("\n")
    kept: list[str] = []
    moved = 0
    index = 0
    while index < len(lines):
        opening = BOX_OPEN.match(lines[index])
        if not opening:
            kept.append(lines[index])
            index += 1
            continue
        fence, kind, key = opening.group(1), opening.group(2), opening.group(3)
        field = f"{kind}_box"
        end = index + 1
        while lines[end].strip() != fence:
            end += 1
        inside = lines[index + 1 : end]
        kept.extend([lines[index], lines[end]])
        index = end + 1
        if not any(line.strip() for line in inside):
            continue
        path = record_path(key)
        if not path.exists():
            raise SystemExit(f"{essay}: no source record for {kind} box '{key}'")
        record_text = path.read_text(encoding="utf-8")
        if re.search(rf"^{field}:", record_text, re.M):
            raise SystemExit(f"{path}: already has {field}; move the box by hand")
        box = read_box(inside, key, PART_ORDERS[kind])
        block = as_yaml(field, box)
        if yaml.safe_load(block)[field] != box:
            raise SystemExit(f"{key}: the YAML written would not read back as the same text")
        path.write_text(record_text.rstrip("\n") + "\n" + block, encoding="utf-8")
        moved += 1
    essay.write_text("\n".join(kept), encoding="utf-8")
    return moved


def main(arguments: list[str]) -> int:
    essays = [pathlib.Path(argument) for argument in arguments] or sorted((ROOT / "content" / "essays").glob("*.md"))
    for essay in essays:
        count = move(essay)
        if count:
            print(f"{essay.relative_to(ROOT)}: moved {count} boxes")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
