"""Flag prose habits that style guide section 8 asks writers to justify.

Reads Markdown under content/ and docs/ and reports, as warnings only:
watch-list words, "serves as" and similar stand-ins for "is", trailing
claims of significance, vague attributions, reflexive "not X but Y"
frames, dashes, and sentences longer than the limit. The rules and their
sources are in docs/style-guide.md, section 8 ("Sound and rhythm").

Text inside quotation marks is not checked for words, since it is a
source's own wording, and the style guide itself is skipped because it
lists the patterns. This never fails a pull request. A flag is a prompt to reread the
sentence, not a verdict: each listed word is fine when it is the most
exact word, and quotations are often flagged.

Usage:
  python3 scripts/check_prose.py                         # every file
  python3 scripts/check_prose.py --base origin/main      # lines a pull request adds
  python3 scripts/check_prose.py docs/charter.md         # named files
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FOLDERS = ("content", "docs")
LONG_SENTENCE = 40  # words; project choice, see style guide section 2 and 8

CHECKS = [
    ("watch-list word", re.compile(
        r"\b(delve[sd]?|delving|pivotal|crucial|underscor\w*|showcas\w*|foster(s|ed|ing)?|tapestry|testament"
        r"|vibrant|landscape|intricate|intricacies|enduring|bolster\w*|meticulous\w*|interplay)\b", re.I)),
    ("stand-in for \"is\" or \"has\"", re.compile(
        r"\b(serves? as|served as|stands? as|stood as|boasts?|boasted)\b", re.I)),
    ("claim of significance", re.compile(
        r",\s+(highlighting|underscoring|reflecting|symbolizing|emphasizing|showcasing)\b"
        r"|\ba (pivotal|key|significant|crucial|vital) (role|moment|turning point)\b"
        r"|\b(reflects|marks|represents) a (broader|significant) (shift|trend|movement)\b", re.I)),
    ("vague attribution", re.compile(
        r"\b(experts|observers|critics|commentators|many scholars) (argue|note|say|suggest|have noted|agree)\b", re.I)),
    ("\"not X but Y\" frame", re.compile(
        r"\bnot (only|just|merely)\b[^.;:]{0,120}\bbut\b", re.I)),
    ("dash", re.compile("—|–(?=\\s)| -- ")),
]

EXEMPT = {"docs/style-guide.md"}  # lists the patterns as examples
QUOTED = re.compile(r"\"[^\"]*\"|\u201c[^\u201d]*\u201d")
SKIP_LINE = re.compile(r"^\s*(\||```|<!--|\[\^[^\]]+\]:|---\s*$|[a-z_]+:\s)")


def changed_lines(base):
    """Map each changed Markdown file to the set of line numbers the diff adds."""
    diff = subprocess.run(
        ["git", "diff", "--unified=0", "--no-color", f"{base}...HEAD", "--", *FOLDERS],
        cwd=ROOT, capture_output=True, text=True, check=True).stdout
    result, current = {}, None
    for line in diff.splitlines():
        if line.startswith("+++ "):
            name = line[6:] if line.startswith("+++ b/") else None
            current = name if name and name.endswith(".md") else None
            if current:
                result.setdefault(current, set())
        elif current and line.startswith("@@"):
            match = re.search(r"\+(\d+)(?:,(\d+))?", line)
            start, count = int(match.group(1)), int(match.group(2) or 1)
            result[current].update(range(start, start + count))
    return result


def all_files():
    return {str(path.relative_to(ROOT)): None
            for folder in FOLDERS for path in sorted((ROOT / folder).rglob("*.md"))}


def strip_markup(text):
    text = re.sub(r"`[^`]*`", "", text)
    text = re.sub(r"\[@[^\]]*\]|\[\^[^\]]*\]", "", text)
    text = re.sub(r"\]\([^)]*\)", "]", text)
    text = re.sub(r"\[\[([^\]|]*\|)?([^\]]*)\]\]", r"\2", text)
    return text


def paragraphs(lines):
    """Yield (first line number, text) for each prose paragraph."""
    in_front_matter = lines[:1] == ["---"]
    in_code, block, start = False, [], 0
    for number, line in enumerate(lines, 1):
        if in_front_matter:
            if number > 1 and line.strip() == "---":
                in_front_matter = False
            continue
        if line.lstrip().startswith("```"):
            in_code = not in_code
            continue
        if in_code or SKIP_LINE.match(line) or line.lstrip().startswith(("#", ">")):
            if block:
                yield start, " ".join(block)
            block = []
            continue
        if not line.strip() or re.match(r"^\s*([-*+]|\d+\.)\s", line):
            if block:
                yield start, " ".join(block)
            block = []
            if not line.strip():
                continue
            line = re.sub(r"^\s*([-*+]|\d+\.)\s+", "", line)
        if not block:
            start = number
        block.append(line.strip())
    if block:
        yield start, " ".join(block)


def check_file(name, wanted):
    lines = (ROOT / name).read_text(encoding="utf-8").splitlines()
    findings = []
    for number, line in enumerate(lines, 1):
        if wanted is not None and number not in wanted:
            continue
        if SKIP_LINE.match(line):
            continue
        prose = QUOTED.sub("", strip_markup(line))  # quotations are the source's words
        for label, pattern in CHECKS:
            for match in pattern.finditer(prose):
                findings.append((number, label, match.group(0).strip()))
    for start, text in paragraphs(lines):
        if wanted is not None and not any(n in wanted for n in range(start, start + text.count(" ") + 1)):
            continue
        for sentence in re.split(r"(?<=[.!?])[\"”)]?\s+(?=[A-Z\"“(])", strip_markup(text)):
            words = len(sentence.split())
            if words > LONG_SENTENCE:
                findings.append((start, f"sentence of {words} words", sentence[:60] + "..."))
    return findings


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base", help="git ref; check only the lines added since it")
    parser.add_argument("files", nargs="*", help="files to check (default: all Markdown in content/ and docs/)")
    arguments = parser.parse_args()
    if arguments.files:
        targets = {name: None for name in arguments.files}
    elif arguments.base:
        targets = changed_lines(arguments.base)
    else:
        targets = all_files()
    annotate = os.environ.get("GITHUB_ACTIONS") == "true"
    total = 0
    for name, wanted in sorted(targets.items()):
        if not (ROOT / name).is_file() or (name in EXEMPT and not arguments.files):
            continue
        for number, label, text in check_file(name, wanted):
            total += 1
            if annotate:
                print(f"::warning file={name},line={number},title=Style guide section 8::{label}: {text}")
            else:
                print(f"{name}:{number}: {label}: {text}")
    print(f"{total} prose flag(s). These are prompts to reread, never failures; "
          "see docs/style-guide.md, section 8.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
