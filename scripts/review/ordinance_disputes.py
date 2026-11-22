"""Find the dispute resolution procedures in the Tribal gaming ordinances the
gaming thread captured (research/gaming/ordinance-documents.json) and write
review batches: procedures for disputes between the gaming public (patrons)
and the Tribe, gaming operation or management contractor, employee grievance
procedures, licensing hearings and appeals, and any mediation, arbitration,
peacemaking or Tribal court review step.

    python3 scripts/review/ordinance_disputes.py batches --work WORK [--captures DIR]
    python3 scripts/review/ordinance_disputes.py merge   --work WORK

batches  For every row of the ordinance catalog, reads the text the gaming
         thread extracted beside each private PDF copy (`pdftotext -layout`,
         one page per form feed; the PDF is converted again only when the
         text file is missing) and never downloads anything. It marks pages
         with no text layer, pages of the National Indian Gaming
         Commission's approval letter and tables of contents, finds
         candidate sections by their headings (dispute, complaint,
         grievance, patron, claims, arbitration, mediation, hearing, appeal)
         and by keywords in the body (patron or gaming public near dispute,
         complaint or claim; grievance; arbitration; mediation; peacemaking;
         Tribal court near appeal or review; the model ordinance's citation
         of 25 C.F.R. 522.2), and keeps each section with its PDF page
         numbers. For each nation it selects the newest document (by the
         list's date) with a patron dispute section, the newest with an
         employee grievance section, and, when there is neither, the newest
         with any other dispute section, or else the newest with a licensing
         hearing; every document checked is recorded with its outcome
         (`candidate`, `no-candidate`, `approval-letter-only`,
         `scanned-unreadable`, `partly-scanned`, `not-captured`). No OCR is
         run. Writes WORK/documents-checked.json, WORK/nations.json,
         WORK/batches/batch-NNN.json (about 40 documents each) and
         WORK/manifest.json. Reviewers follow
         research/reviews/briefs/2026-11-22-ordinance-disputes.md and write
         WORK/verdicts/batch-NNN.json.

merge    Reads the reviewers' verdicts (WORK/verdicts/batch-NNN.json) and checks
         every snippet against the document's extracted text, with
         whitespace normalized (`exact`, `exact-ignoring-case-and-punctuation`
         or `not-found`, and a flag for 25 words or more); failures are
         flagged, never dropped. It scores each item's passages for text
         garbled by character recognition, queues low-confidence and garbled
         items for a second look (WORK/second-look-queue.json) and applies
         the second reader's verdicts from WORK/second-look.json (keep,
         change-kind or not-a-dispute-procedure), keeping the reviewer's own
         fields beside them. Writes research/reviews/2026-11-22-ordinance-
         disputes.{json,csv} (summaries only, empty lead_author_decision
         column), a counts file, one search log per profile under
         research/search-logs/gaming-dispute-procedures/, and the snippets
         to a private file under /mnt/project-files/research/ordinance-disputes/.

The text of the ordinances stays in the private work folder: the ordinances
are the nations' own laws, and the project cites and links them rather than
republishing them. It never changes a profile.

`batches` needs only the Python 3 standard library and the saved text
(pdftotext only for a missing text file); `merge` also needs PyYAML
(scripts/requirements.txt).
"""

import argparse
import collections
import json
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
CATALOG = ROOT / "research/gaming/ordinance-documents.json"
DEFAULT_CAPTURES = pathlib.Path("/mnt/project-files/research/captures/gaming/ordinances")

DOCUMENTS_PER_BATCH = 40
CHARACTERS_PER_BATCH = 220_000
CHARACTERS_PER_DOCUMENT = 14_000
SECTION_CAP = {"patron-dispute": 7000, "employee-grievance": 6000}
OTHER_SECTION_CAP = 3000
LICENSING_SECTION_CAP = 2000
LICENSING_SECTIONS_PER_DOCUMENT = 2
EMPTY_PAGE_CHARACTERS = 100

PRIORITY = ["patron-dispute", "employee-grievance", "dispute-other", "court-review", "licensing-hearing"]

HEADING_WORDS = re.compile(
    r"disput|complain|grievan|patron|arbitrat|\bmediat|peacemak|\bclaims?\b|appeal|hearing|"
    r"customer|tort|reconsider", re.I)
NUMBERED = re.compile(
    r"^\s*(?:(?P<word>section|sec\.|§+|article|art\.|chapter|subchapter|part|title|rule)\s*"
    r"(?P<wordnumber>[0-9IVXLC]+[0-9A-Za-z.\-]*)"
    r"|(?P<dotted>[0-9]{1,3}(?:[.\-][0-9]{1,3}){0,4})\.?\s+(?=[A-Z(])"
    r"|(?P<roman>[IVXL]{1,6})\.\s+(?=[A-Z]))", re.I)
PATRON = re.compile(r"\bpatron|gaming\s+public|\bcustomer|\bconsumer|\bplayer|\bguest|members?\s+of\s+the\s+public|"
                    r"(?:complain|disput)\w*\s+(?:\w+\s+){0,3}?(?:the\s+)?public", re.I)
DISPUTE = re.compile(r"disput|complain|\bclaim|grievan", re.I)
ANCHOR_PATTERNS = [
    ("patron", re.compile(r"(?:\bpatron|gaming\s+public|\bcustomer|\bconsumer|\bplayer)\S*\W+(?:\w+\W+){0,6}?"
                          r"(?:disput|complain|claim|grievan)", re.I)),
    ("patron", re.compile(r"(?:disput|complain|claim|grievan)\S*\W+(?:\w+\W+){0,6}?"
                          r"(?:\bpatron|gaming\s+public|\bcustomer|\bconsumer|\bplayer|the\s+public)", re.I)),
    ("employee", re.compile(r"employee\S*\W+(?:\w+\W+){0,4}?(?:complain|grievan|disput)|"
                            r"(?:complain|grievan|disput)\S*\W+(?:\w+\W+){0,4}?employee", re.I)),
    ("dispute", re.compile(r"disputes?\s+(?:arises?|arising|between|involving|concerning|with)|"
                           r"(?:resolve|resolution\s+of|resolving|settle|settlement\s+of)\s+(?:\w+\s+){0,2}?disputes", re.I)),
    ("regulation", re.compile(r"522\.2\s*\(\s*[ef]\s*\)", re.I)),
    ("grievance", re.compile(r"grievan", re.I)),
    ("adr", re.compile(r"arbitrat|\bmediat|peacemak|dispute\s+resolution|alternative\s+dispute", re.I)),
    ("court", re.compile(r"tribal\s+court\W+(?:\w+\W+){0,8}?(?:appeal|review)|"
                         r"(?:appeal|review)\S*\W+(?:\w+\W+){0,8}?tribal\s+court", re.I)),
]
LETTER_MARK = re.compile(r"national\s+indian\s+gaming\s+commission|NIGC", re.I)
LETTER_SIGN = re.compile(r"\bdear\b|sincerely|\bchair(?:man|woman)?\b", re.I)
TOC_LINE = re.compile(r"(?:[.…·_]{4,}|…+|\s{3,})\s*[0-9]{1,3}\s*$")
LEADER_LINE = re.compile(r"(?:[.…·_]{4,}|…{2,})\s*[0-9]{1,3}\s*$")
OBLIGATION = re.compile(r"\b(?:shall|must|may|will|is|are)\b", re.I)


def load_text(capture_dir, work, relative):
    """Return the saved text of one capture, copying it into WORK/text."""
    local = work / "text" / relative
    local = local.with_name(local.name + ".txt") if local.suffix.lower() != ".pdf" else local.with_suffix(".txt")
    if not local.exists():
        pdf = capture_dir / relative
        saved = pdf.with_name(pdf.name + ".txt") if pdf.suffix.lower() != ".pdf" else pdf.with_suffix(".txt")
        local.parent.mkdir(parents=True, exist_ok=True)
        if saved.exists():
            shutil.copyfile(saved, local)
        elif pdf.exists():
            subprocess.run(["pdftotext", "-layout", str(pdf), str(local)], capture_output=True)
        else:
            return None
    return local.read_text(encoding="utf-8", errors="replace")


def nonspace(text):
    return len(re.sub(r"\s", "", text))


def page_kinds(pages):
    """Label each page: empty (no text layer), letter, contents, or text."""
    kinds = []
    for number, page in enumerate(pages):
        if nonspace(page) < EMPTY_PAGE_CHARACTERS:
            kinds.append("empty")
        elif number < 4 and LETTER_MARK.search(page) and LETTER_SIGN.search(page) and not re.search(
                r"^\s*(?:section|article)\s+[0-9IVX]", page, re.I | re.M):
            kinds.append("letter")
        else:
            lines = [line for line in page.splitlines() if line.strip()]
            toc = sum(1 for line in lines if TOC_LINE.search(line) and len(line.strip()) < 110)
            kinds.append("contents" if lines and (toc >= 8 or toc / len(lines) > 0.4) else "text")
    return kinds


def numbering(line):
    match = NUMBERED.match(line)
    if not match:
        return None
    if match.group("word"):
        word = match.group("word").lower().rstrip(".")
        word = "section" if word.startswith(("sec", "§")) else "article" if word.startswith("art") else word
        return ("word", word, match.group("wordnumber").count(".") + match.group("wordnumber").count("-"))
    if match.group("dotted"):
        dotted = match.group("dotted")
        return ("dotted", "", len(re.split(r"[.\-]", dotted)))
    return ("roman", "", 0)


def is_heading(line):
    stripped = line.strip()
    if not stripped or len(stripped) > 100 or TOC_LINE.search(line):
        return False
    words = stripped.split()
    style = numbering(stripped)
    letters = [c for c in stripped if c.isalpha()]
    upper = letters and sum(c.isupper() for c in letters) / len(letters) > 0.8
    if style and len(words) <= 12:
        rest = NUMBERED.sub("", stripped, count=1).strip(" .:-")
        return (bool(rest) and (rest[0].isupper() or rest[0] == "(") and not rest.endswith((",", ";"))
                and not OBLIGATION.search(rest.split(".")[0]))
    if upper and 1 <= len(words) <= 12 and len(letters) >= 4:
        return True
    capitalized = [w for w in words if w[0].isalpha() and len(w) > 3]
    return (2 <= len(words) <= 8 and capitalized and all(w[0].isupper() for w in capitalized)
            and not stripped.endswith((".", ",", ";")))


def section_end(lines, start, style, limit):
    """Index after the last line of the section that starts at `start`."""
    total = 0
    for index in range(start + 1, len(lines)):
        total += len(lines[index][1])
        if total > limit * 1.6:
            return index
        line = lines[index][1]
        if not line.strip():
            continue
        other = numbering(line.strip()) if is_heading(line) else None
        if style is None:
            if other or (is_heading(line) and line.strip().upper() == line.strip()):
                return index
        elif other:
            if style[0] == "word" and (other[0] == "word" and (other[1] != style[1] or other[2] <= style[2])):
                return index
            if style[0] == "dotted" and ((other[0] == "dotted" and other[2] <= style[2]) or other[0] in ("word", "roman")):
                return index
            if style[0] == "roman" and other[0] in ("roman", "word"):
                return index
    return len(lines)


def classify(text):
    low = text.lower()
    kinds = set()
    if (PATRON.search(low) and DISPUTE.search(low)) or re.search(r"522\.2\s*\(\s*[ef]\s*\)", low):
        kinds.add("patron-dispute")
    if ("grievan" in low and "employ" in low) or re.search(
            r"employee\S*\W+(?:\w+\W+){0,4}?(?:complain|grievan|disput)", low) or (
            "employ" in low and re.search(r"disciplin|terminat|dismiss", low)
            and re.search(r"appeal|grievan|hearing", low)):
        kinds.add("employee-grievance")
    if re.search(r"arbitrat|\bmediat|peacemak|disput", low):
        kinds.add("dispute-other")
    if re.search(r"tribal\s+court|court of the (?:tribe|nation)", low) and re.search(r"appeal|review|disput|complain", low):
        kinds.add("court-review")
    if re.search(r"licen[cs]", low) and re.search(r"hearing|appeal|reconsider", low):
        kinds.add("licensing-hearing")
    methods = sorted({word for word, pattern in (
        ("arbitration", r"arbitrat"), ("mediation", r"\bmediat"), ("peacemaking", r"peacemak"),
        ("tribal-court", r"tribal\s+court")) if re.search(pattern, low)})
    return kinds, methods


def find_sections(pages, kinds_of_pages):
    lines = []
    for number, page in enumerate(pages, start=1):
        if kinds_of_pages[number - 1] == "empty":
            continue
        for line in page.splitlines():
            if LEADER_LINE.search(line) or (kinds_of_pages[number - 1] == "contents" and TOC_LINE.search(line)):
                continue
            lines.append((number, line.rstrip()))
    headed, anchors = [], []
    for index, (page, line) in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        if is_heading(line) and HEADING_WORDS.search(stripped):
            style = numbering(stripped)
            end = section_end(lines, index, style, 7000)
            if headed and index < headed[-1][1]:
                headed[-1][1] = index
            headed.append([index, end, stripped])
            continue
        context = " ".join(l for _, l in lines[max(0, index - 1):index + 2])
        if any(pattern.search(line) or (name == "patron" and pattern.search(context) and DISPUTE.search(line))
               for name, pattern in ANCHOR_PATTERNS):
            anchors.append(index)
    # A passage found by keyword outside any headed section gets a window of
    # its own, clipped so that it never runs into a headed section.
    inside = set()
    for start, end, _ in headed:
        inside.update(range(start, end))
    body = []
    for index in anchors:
        if index in inside:
            continue
        start, end = max(0, index - 8), min(len(lines), index + 25)
        for head_start, head_end, _ in headed:
            if head_start <= index:
                start = max(start, head_end)
            elif head_start < end:
                end = head_start
        if body and start <= body[-1][1] + 3:
            body[-1][1] = max(body[-1][1], end)
        else:
            body.append([start, end, None])
    sections = []
    for start, end, heading in sorted(headed + body, key=lambda window: window[0]):
        chunk = lines[start:end]
        heading_like = sum(1 for _, l in chunk if l.strip() and is_heading(l))
        if len([l for _, l in chunk if l.strip()]) >= 6 and heading_like > 0.6 * len([l for _, l in chunk if l.strip()]):
            continue  # a table of contents
        text = "\n".join(re.sub(r"[ \t]{2,}", " ", l).strip() for _, l in chunk if l.strip())
        kinds, methods = classify(text)
        if not kinds:
            continue
        page_numbers = sorted({p for p, _ in chunk})
        on_letter = all(kinds_of_pages[p - 1] == "letter" for p in page_numbers)
        sections.append({"heading": heading, "pages": [page_numbers[0], page_numbers[-1]],
                         "kinds_detected": sorted(kinds, key=PRIORITY.index), "methods_named": methods,
                         "on_approval_letter": on_letter, "text": text})
    return sections


def choose(sections):
    """Keep the strongest sections of a document within its character budget."""
    def rank(section):
        return (section["on_approval_letter"], min(PRIORITY.index(k) for k in section["kinds_detected"]),
                section["pages"][0])
    kept, used, licensing = [], 0, 0
    for section in sorted(sections, key=rank):
        top = section["kinds_detected"][0]
        if top == "licensing-hearing":
            if licensing >= LICENSING_SECTIONS_PER_DOCUMENT:
                continue
            licensing += 1
            cap = LICENSING_SECTION_CAP
        else:
            cap = SECTION_CAP.get(top, OTHER_SECTION_CAP)
        text = section["text"]
        if used + min(len(text), cap) > CHARACTERS_PER_DOCUMENT and kept:
            continue
        item = dict(section)
        item["truncated"] = len(text) > cap
        item["text"] = text[:cap]
        used += len(item["text"])
        kept.append(item)
    kept.sort(key=lambda s: s["pages"][0])
    return kept


def profile_path(nation):
    first = nation[0] if nation[0].isalpha() else "_other"
    path = ROOT / "content/tribes" / first / f"{nation}.yaml"
    return str(path.relative_to(ROOT)) if path.exists() else None


def title_in_text(pages, kinds_of_pages):
    for number, page in enumerate(pages):
        if kinds_of_pages[number] not in ("text", "contents"):
            continue
        for line in page.splitlines()[:60]:
            stripped = re.sub(r"\s{2,}", " ", line.strip())
            if 8 < len(stripped) < 120 and re.search(r"ordinance|code|act|regulation", stripped, re.I) and \
                    sum(c.isupper() for c in stripped) > 0.6 * sum(c.isalpha() for c in stripped):
                return stripped
        break
    return None


def check_document(row, capture_dir, work, cache):
    capture = (row.get("capture") or {}).get("capture")
    record = {"id": row["id"], "nations": row["nations"], "list_nation_column": row["list_nation_column"],
              "kind": row["kind"], "listed_date": row["listed_date"], "link": row["link"],
              "final_link": row.get("final_link"), "capture": capture,
              "pages": (row.get("capture") or {}).get("pages"), "sha256": (row.get("capture") or {}).get("sha256"),
              "catalog_flags": row["flags"]}
    if not capture:
        record.update(outcome="not-captured", reason="the catalog has no capture of this row", sections=[])
        return record
    if capture not in cache:
        text = load_text(capture_dir, work, capture)
        if text is None:
            cache[capture] = None
        else:
            pages = text.split("\f")
            if pages and not pages[-1].strip():
                pages = pages[:-1]
            kinds = page_kinds(pages)
            cache[capture] = (pages, kinds, find_sections(pages, kinds), title_in_text(pages, kinds))
    if cache[capture] is None:
        record.update(outcome="not-captured", reason="the capture's text file and PDF are missing", sections=[])
        return record
    pages, kinds, sections, title = cache[capture]
    count = collections.Counter(kinds)
    record.update(page_kinds=dict(count), title_in_text=title)
    readable = count["text"] + count["contents"]
    found = [s for s in sections if not s["on_approval_letter"]]
    record["kinds_detected"] = sorted({k for s in found for k in s["kinds_detected"]}, key=PRIORITY.index)
    record["sections"] = sections
    if found:
        record["outcome"] = "partly-scanned" if count["empty"] > len(pages) / 3 else "candidate"
        record["reason"] = (f"{len(found)} candidate section(s) found" +
                            (f"; {count['empty']} of {len(pages)} pages have no text layer" if count["empty"] else ""))
    elif readable == 0 and count["empty"]:
        record["outcome"] = "scanned-unreadable"
        record["reason"] = (f"{count['empty']} of {len(pages)} pages have no text layer"
                            + (" (only the approval letter has text)" if count["letter"] else "") + "; no OCR available")
    elif count["empty"] > len(pages) / 3:
        record["outcome"] = "scanned-unreadable"
        record["reason"] = (f"{count['empty']} of {len(pages)} pages have no text layer and the readable pages "
                            "have no candidate section; no OCR available")
    elif readable == 0:
        record["outcome"] = "approval-letter-only"
        record["reason"] = "the file is the Commission's approval letter only, with no ordinance text"
    else:
        record["outcome"] = "no-candidate"
        record["reason"] = "the text has no heading or passage on disputes, complaints, grievances, hearings or appeals"
    return record


def has(record, kinds):
    return any(not s["on_approval_letter"] and set(s["kinds_detected"]) & set(kinds) for s in record["sections"])


def select(records):
    """Pick, newest first, the documents whose sections reviewers will read."""
    newest = sorted(records, key=lambda r: (r["listed_date"] or "", r["id"]), reverse=True)
    chosen = {}
    for kinds, why in ((["patron-dispute"], "newest document with a patron dispute section"),
                       (["employee-grievance"], "newest document with an employee grievance section")):
        for record in newest:
            if has(record, kinds):
                chosen.setdefault(record["id"], []).append(why)
                break
    if not chosen:
        for kinds, why in ((["dispute-other", "court-review"], "newest document with another dispute section"),
                           (["licensing-hearing"], "newest document with a licensing hearing or appeal section")):
            for record in newest:
                if has(record, kinds):
                    chosen.setdefault(record["id"], []).append(why)
                    break
            if chosen:
                break
    return chosen


def batches(args):
    work = pathlib.Path(args.work)
    capture_dir = pathlib.Path(args.captures)
    rows = json.loads(CATALOG.read_text(encoding="utf-8"))
    cache, records = {}, []
    for row in rows:
        records.append(check_document(row, capture_dir, work, cache))
    by_nation = collections.defaultdict(list)
    for record in records:
        for key in record["nations"] or [f"list:{record['list_nation_column']}"]:
            by_nation[key].append(record)
    nations, selected = {}, collections.OrderedDict()
    for key in sorted(by_nation):
        chosen = select(by_nation[key])
        outcomes = collections.Counter(r["outcome"] for r in by_nation[key])
        if chosen:
            status = "candidates"
        elif outcomes["scanned-unreadable"] and not (outcomes["no-candidate"] or outcomes["partly-scanned"]):
            status = "scanned-unreadable"
        elif outcomes["scanned-unreadable"]:
            status = "none-found-some-scanned"
        else:
            status = "none-found"
        profile = None if key.startswith("list:") else key
        nations[key] = {"profile": profile, "profile_path": profile_path(profile) if profile else None,
                        "status": status, "selected": chosen,
                        "documents_checked": [{"id": r["id"], "listed_date": r["listed_date"], "kind": r["kind"],
                                               "outcome": r["outcome"], "kinds_detected": r.get("kinds_detected", []),
                                               "reason": r["reason"]} for r in
                                              sorted(by_nation[key], key=lambda r: r["listed_date"] or "")]}
        for document_id, why in chosen.items():
            selected.setdefault(document_id, {"nations": [], "why": {}})
            selected[document_id]["nations"].append(key)
            selected[document_id]["why"][key] = why
    for record in records:
        record["selected_for"] = selected.get(record["id"], {}).get("why", {})
    # Batches: keep each nation's documents together.
    record_by_id = {r["id"]: r for r in records}
    out = work / "batches"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    batch, size, written, number = [], 0, [], 0

    def flush():
        nonlocal batch, size, number
        if batch:
            number += 1
            path = out / f"batch-{number:03d}.json"
            path.write_text(json.dumps({"batch": f"batch-{number:03d}", "documents": batch},
                                       ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            written.append(str(path))
        batch, size = [], 0

    seen = set()
    for key in sorted(nations):
        group = [i for i in nations[key]["selected"] if i not in seen]
        items = []
        for document_id in group:
            seen.add(document_id)
            record = record_by_id[document_id]
            sections = choose(record["sections"])
            for n, section in enumerate(sections, start=1):
                section["ref"] = f"{document_id}#s{n}"
            items.append({
                "document": document_id,
                "nations": [{"profile": None if k.startswith("list:") else k,
                             "profile_path": nations[k]["profile_path"],
                             "list_nation_column": record["list_nation_column"],
                             "why_selected": selected[document_id]["why"][k]} for k in selected[document_id]["nations"]],
                "document_kind": record["kind"], "listed_date": record["listed_date"],
                "title_in_text": record.get("title_in_text"),
                "link": record["link"], "final_link": record["final_link"], "pages": record["pages"],
                "outcome": record["outcome"], "reason": record["reason"],
                "other_documents_checked": [{"id": d["id"], "listed_date": d["listed_date"], "outcome": d["outcome"],
                                             "kinds_detected": d["kinds_detected"]}
                                            for d in nations[key]["documents_checked"] if d["id"] != document_id],
                "sections": sections})
        chars = sum(len(s["text"]) for item in items for s in item["sections"])
        if batch and (len(batch) + len(items) > DOCUMENTS_PER_BATCH or size + chars > CHARACTERS_PER_BATCH):
            flush()
        batch.extend(items)
        size += chars
    flush()
    (work / "verdicts").mkdir(exist_ok=True)
    for record in records:
        record["sections"] = [{k: v for k, v in s.items() if k != "text"} for s in record["sections"]]
    (work / "documents-checked.json").write_text(json.dumps(records, ensure_ascii=False, indent=1) + "\n",
                                                 encoding="utf-8")
    (work / "nations.json").write_text(json.dumps(nations, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    manifest = {
        "documents_in_catalog": len(rows),
        "captures_read": sum(1 for v in cache.values() if v is not None),
        "document_outcomes": dict(collections.Counter(r["outcome"] for r in records)),
        "nations": len(nations),
        "nations_with_profile": sum(1 for v in nations.values() if v["profile"]),
        "nation_status": dict(collections.Counter(v["status"] for v in nations.values())),
        "documents_selected": len(selected),
        "selected_by_reason": dict(collections.Counter(reason for v in selected.values()
                                                       for reasons in v["why"].values() for reason in reasons)),
        "batches": written,
        "verdicts_pattern": str(work / "verdicts" / "batch-NNN.json"),
    }
    (work / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=1))


# ---------------------------------------------------------------- merge

REVIEW_DATE = "2026-11-22"
REVIEW_BASE = "research/reviews/2026-11-22-ordinance-disputes"
SEARCH_LOG_TOPIC = "gaming-dispute-procedures"
PRIVATE_COPY = pathlib.Path("/mnt/project-files/research/ordinance-disputes/2026-11-22-ordinance-disputes-with-snippets.json")
CATALOG_SOURCE = "nigc-gaming-ordinances-table-2026"
GARBLED = 0.08
SNIPPET_WORD_LIMIT = 25
QUERY = ("headings and passages on patron or gaming public disputes, complaints and claims, grievances, "
         "arbitration, mediation, peacemaking, hearings, appeals and Tribal court review")
FIRST_READER = "small-model reviewer (Claude, AI assistant), from the extracted passages"
SECOND_READER = "Claude (AI assistant), second look at the passage"
# Judgment calls the reviewers raised, recorded for the lead author (not reversed here).
DOCUMENT_FLAGS = {
    "colorado-river-indian-tribes-amendment-2009-10-09":
        "needs-full-document-read: the extracted passages hold the table of contents and the chapter heading, "
        "not the text of the patron dispute chapter",
    "confederated-tribes-of-the-chehalis-reservation-amendment-2017-12-01":
        "needs-full-document-read: the extracted passage lists a grievances section in the table of contents "
        "but holds none of its text",
    "northern-arapahoe-tribe-of-the-wind-river-reservation-amendment-2013-01-03":
        "check-overlap: same sections 802 and 803 as the 2017 amendment and the Northern Cheyenne 2011 amendment",
    "northern-arapahoe-tribe-of-the-wind-river-reservation-amendment-2017-03-31":
        "check-overlap: same sections 802 and 803 as the 2013 amendment and the Northern Cheyenne 2011 amendment",
    "northern-cheyenne-tribe-amendment-2011-12-09":
        "check-overlap: same sections 802 and 803 as the Northern Arapaho 2013 and 2017 amendments",
    "dry-creek-rancheria-of-pomo-indians-amendment-2019-08-20":
        "compact-terms-skipped: the reviewer set aside Tribal-State compact sections printed in the document",
    "pawnee-nation-of-oklahoma-amendment-2022-11-22":
        "compact-terms-recorded: the reviewer recorded Tribal-State compact claim terms printed in the "
        "document, where other reviewers skipped such terms",
}


def normalize(text):
    import unicodedata
    text = unicodedata.normalize("NFC", text)
    text = text.translate(str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"',
                                         "–": "-", "—": "-", " ": " "}))
    return re.sub(r"\s+", " ", text).strip()


def loose(text):
    return " ".join(re.findall(r"[a-z0-9]+", text.lower()))


def garble_score(text, vocabulary):
    words = [re.sub(r"^\W+|\W+$", "", w) for w in text.split()]
    words = [w for w in words if len(w) >= 3]
    bad = sum(1 for w in words if re.search(r"[a-z][0-9~*^|{}@]|[0-9~*^|{}@][a-z]", w.lower())
              or (w.isalpha() and vocabulary.get(w.lower(), 0) <= 2))
    return bad / max(1, len(words))


def vocabulary_of(work):
    cached = work / "vocab-docfreq.json"
    if cached.exists():
        return json.loads(cached.read_text(encoding="utf-8"))
    counts = collections.Counter()
    for path in (work / "text").glob("*/*.txt"):
        counts.update(set(re.findall(r"[a-z]+", path.read_text(encoding="utf-8", errors="replace").lower())))
    cached.write_text(json.dumps(counts), encoding="utf-8")
    return counts


def text_path(work, capture):
    path = work / "text" / capture
    return path.with_suffix(".txt") if path.suffix.lower() == ".pdf" else path.with_name(path.name + ".txt")


def merge(args):
    import csv
    import yaml
    work = pathlib.Path(args.work)
    batch_documents = {}
    for path in sorted((work / "batches").glob("batch-*.json")):
        for document in json.loads(path.read_text(encoding="utf-8"))["documents"]:
            document["batch"] = path.stem
            batch_documents[document["document"]] = document
    checked = {r["id"]: r for r in json.loads((work / "documents-checked.json").read_text(encoding="utf-8"))}
    nations = json.loads((work / "nations.json").read_text(encoding="utf-8"))
    second = {}
    if (work / "second-look.json").exists():
        second = json.loads((work / "second-look.json").read_text(encoding="utf-8"))
    vocabulary = vocabulary_of(work)
    texts = {}
    items, private, without, queue, reviewed = [], [], [], [], {}
    for path in sorted((work / "verdicts").glob("batch-*.json")):
        for verdict in json.loads(path.read_text(encoding="utf-8")):
            document_id = verdict["document"]
            document = batch_documents[document_id]
            record = checked[document_id]
            sections = {s["ref"]: s for s in document["sections"]}
            if record["capture"] not in texts:
                raw = text_path(work, record["capture"]).read_text(encoding="utf-8", errors="replace")
                texts[record["capture"]] = (normalize(raw), loose(raw))
            exact_text, loose_text = texts[record["capture"]]
            profiles = [n["profile"] for n in document["nations"] if n["profile"]]
            common = {
                "document": document_id, "nations": profiles,
                "profiles": [n["profile_path"] for n in document["nations"] if n["profile_path"]],
                "list_nation_column": document["nations"][0]["list_nation_column"],
                "document_kind": document["document_kind"], "listed_date": document["listed_date"],
                "link": document["link"], "final_link": document["final_link"], "source": CATALOG_SOURCE,
                "batch": document["batch"],
            }
            document_flags = [DOCUMENT_FLAGS[document_id]] if document_id in DOCUMENT_FLAGS else []
            reviewed[document_id] = []
            if not verdict["items"]:
                without.append({**common, "none_found_reason": verdict.get("none_found_reason") or "not given",
                                "skipped": verdict.get("skipped", []), "flags": document_flags,
                                "first_reader": FIRST_READER})
            for number, item in enumerate(verdict["items"], start=1):
                item_id = f"{document_id}#i{number}"
                flags = list(document_flags)
                missing = [r for r in item["refs"] if r not in sections]
                if missing:
                    flags.append("ref-not-in-batch: " + ", ".join(missing))
                passage = "\n".join(sections[r]["text"] for r in item["refs"] if r in sections)
                snippet = item.get("snippet") or ""
                words = len(snippet.split())
                if not snippet.strip():
                    quote_check = "no-snippet"
                elif normalize(snippet) in exact_text:
                    quote_check = "exact"
                elif loose(snippet) and loose(snippet) in loose_text:
                    quote_check = "exact-ignoring-case-and-punctuation"
                else:
                    quote_check = "not-found"
                    flags.append("snippet-not-found-in-document-text")
                if words >= SNIPPET_WORD_LIMIT:
                    flags.append(f"snippet-too-long: {words} words")
                score = garble_score(passage, vocabulary)
                ocr = score > GARBLED
                if any(sections.get(r, {}).get("on_approval_letter") for r in item["refs"]):
                    flags.append("rests-on-approval-letter-passage")
                needs_second = item["confidence"] == "low" or ocr
                look = second.get(item_id)
                if needs_second and not look:
                    queue.append({"id": item_id, "reason": "low confidence" if item["confidence"] == "low"
                                  else "text read by an earlier scanner's character recognition",
                                  "garble": round(score, 3), "item": item, "passage": passage})
                if look:
                    second_look = {"verdict": look["verdict"], "kind": look.get("kind", item["kind"]),
                                   "reason": look["reason"], "reader": SECOND_READER}
                elif needs_second:
                    second_look = {"verdict": "not-rechecked", "kind": item["kind"],
                                   "reason": "queued for a second look but not yet read", "reader": ""}
                else:
                    second_look = {"verdict": "not-queued", "kind": item["kind"],
                                   "reason": "medium or high confidence on clean text", "reader": ""}
                current_kind = ("not-a-dispute-procedure" if second_look["verdict"] == "not-a-dispute-procedure"
                                else second_look["kind"])
                row = {
                    "id": item_id, **common,
                    "locator": item["locator"], "kind": item["kind"], "current_kind": current_kind,
                    "steps": item["steps"], "steps_summary": item["steps_summary"],
                    "final_decision_maker": item["final_decision_maker"], "refers_to": item.get("refers_to", ""),
                    "framed_as_dispute_resolution": item.get("framed_as_dispute_resolution"),
                    "confidence": item["confidence"], "refs": item["refs"],
                    "quote_check": quote_check, "snippet_words": words, "ocr_text": ocr,
                    "garble_score": round(score, 3),
                    "verification": "read-in-full" if quote_check.startswith("exact") else "inferred",
                    "first_reader": FIRST_READER, "second_look": second_look, "flags": flags,
                    "as_of": REVIEW_DATE, "lead_author_decision": None,
                }
                items.append(row)
                private.append({"id": item_id, "snippet": snippet, "quote_check": quote_check})
                if current_kind != "not-a-dispute-procedure":
                    reviewed[document_id].append(item_id)
    (work / "second-look-queue.json").write_text(json.dumps(queue, ensure_ascii=False, indent=1) + "\n",
                                                 encoding="utf-8")
    kept = [i for i in items if i["current_kind"] != "not-a-dispute-procedure"]
    # Public review files: summaries and checks, no quotation of the ordinances.
    out = ROOT / REVIEW_BASE
    payload = {
        "about": ("Dispute procedures found in Tribal gaming ordinances on the National Indian Gaming Commission's "
                  "list, for the lead author to accept, change or reject (scope rule of Nov. 22, 2026: collect now, "
                  "classify later). Summaries only; the short verbatim snippets checked against each document are "
                  "kept privately. Built by scripts/review/ordinance_disputes.py merge."),
        "items": items, "documents_without_items": without,
    }
    out.with_suffix(".json").write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    columns = ["id", "nations", "list_nation_column", "document", "document_kind", "listed_date", "final_link",
               "section", "pages", "kind", "current_kind", "who_hears", "time_limits", "review_or_appeal",
               "mediation_arbitration_court", "steps_summary", "final_decision_maker", "refers_to",
               "framed_as_dispute_resolution", "confidence", "quote_check", "ocr_text", "second_look_verdict",
               "second_look_kind", "second_look_reason", "flags", "lead_author_decision"]
    with out.with_suffix(".csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(columns)
        for i in items:
            writer.writerow([i["id"], " ".join(i["nations"]), i["list_nation_column"], i["document"],
                             i["document_kind"], i["listed_date"], i["final_link"] or i["link"],
                             i["locator"].get("section", ""), i["locator"].get("pages", ""), i["kind"],
                             i["current_kind"], i["steps"].get("who_hears", ""), i["steps"].get("time_limits", ""),
                             i["steps"].get("review_or_appeal", ""), i["steps"].get("mediation_arbitration_court", ""),
                             i["steps_summary"], i["final_decision_maker"], i["refers_to"],
                             i["framed_as_dispute_resolution"], i["confidence"], i["quote_check"], i["ocr_text"],
                             i["second_look"]["verdict"], i["second_look"]["kind"], i["second_look"]["reason"],
                             "; ".join(i["flags"]), ""])
    try:
        PRIVATE_COPY.parent.mkdir(parents=True, exist_ok=True)
        PRIVATE_COPY.write_text(json.dumps(private, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    except OSError as error:
        print(f"private copy not written: {error}", file=sys.stderr)
    # Search logs, one per profile.
    log_status = collections.Counter()
    log_root = ROOT / "research/search-logs" / SEARCH_LOG_TOPIC
    for key, nation in sorted(nations.items()):
        if not nation["profile"] or not nation["profile_path"]:
            continue
        searches, next_steps = [], []
        for summary in nation["documents_checked"]:
            record = checked[summary["id"]]
            address = record["final_link"] or record["link"]
            label = f"{record['kind']} listed {record['listed_date']}"
            entry = {"date": REVIEW_DATE, "searched_by": "Claude (AI assistant)", "place_kind": "project-capture",
                     "address": address, "query": QUERY}
            if summary["id"] in reviewed:
                kept_here = reviewed[summary["id"]]
                entry["method"] = "ai-review"
                if kept_here:
                    kinds = sorted({i["current_kind"] for i in kept if i["id"] in kept_here})
                    entry["outcome"] = "found"
                    entry["reason"] = (f"Small-model reviewers read the passages the script cut from this {label} "
                                       f"and recorded {len(kept_here)} procedure(s): {', '.join(kinds)}.")
                    entry["records"] = [f"{REVIEW_BASE}.json#{i}" for i in kept_here]
                else:
                    entry["outcome"] = "not-found"
                    entry["reason"] = (f"Small-model reviewers read the passages the script cut from this {label} "
                                       "and found no dispute procedure in them.")
                if summary["id"] in DOCUMENT_FLAGS and DOCUMENT_FLAGS[summary["id"]].startswith("needs-full"):
                    next_steps.append(f"Read the whole {label} ({address}); its dispute section was not in the "
                                      "extracted passages.")
            else:
                entry["method"] = "script"
                outcome = record["outcome"]
                if outcome in ("candidate", "partly-scanned"):
                    entry["outcome"] = "found"
                    entry["reason"] = (f"scripts/review/ordinance_disputes.py found candidate sections "
                                       f"({', '.join(record.get('kinds_detected', []))}) in this {label}; reviewers "
                                       "read a newer document with the same kinds instead.")
                elif outcome == "scanned-unreadable":
                    entry["outcome"] = "scanned-unreadable"
                    entry["reason"] = f"This {label} has no text layer on most pages ({record['reason']})."
                    next_steps.append(f"Read the scanned {label} ({address}) with OCR or by hand.")
                elif outcome == "not-captured":
                    entry["outcome"] = "error"
                    entry["reason"] = f"The gaming catalog has no capture of this {label}."
                    next_steps.append(f"Download and read the {label} ({address}).")
                else:
                    entry["outcome"] = "not-found"
                    entry["reason"] = (f"scripts/review/ordinance_disputes.py read this {label} and found no "
                                       f"candidate section ({record['reason']}).")
            if record["outcome"] == "partly-scanned":
                next_steps.append(f"Some pages of the {label} ({address}) have no text layer; read them with OCR.")
            searches.append({k: entry[k] for k in ("date", "searched_by", "method", "place_kind", "address",
                                                   "query", "outcome", "reason", "records") if k in entry})
        outcomes = {s["outcome"] for s in searches}
        if "found" in outcomes and not any(s["method"] == "ai-review" and s["outcome"] == "found" for s in searches):
            next_steps.append("Reviewers found no procedure in the document they read; the script found candidate "
                              "sections in older documents, which no reviewer has read yet.")
        status = ("found" if "found" in outcomes else "partly-searched"
                  if outcomes & {"scanned-unreadable", "error"} or next_steps else "none-found")
        log_status[status] += 1
        log = {"profile": nation["profile_path"], "topic": SEARCH_LOG_TOPIC, "status": status,
               "last_searched": REVIEW_DATE, "searches": searches}
        if next_steps:
            log["next_steps"] = " ".join(dict.fromkeys(next_steps))
        elif status == "found":
            log["next_steps"] = ("The lead author decides the procedures in "
                                 f"{REVIEW_BASE}.csv; the nation's own current ordinance may differ from the list's copy.")
        else:
            log["next_steps"] = ("Every ordinance document on the Commission's list was read; look for gaming "
                                 "regulations or a patron dispute policy on the nation's or its gaming commission's "
                                 "website.")
        first = key[0] if key[0].isalpha() else "_other"
        path = log_root / first / f"{key}.yaml"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(yaml.dump(log, sort_keys=False, allow_unicode=True, width=100), encoding="utf-8")
    counts = {
        "date": REVIEW_DATE,
        "documents_in_catalog": len(checked),
        "document_outcomes": dict(collections.Counter(r["outcome"] for r in checked.values())),
        "documents_reviewed": len(reviewed),
        "documents_without_items": len(without),
        "items": len(items),
        "items_by_kind": dict(collections.Counter(i["kind"] for i in items)),
        "items_by_confidence": dict(collections.Counter(i["confidence"] for i in items)),
        "items_by_current_kind": dict(collections.Counter(i["current_kind"] for i in items)),
        "quote_check": dict(collections.Counter(i["quote_check"] for i in items)),
        "snippets_25_words_or_more": sum(1 for i in items if i["snippet_words"] >= SNIPPET_WORD_LIMIT),
        "ocr_text_items": sum(1 for i in items if i["ocr_text"]),
        "second_look": dict(collections.Counter(i["second_look"]["verdict"] for i in items)),
        "second_look_kind_changes": dict(collections.Counter(
            f"{i['kind']} -> {i['second_look']['kind']}" for i in items if i["second_look"]["verdict"] == "change-kind")),
        "nations": len(nations),
        "nations_with_profile": sum(1 for n in nations.values() if n["profile"]),
        "nations_with_kept_items": len({n for i in kept for n in (i["nations"] or [i["list_nation_column"]])}),
        "nations_by_kept_kind": {k: len({n for i in kept if i["current_kind"] == k for n in i["nations"]})
                                 for k in PRIORITY[:2] + ["licensing-hearing", "other"]},
        "items_naming_method": {m: sum(1 for i in kept if re.search(p, " ".join(i["steps"].values()).lower()))
                                for m, p in (("arbitration", r"arbitrat"), ("mediation", r"\bmediat"),
                                             ("peacemaking", r"peacemak"), ("tribal court", r"tribal court"))},
        "search_logs": dict(log_status),
        "second_look_queue_left": len(queue),
    }
    out.with_name(out.name + "-counts.json").write_text(json.dumps(counts, ensure_ascii=False, indent=1) + "\n",
                                                        encoding="utf-8")
    print(json.dumps(counts, indent=1))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    command = sub.add_parser("batches")
    command.add_argument("--work", required=True)
    command.add_argument("--captures", default=str(DEFAULT_CAPTURES))
    command = sub.add_parser("merge")
    command.add_argument("--work", required=True)
    args = parser.parse_args()
    if args.command == "batches":
        batches(args)
    else:
        merge(args)


if __name__ == "__main__":
    sys.exit(main())
