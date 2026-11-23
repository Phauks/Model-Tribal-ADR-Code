#!/usr/bin/env python3
"""Index the tribal court opinions in the Caselaw Access Project's free files.

Reads the reporters, courts and topics in research/tribal-court-opinions/sources.yaml,
downloads each volume's zip from static.case.law (no account or key; released
without restriction in March 2024), and writes:

- research/tribal-court-opinions/opinions.csv: one row per tribal court opinion
  (federal and state decisions reprinted in these reporters are left out) with
  its citation, court, date, the Native nations the court belongs to, topic
  tags and where the private copy is.
- research/tribal-court-opinions/cites-to-records.csv: each time an opinion
  cites a case that has a source record in content/sources/, for "cited by
  tribal courts" lists.
- research/tribal-court-opinions/counts.json: totals by nation, court and topic.
- With --private FOLDER, snippets.json there: a few lines around each topic
  word, for reading without opening every opinion. Opinion text stays out of
  the repository.

With --file-captures, the script also files two kinds of capture in the R2
bucket and the capture index (research/capture-index.csv):

- each volume zip, as a private archive (redistribution "no");
- each opinion as its own web page, caselaw-access-project/<reporter>/<volume>/<case>.html,
  built from the Caselaw Access Project's HTML with a heading that names the
  case, credits the source and links to the removal request. These have
  redistribution "yes": the website serves them at /copies/<key> and lists
  them on each nation's page (decision record 0047, Trevor, Nov. 23, 2026).
  A nation's removal request is carried out as for any copy: set
  "redistribution": "no" for the key in research/capture-index-overrides.json.

A file already filed with the same SHA-256 is not filed again, and the pages
are built the same way each run, so the script can be re-run whenever the
Caselaw Access Project updates a volume or a reporter is added to the settings.

Run from the repository root:

    python3 scripts/caselaw/tribal_court_opinions.py --cache ~/caselaw-cache \
        [--private /mnt/project-files/research/tribal-court-opinions] \
        [--file-captures --captures /mnt/project-files/research/captures]
"""

from __future__ import annotations

import argparse
import csv
import datetime
import hashlib
import json
import re
import subprocess
import sys
import html
import os
import tempfile
import zipfile
from collections import Counter
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from caselaw_sources import cap_case_link, cap_volume_zip, cap_volumes, record_citations  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / "research" / "tribal-court-opinions"
SETTINGS = FOLDER / "sources.yaml"
SOURCES = ROOT / "content" / "sources"
TRIBES = ROOT / "content" / "tribes"
CAPTURE_INDEX = ROOT / "research" / "capture-index.csv"
CAPTURE_TOPIC = "caselaw-access-project"
OPINION_FIELDS = ["case_id", "citation", "other_citations", "name", "decision_date", "court", "nations",
                  "docket_number", "words", "topics", "reporter", "volume", "copy_key", "volume_key", "link"]
OPINION_RIGHTS = ("Tribal court opinion as the Caselaw Access Project (Harvard Law School Library) published it, released "
                  "without restriction in March 2024, with the publisher's headnotes removed. Served on the website under "
                  "decision record 0047; the nation can ask for removal or redaction.")
VOLUME_RIGHTS = ("Released by the Harvard Library Innovation Lab without restriction (Mar. 2024); publisher headnotes removed. "
                 "Private archive of the volume; each opinion is filed and served as its own page.")
CITE_FIELDS = ["case_id", "citation", "name", "decision_date", "nations", "cites", "record", "times"]
SNIPPET_CHARS = 240


def load_settings() -> dict:
    settings = yaml.safe_load(SETTINGS.read_text(encoding="utf-8"))
    known = {p.stem for p in TRIBES.rglob("*.yaml")}
    for rule in settings["courts"]:
        rule["regex"] = re.compile(rule["court"], re.I)
        missing = [n for n in rule["nations"] if n not in known]
        if missing:
            sys.exit(f"sources.yaml names nations with no profile: {', '.join(missing)}")
    for topic in settings["topics"]:
        topic["regex"] = re.compile(topic["pattern"], re.I)
    return settings


def nations_for(court: str, settings: dict) -> list[str]:
    for rule in settings["courts"]:
        if rule["regex"].match(court):
            return rule["nations"]
    return []


def is_tribal(case: dict, settings: dict) -> bool:
    """Tribal court opinions only: the reporters also reprint federal and state decisions."""
    court = case["court"]["name"]
    if nations_for(court, settings):
        return True
    return not re.search(r"\b(United States|Supreme Court of the United States|Circuit|District of|State of)\b", court)


def record_index() -> dict[str, str]:
    """'volume reporter page' -> source record key, for every case record."""
    index = {}
    for path in SOURCES.rglob("*.yaml"):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if record and str(record.get("kind", "")).endswith("case"):
            for cite in record_citations(record):
                index.setdefault(" ".join(cite), record["key"])
    return index


def filed_captures() -> dict[str, str]:
    """SHA-256 -> capture key, from the capture index."""
    if not CAPTURE_INDEX.exists():
        return {}
    with CAPTURE_INDEX.open(encoding="utf-8", newline="") as handle:
        return {row["sha256"]: row["key"] for row in csv.DictReader(handle)}


def file_capture(zip_path: Path, reporter: dict, volume: dict, captures: Path, filed: dict[str, str]) -> str:
    digest = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    if digest in filed:
        return filed[digest]
    name = f"{reporter['slug']}/{volume['volume_folder']}.zip"
    if f"{CAPTURE_TOPIC}/{name}" in filed.values():  # same volume, changed since: keep both
        name = f"{reporter['slug']}/{volume['volume_folder']}-{datetime.date.today().isoformat()}.zip"
    link = f"https://static.case.law/{reporter['slug']}/{volume['volume_folder']}.zip"
    subprocess.run([sys.executable, str(ROOT / "scripts" / "captures" / "mirror_captures.py"), "add",
                    "--captures", str(captures), "--topic", CAPTURE_TOPIC, "--name", name,
                    "--obtained", "Caselaw Access Project static files (static.case.law)",
                    "--title", f"{reporter['name']}, volume {volume['volume_number']} (Caselaw Access Project)",
                    "--link", link, "--redistribution", "no",
                    "--rights", VOLUME_RIGHTS,
                    str(zip_path)], check=True)
    key = f"{CAPTURE_TOPIC}/{name}"
    filed[digest] = key
    return key


PAGE_STYLE = (
    "body{margin:0;background:#FFFAF5;color:#1d1b19;font:1.0625rem/1.6 Georgia,'Times New Roman',serif}"
    "header,main{max-width:42rem;margin:0 auto;padding:0 1rem}"
    "header{padding-top:1.5rem;padding-bottom:1rem;border-bottom:1px solid #c9bfb5;font:0.9375rem/1.5 system-ui,sans-serif}"
    "header h1{font:600 1.375rem/1.3 system-ui,sans-serif;margin:0 0 .25rem;color:#0F4C54}"
    "header p{margin:.25rem 0}a{color:#1A6D76}"
    "main{padding-bottom:3rem}.head-matter{margin:1.5rem 0;font-style:italic}.opinion{margin-top:1.5rem}"
    "@media (prefers-color-scheme:dark){body{background:#151413;color:#ece7e1}header h1{color:#7cc4cc}"
    "header{border-color:#4a443e}a{color:#7cc4cc}}"
)


def readable(date: str) -> str:
    """2007-03-30 as March 30, 2007 (a partial date is left as it is)."""
    try:
        day = datetime.date.fromisoformat(date)
    except ValueError:
        return html.escape(date)
    return f"{day:%B} {day.day}, {day.year}"


def opinion_page(case: dict, fragment: str, key: str, source_link: str) -> bytes:
    """A standalone page for one opinion. Built the same way each run, so its SHA-256 only changes with the source."""
    citations = ", ".join(c["cite"] for c in case.get("citations", []))
    name = case.get("name_abbreviation") or case.get("name") or "Opinion"
    court = case["court"]["name"]
    date = case.get("decision_date", "")
    body = re.sub(r"\s+data-(blocks|firstpage|lastpage|case-id)='[^']*'", "", fragment)
    body = re.sub(r'\s+data-(blocks|firstpage|lastpage|case-id)="[^"]*"', "", body)
    removal = "/requests?kind=remove&record=copies/" + key
    title = f"{name}, {citations} ({court} {date[:4]})" if citations else f"{name} ({court} {date[:4]})"
    return (
        "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
        f"<title>{html.escape(title)}</title>\n<style>{PAGE_STYLE}</style>\n</head>\n<body>\n<header>\n"
        f"<h1>{html.escape(name)}</h1>\n"
        f"<p>{html.escape(citations)}{' · ' if citations else ''}{html.escape(court)}{', decided ' + readable(date) if date else ''}</p>\n"
        "<p>Text from the Caselaw Access Project, Harvard Law School Library, with the publisher's headnotes removed. "
        f"<a href=\"{html.escape(source_link)}\">Original</a>. "
        f"The nation can have this copy taken down: <a href=\"{html.escape(removal)}\">Ask to remove it</a>.</p>\n"
        "</header>\n<main>\n" + body.strip() + "\n</main>\n</body>\n</html>\n"
    ).encode("utf-8")


class CaptureFiler:
    """Files many small captures in one pass: uploads to the bucket and appends rows to the capture index."""

    def __init__(self) -> None:
        sys.path.insert(0, str(ROOT / "scripts" / "captures"))
        import mirror_captures  # noqa: PLC0415
        self.mirror = mirror_captures
        if not mirror_captures.have_credentials():
            sys.exit("Filing pages needs R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID in the environment.")
        self.s3 = mirror_captures.client()
        self.bucket = os.environ.get("R2_BUCKET", mirror_captures.DEFAULT_BUCKET)
        self.rows = mirror_captures.load_index()
        self.by_key = {row["key"]: row for row in self.rows}
        self.added = 0

    def file(self, key: str, data: bytes, row: dict) -> None:
        digest = hashlib.sha256(data).hexdigest()
        existing = self.by_key.get(key)
        if existing and existing["sha256"] == digest:
            return
        with tempfile.NamedTemporaryFile(suffix=".html") as handle:
            handle.write(data)
            handle.flush()
            self.s3.upload_file(handle.name, self.bucket, key, ExtraArgs={
                "ContentType": "text/html; charset=utf-8",
                "Metadata": {"sha256": digest, "captured": datetime.date.today().isoformat()}})
        if self.mirror.remote_state(self.s3, self.bucket, key) != (len(data), digest):
            sys.exit(f"verification failed for {key}")
        today = datetime.date.today().isoformat()
        new = {field: "" for field in self.mirror.FIELDS}
        new.update(row, key=key, bytes=len(data), sha256=digest, media_type="text/html",
                   captured=today, obtained=f"built from the Caselaw Access Project's files, {today}",
                   keep_local="no", orphan="no")
        if existing:
            existing.update(new)
        else:
            self.rows.append(new)
            self.by_key[key] = new
        self.added += 1

    def close(self) -> None:
        if self.added:
            self.mirror.write_index(self.rows)
        print(f"filed {self.added} opinion pages", file=sys.stderr)


def opinion_text(case: dict) -> str:
    return "\n\n".join(o.get("text", "") for o in (case.get("casebody") or {}).get("opinions", []))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache", required=True, type=Path, help="folder for the downloaded volume zips (outside the repository)")
    parser.add_argument("--private", type=Path, help="folder for snippets.json (outside the repository)")
    parser.add_argument("--file-captures", action="store_true", help="file each zip in the private R2 captures")
    parser.add_argument("--captures", type=Path, help="the research/captures folder, needed with --file-captures")
    arguments = parser.parse_args()
    if arguments.file_captures and not arguments.captures:
        parser.error("--file-captures needs --captures")

    settings = load_settings()
    records = record_index()
    filed = filed_captures()
    pages = None
    opinions, cites, snippets = [], [], []
    unmapped: Counter = Counter()

    for reporter in settings["reporters"]:
        for volume in sorted(cap_volumes(reporter["slug"]), key=lambda v: int(re.sub(r"\D", "", v["volume_number"]) or 0)):
            zip_path = cap_volume_zip(reporter["slug"], volume["volume_folder"], arguments.cache)
            if arguments.file_captures:
                volume_key = file_capture(zip_path, reporter, volume, arguments.captures, filed)
                pages = pages or CaptureFiler()
            else:
                volume_key = filed.get(hashlib.sha256(zip_path.read_bytes()).hexdigest(), "")
            with zipfile.ZipFile(zip_path) as archive:
                for member in sorted(n for n in archive.namelist() if n.startswith("json/") and n.endswith(".json")):
                    case = json.loads(archive.read(member))
                    if not is_tribal(case, settings):
                        continue
                    court = case["court"]["name"]
                    nations = nations_for(court, settings)
                    if not nations:
                        unmapped[court] += 1
                    text = opinion_text(case)
                    citations = [c["cite"] for c in case.get("citations", [])]
                    topics = []
                    for topic in settings["topics"]:
                        hits = list(topic["regex"].finditer(text))
                        if not hits:
                            continue
                        topics.append(topic["tag"])
                        for hit in hits[:3]:
                            start = max(0, hit.start() - SNIPPET_CHARS)
                            snippets.append({"case_id": case["id"], "citation": citations[0] if citations else "",
                                             "topic": topic["tag"],
                                             "text": re.sub(r"\s+", " ", text[start:hit.end() + SNIPPET_CHARS]).strip()})
                    file_name = Path(member).stem
                    link = cap_case_link(reporter["slug"], volume["volume_folder"], file_name)
                    copy_key = f"{CAPTURE_TOPIC}/{reporter['slug']}/{volume['volume_folder']}/{file_name}.html"
                    fragment_name = f"html/{file_name}.html"
                    if pages is not None and nations and fragment_name in archive.namelist():
                        data = opinion_page(case, archive.read(fragment_name).decode("utf-8"), copy_key, link)
                        title = f"{case.get('name_abbreviation') or case.get('name')}, {citations[0] if citations else ''} ({court}, {case.get('decision_date', '')[:4]})"
                        pages.file(copy_key, data, {
                            "topic": CAPTURE_TOPIC, "title": title[:300], "nations": ";".join(nations), "link": link,
                            "catalog": f"research/tribal-court-opinions/opinions.csv#{case['id']}",
                            "rights": OPINION_RIGHTS, "redistribution": "yes"})
                    elif copy_key not in filed.values() and (pages is None or copy_key not in pages.by_key):
                        copy_key = ""
                    row = {
                        "case_id": case["id"], "citation": citations[0] if citations else "",
                        "other_citations": "; ".join(citations[1:]), "name": case.get("name_abbreviation") or case.get("name"),
                        "decision_date": case.get("decision_date", ""), "court": court, "nations": "; ".join(nations),
                        "docket_number": case.get("docket_number", ""), "words": len(text.split()),
                        "topics": "; ".join(topics), "reporter": reporter["slug"], "volume": volume["volume_number"],
                        "copy_key": copy_key, "volume_key": volume_key, "link": link,
                    }
                    opinions.append(row)
                    seen: Counter = Counter()
                    for cited in case.get("cites_to", []):
                        key = records.get(re.sub(r"\s+", " ", cited.get("cite", "")))
                        if key:
                            seen[(cited["cite"], key)] += 1
                    for (cite, key), times in sorted(seen.items()):
                        cites.append({"case_id": case["id"], "citation": row["citation"], "name": row["name"],
                                      "decision_date": row["decision_date"], "nations": row["nations"],
                                      "cites": cite, "record": key, "times": times})

    if pages is not None:
        pages.close()
    opinions.sort(key=lambda r: (r["decision_date"], r["citation"]))
    cites.sort(key=lambda r: (r["record"], r["decision_date"], r["citation"]))
    FOLDER.mkdir(parents=True, exist_ok=True)
    for name, fields, rows in (("opinions.csv", OPINION_FIELDS, opinions), ("cites-to-records.csv", CITE_FIELDS, cites)):
        with (FOLDER / name).open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)

    by_nation: Counter = Counter()
    for row in opinions:
        for nation in row["nations"].split("; ") if row["nations"] else ["(no nation)"]:
            by_nation[nation] += 1
    counts = {
        "generated": datetime.date.today().isoformat(),
        "reporters": [r["slug"] for r in settings["reporters"]],
        "opinions": len(opinions),
        "date_range": [opinions[0]["decision_date"], opinions[-1]["decision_date"]] if opinions else [],
        "nations": dict(by_nation.most_common()),
        "courts": dict(Counter(r["court"] for r in opinions).most_common()),
        "topics": dict(Counter(t for r in opinions for t in r["topics"].split("; ") if t).most_common()),
        "records_cited": dict(Counter(c["record"] for c in cites).most_common()),
        "courts_with_no_nation": dict(unmapped.most_common()),
    }
    (FOLDER / "counts.json").write_text(json.dumps(counts, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if arguments.private:
        arguments.private.mkdir(parents=True, exist_ok=True)
        (arguments.private / "snippets.json").write_text(json.dumps(snippets, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(opinions)} opinions from {len(by_nation)} nations; {len(cites)} citations of {len(counts['records_cited'])} case records",
          file=sys.stderr)
    if unmapped:
        print("courts with no nation (add a rule to sources.yaml): " + ", ".join(unmapped), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
