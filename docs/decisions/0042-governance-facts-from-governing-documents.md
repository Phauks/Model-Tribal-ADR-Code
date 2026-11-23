# 0042. Record how each nation's government is set up, as plain facts from its own documents

- **Status:** Accepted (lead author, Nov. 23, 2026)
- **Date:** 2026-11-23

## Context

On Nov. 23, 2026 the lead author asked: "Can we add information for these tribes relating to governance structure?"[^request] A reader of a model dispute resolution code needs to know who in a nation makes law, who leads it, and how its courts are set up. Those answer where a dispute can go and who can change the rules.

The profiles already had `government_structure`, the legal form a federal source records (for example a constitution approved under the Indian Reorganization Act), for 182 nations, but the website did not show it. The project holds the text of a constitution or other governing document for 391 nations (research/constitutions/README.md), and the Bureau of Indian Affairs Tribal Leaders Directory lists the title of each federally recognized nation's leader.[^directory]

Two earlier rules bound the work. The project shows no AI summary of a constitution anywhere public (lead author, Nov. 22, 2026: "No reason for it").[^catalog] And every fact names its source, and a field no source supports is left empty, with a search log saying where the project looked (decision record 0025).[^0025]

## Decision

- **A `governance` list in each profile.** Each item is one plain fact about one aspect of the government (`schemas/tribe.schema.json`). The aspects are the form of government; the governing body (name, size, how chosen, term); a general council; the head of government (title, how chosen, term) and other officers; and elections (when, voting age, who runs them). Then come the branches and any statement that their powers are separate; the courts (how set up, how judges are chosen, their term, each protection the document gives them); how the governing document is changed and whether the Secretary of the Interior must approve; and recall and removal.
- **Facts, not summaries.** A value is a few words in the source's own names ("Business Committee", "Chairman", "7 members"), never a sentence that interprets the document. A fact taken from a document's text carries `quote`, the words that state it, copied exactly. `scripts/governance/apply.py` keeps a fact only when its quote is found in the text, so every fact can be checked against the document. The website shows the quote beside the fact in the Sources list.
- **Sources, in order.** First the nation's own constitution or other governing document: the version marked in effect, else the newest full text with a text layer (`scripts/governance/prepare_batches.py`). Then the nation's own website. Then official directories: from the Tribal Leaders Directory, only the title of the leader's office, never the person's name, and in the office's own form rather than the holder's ("Chairperson" for a listing of "Chairman" or "Chairwoman").
- **AI readers, checked by script.** AI readers (Claude Haiku) read each text in full and copied out the facts under a written brief (`scripts/governance/reader-brief.md`). Their facts are marked `read-in-full` with a note that an AI read them and the lead author has not yet checked them. Facts from a text marked in effect on the nation's own site are `high` confidence; facts from older or library copies are `medium`, with a note that a later version may be in effect.
- **Shown on the nation's page.** A "Government" section comes before "Courts and dispute resolution", and At a glance names the governing body and the head of government. Like the other legal sections it always shows; with nothing found it says so, with how far the search went (`research/search-logs/governance/`).

## Consequences

- Readers see, for most federally recognized nations, who governs and how, each fact tied to the article and section that states it.
- Older texts can describe a government that has since changed. The page names the version each fact was read from and links to its history, and the confidence and note say when a later version may be in effect.
- A nation can correct, restrict or remove any fact through the usual requests (charter, commitment 6).
- The website pass for nations without a captured text, and a check of the AI readers' facts by the lead author, are still to do.

## Sources

[^request]: Lead author, message in the project's governance thread, Nov. 23, 2026 (project records).
[^directory]: U.S. Dep't of the Interior, Bureau of Indian Affairs, *Tribal Leaders Directory* (ArcGIS feature service, updated Nov. 20, 2026) (content/sources/b/bia-tribal-leaders-directory-2026.yaml).
[^catalog]: research/constitutions/README.md, "Files" (lead author, Nov. 22, 2026).
[^0025]: [Decision record 0025](0025-search-logs.md).
