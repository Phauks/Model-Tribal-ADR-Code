"""Check the web address of every source record and record what it returns
(row 21 of the dataset gap audit, research/analyses/2026-11-21-dataset-gap-audit.md).

    python3 scripts/review/source_links.py check WORK.json [--limit N] [--host HOST] [--recheck OUTCOME,...]
    python3 scripts/review/source_links.py apply WORK.json [--date YYYY-MM-DD] [--agree REVIEW.csv]

`check` requests each source's `original_link` (or `citation.URL` when it has
none): a HEAD request first, then a GET when HEAD is refused or fails, or
when the page is needed for its date. It follows redirects, runs at most 8
requests at once and 2 per site with half a second between requests to one
site, waits 20 seconds at most, and identifies itself as a script. A site that
refuses scripts (401, 403 or 429, or a bot-protection page) is recorded as
`blocked`; the script never tries to get around it. For web pages with no
`citation.issued`, it reads only explicit publication-date metadata
(article:published_time, datePublished, citation_publication_date,
DC.date.issued, dcterms.issued) and, failing that, explicit last-modified
metadata in the page (article:modified_time, dateModified). HTML pages are
always fetched with GET too, because a bot wall can answer HEAD with 200.
FederalRegister.gov document pages, which answer scripts with a CAPTCHA page,
are checked through the FederalRegister.gov API by document number. The HTTP
Last-Modified header is kept in the work file but never used as a date.
A site's home page is never given a date.
Results are cached in WORK.json, so an interrupted run resumes; --recheck
runs the listed outcomes again.

`apply` writes only clear results to the source records, editing the
`history` block in place (and `citation.issued` plus one sentence in `notes`
for a filled date), leaving every other line, including `archives`, as it is:

  - live: the address answers 200, at the same address or one that differs
    only in scheme, `www.`, a trailing slash or an index page;
  - moved: it redirects to a page that answers 200 and keeps the page's own
    name (the last part of its path) or only adds to the old path on the same
    site, or the old address was a WordPress short link; the new address
    goes in `history.changes`. A redirect to a file host or signed download
    link counts as live. Other redirects can be a site's guess for a missing
    page and are recorded as `redirect-unclear`;
  - removed: both requests answer 404 or 410.

Each also gets `history.last_checked`. With --agree REVIEW.csv (the second
gap review's research/reviews/2026-11-22-source-links.csv), only `removed`
and `moved` results that the other check agrees with are written, and no
dates are filled; this is how the Nov. 22, 2026 run was applied.

Blocked, timed out, server errors, redirects to a home page or to a page
with another name, and pages titled "not found" are left unchanged; they are
already listed for the lead author in research/reviews/2026-11-22-source-links.csv
(the second gap review), so this script writes no review file of its own.
"""

import concurrent.futures
import csv
import datetime
import glob
import json
import pathlib
import re
import sys
import threading
import time
import urllib.parse

import requests
import yaml

USER_AGENT = "model-tribal-adr-code link checker (source records; 2 requests per site)"
HEADERS = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8"}
TIMEOUT = 20
WORKERS = 8
PER_HOST = 2
HOST_PAUSE = 0.5
MAX_BODY = 2_000_000
BLOCK_MARKERS = re.compile(
    r"just a moment|cf-browser-verification|challenge-platform|attention required|captcha|"
    r"incapsula|access denied|request unsuccessful|are you a robot|bot protection|ddos-guard",
    re.IGNORECASE)
BODY_BLOCK_MARKERS = re.compile(
    r"flagged as potentially automated|cf-browser-verification|cf_chl_opt|"
    r"Incapsula incident|Pardon Our Interruption|_Incapsula_Resource|Request unsuccessful\. Incapsula",
    re.IGNORECASE)
FEDERAL_REGISTER_DOCUMENT = re.compile(r"^https?://(?:www\.)?federalregister\.gov/(?:documents|d)/(?:\d{4}/\d{2}/\d{2}/)?([0-9A-Z-]+?\d)(?:/|$)")
FEDERAL_REGISTER_API = "https://www.federalregister.gov/api/v1/documents/{}.json?fields[]=document_number&fields[]=html_url"
NOT_FOUND_TITLE = re.compile(r"\b(404|page not found|not found|page cannot be found|no longer available)\b",
                             re.IGNORECASE)
PUBLISHED_KEYS = ("article:published_time", "datepublished", "citation_publication_date", "citation_date",
                  "dc.date.issued", "dcterms.issued", "og:published_time")
MODIFIED_KEYS = ("article:modified_time", "datemodified", "og:updated_time")
ISO_DATE = re.compile(r"^\s*(\d{4})-(\d{2})-(\d{2})")

_host_locks = {}
_host_last = {}
_lock = threading.Lock()


def sources():
    for path in sorted(glob.glob("content/sources/*/*.yaml")):
        record = yaml.safe_load(pathlib.Path(path).read_text(encoding="utf-8"))
        link = record.get("original_link") or (record.get("citation") or {}).get("URL")
        yield path, record, link


def host_of(link):
    return (urllib.parse.urlsplit(link).hostname or "").lower()


def polite(link):
    host = host_of(link)
    with _lock:
        semaphore = _host_locks.setdefault(host, threading.Semaphore(PER_HOST))
    semaphore.acquire()
    with _lock:
        wait = _host_last.get(host, 0) + HOST_PAUSE - time.monotonic()
        _host_last[host] = max(time.monotonic(), _host_last.get(host, 0) + HOST_PAUSE)
    if wait > 0:
        time.sleep(wait)
    return semaphore


def request(method, link, retry=True):
    result = _request(method, link)
    if retry and result[0].get("error") and "ConnectionError" in result[0]["error"]:
        time.sleep(3)
        result = _request(method, link)
    return result


def _request(method, link):
    semaphore = polite(link)
    try:
        response = requests.request(method, link, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True,
                                    stream=(method == "GET"))
        body = b""
        if method == "GET":
            for chunk in response.iter_content(65536):
                body += chunk
                if len(body) > MAX_BODY:
                    break
        response.close()
        return {"status": response.status_code, "final_url": response.url,
                "redirects": [r.url for r in response.history],
                "content_type": response.headers.get("Content-Type", ""),
                "last_modified_header": response.headers.get("Last-Modified"),
                "server": response.headers.get("Server", ""),
                "cf_ray": bool(response.headers.get("CF-RAY"))}, body
    except requests.RequestException as error:
        return {"status": None, "error": f"{type(error).__name__}: {str(error)[:200]}"}, b""
    finally:
        semaphore.release()


def page_title(html):
    match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    return re.sub(r"\s+", " ", match.group(1)).strip()[:200] if match else ""


def meta_dates(html):
    """Explicit date metadata in the page: {key: value}. Never the HTTP header."""
    found = {}
    for tag in re.findall(r"<meta\b[^>]*>", html, re.IGNORECASE):
        name = re.search(r"\b(?:property|name|itemprop)\s*=\s*[\"']([^\"']+)[\"']", tag, re.IGNORECASE)
        content = re.search(r"\bcontent\s*=\s*[\"']([^\"']*)[\"']", tag, re.IGNORECASE)
        if name and content and name.group(1).lower() in PUBLISHED_KEYS + MODIFIED_KEYS:
            found.setdefault(name.group(1).lower(), content.group(1))
    for block in re.findall(r"<script[^>]+application/ld\+json[^>]*>(.*?)</script>", html,
                            re.IGNORECASE | re.DOTALL):
        for key in ("datePublished", "dateModified"):
            match = re.search(r"\"%s\"\s*:\s*\"([^\"]+)\"" % key, block)
            if match:
                found.setdefault(key.lower(), match.group(1))
    return found


def choose_date(dates):
    for keys, basis in ((PUBLISHED_KEYS, "published"), (MODIFIED_KEYS, "modified")):
        for key in keys:
            match = ISO_DATE.match(dates.get(key, ""))
            if match:
                year, month, day = (int(part) for part in match.groups())
                if 1900 <= year <= 2026 and 1 <= month <= 12 and 1 <= day <= 31:
                    return {"date_parts": [year, month, day], "metadata": key, "basis": basis,
                            "value": dates[key]}
    return None


def normal(link):
    parts = urllib.parse.urlsplit(link)
    host = (parts.hostname or "").lower().removeprefix("www.")
    path = re.sub(r"/(index|default)\.(html?|php|aspx?)$", "/", parts.path or "/").rstrip("/")
    return host, urllib.parse.unquote(path), parts.query


FILE_HOST = re.compile(r"X-Amz-|Signature=|[?&]Expires=|static1\.squarespace\.com|\.s3\.amazonaws\.com|"
                       r"s3\.amazonaws\.com/|cloudfront\.net|storage\.googleapis\.com|blob\.core\.windows\.net")


def last_segment(link):
    return urllib.parse.unquote(normal(link)[1].rsplit("/", 1)[-1]).lower()


def same_document(link, final):
    """A redirect counts as a move only when the new address keeps the page's own name (its last
    path segment) or extends the old path on the same site, or the old address was a WordPress short
    link (?p=N)."""
    if re.search(r"[?&]p=\d+$", link):
        return True
    old, new = last_segment(link), last_segment(final)
    extends = normal(final)[0] == normal(link)[0] and normal(final)[1].startswith(normal(link)[1] + "/")
    return bool(old) and (old == new or extends)


def classify(link, head, get, body):
    final = get if get else head
    status = final.get("status")
    html = body.decode("utf-8", "replace") if body else ""
    title = page_title(html) if "html" in final.get("content_type", "") else ""
    result = {"http_status": status, "final_url": final.get("final_url"), "title": title,
              "error": final.get("error")}
    if status is None:
        result["outcome"] = "error"
    elif status in (401, 403, 429) or (status in (503, 202) and (final.get("cf_ray") or BLOCK_MARKERS.search(html))):
        result["outcome"] = "blocked"
    elif status in (404, 410) and (head.get("status") in (404, 410, None, 405, 403, 400, 501) or not get):
        result["outcome"] = "removed"
    elif status >= 500:
        result["outcome"] = "server-error"
    elif 200 <= status < 300:
        if BLOCK_MARKERS.search(title) or BODY_BLOCK_MARKERS.search(html) or \
                (urllib.parse.urlsplit(final["final_url"]).hostname or "").startswith("unblock."):
            result["outcome"] = "blocked"
        elif title and NOT_FOUND_TITLE.search(title):
            result["outcome"] = "soft-not-found"
        elif normal(link) == normal(final["final_url"]) or FILE_HOST.search(final["final_url"]):
            # Same address, or a download handed to a file host or signed link: the address still works.
            result["outcome"] = "live"
        elif normal(final["final_url"])[1] in ("", "/") and normal(link)[1] not in ("", "/"):
            result["outcome"] = "redirect-to-home"
        elif re.search(r"login|signin|sso|/auth|/abs/|access-denied|unauthori", final["final_url"], re.I):
            result["outcome"] = "redirect-to-login-or-abstract"
        elif same_document(link, final["final_url"]):
            result["outcome"] = "moved"
        else:
            # A redirect to a page with another name can be a site's guess for a missing page.
            result["outcome"] = "redirect-unclear"
    else:
        result["outcome"] = "other-status"
    return result


def check_federal_register(key, link, number):
    """FederalRegister.gov answers scripts with a CAPTCHA page, so its document pages are checked
    through the site's own public API instead: the document number in the address must exist there."""
    answer, body = request("GET", FEDERAL_REGISTER_API.format(number))
    result = {"key": key, "link": link, "head_status": None, "method": "federal-register-api",
              "http_status": answer.get("status"), "title": "", "error": answer.get("error"),
              "last_modified_header": None, "redirects": []}
    try:
        data = json.loads(body.decode("utf-8")) if answer.get("status") == 200 else {}
    except ValueError:
        data = {}
    if data.get("document_number") == number:
        result.update(outcome="live", final_url=data.get("html_url"))
    elif answer.get("status") == 404:
        result.update(outcome="removed", final_url=None)
    else:
        result.update(outcome="blocked" if answer.get("status") in (401, 403, 429) else "error", final_url=None)
    return result


def check_one(key, link, record):
    number = FEDERAL_REGISTER_DOCUMENT.match(link)
    if number:
        return check_federal_register(key, link, number.group(1))
    wants_date = (record.get("kind") == "web-page" and not (record.get("citation") or {}).get("issued"))
    head, _ = request("HEAD", link)
    get, body = None, b""
    head_ok = head.get("status") and 200 <= head["status"] < 300
    is_html = "html" in head.get("content_type", "") or not head.get("content_type")
    # A bot wall answers HEAD with 200 too, so an HTML page is always read; a PDF or other file is not.
    if not head_ok or is_html:
        get, body = request("GET", link)
    result = classify(link, head, get, body)
    result.update({"key": key, "link": link, "head_status": head.get("status"),
                   "last_modified_header": (get or head).get("last_modified_header"),
                   "redirects": (get or head).get("redirects", [])})
    is_home = normal(link)[1] in ("", "/")
    if wants_date and body and result["outcome"] in ("live", "moved") and not is_home:
        dates = meta_dates(body.decode("utf-8", "replace"))
        result["date_metadata"] = dates
        result["issued_found"] = choose_date(dates)
    return result


def check(work, limit=None, only_host=None, recheck=()):
    work = pathlib.Path(work)
    done = json.loads(work.read_text()) if work.exists() else {}
    done = {key: value for key, value in done.items() if value["outcome"] not in recheck}
    todo = []
    for path, record, link in sources():
        if not link or record["key"] in done:
            continue
        if only_host and host_of(link) != only_host:
            continue
        todo.append((record["key"], link, record))
    # Interleave sites so that the workers are not all waiting on one site's limit.
    by_host = {}
    for item in todo:
        by_host.setdefault(host_of(item[1]), []).append(item)
    queues = sorted(by_host.values(), key=len, reverse=True)
    todo = [queue[i] for i in range(max(map(len, queues), default=0)) for queue in queues if i < len(queue)]
    if limit:
        todo = todo[:limit]
    print(f"{len(done)} done, {len(todo)} to check", file=sys.stderr)
    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        futures = {pool.submit(check_one, *item): item[0] for item in todo}
        for number, future in enumerate(concurrent.futures.as_completed(futures), 1):
            result = future.result()
            done[result["key"]] = result
            if number % 100 == 0:
                work.write_text(json.dumps(done, indent=1, ensure_ascii=False))
                print(f"{number}/{len(todo)}", file=sys.stderr)
    work.write_text(json.dumps(done, indent=1, ensure_ascii=False))


# ---- writing records: edit blocks in place so comments and layout survive ----

TOP_KEY = re.compile(r"^[A-Za-z_][\w-]*:")


def block_span(lines, key):
    start = next((i for i, line in enumerate(lines) if line.startswith(f"{key}:")), None)
    if start is None:
        return None
    end = start + 1
    while end < len(lines) and not TOP_KEY.match(lines[end]):
        end += 1
    return start, end


def dump_block(key, value):
    return yaml.safe_dump({key: value}, allow_unicode=True, sort_keys=False, width=100).splitlines(keepends=True)


def set_block(lines, key, value, after=None):
    span = block_span(lines, key)
    new = dump_block(key, value)
    if span:
        lines[span[0]:span[1]] = new
    else:
        anchor = block_span(lines, after) if after else None
        position = anchor[1] if anchor else len(lines)
        lines[position:position] = new


def add_issued(lines, parts):
    span = block_span(lines, "citation")
    insert = ["  issued:\n", f"    date-parts: [[{', '.join(str(p) for p in parts)}]]\n"]
    accessed = next((i for i in range(span[0], span[1]) if lines[i].startswith("  accessed:")), None)
    position = accessed if accessed is not None else span[1]
    lines[position:position] = insert


def agreeing(review_csv):
    """Keys whose result a second, independent check (research/reviews/2026-11-22-source-links.csv,
    from the second gap review) agrees with: gone there and removed here, or moved there to the same
    address."""
    with open(review_csv, encoding="utf-8") as handle:
        return {row["key"]: row for row in csv.DictReader(handle)}


def apply(work, today, review_csv=None):
    results = json.loads(pathlib.Path(work).read_text())
    other = agreeing(review_csv) if review_csv else None
    counts = {}
    for path, record, link in sources():
        result = results.get(record["key"])
        if not result or result.get("link") != link:
            continue
        outcome = result["outcome"]
        if other is not None:
            row = other.get(record["key"])
            agrees = row and ((outcome == "removed" and row["category"] == "gone") or
                              (outcome == "moved" and row["moved_to_another_site"] == "True"
                               and normal(row["final"]) == normal(result["final_url"])))
            if not agrees:
                continue
            result = dict(result, issued_found=None)
        text = pathlib.Path(path).read_text(encoding="utf-8")
        lines = text.splitlines(keepends=True)
        changed = False
        if outcome in ("live", "moved", "removed"):
            history = dict(record.get("history") or {})
            status = {"live": "live", "moved": "moved", "removed": "removed"}[outcome]
            history["status"] = status
            history["last_checked"] = today
            if outcome == "moved":
                change = {"date": today, "before": link, "after": result["final_url"],
                          "summary": f"The address redirects to this page (HTTP {result['http_status']} there); "
                                     "found by scripts/review/source_links.py"
                                     + (" and the second gap review." if other is not None else ".")}
                history["changes"] = [c for c in history.get("changes", []) if c.get("after") != change["after"]]
                history["changes"].append(change)
            ordered = {k: history[k] for k in ("first_seen", "last_seen", "status", "last_checked", "changes")
                       if history.get(k) not in (None, "", [])}
            for k in ordered:
                if isinstance(ordered[k], datetime.date):
                    ordered[k] = ordered[k].isoformat()
            set_block(lines, "history", ordered, after="archives" if block_span(lines, "archives") else "retrieved")
            changed = True
            counts[status] = counts.get(status, 0) + 1
        found = result.get("issued_found")
        if found and not (record.get("citation") or {}).get("issued"):
            add_issued(lines, found["date_parts"])
            date = "-".join(f"{p:02d}" if i else str(p) for i, p in enumerate(found["date_parts"]))
            sentence = (f"Issued date {date} is the page's own {found['metadata']} metadata, read on {today}"
                        + (" (a last-modified date; the page gives no publication date)." if found["basis"] == "modified"
                           else "."))
            notes = (record.get("notes") or "").strip()
            set_block(lines, "notes", (notes + " " + sentence).strip())
            changed = True
            counts["issued-" + found["basis"]] = counts.get("issued-" + found["basis"], 0) + 1
        if changed:
            new = "".join(lines)
            yaml.safe_load(new)
            pathlib.Path(path).write_text(new, encoding="utf-8")
    print(json.dumps(counts, indent=1))


def main(argv):
    if len(argv) < 2:
        sys.exit(__doc__)
    command, work = argv[0], argv[1]
    if command == "check":
        limit = int(argv[argv.index("--limit") + 1]) if "--limit" in argv else None
        host = argv[argv.index("--host") + 1] if "--host" in argv else None
        recheck = argv[argv.index("--recheck") + 1].split(",") if "--recheck" in argv else ()
        check(work, limit, host, recheck)
    elif command == "apply":
        today = argv[argv.index("--date") + 1] if "--date" in argv else datetime.date.today().isoformat()
        apply(work, today, argv[argv.index("--agree") + 1] if "--agree" in argv else None)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
