"""Download the Library of Congress copies of constitutions that profiles cite.

The profiles cite Library of Congress item pages (www.loc.gov/item/<id>/).
For each one this script asks the Library's own JSON view of the item
(`?fo=json`, the documented loc.gov API), downloads the PDF it names and
extracts its text, one request a second, with a user agent naming the project.

Usage:
  python3 scripts/constitutions/fetch_library_of_congress.py SEEDS.json CAPTURE_DIR OUTPUT.json

OUTPUT.json has the same shape as fetch_documents.py's output (one row per
nation with its documents), so combine_found.py can join it.
"""

import hashlib
import json
import os
import subprocess
import sys
import time

import requests

USER_AGENT = "Mozilla/5.0 (compatible; model-tribal-code-research/0.1; +https://github.com/Phauks/Model-Tribal-ADR-Code)"


def get(session, address, **options):
    for attempt in range(3):
        try:
            response = session.get(address, timeout=120, **options)
            time.sleep(1)
            if response.status_code == 200:
                return response
            if response.status_code in (429, 503):
                time.sleep(10 * (attempt + 1))
                continue
            return response
        except requests.RequestException:
            time.sleep(5 * (attempt + 1))
    return None


def pdf_text(path):
    pages = 0
    info = subprocess.run(["pdfinfo", path], capture_output=True, text=True)
    for line in info.stdout.splitlines():
        if line.startswith("Pages:"):
            pages = int(line.split()[1])
    text_path = path.rsplit(".", 1)[0] + ".txt"
    subprocess.run(["pdftotext", "-layout", path, text_path], capture_output=True)
    characters = os.path.getsize(text_path) if os.path.exists(text_path) else 0
    return pages, characters


def main(seeds_path, capture_dir, output_path):
    with open(seeds_path, encoding="utf-8") as handle:
        seeds = json.load(handle)
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    results = []
    count = 0
    for row in seeds:
        documents = []
        for seed in row["seeds"]:
            if "loc.gov/item/" not in seed["link"]:
                continue
            count += 1
            item = seed["link"].split("?")[0].rstrip("/") + "/"
            response = get(session, item, params={"fo": "json"})
            if not response or response.status_code != 200:
                print(f"no item view: {item}", flush=True)
                continue
            data = response.json()
            title = (data.get("item") or {}).get("title") or seed.get("title") or ""
            pdfs = [resource.get("pdf") for resource in data.get("resources") or [] if resource.get("pdf")]
            if not pdfs:
                print(f"no PDF: {item}", flush=True)
                continue
            download = get(session, pdfs[0])
            if not download or download.status_code != 200 or not download.content.startswith(b"%PDF"):
                print(f"PDF failed: {pdfs[0]}", flush=True)
                continue
            digest = hashlib.sha256(download.content).hexdigest()
            folder = os.path.join(capture_dir, row["nation"])
            os.makedirs(folder, exist_ok=True)
            path = os.path.join(folder, f"{digest[:16]}.pdf")
            with open(path, "wb") as handle:
                handle.write(download.content)
            pages, characters = pdf_text(path)
            documents.append(
                {
                    "sha256": digest,
                    "capture": f"{row['nation']}/{digest[:16]}.pdf",
                    "text_capture": f"{row['nation']}/{digest[:16]}.txt",
                    "bytes": len(download.content),
                    "pages": pages,
                    "page_title": title,
                    "text_characters": characters,
                    "url": seed["link"],
                    "final_url": pdfs[0],
                    "via": ["seed", "library-of-congress"],
                    "anchor": title,
                    "format": "pdf",
                }
            )
            print(f"{count}: {row['nation']} {pages} pages", flush=True)
        if documents:
            results.append({"nation": row["nation"], "documents": documents, "visited": []})
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(results, handle, indent=1, ensure_ascii=False)
    print(f"{sum(len(row['documents']) for row in results)} documents for {len(results)} nations")


if __name__ == "__main__":
    main(*sys.argv[1:4])
