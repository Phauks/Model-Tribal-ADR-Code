"""Record what the National Indian Law Library pages saved by nill_gateway_fetch.py list.

    python3 scripts/review/nill_gateway_apply.py --work WORK [--dry-run]

For each saved Tribal Law Gateway page (WORK/pages/<slug>.html) of a page the project had not read (research/nill-coverage/gateway-nations.csv, read_by_project = no), it reads the "Tribal Code", "Tribal Constitution", "Tribal Court Opinions" and "Contact Info" blocks the same way the Nov. 21, 2026 session did (research/sessions/2026/2026-11-21-justice-and-law.md):

- Every listing with a link (other than NILL catalog, Westlaw or email links) becomes a `governing_documents` entry on each matched profile, with the note 'Listed on the National Indian Law Library page under 'Tribal Code' as: "...".' and verification title-only, unless the profile already holds that link. Links to NILL's own table-of-contents pages are listed, never copied (decision record 0043).
- A "Tribal Court" line in the Contact Info block becomes a `justice_institutions` entry, unless the profile already lists a court.
- Every page read gets a source record content/sources/n/national-indian-law-library-<slug>.yaml (facts only; not redistributed).
- Every matched profile gets an entry in its `governance` search log saying what the page listed, or that it listed nothing usable.
- research/reviews/2026-11-24-nill-gateway-remaining.json and .csv list every page, every listing and what was done with it.

New YAML is inserted as text, so the rest of each profile is left exactly as it was.
"""

import argparse
import csv
import html
import json
import pathlib
import re
import sys
import urllib.parse

import yaml

TODAY = "2026-11-24"
SESSION = "2026-11-24-nill-gateway-remaining"
SEARCHER = "Claude (AI assistant)"
REVIEW = pathlib.Path("research/reviews/2026-11-24-nill-gateway-remaining")
GATEWAY = "https://narf.org/nill/tribes/{slug}.html"
SECTIONS = {"code": "Tribal Code", "constitution": "Tribal Constitution", "Court": "Tribal Court Opinions"}
SKIP_LINK = re.compile(r"tinyurl\.com|softlinkliberty|nill\.narf\.org/liberty|mailto:|westlaw|versuslaw|lib\.narf\.org|/catalog", re.I)
# Matches checked by hand on Nov. 24, 2026, where the coverage script's name match found no profile or more than one.
MATCHES = {
    "duwamish": (["duwamish-tribal-organization"], "the profile's other name is Duwamish Tribe, petitioner #25, the petition the page names"),
    "eastern_pequot": (["eastern-pequot-tribal-nation"], "the page's constitution link is on easternpequottribalnation.com"),
    "haliwa_saponi": (["haliwa-saponi-indian-tribe"], "the profile's other name is Haliwa-Saponi Indian Tribe, Inc."),
    "iqurmuit": (["iqugmiut-traditional-council"], "same name, spelled Iqugmuit on the page"),
    "los_coyotes_band": (["los-coyotes-band-of-cahuilla-and-cupeno-indians"], "same name, Cahuilla misspelled on the page"),
    "saint_francis_abenaki": (["missisquoi-st-francis-sokoki-band"], "the state-recognized Missisquoi, St. Francis-Sokoki Band; the profile st-francis-sokoki-band-of-abenakis-of-vermont, the same group, was merged into it"),
    "snoqualmoo": (["snoqualmoo-tribe-of-whidbey-island"], "the only Snoqualmoo profile"),
    "tuscarora": (["tuscarora-nation"], "the page gives a Lewiston, New York address, so not the Tuscarora Nation of North Carolina"),
    "northfork_rancheria": (["northfork-rancheria-of-mono-indians-of-california"], "the page names Northfork Rancheria, the federally recognized nation, not the North Fork Band petitioner"),
    "mission_creek": (["mission-creek-band-of-indians"], "the Gateway index names the Mission Creek Band"),
    "nipmuc_tribe": (["nipmuc-nation", "webster-dudley-band-of-chaubunagungamaug-nipmuck-indians"],
                     "the page lists the constitutions of both the Nipmuc Nation and the Chaubunagungamaug Band of Nipmuck Indians"),
}
# A listing whose link belongs to another nation than the page's (checked by hand).
LINK_NATIONS = {"nipmuck.org": "webster-dudley-band-of-chaubunagungamaug-nipmuck-indians", "nipmucnation.org": "nipmuc-nation"}
NONE = re.compile(r"^\s*(none available|none)\.?\s*$", re.I)


def clean(fragment):
    text = re.sub(r"<[^>]+>", " ", fragment)
    text = html.unescape(text).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def block(page, name):
    match = re.search(r'InstanceBeginEditable name="%s" -->(.*?)<!-- InstanceEndEditable' % name, page, re.S)
    return match.group(1) if match else ""


def paragraphs(fragment):
    parts = re.split(r"</p>|<p[^>]*>|<br\s*/?>\s*<br\s*/?>", fragment)
    return [part for part in parts if clean(part)]


def absolute(link, page_url):
    return urllib.parse.urljoin(page_url, link.strip())


def normalized(link):
    parts = urllib.parse.urlsplit(link.strip().lower())
    host = parts.netloc.removeprefix("www.")
    return host + parts.path.rstrip("/").removesuffix("/index.html").removesuffix("/index.php")


def kind_and_title(section, text, link):
    lower = text.lower()
    year = re.search(r"\((?:[A-Za-z: ]*?)?((?:1[89]|20)\d\d)[^)]*\)", text)
    year = year.group(1) if year else None
    if section == "constitution":
        if "corporate charter" in lower:
            return "corporate-charter", "Corporate charter", year
        if "articles of association" in lower:
            return "articles-of-association", "Articles of Association", year
        return "constitution", "Constitution", year
    if section == "code":
        if "court rules" in lower or "rules of court" in lower:
            return "court-rules", "Court rules", year
        # A title after the "At ... website." phrase, as on the Nov. 21 pages ("At tribe's website . Tax Codes.").
        tail = re.sub(r"^.*?website\s*\.?\s*", "", text, flags=re.I) if re.search(r"website", text, re.I) else ""
        tail = re.sub(r"\s*\((?:[^)]*)\)\s*\.?$", "", tail).strip(" .")
        if tail and len(tail) < 120 and not re.match(r"(table of contents|see )", tail, re.I):
            return "law-code", tail, year
        return "law-code", "Tribal code", year
    return "other", "Tribal court opinions", year


def listings(page, page_url):
    found, texts = [], {}
    for name, label in SECTIONS.items():
        fragment = block(page, name)
        texts[name] = clean(fragment)
        for part in paragraphs(fragment):
            links = [absolute(link, page_url) for link in re.findall(r'href="([^"]+)"', part)]
            links = [link for link in links if not SKIP_LINK.search(link) and not link.startswith("https://narf.org/nill/tribes/")]
            text = clean(part)
            for link in links:
                kind, title, year = kind_and_title(name, text, link)
                found.append({"section": label, "text": text, "link": link, "kind": kind, "title": title, "year": year,
                              "nill_hosted": "narf.org/nill/" in link})
    contact = block(page, "ContactInfo")
    court = None
    match = re.search(r"(?:<[^>]+>|\s)*([^<>]*\bTribal Court\b[^<>]*)", contact, re.I)
    placeholder = "555-555" in contact or "123 Road" in contact  # an unfilled page template (seen on one page)
    if match and "mailto" not in match.group(0).lower() and not placeholder:
        after = contact[match.end():]
        link = re.search(r'href="(https?://[^"]+)"', after[:400])
        court = {"name": clean(match.group(1)).strip(":") or "Tribal Court", "link": link.group(1) if link else None}
    texts["contact_mentions_court"] = bool(court)
    return found, texts, court


def profile_path(nation):
    first = nation[0] if nation[0].isalpha() else "_other"
    return pathlib.Path("content/tribes") / first / f"{nation}.yaml"


def yaml_item(fact):
    dumped = yaml.safe_dump([fact], allow_unicode=True, sort_keys=False, width=float("inf"))
    return dumped


def insert_list_items(text, key, items_text):
    """Append items to the top-level list `key`, or add the key at the end of the file."""
    lines = text.splitlines(keepends=True)
    start = next((i for i, line in enumerate(lines) if line.rstrip() == f"{key}:"), None)
    if start is None:
        if not text.endswith("\n"):
            text += "\n"
        return text + f"{key}:\n" + items_text
    end = start + 1
    while end < len(lines) and (lines[end].startswith((" ", "-")) or not lines[end].strip()):
        end += 1
    return "".join(lines[:end]) + items_text + "".join(lines[end:])


def source_record(slug, name, nations):
    url = GATEWAY.format(slug=urllib.parse.quote(slug))
    return {
        "key": source_key(slug),
        "kind": "web-page",
        "citation": {"type": "webpage", "title": f"{name} - Tribal Law",
                     "author": [{"literal": "National Indian Law Library, Native American Rights Fund"}],
                     "container-title": "National Indian Law Library Tribal Law Gateway", "URL": url,
                     "accessed": {"date-parts": [[2026, 11, 24]]}},
        "original_link": url,
        "retrieved": TODAY,
        "history": {"status": "live", "last_checked": TODAY},
        "rights": {"status": "no-permission-needed", "basis": "fact-only",
                   "basis_note": "Only facts are recorded from this source; it is cited and linked, not quoted or reproduced.",
                   "redistribution": False},
        "tribes": nations,
        "found_in": [SESSION],
    }


def source_key(slug):
    return "national-indian-law-library-" + re.sub(r"[^a-z0-9]+", "-", slug.lower().replace("'", "")).strip("-")


def log_entry(slug, outcome, reason, records=None):
    entry = {"date": TODAY, "searched_by": SEARCHER, "method": "script", "place_kind": "national-indian-law-library",
             "address": GATEWAY.format(slug=urllib.parse.quote(slug)),
             "query": "Tribal Code, Tribal Constitution, Tribal Court Opinions and Contact Info blocks (scripts/review/nill_gateway_apply.py)",
             "outcome": outcome, "reason": reason}
    if records:
        entry["records"] = records
    return entry


def add_to_log(nation, entry, dry_run):
    path = pathlib.Path("research/search-logs/governance") / (nation[0] if nation[0].isalpha() else "_other") / f"{nation}.yaml"
    if path.exists():
        log = yaml.safe_load(path.read_text(encoding="utf-8"))
    else:
        log = {"profile": str(profile_path(nation)), "topic": "governance", "status": "not-searched", "searches": []}
    if any(s.get("address") == entry["address"] and s.get("date") == TODAY for s in log["searches"]):
        return
    log["searches"].append(entry)
    log["last_searched"] = TODAY
    if entry["outcome"] == "found" or log.get("status") == "found":
        log["status"] = "found"
    elif log.get("status") in (None, "not-searched"):
        log["status"] = "partly-searched"
        log.setdefault("next_steps", "Read the nation's own website for its constitution and codes.")
    ordered = {key: log[key] for key in ("profile", "topic", "status", "last_searched", "searches", "next_steps") if key in log}
    ordered.update({key: value for key, value in log.items() if key not in ordered})
    if not dry_run:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(yaml.dump(ordered, sort_keys=False, allow_unicode=True, width=float("inf")), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--work", required=True)
    parser.add_argument("--dry-run", action="store_true")
    arguments = parser.parse_args()
    pages = pathlib.Path(arguments.work) / "pages"
    rows = [row for row in csv.DictReader(open("research/nill-coverage/gateway-nations.csv", encoding="utf-8"))
            if row["read_by_project"] == "no"]
    review, flat = [], []
    for row in rows:
        slug = row["slug"]
        nations = [n for n in row["nations"].split(";") if n]
        match_note = None
        if slug in MATCHES:
            nations, match_note = MATCHES[slug]
        meta_path = pages / f"{slug}.json"
        entry = {"slug": slug, "name": row["name"], "status": row["status"], "page": GATEWAY.format(slug=urllib.parse.quote(slug)),
                 "nations": nations, "matched_by_hand": match_note, "listings": [], "court": None, "added": [], "already_held": [], "notes": []}
        review.append(entry)
        if not meta_path.exists():
            entry["notes"].append("page not fetched")
            continue
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        entry["http_status"] = meta.get("status")
        if meta.get("status") != 200:
            entry["notes"].append(f"page returned {meta.get('status') or meta.get('error')}")
            for nation in nations:
                add_to_log(nation, log_entry(slug, "dead-link" if meta.get("status") == 404 else "error",
                                             f"The page returned {meta.get('status') or meta.get('error')} on {TODAY}."), arguments.dry_run)
            continue
        page = (pages / f"{slug}.html").read_text(encoding="utf-8", errors="replace")
        found, texts, court = listings(page, meta.get("final") or GATEWAY.format(slug=urllib.parse.quote(slug)))
        entry["listings"], entry["court"] = found, court
        entry["section_text"] = {SECTIONS.get(k, k): v for k, v in texts.items() if isinstance(v, str)}
        key = source_key(slug)
        if not nations:
            entry["notes"].append("no matching nation profile; nothing recorded")
            continue
        if not arguments.dry_run:
            path = pathlib.Path("content/sources/n") / f"{key}.yaml"
            path.write_text(yaml.safe_dump(source_record(slug, row["name"], nations), allow_unicode=True, sort_keys=False, width=100),
                            encoding="utf-8")
        for nation in nations:
            path = profile_path(nation)
            text = path.read_text(encoding="utf-8")
            profile = yaml.safe_load(text)
            held = {normalized(d.get("link", "")) for d in profile.get("governing_documents") or [] if d.get("link")}
            new_docs = []
            for item in found:
                owner = next((n for host, n in LINK_NATIONS.items() if host in item["link"]), None)
                if owner and owner != nation:
                    continue
                if item["section"] == "Tribal Court Opinions":
                    entry["notes"].append(f"court opinions listing left for review: {item['link']}")
                    continue
                if normalized(item["link"]) in held:
                    entry["already_held"].append({"nation": nation, "link": item["link"]})
                    continue
                held.add(normalized(item["link"]))
                fact = {"kind": item["kind"], "title": item["title"]}
                if item["year"]:
                    fact["year"] = item["year"]
                fact.update({"link": item["link"], "source": key, "confidence": "medium", "verification": "title-only",
                             "as_of": TODAY, "locator": f"{item['section']} section",
                             "note": f"Listed on the National Indian Law Library page under '{item['section']}' as: \"{item['text']}\"."})
                if item["nill_hosted"]:
                    fact["note"] += " The National Indian Law Library page gives the table of contents (and may link to the nation's own copy); it is linked, not copied (decision record 0043)."
                new_docs.append(fact)
                entry["added"].append({"nation": nation, "field": "governing_documents", "kind": item["kind"], "link": item["link"]})
            new_courts = []
            courts = profile.get("justice_institutions") or []
            if court and not any(c.get("kind") in ("tribal-court", "court-of-appeals") for c in courts):
                fact = {"kind": "tribal-court", "name": court["name"]}
                if court["link"]:
                    fact["link"] = court["link"]
                fact.update({"source": key, "confidence": "medium", "verification": "bulk-import", "as_of": TODAY,
                             "locator": "Contact Info, Tribal Court",
                             "note": "The page gives a contact for a tribal court without a fuller name."})
                new_courts.append(fact)
                entry["added"].append({"nation": nation, "field": "justice_institutions", "kind": "tribal-court", "link": court["link"]})
            if not arguments.dry_run and (new_docs or new_courts):
                if new_docs:
                    text = insert_list_items(text, "governing_documents", "".join(yaml_item(f) for f in new_docs))
                if new_courts:
                    text = insert_list_items(text, "justice_institutions", "".join(yaml_item(f) for f in new_courts))
                path.write_text(text, encoding="utf-8")
            listed = [i for i in found if i["section"] != "Tribal Court Opinions" and
                      next((n for host, n in LINK_NATIONS.items() if host in i["link"]), nation) == nation]
            if listed:
                kinds = sorted({i["kind"].replace("-", " ") for i in listed})
                added = sum(1 for a in entry["added"] if a["nation"] == nation and a["field"] == "governing_documents")
                what = ", ".join(kinds)
                if added == len(listed):
                    tail = "added to the profile" if added == 1 else "both added to the profile" if added == 2 else f"all {added} added to the profile"
                elif added:
                    tail = f"{added} of {len(listed)} added to the profile; the profile already had the rest"
                else:
                    tail = "the profile already had it" if len(listed) == 1 else "the profile already had them"
                reason = f"The page lists {len(listed)} {'link' if len(listed) == 1 else 'links'} ({what}); {tail}."
                add_to_log(nation, log_entry(slug, "found", reason, [str(path), key]), arguments.dry_run)
            else:
                said = "; ".join(f"{k}: {v}" for k, v in entry["section_text"].items()
                                 if k in ("Tribal Code", "Tribal Constitution") and v and not NONE.match(v))
                reason = "The page lists no constitution or code with a link" + (f" (it says {said})." if said else " (both blocks say none available).")
                if "555-555" in page:
                    reason = "The page is an unfilled template (\"Tribe Name\", placeholder address and links), so it lists nothing for this nation."
                add_to_log(nation, log_entry(slug, "not-found", reason, [key]), arguments.dry_run)
        for item in found:
            flat.append({"slug": slug, "name": row["name"], "nations": ";".join(nations), "section": item["section"],
                         "kind": item["kind"], "title": item["title"], "year": item["year"] or "", "link": item["link"],
                         "nill_hosted": "yes" if item["nill_hosted"] else "no",
                         "added_to": ";".join(a["nation"] for a in entry["added"] if a.get("link") == item["link"]),
                         "listing_text": item["text"]})
    if not arguments.dry_run:
        REVIEW.with_suffix(".json").write_text(json.dumps(review, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        with open(REVIEW.with_suffix(".csv"), "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=["slug", "name", "nations", "section", "kind", "title", "year", "link",
                                                        "nill_hosted", "added_to", "listing_text"])
            writer.writeheader()
            writer.writerows(flat)
    read = [e for e in review if e.get("http_status") == 200]
    for e in read:
        for a in e["added"]:
            print("added", e["slug"], a, file=sys.stderr)
        if e["court"]:
            print("court", e["slug"], e["court"], file=sys.stderr)
    print(json.dumps({
        "pages": len(review), "read": len(read),
        "not_read": [e["slug"] for e in review if e.get("http_status") != 200],
        "no_profile": [e["slug"] for e in review if not e["nations"]],
        "pages_with_listings": sum(1 for e in read if e["listings"]),
        "listings": sum(len(e["listings"]) for e in read),
        "nill_hosted_listings": sum(1 for e in read for i in e["listings"] if i["nill_hosted"]),
        "added": sum(len(e["added"]) for e in read),
        "already_held": sum(len(e["already_held"]) for e in read),
        "court_contacts": sum(1 for e in read if e["court"]),
    }, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
