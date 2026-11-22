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
  service-link      every service a profile lists (a `justice_institutions`
                    entry or a `dispute_resolution.forums` entry) has a
                    `link`: the service's own official page, or, where it has
                    none, the official directory entry that lists it (the lead
                    author's rule of Nov. 22, 2026; docs/data-model.md)
  archive           every source with a web address has an archived copy once
                    the grace period after `retrieved` has passed
  version-dates     each version of a document history has its dates in
                    order: signed or adopted before approved, approved before
                    published, and nothing after it ended (decision record 0018)
  version-order     versions are listed oldest first, and none amends or
                    supersedes a version dated after it
  version-status    a version that a later version took the place of, or one
                    with an end date, is not in effect; a version marked superseded is
                    superseded by some version (or the record names what
                    replaced it under `related`)
  clause-change     every key clause topic recorded for a version, or for a
                    version it amends or supersedes, has a `changes` entry saying
                    how it changed (or that it was not compared yet)
  version-link      a source record's `document_version` names the version
                    that cites it
  superseded-citation
                    a profile fact that cites a version no longer in effect
                    names that version in `document_version`, so the page can
                    say so; otherwise it should cite the version in effect
  edition-citation  every source cited by content headed for an edition
                    (essays, provisions, commentary, glossary) is archived,
                    has a citator result if it is a case, statute, regulation
                    or court rule, and is not marked unverified in its notes

Which problems fail the run:
  - With --base REF (pull requests): problems in facts, source records and
    document histories that the pull request adds or changes. Older problems are counted as
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
    CITATOR_KINDS, DATE_SEQUENCE, ENDED_STATUSES, UNVERIFIED, Tree, changed_files,
    clause_change_gaps, compare_partial_dates, fact_identity, file_at, key_date, load_yaml,
    profile_facts, source_links, version_sources,
)

GRACE_DAYS = 30
# Statuses of a version that never took effect, so it supersedes nothing.
NEVER_IN_EFFECT = {"proposed", "disapproved", "withdrawn", "unknown"}
STRICT_STATUSES = {"stable", "adopted", "final"}
SHOWN_PER_CHECK = 15
# Profile sections whose entries are services a reader may want to reach.
SERVICE_SECTIONS = ("justice_institutions", "dispute_resolution.forums")


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
            if path in SERVICE_SECTIONS and not fact.get("link"):
                name = fact.get("name") or fact.get("kind")
                report.add("service-link", f"{file}: {path} '{name}' (source {fact['source']}) has no link; give the "
                           "service's own page, or the official directory entry that lists it", new)
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


def check_documents(tree, report, changed_documents, changed_sources):
    """Version histories (content/documents/, decision record 0018)."""
    for document_id, record in tree.documents.items():
        file = record["_file"]
        new = file in changed_documents
        versions = record.get("versions") or []
        by_id = {version.get("id"): version for version in versions}
        replaced_elsewhere = any(entry.get("relation") == "replaced-by" for entry in record.get("related") or [])
        superseded_by = {}
        for version in versions:
            for other in version.get("supersedes") or []:
                superseded_by.setdefault(other, []).append(version)

        previous = None
        for version in versions:
            name = f"{file}: version {version.get('id')}"
            dates = version.get("dates") or {}
            for earlier, later in DATE_SEQUENCE:
                if dates.get(earlier) and dates.get(later) and compare_partial_dates(dates[earlier], dates[later]) > 0:
                    report.add("version-dates", f"{name} is {later} ({dates[later]}) before it was {earlier} ({dates[earlier]})", new)
            if dates.get("ended"):
                for field, value in dates.items():
                    if field != "ended" and compare_partial_dates(value, dates["ended"]) > 0:
                        report.add("version-dates", f"{name} ended ({dates['ended']}) before it was {field} ({value})", new)

            when = key_date(version)
            if previous and when and compare_partial_dates(previous[1], when) > 0:
                report.add("version-order", f"{name} ({when}) is listed after {previous[0]} ({previous[1]}); list versions oldest first", new)
            if when:
                previous = (version.get("id"), when)
            for field in ("amends", "supersedes"):
                for other in version.get(field) or []:
                    other_when = key_date(by_id.get(other) or {})
                    if when and other_when and compare_partial_dates(other_when, when) > 0:
                        report.add("version-order", f"{name} ({when}) {field} {other}, which is dated later ({other_when})", new)

            status = version.get("status")
            if status == "in-effect" and dates.get("ended"):
                report.add("version-status", f"{name} is in effect but has an end date ({dates['ended']})", new)
            if status == "in-effect":
                replacing = [v.get("id") for v in superseded_by.get(version.get("id"), []) if v.get("status") not in NEVER_IN_EFFECT]
                if replacing:
                    report.add("version-status", f"{name} is in effect but {', '.join(replacing)} superseded it", new)
            if status == "superseded" and version.get("id") not in superseded_by and not replaced_elsewhere:
                report.add("version-status", f"{name} is superseded, but no version lists it in supersedes and `related` names no replacement", new)

            for topic in clause_change_gaps(version, by_id):
                earlier = ", ".join(list(version.get("amends") or []) + list(version.get("supersedes") or []))
                report.add("clause-change", f"{name} records no change for '{topic}' against {earlier}; add a changes entry (use not-compared if the comparison is still to do)", new)

            source = tree.sources.get(version.get("source"))
            link = (source or {}).get("document_version")
            if link and (link.get("document"), link.get("version")) != (document_id, version.get("id")):
                report.add("version-link", f"{name} cites {version['source']}, whose document_version names {link.get('document')} / {link.get('version')}", new or source["_file"] in changed_sources)

    for key, source in tree.sources.items():
        link = source.get("document_version")
        if not link:
            continue
        version = next((v for v in (tree.documents.get(link.get("document")) or {}).get("versions") or []
                        if v.get("id") == link.get("version")), None)
        if version is not None and version.get("source") != key:
            report.add("version-link", f"{source['_file']}: document_version names {link['document']} / {link['version']}, which cites {version.get('source')} instead", source["_file"] in changed_sources)


def check_superseded_citations(tree, report, new_facts):
    """Profile facts that cite a version no longer in effect without saying so."""
    by_source = version_sources(tree.documents)
    for file, profile in tree.profiles.items():
        for path, fact in profile_facts(profile):
            if fact.get("document_version"):
                continue
            for document_id, version in by_source.get(fact["source"], []):
                if version.get("status") not in ENDED_STATUSES:
                    continue
                current = [v.get("label") or v.get("id") for v in tree.documents[document_id].get("versions") or []
                           if v.get("status") == "in-effect"]
                instead = f"cite the version in effect ({'; '.join(current)})" if current else "cite a version in effect"
                report.add(
                    "superseded-citation",
                    f"{file}: {path} cites {fact['source']}, the {version.get('label') or version.get('id')} of "
                    f"{document_id}, which is {version.get('status')}; {instead}, or name the version in "
                    "document_version if the fact describes it on purpose",
                    is_new(new_facts, file, path, fact),
                )


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
    changed_documents = set(changed_files(arguments.base, ["content/documents"])) if arguments.base else set()

    check_profiles(tree, report, new_facts, tree.method_ids())
    check_sources(tree, report, changed_sources, arguments.today, arguments.grace_days)
    check_documents(tree, report, changed_documents, changed_sources)
    check_superseded_citations(tree, report, new_facts)
    check_edition(tree, report, arguments.edition)
    report.print()
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
