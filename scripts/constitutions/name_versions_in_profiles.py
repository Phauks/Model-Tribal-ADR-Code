"""Name the constitution version that existing profile facts describe.

Profile facts written before the version histories cite the University of
Oklahoma and other copies of older constitutions. Those facts describe the
older text on purpose (their notes say so), so this script adds the version
they cite as `document_version` beside their `source`, which tells readers and
the record lint (`superseded-citation`) that the fact is about that version.
It edits the lines in place and leaves the rest of each profile untouched.

Usage: python3 scripts/constitutions/name_versions_in_profiles.py
"""

import glob
import re

import yaml


def main():
    versions = {}
    for path in glob.glob("content/documents/*/*-constitution.yaml"):
        with open(path, encoding="utf-8") as handle:
            history = yaml.safe_load(handle)
        for version in history["versions"]:
            if version["status"] in ("superseded", "unknown"):
                versions[version["source"]] = (history["id"], version["id"])
    changed = 0
    for path in sorted(glob.glob("content/tribes/*/*.yaml")):
        with open(path, encoding="utf-8") as handle:
            lines = handle.read().split("\n")
        out = []
        index = 0
        touched = False
        while index < len(lines):
            line = lines[index]
            out.append(line)
            match = re.match(r"^(\s*)source: (\S+)\s*$", line)
            if match and match.group(2) in versions:
                indent = match.group(1)
                # Skip if the fact already names a version.
                following = lines[index + 1: index + 12]
                block = []
                for next_line in following:
                    width = len(next_line) - len(next_line.lstrip())
                    if next_line.strip() and width >= len(indent) and not next_line.lstrip().startswith("- ") or (
                        next_line.strip() and width > len(indent)
                    ):
                        block.append(next_line)
                    else:
                        break
                if not any(item.strip().startswith("document_version:") for item in block):
                    document, version = versions[match.group(2)]
                    out.append(f"{indent}document_version:")
                    out.append(f"{indent}  document: {document}")
                    out.append(f"{indent}  version: {version}")
                    changed += 1
                    touched = True
            index += 1
        if touched:
            with open(path, "w", encoding="utf-8") as handle:
                handle.write("\n".join(out))
    print(f"{changed} facts now name the version they describe")


if __name__ == "__main__":
    main()
