---
id: 2026-11-21-website-design-references
date: 2026-11-21
researchers: [Trevor Goldsmith, Claude (AI assistant)]
tools:
  - kind: ai-assistant
    name: Claude (AI assistant)
    detail: A research sub-agent opened each reference site and reported observations separately from its own judgment. An earlier design thread's notes, from the same day, were reused.
  - kind: page-fetch
    name: Web page fetch tool
    detail: Pages were read as text and markup, not as rendered images, so no colors, typefaces or spacing were observed.
  - kind: web-search
    name: Web search
purpose: Find reference websites for the design of the project website, and record what to borrow and what to avoid from each.
queries:
  - Cornell LII United States Code section page and Wex dictionary
  - Uniform Law Commission acts catalog
  - eCFR reader aids, timeline and point-in-time
  - GOV.UK Design System question pages, start pages, summary list, step by step
  - USWDS in-page navigation, banner, accordion
  - National Indian Law Library Tribal Law Gateway
  - Native Governance Center, Native Land Digital, Smithsonian NMAI Native Knowledge 360
  - legislation.gov.uk section page with changes to legislation
  - Tufte CSS sidenotes, Practical Typography line length, Rust book, Quarto book
  - Wikipedia Page Previews accessibility
  - WCAG 2.2 understanding documents for 1.4.3, 1.4.10, 1.4.11, 2.4.11 and 2.5.8
  - Braille Institute Atkinson Hyperlegible Next
sources_added: []
limits: >-
  The eCFR section page refused automated access, so only its reader-aid pages
  were read. One Cornell Wex page was rate-limited and another entry was read
  instead. The Native Knowledge 360 home page returned only an excerpt. No
  page was archived, because these are design references cited in
  site/DESIGN.md rather than sources for claims in the content; no source
  records were added. Observations about visual design come from the earlier
  design thread, which also read text only.
---

The research supports [site/DESIGN.md](../../../site/DESIGN.md). It restarted
an earlier design thread from the same day, whose notes were reused rather
than repeated. Section 3 of the design document lists each reference with its
address, what the project borrows and what it avoids.

Findings that shaped the design most:

- The National Indian Law Library's Tribal Law Gateway frames missing material
  as a nation's choice not to consent, which matches charter commitment 6 and
  shaped the nation profile's review panel.
- legislation.gov.uk's status box and timeline shaped the "Model text, not law
  in force" notice and the per-section history.
- The GOV.UK Design System's question pages and start pages shaped the request
  flow in docs/requests.md into one question per page.
- Native Land Digital's statement that its maps are not official sources and
  draw no legal boundaries shaped the notice beside the state-presence map.
- Wikipedia's Page Previews, which screen readers skip, showed why every
  glossary card must also be reachable as a link to the full entry.
