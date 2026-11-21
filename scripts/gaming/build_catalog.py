"""Build the gaming document catalog in research/gaming/ from the work files
of compact_list.py, ordinance_list.py and a Federal Register API search.

    python3 scripts/gaming/build_catalog.py WORK_DIRECTORY

WORK_DIRECTORY holds oig/list.json (compact_list.py), nigc/ordinances.json
(ordinance_list.py) and fr/fr_all.json (Federal Register API metadata, keyed
by document number). The script

- writes research/gaming/compact-documents.{json,csv}: one row per document
  on the Office of Indian Gaming list, with the nation's profile id taken
  from the profile fact that already cites that list row, and the Federal
  Register notice that the list links or, failing a link, the only Indian
  gaming notice published on the listed date;
- writes research/gaming/ordinance-documents.{json,csv}: one row per
  ordinance or amendment on the National Indian Gaming Commission list, with
  the nation's profile id taken from the profile fact that cites that link;
- writes research/gaming/federal-register-notices.{json,csv}: every Bureau
  of Indian Affairs or Interior notice about Class III compacts or
  procedures found, and which list rows it was matched to;
- adds a source record content/sources/f/federal-register-<number>.yaml for
  every such notice that has no record yet.

Never changes a profile.
"""

import csv
import datetime
import json
import pathlib
import re
import sys

import yaml

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import record_facts  # noqa: E402

SESSION = "2026-11-21-gaming-compacts-and-ordinances"
TODAY = "2026-11-21"
OUT = pathlib.Path("research/gaming")
COMPACT_LIST_SOURCE = "office-of-indian-gaming-compacts-list-2026"
ORDINANCE_SOURCE = "nigc-gaming-ordinances-table-2026"
STATES = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "California": "CA", "Colorado": "CO",
    "Connecticut": "CT", "Florida": "FL", "Idaho": "ID", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Louisiana": "LA", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Oklahoma": "OK", "Oregon": "OR", "Rhode Island": "RI",
    "South Dakota": "SD", "Texas": "TX", "Washington": "WA", "Wisconsin": "WI", "Wyoming": "WY",
}
DECISIONS = {
    "Approve": "approved", "Deemed Approved": "deemed-approved", "Disapproved": "disapproved",
    "Secretarial Procedures": "secretarial-procedures", "Extensions": "extension",
}
MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
GAMING_NOTICE = re.compile(r"indian gaming|class iii|gaming compact|tribal-state compact|gaming procedures", re.I)
NOT_COMPACT = re.compile(
    r"environmental|land acquisition|information collection|minimum internal control|fee rate|"
    r"privacy act|technical standards|appointment|revenue allocation plan|hearing|eis\b|scoping|"
    r"gaming on trust lands|two-part determination|self-regulation|management contract|"
    r"background investigation|class ii\b", re.I)
DOCUMENT_NUMBER = re.compile(
    r"federalregister\.gov/(?:documents|d|articles)/(?:\d{4}/\d\d/\d\d/)?([0-9A-Za-z-]+?)(?:/|$)"
    r"|govinfo\.gov/content/pkg/FR-[0-9-]+/(?:pdf|html)/([0-9A-Za-z-]+?)\.(?:pdf|htm)")


def indigo_date(iso):
    day = datetime.date.fromisoformat(iso)
    return f"{MONTHS[day.month - 1]} {day.day}, {day.year}"


def fr_citation(notice):
    return f"{notice['volume']} Fed. Reg. {notice['start_page']} ({indigo_date(notice['publication_date'])})"


def document_kind(title, decision, link=None):
    lowered = f"{title} {pathlib.PurePosixPath(link or '').name}".lower()
    if decision == "Secretarial Procedures" or "procedures" in lowered:
        return "secretarial-procedures"
    if decision == "Extensions" or "extension" in lowered:
        return "extension"
    if re.search(r"amend|addend|restat|appendix", lowered):
        return "amendment"
    if "letter" in lowered:
        return "letter"
    return "compact"


def is_compact_notice(notice):
    agencies = {a.get("slug") for a in notice.get("agencies") or []}
    if not agencies & {"indian-affairs-bureau", "interior-department", "indian-affairs-office-of-the-assistant-secretary"}:
        return False
    if notice.get("type") not in ("Notice", "Correction"):
        return False
    title = notice.get("title") or ""
    return bool(GAMING_NOTICE.search(title)) and not NOT_COMPACT.search(title)


COMMON_WORDS = set("""indian indians tribe tribes tribal band bands nation nations community communities of the
and in on reservation rancheria rancherias california oklahoma washington oregon arizona new mexico south north
dakota nevada wisconsin minnesota montana michigan idaho kansas iowa louisiana york connecticut florida colorado
wyoming nebraska mississippi massachusetts rhode island carolina indiana texas alabama pueblo confederated
previously listed as mission state gaming compact sioux chippewa paiute shoshone band's""".split())


def nation_words(text):
    return {word for word in re.findall(r"[a-z][a-z'-]{3,}", text.lower()) if word not in COMMON_WORDS}


def nation_named_nearby(row, notices):
    words = nation_words(f"{row['title']} {row['tribes_column']}")
    if not words:
        return []
    listed = datetime.date.fromisoformat(row["date"])
    found = []
    for number, notice in notices.items():
        if not is_compact_notice(notice):
            continue
        gap = (datetime.date.fromisoformat(notice["publication_date"]) - listed).days
        if -30 <= gap <= 150 and words & nation_words(f"{notice.get('title')} {notice.get('abstract') or ''}"):
            found.append(number)
    return found


def profile_maps(tree):
    """Map list documents and ordinance links to the profile ids that cite them."""
    compact_documents, ordinance_links = {}, {}
    for file, profile in tree.profiles.items():
        identifier = profile["id"]
        gaming = profile.get("gaming") or {}
        for fact in gaming.get("compacts") or []:
            if fact.get("source") != COMPACT_LIST_SOURCE:
                continue
            link = re.search(r"Document: (\S+?\.pdf)", fact.get("note", ""), re.I)
            if link:
                compact_documents.setdefault(link.group(1), set()).add(identifier)
        for fact in gaming.get("ordinances") or []:
            if fact.get("link"):
                ordinance_links.setdefault(fact["link"], set()).add(identifier)
    return compact_documents, ordinance_links


def write_table(name, rows, columns):
    (OUT / f"{name}.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    with open(OUT / f"{name}.csv", "w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(columns)
        for row in rows:
            flat = []
            for column in columns:
                value = row
                for part in column.split("."):
                    value = (value or {}).get(part) if isinstance(value, dict) else None
                flat.append(";".join(map(str, value)) if isinstance(value, list) else ("" if value is None else value))
            writer.writerow(flat)


def build_compacts(work, notices, compact_documents):
    rows = json.loads((work / "oig/list.json").read_text(encoding="utf-8"))
    by_date = {}
    for number, notice in notices.items():
        if is_compact_notice(notice):
            by_date.setdefault(notice["publication_date"], []).append(number)
    catalog, matched = [], {}
    for row in rows:
        linked = []
        for link in row["federal_register_links"]:
            match = DOCUMENT_NUMBER.search(link)
            if match:
                linked.append(match.group(1) or match.group(2))
        documents = row["documents"] or [{"link": None, "file_name": None}]
        for document in documents:
            nation_ids = sorted(compact_documents.get(document["link"], ()))
            notice_number, how = None, None
            if linked and linked[0] in notices:
                notice_number, how = linked[0], "linked-from-list"
            elif row["date"] and len(by_date.get(row["date"], [])) == 1:
                notice_number, how = by_date[row["date"]][0], "only-gaming-notice-that-day"
            elif row["date"] and row["decision"] != "Secretarial Procedures":
                near = nation_named_nearby(row, notices)
                if len(near) == 1:
                    notice_number, how = near[0], "nation-named-in-notice-within-150-days"
            notice = notices.get(notice_number) if notice_number else None
            flags = []
            if notice and row["date"]:
                gap = abs((datetime.date.fromisoformat(notice["publication_date"])
                           - datetime.date.fromisoformat(row["date"])).days)
                if gap > 120:
                    flags.append(f"Federal Register notice published {gap} days from the listed date")
            if not nation_ids:
                flags.append("no profile cites this list row")
            if document.get("capture") is None and document["link"]:
                flags.append("document not downloaded")
            elif document["link"] and document.get("text_characters", 0) < 500:
                flags.append("no text layer (scanned)")
            name = (document.get("file_name") or row["title"]).removesuffix(".pdf")
            identifier = re.sub(r"[^a-z0-9]+", "-", name.lower().replace("508_compliant_", "")).strip("-")
            record = {
                "id": identifier,
                "state": STATES[row["state"]],
                "nations": nation_ids,
                "list_tribes_column": row["tribes_column"],
                "title": row["title"],
                "decision": DECISIONS.get(row["decision"], row["decision"] or None),
                "document_kind": document_kind(row["title"], row["decision"], document["link"]),
                "listed_date": row["date"],
                "document_link": document["link"],
                "federal_register": {
                    "source": f"federal-register-{notice_number.lower()}" if notice else None,
                    "citation": fr_citation(notice) if notice else None,
                    "title": notice["title"] if notice else None,
                    "match": how,
                } if notice else None,
                "capture": {key: document.get(key) for key in ("capture", "sha256", "bytes", "pages", "text_characters")}
                if document.get("capture") else None,
                "list_row": {"page": row["page"], "row": row["row"]},
                "source": COMPACT_LIST_SOURCE,
                "confidence": "high" if nation_ids and notice and how == "linked-from-list" and not flags else "medium",
                "verification": "bulk-import" if how in (None, "linked-from-list") else "inferred",
                "flags": flags,
            }
            catalog.append(record)
            if notice_number:
                matched.setdefault(notice_number, []).append(record)
    seen = {}
    for record in catalog:  # file names repeat across states now and then
        seen[record["id"]] = seen.get(record["id"], 0) + 1
        if seen[record["id"]] > 1:
            record["id"] += f"-{seen[record['id']]}"
    return catalog, matched


def build_ordinances(work, ordinance_links):
    rows = json.loads((work / "nigc/ordinances.json").read_text(encoding="utf-8"))
    catalog, by_link = [], {}
    for row in rows:
        for document in row["documents"]:
            nation_ids = sorted(ordinance_links.get(document["link"], ()))
            flags = []
            by_link.setdefault(document["link"], []).append(row["nation_column"])
            if not nation_ids:
                flags.append("no profile cites this link")
            if not document.get("capture"):
                flags.append("document not downloaded")
            elif document.get("text_characters", 0) < 500:
                flags.append("no text layer (scanned)")
            catalog.append({
                "id": re.sub(r"[^a-z0-9]+", "-", f"{row['nation_column']} {document['kind']} {document['date']}".lower()).strip("-"),
                "nations": nation_ids,
                "list_nation_column": row["nation_column"],
                "kind": document["kind"],
                "listed_date": document["date"],
                "link": document["link"],
                "final_link": document.get("final_link"),
                "capture": {key: document.get(key) for key in ("capture", "sha256", "bytes", "pages", "text_characters")}
                if document.get("capture") else None,
                "list_row": row["table_row"],
                "source": ORDINANCE_SOURCE,
                "confidence": "high" if nation_ids else "medium",
                "verification": "bulk-import",
                "flags": flags,
            })
    for record in catalog:
        sharing = by_link[record["link"]]
        if len(sharing) > 1 or sum(1 for r in catalog if r["link"] == record["link"]) > 1:
            record["flags"].append("the list uses this same link for another date or nation")
    seen = {}
    for record in catalog:
        seen[record["id"]] = seen.get(record["id"], 0) + 1
        if seen[record["id"]] > 1:
            record["id"] += f"-{seen[record['id']]}"
    return catalog


def existing_addresses(tree):
    addresses = {}
    for key, source in tree.sources.items():
        for link in record_facts.source_links(source):
            addresses[record_facts.normalized_link(link)] = key
    return addresses


def source_record(number, notice, nation_ids):
    record = {
        "key": f"federal-register-{number.lower()}",
        "kind": "federal-register-notice",
        "citation": {
            "type": "legislation",
            "title": notice["title"],
            "container-title-short": "Fed. Reg.",
            "volume": str(notice["volume"]),
            "page": str(notice["start_page"]) if notice.get("start_page") == notice.get("end_page") or not notice.get("end_page")
            else f"{notice['start_page']}-{notice['end_page']}",
            "author": [{"literal": "U.S. Department of the Interior, Bureau of Indian Affairs"}],
            "container-title": "Federal Register",
            "number": f"FR Doc. {number}",
            "URL": notice["html_url"],
            "issued": {"date-parts": [[int(part) for part in notice["publication_date"].split("-")]]},
            "accessed": {"date-parts": [[2026, 11, 21]]},
        },
        "original_link": notice["html_url"],
        "retrieved": TODAY,
        "archives": [],
        "history": {"status": "live", "last_checked": TODAY},
        "rights": {"status": "no-permission-needed", "basis": "us-government-work", "redistribution": True},
    }
    if nation_ids:
        record["tribes"] = sorted(nation_ids)
    record["found_in"] = [SESSION]
    record["notes"] = (f"{fr_citation(notice)}. Notice of a federal action on a Class III gaming compact, amendment, "
                       "extension or procedures under 25 U.S.C. § 2710(d)(8). Metadata from the Federal Register API "
                       "(federalregister.gov/api/v1); the matching Office of Indian Gaming list rows are in "
                       "research/gaming/compact-documents.json.")
    return record


def main(work):
    OUT.mkdir(parents=True, exist_ok=True)
    tree = record_facts.Tree(".")
    notices = json.loads((work / "fr/fr_all.json").read_text(encoding="utf-8"))
    compact_documents, ordinance_links = profile_maps(tree)
    compacts, matched = build_compacts(work, notices, compact_documents)
    ordinances = build_ordinances(work, ordinance_links)
    write_table("compact-documents", compacts, [
        "id", "state", "nations", "list_tribes_column", "title", "decision", "document_kind", "listed_date",
        "document_link", "federal_register.citation", "federal_register.source", "federal_register.match",
        "capture.capture", "capture.pages", "capture.text_characters", "capture.sha256", "confidence",
        "verification", "flags"])
    write_table("ordinance-documents", ordinances, [
        "id", "nations", "list_nation_column", "kind", "listed_date", "link", "final_link", "capture.capture",
        "capture.pages", "capture.text_characters", "capture.sha256", "confidence", "verification", "flags"])

    addresses = existing_addresses(tree)
    notice_rows, added = [], 0
    for number, notice in sorted(notices.items(), key=lambda item: item[1]["publication_date"]):
        if not (is_compact_notice(notice) or number in matched):
            continue
        records = matched.get(number, [])
        nation_ids = {n for r in records for n in r["nations"]}
        key = f"federal-register-{number.lower()}"
        existing = addresses.get(record_facts.normalized_link(notice["html_url"]))
        if existing:
            key = existing
        else:
            path = pathlib.Path("content/sources/f") / f"{key}.yaml"
            if not path.exists():
                path.write_text(yaml.safe_dump(source_record(number, notice, nation_ids), sort_keys=False,
                                               allow_unicode=True, width=110), encoding="utf-8")
                added += 1
        notice_rows.append({
            "document_number": number, "source": key, "citation": fr_citation(notice), "title": notice["title"],
            "publication_date": notice["publication_date"], "link": notice["html_url"],
            "states": sorted({r["state"] for r in records}), "nations": sorted(nation_ids),
            "matched_list_documents": [r["id"] for r in records],
            "verification": "bulk-import",
        })
    write_table("federal-register-notices", notice_rows, [
        "document_number", "source", "citation", "title", "publication_date", "link", "states", "nations",
        "matched_list_documents", "verification"])
    print(f"{len(compacts)} compact documents, {len(ordinances)} ordinance documents, "
          f"{len(notice_rows)} notices ({added} new source records)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(pathlib.Path(sys.argv[1]))
