"""Read the scanned Tribal gaming ordinances (no text layer) as page images.

`scripts/review/ordinance_disputes.py batches` logged 330 ordinance documents
as `scanned-unreadable`: their pages are images with no text layer, and no OCR
tool was available. This script prepares those documents for reviewers who
read the page images, then merges what they recorded into the ordinance
dispute review.

    python3 scripts/review/ordinance_scans.py select      --work WORK [--nations FILE]
    python3 scripts/review/ordinance_scans.py download    --work WORK [--pause 3]
    python3 scripts/review/ordinance_scans.py pages       --work WORK
    python3 scripts/review/ordinance_scans.py batches     --work WORK [--force]
    python3 scripts/review/ordinance_scans.py merge-scans --work WORK

WORK is the work folder of `ordinance_disputes.py` (it reads
WORK/documents-checked.json and WORK/nations.json); everything this script
writes there goes under WORK/scans/.

select       First tier: the nations whose search log under
             research/search-logs/gaming-dispute-procedures/ is
             `partly-searched` (or the profile ids listed in --nations). For
             each, it lists the scanned documents newest first and picks the
             newest full ordinance on the list (if it is scanned) plus the
             scanned amendments listed on or after it, newest first, at most 3,
             one copy of a file listed twice. Second tier: the same choice for
             every other nation, listed but not downloaded. Writes
             WORK/scans/first-tier.json and WORK/scans/second-tier.json.
download     Downloads each first-tier PDF from its public link on the
             National Indian Gaming Commission's site, one at a time with a
             pause, into WORK/scans/pdf/. A response that is not a PDF is
             logged `blocked`, and a 403 or 429 stops the run: no attempt is
             made to get around a refusal. Writes WORK/scans/download-log.tsv
             (status, bytes, sha256, pages; the sha256 is compared with the
             gaming thread's capture).
pages        Classifies every page: `nigc-letter` (a text layer with the
             Commission's name and a letter's salutation or closing), `text`
             (another page with a text layer), `blank` (almost no ink on a
             20 dpi rendering) or `image`. A page that is only an image cannot
             be classified further without OCR, so an approval letter scanned
             as an image is an `image` page. Writes WORK/scans/page-kinds.json.
batches      Writes reviewer batches (about 8 documents or 150 planned pages)
             to WORK/scans/batches/scan-batch-NNN.json, with a reading plan for
             each document: every page when it has 40 pages or fewer, else
             the first 6 pages, the contents, then the dispute parts, within a
             40-page budget. Approval letter pages are left out of the ranges.
             Refuses to overwrite existing batches without --force, because
             the verdicts are numbered by batch. Reviewers follow
             research/reviews/briefs/2026-11-23-ordinance-scans.md and write
             WORK/scans/verdicts/scan-batch-NNN.json.
merge-scans  Adds the reviewers' items to
             research/reviews/2026-11-22-ordinance-disputes.{json,csv} with
             ids ending `#p<n>`, in the review's item format: quote check
             "copied from the page image; no text layer to check",
             verification `read-in-full` only when every page was read,
             `partly-read` flags, the `compact-terms` and `no-steps` flags of
             `ordinance_disputes.py grab`, the lead author's grab-now decision,
             and the second looks in WORK/scans/second-look.json. A later
             verdict file replaces an earlier one for the same document.
             Appends a search entry for each document read to the nation's
             search log and sets its status, updates the counts file, and
             writes the snippets to the private copy under
             /mnt/project-files/research/ordinance-disputes/. Running it again
             replaces what it added before.

The PDFs, batches and verdicts stay in the private work folder: the
ordinances are the nations' own laws, and the project cites and links them
rather than republishing them. It never changes a profile.

Needs Python 3, curl, and poppler's pdfinfo, pdftotext and pdftoppm;
`merge-scans` also needs PyYAML (scripts/requirements.txt).
"""

import argparse
import collections
import csv
import hashlib
import json
import pathlib
import random
import re
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ordinance_disputes as base  # noqa: E402

ROOT = base.ROOT
SCAN_DATE = "2026-11-23"
LOG_ROOT = ROOT / "research/search-logs" / base.SEARCH_LOG_TOPIC
FIRST_READER = "small-model reviewer (Claude, AI assistant), from page images"
SECOND_READER = "Claude (AI assistant), spot check against the page image"
QUOTE_CHECK = "copied from the page image; no text layer to check"
QUERY = ("read scanned PDF page images: patron or gaming public disputes, complaints and claims, grievances, "
         "licensing hearings framed as disputes, arbitration, mediation, peacemaking and Tribal court review")
PLACE_KIND = "nigc-ordinance-pdf"
MAX_PER_NATION = 3
MAX_PAGES_PER_CALL = 20
FULL_READ_LIMIT = 40
LONG_BUDGET = 40
CONTENTS_PAGES = 6
BATCH_DOCUMENTS = 8
BATCH_PAGES = 150
BLANK_INK = 0.0002
SPOT_CHECK_SEED = 20261123
COMPACT_WORDS = re.compile(r"compact", re.I)
SCAN_COMPACT_FLAG = ("compact-terms: the item refers to the Tribal-State compact; recorded by the page-image "
                     "reader under the lead author's grab-now rule")
LETTER_CLOSING = re.compile(r"\bdear\b|\bsincerely\b", re.I)


def scans_dir(work):
    return pathlib.Path(work) / "scans"


def load_json(path):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))


def write_json(path, data):
    pathlib.Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def expand(ranges):
    """Turn ["1-20", "35", 41] into a set of page numbers."""
    pages = set()
    for value in ranges or []:
        for part in str(value).split(","):
            part = part.strip()
            if not part:
                continue
            if "-" in part:
                start, end = part.split("-", 1)
                pages.update(range(int(start), int(end) + 1))
            else:
                pages.add(int(part))
    return pages


def compress(pages, longest=MAX_PAGES_PER_CALL):
    """Turn a list of page numbers into ranges of at most `longest` pages, for example ["1-20", "21-26"]."""
    out, start, previous = [], None, None
    for page in sorted(pages) + [None]:
        if start is not None and (page is None or page != previous + 1 or page - start >= longest):
            out.append(f"{start}-{previous}" if previous != start else f"{start}")
            start = None
        if page is not None and start is None:
            start = page
        previous = page
    return out


# ---------------------------------------------------------------- select

def nation_choice(documents):
    """The nation's scanned documents, newest first, and the ones to read."""
    ordered = sorted(documents, key=lambda d: (d["listed_date"] or "", d["kind"] == "ordinance"), reverse=True)
    scanned = [d for d in ordered if d["outcome"] == "scanned-unreadable"]
    ordinances = [d for d in ordered if d["kind"] == "ordinance"]
    newest = ordinances[0] if ordinances else None
    anchor = newest["listed_date"] if newest else ""
    chosen, files = [], set()
    for document in scanned:
        if (document["listed_date"] or "") < anchor:
            continue
        if document["kind"] != "amendment" and document is not newest:
            continue
        key = document.get("sha256") or document["final_link"] or document["link"]
        if key in files:
            continue
        files.add(key)
        chosen.append(document)
    return scanned, chosen[:MAX_PER_NATION], newest


def select(args):
    import yaml
    work = pathlib.Path(args.work)
    out = scans_dir(work)
    out.mkdir(parents=True, exist_ok=True)
    documents = load_json(work / "documents-checked.json")
    by_nation = collections.defaultdict(list)
    for document in documents:
        for nation in document["nations"]:
            by_nation[nation].append(document)
    if args.nations:
        first = pathlib.Path(args.nations).read_text(encoding="utf-8").split()
    else:
        first = sorted(path.stem for path in LOG_ROOT.glob("*/*.yaml")
                       if yaml.safe_load(path.read_text(encoding="utf-8"))["status"] == "partly-searched")

    def row(document, chosen):
        return {"document": document["id"], "kind": document["kind"], "listed_date": document["listed_date"],
                "pages": document["pages"], "final_link": document["final_link"] or document["link"],
                "selected": document["id"] in chosen}

    def tier(nations):
        entries = []
        for nation in nations:
            scanned, chosen, newest = nation_choice(by_nation.get(nation, []))
            ids = {d["id"] for d in chosen}
            entries.append({"profile": nation, "newest_ordinance": newest and newest["id"],
                            "newest_ordinance_outcome": newest and newest["outcome"],
                            "scanned_documents": [row(d, ids) for d in scanned],
                            "selected": [d["id"] for d in chosen]})
        return entries

    first_entries = tier(first)
    chosen_ids = list(dict.fromkeys(i for e in first_entries for i in e["selected"]))
    write_json(out / "first-tier.json", {"partly_searched_nations": first, "nations": first_entries,
                                         "documents": chosen_ids})
    second_entries = [e for e in tier(sorted(n for n in by_nation if n not in first)) if e["scanned_documents"]]
    pages = {d["id"]: d["pages"] or 0 for d in documents}
    no_profile = [{"document": d["id"], "list_nation_column": d["list_nation_column"],
                   "listed_date": d["listed_date"], "pages": d["pages"], "final_link": d["final_link"] or d["link"]}
                  for d in documents if d["outcome"] == "scanned-unreadable" and not d["nations"]]
    counts = {
        "nations_with_scanned_documents": len(second_entries),
        "scanned_documents": sum(len(e["scanned_documents"]) for e in second_entries),
        "scanned_pages": sum(r["pages"] or 0 for e in second_entries for r in e["scanned_documents"]),
        "selected_documents": sum(len(e["selected"]) for e in second_entries),
        "selected_pages": sum(pages[i] for e in second_entries for i in e["selected"]),
        "nations_with_a_selected_document": sum(1 for e in second_entries if e["selected"]),
        "scanned_documents_without_a_profile": len(no_profile),
    }
    write_json(out / "second-tier.json", {
        "note": ("Second tier: scanned-unreadable documents of nations outside the first tier. Not downloaded. "
                 "'selected' applies the first-tier rule: the newest full ordinance on the list (if scanned) plus "
                 "scanned amendments listed on or after it, newest first, at most 3 per nation, one copy of a file "
                 "listed twice."),
        "counts": counts, "nations": second_entries, "documents_without_a_profile": no_profile})
    print(json.dumps({"first_tier_nations": len(first), "first_tier_documents": len(chosen_ids),
                      "second_tier": counts}, indent=1))


# ---------------------------------------------------------------- download

def pdf_pages(path):
    result = subprocess.run(["pdfinfo", str(path)], capture_output=True, text=True)
    for line in result.stdout.splitlines():
        if line.startswith("Pages:"):
            return int(line.split()[1])
    return None


def download(args):
    work = pathlib.Path(args.work)
    out = scans_dir(work)
    (out / "pdf").mkdir(parents=True, exist_ok=True)
    checked = {d["id"]: d for d in load_json(work / "documents-checked.json")}
    first = load_json(out / "first-tier.json")
    rows = []
    for document_id in first["documents"]:
        record = checked[document_id]
        url = record["final_link"] or record["link"]
        target = out / "pdf" / f"{document_id}.pdf"
        code = "cached"
        if not target.exists() or target.stat().st_size == 0:
            result = subprocess.run(["curl", "-sS", "-L", "--max-time", "180", "-A",
                                     "Mozilla/5.0 (compatible; research-download)", "-o", str(target),
                                     "-w", "%{http_code}", url], capture_output=True, text=True)
            code = result.stdout.strip() or "error"
            time.sleep(args.pause)
        is_pdf = target.exists() and target.read_bytes()[:5] == b"%PDF-"
        if is_pdf:
            data = target.read_bytes()
            digest = hashlib.sha256(data).hexdigest()
            status = "ok" if digest == record.get("sha256") else "sha-differs"
            rows.append([document_id, code, len(data), digest, record.get("sha256") or "", pdf_pages(target), status])
        else:
            if target.exists():
                target.rename(out / f"blocked-{document_id}.bin")
            rows.append([document_id, code, "", "", record.get("sha256") or "", "", "blocked"])
            if code in ("403", "429"):
                print(f"stopped: the site refused {url} ({code})", file=sys.stderr)
                break
    with (out / "download-log.tsv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, delimiter="\t", lineterminator="\n")
        writer.writerow(["document", "http", "bytes", "sha256", "expected_sha256", "pages", "status"])
        writer.writerows(rows)
    print(json.dumps(dict(collections.Counter(r[-1] for r in rows))))


# ---------------------------------------------------------------- pages

def read_pgm(path):
    """Return (width, height, pixel bytes) of a binary PGM file written by pdftoppm."""
    data = path.read_bytes()
    fields, position = [], 2
    while len(fields) < 3:
        while data[position:position + 1].isspace():
            position += 1
        if data[position:position + 1] == b"#":
            position = data.index(b"\n", position) + 1
            continue
        end = position
        while not data[end:end + 1].isspace():
            end += 1
        fields.append(int(data[position:end]))
        position = end
    return fields[0], fields[1], data[position + 1:]


def ink(path):
    """Share of dark pixels in the page, leaving out a 5 percent margin (scanner edges)."""
    width, height, pixels = read_pgm(path)
    top, bottom = int(height * 0.05), int(height * 0.95)
    left, right = int(width * 0.05), int(width * 0.95)
    dark = total = 0
    for row in range(top, bottom):
        line = pixels[row * width + left:row * width + right]
        dark += sum(1 for value in line if value < 160)
        total += len(line)
    return dark / max(1, total)


def page_kind(text, ink_share):
    characters = len("".join(text.split()))
    if characters > 150:
        # A letter needs the Commission's name and a salutation or closing; the name alone also appears in
        # ordinance text (for example sections on notices to the Commission).
        if base.LETTER_MARK.search(text) and LETTER_CLOSING.search(text):
            return "nigc-letter", characters
        return "text", characters
    if ink_share < BLANK_INK:
        return "blank", characters
    return "image", characters


def pages(args):
    out = scans_dir(args.work)
    kinds = {}
    for pdf in sorted((out / "pdf").glob("*.pdf")):
        count = pdf_pages(pdf)
        entries = []
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(["pdftoppm", "-r", "20", "-gray", str(pdf), f"{tmp}/p"], check=True)
            images = sorted(pathlib.Path(tmp).glob("p-*.pgm"), key=lambda p: int(p.stem.split("-")[-1]))
            for number in range(1, count + 1):
                text = subprocess.run(["pdftotext", "-f", str(number), "-l", str(number), "-layout", str(pdf), "-"],
                                      capture_output=True, text=True).stdout
                share = ink(images[number - 1])
                kind, characters = page_kind(text, share)
                entries.append({"page": number, "kind": kind, "ink": round(share, 4), "text_chars": characters})
        kinds[pdf.stem] = entries
        print(pdf.stem, count, dict(collections.Counter(e["kind"] for e in entries)), flush=True)
    write_json(out / "page-kinds.json", kinds)


# ---------------------------------------------------------------- batches

def batches(args):
    work = pathlib.Path(args.work)
    out = scans_dir(work)
    if list((out / "batches").glob("scan-batch-*.json")) and not args.force:
        sys.exit("batches already exist; the verdicts are numbered by batch, so pass --force to rewrite them")
    checked = {d["id"]: d for d in load_json(work / "documents-checked.json")}
    nations = load_json(work / "nations.json")
    first = load_json(out / "first-tier.json")
    kinds = load_json(out / "page-kinds.json")
    downloads = {r["document"]: r for r in csv.DictReader((out / "download-log.tsv").open(encoding="utf-8"),
                                                           delimiter="\t")}

    def entry(document_id):
        record = checked[document_id]
        page_list = kinds[document_id]
        letter = [p["page"] for p in page_list if p["kind"] == "nigc-letter"]
        readable = [p["page"] for p in page_list if p["kind"] != "nigc-letter"]
        item = {"document": document_id, "nations": record["nations"],
                "profile_paths": {n: nations[n]["profile_path"] for n in record["nations"]},
                "list_nation_column": record["list_nation_column"], "document_kind": record["kind"],
                "listed_date": record["listed_date"], "link": record["link"], "final_link": record["final_link"],
                "local_pdf": str(out / "pdf" / f"{document_id}.pdf"), "pages": len(page_list),
                "bytes": int(downloads[document_id]["bytes"]), "sha256": downloads[document_id]["sha256"],
                "pages_with_a_text_layer": [p["page"] for p in page_list if p["kind"] == "text"],
                "commission_approval_letter_pages": letter}
        if len(readable) <= FULL_READ_LIMIT:
            item.update(reading_plan="full", suggested_page_ranges=compress(readable), planned_pages=len(readable),
                        plan_note="Read every listed range, one Read call per range.")
        else:
            item.update(reading_plan="contents-first",
                        suggested_page_ranges=compress([p for p in readable if p <= CONTENTS_PAGES]),
                        planned_pages=LONG_BUDGET,
                        plan_note=(f"Read the suggested ranges (the first {CONTENTS_PAGES} pages) first and find a "
                                   "table of contents or section list. Then read the pages of any part on disputes, "
                                   "complaints, claims, grievances, hearings, appeals, licensing hearings, "
                                   "enforcement or the compact, in ranges of at most 20 pages. If there is no "
                                   "contents list, read on in ranges of 20 pages and stop when you have found and "
                                   "read the dispute parts or reached the budget. Budget: at most "
                                   f"{LONG_BUDGET} pages in all for this document. List every page you read in "
                                   "pages_read."))
        if letter:
            item["plan_note"] += (f" Pages {', '.join(map(str, letter))} are the Commission's approval letter, which "
                                  "the earlier review already read from its text layer; they are left out of the "
                                  "ranges.")
        return item

    groups = []
    for nation in sorted(first["nations"], key=lambda n: n["profile"]):
        group = [entry(i) for i in nation["selected"]]
        if group:
            groups.append(group)
    written, current = [], []
    for group in groups:
        planned = sum(e["planned_pages"] for e in current)
        if current and (len(current) + len(group) > BATCH_DOCUMENTS
                        or planned + sum(e["planned_pages"] for e in group) > BATCH_PAGES):
            written.append(current)
            current = []
        current = current + group
    if current:
        written.append(current)
    (out / "batches").mkdir(parents=True, exist_ok=True)
    (out / "verdicts").mkdir(parents=True, exist_ok=True)
    for number, documents in enumerate(written, start=1):
        name = f"scan-batch-{number:03d}"
        write_json(out / "batches" / f"{name}.json", {
            "batch": name, "verdict_file": str(out / "verdicts" / f"{name}.json"), "documents": documents})
        print(name, len(documents), "documents", sum(e["planned_pages"] for e in documents), "planned pages")


# ---------------------------------------------------------------- merge-scans

def reading(document_id, verdict, kinds):
    """Which pages of the document the reader saw, and which were left."""
    page_list = kinds[document_id]
    total = len(page_list)
    read = expand(verdict.get("pages_read"))
    # Pages with a text layer (approval letters and some typed pages) were already searched by
    # ordinance_disputes.py, which found no candidate section in these documents; blank pages hold nothing.
    covered = {p["page"] for p in page_list if p["kind"] in ("nigc-letter", "text", "blank")}
    dropped = (expand(verdict.get("not_reviewed")) | set(verdict.get("unreadable_pages") or [])) - read - covered
    unread = set(range(1, total + 1)) - read - covered
    budget = unread - dropped
    return {"total": total, "read": read, "unread": unread, "dropped": dropped, "budget": budget,
            "complete": not unread}


def span(pages):
    """Page numbers as prose, for example "pages 1-12, 21-22" or "page 41"."""
    ranges = compress(pages, longest=100_000)
    word = "page" if len(pages) == 1 else "pages"
    return f"{word} {', '.join(ranges)}"


def partly_read_flag(info):
    parts = []
    if info["dropped"]:
        parts.append(f"not seen: {span(info['dropped'])} (dropped out of the reading or unreadable)")
    if info["budget"]:
        parts.append(f"not read: {span(info['budget'])} (40-page budget or reading plan)")
    return f"partly-read: the reader saw {len(info['read'])} of {info['total']} PDF pages; " + "; ".join(parts)


def merge_scans(args):
    import yaml
    work = pathlib.Path(args.work)
    out = scans_dir(work)
    checked = {d["id"]: d for d in load_json(work / "documents-checked.json")}
    nations = load_json(work / "nations.json")
    kinds = load_json(out / "page-kinds.json")
    second = load_json(out / "second-look.json") if (out / "second-look.json").exists() else {}
    first = load_json(out / "first-tier.json")
    verdicts = {}
    for path in sorted((out / "verdicts").glob("scan-batch-*.json")):
        for verdict in load_json(path):
            previous = verdicts.get(verdict["document"])
            if previous and not verdict.get("pages_read"):
                continue  # keep an earlier reading over a later one that read nothing
            verdict["batch"] = path.stem
            verdicts[verdict["document"]] = verdict
    review = ROOT / base.REVIEW_BASE
    payload = load_json(review.with_suffix(".json"))
    items = [i for i in payload["items"] if i.get("first_reader") != FIRST_READER]
    without = [w for w in payload["documents_without_items"] if w.get("first_reader") != FIRST_READER]
    private = []
    added, added_without, readings = [], [], {}
    order = [i for i in first["documents"] if i in verdicts] + sorted(set(verdicts) - set(first["documents"]))
    for document_id in order:
        verdict = verdicts[document_id]
        record = checked[document_id]
        info = reading(document_id, verdict, kinds)
        readings[document_id] = info
        document_flags = [] if info["complete"] else [partly_read_flag(info)]
        common = {
            "document": document_id, "nations": record["nations"],
            "profiles": [nations[n]["profile_path"] for n in record["nations"]],
            "list_nation_column": record["list_nation_column"], "document_kind": record["kind"],
            "listed_date": record["listed_date"], "link": record["link"], "final_link": record["final_link"],
            "source": base.CATALOG_SOURCE, "batch": verdict["batch"],
        }
        pages_read = compress(info["read"], longest=100_000)
        if not verdict["items"]:
            added_without.append({**common, "none_found_reason": verdict.get("none_found_reason") or "not given",
                                  "skipped": verdict.get("skipped", []), "flags": document_flags,
                                  "first_reader": FIRST_READER, "pages_read": pages_read,
                                  "what_the_document_is": verdict.get("what_the_document_is", "")})
        for number, item in enumerate(verdict["items"], start=1):
            item_id = f"{document_id}#p{number}"
            flags = list(document_flags)
            snippet = item.get("snippet") or ""
            words = len(snippet.split())
            if words >= base.SNIPPET_WORD_LIMIT:
                flags.append(f"snippet-too-long: {words} words")
            look = second.get(item_id)
            if look:
                second_look = {"verdict": look["verdict"], "kind": look.get("kind", item["kind"]),
                               "reason": look["reason"], "reader": SECOND_READER}
            elif item["confidence"] == "low":
                second_look = {"verdict": "not-rechecked", "kind": item["kind"],
                               "reason": "low confidence; not in the Nov. 23 spot check", "reader": ""}
            else:
                second_look = {"verdict": "not-queued", "kind": item["kind"],
                               "reason": "medium or high confidence, read from page images", "reader": ""}
            if second_look["verdict"] == "not-in-force":
                flags.append("not-in-force: the passage is struck through in this amendment")
            if COMPACT_WORDS.search(item.get("refers_to") or ""):
                flags.append(SCAN_COMPACT_FLAG)
            text = " ".join([item["steps_summary"], item["steps"].get("who_hears", ""), second_look["reason"]])
            if base.BARE_POWER_WORDS.search(text):
                flags.append(base.BARE_POWER_FLAG)
            current_kind = ("not-a-dispute-procedure" if second_look["verdict"] == "not-a-dispute-procedure"
                            else second_look["kind"])
            added.append({
                "id": item_id, **common,
                "locator": item["locator"], "kind": item["kind"], "current_kind": current_kind,
                "steps": item["steps"], "steps_summary": item["steps_summary"],
                "final_decision_maker": item["final_decision_maker"], "refers_to": item.get("refers_to", ""),
                "framed_as_dispute_resolution": item.get("framed_as_dispute_resolution"),
                "confidence": item["confidence"], "refs": [],
                "quote_check": QUOTE_CHECK, "snippet_words": words, "ocr_text": False, "garble_score": None,
                "verification": "read-in-full" if info["complete"] else "title-only",
                "first_reader": FIRST_READER, "second_look": second_look, "flags": flags,
                "pages_read": pages_read, "as_of": SCAN_DATE, "lead_author_decision": base.GRAB_DECISION,
            })
            private.append({"id": item_id, "snippet": snippet, "quote_check": QUOTE_CHECK})
    payload["items"] = items + added
    payload["documents_without_items"] = without + added_without
    write_json(review.with_suffix(".json"), payload)
    base.write_csv(review, payload["items"])
    try:
        earlier = load_json(base.PRIVATE_COPY) if base.PRIVATE_COPY.exists() else []
        kept = [p for p in earlier if p["id"] not in {a["id"] for a in added} and not re.search(r"#p\d+$", p["id"])]
        write_json(base.PRIVATE_COPY, kept + private)
    except OSError as error:
        print(f"private copy not written: {error}", file=sys.stderr)
    moved = update_search_logs(yaml, checked, nations, verdicts, readings, added, first)
    write_counts(out, first, verdicts, readings, added, added_without, moved)


def label_of(record):
    return f"{record['kind']} listed {record['listed_date']}"


def update_search_logs(yaml, checked, nations, verdicts, readings, added, first):
    kept_by_document = collections.defaultdict(list)
    for item in added:
        if item["current_kind"] != "not-a-dispute-procedure":
            kept_by_document[item["document"]].append(item)
    documents_by_nation = collections.defaultdict(list)
    for document_id in verdicts:
        for nation in checked[document_id]["nations"]:
            documents_by_nation[nation].append(document_id)
    scanned_by_nation = {n["profile"]: [r["document"] for r in n["scanned_documents"]] for n in first["nations"]}
    moved = collections.Counter()
    for nation, document_ids in sorted(documents_by_nation.items()):
        path = LOG_ROOT / (nation[0] if nation[0].isalpha() else "_other") / f"{nation}.yaml"
        log = yaml.safe_load(path.read_text(encoding="utf-8"))
        searches = [s for s in log["searches"] if s.get("query") != QUERY]
        earlier = {s["outcome"] for s in searches}
        before = ("found" if "found" in earlier else "partly-searched"
                  if earlier & {"scanned-unreadable", "error"} else log["status"])
        left, notes = [], []
        for document_id in document_ids:
            record = checked[document_id]
            info = readings[document_id]
            verdict = verdicts[document_id]
            address = record["final_link"] or record["link"]
            label = label_of(record)
            kept = kept_by_document.get(document_id, [])
            seen = (f"read PDF {span(info['read'])} of {info['total']} of this {label} as page images (it has "
                    "no text layer)")
            entry = {"date": SCAN_DATE, "searched_by": "Claude (AI assistant)", "method": "ai-review",
                     "place_kind": PLACE_KIND, "address": address, "query": QUERY}
            if kept:
                kinds = sorted({i["current_kind"] for i in kept})
                entry["outcome"] = "found"
                entry["reason"] = (f"Small-model reviewers {seen} and recorded {len(kept)} procedure(s): "
                                   f"{', '.join(kinds)}.")
                entry["records"] = [f"{base.REVIEW_BASE}.json#{i['id']}" for i in kept]
            else:
                why = (verdict.get("none_found_reason") or "").rstrip(".")
                entry["outcome"] = "not-found"
                entry["reason"] = f"Small-model reviewers {seen} and found no dispute procedure" + (
                    f" ({why})." if why else ".")
            if info["dropped"]:
                entry["reason"] += f" Not seen: {span(info['dropped'])} (dropped out of the reading or unreadable)."
                left.append(f"Read {span(info['dropped'])} of the {label} ({address}), which dropped out of the "
                            "page-image reading.")
            elif info["budget"]:
                entry["reason"] += f" Not read: {span(info['budget'])} (40-page budget for long documents)."
                notes.append(f"Not read: {span(info['budget'])} of the {label} ({address}), left by the 40-page "
                             "budget for long documents.")
            searches.append({k: entry[k] for k in ("date", "searched_by", "method", "place_kind", "address",
                                                   "query", "outcome", "reason", "records") if k in entry})
        older = [i for i in scanned_by_nation.get(nation, []) if i not in verdicts]
        if older:
            notes.append("Older scanned documents were not read, because the newer documents read replace them: "
                         + "; ".join(f"{label_of(checked[i])} ({checked[i]['final_link'] or checked[i]['link']})"
                                     for i in older) + ".")
        found = any(s["outcome"] == "found" for s in searches)
        other_left = [f"Read the whole {label_of(checked[d['id']])} ({checked[d['id']]['final_link']}); its dispute "
                      "section was not in the extracted passages."
                      for d in nations[nation]["documents_checked"]
                      if base.DOCUMENT_FLAGS.get(d["id"], "").startswith("needs-full")]
        # The search-log schema treats any search that found something as `found`; pages still to read
        # go into next_steps.
        if found:
            status = "found"
        elif left:
            status = "partly-searched"
        elif all(readings[i]["complete"] for i in document_ids) and not other_left:
            status = "none-found"
        else:
            status = "partly-searched"
        if status == "found":
            steps = left + [f"The lead author decides the procedures in {base.REVIEW_BASE}.csv; the nation's own "
                            "current ordinance may differ from the list's copy."] + notes
        elif status == "none-found":
            steps = ["Every chosen ordinance document on the Commission's list was read from page images; look for "
                     "gaming regulations or a patron dispute policy on the nation's or its gaming commission's "
                     "website."] + notes
        else:
            steps = left + other_left + notes
            if found:
                steps.append(f"Procedures already recorded are in {base.REVIEW_BASE}.csv for the lead author.")
        log["status"] = status
        log["last_searched"] = SCAN_DATE
        log["searches"] = searches
        log["next_steps"] = " ".join(steps)
        path.write_text(yaml.dump(log, sort_keys=False, allow_unicode=True, width=100), encoding="utf-8")
        moved[f"{before} -> {status}"] += 1
    return moved


def write_counts(out, first, verdicts, readings, added, added_without, moved):
    import yaml
    counts_path = ROOT / (base.REVIEW_BASE + "-counts.json")
    counts = load_json(counts_path)
    second_tier = load_json(out / "second-tier.json")["counts"] if (out / "second-tier.json").exists() else {}
    statuses = collections.Counter(yaml.safe_load(p.read_text(encoding="utf-8"))["status"]
                                   for p in LOG_ROOT.glob("*/*.yaml"))
    kept = [i for i in added if i["current_kind"] != "not-a-dispute-procedure"]
    counts["scans_2026_11_23"] = {
        "first_tier_nations": len(first["partly_searched_nations"]),
        "nations_with_a_document_read": len({n for d in verdicts.values() for n in d["nations"]}),
        "documents_read": len(verdicts),
        "pages_in_documents": sum(r["total"] for r in readings.values()),
        "pages_read": sum(len(r["read"]) for r in readings.values()),
        "documents_read_in_full": sum(1 for r in readings.values() if r["complete"]),
        "documents_partly_read": sorted(d for d, r in readings.items() if not r["complete"]),
        "documents_with_pages_dropped": sorted(d for d, r in readings.items() if r["dropped"]),
        "documents_without_items": len(added_without),
        "items": len(added),
        "items_by_kind": dict(collections.Counter(i["kind"] for i in added)),
        "items_by_confidence": dict(collections.Counter(i["confidence"] for i in added)),
        "items_by_kind_and_confidence": {f"{k} {c}": n for (k, c), n in sorted(collections.Counter(
            (i["kind"], i["confidence"]) for i in added).items())},
        "items_by_current_kind": dict(collections.Counter(i["current_kind"] for i in added)),
        "flags": dict(collections.Counter(f.split(":")[0] for i in added for f in i["flags"])),
        "nations_with_kept_items": len({n for i in kept for n in i["nations"]}),
        "spot_check": {"seed": SPOT_CHECK_SEED, "checked": sum(1 for i in added if i["second_look"]["reader"]),
                       "verdicts": dict(collections.Counter(i["second_look"]["verdict"] for i in added
                                                            if i["second_look"]["reader"]))},
        "second_look": dict(collections.Counter(i["second_look"]["verdict"] for i in added)),
        "search_logs_changed": dict(moved),
        "search_logs_after": dict(statuses),
        "items_after": counts.get("grab_2026_11_23", {}).get("items_after", 0) + len(added),
        "second_tier_not_read": second_tier,
    }
    write_json(counts_path, counts)
    print(json.dumps(counts["scans_2026_11_23"], indent=1))


def spot_check_sample(work, required, size=10):
    """The items to check by hand: the required ids, then a seeded random draw from the rest."""
    ids = []
    for path in sorted((scans_dir(work) / "verdicts").glob("scan-batch-*.json")):
        for verdict in load_json(path):
            ids += [f"{verdict['document']}#p{n}" for n in range(1, len(verdict["items"]) + 1)]
    rest = sorted(set(ids) - set(required))
    return list(required) + random.Random(SPOT_CHECK_SEED).sample(rest, size - len(required))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    command = sub.add_parser("select")
    command.add_argument("--work", required=True)
    command.add_argument("--nations", help="file of profile ids, one per line (default: partly-searched logs)")
    command = sub.add_parser("download")
    command.add_argument("--work", required=True)
    command.add_argument("--pause", type=float, default=3.0)
    command = sub.add_parser("pages")
    command.add_argument("--work", required=True)
    command = sub.add_parser("batches")
    command.add_argument("--work", required=True)
    command.add_argument("--force", action="store_true")
    command = sub.add_parser("merge-scans")
    command.add_argument("--work", required=True)
    command = sub.add_parser("spot-check")
    command.add_argument("--work", required=True)
    command.add_argument("--require", nargs="*", default=[])
    args = parser.parse_args()
    if args.command == "spot-check":
        print("\n".join(spot_check_sample(args.work, args.require)))
        return
    {"select": select, "download": download, "pages": pages, "batches": batches,
     "merge-scans": merge_scans}[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
