#!/usr/bin/env python3
"""Find, for each federally recognized Native nation, the earliest federal
document that dealt with it as a nation (Trevor, Nov. 27, 2026: nation pages
said "This site has not yet found the document by which the United States
first recognized this nation"; "Can we work to get those documents?").

Most nations' pages cite only the Bureau of Indian Affairs list of Jan. 30,
2026. scripts/tribes/recognition_basis.py already cites the Act of Congress,
final determination or administrative decision for 58 of them. This script
gathers, for every federal nation, the candidates the project already holds
and the Federal Register lists back to the first one in 1979:

- the earliest ratified treaty linked to the nation on its profile
  (`treaties`, linked by name and not yet checked against a second source);
- the earliest instrument that first set aside its land (`land_establishment`:
  executive orders, statutes, agreements, treaties);
- a constitution approved by the Secretary of the Interior under the Indian
  Reorganization Act of 1934, the Oklahoma Indian Welfare Act of 1936 or the
  Alaska amendment of 1936 (`government_structure`, with the approval or
  adoption date from the nation's constitution history where one is held);
- the earliest Federal Register list of recognized tribes that names the
  nation, found by matching its names back through the 40 lists from 1979
  (`appearances`, below), with every uncertain match checked by a reviewer.

None of these is asserted as the act that first recognized the nation. The
`candidates` step writes a review table (research/reviews/first-recognition/
candidates.csv) with the earliest-dated candidate and the reasons it needs a
person's check.

Steps, from the repository root:

  python3 scripts/tribes/first_recognition.py fetch --work DIR
      Downloads the stored copy of every list (the site's /copies route) and
      extracts its text with pdftotext.
  python3 scripts/tribes/first_recognition.py appearances --work DIR
      Matches each federal nation back through the lists. Writes
      research/raw/2026-11-27/recognition-list-appearances.json and the
      packets a reviewer reads for every uncertain match (DIR/packets.json).
  python3 scripts/tribes/first_recognition.py candidates
      Writes the review table, using the reviewers' answers in
      research/reviews/first-recognition/list-appearance-reviews.json.
  python3 scripts/tribes/first_recognition.py profiles --work DIR
      Adds to each nation without its own recognition basis the earliest of
      these candidates as a federal recognition fact marked `earliest_record`
      (Trevor, Nov. 27, 2026: "the first instance that it shows they were
      federally recognized"). A treaty counts only as linked on the profile, a
      constitution only once the Secretary of the Interior approved it, and a
      list entry gets its page from the list's text (DIR, from `fetch`).
"""
from __future__ import annotations

import argparse
import csv
import difflib
import json
import re
import subprocess
import sys
import unicodedata
import urllib.request
from functools import lru_cache
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
TRIBES = ROOT / "content" / "tribes"
SOURCES = ROOT / "content" / "sources"
DOCUMENTS = ROOT / "content" / "documents"
APPEARANCES = ROOT / "research/raw/2026-11-27/recognition-list-appearances.json"
REVIEWS = ROOT / "research/reviews/first-recognition"
LIST_SOURCE = "bia-recognized-entities-2026"
SITE = "https://triballawproject.org/copies/"

STATES = ("Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Idaho|Illinois|Indiana|Iowa|"
          "Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|"
          "New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|"
          "South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming")
STATE_WORDS = {state.lower().split()[-1] for state in STATES.split("|")} - {"island"}
# Words that say what kind of body a name is, not which one: set aside when comparing names.
GENERIC = set("the of and & tribe tribes tribal band bands indian indians nation nations community communities reservation "
              "reservations rancheria colony pueblo village native inc incorporated confederated federated mission previously "
              "listed as formerly known aka also".split()) | {word.lower() for state in STATES.split("|") for word in state.split()}
# Common misreadings in the scanned lists before 1995.
OCR = {"porno": "pomo", "wintum": "wintun", "reserva": "reservation", "ervation": "reservation"}
# Misread words mapped to the nations' own spellings ("Aqua-Caliente" to Agua, "Bums" to Burns); filled by
# `appearances` from the names the profiles hold.
CANON: dict[str, str] = {}
# A line that carries on the entry above it in a list's text.
CONTINUES = re.compile(rf"^(?:[a-z(]|(?:{STATES})\b|(?:Reservation|Reserva|Rancheria|Ranchería|Indians|Colony|Division|Reservations|ervation)\b)")


# ---------------------------------------------------------------- the lists

def list_records() -> list[dict]:
    """Every Federal Register list's source record, oldest first (corrections left out)."""
    found = []
    for path in sorted((SOURCES / "b").glob("bia-recognized-entities-*.yaml")):
        record = yaml.safe_load(path.read_text())
        if "correction" in record["key"]:
            continue
        year, month, day = record["citation"]["issued"]["date-parts"][0]
        record["_date"] = f"{year}-{month:02d}-{day:02d}"
        found.append(record)
    return sorted(found, key=lambda record: record["_date"])


def fetch(work: Path) -> None:
    work.mkdir(parents=True, exist_ok=True)
    for record in list_records():
        pdf = work / f"{record['key']}.pdf"
        if not pdf.exists():
            storage = record.get("file", {}).get("storage_key")
            if not storage:
                raise SystemExit(f"{record['key']}: no stored copy")
            request = urllib.request.Request(SITE + storage, headers={"User-Agent": "tribal-law-project-scripts"})
            pdf.write_bytes(urllib.request.urlopen(request, timeout=120).read())
        subprocess.run(["pdftotext", str(pdf), str(work / f"{record['key']}.txt")], check=True)
        print(record["key"], pdf.stat().st_size)


def entries(path: Path) -> list[str]:
    """A list's entries, one per string, from pdftotext's reading-order text. Joins the lines of an
    entry that wraps; entries the scan runs together on one line stay together (matching allows it)."""
    out: list[str] = []
    current = ""
    for line in (raw.strip() for raw in path.read_text(encoding="utf-8", errors="replace").split("\n")):
        if not line:
            continue
        carries = current and (current.endswith("­") or (current.endswith("-") and not current.endswith(" -"))
                               or re.search(r"\b(of|the|and|&|de|du|in)$|[,(—–]$", current) or CONTINUES.match(line))
        if carries:
            if current.endswith("­"):
                current = current[:-1] + line
            elif current.endswith("-") and re.match(r"[a-z]", line):
                current = current[:-1] + line
            else:
                current += " " + line
        else:
            if current:
                out.append(current)
            current = line
    if current:
        out.append(current)
    return out


@lru_cache(None)
def words(text: str) -> tuple[tuple[str, bool], ...]:
    """The words of a name or entry, each marked True when it is generic."""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower().replace("'", "")
    text = re.sub(r"\bo f\b", "of", text)
    text = re.sub(r"alabama[\s\-]+(coushatta|quassarte)", r"alabama\1", text)
    found = [CANON.get(word, OCR.get(word, word)) for word in re.findall(r"[a-z0-9]+", text)]
    return tuple((word, word in GENERIC or len(word) < 2) for word in found)


@lru_cache(None)
def distinctive(text: str) -> frozenset[str]:
    return frozenset(word for word, generic in words(text) if not generic)


def score(name: str, entry: str) -> tuple[float, float]:
    """How well an entry names the nation: the share of the name's distinctive words it holds (recall), and
    the share of the distinctive words around them that belong to the name (precision). "Crow Tribe" against
    "Crow Creek Sioux Tribe" has recall 1 and precision 1/3. A name with a state is not matched to an entry
    that gives another state right after it ("Ponca Tribe of Nebraska" against "Ponca Tribe of Oklahoma")."""
    wanted = distinctive(name)
    sequence = words(entry)
    if not wanted:
        return 0.0, 0.0
    positions = [i for i, (word, generic) in enumerate(sequence) if not generic and word in wanted]
    if not positions:
        return 0.0, 0.0
    present = {sequence[i][0] for i in positions}
    best = None
    for start in positions:
        missing = set(present)
        for end in (p for p in positions if p >= start):
            missing.discard(sequence[end][0])
            if not missing:
                break
        if not missing and (best is None or end - start < best[1] - best[0]):
            best = (start, end)
    start, end = best
    while start > 0 and not sequence[start - 1][1]:
        start -= 1
    while end < len(sequence) - 1 and not sequence[end + 1][1]:
        end += 1
    window = {word for word, generic in sequence[start:end + 1] if not generic}
    own_state = STATE_WORDS & {word for word, _ in words(name)}
    following = STATE_WORDS & {word for word, _ in sequence[end + 1:end + 8]}
    if own_state and following and not own_state & following:
        return 0.0, 0.0
    return len(present) / len(wanted), len(present) / len(window)


def good(recall: float, precision: float) -> bool:
    return (recall >= 0.99 and precision >= 0.66) or (recall >= 0.66 and precision >= 0.8)


def best_entry(names: list[str], listed: list[str]) -> tuple[float, float, str | None]:
    best: tuple[float, float, str | None] = (0.0, 0.0, None)
    for entry in listed:
        for name in names:
            recall, precision = score(name, entry)
            if (recall, precision) > best[:2]:
                best = (recall, precision, entry)
    return best


def federal_nations() -> list[dict]:
    found = []
    for path in sorted(TRIBES.glob("*/*.yaml")):
        record = yaml.safe_load(path.read_text())
        if any(fact.get("source") == LIST_SOURCE for fact in record.get("recognition") or []):
            found.append(record)
    return found


def names_of(record: dict) -> list[str]:
    names = record["names"]
    return [names["official"]] + [entry.get("name") if isinstance(entry, dict) else entry for entry in names.get("former") or []]


def appearances(work: Path) -> None:
    """Walks each nation back from the 2026 list. On each older list it takes the entry that best matches
    any name it has had so far (an entry's "previously listed as" names count), and the earliest list is
    the oldest one matched while at least three in five of the lists from there to 2026 also match. Every
    nation not plainly on the 1979 list goes to a reviewer (packets.json)."""
    records = list_records()
    keys = [record["key"] for record in records]
    dates = {record["key"]: record["_date"] for record in records}
    listed = {key: entries(work / f"{key}.txt") for key in keys}
    nations = federal_nations()
    vocabulary = {word for nation in nations for name in names_of(nation) for word in re.findall(r"[a-z0-9]+", unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower().replace("'", ""))}
    seen = {word for key in keys for entry in listed[key] for word in re.findall(r"[a-z0-9]+", unicodedata.normalize("NFKD", entry).encode("ascii", "ignore").decode().lower().replace("'", ""))}
    for word in seen - vocabulary - GENERIC:
        if len(word) >= 4 and not word.isdigit():
            close = difflib.get_close_matches(word, vocabulary, n=1, cutoff=0.8)
            if close and len(close[0]) >= 4:
                CANON[word] = close[0]
    words.cache_clear()
    distinctive.cache_clear()
    result, packets = {}, []
    for nation in nations:
        names = names_of(nation)
        trail = []
        for key in reversed(keys[:-1]):
            recall, precision, entry = best_entry(names, listed[key])
            matched = good(recall, precision)
            trail.append({"list": key, "recall": round(recall, 2), "precision": round(precision, 2), "entry": entry if matched else None})
            if matched:
                for name in [re.sub(r"\(.*?\)", "", entry)] + re.findall(r"\(([^)]*)\)", entry):
                    name = re.sub(r"^(previously listed as|formerly known as|formerly|aka|also known as)\s*", "", name.strip(), flags=re.I)
                    if distinctive(name) and name not in names:
                        names.append(name)
        hits = [step["entry"] is not None for step in trail]
        earliest = keys[-1]
        for i, hit in enumerate(hits):
            if hit and sum(hits[:i + 1]) / (i + 1) >= 0.6:
                earliest = trail[i]["list"]
        first = next(step for step in trail if step["list"] == keys[0])
        plain = earliest == keys[0] and first["recall"] == 1 and first["precision"] == 1
        result[nation["id"]] = {
            "earliest_list": earliest,
            "date": dates[earliest],
            "entry": next((step["entry"] for step in trail if step["list"] == earliest), None),
            "method": "script" if plain else "script, reviewed",
            "lists_matched": sum(hits) + 1,
        }
        if not plain:
            at = keys.index(earliest)
            shown = []
            for key in keys[:min(at + 2, len(keys))]:
                ranked = sorted(((score(name, entry), entry) for entry in listed[key] for name in names[:4]), reverse=True)
                top: list[str] = []
                for _, entry in ranked:
                    if entry not in top:
                        top.append(entry)
                    if len(top) == 3:
                        break
                shown.append({"list": key, "date": dates[key], "top_entries": [entry[:300] for entry in top]})
            packets.append({"nation": nation["id"], "current_name": names[0], "other_names": names[1:], "computed_earliest": earliest, "lists": shown})
    APPEARANCES.parent.mkdir(parents=True, exist_ok=True)
    APPEARANCES.write_text(json.dumps({"generated": "2026-11-27", "lists": keys, "nations": result}, indent=1, ensure_ascii=False) + "\n")
    (work / "packets.json").write_text(json.dumps(packets, indent=1, ensure_ascii=False))
    print(f"{len(result)} nations; {len(packets)} sent for review")


# ----------------------------------------------------------- other records

def treaty_records() -> dict[str, dict]:
    """Treaty source records by their Statutes at Large citation ("7 Stat. 18")."""
    found = {}
    for path in sorted((SOURCES / "t").glob("treaty-*.yaml")):
        record = yaml.safe_load(path.read_text())
        link = record.get("original_link") or ""
        match = re.search(r"statute/(\d+)/(\d+)", link) or re.search(r"(\d+) Stat\. (\d+)", record["citation"].get("container-title", "") + " " + record["citation"]["title"])
        if match:
            found.setdefault(f"{match.group(1)} Stat. {match.group(2)}", record)
    return found


def treaty_parties() -> dict[str, int]:
    """How many nations' profiles link each treaty (by citation)."""
    counts: dict[str, int] = {}
    for path in TRIBES.glob("*/*.yaml"):
        for treaty in yaml.safe_load(path.read_text()).get("treaties") or []:
            counts[treaty["statutes_at_large"]] = counts.get(treaty["statutes_at_large"], 0) + 1
    return counts


def constitution_date(nation: str, version: str | None) -> tuple[str | None, str | None]:
    """The approval (else adoption) date of a version of the nation's constitution, or of its earliest dated version."""
    path = DOCUMENTS / (nation[0] if nation[0].isalpha() else "_other") / f"{nation}-constitution.yaml"
    if not path.exists():
        return None, None
    history = yaml.safe_load(path.read_text())
    versions = history.get("versions") or []
    if version:
        versions = [entry for entry in versions if entry.get("id") == version] or versions
    dated = []
    for entry in versions:
        dates = entry.get("dates") or {}
        when = dates.get("approved") or dates.get("adopted") or dates.get("ratified")
        if when:
            dated.append((str(when), entry.get("label")))
    return min(dated) if dated else (None, None)


def constitution_title(nation: str) -> str | None:
    path = DOCUMENTS / (nation[0] if nation[0].isalpha() else "_other") / f"{nation}-constitution.yaml"
    return yaml.safe_load(path.read_text()).get("title") if path.exists() else None


ORGANIZING_ACTS = {
    "indian-reorganization-act": "Indian Reorganization Act, ch. 576, § 16, 48 Stat. 984, 987 (1934)",
    "oklahoma-indian-welfare-act": "Oklahoma Indian Welfare Act, ch. 831, § 3, 49 Stat. 1967, 1967 (1936)",
    "alaska-indian-reorganization-act": "Act of May 1, 1936, ch. 254, § 1, 49 Stat. 1250, 1250",
}
LIST_KINDS = {"list": "Earliest Federal Register list naming the nation"}


def nation_state(nation: dict) -> str:
    return next((s["state"] for s in nation.get("states") or [] if s.get("presence") == "government-office"), "")


def candidates() -> None:
    sys.path.insert(0, str(ROOT / "scripts/tribes"))
    import recognition_basis  # the nations whose own basis is already cited

    covered = (set(recognition_basis.LEGISLATED) | set(recognition_basis.DETERMINED) | set(recognition_basis.ADMINISTRATIVE)
               | set(recognition_basis.JUDGED))
    data = json.loads(APPEARANCES.read_text())
    reviews_path = REVIEWS / "list-appearance-reviews.json"
    reviews = {row["nation"]: row for row in json.loads(reviews_path.read_text())} if reviews_path.exists() else {}
    audit_path = REVIEWS / "list-appearance-audit.json"  # second review of the list-only rows
    audit = {row["nation"]: row for row in json.loads(audit_path.read_text())} if audit_path.exists() else {}
    lists = {record["key"]: record for record in list_records()}
    treaties = treaty_records()
    parties = treaty_parties()
    rows = []
    for nation in federal_nations():
        nid = nation["id"]
        row = {"nation": nid, "name": nation["names"]["official"],
               "state": next((s["state"] for s in nation.get("states") or [] if s.get("presence") == "government-office"), ""),
               "own_basis_cited": "yes" if nid in covered else "no"}
        found = []  # (date, kind, citation, source, review reasons)
        # Treaties
        linked = sorted(nation.get("treaties") or [], key=lambda treaty: treaty["signed"])
        if linked:
            first = linked[0]
            record = treaties.get(first["statutes_at_large"])
            reasons = ["treaty linked to the nation by name, not yet checked against a second source"]
            if parties.get(first["statutes_at_large"], 0) > 1:
                reasons.append(f"{parties[first['statutes_at_large']]} nations' profiles link this treaty")
            if first.get("confidence") == "low":
                reasons.append("the link is marked low confidence")
            title = record["citation"]["title"] if record else first["title"]
            citation = title if "Stat." in title else f"{title}, {first['statutes_at_large']}"
            row.update(treaty=citation, treaty_date=first["signed"], treaty_record=record["key"] if record else "",
                       treaty_party=first.get("signatory", ""), treaty_links=parties.get(first["statutes_at_large"], 0))
            found.append((first["signed"], "treaty", citation, record["key"] if record else first["source"], reasons))
        # Land first set aside
        land = sorted((entry for entry in nation.get("land_establishment") or [] if entry.get("date") and entry.get("detail") == "First set aside"),
                      key=lambda entry: str(entry["date"]))
        if land:
            first = land[0]
            reasons = []
            if first.get("verification") != "read-in-full":
                reasons.append("instrument not read in full")
            if re.search(r"does not name|not .* by name", first.get("note", "")):
                reasons.append("the instrument does not name the nation itself")
            row.update(land=first["instrument"], land_date=str(first["date"]), land_method=first.get("method", ""), land_source=first.get("source", ""))
            found.append((str(first["date"]), f"land: {first.get('method')}", first["instrument"], first.get("source", ""), reasons))
        # Constitution approved under the organizing acts
        for entry in nation.get("government_structure") or []:
            if entry.get("kind") not in ORGANIZING_ACTS:
                continue
            version = (entry.get("document_version") or {}).get("version")
            when, label = constitution_date(nid, version)
            if not when and re.search(r"approved (\d{4})", entry.get("detail", "")):
                when = re.search(r"approved (\d{4})", entry["detail"]).group(1)
            reasons = ["date read from the constitution's text by rule" if when else "no approval date held"]
            row.update(organized=entry["kind"], organized_date=when or "", organized_source=entry.get("source", ""))
            if when:
                title = constitution_title(nid) or f"Constitution of the {nation['names']['official']}"
                found.append((when, f"organized: {entry['kind']}", f"{title} ({label or when}), adopted under {ORGANIZING_ACTS[entry['kind']]}", entry.get("source", ""), reasons))
            break
        # Earliest list
        appearance = data["nations"].get(nid)
        if appearance:
            key, entry, method = appearance["earliest_list"], appearance["entry"], appearance["method"]
            review = reviews.get(nid)
            reasons = []
            if review:
                if review.get("earliest_list") and review["earliest_list"] != key:
                    reasons.append(f"script said {key}; reviewer said {review['earliest_list']}")
                    key = review["earliest_list"]
                if review.get("earliest_list") == key and review.get("entry"):
                    entry = review["entry"]
                if review.get("confidence") != "high":
                    reasons.append(f"reviewer confidence {review.get('confidence')}")
            elif method != "script":
                reasons.append("match not yet reviewed")
            second = audit.get(nid)
            if second and second.get("earliest_list") != key:
                settled = review and review.get("reviewed_by", "").startswith("Claude (AI assistant), by searching")
                if not settled:
                    reasons.append(f"a second reviewer, shown at most five lines per list, said {second.get('earliest_list') or 'no list'}")
            if entry and re.search(r"\b(Inc\.?|Corporation|Native Association)\b", entry):
                reasons.append("the entry names an Alaska Native corporation or association, not the tribal government")
            if key == "bia-recognized-entities-1988" and nation_state(nation) == "AK":
                # 58 Fed. Reg. 54364, 54365 (1993): the 1988 Alaska list added ANCSA corporations, which are not governments.
                reasons.append("first named on the 1988 Alaska list, which also listed Alaska Native Claims Settlement Act corporations")
            record = lists[key]
            row.update(earliest_list=key, earliest_list_date=record["_date"], earliest_list_entry=entry or "", earliest_list_reasons="; ".join(reasons))
            notes = record.get("notes", "")
            cite = re.search(r"Indigo Book citation: (.*?\([A-Z][a-z]+\.? \d{1,2}, \d{4}\))", notes)
            found.append((record["_date"], "list", cite.group(1) if cite else record["citation"]["title"], key, reasons))
        found.sort(key=lambda item: item[0])
        if found:
            date, kind, citation, source, reasons = found[0]
            row.update(proposed_date=date, proposed_kind=kind, proposed_citation=citation, proposed_source=source,
                       review_reasons="; ".join(reasons) or "none")
        rows.append(row)
    fields = ["nation", "name", "state", "own_basis_cited", "proposed_date", "proposed_kind", "proposed_citation", "proposed_source",
              "review_reasons", "treaty", "treaty_date", "treaty_record", "treaty_party", "treaty_links", "land", "land_date", "land_method",
              "land_source", "organized", "organized_date", "organized_source", "earliest_list", "earliest_list_date",
              "earliest_list_entry", "earliest_list_reasons"]
    REVIEWS.mkdir(parents=True, exist_ok=True)
    with (REVIEWS / "candidates.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    kinds: dict[str, int] = {}
    for row in rows:
        if row["own_basis_cited"] == "no":
            kind = row.get("proposed_kind", "none").split(":")[0]
            kinds[kind] = kinds.get(kind, 0) + 1
    print(f"{len(rows)} federal nations; of those without their own basis cited, earliest candidate by kind: {kinds}")


# Trevor (Nov. 27, 2026), on what a nation page should cite: "the first instance that it shows they were
# federally recognized. a relationshipp is expected to have begun prior to that anyways". So each nation
# without its own recognition basis gets one fact: the earliest document the project holds that shows the
# United States dealing with it as a recognized nation, labeled by kind (`earliest_record`).
EARLIEST = ("The earliest record this site has found that shows the United States dealing with the nation as a "
            "federally recognized nation. The relationship may be older.")
ALASKA_1988 = ("The 1988 list also named Alaska Native Claims Settlement Act corporations, which are not tribal "
               "governments (58 Fed. Reg. 54364, 54365 (Oct. 21, 1993)).")


def plain_letters(text: str) -> str:
    folded = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]", "", folded)


@lru_cache(None)
def list_pages(work: Path, key: str) -> list[str]:
    return [plain_letters(page) for page in (work / f"{key}.txt").read_text(encoding="utf-8", errors="replace").split("\f")]


def list_page(work: Path, key: str, first_page: int, entry: str) -> int | None:
    """The Federal Register page that prints the entry: the stored copy starts at the list's first page."""
    wanted = plain_letters(entry)[:30]
    if len(wanted) >= 8:
        for index, page in enumerate(list_pages(work, key)):
            if wanted in page:
                return first_page + index
    # A short entry, such as "Council" on the 1988 Alaska list: the page with a line that is the entry.
    pages = (work / f"{key}.txt").read_text(encoding="utf-8", errors="replace").split("\f")
    for index, page in enumerate(pages):
        if any(plain_letters(line) == plain_letters(entry) for line in page.split("\n")):
            return first_page + index
    return None


def recognition_basis_months() -> list[str]:
    import recognition_basis
    return recognition_basis.MONTHS


def secretarial_approval(nation: str) -> tuple[dict, dict] | None:
    """The earliest version of the nation's constitution that the Secretary of the Interior approved."""
    path = DOCUMENTS / (nation[0] if nation[0].isalpha() else "_other") / f"{nation}-constitution.yaml"
    if not path.exists():
        return None
    history = yaml.safe_load(path.read_text())
    approved = [version for version in history.get("versions") or []
                if (version.get("dates") or {}).get("approved")
                and (version.get("approval") or {}).get("authority") == "secretary-of-the-interior"]
    if not approved:
        return None
    return history, min(approved, key=lambda version: str(version["dates"]["approved"]))


def earliest_facts(nation: dict, row: dict, reviews: dict, lists: dict, treaties: dict, parties: dict,
                   work: Path, written_date) -> list[dict]:
    """Every candidate fact for one nation, each dated; the caller keeps the earliest."""
    nid = nation["id"]
    found = []
    linked = sorted(nation.get("treaties") or [], key=lambda treaty: treaty["signed"])
    if linked:
        link = linked[0]
        record = treaties.get(link["statutes_at_large"])
        title = record["citation"]["title"] if record else link["title"]
        citation = title if "Stat." in title else f"{title}, {link['statutes_at_large']}"
        shared = parties.get(link["statutes_at_large"], 0)
        note = (f"{EARLIEST} The treaty names the {link.get('signatory') or 'party'}; the nation's profile links it to the "
                "treaty by name, and the link has not yet been checked against a second source.")
        if shared > 1:
            note += f" {shared} nations' profiles link this treaty."
        found.append({"type": "federal", "earliest_record": "treaty", "legal_basis": citation, "since": link["signed"],
                      "source": record["key"] if record else link["source"],
                      "confidence": "low" if link.get("confidence") == "low" else "medium", "verification": "inferred",
                      "as_of": link["signed"], "locator": link.get("locator") or link["statutes_at_large"], "note": note})
    land = sorted((entry for entry in nation.get("land_establishment") or []
                   if entry.get("date") and entry.get("detail") == "First set aside"
                   and not re.search(r"does not name|not .* by name", entry.get("note", ""))),
                  key=lambda entry: str(entry["date"]))
    if land:
        entry = land[0]
        found.append({"type": "federal", "earliest_record": "land", "legal_basis": entry["instrument"], "since": str(entry["date"]),
                      "source": entry["source"], "confidence": entry.get("confidence", "medium"),
                      "verification": entry.get("verification", "inferred"), "as_of": str(entry["date"]),
                      "locator": entry.get("locator") or entry["instrument"],
                      "note": f"{EARLIEST} The instrument first set aside the {entry.get('land_area') or 'nation’s land'}."})
    approval = secretarial_approval(nid)
    if approval:
        history, version = approval
        when = str(version["dates"]["approved"])
        kind = next((entry["kind"] for entry in nation.get("government_structure") or [] if entry.get("kind") in ORGANIZING_ACTS), None)
        parts = when.split("-")
        written = (written_date(when) if len(parts) == 3
                   else f"in {recognition_basis_months()[int(parts[1]) - 1]} {parts[0]}" if len(parts) == 2 else f"in {when}")
        citation = f"{history['title']} (approved by the Secretary of the Interior {written})"
        if kind:
            citation += f", under the {ORGANIZING_ACTS[kind]}"
        how = "read from the approval certificate" if version.get("verification") == "read-in-full" else "read by rule from the approval certificate"
        found.append({"type": "federal", "earliest_record": "constitution", "legal_basis": citation, "since": when,
                      "source": version["source"], "document_version": {"document": history["id"], "version": version["id"]},
                      "confidence": version.get("confidence", "medium"),
                      "verification": version.get("verification", "inferred"), "as_of": when,
                      "locator": f"{version.get('label') or version['id']}, {(version.get('approval') or {}).get('locator', 'approval')}",
                      "note": f"{EARLIEST} The Secretary of the Interior approved the nation's constitution; the date is {how}."})
    key = row.get("earliest_list")
    if key and key != LIST_SOURCE:
        record = lists[key]
        entry = row.get("earliest_list_entry", "")
        cite = re.search(r"Indigo Book citation: (.*?\([A-Z][a-z]+\.? \d{1,2}, \d{4}\))", record.get("notes", ""))
        citation = cite.group(1) if cite else record["citation"]["title"]
        volume, first = re.search(r"(\d+) Fed\. Reg\. ([\d,]+) \(", citation).groups()
        first_page = int(first.replace(",", ""))
        page = list_page(work, key, first_page, entry)
        pin = f"{first_page}, {page}" if page and page != first_page else f"{first_page}, {first_page}" if page else f"{first_page}"
        citation = citation.replace(f"Fed. Reg. {first} (", f"Fed. Reg. {pin} (")
        review = reviews.get(nid) or {}
        reasons = row.get("earliest_list_reasons", "")
        settled = not reasons
        corporation = bool(re.search(r"\b(Inc\.?|Corporation|Native Association)\b", entry))
        note = f"{EARLIEST} The list's entry reads \"{entry.rstrip('.')}.\" The entry is matched to the nation by name." if entry else EARLIEST
        if key == "bia-recognized-entities-1988" and nation_state(nation) == "AK":
            note += " " + ALASKA_1988
        found.append({"type": "federal", "earliest_record": "federal-list", "legal_basis": citation, "since": record["_date"],
                      "source": key, "confidence": "low" if corporation or review.get("confidence") == "low" else "medium",
                      "verification": "bulk-import" if settled else "inferred", "as_of": record["_date"],
                      "locator": f"{volume} Fed. Reg. {page}" + (f" (entry \"{entry}\")" if entry else "") if page else f"{volume} Fed. Reg. {first_page}",
                      "note": note})
    return found


def profiles(work: Path) -> None:
    """Adds each nation's earliest record of federal recognition to its profile (`earliest_record`)."""
    sys.path.insert(0, str(ROOT / "scripts/tribes"))
    import recognition_basis

    covered = (set(recognition_basis.LEGISLATED) | set(recognition_basis.DETERMINED) | set(recognition_basis.ADMINISTRATIVE)
               | set(recognition_basis.JUDGED))
    rows = {row["nation"]: row for row in csv.DictReader((REVIEWS / "candidates.csv").open())}
    reviews_path = REVIEWS / "list-appearance-reviews.json"
    reviews = {row["nation"]: row for row in json.loads(reviews_path.read_text())}
    lists = {record["key"]: record for record in list_records()}
    treaties = treaty_records()
    parties = treaty_parties()
    kinds: dict[str, int] = {}
    unverified = changed = 0
    for nation in federal_nations():
        nid = nation["id"]
        path = recognition_basis.profile_path(nid)
        recognition = [dict(fact) for fact in nation["recognition"] if "earliest_record" not in fact]
        if nid not in covered:
            found = earliest_facts(nation, rows.get(nid, {}), reviews, lists, treaties, parties, work, recognition_basis.written_date)
            if found:
                fact = min(found, key=lambda fact: fact["since"])
                index = next(i for i, existing in enumerate(recognition) if existing.get("source") == LIST_SOURCE) + 1
                recognition.insert(index, fact)
                kinds[fact["earliest_record"]] = kinds.get(fact["earliest_record"], 0) + 1
                unverified += fact["verification"] == "inferred"
        if recognition != nation["recognition"]:
            changed += recognition_basis.replace_recognition(path, recognition)
    print(f"earliest records by kind: {kinds}; {unverified} rest on an inferred match; {changed} profiles changed")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("step", choices=["fetch", "appearances", "candidates", "profiles"])
    parser.add_argument("--work", type=Path)
    args = parser.parse_args()
    if args.step in ("fetch", "appearances", "profiles") and not args.work:
        parser.error("--work is required")
    {"fetch": lambda: fetch(args.work), "appearances": lambda: appearances(args.work), "candidates": candidates,
     "profiles": lambda: profiles(args.work)}[args.step]()


if __name__ == "__main__":
    main()
