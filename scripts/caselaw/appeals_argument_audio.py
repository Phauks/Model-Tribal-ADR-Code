#!/usr/bin/env python3
"""Courts of appeals argument audio for the lower federal court Indian law records.

The Ninth Circuit keeps an MP3 of its arguments on its own server back to 2003, found through the
public media search its archive page calls; the Tenth Circuit has posted an MP3 of every argument since
January 2018 (research/analyses/2026-11-27-appeals-audio-land-spectrum-films.md, section 2). This script
joins those recordings to our case records by docket number, never by case name alone:

  dockets   reads each Ninth and Tenth Circuit record's docket number from the Caselaw Access Project's
            case file (docket_number), from the record's notes (CourtListener records with no reporter
            citation), from GovInfo's United States Courts Opinions, or from the court's own opinion file
            at the decision date; writes <work>/dockets.json
  lists     reads the Tenth Circuit's argument list (all pages) into <work>/ca10-arguments.json
  match     looks up each docket in the courts' lists and keeps recordings argued before the decision;
            writes <work>/matches.json
  download  downloads each matched recording once, measures it (SHA-256, bytes, length) and uploads it, unchanged,
            to R2 under appeals-court-audio/<court>/<year>/<date argued>-<docket>.<mp3 or wma>
  write     adds citation.number (the docket) and argument_audio to each record

A recording whose opinion is held for privacy has no record in content/sources, so it gets no public
link; the held list's matches are written only to the private file named by --private.

Usage: python3 scripts/caselaw/appeals_argument_audio.py <step> --work DIR [options]
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[2]
SOURCES = REPO / "content" / "sources"
USER_AGENT = "Mozilla/5.0 (compatible; TribalLawProject/1.0; research archive)"
NINTH_MEDIA = "https://oldrbx80f5.execute-api.us-west-2.amazonaws.com/prod/media"
TENTH_SEARCH = "https://www.ca10.uscourts.gov/oralargument/search-results"
TENTH_AUDIO = "https://www.ca10.uscourts.gov/sites/ca10/files/oralarguments/{docket}.mp3"
BUCKET_PREFIX = "appeals-court-audio"
NINTH_FROM, TENTH_FROM = 2003, 2014
TODAY = datetime.date.today().isoformat()


def fetch(url: str, tries: int = 4, method: str = "GET") -> tuple[int, bytes]:
    for attempt in range(tries):
        try:
            # The court's file names sometimes hold spaces ("17-56791 Chemehuevi Indian Tribe v. John McMahon.mp3").
            request = urllib.request.Request(urllib.parse.quote(url, safe=":/?&=%"), headers={"User-Agent": USER_AGENT}, method=method)
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.status, response.read() if method == "GET" else b""
        except urllib.error.HTTPError as error:
            if error.code in (404, 403, 401, 400):
                return error.code, b""
            time.sleep(2 * (attempt + 1))
        except Exception:
            time.sleep(2 * (attempt + 1))
    return 0, b""


def court_of(authority: str) -> str | None:
    if "Ninth" in authority:
        return "ca9"
    if "Tenth" in authority:
        return "ca10"
    return None


def case_records() -> list[dict]:
    """Ninth Circuit records decided from 2003 and Tenth Circuit records from 2014 in the federal court collection."""
    rows = []
    for path in sorted(SOURCES.glob("*/*.yaml")):
        text = path.read_text(encoding="utf-8")
        if "federal-court-indian-law" not in text or ("Ninth" not in text and "Tenth" not in text):
            continue
        record = yaml.safe_load(text)
        citation = record.get("citation") or {}
        court = court_of(citation.get("authority", ""))
        if not court or record.get("kind") != "federal-case":
            continue
        parts = citation["issued"]["date-parts"][0]
        if parts[0] < (NINTH_FROM if court == "ca9" else TENTH_FROM):
            continue
        decided = "-".join(f"{p:02d}" if i else str(p) for i, p in enumerate(parts + [1] * (3 - len(parts))))
        rows.append({"key": record["key"], "path": str(path.relative_to(REPO)), "court": court, "title": citation["title"],
                     "decided": decided, "url": citation.get("URL", ""), "number": citation.get("number"),
                     "notes": record.get("notes", "")})
    return rows


def normal_docket(court: str, docket: str) -> str:
    """'No. 17-1421' -> '17-1421'; GovInfo's '18-04013' -> '18-4013'; Ninth Circuit four-digit years kept as filed."""
    docket = re.sub(r"^(Nos?\.?|Docket)\s*", "", docket.strip(), flags=re.I)
    match = re.fullmatch(r"(\d{2})-0*(\d+)", docket)
    return f"{match.group(1)}-{match.group(2)}" if match else docket


def split_dockets(court: str, text: str) -> list[str]:
    """All docket numbers in a docket line, such as '10-17803, 10-17878 (D.C. No. 4:09-cv-01471-CW)'."""
    text = re.sub(r"\(D\.\s*C\..*?\)|D\.\s*C\.\s*No\..*", "", text)
    found = re.findall(r"\b(\d{2}-\d{3,5})\b", text)
    out = []
    for docket in found:
        docket = normal_docket(court, docket)
        if docket not in out:
            out.append(docket)
    return out


def cap_docket(url: str) -> str | None:
    match = re.match(r"https://static\.case\.law/([^/]+)/([^/]+)/html/([^/]+)\.html", url)
    if not match:
        return None
    status, body = fetch(f"https://static.case.law/{match.group(1)}/{match.group(2)}/cases/{match.group(3)}.json")
    if status != 200:
        return None
    return json.loads(body).get("docket_number") or None


GENERIC = {"the", "and", "inc", "llc", "corp", "co", "united", "states", "america", "tribe", "tribes", "indian", "indians", "nation", "nations",
           "band", "city", "county", "state", "of", "for", "in", "re", "et", "al", "v", "vs", "department", "dept", "secretary", "interior",
           "community", "council", "people", "company", "corporation", "association", "ass'n", "ex", "rel", "usa", "us"}


def caption_words(title: str) -> set[str]:
    return {w.lower().strip("'") for w in re.findall(r"[A-Za-z][A-Za-z'\-]{1,}", title) if w.lower().strip("'") not in GENERIC and len(w) > 2}


def govinfo_search(key: str, query: str) -> list[dict]:
    body = json.dumps({"query": query, "pageSize": 1000, "offsetMark": "*"}).encode()
    request = urllib.request.Request(f"https://api.govinfo.gov/search?api_key={key}", data=body,
                                     headers={"Content-Type": "application/json", "User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.loads(response.read()).get("results", [])
        except Exception:
            time.sleep(3 * (attempt + 1))
    return []


def govinfo_docket(row: dict, key: str) -> tuple[str | None, str | None]:
    """The one GovInfo United States Courts Opinions package from this court, issued on the decision date, whose
    caption shares a distinctive word with ours."""
    match = re.search(r"USCOURTS-(ca\d+)-(\d{2}-\d+)", row["url"])
    if match:
        return match.group(2), row["url"]
    court_code = row["court"]
    ours = caption_words(row["title"])
    if not ours:
        return None, None
    day = row["decided"]
    results = govinfo_search(key, f"collection:USCOURTS courtcode:{court_code} publishdate:range({day},{day})")
    hits = {r["packageId"] for r in results if r.get("dateIssued") == day and r.get("packageId", "").startswith(f"USCOURTS-{court_code}-")
            and caption_words(r.get("title", "")) & ours}
    if len(hits) != 1:
        return None, None
    package = hits.pop()
    return package.split(f"USCOURTS-{court_code}-")[1], f"https://www.govinfo.gov/app/details/{package}"


def held_records(path: str) -> list[dict]:
    """Ninth and Tenth Circuit opinions on the private held list (no record in content/sources)."""
    import csv
    rows = []
    with open(path, encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            court = court_of(row["court"])
            if not court or row["date"][:4] < str(NINTH_FROM if court == "ca9" else TENTH_FROM):
                continue
            rows.append({"key": row["id"], "path": None, "held": True, "court": court, "title": row["name"], "decided": row["date"],
                         "url": row["link"], "number": None, "notes": ""})
    return rows


def step_dockets(args) -> None:
    work = Path(args.work)
    rows = case_records() + (held_records(args.held) if args.held else [])
    key = os.environ.get("DATA_GOV_API_KEY", "")
    print(f"{len(rows)} records", file=sys.stderr)

    def one(row: dict) -> dict:
        found = {"key": row["key"], "court": row["court"], "title": row["title"], "decided": row["decided"], "path": row["path"],
                 "held": row.get("held", False)}
        if row.get("number"):
            found.update(dockets=split_dockets(row["court"], str(row["number"])), how="record", raw=row["number"])
            return found
        if "static.case.law" in row["url"]:
            raw = cap_docket(row["url"])
            if raw:
                found.update(dockets=split_dockets(row["court"], raw), how="cap", raw=raw)
                return found
        match = re.search(r"Docket ([0-9][0-9A-Za-z\-, ]+?)(?:;|\.)", row["notes"])
        if match:
            found.update(dockets=split_dockets(row["court"], match.group(1)), how="notes", raw=match.group(1))
            return found
        if key:
            docket, link = govinfo_docket(row, key)
            if docket:
                found.update(dockets=[normal_docket(row["court"], docket)], how="govinfo", raw=docket, source=link)
                return found
        found.update(dockets=[], how="none")
        return found

    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        out = list(pool.map(one, rows))
    (work / "dockets.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    counts: dict[str, int] = {}
    for row in out:
        counts[row["how"]] = counts.get(row["how"], 0) + 1
    print(counts, file=sys.stderr)


def tenth_page(page: int) -> list[dict]:
    status, body = fetch(f"{TENTH_SEARCH}?page={page}")
    if status != 200:
        raise SystemExit(f"Tenth Circuit list page {page}: HTTP {status}")
    html = body.decode("utf-8", "replace")
    rows = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", html, flags=re.S):
        def cell(name: str) -> str:
            match = re.search(rf'<td class="[^"]*views-field-{name}[^"]*"[^>]*>(.*?)</td>', row, flags=re.S)
            return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", match.group(1))).strip() if match else ""
        mp3 = re.search(r'<a href="([^"]+\.mp3)"(?: type="[^"]*length=(\d+)")?', row, flags=re.I)
        argued = re.search(r'content="(\d{4}-\d{2}-\d{2})T', row)
        if not (mp3 and argued):
            if "<td" in row and "views-field-field-oa-case-number" in row:
                print(f"page {page}: a listed argument with no recording link: {re.sub(r'<[^>]+>', ' ', row)[:120]}", file=sys.stderr)
            continue
        docket = cell("field-oa-case-number")
        associated = re.findall(r"\b\d{2}-\d{3,5}\b", cell("field-opinion-associated-cases"))
        rows.append({"docket": normal_docket("ca10", docket), "associated": [normal_docket("ca10", d) for d in associated],
                     "caption": cell("field-oa-case-title"), "argued": argued.group(1), "place": cell("field-oa-location"),
                     "mp3": urllib.parse.urljoin(TENTH_SEARCH, mp3.group(1)), "listed_bytes": int(mp3.group(2)) if mp3.group(2) else None})
    return rows


def step_lists(args) -> None:
    work = Path(args.work)
    first = tenth_page(0)
    if not first:
        raise SystemExit("Tenth Circuit list: no rows on the first page; the page layout may have changed")
    rows, page = list(first), 1
    while True:
        more = tenth_page(page)
        if not more:
            break
        rows.extend(more)
        page += 1
        time.sleep(0.5)
    (work / "ca10-arguments.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
    print(f"{len(rows)} Tenth Circuit recordings on {page} pages", file=sys.stderr)


def ninth_search(docket: str) -> list[dict]:
    status, body = fetch(f"{NINTH_MEDIA}/search?" + urllib.parse.urlencode({"q": docket}))
    if status != 200:
        return []
    items = json.loads(body).get("items", [])
    return [i for i in items if (i.get("case_num") or "").strip() == docket]


def ninth_detail(docket: str, hearing_date: str) -> dict:
    status, body = fetch(f"{NINTH_MEDIA}/{urllib.parse.quote(docket)}?hearingDate={hearing_date}")
    return json.loads(body) if status == 200 and body else {}


def step_match(args) -> None:
    work = Path(args.work)
    dockets = json.loads((work / "dockets.json").read_text(encoding="utf-8"))
    tenth = json.loads((work / "ca10-arguments.json").read_text(encoding="utf-8"))
    by_tenth: dict[str, list[dict]] = {}
    for row in tenth:
        for docket in [row["docket"], *row.get("associated", [])]:
            by_tenth.setdefault(docket, []).append(row)

    def one(row: dict) -> dict:
        found = []
        for docket in row["dockets"]:
            if row["court"] == "ca10":
                for hearing in by_tenth.get(docket, []):
                    found.append({"docket": docket, "argued": hearing["argued"], "caption": hearing["caption"],
                                  "court_link": hearing["mp3"], "place": hearing.get("place")})
            else:
                for item in ninth_search(docket):
                    detail = ninth_detail(docket, item["hearing_date"])
                    if detail.get("listen_url"):
                        found.append({"docket": docket, "argued": item["hearing_date"], "caption": item.get("case_name"),
                                      "court_link": detail["listen_url"], "place": item.get("hearing_location"),
                                      "panel": item.get("case_panel")})
        # A recording argued after the decision belongs to a rehearing or a later appeal, not this opinion.
        kept, seen = [], set()
        for hearing in sorted(found, key=lambda h: h["argued"]):
            if hearing["argued"] > row["decided"] or hearing["court_link"] in seen:
                continue
            seen.add(hearing["court_link"])
            kept.append(hearing)
        return {**row, "recordings": kept}

    with concurrent.futures.ThreadPoolExecutor(6) as pool:
        out = list(pool.map(one, dockets))
    (work / "matches.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    with_audio = [r for r in out if r["recordings"]]
    print(f"{len(with_audio)} of {len(out)} records have a recording; {sum(len(r['recordings']) for r in with_audio)} recordings", file=sys.stderr)


def duration_seconds(path: Path) -> int | None:
    try:
        result = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                                capture_output=True, text=True, timeout=120)
        return round(float(result.stdout.strip()))
    except Exception:
        return None


def bucket():
    import boto3
    from botocore.config import Config
    account = os.environ.get("R2_ACCOUNT_ID") or os.environ["CLOUDFLARE_ACCOUNT_ID"]
    return boto3.client("s3", endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
                        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"], aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
                        region_name="auto", config=Config(retries={"max_attempts": 8}))


MEDIA_TYPES = {"mp3": "audio/mpeg", "wma": "audio/x-ms-wma"}
ASF_HEADER = bytes.fromhex("3026b2758e66cf11a6d900aa0062ce6c")


def extension(link: str) -> str:
    return link.rsplit(".", 1)[-1].lower()


def storage_key(court: str, argued: str, docket: str, link: str) -> str:
    """The court's file kept as it was published: the Ninth Circuit's older arguments are Windows Media Audio."""
    return f"{BUCKET_PREFIX}/{court}/{argued[:4]}/{argued}-{docket}.{extension(link)}"


def is_audio(data: bytes, kind: str) -> bool:
    if kind == "wma":
        return data[:16] == ASF_HEADER
    return data[:3] == b"ID3" or (len(data) > 1 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0)


def step_download(args) -> None:
    work = Path(args.work)
    files = work / "mp3"
    files.mkdir(exist_ok=True)
    matches = json.loads((work / Path(args.matches).name if args.matches else work / "matches.json").read_text(encoding="utf-8"))
    measured_path = work / "measured.json"
    measured = json.loads(measured_path.read_text(encoding="utf-8")) if measured_path.exists() else {}
    client = bucket()
    name = os.environ.get("R2_BUCKET", "tribal-law-project-files")
    jobs = {}
    for row in matches:
        for hearing in row["recordings"]:
            jobs[hearing["court_link"]] = storage_key(row["court"], hearing["argued"], hearing["docket"], hearing["court_link"])

    def one(item):
        link, key = item
        if link in measured and measured[link].get("uploaded"):
            return link, measured[link]
        path = files / Path(key).name
        if not path.exists() or path.stat().st_size == 0:
            status, body = fetch(link)
            if status != 200 or not body:
                return link, {"error": f"HTTP {status}"}
            path.write_bytes(body)
        data = path.read_bytes()
        info = {"storage_key": key, "checksum": hashlib.sha256(data).hexdigest(), "bytes": len(data),
                "duration_seconds": duration_seconds(path), "retrieved": TODAY}
        if not is_audio(data, extension(link)):
            return link, {"error": f"not a {extension(link)} file"}
        client.put_object(Bucket=name, Key=key, Body=data, ContentType=MEDIA_TYPES[extension(link)])
        head = client.head_object(Bucket=name, Key=key)
        info["uploaded"] = head["ContentLength"] == len(data)
        if args.remove_local:
            path.unlink()
        return link, info

    done = 0
    with concurrent.futures.ThreadPoolExecutor(args.threads) as pool:
        for link, info in pool.map(one, jobs.items()):
            measured[link] = info
            done += 1
            if done % 25 == 0:
                measured_path.write_text(json.dumps(measured, indent=1), encoding="utf-8")
                print(f"{done} of {len(jobs)}", file=sys.stderr)
    measured_path.write_text(json.dumps(measured, indent=1), encoding="utf-8")
    errors = {k: v for k, v in measured.items() if "error" in v}
    print(f"{len(jobs) - len(errors)} uploaded, {len(errors)} errors", file=sys.stderr)


COURT_NAMES = {"ca9": "United States Court of Appeals for the Ninth Circuit", "ca10": "United States Court of Appeals for the Tenth Circuit"}


# A child or a person named by initials in the caption: the recording is listed only in the private file, as a
# held opinion's would be (the project's children's cases rule; #595's initials rule).
CHILD_WORDS = re.compile(r"\bjuvenile\b|\bminors?\b|\b(john|jane)?\s*doe\b|\bchild(ren)?\b|\bguardian", re.I)
NOT_INITIALS = {"U.S.", "U.S.A.", "P.S.", "L.L.C.", "L.P.", "N.A.", "P.C.", "D.C.", "S.A.", "P.A.", "L.L.P."}
INITIALS_PARTY = re.compile(r"^(?:[A-Z]\.\s?){2,3}$|^[A-Z][a-z]+ [A-Z]\.$")
STATES = {"alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
          "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota",
          "mississippi", "missouri", "montana", "nebraska", "nevada", "hampshire", "jersey", "mexico", "york", "carolina", "dakota", "ohio",
          "oklahoma", "oregon", "pennsylvania", "rhode", "tennessee", "texas", "utah", "vermont", "virginia", "washington", "wisconsin", "wyoming",
          "guam", "samoa"}
ENTITY = re.compile(r"\b(state|co\.?|inc\.?|corp\.?|corporation|company|llc|ltd|district|county|city|tribe|tribes|band|nation|board|"
                    r"realty|acres|land|lands|water|irrigation|ditch|estate|financial|service|services|bank|trust|association|ass'n|"
                    r"authority|department|agency|commission|community|council|enterprises?|casino|reservation|parcel|property|"
                    r"\$|dollars|approximately|various|one|two|\d)\b", re.I)


def child_caption(*captions: str) -> bool:
    """The caption names a child (juvenile, minor, Doe) or names a party only by initials ("M.J.", "Leon H.")."""
    for caption in captions:
        caption = caption or ""
        if CHILD_WORDS.search(caption):
            return True
        for party in re.split(r"\s+v\.?\s+|\s+ex rel\.\s+|,", caption):
            party = re.sub(r"^(?:in re|the)\s+", "", party.strip(), flags=re.I).strip()
            if party and INITIALS_PARTY.match(party) and party.replace(" ", "") not in NOT_INITIALS:
                return True
    return False


def criminal_appeal(title: str) -> bool:
    """A United States prosecution of a person (project inference from the caption: the defendant is not a state,
    a business, a public body, a nation or property). Its argument may name a victim the opinion does not."""
    match = re.match(r"^(United States|U\.\s?S\.|USA)( of America)?,?\s+v\.?\s+(.+)$", title.strip(), flags=re.I)
    if not match:
        return False
    defendant = match.group(3)
    words = {w.lower() for w in re.findall(r"[A-Za-z]+", defendant)}
    return not (words & STATES or ENTITY.search(defendant))


def step_write(args) -> None:
    work = Path(args.work)
    matches = json.loads((work / "matches.json").read_text(encoding="utf-8"))
    measured = json.loads((work / "measured.json").read_text(encoding="utf-8"))
    dockets_written = audio_written = 0
    private = []
    for row in matches:
        private_only = row.get("held") or any(child_caption(row["title"], h.get("caption", "")) for h in row["recordings"])
        if private_only:
            # A held opinion has no public record, and a recording whose caption names a child or a person by
            # initials stays off the public record too: both are listed only in the private file.
            for hearing in row["recordings"]:
                info = measured.get(hearing["court_link"], {})
                private.append({"id": row["key"], "why": "opinion held" if row.get("held") else "caption names a child or initials",
                                "name": row["title"], "court": row["court"], "decided": row["decided"],
                                "docket": hearing["docket"], "argued": hearing["argued"], "link": hearing["court_link"],
                                "storage_key": info.get("storage_key", ""), "checksum": info.get("checksum", ""),
                                "bytes": info.get("bytes", ""), "duration_seconds": info.get("duration_seconds", "")})
            if row.get("held"):
                continue
        path = REPO / row["path"]
        text = path.read_text(encoding="utf-8")
        record = yaml.safe_load(text)
        changed = False
        citation = record["citation"]
        if row["dockets"] and not citation.get("number"):
            citation["number"] = ", ".join(row["dockets"])
            dockets_written += 1
            changed = True
        recordings = []
        for hearing in [] if private_only else row["recordings"]:
            info = measured.get(hearing["court_link"], {})
            if not info.get("uploaded"):
                continue
            # The same item shape as the Supreme Court recordings (schemas/source.schema.json, argument_audio).
            entry = {"kind": "argument", "date": hearing["argued"], "source": COURT_NAMES[row["court"]],
                     "link": urllib.parse.quote(hearing["court_link"], safe=":/?&=%")}
            if info.get("duration_seconds"):
                entry["duration_seconds"] = info["duration_seconds"]
            if criminal_appeal(row["title"]):
                # Held until a reading of its transcript finds no child or victim named (spike note, section 2.3).
                entry["held"] = True
                entry["note"] = "Held until a reading of the argument finds no child or victim named; the opinion itself is shown."
            entry["file"] = {"storage_key": info["storage_key"], "checksum": info["checksum"], "media_type": MEDIA_TYPES[extension(hearing["court_link"])], "bytes": info["bytes"]}
            recordings.append(entry)
        if recordings and record.get("argument_audio") != recordings:
            record["argument_audio"] = recordings
            audio_written += 1
            changed = True
        if changed:
            # argument_audio sits just before rights, after the record's own copy fields.
            out = {}
            for field, value in record.items():
                if field == "argument_audio":
                    continue
                if field == "rights" and "argument_audio" in record:
                    out["argument_audio"] = record["argument_audio"]
                out[field] = value
            path.write_text(yaml.safe_dump(out, sort_keys=False, allow_unicode=True, width=1_000_000), encoding="utf-8")
    if args.private and private:
        import csv
        with open(args.private, "w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(private[0]))
            writer.writeheader()
            writer.writerows(private)
    print(f"docket numbers added to {dockets_written} records; argument audio on {audio_written} records; "
          f"{len(private)} recordings of held opinions listed privately", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("step", choices=["dockets", "lists", "match", "download", "write"])
    parser.add_argument("--work", required=True, help="working folder outside git")
    parser.add_argument("--held", help="the private held list (CSV with id, name, court, date, link); its recordings are kept private")
    parser.add_argument("--private", help="private file (outside git) for the held records' recordings (write step)")
    parser.add_argument("--matches", help="matches file name in the working folder (download step)")
    parser.add_argument("--threads", type=int, default=8)
    parser.add_argument("--remove-local", action="store_true", help="delete each MP3 here once it is in the bucket")
    args = parser.parse_args()
    Path(args.work).mkdir(parents=True, exist_ok=True)
    {"dockets": step_dockets, "lists": step_lists, "match": step_match, "download": step_download, "write": step_write}[args.step](args)


if __name__ == "__main__":
    main()
