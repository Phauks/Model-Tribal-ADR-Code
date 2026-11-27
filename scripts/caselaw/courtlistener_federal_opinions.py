#!/usr/bin/env python3
"""Find the federal court opinions on Indian law published after the Caselaw Access Project ends (data tier 2).

The Caselaw Access Project's federal reporters stop in 2017 to 2019 (Fed. Cl. in
Dec. 2017, F. App'x in Mar. 2018, F.3d and F. Supp. 3d in Aug. 2019), so
scripts/caselaw/federal_indian_law_cases.py finds nothing later. CourtListener's
quarterly bulk files (Free Law Project; public domain mark; no account or key;
research note research/analyses/2026-11-23-free-legal-information-sources.md)
hold the later opinions of the federal courts of appeals, district courts and
Court of Federal Claims. This script reads them and lays the candidates out in
scripts/caselaw/state_court_opinions.py's --work layout, so they go through the
same reading, privacy holds, records and copies (with --courts federal).

Steps, run in order:

  clusters  From the opinion clusters, dockets, courts and citations files, list
            every cluster filed on or after --since in a federal court of appeals,
            district court or the Court of Federal Claims (--cache/clusters.json).
  opinions  Download the opinions file (about 55 GB compressed; it needs that much
            free disk), decompress it in parallel,
            score the text of each opinion of those clusters with the study's
            Indian law terms, and write --work/candidates-courtlistener.jsonl and
            --work/cases/courtlistener/<court>/<cluster>.json, a case in the
            Caselaw Access Project's JSON shape with the opinion text (no head
            matter: CourtListener's syllabus and headnotes fields are left out).
  merge     Add those candidates to --work/candidates.jsonl, leaving out any whose
            citation a Caselaw Access Project candidate already has.

Run from the repository root:

    python3 scripts/caselaw/courtlistener_federal_opinions.py clusters --cache DIR [--release 2026-09-30] [--since 2017-10-01]
    python3 scripts/caselaw/courtlistener_federal_opinions.py opinions --cache DIR --work DIR [--release 2026-09-30]
    python3 scripts/caselaw/courtlistener_federal_opinions.py merge --work DIR
"""

from __future__ import annotations

import argparse
import csv
import html
import io
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from caselaw_sources import bulk_url, download  # noqa: E402
from state_court_opinions import MARKERS  # noqa: E402

csv.field_size_limit(sys.maxsize)

# Courts kept: the federal courts of appeals and district courts, and the Court of Federal Claims (the Court of Claims' successor).
# The Supreme Court is left out: every Supreme Court Native case has its own record (tier 1).
KEEP_JURISDICTIONS = {"F", "FD"}
KEEP_COURTS = {"uscfc"}
LEAVE_OUT = {"scotus"}
TEXT_FIELDS = ["html_with_citations", "xml_harvard", "html_columbia", "html_lawbox", "html_anon_2020", "html", "plain_text"]
FEDERAL_REPORTERS = re.compile(r"^(?:F\.(?: ?\dd| ?4th)?|F\. Supp\.(?: ?\dd)?|F\. App'x|Fed\. Cl\.|Ct\. Cl\.|Cl\. Ct\.|F\. Cas\.)$")


def bulk_rows(path: Path):
    """Rows of a bulk file, decompressed in parallel."""
    import indexed_bzip2  # noqa: PLC0415  (pip install indexed_bzip2)
    handle = io.TextIOWrapper(indexed_bzip2.open(str(path), parallelization=4), encoding="utf-8", newline="")
    yield from csv.DictReader(handle, escapechar="\\", doublequote=False)


def clusters(args: argparse.Namespace) -> None:
    cache = Path(args.cache)
    paths = {name: download(bulk_url(name, args.release), cache / f"{name}.csv.bz2") for name in ("courts", "opinion-clusters", "dockets", "citations")}
    courts = {row["id"]: row for row in bulk_rows(paths["courts"])
              if (row["jurisdiction"] in KEEP_JURISDICTIONS or row["id"] in KEEP_COURTS) and row["id"] not in LEAVE_OUT}
    print(len(courts), "federal courts", flush=True)
    found: dict[str, dict] = {}
    for row in bulk_rows(paths["opinion-clusters"]):
        if row["date_filed"] >= args.since and row["blocked"] != "t":
            found[row["id"]] = {"docket": row["docket_id"], "date": row["date_filed"], "name": row["case_name"] or row["case_name_short"],
                                "name_full": row["case_name_full"], "slug": row["slug"], "status": row["precedential_status"],
                                "source": row["source"], "citations": []}
    dockets = {cluster["docket"] for cluster in found.values()}
    print(len(found), "clusters since", args.since, flush=True)
    court_of = {}
    for row in bulk_rows(paths["dockets"]):
        if row["id"] in dockets and row["court_id"] in courts and row["blocked"] != "t":
            court_of[row["id"]] = (row["court_id"], row["docket_number"], row["case_name"] or row["case_name_short"] or row["case_name_full"])
    kept = {}
    for cluster_id, cluster in found.items():
        if cluster["docket"] in court_of:
            court_id, number, docket_name = court_of[cluster["docket"]]
            # Some clusters (most often new district court orders) carry no case name; the docket has it.
            cluster["name"] = cluster["name"] or docket_name
            cluster["name_full"] = cluster["name_full"] or docket_name
            cluster.update(court=court_id, court_name=court_title(courts[court_id]["full_name"]), court_short=courts[court_id]["short_name"], docket_number=number)
            kept[cluster_id] = cluster
    for row in bulk_rows(paths["citations"]):
        if row["cluster_id"] in kept:
            kept[row["cluster_id"]]["citations"].append(f"{row['volume']} {row['reporter']} {row['page']}")
    (cache / "clusters.json").write_text(json.dumps(kept))
    print(len(kept), "clusters in federal courts", flush=True)


TERRITORIAL = {"District Court, Virgin Islands": "District Court of the Virgin Islands", "District Court, D. Guam": "District Court of Guam",
               "District Court, Northern Mariana Islands": "District Court for the Northern Mariana Islands",
               "District Court, District of Columbia": "United States District Court for the District of Columbia"}
DISTRICTS = {"N": "Northern", "S": "Southern", "E": "Eastern", "W": "Western", "C": "Central", "M": "Middle"}


def court_title(name: str) -> str:
    """CourtListener's court name in the Caselaw Access Project's style, so one court is listed one way
    ("District Court, E.D. New York" is "United States District Court for the Eastern District of New York")."""
    if name in TERRITORIAL:
        return TERRITORIAL[name]
    match = re.fullmatch(r"District Court, (?:([NSEWCM])\.D\.|D\.) (.+)", name)
    if match:
        part = f"{DISTRICTS[match.group(1)]} District" if match.group(1) else "District"
        return f"United States District Court for the {part} of {match.group(2)}"
    if name.startswith("Court of Appeals for the "):
        return "United States " + name.replace("the D.C. Circuit", "the District of Columbia Circuit")
    return name


TAG = re.compile(r"<[^>]+>")


def opinion_text(row: dict) -> str:
    for field in TEXT_FIELDS:
        value = row.get(field) or ""
        if value.strip():
            if field == "plain_text":
                return value
            text = re.sub(r"(?i)</p>|<br\s*/?>|</div>|</blockquote>|</h\d>", "\n", value)
            return html.unescape(TAG.sub("", text))
    return ""


def opinions(args: argparse.Namespace) -> None:
    import indexed_bzip2  # noqa: PLC0415
    cache, work = Path(args.cache), Path(args.work)
    work.mkdir(parents=True, exist_ok=True)  # made first: the pass takes over an hour
    wanted = json.loads((cache / "clusters.json").read_text())
    print(len(wanted), "clusters to look for", flush=True)
    # The file is downloaded whole first (about 55 GB): parallel decompression needs a local file, and
    # reading it over HTTP range requests ran at about a fiftieth of the speed.
    path = download(bulk_url("opinions", args.release), cache / "opinions.csv.bz2")
    source = indexed_bzip2.open(str(path), parallelization=args.jobs)
    # Parsing every row of the file (about 300 GB of text) with the csv module takes most of a day, so
    # rows are split by where a new one starts (a line opening with its quoted id and creation time:
    # quotes inside a field are escaped, so no field's line can look like that), the cluster is read
    # from the row's last field, and only rows of the clusters wanted are parsed.
    row_start = re.compile(rb'\n(?="\d+","\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)')
    last_field = re.compile(rb',"?(\d+)"?\s*$')
    header = next(csv.reader([source.readline().decode("utf-8")]))
    # Opinions that use an Indian law term are kept in memory; for the others of the wanted clusters only
    # where the row sits in the decompressed file is noted, so a dissent or concurrence that uses no term
    # can be read back by seeking once the pass is done (the file is indexed as it is read).
    texts: dict[str, list[dict]] = {}
    elsewhere: dict[str, list[tuple[int, int]]] = {}
    seen, started, rest = 0, time.time(), b""

    def parse(raw: bytes) -> tuple[str, dict]:
        values = next(csv.reader([raw.decode("utf-8", "replace")], escapechar="\\", doublequote=False))
        row = dict(zip(header, values))
        return row["cluster_id"], {"type": row["type"], "author": row["author_str"], "text": opinion_text(row)}

    def take(raw: bytes, offset: int) -> None:
        match = last_field.search(raw[-40:])
        if not match or match.group(1).decode() not in wanted:
            return
        cluster_id, part = parse(raw)
        if cluster_id in texts or any(pattern.search(part["text"]) for pattern in MARKERS.values()):
            texts.setdefault(cluster_id, []).append(part)
        else:
            elsewhere.setdefault(cluster_id, []).append((offset, len(raw)))

    base = source.tell()  # decompressed offset of data[0]
    while True:
        block = source.read(64 << 20)
        data = rest + block
        cuts = [match.start() for match in row_start.finditer(data)]
        if not block:
            cuts.append(len(data))
        begin = 0
        for cut in cuts:
            if cut > begin:
                take(data[begin:cut], base + begin)
                seen += 1
            begin = cut + 1
        rest = data[begin:]
        base += begin
        if not block:
            break
        if seen // 500_000 != (seen - len(cuts)) // 500_000:
            print(f"{seen} opinions read, {len(texts)} clusters with a term, {(time.time() - started) / 60:.0f} min", flush=True)
    joined = 0
    for cluster_id, parts in texts.items():
        for offset, length in elsewhere.get(cluster_id, []):
            source.seek(offset)
            parts.append(parse(source.read(length))[1])
            joined += 1
    source.close()
    print(joined, "opinions without a term joined to their cases", flush=True)
    print(seen, "opinions read;", len(texts), "clusters with an Indian law term", flush=True)
    out = work / "candidates-courtlistener.jsonl"
    count = 0
    with open(out, "w", encoding="utf-8") as handle:
        for cluster_id, parts in texts.items():
            cluster = wanted[cluster_id]
            # Combined opinions repeat the lead; keep the lead and any separate concurrence or dissent.
            parts.sort(key=lambda part: part["type"])
            body = "\n".join(part["text"] for part in parts)
            hits = {key: len(pattern.findall(body)) for key, pattern in MARKERS.items()}
            score = sum(hits.values())
            if not score:
                continue
            case = {
                "id": f"cl-{cluster_id}", "name": cluster["name_full"] or cluster["name"], "name_abbreviation": cluster["name"],
                "decision_date": cluster["date"], "docket_number": cluster["docket_number"],
                "court": {"name": cluster["court_name"], "name_abbreviation": cluster["court_short"]},
                "jurisdiction": {"name": "United States", "name_long": "United States"},
                "citations": [{"cite": cite} for cite in cluster["citations"]],
                "courtlistener": {"cluster": int(cluster_id), "slug": cluster["slug"], "status": cluster["status"]},
                "casebody": {"head_matter": "", "opinions": [{"type": part["type"], "author": part["author"], "text": part["text"]} for part in parts]},
            }
            path = work / "cases" / "courtlistener" / cluster["court"] / f"{cluster_id}.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(case), encoding="utf-8")
            handle.write(json.dumps({
                "reporter": "courtlistener", "volume": cluster["court"], "file": f"{cluster_id}.json", "id": f"cl-{cluster_id}",
                "name": cluster["name"], "date": cluster["date"], "court": cluster["court_name"], "jurisdiction": "United States",
                "citations": cluster["citations"], "score": score, "hits": hits, "status": cluster["status"],
                "link": f"https://www.courtlistener.com/opinion/{cluster_id}/{cluster['slug']}/",
            }) + "\n")
            count += 1
    print(count, "candidates written to", out, flush=True)


WORD = re.compile(r"[a-z0-9]+")
NOT_NAMES = {"the", "of", "in", "re", "v", "vs", "and", "inc", "co", "corp", "llc", "et", "al", "us", "united", "states", "america"}


def name_words(name: str) -> frozenset[str]:
    return frozenset(word for word in WORD.findall((name or "").lower()) if word not in NOT_NAMES and len(word) > 2)


def same_case(row: dict, other: dict) -> bool:
    """Whether two candidates without a shared citation look like one opinion: filed within a week, and most of the shorter caption's words in the other."""
    from datetime import date  # noqa: PLC0415
    try:
        apart = abs((date.fromisoformat(row["date"][:10]) - date.fromisoformat(other["date"][:10])).days)
    except ValueError:
        return False
    first, second = name_words(row["name"]), name_words(other["name"])
    shorter = min(len(first), len(second))
    if apart > 7 or not shorter or len(first & second) < max(1, (shorter * 2 + 2) // 3):
        return False
    # Each side of the "v." shares a word with the same side of the other caption (Havasu Water Co. v. Chemehuevi Indian Tribe is not Chemehuevi Indian Tribe v. McMahon).
    sides, others = re.split(r"\bv\.?\s", row["name"] or "", maxsplit=1), re.split(r"\bv\.?\s", other["name"] or "", maxsplit=1)
    if len(sides) == 2 and len(others) == 2:
        return all(name_words(one) & name_words(two) or not name_words(one) or not name_words(two) for one, two in zip(sides, others))
    return True


def merge(args: argparse.Namespace) -> None:
    work = Path(args.work)
    rows = [json.loads(line) for line in open(work / "candidates.jsonl", encoding="utf-8")]
    rows = [row for row in rows if row["reporter"] != "courtlistener"]
    cites = {" ".join(cite.split()) for row in rows for cite in row["citations"] if cite}
    # The Project's last federal volumes overlap CourtListener's first years (Oct. 2017 to 2019); district
    # opinions from GovInfo carry no citation there, so those are matched by date and caption.
    recent: dict[str, list[dict]] = {}
    for row in rows:
        if (row["date"] or "") >= "2017-09":
            recent.setdefault(row["date"][:7], []).append(row)
    added = by_cite = by_name = 0
    for line in open(work / "candidates-courtlistener.jsonl", encoding="utf-8"):
        row = json.loads(line)
        if any(" ".join(cite.split()) in cites for cite in row["citations"]):
            by_cite += 1
            continue
        month = row["date"][:7]
        if any(same_case(row, other) for near in nearby_months(month) for other in recent.get(near, [])):
            by_name += 1
            continue
        rows.append(row)
        added += 1
    with open(work / "candidates.jsonl", "w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row) + "\n")
    print(added, "CourtListener candidates added;", by_cite, "already there by citation,", by_name, "by date and caption")


def nearby_months(month: str) -> list[str]:
    """The month and those on either side, so a filing date a few days off still meets its match."""
    year, number = int(month[:4]), int(month[5:7])
    index = year * 12 + number - 1
    return [f"{(index + step) // 12}-{(index + step) % 12 + 1:02d}" for step in (-1, 0, 1)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("clusters")
    p.add_argument("--cache", required=True)
    p.add_argument("--release", default="2026-09-30")
    p.add_argument("--since", default="2017-10-01")
    p = sub.add_parser("opinions")
    p.add_argument("--cache", required=True)
    p.add_argument("--work", required=True)
    p.add_argument("--release", default="2026-09-30")
    p.add_argument("--jobs", type=int, default=4)
    p = sub.add_parser("merge")
    p.add_argument("--work", required=True)
    args = parser.parse_args()
    {"clusters": clusters, "opinions": opinions, "merge": merge}[args.command](args)


if __name__ == "__main__":
    main()
