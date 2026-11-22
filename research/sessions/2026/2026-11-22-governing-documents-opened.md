---
id: 2026-11-22-governing-documents-opened
date: '2026-11-22'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: other
  name: scripts/review/governing_documents.py
  detail: Listed the governing document facts still recorded by title only, set aside those other work
    covers, took each remaining document's text from the copies the constitution catalog and tribal law
    texts work saved on Nov. 21, 2026, and checked the opening text against the fact.
- kind: page-fetch
  name: scripts/review/governing_documents.py gather
  detail: Fetched about 280 documents that no earlier work had saved, with a user agent naming the
    project's checker and one request per second per site, before the run was stopped; those copies
    were read but none of them led to a change.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Wrote the checks, read the opening text of every non-University of Oklahoma document that
    passed them, tightened the checks where a page only mentioned the document, and compared the result
    with the second gap review's governing document file.
purpose: Open each governing document listed by title only (gap audit row 10) and confirm its title,
  kind and date where two checks agree.
queries:
- every governing_documents fact in content/tribes/*/*.yaml with verification title-only
sources_added: []
limits: >-
  Set aside: 151 facts the constitutions pull request (#55) edits, 520 law codes and court rules the
  tribal law texts work fetched, and 192 facts with no link. Of the other 897, a fact was set to
  read-in-full only when its document's opening text gives the document's own title for its kind
  ("Constitution ... of", "Corporate Charter of"), names the nation and the fact's title words and
  year, has the articles or sections of a full text rather than a table of contents, and the second
  gap review also confirmed the link. Scanned PDFs without a text layer were not read. No dead link
  was replaced.
---

Output: `verification: read-in-full` on 301 governing document facts (147 constitutions and 154 corporate charters), each with a dated note, described in the "Applied" section of [the second gap review](../../reviews/2026-11-22-second-gap-review.md).

Method: `scripts/review/governing_documents.py gather --no-fetch` read the text of each document from saved copies and recorded whether its heading gives the document's own title for its kind, whether the nation, the fact's title words and its year appear, and whether the text is a full document; National Indian Law Library index pages always count as tables of contents, as the second gap review found. `apply --agree` wrote the level only where the second gap review had also confirmed the same link.

Ruled out: links were not replaced and no title, kind or year was changed; facts whose kind does not match the linked page are listed in the review's Applied section for the lead author.
