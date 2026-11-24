# National Indian Law Library coverage data

Data behind the research note [National Indian Law Library: how much of it we cover](../analyses/2026-11-24-national-indian-law-library-coverage.md) (Nov. 24, 2026). Built by `scripts/analysis/national_indian_law_library_coverage.py` from a handful of NILL index pages a person saved, and by `scripts/analysis/model_code_mentions.py` from the project's own law text captures. Every file holds facts only (names, courts, dates, citations, counts), never NILL's text.

- `gateway-nations.csv`: one row per Tribal Law Gateway nation page, matched to our nation profiles, with what NILL lists and what we hold.
- `tribal-bulletin.csv`: one row per case in NILL's Tribal Courts Bulletin, with the nation and whether the opinion is in our Caselaw Access Project index. Use it as a list of opinions to ask nations for, not as a source to copy.
- `supreme-court-bulletin.csv`: cases in NILL's Supreme Court Bulletin with a U.S. Reports citation, matched to our list of Supreme Court Native cases. Partial: older terms use other page layouts.
- `model-code-mentions.json`: nations whose captured law texts name a model or uniform law. A mention is a lead, not proof of adoption.
- `counts.json`: the totals the research note quotes.
