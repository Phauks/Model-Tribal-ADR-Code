# 0036. Show every story in full on the website

- **Status:** Accepted (lead author, Nov. 23, 2026)
- **Date:** 2026-11-23
- **Amends:** [0034](0034-show-stories-in-full-where-rights-allow.md), for website display only

## Context

Decision record 0034 let a story page show the whole story only where the telling is in the public domain, is a nation's own law, or has permission to be published in full.[^0034] Five pages qualified. On Nov. 23, 2026 the lead author wrote "Do all the stories! I didn't say do 5."[^request] Asked which copyrighted stories should show their full text, the lead author chose "All 31, including outside publishers."[^choice]

Most of the remaining tellings are published by the nations themselves, on their own websites or in their own newsletters and books. Six are published by others: the Museum of the Cherokee People, Liliʻuokalani Trust, the Omaha Tribal Historical Research Project, Sealaska Heritage Institute, *Tribal College Journal*, and the American Indian Language Development Institute at the University of Arizona. One more, *Ross v. Sulu*, is a decision of the Hopi Appellate Court.

## Decision

- **Every story in full.** Every story record carries a `full_text` where the whole telling can be found. A telling that is not in the public domain, not a nation's law and not published with permission takes the basis `lead-author-decision` (`schemas/story.schema.json`).
- **Court decisions count as a nation's law.** A Tribal court's decision (`tribal-case`) joins codes, constitutions and court rules as a basis under 0031, so *Ross v. Sulu* is shown as the Hopi Tribe's own law.
- **Credit and removal stay.** Each full text names who published it, why it is shown in full, where it runs in the telling, and how it was transcribed. The page keeps its citation, its link to the original and its removal link. A nation or publisher that asks for a story to be changed or removed is answered as under 0029 and 0031.
- **Everything else in 0034 stands.** The text is verbatim. Passages left out are marked. Restricted and embargoed tellings, and contributor tellings not yet public, are never shown. Winter-only and other protocols are shown beside the story.
- **Website only.** The print edition, ebook and data exports still follow 0019 and 0029.

This is a choice about risk and about readers having the teller's own words. It is not a finding that each copy is a fair use under 17 U.S.C. § 107.[^107]

## Consequences

- 36 of the 37 story pages show their whole story. *My Home: An Oneida Indian Legend* is a children's book, and the Nation's page gives only a description of it, so its page keeps the excerpt.
- For the *Tlingit Law* booklet, only Sealaska Heritage Institute's own description is online, so that description is the text shown.
- Outside publishers keep their copyright. If one objects, the full text comes down and the page goes back to excerpts.

## Sources

[^0034]: [Decision record 0034](0034-show-stories-in-full-where-rights-allow.md), "Decision."
[^request]: Lead author, message in the project's story thread, Nov. 23, 2026 (project records).
[^choice]: Lead author, answer to the question "Which copyrighted stories should show their full text?" in the project's story thread, Nov. 23, 2026 (project records).
[^107]: 17 U.S.C. § 107 (2018).
