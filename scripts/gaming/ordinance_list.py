"""Catalog every gaming ordinance and amendment on the National Indian Gaming
Commission's list of approved Tribal gaming ordinances
(https://www.nigc.gov/office-of-general-counsel/gaming-ordinances/).

    python3 scripts/gaming/ordinance_list.py scrape WORK_DIRECTORY
    python3 scripts/gaming/ordinance_list.py download WORK_DIRECTORY CAPTURE_DIRECTORY

`scrape` writes WORK_DIRECTORY/ordinances.json, one row per nation with each
ordinance and amendment date and its download link, exactly as the table
shows them. `download` follows each link (the Commission's links redirect to
the approval letter or ordinance PDF), saves the file to CAPTURE_DIRECTORY,
which stays private, records its final address, SHA-256, page count and
whether it has a text layer, and writes the extracted text beside it.

Needs `curl`, `pdfinfo` and `pdftotext`. Never writes to a profile.
"""

import concurrent.futures
import html
import json
import pathlib
import re
import subprocess
import sys
import urllib.parse

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from compact_list import clean, describe  # noqa: E402

PAGE = "https://www.nigc.gov/office-of-general-counsel/gaming-ordinances/"
ROW = re.compile(r'<tr class="row-(\d+)[^"]*">(.*?)</tr>', re.S)
CELL = re.compile(r'<td class="column-(\d)">(.*?)</td>', re.S)
LINK = re.compile(r'<a href="([^"]+)"[^>]*>(.*?)</a>', re.S)


def scrape(work):
    work.mkdir(parents=True, exist_ok=True)
    page = work / "ordinances.html"
    if not page.exists():
        subprocess.run(["curl", "-sL", "-m", "90", "-o", str(page), PAGE], check=True)
    text = page.read_text(encoding="utf-8")
    body = text[text.find("<tbody"):text.find("</tbody>")]
    rows = []
    for row_number, content in ROW.findall(body):
        cells = dict(CELL.findall(content))
        documents = []
        for column, kind in (("2", "ordinance"), ("3", "amendment")):
            for href, label in LINK.findall(cells.get(column, "")):
                documents.append({"kind": kind, "date": clean(label), "link": html.unescape(href)})
        rows.append({"table_row": int(row_number), "nation_column": clean(cells.get("1", "")),
                     "documents": documents})
    (work / "ordinances.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(rows)} nations, {sum(len(r['documents']) for r in rows)} documents")


def fetch_one(link, folder, captures):
    final = subprocess.run(["curl", "-sIL", "-m", "60", "-o", "/dev/null", "-w", "%{url_effective}", link],
                           capture_output=True, text=True).stdout.strip()
    name = urllib.parse.unquote(pathlib.PurePosixPath(urllib.parse.urlparse(final).path).name) or "document"
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", name)
    target = captures / folder / name
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() or target.stat().st_size == 0:
        subprocess.run(["curl", "-sfL", "-m", "300", "--retry", "3", "-o", str(target), link])
    details = {"final_link": final}
    if target.exists() and target.read_bytes()[:5] == b"%PDF-":
        details.update({"capture": str(target.relative_to(captures)), **describe(target)})
    elif target.exists() and target.stat().st_size > 0:
        details.update({"capture": str(target.relative_to(captures)), "note": "not a PDF"})
    else:
        details.update({"capture": None, "download_error": "not reachable"})
    return link, details


def download(work, captures, workers=6):
    rows = json.loads((work / "ordinances.json").read_text(encoding="utf-8"))
    jobs = {}
    for row in rows:
        folder = re.sub(r"[^a-z0-9]+", "-", row["nation_column"].lower()).strip("-")
        for document in row["documents"]:
            jobs.setdefault(document["link"], folder)
    with concurrent.futures.ThreadPoolExecutor(workers) as pool:
        seen = dict(pool.map(lambda item: fetch_one(item[0], item[1], captures), jobs.items()))
    for row in rows:
        for document in row["documents"]:
            document.update(seen[document["link"]])
    (work / "ordinances.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(seen)} documents; {sum(1 for d in seen.values() if d.get('capture'))} saved")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "scrape":
        scrape(pathlib.Path(sys.argv[2]))
    elif len(sys.argv) == 4 and sys.argv[1] == "download":
        download(pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]))
    else:
        sys.exit(__doc__)
