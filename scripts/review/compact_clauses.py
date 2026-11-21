"""Gather each nation's own gaming compact text for the compact dispute
clauses that were copied from another nation's compact (row 1 of the dataset
gap audit, research/analyses/2026-11-21-dataset-gap-audit.md).

    python3 scripts/review/compact_clauses.py gather WORK_DIRECTORY

For every `gaming.compacts[]` fact whose note says "nation-specific text not
checked", lists that nation's compact documents for the same state from the
Office of Indian Gaming list facts in the profile (categories Approve, Deemed
Approved and Secretarial Procedures; extensions are left out), downloads each
PDF, extracts its text with pdftotext, and writes one evidence file per fact
to WORK_DIRECTORY/evidence/ with the text that follows each heading naming
dispute resolution (table-of-contents lines and patron or employee dispute
headings are skipped). Reviewers then read the evidence files; their
verdicts are merged into research/reviews/ by scripts/review/gap_review.py.

Needs `curl` and `pdftotext` (poppler-utils). Never writes to a profile.
"""

import hashlib
import json
import pathlib
import re
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import record_facts  # noqa: E402

LIST_SOURCE = "office-of-indian-gaming-compacts-list-2026"
KEPT_CATEGORIES = ("Approve", "Deemed Approved", "Secretarial Procedures")
LISTED = re.compile(r'Listed as: "([^"]*)" \(([^)]*)\)')
DOCUMENT = re.compile(r"Document: (\S+?\.pdf)", re.IGNORECASE)
HEADING = re.compile(
    r"^[ \t]*(?:(?:SECTION|Section|PART|Part|ARTICLE|Article)\s*)?[0-9IVXL]*[0-9IVXL.()A-Za-z]{0,6}"
    r"[.:)\-\s]*[^\n]{0,40}(?:DISPUTE|Dispute)[^\n]{0,60}$", re.MULTILINE)
SECTION_CHARACTERS = 6000


def candidates(tree):
    found = []
    for file, profile in tree.profiles.items():
        compacts = (profile.get("gaming") or {}).get("compacts") or []
        for index, fact in enumerate(compacts):
            if "dispute_resolution_summary" not in fact:
                continue
            if "nation-specific text not checked" not in str(fact.get("note", "")):
                continue
            documents = []
            for row in compacts:
                if row.get("source") != LIST_SOURCE or row.get("state") != fact.get("state"):
                    continue
                listed = LISTED.search(row.get("note", ""))
                link = DOCUMENT.search(row.get("note", ""))
                if listed and listed.group(2) in KEPT_CATEGORIES:
                    documents.append({"title": listed.group(1), "category": listed.group(2),
                                      "date": str(row.get("approved") or row.get("as_of")),
                                      "link": link.group(1) if link else None})
            documents.sort(key=lambda d: d["date"], reverse=True)
            found.append({"profile": file, "compact_index": index, "nation": profile["names"]["official"],
                          "state": fact["state"], "current_summary": fact["dispute_resolution_summary"],
                          "current_summary_copied_from": fact["source"], "current_as_of": str(fact.get("as_of")),
                          "documents": documents})
    return found


def heading_score(text, match):
    line = match.group(0)
    if re.search(r"\.{4,}|\s\d{1,3}\s*$", line):
        return -1  # a table-of-contents line
    score = 0
    if re.search(r"resolution", line, re.IGNORECASE):
        score += 3
    if re.search(r"patron|player|customer|employee|claims? by", line, re.IGNORECASE):
        score -= 4
    if line.strip().isupper():
        score += 1
    if re.search(r"^\s*(section|part|article|[0-9IVX]+\.)", line, re.IGNORECASE):
        score += 1
    if len(re.findall(r"\.{4,}", text[match.end():match.end() + 800])) > 2:
        score -= 5
    return score


def dispute_sections(text):
    ranked = sorted(((heading_score(text, m), m.start()) for m in HEADING.finditer(text)), reverse=True)
    return [re.sub(r"[ \t]+", " ", text[start:start + SECTION_CHARACTERS])
            for score, start in ranked[:2] if score >= 2]


def text_of(link, work):
    name = hashlib.sha1(link.encode()).hexdigest()[:16]
    text_file = work / "text" / f"{name}.txt"
    if not text_file.exists():
        pdf = work / "pdf" / f"{name}.pdf"
        subprocess.run(["curl", "-sL", "-m", "120", "--retry", "3", "-o", str(pdf), link], check=False)
        subprocess.run(["pdftotext", "-layout", str(pdf), str(text_file)], check=False)
        pdf.unlink(missing_ok=True)
    return text_file.read_text(encoding="utf-8", errors="replace") if text_file.exists() else None


def gather(work):
    for folder in ("pdf", "text", "evidence"):
        (work / folder).mkdir(parents=True, exist_ok=True)
    items = candidates(record_facts.Tree("."))
    for number, item in enumerate(items, start=1):
        for document in item["documents"]:
            text = text_of(document["link"], work) if document["link"] else None
            document["text_characters"] = len(text or "")
            document["opening"] = (text or "")[:700]
            document["dispute_sections"] = dispute_sections(text or "")
        item["item_id"] = number
        (work / "evidence" / f"item-{number:03d}.json").write_text(
            json.dumps(item, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(items)} copied compact clauses; evidence in {work / 'evidence'}")


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] != "gather":
        sys.exit(__doc__)
    gather(pathlib.Path(sys.argv[2]))
