#!/usr/bin/env python3
"""Find, store and record the official transcripts of the Supreme Court's arguments in our cases.

The Court's own site has a transcript of every argument since the October 1968
term, one PDF each: the Court's library scans for the 1968 to 1999 terms
(supremecourt.gov/oral_arguments/archived_transcripts/<term>) and the court
reporter's transcripts since the 2000 term
(supremecourt.gov/oral_arguments/argument_transcript/<term>). Each term page
lists docket, case name and the day argued. Before 1968 the Court kept no
official transcript; the National Archives' series "Transcripts of Oral
Arguments" (Record Group 267, catalog 562621) also begins with 1968 and is not
digitized.

A case matches a transcript when a docket number of the case is the
transcript's docket and the transcript's day is within four days of an
argument date, or when the transcript was made on an argument day and names
the same first word of each party's name (the list misprints a few docket numbers) (the same cases, docket numbers and dates as the argument
audio: scripts/caselaw/supreme_court_argument_audio.py).

Subcommands, run from the repository root in this order:

  match    Build research/supreme-court-coverage/argument-transcripts.csv, one row per transcript.
  fetch    Download each PDF into --work (kept there under its storage key), hash it,
           count its pages, put it in the R2 bucket under
           supreme-court-transcripts/<term>/ and add it to the capture index and the
           page list (research/copy-pages.csv).
  records  Write each case's argument_transcripts block from the CSV.

    python3 scripts/caselaw/supreme_court_argument_transcripts.py match --cache ~/audio-cache
    python3 scripts/caselaw/supreme_court_argument_transcripts.py fetch --work ~/transcript-work
    python3 scripts/caselaw/supreme_court_argument_transcripts.py records
"""

from __future__ import annotations

import argparse
import collections
import concurrent.futures
import csv
import datetime as dt
import html
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "captures"))

import supreme_court_argument_audio as audio  # noqa: E402

ROOT = audio.ROOT
PLAN = ROOT / "research" / "supreme-court-coverage" / "argument-transcripts.csv"
TOPIC = "supreme-court-transcripts"
FIRST_TERM = 1968
LAST_TERM = 2025
FIELDS = ["case", "docket", "date", "term", "title", "link", "bytes", "pages", "status"]
RIGHTS = ("Transcript of an argument before the Supreme Court of the United States, published by the Court "
          "(supremecourt.gov); the Court's official record of the argument.")


def term_page(term: int) -> str:
    return f"oral_arguments/archived_transcripts/{term}" if term < 2000 else f"oral_arguments/argument_transcript/{term}"


def term_rows(cache: Path, term: int) -> list[dict]:
    """The transcripts listed on one term's page: docket, case name, day argued and the PDF's address."""
    try:
        page = audio.cached(cache, f"court/{term_page(term).replace('/', '-')}.html", f"{audio.COURT}/{term_page(term)}")
    except Exception as error:  # a term the site has no page for
        print(f"  {term}: {error}", file=sys.stderr)
        return []
    text = page.decode("utf-8", "replace")
    rows = []
    for row in re.findall(r"<tr>.*?</tr>", text, flags=re.S):
        link = re.search(r"href='([^']+\.pdf)'[^>]*>([^<]+)</a>", row)
        day = re.findall(r">\s*(\d{1,2}/\d{1,2}/\d{2,4})\s*<", row)
        if not link or not day:
            continue
        name = re.search(r"<(?:div|span) style='display:(?:table-cell|block);'>(.*?)</(?:div|span)>", row, flags=re.S)
        href = link.group(1)
        href = audio.COURT + "/" + re.sub(r"^(\.\./)+", "oral_arguments/", href).lstrip("/") if not href.startswith("/") else audio.COURT + href
        rows.append({"docket": html.unescape(link.group(2)).strip(), "date": audio.us_date(day[-1]), "term": term,
                     "title": html.unescape(re.sub(r"<[^>]+>", "", name.group(1))).strip() if name else "",
                     "link": href})
    return rows


def first_party(title: str) -> tuple[str, ...]:
    """The first word of each side's name ("defunis", "odegaard"), to tell a case by its name."""
    return tuple((re.findall(r"[a-z]+", side.lower()) or [""])[0] for side in re.split(r"\s+v\.?\s+", title, maxsplit=1))


def match(args: argparse.Namespace) -> None:
    cache = Path(args.cache).expanduser()
    cases = audio.our_cases(cache)
    listed = [row for term in range(FIRST_TERM, LAST_TERM + 1) for row in term_rows(cache, term)]
    print(f"{len(listed)} transcripts listed, terms {FIRST_TERM} to {LAST_TERM}")
    out, seen = [], set()
    for case in cases.values():
        for row in listed:
            same_docket = audio.docket_form(row["docket"]) in case["dockets"] and any(audio.near(row["date"], day) for day in case["argued"])
            # The Court's list sometimes misprints a docket number (DeFunis v. Odegaard, 73-235, is listed as 72-235):
            # the same parties on an argument day are the same case.
            same_name = row["date"] in case["argued"] and first_party(row["title"]) == first_party(case["title"] or "")
            if same_docket or same_name:
                if (case["key"], row["link"]) in seen:
                    continue
                seen.add((case["key"], row["link"]))
                out.append({"case": case["key"], **row, "date": row["date"].isoformat(), "bytes": "", "pages": "", "status": "planned"})
    out.sort(key=lambda row: (row["case"], row["date"], row["docket"]))
    matched = {row["case"] for row in out}
    argued = [c for c in cases.values() if any(day.year > FIRST_TERM or (day.year == FIRST_TERM and day.month >= 10) for day in c["argued"])]
    missing = sorted(c["key"] for c in argued if c["key"] not in matched)
    print(f"{len(out)} transcripts for {len(matched)} cases; {len(argued)} cases argued since Oct. {FIRST_TERM}; unmatched: {missing}")
    write_plan(out)


def read_plan() -> list[dict]:
    with PLAN.open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def write_plan(rows: list[dict]) -> None:
    PLAN.parent.mkdir(parents=True, exist_ok=True)
    with PLAN.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def page_count(path: Path) -> int | None:
    try:
        out = subprocess.run(["pdfinfo", str(path)], capture_output=True, text=True, timeout=60).stdout
        found = re.search(r"^Pages:\s+(\d+)", out, flags=re.M)
        return int(found.group(1)) if found else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def storage_key(row: dict) -> str:
    return f"{TOPIC}/{row['term']}/{row['link'].rsplit('/', 1)[1]}"


def fetch(args: argparse.Namespace) -> None:
    import mirror_captures

    work = Path(args.work).expanduser()
    work.mkdir(parents=True, exist_ok=True)
    rows = read_plan()
    index = mirror_captures.load_index()
    filed = {row["key"]: row for row in index}
    s3 = mirror_captures.client()
    bucket = mirror_captures.bucket_name()
    todo = [row for row in rows if not (storage_key(row) in filed and row["pages"])]

    def one(row: dict):
        key = storage_key(row)
        path = work / key
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            size, digest = audio.download(row["link"], path)
        except Exception as error:
            path.unlink(missing_ok=True)
            return row, None, f"failed ({type(error).__name__})"
        if mirror_captures.remote_state(s3, bucket, key) != (size, digest):
            s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": "application/pdf",
                                                              "Metadata": {"sha256": digest, "captured": dt.date.today().isoformat()}})
        ok = mirror_captures.remote_state(s3, bucket, key) == (size, digest)
        pages = page_count(path)
        print(f"{'stored' if ok else 'upload failed'}: {key} ({size:,} bytes)", flush=True)
        return row, (size, digest, pages) if ok else None, "stored" if ok else "upload failed"

    stored = 0
    with concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
        for row, result, status in pool.map(one, todo):
            row["status"] = status
            if not result:
                print(f"{status}: {row['link']}", file=sys.stderr)
                continue
            size, digest, pages = result
            row["bytes"], row["pages"] = str(size), str(pages or "")
            key = storage_key(row)
            if key not in filed:
                index.append(mirror_captures.index_row(
                    key=key, size=size, digest=digest, media="application/pdf", topic=TOPIC,
                    title=f"Supreme Court argument transcript, {row['date']}, No. {row['docket']}: {row['title']}"[:300], nations="",
                    obtained="downloaded from the Supreme Court's argument transcript pages (supremecourt.gov) by script",
                    links=[row["link"]], record=row["case"], redistribution="yes", rights=RIGHTS, existing_keys=set(filed)))
                filed[key] = index[-1]
                stored += 1
    write_plan(rows)
    # The index writer also counts the pages of every served PDF the page list lacks, from the bucket; count only
    # these transcripts, from the copies just downloaded (kept in --work under their storage keys).
    sys.path.insert(0, str(ROOT / "scripts" / "library"))
    import count_pages
    mirror_captures.count_new_pages = lambda rows: None
    mirror_captures.write_index(index)
    count_pages.count_new([filed[storage_key(row)] for row in rows if storage_key(row) in filed], [work])
    print(f"stored {stored}; " + ", ".join(f"{n} {s}" for s, n in collections.Counter(r["status"] for r in rows).items()))


def block_yaml(entries: list[dict]) -> str:
    lines = ["argument_transcripts:"]
    for entry in entries:
        lines.append(f"- date: '{entry['date']}'")
        lines.append(f"  docket: {json.dumps(entry['docket'])}")
        lines.append("  source: Supreme Court of the United States")
        lines.append(f"  link: {entry['link']}")
        if entry.get("pages"):
            lines.append(f"  pages: {entry['pages']}")
        if entry.get("file"):
            f = entry["file"]
            lines.append("  file:")
            lines.append(f"    storage_key: {f['storage_key']}")
            lines.append(f"    checksum: {f['checksum']}")
            lines.append(f"    media_type: {f['media_type']}")
            lines.append(f"    bytes: {f['bytes']}")
    return "\n".join(lines) + "\n"


def records(args: argparse.Namespace) -> None:
    import mirror_captures

    index = {row["key"]: row for row in mirror_captures.load_index()}
    by_case = collections.defaultdict(list)
    for row in read_plan():
        key = storage_key(row)
        stored = index.get(key)
        entry = {"date": row["date"], "docket": row["docket"], "link": row["link"],
                 "pages": int(row["pages"]) if row["pages"] else None}
        if stored:
            entry["file"] = {"storage_key": key, "checksum": stored["sha256"], "media_type": stored["media_type"], "bytes": stored["bytes"]}
        by_case[row["case"]].append(entry)
    written = 0
    for path in sorted(audio.SOURCES.rglob("*.yaml")):
        text = path.read_text(encoding="utf-8")
        key = re.search(r"(?m)^key: (\S+)", text)
        if not key or key.group(1) not in by_case:
            continue
        entries = sorted(by_case[key.group(1)], key=lambda e: (e["date"], e["docket"]))
        text = re.sub(r"(?m)^argument_transcripts:\n(?:[- ] .*\n)*", "", text)
        anchor = "\nrights:\n" if "\nrights:\n" in text else None
        block = block_yaml(entries)
        text = text.replace(anchor, "\n" + block + "rights:\n", 1) if anchor else text.rstrip("\n") + "\n" + block
        path.write_text(text, encoding="utf-8")
        written += 1
    print(f"wrote argument_transcripts for {written} records")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("match")
    p.add_argument("--cache", required=True)
    p = sub.add_parser("fetch")
    p.add_argument("--work", required=True)
    p.add_argument("--workers", type=int, default=6)
    sub.add_parser("records")
    args = parser.parse_args()
    {"match": match, "fetch": fetch, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
