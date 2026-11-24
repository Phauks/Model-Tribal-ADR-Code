"""Count the nations whose captured law texts mention a model or uniform law.

Reads the tribal law crawl index (research/tribal-law/documents.json) and the
plain text of each captured page or file, and lists, for each model law below,
the nations with at least one text that names it. A mention is a lead, not
proof of adoption: a code may cite a model it rejected, and a nation that
adopted one may not have a text in the crawl. The crawl covers only nations
whose codes earlier threads found online.

Run from the repository root:
    python3 scripts/analysis/model_code_mentions.py <captures folder> research/nill-coverage/model-code-mentions.json
where <captures folder> holds the .txt files named in documents.json (for
example /mnt/project-files/research/captures/tribal-law/documents).
"""

import collections
import json
import pathlib
import re
import sys

# Search patterns, matched anywhere in a text, ignoring case. Chosen by the
# project as the names each model law is cited by (project analysis).
PATTERNS = {
    "Indian Child Welfare Act (federal statute codes often implement)": r"Indian Child Welfare Act",
    "Uniform Commercial Code or Article 9 (any secured transactions law)": r"Article 9|Uniform Commercial Code",
    "Violence Against Women Act Tribal criminal jurisdiction": r"Violence Against Women|special domestic violence criminal jurisdiction|special Tribal criminal jurisdiction",
    "A code of judicial conduct (most follow the ABA or NAICJA models)": r"Code of Judicial Conduct",
    "Sex Offender Registration and Notification Act (SMART Office model code)": r"Sex Offender Registration and Notification Act|Adam Walsh",
    "Model Tribal Secured Transactions Act, or a secured transactions act or code": r"Model Tribal Secured Transactions|Secured Transactions (Act|Code)",
    "HEARTH Act leasing regulations": r"HEARTH Act|Helping Expedite and Advance Responsible",
    "Uniform Child Custody Jurisdiction and Enforcement Act": r"Uniform Child Custody Jurisdiction",
    "Tribal Law and Order Act enhanced sentencing": r"Tribal Law and Order Act",
    "American Indian Probate Reform Act (Tribal probate codes)": r"American Indian Probate Reform|\bAIPRA\b",
    "Uniform Interstate Family Support Act": r"Uniform Interstate Family Support",
    "Uniform Electronic Transactions Act": r"Uniform Electronic Transactions",
}


def main():
    captures, output = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    mentions = collections.defaultdict(set)
    texts, nations = 0, set()
    for doc in json.load(open("research/tribal-law/documents.json", encoding="utf-8")):
        if doc.get("http_status") != "200" or not doc.get("capture"):
            continue
        path = captures / (pathlib.Path(doc["capture"]).stem + ".txt")
        if not path.exists():
            continue
        texts += 1
        nations.update(doc["nations"])
        text = path.read_text(encoding="utf-8", errors="replace")
        for name, pattern in PATTERNS.items():
            if re.search(pattern, text, re.I):
                mentions[name].update(doc["nations"])
    result = {
        "generated": "2026-11-24",
        "texts_scanned": texts,
        "nations_scanned": len(nations),
        "nations_mentioning": {name: sorted(mentions[name]) for name in sorted(PATTERNS, key=lambda n: -len(mentions[n]))},
    }
    output.write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8")
    for name, found in result["nations_mentioning"].items():
        print(len(found), name)


if __name__ == "__main__":
    main()
