---
id: 2026-11-22-ai-and-human-prose
date: 2026-11-22
researchers: [Trevor Goldsmith, Claude (AI assistant)]
tools:
  - kind: web-search
    name: Web search
  - kind: page-fetch
    name: Web page fetch tool
    detail: Pages were read as text. Paywalled pages were not read; where a finding came through another writer's quotation, the source record says so.
  - kind: archive
    name: Wayback Machine availability check
    detail: Used to find an existing capture for each web source; no new captures were made.
  - kind: ai-assistant
    name: Claude (AI assistant)
    detail: Searched, read and summarized the sources, and drafted the style guide section from them. Its own conclusions are labeled as project analysis.
purpose: >-
  Find what research says distinguishes AI-generated prose from human writing,
  find an article Trevor remembered about "sentence weight," and turn the
  findings into style guide rules for the project's AI-assisted drafts.
queries:
  - '"sentence weight" AI writing human writing article'
  - '"sentence weight" LLM prose uniform rhythm'
  - AI writing "every sentence" "same weight" essay
  - AI writing "weightless" prose sentences article
  - study LLM-generated text overused words "delve" excess vocabulary scientific abstracts
  - Wikipedia "Signs of AI writing" field guide
  - Reinhart "Do LLMs write like humans" grammatical rhetorical styles PNAS
  - Economist July 2026 "How to spot AI writing"
  - burstiness perplexity GPTZero sentence length variation
  - Gary Provost "This sentence has five words"
  - '"principle of end-weight" Quirk'
  - Hyland hedges boosters metadiscourse ChatGPT comparison
  - legal writing generative AI prose style law review 2025 2026
sources_added:
  - wikipedia-signs-of-ai-writing
  - reinhart-2025-do-llms-write-like-humans
  - johndrow-2025-is-it-human-or-ai
  - kobak-2025-excess-vocabulary
  - russell-2025-frequent-chatgpt-users-detect-ai-text
  - jiang-hyland-2025-rhetorical-distinctions
  - economist-2026-how-to-spot-ai-writing
  - gruber-2026-economist-how-to-spot-ai-writing
  - garner-2026-ai-bad-legal-writing
  - provost-1985-100-ways-to-improve-your-writing
  - haisley-concise-guide-english-grammar
  - robbins-2025-how-to-tell-ai-written
limits: >-
  The "sentence weight" article was not found; the closest wording is a
  writing-app company's blog post (rwrt team, "Why AI Writing Has No Rhythm,"
  Jan. 5, 2026, rwrt.app/blog/ai-writing-no-rhythm), which was read but not
  added as a source because its figures are unsourced. The Economist study and
  Sam Kriss's New York Times Magazine essay (Dec. 3, 2025) are paywalled and
  were not read; the Economist's findings were taken from John Gruber's
  quotations. The Reinhart and Kobak papers were read in full on Europe PMC;
  the Russell and the Jiang and Hyland papers were read at abstract level only. Provost's book was not read; the passage comes
  from a quotations page. A Fast Company article and a Search Engine Journal
  column refused automated access. Two pages had no Wayback capture.
---

Trevor asked for research into what makes AI-written prose recognizable, so
that the project's AI-assisted drafts read well. The findings went into
section 8 of the [style guide](../../../docs/style-guide.md#8-sound-and-rhythm).

Findings that shaped the rules:

- Corpus studies find chat models overuse a small, shifting set of words
  (*delve*, *pivotal*, *underscore*), write in a noun-heavy style whatever the
  genre, and use fewer hedges, boosters and attitude markers than human
  writers. Sources: `kobak-2025-excess-vocabulary`,
  `reinhart-2025-do-llms-write-like-humans`, `johndrow-2025-is-it-human-or-ai`,
  `jiang-hyland-2025-rhetorical-distinctions`.
- Wikipedia's field guide lists recurring patterns with examples: avoiding
  "is" and "has," claims of significance in trailing "-ing" phrases,
  "not X but Y" frames, lists of three and vague attributions. It also warns
  that detectors and untrained readers err, and that perfect grammar and
  formal prose are not tells. Source: `wikipedia-signs-of-ai-writing`.
- Em dashes are no longer a reliable sign. The Economist's 2026 study found
  that current models write longer sentences with less punctuation overall.
  Sources: `economist-2026-how-to-spot-ai-writing` as quoted in
  `gruber-2026-economist-how-to-spot-ai-writing`.
- The "sentence weight" idea is best grounded in two older sources: Provost's
  passage on varying sentence length, and the linguistic principles of
  end-focus and end-weight. Sources:
  `provost-1985-100-ways-to-improve-your-writing`,
  `haisley-concise-guide-english-grammar`.
- For legal writing, Garner argues that AI will remove visible defects, so
  polish will no longer signal careful thought, and that fabricated authority
  is the failure to guard against. Source: `garner-2026-ai-bad-legal-writing`.

Project analysis: most of the existing style guide (plain words, active voice,
naming the actor, no dashes) already works against these habits. The new
section adds rhythm, emphasis, stock phrases and committing to claims, and
frames the rules as editing for clarity, not as evading detection.
