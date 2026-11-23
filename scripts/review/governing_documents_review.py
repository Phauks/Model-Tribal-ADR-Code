"""Full check of every governing document link (Nov. 22, 2026), after the
second data gap review found that a page naming the nation and the kind of
document is often a page that lists the document, not the document itself.

    python3 scripts/review/governing_documents_review.py gather WORK_DIRECTORY
    python3 scripts/review/governing_documents_review.py merge WORK_DIRECTORY
    python3 scripts/review/governing_documents_review.py apply WORK_DIRECTORY
    python3 scripts/review/governing_documents_review.py crosscheck WORK_DIRECTORY

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

`crosscheck` (Nov. 23, 2026) compares the review with what the project's
other document searches hold: the constitution catalog
(research/constitutions/), the tribal law texts (research/tribal-law/), the
capture index, the search logs and the Nov. 23 retry of failed fetches. It
fills the CSV's `other_searches` column, writes the facts that have no link at
all to research/reviews/2026-11-23-governing-documents-without-links.csv, and
points three links at texts those searches downloaded (see CONFIRMED_ELSEWHERE).
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


# `crosscheck` ---------------------------------------------------------------
# Nov. 23, 2026: the lead author asked that the review be checked against the
# documents other threads had found since.

WITHOUT_LINKS = base.REVIEWS / "2026-11-23-governing-documents-without-links.csv"
CONSTITUTION_TYPES = {
    "constitution": {"constitution", "constitution-and-bylaws", "bylaws", "amendment", "proposed-constitution"},
    "corporate-charter": {"corporate-charter"},
    "articles-of-association": {"articles-of-association", "constitution", "constitution-and-bylaws"},
}
# Code Publishing pages captured on Nov. 21, 2026 say each code moved to eCode360
# (research/captures/tribal-law/documents/7268a810a0c01c6c561f.txt, 428fd8c53abb9007273f.txt,
# fca87baa71d190b465fb.txt). eCode360 refuses automated requests, so the new addresses are unread.
MOVED = {"codepublishing.com/wa/chehalistribe": "https://ecode360.com/CH4710",
         "codepublishing.com/wa/puyalluptribe": "https://ecode360.com/PU4881",
         "codepublishing.com/wa/tulalip": "https://ecode360.com/TU4849"}
# Direct links the 2026-11-22 `apply` could not confirm with its own download, but whose text
# another collection downloaded and read: (profile, index) -> (old link, new link, evidence).
CONFIRMED_ELSEWHERE = {
    ("hopi-tribe-of-arizona", 2): (
        "http://www.hopi-nsn.gov/judicial-branch/hopi-code-of-laws-and-rules-of-civil-procedures/",
        "https://www.hopi-nsn.gov/wp-content/uploads/2025/03/HOPI-CODE-UPDATED.pdf",
        "the tribal law texts collection downloaded it on 2026-11-21, and it is the Hopi Code as enacted "
        "August 28, 2012 and amended through July 2020 (research/tribal-law/documents.json)"),
    ("cheyenne-and-arapaho-tribes", 1): (
        "https://www.cheyenneandarapaho-nsn.gov/legislative/tribal-codes-acts-and-ordinances",
        "https://cdn.prod.website-files.com/625854e97e951a806fc03c22/66f2df79fdd57da455bc6c2c_Constitution.pdf",
        "the constitution catalog downloaded and read it on 2026-11-21 as the Tribes' amended constitution "
        "of 2006, amended 2021 (research/constitutions/documents.csv, row cheyenne-and-arapaho-tribes:34748b55b07139a4)"),
    ("walker-river-paiute-tribe-of-the-walker-river-reservation", 3): (
        "https://www.wrpt.org/tribal-government/#Constitution",
        "https://www.wrpt.org/wp-content/uploads/Constitution-and-By-Laws-of-the-Walker-River-Paiute-Tribe-of-Nevada.pdf",
        "the constitution catalog downloaded and read it on 2026-11-21 as the Tribe's 1937 constitution and "
        "by-laws with amendments (research/constitutions/documents.csv, "
        "row walker-river-paiute-tribe-of-the-walker-river-reservation:b2410091679011ad)"),
}
CROSSCHECK_NOTE = "research/reviews/2026-11-22-governing-documents-full.md, section on the other document searches"
ERROR_TITLE = re.compile(r"just a moment|attention required|not found|error|forbidden|access denied|waf block|slot", re.I)


def link_key(link):
    """A link without scheme, www., fragment or trailing slash, for matching across files."""
    if not link:
        return ""
    link = link.strip()
    archived = re.match(r"https?://web\.archive\.org/web/\d+[a-z_]*/(.*)", link)
    if archived:
        link = archived.group(1)
    link = re.sub(r"#.*$", "", re.sub(r"^https?://", "", link, flags=re.I))
    host, _, path = link.partition("/")
    host = host.lower().removeprefix("www.")
    return (host + "/" + urllib.parse.unquote(path)).rstrip("/").lower()


def other_holdings():
    research = ROOT / "research"
    catalog = list(csv.DictReader((research / "constitutions/documents.csv").open(encoding="utf-8")))
    coverage = {r["nation"]: r for r in csv.DictReader((research / "constitutions/coverage.csv").open(encoding="utf-8"))}
    by_nation = collections.defaultdict(list)
    catalog_links = collections.defaultdict(list)
    for row in catalog:
        by_nation[row["nation"]].append(row)
        if row["link"]:
            catalog_links[link_key(row["link"])].append(row)
    wayback_prints = collections.defaultdict(list)
    for row in csv.DictReader((research / "capture-index.csv").open(encoding="utf-8")):
        if row["key"].startswith("constitutions/") and "Wayback" in row["title"] and row["link"]:
            wayback_prints[link_key(row["link"])].append(row)
    law_texts = {}
    for row in json.loads((research / "tribal-law/documents.json").read_text()):
        if str(row["http_status"]) == "200" and (row["characters"] or 0) > 3000 \
                and not ERROR_TITLE.search(row["page_title"] or ""):
            law_texts.setdefault(link_key(row["url"]), row)
    retried = collections.defaultdict(list)
    for row in csv.DictReader((base.REVIEWS / "2026-11-23-retry-batch-6.csv").open(encoding="utf-8")):
        if row["outcome"] == "found":
            retried[link_key(row["address_tried"])].append(row)
    # Hand-pulled constitutions added after the catalog was built: version histories (PR #123) and
    # captures filed under constitutions/<nation>/ that wait for the catalog.
    histories = {p.stem.removesuffix("-constitution") for p in (ROOT / "content/documents").glob("*/*-constitution.yaml")}
    later = collections.Counter()
    for row in csv.DictReader((research / "capture-index.csv").open(encoding="utf-8")):
        parts = row["key"].split("/")
        if parts[0] == "constitutions" and len(parts) == 3 and not row["key"].endswith((".txt", ".json", ".raw")):
            later[parts[1]] += 1
    return dict(by_nation=by_nation, coverage=coverage, catalog_links=catalog_links, histories=histories, later=later,
                wayback_prints=wayback_prints, law_texts=law_texts, retried=retried)


def held_texts(held, profile, kind, year):
    """What the constitution catalog holds for this nation and kind of document."""
    types = CONSTITUTION_TYPES.get(kind)
    if not types:
        return None
    texts = [d for d in held["by_nation"].get(profile, []) if d["document_type"] in types and d["completeness"] == "full-text"]
    if not texts:
        if kind == "constitution" and (profile in held["histories"] or held["later"].get(profile)):
            return dict(status="text held outside the catalog",
                        note="A hand-pulled constitution for the nation is held (a version history in content/documents/ "
                             "or a capture under constitutions/ that waits for the catalog); not compared with this fact.")
        return dict(status="no text held", note="")
    years = {(d.get(f) or "")[:4] for d in texts for f in ("adopted", "approved", "effective", "latest_amendment")} - {""}
    newest = held["coverage"].get(profile, {})
    label = newest.get("newest_version_label") or "undated"
    if not year:
        status = "text held, fact has no year"
    elif str(year)[:4] in years:
        status = "text held, same year"
    else:
        status = "text held, other year"
    note = (f"The constitution catalog holds {len(texts)} full text(s) of this kind for the nation "
            f"(newest version: {label}; currency {newest.get('newest_version_status') or 'unknown'})"
            + (", including one of this year." if status == "text held, same year" else "."))
    return dict(status=status, note=note)


def crosscheck_row(row, held):
    notes, tags = [], []
    key = link_key(row["link"])
    same_text = [d for d in held["catalog_links"].get(key, []) if d["nation"] == row["profile"]]
    if same_text and row["tier"] == "link problem" and row["final"] == "error-or-empty":
        d = same_text[0]
        notes.append(f"The constitution catalog downloaded this link's text through the item's JSON view on 2026-11-22 "
                     f"({d['printed_title'][:80]}; {d['key']}), so the error was this review's fetch timing out, not the link.")
        tags.append("link holds the text (catalog)")
    for d in held["wayback_prints"].get(key, [])[:1]:
        notes.append(f"A Wayback Machine print of this page, hand-pulled on Nov. 22, holds the text ({d['key']}).")
        tags.append("Wayback copy held")
    for d in held["retried"].get(key, [])[:1]:
        notes.append(f"The Nov. 23 retry read a Wayback Machine copy ({d['address_read']}): {d['reason']}")
        tags.append("Wayback copy read")
    for old, new in MOVED.items():
        if key.startswith(old):
            notes.append(f"Code Publishing now sends readers to {new} (eCode360), which refuses automated requests; unread.")
            tags.append("moved to eCode360")
    for target in (row["reviewer_direct_link"], row["document_link"]):
        t = link_key(target)
        if not t or t == key:
            continue
        if any(d["nation"] == row["profile"] for d in held["catalog_links"].get(t, [])):
            notes.append(f"The constitution catalog downloaded and read the direct link {target}.")
            tags.append("direct link read (catalog)")
            break
        if t in held["law_texts"]:
            notes.append(f"The tribal law texts collection downloaded the direct link {target} on 2026-11-21.")
            tags.append("direct link downloaded (tribal law)")
            break
    catalog = held_texts(held, row["profile"], row["kind"], row["year"])
    if catalog and row["tier"] != "text at the link":
        if catalog["note"]:
            notes.append(catalog["note"])
        tags.append(catalog["status"])
    return " ".join(notes), tags


def fact_lines(lines, field, index):
    """The first and past-the-end line numbers of item `index` of a top-level list in a YAML file."""
    top = next(i for i, line in enumerate(lines) if line.startswith(f"{field}:"))
    starts, end = [], len(lines)
    for i in range(top + 1, len(lines)):
        line = lines[i]
        if line.startswith("- "):
            starts.append(i)
        elif line.strip() and not line.startswith((" ", "-")):
            end = i
            break
    return starts[index], (starts[index + 1] if index + 1 < len(starts) else end)


def crosscheck(work):
    held = other_holdings()
    csv_path = OUT.with_suffix(".csv")
    rows = list(csv.DictReader(csv_path.open(encoding="utf-8")))
    counts = collections.Counter()
    for row in rows:
        note, tags = crosscheck_row(row, held)
        row["other_searches"] = note
        for tag in tags:
            counts[f"{row['tier']} / {tag}"] += 1
    columns = [c for c in rows[0] if c not in ("other_searches", "lead_author_decision")] + ["other_searches", "lead_author_decision"]
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    # Facts with no link at all were outside the link review.
    tree = base.record_facts.Tree(ROOT)
    linkless = []
    for path, profile in sorted(tree.profiles.items()):
        for index, fact in enumerate(profile.get("governing_documents") or []):
            if fact.get("link"):
                continue
            catalog = held_texts(held, profile["id"], fact.get("kind"), fact.get("year"))
            status = catalog["status"] if catalog else "not a constitution, charter or articles"
            counts[f"no link / {status}"] += 1
            linkless.append(dict(profile=profile["id"], index=index, kind=fact.get("kind"), title=fact.get("title"),
                                 year=fact.get("year") or "", verification=fact.get("verification"),
                                 why_no_link=re.sub(r"\s+", " ", str(fact.get("note") or ""))[:300],
                                 other_searches=catalog["note"] if catalog else "", lead_author_decision=""))
    with WITHOUT_LINKS.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(linkless[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(linkless)

    # Links the other collections confirm.
    by_id = {profile["id"]: (path, profile) for path, profile in tree.profiles.items()}
    changed = collections.defaultdict(dict)
    # Library of Congress items this review's fetch timed out on, which the catalog read in full.
    for row in rows:
        if "through the item's JSON view" not in row["other_searches"]:
            continue
        path, profile = by_id[row["profile"]]
        fact = profile["governing_documents"][int(row["index"])]
        if fact.get("link") != row["link"] or fact.get("verification") != "title-only":
            continue
        fact["verification"] = "read-in-full"
        add_note(fact, f"Document opened on 2026-11-22 (the copy the constitution catalog work saved, "
                       f"{row['other_searches'].split('; ')[1].split(')')[0]}); the full link review's error on "
                       f"this link was its own fetch timing out. See {CROSSCHECK_NOTE}.")
        counts["catalog copy: marked read in full"] += 1
        changed[path][int(row["index"])] = fact
    for (profile_id, index), (old, new, evidence) in CONFIRMED_ELSEWHERE.items():
        path, profile = by_id[profile_id]
        fact = profile["governing_documents"][index]
        if fact.get("link") != old:
            counts["confirmed elsewhere: profile changed since"] += 1
            continue
        fact["link"] = new
        add_note(fact, f"Link changed on 2026-11-23 from {old}, a page that leads to the text, to the text "
                       f"itself; {evidence}. See {CROSSCHECK_NOTE}.")
        counts["confirmed elsewhere: pointed at the text"] += 1
        changed[path][index] = fact
    for path, edits in changed.items():
        lines = (ROOT / path).read_text(encoding="utf-8").splitlines(keepends=True)
        for index, fact in sorted(edits.items(), reverse=True):
            first, last = fact_lines(lines, "governing_documents", index)
            # Rewrite only the changed fact, one line per value (no hard wrapping).
            lines[first:last] = [yaml.safe_dump([fact], allow_unicode=True, sort_keys=False, width=1_000_000)]
        (ROOT / path).write_text("".join(lines), encoding="utf-8")
        check = yaml.safe_load((ROOT / path).read_text(encoding="utf-8"))
        assert all(check["governing_documents"][i] == f for i, f in edits.items()), path
    counts_path = pathlib.Path(f"{OUT}-counts.json")
    summary = json.loads(counts_path.read_text())
    summary["other_searches"] = dict(sorted(counts.items()))
    counts_path.write_text(json.dumps(summary, indent=1, ensure_ascii=False) + "\n")
    print(json.dumps(summary["other_searches"], indent=1, ensure_ascii=False))


if __name__ == "__main__":
    commands = {"gather": gather, "merge": merge, "apply": apply, "crosscheck": crosscheck}
    if len(sys.argv) != 3 or sys.argv[1] not in commands:
        sys.exit(__doc__)
    commands[sys.argv[1]](pathlib.Path(sys.argv[2]))
