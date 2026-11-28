#!/usr/bin/env python3
"""Our own reading of a scan, checked word by word against the other readings
of the same pages (thread "Put full document text on the site", Nov. 28, 2026;
Trevor: "couldn't we run ocr with multiple passes or models and do something
similar so we don't have to rely upon external forces").

Readings:
  ours        tesseract on each page of the scan at 300 dpi (the base text)
  layer       the scan's own text layer (pdftotext), when it has one
  others      any other texts of the same document, such as the Caselaw
              Access Project's opinion text (--other, repeatable)

The vote: the texts are lined up word by word with the base (difflib on the
words' plain letters). A base word that is not an English word (wordfreq) is
replaced when another reading has, in the same place, a word that is; and
any base word is replaced when every other reading agrees on the same other
word and that word is an English word. Every change is written to a log with
its page, so a reader can check it against the scan. Words no reading reads
as an English word are listed as unsettled, for a later look (Haiku with the
page image, or a person).

Usage:
  python3 scripts/law/ocr_vote.py SCAN.pdf --other OTHER.html [--other OTHER.txt] --out DIR [--pages 1-25]
"""
from __future__ import annotations

import argparse
import difflib
import html
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

from wordfreq import zipf_frequency

TOKEN = re.compile(r"\S+")
CORE = re.compile(r"[A-Za-z]+(?:['’-][A-Za-z]+)*")


def plain(token: str) -> str:
    found = CORE.search(token)
    return found.group(0).lower() if found else ""


def is_word(token: str) -> bool:
    core = plain(token)
    return bool(core) and (len(core) <= 2 or zipf_frequency(core.replace("’", "'"), "en") > 0)


def close(token: str, other: str) -> bool:
    """Whether another reading's word looks like a misreading of this one: nearly the same letters, nearly the same length."""
    one, two = plain(token), plain(other)
    return len(CORE.findall(other)) == 1 and len(two) >= 3 and abs(len(one) - len(two)) <= 2 and difflib.SequenceMatcher(None, one, two).ratio() >= 0.6


def page_count(pdf: Path) -> int:
    info = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True).stdout
    return int(re.search(r"^Pages:\s+(\d+)", info, re.M).group(1))


def our_reading(pdf: Path, page: int, folder: Path) -> str:
    image = folder / f"page-{page}"
    subprocess.run(["pdftoppm", "-r", "300", "-gray", "-f", str(page), "-l", str(page), "-singlefile", str(pdf), str(image)], check=True)
    run = subprocess.run(["tesseract", f"{image}.pgm", "-", "-l", "eng", "--psm", "3"], capture_output=True, text=True,
                         env={**os.environ, "OMP_THREAD_LIMIT": "1"})
    (folder / f"page-{page}.pgm").unlink(missing_ok=True)
    return run.stdout


def layer_reading(pdf: Path, page: int) -> str:
    return subprocess.run(["pdftotext", "-f", str(page), "-l", str(page), str(pdf), "-"], capture_output=True, text=True).stdout


def text_of(path: Path) -> str:
    text = path.read_text(encoding="utf-8", errors="replace")
    if path.suffix.lower() in (".html", ".htm"):
        text = re.sub(r"(?is)<(script|style|header)\b.*?</\1>", " ", text)
        text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    return text


def aligned(base: list[str], other: list[str]) -> dict[int, str]:
    """For each base word position, the other reading's word in the same place, when the two line up one for one."""
    matcher = difflib.SequenceMatcher(None, [plain(token) for token in base], [plain(token) for token in other], autojunk=False)
    found: dict[int, str] = {}
    for tag, a1, a2, b1, b2 in matcher.get_opcodes():
        if tag in ("equal", "replace") and a2 - a1 == b2 - b1:
            for offset in range(a2 - a1):
                found[a1 + offset] = other[b1 + offset]
    return found


def vote(base_text: str, others: list[list[str]]) -> tuple[str, list[dict], list[str]]:
    lines = base_text.split("\n")
    flat: list[tuple[int, int, str]] = []
    for line_number, line in enumerate(lines):
        for match in TOKEN.finditer(line):
            flat.append((line_number, match.start(), match.group(0)))
    base = [token for _, _, token in flat]
    maps = [aligned(base, other) for other in others]
    changes, unsettled = [], []
    replaced = list(base)
    # Words split across lines ("territo-" / "ries") are left as printed: each half is not a word on its own.
    split = set()
    for index, (line_number, _, token) in enumerate(flat):
        if token.endswith("-") and index + 1 < len(flat) and flat[index + 1][0] != line_number:
            split.update({index, index + 1})
    for index, token in enumerate(base):
        if index in split or len(CORE.findall(token)) != 1:
            continue
        candidates = [found[index] for found in maps if index in found]
        if candidates and all(plain(candidate) == plain(token) for candidate in candidates):
            continue  # every reading agrees: a name, a Latin or old word, not a misreading
        alternatives = [candidate for candidate in candidates if plain(candidate) and plain(candidate) != plain(token)]
        choice = None
        if plain(token) and not is_word(token):
            words = [candidate for candidate in alternatives if is_word(candidate) and close(token, candidate)]
            if words:
                choice = max(set(words), key=words.count)
            elif not any(is_word(candidate) for candidate in candidates):
                unsettled.append(token)
        elif alternatives and len(alternatives) == len(maps) >= 2 and len({plain(c) for c in alternatives}) == 1 and is_word(alternatives[0]) and close(token, alternatives[0]):
            choice = alternatives[0]
        if choice:
            core_old, core_new = CORE.search(token), CORE.search(choice)
            word = core_new.group(0) if core_new else choice
            if core_old:
                # Keep the base's capitals (a small-caps heading read as "Inprans" stays "Indians"), not the other reading's.
                old_core = core_old.group(0)
                word = word.upper() if old_core.isupper() and len(old_core) > 1 else word.capitalize() if old_core[0].isupper() else word.lower()
            new = token[: core_old.start()] + word + token[core_old.end():] if core_old else choice
            replaced[index] = new
            changes.append({"was": token, "now": new, "readings": candidates})
    out_lines = [list(line) for line in lines]
    for (line_number, start, token), new in sorted(zip(flat, replaced), key=lambda item: (-item[0][0], -item[0][1])):
        if new != token:
            out_lines[line_number][start:start + len(token)] = list(new)
    return "\n".join("".join(line) for line in out_lines), changes, unsettled


def misread_share(text: str) -> float:
    words = [token for token in TOKEN.findall(text) if len(plain(token)) >= 3 and plain(token).islower() and token[:1].islower()]
    return sum(1 for token in words if not is_word(token)) / max(len(words), 1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("scan")
    parser.add_argument("--other", action="append", default=[])
    parser.add_argument("--out", required=True)
    parser.add_argument("--pages")
    args = parser.parse_args()
    pdf, out = Path(args.scan), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    total = page_count(pdf)
    first, last = (int(part) for part in args.pages.split("-")) if args.pages else (1, total)
    other_words = [TOKEN.findall(text_of(Path(path))) for path in args.other]
    pages_out, log, unsettled_all = [], [], []
    before_ours, before_layer = [], []
    with tempfile.TemporaryDirectory() as folder:
        for page in range(first, last + 1):
            ours = our_reading(pdf, page, Path(folder))
            layer = layer_reading(pdf, page)
            before_ours.append(ours)
            before_layer.append(layer)
            readings = [TOKEN.findall(layer)] + other_words
            text, changes, unsettled = vote(ours, [reading for reading in readings if reading])
            pages_out.append(text)
            log.extend({"page": page, **change} for change in changes)
            unsettled_all.extend({"page": page, "word": word} for word in unsettled)
    final = "\f".join(pages_out)
    (out / "voted.txt").write_text(final, encoding="utf-8")
    (out / "ours.txt").write_text("\f".join(before_ours), encoding="utf-8")
    (out / "changes.json").write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "unsettled.json").write_text(json.dumps(unsettled_all, ensure_ascii=False, indent=1), encoding="utf-8")
    report = {
        "pages": last - first + 1,
        "misread_share": {"layer": round(misread_share("\n".join(before_layer)), 4), "ours": round(misread_share("\n".join(before_ours)), 4),
                          "voted": round(misread_share(final), 4)},
        "others": {path: round(misread_share(text_of(Path(path))), 4) for path in args.other},
        "changes": len(log), "unsettled": len(unsettled_all),
    }
    (out / "report.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
