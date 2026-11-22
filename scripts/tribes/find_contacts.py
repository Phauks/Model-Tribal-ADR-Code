"""List the contact page, email addresses and phone numbers on nations' own websites, for review.

For every tribe profile with an official website (contacts, kind 'website', not lapsed), the
script reads the home page and up to three same-site pages whose links suggest a contact page
("Contact us", "Contact", "Directory", "Reach us"). From each page read it keeps every
mailto: and plain-text email address and every tel: link, with the page it was found on. It
picks the best contact page: the first same-site link whose words or address say "contact".

It never writes to a profile. scripts/tribes/write_contacts.py turns the results into
contact facts: only a general office address (info@, contact@, office@ and the like) becomes
an email-general fact (schemas/tribe.schema.json, "contacts"). The results file keeps only
those general addresses and counts the rest (other_addresses, phone_links), because the
repository may be public and the other addresses often name staff members.

Run from the repository root:
    python3 scripts/tribes/find_contacts.py research/raw/2026-11-22/contact-pages.json
Uses only the Python standard library and PyYAML (scripts/requirements.txt).
"""

import concurrent.futures
import datetime
import glob
import html
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.robotparser

import yaml

USER_AGENT = "model-tribal-adr-code contact finder (nations' published contact pages; about 1 request per second per site)"
HEADERS = {"User-Agent": USER_AGENT}
CONTACT_WORDS = re.compile(r"\b(contact(?:[\s-]?us)?|reach us|get in touch|directory)\b", re.I)
CONTACT_ADDRESS = re.compile(r"contact|directory|reach-?us", re.I)
SKIP_ADDRESS = re.compile(r"\.(pdf|jpe?g|png|gif|docx?|xlsx?|zip)(\?|$)|/wp-content/|/feed/?$", re.I)
LINK = re.compile(r"""<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>(.*?)</a>""", re.I | re.S)
EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_TEXT = re.compile(r"\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b")
CONTACT_PAGES = 3


def fetch(url: str) -> tuple[str, str] | None:
    """Return (final address, text) for an HTML page, or None."""
    try:
        request = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(request, timeout=20) as response:
            kind = response.headers.get("content-type", "")
            if "html" not in kind and "text" not in kind:
                return None
            return response.geturl(), response.read(3_000_000).decode("utf-8", "replace")
    except Exception:
        return None


def allowed(robots: urllib.robotparser.RobotFileParser | None, url: str) -> bool:
    try:
        return robots is None or robots.can_fetch(USER_AGENT, url)
    except Exception:
        return True


def load_robots(base: str) -> urllib.robotparser.RobotFileParser | None:
    parts = urllib.parse.urlparse(base)
    result = fetch(f"{parts.scheme}://{parts.netloc}/robots.txt")
    if not result:
        return None
    parser = urllib.robotparser.RobotFileParser()
    parser.parse(result[1].splitlines())
    return parser


def visible_text(page: str) -> str:
    page = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", page)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", page))).strip()


def bare_host(netloc: str) -> str:
    return netloc.lower().split(":")[0].removeprefix("www.")


def page_title(page: str) -> str:
    match = re.search(r"(?is)<title[^>]*>(.*?)</title>", page)
    return re.sub(r"\s+", " ", html.unescape(match.group(1))).strip()[:200] if match else ""


def contact_links(base: str, page: str) -> list[dict]:
    """Same-site links that look like a contact page, best first."""
    host = bare_host(urllib.parse.urlparse(base).netloc)
    found: dict[str, dict] = {}
    for href, label in LINK.findall(page):
        href = html.unescape(href).strip()
        if href.startswith(("mailto:", "tel:", "javascript:")):
            continue
        address = urllib.parse.urljoin(base, href).split("#")[0]
        parts = urllib.parse.urlparse(address)
        if parts.scheme not in ("http", "https") or bare_host(parts.netloc) != host or SKIP_ADDRESS.search(address):
            continue
        words = visible_text(label)
        path = parts.path + ("?" + parts.query if parts.query else "")
        score = 0
        if re.search(r"\bcontact", words, re.I):
            score += 4
        if re.search(r"contact", path, re.I):
            score += 3
        if CONTACT_WORDS.search(words):
            score += 1
        if CONTACT_ADDRESS.search(path):
            score += 1
        if score == 0 or address.rstrip("/") == base.rstrip("/"):
            continue
        if address not in found or found[address]["score"] < score:
            found[address] = {"link": address, "words": words[:120], "score": score}
    return sorted(found.values(), key=lambda link: (-link["score"], len(link["link"])))


def contacts_on(address: str, page: str) -> tuple[list[dict], list[dict]]:
    emails: dict[str, dict] = {}
    phones: dict[str, dict] = {}
    for href, label in LINK.findall(page):
        href = html.unescape(href).strip()
        if href.lower().startswith("mailto:"):
            value = urllib.parse.unquote(href[7:].split("?")[0]).strip().lower()
            if EMAIL.fullmatch(value):
                emails.setdefault(value, {"value": value, "page": address, "how": "mailto", "words": visible_text(label)[:120]})
        elif href.lower().startswith("tel:"):
            digits = re.sub(r"\D", "", href)
            if len(digits) == 11 and digits.startswith("1"):
                digits = digits[1:]
            if len(digits) == 10:
                phones.setdefault(digits, {"value": f"({digits[:3]}) {digits[3:6]}-{digits[6:]}", "page": address, "how": "tel", "words": visible_text(label)[:120]})
    text = visible_text(page)
    for match in EMAIL.finditer(text):
        value = match.group(0).lower().rstrip(".")
        if re.search(r"\.(png|jpe?g|gif|webp|svg)$", value) or "example.com" in value or "sentry" in value:
            continue
        context = text[max(0, match.start() - 120) : match.end() + 40]
        emails.setdefault(value, {"value": value, "page": address, "how": "text", "words": context})
    return list(emails.values()), list(phones.values())


def search(profile: dict) -> dict:
    result = {"id": profile["id"], "name": profile["names"]["official"], "checked": datetime.date.today().isoformat(),
              "websites": [], "unreachable": [], "contact_pages": [], "emails": [], "phones": []}
    for contact in profile.get("contacts") or []:
        if contact.get("kind") != "website" or contact.get("link_status") == "lapsed":
            continue
        result["websites"].append(contact["value"])
        home = fetch(contact["value"])
        if not home:
            result["unreachable"].append(contact["value"])
            continue
        base, page = home
        robots = load_robots(base)
        emails, phones = contacts_on(base, page)
        candidates = contact_links(base, page)
        read = 0
        for candidate in candidates:
            if read >= CONTACT_PAGES:
                break
            if not allowed(robots, candidate["link"]):
                candidate["robots"] = "disallowed"
                continue
            time.sleep(1)
            fetched = fetch(candidate["link"])
            read += 1
            if not fetched:
                candidate["fetched"] = False
                continue
            final, contact_page = fetched
            candidate.update({"fetched": True, "final": final, "title": page_title(contact_page)})
            more_emails, more_phones = contacts_on(final, contact_page)
            candidate["emails"] = [email["value"] for email in more_emails]
            emails += more_emails
            phones += more_phones
        result["contact_pages"] += candidates[:6]
        seen = set()
        result["emails"] += [e for e in emails if not (e["value"] in seen or seen.add(e["value"]))]
        seen = set()
        result["phones"] += [p for p in phones if not (p["value"] in seen or seen.add(p["value"]))]
    return result


def main() -> None:
    output = sys.argv[1]
    only = set(sys.argv[2:])
    profiles = []
    for path in sorted(glob.glob("content/tribes/*/*.yaml")):
        profile = yaml.safe_load(open(path, encoding="utf-8"))
        if only and profile["id"] not in only:
            continue
        if any(c.get("kind") == "website" and c.get("link_status") != "lapsed" for c in profile.get("contacts") or []):
            profiles.append(profile)
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        for count, result in enumerate(pool.map(search, profiles), 1):
            results.append(result)
            if count % 50 == 0:
                print(f"{count} of {len(profiles)}", file=sys.stderr)
    results.sort(key=lambda result: result["id"])
    sys.path.insert(0, str(pathlib.Path(__file__).parent))
    import write_contacts  # noqa: E402  (the rules for a general office address live there)

    wanted = set(write_contacts.HAND_EMAILS.values())
    for result in results:
        keep = [e for e in result["emails"] if e["value"] in wanted
                or (write_contacts.rank(e["value"].split("@")[0]) is not None and e["value"] not in write_contacts.HAND_REJECTED)]
        result["other_addresses"] = len(result["emails"]) - len(keep)
        result["emails"] = keep
        result["phone_links"] = len(result.pop("phones"))
        for candidate in result["contact_pages"]:
            candidate.pop("emails", None)
    with open(output, "w", encoding="utf-8") as handle:
        json.dump(results, handle, indent=1, ensure_ascii=False)
        handle.write("\n")
    print(f"{len(results)} nations; {sum(1 for r in results if r['unreachable'] and not r['contact_pages'] and not r['emails'])} unreachable", file=sys.stderr)


if __name__ == "__main__":
    main()
