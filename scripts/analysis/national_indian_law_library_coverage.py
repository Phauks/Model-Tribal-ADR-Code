"""Measure how much of the National Indian Law Library (NILL) the project covers.

NILL is the Native American Rights Fund's law library. Its terms say it "will
deny requests that appear to be frequent or systematic", so this script never
fetches NILL pages itself. A person saves a handful of NILL's public index pages
(listed below) into one folder, and the script reads them from there:

    triballaw_index.html             https://narf.org/nill/triballaw/index.html
    tribal_<year>.html, tribal_pre2016.html
                                     https://narf.org/nill/bulletins/tribal/<year>.html
    sct_<term>update.html            https://narf.org/nill/bulletins/sct/<term>update.html

It then compares them with what the repository already holds: nation profiles
(content/tribes/), source records for the NILL pages earlier threads read
(content/sources/), the tribal law crawl index (research/tribal-law/
documents.json), the governing documents index (research/constitutions/
documents.csv), the Caselaw Access Project opinions index (research/
tribal-court-opinions/opinions.csv) and the Supreme Court list (research/
supreme-court-coverage/native-cases-scdb.csv).

Outputs (facts only: names, places, dates, citations; no NILL text):
    research/nill-coverage/gateway-nations.csv  one row per Tribal Law Gateway entry
    research/nill-coverage/tribal-bulletin.csv  one row per Tribal Courts Bulletin case
    research/nill-coverage/supreme-court-bulletin.csv  one row per decided case in the Supreme Court Bulletin
    research/nill-coverage/counts.json          the totals the research note quotes

Run from the repository root:
    python3 scripts/analysis/national_indian_law_library_coverage.py <folder of saved NILL pages>
"""

import collections
import csv
import glob
import html
import json
import pathlib
import re
import sys

import yaml

ROOT = pathlib.Path(".")
OUT = ROOT / "research" / "nill-coverage"

# Tribal Courts Bulletin court names that the Caselaw Access Project rules in
# research/tribal-court-opinions/sources.yaml do not already cover. Searched
# anywhere in the court name, ignoring case; first match wins.
EXTRA_COURTS = [
    ("mashantucket", "mashantucket-pequot-indian-tribe"),
    ("muscogee", "the-muscogee-nation"),
    ("sault", "sault-ste-marie-tribe-of-chippewa-indians"),
    ("muckleshoot", "muckleshoot-indian-tribe"),
    ("hoopa", "hoopa-valley-tribe"),
    ("puyallup", "puyallup-tribe-of-the-puyallup-reservation"),
    ("nottawaseppi", "nottawaseppi-huron-band-of-the-potawatomi"),
    ("tohono", "tohono-oodham-nation-of-arizona"),
    ("ho.chunk", "ho-chunk-nation-of-wisconsin"),
    ("oneida", "oneida-nation"),
    ("southern ute", "southern-ute-indian-tribe-of-the-southern-ute-reservation"),
    ("colorado river", "colorado-river-indian-tribes-of-the-colorado-river-indian-reservation"),
    ("quinault", "quinault-indian-nation"),
    ("st\\. ?croix", "st-croix-chippewa-indians-of-wisconsin"),
    ("ak-chin", "ak-chin-indian-community"),
    ("quileute", "quileute-tribe-of-the-quileute-reservation"),
    ("mashpee", "mashpee-wampanoag-tribe"),
    ("comanche", "comanche-nation"),
    ("rincon", "rincon-band-of-luiseno-indians"),
    ("yavapai-apache", "yavapai-apache-nation-of-the-camp-verde-indian-reservation"),
    ("kickapoo tribe in kansas", "kickapoo-tribe-of-indians-of-the-kickapoo-reservation-in-kansas"),
    ("san manuel", "yuhaaviatam-of-san-manuel-nation"),
    ("snoqualmie", "snoqualmie-indian-tribe"),
    ("squaxin", "squaxin-island-tribe-of-the-squaxin-island-reservation"),
    ("skokomish", "skokomish-indian-tribe"),
    ("yurok", "yurok-tribe-of-the-yurok-reservation"),
    ("saginaw", "saginaw-chippewa-indian-tribe-of-michigan"),
    ("sauk-suiattle", "sauk-suiattle-indian-tribe"),
    ("cheyenne.arapaho", "cheyenne-and-arapaho-tribes"),
    ("fort mojave", "fort-mojave-indian-tribe"),
    ("fort berthold", "three-affiliated-tribes-of-the-fort-berthold-reservation"),
    ("^hoh ", "hoh-indian-tribe"),
    ("burns paiute", "burns-paiute-tribe"),
    ("chilkat", "chilkat-indian-village"),
    ("sac and fox", "sac-and-fox-nation"),
    ("grand traverse|chippewa indians tribal (judiciary|court)$", "grand-traverse-band-of-ottawa-and-chippewa-indians"),
    ("mohegan", "mohegan-tribe-of-indians-of-connecticut"),
    ("white earth", "white-earth-band"),
    ("poarch", "poarch-band-of-creek-indians"),
    ("grand ronde", "confederated-tribes-of-the-grand-ronde-community-of-oregon"),
    ("little river", "little-river-band-of-ottawa-indians"),
]

DATE = re.compile(r"^(?:[A-Z][a-z]{2,8}\.?|Sept\.) \d{1,2}, ?\d{4}\.?$")
CASE_NAME = re.compile(r" v\.? | vs\.? |^In re|^In the|Matter of|^Ex parte|^Re:|^Petition", re.I)


def page_lines(path):
    text = path.read_text(encoding="utf-8", errors="replace")
    text = re.sub(r"<script.*?</script>|<style.*?</style>", "", text, flags=re.S)
    text = html.unescape(re.sub(r"<[^>]+>", "\n", text))
    lines = (re.sub(r"\s+", " ", line).strip() for line in text.split("\n"))
    return [line for line in lines if line]


def norm(name):
    name = name.lower().replace("&", "and")
    name = re.sub(r"\(.*?\)", " ", name)
    name = re.sub(r",? (california|oklahoma|montana|washington|wisconsin|michigan|minnesota|nevada|arizona|new mexico|south dakota|north dakota|oregon|idaho|alaska|utah|wyoming|nebraska|kansas|iowa|texas|new york|maine|louisiana|mississippi|north carolina|florida|colorado|wi)$", "", name.strip())
    name = re.sub(r"\b(the|of|tribe|tribes|indians?|band|nation|community|village|native|reservation|rancheria)\b", " ", name)
    return re.sub(r"[^a-z0-9]+", "", name)


def load_profiles():
    profiles = {}
    for path in sorted(glob.glob("content/tribes/*/*.yaml")):
        data = yaml.safe_load(open(path, encoding="utf-8"))
        profiles[data["id"]] = data
    return profiles


def nill_tribe_page_sources():
    """NILL Tribal Law Gateway pages that earlier threads read, by page slug."""
    pages = {}
    for path in glob.glob("content/sources/*/national-indian-law-library*.yaml"):
        data = yaml.safe_load(open(path, encoding="utf-8"))
        link = data.get("original_link") or data["citation"].get("URL", "")
        match = re.search(r"nill/tribes/([^/]+)\.html", link)
        if match:
            pages.setdefault(match.group(1), {"source": data["key"], "nations": set()})
            pages[match.group(1)]["nations"].update(data.get("tribes") or [])
    return pages


def gateway(pages_dir, profiles):
    lines = (pages_dir / "triballaw_index.html").read_text(encoding="utf-8", errors="replace")
    entries = re.findall(r'<li>([^<]*)(?:<a name="[^"]*" id="[^"]*"></a>)?\s*<a href="\.\./tribes/([^"]+)\.html"[^>]*>(.*?)</a>(.*?)</li>', lines, flags=re.S)
    read = nill_tribe_page_sources()
    by_name = collections.defaultdict(set)
    for key, data in profiles.items():
        for value in (data.get("names") or {}).values():
            if isinstance(value, str):
                by_name[norm(value)].add(key)
    rows, seen = [], set()
    for before, slug, name, after in entries:
        name = before.strip().rstrip("-").strip() + " - " + name if before.strip() else name
        name = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", name))).strip()
        status = "state recognized" if "state recognized" in after else "not recognized" if "not recognized" in after else ""
        if slug in seen:
            continue
        seen.add(slug)
        if slug in read:
            nations, how = sorted(read[slug]["nations"]), "source record"
        else:
            nations, how = sorted(by_name.get(norm(name), [])), "name match"
            if not nations:
                how = ""
        rows.append({"slug": slug, "name": name, "status": status, "nations": ";".join(nations),
                     "matched_by": how, "read_by_project": "yes" if slug in read else "no"})
    return rows


def governing_documents(profiles):
    """What each profile holds, split into what came from NILL's listings and the rest."""
    held = {}
    for key, data in profiles.items():
        record = collections.Counter()
        for doc in data.get("governing_documents") or []:
            kind = doc.get("kind")
            from_nill = (doc.get("source") or "").startswith("national-indian-law-library")
            note = doc.get("note") or ""
            record[kind] += 1
            if from_nill:
                record["nill-listed:" + kind] += 1
                if "At NILL website" in note:
                    record["nill-hosted:" + kind] += 1
            if doc.get("verification") == "read-in-full":
                record["read:" + kind] += 1
        held[key] = record
    return held


def nill_copies():
    """Copies the project took from NILL's own pages, by nation."""
    codes = collections.defaultdict(lambda: {"folders": set(), "files": 0, "texts": 0})
    for doc in json.load(open("research/tribal-law/documents.json", encoding="utf-8")):
        url = doc.get("final_url") or doc["url"]
        if doc.get("http_status") == "200" and doc.get("capture"):
            for nation in doc["nations"]:
                codes[nation]["texts"] += 1
        match = re.search(r"narf\.org/nill/codes/([^/]+)/", url)
        if match and doc.get("http_status") == "200":
            for nation in doc["nations"]:
                codes[nation]["folders"].add(match.group(1))
                codes[nation]["files"] += 1
    constitutions, indexed = collections.Counter(), collections.Counter()
    with open("research/constitutions/documents.csv", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            indexed[row["nation"]] += 1
            if "narf.org/nill" in (row.get("link") or ""):
                constitutions[row["nation"]] += 1
    return codes, constitutions, indexed


def tribal_bulletin(pages_dir):
    rows = []
    for path in sorted(pages_dir.glob("tribal_*.html")):
        year = path.stem.split("_", 1)[1]
        if year == "current":
            continue
        lines = page_lines(path)
        seen = set()
        for i, line in enumerate(lines):
            if not DATE.match(line):
                continue
            court = lines[i - 1]
            if not re.search(r"Court|Judiciary|Tribunal|Judicial", court) and re.search(r"Court|Judiciary|Judicial", lines[i - 2]):
                court = lines[i - 2] + " " + court
            if "Last updated" in court or "Next update" in court:
                continue
            name = next((lines[j] for j in range(i - 1, max(i - 8, -1), -1)
                         if CASE_NAME.search(lines[j]) and not re.search(r"Am\. ?Tribal Law|WL \d", lines[j]) and lines[j] != court), "")
            block = lines[max(0, i - 7):i]
            cites = " | ".join(x for x in block if re.search(r"Am\. ?Tribal Law|WL \d|NICS|G\.D\.R\.|Nav\.|Mash\.", x))
            if (name, line) in seen:
                continue
            seen.add((name, line))
            reporter_cite = re.search(r"(\d+) Am\. ?Tribal Law (\d+)", cites)
            topics = next((lines[j + 1] for j in range(i + 1, min(i + 4, len(lines) - 1)) if lines[j].startswith("Legal Topics")), "")
            rows.append({"bulletin_year": year, "name": name, "court": court.rstrip("."), "date": line.rstrip("."),
                         "citations": cites, "american_tribal_law": f"{reporter_cite.group(1)} Am. Tribal Law {reporter_cite.group(2)}" if reporter_cite else "",
                         "topics": topics})
    return rows


def court_nation(court, rules):
    for pattern, nations in rules:
        if re.search(pattern, court, re.I):
            return nations
    return []


def supreme_court_bulletin(pages_dir):
    rows = {}
    for path in sorted(pages_dir.glob("sct_*update.html")):
        term = path.stem[4:-6]
        lines = page_lines(path)
        for i, line in enumerate(lines[1:-1], start=1):
            # A case heading is: name / "NNN U.S. NNN" / "Docket ..."
            # Includes orders (certiorari denied) that the bulletin also
            # gives a U.S. Reports citation.
            match = re.fullmatch(r"\d+ U\.S\. (\d+)", line)
            if match and lines[i + 1].startswith("Docket"):
                name = lines[i - 1]
                if not CASE_NAME.search(name) and i > 1:
                    name = lines[i - 2] + " " + name
                rows.setdefault(line, {"term": term, "name": name, "citation": line})
    return list(rows.values())


def main():
    pages_dir = pathlib.Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    profiles = load_profiles()
    held = governing_documents(profiles)
    codes, constitutions, indexed = nill_copies()

    gateway_rows = gateway(pages_dir, profiles)
    for row in gateway_rows:
        nations = [n for n in row["nations"].split(";") if n]
        totals = collections.Counter()
        for nation in nations:
            totals.update(held.get(nation, {}))
        row.update({
            "profile": "yes" if nations else "no",
            "constitutions_listed": totals["constitution"],
            "codes_listed": totals["law-code"],
            "nill_page_lists_constitution": totals["nill-listed:constitution"] + totals["nill-listed:corporate-charter"] + totals["nill-listed:articles-of-association"],
            "nill_page_lists_code": totals["nill-listed:law-code"],
            "constitutions_read_in_full": totals["read:constitution"],
            "nill_hosted_code_listed": totals["nill-hosted:law-code"],
            "nill_code_files_copied": sum(codes[n]["files"] for n in nations),
            "law_texts_captured": sum(codes[n]["texts"] for n in nations),
            "nill_constitution_copies": sum(constitutions[n] for n in nations),
            "governing_documents_indexed": sum(indexed[n] for n in nations),
        })
    with open(OUT / "gateway-nations.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(gateway_rows[0]))
        writer.writeheader()
        writer.writerows(gateway_rows)

    rules = [(r["court"], r["nations"]) for r in yaml.safe_load(open("research/tribal-court-opinions/sources.yaml"))["courts"]]
    rules = [(p, n) for p, n in rules] + [(p, [n]) for p, n in EXTRA_COURTS]
    opinions = list(csv.DictReader(open("research/tribal-court-opinions/opinions.csv", encoding="utf-8")))
    ours_by_cite = {o["citation"] for o in opinions} | {c.strip() for o in opinions for c in (o["other_citations"] or "").split(";") if c.strip()}
    ours_by_name = {re.sub(r"[^a-z]", "", o["name"].lower())[:30] for o in opinions}
    bulletin_rows = tribal_bulletin(pages_dir)
    for row in bulletin_rows:
        row["nations"] = ";".join(court_nation(row["court"], rules))
        in_cap = (row["american_tribal_law"] and row["american_tribal_law"] in ours_by_cite) or \
            re.sub(r"[^a-z]", "", row["name"].lower())[:30] in ours_by_name
        row["in_caselaw_access_project_index"] = "yes" if in_cap else "no"
    with open(OUT / "tribal-bulletin.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(bulletin_rows[0]))
        writer.writeheader()
        writer.writerows(bulletin_rows)

    def case_key(name):
        parties = re.split(r" v\.? ", name.lower())
        return tuple(re.sub(r"[^a-z]", "", part)[:12] for part in parties[:2])
    native_case_rows = list(csv.DictReader(open("research/supreme-court-coverage/native-cases-scdb.csv", encoding="utf-8")))
    native_cases = {r["citation"]: r for r in native_case_rows if r["citation"]}
    native_case_names = {}
    for r in native_case_rows:
        if int(r["term"] or 0) >= 1996:
            native_case_names.setdefault(case_key(r["case_name"]), r)
    supreme_court_rows = supreme_court_bulletin(pages_dir)
    for row in supreme_court_rows:
        match = native_cases.get(row["citation"]) or native_case_names.get(case_key(row["name"]))
        row["on_native_cases_list"] = "yes" if match else "no"
        row["our_record"] = (match or {}).get("our_record", "")
    with open(OUT / "supreme-court-bulletin.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["term", "name", "citation", "on_native_cases_list", "our_record"])
        writer.writeheader()
        writer.writerows(supreme_court_rows)

    federal = [r for r in gateway_rows if not r["status"]]
    counts = {
        "generated": "2026-11-24",
        "gateway": {
            "entries": len(gateway_rows),
            "federally_recognized_or_unmarked": len(federal),
            "state_recognized": sum(r["status"] == "state recognized" for r in gateway_rows),
            "not_recognized": sum(r["status"] == "not recognized" for r in gateway_rows),
            "read_by_project": sum(r["read_by_project"] == "yes" for r in gateway_rows),
            "matched_to_profile": sum(r["profile"] == "yes" for r in gateway_rows),
            "read_and_page_lists_constitution": sum(r["read_by_project"] == "yes" and r["nill_page_lists_constitution"] > 0 for r in gateway_rows),
            "read_and_page_lists_code": sum(r["read_by_project"] == "yes" and r["nill_page_lists_code"] > 0 for r in gateway_rows),
            "read_and_page_lists_nothing": sum(r["read_by_project"] == "yes" and not r["nill_page_lists_code"] and not r["nill_page_lists_constitution"] for r in gateway_rows),
            "page_lists_constitution_and_we_read_one": sum(r["nill_page_lists_constitution"] > 0 and r["constitutions_read_in_full"] > 0 for r in gateway_rows),
            "page_lists_constitution_and_indexed": sum(r["nill_page_lists_constitution"] > 0 and r["governing_documents_indexed"] > 0 for r in gateway_rows),
            "with_governing_documents_indexed": sum(r["governing_documents_indexed"] > 0 for r in gateway_rows),
            "read_and_page_lists_code_and_law_text_captured": sum(r["read_by_project"] == "yes" and r["nill_page_lists_code"] > 0 and r["law_texts_captured"] > 0 for r in gateway_rows),
            "with_law_text_captured": sum(r["law_texts_captured"] > 0 for r in gateway_rows),
            "page_lists_code_and_we_copied_nill_code": sum(r["nill_page_lists_code"] > 0 and r["nill_code_files_copied"] > 0 for r in gateway_rows),
            "with_constitution_listed_on_profile": sum(r["constitutions_listed"] > 0 for r in gateway_rows),
            "with_code_listed_on_profile": sum(r["codes_listed"] > 0 for r in gateway_rows),
            "with_nill_hosted_code_noted": sum(r["nill_hosted_code_listed"] > 0 for r in gateway_rows),
            "with_nill_code_files_copied": sum(r["nill_code_files_copied"] > 0 for r in gateway_rows),
            "with_nill_constitution_copy": sum(r["nill_constitution_copies"] > 0 for r in gateway_rows),
            "unmatched": [r["name"] for r in gateway_rows if r["profile"] == "no"],
        },
        "nill_copies": {
            "code_folders": len(set().union(*[c["folders"] for c in codes.values()])) if codes else 0,
            "code_files": sum(c["files"] for c in codes.values()),
            "code_nations": sum(1 for c in codes.values() if c["files"]),
            "law_text_nations": sum(1 for c in codes.values() if c["texts"]),
            "constitution_documents": sum(constitutions.values()),
            "constitution_nations": len(constitutions),
        },
        "profiles": {
            "total": len(profiles),
            "with_any_constitution": sum(h["constitution"] > 0 for h in held.values()),
            "with_any_code": sum(h["law-code"] > 0 for h in held.values()),
            "with_constitution_read": sum(h["read:constitution"] > 0 for h in held.values()),
            "with_code_read": sum(h["read:law-code"] > 0 for h in held.values()),
        },
        "tribal_bulletin": {
            "cases": len(bulletin_rows),
            "by_year": dict(sorted(collections.Counter(r["bulletin_year"] for r in bulletin_rows).items())),
            "in_caselaw_access_project_index": sum(r["in_caselaw_access_project_index"] == "yes" for r in bulletin_rows),
            "decided_through_2017": sum(r["date"][-4:] <= "2017" for r in bulletin_rows),
            "decided_through_2017_in_index": sum(r["date"][-4:] <= "2017" and r["in_caselaw_access_project_index"] == "yes" for r in bulletin_rows),
            "with_nation": sum(bool(r["nations"]) for r in bulletin_rows),
            "nations": len({n for r in bulletin_rows for n in r["nations"].split(";") if n}),
            "by_nation": dict(collections.Counter(n for r in bulletin_rows for n in r["nations"].split(";") if n).most_common()),
            "topics": dict(collections.Counter(t.strip().lower() for r in bulletin_rows for t in re.split(r"[;,]", r["topics"]) if t.strip()).most_common(40)),
            "courts_without_nation": sorted({r["court"] for r in bulletin_rows if not r["nations"]}),
            "nations_not_in_caselaw_access_project": sorted({n for r in bulletin_rows for n in r["nations"].split(";") if n}
                                                             - {n for o in opinions for n in (o["nations"] or "").split(";") if n}),
        },
        "supreme_court_bulletin": {
            "cases_with_us_reports_citation": len(supreme_court_rows),
            "on_native_cases_list": sum(r["on_native_cases_list"] == "yes" for r in supreme_court_rows),
            "with_our_record": sum(bool(r["our_record"]) for r in supreme_court_rows),
            "not_on_list": [f'{r["name"]}, {r["citation"]}' for r in supreme_court_rows if r["on_native_cases_list"] == "no"],
        },
    }
    (OUT / "counts.json").write_text(json.dumps(counts, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({k: {kk: vv for kk, vv in v.items() if not isinstance(vv, (list, dict))} if isinstance(v, dict) else v
                      for k, v in counts.items()}, indent=1))


if __name__ == "__main__":
    main()
