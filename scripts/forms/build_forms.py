#!/usr/bin/env python3
"""Build Word (.docx) and PDF copies of the model court forms, with SHA-256 hashes.

Reads content/forms/*.md and content/variables/*.yaml. For each form it:

1. leaves off the YAML front matter and the "Notes for courts adapting this
   form" section, which explain the form and are not part of it;
2. puts each placeholder's model text in place, such as "[Name of Tribal
   Court]" for {{court.name}}, so a court can find and replace it;
3. writes <slug>.docx with pandoc, adds borders and room to write to every
   table, and sets the project's font (Atkinson Hyperlegible Next);
4. writes <slug>.pdf from the .docx with LibreOffice.

Then it writes SHA256SUMS.txt (the format `sha256sum -c` reads) and
checksums.json, so anyone can check a download is the file we built. The
same text always gives the same .docx bytes; LibreOffice stamps each PDF
with the time it was made, so a PDF's hash changes with every build.

Needs pandoc and LibreOffice (soffice) on the PATH. The PDF looks right
only where the Atkinson Hyperlegible Next fonts in pdf/fonts/ are installed.

    python3 scripts/forms/build_forms.py

writes the files to site/static/help/forms/, where the website serves them
at /help/forms/<slug>.docx and .pdf and shows each file's hash beside its
download link. checksums.json also records the SHA-256 of each form's
Markdown file and of the variables files, so the site's tests fail when a
form or a placeholder changes and the copies were not built again
(decision record 0047).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
FORMS = ROOT / "content" / "forms"
VARIABLES = ROOT / "content" / "variables"
FONT = "Atkinson Hyperlegible Next"
FRONT_MATTER = re.compile(r"^---\n.*?\n---\n", re.DOTALL)
NOTES = re.compile(r"^## Notes for courts adapting this form\n.*", re.DOTALL | re.MULTILINE)
PLACEHOLDER = re.compile(r"\{\{\s*([a-z]+)\.([a-z_]+)\s*\}\}")

BORDERS = (
    "<w:tblBorders>"
    + "".join(
        f'<w:{side} w:val="single" w:sz="4" w:space="0" w:color="808080"/>'
        for side in ("top", "left", "bottom", "right", "insideH", "insideV")
    )
    + "</w:tblBorders>"
)


def model_texts() -> dict[str, str]:
    texts = {}
    for path in sorted(VARIABLES.glob("*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        for name, variable in record["variables"].items():
            texts[f"{record['group']}.{name}"] = variable["model"]
    return texts


def printable_markdown(source: str, texts: dict[str, str], path: pathlib.Path) -> str:
    body = NOTES.sub("", FRONT_MATTER.sub("", source, count=1)).rstrip() + "\n"

    def replace(match: re.Match) -> str:
        key = f"{match.group(1)}.{match.group(2)}"
        if key not in texts:
            sys.exit(f"{path.name}: {{{{{key}}}}} has no entry in content/variables/{match.group(1)}.yaml")
        return texts[key]

    body = PLACEHOLDER.sub(replace, body)
    # A tick box needs no bullet beside it: each choice becomes its own paragraph.
    body = re.sub(r"^- ☐ (.*)$", r"☐ \1\n", body, flags=re.MULTILINE)
    # Room to write by hand.
    return re.sub(r"_{4,}", "_" * 22, body)


def drop_empty_row(match: re.Match) -> str:
    return "" if "<w:t>" not in match.group(0) and "<w:t " not in match.group(0) else match.group(0)


def finish_docx(path: pathlib.Path) -> None:
    """Borders and a writing-height minimum on every table; the project font throughout."""
    with zipfile.ZipFile(path) as archive:
        parts = {name: archive.read(name) for name in archive.namelist()}
    document = parts["word/document.xml"].decode("utf-8")
    document = re.sub(r"<w:tblBorders>.*?</w:tblBorders>", "", document)
    document = document.replace("<w:tblPr>", "<w:tblPr>" + BORDERS)
    # A table whose header cells are all empty ("| | |") prints no header row.
    document = re.sub(r"<w:tr>(?:(?!</w:tr>).)*?<w:tblHeader[^>]*/>(?:(?!</w:tr>).)*?</w:tr>", drop_empty_row, document, flags=re.DOTALL)
    document = re.sub(r"<w:tr>(?!<w:trPr>)", "<w:tr><w:trPr></w:trPr>", document)
    document = document.replace("<w:trPr>", '<w:trPr><w:cantSplit/><w:trHeight w:val="440"/>')
    parts["word/document.xml"] = document.encode("utf-8")
    styles = parts["word/styles.xml"].decode("utf-8")
    styles = re.sub(r"<w:rFonts [^>]*/>", f'<w:rFonts w:ascii="{FONT}" w:hAnsi="{FONT}" w:cs="{FONT}" w:eastAsia="{FONT}"/>', styles)
    parts["word/styles.xml"] = styles.encode("utf-8")
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in parts.items():
            # A fixed date keeps the zip bytes the same from one build to the next.
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--out", type=pathlib.Path, default=ROOT / "site" / "static" / "help" / "forms")
    parser.add_argument("--no-pdf", action="store_true", help="write only the .docx files")
    arguments = parser.parse_args()
    for tool in ["pandoc"] + ([] if arguments.no_pdf else ["soffice"]):
        if not shutil.which(tool):
            sys.exit(f"{tool} is not installed")
    out = arguments.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    texts = model_texts()
    built: list[pathlib.Path] = []
    sources: dict[str, str] = {}

    with tempfile.TemporaryDirectory() as scratch:
        for form in sorted(FORMS.glob("*.md")):
            sources[form.stem] = sha256(form)
            markdown = printable_markdown(form.read_text(encoding="utf-8"), texts, form)
            source = pathlib.Path(scratch) / f"{form.stem}.md"
            source.write_text(markdown, encoding="utf-8")
            docx = out / f"{form.stem}.docx"
            subprocess.run(
                ["pandoc", str(source), "--from", "gfm", "--to", "docx", "--output", str(docx)],
                check=True,
                # A fixed creation date, so the same text always gives the same .docx and hash.
                env={**os.environ, "SOURCE_DATE_EPOCH": "1767225600"},
            )
            finish_docx(docx)
            built.append(docx)
            if not arguments.no_pdf:
                subprocess.run(
                    ["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(out), str(docx)],
                    check=True,
                    capture_output=True,
                )
                built.append(out / f"{form.stem}.pdf")

    files = {path.name: {"sha256": sha256(path), "bytes": path.stat().st_size} for path in built}
    (out / "SHA256SUMS.txt").write_text("".join(f"{entry['sha256']}  {name}\n" for name, entry in files.items()), encoding="utf-8")
    variables = hashlib.sha256(b"".join(path.read_bytes() for path in sorted(VARIABLES.glob("*.yaml")))).hexdigest()
    record = {"files": files, "sources": sources, "variables": variables}
    (out / "checksums.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(built)} files and their SHA-256 hashes to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
