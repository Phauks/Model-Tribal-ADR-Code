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
