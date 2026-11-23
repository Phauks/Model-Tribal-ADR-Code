# 0047. Show tribal court opinions from the Caselaw Access Project on the website

- **Status:** Accepted
- **Date:** 2026-11-23
- **Extends:** decision record [0031](0031-serve-copies-of-documents-from-the-private-bucket.md)

## Context

The Caselaw Access Project of the Harvard Law School Library holds two reporters of tribal court opinions: West's American Tribal Law Reporter (13 volumes, 1997 to 2017) and the Navajo Reporter (8 volumes, 1969 to 2006). In March 2024 the Library Innovation Lab released the project's data "without restriction on access or use" ([Transitions for the Caselaw Access Project](https://lil.law.harvard.edu/blog/2024/03/26/transitions-for-the-caselaw-access-project), Mar. 26, 2024). Every volume of both reporters is marked redacted, which removes the publisher's headnotes and summaries. Together they hold 2,368 opinions of courts serving 24 Native nations ([sources note](../../research/analyses/2026-11-23-free-legal-information-sources.md); [index](../../research/tribal-court-opinions/README.md)).

The opinions were first loaded as private research data. Asked whether the website should show them in full, Trevor Goldsmith chose "Show them, with a removal link" over listing them with links out or keeping them private.

## Decision

- The website serves each tribal court opinion in those reporters as its own page, at `/copies/caselaw-access-project/<reporter>/<volume>/<case>.html`, from the private bucket, as it serves nations' constitutions and laws under decision record 0031.
- Each page is built from the Caselaw Access Project's own HTML for the case. A heading names the case, its citation, court and date, credits the source, and links to the original and to the request to remove it. The text of the opinion is not changed.
- Each nation's page lists its courts' opinions in a section of its own, with the ones that mention peacemaking, mediation, arbitration or another form of dispute resolution named first, and links to a table of all of them.
- A nation's request to remove or redact an opinion is carried out as for any copy: within 7 days, by setting `"redistribution": "no"` for the key in `research/capture-index-overrides.json` (docs/public-copies.md).
- Decisions of federal and state courts that the reporters reprint are left out.
- `scripts/caselaw/tribal_court_opinions.py` files the pages and keeps the index; re-running it picks up changed volumes and new reporters named in `research/tribal-court-opinions/sources.yaml`.

## Consequences

- Readers can read the opinions of 24 nations' courts on the site, and nation pages show how those courts have used peacemaking and other dispute resolution, which the model code's commentary draws on.
- Opinions can name people in family, child welfare and criminal matters. The reporters published them, but a nation or a person named may ask for a copy to come down, and the removal path handles that. A nation that wants none of its courts' opinions shown can ask once for all of them.
- Whether the government edicts doctrine reaches tribal courts is unsettled (project analysis). The project relies on the release without restriction, on the removal path, and on the CARE principles' respect for each nation's control of its own records.
- Nothing after early 2017 comes from this source. Later opinions need the courts' own sites, the National Indian Law Library's bulletin (link only, decision record 0042) or the nations themselves.

## Sources

- Trevor Goldsmith, project thread "Use free legal information projects as sources", 2026-11-23 (decision card answer "Show them, with a removal link").
- Harvard L. Sch. Libr., Libr. Innovation Lab, *Transitions for the Caselaw Access Project* (Mar. 26, 2024), https://lil.law.harvard.edu/blog/2024/03/26/transitions-for-the-caselaw-access-project.
- *Georgia v. Public.Resource.Org, Inc.*, 590 U.S. 255 (2020).
- Decision records [0030](0030-keep-research-captures-in-the-private-bucket.md), [0031](0031-serve-copies-of-documents-from-the-private-bucket.md) and [0042](0042-link-to-the-national-indian-law-library-for-its-copies.md); [public-copies.md](../public-copies.md).
