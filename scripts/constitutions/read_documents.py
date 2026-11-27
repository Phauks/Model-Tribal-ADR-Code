"""Read every captured document: text, dates, articles and topics.

For each document fetch_documents.py saved:

- reads its text: the PDF text layer, or optical character recognition
  (Tesseract, 200 dots per inch) when the text layer is missing or nearly
  empty; Word files through python-docx or LibreOffice;
- finds the title line, years named next to words such as adopted, approved,
  ratified, amended or effective, and whether the Secretary of the Interior's
  approval is mentioned;
- splits the text into articles and marks each article with the topics this
  project tracks (court and judicial power, dispute resolution, peacemaking,
  election disputes, removal and recall, sovereign immunity, rights, and
  how the constitution is amended).

Topic marks are word matches, not readings: the catalog records them as
`inferred`, and a reviewer confirms them.

Usage:
  python3 scripts/constitutions/read_documents.py FETCHED.json CAPTURE_DIR OUTPUT.json
"""

import concurrent.futures
import json
import os
import re
import subprocess
import sys
import tempfile

TOPICS = {
    "judicial": (
        re.compile(r"judic|court|judge|justice", re.I),
        re.compile(r"tribal court|judicial (power|branch|department)|supreme court|court of appeals|"
                   r"appellate court|chief judge|chief justice", re.I),
    ),
    "dispute-resolution": (
        re.compile(r"dispute|arbitrat|mediat|grievance|controvers|conflict", re.I),
        re.compile(r"\bdisputes?\b|arbitrat|mediat|grievances?|controvers(y|ies)|conciliat", re.I),
    ),
    "peacemaking": (
        re.compile(r"peace|tradition|elder|clan", re.I),
        re.compile(r"peace ?-?mak|traditional (court|dispute|law|justice|council)|council of elders|"
                   r"elders'? council|clan mothers?|customs? and traditions?", re.I),
    ),
    "election-disputes": (
        re.compile(r"election", re.I),
        re.compile(r"election (dispute|contest|challenge|board|committee|appeal)|contest(ed)? (an |the )?election|"
                   r"challenge (to |of )?(the |an )?election", re.I),
    ),
    "removal-and-recall": (
        re.compile(r"remov|recall|impeach|forfeit|vacanc|censure|discipline", re.I),
        re.compile(r"\brecall\b|impeach|removal from office|remove(d)? from office", re.I),
    ),
    "sovereign-immunity": (
        re.compile(r"immunit", re.I),
        re.compile(r"sovereign immunity|immunity from (suit|unconsented suit)|waive[sd]?( its| the)? (sovereign )?immunity", re.I),
    ),
    "rights": (
        re.compile(r"rights|due process|liberties", re.I),
        re.compile(r"due process|equal protection|bill of rights|indian civil rights act", re.I),
    ),
    "amendment-procedure": (
        re.compile(r"amend|revision", re.I),
        re.compile(r"amendments? to this constitution|this constitution (may|shall) be amended|"
                   r"secretarial election|approval of the secretary", re.I),
    ),
}

HEADING_ALONE = {
    "judicial",
    "dispute-resolution",
    "removal-and-recall",
    "sovereign-immunity",
    "rights",
    "amendment-procedure",
}

ARTICLE_LINE = re.compile(
    r"^\s{0,12}(ARTICLE|Article|ART\.|CHAPTER|Chapter)\s+([IVXLC]+|\d+|[A-Z][a-z]+(?:-[A-Z]?[a-z]+)?)\b[\s.:\-—–]*(.{0,120})$",
    re.M,
)
DATE_WORDS = re.compile(
    r"(adopted|approved|ratified|amended|effective|revised|enacted|restated|signed)", re.I
)
YEAR = re.compile(r"\b(1[89]\d\d|20[0-2]\d)\b")
MONTHS = r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan\.|Feb\.|Mar\.|Apr\.|Aug\.|Sept?\.|Oct\.|Nov\.|Dec\.)"
FULL_DATE = re.compile(MONTHS + r"\s+\d{1,2},?\s+(1[89]\d\d|20[0-2]\d)")
SECRETARY = re.compile(r"(Assistant )?Secretary of the Interior|Commissioner of Indian Affairs|Secretarial election", re.I)


SINGLE_THREAD = dict(os.environ, OMP_THREAD_LIMIT="1")


def ocr_pdf(path):
    with tempfile.TemporaryDirectory() as folder:
        subprocess.run(["pdftoppm", "-r", "200", "-gray", path, os.path.join(folder, "page")],
                       capture_output=True, timeout=1800)
        parts = []
        for name in sorted(os.listdir(folder)):
            result = subprocess.run(["tesseract", os.path.join(folder, name), "-", "--psm", "4"], env=SINGLE_THREAD,
                                    capture_output=True, timeout=300)
            parts.append(result.stdout.decode("utf-8", "replace"))
            parts.append("\f")
        return "".join(parts)


def word_text(path):
    if path.endswith(".docx"):
        try:
            import docx

            return "\n".join(paragraph.text for paragraph in docx.Document(path).paragraphs)
        except Exception:
            pass
    with tempfile.TemporaryDirectory() as folder:
        subprocess.run(["soffice", "--headless", "--convert-to", "txt:Text", "--outdir", folder, path],
                       capture_output=True, timeout=300)
        for name in os.listdir(folder):
            with open(os.path.join(folder, name), encoding="utf-8", errors="replace") as handle:
                return handle.read()
    return ""


def read_text(document, capture_dir):
    path = os.path.join(capture_dir, document["capture"])
    text_path = os.path.join(capture_dir, document["text_capture"])
    with open(text_path, encoding="utf-8", errors="replace") as handle:
        text = handle.read()
    method = document.get("text_source") or ("text-layer" if document["format"] == "pdf" else document["format"])
    if document["format"] == "pdf":
        pages = document.get("pages") or 1
        if len(text.strip()) < 300 * pages:
            ocr_path = path.rsplit(".", 1)[0] + ".ocr.txt"
            if os.path.exists(ocr_path):
                with open(ocr_path, encoding="utf-8") as handle:
                    ocr = handle.read()
            elif pages <= 400:
                ocr = ocr_pdf(path)
                with open(ocr_path, "w", encoding="utf-8") as handle:
                    handle.write(ocr)
            else:
                ocr = ""
            if len(ocr.strip()) > len(text.strip()):
                text, method = ocr, "optical-character-recognition"
    elif document["format"] in ("doc", "docx", "rtf"):
        text = word_text(path)
        with open(text_path, "w", encoding="utf-8") as handle:
            handle.write(text)
    return text, method


def title_of(text, page_title):
    # The printed heading first (fix_copy_titles.heading_of): the first line
    # naming a constitution is often a sentence of a corporate charter, or only
    # the first line of a heading that runs over several (2026-11-27).
    from fix_copy_titles import heading_of  # noqa: PLC0415  (imports build_catalog, which is slow to load)

    heading = heading_of(text)
    if heading:
        return heading
    for line in text.splitlines()[:80]:
        clean = " ".join(line.split())
        if 8 <= len(clean) <= 160 and re.search(r"constitution|by-?laws|articles of association|amendment", clean, re.I):
            return clean
    return page_title or ""


def dated_phrases(text):
    found = []
    for match in DATE_WORDS.finditer(text):
        window = text[match.start(): match.start() + 160]
        date = FULL_DATE.search(window)
        year = YEAR.search(window)
        if date:
            found.append({"word": match.group(1).lower(), "date": " ".join(date.group(0).split())})
        elif year:
            found.append({"word": match.group(1).lower(), "year": year.group(0)})
    unique = []
    for item in found:
        if item not in unique:
            unique.append(item)
    return unique[:60]


def articles_of(text):
    matches = list(ARTICLE_LINE.finditer(text))
    articles = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        body = text[match.end(): end]
        heading = " ".join(match.group(3).split())
        if not heading or len(heading) < 3:
            next_lines = [line.strip() for line in body.splitlines() if line.strip()][:1]
            heading = next_lines[0][:120] if next_lines else ""
        if len(body.strip()) < 80:
            continue  # a table of contents line, not the article itself
        line_number = text.count("\n", 0, match.start()) + 1
        topics = {}
        for topic, (heading_words, body_words) in TOPICS.items():
            hits = len(body_words.findall(body))
            in_heading = bool(heading_words.search(heading)) and (topic in HEADING_ALONE or hits >= 1)
            if in_heading or hits >= 2 or (topic in ("peacemaking", "sovereign-immunity") and hits >= 1):
                topics[topic] = {"heading": in_heading, "matches": hits}
        articles.append(
            {
                "label": f"{match.group(1).rstrip('.').title()} {match.group(2)}",
                "heading": heading,
                "line": line_number,
                "characters": len(body),
                "topics": topics,
            }
        )
    return articles


def snippets(text, articles, limit=3):
    """Short lines around topic matches, for private review only."""
    lines = text.splitlines()
    out = {}
    for article in articles:
        for topic in article["topics"]:
            pattern = TOPICS[topic][1]
            start = article["line"] - 1
            stop = min(len(lines), start + max(5, article["characters"] // 40 + 5))
            for number in range(start, stop):
                if pattern.search(lines[number]):
                    key = f"{article['label']}|{topic}"
                    out.setdefault(key, [])
                    if len(out[key]) < limit:
                        out[key].append(" ".join(" ".join(lines[max(start, number - 1): number + 2]).split())[:400])
    return out


CONSTITUTION_WORDS = re.compile(r"constitut|by-?laws|articles\s+of\s+association", re.I)
OTHER_LAW_WORDS = re.compile(
    r"ordinance|budget|resolution|minutes|agenda|policy|polic(y|ies)|\bcode\b|title\s+\d|statute|"
    r"election\s+results|newsletter|report|petition|order|opinion|request for judicial",
    re.I,
)


def worth_reading(document):
    """Skip files a link calls an ordinance, budget, resolution and the like
    unless the link also names a constitution; links from the profiles'
    own citations (the first step of the path) are always read."""
    label = f"{document['anchor']} {document['url']}"
    if CONSTITUTION_WORDS.search(label) or (len(document["via"]) == 1 and document["via"][0].startswith("seed:")):
        return True
    return not OTHER_LAW_WORDS.search(label)


def process(nation, document, capture_dir):
    if not worth_reading(document):
        return None
    text, method = read_text(document, capture_dir)
    if not (CONSTITUTION_WORDS.search(document["anchor"] + document["url"])
            or CONSTITUTION_WORDS.search(text[:4000])):
        return None
    articles = articles_of(text)
    return {
        "nation": nation,
        "sha256": document["sha256"],
        "capture": document["capture"],
        "format": document["format"],
        "url": document["url"],
        "final_url": document["final_url"],
        "anchor": document["anchor"],
        "via": document["via"],
        "pages": document.get("pages"),
        "bytes": document["bytes"],
        "text_method": method,
        "text_characters": len(text.strip()),
        "title_line": title_of(text, document.get("page_title", "")),
        "page_title": document.get("page_title", ""),
        "opening": "\n".join(line for line in text.splitlines() if line.strip())[:2500],
        "closing": "\n".join(line for line in text.splitlines() if line.strip())[-2000:],
        "dated_phrases": dated_phrases(text),
        "mentions_secretary": bool(SECRETARY.search(text)),
        "articles": articles,
        "snippets": snippets(text, articles),
    }


def main(fetched_path, capture_dir, output_path):
    with open(fetched_path, encoding="utf-8") as handle:
        fetched = json.load(handle)
    jobs = []
    seen = set()
    for row in fetched:
        for document in row["documents"]:
            key = (row["nation"], document["sha256"])
            if key in seen:
                continue
            seen.add(key)
            jobs.append((row["nation"], document))
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(process, nation, document, capture_dir) for nation, document in jobs]
        for count, future in enumerate(concurrent.futures.as_completed(futures), 1):
            try:
                result = future.result()
                if result:
                    results.append(result)
            except Exception as error:
                print("failed:", repr(error), flush=True)
            if count % 50 == 0:
                print(f"{count}/{len(jobs)}", flush=True)
                with open(output_path + ".partial", "w", encoding="utf-8") as handle:
                    json.dump(results, handle, ensure_ascii=False)
    results.sort(key=lambda item: (item["nation"], item["url"]))
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(results, handle, indent=1, ensure_ascii=False)
    print(f"{len(results)} documents read")


if __name__ == "__main__":
    main(*sys.argv[1:4])
