"""Check the names and headers of the database migrations in site/migrations/.

Rule (site/migrations/README.md, Trevor, Nov. 23, 2026): a new migration is named for the time it was written, in UTC, and what it does, such as `20261123T0430_add_file_scans.sql`, and it opens with a comment that says what it changes. Several threads once picked the same sequential number at the same time; a timestamp makes that very unlikely, and this check refuses what slips through.

Wrangler applies every file whose name is not yet in the database's `d1_migrations` table, sorted by the number before the first underscore and then by name (wrangler 4.166, `compareMigrationPaths`). The 21 numbered files written before the rule are already recorded under their names, so they keep them: renaming one would make Wrangler run it again.

The check fails when:
  * a file in the folder is not a `.sql` migration (README.md aside), or its name fits neither pattern;
  * a numbered name is not one of the 21 already applied, or one of those is missing;
  * a timestamp is not a real UTC time, or lies more than a day ahead;
  * two migrations share a timestamp, so their order would hang on their descriptions;
  * a migration does not open with a `-- ` comment line of at least five words saying what it does, or its opening comment still holds a TODO from `npm run database:new-migration`;
  * with --base, the pull request changes, renames or deletes a migration already on the base branch (the live database has run it, so a change would never reach it; write a new migration instead).

Run from the repository root:
  python3 scripts/check_migrations.py --base origin/main
  python3 scripts/check_migrations.py
Uses only the Python standard library.
"""

import argparse
import datetime
import os
import pathlib
import re
import subprocess
import sys

FOLDER = pathlib.Path("site/migrations")

# Applied to the live database under these names before the timestamp rule. Never rename or add to this list.
NUMBERED = (
    "0001_sign_in_and_collaboration.sql",
    "0002_permission_tiers.sql",
    "0003_contributor_profiles.sql",
    "0004_own_sign_in.sql",
    "0005_essays.sql",
    "0006_essay_back_matter.sql",
    "0007_form_submissions.sql",
    "0008_open_sign_up.sql",
    "0009_account_deletion.sql",
    "0010_uploads.sql",
    "0011_following.sql",
    "0012_address_book.sql",
    "0013_mail.sql",
    "0014_contributor_pages.sql",
    "0015_nation_teams.sql",
    "0016_book_orders.sql",
    "0017_page_changes.sql",
    "0018_upload_nation_comments.sql",
    "0019_account_settings.sql",
    "0020_nation_page_changes.sql",
    "0021_file_scans.sql",
)

TIMESTAMPED = re.compile(r"^(?P<stamp>\d{8}T\d{4})_(?P<words>[a-z0-9]+(?:_[a-z0-9]+)+)\.sql$")
NUMBERED_NAME = re.compile(r"^\d{4}_[a-z0-9_]+\.sql$")
EXAMPLE = "20261123T0430_add_file_scans.sql"
HEADER_WORDS = 5


def header_problem(text: str) -> str | None:
    """Return why the file's opening comment is missing or too thin, or None."""
    lines = text.lstrip("﻿").splitlines()
    first = next((line for line in lines if line.strip()), "")
    if not first.startswith("-- "):
        return 'does not open with a "-- " comment line saying what it changes'
    words = re.findall(r"[A-Za-z0-9][A-Za-z0-9'-]*", first[3:])
    opening = []
    for line in lines:
        if not line.startswith("--") and line.strip():
            break
        opening.append(line)
    if "TODO" in "\n".join(opening):
        return "still has a TODO in its opening comment; say what it changes"
    if len(words) < HEADER_WORDS:
        return f"opens with a comment of {len(words)} words; say what it changes in at least {HEADER_WORDS}"
    return None


def changed_on_branch(base: str) -> list[tuple[str, str]]:
    """Return (status, path) for migrations that existed on the base and this branch modifies, renames or deletes."""
    output = subprocess.run(
        ["git", "diff", "--name-status", "--find-renames", f"{base}...HEAD", "--", str(FOLDER)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    changed = []
    for line in output.splitlines():
        parts = line.split("\t")
        status = parts[0]
        if status.startswith(("M", "D", "R")) and parts[1].endswith(".sql"):
            changed.append((status[0], parts[1]))
    return changed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base", help="base commit; refuse changes to migrations that already exist there")
    arguments = parser.parse_args()

    problems: list[str] = []
    names = sorted(path.name for path in FOLDER.iterdir() if path.is_file())
    latest = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)
    stamps: dict[str, str] = {}

    for name in names:
        if name == "README.md":
            continue
        if not name.endswith(".sql"):
            problems.append(f"{name}: only .sql migrations and README.md belong in {FOLDER}/")
            continue
        match = TIMESTAMPED.match(name)
        if match:
            stamp = match["stamp"]
            try:
                when = datetime.datetime.strptime(stamp, "%Y%m%dT%H%M").replace(tzinfo=datetime.timezone.utc)
            except ValueError:
                problems.append(f"{name}: {stamp} is not a real date and time (YYYYMMDDTHHMM, UTC)")
            else:
                if when > latest:
                    problems.append(f"{name}: {stamp} is in the future; use the UTC time you wrote the file")
            if stamp in stamps:
                problems.append(f"{name}: shares timestamp {stamp} with {stamps[stamp]}; move one of them a minute later")
            stamps.setdefault(stamp, name)
        elif NUMBERED_NAME.match(name):
            if name not in NUMBERED:
                problems.append(f"{name}: numbered names ended at 0021; name it for the UTC time and what it does, such as {EXAMPLE} (npm run database:new-migration in site/)")
        else:
            problems.append(f"{name}: name it YYYYMMDDTHHMM_what_it_does.sql in UTC, lowercase words joined by underscores, at least two words, such as {EXAMPLE}")
            continue
        reason = header_problem((FOLDER / name).read_text(encoding="utf-8"))
        if reason:
            problems.append(f"{name}: {reason}")

    for name in NUMBERED:
        if name not in names:
            problems.append(f"{name}: missing; it is already applied to the live database under this name, so it must stay")

    if arguments.base:
        verbs = {"M": "changes", "D": "deletes", "R": "renames"}
        for status, path in changed_on_branch(arguments.base):
            problems.append(f"{pathlib.Path(path).name}: this branch {verbs[status]} a migration already on main; the live database has run it and will not run it again, so write a new migration instead")

    for problem in problems:
        print(f"::error file={FOLDER}::{problem}" if "GITHUB_ACTIONS" in os.environ else problem)
    if problems:
        print(f"\n{len(problems)} problem(s) with migrations. Rules: {FOLDER}/README.md")
        return 1
    print(f"{len(names) - names.count('README.md')} migrations: names, order and headers are fine.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
