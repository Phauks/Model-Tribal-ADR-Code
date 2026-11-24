"""Find or make Wayback Machine captures for source records that have none.

For every content/sources/<letter>/<key>.yaml record with an 'original_link'
and an empty 'archives' list:

  - with --save, ask Save Page Now (https://web.archive.org/save/) for a new
    capture; then
  - ask the availability service for the capture closest to today (or, without
    --save, closest to the record's 'retrieved' date).

It prints a YAML snippet per record and, with --report FILE, writes the
results as JSON. A capture of another site than the original link (a block
page, or a signed download link that carries a temporary access token) is
reported for a person to check instead of being offered as a capture. It never edits records: a person or a later commit copies the
links in, so every change to a record stays reviewable.

Service documentation: https://archive.org/help/wayback_api.php and
https://web.archive.org/save/ (anonymous Save Page Now is rate limited, so the
script waits between requests).

Run from the repository root:
  python3 scripts/find_archived_copies.py [--save] [--reuse-days D] [--state FILE] [--limit N] [--minutes M] [--report FILE] [key ...]

--limit N stops after N records, so a large backlog is worked through over
several runs instead of one very long one. --reuse-days D first asks the
availability service for an existing capture and uses it, without a new save,
when it was taken within D days of the record's 'retrieved' date; a lookup
takes about a second, a save about a minute, so this clears most records
quickly. Without --save, a capture further than D days away is reported as
too far from the retrieval date instead of being offered. --state FILE keeps,
between runs, which records were looked up with no recent capture and when a
save was last tried: records not yet looked up come first, a record looked up
in the last 7 days goes straight to a save, and a record whose save failed in
the last day is skipped, so slow or refused saves do not crowd out quick
lookups. All lookups run before any save, so
every record that already has a usable capture is cleared first. --minutes M
stops starting new records after M minutes, so a run finishes inside a job's time limit even when
the service is slow. The report is rewritten after every record, so a run that
is stopped part way keeps what it captured.
Two kinds of link are treated differently. A link already on archive.org is
itself in the Internet Archive, so it is skipped. A link to a fixed published
document (FIXED_DOCUMENT_HOSTS: Federal Register documents, GovInfo, Library of
Congress items and the Kappler treaty texts) takes an existing capture of any
age, because the document at that address does not change; such a record is
looked up once that way even if its state says it was looked up recently.
Uses only the Python standard library, plus PyYAML from requirements.txt.
"""

import datetime
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import yaml

AVAILABILITY_SERVICE = "https://archive.org/wayback/available"
SAVE_SERVICE = "https://web.archive.org/save/"
CAPTURE_LINK = re.compile(r"/web/(\d{14})[a-z_]*/(.*)$")
HEADERS = {"User-Agent": "source-archiver/1.0"}
SECONDS_BETWEEN_SAVES = 20
SECONDS_BEFORE_RETRY = 60
SAVE_TIMEOUT = 120
DAYS_BEFORE_LOOKING_AGAIN = 7
DAYS_BEFORE_SAVING_AGAIN = 1
# Sites whose links name a published document that never changes, so a
# capture of any age is a capture of the same document.
FIXED_DOCUMENT_HOSTS = ("federalregister.gov", "govinfo.gov", "loc.gov", "treaties.okstate.edu")
# A link here is already in the Internet Archive.
INTERNET_ARCHIVE_HOSTS = ("archive.org",)


class RedirectedCapture(Exception):
    """The capture is of another address, such as a login wall or a signed download link."""


def as_capture(link: str, stamp: str) -> dict:
    return {
        "service": "wayback",
        "link": link.replace("http://web.archive.org", "https://web.archive.org", 1),
        "captured": f"{stamp[0:4]}-{stamp[4:6]}-{stamp[6:8]}",
    }


def closest_capture(link: str, near_date: str):
    """Ask the availability service, waiting once and trying again if it says too many requests."""
    try:
        return closest_capture_once(link, near_date)
    except urllib.error.HTTPError as error:
        if error.code != 429:
            raise
        time.sleep(SECONDS_BEFORE_RETRY)
        return closest_capture_once(link, near_date)


def closest_capture_once(link: str, near_date: str):
    query = urllib.parse.urlencode({"url": link, "timestamp": near_date.replace("-", "")})
    request = urllib.request.Request(f"{AVAILABILITY_SERVICE}?{query}", headers=HEADERS)
    with urllib.request.urlopen(request, timeout=60) as response:
        answer = json.load(response)
    closest = answer.get("archived_snapshots", {}).get("closest")
    if not closest or not closest.get("available") or closest.get("status") != "200":
        return None
    return as_capture(closest["url"], closest["timestamp"])


def host_of(link: str) -> str:
    host = urllib.parse.urlsplit(link).hostname or ""
    return host.removeprefix("www.")


def as_request_link(link: str) -> str:
    """Percent-encode spaces and other characters a request line cannot carry, leaving the link's own encoding alone."""
    return urllib.parse.quote(link.strip(), safe=":/?#[]@!$&'()*+,;=%~")


def on_hosts(link: str, hosts) -> bool:
    host = host_of(link)
    return any(host == known or host.endswith("." + known) for known in hosts)


def save_capture(link: str):
    """Request a new capture. Returns it when the service names one, otherwise None.

    Raises RedirectedCapture when the page redirected to another site, because
    that capture may be a block page or a signed link that should not be
    published; a person checks those by hand."""
    request = urllib.request.Request(SAVE_SERVICE + as_request_link(link), headers=HEADERS)
    with urllib.request.urlopen(request, timeout=SAVE_TIMEOUT) as response:
        final_link = response.geturl()
        location = response.headers.get("Content-Location", "")
    for candidate in (final_link, location):
        match = CAPTURE_LINK.search(candidate or "")
        if match:
            captured_address = match.group(2)
            if host_of(captured_address) != host_of(link):
                raise RedirectedCapture(f"the page redirected to {host_of(captured_address)}; check it by hand")
            if candidate.startswith("/"):
                candidate = "https://web.archive.org" + candidate
            return as_capture(candidate, match.group(1))
    return None


def save_with_retry(link: str):
    """Ask Save Page Now once; when it says too many requests or refuses the connection, pause before the next record.

    Trying the same record again at once rarely works and doubles the wait, so
    a failed record is left for a later run instead. Only a 429 or a refused
    connection means the service wants us to slow down. A timeout or a 5xx
    answer is about that one page (the save already waited up to
    SAVE_TIMEOUT), so the next record follows after the usual
    SECONDS_BETWEEN_SAVES."""
    try:
        return save_capture(link)
    except RedirectedCapture:
        raise
    except urllib.error.HTTPError as error:
        if error.code == 429:
            time.sleep(SECONDS_BEFORE_RETRY)
        raise
    except OSError as error:
        reason = getattr(error, "reason", error)
        if isinstance(reason, ConnectionRefusedError):
            time.sleep(SECONDS_BEFORE_RETRY)
        raise


def days_apart(first: str, second: str) -> int:
    try:
        return abs((datetime.date.fromisoformat(first) - datetime.date.fromisoformat(second)).days)
    except ValueError:
        return 10**6


def read_state(state_path):
    if not state_path:
        return {}
    try:
        return json.loads(pathlib.Path(state_path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def recent(date: str, today: str, days: int) -> bool:
    return bool(date) and days_apart(date, today) < days


def write_report(report_path: str, results) -> None:
    """Write JSON through a temporary file, so a run stopped mid-write leaves the last whole file."""
    temporary = pathlib.Path(report_path + ".partial")
    temporary.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    temporary.replace(report_path)


def main(arguments: list[str]) -> int:
    save = "--save" in arguments
    report_path, limit, minutes = None, None, None
    if "--report" in arguments:
        report_path = arguments[arguments.index("--report") + 1]
    if "--limit" in arguments:
        limit = int(arguments[arguments.index("--limit") + 1])
    if "--minutes" in arguments:
        minutes = float(arguments[arguments.index("--minutes") + 1])
    reuse_days = None
    if "--reuse-days" in arguments:
        reuse_days = int(arguments[arguments.index("--reuse-days") + 1])
    state_path = None
    if "--state" in arguments:
        state_path = arguments[arguments.index("--state") + 1]
    option_values = {arguments[index + 1] for index, argument in enumerate(arguments[:-1]) if argument in ("--report", "--limit", "--minutes", "--reuse-days", "--state")}
    started = time.monotonic()
    keys = [argument for argument in arguments if not argument.startswith("--") and argument not in option_values]

    paths = sorted(pathlib.Path("content/sources").glob("*/*.yaml"))
    if keys:
        paths = [path for path in paths if path.stem in keys]
    today = datetime.date.today().isoformat()
    state = read_state(state_path)
    candidates = []
    for path in paths:
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if record.get("archives") or not record.get("original_link"):
            continue
        if on_hosts(record["original_link"], INTERNET_ARCHIVE_HOSTS):
            continue
        seen = state.get(path.stem, {})
        if save and reuse_days is not None and recent(seen.get("save_failed", ""), today, DAYS_BEFORE_SAVING_AGAIN):
            continue
        candidates.append((path, record, seen))
    # Least recently tried saves first.
    candidates.sort(key=lambda item: item[2].get("save_failed", ""))
    results = {}
    tried = 0

    def out_of_time() -> bool:
        if limit is not None and tried >= limit:
            print(f"Stopped at --limit {limit}; run again for the rest.")
            return True
        if minutes is not None and time.monotonic() - started >= minutes * 60:
            print(f"Stopped after --minutes {minutes:g}; run again for the rest.")
            return True
        return False

    def finish(path, link, capture, problem) -> None:
        results[path.stem] = {"key": path.stem, "path": str(path), "original_link": link, "capture": capture, "problem": problem}
        if capture:
            print(f"# {path.stem}\narchives:\n  - service: wayback\n    link: {capture['link']}\n    captured: {capture['captured']}", flush=True)
            state.pop(path.stem, None)
        else:
            print(f"# {path.stem}: no capture ({problem or 'none found'})", flush=True)
        if report_path:
            write_report(report_path, list(results.values()))
        if state_path:
            write_report(state_path, state)

    # First pass: look up existing captures, about two seconds each, so every
    # record that already has a usable capture is cleared before any slow save.
    stopped = False
    needs_save = []
    for path, record, seen in candidates:
        link = record["original_link"]
        retrieved = str(record.get("retrieved") or today)[:10]
        fixed = on_hosts(link, FIXED_DOCUMENT_HOSTS)
        looked_up_recently = recent(seen.get("looked_up", ""), today, DAYS_BEFORE_LOOKING_AGAIN)
        if reuse_days is None or (looked_up_recently and (not fixed or seen.get("looked_up_any_age"))):
            needs_save.append((path, record))
            continue
        if out_of_time():
            stopped = True
            break
        tried += 1
        problem = None
        try:
            existing = closest_capture(link, retrieved)
        except OSError as error:
            existing, problem = None, f"lookup failed ({error})"
        time.sleep(1)
        if existing and (fixed or days_apart(existing["captured"], retrieved) <= reuse_days):
            finish(path, link, existing, None)
            continue
        if problem is None:
            state.setdefault(path.stem, {})["looked_up"] = today
            if fixed:
                state[path.stem]["looked_up_any_age"] = today
        if existing:
            problem = f"closest capture ({existing['captured']}) is more than {reuse_days} days from the retrieval date"
        if save:
            needs_save.append((path, record))
        finish(path, link, None, problem)

    # Second pass: ask Save Page Now for the rest (or, without --reuse-days,
    # look up the capture closest to the retrieval date).
    for path, record in [] if stopped else needs_save:
        if out_of_time():
            break
        link = record["original_link"]
        retrieved = str(record.get("retrieved") or today)[:10]
        if path.stem not in results:
            tried += 1
        capture, problem = None, None
        if save:
            try:
                capture = save_with_retry(link)
            except RedirectedCapture as error:
                problem = str(error)
            except Exception as error:  # one bad link must not end the run
                problem = f"save failed ({error})"
            if capture is None:
                state.setdefault(path.stem, {})["save_failed"] = today
            time.sleep(SECONDS_BETWEEN_SAVES)
        if capture is None:
            try:
                capture = closest_capture(link, today if save else retrieved)
                if capture and reuse_days is not None and not on_hosts(link, FIXED_DOCUMENT_HOSTS) and days_apart(capture["captured"], retrieved) > reuse_days:
                    problem = (problem + "; " if problem else "") + f"closest capture ({capture['captured']}) is more than {reuse_days} days from the retrieval date"
                    capture = None
            except OSError as error:
                problem = (problem + "; " if problem else "") + f"lookup failed ({error})"
            time.sleep(1)
        finish(path, link, capture, problem)
    results = list(results.values())
    if report_path:
        write_report(report_path, results)
    if state_path:
        write_report(state_path, state)
    found = sum(1 for result in results if result["capture"])
    print(f"\n{found} of {len(results)} records have a capture.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
