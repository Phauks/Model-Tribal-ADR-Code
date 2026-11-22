"""Open each governing document still recorded by title only and check its
title, kind and date (row 10 of the dataset gap audit,
research/analyses/2026-11-21-dataset-gap-audit.md).

    python3 scripts/review/governing_documents.py gather WORK_DIRECTORY [--skip-ref REF] [--no-fetch]
    python3 scripts/review/governing_documents.py apply WORK_DIRECTORY [--date YYYY-MM-DD] [--agree REVIEW.csv]

`gather` lists every `governing_documents` fact whose `verification` is
`title-only` and sets aside the ones other work covers:

  - facts that the branch REF (the constitutions pull request, #55) gives a
    `document_version`, so this check does not edit the lines it edits;
  - law codes and court rules that the tribal law texts work fetched
    (research/tribal-law/documents.json);
  - facts with no link.

For the rest it takes the document's text from the captures that work already
saved (the constitutions captures and the tribal law captures, in the private
project files) and fetches only what neither saved, identifying itself as a
script; a site that refuses scripts is recorded as `blocked` and not tried
another way. With --no-fetch it fetches nothing and uses only the captures
and files an earlier run saved in WORK_DIRECTORY/documents (whose HTTP status
was not kept, so a saved error page simply fails the checks). PDF text comes from `pdftotext` (first three pages); scanned
PDFs without a text layer are not read. It then records, from the opening of
the text, whether its heading (first 1,500 characters) opens with the
document's own title for that kind ("Constitution ... of", "Corporate Charter
of") and the link's own name does not say it is another kind, whether the nation is named,
whether the fact's year appears, and whether the text is the document itself
(long enough, with articles or sections that are not packed together like a
table of contents) rather than a page that lists it; National Indian Law
Library index pages always count as listings.

`apply` sets `verification: read-in-full` only on facts whose document was
opened and passed every check (the meaning in decision record 0014: the part
of the document that states the value was read), adding one sentence to the
note. With --agree REVIEW.csv (the second gap review's
research/reviews/2026-11-22-governing-documents.csv) it also requires that
review to have confirmed the same link by text without a reviewer finding
otherwise, or a reviewer to have found it is the document itself. Facts not
confirmed stay in that review for the lead author; this script writes no
review file of its own.
"""

import concurrent.futures
import csv
import datetime
import glob
import hashlib
import io
import json
import pathlib
import re
import subprocess
import sys
import tarfile
import threading
import time
import urllib.parse

import requests
import yaml

PROJECT_FILES = pathlib.Path("/mnt/project-files")
CONSTITUTION_READINGS = PROJECT_FILES / "research/constitutions/read-all.json"
CONSTITUTION_CAPTURES = PROJECT_FILES / "research/captures/constitutions"
LAW_DOCUMENTS = pathlib.Path("research/tribal-law/documents.json")
USER_AGENT = "model-tribal-adr-code link checker (governing documents; 1 request per second per site)"
KIND_WORDS = {
    "constitution": r"constitution",
    "corporate-charter": r"corporate\s+charter|charter",
    "articles-of-association": r"articles\s+of\s+association",
    "law-code": r"\bcode\b|ordinance|title\s+[0-9IVX]+",
    "court-rules": r"rules",
}
# The document's own title line, as it opens: "Constitution and By-laws of the ...", "Corporate Charter
# of the ...". A page that only mentions a constitution does not open this way.
OWN_TITLE = {
    "constitution": r"constitution\s+(and\s+by-?\s*laws\s+)?of\b",
    "corporate-charter": r"corporate\s+charter\s+of\b",
    "articles-of-association": r"articles\s+of\s+association\s+of\b",
}
# A link whose own name says it is another kind (the University of Oklahoma names its pages ...cons and ...chrtr).
OTHER_KIND_LINK = {"constitution": r"chrtr|charter", "corporate-charter": r"cons\.html|constitution"}
STRUCTURE = re.compile(r"\b(article|section|sec\.|chapter)\s+[0-9IVXL]+", re.IGNORECASE)
COMMON = set("""the of and in a an to for tribe tribes tribal indian indians band bands nation nations community
communities village native reservation rancheria colony state california oklahoma alaska arizona nevada
washington new mexico minnesota wisconsin michigan montana north south dakota oregon idaho utah wyoming
kansas nebraska iowa texas florida louisiana maine york mission confederated council government people
federated association traditional inc united""".split())
OPENING = 6000
_lock = threading.Lock()
_last = {}


def normal(link):
    parts = urllib.parse.urlsplit(link)
    return (parts.hostname or "").lower().removeprefix("www."), parts.path.rstrip("/"), parts.query


def skip_set(ref):
    """Facts the branch REF gives a document_version: (profile id, title, link, source)."""
    if not ref:
        return set()
    archive = subprocess.run(["git", "archive", ref, "content/tribes"], capture_output=True, check=True).stdout
    found = set()
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        for member in tar.getmembers():
            if not member.name.endswith(".yaml"):
                continue
            profile = yaml.safe_load(tar.extractfile(member).read())
            for fact in profile.get("governing_documents") or []:
                if fact.get("document_version"):
                    found.add((profile["id"], fact.get("title"), fact.get("link"), fact.get("source")))
    return found


def capture_index():
    index = {}
    if CONSTITUTION_READINGS.exists():
        for reading in json.loads(CONSTITUTION_READINGS.read_text()):
            text = CONSTITUTION_CAPTURES / re.sub(r"\.[a-z]+$", ".txt", reading["capture"])
            for link in (reading.get("url"), reading.get("final_url")):
                if link and text.exists():
                    index.setdefault(normal(link), {"text": str(text), "via": "constitutions captures",
                                                    "format": reading.get("format")})
    if LAW_DOCUMENTS.exists():
        for document in json.loads(LAW_DOCUMENTS.read_text()):
            if not document.get("capture"):
                continue
            text = PROJECT_FILES / re.sub(r"\.[a-z]+$", ".txt", document["capture"])
            for link in (document.get("url"), document.get("final_url")):
                if link and text.exists():
                    index.setdefault(normal(link), {"text": str(text), "via": "tribal law captures",
                                                    "format": document.get("file_kind")})
    return index


def law_fetched():
    fetched = set()
    if LAW_DOCUMENTS.exists():
        for document in json.loads(LAW_DOCUMENTS.read_text()):
            for cited in document["cited_by"]:
                if cited["field"] == "governing_documents":
                    fetched.add((cited["nation"], cited["index"]))
    return fetched


def facts(skip, fetched):
    for path in sorted(glob.glob("content/tribes/*/*.yaml")):
        profile = yaml.safe_load(pathlib.Path(path).read_text(encoding="utf-8"))
        names = [profile["names"]["official"]] + [n.get("name", "") for key in ("alternate", "former", "other", "self_designation") for n in profile["names"].get(key) or []
                                                  if isinstance(n, dict)]
        for number, fact in enumerate(profile.get("governing_documents") or []):
            if fact.get("verification") != "title-only":
                continue
            if (profile["id"], fact.get("title"), fact.get("link"), fact.get("source")) in skip:
                group = "constitutions-pull-request"
            elif (profile["id"], number) in fetched and fact.get("kind") in ("law-code", "court-rules", "other"):
                group = "tribal-law-texts"
            elif not fact.get("link"):
                group = "no-link"
            else:
                group = "this-check"
            yield {"profile": path, "nation": profile["id"], "nation_names": names, "fact_number": number,
                   "group": group, **{k: fact.get(k) for k in ("kind", "title", "year", "link", "source")}}


def fetch(link, folder):
    host = urllib.parse.urlsplit(link).hostname
    with _lock:
        wait = _last.get(host, 0) + 1.0 - time.monotonic()
        _last[host] = time.monotonic() + max(wait, 0)
    if wait > 0:
        time.sleep(wait)
    try:
        response = requests.get(link, headers={"User-Agent": USER_AGENT}, timeout=30, allow_redirects=True)
    except requests.RequestException as error:
        return {"status": None, "error": f"{type(error).__name__}"}
    body = response.content[:30_000_000]
    kind = "pdf" if body[:5] == b"%PDF-" else "html"
    name = folder / (hashlib.sha256(link.encode()).hexdigest()[:20] + "." + kind)
    name.write_bytes(body)
    return {"status": response.status_code, "final_url": response.url, "file": str(name), "format": kind}


def text_of(result):
    if result.get("text"):
        return pathlib.Path(result["text"]).read_text(encoding="utf-8", errors="replace")
    file = result.get("file")
    if not file:
        return ""
    if result.get("format") == "pdf":
        out = subprocess.run(["pdftotext", "-l", "3", "-layout", file, "-"], capture_output=True)
        return out.stdout.decode("utf-8", "replace")
    html = pathlib.Path(file).read_text(encoding="utf-8", errors="replace")
    html = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", html)
    return re.sub(r"[ \t]+", " ", re.sub(r"<[^>]+>", " ", html))


def distinctive(names):
    words = set()
    for name in names:
        words |= {w for w in re.findall(r"[a-z][a-z'-]{2,}", name.lower()) if w not in COMMON}
    return words


def checks(item, text):
    opening = re.sub(r"\s+", " ", text[:OPENING])
    whole = re.sub(r"\s+", " ", text)
    lower = opening.lower()
    blocked = re.search(r"just a moment|captcha|access denied|request access|are you a robot", lower[:2000])
    # The kind must be named in the heading (the first 1,500 characters), not only somewhere in the text.
    kind = bool(re.search(OWN_TITLE.get(item["kind"], KIND_WORDS.get(item["kind"], r"$^")), lower[:1500])) and \
        not re.search(OTHER_KIND_LINK.get(item["kind"], r"$^"), item["link"].lower())
    nation_words = distinctive(item["nation_names"])
    named = sorted(w for w in nation_words if w in lower)
    title_words = distinctive([item["title"] or ""]) - {"constitution", "charter", "corporate", "code", "by-laws", "bylaws"}
    title_ok = all(w in lower for w in title_words) if title_words else True
    year = str(item["year"]) if item.get("year") else None
    year_ok = year in whole[:20000] if year else True
    structure = len(STRUCTURE.findall(whole))
    return {"characters": len(whole), "blocked_page": bool(blocked), "kind_named": kind,
            "nation_words_found": named, "nation_named": bool(named), "title_words_found": title_ok,
            "year_found": year_ok if year else None, "structure_marks": structure,
            # A table of contents has many article or section marks close together; a National Indian
            # Law Library index page is a table of contents by design, even where it holds more.
            "document_itself": (len(whole) >= 4000 and structure >= 5 and len(whole) / structure >= 150
                                and not re.search(r"narf\.org/nill/.*index\.html?$", item["link"]))}


def saved(link, folder):
    """A file an earlier, interrupted run of `gather` already fetched (its HTTP status was not kept)."""
    stem = hashlib.sha256(link.encode()).hexdigest()[:20]
    for kind in ("pdf", "html"):
        file = folder / f"{stem}.{kind}"
        if file.exists():
            return {"status": 200, "file": str(file), "format": kind, "via": "fetched on 2026-11-22"}
    return {"status": None, "error": "not opened (no capture, and --no-fetch)", "via": "not opened"}


def gather(work, ref, no_fetch=False):
    work = pathlib.Path(work)
    folder = work / "documents"
    folder.mkdir(parents=True, exist_ok=True)
    items = list(facts(skip_set(ref), law_fetched()))
    captures = capture_index()
    todo = [item for item in items if item["group"] == "this-check"]
    results = {}
    links = sorted({item["link"] for item in todo})

    def resolve(link):
        if normal(link) in captures:
            return link, dict(captures[normal(link)], status=200)
        if no_fetch:
            return link, saved(link, folder)
        return link, dict(fetch(link, folder), via="fetched")

    with concurrent.futures.ThreadPoolExecutor(6) as pool:
        for number, (link, result) in enumerate(pool.map(resolve, links), 1):
            results[link] = result
            if number % 50 == 0:
                print(f"{number}/{len(links)}", file=sys.stderr)
    for item in todo:
        result = results[item["link"]]
        item["opened"] = {k: result.get(k) for k in ("status", "final_url", "via", "format", "error")}
        status = result.get("status")
        text = text_of(result) if status and 200 <= status < 300 else ""
        item["checks"] = checks(item, text) if text.strip() else None
        item["outcome"] = outcome(item)
    (work / "governing-documents.json").write_text(json.dumps(items, indent=1, ensure_ascii=False))
    tally = {}
    for item in items:
        key = item["group"] + ":" + item.get("outcome", "-")
        tally[key] = tally.get(key, 0) + 1
    print(json.dumps(tally, indent=1, sort_keys=True))


def outcome(item):
    status = item["opened"]["status"]
    result = item["checks"]
    if status is None:
        return "no-response"
    if status in (401, 403, 429):
        return "blocked"
    if status in (404, 410):
        return "dead"
    if status >= 400:
        return "error-status"
    if result is None:
        return "no-text" if item["opened"].get("format") == "pdf" else "empty"
    if result["blocked_page"]:
        return "blocked"
    if not result["document_itself"]:
        return "listing-or-short-page"
    if result["kind_named"] and result["nation_named"] and result["title_words_found"] and result["year_found"] is not False:
        return "confirmed"
    return "does-not-match"


def agreed_by(review_csv):
    with open(review_csv, encoding="utf-8") as handle:
        return {(row["profile"], int(row["index"]), row["link"]) for row in csv.DictReader(handle)
                if (row["auto"] == "confirmed-by-text" and row["reviewer_verdict"] in ("", "the-document"))
                or row["reviewer_verdict"] == "the-document"}


def apply(work, today, review_csv=None):
    items = json.loads((pathlib.Path(work) / "governing-documents.json").read_text())
    agreed = agreed_by(review_csv) if review_csv else None
    confirmed = {}
    for item in items:
        if agreed is not None and (item["nation"], item["fact_number"], item["link"]) not in agreed:
            continue
        if item.get("outcome") == "confirmed":
            confirmed.setdefault(item["profile"], []).append(item)
    changed = 0
    for path, group in confirmed.items():
        text = pathlib.Path(path).read_text(encoding="utf-8")
        profile = yaml.safe_load(text)
        if yaml.safe_dump(profile, allow_unicode=True, sort_keys=False, width=100) != text:
            print(f"skipped (does not round-trip, edit by hand): {path}", file=sys.stderr)
            continue
        for item in group:
            fact = profile["governing_documents"][item["fact_number"]]
            if fact.get("link") != item["link"] or fact.get("verification") != "title-only":
                continue
            parts = ["kind", "nation", "title"] + ([f"year {item['year']}"] if item.get("year") else [])
            what = ", ".join(parts[:-1]) + " and " + parts[-1]
            note = (fact.get("note") or "").rstrip()
            if note and not note.endswith((".", ")", '"')):
                note += "."
            copy = {"constitutions captures": "the copy the constitution catalog work saved",
                    "tribal law captures": "the copy the tribal law texts work saved"}.get(
                        item["opened"]["via"], "a copy fetched for this check")
            fact["note"] = (note + f" Document opened on {today} ({copy}); its opening text"
                            f" names the {what}" + ("; the second gap review also confirmed this link."
                                                    if agreed is not None else ".")).strip()
            fact["verification"] = "read-in-full"
            changed += 1
        pathlib.Path(path).write_text(yaml.safe_dump(profile, allow_unicode=True, sort_keys=False, width=100),
                                      encoding="utf-8")
    print(f"facts set to read-in-full: {changed}")


def main(argv):
    if len(argv) < 2:
        sys.exit(__doc__)
    if argv[0] == "gather":
        gather(argv[1], argv[argv.index("--skip-ref") + 1] if "--skip-ref" in argv else None, "--no-fetch" in argv)
    elif argv[0] == "apply":
        apply(argv[1], argv[argv.index("--date") + 1] if "--date" in argv else datetime.date.today().isoformat(),
              argv[argv.index("--agree") + 1] if "--agree" in argv else None)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
