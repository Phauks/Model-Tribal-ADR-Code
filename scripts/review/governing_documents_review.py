"""Full check of every governing document link (Nov. 22, 2026), after the
second data gap review found that a page naming the nation and the kind of
document is often a page that lists the document, not the document itself.

    python3 scripts/review/governing_documents_review.py gather WORK_DIRECTORY
    python3 scripts/review/governing_documents_review.py merge WORK_DIRECTORY
    python3 scripts/review/governing_documents_review.py apply WORK_DIRECTORY

`gather` downloads every `governing_documents[].link` in the profiles (files
already in WORK_DIRECTORY/files are reused) and sorts each link by what the
page holds:

- full-text: the page is the document: at least 800 words naming the nation
  and the kind of document, with at least five article or section headings or
  opening with the document's own title;
- contents-page: a table of contents that names the nation, with at least
  three links to articles, titles or chapters; the first of those links is
  opened, and the item says whether it holds text;
- links-to-document: a page that names the nation and links to a PDF whose
  link text or address names the document; that PDF is opened and checked
  the same way;
- contents-only: a table of contents with no text online (the National
  Indian Law Library lists many documents whose nation has not let it post
  the text);
- error-or-empty: an error, sign-in, bot-check or nearly empty page;
- not-fetched: no page came back (the reason is kept);
- needs-review: anything else, for a reviewer.

Library of Congress item links (www.loc.gov/item/...) refuse automated
requests, so the item's JSON record and its full-text file are read instead.
A link used by three or more profiles is flagged `shared_by`.

Reviewers then follow research/reviews/briefs/2026-11-22-governing-documents-full.md
for every needs-review and not-fetched item and for a random calibration sample of the
script's own calls, writing WORK_DIRECTORY/verdicts-*.json. `merge` writes
research/reviews/2026-11-22-governing-documents-full.json, .csv (with an empty
`lead_author_decision` column) and -counts.json. Neither command edits a
profile. `apply` makes the plain corrections the review found (see its
docstring) and leaves every judgment call to the lead author.
"""

import collections
import concurrent.futures
import csv
import hashlib
import html
import json
import os
import pathlib
import random
import re
import subprocess
import sys
import threading
import urllib.error
import urllib.parse

import yaml

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import second_gap_review as base  # noqa: E402

ROOT = base.ROOT
OUT = base.REVIEWS / "2026-11-22-governing-documents-full"
HEADING = re.compile(r"\b(?:ARTICLE|Article)\s+[IVXLC\d]+\b|\b(?:SECTION|Section|Sec\.)\s*\d+|§\s*\d+")
CONTENTS_LINK = re.compile(r"^\s*(?:article|title|chapter|part|section|preamble|by-?laws?)\b", re.I)
BLOCKED = re.compile(r"security verification|verify you are (?:a )?human|captcha|enable (?:javascript|cookies)"
                     r"|cookies (?:are )?disabled|access denied|access blocked|log ?in to continue|password protected"
                     r"|page not found|404 not found|domain (?:is )?for sale", re.I)
ANCHOR = re.compile(r"<a\b[^>]*?href\s*=\s*[\"']([^\"'#]+)[\"'][^>]*>(.*?)</a>", re.S | re.I)
NO_TEXT = re.compile(r"not given permission for the full text|full text[^.]{0,40}not (?:available )?online", re.I)
FULL_TEXT_WORDS, FULL_TEXT_HEADINGS = 800, 5
# The script's labels in the reviewers' terms, so `final` has one vocabulary.
SCRIPT_VERDICT = {"full-text": "the-document", "contents-only": "page-naming-only",
                  "links-to-document": "page-linking-to-it", "error-or-empty": "error-or-empty"}


def cached_download(link, folder):
    path = folder / hashlib.sha1(link.encode()).hexdigest()[:16]
    meta = pathlib.Path(f"{path}.meta.json")
    if meta.exists():
        return json.loads(meta.read_text())
    loc = re.match(r"https?://(?:www\.)?loc\.gov/item/([^/?#]+)", link)
    try:
        if loc:
            _, _, record = base.fetch(f"https://www.loc.gov/item/{loc.group(1)}/?fo=json")
            record = json.loads(record)
            resource = (record.get("resources") or [{}])[0]
            text = ""
            if resource.get("fulltext_file"):
                _, _, data = base.fetch(resource["fulltext_file"])
                text = data.decode("utf-8", "ignore")
            data = f"<title>{html.escape(record['item'].get('title', ''))}</title>\n<pre>{html.escape(text)}</pre>".encode()
            result = dict(link=link, code=200, final=resource.get("pdf") or link, via="loc.gov item record")
        elif path.exists():
            data = path.read_bytes()
            result = dict(link=link, code=200, final=link, via="earlier download")
        else:
            code, final, data = base.fetch(link)
            result = dict(link=link, code=code, final=final)
    except urllib.error.HTTPError as error:
        result = dict(link=link, code=error.code, error=f"HTTP {error.code}")
        meta.write_text(json.dumps(result))
        return result
    except Exception as error:  # noqa: BLE001
        result = dict(link=link, code=None, error=f"{type(error).__name__}: {error}"[:120])
        meta.write_text(json.dumps(result))
        return result
    path.write_bytes(data)
    result["file"] = str(path)
    meta.write_text(json.dumps(result))
    return result


OCR_LOCKS = collections.defaultdict(threading.Lock)


def ocr_first_pages(path, pages=2):
    """Tesseract text of a scanned PDF's first pages, kept beside the file."""
    with OCR_LOCKS[str(path)]:
        return _ocr_first_pages(path, pages)


def _ocr_first_pages(path, pages):
    cache = pathlib.Path(f"{path}.ocr.txt")
    if cache.exists():
        return cache.read_text()
    out = f"{path}-ocr"
    subprocess.run(["pdftoppm", "-r", "150", "-l", str(pages), "-png", str(path), out], capture_output=True, timeout=300)
    text = ""
    for image in sorted(path.parent.glob(pathlib.Path(out).name + "*.png")):
        try:  # One thread each: the pool already runs many at once.
            text += subprocess.run(["tesseract", str(image), "-"], capture_output=True, text=True, timeout=300,
                                   env={**os.environ, "OMP_THREAD_LIMIT": "1"}).stdout
        except subprocess.TimeoutExpired:
            pass
        image.unlink(missing_ok=True)
    cache.write_text(text)
    return text


def read_page(path):
    """(visible text, anchors as (absolute href, link text), title, kind)."""
    path = pathlib.Path(path)
    data = path.read_bytes()
    if data[:4] == b"%PDF":
        text = subprocess.run(["pdftotext", "-l", "15", str(path), "-"], capture_output=True, text=True).stdout
        kind = "pdf"
        if len(text.split()) < 50:
            text, kind = ocr_first_pages(path), "pdf (OCR of first pages)"
        return text, [], "", kind
    raw = data.decode("utf-8", "ignore")
    raw = re.sub(r"<script.*?</script>|<style.*?</style>|<!--.*?-->", "", raw, flags=re.S | re.I)
    title = re.search(r"<title[^>]*>(.*?)</title>", raw, re.S | re.I)
    anchors = [(href.strip(), re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", inner))).strip())
               for href, inner in ANCHOR.findall(raw)]
    text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    return text, anchors, html.unescape(title.group(1)).strip() if title else "", "html"


def nation_words(item):
    names = [item["official_name"]] + item.get("other_names", [])
    found = set()
    for name in names:
        words = [w for w in base.normalized(name).split() if w not in base.STOP and len(w) > 2]
        found.update(words[:3])
    return found


def describe(text, item):
    norm = base.normalized(text)
    words = len(text.split())
    return dict(
        words=words,
        headings=len(HEADING.findall(text)),
        names_nation=any(re.search(rf"\b{re.escape(w)}\b", norm) for w in nation_words(item)),
        names_kind=any(w in norm for w in base.DOCUMENT_WORDS.get(item["kind"], [""])),
        blocked=bool(BLOCKED.search(text[:3000])) and words < 600,
    )


def full_text(facts, text, anchors):
    """The page is the document: long, names the nation and the kind of
    document, and either has many article or section headings or opens with
    the document's own title (charters number their paragraphs instead)."""
    if not (facts["words"] >= FULL_TEXT_WORDS and facts["names_nation"] and facts["names_kind"]):
        return False
    if facts["headings"] >= FULL_TEXT_HEADINGS:
        return True
    opening = base.normalized(text[:800])
    return ("table of contents" not in base.normalized(text) and len(anchors) <= 40
            and any(w in opening for w in ("constitution", "charter", "articles of association", "code", "ordinance")))


def child(link, folder):
    result = cached_download(link, folder)
    if not result.get("file"):
        return dict(link=link, error=result.get("error"))
    text, _, title, kind = read_page(result["file"])
    return dict(link=link, words=len(text.split()), headings=len(HEADING.findall(text)), title=title[:120], kind=kind,
                excerpt=re.sub(r"\s+", " ", text)[:600])


def classify(item, fetched, folder):
    result = fetched[item["link"]]
    item.update(code=result.get("code"), final_url=result.get("final"), via=result.get("via"))
    if not result.get("file"):
        item.update(script="not-fetched", reason=result.get("error") or f"HTTP {result.get('code')}")
        return item
    text, anchors, title, kind = read_page(result["file"])
    facts = describe(text, item)
    item.update(page_kind=kind, page_title=title[:160], **facts,
                excerpt=re.sub(r"\s+", " ", text)[:2500])
    base_url = result.get("final") or item["link"]
    if facts["blocked"] or facts["words"] < 40:
        item.update(script="error-or-empty", reason="bot-check, sign-in or error wording, or under 40 words")
        return item
    if NO_TEXT.search(text):
        item.update(script="contents-only", reason="the page says the full text is not online")
        return item
    if full_text(facts, text, anchors):
        item.update(script="full-text", reason=f"{facts['words']} words, {facts['headings']} headings")
        return item
    contents = [(urllib.parse.urljoin(base_url, href), label) for href, label in anchors if CONTENTS_LINK.match(label)]
    if "narf.org/nill/" in item["link"] and "table of contents" in base.normalized(text) and len(contents) < 3:
        item.update(script="contents-only", reason="National Indian Law Library table of contents with no links to text")
        return item
    if facts["names_nation"] and len(contents) >= 3:
        first = child(contents[0][0], folder)
        holds_text = first.get("words", 0) >= 300 and first.get("headings", 0) >= 1
        item.update(script="contents-page", contents_links=len(contents), first_linked_page=first,
                    reason=f"{len(contents)} article/title/chapter links; first linked page "
                           + ("holds text" if holds_text else "does not clearly hold text"))
        item["linked_text_confirmed"] = holds_text
        return item
    title_words = [w for w in base.normalized(item.get("title") or "").split() if w not in base.STOP and len(w) > 3]
    kind_words = base.DOCUMENT_WORDS.get(item["kind"], [])
    documents = [(urllib.parse.urljoin(base_url, href), label) for href, label in anchors
                 if re.search(r"\.pdf(\?|$)", href, re.I)
                 and any(w in base.normalized(label + " " + urllib.parse.unquote(href)) for w in kind_words + title_words)]
    if facts["names_nation"] and documents:
        target = documents[0][0]
        linked = child(target, folder)
        linked_facts = describe(linked.get("excerpt", ""), item) if linked.get("excerpt") else {}
        item.update(script="links-to-document", document_link=target, document_link_text=documents[0][1][:120],
                    document_page=linked,
                    reason=f"links to a PDF named for the document ({len(documents)} such link(s))")
        item["linked_document_names_kind"] = bool(linked_facts.get("names_kind"))
        return item
    item.update(script="needs-review", reason="none of the patterns above")
    return item


def gather(work):
    folder = work / "files"
    folder.mkdir(parents=True, exist_ok=True)
    tree = base.record_facts.Tree(ROOT)
    items = []
    for _, profile in sorted(tree.profiles.items()):
        names = profile.get("names") or {}
        others = [n.get("name") for key in ("alternate", "former") for n in (names.get(key) or [])
                  if isinstance(n, dict) and n.get("name")]
        for index, document in enumerate(profile.get("governing_documents") or []):
            if not document.get("link"):
                continue
            items.append(dict(profile=profile["id"], official_name=names.get("official", ""), other_names=others,
                              index=index, kind=document.get("kind"), title=document.get("title"),
                              year=document.get("year"), link=document["link"],
                              verification=document.get("verification"), source=document.get("source")))
    links = sorted({i["link"] for i in items})
    with concurrent.futures.ThreadPoolExecutor(16) as pool:
        fetched = {r["link"]: r for r in pool.map(lambda link: cached_download(link, folder), links)}
    shared = collections.Counter()
    users = collections.defaultdict(set)
    for item in items:
        users[item["link"]].add(item["profile"])
    with concurrent.futures.ThreadPoolExecutor(16) as pool:
        items = list(pool.map(lambda item: classify(item, fetched, folder), items))
    for item in items:
        if len(users[item["link"]]) >= 3:
            item["shared_by"] = len(users[item["link"]])
        shared[item["script"]] += 1
    (work / "items.json").write_text(json.dumps(items, indent=0, ensure_ascii=False) + "\n")
    random.seed(1122)
    # Reviewers also try the pages the script could not fetch, with their own tools.
    review = [i for i in items if i["script"] in ("needs-review", "not-fetched")]
    calibration = []
    for label, size in (("full-text", 25), ("contents-page", 20), ("contents-only", 15), ("links-to-document", 15)):
        pool_items = [i for i in items if i["script"] == label]
        calibration += random.sample(pool_items, min(size, len(pool_items)))
    for i, batch in enumerate(range(0, len(review), 40)):
        (work / f"batch-review-{i + 1:02d}.json").write_text(json.dumps(review[batch:batch + 40], indent=1, ensure_ascii=False) + "\n")
    (work / "batch-calibration.json").write_text(json.dumps(calibration, indent=1, ensure_ascii=False) + "\n")
    print(json.dumps(dict(shared), indent=1))


CLIMATE_PAGE = "https://narf.org/nill/triballaw/climate/index.html"
TIERS = {"the-document": "text at the link", "contents-page-with-text": "text one step away",
         "page-linking-to-it": "text one step away", "page-naming-only": "names the document only"}


def tier(item, final):
    """How far the link is from the document's text. The reviewers' spot check
    found that the script's full-text call on National Indian Law Library
    pages was a table of contents each time, so those count one step away."""
    if final == "the-document" and item["script"] == "full-text" and "narf.org/nill/" in item["link"]:
        return "text one step away"
    return TIERS.get(final, "link problem")


def merge(work):
    items = json.loads((work / "items.json").read_text())
    verdicts = {}
    for path in sorted(work.glob("verdicts-*.json")):
        for verdict in json.loads(path.read_text()):
            verdicts[(verdict["profile"], int(verdict["index"]))] = dict(verdict, batch=path.stem.removeprefix("verdicts-"))
    rows = []
    for item in items:
        verdict = verdicts.get((item["profile"], int(item["index"])), {})
        item["reviewer"] = {k: verdict.get(k) for k in ("verdict", "direct_link", "date_seen", "title_seen", "reason", "batch")} if verdict else None
        if verdict and item["script"] in ("needs-review", "not-fetched"):
            final = verdict.get("verdict")
        elif item["script"] == "contents-page":
            final = "contents-page-with-text" if item.get("linked_text_confirmed") else "page-naming-only"
        else:
            final = SCRIPT_VERDICT.get(item["script"], item["script"])
        if item["link"] == CLIMATE_PAGE:
            # Reviewers split on this one shared page; settle it the same way for every nation.
            named = bool(item.get("names_nation"))
            final = "page-linking-to-it" if named and "resolution" in (item.get("title") or "").lower() else "generic-page"
        item["final"] = final
        item["tier"] = tier(item, final)
        rows.append(dict(profile=item["profile"], index=item["index"], kind=item["kind"], title=item["title"],
                         year=item.get("year"), link=item["link"], verification=item.get("verification"),
                         script=item["script"], script_reason=item.get("reason"),
                         linked_text_confirmed=item.get("linked_text_confirmed", ""),
                         document_link=item.get("document_link", ""), shared_by=item.get("shared_by", ""),
                         reviewer_batch=verdict.get("batch", ""), reviewer_verdict=verdict.get("verdict", ""),
                         reviewer_direct_link=verdict.get("direct_link") or "",
                         reviewer_reason=verdict.get("reason", ""), final=final, tier=item["tier"],
                         lead_author_decision=""))
    # Page text stays in the work directory: it can hold officials' names and contact details.
    def without_text(value):
        if isinstance(value, dict):
            return {k: without_text(v) for k, v in value.items() if k != "excerpt"}
        return value
    slim = [without_text(item) for item in items]
    OUT.with_suffix(".json").write_text(json.dumps(slim, indent=1, ensure_ascii=False) + "\n")
    with OUT.with_suffix(".csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    calibration = collections.Counter((item["script"], item["reviewer"]["verdict"]) for item in items
                                      if item["reviewer"] and item["reviewer"]["batch"] == "calibration")
    counts = dict(
        links=len(items),
        script=dict(collections.Counter(i["script"] for i in items).most_common()),
        final=dict(collections.Counter(i["final"] for i in items).most_common()),
        tier=dict(collections.Counter(i["tier"] for i in items).most_common()),
        tier_by_verification={f"{t} / {v}": n for (t, v), n in sorted(collections.Counter(
            (i["tier"], i.get("verification")) for i in items).items())},
        contents_pages_with_linked_text=sum(1 for i in items if i.get("linked_text_confirmed")),
        shared_links=dict(collections.Counter(i["link"] for i in items if i.get("shared_by")).most_common()),
        calibration={f"{s} -> {v}": n for (s, v), n in sorted(calibration.items())},
        verification_levels=dict(collections.Counter(i.get("verification") for i in items).most_common()),
    )
    pathlib.Path(f"{OUT}-counts.json").write_text(json.dumps(counts, indent=1, ensure_ascii=False) + "\n")
    print(json.dumps(counts, indent=1, ensure_ascii=False))


# `apply` ------------------------------------------------------------------
# The plain corrections from the review, made on Nov. 22, 2026 after it merged.

HIJACKED = {  # Addresses that now serve unrelated gambling pages (reviewer verdicts).
    "http://www.stcciw.com/tribal-constitution",
    "https://www.tolc-nsn.gov/tohono-oodham-code/",
}
# Another nation's documents: the National Indian Law Library's Lumbee page lists the Native
# Village of Buckland, Alaska constitution and charter of 1950, and the Buckland profile already
# has the same four links.
WRONG_NATION = {"lumbee-tribe-of-north-carolina": {
    "https://thorpe.law.ou.edu/IRA/buckcons.html", "https://www.loc.gov/item/51061618/",
    "https://thorpe.law.ou.edu/IRA/buckchrtr.html", "https://www.loc.gov/item/51061567/"}}
# Direct links that passed the automatic check but are not the whole document the fact names:
# one part of a code, a single amendment, rules of conduct, an ERIC report, an unclear court file.
NOT_THE_DOCUMENT = {
    "https://www.cherokeecourts.org/LinkClick.aspx?fileticket=hwF-vw5YNeI%3d&tabid=364&portalid=11",
    "https://www.gilariver.org/view/download.php/government/ordinances/criminal-code-2018",
    "http://files.eric.ed.gov/fulltext/ED046553.pdf",
    "http://klamathtribalcourts.com/documents/49/Constitution_Amendment_to_Article_III.pdf",
    "https://ltbbodawa-nsn.gov/wp-content/uploads/2020/12/Constitutionally-Mandated-Rules-of-Conduct-for-All-Levels-of-Tribal-Government.pdf",
}
OPENING_WORDS = {"constitution": ["constitution"], "corporate-charter": ["charter"],
                 "articles-of-association": ["articles of association"],
                 "law-code": ["code", "ordinance", "title", "chapter", "law"], "court-rules": ["rule"]}
REVIEW_FILE = "research/reviews/2026-11-22-governing-documents-full.md"


def direct_text(item, link, folder):
    """Why `link` is not confirmed as the text of the document, or None if it is."""
    if link in NOT_THE_DOCUMENT:
        return "not the whole document"
    result = cached_download(link, folder)
    if not result.get("file"):
        return f"could not fetch ({result.get('error') or result.get('code')})"
    text, _, title, kind = read_page(result["file"])
    facts = describe(text, item)
    opening = base.normalized(title + " " + text[:1500])
    long_enough = facts["words"] >= 300 if kind.startswith("pdf") else (facts["words"] >= 800 and facts["headings"] >= 3)
    if facts["blocked"] or not (facts["names_nation"] and facts["names_kind"] and long_enough):
        return "text not confirmed"
    if not any(w in opening for w in OPENING_WORDS.get(item["kind"], [""])):
        return "does not open as the document"
    return None


def add_note(fact, sentence):
    fact["note"] = (str(fact["note"]).rstrip() + " " + sentence) if fact.get("note") else sentence


def apply(work):
    """Remove hijacked links, drop another nation's documents, and point links at the text
    where a reviewer (or, for a constitution or charter, the script) found it and the text
    checks out. Everything else waits for the lead author's decision column."""
    review = {(r["profile"], r["index"]): r for r in json.loads(OUT.with_suffix(".json").read_text())}
    tree = base.record_facts.Tree(ROOT)
    by_id = {profile["id"]: (path, profile) for path, profile in tree.profiles.items()}
    counts, skipped, changed = collections.Counter(), collections.Counter(), set()
    for (profile_id, index), row in sorted(review.items()):
        reviewer = row.get("reviewer") or {}
        if row["final"] in ("page-linking-to-it", "contents-page-with-text") and reviewer.get("direct_link") \
                and reviewer["direct_link"] != row["link"]:
            target = reviewer["direct_link"]
        elif row["script"] == "links-to-document" and row["final"] == "page-linking-to-it" and row.get("document_link") \
                and row["kind"] in ("constitution", "corporate-charter", "articles-of-association"):
            target = row["document_link"]
        else:
            continue
        if profile_id in WRONG_NATION:
            continue
        path, profile = by_id[profile_id]
        fact = (profile.get("governing_documents") or [])[index]
        if fact.get("link") != row["link"]:
            skipped["profile changed since the review"] += 1
            continue
        problem = direct_text(row, target, work / "files")
        if problem:
            skipped[problem] += 1
            continue
        fact["link"] = target
        add_note(fact, f"Link changed on 2026-11-22 from {row['link']}, a page that leads to the text, "
                       f"to the text itself ({REVIEW_FILE}).")
        counts["pointed at the text"] += 1
        changed.add(path)
    for path, profile in tree.profiles.items():
        documents = profile.get("governing_documents") or []
        for fact in documents:
            if fact.get("link") in HIJACKED:
                add_note(fact, f"Link {fact.pop('link')} removed on 2026-11-22: the address now serves an "
                               f"unrelated gambling page ({REVIEW_FILE}).")
                counts["hijacked link removed"] += 1
                changed.add(path)
        drop = WRONG_NATION.get(profile.get("id"), set())
        kept = [fact for fact in documents if fact.get("link") not in drop]
        if len(kept) != len(documents):
            counts["another nation's document removed"] += len(documents) - len(kept)
            profile["governing_documents"] = kept
            changed.add(path)
    for path in changed:
        record = {k: v for k, v in tree.profiles[path].items() if not k.startswith("_")}
        (ROOT / path).write_text(yaml.safe_dump(record, allow_unicode=True, sort_keys=False, width=100),
                                 encoding="utf-8")
    print(json.dumps(dict(changed=dict(counts), skipped=dict(skipped), profiles=len(changed)), indent=1))


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("gather", "merge", "apply"):
        sys.exit(__doc__)
    {"gather": gather, "merge": merge, "apply": apply}[sys.argv[1]](pathlib.Path(sys.argv[2]))
