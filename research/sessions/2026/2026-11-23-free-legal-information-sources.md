---
id: 2026-11-23-free-legal-information-sources
date: '2026-11-23'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: "One session with five page-reading helpers for the services' terms and documentation pages. Scripts in scripts/caselaw/ did the citation check and the tribal court opinion index."
- kind: page-fetch
  name: Direct downloads (curl) of public files
  detail: "CourtListener's quarterly bulk data (citations and opinion clusters, release of Sept. 30, 2026) and the Caselaw Access Project's static files for the American Tribal Law Reporter and the Navajo Reporter."
- kind: web-search
  name: Web search
  detail: "Used to find the Free Law Project's API, membership and citator pages, the Caselaw Access Project's 2024 transition post, the National Indian Law Library's tribal court pages, GovInfo's API documentation, the Legal Information Institute's terms and the Free Access to Law Movement."
purpose: "Answer Trevor's question about using free legal information projects as sources, then build the two uses he chose: checking the project's case citations against CourtListener and indexing the tribal court opinions in the Caselaw Access Project's files; later the same day he chose to show those opinions on the website."
queries:
- CourtListener REST API v4 rate limit authentication token terms of use
- CourtListener citation lookup API eyecite throttle citations per minute
- Free Law Project tribal court opinions CourtListener tribal jurisdictions
- Caselaw Access Project static.case.law CC0 public domain Harvard open 2024 bulk data
- National Indian Law Library tribal court opinions Tribal Law Gateway NARF
- GovInfo API key api.data.gov rate limit USCOURTS collection opinions
- Cornell Legal Information Institute terms of use reuse content API bulk
- Free Access to Law Movement Montreal Declaration LIIs members
sources_added:
- caselaw-access-project-tribal-reporters
sources_updated: []
limits: "Justia's terms were not read. The CourtListener API was not called: its free tier needs an account, so the check used the public bulk files instead. Topic tags on the opinions are keyword matches, not readings. The Caselaw Access Project's tribal reporters end in early 2017."
---

Findings and ranked uses are in the [sources note](../../analyses/2026-11-23-free-legal-information-sources.md). The citation check is in the [review](../../reviews/2026-11-23-case-citations-courtlistener.md), and the opinion index in [research/tribal-court-opinions](../../tribal-court-opinions/README.md).
