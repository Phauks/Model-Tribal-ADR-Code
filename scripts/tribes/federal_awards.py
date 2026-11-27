#!/usr/bin/env python3
"""Federal awards to each nation's government, from USAspending.gov.

Gives each federally recognized nation's page a "Federal awards" line in Key
facts: the money federal agencies obligated to the nation's government in the
latest complete fiscal year, broken down by agency (Trevor asked for federal
awards on Nov. 27, 2026; research/analyses/2026-11-27-audio-video-and-more-sources.md,
rank 2). Steps:

  recipients  Write research/federal-awards/<date>/recipients-fy<year>.csv:
              every recipient USAspending lists as an "Indian/Native American
              Tribal Government" for the fiscal year, with its recipient id,
              UEI number and the amount on transactions so tagged.
  match       Write research/federal-awards/crosswalk.csv: each recipient, the
              nation profile it is the government of (or none) and how that
              was decided. Rows decided by a person or a review keep their
              decision when the step runs again.
  amounts     Write research/federal-awards/<date>/fy<year>-by-agency.csv: for
              each accepted recipient, every awarding agency and the amount it
              obligated to that recipient in the year, on all of the
              recipient's transactions (not only those tagged as a tribal
              government), as USAspending's own search totals them.

Only the nation's government is credited (Trevor chose this on Nov. 27, 2026,
mockup design/federal-awards/). Consortia, intertribal organizations, health
corporations, housing authorities, school boards, colleges and businesses are
left out, even when their names name one nation, because they are separate
bodies. A nation with more than one government recipient (two UEI numbers)
has their amounts added together.

Usage:
  python3 scripts/tribes/federal_awards.py recipients
  python3 scripts/tribes/federal_awards.py match
  python3 scripts/tribes/federal_awards.py amounts

The API needs no key. Raw answers are saved in the project files capture
folder (research/captures/federal-awards/) as the private copy.
"""
import csv
import difflib
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from federal_programs import loose, norm, profiles  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
FISCAL_YEAR = 2026
DATE = "2026-11-27"
PERIOD = {"start_date": f"{FISCAL_YEAR - 1}-10-01", "end_date": f"{FISCAL_YEAR}-09-30"}
FOLDER = ROOT / "research" / "federal-awards"
RECIPIENTS = FOLDER / DATE / f"recipients-fy{FISCAL_YEAR}.csv"
CROSSWALK = FOLDER / "crosswalk.csv"
AMOUNTS = FOLDER / DATE / f"fy{FISCAL_YEAR}-by-agency.csv"
SELF_GOVERNANCE = ROOT / "research" / "self-governance" / "crosswalk.csv"
CAPTURES = Path("/mnt/project-files/research/captures/federal-awards")
API = "https://api.usaspending.gov/api/v2/search/spending_by_category"

# Words in a recipient's name that mark a body other than the government itself.
BODY = re.compile(
    r"\b(consortium|consortia|health|hospital|clinic|medical|housing|authority|school|schools|board of education|"
    r"college|university|academy|corp|corporation|inc|incorporated|llc|l l c|enterprise|enterprises|foundation|"
    r"association|assn|intertribal|inter tribal|services|utility|utilities|industry|industries|development|"
    r"commission|committee|club|center|centre|alliance|conference|organization|council of governments|"
    r"united tribes|federation|fund|bank|company|co|holdings|gaming|casino|chapter|district)\b"
)

FIELDS = ["uei", "recipient_id", "name", "profile", "profile_name", "method", "accept", "decided_by", "note"]


def post(endpoint: str, body: dict) -> dict:
    data = json.dumps(body).encode()
    for attempt in range(5):
        try:
            request = urllib.request.Request(f"{API}/{endpoint}/", data=data, headers={"Content-Type": "application/json", "User-Agent": "tribal-law-project-data/1.0"})
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.load(response)
        except Exception as error:  # noqa: BLE001
            if attempt == 4:
                raise
            print(f"retrying after {error}", file=sys.stderr)
            time.sleep(2 ** attempt)
    raise RuntimeError("unreachable")


def save_capture(name: str, value) -> None:
    if CAPTURES.parent.exists():
        CAPTURES.mkdir(parents=True, exist_ok=True)
        (CAPTURES / name).write_text(json.dumps(value, indent=1), encoding="utf-8")


def recipients() -> None:
    rows, pages, page = [], [], 1
    while True:
        answer = post("recipient", {"filters": {"time_period": [PERIOD], "recipient_type_names": ["indian_native_american_tribal_government"]}, "limit": 100, "page": page})
        pages.append(answer)
        for item in answer["results"]:
            rows.append({"recipient_id": item["recipient_id"], "uei": item.get("uei") or "", "name": item["name"] or "", "amount_tagged": f"{item['amount']:.2f}"})
        if not answer["page_metadata"]["hasNext"]:
            break
        page += 1
    save_capture(f"recipients-fy{FISCAL_YEAR}-{DATE}.json", pages)
    RECIPIENTS.parent.mkdir(parents=True, exist_ok=True)
    with open(RECIPIENTS, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["recipient_id", "uei", "name", "amount_tagged"], lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"{len(rows)} recipients -> {RECIPIENTS.relative_to(ROOT)}")


def read_csv(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def match() -> None:
    people = profiles()
    exact, loose_index = {}, {}
    for identifier, entry in people.items():
        for name in entry["names"]:
            exact.setdefault(norm(name), identifier)
            loose_index.setdefault(loose(name), set()).add(identifier)
    # USAspending names the self-governance study already matched to a profile.
    earlier = {}
    if SELF_GOVERNANCE.exists():
        for row in read_csv(SELF_GOVERNANCE):
            if row["list"].startswith("spending") and row["accept"] == "yes" and row["profile"]:
                earlier[norm(row["name"])] = row["profile"]
    previous = {row["recipient_id"]: row for row in read_csv(CROSSWALK)} if CROSSWALK.exists() else {}
    rows = []
    for item in read_csv(RECIPIENTS):
        old = previous.get(item["recipient_id"])
        if old and old["decided_by"] != "script":
            rows.append(old)
            continue
        name = item["name"]
        profile, method = "", "none"
        body = bool(BODY.search(norm(name)))
        if norm(name) in exact:
            profile, method = exact[norm(name)], "exact"
        elif norm(name) in earlier:
            profile, method = earlier[norm(name)], "self-governance-crosswalk"
        else:
            candidates = loose_index.get(loose(name), set()) if loose(name) else set()
            if len(candidates) == 1:
                profile, method = next(iter(candidates)), "loose"
            elif loose(name):
                close = difflib.get_close_matches(loose(name), list(loose_index), 1, 0.88)
                if close and len(loose_index[close[0]]) == 1:
                    profile, method = next(iter(loose_index[close[0]])), "close"
        # An exact name is the government; anything else waits for review.
        accept = "yes" if method == "exact" and not body else ""
        note = "name suggests a separate body" if body else ""
        rows.append({"uei": item["uei"], "recipient_id": item["recipient_id"], "name": name, "profile": profile,
                     "profile_name": people.get(profile, {}).get("official", ""), "method": method,
                     "accept": accept, "decided_by": "script", "note": note})
    with open(CROSSWALK, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    counts = {}
    for row in rows:
        counts[(row["method"], row["accept"])] = counts.get((row["method"], row["accept"]), 0) + 1
    print(f"{len(rows)} rows -> {CROSSWALK.relative_to(ROOT)}; {sorted(counts.items())}")


def tokens(text: str) -> set[str]:
    """The words of a name that can carry identity, parenthesized parts included."""
    return {word for word in loose(text.replace("(", " ").replace(")", " ")).split() if len(word) > 2}


def review(folder: str, size: str = "130") -> None:
    """Write the rows still undecided, each with its likeliest profiles, as JSON batches for review.

    A row whose name shares no word with any nation's names (cities,
    counties, states, companies) is decided here: no nation's government.
    """
    people = profiles()
    names = [(identifier, name) for identifier, entry in people.items() for name in entry["names"]]
    word_index: dict[str, set[str]] = {}
    for identifier, name in names:
        for word in tokens(name):
            word_index.setdefault(word, set()).add(identifier)
    rows = read_csv(CROSSWALK)
    pending = []
    for row in rows:
        if row["accept"] or row["decided_by"] != "script":
            continue
        words = tokens(row["name"])
        hits: dict[str, int] = {}
        for word in words:
            for identifier in word_index.get(word, ()):
                hits[identifier] = hits.get(identifier, 0) + 1
        if not hits and not row["profile"]:
            row.update(accept="no", note="no nation's name in it")
            continue
        def score(identifier: str) -> float:
            best = max(difflib.SequenceMatcher(None, norm(row["name"]), norm(name)).ratio() for name in people[identifier]["names"])
            return hits[identifier] + best
        candidates = sorted(hits, key=score, reverse=True)[:6] if hits else []
        if row["profile"] and row["profile"] not in candidates:
            candidates = [row["profile"], *candidates[:5]]
        pending.append({"recipient_id": row["recipient_id"], "name": row["name"],
                        "candidates": [{"profile": c, "names": people[c]["names"][:4], "states": people[c]["states"]} for c in candidates]})
    with open(CROSSWALK, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    out = Path(folder)
    out.mkdir(parents=True, exist_ok=True)
    step = int(size)
    for start in range(0, len(pending), step):
        (out / f"batch-{start // step + 1:02d}.json").write_text(json.dumps(pending[start:start + step], indent=1), encoding="utf-8")
    print(f"{len(pending)} rows to review in {(len(pending) + step - 1) // step} batches -> {out}")


def decide(path: str, by: str = "haiku") -> None:
    """Merge review decisions (CSV: recipient_id, profile, accept, note) into the crosswalk."""
    people = profiles()
    decisions = {row["recipient_id"]: row for row in read_csv(Path(path))}
    rows = read_csv(CROSSWALK)
    changed = 0
    for row in rows:
        decision = decisions.get(row["recipient_id"])
        if not decision:
            continue
        profile = decision["profile"].strip() if decision["accept"].strip() == "yes" else ""
        if profile and profile not in people:
            print(f"unknown profile {profile!r} for {row['name']}", file=sys.stderr)
            continue
        row.update(profile=profile, profile_name=people.get(profile, {}).get("official", ""),
                   accept=decision["accept"].strip(), decided_by=by, note=decision.get("note", "").strip())
        changed += 1
    with open(CROSSWALK, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"{changed} rows decided by {by}")


def amounts() -> None:
    accepted = [row for row in read_csv(CROSSWALK) if row["accept"] == "yes" and row["profile"]]
    out, captured = [], {}
    for index, row in enumerate(accepted, 1):
        answer = post("awarding_agency", {"filters": {"time_period": [PERIOD], "recipient_id": row["recipient_id"]}, "limit": 100, "page": 1})
        captured[row["recipient_id"]] = answer
        for item in answer["results"]:
            out.append({"profile": row["profile"], "uei": row["uei"], "recipient_id": row["recipient_id"], "recipient_name": row["name"],
                        "agency": item["name"], "amount": f"{item['amount']:.2f}"})
        if index % 50 == 0:
            print(f"{index}/{len(accepted)}", file=sys.stderr)
    save_capture(f"fy{FISCAL_YEAR}-by-agency-{DATE}.json", captured)
    out.sort(key=lambda r: (r["profile"], r["recipient_id"], -float(r["amount"])))
    with open(AMOUNTS, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["profile", "uei", "recipient_id", "recipient_name", "agency", "amount"], lineterminator="\n")
        writer.writeheader()
        writer.writerows(out)
    print(f"{len(out)} rows for {len({r['profile'] for r in out})} nations -> {AMOUNTS.relative_to(ROOT)}")


if __name__ == "__main__":
    steps = {"recipients": recipients, "match": match, "review": review, "decide": decide, "amounts": amounts}
    if len(sys.argv) < 2 or sys.argv[1] not in steps:
        sys.exit(__doc__)
    steps[sys.argv[1]](*sys.argv[2:])
