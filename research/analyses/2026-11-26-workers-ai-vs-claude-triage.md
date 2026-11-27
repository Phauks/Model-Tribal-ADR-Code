# Workers AI or Claude for the source watch's triage: a side-by-side test on 88 real items

**Status:** research spike, written Nov. 26, 2026, in answer to Trevor's request for "a spike on workers AI vs a claude worker just so i can tangibly see the differences for the use case" (project chat, Nov. 26, 2026). It decides nothing and built nothing permanent: no Worker, gateway, key or stored data was created in Cloudflare. The source watch and its triage step are described in [source-watch.md](../../docs/source-watch.md) and decision record [0059](../../docs/decisions/0059-watch-for-new-legal-sources-with-plug-in-watchers.md); PR #540 made Inkling 2 Small on Workers AI the default model. Numbers in brackets point to the Sources list in section 9. "Measured" means a script in this spike counted it; "project analysis" marks my own estimate or reading, with its basis.

## 1. Short answer

Every model tested sorted the easy part well, and none of them let a relevant item be closed without a person seeing it. The differences are in the middle: noticing that an item is something we already hold, telling a passing mention of a tribe from Indian law, and how much it costs and how long it takes.

| Model | Where it runs | Relevance right (of 68) | Noise closed with no review (of 43) | Matched to a record we hold (of 14) | Cost per 1,000 items | Time per item, one at a time |
| --- | --- | --- | --- | --- | --- | --- |
| Inkling 2 Small, low reasoning (the PR #540 default) | Workers AI | 65 | 37 | 10 | $0.69 | 1.3 to 1.8 s |
| Inkling 2 Small, high reasoning | Workers AI | 63 of 67 | 31 | 10 | $1.79 | about 4.1 s |
| Gemma 4 26B | Workers AI | 62 of 67 | 38 | 12 of 13 | $0.54 | about 14.7 s |
| gpt-oss-120b | Workers AI | 66 | 41 | 12 | $0.71 | 7.6 to 8.9 s |
| Llama 3.3 70B | Workers AI | 62 | 36 | 8 | $0.52 | 1.8 to 1.9 s |
| Claude Haiku 5.5 (stand-in, see section 2) | Claude | 66 | 36 | 9 | about $0.21 to $0.48, plus 5% | not measured |
| Claude Opus 5.5 (stand-in) | Claude | 66 | 35 | 14 | about $8 to $30 | not measured |

What this means in plain terms (project analysis, from the table and section 4):

- **Inkling at low reasoning and gpt-oss-120b are a near tie, with gpt-oss-120b slightly ahead.** On relevance they differ by one item in 68 (66 against 65), which is within the noise of a test this size. gpt-oss-120b closed more noise with no review (41 of 43 against 37), so it would leave an editor less to read, and it matched more held records (12 against 10). That record gap is entirely regulation sections (3 of 5 against 1 of 5); with the rule suggested in section 7 both would match all 14. Neither let a relevant item close.
- **What counts against gpt-oss-120b.** It is about five times slower (8 seconds against 1.5), which matters little for a scheduled job (section 6). It put three regulations in a collection the key rejects, against Inkling's one. And it once gave a false reason, describing a public-lands hearings rule as part of "the land-acquisition process for Indian reservations" (section 5, example 6); the other models' reasons were not all audited, so this is not proof that Inkling never does the same. It also raised only 2 privacy holds where the others raised 5 or 6; that matched the key here, but none of the 88 items was a real case, so the test cannot say whether it would catch one.
- **Cost does not separate them.** $0.71 against $0.69 per 1,000 items. At the source watch's expected volume (about 6,000 items a year [1]) either uses roughly 60 Neurons an item, about 1,000 Neurons a day, inside the 10,000 Neurons a day that Workers AI gives free [2]. So either costs about nothing.
- **Inkling is already the default (PR #540)**, which should not count in its favor. A run of these two models alone on a few hundred more items would separate them, at no cost inside the free allowance.
- **Linking a regulation section to the part we hold is weak for most models.** Inkling got 1 of 5, gpt-oss-120b 3, Haiku 0, and only Opus all 5. This is better done by a rule than by any model (section 7).
- **High reasoning did not help.** Inkling at high reasoning was slower, cost 2.6 times as much, failed to answer 14 of 109 calls, and was no more accurate.
- **Opus is the most careful, not the most different.** It was the only model to match every record we already hold, but its relevance calls equal Haiku's and gpt-oss-120b's, at 10 to 40 times the price. It earns its place on the hard cases, not the daily stream.
- **Llama 3.3 70B is the one to avoid.** It missed three Federal Register notices we already hold, which would create duplicate records, and invented one match. It put a privacy hold on a federal job form because its title contains "Child Care". It gave a confidence near 1.0 to every answer, so its confidence means nothing.

## 2. What was tested

**The items.** 88 real candidates of the kinds the source watch finds [1], gathered Nov. 26, 2026:

- 17 Federal Register documents from the Indian affairs agencies' feeds (Bureau of Indian Affairs, Indian Health Service, National Indian Gaming Commission) [3].
- 53 Federal Register documents from the all-agency search for "tribe" or "tribal", the noisiest stream [3].
- 11 current eCFR sections: title 25 sections whose parts we hold, 42 C.F.R. part 136 (Indian Health Service) and 43 C.F.R. part 4 (Interior hearings) [4].
- 7 nations' web pages linked from their profiles, as changed pages.

Each item came with up to six records we already hold that might be related, picked by title words from the library index, the way the watch's known-records step would. For 9 Federal Register items the list included the very notice, since we already hold it: a fair test of whether a model sees a duplicate.

**The instructions.** All seven models got the same instructions, word for word, checked by a hash of the text before every call. They are the production triage instructions in `site/src/lib/server/watch/triage.ts`, with three changes needed to score the test. The answer comes as a JSON object rather than through the `classify` tool, since Workers AI and the Claude stand-ins could not share one tool format. A `record` field asks which listed record the item is the same as or a new version of, and `same-as` and `regulation-sections` were added to the allowed answers. The full text is in [the prompt file](../reviews/2026-11-26-triage-model-comparison-prompt.txt).

**How Claude was run.** The project has no Anthropic key, and the Cloudflare connector refused Claude models through AI Gateway (no Unified Billing credits on the account). So Haiku 5.5 and Opus 5.5 ran as Claude subagents of this session, reading the same instructions and items and writing one answer per item. Their accuracy is a fair stand-in for the API models; their speed and token counts are not, so those are estimated from Anthropic's prices (section 6). To measure Claude for real, Trevor would add Unified Billing credits and create the gateway named in the source watch's settings, or give an Anthropic key as a Worker secret.

**How Workers AI was run.** Through the Workers AI REST endpoint with the account's connector, models `@cf/thinkingmachines/inkling-2-small`, `@cf/google/gemma-4-26b-a4b-it`, `@cf/openai/gpt-oss-120b` and `@cf/meta/llama-3.3-70b-instruct-fp8-fast` [5]. Inkling used `reasoning_effort` low and high, as PR #540 does for the middle band and the hard cases. A fifth model, GLM 5.3, was dropped because it costs about four times Inkling ($1.40 and $4.40 per million tokens) [5].

**The answer key.** I wrote the key item by item from the documents themselves, before reading any model's answers, marking each item relevant, not relevant, or a judgment call ("j", 20 items where a careful editor could go either way). A separate Opus 5.5 agent then checked the whole key against the policy. It agreed fully on 73 of 88 items, and its 15 corrections were applied (for example, Paperwork Reduction Act notices are not relevant whatever their subject, and a general regulation is not a privacy matter). Relevance is scored on the 68 non-judgment items.

## 3. What the scores mean

- **Relevance right:** the model's yes or no matches the key.
- **Noise closed with no review:** the production rule closes an item without a person when the model says not relevant, proposes "not-relevant" and gives a confidence of 0.85 or more; everything else goes to the review queue. Higher is less work for an editor. No model closed a relevant item this way.
- **Matched to a record we hold:** for the 14 items that are the same as, or a section of, something we hold (9 Federal Register notices, 5 regulation sections), whether the model named that record.

Per-item answers for every model are in [the comparison table](../reviews/2026-11-26-triage-model-comparison.csv).

## 4. Where they went wrong

**Paperwork notices on tribal subjects.** Every model called two notices relevant that the key says are not: an information collection on gathering plants by federally recognized tribes on Park Service land, and one on tribal employers joining the federal employee health plan. Both are about tribes but are not law. These only reach the review queue, so the cost is an editor's minute (project analysis).

**Privacy holds on things that are not cases.** Every model but gpt-oss-120b put a hold on a proposed federal child welfare rule, a youth wellness court program page and three nation pages that list guardianship or protection orders among a court's case types or a code's chapters. The key says none of these is a particular person's matter. The fault is in the instructions, not the models: they say to flag "if anything suggests" a child or family matter, and every model took that literally. A hold only means a person looks first, so this errs on the safe side (project analysis).

**Regulation sections and their parts.** For the five title 25 sections whose parts we hold, the key expects the model to say the section belongs to that part. Inkling (both levels) and Haiku said instead that it is a new record, reasoning that "we hold the part, not this section". That is a defensible reading of the instructions, so it is as much an unclear instruction as a model error.

**Duplicates.** Llama 3.3 70B missed 3 of the 9 Federal Register notices we already hold, proposing to add them again; Gemma missed 1. Inkling, gpt-oss-120b, Haiku and Opus caught all 9.

**Failed answers.** Inkling at high reasoning returned nothing for 14 of 109 calls, 13 of them because its reasoning used up the 3,000-token limit; one item still failed at 12,000. Gemma cut one answer off mid-JSON. Inkling at low reasoning, gpt-oss-120b and Llama answered every item. Separately, Workers AI returned "too many requests" (HTTP 429) 5 times for Inkling low and 6 times for Inkling high when many calls ran at once; every retry succeeded.

**Confidence.** Llama gave about 1.0 to everything and Gemma 1.0 to most things, so their confidence cannot drive the auto-close rule. Opus and Haiku gave lower, more spread confidences (often 0.5 to 0.7 on judgment items), which is why they closed slightly fewer noise items than Inkling. Inkling sat between.

## 5. Side by side: where the models differ

1. **A notice we already hold.** *Indian Gaming; Approval by Operation of Law of the Squaxin Island Tribe and State of Washington Gaming Compact* (Fed. Reg. doc. 2026-19928), with that very notice in the list of held records. Inkling, Gemma, gpt-oss-120b, Haiku and Opus: "same-as federal-register-2026-19928". Llama: "add", with the reason "Announces approval of gaming compact amendment." Adopting Llama's answer would make a second copy.

2. **The same, for a liquor ordinance.** *Ohkay Owingeh, New Mexico-Liquor Control Ordinance Amendment* (2026-21473). Every model but Llama matched the held notice. Llama proposed "new-version" with no record named.

3. **A trap in a title.** *30-Day Proposed Information Collection: Addendum to Declaration for Federal Employment (OF 306), Indian Health Service, Child Care…*, a federal hiring form. Six models: not relevant, no hold. Llama: relevant, with a "child-or-family-case" hold.

4. **A disaster declaration.** *Presidential Declaration of a Major Disaster for the Oglala Sioux Tribe* (a judgment item). Inkling at both levels: not relevant, "an emergency-management action, not about the tribe's law, government, courts". Gemma, gpt-oss-120b and Llama: relevant, to add. Haiku and Opus: relevant, but only "note" it. Three readings of one notice; this is the kind of call an editor should make once and write down.

5. **Air permits in Indian country.** *Approval of Clean Air Act General Permit Requests for Coverage for New or Modified Minor Source Concrete Batch Plants…* (judgment). Inkling low: not relevant, "environmental permitting, not Native nations' law". Inkling high and the rest: relevant, as federal regulatory jurisdiction on the Navajo Nation. Opus put it best ("regulatory jurisdiction in Indian country; worth noting") at confidence 0.5, which sends it to review.

6. **A made-up connection.** *43 C.F.R. § 4.104 Prehearing conferences*, from the Interior hearings subpart for public lands and grazing (judgment). Inkling, Gemma, Haiku and Opus: not relevant. gpt-oss-120b: relevant, saying the section "governs prehearing conferences in the land-acquisition process for Indian reservations, directly relating to tribal land establishment". Nothing in the section says that. Llama: relevant, "Regulation about prehearing conferences."

7. **A section of a part we hold.** *25 C.F.R. § 522.2 Submission requirements* (gaming ordinances), where we hold part 522. Opus and Llama: a new version of cfr-25-part-522; Gemma: the same as it. Inkling, gpt-oss-120b and Haiku: a new record, because "we hold the part as a whole but not this section as its own record".

8. **A court page and the privacy flag.** The Shingle Springs Band of Miwok Indians' *Tribal Court* page, which lists guardianships and restraining orders among its case types. All seven held it as both a child or family case and a protection order. The page names no person; under the key's policy it needs no hold. This is the instruction wording at work (section 4).

9. **A paperwork notice two models let through.** *60-Day Notice for Reinstated Collection: Division of Urban Indian Affairs Uniform…* Inkling, Haiku and Opus: not relevant. Gemma, gpt-oss-120b and Llama: relevant, to add.

10. **A consultation notice.** *Notice of NIH Tribal Consultations and Listening Session.* The instructions say a notice that merely mentions consultation with tribes is not relevant. Inkling low, gpt-oss-120b, Haiku and Opus followed that; Inkling high, Gemma and Llama did not.

## 6. Speed and cost

**Prices.** Workers AI bills in Neurons at $0.011 per 1,000 Neurons, with 10,000 Neurons a day free for every account [2]; the catalog also gives each model a price per million tokens, read Nov. 26, 2026 [5]:

| Model | Input, per million tokens | Output, per million tokens |
| --- | --- | --- |
| Inkling 2 Small | $0.30 (cached $0.10) | $1.00 |
| Gemma 4 26B | $0.10 | $0.30 |
| gpt-oss-120b | $0.35 | $0.75 |
| Llama 3.3 70B fast | $0.293 | $2.253 |
| Claude Haiku 5.5 | $0.10 | $0.50 |
| Claude Opus 5.5 | $4.00 (cache reads $0.20) | $20.00 |

Claude prices are Anthropic's list prices [6]; through AI Gateway's Unified Billing Cloudflare passes them through and adds 5% when credits are bought [7].

**Tokens and cost per 1,000 items (measured for Workers AI).** Every model read about 1,240 to 1,340 tokens per item. Output varied far more: Llama wrote about 69 tokens, Inkling low 287, gpt-oss-120b 363, Gemma 1,345 and Inkling high 1,391 (the reasoning models count their thinking as output). That gives the costs in the table in section 1. For the Claude stand-ins I assumed the same 1,340 tokens read and 150 to 700 written for Haiku (it thinks by default at medium effort), and 150 to 1,200 for Opus, whose thinking cannot be turned off [6] (project analysis).

**Per year.** At about 6,000 items a year [1]: Inkling low about 1,000 Neurons a day, Inkling high about 2,700, so both stay inside the free allowance and cost about $0 unless other Workers AI use on the account fills it. Haiku would be about $1.60 to $3 a year with the 5% fee; Opus for every item, $50 to $190 a year; Opus for about 300 hard cases a year, a few dollars at these item sizes (project analysis, from the prices above).

**Speed (measured, one call at a time, after the main runs).** Inkling low 1.3 to 1.8 seconds; Llama 1.8 to 1.9; Inkling high about 4.1; gpt-oss-120b 7.6 to 8.9; Gemma about 14.7. The batch runs, with up to 30 calls at once, were much slower (Inkling low's median 2.9 seconds, Gemma's 26), partly from queueing. For a watch that runs on a schedule, none of these speeds matters much; the 429 replies under load matter more.

## 7. Side findings for the source watch

These came up while running the test. None is decided here; they are for the build thread and Trevor.

1. **Reword the privacy instruction.** Flag a case about a particular person (a child, a family, a protection order), not a code chapter list, a form, a regulation or a description of a program. Every model followed the current "if anything suggests" wording into five unneeded holds.
2. **Link regulation sections to their part by rule.** The section number already says which part it belongs to; a rule gets this right every time, where the best model got 5 of 5 and the default got 1 of 5.
3. **Filter 43 C.F.R. part 4 to its Indian subparts.** Sections such as 4.104 to 4.171 are the public-lands and grazing hearing rules; watching all of part 4 sends noise to the models.
4. **Add `regulation-sections` to the collection list** in the production instructions; eCFR sections have nowhere exact to go without it.
5. **Retry an empty answer.** Inkling at high reasoning returned nothing on about one call in eight, nearly always at the token limit. PR #540 sets 16,000 tokens for high, which should cover most of these, but an empty or cut-off answer should be retried once or sent to review.
6. **Retry "too many requests".** Workers AI returned 429 when many calls ran at once; a short wait and retry fixed every one.
7. **The Claude path in triage.ts would fail on Opus 5.5.** It forces the `classify` tool with `tool_choice`, which Opus 5.5 rejects with an error, and its 1,200-token limit is tight for a model that always thinks [8]. Haiku 5.5 accepts forced tools only with thinking turned off.
8. **One price in model-prices.ts is off.** It gives Opus 5.5 cached input as $0.40, a project estimate; Anthropic's rate for Opus 5.5 cache reads is $0.20 [8].

## 8. Limits of this test

- **88 items is small.** One or two items change a score by a few points; differences of one or two between models are noise (project analysis).
- **The key was written by the same model family as one of the contestants.** An Opus 5.5 session wrote it and an Opus 5.5 agent checked it, which may favor Opus. The judgment items were kept out of the relevance score for this reason, and the per-item table lets anyone recheck.
- **Claude ran as subagents, not through the API.** Its accuracy should carry over; its speed, token counts and failure rate were not measured.
- **No real privacy case.** None of the 88 items was a particular child's or family's matter, so the test shows which models over-flag, not which would miss a real one. A later test should add a few redacted examples from the held Tribal opinions.
- **Short inputs.** Items carried a title, summary and facts, not whole documents. Longer inputs would raise every cost in proportion and might change accuracy.
- **One day's catalog.** Workers AI's models and prices change often; these were read Nov. 26, 2026.

## 9. Sources

1. Tribal Law Project, [source-watch.md](../../docs/source-watch.md), "Rate of work and cost (estimates)" (about 6,000 candidates a year reach a model).
2. Cloudflare, [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) (read Nov. 26, 2026): $0.011 per 1,000 Neurons; 10,000 Neurons a day free.
3. Office of the Federal Register, [Federal Register API](https://www.federalregister.gov/developers/documentation/api/v1), documents search, queried Nov. 26, 2026.
4. Office of the Federal Register, [eCFR API](https://www.ecfr.gov/developers/documentation/api/v1), titles 25, 42 and 43, queried Nov. 26, 2026.
5. Cloudflare, Workers AI model catalog, read through the account's API on Nov. 26, 2026, and the model pages for [Inkling 2 Small](https://developers.cloudflare.com/workers-ai/models/inkling-2-small/), [Gemma 4 26B](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/), [gpt-oss-120b](https://developers.cloudflare.com/workers-ai/models/gpt-oss-120b/) and [Llama 3.3 70B fast](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/).
6. Anthropic, [pricing](https://platform.claude.com/docs/en/about-claude/pricing): Claude Haiku 5.5 (`claude-haiku-5-5`) $0.10 and $0.50 per million tokens; Claude Opus 5.5 (`claude-opus-5-5`) $4 and $20, cache reads $0.20.
7. Cloudflare, [AI Gateway Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/).
8. Anthropic, Claude API model migration notes for Claude Opus 5.5 and Claude Haiku 5.5 (forced `tool_choice` returns an error on Opus 5.5; thinking cannot be disabled on Opus 5.5; Opus 5.5 cache reads at 0.05 times input), as bundled with Claude Code, read Nov. 26, 2026.
