"""Report how much of the dataset has been checked, and how closely.

Counts every cited fact in content/tribes/ by profile section and
verification level, plus dispute resolution coverage by Bureau of Indian
Affairs region, source archives and citator checks, method and glossary
status, outreach citations, and citation problems in content headed for an
edition. With --base, each count is shown beside the same count at that git
ref, so a pull request that adds unchecked data shows it.

Facts recorded before the `verification` field existed are sorted by the
wording of their own note (scripts/record_facts.py, NOTE_LEVELS) or, for a
source cited by 20 or more profiles, as a bulk import. Those guessed levels
are project analysis, reported apart from levels a record states.

Run from the repository root:
  python3 scripts/coverage_report.py
  python3 scripts/coverage_report.py --base origin/main --markdown coverage.md --json coverage.json
Requires the packages in scripts/requirements.txt.
"""

import argparse
import collections
import datetime
import json
import pathlib
import subprocess
import sys
import tarfile
import tempfile
import io

from lint_records import GRACE_DAYS, parse_date, source_problems
from record_facts import (
    CITATOR_KINDS, ENDED_STATUSES, UNVERIFIED, VERIFICATION_LEVELS, Tree, clause_change_gaps,
    level_from_note, profile_facts, section_of, source_links, version_sources,
)

GUESSED = ("inferred", "title-only", "bulk-import", "unstated")


def measure(tree, today):
    m = collections.OrderedDict()
    bulk_sources = tree.bulk_sources()
    method_ids = tree.method_ids()

    # Profiles and facts.
    sections = collections.defaultdict(collections.Counter)
    regions = collections.defaultdict(collections.Counter)
    recognition = collections.Counter()
    compacts = collections.Counter()
    m["profiles"] = len(tree.profiles)
    m["profiles with any dispute resolution record"] = 0
    m["profiles marked tribal_review_required"] = 0
    m["profiles not yet sent to the nation"] = 0
    for profile in tree.profiles.values():
        facts = profile_facts(profile)
        has_practice = any(path.startswith("dispute_resolution") for path, _ in facts)
        m["profiles with any dispute resolution record"] += has_practice
        if (profile.get("sensitivity") or {}).get("tribal_review_required"):
            m["profiles marked tribal_review_required"] += 1
        if (profile.get("review") or {}).get("status") == "drafted-from-public-sources":
            m["profiles not yet sent to the nation"] += 1
        types = {item.get("type") for item in profile.get("recognition") or []}
        label = "federal" if "federal" in types else "other"
        recognition[(label, has_practice)] += 1
        region = (profile.get("federal_administration") or {}).get("bureau_of_indian_affairs_region")
        if region:
            regions[region]["profiles"] += 1
            regions[region]["with a record"] += has_practice
        for path, fact in facts:
            row = sections[section_of(path)]
            row["facts"] += 1
            level = fact.get("verification")
            if level:
                row["stated " + level] += 1
            else:
                row["guessed " + (level_from_note(fact, bulk_sources) or "unstated")] += 1
            if fact.get("source") in bulk_sources:
                row["from bulk sources"] += 1
            if path == "gaming.compacts" and "dispute_resolution_summary" in fact:
                note = str(fact.get("note", ""))
                template = "model compact" in note or "nation-specific text not checked" in note
                compacts["copied from another nation's compact" if template else "read from the nation's compact"] += 1
            if path == "dispute_resolution.forums" and fact.get("kind") not in method_ids | {"other", None}:
                m["forums with a kind that has no method record"] = m.get("forums with a kind that has no method record", 0) + 1
    m["federally recognized profiles with a dispute resolution record"] = recognition[("federal", True)]
    m["federally recognized profiles without one"] = recognition[("federal", False)]
    m["other profiles with a dispute resolution record"] = recognition[("other", True)]
    m.setdefault("forums with a kind that has no method record", 0)
    totals = collections.Counter()
    for row in sections.values():
        totals.update(row)
    m["cited facts"] = totals["facts"]
    for level in VERIFICATION_LEVELS:
        m[f"facts stating {level}"] = totals["stated " + level]
    m["facts with no verification level"] = totals["facts"] - sum(totals["stated " + level] for level in VERIFICATION_LEVELS)
    for level in GUESSED:
        m[f"  of which the note suggests {level}"] = totals["guessed " + level]
    m["facts from sources cited by 20 or more profiles"] = totals["from bulk sources"]
    for label in ("read from the nation's compact", "copied from another nation's compact"):
        m[f"compact dispute clauses {label}"] = compacts[label]

    # Sources.
    sources = tree.sources
    linked = [s for s in sources.values() if source_links(s)]
    m["source records"] = len(sources)
    m["sources with a web address"] = len(linked)
    m["  with an archived copy"] = sum(1 for s in linked if s.get("archives"))
    m["  without one"] = sum(1 for s in linked if not s.get("archives"))
    m[f"  without one after {GRACE_DAYS} days"] = sum(
        1 for s in linked if not s.get("archives") and parse_date(s.get("retrieved"))
        and (today - parse_date(s.get("retrieved"))).days > GRACE_DAYS)
    legal = [s for s in sources.values() if s.get("kind") in CITATOR_KINDS]
    m["cases, statutes, regulations and court rules"] = len(legal)
    m["  with a citator result"] = sum(1 for s in legal if s.get("citator"))
    m["sources marked unverified in their notes"] = sum(
        1 for s in sources.values() if UNVERIFIED.search(str(s.get("notes", "")) + " " + str(s.get("annotation", ""))))
    m["sources with no issued date"] = sum(1 for s in sources.values() if not (s.get("citation") or {}).get("issued"))
    by_link = collections.defaultdict(set)
    for key, source in sources.items():
        for link in source_links(source):
            by_link[link].add(key)
    m["addresses shared by more than one source"] = sum(
        1 for keys in by_link.values() if len(keys) > 1 and not all(
            b in (sources[a].get("shares_link_with") or []) or a in (sources[b].get("shares_link_with") or [])
            for a in keys for b in keys if a < b))

    # Document histories (decision record 0018).
    documents = tree.documents
    versions = [v for record in documents.values() for v in record.get("versions") or []]
    m["document histories"] = len(documents)
    kinds = collections.Counter(str(record.get("kind")) for record in documents.values())
    for kind, count in sorted(kinds.items()):
        m[f"  of kind {kind}"] = count
    m["document versions"] = len(versions)
    m["  in effect"] = sum(1 for v in versions if v.get("status") == "in-effect")
    m["  no longer in effect"] = sum(1 for v in versions if v.get("status") in ENDED_STATUSES)
    m["  whose source names the version back"] = sum(
        1 for v in versions if (sources.get(v.get("source")) or {}).get("document_version"))
    m["  with a private capture"] = sum(1 for v in versions if v.get("capture"))
    m["  with an approval source"] = sum(1 for v in versions if (v.get("approval") or {}).get("source"))
    for level in VERIFICATION_LEVELS:
        m[f"  stating {level}"] = sum(1 for v in versions if v.get("verification") == level)
    clauses = [c for v in versions for c in v.get("clauses") or []]
    changes = [c for v in versions for c in v.get("changes") or []]
    m["key clauses recorded"] = len(clauses)
    m["  dispute resolution clauses"] = sum(1 for c in clauses if c.get("topic") == "dispute-resolution")
    m["clause changes recorded"] = len(changes)
    for kind in ("changed", "reworded", "unchanged", "not-compared"):
        m[f"  {kind}"] = sum(1 for c in changes if c.get("change") == kind)
    m["clause topics with no recorded change"] = sum(
        len(clause_change_gaps(v, {x.get("id"): x for x in record.get("versions") or []}))
        for record in documents.values() for v in record.get("versions") or [])
    by_source = version_sources(documents)
    m["profile facts citing a version no longer in effect without naming it"] = sum(
        1 for profile in tree.profiles.values() for _, fact in profile_facts(profile)
        if not fact.get("document_version")
        and any(v.get("status") in ENDED_STATUSES for _, v in by_source.get(fact["source"], [])))

    # Methods, glossary, outreach.
    for kind, pattern in (("methods", "content/methods/*.yaml"), ("glossary entries", "content/glossary/*.yaml")):
        statuses = collections.Counter(str(r.get("status")) for _, r in tree.yaml_records(pattern))
        for status, count in sorted(statuses.items()):
            m[f"{kind} {status}"] = count
    outreach = collections.Counter()
    for _, record in tree.yaml_records("research/outreach/*.yaml"):
        for source in record.get("sources") or []:
            outreach[source.get("verification")] += 1
    m["outreach citations page-read"] = outreach["page-read"]
    m["outreach citations search-result-only"] = outreach["search-result-only"]

    # Edition content.
    pairs = problems = 0
    for _, _, keys in tree.edition_citations():
        for key in keys:
            if key in sources:
                pairs += 1
                problems += bool(source_problems(sources[key]))
    m["citations in edition content"] = pairs
    m["  citing a source that is unarchived, lacks a citator result or is marked unverified"] = problems

    return {
        "summary": m,
        "sections": {name: dict(row) for name, row in sorted(sections.items())},
        "regions": {name: dict(row) for name, row in sorted(regions.items())},
    }


def base_tree(ref, directory):
    """Extract the records at a git ref into a directory and read them."""
    archive = subprocess.run(
        ["git", "archive", "--format=tar", ref, "content", "research/outreach"],
        check=True, capture_output=True,
    ).stdout
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        tar.extractall(directory, filter="data")
    return Tree(directory)


def markdown(now, base, base_label):
    def cell(value):
        return f"{value:,}" if isinstance(value, int) else str(value)

    def change(new, old):
        if old is None:
            return "new"
        diff = new - old
        return "" if diff == 0 else f"{diff:+,}"

    lines = ["# Data coverage report", ""]
    lines.append("Generated by `scripts/coverage_report.py`. Levels marked \"note suggests\" are guessed from "
                 "each fact's note because the fact predates the `verification` field (decision record 0014).")
    lines.append("")
    heading = "| Measure | Now |" + (f" {base_label} | Change |" if base else "")
    rule = "| --- | ---: |" + (" ---: | ---: |" if base else "")
    lines += ["## Summary", "", heading, rule]
    for name, value in now["summary"].items():
        row = f"| {name.replace('  ', '&nbsp;&nbsp;')} | {cell(value)} |"
        if base:
            old = base["summary"].get(name)
            row += f" {cell(old) if old is not None else ''} | {change(value, old)} |"
        lines.append(row)

    columns = ["facts"] + [f"stated {l}" for l in VERIFICATION_LEVELS] + [f"guessed {l}" for l in GUESSED] + ["from bulk sources"]
    titles = ["Facts"] + [l.replace("-", " ") for l in VERIFICATION_LEVELS] + [f"note suggests {l.replace('-', ' ')}" for l in GUESSED] + ["From bulk sources"]
    lines += ["", "## Profile facts by section", "", "| Section | " + " | ".join(titles) + " |",
              "| --- |" + " ---: |" * len(columns)]
    for name, row in now["sections"].items():
        lines.append(f"| `{name}` | " + " | ".join(cell(row.get(c, 0)) for c in columns) + " |")

    lines += ["", "## Dispute resolution records by Bureau of Indian Affairs region", "",
              "| Region | Federally recognized profiles | With any record |", "| --- | ---: | ---: |"]
    for name, row in now["regions"].items():
        lines.append(f"| {name} | {row.get('profiles', 0)} | {row.get('with a record', 0)} |")
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base", help="git ref to compare against")
    parser.add_argument("--markdown", type=pathlib.Path, help="write the Markdown report here (default: print it)")
    parser.add_argument("--json", type=pathlib.Path, help="also write the counts as JSON")
    parser.add_argument("--today", type=datetime.date.fromisoformat, default=datetime.date.today())
    arguments = parser.parse_args()

    now = measure(Tree("."), arguments.today)
    base = None
    if arguments.base:
        with tempfile.TemporaryDirectory() as directory:
            base = measure(base_tree(arguments.base, directory), arguments.today)
    text = markdown(now, base, f"`{arguments.base}`" if arguments.base else "")
    if arguments.markdown:
        arguments.markdown.write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)
    if arguments.json:
        arguments.json.write_text(json.dumps({"now": now, "base": base}, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
