"""Check that every text file in the repository follows the encoding rules.

Rules (docs/style-guide.md, section 7, "Files, encoding and code"):
  - UTF-8, without a byte order mark
  - Unicode Normalization Form C (NFC)
  - LF line endings, and a final newline

Run from the repository root:  python3 scripts/check_text.py
Uses only the Python standard library. Exits with status 1 on any problem.
"""

import pathlib
import subprocess
import sys
import unicodedata

TEXT_SUFFIXES = {
    ".md", ".yaml", ".yml", ".json", ".txt", ".py", ".ts", ".js", ".mjs",
    ".svelte", ".css", ".html", ".typ", ".csl", ".xml", ".toml", ".svg",
}
TEXT_NAMES = {"CODEOWNERS", ".editorconfig", ".gitignore", "version.txt"}


def tracked_files() -> list[pathlib.Path]:
    listing = subprocess.run(
        ["git", "ls-files", "-z"], check=True, capture_output=True
    ).stdout.decode("utf-8")
    return [pathlib.Path(name) for name in listing.split("\0") if name]


def is_text(path: pathlib.Path) -> bool:
    if path.parts and path.parts[0] == "LICENSES":
        return False  # license texts are kept exactly as published
    return path.suffix in TEXT_SUFFIXES or path.name in TEXT_NAMES


def problems_in(path: pathlib.Path) -> list[str]:
    raw = path.read_bytes()
    found = []
    if raw.startswith(b"\xef\xbb\xbf"):
        found.append("starts with a byte order mark")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as error:
        return [f"is not valid UTF-8 (byte {error.start})"]
    if not unicodedata.is_normalized("NFC", text):
        for line_number, line in enumerate(text.splitlines(), start=1):
            if not unicodedata.is_normalized("NFC", line):
                found.append(f"line {line_number} is not in Unicode Normalization Form C")
                break
    if "\r" in text:
        found.append("uses CR or CRLF line endings instead of LF")
    if text and not text.endswith("\n"):
        found.append("does not end with a newline")
    return found


def main() -> int:
    failures = 0
    for path in tracked_files():
        if not is_text(path) or not path.is_file():
            continue
        for problem in problems_in(path):
            print(f"{path}: {problem}")
            failures += 1
    if failures:
        print(f"\n{failures} problem(s). To fix normalization, run: python3 scripts/check_text.py --help")
        return 1
    print("All text files are UTF-8, NFC, LF, with a final newline.")
    return 0


if __name__ == "__main__":
    if "--help" in sys.argv:
        print(__doc__)
        print("To normalize a file to NFC in Python:\n"
              "  text = unicodedata.normalize('NFC', path.read_text('utf-8'))")
        sys.exit(0)
    sys.exit(main())
