"""List each nation's individual courts (Trevor, Nov. 22, 2026).

Trevor asked that a nation page list every court of the nation, not only
"Tribal Court": each of the Navajo Nation's eleven judicial district courts,
and the same for other nations (district, family, peacemaking and appellate
courts, and intertribal courts or Courts of Indian Offenses that serve a
nation). Reviewer agents read the official pages for each of the 416 nations
whose profile lists a court and wrote one JSON file per nation (brief:
research/reviews/briefs/2026-11-22-individual-courts.md). This script turns
those files into the review and into profile facts.

  python3 scripts/review/individual_courts.py collect RESULTS_DIR CACHE_DIR
      Gathers the per-nation files into research/reviews/2026-11-22-individual-courts.json
      and checks each court's quote against the saved copy of the page it came
      from (CACHE_DIR, written by the agents' page fetcher), fetching the page
      again when no copy was saved.
  python3 scripts/review/individual_courts.py apply
      Adds the courts whose quote was found on their page to the profiles'
      justice_institutions, creates a source record for each page, extends
      the court search logs, and writes the review's .csv and counts.

What is added, and what is not:
- A court the profile did not list is added with its name as the page
  writes it, its kind, the group it belongs to (`part_of`), where it sits
  (`location`), its link and, when the page says so, where its appeals go.
- A court the profile already lists is added again only when the page names
  it the same way and adds its street address, the group it belongs to or
  where its appeals go; then
  the two facts, each with its own source, show as one court. A court the
  profile lists only as "Tribal Court" is left alone, so the page does not
  show the same court twice under two names.
- A court whose quote was not found on its page, or whose page could not be
  read again, or that the reader rated low confidence (for example an Alaska
  directory entry saying the court is not active now), is not added; it
  stays in the review for the lead author.
- `part_of` and `appeals_to` are kept only when they name a court in the
  same profile (scripts/validate_records.py checks this too).
- Nothing is removed from a profile.
"""

import collections
import csv
import hashlib
import json
import pathlib
import re
import sys
import unicodedata

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATE = "2026-11-22"
SESSION = "2026-11-22-individual-courts"
REVIEW = ROOT / "research" / "reviews" / "2026-11-22-individual-courts.json"
TRIBES = ROOT / "content" / "tribes"
SOURCES = ROOT / "content" / "sources"
LOGS = ROOT / "research" / "search-logs" / "courts"
CA = "/root/.ccr/ca-bundle.crt"

GENERIC = {"court", "courts", "tribal court", "tribal courts", "judicial branch", "judiciary"}


def comparable(text):
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"').replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", text).strip().lower()


def comparable_name(name):
    text = comparable(name)
    text = re.sub(r"\([^)]*\)", " ", text)
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def letter(identifier):
    first = identifier[0]
    return first if first.isalpha() else "_other"


def cache_key(url):
    return hashlib.sha1(url.encode()).hexdigest()[:16]


def page_text(url, cache_dir, fetched):
    """The text of a page: the agents' saved copy, else a fresh fetch."""
    if url in fetched:
        return fetched[url]
    saved = cache_dir / f"{cache_key(url)}.json"
    text = None
    if saved.exists():
        record = json.loads(saved.read_text(encoding="utf-8"))
        if record.get("status") == 200:
            text = record.get("text", "")
    if text is None and (cache_dir / f"{cache_key(url)}.txt").exists():
        # A PDF's text, extracted with pdftotext.
        text = (cache_dir / f"{cache_key(url)}.txt").read_text(encoding="utf-8", errors="replace")
    if text is None:
        try:
            import requests
            from bs4 import BeautifulSoup

            response = requests.get(url, timeout=25, verify=CA if pathlib.Path(CA).exists() else True,
                                    headers={"User-Agent": "Mozilla/5.0 (compatible; research link checker)"})
            if response.status_code == 200 and (url.lower().endswith(".pdf") or "pdf" in response.headers.get("content-type", "")):
                import subprocess
                import tempfile

                with tempfile.NamedTemporaryFile(suffix=".pdf") as handle:
                    handle.write(response.content)
                    handle.flush()
                    text = subprocess.run(["pdftotext", handle.name, "-"], capture_output=True, text=True).stdout or None
            elif response.status_code == 200 and "html" in response.headers.get("content-type", "html"):
                soup = BeautifulSoup(response.text, "html.parser")
                for tag in soup(["script", "style", "noscript", "svg"]):
                    tag.decompose()
                text = soup.get_text("\n", strip=True)
        except Exception:  # noqa: BLE001 - any failure means the page was not read again
            text = None
    fetched[url] = text
    return text


def collect(results_dir, cache_dir):
    rows = []
    fetched = {}
    for path in sorted(results_dir.glob("*.json")):
        nation = json.loads(path.read_text(encoding="utf-8"))
        for number, court in enumerate(nation.get("courts") or [], 1):
            court["item_id"] = f"{nation['id']}#{number}"
            if nation.get("hand_checked"):
                court["quote_check"] = "checked-by-hand"
                continue
            url = court.get("evidence_url")
            quote = court.get("quote") or ""
            text = page_text(url, cache_dir, fetched) if url and url.startswith("http") else None
            if text is None:
                court["quote_check"] = "page-not-read-again"
            elif comparable(quote) and comparable(quote) in comparable(text):
                court["quote_check"] = "found"
            else:
                court["quote_check"] = "not-found"
        rows.append(nation)
    REVIEW.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    counts = collections.Counter(c["quote_check"] for n in rows for c in n.get("courts") or [])
    print(f"{len(rows)} nations, quote checks: {dict(counts)}")


# --- apply -------------------------------------------------------------------

def slug(text, limit=70):
    text = comparable(text)
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:limit].strip("-")


def normal_link(url):
    return re.sub(r"/+$", "", re.sub(r"^https?://(www\.)?", "", (url or "").strip().lower()))


def existing_sources():
    by_link, keys = {}, set()
    for path in SOURCES.glob("*/*.yaml"):
        record = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        keys.add(record.get("key"))
        for url in (record.get("original_link"), (record.get("citation") or {}).get("URL")):
            if url:
                by_link.setdefault(normal_link(url), record.get("key"))
    return by_link, keys


def source_record(key, url, title, publisher, nation_ids):
    return {
        "key": key,
        "kind": "web-page",
        "citation": {
            "type": "webpage",
            "title": title,
            "author": [{"literal": publisher}],
            "URL": url,
            "accessed": {"date-parts": [[2026, 11, 22]]},
        },
        "original_link": url,
        "retrieved": DATE,
        "archives": [],
        "history": {"status": "live", "last_checked": DATE},
        "rights": {
            "status": "no-permission-needed",
            "basis": "fact-only",
            "basis_note": "Only facts (a court's name, where it sits, its link) and a few words naming the court are recorded from this page.",
            "redistribution": False,
        },
        "tribes": sorted(nation_ids),
        "found_in": [SESSION],
        "notes": "Read on Nov. 22, 2026 for the individual courts review (research/reviews/2026-11-22-individual-courts.md).",
    }


def dump(value):
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=10**6)


def save_profile(path, profile, facts, appeals):
    """Add `facts` at the end of justice_institutions, and each (court name,
    appeals_to) in `appeals` to that listed court, in the file's own text, so
    every other line keeps its layout; then check the result."""
    text = path.read_text(encoding="utf-8")
    for name, appeal in appeals:
        block = "".join("  " + line + "\n" for line in dump({"appeals_to": appeal}).splitlines())
        pattern = re.compile(r"^- (?:[^\n]*\n)(?:  [^\n]*\n)*?  name: " + re.escape(yaml.safe_dump(name, allow_unicode=True, width=10**6).strip().removesuffix("...").strip()) + r"\n(?:  [^\n]*\n|\s*\n)*", re.M)
        found = list(pattern.finditer(text))
        if len(found) != 1:
            raise SystemExit(f"{path}: cannot place appeals_to for {name!r}")
        text = text[:found[0].end()] + block + text[found[0].end():]
    path.write_text(text, encoding="utf-8")
    if facts:
        insert_facts(path, facts)
    record = yaml.safe_load(path.read_text(encoding="utf-8"))
    profile["justice_institutions"] = (profile.get("justice_institutions") or []) + facts
    if record != profile:
        raise SystemExit(f"{path}: the written file does not match the intended record")


def insert_facts(path, facts):
    """Add facts at the end of the profile's justice_institutions list, in the
    file's own text, so the rest of the file keeps its layout."""
    text = path.read_text(encoding="utf-8")
    block = dump(facts)
    match = re.search(r"^justice_institutions:\n((?:[- ] .*\n|\s*\n)*)", text, flags=re.M)
    if not match:
        raise SystemExit(f"{path}: no justice_institutions list")
    end = match.end()
    text = text[:end] + block + text[end:]
    path.write_text(text, encoding="utf-8")
    yaml.safe_load(text)


def fact_for(court, source, appeals_source, names, nation_names):
    fact = {"kind": court.get("kind") or "tribal-court", "name": court["name"].strip()}
    if court.get("link"):
        fact["link"] = court["link"]
    group = court.get("part_of")
    if group and comparable_name(group) in nation_names and comparable_name(group) != comparable_name(fact["name"]):
        fact["part_of"] = nation_names[comparable_name(group)]
    location = {k: v for k, v in (court.get("location") or {}).items() if v and k in ("place", "state", "address")}
    if location.get("state") and not re.fullmatch(r"[A-Z]{2}", location["state"]):
        location.pop("state")
    if location:
        fact["location"] = location
    fact["source"] = source
    fact["confidence"] = court.get("confidence") if court.get("confidence") in ("high", "medium", "low") else "medium"
    fact["verification"] = "read-in-full"
    fact["as_of"] = DATE
    if court.get("evidence_date") and re.fullmatch(r"\d{4}(-\d{2}(-\d{2})?)?", str(court["evidence_date"])):
        fact["as_of"] = str(court["evidence_date"])
    note = f"The page names the court: “{court['quote'].strip()}”."
    if court.get("note"):
        note += " " + court["note"].strip()
    note += f" Found in the individual courts review of {DATE} (research/reviews/2026-11-22-individual-courts.json, {court['item_id']})."
    fact["note"] = note
    appeal = court.get("appeals_to")
    if appeal and appeal.get("court") and appeals_source:
        target = nation_names.get(comparable_name(appeal["court"]))
        if target and target != fact["name"]:
            fact["appeals_to"] = {
                "court": target,
                "source": appeals_source,
                "confidence": fact["confidence"],
                "verification": "read-in-full",
                "as_of": fact["as_of"],
                "note": f"The page says: “{(appeal.get('quote') or '').strip()}”.",
            }
    return fact


def apply():
    rows = json.loads(REVIEW.read_text(encoding="utf-8"))
    by_link, keys = existing_sources()
    new_sources = {}
    source_nations = collections.defaultdict(set)
    decisions = []
    added_by_profile = {}

    def source_for(url, title, publisher, nation_id):
        known = by_link.get(normal_link(url))
        if known:
            return known, False
        if normal_link(url) in new_sources:
            key = new_sources[normal_link(url)]["key"]
        else:
            # The publisher, then the words of the title the publisher's name does not already say.
            words = slug(publisher, 200).split("-")
            extra = [word for word in slug(title, 200).split("-") if word and word not in words]
            base = slug(" ".join(words[:6] + extra), 60) or slug(url)
            key, number = base, 2
            while key in keys:
                key, number = f"{base}-{number}", number + 1
            keys.add(key)
            new_sources[normal_link(url)] = source_record(key, url, title or url, publisher or "Unknown publisher", [])
        source_nations[key].add(nation_id)
        return key, True

    for nation in rows:
        path = next(TRIBES.glob(f"*/{nation['id']}.yaml"), None)
        if not path:
            continue
        profile = yaml.safe_load(path.read_text(encoding="utf-8"))
        listed = profile.get("justice_institutions") or []
        listed_names = {comparable_name(i.get("name", "")): i.get("name", "") for i in listed}
        courts = [c for c in nation.get("courts") or [] if c.get("name")]
        usable = [c for c in courts if c.get("quote_check") in ("found", "checked-by-hand")]
        # Every name a fact may point to: listed courts and the usable new ones.
        names = dict(listed_names)
        for court in usable:
            names.setdefault(comparable_name(court["name"]), court["name"].strip())
        # A court the reader matched to a listed court under another name is
        # that court: a part_of or appeals_to naming it points to the listed name.
        for court in usable:
            if court.get("existing") and comparable_name(court["existing"]) in listed_names:
                names[comparable_name(court["name"])] = listed_names[comparable_name(court["existing"])]
        listed_appeals = []
        facts = []
        for court in courts:
            decision = {"item_id": court["item_id"], "nation": nation["id"], "name": court.get("name"), "kind": court.get("kind"),
                        "existing": court.get("existing"), "quote_check": court.get("quote_check"), "evidence_url": court.get("evidence_url"),
                        "location": ", ".join(str(v) for v in (court.get("location") or {}).values() if v), "confidence": court.get("confidence"),
                        "note": court.get("note") or ""}
            if court not in usable:
                decision["result"] = "not added: quote not found on the page" if court.get("quote_check") == "not-found" else "not added: page not read again"
                decisions.append(decision)
                continue
            if court.get("confidence") == "low":
                decision["result"] = "not added: low confidence"
                decisions.append(decision)
                continue
            own = comparable_name(court["name"])
            existing = court.get("existing")
            if own in listed_names or existing:
                same_name = own in listed_names
                # A place alone (often just the nation's own community) is not enough to list a court twice.
                adds = (court.get("location") or {}).get("address") or court.get("part_of") or court.get("appeals_to")
                if not same_name:
                    decision["result"] = "not added: the profile lists this court under another name"
                    appeal = court.get("appeals_to") or {}
                    listed_name = listed_names.get(comparable_name(existing or ""))
                    if listed_name and appeal.get("url") and appeal.get("court") and court.get("confidence") != "low":
                        appeals_source, _ = source_for(appeal["url"], court.get("evidence_title") or "", court.get("evidence_publisher") or "", nation["id"])
                        listed_appeals.append((listed_name, appeal, appeals_source, court))
                        decision["result"] += "; its path of appeal is added to the listed court"
                    decisions.append(decision)
                    continue
                if not adds:
                    decision["result"] = "not added: already listed, nothing new"
                    decisions.append(decision)
                    continue
            if any(comparable_name(f["name"]) == own for f in facts):
                decision["result"] = "not added: listed twice in the findings"
                decisions.append(decision)
                continue
            source, _ = source_for(court["evidence_url"], court.get("evidence_title") or "", court.get("evidence_publisher") or "", nation["id"])
            appeals_source = None
            appeal = court.get("appeals_to") or {}
            if appeal.get("url") and appeal.get("court"):
                appeals_source, _ = source_for(appeal["url"], court.get("evidence_title") or "", court.get("evidence_publisher") or "", nation["id"])
            fact = fact_for(court, source, appeals_source, None, names)
            facts.append(fact)
            decision["result"] = "added" if own not in listed_names else "added: where it sits, for a listed court"
            decisions.append(decision)
        # A part_of or appeals_to that names a court not in the profile after all is dropped.
        final_names = set(listed_names) | {comparable_name(f["name"]) for f in facts}
        for fact in facts:
            if fact.get("part_of") and comparable_name(fact["part_of"]) not in final_names:
                fact.pop("part_of")
            if fact.get("appeals_to") and comparable_name(fact["appeals_to"]["court"]) not in final_names:
                fact.pop("appeals_to")
        appeals_set = 0
        appeals_written = []
        for listed_name, appeal, appeals_source, court in listed_appeals:
            target = names.get(comparable_name(appeal["court"]))
            fact = next((i for i in listed if i.get("name") == listed_name), None)
            if not fact or fact.get("appeals_to") or not target or comparable_name(target) not in final_names or target == listed_name:
                continue
            fact["appeals_to"] = {
                "court": target,
                "source": appeals_source,
                "confidence": court.get("confidence") if court.get("confidence") in ("high", "medium") else "medium",
                "verification": "read-in-full",
                "as_of": DATE,
                "note": f"The page says: “{(appeal.get('quote') or '').strip()}”. Found in the individual courts review of {DATE} (research/reviews/2026-11-22-individual-courts.json, {court['item_id']}).",
            }
            appeals_written.append((listed_name, fact["appeals_to"]))
            appeals_set += 1
        if facts or appeals_set:
            save_profile(path, profile, facts, appeals_written)
            added_by_profile[nation["id"]] = len(facts) + appeals_set
        write_log(nation, path)

    for record in new_sources.values():
        record["tribes"] = sorted(source_nations[record["key"]])
        target = SOURCES / letter(record["key"]) / f"{record['key']}.yaml"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(dump(record), encoding="utf-8")

    with open(REVIEW.with_suffix(".csv"), "w", newline="", encoding="utf-8") as handle:
        fields = ["item_id", "nation", "name", "kind", "existing", "location", "confidence", "quote_check", "result", "evidence_url", "note", "lead_author_decision"]
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for decision in decisions:
            writer.writerow({**{k: decision.get(k, "") for k in fields}, "lead_author_decision": ""})
    counts = {
        "nations_reviewed": len(rows),
        "courts_found": len(decisions),
        "results": dict(collections.Counter(d["result"] for d in decisions)),
        "profiles_changed": len(added_by_profile),
        "facts_added": sum(added_by_profile.values()),
        "sources_added": len(new_sources),
    }
    (REVIEW.parent / "2026-11-22-individual-courts-counts.json").write_text(json.dumps(counts, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(counts, indent=1))


PLACE_KINDS = {"nation-website", "tribal-court-site", "state-court-directory", "bureau-of-indian-affairs-list",
               "intertribal-organization", "web-search", "other", "nation-code-site"}
OUTCOMES = {"found", "not-found", "no-site", "blocked", "dead-link", "paywalled", "scanned-unreadable", "not-public", "error"}


def write_log(nation, profile_path):
    searches = []
    for search in nation.get("searches") or []:
        address = (search.get("address") or "").strip()
        if not address:
            continue
        kind = search.get("place_kind") if search.get("place_kind") in PLACE_KINDS else "other"
        outcome = search.get("outcome") if search.get("outcome") in OUTCOMES else "error"
        searches.append({
            "date": DATE,
            "searched_by": "Claude (AI assistant)",
            "method": "script",
            "place_kind": kind,
            "address": address,
            "query": "Individual courts review: every court, district, division and appellate court of the nation",
            "outcome": outcome,
            "reason": (search.get("reason") or "No reason given.").strip(),
        })
    if not searches:
        return
    path = LOGS / letter(nation["id"]) / f"{nation['id']}.yaml"
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        log = {"profile": str(profile_path.relative_to(ROOT)), "topic": "courts",
               "status": "found" if any(s["outcome"] == "found" for s in searches) else "partly-searched",
               "last_searched": DATE, "searches": searches}
        path.write_text(dump(log), encoding="utf-8")
        return
    # Append to the file's own text, so the earlier entries keep their layout.
    text = path.read_text(encoding="utf-8")
    log = yaml.safe_load(text)
    existing = {(s.get("address"), s.get("date"), s.get("query")) for s in log["searches"]}
    added = [s for s in searches if (s["address"], s["date"], s["query"]) not in existing]
    if not added:
        return
    match = re.search(r"^searches:\n((?:[- ] .*\n)*)", text, flags=re.M)
    if not match:
        raise SystemExit(f"{path}: no searches list")
    text = text[:match.end()] + dump(added) + text[match.end():]
    status = log["status"]
    if any(s["outcome"] == "found" for s in added):
        status = "found"
    elif status == "not-searched":
        status = "partly-searched"
    text = re.sub(r"^status: .*$", f"status: {status}", text, count=1, flags=re.M)
    if re.search(r"^last_searched: .*$", text, flags=re.M):
        text = re.sub(r"^last_searched: .*$", f"last_searched: '{DATE}'", text, count=1, flags=re.M)
    else:
        text = re.sub(r"^(status: .*)$", rf"\1\nlast_searched: '{DATE}'", text, count=1, flags=re.M)
    result = yaml.safe_load(text)
    if result["searches"] != log["searches"] + added or result["status"] != status:
        raise SystemExit(f"{path}: appending the searches did not give the intended log")
    path.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "collect":
        collect(pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]))
    elif len(sys.argv) >= 2 and sys.argv[1] == "apply":
        apply()
    else:
        print(__doc__)
        sys.exit(2)
