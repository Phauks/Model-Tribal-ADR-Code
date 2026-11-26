#!/usr/bin/env python3
"""Find, select and file the published state and federal court opinions on Indian law.

Tier 3 of the project's data coverage (docs/data-roadmap.md; research note
research/analyses/2026-11-26-tier-2-and-3-data-sources.md, section 3.1). The
Caselaw Access Project (https://static.case.law/, released without restriction
in 2024) holds every published state opinion to about 2019, as one zip of JSON
cases per reporter volume.

Subcommands, in the order they are run:

  scan     Read every volume of every state and regional reporter, score each case
           by its Indian law terms (the same terms as the tier 2 and 3 study,
           scripts/analysis/indian_law_case_sample.py), and keep, in --work:
           candidates.jsonl (one row per case with any term) and cases/<reporter>/
           <volume>/<id>.json (the full case, for cases scoring 3 or more).
           Resumable: volumes already read are listed in done.txt.

  excerpts Write reading/in-N.json in --work: short passages around the Indian law
           terms of each case scoring from 3 to below --auto, for AI readers who
           judge from them alone whether it is an Indian law case
           (reading/INSTRUCTIONS.md). Their answers go in reading/out-N.json.

  write    Read --work/selected.json (a list of {"id", "how", "topic"}, where how is
           "score" for cases at or above --auto, "reader" for those a reader
           judged Indian law, or "caption" for those naming a Native nation or
           organization as a party) and write one source record per case
           (content/sources/, kind state-case or territorial-case, topic
           state-court-indian-law, review unverified). Cases already held are
           skipped by citation. Cases about children or protected persons, and
           estates decided in or after --estates-from, are held for a privacy
           review and listed only in --private/held-for-privacy-review.csv, which
           never goes in git (decision record 0060). With --file, each opinion is
           built as an HTML page of the court's opinions only, without the
           publisher's head matter, uploaded to R2 under caselaw-access-project/
           and added to research/capture-index.csv. Counts go to
           research/state-court-opinions/summary.json and records.csv.

With --courts federal, excerpts and write work on the lower federal courts' opinions
instead (data tier 2): scripts/caselaw/federal_indian_law_cases.py scans the eleven
federal reporters and its prepare step lays the results out in this script's --work
layout. Federal records are kind federal-case, topic federal-court-indian-law, their
counts go to research/federal-court-opinions/, and their copies are filed under
federal-court-opinions/ in R2.

Run from the repository root:

    python3 scripts/caselaw/state_court_opinions.py scan --work DIR [--jobs 8]
    python3 scripts/caselaw/state_court_opinions.py excerpts --work DIR --auto 10 --batches 8
    python3 scripts/caselaw/state_court_opinions.py write --work DIR --auto 10 --private DIR --estates-from 1976 --file
    python3 scripts/caselaw/state_court_opinions.py --courts federal excerpts --work DIR --auto 10 --read-from 1 --batches 30
    python3 scripts/caselaw/state_court_opinions.py --courts federal write --work DIR --auto 10 --private DIR --estates-from 1976 --file
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import io
import json
import re
import sys
import time
import urllib.request
import zipfile

import yaml
from pathlib import Path

STATIC = "https://static.case.law"
AGENT = "Mozilla/5.0 (compatible; tribal-law-research-script)"

# The study's terms (scripts/analysis/indian_law_case_sample.py), so counts compare.
MARKERS = {
    "indian_term": re.compile(r"\bIndian (?:country|tribes?|nations?|reservations?|lands?|affairs|child welfare|gaming|commerce|claims commission|civil rights act|reorganization|allotments?|allottees?|trust|self-determination|agent|agency|title|treaty|treaties|band|health service|police|tribal)\b", re.I),
    "tribal": re.compile(r"\btribal (?:courts?|sovereign\w*|governments?|members?|membership|lands?|councils?|nations?|jurisdiction|law|ordinance|code|police|officials?|immunity|enterprises?|casino)", re.I),
    "usc25": re.compile(r"\b25 U\.\s?S\.\s?C"),
    "bia": re.compile(r"Bureau of Indian Affairs|Commissioner of Indian Affairs|Office of Indian Affairs", re.I),
    "native": re.compile(r"\bNative Americans?\b|\bAlaska Natives?\b|\bAmerican Indians?\b|\bNative Hawaiians?\b", re.I),
    "acts": re.compile(r"\bICWA\b|\bIGRA\b|\bISDEAA\b|\bANCSA\b|\bNAGPRA\b|Public Law 280|P\.\s?L\.\s?280|Indian Civil Rights Act|General Allotment Act|Dawes Act", re.I),
}
KEEP_FULL = 3

# Reporters that are federal, territorial or Tribal; everything else in the Project is a state or regional reporter.
NOT_STATE = {
    "alaska-fed", "am-samoa", "am-samoa-2d", "am-samoa-3d", "am-tribal-law", "br", "bta", "ccpa", "cl-ct", "cma", "ct-cust",
    "ct-intl-trade", "cust-ct", "d-haw", "ed-pa", "f", "f-appx", "f-cas", "f-supp", "f-supp-2d", "f-supp-3d", "f2d", "f3d",
    "fed-cl", "frd", "guam", "l-ed-2d", "mj", "n-mar-i", "n-mar-i-commw", "navajo-rptr", "pr", "pr-dec", "pr-fed", "pr-sent",
    "s-ct", "tc", "tca", "us", "us-ct-cl", "vet-app", "vi",
}


def get(url: str, attempts: int = 5) -> bytes:
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": AGENT})
            with urllib.request.urlopen(request, timeout=180) as response:
                return response.read()
        except Exception:
            if attempt == attempts - 1:
                raise
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(url)


def case_text(case: dict) -> str:
    body = case.get("casebody") or {}
    return (body.get("head_matter") or "") + "\n" + "\n".join((opinion.get("text") or "") for opinion in body.get("opinions", []))


def read_volume(work: str, reporter: str, folder: str) -> tuple[str, int, list[dict]]:
    archive = zipfile.ZipFile(io.BytesIO(get(f"{STATIC}/{reporter}/{folder}.zip")))
    rows, total = [], 0
    for name in archive.namelist():
        if not (name.startswith("json/") and name.endswith(".json")):
            continue
        total += 1
        raw = archive.read(name)
        case = json.loads(raw)
        hits = {key: len(pattern.findall(case_text(case))) for key, pattern in MARKERS.items()}
        score = sum(hits.values())
        if not score:
            continue
        rows.append({
            "reporter": reporter, "volume": folder, "file": name.split("/")[-1], "id": case.get("id"),
            "name": case.get("name_abbreviation"), "date": case.get("decision_date") or "",
            "court": (case.get("court") or {}).get("name"), "jurisdiction": (case.get("jurisdiction") or {}).get("name"),
            "citations": [c.get("cite") for c in case.get("citations") or []], "score": score, "hits": hits,
        })
        if score >= KEEP_FULL:
            path = Path(work) / "cases" / reporter / folder / name.split("/")[-1]
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
    return f"{reporter}/{folder}", total, rows


def scan(args: argparse.Namespace) -> None:
    work = Path(args.work)
    work.mkdir(parents=True, exist_ok=True)
    meta = work / "VolumesMetadata.json"
    if not meta.exists():
        meta.write_bytes(get(f"{STATIC}/VolumesMetadata.json"))
    volumes = [v for v in json.loads(meta.read_text()) if v["reporter_slug"] not in NOT_STATE]
    done_file = work / "done.txt"
    done = set(done_file.read_text().split()) if done_file.exists() else set()
    todo = [v for v in volumes if f"{v['reporter_slug']}/{v['volume_folder']}" not in done]
    print(f"{len(volumes)} state and regional volumes; {len(todo)} to read", flush=True)
    started, count = time.time(), 0
    with cf.ProcessPoolExecutor(args.jobs) as pool, open(work / "candidates.jsonl", "a") as out, open(done_file, "a") as log, open(work / "totals.jsonl", "a") as totals:
        futures = {pool.submit(read_volume, str(work), v["reporter_slug"], v["volume_folder"]): v for v in todo}
        for future in cf.as_completed(futures):
            volume = futures[future]
            try:
                key, total, rows = future.result()
            except Exception as error:  # noqa: BLE001
                print(f"failed {volume['reporter_slug']}/{volume['volume_folder']}: {error}", flush=True)
                continue
            for row in rows:
                out.write(json.dumps(row) + "\n")
            totals.write(json.dumps({"volume": key, "cases": total}) + "\n")
            log.write(key + "\n")
            count += 1
            if count % 500 == 0:
                out.flush(); log.flush()
                rate = count / (time.time() - started)
                print(f"{count}/{len(todo)} volumes, {rate:.1f}/s, about {(len(todo) - count) / rate / 60:.0f} min left", flush=True)
    print("done", flush=True)


# Kinds of case the Tribal court opinions' privacy rules cover (decision record 0057;
# research/analyses/2026-11-24-tribal-child-cases-privacy.md): children, protection orders and,
# at the coordinator's request on Nov. 26, 2026, estates. Matched in the caption, then the text.
SENSITIVE_CAPTION = re.compile(
    r"\b(?:adoption|custody|guardianship|welfare of|interest of|dependency|dependent|neglected|delinquen|juvenile|minor|"
    r"child(?:ren)?|infant|parental rights|paternity|protective order|protection order|estate of|estate|heirs|will of|probate|"
    r"commitment of|mental health|incompeten)\b", re.I)
SENSITIVE_TEXT = re.compile(
    r"Indian Child Welfare Act|\bICWA\b|termination of (?:the )?parental rights|\badoption\b|child custody|"
    r"protective order|order of protection|protection order|juvenile court|youth court", re.I)


def sensitivity(case: dict) -> str:
    """Why a case is held for a privacy review, or "" when it is not."""
    caption = (case.get("name") or "") + " " + (case.get("name_abbreviation") or "")
    if SENSITIVE_CAPTION.search(caption):
        match = SENSITIVE_CAPTION.search(caption).group(0).lower()
        return "estate" if match in ("estate of", "estate", "heirs", "will of", "probate") else "child or protected person"
    text = case_text(case)
    hits = SENSITIVE_TEXT.findall(text)
    return "child or protected person" if len(hits) >= 3 else ""


def candidates(work: Path) -> list[dict]:
    """Each case once: a case printed in both a state's own reports and a regional reporter shares a citation."""
    rows = [json.loads(line) for line in open(work / "candidates.jsonl")]
    rows.sort(key=lambda row: (-row["score"], row["reporter"], row["volume"], row["file"]))
    seen: dict[str, dict] = {}
    kept = []
    for row in rows:
        if any(cite in seen for cite in row["citations"] if cite):
            continue
        for cite in row["citations"]:
            if cite:
                seen[cite] = row
        kept.append(row)
    return kept


def snippets(text: str, limit: int = 5, width: int = 220) -> list[str]:
    spans = []
    for pattern in MARKERS.values():
        for match in pattern.finditer(text):
            spans.append(match.start())
    spans.sort()
    chosen, last = [], -10**9
    for start in spans:
        if start - last > width * 2:
            chosen.append(" ".join(text[max(0, start - width): start + width].split()))
            last = start
        if len(chosen) >= limit:
            break
    return chosen


def only_native(row: dict) -> bool:
    """True when every term hit is "Native American" and the like, which the study found mostly in affirmative action cases."""
    return all(count == 0 for key, count in row["hits"].items() if key != "native")


def needs_reading(row: dict, auto: int, read_from: int) -> bool:
    """A case below the score kept without a reading, or one whose only hits are "Native American" and the like, however many."""
    return read_from <= row["score"] < auto or (row["score"] >= auto and only_native(row))


def excerpts(args: argparse.Namespace) -> None:
    """Write the reading batches: one short excerpt per candidate case scoring from --read-from to below --auto, for an AI reader."""
    work = Path(args.work)
    rows = [row for row in candidates(work) if needs_reading(row, args.auto, args.read_from)]
    out = work / "reading"
    out.mkdir(exist_ok=True)
    items = []
    for row in rows:
        case = json.loads((work / "cases" / row["reporter"] / row["volume"] / row["file"]).read_text())
        items.append({"id": row["id"], "name": row["name"], "court": row["court"], "date": row["date"],
                      "excerpts": snippets(case_text(case), args.snippets, args.width)})
    items.sort(key=lambda item: item["id"])  # mixes scores and reporters, so each batch is like the others
    size = -(-len(items) // args.batches)
    for index in range(args.batches):
        part = items[index * size:(index + 1) * size]
        (out / f"in-{index + 1}.json").write_text(json.dumps(part, indent=0, ensure_ascii=False))
    print(f"{len(items)} cases to read in {args.batches} batches")


# A Native nation or Native organization named as a party, for cases a reader did not keep.
NATIVE_PARTY = re.compile(r"\b(?:Tribes?|Band|Nation|Pueblo|Rancheria|Indian Community|Native Village|Native Association|Indian Health Board|Tribal)\b")


def select(args: argparse.Namespace) -> None:
    """Write --work/selected.json from the scores and the readers' answers (reading/out-N.json), and the readings, without case names, to the data folder."""
    work = Path(args.work)
    readings = {}
    for path in sorted((work / "reading").glob("out-*.json")):
        for answer in json.loads(path.read_text()):
            readings[answer["id"]] = answer
    selected, missing = [], 0
    for row in candidates(work):
        if row["score"] >= args.auto and not only_native(row):
            selected.append({"id": row["id"], "how": "score"})
            continue
        answer = readings.get(row["id"])
        if needs_reading(row, args.auto, args.read_from) and answer is None:
            missing += 1
        if answer and answer.get("indian_law") is True:
            selected.append({"id": row["id"], "how": "reader", "topic": answer.get("topic", "")})
        elif row["score"] >= args.read_from and NATIVE_PARTY.search(row["name"] or ""):
            selected.append({"id": row["id"], "how": "caption"})
    if missing:
        sys.exit(f"{missing} cases to read have no answer yet")
    (work / "selected.json").write_text(json.dumps(selected, indent=1))
    data = FEDERAL_DATA if args.courts == "federal" else DATA
    data.mkdir(parents=True, exist_ok=True)
    (data / "readings.json").write_text(json.dumps([{"id": key, "indian_law": value.get("indian_law"), "topic": value.get("topic", ""), "sure": value.get("sure")}
                                                    for key, value in sorted(readings.items(), key=lambda item: str(item[0]))], indent=0) + "\n")
    counts = {how: sum(1 for row in selected if row["how"] == how) for how in ("score", "reader", "caption")}
    print(len(selected), "selected", counts)


ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "content" / "sources"
DATA = ROOT / "research" / "state-court-opinions"
SESSION = "2026-11-26-state-court-indian-law-opinions"
TODAY = "2026-11-26"
TOPIC = "state-court-indian-law"
FEDERAL_TOPIC = "federal-court-indian-law"
# --courts federal: the lower federal courts' opinions (data tier 2), from scripts/caselaw/federal_indian_law_cases.py.
FEDERAL_DATA = ROOT / "research" / "federal-court-opinions"
FEDERAL_SESSION = "2026-11-26-federal-court-indian-law-opinions"
# Federal courts whose reports the Project files with the states' (the District of Columbia's, mostly); their cases are federal.
FEDERAL_COURT = re.compile(r"^United States |^Supreme Court of the District of Columbia$|^Court of Appeals of the District of Columbia$")
# The copies' own topics, so they are never listed as Tribal court opinions, which use "caselaw-access-project".
CAPTURE_TOPIC = "state-court-opinions"
FEDERAL_CAPTURE_TOPIC = "federal-court-opinions"
STATES = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA", "Colorado": "CO", "Connecticut": "CT",
    "Delaware": "DE", "District of Columbia": "DC", "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL",
    "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO", "Montana": "MT",
    "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA",
    "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
}
RIGHTS_NOTE = ("The text of a judicial opinion has no copyright (Georgia v. Public.Resource.Org, Inc., 590 U.S. 255 (2020)). "
               "The copy served on this site is the court's opinion only, without the publisher's headnotes, synopsis or other editorial matter (decision record 0060).")


def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def slug(text: str) -> str:
    import unicodedata  # noqa: PLC0415
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:80].strip("-")


def parse_cite(cite: str) -> tuple[str, str, str] | None:
    match = re.match(r"^(\d+)\s+(.+?)\s+(\d+)$", cite or "")
    return (match.group(1), match.group(2), match.group(3)) if match else None


def readable(date: str) -> str:
    parts = [int(part) for part in date.split("-")]
    months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
    if len(parts) == 3:
        return f"{months[parts[1] - 1]} {parts[2]}, {parts[0]}"
    return str(parts[0])


def copy_key(row: dict, topic: str = CAPTURE_TOPIC) -> str:
    return f"{topic}/{row['reporter']}/{row['volume']}/{row['file'].removesuffix('.json')}.html"


def from_courtlistener(row: dict) -> bool:
    """Opinions after the Caselaw Access Project ends, from CourtListener's bulk files (scripts/caselaw/courtlistener_federal_opinions.py)."""
    return row["reporter"] == "courtlistener"


def source_link(row: dict) -> str:
    if from_courtlistener(row):
        return row["link"]
    return f"{STATIC}/{row['reporter']}/{row['volume']}/html/{row['file'].removesuffix('.json')}.html"


def opinion_page(case: dict, key: str, link: str, courtlistener: bool = False) -> bytes:
    """The court's opinions only (no head matter, where the publishers' headnotes and synopses are), as one page."""
    import html  # noqa: PLC0415
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from tribal_court_opinions import PAGE_STYLE  # noqa: PLC0415
    name = case.get("name_abbreviation") or case.get("name") or "Opinion"
    citations = ", ".join(c["cite"] for c in case.get("citations", []) if c.get("cite"))
    court = (case.get("court") or {}).get("name", "")
    date = case.get("decision_date", "")
    removal = "/requests?kind=remove&record=copies/" + key
    parts = []
    for opinion in (case.get("casebody") or {}).get("opinions", []):
        paragraphs = [line.strip() for line in (opinion.get("text") or "").split("\n") if line.strip()]
        parts.append("<section>\n" + "\n".join(f"<p>{html.escape(line)}</p>" for line in paragraphs) + "\n</section>")
    title = f"{name}, {citations} ({court} {date[:4]})" if citations else f"{name} ({court} {date[:4]})"
    return (
        "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
        f"<title>{html.escape(title)}</title>\n<style>{PAGE_STYLE}</style>\n</head>\n<body>\n<header>\n"
        f"<h1>{html.escape(name)}</h1>\n"
        f"<p>{html.escape(citations)}{' · ' if citations else ''}{html.escape(court)}{', decided ' + readable(date) if date else ''}</p>\n"
        + ("<p>The court's opinion, from CourtListener, Free Law Project. " if courtlistener else
           "<p>The court's opinion, from the Caselaw Access Project, Harvard Law School Library, without the publisher's headnotes and synopsis. ") +
        f"<a href=\"{html.escape(link)}\">Original</a>. <a href=\"{html.escape(removal)}\">Ask to remove it</a>.</p>\n"
        "</header>\n<main>\n" + "\n".join(parts) + "\n</main>\n</body>\n</html>\n"
    ).encode("utf-8")


def existing_citations(session: str = "") -> tuple[set[str], set[str], dict[str, Path]]:
    """Keys and "volume reporter page" citations of the source records the project already has, less
    those an earlier run of this session wrote, which are returned by original link so a rerun
    rewrites them under the same keys."""
    keys, cites, ours = set(), set(), {}
    for path in SOURCES.rglob("*.yaml"):
        text = path.read_text(encoding="utf-8")
        if session and session in text and "type: legal_case" in text:
            record = yaml.safe_load(text)
            if session in (record.get("found_in") or []):
                ours[record["original_link"]] = path
                continue
        keys.add(path.stem)
        if "type: legal_case" not in text:
            continue
        record = yaml.safe_load(text)
        citation = record.get("citation") or {}
        if citation.get("volume") and citation.get("page"):
            cites.add(f"{citation['volume']} {citation.get('container-title', '')} {citation['page']}")
        for match in re.finditer(r"\b(\d+) ((?:[A-Z][A-Za-z.]*\s?){1,4}(?:\dd|2d|3d|4th)?) (\d+)\b", (citation.get("title") or "") + " " + str(record.get("notes") or "")):
            cites.add(" ".join(match.group(0).split()))
        if (record.get("courtlistener") or {}).get("citation"):
            cites.add(record["courtlistener"]["citation"])
    return keys, cites, ours


def write(args: argparse.Namespace) -> None:
    """Write a source record and file an opinion page for each selected case; list held ones privately."""
    import csv  # noqa: PLC0415
    import hashlib  # noqa: PLC0415
    import os  # noqa: PLC0415
    import tempfile  # noqa: PLC0415
    work = Path(args.work)
    federal = args.courts == "federal"
    data, session = (FEDERAL_DATA, FEDERAL_SESSION) if federal else (DATA, SESSION)
    selected = {row["id"]: row for row in json.loads((work / "selected.json").read_text())}
    rows = [row for row in candidates(work) if row["id"] in selected]
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from supreme_court_native_cases import Nations  # noqa: PLC0415
    nations = Nations()
    sys.path.insert(0, str(ROOT / "scripts" / "law"))
    from nation_names import NationNames  # noqa: PLC0415
    names = NationNames()
    keys, cites, ours = existing_citations(session)
    keys |= {path.stem for path in ours.values()}  # an earlier run's keys stay with their cases
    rewritten: set[Path] = set()
    if args.file:
        sys.path.insert(0, str(ROOT / "scripts" / "captures"))
        import mirror_captures  # noqa: PLC0415
        if not mirror_captures.have_credentials():
            sys.exit("Filing pages needs R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID in the environment.")
        s3 = mirror_captures.client()
        bucket = os.environ.get("R2_BUCKET", mirror_captures.DEFAULT_BUCKET)
        index = mirror_captures.load_index()
        by_key = {row["key"]: row for row in index}
        overrides = json.loads((ROOT / "research" / "capture-index-overrides.json").read_text(encoding="utf-8"))
    written, skipped, held, public_rows, private_rows = 0, 0, 0, [], []
    pages = []
    for row in rows:
        case = json.loads((work / "cases" / row["reporter"] / row["volume"] / row["file"]).read_text())
        cite_list = [c.get("cite") for c in case.get("citations", []) if c.get("cite")]
        court_name = (case.get("court") or {}).get("name") or row["court"] or ""
        if any(" ".join(cite.split()) in cites for cite in cite_list) or court_name == "Supreme Court of the United States":
            skipped += 1  # held already; every Supreme Court Native case has its own record
            continue
        reason = sensitivity(case)
        if reason == "estate" and args.estates_from and int((row["date"] or "0")[:4] or 0) < args.estates_from:
            reason = ""  # an older estate: shown, per the choice recorded in decision record 0060
        choice = selected[row["id"]]
        if reason:
            held += 1
            private_rows.append({"id": row["id"], "name": case.get("name_abbreviation"), "citation": "; ".join(cite_list),
                                 "court": row["court"], "date": row["date"], "reason": reason, "link": source_link(row)})
            continue
        year = (row["date"] or "0000")[:4]
        base = f"{slug(case.get('name_abbreviation') or 'case')}-{year}"
        key = base
        if source_link(row) in ours:
            key = ours[source_link(row)].stem
        elif key in keys:
            key = f"{base}-{slug((case.get('court') or {}).get('name_abbreviation') or row['reporter'])}"
        number = 2
        while key in keys and source_link(row) not in ours:
            key = f"{base}-{number}"
            number += 1
        keys.add(key)
        first = parse_cite(cite_list[0]) if cite_list else None
        jurisdiction = (case.get("jurisdiction") or {}).get("name_long") or ""
        territorial = "Terr" in jurisdiction or "Territory" in (row["court"] or "")
        named, not_linked = nations.propose(case.get("name") or case.get("name_abbreviation") or "")
        if federal:
            # The tier 2 scripts' shared matcher (scripts/law/nation_names.py) also knows each nation's other names and the Gaming Commission's.
            for nation, named_as in names.named(case.get("name_abbreviation") or case.get("name") or ""):
                if nation not in {n["nation"] for n in named}:
                    named.append({"nation": nation, "named_as": named_as, "role": "party",
                                  "note": "Matched by the script to a name the nation record gives; not yet checked."})
                    not_linked = [n for n in not_linked if named_as.lower() not in n["named_as"].lower() and n["named_as"].lower() not in named_as.lower()]
        date_parts = [int(part) for part in (row["date"] or year).split("-") if part]
        link = source_link(row)
        citation = {"type": "legal_case", "title": case.get("name_abbreviation"), "authority": (case.get("court") or {}).get("name")}
        if first:
            citation.update({"container-title": first[1], "volume": first[0], "page": first[2]})
        citation.update({"issued": {"date-parts": [date_parts]}, "URL": link, "accessed": {"date-parts": [[2026, 11, 26]]}})
        how = {"score": f"an Indian law term score of {row['score']}, at or above {args.auto}, the level kept without a reading",
               "reader": f"an Indian law term score of {row['score']}; an AI reader read excerpts and judged it an Indian law case ({choice.get('topic', '')})",
               "caption": f"an Indian law term score of {row['score']} and a Native nation or Native organization named as a party"}[choice["how"]]
        record = {
            "key": key,
            "kind": "territorial-case" if territorial else "state-case",
            "citation": citation,
            "original_link": link,
            "retrieved": TODAY,
            "archives": [],
            "history": {"status": "live", "last_checked": TODAY},
            "rights": {"status": "no-permission-needed", "basis": "government-edict", "basis_note": RIGHTS_NOTE, "redistribution": True},
            **({"tribes": [n["nation"] for n in named]} if named else {}),
            "nations_in_case": {"checked": TODAY, "named": named, **({"not_linked": not_linked} if not_linked else {})},
            "jurisdictions": [{"level": "territory" if territorial else "state", **({"state": STATES[jurisdiction]} if jurisdiction in STATES else {})}],
            "topics": [TOPIC],
            "found_in": [session],
            "notes": ((f"Published at {'; '.join(cite_list)}. " if cite_list else f"Docket {case.get('docket_number') or 'number not given'}; no reporter citation yet. ")
                      + f"Decided by the {citation['authority']}" + (f" on {readable(row['date'])}" if row["date"] else "")
                      + (". Found by scripts/caselaw/courtlistener_federal_opinions.py and scripts/caselaw/state_court_opinions.py in CourtListener's bulk files" if from_courtlistener(row)
                         else ". Found by scripts/caselaw/state_court_opinions.py in the Caselaw Access Project's volumes") + f", with {how}."),
            "review": {"status": "unverified", "by": "scripts/caselaw/state_court_opinions.py", "date": TODAY, "checks": [
                {"check": "Indian law case: the term score and, below the score kept without a reading, an AI reader's judgment of excerpts",
                 "result": "agree", "detail": f"score {row['score']}" + (f"; reader: {choice.get('topic', '')}" if choice["how"] == "reader" else "; kept because a party is a Native nation or organization" if choice["how"] == "caption" else "")},
                {"check": "Nations named in the caption, matched to nation records by name", "result": "agree" if not not_linked else "missing",
                 "detail": f"{len(named)} matched, {len(not_linked)} not linked"}]},
        }
        if record["jurisdictions"][0]["level"] == "territory":
            record["jurisdictions"][0] = {"level": "other", "note": "Indian Territory" if "Indian Territory" in court_name else jurisdiction or "Territorial court"}
        if federal or FEDERAL_COURT.search(court_name):
            record.update(kind="federal-case", jurisdictions=[{"level": "federal"}], topics=[FEDERAL_TOPIC])
        path = SOURCES / (key[0] if "a" <= key[0] <= "z" else "_other") / f"{key}.yaml"
        path.write_text(dump(record), encoding="utf-8")
        rewritten.add(path)
        written += 1
        public_rows.append({"key": key, "citation": "; ".join(cite_list), "court": row["court"], "date": row["date"], "score": row["score"], "how": choice["how"]})
        if args.file:
            capture = copy_key(row, FEDERAL_CAPTURE_TOPIC if federal else CAPTURE_TOPIC)
            page = opinion_page(case, capture, link, from_courtlistener(row))
            pages.append((capture, page, record, row))
    stale = {path.stem for path in ours.values() if path not in rewritten}
    for path in ours.values():
        if path not in rewritten:
            path.unlink()  # no longer selected, or now held for a privacy review
    if args.file:
        if stale:
            index = [row for row in index if row["records"] not in stale]
            by_key = {row["key"]: row for row in index}

        def upload(item):
            capture, data, record, row = item
            digest = hashlib.sha256(data).hexdigest()
            existing = by_key.get(capture)
            if not (existing and existing["sha256"] == digest):
                with tempfile.NamedTemporaryFile(suffix=".html") as handle:
                    handle.write(data)
                    handle.flush()
                    s3.upload_file(handle.name, bucket, capture, ExtraArgs={"ContentType": "text/html; charset=utf-8", "Metadata": {"sha256": digest, "captured": TODAY}})
                if mirror_captures.remote_state(s3, bucket, capture) != (len(data), digest):
                    raise SystemExit(f"verification failed for {capture}")
            new = {field: "" for field in mirror_captures.FIELDS}
            topic = FEDERAL_CAPTURE_TOPIC if record["kind"] == "federal-case" else CAPTURE_TOPIC
            new.update(key=capture, bytes=len(data), sha256=digest, media_type="text/html", topic=topic,
                       title=record["citation"]["title"], nations=";".join(record.get("tribes", [])),
                       obtained=f"built from {'CourtListener' if from_courtlistener(row) else 'the Caselaw Access Project'}'s files, {TODAY}", link=record["original_link"], captured=TODAY,
                       records=record["key"], record_kinds="source", rights=mirror_captures.TOPIC_RIGHTS[topic], redistribution="yes", keep_local="no", orphan="no")
            for field in ("redistribution", "rights"):
                if overrides.get(capture, {}).get(field):
                    new[field] = overrides[capture][field]
            return capture, new
        with cf.ThreadPoolExecutor(8) as pool:
            for capture, new in pool.map(upload, pages):
                if capture in by_key:
                    by_key[capture].update(new)
                else:
                    index.append(new)
                    by_key[capture] = new
        mirror_captures.write_index(index)
    data.mkdir(parents=True, exist_ok=True)
    with open(data / "records.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, ["key", "citation", "court", "date", "score", "how"])
        writer.writeheader()
        writer.writerows(public_rows)
    summary = {"written": written, "already_held": skipped, "held_for_privacy_review": held,
               "held_by_reason": {reason: sum(1 for r in private_rows if r["reason"] == reason) for reason in sorted({r["reason"] for r in private_rows})}}
    (data / "summary.json").write_text(json.dumps(summary, indent=1) + "\n", encoding="utf-8")
    private = Path(args.private)
    private.mkdir(parents=True, exist_ok=True)
    with open(private / "held-for-privacy-review.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, ["id", "name", "citation", "court", "date", "reason", "link"])
        writer.writeheader()
        writer.writerows(private_rows)
    print(summary)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--courts", choices=["state", "federal"], default="state", help="state and territorial courts (tier 3) or the lower federal courts (tier 2)")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("scan")
    p.add_argument("--work", required=True)
    p.add_argument("--jobs", type=int, default=8)
    p = sub.add_parser("excerpts")
    p.add_argument("--work", required=True)
    p.add_argument("--auto", type=int, default=10, help="score from which a case is kept without a reading")
    p.add_argument("--batches", type=int, default=8)
    p.add_argument("--read-from", type=int, default=KEEP_FULL, help="lowest score read (the federal run reads every candidate, from 1)")
    p.add_argument("--snippets", type=int, default=5, help="passages per case")
    p.add_argument("--width", type=int, default=220, help="characters on each side of a term")
    p = sub.add_parser("select")
    p.add_argument("--work", required=True)
    p.add_argument("--auto", type=int, default=10)
    p.add_argument("--read-from", type=int, default=KEEP_FULL)
    p = sub.add_parser("write")
    p.add_argument("--work", required=True)
    p.add_argument("--auto", type=int, default=10)
    p.add_argument("--private", required=True, help="folder outside git for the list of held cases, which names people")
    p.add_argument("--estates-from", type=int, default=0, help="hold estate cases decided in this year or later (0: hold every estate case)")
    p.add_argument("--file", action="store_true", help="also file each opinion page in the bucket and the capture index")
    args = parser.parse_args()
    {"scan": scan, "excerpts": excerpts, "select": select, "write": write}[args.command](args)


if __name__ == "__main__":
    main()
