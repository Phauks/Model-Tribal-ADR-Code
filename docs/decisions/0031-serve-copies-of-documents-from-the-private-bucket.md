# 0031. Serve the project's copies of cited documents, including nations' constitutions and laws

- **Status:** Accepted
- **Date:** 2026-11-22

## Context

The website links to thousands of documents on other sites: federal statutes on GovInfo, Federal Register notices, and nations' constitutions and codes on nation websites, the University of Oklahoma's tribal constitutions collection, the National Indian Law Library and the Wayback Machine. Those links are slow, and they break when a site moves a file. The project already keeps a copy of most of these documents in the private bucket, with one index row for each (decision record 0030).

On 2026-11-22 Trevor Goldsmith asked that links such as `https://www.govinfo.gov/link/statute/108/4791?link-type=pdf` be "hosted in our r2 bucket, would be faster and more secure". Until then the charter (section 9) and the data model's permission statuses made tribal legal texts link-only: cite and link, never republish, until a nation permits more. Asked whether the site should serve its copies of nations' constitutions too, with a removal link, or keep linking to the nation's own copy, Trevor answered: "yes, allow hosting our own website, we have the info and await redactions."

## Decision

- The website serves its own copy of a cited document at `/copies/<key>`, from the private bucket, when the document's capture index row says `redistribution: yes` (docs/public-copies.md).
- Works of the United States government are served: they have no copyright (17 U.S.C. § 105).
- Nations' constitutions and laws are served too (index topics `constitutions` and `tribal-law`). This replaces the link-only default for serving copies of these documents. It does not change what the project quotes in its own text, which the permission statuses still govern.
- Not served: Westlaw prints and journal articles (always `no`, decision record 0030), books and other works under copyright, and tribal codes copied from commercial code publishers (eCode360, Municode, Code Publishing Company, American Legal Publishing). A publisher's compilation can carry its own copyright and terms of use, so those copies stay private, and the site links to the nation's code where the publisher hosts it.
- The original address stays the source cited. Each copy is byte for byte the file found there, checked by SHA-256, and the `/copies` page lists every copy with its original address, capture date and SHA-256.
- Every served copy has a link to the request form ("Ask to remove"). A nation's request to remove or redact a copy follows the charter's request process: the copy is taken down within seven days, before the request is decided, by setting `"redistribution": "no"` for its key in `research/capture-index-overrides.json` and rebuilding the index. A redacted copy is filed as a new file with its own key and SHA-256; the old copy is never served again.

## Consequences

- Pages open documents from the project's own site, quickly, and keep working when the original moves. Where the bucket does not yet hold a federal document, the Worker fetches it from the `.gov` address and keeps it only if its SHA-256 matches the index.
- The project now republishes nations' governing documents, which it did not before. Whether the government edicts doctrine (*Georgia v. Public.Resource.Org, Inc.*, 590 U.S. 255 (2020)) reaches tribal law is unsettled, and some nations may object to a copy outside their control. The project's answer is the lead author's call recorded here: serve the copies, say plainly where each came from, and take a copy down promptly when a nation asks (project analysis, not legal advice).
- The charter's section 9 and the data model's permission statuses now point here for copies of tribal legal texts.
- Most of these copies are already in the bucket. Federal documents not yet uploaded are filled by the Worker on first request, or by `mirror_captures.py upload` from a session with the bucket keys.

## Sources

- Trevor Goldsmith, project thread "Host source documents in our storage", 2026-11-22 ("links to things like 'https://www.govinfo.gov/link/statute/108/4791?link-type=pdf' and other stuff like that should be hosted in our r2 bucket, would be faster and more secure").
- Trevor Goldsmith, project chat, 2026-11-22 ("yes, allow hosting our own website, we have the info and await redactions").
- 17 U.S.C. § 105; *Georgia v. Public.Resource.Org, Inc.*, 590 U.S. 255 (2020).
- Decision records [0017](0017-serve-nation-images-from-the-private-bucket.md) and [0030](0030-keep-research-captures-in-the-private-bucket.md); [charter](../charter.md), sections 5 and 9; [requests.md](../requests.md).
