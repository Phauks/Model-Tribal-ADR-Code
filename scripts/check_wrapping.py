"""Refuse Markdown that breaks a paragraph across lines by hand.

Rule (docs/style-guide.md, section 7, "Files, encoding and code"): never hard-wrap text. A paragraph, list item, footnote or quotation is one line, however long; editors and browsers wrap it for the reader.

Older files were wrapped by hand before the rule (Trevor, Nov. 22, 2026). Until one pass unwraps them, the check fails only on wrapped paragraphs that a pull request adds or changes, and counts the rest as warnings, like the record lint (decision record 0014).

Run from the repository root:
  python3 scripts/check_wrapping.py --base origin/main   # fail on what this branch adds or changes
  python3 scripts/check_wrapping.py                      # report every wrapped paragraph, never fail
Uses only the Python standard library.
"""

import argparse
import pathlib
import re
import subprocess
import sys

# A line that starts a new block rather than continuing the paragraph above it.
NEW_BLOCK = re.compile(
    r"""^\s*(
        \#{1,6}\s            # heading
      | [-*+]\s              # bulleted list item
      | \d+[.)]\s            # numbered list item
      | \|                   # table row
      | ```|~~~              # code fence
      | <                    # HTML
      | \[\^[^\]]+\]:        # footnote definition
      | \[[^\]]+\]:\s        # link reference definition
      | (-{3,}|\*{3,}|_{3,})\s*$   # thematic break or front matter
      | :                    # definition list
    )""",
    re.VERBOSE,
)


def tracked_markdown() -> list[pathlib.Path]:
    listing = subprocess.run(["git", "ls-files", "-z", "*.md"], check=True, capture_output=True).stdout.decode("utf-8")
    return [pathlib.Path(name) for name in listing.split("\0") if name and not name.startswith("LICENSES/")]


def unquoted(line: str) -> tuple[int, str]:
    """Returns how many > markers start the line, and the line without them."""
    depth = 0
    rest = line
    while True:
        match = re.match(r"\s{0,3}>\s?", rest)
        if not match:
            return depth, rest
        depth += 1
        rest = rest[match.end():]


def wrapped_lines(text: str) -> list[int]:
    """Returns the 1-based numbers of lines that continue a paragraph from the line above."""
    lines = text.split("\n")
    found = []
    in_code = False
    in_front_matter = bool(lines) and lines[0].strip() == "---"
    for index in range(1, len(lines)):
        above, line = lines[index - 1], lines[index]
        if in_front_matter:
            if line.strip() == "---":
                in_front_matter = False
            continue
        if re.match(r"^\s*(```|~~~)", above):
            in_code = not in_code
        if in_code:
            continue
        above_depth, above_text = unquoted(above)
        depth, text_here = unquoted(line)
        if depth != above_depth or not above_text.strip() or not text_here.strip():
            continue
        if re.match(r"^\s*(#{1,6}\s|\||```|~~~|<|(-{3,}|\*{3,}|_{3,})\s*$)", above_text):
            continue
        if above_text.endswith("  ") or above_text.endswith("\\"):
            continue  # a deliberate line break, such as in an address
        if NEW_BLOCK.match(text_here):
            continue
        found.append(index + 1)
    return found


def changed_lines(base: str) -> dict[pathlib.Path, set[int]]:
    """Returns, for each Markdown file, the line numbers this branch adds or changes since base."""
    diff = subprocess.run(
        ["git", "diff", "--unified=0", "--no-color", f"{base}...HEAD", "--", "*.md"],
        check=True,
        capture_output=True,
    ).stdout.decode("utf-8")
    changed: dict[pathlib.Path, set[int]] = {}
    current = None
    for row in diff.split("\n"):
        if row.startswith("+++ "):
            current = None if row == "+++ /dev/null" else pathlib.Path(row[6:])
            if current is not None:
                changed.setdefault(current, set())
        elif row.startswith("@@") and current is not None:
            match = re.search(r"\+(\d+)(?:,(\d+))?", row)
            start, count = int(match.group(1)), int(match.group(2) or "1")
            changed[current].update(range(start, start + count))
    return changed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--base", help="fail only on wrapped paragraphs changed since this commit")
    arguments = parser.parse_args()

    changed = changed_lines(arguments.base) if arguments.base else None
    failures = []
    older = 0
    for path in tracked_markdown():
        if not path.exists():
            continue
        lines = wrapped_lines(path.read_text(encoding="utf-8"))
        for number in lines:
            # A wrap is new if either of the two lines it joins was added or changed.
            if changed is not None and path in changed and ({number, number - 1} & changed[path]):
                failures.append(f"{path}:{number}: this line continues the paragraph above; join them into one line")
            else:
                older += 1

    for failure in failures:
        print(failure)
    if older:
        print(f"Note: {older} older wrapped lines remain from before the rule; they will be unwrapped in one pass.")
    if failures:
        print(f"{len(failures)} wrapped lines added or changed. Write each paragraph, list item and footnote as one line (docs/style-guide.md, section 7).")
        return 1
    print("No newly wrapped Markdown.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
