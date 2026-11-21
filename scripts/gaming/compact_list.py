"""Catalog every entry on the Office of Indian Gaming list of Class III
tribal-state gaming compacts, amendments, extensions, disapprovals and
Secretarial Procedures (https://www.bia.gov/as-ia/oig/gaming-compacts).

    python3 scripts/gaming/compact_list.py scrape WORK_DIRECTORY
    python3 scripts/gaming/compact_list.py download WORK_DIRECTORY CAPTURE_DIRECTORY

`scrape` reads every result page with curl and writes WORK_DIRECTORY/list.json,
one row per entry, keeping the list's State, Tribes, Title, Decision and Date
columns, every document link and the Federal Register link exactly as shown.

`download` saves each linked document to CAPTURE_DIRECTORY (kept private,
never in the repository: the documents are posted by the Office of Indian
Gaming but the compacts are agreements of the nations and states), records
its SHA-256, page count and whether it has a text layer, and writes the
extracted text next to it.

Needs `curl`, `pdfinfo` and `pdftotext` (poppler-utils). Never writes to a
profile.
"""

import hashlib
import html
import json
import pathlib
import re
import subprocess
import sys
import time
import urllib.parse

BASE = "https://www.bia.gov"
LIST = BASE + "/as-ia/oig/gaming-compacts?page={}"
ROW = re.compile(r"<tr>(.*?)</tr>", re.S)
CELL = re.compile(r'<td headers="([^"]+)"[^>]*>(.*?)</td>', re.S)
LINK = re.compile(r'<a href="([^"]+)"[^>]*>(.*?)</a>', re.S)
TAG = re.compile(r"<[^>]+>")


def clean(text):
    return re.sub(r"\s+", " ", html.unescape(TAG.sub(" ", text))).strip()


def fetch(url, attempts=4):
    for attempt in range(attempts):
        result = subprocess.run(["curl", "-sL", "-m", "90", url], capture_output=True)
        if result.returncode == 0 and b"<table" in result.stdout:
            return result.stdout.decode("utf-8", "replace")
        time.sleep(2 ** attempt)
    return result.stdout.decode("utf-8", "replace")


def parse(page_html, page):
    rows = []
    body = page_html[page_html.find("<tbody"):page_html.find("</tbody>")]
    for number, match in enumerate(ROW.finditer(body), start=1):
        cells = {header.split("-table-column")[0].replace("view-", ""): content
                 for header, content in CELL.findall(match.group(1))}
        title_cell = cells.get("title", "")
        heading = re.search(r"<h3>(.*?)</h3>", title_cell, re.S)
        documents, federal_register = [], []
        for href, text in LINK.findall(title_cell):
            link = urllib.parse.urljoin(BASE, html.unescape(href))
            if "federalregister.gov" in link or "govinfo.gov" in link:
                federal_register.append(link)
            else:
                documents.append({"link": link, "file_name": clean(text)})
        date = re.search(r'datetime="([0-9-]{10})', cells.get("field-date", ""))
        rows.append({
            "page": page, "row": number,
            "state": clean(cells.get("field-us-state-s", "")),
            "tribes_column": clean(cells.get("field-bogs-federally-recognized", "")),
            "title": clean(heading.group(1)) if heading else clean(title_cell),
            "decision": clean(cells.get("field-approve-or-not-approved", "")),
            "date": date.group(1) if date else None,
            "documents": documents,
            "federal_register_links": federal_register,
        })
    return rows


def scrape(work):
    work.mkdir(parents=True, exist_ok=True)
    rows, page = [], 0
    while True:
        cached = work / "pages" / f"{page:03d}.html"
        if not cached.exists():
            cached.parent.mkdir(parents=True, exist_ok=True)
            cached.write_text(fetch(LIST.format(page)), encoding="utf-8")
            time.sleep(1)
        found = parse(cached.read_text(encoding="utf-8"), page)
        if not found:
            break
        rows.extend(found)
        page += 1
    (work / "list.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(rows)} rows from {page} pages")


def describe(pdf):
    info = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True, errors="replace").stdout
    pages = re.search(r"^Pages:\s+(\d+)", info, re.M)
    text_file = pdf.with_suffix(".txt")
    subprocess.run(["pdftotext", "-layout", str(pdf), str(text_file)], capture_output=True)
    text = text_file.read_text(encoding="utf-8", errors="replace") if text_file.exists() else ""
    return {
        "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest(),
        "bytes": pdf.stat().st_size,
        "pages": int(pages.group(1)) if pages else None,
        "text_characters": len(re.sub(r"\s", "", text)),
    }


def download(work, captures):
    rows = json.loads((work / "list.json").read_text(encoding="utf-8"))
    seen = {}
    for row in rows:
        for document in row["documents"]:
            link = document["link"]
            if link in seen:
                document.update(seen[link])
                continue
            name = pathlib.PurePosixPath(urllib.parse.urlparse(link).path).name
            name = urllib.parse.unquote(name)
            pdf = captures / re.sub(r"[^A-Za-z0-9._-]+", "-", row["state"].lower()) / name
            pdf.parent.mkdir(parents=True, exist_ok=True)
            if not pdf.exists() or pdf.stat().st_size == 0:
                subprocess.run(["curl", "-sfL", "-m", "300", "--retry", "3", "-o", str(pdf), link])
            if pdf.exists() and pdf.stat().st_size > 0 and pdf.read_bytes()[:5] == b"%PDF-":
                details = {"capture": str(pdf.relative_to(captures)), **describe(pdf)}
            else:
                details = {"capture": None, "download_error": "not a PDF or not reachable"}
            seen[link] = details
            document.update(details)
    (work / "list.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(seen)} documents; {sum(1 for d in seen.values() if d.get('capture'))} saved")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "scrape":
        scrape(pathlib.Path(sys.argv[2]))
    elif len(sys.argv) == 4 and sys.argv[1] == "download":
        download(pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]))
    else:
        sys.exit(__doc__)
