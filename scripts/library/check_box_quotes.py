#!/usr/bin/env python3
"""Check every case and law box quotation against the text it quotes, in the
source library (library.py), and keep its ellipses honest.

A quotation in a record's `case_box` or `law_box` must match the opinion or
the enacted text word for word, and "..." marks only words that are really
left out (docs/style-guide.md, "Quotations"; Indigo Book R8.3.7: "When
omitting material following a final punctuation mark, do not use an
ellipsis"). So:

  - a quotation that ends where the court's sentence ends keeps the
    sentence's own period (or "?" or "!") and takes no trailing "...";
  - a trailing "..." is right only when the sentence goes on after the last
    quoted word;
  - a leading "..." is right only when the sentence began before the first
    quoted word.

For each quotation the script finds the words in the documents the record
cites (the official report first, then other copies; a match in the
syllabus gives way to one in the opinion), and looks at the characters just
before and just after them. Matching ignores case, punctuation, spacing and
line-break hyphens, so a scan's hyphenation and curly quotation marks do not
hide a match; the words themselves must all be there, in order.

What it finds goes to research/quotes/box-quote-endings.json with --write:
one entry for each quotation that begins or ends with "...", saying whether
the sentence goes on at that end. scripts/lint_records.py reads that file,
so a pull request that adds or changes a quotation with "..." at either end
fails until this script has confirmed it (check "quote-ellipsis"). An entry
whose `how` is "read by hand" was checked by a person or Claude against a
copy the library cannot match (a scan too poor to read, say); --write keeps
those while their quotation is unchanged.

Commands (run from the repository root; the library downloads on first use,
see library.py):
  python3 scripts/library/check_box_quotes.py            # report
  python3 scripts/library/check_box_quotes.py --fix      # drop needless trailing "..."
  python3 scripts/library/check_box_quotes.py --write    # save the endings file
  python3 scripts/library/check_box_quotes.py --record cherokee-nation-v-georgia

--fix replaces a trailing "..." after a quotation that ends its sentence with
that sentence's own closing mark, placed before any closing quotation mark
the quotation already has ('status" ...' becomes 'status."'). It changes
nothing else; every other problem is for a person to read and decide.
"""

from __future__ import annotations

import argparse
import datetime
import json
import re
import sys
import unicodedata
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import library  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
ENDINGS_FILE = ROOT / "research" / "quotes" / "box-quote-endings.json"
BOXES = ("case_box", "law_box")
ELLIPSIS = r"(?:\.\s?\.\s?\.|…)"
LEADING = re.compile(rf"^\s*{ELLIPSIS}\s*")
TRAILING = re.compile(rf"\s*{ELLIPSIS}\s*$")
CLOSERS = "\"”’'"
SENTENCE_ENDS = ".?!"
# A quoted run of words is allowed this many letters of other text between
# two of its parts: an ellipsis may leave out a lot, a bracket only a little.
GAP_AFTER_ELLIPSIS = 4000
GAP_AFTER_BRACKET = 40


def letters(text: str) -> tuple[str, list[int]]:
    """The text's letters and digits, folded to lowercase, with each one's
    index in the original text. Ligatures and accents are folded too."""
    out: list[str] = []
    where: list[int] = []
    for index, character in enumerate(text):
        for piece in unicodedata.normalize("NFKD", character):
            if piece.isalnum():
                for folded in piece.casefold():
                    out.append(folded)
                    where.append(index)
    return "".join(out), where


def quotation_parts(text: str) -> list[tuple[str, int]]:
    """The runs of words a quotation must contain, in order, each with the
    most other letters allowed before it (after the previous run)."""
    body = LEADING.sub("", TRAILING.sub("", text))
    body = re.sub(r"\[@[^\]]*\]", "", body)
    parts: list[tuple[str, int]] = []
    gap = 0
    for chunk in re.split(rf"({ELLIPSIS}|\[[^\]@]*\])", body):
        if not chunk:
            continue
        if re.fullmatch(ELLIPSIS, chunk):
            gap = GAP_AFTER_ELLIPSIS
            continue
        if chunk.startswith("["):
            # "[w]e" changes a letter; "[and]" adds a word. Keep a one- or
            # two-letter change in the run, and let a longer one stand for
            # a few letters of the source.
            inner = letters(chunk[1:-1])[0]
            if len(inner) <= 2 and parts and gap == 0:
                parts[-1] = (parts[-1][0] + inner, parts[-1][1])
                continue
            if len(inner) <= 2 and not parts:
                parts.append((inner, gap))
                gap = 0
                continue
            gap = max(gap, GAP_AFTER_BRACKET)
            continue
        run = letters(chunk)[0]
        if not run:
            continue
        if parts and gap == 0:
            parts[-1] = (parts[-1][0] + run, parts[-1][1])
        else:
            parts.append((run, gap))
        gap = 0
    return parts


# A scanned report's running head: the page number, the term, the case name
# and which opinion the page holds ("OCTOBER TERM, 1900.", "Opinion of the
# Court.", "WHITE, J., concurring."). It can fall in the middle of a quotation.
RUNNING_HEAD = re.compile(r"TERM,|Opinion of the Court|Syllabus|concurring|dissenting|Statement of the Case|^\W*\d+\W*$|\bv\.\s")


def without_running_heads(text: str) -> str:
    lines = text.split("\n")
    dropped = 0
    heads = 0
    while dropped < len(lines) and heads < 3:
        line = lines[dropped]
        if not line.strip():
            dropped += 1
            continue
        if len(line) >= 80 or not RUNNING_HEAD.search(line):
            break
        dropped += 1
        heads += 1
    # Keep the length, so indexes still point into the page as it is.
    return "\n".join(" " * len(line) if number < dropped else line for number, line in enumerate(lines))


class Document:
    def __init__(self, document_id: int, key: str, connection, heads: bool = True):
        self.key = key
        texts = []
        self.page_starts: list[tuple[int, str]] = []
        offset = 0
        for page, label, text in connection.execute(
            "select page, label, text from pages where document_id = ? order by sequence", (document_id,)
        ):
            self.page_starts.append((offset, str(label or page or "")))
            texts.append(text if heads else without_running_heads(text))
            offset += len(text) + 1
        self.raw = "\n".join(texts)
        self.folded, self.where = letters(self.raw)

    def page_at(self, raw_index: int) -> str:
        label = ""
        for start, name in self.page_starts:
            if start > raw_index:
                break
            label = name
        return label

    def matches(self, parts: list[tuple[str, int]]):
        """Each place the parts occur in order, as (first, last) raw indexes
        of the first and last matched letters."""
        if not parts:
            return
        first_run = parts[0][0]
        position = self.folded.find(first_run)
        while position != -1:
            end = position + len(first_run)
            ok = True
            for run, gap in parts[1:]:
                found = self.folded.find(run, end, end + gap + len(run)) if gap else (end if self.folded.startswith(run, end) else -1)
                if found == -1:
                    ok = False
                    break
                end = found + len(run)
            if ok:
                yield self.where[position], self.where[end - 1]
            position = self.folded.find(first_run, position + 1)


def ending_after(raw: str, index: int) -> tuple[str, str]:
    """('sentence', mark) when the sentence ends right after raw[index], or
    ('continues', '') when it goes on. Closing quotation marks and brackets
    between the word and the mark are passed over; anything else (a footnote
    number, say) counts as the sentence going on, so the answer errs toward
    keeping an ellipsis."""
    rest = raw[index + 1 : index + 12]
    for character in rest:
        if character in SENTENCE_ENDS:
            return "sentence", character
        if character.isspace() or character in CLOSERS + ")]":
            continue
        return "continues", ""
    return "sentence", "."


def beginning_before(raw: str, index: int) -> str:
    """'sentence' when a sentence (or the text) starts at raw[index], else
    'continues'. Opening quotation marks and brackets are passed over; a
    footnote number after a period counts as words, so the answer errs
    toward keeping an ellipsis."""
    position = index - 1
    while position >= 0 and (raw[position].isspace() or raw[position] in "\"“‘'([" ):
        position -= 1
    if position < 0:
        return "sentence"
    if re.search(r"(\.\s?\.\s?\.|…)$", raw[max(0, position - 5) : position + 1]):
        # The court's own ellipsis: words of its sentence were left out there.
        return "continues"
    return "sentence" if raw[position] in SENTENCE_ENDS else "continues"


OPINION_STARTS = re.compile(r"delivered\s+the\s+opinion|PER CURIAM|Per Curiam\.", re.IGNORECASE)


def in_syllabus(raw: str, first: int, last: int) -> bool:
    """Whether a match sits in a Supreme Court syllabus, which is the
    Reporter's summary and not the Court's words: it comes before the line
    that starts the opinion ("delivered the opinion of the Court", or "for a unanimous Court"), or is
    followed by "Pp. 5-8." or preceded by "Held:"."""
    after = raw[last + 1 : last + 30]
    before = raw[max(0, first - 40) : first]
    if re.match(r"^[.\s\"”]*Pp?\.\s*\d", after) or "Held:" in before:
        return True
    opening = OPINION_STARTS.search(raw)
    return bool(opening) and "Syllabus" in raw[: opening.start()] and first < opening.start()


def pinpoint_pages(pinpoint: str | None) -> set[str]:
    if not pinpoint:
        return set()
    numbers = re.findall(r"\d+", pinpoint.split("n.")[0])
    if len(numbers) >= 2 and "-" in pinpoint:
        low, high = int(numbers[0]), int(numbers[1])
        if 0 <= high - low < 20:
            return {str(n) for n in range(low, high + 1)}
    return set(numbers)


def official_first(key: str) -> int:
    if "usrep" in key or "supremecourt.gov" in key or "govinfo" in key:
        return 0
    if "westlaw" in key or "cornell" in key or key.startswith("cited-pages/"):
        return 2
    return 1


def box_quotes(record_filter: str | None):
    for path in sorted((ROOT / "content" / "sources").glob("*/*.yaml")):
        if record_filter and path.stem != record_filter:
            continue
        text = path.read_text(encoding="utf-8")
        if "quotes:" not in text:
            continue
        record = yaml.safe_load(text) or {}
        for box in BOXES:
            for index, quote in enumerate((record.get(box) or {}).get("quotes") or []):
                yield path, record.get("key") or path.stem, box, index, quote


def check(record_filter: str | None):
    connection = library.connect()
    documents: dict[tuple[int, bool], Document] = {}
    results = []
    for path, key, box, index, quote in box_quotes(record_filter):
        text = quote["text"]
        result = {
            "file": path.relative_to(ROOT).as_posix(),
            "record": key,
            "box": box,
            "index": index,
            "text": text,
            "pinpoint": quote.get("pinpoint"),
            "leading": bool(LEADING.match(text)),
            "trailing": bool(TRAILING.search(text)),
        }
        parts = quotation_parts(text)
        rows = connection.execute(
            "select d.document_id, d.key from documents d join citing_records c on c.document_id = d.document_id "
            "where c.record = ? and d.text_status != 'none'",
            (key,),
        ).fetchall()
        rows.sort(key=lambda row: official_first(row[1]))
        wanted_pages = pinpoint_pages(quote.get("pinpoint"))
        best = None
        attempts = [(row, True) for row in rows] + [(row, False) for row in rows]
        for (document_id, document_key), heads in attempts:
            if (document_id, heads) not in documents:
                documents[(document_id, heads)] = Document(document_id, document_key, connection, heads)
            document = documents[(document_id, heads)]
            found = list(document.matches(parts))
            if not found:
                continue

            def rank(match):
                first, last = match
                return (in_syllabus(document.raw, first, last), document.page_at(first) not in wanted_pages)

            first, last = min(found, key=rank)
            best = (document, first, last)
            break
        if best is None:
            result["found"] = False
            result["searched"] = [row[1] for row in rows]
            results.append(result)
            continue
        document, first, last = best
        end, mark = ending_after(document.raw, last)
        result.update(
            found=True,
            document=document.key,
            page=document.page_at(first),
            start=beginning_before(document.raw, first),
            end=end,
            mark=mark,
            syllabus=in_syllabus(document.raw, first, last),
            before=document.raw[max(0, first - 50) : first].replace("\n", " "),
            after=document.raw[last + 1 : last + 40].replace("\n", " "),
        )
        results.append(result)
    return results


def problems_of(result) -> list[str]:
    if not result["found"]:
        return ["not found in " + (", ".join(result["searched"]) or "any document the record cites")]
    problems = []
    if result["syllabus"]:
        problems.append("found only in the syllabus, which is the Reporter's summary, not the Court's words")
    if result["trailing"] and result["end"] == "sentence":
        problems.append(f'needless trailing "...": the sentence ends here with "{result["mark"]}"')
    if result["leading"] and result["start"] == "sentence":
        problems.append('needless leading "...": the sentence starts here')
    stripped = TRAILING.sub("", result["text"]).rstrip()
    if not result["trailing"] and result["end"] == "continues" and stripped[-1:] not in SENTENCE_ENDS + CLOSERS:
        problems.append('stops mid-sentence without "..."')
    return problems


def fixed_text(text: str, mark: str) -> str:
    body = TRAILING.sub("", text).rstrip()
    closing = ""
    while body and body[-1] in CLOSERS:
        closing = body[-1] + closing
        body = body[:-1]
    if body and body[-1] in SENTENCE_ENDS:
        return body + closing
    return body + mark + closing


def apply_fixes(results) -> int:
    changes: dict[str, list[tuple[str, str]]] = {}
    for result in results:
        if result["found"] and result["trailing"] and result["end"] == "sentence":
            changes.setdefault(result["file"], []).append((result["text"], fixed_text(result["text"], result["mark"])))
    count = 0
    for file, pairs in changes.items():
        path = ROOT / file
        source = path.read_text(encoding="utf-8")
        for old, new in pairs:
            old_line = "text: " + json.dumps(old, ensure_ascii=False)
            new_line = "text: " + json.dumps(new, ensure_ascii=False)
            if source.count(old_line) != 1:
                print(f"{file}: could not place the fix for {old[:60]!r}; change it by hand", file=sys.stderr)
                continue
            source = source.replace(old_line, new_line)
            count += 1
        path.write_text(source, encoding="utf-8")
        # The file must still say the same thing, apart from the fixed texts.
        yaml.safe_load(source)
    return count


def write_endings(results) -> int:
    """Save the endings of the quotations checked, keeping the entries for
    records this run did not check and the entries read by hand whose
    quotation is unchanged."""
    kept = []
    checked = {r["record"] for r in results}
    current = {(r["record"], r["text"]) for r in results}
    if ENDINGS_FILE.exists():
        for entry in json.loads(ENDINGS_FILE.read_text(encoding="utf-8")).get("quotations", []):
            if entry["record"] not in checked or (entry.get("how") == "read by hand" and (entry["record"], entry["text"]) in current):
                kept.append(entry)
    by_hand = {(entry["record"], entry["text"]) for entry in kept}
    today = datetime.date.today().isoformat()
    entries = list(kept)
    for result in results:
        if not (result["leading"] or result["trailing"]) or not result["found"]:
            continue
        if (result["record"], result["text"]) in by_hand:
            continue
        entry = {"record": result["record"], "text": result["text"], "document": result["document"], "page": result["page"]}
        if result["leading"]:
            entry["start"] = result["start"]
        if result["trailing"]:
            entry["end"] = result["end"]
        entry["how"] = "library"
        entry["checked"] = today
        entries.append(entry)
    entries.sort(key=lambda entry: (entry["record"], entry["text"]))
    document = {
        "about": "For each case or law box quotation that begins or ends with \"...\", whether the quoted sentence goes on past that end in the document it quotes ('continues') or starts or stops there ('sentence'). Written by scripts/library/check_box_quotes.py --write; read by scripts/lint_records.py (check quote-ellipsis).",
        "quotations": entries,
    }
    ENDINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    ENDINGS_FILE.write_text(json.dumps(document, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return len(entries)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--record", help="check only this record key")
    parser.add_argument("--fix", action="store_true", help='replace needless trailing "..." with the sentence\'s own mark')
    parser.add_argument("--write", action="store_true", help=f"save the endings to {ENDINGS_FILE.relative_to(ROOT)}")
    parser.add_argument("--json", help="also save every result to this file")
    arguments = parser.parse_args()

    results = check(arguments.record)
    if arguments.fix:
        fixed = apply_fixes(results)
        print(f"Fixed {fixed} needless trailing ellipses.")
        results = check(arguments.record)
    if arguments.json:
        Path(arguments.json).write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    problem_count = 0
    for result in results:
        for problem in problems_of(result):
            problem_count += 1
            where = f"{result['file']} {result['box']}.quotes[{result['index']}]"
            print(f"{where}: {problem}\n    {result['text'][:110]}")
    found = sum(result["found"] for result in results)
    print(f"\n{len(results)} quotations, {found} found in the library, {problem_count} problems.")
    if arguments.write:
        print(f"Saved {write_endings(results)} endings to {ENDINGS_FILE.relative_to(ROOT)}.")
    return 1 if problem_count else 0


if __name__ == "__main__":
    sys.exit(main())
