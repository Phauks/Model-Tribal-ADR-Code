"""Check that each quotation in a research file appears on the page it cites.

    python3 scripts/gaming/check_quotes.py FACTS.json CACHE_DIRECTORY

FACTS.json is a list of objects with `link` and `quote`. Each page is fetched
once with curl (PDFs converted with pdftotext, HTML tags removed), and each
fact gets `quote_found`: true, false, or null when the page could not be
fetched. The file is rewritten in place. A false result means the quotation
was not found word for word, often because the assistant that found it read a
summary of the page; such facts are recorded as title-only.
"""

import hashlib
import html
import json
import pathlib
import re
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from clause_evidence import normalize  # noqa: E402


def page_text(link, cache):
    name = hashlib.sha1(link.encode()).hexdigest()[:16]
    text_file = cache / f"{name}.txt"
    if not text_file.exists():
        raw = cache / f"{name}.raw"
        subprocess.run(["curl", "-sL", "-m", "60", "-A", "Mozilla/5.0", "-o", str(raw), link])
        if not raw.exists() or raw.stat().st_size == 0:
            return None
        data = raw.read_bytes()
        if data[:5] == b"%PDF-":
            subprocess.run(["pdftotext", str(raw), str(text_file)])
        else:
            page = data.decode("utf-8", "replace")
            page = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", page, flags=re.S | re.I)
            text_file.write_text(html.unescape(re.sub(r"<[^>]+>", " ", page)), encoding="utf-8")
    return text_file.read_text(encoding="utf-8", errors="replace") if text_file.exists() else None


def main(path, cache):
    cache.mkdir(parents=True, exist_ok=True)
    facts = json.loads(path.read_text(encoding="utf-8"))
    for fact in facts:
        if not fact.get("quote") or not fact.get("link"):
            fact["quote_found"] = None
            continue
        text = page_text(fact["link"], cache)
        fact["quote_found"] = None if text is None else normalize(fact["quote"]) in normalize(text)
    path.write_text(json.dumps(facts, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    found = [f["quote_found"] for f in facts]
    print(f"{path.name}: {found.count(True)} found, {found.count(False)} not found, {found.count(None)} not fetched")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]))
