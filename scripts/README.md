# Scripts

Checks that run on every pull request (see `.github/workflows/checks.yml`).
Run them from the repository root before opening a pull request.

The workflow's final job, `All checks`, passes only when every other check
passes, and it is the only check the `main` ruleset requires. To add a check,
add a job to the workflow and list it under `all-checks.needs`.

| Script | Checks | Needs |
| --- | --- | --- |
| `check_text.py` | Every text file is UTF-8 without a byte order mark, in Unicode Normalization Form C, with LF line endings and a final newline | Python 3 standard library |
| `validate_records.py` | Every schema, example and content record is valid, and every citation key, glossary link and research session reference resolves | `pip install -r scripts/requirements.txt` |
| `lint_records.py` | Catches unchecked data (decision record 0014): profile facts with no `verification` level, two source records at one address, forum kinds with no method record, sources still unarchived 30 days after retrieval, and sources cited by content headed for an edition that are unarchived, lack a citator result or are marked unverified. With `--base <ref>` it fails only on problems the pull request adds or changes; run it with `--edition` before exporting an edition | `scripts/requirements.txt` |
| `coverage_report.py` | Counts how much of the dataset has been checked and how closely: facts by section and verification level, dispute resolution coverage by region, archives, citator checks, method and glossary status. With `--base <ref>` it shows each count beside the base's. In continuous integration the report goes to the job summary | `scripts/requirements.txt` |

`record_facts.py` holds the helpers both share.

## Analysis

| Script | Does | Needs |
| --- | --- | --- |
| `analysis/dispute_resolution_practice.py` | Counts the dispute resolution records in the profiles by kind, evidence tier, recognition and region, and lists data quality flags, as JSON for `research/analyses/` | `scripts/requirements.txt` |

## Native nations dataset

Scripts that built the first profiles in `content/tribes/` from cited facts in
`research/raw/` (see [research/raw/README.md](../research/raw/README.md)).
They are kept so the first edition can be reproduced; once profiles are edited
by hand, add new facts by hand or in a new raw file and review the diff.

| Script | Does | Needs |
| --- | --- | --- |
| `tribes/federal_facts.py` | Parses the Federal Register list of recognized entities and the Bureau of Indian Affairs Tribal Leaders Directory into cited facts, keeping office contact points only | Python 3 standard library |
| `tribes/build_profiles.py` | Merges every raw file into profiles and new source records, drops facts the schema rejects and writes a build report | `scripts/requirements.txt` |
| `tribes/write_sessions.py` | Writes a research session log for each raw file that has none | `scripts/requirements.txt` |
| `tribes/find_pronunciations.py` | Reads each nation's official website and lists passages that mention pronunciation, and linked audio, for review by hand; never writes to a profile | `scripts/requirements.txt` |

## Outreach

Run by hand, never in continuous integration:

| Script | Does | Needs |
| --- | --- | --- |
| `build_outreach_overview.py` | Checks the private outreach plan against its schema and the public records in `research/outreach/`, and writes a private overview next to the plan ([decision record 0012](../docs/decisions/0012-outreach-list-split-public-and-private.md)) | `pip install -r scripts/requirements.txt` |
