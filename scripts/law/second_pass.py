"""Second-pass check of the hard cases in the parsed tribal law provisions.

The first pass (scripts/law/collect_law_texts.py) recorded each provision
from a passage of a nation's law. A second reader checks the records most
likely to be wrong: every record marked `borderline` or with `low` or
`medium` confidence, plus a fixed random sample of the rest so the error rate
of the high-confidence records can be estimated. It never changes a profile.

  prepare  Writes review batches (Markdown) with each record and the passage
           text around its quotation.
  apply    Reads the reviewers' verdict files and writes them beside the
           provisions as `second_pass`, then rewrites the outputs.

Usage:
  python3 scripts/law/second_pass.py prepare --work WORK --private PRIVATE
  python3 scripts/law/second_pass.py apply --work WORK --private PRIVATE --output research/tribal-law
"""

import argparse
import collections
import csv
import glob
import json
import os
import random

SAMPLE_SIZE = 120
SAMPLE_SEED = 20261121
BATCH_RECORDS = 90
CONTEXT = 1400


def load(path):
    with open(path, encoding="utf-8") as input_file:
        return json.load(input_file)


def selected(provisions):
    hard = [record for record in provisions if not record.get("duplicate_of") and (
        record.get("scope") == "borderline" or record.get("confidence") in ("low", "medium")
        or record.get("quote_check") in ("failed", "missing"))]
    hard_ids = {record["id"] for record in hard}
    rest = [record for record in provisions if not record.get("duplicate_of") and record["id"] not in hard_ids]
    sample = random.Random(SAMPLE_SEED).sample(rest, min(SAMPLE_SIZE, len(rest)))
    return [(record, "hard-case") for record in hard] + [(record, "random-sample") for record in sample]


def context_of(record, passages):
    text = passages[record["passages"][0]]["text"]
    quote = record.get("quote") or ""
    position = text.find(quote) if quote else -1
    if position < 0:
        return text[:2 * CONTEXT]
    return text[max(0, position - CONTEXT): position + len(quote) + CONTEXT]


def command_prepare(arguments):
    provisions = load(os.path.join(arguments.private, "provisions-with-quotes.json"))
    passages = {passage["id"]: passage for passage in load(os.path.join(arguments.work, "passages.json"))}
    chosen = selected(provisions)
    folder = os.path.join(arguments.work, "second-pass")
    os.makedirs(os.path.join(folder, "results"), exist_ok=True)
    for old in glob.glob(os.path.join(folder, "review-*.md")):
        os.remove(old)
    for number in range(0, len(chosen), BATCH_RECORDS):
        name = f"review-{number // BATCH_RECORDS + 1:02d}"
        with open(os.path.join(folder, name + ".md"), "w", encoding="utf-8") as output:
            for record, why in chosen[number:number + BATCH_RECORDS]:
                first = passages[record["passages"][0]]
                fields = {key: record.get(key) for key in (
                    "nation", "document", "locator", "citation", "method", "setting", "subject_area",
                    "entry", "outcome", "enforcement", "scope", "confidence", "summary", "note")}
                output.write(
                    f"=== RECORD {record['id']} ({why}) ===\nurl: {record['url']}\n"
                    f"nations citing the document: {', '.join(first['nations'])}\n"
                    f"first pass: {json.dumps(fields, ensure_ascii=False)}\n"
                    f"quote: {record.get('quote')}\n\n--- passage text ---\n{context_of(record, passages).strip()}\n\n")
    counts = collections.Counter(why for _, why in chosen)
    print(f"{len(chosen)} records ({dict(counts)}) in {-(-len(chosen) // BATCH_RECORDS)} batches")


def command_apply(arguments):
    folder = os.path.join(arguments.work, "second-pass", "results")
    verdicts = {}
    for path in sorted(glob.glob(os.path.join(folder, "review-*.json"))):
        for item in load(path):
            verdicts[item["id"]] = item
    private_path = os.path.join(arguments.private, "provisions-with-quotes.json")
    provisions = load(private_path)
    chosen = {record["id"]: why for record, why in selected(provisions)}
    for record in provisions:
        verdict = verdicts.get(record["id"])
        record["second_pass"] = None if not verdict else {
            "reason_selected": chosen.get(record["id"]),
            "verdict": verdict.get("verdict"),
            "changes": verdict.get("changes") or {},
            "reason": verdict.get("reason"),
            "reviewer": "machine pass (Sonnet)",
        }
    with open(private_path, "w", encoding="utf-8") as output:
        json.dump(provisions, output, indent=1, ensure_ascii=False)
        output.write("\n")
    public = [{key: value for key, value in record.items() if key != "quote"} for record in provisions]
    with open(os.path.join(arguments.output, "provisions.json"), "w", encoding="utf-8") as output:
        json.dump(public, output, indent=1, ensure_ascii=False)
        output.write("\n")
    csv_path = os.path.join(arguments.output, "provisions.csv")
    with open(csv_path, encoding="utf-8", newline="") as csv_file:
        fieldnames = next(csv.reader(csv_file))
    extra = ["second_pass_verdict", "second_pass_changes", "second_pass_reason"]
    fieldnames = [name for name in fieldnames if name not in extra and name != "lead_author_decision"] + extra + ["lead_author_decision"]
    with open(csv_path, "w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames, lineterminator="\n", extrasaction="ignore")
        writer.writeheader()
        for record in public:
            row = dict(record)
            row["passages"] = " ".join(record["passages"])
            row["peacemaking_features"] = " ".join(record.get("peacemaking_features") or [])
            second = record.get("second_pass") or {}
            row["second_pass_verdict"] = second.get("verdict")
            row["second_pass_changes"] = json.dumps(second.get("changes"), ensure_ascii=False) if second.get("changes") else None
            row["second_pass_reason"] = second.get("reason")
            writer.writerow(row)
    results = collections.Counter((chosen.get(i), (verdicts[i].get("verdict"))) for i in verdicts)
    missing = sorted(set(chosen) - set(verdicts))
    summary = {"reviewed": len(verdicts), "selected": len(chosen), "missing": len(missing),
               "by_reason_and_verdict": {f"{reason}: {verdict}": count for (reason, verdict), count in sorted(results.items())}}
    counts_path = os.path.join(arguments.output, "counts.json")
    counts = load(counts_path)
    counts["second_pass"] = summary
    with open(counts_path, "w", encoding="utf-8") as output:
        json.dump(counts, output, indent=1, ensure_ascii=False)
        output.write("\n")
    print(json.dumps(summary, indent=1))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["prepare", "apply"])
    parser.add_argument("--work", required=True)
    parser.add_argument("--private", default="/mnt/project-files/research/tribal-law/")
    parser.add_argument("--output", default="research/tribal-law")
    arguments = parser.parse_args()
    {"prepare": command_prepare, "apply": command_apply}[arguments.command](arguments)


if __name__ == "__main__":
    main()
