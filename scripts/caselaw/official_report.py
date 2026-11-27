"""Read facts back out of the official report of a Supreme Court case, to confirm what a record says.

supreme_court_native_cases.py builds each record from the Caselaw Access Project's text and the Supreme Court
Database and compares them with the official report. Where they disagree, an AI reader may have read the
scan (research/supreme-court-coverage/settled.json). This module checks the record against the official
report itself, so a disputed fact is settled by what the report prints:

- page_map: which printed page each page of the scan is, read from the page numbers and running heads, so
  a scan with an inserted plate or a missing last page still maps to the right report pages;
- opinion_headings: every opinion heading the report prints ("MR. JUSTICE REED delivered the opinion of the
  Court.", "JUSTICE BLACKMUN, with whom ... join, dissenting.", "PER CURIAM."), with its printed page;
- find_text: a line of the record (a caption, an "Argued ... Decided ..." line) in the report's text, first in
  the scan's own text layer and then in a fresh OCR of the page image (tesseract), which reads old type
  better than the 2000s text layer.

Nothing here writes records; the generator calls it and records the result of each check.
"""

from __future__ import annotations

import difflib
import json
import re
import subprocess
import unicodedata
from pathlib import Path


def plain(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    text = text.replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def best_run(needle: str, haystack: str) -> float:
    """How well the needle's words appear as one run in the haystack (0 to 1), allowing OCR slips."""
    words, hay = plain(needle).split(), plain(haystack).split()
    if not words or not hay:
        return 0.0
    target = " ".join(words)
    best = 0.0
    size = len(words)
    for width in {max(1, size - 2), size, size + 2}:
        for start in range(0, max(1, len(hay) - width + 1)):
            window = " ".join(hay[start:start + width])
            quick = difflib.SequenceMatcher(None, target, window, autojunk=False)
            if quick.real_quick_ratio() < best or quick.quick_ratio() < best:
                continue
            best = max(best, quick.ratio())
    return best


# ---------------------------------------------------------------- which printed page each scan page is


def _top_numbers(text: str, low: int, high: int) -> list[int]:
    """Page numbers printed at the head of a page (the first few lines), within the case's pages."""
    numbers = []
    for line in [line.strip() for line in text.splitlines() if line.strip()][:8]:
        for token in re.findall(r"(?<![\d,.])(\d{1,4})(?![\d,])", line):
            if low <= int(token) <= high and (len(line) <= 12 or re.match(rf"^\W*{token}\b", line) or re.search(rf"\b{token}\W*$", line)):
                numbers.append(int(token))
    return numbers


def _side(text: str) -> str | None:
    """Even pages carry the term ("OCTOBER TERM, 1891."), odd pages the case name."""
    head = " ".join(line.strip() for line in text.splitlines() if line.strip())[:80]
    if re.search(r"(?i)\b(o\w?c\w?t\w?o\w?b\w?e\w?r|term)\b", head[:40]):
        return "even"
    if re.search(r"[A-Z]{3,}.{0,40}\b[vr]\W", head[:80]) or re.search(r"(?i)\bin re\b|\bex parte\b", head[:40]):
        return "odd"
    first = next((line.strip() for line in text.splitlines() if line.strip()), "")
    letters = [c for c in first if c.isalpha()]
    if re.search(r"(?i)^\W*o\w?c|\bt\w?e\w?r|\b1[789]\d\d\b", first):
        return None  # a misread term line ("OCOBEII TERRI, 1903."): leave it to the page numbers
    if len(letters) >= 8 and sum(c.isupper() for c in letters) >= 0.8 * len(letters):
        return "odd"  # a short title in capitals ("THE CHICKASAW FREEDMEN.")
    return None


def page_map(pages: list[str], first: int, last: int | None) -> tuple[list[int | None], list[str]]:
    """The printed page of each scan page (None for an inserted plate or blank), and notes on what was found.

    The scan's pages follow the report's from the case's first page; an inserted page (a map, a fold-out, a
    printer's blank) shifts the rest. Page numbers the OCR can read anchor the count, and the running head
    (term on even pages, case name on odd ones) checks the pages between.
    """
    high = (last or first + len(pages)) + 3
    mapping: list[int | None] = []
    notes = []
    offset = 0
    for index, text in enumerate(pages):
        numbers = [n for n in _top_numbers(text, first, high) if n != first or index == 0]
        expected = first + index + offset
        if not text.strip() or re.search(r"GOVERNMENT PRINTING OFFICE", text) and expected not in numbers:
            mapping.append(None)
            offset -= 1
            notes.append(f"scan page {index + 1} is not a report page")
            continue
        if index and not numbers and not RUNNING_HEAD.search(text[:300]) and len(re.findall(r"\b[a-z]{3,}\b", text)) < 15:
            # an inserted map or plate: no page number, no running head and hardly a word of prose
            mapping.append(None)
            offset -= 1
            notes.append(f"scan page {index + 1} is not a report page (a map or plate)")
            continue
        if numbers and expected not in numbers:
            # follow a new count only when the next page agrees with it
            for number in numbers:
                shift = number - first - index
                ahead = _top_numbers(pages[index + 1], first, high) if index + 1 < len(pages) else []
                if first + index + 1 + shift in ahead or index + 1 == len(pages):
                    offset = shift
                    notes.append(f"scan page {index + 1} is p. {number}")
                    break
        mapping.append(first + index + offset)
    return mapping, notes


def map_checks(pages: list[str], mapping: list[int | None]) -> tuple[int, int, list[str]]:
    """How many pages show their own number or the running head their page side should carry, of how many could."""
    shown, wrong = 0, []
    for index, (text, printed) in enumerate(zip(pages, mapping)):
        if printed is None:
            continue
        numbers = _top_numbers(text, printed - 1, printed + 1)
        side = _side(text)
        if printed in numbers or (side and side == ("even" if printed % 2 == 0 else "odd")):
            shown += 1
        elif numbers or side:
            wrong.append(f"scan page {index + 1} reads as p. {numbers[0] if numbers else '?'} ({side or 'no head'}), not p. {printed}")
    return shown, sum(1 for p in mapping if p is not None), wrong


# ---------------------------------------------------------------- opinion headings

CUES = r"(?P<cue>delivered\s+the\s+opinion|announced\s+the\s+judgment|delivered\s+an\s+opinion|dissenting|concurring|dissents|concurs|dissent(?=\s+from)|concur(?=\s+in))"
HEADING = re.compile(
    r"(?ix)(?P<who>(?:m[rnbe]\s*\.?\s*)?(?:chief\s+)?just[il1]ces?\s+[\w'’\.\-]{2,24}(?:\s+[\w'’\.\-]{2,24})?|the\s+chief\s+justice"
    r"|[\w'’\-]{3,20}\s*,?\s*(?:ch\s*\.?\s*)?(?:j\s*\.|justice)\s*,?)"
    r"(?:\s*,?\s*after\s+stating\s+the\s+case,?)?"
    r"\s*,?\s*(?:with\s+whom\s+(?:concur(?:s|red)?\s+)?(?:[^.]|(?i:\b(?:mr|mb|m|j|jr|ch|c))\.){0,300}?(?:join|joins|joined|concur|concurs|concurred|agree|agrees)?\s*(?:as\s+to\s[^,]{0,60})?,?\s*)?" + CUES)


RUNNING_HEAD = re.compile(r"(?i)\bj\s*\.\s*,|opinion|october|term\b|syllabus|cite as|u\.\s?s\.|^\W*\d+\W*$|per curiam$|\bv\.|\bin re\b|\bex parte\b")

# What a heading's words say the opinion is; the same wording the generator reads in the Caselaw Access Project's text.
HEADING_KINDS = [
    (r"announced the judgment", "judgment"),
    (r"delivered an opinion", "plurality"),
    (r"delivered the opinion", "majority"),
    (r"concurring in part,? concurring in the judgment in part,? and dissenting in part", "concurrence in part, concurrence in the judgment in part, and dissent in part"),
    (r"concurring in part and dissenting in part", "concurrence in part and dissent in part"),
    (r"concurring in part and concurring in the judgment|concurring in part and in the judgment", "concurrence in part and in the judgment"),
    (r"concurring in part and concurring in the result", "concurrence in part and in the result"),
    (r"concurring in the judgment,? and dissenting in part", "concurrence in the judgment and dissent in part"),
    (r"dissenting in part", "dissent in part"),
    (r"concurring in the judgment", "special concurrence"),
    (r"concurring in the result", "concurrence in the result"),
    (r"dissenting", "dissent"),
    (r"concurring", "concurrence"),
]


def heading_kind(text: str) -> str:
    text = re.sub(r"\s+", " ", text.lower())
    for pattern, kind in HEADING_KINDS:
        if re.search(pattern, text):
            return kind
    return "opinion"


def body_text(text: str) -> str:
    """A page's words without its running head: the page number, term, case name or "BLACKMUN, J., dissenting" lines at its top."""
    lines = text.splitlines()
    kept, at_top = [], True
    for line in lines:
        stripped = line.strip()
        if at_top and (not stripped or (len(stripped) <= 80 and RUNNING_HEAD.search(stripped) and not re.search(r"(?i)justice|delivered|announced|^per curiam\.$", stripped))):
            continue
        at_top = False
        kept.append(stripped)
    flat = re.sub(r"\s+", " ", " ".join(kept))
    return re.sub(r"(\w)[-\u00ad] (\w)", r"\1\2", flat)  # words broken at a line's end


def opinion_headings(pages: list[str], mapping: list[int | None], day: str, justices, last: int | None = None) -> list[dict]:
    """Every opinion heading the report prints on the case's pages, with its printed page, the words that name the
    Justice, and the kind of opinion the heading's words give. The syllabus's list of opinions ("filed a dissenting
    opinion", "delivered the opinion of the Court, in which ...") and citations to opinions are left out."""
    found = []
    for index, text in enumerate(pages):
        printed = mapping[index] if index < len(mapping) else None
        if printed is None or (last and printed > last):
            continue
        flat = body_text(text)
        for match in HEADING.finditer(flat):
            before = flat[max(0, match.start() - 40):match.start()].lower()
            after = flat[match.end():match.end() + 200].lower()
            if re.search(r"(filed|joined?|joins|in which|see|post|ante|\(|\bat \d+|,\s*supra|opinion of)\W*$", before):
                continue
            if re.match(r"\s*(?:of the court|in the judgment|of the court with respect to[^.]{0,160}?)?\s*,?\s*(?:in which|and (?:an|the) opinion|and delivered)", after[:200]) and not re.match(r"[^.]{0,200}\bjoin", after) or re.match(r"\s*opinion", after):
                continue  # the syllabus's list of opinions
            if re.search(r"(?i)\bin which\b", after[:200]) and re.search(r"(?i)\bfiled\b", after[:300]) or re.search(r"(?i)concluding that|for a unanimous court", after[:200]):
                continue  # the syllabus
            cue = match["cue"].lower()
            if re.search(r"(?i)\bj\s*\.\s*,?\s*$", match["who"]) and not cue.startswith(("delivered", "announced")) and day >= "1850":
                continue  # "BLACKMUN, J., dissenting" is a running head; headings name "JUSTICE BLACKMUN"
            tail = flat[match.start():match.end() + (after.find(".") if "." in after else 120)]
            if cue in ("dissents", "concurs", "dissent", "concur"):
                # "MR. JUSTICE JACKSON dissents." notes a vote; a statement that goes on to give reasons is an opinion
                bare = re.match(r"\s*(?:in the (?:judgment|result))?\s*\.", after)
                kind = ("notes " if bare else "statement: ") + ("dissent" if cue.startswith("dissent") else "concurrence")
            else:
                kind = heading_kind(tail)
            found.append({"page": printed, "who": match["who"], "kind": kind, "text": tail[:220].strip(),
                          "chief": bool(re.search(r"(?i)the\s+chief\s+justice|chief\s+justice", match["who"]))})
        for match in re.finditer(r"(?i)\bper\s+curiam\b\.?", flat):
            before = flat[max(0, match.start() - 40):match.start()].lower()
            if re.search(r"(see|cf\.|\(|\bat \d+|u\. ?s\.[^.]{0,20})\W*$", before):
                continue
            found.append({"page": printed, "who": "", "kind": "per curiam", "text": match[0], "chief": False})
    return found


def names(heading: dict, justice_name: str, day: str, justices) -> bool:
    """Whether a heading's words name this Justice better than any other Justice then serving (OCR slips allowed)."""
    if heading["chief"] and re.search(r"(?i)the\s+chief\s+justice", heading["who"]):
        chief = [j for j in justices.serving(day) if j["role"] == "Chief Justice"]
        return bool(chief) and chief[0]["name"] == justice_name
    words = [plain(w).replace(" ", "") for w in re.findall(r"[^\W\d_][\w'’-]*", re.sub(r"(?i)\b(mr|me|mb|chief|justice|justices|ch|j)\b", " ", heading["who"]))]
    words = [w for w in words if len(w) > 1]
    if not words:
        return False

    def score(name):
        family = _family(name).replace(" ", "")
        return max(difflib.SequenceMatcher(None, family, w).ratio() for w in words + ["".join(words)])

    mine = score(justice_name)
    others = [score(j["name"]) for j in justices.serving(day) if j["name"] != justice_name]
    return mine >= 0.6 and mine > max(others, default=0)


# ---------------------------------------------------------------- fresh OCR of a page image


def ocr_page(pdf: Path, index: int, cache: Path) -> str:
    """The text of one scan page (0-based) read by tesseract from a 300 dpi image; cached beside the scan."""
    target = cache / "ocr" / f"{pdf.stem}-{index + 1}.txt"
    if target.exists():
        return target.read_text(encoding="utf-8")
    target.parent.mkdir(parents=True, exist_ok=True)
    stem = target.with_suffix("")
    subprocess.run(["pdftoppm", "-r", "300", "-gray", "-f", str(index + 1), "-l", str(index + 1), "-png", "-singlefile", str(pdf), str(stem)],
                   check=True, capture_output=True)
    image = stem.with_suffix(".png")
    result = subprocess.run(["tesseract", str(image), "-", "--psm", "4"], capture_output=True, check=True)
    image.unlink()
    text = result.stdout.decode("utf-8", "replace")
    target.write_text(text, encoding="utf-8")
    return text


def find_text(line: str, pages: list[str], indexes: list[int], pdf: Path | None, cache: Path) -> tuple[float, str, int | None]:
    """The best match for a line in the given scan pages: (score, "text layer" or "fresh OCR", scan index)."""
    best = (0.0, "text layer", None)
    for index in indexes:
        if 0 <= index < len(pages):
            score = best_run(line, pages[index])
            if score > best[0]:
                best = (score, "text layer", index)
    if best[0] < 0.95 and pdf and pdf.exists():
        for index in indexes:
            if 0 <= index < len(pages):
                score = best_run(line, ocr_page(pdf, index, cache))
                if score > best[0]:
                    best = (score, "fresh OCR", index)
    return best


def numbers(text: str) -> list[str]:
    """The figures in a line, in order ("Argued December 14, 17, 1900." -> 14, 17, 1900)."""
    return re.findall(r"\d+", text or "")


def has_numbers(line: str, text: str) -> bool:
    """Whether the page prints the line's figures one after another (words between them may differ, figures may not)."""
    wanted, found = numbers(line), numbers(re.sub(r"(\d),(\d{4})", r"\1, \2", text))
    return bool(wanted) and any(found[i:i + len(wanted)] == wanted for i in range(len(found) - len(wanted) + 1))


def ocr_pages(pdf: Path, indexes: list[int], cache: Path) -> dict[int, str]:
    return {index: ocr_page(pdf, index, cache) for index in indexes}


def save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")


# ---------------------------------------------------------------- confirming a record's facts

KIND_CUES = {
    "opinion of the Court": ("majority", "plurality", "judgment"),
    "judgment": ("judgment", "plurality"),
    "opinion": ("judgment", "plurality", "majority", "special concurrence", "concurrence", "dissent"),
    "dissenting": ("dissent", "dissent in part", "concurrence in part and dissent in part",
                   "concurrence in part, concurrence in the judgment in part, and dissent in part",
                   "concurrence in the judgment and dissent in part"),
    "concurring": ("concurrence", "special concurrence", "concurrence in the result", "concurrence in part and in the judgment",
                   "concurrence in part and dissent in part", "concurrence in part, concurrence in the judgment in part, and dissent in part",
                   "concurrence in the judgment and dissent in part"),
    "per curiam": ("per curiam",),
}


def _family(name: str) -> str:
    name = re.sub(r",?\s+(Jr\.|Sr\.|II|III)$", "", (name or "").strip())
    return plain(name.split()[-1]) if name.split() else ""


def confirm_opinions(listing: list[dict], pages: list[str], mapping: list[int | None], day: str, justices,
                     pdf: Path | None, cache: Path, last: int | None = None, base: int = 0) -> tuple[bool, str]:
    """Whether the report prints a heading for each opinion in the list, on its page, and no other opinion heading.

    The scan's text layer is read first; a page where an opinion's heading is not found is read again by fresh OCR.
    A bare line such as "MR. JUSTICE JACKSON dissents." is a vote noted without an opinion, not an opinion.
    """
    index_of = {printed: index for index, printed in enumerate(mapping) if printed is not None}
    headings = opinion_headings(pages, mapping, day, justices, last)
    missing, found_text = [], []
    for entry in listing:
        index = index_of.get(entry["page"])
        if index is None:
            missing.append(f"p. {entry['page']} is not in the scan")
            continue

        def match(candidates):
            for heading in candidates:
                if heading["page"] != entry["page"]:
                    continue
                if entry["kind"] == "per curiam" and heading["kind"] == "per curiam":
                    return heading
                if heading["kind"] == entry["kind"] and names(heading, entry["justice"], day, justices):
                    return heading
            return None

        hit = match(headings)
        if hit is None and pdf and pdf.exists():
            fresh = list(pages)
            fresh[index] = ocr_page(pdf, base + index, cache)
            hit = match(opinion_headings(fresh, mapping, day, justices, last))
            if hit:
                headings = [h for h in headings if h["page"] != entry["page"]] + opinion_headings([fresh[index]], [entry["page"]], day, justices)
        if hit:
            found_text.append(f"p. {entry['page']}: \"{hit['text']}\"")
        else:
            missing.append(f"no heading for the {entry['kind']} of {_family(entry['justice']).title() or 'the Court'} on p. {entry['page']}")
    others = []
    for heading in headings:
        if heading["kind"].startswith("notes"):
            continue
        if heading["kind"].startswith("statement"):
            if not any(e["page"] == heading["page"] and names(heading, e["justice"], day, justices) for e in listing):
                others.append(f"p. {heading['page']}: \"{heading['text']}\" (a statement with reasons)")
            continue
        if heading["kind"] == "per curiam":
            if not any(e["kind"] == "per curiam" and e["page"] == heading["page"] for e in listing):
                others.append(f"p. {heading['page']}: \"{heading['text']}\"")
            continue
        if not any(e["page"] == heading["page"] and e["kind"] == heading["kind"] and names(heading, e["justice"], day, justices) for e in listing):
            others.append(f"p. {heading['page']}: \"{heading['text']}\"")
    noted = [f"p. {h['page']}: \"{h['text']}\"" for h in headings if h["kind"].startswith("notes")]
    ok = not missing and not others
    detail = "; ".join(filter(None, [
        f"The report prints {'; '.join(dict.fromkeys(found_text))}" if found_text else "",
        f"not found: {'; '.join(missing)}" if missing else "",
        f"other headings: {'; '.join(dict.fromkeys(others))}" if others else "",
        f"votes noted without an opinion: {'; '.join(dict.fromkeys(noted))}" if noted else ""]))
    return ok, detail
