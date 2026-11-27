# 0064. Check each fact against the source it cites, and answer visitors' questions only from our records

- **Status:** Proposed (waiting for Trevor Goldsmith's choice)
- **Date:** 2026-11-27
- **Extends:** decision records [0051](0051-search-the-source-documents-through-a-private-full-text-library.md) (the full-text library), [0056](0056-let-nations-restrict-their-laws-and-opinions.md) (nations' restrictions), [0057](0057-replace-names-in-tribal-court-opinions-with-initials.md) (initials in opinions), [0059](0059-watch-for-new-legal-sources-with-plug-in-watchers.md) (the source watch and its models) and [0062](0062-add-passkeys-outside-sign-in-and-a-person-check.md) (Turnstile)

## Context

On Nov. 27, 2026 Trevor Goldsmith asked what Wikiwand-style AI tools (Summarize, Timeline, Top questions and especially Fact check) would look like on the site, for the team and for visitors, and asked that visitors be able to ask an agent to do research for them. Wikiwand describes its Fact Check as cross-referencing "live sources" and other language editions, without saying how ([Chrome Web Store listing](https://chromewebstore.google.com/detail/wikiwand-wikipedia-modern/emffkefkbkpkgpdeeooapgaicgmcbolj?hl=en)). Commercial legal research tools built on retrieval still gave incorrect or misgrounded answers 17% to 34% of the time in Stanford's tests ([Stanford HAI, May 23, 2024](https://hai.stanford.edu/news/ai-trial-legal-models-hallucinate-1-out-6-or-more-benchmarking-queries)).

This site already cites a source for nearly every fact, keeps the source's own words for governance facts, and holds the text of 13,866 source documents page by page in the library. A test on Nov. 27, 2026 checked 38 facts from three nation pages against their constitutions with Inkling 2 Small on Workers AI, for about 2 cents: 36 Supported and 2 Partly supported, both flags probably caused by poor scanned text in our copy. The full design, research, mockups and cost model are in [docs/fact-check-and-ask.md](../fact-check-and-ask.md).

## Decision (proposed)

1. **Fact check is a citation check.** Each cited fact is compared with the text of the source it cites, from the library. Stored quotes are aligned by rule. A model judges each fact Supported, Partly supported, Not supported or Not found in this source; the words shown are always our own copy's, found by alignment, never the model's. Facts whose source text we do not hold, or may not show, are Can't check, without a model call.
2. **Results are made in a nightly batch and stored.** Visitors read stored results and never start a model run. Staff can check one page at once. Fact check never edits a page, never writes a quote, and never changes Verified or Unverified.
3. **The team first.** A review queue at `/workspace/fact-check` comes first. Visitors see a flag only after a person confirms it.
4. **Ask answers only from our records,** first about the open page, later the whole site, through read-only tools that apply each visitor's rights before the model sees anything. Every sentence must cite a page or passage the tools returned; anything else is removed in code. Questions about a person's own situation get a fixed not-legal-advice answer and a pointer to legal help. Each step opens to visitors only after it passes a fixed set of test questions.
5. **Limits.** Turnstile before the first question, a per-minute rate-limit binding and a daily count per address, a daily budget for all of Ask, and 90-day logs without addresses.
6. **Nations and privacy.** Nations' restrictions and the privacy holds apply to both tools; held Tribal court opinions and text from hosts that signal against AI use are never sent to a model; a claimed nation can leave its pages out of both tools; Ask does not retell peacemaking stories or cultural material.
7. **Models and retrieval.** Inkling 2 Small through the Workers AI binding, with Claude through AI Gateway as a setting, as in decision record 0059. Retrieval uses the library's full-text index and the site's search index; Vectorize is added only if the test questions show keyword search missing answers. Cloudflare AI Search is not used.
8. **No Summarize or AI Timeline.** Top questions become a few reviewed suggested questions in Ask.

## Options weighed

- **Fact check against the open web, as Wikiwand describes it.** Rejected: our facts already name their sources, the web is noisier, and checking the cited source catches the failure that matters most here, a citation that does not support its sentence.
- **Live fact checks for every visitor.** Rejected: the same answer for every visitor can be computed once; live runs would cost money per visit and invite abuse.
- **Showing unconfirmed flags to visitors.** Not recommended: in the test both flags were probably caused by our copy's poor text.
- **Cloudflare AI Search instead of our library.** Rejected for now: it would re-parse documents without our page labels, offers only five filterable metadata fields for the restrictions, skips PDFs over 4 MiB without OCR, and charges per search ([AI Search limits and pricing](https://developers.cloudflare.com/ai-search/platform/limits-pricing/)).
- **Summarize and an AI timeline.** Rejected: they would put uncited paraphrase and unverified dates above cited facts.

## Consequences

- Two D1 tables for results, a review permission (`review-fact-check`), a nightly Workflow, two header buttons and side panels, a How Ask works page, an Ask log table, and a new choice on nation teams' Laws and cases page. Each piece is built only after its mockup is approved.
- Estimated cost: about $15 for the first full fact check, about $1 a month after, and about half a cent per Ask question under a daily budget.
- A person's review is the steady work: flags, quote mismatches, and a weekly sample of answers.
- The check doubles as a data-quality tool: the test found stored quotes that do not match our OCR text and two served documents whose text is an empty challenge page.

## Sources

- [docs/fact-check-and-ask.md](../fact-check-and-ask.md) and every source it lists.
