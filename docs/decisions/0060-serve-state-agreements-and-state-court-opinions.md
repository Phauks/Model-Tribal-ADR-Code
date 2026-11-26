# 0060. Serve copies of Oklahoma's filed state-tribal agreements and of published state court opinions

- **Status:** Accepted
- **Date:** 2026-11-26
- **Extends:** decision records [0031](0031-serve-copies-of-documents-from-the-private-bucket.md) (the site serves its own copies of federal works and nations' governing documents) and [0047](0047-show-tribal-court-opinions-from-the-caselaw-access-project.md) (Tribal court opinions shown, with a removal link)

## Context

The tier 2 and 3 study (`research/analyses/2026-11-26-tier-2-and-3-data-sources.md`, PR #519) counted two tier 3 sources that a script can collect from one place each: the Oklahoma Secretary of State's register of tribal compacts and agreements (1,087 filings, each with a PDF) and about 5,000 published state court opinions on Indian law (the Caselaw Access Project to about 2019, CourtListener after). The data roadmap said state cases were "link only", a project choice rather than a legal limit (the note's section 5). On Nov. 26, 2026 Trevor Goldsmith asked to "grab those tier 3 state court opinions and state tribal compacts", and the project's coordinator asked for the project's own copies to be hosted, as for federal opinions.

## Decision

- **Oklahoma's register.** Every filing gets a source record (`content/sources/o/oklahoma-filing-<file>.yaml`) and its filed PDF is served from the bucket (`oklahoma-secretary-of-state/file-<file>.pdf`). The filings are public records of a state office, and most are agreements to which a nation is a party; as with nations' laws under decision record 0031, a nation can ask for a copy to be taken down or redacted, and the request is carried out with `research/capture-index-overrides.json`. Filings that are the State's copy of a gaming compact the project already holds from the Office of Indian Gaming are not given a second record: the held record's notes name the State's copy (`research/state-agreements/oklahoma/gaming-matches.csv`).
- **State court opinions.** Published state court opinions are served, like federal ones, because the text of judicial opinions has no copyright (*Georgia v. Public.Resource.Org, Inc.*, 590 U.S. 255 (2020)). The served text is the court's opinion only: publishers' headnotes, synopses and other editorial matter are removed. Opinions about children, protection orders or estates follow the Tribal opinions' privacy rules (decision record [0057](0057-replace-names-in-tribal-court-opinions-with-initials.md) and `research/analyses/2026-11-24-tribal-child-cases-privacy.md`): they are held back until they are checked and, where needed, redacted. Estate cases decided before 1976 are shown, since fifty years on the estates are long closed and most of the people named in them have died; later estates stay held. The cutoff is the `--estates-from` option of `scripts/caselaw/state_court_opinions.py`, so it can be moved.
- **Records start unverified.** Every record written by these scripts carries a `review` block with status `unverified`.

## Consequences

- The Statistics page counts the Oklahoma filings as their own collection, apart from the other compacts and agreements, so nothing is counted twice.
- Nation pages list the Oklahoma agreements under "Laws and agreements", one line for each agreement, amendment or extension; addenda, letters, approvals and notices are records and copies but not lines on the nation page.
- The filed PDFs are scans with no text layer, so the records' facts come from the register's own lines, not the documents. Reading the scans would need OCR.

## Sources

- Oklahoma Secretary of State, Tribal Compacts and Agreements, https://oklahoma.gov/sos/executive-legislative-records/executive-branch/tribal.html (read Nov. 26, 2026).
- *Georgia v. Public.Resource.Org, Inc.*, 590 U.S. 255 (2020).
