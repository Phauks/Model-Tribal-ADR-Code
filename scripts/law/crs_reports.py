#!/usr/bin/env python3
"""Source records and stored copies for the Congressional Research Service's
reports on Indian affairs (data tier 2; Trevor, Nov. 27, 2026: "work on those
tier 2 gaps").

Congress.gov's API (https://api.congress.gov/v3/crsreport, which needs the
free api.data.gov key in DATA_GOV_API_KEY) lists every product the Service
has made public: its reports (R, RL, RS), In Focus briefs (IF), Insights (IN)
and Legal Sidebars (LSB), each with its authors, date, current version, a
summary and its PDF. A product is kept when its title names Indians, tribes,
Native Americans, Alaska Natives or Native Hawaiians, or a nation the project
has a page for (the same tests as scripts/law/congressional_documents.py,
except that "Indian" alone, which in a CRS title is nearly always India's,
does not count). The review file lists every product kept.

The Service's products are works of the United States government (17 U.S.C.
§ 105), so the project keeps the current version's PDF in the bucket under
crs/<id>.<version>.pdf and serves it. An earlier version is not kept.

Steps:
  list     List every product. Writes --work/list.json.
  details  Read each candidate's details. Cached in --work/details/.
  file     Download each kept product's PDF, store it in the bucket and add it
           to the capture index.
  records  Write content/sources/c/crs-<id>.yaml for each kept product.

Usage:
  python3 scripts/law/crs_reports.py list --work DIR
  python3 scripts/law/crs_reports.py details --work DIR
  python3 scripts/law/crs_reports.py file --work DIR
  python3 scripts/law/crs_reports.py records --work DIR
"""
from __future__ import annotations

import argparse
import concurrent.futures
import csv
import datetime as dt
import json
import re
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from congressional_documents import NATIVE_TITLE, NOT_NATIVE, RIGHTS, congress_api, get, nations_in  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "content/sources"
REVIEW = ROOT / "research/reviews/2026-11-27-crs-reports.csv"
SESSION = "2026-11-27-congressional-documents"
SCRIPT = "scripts/law/crs_reports.py"
TODAY = "2026-11-27"
MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
# What each kind of product is called, by the letters its number starts with.
GENRES = [("LSB", "CRS Legal Sidebar"), ("IF", "CRS In Focus"), ("IN", "CRS Insight"), ("IG", "CRS infographic"), ("TE", "CRS testimony"), ("RL", "CRS report"), ("RS", "CRS report"), ("R", "CRS report")]


def genre_of(identifier: str) -> str:
    return next((name for prefix, name in GENRES if identifier.upper().startswith(prefix)), "CRS product")


def listing(args) -> None:
    work = Path(args.work)
    work.mkdir(parents=True, exist_ok=True)
    found, offset = [], 0
    while True:
        page = congress_api(f"/crsreport?limit=250&offset={offset}")
        items = page.get("CRSReports", [])
        found += items
        if len(items) < 250:
            break
        offset += 250
    (work / "list.json").write_text(json.dumps(found, indent=0, ensure_ascii=False), encoding="utf-8")
    print(f"{len(found)} products")


def names_finder():
    sys.path.insert(0, str(ROOT / "scripts/law"))
    from nation_names import NationNames  # noqa: E402

    return NationNames()


def title_test(title: str, names) -> str | None:
    cleaned = NOT_NATIVE.sub(" ", title)
    cleaned = re.sub(r"\b(Federally Administered )?Tribal Areas\b|tribal (?:militias?|regions? of|leaders in (?:Iraq|Afghanistan|Pakistan|Yemen|Libya))", " ", cleaned, flags=re.I)
    # "Indian" alone in a CRS title is nearly always India's ("Indian Elections"); the Native senses are named.
    native_indian = re.search(r"\b(American Indians?|Indians\b|Indian (?:tribes?|tribal|Country|Affairs|Health|Child|Gaming|lands?|reservations?|Self-Determination|Education|trust|water|Claims|Reorganization|Civil Rights|Housing|Arts|Law|Financing|Employment|Programs?))", cleaned, re.I)
    if native_indian or NATIVE_TITLE.search(re.sub(r"\bIndians?\b", " ", cleaned)):
        return "title"
    if nations_in(names, cleaned):
        return "nation named"
    return None


def candidates(work: Path, names) -> list[dict]:
    items = json.loads((work / "list.json").read_text(encoding="utf-8"))
    out = []
    for item in items:
        reason = title_test(item.get("title") or "", names)
        if reason:
            out.append({**item, "kept_because": reason})
    return out


def detail_of(work: Path, identifier: str) -> dict:
    path = work / "details" / f"{identifier}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    detail = congress_api(f"/crsreport/{identifier}").get("CRSReport", {})
    path.write_text(json.dumps(detail, ensure_ascii=False), encoding="utf-8")
    return detail


def details(args) -> None:
    work = Path(args.work)
    (work / "details").mkdir(parents=True, exist_ok=True)
    names = names_finder()
    chosen = candidates(work, names)
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        list(pool.map(lambda item: detail_of(work, item["id"]), chosen))
    REVIEW.parent.mkdir(parents=True, exist_ok=True)
    with REVIEW.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["id", "decision", "reason", "date", "title"])
        writer.writeheader()
        kept_ids = {item["id"] for item in chosen}
        for item in json.loads((work / "list.json").read_text(encoding="utf-8")):
            if item["id"] in kept_ids:
                writer.writerow({"id": item["id"], "decision": "kept", "reason": next(c["kept_because"] for c in chosen if c["id"] == item["id"]), "date": (item.get("publishDate") or "")[:10], "title": item.get("title", "")})
    (work / "kept.json").write_text(json.dumps(chosen, indent=0, ensure_ascii=False), encoding="utf-8")
    print(f"{len(chosen)} kept")


def pdf_of(detail: dict) -> str | None:
    return next((entry["url"] for entry in detail.get("formats", []) if entry.get("format") == "PDF"), None)


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    (work / "pdf").mkdir(parents=True, exist_ok=True)
    kept = json.loads((work / "kept.json").read_text(encoding="utf-8"))
    rows = mirror_captures.load_index()
    filed = {row["key"] for row in rows}
    s3 = mirror_captures.client()
    bucket = mirror_captures.bucket_name()

    def put(item: dict):
        detail = detail_of(work, item["id"])
        link = pdf_of(detail)
        if not link:
            return ("failed", f"{item['id']}: no PDF")
        key = f"crs/{link.rsplit('/', 1)[-1]}"
        if key in filed:
            return None
        path = work / "pdf" / link.rsplit("/", 1)[-1]
        try:
            if not path.exists():
                data = get(link)
                if not data.startswith(b"%PDF"):
                    return ("failed", f"{item['id']}: not a PDF")
                path.write_bytes(data)
            digest = mirror_captures.sha256_of(path)
            size = path.stat().st_size
            if mirror_captures.remote_state(s3, bucket, key) != (size, digest):
                s3.upload_file(str(path), bucket, key, ExtraArgs={"ContentType": "application/pdf", "Metadata": {"sha256": digest, "captured": dt.date.today().isoformat()}})
                if mirror_captures.remote_state(s3, bucket, key) != (size, digest):
                    return ("failed", f"{item['id']}: verification failed")
        except Exception as problem:  # noqa: BLE001 - reported
            return ("failed", f"{item['id']}: {problem}")
        path.unlink(missing_ok=True)
        return ("ok", mirror_captures.index_row(
            key=key, size=size, digest=digest, media="application/pdf", topic="crs", title=detail.get("title", item.get("title", "")), nations="",
            obtained="downloaded from Congress.gov by script", links=[link, f"https://www.congress.gov/crs-product/{item['id']}"],
            record=f"crs-{item['id'].lower()}", redistribution="yes", rights="United States government work (17 U.S.C. § 105).", existing_keys=filed))

    added, problems = 0, []
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        for result in pool.map(put, kept):
            if result and result[0] == "failed":
                problems.append(result[1])
            elif result:
                rows.append(result[1])
                added += 1
    mirror_captures.write_index(rows)
    for problem in problems:
        print("FAILED", problem, file=sys.stderr)
    print(f"filed {added}; {len(problems)} failed")


def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def records(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    names = names_finder()
    kept = json.loads((work / "kept.json").read_text(encoding="utf-8"))
    stored = {row["key"]: row for row in mirror_captures.load_index() if row["key"].startswith("crs/")}
    statutes = statute_keys()
    written = 0
    for item in kept:
        detail = detail_of(work, item["id"])
        identifier = item["id"]
        title = re.sub(r"\s+", " ", detail.get("title") or item.get("title") or "").strip()
        date = (detail.get("publishDate") or item.get("publishDate") or "")[:10]
        year, month, day = (int(part) for part in date.split("-"))
        authors = [entry["author"] for entry in detail.get("authors", []) if entry.get("author")]
        genre = genre_of(identifier)
        by = (", ".join(authors[:-1]) + " & " + authors[-1]) if len(authors) > 1 else (authors[0] if authors else "")
        citation_text = f"{by + ', ' if by else ''}Cong. Rsch. Serv., {identifier}, {title} ({MONTHS[month - 1]} {day}, {year})"
        link = pdf_of(detail)
        page = f"https://www.congress.gov/crs-product/{identifier}"
        citation = {"type": "report", "title": title, "genre": genre, "author": [{"literal": author} for author in authors] or [{"literal": "Congressional Research Service"}],
                    "publisher": "Congressional Research Service", "number": identifier, "URL": page,
                    "issued": {"date-parts": [[year, month, day]]}, "accessed": {"date-parts": [[2026, 11, 27]]}}
        if detail.get("currentVersion"):
            citation["version"] = str(detail["currentVersion"])
        record = {"key": f"crs-{identifier.lower()}", "kind": "congressional-document", "citation": citation, "original_link": page, "retrieved": TODAY}
        copy = stored.get(f"crs/{link.rsplit('/', 1)[-1]}") if link else None
        if copy:
            record["file"] = {"storage_key": copy["key"], "checksum": copy["sha256"], "media_type": copy["media_type"], "bytes": int(copy["bytes"])}
        legislative = {"chamber": "congress"}
        laws = sorted({statutes[material["number"]] for material in detail.get("relatedMaterials", []) or [] if material.get("type") == "PUB" and material.get("number") in statutes})
        if laws:
            legislative["laws"] = laws
        legislative["crs_status"] = (detail.get("status") or "").lower() or "active"
        record["legislative"] = legislative
        record["rights"] = RIGHTS
        record["jurisdictions"] = [{"level": "federal"}]
        nations = nations_in(names, NOT_NATIVE.sub(" ", title))
        if nations:
            record["tribes"] = nations
        why = {"title": "its title names Native people", "nation named": "its title names a Native nation"}[item["kept_because"]]
        record.update({"access": {"open": True, "pull_from": ["free-web"]}, "found_in": [SESSION],
                       "notes": (f"Indigo Book citation: {citation_text}. {genre}, version {detail.get('currentVersion', 1)}, "
                                 f"{(detail.get('status') or 'Active').lower()} on Congress.gov; kept because {why}. Title, authors, date and laws from Congress.gov's API; "
                                 f"nations matched by name in the title. Generated by {SCRIPT}; not yet read by a person (Unverified)."),
                       "review": {"status": "unverified", "by": SCRIPT, "date": TODAY,
                                  "checks": [{"check": "citation", "result": "missing", "detail": f"Congress.gov API only: {identifier}, version {detail.get('currentVersion', 1)}"}]}})
        path = SOURCES / "c" / f"crs-{identifier.lower()}.yaml"
        path.write_text(dump(record), encoding="utf-8")
        written += 1
    print(f"wrote {written} records")


def statute_keys() -> dict[str, str]:
    from congressional_documents import statute_records  # noqa: E402

    return statute_records()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("list", "details", "file", "records"):
        sub.add_parser(name).add_argument("--work", required=True)
    args = parser.parse_args()
    {"list": listing, "details": details, "file": file, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
