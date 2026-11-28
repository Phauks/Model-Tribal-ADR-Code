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
           skipped by citation. Cases about children or protected persons are
           held for a privacy review, and so are estate cases unless
           --show-estates is given (or, with --estates-from, only those decided
           in or after that year). Held cases are listed only in
           --private/held-for-privacy-review.csv, which never goes in git (decision record 0060). With --file, each opinion is
           built as an HTML page of the court's opinions only, without the
           publisher's head matter, uploaded to R2 under caselaw-access-project/
           and added to research/capture-index.csv. Counts go to
           research/state-court-opinions/summary.json and records.csv.

  release  Bring back cases a read check cleared of a privacy hold (--cleared, a private
           CSV outside git with the columns id, link and decision; the rows whose
           decision is "release"). Each case is fetched again from the Caselaw Access
           Project into --work, with its score and how it was chosen rebuilt from the
           scan's terms and the readers' answers in the data folder's readings.json, and
           written as write does, adding to the records already written: no other
           record is removed, records.csv and summary.json gain the cases, and the
           private list of held cases loses them. Their records say why they were
           held and why they were released, without names.

With --courts federal, excerpts, write and release work on the lower federal courts' opinions
instead (data tier 2): scripts/caselaw/federal_indian_law_cases.py scans the eleven
federal reporters and its prepare step lays the results out in this script's --work
layout. Federal records are kind federal-case, topic federal-court-indian-law, their
counts go to research/federal-court-opinions/, and their copies are filed under
federal-court-opinions/ in R2.

Run from the repository root:

    python3 scripts/caselaw/state_court_opinions.py scan --work DIR [--jobs 8]
    python3 scripts/caselaw/state_court_opinions.py excerpts --work DIR --auto 10 --batches 8
    python3 scripts/caselaw/state_court_opinions.py write --work DIR --auto 10 --private DIR --show-estates --file
    python3 scripts/caselaw/state_court_opinions.py --courts federal excerpts --work DIR --auto 10 --read-from 1 --batches 30
    python3 scripts/caselaw/state_court_opinions.py --courts federal write --work DIR --auto 10 --private DIR --show-estates --file
    python3 scripts/caselaw/state_court_opinions.py --courts federal release --cleared CSV --work DIR --private DIR --show-estates --file
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
# at the coordinator's request on Nov. 26, 2026, estates, which Trevor chose to show the same day
# (--show-estates). Matched in the caption, then the text.
SENSITIVE_CAPTION = re.compile(
    r"\b(?:adoption|custody|guardianship|welfare of|interest of|dependency|dependent|neglected|delinquen|juvenile|minor|"
    r"child(?:ren)?|infant|parental rights|paternity|protective order|protection order|estate of|estate|heirs|will of|probate|"
    r"commitment of|mental health|incompeten)\b", re.I)
SENSITIVE_TEXT = re.compile(
    r"Indian Child Welfare Act|\bICWA\b|termination of (?:the )?parental rights|\badoption\b|child custody|"
    r"protective order|order of protection|protection order|juvenile court|youth court", re.I)

INITIALS_PARTY = re.compile(r"^\s*(?:In re |Matter of |Doe, )?(?:[A-Z]\.\s?){1,4}(?:-?[A-Z]\.\s?)*(?:,? (?:Jr|Sr)\.?)?(?:,? et al\.?)?\s*$")


def sensitivity(case: dict) -> str:
    """Why a case is held for a privacy review, or "" when it is not."""
    caption = (case.get("name") or "") + " " + (case.get("name_abbreviation") or "")
    if SENSITIVE_CAPTION.search(caption):
        match = SENSITIVE_CAPTION.search(caption).group(0).lower()
        if match not in ("estate of", "estate", "heirs", "will of", "probate"):
            return "child or protected person"
        # An estate case that is also about a child (an adoption, a minor heir's guardianship) is held as a child case.
        return "child or protected person" if len(SENSITIVE_TEXT.findall(case_text(case))) >= 3 else "estate"
    # A party the court names only by initials (United States v. B.N.M., L.B. v. United States) is most often a
    # minor or a victim the court has already shielded; the opinion's text may still say more.
    for name in (case.get("name_abbreviation"), case.get("name")):
        if any(INITIALS_PARTY.match(side) for side in re.split(r"\bv\.?\s", name or "")):
            return "child or protected person"
    # Juvenile cases in the federal courts often give a first name and an initial (United States v. Bernard S.),
    # unless the full caption shows it is a shortened name with a surname (Charles E. and Carol M. SAUNOOKE).
    short = case.get("name_abbreviation") or ""
    if any(FIRST_NAME_INITIAL.match(side.strip()) for side in re.split(r"\bv\.?\s", short)) and not caption_surname(case):
        return "child or protected person"
    hits = SENSITIVE_TEXT.findall(case_text(case))
    if len(hits) >= 3:
        return "child or protected person"
    # Federal criminal and civil rights cases about a child: a juvenile defendant, a child victim, a foster placement.
    # Added after the review of Nov. 27, 2026, when readers found 107 shown opinions like these.
    return "child or protected person" if len(CHILD_TEXT.findall(case_text(case))) >= 3 else ""


FIRST_NAME_INITIAL = re.compile(r"^(?:In re )?[A-Z][a-z]+ [A-Z]\.$")
CHILD_TEXT = re.compile(
    r"Juvenile Delinquency Act|18 U\.S\.C\. ?§+ ?503[1-9]|juvenile delinquen|adjudicated (?:a )?delinquent|\bJuvenile (?:Male|Female)\b|"
    r"sexual abuse of a minor|abusive sexual contact with a (?:child|minor)|aggravated sexual abuse of a child|child pornography|"
    r"parental rights|Indian Child Welfare Act|foster (?:care|home)|guardian ad litem", re.I)


def caption_surname(case: dict) -> str:
    """The first party's surname in the full caption, where the court printed it in capitals (Charles E. SAUNOOKE)."""
    first = re.split(r"\s+v\.?\s+", case.get("name") or "", maxsplit=1)[0]
    given = (first.split() or [""])[0].upper()
    for found in re.finditer(r"\b([A-Z][A-Z'’-]{2,})\b", first):
        if found.group(1) != given and found.group(1) not in {"THE", "AND", "INC", "LLC", "USA"}:
            return found.group(1)
    return ""


# Captions. The Caselaw Access Project's short names sometimes drop a nation's name ("Tribe v. Connecticut") or a
# surname ("Charles E. v. United States"), CourtListener's short names are sometimes a surname alone ("Brewer"),
# and some of its full names are in capitals. case_title rebuilds those from the full caption.
ORGANIZATION = re.compile(
    r"\b(?:Inc|LLC|L\.L\.C|Corp|Corporation|Co|Company|Ltd|LLP|Tribes?|Nation|Band|Indians?|Community|Village|Pueblo|Rancheria|"
    r"County|City|State|States|Town|Department|Dep't|Dept|Bureau|Board|Commission|Authority|Agency|Services?|Office|Bank|"
    r"University|College|School|District|Council|Association|Ass'n|Church|Hospital|Center|Trust|Fund|Group|Holdings|Partners|"
    r"Enterprises?|Casino|Club|Union|Federation|Society|Foundation|Institute|Committee|Project|Coalition|Republic|Government|"
    r"Court|Secretary|Administration|Corps|America|Reservation|Railroad|Railway|Insurance|Industries|Systems|Oil|Gas|Energy|"
    r"Mining|Power|Electric|Water|Land|Farms?|Ranch|Estate|Heirs|Doe|Roe|Incorporated|Limited|Trustees?|Plan|Program|Facility|"
    r"Police|Sheriff|Clinic|Health|Housing|Development|Management|Solutions|Finance|Credit|Lending|Financial|Capital|River|"
    r"Irrigation|Lake|Creek|Valley|Mountain|Springs|Ditch|Canal|Partnership|Against|Friends|Citizens|Concerned|Alliance|"
    r"Defense|Network|Save|Protect|Advocates|Defenders|Action|Watch|Keepers|Neighbors|Residents|Voters|Taxpayers|People)\b", re.I)
HONORIFIC = re.compile(r"^(?:Hon\.|Honorable|Rev\.|Reverend|Dr\.|Sgt\.|Lt\.|Capt\.|Officer|Deputy|Sheriff|Warden|Judge|Mr\.|Ms\.|Mrs\.)\s+")
PERSON_WORD = re.compile(r"^(?:[A-Z][A-Za-z'’-]+|(?:[A-Z]\.)+|[A-Z]|Mc[A-Z][a-z]+|de|De|La|Le|Van|van|von|Von|del|Del)$")
SUFFIX = re.compile(r"^(?:Jr|Sr|II|III|IV)\.?$")
SMALL_WORDS = {"a", "an", "and", "as", "at", "by", "de", "del", "ex", "for", "in", "of", "on", "or", "rel.", "the", "to", "v.", "vs.", "re"}
KEEP_CAPITALS = {"LLC", "LLP", "USA", "BIA", "IHS", "EPA", "NLRB", "FBI", "FDIC", "II", "III", "IV", "PLLC", "NA", "TK"}
GENERIC_LEAD = re.compile(r"^(Tribes?|Nation|Band|Indians|Community|Village)\b")


def tidy_capitals(text: str) -> str:
    """A caption printed in capitals, in title case ("WALTON v. UPROVA CREDIT LLC" to "Walton v. Uprova Credit LLC")."""
    def word(token: str, first: bool) -> str:
        bare = token.strip(",.;:()")
        if bare in KEEP_CAPITALS or re.fullmatch(r"(?:[A-Z]\.){2,}", bare) or any(ch.isdigit() for ch in token):
            return token
        if token.lower() in SMALL_WORDS and not first:
            return token.lower()
        if bare.upper() == "INC":
            return token.replace(bare, "Inc")
        return "-".join(part[:1].upper() + (part[1:2].upper() + part[2:].lower() if part[1:2] in ("'", "’") else part[1:].lower()) for part in token.split("-"))
    return " ".join(word(token, index == 0) for index, token in enumerate(text.split()))


def shouting(text: str) -> bool:
    letters = [ch for ch in text if ch.isalpha()]
    return len(letters) > 6 and sum(ch.isupper() for ch in letters) / len(letters) > 0.8


def is_person(side: str) -> bool:
    tokens = [token.strip(",") for token in side.split()]
    return (2 <= len(tokens) <= 5 and not ORGANIZATION.search(side)
            and all(PERSON_WORD.match(token) or SUFFIX.match(token) for token in tokens)
            and not re.fullmatch(r"(?:[A-Z]\.?)+", [token for token in tokens if not SUFFIX.match(token)][-1]))


def short_side(side: str) -> str:
    """One party of a full caption as a short caption gives it: the first party named, a person by surname alone."""
    side = re.split(r";|,? (?:et al\b\.?|in (?:his|her|their|its) (?:official |individual )?capacit|individually\b|on behalf of\b|a/k/a\b|"
                    r"aka\b|d/b/a\b|as (?:next friend|guardian|trustee|personal representative|administrat|executor|parent)|"
                    r"a (?:political|federally|municipal|corporation|sovereign))", side.strip(), maxsplit=1, flags=re.I)[0]
    side = re.split(r",\s+(?!(?:Inc|Incorporated|LLC|L\.L\.C|Ltd|Co|Corp|N\.A|P\.C|LLP|PLLC|L\.P|Jr|Sr|II|III)\b)", side.strip(" ,"), maxsplit=1)[0]
    side = re.sub(r"\s*[“\"][^”\"]+[”\"]", "", side)  # a nickname in quotation marks
    pieces = re.split(r"\s+and\s+", side)
    if len(pieces) == 2 and (is_person(pieces[0]) or is_person(pieces[1]) or re.match(r"(?:the )?(?:State|City|County|Town|Commonwealth|United States)\b", pieces[1])):
        side = pieces[0]
    side = re.sub(r"\bUnited States of America\b|^U\.?S\.?A\.?$", "United States", side.strip(" ,"))
    side = re.sub(r"^(?:The|the) ", "", HONORIFIC.sub("", side))
    side = re.sub(r"^(?:State|Commonwealth) of (?=[A-Z][a-z]+(?: [A-Z][a-z]+)?$)", "", side)  # Bluebook rule 10.2.1(f)
    if is_person(side):
        return [token.strip(",") for token in side.split() if not SUFFIX.match(token.strip(","))][-1]
    return side


def case_title(case: dict) -> str:
    """The caption a record gives a case: the short caption, rebuilt from the full one where the short one lost words."""
    docket_notes = re.compile(r"\s*\((?:DO NOT FILE|ALL FILINGS)[^)]*\)?|\s+(?:LEAD )?DOCKET IN THIS CASE ONLY\b.*$")  # a clerk's filing notes
    def clean(name: str) -> str:
        name = " ".join((name or "").split())
        return docket_notes.sub("", name).rstrip(" .") if docket_notes.search(name) else name
    short, full = clean(case.get("name_abbreviation")), clean(case.get("name"))
    title = short or full
    versus = re.compile(r"\s+v\.?\s+", re.I)
    if full and versus.search(full) and not versus.search(short) and not re.match(r"(?:In re|Ex parte|Matter of|In the Matter)\b", short, re.I):
        title = " v. ".join(short_side(side) for side in versus.split(full, maxsplit=1))
    elif full and (lead := GENERIC_LEAD.match(short)):
        first = re.split(r",|\s+v\.?\s+", full, maxsplit=1)[0].strip()
        if first.lower().endswith(lead.group(1).lower()) and len(first.split()) > 1:
            first = re.sub(r"^(?:The|the) ", "", tidy_capitals(first) if shouting(first) else
                           " ".join(tidy_capitals(token) if token.isupper() and len(token) > 3 and token not in KEEP_CAPITALS else token for token in first.split()))
            title = first + short[len(lead.group(1)):]
    elif full and (person := re.match(r"^([A-Z][a-z]+ [A-Z]\.)( v\. .*)$", short)) and caption_surname(case):
        title = caption_surname(case).title() + person.group(2)
    if shouting(title):
        title = tidy_capitals(title)
        if versus.search(title) and not re.match(r"(?:In re|Ex parte|Matter of|In the Matter)\b", title, re.I):
            title = " v. ".join(short_side(side) for side in versus.split(title, maxsplit=1))
    return title


# Court names. The Caselaw Access Project files some District of Columbia district court opinions under the court
# of appeals and spells a few courts more than one way; CourtListener's divisions are left out.
COURT_SPELLINGS = {
    "United States Court of Appeals for the Six Circuit": "United States Court of Appeals for the Sixth Circuit",
    "United States District Court for the Central District of South Dakota": "United States District Court for the District of South Dakota",
    "United States District Court for the District of the Virgin Islands": "District Court of the Virgin Islands",
}


def court_title(name: str, reporter: str = "", year: int = 0) -> str:
    """One spelling for each court, and the court a reporter's series shows for the District of Columbia's opinions."""
    name = " ".join((name or "").split())
    if found := re.match(r"^United States District Court, D\. ([A-Z][A-Za-z. ]+?)(?:, [A-Z][a-z]+ Division)?$", name):
        name = f"United States District Court for the District of {found.group(1)}"
    name = COURT_SPELLINGS.get(name, name)
    if name == "United States Court of Appeals for the District of Columbia" and (year >= 1948 or reporter.startswith("F. Supp")):
        name = "United States Court of Appeals for the District of Columbia Circuit"  # its name from 1948
    if reporter.startswith("F. Supp") and name == "United States Court of Appeals for the District of Columbia Circuit":
        name = "United States District Court for the District of Columbia"
    if reporter in ("F.2d", "F.3d", "F.4th", "F. App'x") and year > 1933 and name == "United States District Court for the District of Columbia":
        name = "United States Court of Appeals for the District of Columbia Circuit"
    return name


# A word every nation shares is not a nation's name ("Arapahoe & Shoshone Tribes" once linked the Confederated Salish
# and Kootenai Tribes through "Tribes" alone).
GENERIC_NATION_NAMES = {"tribe", "tribes", "nation", "nations", "band", "bands", "indian", "indians", "dakota", "community", "village", "tribal"}


def specific_names(named: list[dict]) -> list[dict]:
    return [entry for entry in named if entry["named_as"].strip().lower() not in GENERIC_NATION_NAMES]


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
    first = 1
    if args.unread:
        # Only cases no reader has answered yet (candidates added later, such as CourtListener's), in new batches after the last.
        answered = {answer["id"] for path in out.glob("out-*.json") for answer in json.loads(path.read_text())}
        rows = [row for row in rows if row["id"] not in answered]
        first = 1 + max((int(path.stem.split("-")[1]) for path in out.glob("in-*.json")), default=0)
    items = []
    for row in rows:
        case = json.loads((work / "cases" / row["reporter"] / row["volume"] / row["file"]).read_text())
        items.append({"id": row["id"], "name": row["name"], "court": row["court"], "date": row["date"],
                      "excerpts": snippets(case_text(case), args.snippets, args.width)})
    items.sort(key=lambda item: item["id"])  # mixes scores and reporters, so each batch is like the others
    size = -(-len(items) // args.batches)
    for index in range(args.batches):
        part = items[index * size:(index + 1) * size]
        (out / f"in-{first + index}.json").write_text(json.dumps(part, indent=0, ensure_ascii=False))
    print(f"{len(items)} cases to read in batches {first} to {first + args.batches - 1}")


# A Native nation or Native organization named as a party, for cases a reader did not keep.
NATIVE_PARTY = re.compile(r"\b(?:Tribes?|Band|Nation|Pueblo|Rancheria|Indian Community|Native Village|Native Association|Indian Health Board|Tribal)\b")


def select(args: argparse.Namespace) -> None:
    """Write --work/selected.json from the scores and the readers' answers (reading/out-N.json), and the readings, without case names, to the data folder."""
    work = Path(args.work)
    readings = {}
    for path in sorted((work / "reading").glob("out-*.json")):
        for answer in json.loads(path.read_text()):
            readings[answer["id"]] = answer
    # The spot checks of cases kept by score (reading/check-out.json, and check-<name>-out.json for later
    # sets): a case judged not Indian law is left out, unless the caption names a Native nation as a party.
    rejected = {answer["id"] for path in (work / "reading").glob("check*out.json")
                for answer in json.loads(path.read_text()) if answer.get("indian_law") is False}
    selected, missing = [], 0
    for row in candidates(work):
        if row["score"] >= args.auto and not only_native(row):
            if row["id"] not in rejected:
                selected.append({"id": row["id"], "how": "score"})
            elif NATIVE_PARTY.search(row["name"] or ""):
                selected.append({"id": row["id"], "how": "caption"})
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
# release: held cases a read check cleared. Trevor chose "read-check, then release" for the held federal
# opinions on Nov. 27, 2026; two AI readings of each full text found no child or protected person named.
RELEASED = "2026-11-27"
RELEASE_NOTE = ("It was held at first for a privacy review because its text uses words about children or protected persons; "
                "two readings of the full opinion on Nov. 27, 2026 found no child or protected person named, so it is shown.")
RELEASE_CHECK = {"check": "Privacy: no child or protected person named in the opinion", "result": "agree",
                 "detail": "two AI readings of the full text, Nov. 27, 2026; released from the privacy hold"}
# The CourtListener opinions released through GovInfo's copies were read in passages: every passage of the court's
# filing around a word about children, minors, victims, custody or abuse, by two or three readers.
GOVINFO_RELEASE_NOTE = ("It was held at first for a privacy review because its text uses words about children or protected persons; "
                        "readings on Nov. 27, 2026 of every passage of the court's filing about children, victims or custody found no child or protected person named, so it is shown.")
# The CourtListener opinions whose text is in CourtListener's bulk files (scripts/caselaw/courtlistener_federal_opinions.py),
# read again on Nov. 27, 2026 in the passages around words about children, custody, victims or wards.
BULK_RELEASE_NOTE = ("It was held at first for a privacy review because its text uses words about children or protected persons; "
                     "a reading on Nov. 27, 2026 of the passages of CourtListener's text around those words found no child or protected person named, so it is shown.")
BULK_RELEASE_CHECK = {"check": "Privacy: no child or protected person named in the opinion", "result": "agree",
                      "detail": "an AI reading of the passages about children, victims or custody in CourtListener's text, Nov. 27, 2026; released from the privacy hold"}
GOVINFO_RELEASE_CHECK = {"check": "Privacy: no child or protected person named in the opinion", "result": "agree",
                         "detail": "two or three AI readings of every passage about children, victims or custody in GovInfo's copy, Nov. 27, 2026; released from the privacy hold"}
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


def opinions_html(fragment: str) -> list[str]:
    """The court's opinions from the Project's HTML of a case: each <article class="opinion">, without the head matter and layout data."""
    articles = re.findall(r"<article class=\"opinion\"[^>]*>.*?</article>", fragment, re.S)
    articles = [re.sub(r"\s+data-(?:blocks|firstpage|lastpage|case-id)=(?:'[^']*'|\"[^\"]*\")", "", article) for article in articles]
    # The publisher's key numbers ("[1]") point to its headnotes, which are left out, so they go too (as in the JSON text).
    return [re.sub(r"\s*<a class=\"bracketnum\"[^>]*>.*?</a>\s*", " ", article, flags=re.S) for article in articles]


def opinion_page(case: dict, key: str, link: str, fragment: str | None = None, links=None, courtlistener: bool = False) -> bytes:
    """The court's opinions only (no head matter, where the publishers' headnotes and synopses are), as one page.

    With the Project's HTML of the case (fragment), the opinions keep its page numbers, footnotes and citations, and with
    links (copy_links.CitationLinks) the citations link to this site's pages or to case.law. Without it, the opinions are
    built from the JSON text, as plain paragraphs (as CourtListener's opinions always are; courtlistener credits it)."""
    import html  # noqa: PLC0415
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from tribal_court_opinions import PAGE_STYLE  # noqa: PLC0415
    name = case.get("name_abbreviation") or case.get("name") or "Opinion"
    citations = ", ".join(c["cite"] for c in case.get("citations", []) if c.get("cite"))
    court = (case.get("court") or {}).get("name", "")
    date = case.get("decision_date", "")
    removal = f"/copies/view/{key}#request=remove&record=copies/{key}"
    parts = opinions_html(fragment) if fragment else []
    if parts and links is not None:
        parts = [links.rewrite(part, key) for part in parts]
    if not parts:
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
        f"<a class=\"external\" href=\"{html.escape(link)}\" target=\"_blank\" rel=\"noopener\">Original</a>. <a href=\"{html.escape(removal)}\" target=\"_top\">Ask to remove it</a>.</p>\n"
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
        # The notes are read for a record with no citation of its own; a record that has one may name other cases there
        # (an IBIA decision's notes give the court cases that reviewed it).
        notes = "" if citation.get("volume") and citation.get("page") else str(record.get("notes") or "")
        for match in re.finditer(r"\b(\d+) ((?:[A-Z][A-Za-z.]*\s?){1,4}(?:\dd|2d|3d|4th)?) (\d+)\b", (citation.get("title") or "") + " " + notes):
            cites.add(" ".join(match.group(0).split()))
        if (record.get("courtlistener") or {}).get("citation"):
            cites.add(record["courtlistener"]["citation"])
    return keys, cites, ours


def privacy_reviews(private: Path) -> dict[str, str]:
    """Readers' privacy choices by case id ("hold" or "show"), kept outside git with the held list (privacy-reviews.json)."""
    path = private / "privacy-reviews.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


REPORTER_RANK = ["F.", "F.2d", "F.3d", "F.4th", "F. Supp.", "F. Supp. 2d", "F. Supp. 3d", "F. App'x", "Ct. Cl.", "Cl. Ct.", "Fed. Cl."]


def shingles(text: str, size: int = 8) -> set[int]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    every = (hash(" ".join(words[at:at + size])) for at in range(0, max(1, len(words) - size + 1)))
    return {value for value in every if value % 4 == 0}  # a quarter of them, the same quarter in both texts


def same_text(one: set[int], other: set[int]) -> bool:
    return bool(one and other) and len(one & other) / min(len(one), len(other)) >= 0.75


def parallel_reports(rows: list[dict], work: Path) -> dict:
    """Cases that are one opinion: the same caption, date and court and nearly the same text, as when the Court of
    Claims' opinions are printed in both the Court of Claims Reports and the Federal Reporter, or CourtListener has a
    filing twice. The record keeps the Federal Reporter's (or the first) copy and lists every citation."""
    def load(row: dict) -> dict:
        return json.loads((work / "cases" / row["reporter"] / row["volume"] / row["file"]).read_text())

    def reporter(case: dict) -> str:
        found = parse_cite(((case.get("citations") or [{}])[0] or {}).get("cite") or "")
        return found[1] if found else ""

    groups: dict[tuple, list[dict]] = {}
    for row in rows:
        groups.setdefault(((row["name"] or "").lower(), row["date"], row["court"]), []).append(row)
    duplicates, citations = set(), {}
    for group in (group for group in groups.values() if len(group) > 1):
        cases = {row["id"]: load(row) for row in group}
        order = sorted(group, key=lambda row: (REPORTER_RANK.index(reporter(cases[row["id"]])) if reporter(cases[row["id"]]) in REPORTER_RANK else len(REPORTER_RANK), str(row["id"])))
        texts = {row["id"]: shingles(case_text(cases[row["id"]])) for row in order}
        for at, keeper in enumerate(order):
            if keeper["id"] in duplicates:
                continue
            for other in order[at + 1:]:
                # Two opinions in the same reporter (an opinion and its amended version) stay two records.
                one, two = reporter(cases[keeper["id"]]), reporter(cases[other["id"]])
                parallel = one != two or "courtlistener" in (keeper["reporter"], other["reporter"])
                if other["id"] not in duplicates and parallel and same_text(texts[keeper["id"]], texts[other["id"]]):
                    duplicates.add(other["id"])
                    citations.setdefault(keeper["id"], []).extend(c.get("cite") for c in cases[other["id"]].get("citations", []) if c.get("cite"))
    return {"duplicates": duplicates, "citations": citations}


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
    # release: cases a read check cleared of a privacy hold, added to the records an earlier run wrote.
    cleared: set = getattr(args, "cleared", set())
    adding = bool(cleared)
    today = RELEASED if adding else TODAY
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from supreme_court_native_cases import Nations  # noqa: PLC0415
    nations = Nations()
    sys.path.insert(0, str(ROOT / "scripts" / "law"))
    from nation_names import NationNames  # noqa: PLC0415
    names = NationNames()
    keys, cites, ours = existing_citations("" if adding else session)
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
    written, skipped, held, released_count, public_rows, private_rows = 0, 0, 0, 0, [], []
    pages = []
    reviews = privacy_reviews(Path(args.private))
    also = parallel_reports(rows, work)  # one opinion printed in two reporters, or filed twice: one record, both citations
    if args.file:
        from copy_links import CitationLinks  # noqa: PLC0415
        citation_links = CitationLinks()
    for row in rows:
        if row["id"] in also["duplicates"]:
            continue
        case = json.loads((work / "cases" / row["reporter"] / row["volume"] / row["file"]).read_text())
        cite_list = [c.get("cite") for c in case.get("citations", []) if c.get("cite")]
        cite_list += [cite for cite in also["citations"].get(row["id"], []) if cite not in cite_list]
        court_name = (case.get("court") or {}).get("name") or row["court"] or ""
        if any(" ".join(cite.split()) in cites for cite in cite_list) or court_name == "Supreme Court of the United States":
            skipped += 1  # held already; every Supreme Court Native case has its own record
            continue
        reason = sensitivity(case)
        if reason == "estate" and (args.show_estates or (args.estates_from and int((row["date"] or "0")[:4] or 0) < args.estates_from)):
            reason = ""  # an older estate: shown, per the choice recorded in decision record 0060
        if reviews.get(str(row["id"])) == "hold":
            reason = "child or protected person"  # a reader found a child or protected person (privacy-reviews.json)
        elif reviews.get(str(row["id"])) == "show" and reason == "child or protected person":
            reason = ""  # a reader found none, though the text uses words about children
        choice = selected[row["id"]]
        released = row["id"] in cleared  # held by the first run; a text read again elsewhere may score differently
        if released:
            reason = ""
        if reason:
            held += 1
            private_rows.append({"id": row["id"], "name": case.get("name_abbreviation"), "citation": "; ".join(cite_list),
                                 "court": row["court"], "date": row["date"], "reason": reason, "link": source_link(row)})
            continue
        year = (row["date"] or "0000")[:4]
        base = f"{slug(case_title(case) or 'case')}-{year}"
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
        named = specific_names(named)
        if federal:
            # The tier 2 scripts' shared matcher (scripts/law/nation_names.py) also knows each nation's other names and the Gaming Commission's.
            for nation, named_as in names.named(case.get("name_abbreviation") or case.get("name") or ""):
                if nation not in {n["nation"] for n in named} and named_as.strip().lower() not in GENERIC_NATION_NAMES:
                    named.append({"nation": nation, "named_as": named_as, "role": "party",
                                  "note": "Matched by the script to a name the nation record gives; not yet checked."})
                    not_linked = [n for n in not_linked if named_as.lower() not in n["named_as"].lower() and n["named_as"].lower() not in named_as.lower()]
        date_parts = [int(part) for part in (row["date"] or year).split("-") if part]
        link = source_link(row)
        citation = {"type": "legal_case", "title": case_title(case),
                    "authority": court_title((case.get("court") or {}).get("name"), first[1] if first else "", int(year or 0))}
        if first:
            citation.update({"container-title": first[1], "volume": first[0], "page": first[2]})
        citation.update({"issued": {"date-parts": [date_parts]}, "URL": link, "accessed": {"date-parts": [[int(part) for part in today.split("-")]]}})
        how = {"score": f"an Indian law term score of {row['score']}, at or above {args.auto}, the level kept without a reading",
               "reader": f"an Indian law term score of {row['score']}; an AI reader read excerpts and judged it an Indian law case ({choice.get('topic', '')})",
               "caption": f"an Indian law term score of {row['score']} and a Native nation or Native organization named as a party"}[choice["how"]]
        if row.get("pdf"):
            # Released through GovInfo: the first run scored and read CourtListener's text, which this run does not have.
            how = {"score": f"an Indian law term score in CourtListener's text at or above {args.auto}, the level kept without a reading",
                   "reader": f"an AI reader's judgment of excerpts of CourtListener's text that it is an Indian law case ({choice.get('topic', '')})"}[choice["how"]]
        record = {
            "key": key,
            "kind": "territorial-case" if territorial else "state-case",
            "citation": citation,
            "original_link": link,
            "retrieved": today,
            "archives": [],
            "history": {"status": "live", "last_checked": today},
            "rights": {"status": "no-permission-needed", "basis": "government-edict", "basis_note": RIGHTS_NOTE, "redistribution": True},
            **({"tribes": [n["nation"] for n in named]} if named else {}),
            "nations_in_case": {"checked": today, "named": named, **({"not_linked": not_linked} if not_linked else {})},
            "jurisdictions": [{"level": "territory" if territorial else "state", **({"state": STATES[jurisdiction]} if jurisdiction in STATES else {})}],
            "topics": [TOPIC],
            "found_in": [session],
            "notes": ((f"Published at {'; '.join(cite_list)}. " if cite_list else f"Docket {case.get('docket_number') or 'number not given'}; no reporter citation yet. ")
                      + f"Decided by the {citation['authority']}" + (f" on {readable(row['date'])}" if row["date"] else "")
                      + (". Found by scripts/caselaw/courtlistener_federal_opinions.py and scripts/caselaw/state_court_opinions.py in CourtListener's bulk files" if from_courtlistener(row)
                         else ". Found by scripts/caselaw/state_court_opinions.py in the Caselaw Access Project's volumes") + f", with {how}."
                      + (" " + (GOVINFO_RELEASE_NOTE if row.get("pdf") else BULK_RELEASE_NOTE if row.get("bulk") else RELEASE_NOTE) if released else "")
                      + (f" Its copy is the court's own filing, from GovInfo's United States Courts Opinions ({row['granule']}); CourtListener's page is {row['courtlistener']}." if row.get("pdf") else "")),
            "review": {"status": "unverified", "by": "scripts/caselaw/state_court_opinions.py", "date": today, "checks": [
                {"check": "Indian law case: the term score and, below the score kept without a reading, an AI reader's judgment of excerpts",
                 "result": "agree", "detail": ("in CourtListener's text" if row.get("pdf") else f"score {row['score']}") + (f"; reader: {choice.get('topic', '')}" if choice["how"] == "reader" else "; kept because a party is a Native nation or organization" if choice["how"] == "caption" else "")},
                {"check": "Nations named in the caption, matched to nation records by name", "result": "agree" if not not_linked else "missing",
                 "detail": f"{len(named)} matched, {len(not_linked)} not linked"}]
                + ([GOVINFO_RELEASE_CHECK if row.get("pdf") else BULK_RELEASE_CHECK if row.get("bulk") else RELEASE_CHECK] if released else [])},
        }
        if record["jurisdictions"][0]["level"] == "territory":
            record["jurisdictions"][0] = {"level": "other", "note": "Indian Territory" if "Indian Territory" in court_name else jurisdiction or "Territorial court"}
        if federal or FEDERAL_COURT.search(court_name):
            record.update(kind="federal-case", jurisdictions=[{"level": "federal"}], topics=[FEDERAL_TOPIC])
        path = SOURCES / (key[0] if "a" <= key[0] <= "z" else "_other") / f"{key}.yaml"
        path.parent.mkdir(exist_ok=True)  # no record had begun with x before
        path.write_text(dump(record), encoding="utf-8")
        rewritten.add(path)
        written += 1
        released_count += released
        public_rows.append({"key": key, "citation": "; ".join(cite_list), "court": row["court"], "date": row["date"], "score": row["score"], "how": choice["how"]})
        if args.file and row.get("pdf"):
            # A CourtListener opinion released through GovInfo: its copy is the court's own filing.
            pages.append((f"{FEDERAL_CAPTURE_TOPIC}/govinfo/{Path(row['pdf']).name}", Path(row["pdf"]).read_bytes(), record, row))
        elif args.file:
            capture = copy_key(row, FEDERAL_CAPTURE_TOPIC if federal else CAPTURE_TOPIC)
            # State copies keep the Project's HTML (page numbers, footnotes, citation links); the federal set's are still
            # built from the JSON text, as CourtListener's always are.
            fragment = None if federal or from_courtlistener(row) else get(link).decode("utf-8")
            page = opinion_page(case, capture, link, fragment, citation_links, courtlistener=from_courtlistener(row))
            pages.append((capture, page, record, row))
    stale = {path.stem for path in ours.values() if path not in rewritten}
    for path in ([] if adding else ours.values()):
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
            media = "application/pdf" if row.get("pdf") else "text/html"
            if not (existing and existing["sha256"] == digest):
                with tempfile.NamedTemporaryFile(suffix=".pdf" if row.get("pdf") else ".html") as handle:
                    handle.write(data)
                    handle.flush()
                    s3.upload_file(handle.name, bucket, capture, ExtraArgs={"ContentType": media + ("" if row.get("pdf") else "; charset=utf-8"), "Metadata": {"sha256": digest, "captured": today}})
                if mirror_captures.remote_state(s3, bucket, capture) != (len(data), digest):
                    raise SystemExit(f"verification failed for {capture}")
            new = {field: "" for field in mirror_captures.FIELDS}
            topic = FEDERAL_CAPTURE_TOPIC if record["kind"] == "federal-case" else CAPTURE_TOPIC
            obtained = (f"downloaded from GovInfo, United States Courts Opinions, {today}" if row.get("pdf") else
                        f"built from {'CourtListener' if from_courtlistener(row) else 'the Caselaw Access Project'}'s files, {today}")
            new.update(key=capture, bytes=len(data), sha256=digest, media_type=media, topic=topic,
                       title=record["citation"]["title"], nations=";".join(record.get("tribes", [])),
                       obtained=obtained, link=row.get("pdf_link") or record["original_link"], captured=today,
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
    private = Path(args.private)
    private.mkdir(parents=True, exist_ok=True)
    if adding:
        # The earlier run's lists, less what this run settles: its new records join records.csv, and the
        # cases it released leave the private list, which keeps every case still held.
        with open(data / "records.csv", newline="", encoding="utf-8") as handle:
            earlier = [row for row in csv.DictReader(handle) if row["key"] not in {r["key"] for r in public_rows}]
        public_rows = earlier + public_rows
        with open(private / "held-for-privacy-review.csv", newline="", encoding="utf-8") as handle:
            still = list(csv.DictReader(handle))
        released_ids = {str(row["id"]) for row in rows if row["id"] in cleared} - {str(r["id"]) for r in private_rows}
        private_rows = [r for r in still if r["id"] not in released_ids and r["id"] not in {str(p["id"]) for p in private_rows}] + private_rows
        before = json.loads((data / "summary.json").read_text(encoding="utf-8"))
        written = before["written"] + written
        skipped = before["already_held"]
        held = len(private_rows)
    with open(data / "records.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, ["key", "citation", "court", "date", "score", "how"])
        writer.writeheader()
        writer.writerows(public_rows)
    summary = {"written": written, "already_held": skipped, "held_for_privacy_review": held,
               "held_by_reason": {reason: sum(1 for r in private_rows if r["reason"] == reason) for reason in sorted({r["reason"] for r in private_rows})}}
    if adding:
        summary["released_after_read_check"] = before.get("released_after_read_check", 0) + released_count
    (data / "summary.json").write_text(json.dumps(summary, indent=1) + "\n", encoding="utf-8")
    with open(private / "held-for-privacy-review.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, ["id", "name", "citation", "court", "date", "reason", "link"])
        writer.writeheader()
        writer.writerows(private_rows)
    print(summary)


def release(args: argparse.Namespace) -> None:
    """Fetch the cleared cases into --work in write's layout, with the score and choice an earlier run gave them, then write them."""
    import csv  # noqa: PLC0415
    work = Path(args.work)
    data = FEDERAL_DATA if args.courts == "federal" else DATA
    with open(args.cleared, newline="", encoding="utf-8") as handle:
        cleared = [row for row in csv.DictReader(handle) if row["decision"] == "release"]
    readings = {answer["id"]: answer for answer in json.loads((data / "readings.json").read_text(encoding="utf-8"))}
    # CourtListener opinions: the text and copy come from GovInfo (--govinfo, a JSON map of id to package,
    # granule, docket and the downloaded PDF and its text), since CourtListener's text needs a token.
    govinfo = json.loads(Path(args.govinfo).read_text(encoding="utf-8")) if args.govinfo else {}
    # Or from the bulk files' text that the first run read (--earlier, that run's candidates.jsonl, beside its cases folder).
    earlier = {}
    if args.earlier:
        earlier = {str(json.loads(line)["id"]): json.loads(line) for line in open(args.earlier, encoding="utf-8")}
    cleared = [row for row in cleared if not row["id"].startswith("cl-") or row["id"] in govinfo or row["id"] in earlier]
    found = re.compile(re.escape(STATIC) + r"/([^/]+)/(\d+)/html/([^/]+)\.html$")

    def scored(case: dict) -> dict:
        body = case.get("casebody") or {}
        text = (body.get("head_matter") or "") + "\n" + "\n".join((opinion.get("text") or "") for opinion in body.get("opinions", []))
        return {key: len(pattern.findall(text)) for key, pattern in MARKERS.items()}  # as scripts/caselaw/federal_indian_law_cases.py scored it

    def from_govinfo(row: dict) -> tuple[dict, dict]:
        found_at = govinfo[row["id"]]
        case = {"id": row["id"], "name": row["name"], "name_abbreviation": row["name"],
                "citations": [{"cite": cite} for cite in row["citation"].split("; ") if cite], "court": {"name": row["court"]},
                "decision_date": row["date"], "docket_number": found_at["docket"],
                "casebody": {"opinions": [{"text": Path(found_at["text"]).read_text(encoding="utf-8", errors="replace")}]}}
        hits = scored(case)
        path = work / "cases" / "courtlistener" / "govinfo" / f"{found_at['granule']}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(case), encoding="utf-8")
        return case, {"reporter": "courtlistener", "volume": "govinfo", "file": path.name, "id": row["id"], "name": row["name"],
                      "date": row["date"], "court": row["court"], "jurisdiction": "", "citations": [c["cite"] for c in case["citations"]],
                      "score": sum(hits.values()), "hits": hits, "link": f"https://www.govinfo.gov/app/details/{found_at['package']}/{found_at['granule']}",
                      "pdf": found_at["pdf"], "pdf_link": f"https://www.govinfo.gov/content/pkg/{found_at['package']}/pdf/{found_at['granule']}.pdf",
                      "granule": found_at["granule"], "courtlistener": row["link"]}

    def from_bulk_files(row: dict) -> tuple[dict, dict]:
        first = dict(earlier[row["id"]], bulk=True)
        source = Path(args.earlier).parent / "cases" / first["reporter"] / first["volume"] / first["file"]
        path = work / "cases" / first["reporter"] / first["volume"] / first["file"]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(source.read_bytes())
        return json.loads(source.read_text(encoding="utf-8")), first

    def fetch(row: dict) -> tuple[dict, dict]:
        if row["id"].startswith("cl-"):
            return from_govinfo(row) if row["id"] in govinfo else from_bulk_files(row)
        match = found.match(row["link"])
        if not match:
            raise SystemExit(f"not a Caselaw Access Project link: {row['id']}")
        reporter, volume, name = match.groups()
        path = work / "cases" / reporter / volume / f"{name}.json"
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(get(f"{STATIC}/{reporter}/{volume}/cases/{name}.json"))
        case = json.loads(path.read_text(encoding="utf-8"))
        if str(case.get("id")) != row["id"]:
            raise SystemExit(f"case {row['id']} is not at its link")
        hits = scored(case)
        return case, {"reporter": reporter, "volume": volume, "file": f"{name}.json", "id": case["id"], "name": case.get("name_abbreviation"),
                      "date": case.get("decision_date") or "", "court": (case.get("court") or {}).get("name"),
                      "jurisdiction": (case.get("jurisdiction") or {}).get("name"),
                      "citations": [c.get("cite") for c in case.get("citations") or []], "score": sum(hits.values()), "hits": hits}

    with cf.ThreadPoolExecutor(8) as pool:
        laid_out = list(pool.map(fetch, cleared))
    selected = []
    for case, row in laid_out:
        # How select chose it: the score, else a reader's answer, else a Native party in the caption. A CourtListener
        # opinion's score here is from GovInfo's text, so its reader's answer, or else the score kept, is what chose it.
        answer = readings.get(row["id"]) or {}
        if row.get("pdf"):
            selected.append({"id": row["id"], "how": "reader", "topic": answer.get("topic", "")} if answer.get("indian_law") is True else {"id": row["id"], "how": "score"})
        elif row["score"] >= args.auto and not only_native(row):
            selected.append({"id": row["id"], "how": "score"})
        elif answer.get("indian_law") is True:
            selected.append({"id": row["id"], "how": "reader", "topic": answer.get("topic", "")})
        elif NATIVE_PARTY.search(row["name"] or ""):
            selected.append({"id": row["id"], "how": "caption"})
        else:
            raise SystemExit(f"case {row['id']} has no way it was chosen")
    with open(work / "candidates.jsonl", "w", encoding="utf-8") as out:
        for _, row in laid_out:
            out.write(json.dumps(row) + "\n")
    (work / "selected.json").write_text(json.dumps(selected, indent=1))
    print(len(selected), "cleared cases laid out", {how: sum(1 for row in selected if row["how"] == how) for how in ("score", "reader", "caption")})
    args.cleared = {row["id"] for _, row in laid_out}
    write(args)


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
    p.add_argument("--unread", action="store_true", help="only cases with no reader's answer yet, in new batches numbered after the last")
    p = sub.add_parser("select")
    p.add_argument("--work", required=True)
    p.add_argument("--auto", type=int, default=10)
    p.add_argument("--read-from", type=int, default=KEEP_FULL)
    p = sub.add_parser("write")
    p.add_argument("--work", required=True)
    p.add_argument("--auto", type=int, default=10)
    p.add_argument("--private", required=True, help="folder outside git for the list of held cases, which names people")
    p.add_argument("--show-estates", action="store_true", help="show every estate case (Trevor, Nov. 26, 2026); only child and protected-person cases are held")
    p.add_argument("--estates-from", type=int, default=0, help="hold estate cases decided in this year or later (0: hold every estate case)")
    p.add_argument("--file", action="store_true", help="also file each opinion page in the bucket and the capture index")
    p = sub.add_parser("release")
    p.add_argument("--cleared", required=True, help="private CSV outside git (columns id, link, decision) of held cases a read check cleared")
    p.add_argument("--earlier", help="the first run's candidates.jsonl, for CourtListener cases whose bulk-file text is in its cases folder")
    p.add_argument("--govinfo", help="JSON map of CourtListener ids to their GovInfo package, granule, docket, PDF and text (outside git)")
    p.add_argument("--work", required=True)
    p.add_argument("--auto", type=int, default=10)
    p.add_argument("--private", required=True, help="folder outside git with the list of held cases, which names people")
    p.add_argument("--show-estates", action="store_true")
    p.add_argument("--estates-from", type=int, default=0)
    p.add_argument("--file", action="store_true", help="also file each opinion page in the bucket and the capture index")
    args = parser.parse_args()
    {"scan": scan, "excerpts": excerpts, "select": select, "write": write, "release": release}[args.command](args)


if __name__ == "__main__":
    main()
