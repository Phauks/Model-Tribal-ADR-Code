"""Second round of the data gap review (Nov. 22, 2026): rows 4, 8, 10, 12, 15,
16, 20, 21 and 23 of research/analyses/2026-11-21-dataset-gap-audit.md.

    python3 scripts/review/second_gap_review.py gather WORK_DIRECTORY
    python3 scripts/review/second_gap_review.py merge WORK_DIRECTORY

`gather` fetches what each check needs into WORK_DIRECTORY and runs the
checks a script can settle on its own:

- petitions/ (row 15): the Office of Federal Acknowledgment's Petitions in
  Process and Petitions Resolved pages, compared by petition number with the
  `recognition` facts in the profiles;
- icwa/ (row 8): the page images of the Indian Child Welfare Act designated
  agents notice (91 Fed. Reg. 30,667), read with Tesseract OCR, and each
  profile's listed name looked for in them;
- quotes/ (rows 4 and 20): every quotation followed by a citation in a method
  or glossary record, looked for word for word in the cited source;
- links/ (row 21): every source record's address, requested once;
- govdocs/ (row 10): every governing document link in the profiles,
  downloaded, and confirmed when the page names the nation and the kind of
  document;
- structure.json (row 12): profiles whose government structure is
  historical, and whether they also list a current constitution.

What a script cannot settle goes to reviewers, using the briefs in
research/reviews/briefs/2026-11-22-*.md, who write *-verdicts.json files
beside the inputs. `merge` combines both into research/reviews/:
2026-11-22-second-gap-review.json, one .csv per check (each with an empty
`lead_author_decision` column), and -counts.json. Neither command edits a
profile or source record.

Needs scripts/requirements.txt, poppler-utils (pdfimages, pdftotext) and
tesseract-ocr.
"""

import collections
import concurrent.futures
import csv
import hashlib
import html
import json
import pathlib
import random
import re
import ssl
import subprocess
import sys
import unicodedata
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import record_facts  # noqa: E402

REVIEWS = ROOT / "research" / "reviews"
DATE = "2026-11-22"
USER_AGENT = "Mozilla/5.0 (compatible; Model Tribal ADR Code research link check)"
OFA = "https://www.bia.gov/as-ia/ofa/"
ICWA_NOTICE_PDF = "https://www.govinfo.gov/content/pkg/FR-2026-05-26/pdf/2026-10420.pdf"
STOP = set("of the and tribe tribes indian indians band bands community village native nation nations "
           "reservation inc california alaska oklahoma rancheria pueblo confederated mission new mexico "
           "arizona washington".split())
DOCUMENT_WORDS = {
    "constitution": ["constitution"], "law-code": ["code", "title", "ordinance", "law", "statute"],
    "corporate-charter": ["charter", "corporate"], "articles-of-association": ["articles", "association"],
    "court-rules": ["rule"],
}


def normalized(text):
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.replace("’", "'").replace("‘", "'")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", text.lower())).strip()


def context():
    try:
        return ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
    except (FileNotFoundError, ssl.SSLError):
        return ssl.create_default_context()


def fetch(link, timeout=40, limit=30_000_000):
    request = urllib.request.Request(link, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout, context=context()) as response:
        return response.status, response.geturl(), response.read(limit)


def text_of(data, path):
    if data[:4] == b"%PDF":
        return subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, text=True).stdout, "pdf"
    page = re.sub(r"<script.*?</script>|<style.*?</style>", "", data.decode("utf-8", "ignore"), flags=re.S | re.I)
    return html.unescape(re.sub(r"<[^>]+>", " ", page)), "html"


def profiles():
    tree = record_facts.Tree(ROOT)
    return [profile for _, profile in sorted(tree.profiles.items())], tree


# Row 15 -------------------------------------------------------------------

def table_rows(page_text, columns):
    cells = [cell.strip() for cell in page_text.split("|")]
    rows = []
    for i, cell in enumerate(cells):
        if re.fullmatch(r"\d{1,3}[A-Z]?", cell) and i + columns < len(cells):
            rows.append([cell] + [cells[i + k].split("\n")[0].strip() for k in range(1, columns)])
    return rows


def page_cells(raw):
    page = re.sub(r"<script.*?</script>|<style.*?</style>", "", raw, flags=re.S | re.I)
    page = re.sub(r"<t[dh][^>]*>", " | ", page)
    page = re.sub(r"<tr[^>]*>", "\n", page)
    return html.unescape(re.sub(r"<[^>]+>", "", page))


def gather_petitions(work, all_profiles):
    folder = work / "petitions"
    folder.mkdir(parents=True, exist_ok=True)
    tables = {}
    for name, columns in (("resolved", 4), ("petitions-in-process", 3)):
        _, _, data = fetch(OFA + name)
        (folder / f"{name}.html").write_bytes(data)
        tables[name] = {row[0].lstrip("0"): row for row in table_rows(page_cells(data.decode("utf-8", "ignore")), columns)}
    findings, recorded = [], set()
    for profile in all_profiles:
        types = {item.get("type") for item in profile.get("recognition") or []}
        for item in profile.get("recognition") or []:
            number = str(item.get("petition_number") or "").lstrip("0")
            if not number or number.startswith("R"):
                continue
            recorded.add(number)
            stage = f"{item.get('petition_stage', '')} {item.get('note', '')}".lower()
            if number in tables["resolved"]:
                row = tables["resolved"][number]
                decision = row[3] or "(no decision shown)"
                if decision.lower().startswith("ack"):
                    agrees = "federal" in types
                else:
                    agrees = any(word in stage for word in ("denied", "declined", "negative final"))
                findings.append(dict(profile=profile["id"], petition=number, page="resolved", name_on_page=row[1],
                                     status_on_page=decision, agrees=agrees))
            elif number in tables["petitions-in-process"]:
                row = tables["petitions-in-process"][number]
                findings.append(dict(profile=profile["id"], petition=number, page="in process", name_on_page=row[1],
                                     status_on_page="in process", agrees=True))
    for page, table in tables.items():
        for number, row in table.items():
            if number not in recorded:
                findings.append(dict(profile=None, petition=number, page=page, name_on_page=row[1],
                                     status_on_page=(row[3] if page == "resolved" else "in process") or "(no decision shown)",
                                     agrees=False))
    (folder / "check.json").write_text(json.dumps(findings, indent=1, ensure_ascii=False) + "\n")


# Row 8 --------------------------------------------------------------------

def gather_icwa(work, all_profiles):
    folder = work / "icwa"
    pages = folder / "pages"
    pages.mkdir(parents=True, exist_ok=True)
    if not (folder / "notice.pdf").exists():
        _, _, data = fetch(ICWA_NOTICE_PDF)
        (folder / "notice.pdf").write_bytes(data)
        subprocess.run(["pdfimages", "-png", str(folder / "notice.pdf"), str(pages / "p")], check=True)
    for image in sorted(pages.glob("p-*.png")):
        for _ in range(3):  # an empty result is retried; OCR occasionally returns nothing
            text_file = image.with_suffix(".txt")
            if text_file.exists() and text_file.stat().st_size > 0:
                break
            subprocess.run(["tesseract", str(image), str(image.with_suffix("")), "--psm", "4"], capture_output=True)
    texts = [normalized(path.read_text()) for path in sorted(pages.glob("p-*.txt"))]
    everything = " ".join(texts)
    items = []
    for profile in all_profiles:
        facts = [j for j in profile.get("jurisdiction") or [] if j.get("topic") == "indian-child-welfare-act"]
        federal = "federal" in {r.get("type") for r in profile.get("recognition") or []}
        if federal and not facts:
            items.append(dict(profile=profile["id"], official_name=profile["names"]["official"], listed_as=None,
                              ocr="no fact", kind="federally recognized profile with no ICWA fact"))
        for fact in facts:
            match = re.search(r"Listed as: (.*?) Confidence lowered", fact.get("note", ""))
            label = match.group(1) if match else None
            result = "no label"
            if label:
                name = normalized(label)
                words = [w for w in name.split() if w not in STOP and len(w) > 2] or name.split()
                if name in everything:
                    result = "exact"
                elif any(all(w in page[max(0, m.start() - 150):m.start() + 250] for w in words)
                         for page in texts for m in re.finditer(re.escape(words[0]), page)):
                    result = "words nearby"
                else:
                    result = "not found"
            items.append(dict(profile=profile["id"], official_name=profile["names"]["official"], listed_as=label,
                              ocr=result, kind="ICWA fact"))
    (folder / "check.json").write_text(json.dumps(items, indent=1, ensure_ascii=False) + "\n")
    review = [item for item in items if item["ocr"] in ("no label", "not found", "no fact")]
    (folder / "review-items.json").write_text(json.dumps(review, indent=1, ensure_ascii=False) + "\n")


# Rows 4 and 20 ------------------------------------------------------------

def gather_quotes(work, tree):
    folder = work / "quotes"
    (folder / "src").mkdir(parents=True, exist_ok=True)
    quotes = []
    for pattern in ("content/methods/*.yaml", "content/glossary/*.yaml"):
        for file, record in tree.yaml_records(pattern):
            for field, value in record.items():
                if isinstance(value, str):
                    for m in re.finditer(r'["“]([^"”]{12,}?)["”]([^\[]{0,120}?)\[@([a-z0-9-]+)', value):
                        quotes.append(dict(file=file, field=field, quote=m.group(1), key=m.group(3)))
    texts = {}
    for key in sorted({q["key"] for q in quotes}):
        source = tree.sources.get(key, {})
        link = source.get("original_link") or (source.get("citation") or {}).get("URL")
        texts[key] = None
        if not link:
            continue
        try:
            _, _, data = fetch(link)
            path = folder / "src" / key
            path.write_bytes(data)
            texts[key] = normalized(text_of(data, path)[0])
        except Exception as error:  # noqa: BLE001 - any failure means "not fetched"
            texts[key] = f"ERR {error}"[:100]
    for quote in quotes:
        text = texts.get(quote["key"])
        if not text or text.startswith("ERR"):
            quote["status"] = "not-fetched"
            continue
        words = normalized(quote["quote"]).split()
        if " ".join(words) in text:
            quote["status"] = "found"
        else:
            quote["status"] = "partly" if sum(w in text for w in words) / max(1, len(words)) > 0.8 else "not-found"
    (folder / "quote-check.json").write_text(json.dumps(quotes, indent=1, ensure_ascii=False) + "\n")


# Row 21 -------------------------------------------------------------------

def link_status(item):
    key, link, recorded = item
    for method in ("HEAD", "GET"):
        try:
            request = urllib.request.Request(link, method=method, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=25, context=context()) as response:
                return dict(key=key, link=link, recorded=recorded, code=response.status, final=response.geturl())
        except urllib.error.HTTPError as error:
            if method == "HEAD" and error.code in (400, 403, 405, 429, 501):
                continue
            return dict(key=key, link=link, recorded=recorded, code=error.code, final=None)
        except Exception as error:  # noqa: BLE001
            if method == "HEAD":
                continue
            return dict(key=key, link=link, recorded=recorded, code=None, error=f"{type(error).__name__}: {error}"[:140])


def gather_links(work, tree):
    folder = work / "links"
    folder.mkdir(parents=True, exist_ok=True)
    items = []
    for key, source in sorted(tree.sources.items()):
        link = source.get("original_link") or (source.get("citation") or {}).get("URL")
        if link and link.startswith("http"):
            items.append((key, link, (source.get("history") or {}).get("status")))
    with concurrent.futures.ThreadPoolExecutor(24) as pool:
        results = list(pool.map(link_status, items))
    (folder / "results.json").write_text(json.dumps(results, indent=0) + "\n")


# Row 10 -------------------------------------------------------------------

def download(link, folder):
    path = folder / hashlib.sha1(link.encode()).hexdigest()[:16]
    try:
        code, final, data = fetch(link)
    except urllib.error.HTTPError as error:
        return dict(link=link, code=error.code)
    except Exception as error:  # noqa: BLE001
        return dict(link=link, code=None, error=f"{type(error).__name__}: {error}"[:100])
    path.write_bytes(data)
    text, kind = text_of(data, path)
    pathlib.Path(f"{path}.txt").write_text(re.sub(r"\s+", " ", text)[:4000])
    return dict(link=link, code=code, final=final, kind=kind, file=str(path))


def gather_govdocs(work, all_profiles):
    folder = work / "govdocs"
    (folder / "files").mkdir(parents=True, exist_ok=True)
    items = [dict(profile=p["id"], official_name=p["names"]["official"], index=i, kind=g.get("kind"),
                  title=g.get("title"), link=g["link"], verification=g.get("verification"))
             for p in all_profiles for i, g in enumerate(p.get("governing_documents") or []) if g.get("link")]
    with concurrent.futures.ThreadPoolExecutor(16) as pool:
        fetched = {r["link"]: r for r in pool.map(lambda link: download(link, folder / "files"),
                                                   sorted({i["link"] for i in items}))}
    for item in items:
        result = fetched[item["link"]]
        item["code"], item["final_url"] = result.get("code"), result.get("final")
        if not result.get("file"):
            item["auto"] = "not-fetched"
            continue
        item["text_file"], item["full_file"] = result["file"] + ".txt", result["file"]
        text = normalized(pathlib.Path(item["text_file"]).read_text())
        words = [w for w in normalized(item["official_name"]).split() if w not in STOP and len(w) > 2][:3]
        names_nation = any(w in text for w in words)
        names_kind = any(w in text for w in DOCUMENT_WORDS.get(item["kind"], [""]))
        title = normalized(item["title"])
        item["auto"] = ("confirmed-by-text" if names_nation and (names_kind or (len(title) > 8 and title in text))
                        else "needs-review")
    (folder / "items.json").write_text(json.dumps(items, indent=0) + "\n")
    random.seed(22)
    confirmed = [i for i in items if i["auto"] == "confirmed-by-text"]
    (folder / "batch-residual.json").write_text(json.dumps([i for i in items if i["auto"] == "needs-review"], indent=1) + "\n")
    (folder / "batch-sample.json").write_text(json.dumps(random.sample(confirmed, min(60, len(confirmed))), indent=1) + "\n")


# Row 12 -------------------------------------------------------------------

def gather_structure(work, all_profiles):
    rows = []
    for profile in all_profiles:
        structure = profile.get("government_structure") or []
        if not structure:
            continue
        historical = all("Historical" in str(f.get("note", "")) or "1947" in str(f.get("note", "")) for f in structure)
        current = [g.get("title") for g in profile.get("governing_documents") or []
                   if g.get("kind") == "constitution" and "Historical text" not in str(g.get("note", ""))]
        rows.append(dict(profile=profile["id"], structure_facts=len(structure), all_historical=historical,
                         current_constitution_listed=bool(current), current_constitution_titles=current))
    (work / "structure.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False) + "\n")


def gather(work):
    work.mkdir(parents=True, exist_ok=True)
    all_profiles, tree = profiles()
    gather_petitions(work, all_profiles)
    gather_icwa(work, all_profiles)
    gather_quotes(work, tree)
    gather_links(work, tree)
    gather_govdocs(work, all_profiles)
    gather_structure(work, all_profiles)


# Merge --------------------------------------------------------------------

def load(path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


def link_category(code):
    if code and 200 <= code < 400:
        return "reachable"
    if code in (404, 410):
        return "gone"
    if code in (401, 403, 406, 429, 999):
        return "refused-automated-request"
    if code:
        return f"http-{code}"
    return "no-response"


def write_csv(name, rows, columns):
    path = REVIEWS / f"{DATE}-{name}.csv"
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns + ["lead_author_decision"], extrasaction="ignore",
                                lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({k: ("; ".join(map(str, v)) if isinstance(v, list) else v) for k, v in row.items()})


def merge(work):
    result, counts = {}, {}

    petitions = load(work / "petitions" / "check.json", [])
    result["petitions"] = petitions
    counts["petitions"] = dict(collections.Counter(
        f"{p['page']}: {'matches the profile' if p['agrees'] else ('no profile cites this number' if not p['profile'] else 'differs')}"
        for p in petitions))
    write_csv("petition-status", petitions, ["profile", "petition", "page", "name_on_page", "status_on_page", "agrees"])

    icwa = load(work / "icwa" / "check.json", [])
    verdicts = {v["profile"]: v for v in load(work / "icwa" / "icwa-verdicts.json", [])}
    for item in icwa:
        verdict = verdicts.get(item["profile"]) if item["ocr"] in ("no label", "not found", "no fact") else None
        item["reviewer_verdict"] = verdict and verdict.get("verdict")
        item["name_in_notice"] = verdict and verdict.get("name_in_notice")
        item["reviewer_reason"] = verdict and verdict.get("reason")
        item["page"] = verdict and verdict.get("page")
    result["icwa"] = icwa
    counts["icwa"] = dict(collections.Counter(item["reviewer_verdict"] or f"OCR {item['ocr']}" for item in icwa))
    write_csv("icwa-agents", icwa, ["profile", "official_name", "kind", "listed_as", "ocr", "reviewer_verdict",
                                     "name_in_notice", "page", "reviewer_reason"])

    quotes = load(work / "quotes" / "quote-check.json", [])
    verdicts = {(v["file"], v["key"], v.get("quote_in_record", "")[:40]): v for v in load(work / "quotes" / "quote-verdicts.json", [])}
    by_item = collections.defaultdict(list)
    for v in load(work / "quotes" / "quote-verdicts.json", []):
        by_item[(v["file"], v["key"])].append(v)
    for quote in quotes:
        if quote["status"] == "found":
            quote["verdict"] = "exact (script)"
            continue
        candidates = by_item.get((quote["file"], quote["key"]), [])
        match = next((v for v in candidates if normalized(quote["quote"])[:30] in normalized(v.get("quote_in_record", ""))), None)
        match = match or (candidates[0] if len(candidates) == 1 else None)
        quote["verdict"] = match["verdict"] if match else "not reviewed"
        quote["source_text"] = match and match.get("source_text")
        quote["reason"] = match and match.get("reason")
    result["quotes"] = quotes
    counts["quotes"] = dict(collections.Counter(q["verdict"] for q in quotes))
    write_csv("quotations", quotes, ["file", "field", "key", "quote", "status", "verdict", "source_text", "reason"])

    links = load(work / "links" / "results.json", [])
    for link in links:
        link["category"] = link_category(link.get("code"))
        final = link.get("final") or ""
        link["moved_to_another_site"] = bool(final) and (
            re.sub(r"^www\.", "", urllib.parse.urlsplit(final).netloc) != re.sub(r"^www\.", "", urllib.parse.urlsplit(link["link"]).netloc))
    result["links"] = [l for l in links if l["category"] != "reachable" or l["moved_to_another_site"]]
    counts["links"] = dict(collections.Counter(l["category"] for l in links))
    counts["links"]["reachable but moved to another site"] = sum(l["moved_to_another_site"] for l in links)
    write_csv("source-links", result["links"], ["key", "link", "recorded", "code", "category", "final", "moved_to_another_site"])

    govdocs = load(work / "govdocs" / "items.json", [])
    reviewed = {}
    for name in ("verdicts-residual.json", "verdicts-sample.json"):
        for v in load(work / "govdocs" / name, []):
            reviewed[(v["profile"], v["index"])] = dict(v, batch=name.split("-")[1].split(".")[0])
    for item in govdocs:
        verdict = reviewed.get((item["profile"], item["index"]))
        item["reviewer_verdict"] = verdict and verdict.get("verdict")
        item["reviewer_batch"] = verdict and verdict.get("batch")
        item["date_seen"] = verdict and verdict.get("date_seen")
        item["reviewer_reason"] = verdict and verdict.get("reason")
        item["link_status"] = link_category(item.get("code")) if item["auto"] == "not-fetched" else "reachable"
    result["govdocs"] = govdocs
    sample = [i for i in govdocs if i.get("reviewer_batch") == "sample"]
    counts["govdocs"] = {
        "links": len(govdocs),
        "automatic": dict(collections.Counter(i["auto"] for i in govdocs)),
        "not fetched, by status": dict(collections.Counter(i["link_status"] for i in govdocs if i["auto"] == "not-fetched")),
        "residual reviewed": dict(collections.Counter(i["reviewer_verdict"] for i in govdocs if i.get("reviewer_batch") == "residual")),
        "sample of automatic confirmations reviewed": dict(collections.Counter(i["reviewer_verdict"] for i in sample)),
    }
    write_csv("governing-documents", govdocs, ["profile", "index", "kind", "title", "link", "auto", "link_status",
                                                "final_url", "reviewer_batch", "reviewer_verdict", "date_seen", "reviewer_reason"])

    structure = load(work / "structure.json", [])
    result["structure"] = structure
    counts["structure"] = dict(collections.Counter(
        ("historical only" if s["all_historical"] else "has a current fact") + ", "
        + ("current constitution listed" if s["current_constitution_listed"] else "no current constitution listed")
        for s in structure))

    outreach = load(work / "outreach" / "verdicts.json", [])
    result["outreach"] = outreach
    counts["outreach"] = dict(collections.Counter(o["verdict"] for o in outreach))
    write_csv("outreach-search-results", outreach, ["record", "source_id", "link", "verdict", "evidence", "reason"])

    (REVIEWS / f"{DATE}-second-gap-review.json").write_text(json.dumps(result, indent=1, ensure_ascii=False, default=str) + "\n")
    (REVIEWS / f"{DATE}-second-gap-review-counts.json").write_text(json.dumps(counts, indent=1, ensure_ascii=False) + "\n")
    print(json.dumps(counts, indent=1))


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("gather", "merge"):
        print(__doc__)
        return 2
    work = pathlib.Path(sys.argv[2])
    gather(work) if sys.argv[1] == "gather" else merge(work)
    return 0


if __name__ == "__main__":
    sys.exit(main())
