---
id: 2026-11-22-dispute-resolution-coverage
date: '2026-11-22'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: Page fetch (scripts/review/coverage_search.py)
  detail: Fetched nation websites, court and code pages, National Indian Law Library pages and
    the Alaska Court System's restorative justice plan list, with an honestly named link checker
    that obeys robots.txt and waits one second between requests to a site.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Claude (AI assistant) made both the first reading of the passages and leads and the second
    reading of every candidate and of a 10 percent sample of nations with nothing found. No
    separate small-model or larger-model subagents were used.
- kind: other
  name: pdftotext
  detail: Extracted text from fetched PDFs; scanned PDFs without a text layer were not read.
purpose: >-
  Search every federally recognized nation with no dispute resolution record
  (row 2 of the dataset gap audit, 395 nations), write a search log for each
  under decision record 0025, and gather candidates for the lead author's
  review without changing any profile.
queries:
- peacemaking
- mediation
- dispute resolution, arbitration, restorative justice, talking circle, elders' panel (passage words)
sources_added: []
limits: >-
  One model made both readings, so the second is a check against the evidence
  page, not an independent reading. 37 nations have at least one place that
  refused the link checker (HTTP 403 or 401, robots.txt or a bot challenge),
  68 have no website in their profile, and 77 list only a regional
  organization's website. Scanned PDFs were not read except four constitutions
  the project had already read by OCR. Absence from public sources is not
  absence of practice.
---

# Dispute resolution coverage search

## What was done

The lead author asked on Nov. 22, 2026 for a standard log, for every nation, of how the project searched, the places looked and why a search failed. This session made the log format ([decision record 0025](../../../docs/decisions/0025-search-logs.md)) and ran the first search with it: the 395 federally recognized nations with no dispute resolution record.

`scripts/review/coverage_search.py` first gathered, for each nation, the leads the project already held (tribal-law provisions, constitution articles, justice institutions, raw facts, peacemaking research sources and, for Alaska, the Alaska Court System's restorative justice plans), then fetched the nation's National Indian Law Library page, website, court pages and code pages and kept short passages around dispute resolution words.

## Who read the results

The project's subagent tool was not available in this session, so the reviews planned for a small model (first reading) and a larger model (second reading) were both done by Claude (AI assistant) in the session itself. The first reading judged the passages and leads of 118 nations against the [brief](../../reviews/briefs/2026-11-22-dispute-resolution-coverage.md). The second reading re-opened every candidate's evidence page and re-read a fixed sample of 28 nations with nothing to review.

## Result

Of 395 nations, 55 have candidates (123 in all), 284 have none found and 56 are partly searched because a place failed. The second reading confirmed 110 candidates, changed 10, could not re-open 3 (robots.txt) and set aside 10; all 28 sampled none-found nations were confirmed. The other 373 profiles without a record are logged as not searched. Details, counts by region and the questions for the lead author are in the [review](../../reviews/2026-11-22-dispute-resolution-coverage.md).

## Not done

No dispute resolution record was added to any profile. Blocked sites were not retried with a browser, and no nation was contacted.
