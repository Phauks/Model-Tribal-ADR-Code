# 0034. Show the whole story on its page where the rights allow

- **Status:** Accepted (lead author, Nov. 22, 2026)
- **Date:** 2026-11-22
- **Amends:** [0019](0019-story-records.md) and [0029](0029-show-stories-while-nations-review-them.md), for website display only

## Context

Decision record 0019 set the rule that the project never retells a story and quotes it only in short excerpts of 50 words or fewer, reproducing the whole story only with permission.[^0019] Decision record 0029 put every story record on the website under that rule.[^0029] On Nov. 22, 2026 the lead author asked to "actually include the full text of the stories in the website, don't restate the story in our own words."[^request]

Some tellings need no permission to reproduce. Three of the books the story records cite were published in the United States before 1931 (Zitkala-Ša's *Old Indian Legends*, 1901; Lucy Thompson's *To the American Indian*, 1916; Arthur C. Parker's *Seneca Myths and Folk Tales*, 1923), so they are in the public domain there.[^pd] One record's telling is a nation's own law, which the site already serves in full under decision record 0031, subject to the nation's request to remove or redact it.[^0031] Every other telling is a nation's or an organization's own publication, a newspaper or journal article, or a modern book, and is under copyright.

## Decision

- **A full text where the rights allow.** A story record may carry a `full_text`: the whole story in the teller's exact words, from one telling, paragraph by paragraph (`schemas/story.schema.json`). The record names the ground that allows it, and `scripts/validate_records.py` checks it. There are three: the telling's source record is in the public domain; the telling is a nation's own law (a Tribal code, constitution or court rule), served under 0031; or the telling's permitted uses are `publish-in-full`.
- **Shown first.** A story page shows the full text, with the telling's credit, the pages it runs, why it may be shown, and how it was transcribed and checked. Excerpts from the same telling are not repeated; excerpts from other tellings stay below it.
- **Verbatim, never retold.** The text is the source's own, unchanged except for whitespace, line-end hyphens, spaces the typesetter put before punctuation, and capitals used only as a typographic opening. Spelling and the printing's own slips stay as printed. Anything damaged in the printing is noted under the text.
- **Passages left out are marked.** A passage the project leaves out, such as one touching ceremony, is replaced by a bracketed note saying where it is in the telling, so a reader can find it. The note says why, but does not describe the passage.
- **Copyrighted tellings stay as before.** Where no ground applies, the page keeps the short excerpts in the teller's words, the citation and the link to read the whole story where it was published. A nation or publisher can give permission to publish in full, and the record then changes its permitted uses.
- **Everything else in 0019 and 0029 stands.** Restricted and embargoed tellings are never shown, contributor tellings stay held until public, the review notice and removal link stay, and protocols such as a winter-only rule are shown beside the story.

This decision covers the website only. The print edition, ebook and any data export still follow 0019 and 0029.

## Consequences

- Five story pages show their whole story. They are two of Zitkala-Ša's Dakota stories, Parker's Seneca tale of the Turtle and the Beaver, and Lucy Thompson's account of settling quarrels before the Deerskin Dance. The fifth is the Organized Village of Kake's account of Guwakaan, in § 1.01.010 of its peacemaking code.
- The other stories need a nation's or publisher's permission before their full text can be shown. Asking for it fits the outreach each nation already receives about its stories (charter, commitment 4).
- A full text can be checked against its source: the record keeps the word count and a SHA-256 fingerprint, and the page says which copy it was taken from.

## Sources

[^0019]: [Decision record 0019](0019-story-records.md), "Decision."
[^0029]: [Decision record 0029](0029-show-stories-while-nations-review-them.md), "Decision."
[^request]: Lead author, message in the project's story thread, Nov. 22, 2026 (project records).
[^pd]: 17 U.S.C. § 304(a)-(b) (2018) (a work published before 1978 is protected for at most 95 years from publication, through the end of that calendar year, so a work published in 1930 or earlier was in the public domain by Jan. 1, 2026).
[^0031]: [Decision record 0031](0031-serve-copies-of-documents-from-the-private-bucket.md).
