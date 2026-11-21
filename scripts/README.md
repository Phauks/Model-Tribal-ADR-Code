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

## Outreach

Run by hand, never in continuous integration:

| Script | Does | Needs |
| --- | --- | --- |
| `build_outreach_overview.py` | Checks the private outreach plan against its schema and the public records in `research/outreach/`, and writes a private overview next to the plan ([decision record 0012](../docs/decisions/0012-outreach-list-split-public-and-private.md)) | `pip install -r scripts/requirements.txt` |
