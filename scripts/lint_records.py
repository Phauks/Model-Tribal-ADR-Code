"""Catch unchecked data before it builds up (decision record 0014).

Checks:
  verification      every cited fact in a profile says how it was checked
                    (`verification`: read-in-full, title-only, bulk-import or
                    inferred; schemas/common.schema.json)
  duplicate-link    no two source records share an address, ignoring the
                    scheme, 'www.', a trailing slash and an index page, unless
                    they list each other in `shares_link_with`
  forum-kind        every dispute resolution forum `kind` names a method record
                    in content/methods/ (or is 'other')
  archive           every source with a web address has an archived copy once
                    the grace period after `retrieved` has passed
  edition-citation  every source cited by content headed for an edition
                    (essays, provisions, commentary, glossary) is archived,
                    has a citator result if it is a case, statute, regulation
                    or court rule, and is not marked unverified in its notes

Which problems fail the run:
  - With --base REF (pull requests): problems in facts and source records
    that the pull request adds or changes. Older problems are counted as
    warnings, so they show up without blocking unrelated work; the coverage
    report (scripts/coverage_report.py) tracks them until they are fixed.
  - Edition citations fail when the citing file is stable, adopted or final,
    and always with --edition (run before exporting an edition).
  - Without --base, nothing fails except edition citations; everything is
    reported as a warning.

Run from the repository root:
  python3 scripts/lint_records.py                      # report only
  python3 scripts/lint_records.py --base origin/main   # as on a pull request
  python3 scripts/lint_records.py --edition            # before an edition
Requires the packages in scripts/requirements.txt.
"""

import argparse
import collections
import datetime
import sys

from record_facts import (
    CITATOR_KINDS, UNVERIFIED, Tree, changed_files, fact_identity, file_at, load_yaml,
    profile_facts, source_links,
)

GRACE_DAYS = 30
STRICT_STATUSES = {"stable", "adopted", "final"}
SHOWN_PER_CHECK = 15


class Report:
    def __init__(self):
        self.errors = collections.defaultdict(list)
        self.warnings = collections.defaultdict(list)

    def add(self, check, message, error):
        (self.errors if error else self.warnings)[check].append(message)

    def print(self):
        for label, bucket in (("error", self.errors), ("warning", self.warnings)):
            for check in sorted(bucket):
                messages = bucket[check]
                for message in messages[:SHOWN_PER_CHECK]:
                    print(f"{label} [{check}] {message}")
                if len(messages) > SHOWN_PER_CHECK:
                    print(f"{label} [{check}] ... and {len(messages) - SHOWN_PER_CHECK} more")
        totals = lambda bucket: ", ".join(f"{check} {len(m)}" for check, m in sorted(bucket.items())) or "none"
        print(f"\nErrors: {totals(self.errors)}")
        print(f"Warnings: {totals(self.warnings)}")


def new_fact_identities(tree, base):
    """For each profile changed since `base`, the identities of facts that are
    new or changed. None when there is no base (everything is old)."""
    if not base:
        return None
    result = {}
    for file in changed_files(base, ["content/tribes"]):
        if file not in tree.profiles:
            continue
        old_text = file_at(base, file)
        old_facts = set()
        if old_text:
            old_facts = {fact_identity(path, fact) for path, fact in profile_facts(load_yaml(old_text) or {})}
        result[file] = {fact_identity(path, fact) for path, fact in profile_facts(tree.profiles[file])} - old_facts
    return result


def is_new(new_facts, file, path, fact):
    return new_facts is not None and fact_identity(path, fact) in new_facts.get(file, set())


def check_profiles(tree, report, new_facts, method_ids):
    for file, profile in tree.profiles.items():
        for path, fact in profile_facts(profile):
            new = is_new(new_facts, file, path, fact)
            if "verification" not in fact:
                report.add("verification", f"{file}: {path} (source {fact['source']}) has no verification level", new)
            if path == "dispute_resolution.forums":
                kind = fact.get("kind")
                if kind and kind != "other" and kind not in method_ids:
                    report.add("forum-kind", f"{file}: forum kind '{kind}' has no record in content/methods/", new)


def check_sources(tree, report, changed_sources, today, grace_days):
    by_link = collections.defaultdict(set)
    for key, source in tree.sources.items():
        for link in source_links(source):
            by_link[link].add(key)
    for link, keys in sorted(by_link.items()):
        if len(keys) < 2:
            continue
        shares = {key: set(tree.sources[key].get("shares_link_with") or []) for key in keys}
        explained = all(b in shares[a] or a in shares[b] for a in keys for b in keys if a < b)
        if not explained:
            new = any(tree.sources[key]["_file"] in changed_sources for key in keys)
            report.add("duplicate-link", f"{', '.join(sorted(keys))} share {link}; merge them, or list each other in shares_link_with if they are different documents", new)

    for key, source in tree.sources.items():
        if source.get("archives") or not source_links(source):
            continue
        retrieved = parse_date(source.get("retrieved"))
        if retrieved is None or (today - retrieved).days <= grace_days:
            continue
        new = source["_file"] in changed_sources
        report.add("archive", f"{source['_file']}: no archived copy {(today - retrieved).days} days after retrieval (grace period {grace_days} days)", new)


def source_problems(source):
    problems = []
    if source_links(source) and not source.get("archives"):
        problems.append("no archived copy")
    if source.get("kind") in CITATOR_KINDS and not source.get("citator"):
        problems.append(f"no citator result for a {source.get('kind')}")
    if UNVERIFIED.search(str(source.get("notes", ""))) or UNVERIFIED.search(str(source.get("annotation", ""))):
        problems.append("marked unverified in its notes")
    return problems


def check_edition(tree, report, edition):
    for file, status, keys in tree.edition_citations():
        strict = edition or status in STRICT_STATUSES
        for key in keys:
            source = tree.sources.get(key)
            if source is None:
                continue  # scripts/validate_records.py reports unknown keys
            for problem in source_problems(source):
                report.add("edition-citation", f"{file} ({status}) cites {key}: {problem}", strict)


def parse_date(value):
    if isinstance(value, datetime.date):
        return value
    try:
        return datetime.date.fromisoformat(str(value))
    except ValueError:
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base", help="git ref to compare against; problems added since it fail the run")
    parser.add_argument("--edition", action="store_true", help="fail on every edition citation problem")
    parser.add_argument("--today", type=datetime.date.fromisoformat, default=datetime.date.today())
    parser.add_argument("--grace-days", type=int, default=GRACE_DAYS)
    arguments = parser.parse_args()

    tree = Tree(".")
    report = Report()
    new_facts = new_fact_identities(tree, arguments.base)
    changed_sources = set(changed_files(arguments.base, ["content/sources"])) if arguments.base else set()

    check_profiles(tree, report, new_facts, tree.method_ids())
    check_sources(tree, report, changed_sources, arguments.today, arguments.grace_days)
    check_edition(tree, report, arguments.edition)
    report.print()
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
