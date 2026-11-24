#!/usr/bin/env python3
"""Source records for every presidential executive order on Indian affairs
(data tier 1; Trevor, Nov. 24, 2026): the 562 orders in the Oklahoma State
University Tribal Treaties Database and the 18 orders since 1994 with an
Indian term in their title in the Federal Register.

The database (https://treaties.okstate.edu/) lists 562 executive orders, from
the reservation orders of 1855-1919 reproduced in Kappler's Indian Affairs:
Laws and Treaties to numbered orders as late as 2012 that touch Indian lands,
schools or the Indian Service. Each record page gives the president, the
order's number or Federal Register citation where there is one, the date and
the text. The modern orders come from the Federal Register API
(https://www.federalregister.gov/developers/documentation/api/v1).

Every order is a work of the United States government, so the project keeps
its own copy in the bucket under executive-orders/<key>.<ext>:
the Federal Register PDF from GovInfo for orders published since 1994, and
otherwise the order's text as the database transcribes it (a .txt file).

Steps:
  fetch    Read the database's listing and each order's page, and the
           Federal Register entries for orders since 1994. Writes
           research/raw/2026-11-24/executive-orders.json and, in --work, the
           text and PDF files to store.
  file     Store each copy in the bucket with scripts/captures/mirror_captures.py.
  records  Write content/sources/e/<key>.yaml. The 54 executive order records
           that already exist keep their keys and text, and only gain the
           stored copy.

Usage:
  python3 scripts/law/executive_order_records.py fetch --work DIR
  python3 scripts/law/executive_order_records.py file --work DIR --captures /mnt/project-files/research/captures
  python3 scripts/law/executive_order_records.py records
"""
from __future__ import annotations

import argparse
import csv
import html
import json
import re
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote

import yaml

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "research/raw/2026-11-24/executive-orders.json"
INDEX = ROOT / "research/capture-index.csv"
SOURCES = ROOT / "content/sources"
SESSION = "2026-11-24-federal-executive-order-records"
TODAY = "2026-11-24"
OSU = "https://treaties.okstate.edu/treaties/"
FEDERAL_REGISTER = "https://www.federalregister.gov/api/v1/documents.json"
# The 18 orders since 1994 with an Indian term in their title (research/analyses/2026-11-24-federal-laws-and-treaties-coverage.md, source 6).
MODERN = [13007, 13021, 13084, 13096, 13104, 13175, 13270, 13336, 13549, 13592, 13647, 13774, 13809, 13898, 14031, 14049, 14053, 14112]
MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
DATE = re.compile(r"\b(" + "|".join(MONTH_NAMES) + r")\.? (\d{1,2})[,.]? (\d{4})")
RIGHTS = {"status": "no-permission-needed", "basis": "us-government-work",
          "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105).",
          "redistribution": True}


def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def slug(text: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-")


def get(url: str, path: Path | None = None) -> str:
    """Fetch a page (or save it to path), retrying twice."""
    for attempt in range(3):
        command = ["curl", "-gsfL", "-m", "120", "-A", "Mozilla/5.0", url]
        if path:
            command[1:1] = ["-o", str(path)]
        result = subprocess.run(command, capture_output=True, text=not path)
        if result.returncode == 0:
            return "" if path else result.stdout
        time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"could not fetch {url}")


def local_name(osu_slug: str) -> str:
    """A file name for a database address (a few addresses contain a slash)."""
    return osu_slug.replace("/", "-")


def iso(match: re.Match) -> str:
    return f"{match.group(3)}-{MONTH_NAMES.index(match.group(1)) + 1:02d}-{int(match.group(2)):02d}"


def long_date(value: str) -> str:
    parts = [int(part) for part in value.split("-")]
    if len(parts) == 1:
        return str(parts[0])
    return f"{MONTHS[parts[1] - 1]} {parts[2]}, {parts[0]}"


def text_of(fragment: str) -> str:
    fragment = re.sub(r"<(script|style)\b.*?</\1>", "", fragment, flags=re.S)
    fragment = re.sub(r"\.dropdown-more-info\{[^}]*\}", "", fragment)
    fragment = re.sub(r"<br\s*/?>|</p>|</div>|</h\d>", "\n", fragment)
    lines = [re.sub(r"[ \t\xa0]+", " ", html.unescape(re.sub(r"<[^>]+>", " ", line))).strip() for line in fragment.split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def listing() -> list[dict]:
    """The database's executive orders: year, address, title, president and tags."""
    page = get(OSU)
    orders = []
    for row in re.findall(r"<tr>(.*?)</tr>", page, flags=re.S):
        cells = re.findall(r"<td>(.*?)</td>", row, flags=re.S)
        if len(cells) < 5 or re.sub(r"<[^>]+>|\s+", " ", cells[-2]).strip() != "executive order":
            continue
        link = re.search(r'href="treaties/([^"]+)"[^>]*>([^<]+)<', cells[1])
        orders.append({"osu_slug": link.group(1), "title": html.unescape(link.group(2)).strip(), "year": cells[0].strip(),
                       "president": [html.unescape(p) for p in re.findall(r'presidents/[^"]+"[^>]*>([^<]+)<', cells[2])],
                       "tags": [html.unescape(t) for t in re.findall(r'class="tl-tag">([^<]+)<', cells[-1])]})
    return orders


def read_page(order: dict, page: str) -> str:
    """Fill in an order's identifiers, scan and other links and date from its page; return the order's text."""
    start, end = page.find("LINKS AND MORE INFORMATION"), page.find("Additional Resources")
    section = page[start:end]
    links = dict((label.strip(), href) for href, label in re.findall(r'href="(https?://[^"]+)"[^>]*>([^<]+)<', section))
    order["scan"] = links.get("DOCUMENT SCAN", "")
    order["alternative"] = links.get("ALTERNATIVE SOURCE", "")
    identifiers = re.search(r'IDENTIFIERS</p><div class="more-info-links" >(.*?)<', section, flags=re.S)
    order["identifiers"] = html.unescape(identifiers.group(1)).strip() if identifiers else ""
    text = text_of(section)
    title_at = text.find(order["title"].split(":")[0])
    body = text[title_at:] if title_at >= 0 else text
    body = body.split("\n", 1)[1].strip() if "\n" in body else body
    title_date = DATE.search(order["title"])
    body_date = DATE.search(body)
    order["date"] = iso(title_date) if title_date else iso(body_date) if body_date else order["year"]
    order["date_from"] = "title" if title_date else "text" if body_date else "year only"
    return body


def federal_register(numbers: list[int]) -> dict[int, dict]:
    """Federal Register entries for executive orders, by number."""
    found = {}
    fields = ["executive_order_number", "title", "signing_date", "publication_date", "citation", "document_number",
              "pdf_url", "html_url", "president", "disposition_notes"]
    for start in range(0, len(numbers), 20):
        query = "&".join([f"conditions[presidential_document_type][]=executive_order", "per_page=100"]
                         + [f"conditions[executive_order_numbers][]={number}" for number in numbers[start:start + 20]]
                         + [f"fields[]={field}" for field in fields])
        for item in json.loads(get(f"{FEDERAL_REGISTER}?{query}"))["results"]:
            if item.get("executive_order_number"):
                found[int(item["executive_order_number"])] = item
        time.sleep(1)
    return found


def order_number(order: dict) -> int | None:
    match = re.match(r"Executive Order (\d+)\b", order["title"]) or re.search(r"\bEO (\d+)\b", order.get("identifiers", ""))
    return int(match.group(1)) if match else None


def fetch(args) -> None:
    work = Path(args.work)
    for folder in ("pages", "text", "pdf"):
        (work / folder).mkdir(parents=True, exist_ok=True)
    orders = listing()
    print(f"listing: {len(orders)} executive orders")
    for order in orders:
        path = work / "pages" / f"{local_name(order['osu_slug'])}.html"
        if not path.exists():
            try:
                get(OSU + quote(order["osu_slug"], safe="-()'"), path)
            except RuntimeError:
                order.update({"page": "could not be fetched", "number": order_number(order), "date": order["year"], "date_from": "year only"})
                continue
            time.sleep(0.7)
        body = read_page(order, path.read_text(encoding="utf-8", errors="replace"))
        order["number"] = order_number(order)
        (work / "text" / f"{local_name(order['osu_slug'])}.txt").write_text(body + "\n", encoding="utf-8")
        order["text_characters"] = len(body)
    numbers = sorted({order["number"] for order in orders if order["number"] and order["number"] >= 12890} | set(MODERN))
    entries = federal_register(numbers)
    for number, entry in entries.items():
        path = work / "pdf" / f"executive-order-{number}.pdf"
        if entry.get("pdf_url") and not path.exists():
            get(entry["pdf_url"], path)
            time.sleep(0.5)
    in_database = {order["number"] for order in orders}
    RAW.write_text(json.dumps({
        "generated": TODAY,
        "sources": [OSU, FEDERAL_REGISTER],
        "note": "Executive orders in the Oklahoma State University Tribal Treaties Database (listing and record pages), and the Federal Register entries for orders published since 1994. Order texts are stored in the project's bucket, not here.",
        "database_orders": orders,
        "federal_register": [entries[number] for number in sorted(entries)],
        "modern_orders_not_in_database": [number for number in MODERN if number not in in_database],
    }, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"database orders: {len(orders)}; Federal Register entries: {len(entries)}; "
          f"modern orders not in the database: {[n for n in MODERN if n not in in_database]}")


def existing_records() -> dict:
    """Executive order records not written by this script, by database address, by order number and (a list) by date."""
    found = {}
    for path in SOURCES.glob("*/*.yaml"):
        text = path.read_text(encoding="utf-8")
        if "kind: executive-order" not in text or SESSION in text:
            continue
        for address in re.findall(r"treaties\.okstate\.edu/treaties/([^\s'\"]+)", text):
            found[address.rstrip("/")] = path
        record = yaml.safe_load(text)
        number = re.search(r"(?:Executive Order|E\.O\.|Exec\. Order)(?: No\.)? ?(\d[\d,]+)", record["citation"].get("title", "") + " " + str(record["citation"].get("number", "")))
        if number:
            found[f"number:{int(number.group(1).replace(',', ''))}"] = path
        parts = record["citation"].get("issued", {}).get("date-parts", [[None]])[0]
        if len(parts) == 3:
            found.setdefault(f"date:{parts[0]}-{parts[1]:02d}-{parts[2]:02d}", []).append(path)
    return found


def same_order(order: dict, candidates: list[Path]) -> Path | None:
    """An existing record of the same date whose key names the same place (Tule River Reserve and tule-river-reservation)."""
    name = slug(DATE.sub("", re.sub(r"^Executive Order:?\s*", "", order["title"])))
    first = name.split("-")[0] if name else ""
    matches = [path for path in candidates if first and first in path.stem.split("-")]
    return matches[0] if len(matches) == 1 else None


def plan() -> list[dict]:
    """Every order with its record key, the existing record it matches (if any) and its Federal Register entry."""
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    entries = {int(entry["executive_order_number"]): entry for entry in raw["federal_register"]}
    existing = existing_records()
    items = []
    for order in raw["database_orders"]:
        item = dict(order, source="database")
        if order["number"] and order["number"] in entries:
            item["federal_register"] = entries[order["number"]]
            item["date"], item["date_from"] = entries[order["number"]]["signing_date"], "federal register"
        match = (existing.get(order["osu_slug"]) or (existing.get(f"number:{order['number']}") if order["number"] else None)
                 or same_order(order, existing.get(f"date:{order['date']}", [])))
        item["existing"] = str(match.relative_to(ROOT)) if match else ""
        items.append(item)
    for number in raw["modern_orders_not_in_database"]:
        entry = entries[number]
        match = existing.get(f"number:{number}")
        items.append({"source": "federal-register", "number": number, "title": f"Executive Order {number}: {entry['title']}",
                      "date": entry["signing_date"], "federal_register": entry, "existing": str(match.relative_to(ROOT)) if match else ""})
    counts: dict[str, int] = {}
    for item in items:
        if item["existing"]:
            item["key"] = Path(item["existing"]).stem
            continue
        if item.get("number"):
            suffix = re.match(r"Executive Order (\d+-?[A-Z]?)\b", item["title"])
            base = f"executive-order-{slug(suffix.group(1)) if suffix else item['number']}"
        else:
            name = re.sub(r"^Executive Order:?\s*", "", item["title"])
            name = slug(DATE.sub("", name))
            base = f"executive-order-{item['date']}-{name}".rstrip("-")
        item["key"] = base
        counts[base] = counts.get(base, 0) + 1
    seen: dict[str, int] = {}
    for item in items:
        if not item["existing"] and counts[item["key"]] > 1:
            seen[item["key"]] = seen.get(item["key"], 0) + 1
            item["key"] = f"{item['key']}-{seen[item['key']]}"
    return items


def copy_name(item: dict, work: Path) -> tuple[Path, str]:
    """The local file to store for an order, and its name in the bucket."""
    if item.get("federal_register"):
        pdf = work / "pdf" / f"executive-order-{item['federal_register']['executive_order_number']}.pdf"
        if pdf.exists():
            return pdf, f"{item['key']}.pdf"
    return work / "text" / f"{local_name(item.get('osu_slug', ''))}.txt", f"{item['key']}.txt"


def file(args) -> None:
    sys.path.insert(0, str(ROOT / "scripts/captures"))
    import mirror_captures  # noqa: E402

    work = Path(args.work)
    filed = {row["key"] for row in csv.DictReader(INDEX.open(encoding="utf-8"))}
    staged = work / "staged"
    staged.mkdir(exist_ok=True)
    for item in plan():
        local, name = copy_name(item, work)
        if f"executive-orders/{name}" in filed or not local.exists():
            continue
        if local.suffix == ".txt":
            body = local.read_text(encoding="utf-8").strip()
            if len(body) < 40:
                continue
            header = (f"{item['title']}\n{long_date(item['date'])}\n\n"
                      f"Text as transcribed by the Oklahoma State University Tribal Treaties Database, {OSU}{item['osu_slug']}"
                      + (f"; scan of the printed text: {item['scan']}" if item.get("scan") else "") + ".\n\n")
            target = staged / name
            target.write_text(header + body + "\n", encoding="utf-8")
            local = target
        entry = item.get("federal_register")
        mirror_captures.add(argparse.Namespace(
            captures=args.captures, files=[str(local)], topic="executive-orders", name=name, record=item["key"],
            obtained=("downloaded from GovInfo (Federal Register) by script" if name.endswith(".pdf") else
                      "order text from the Oklahoma State University Tribal Treaties Database, saved by script"),
            title=item["title"],
            link=[entry["pdf_url"]] if name.endswith(".pdf") else [OSU + item["osu_slug"]], redistribution="yes", nations="",
            rights="United States government work (17 U.S.C. § 105).", keep_local=False))


def stored_copies() -> dict[str, dict]:
    copies = {}
    for row in csv.DictReader(INDEX.open(encoding="utf-8")):
        if row["key"].startswith("executive-orders/"):
            copies[Path(row["key"]).stem] = {"storage_key": row["key"], "checksum": row["sha256"],
                                             "media_type": row["media_type"], "bytes": int(row["bytes"])}
    return copies


def add_file_block(path: Path, block: dict) -> bool:
    """Give an existing executive order record its stored copy, leaving the rest of the file as it is."""
    text = path.read_text(encoding="utf-8")
    if "\nfile:\n" in text:
        return False
    text = text.replace("\nrights:\n", "\n" + dump({"file": block}) + "rights:\n", 1)
    if SESSION not in text:
        text = re.sub(r"\nfound_in:\n((?:- .*\n)+)", lambda m: f"\nfound_in:\n{m.group(1)}- {SESSION}\n", text, count=1)
    path.write_text(text, encoding="utf-8")
    return True


def thousands(number: int) -> str:
    return f"{number:,}" if number >= 10000 else str(number)


def record_for(item: dict, copy: dict | None) -> dict:
    entry = item.get("federal_register")
    number = item.get("number")
    name = re.sub(r"^Executive Order(?: \d+-?[A-Z]?)?:?\s*", "", item["title"]).strip()
    name = DATE.sub("", name).strip(" ,.")
    date = item["date"]
    parts = [int(part) for part in date.split("-")]
    if entry:
        volume, page = re.match(r"(\d+) FR (\d+)", entry["citation"]).groups()
        title = f"Executive Order {number}, {name}"
        indigo = f"Exec. Order No. {thousands(number)}, {volume} Fed. Reg. {thousands(int(page))} ({long_date(entry['publication_date'])})"
        link = entry["html_url"]
    elif number:
        label = re.match(r"Executive Order (\d+-?[A-Z]?)", item["title"]).group(1)
        title = f"Executive Order No. {label} of {long_date(date)} ({name})" if name else f"Executive Order No. {label} of {long_date(date)}"
        indigo = f"Exec. Order No. {label} ({long_date(date)})"
        link = OSU + item["osu_slug"]
    else:
        title = f"Executive Order of {long_date(date)} ({name})" if name else f"Executive Order of {long_date(date)}"
        indigo = f"Exec. Order of {long_date(date)}"
        link = OSU + item["osu_slug"]
    citation = {"type": "legislation", "title": title, "author": [{"literal": "United States"}]}
    if entry:
        citation.update({"container-title": "Federal Register", "volume": volume, "page": page, "number": f"Exec. Order No. {number}"})
    citation.update({"URL": link, "issued": {"date-parts": [parts]}, "accessed": {"date-parts": [[2026, 11, 24]]}})
    record = {"key": item["key"], "kind": "executive-order", "citation": citation, "original_link": link,
              "retrieved": TODAY, "archives": []}
    if copy:
        record["file"] = copy
    record["rights"] = RIGHTS
    record["jurisdictions"] = [{"level": "federal"}]
    record["found_in"] = [SESSION]
    where = []
    if item.get("osu_slug"):
        where.append(f"listed in the Oklahoma State University Tribal Treaties Database ({OSU}{item['osu_slug']})"
                     + (f", which links a scan of the printed text ({item['scan']})" if item.get("scan") and "okstate" in item["scan"] else ""))
    if entry:
        where.append(f"published in the Federal Register ({entry['citation']}, {long_date(entry['publication_date'])}; signed {long_date(entry['signing_date'])}; PDF {entry['pdf_url']})")
    stored = ("The stored copy is the Federal Register PDF." if copy and copy["media_type"] == "application/pdf" else
              "The stored copy is the order's text as the database transcribes it." if copy else "No copy is stored: the database gives no text for this order.")
    dated = {"title": "the date in the database's title", "text": "the first date in the database's text of the order",
             "year only": "only the year the database gives"}.get(item.get("date_from", ""), "the Federal Register (date signed)")
    president = f" President: {item['president'][0].rsplit(',', 1)[0]}." if item.get("president") else (
        f" President: {entry['president']['name']}." if entry and entry.get("president") else "")
    record["notes"] = (f"Indigo Book citation: {indigo}. Executive order {'; '.join(where)}.{president} Date from {dated}. {stored} "
                       "Title, date and citation generated by scripts/law/executive_order_records.py; not yet read against the text (Unverified)."
                       + (" Not about Indian affairs alone: it lists Tribal governments among others." if number in (13549, 13774, 13809) else ""))
    return record


def records(args) -> None:
    copies = stored_copies()
    added = updated = 0
    for item in plan():
        copy = copies.get(item["key"])
        if item["existing"]:
            updated += bool(copy and add_file_block(ROOT / item["existing"], copy))
            continue
        path = SOURCES / item["key"][0] / f"{item['key']}.yaml"
        if path.exists() and SESSION not in path.read_text(encoding="utf-8"):
            sys.exit(f"key in use by another record: {item['key']}")
        path.write_text(dump(record_for(item, copy)), encoding="utf-8")
        added += 1
    print(f"executive orders: {added} records written, {updated} existing records given their copy")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "file", "records"):
        p = sub.add_parser(name)
        if name in ("fetch", "file"):
            p.add_argument("--work", required=True)
        if name == "file":
            p.add_argument("--captures", required=True)
    args = parser.parse_args()
    {"fetch": fetch, "file": file, "records": records}[args.command](args)


if __name__ == "__main__":
    main()
