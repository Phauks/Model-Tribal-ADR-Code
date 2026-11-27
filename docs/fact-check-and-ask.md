# Fact check and Ask: automated tools on the website

Design note, Nov. 27, 2026, revised the same day. Nothing here is built. Trevor Goldsmith chose plan A (Fact check first, then Ask) and asked for a better-looking Fact check, clearer ways into it, a check per section and not only per page, and marks in the text showing when and how each fact was confirmed. Section 4.2 is the revised design. Decision record [0064](decisions/0064-check-facts-against-their-sources-and-answer-from-our-records.md) is accepted.

Trevor asked on Nov. 27, 2026 what Wikiwand-style AI tools (Summarize, Timeline, Top questions, Fact check) would look like here, especially Fact check, for the team's own use and for visitors, and asked that visitors also be able to ask an agent to do research for them rather than do it all by hand.

Mockups are in the project files, in `design/fact-check-and-ask/`. The revised Fact check is in `round-2/`: marks and the legend, a section's checked words (desktop light and dark, phone), a prose section (Worcester v. Georgia) and the citation card (light and dark). The third round, in `round-3/`, compares two marks that add no width, and draws Check again now (idle, running in light and dark), and readers' answers in the citation card (light and dark) and in References on a phone. The first round (the side panel, Ask desktop light and dark and phone, and the workspace review queue) is in the folder itself; its Fact check panel is replaced by round 2, and its Ask and review queue mockups still stand. They are drawn over the live Karuk Tribe and Worcester v. Georgia pages. Every verdict and quoted line in them comes from the test runs in section 3, not from imagination.

## 1. Recommendation

1. **Fact check, built as a citation check.** For each fact on a page, compare it with the words of the source it already cites, show the matching words from our own copy, and say Supported, Partly supported, Not supported, or Can't check. Run it in a nightly batch, store the results, and show visitors the stored results. Visitors never start a model run, so they cost nothing and cannot run up a bill.
2. **Staff first, visitors second.** Start with a workspace review queue and hand-label about 200 results to measure accuracy. Then open the stored results to visitors, showing a flag (Partly or Not supported) to visitors only after a person confirms it, because poor scanned text causes false flags (section 3).
3. **Ask, grounded only in our records, after Fact check.** First "Ask about this page" (answers only from the open page and the sources it cites), then "Ask the whole site", each opened to visitors only after it passes a fixed set of test questions. Every sentence carries a citation to our pages; anything uncited is dropped; personal legal questions get a clear "not legal advice" answer and a pointer to legal help.
4. **No Summarize or AI Timeline.** Top questions become two or three suggested questions in Ask, written from search logs and reviewed, not generated for each visit.
5. **Retrieval: the library we already have.** Use the full-text library in D1 (299,511 passages with page numbers) and the site's search index. Add Vectorize for meaning-based search only if the test questions show keyword search missing answers. Do not use Cloudflare AI Search (section 7).
6. **Model: Inkling 2 Small on Workers AI**, through the binding the source watch already uses, with Claude through AI Gateway kept as a setting.

Estimated cost (section 8): about $15 for a first fact check of the whole site, about $12 a month after that to recheck every fact monthly (about $1 a month if only changed facts were rechecked), and about half a cent per Ask question, under a hard daily budget.

## 2. How others do it

**Wikiwand.** Wikiwand's own page lists its AI tools as Chat, Timelines, Top questions and Free text search, "AI generated using this page content", offered "alongside, not as a replacement for" Wikipedia's articles ([Wikiwand, About](https://www.wikiwand.com/about)). Its browser extension describes Fact Check as: "Validate Wikipedia's claims. Compare language versions, cross-reference with live sources, and get to the truth," and Chat as "a reading copilot that understands exactly what you're reading" ([Chrome Web Store listing](https://chromewebstore.google.com/detail/wikiwand-wikipedia-modern/emffkefkbkpkgpdeeooapgaicgmcbolj?hl=en)). Neither page says which sources Fact Check reads or how it decides, and neither gives a disclaimer. Wikiwand's home page refuses scripts (it also refused headless browsers on Nov. 22, 2026), so its panels could not be captured here. My reading of the listing: Wikiwand checks an article against the open web and other language editions. That fits Wikipedia, whose articles are often thinly cited. Our pages already cite a source for nearly every fact, so the useful check here is narrower and more reliable: does the cited source say this?

**Perplexity.** Perplexity searches the live web, keeps a handful of sources, and writes an answer with numbered citations, with the model "instructed to stay grounded in the retrieved text"; it does not publish its ranking method, and journalists have reported misquotes and citations that do not support the sentence they sit on ([LLM Pulse, How Perplexity works](https://llmpulse.ai/blog/how-perplexity-works/), a third-party vendor's description). The lesson taken here: a number after a sentence is not proof; the citation itself has to be checked.

**Consensus.** Consensus searches first (semantic and keyword search together, then re-ranking), uses models only on what it retrieved, runs "checker models" for relevance, and says so when nothing relevant is found ([Consensus, How it works](https://consensus.app/home/blog/how-consensus-works/)). Its Consensus Meter labels up to 20 papers yes, no or possibly, uses words "extracted, not generated", shows every underlying result, and states that the classifier is wrong about 10% of the time ([Consensus, Introducing the Consensus Meter](https://consensus.app/home/blog/introducing-the-consensus-meter/)). A librarian's review found the meter is "essentially a form of vote counting" that ignores study size, and that repeated runs ranked results differently ([Aaron Tay, Nov. 15, 2025](https://aarontay.substack.com/p/a-2025-deep-dive-of-consensus-promises)). Lessons taken here: retrieve first, quote rather than paraphrase, say "not found" plainly, and publish the error rate.

**Legal research assistants.** Stanford's study of the commercial legal tools found that Lexis+ AI and Ask Practical Law AI "produced incorrect information more than 17% of the time" and Westlaw AI-Assisted Research more than 34%, despite retrieval; it counts an answer as a hallucination when it is wrong or "misgrounded", meaning the law is stated correctly but the cited source does not support it, and concludes that retrieval "is not a panacea" ([Stanford HAI, May 23, 2024](https://hai.stanford.edu/news/ai-trial-legal-models-hallucinate-1-out-6-or-more-benchmarking-queries); [Magesh et al., Hallucination-Free?](https://arxiv.org/abs/2405.20362)). Free Law Project's CourtListener added meaning-based search with a fine-tuned ModernBERT encoder over sentence-based chunks of up to 480 tokens, run side by side with keyword search, and its posts describe search only, not generated answers ([Free Law Project, Mar. 11, 2025](https://free.law/2025/03/11/semantic-search/); [May 4, 2026](https://free.law/2026/05/04/semantic-search-on-courtlistener)). Lessons taken here: a legal answer tool must be measured on legal questions before launch, and "misgrounded" is exactly the failure Fact check is built to catch, in our own pages and in Ask's answers.

## 3. What the site already has, and a test run

What makes this cheaper and safer here than on Wikiwand (from the repository and project memory):

- Every fact on a data page and every claim in prose ends in a citation marker tied to a source record (`SourceUses.cite()` / `citeFact()`, `CitationMarks.svelte`). Claims do not need a model to find them.
- Governance facts already store the source's own words and a pinpoint, for example "Term: 4 years" with Article V and "All terms of office shall be for four (4) years." These can be compared word for word.
- The full-text library (decision record [0051](decisions/0051-search-the-source-documents-through-a-private-full-text-library.md)) holds 13,866 documents and 299,511 passages averaging about 2,000 characters, each with its PDF page and printed page or star page, and a `citing_records` table linking 8,694 source records to their documents (counts read from the library database on Nov. 27, 2026). 6,843 documents are served on the site.
- The quotation check (`site/src/lib/quote-context.ts`) already aligns quoted words against library passages as exact, close with differing words, or not found.
- Restrictions are already enforced in one place: nations' Show, Cite only or Hide choices (decision record [0056](decisions/0056-let-nations-restrict-their-laws-and-opinions.md), `site-restrictions.ts`) and the privacy holds on Tribal court opinions (decision record [0057](decisions/0057-replace-names-in-tribal-court-opinions-with-initials.md)).
- Turnstile and per-address rate limits already guard the public forms (decision record [0062](decisions/0062-add-passkeys-outside-sign-in-and-a-person-check.md); `site/wrangler.jsonc`).

**Test run, Nov. 27, 2026.** To check the idea before designing around it, I ran Inkling 2 Small on Workers AI, at low effort, on 38 governance facts from three nation pages (Karuk Tribe, Bridgeport Indian Colony, Native Village of White Mountain), each against the library's copy of the constitution the page cites. The whole run used about 2,000 Neurons, about 2 cents.

| Page | Facts | Result | Notes |
| --- | --- | --- | --- |
| Karuk Tribe (web copy, clean text) | 11 | 11 Supported | One fact came back "not found" when keyword search picked the wrong passages; sending the whole 19,000-character document fixed it. Ten more facts cite the BIA Tribal Leaders Directory, which the library does not hold: Can't check. |
| Bridgeport Indian Colony (scanned PDF, OCR text) | 21 | 21 Supported | 19 of the 21 stored quotes do not appear word for word in our copy's text, because they were typed from a cleaner reading than our OCR. |
| Native Village of White Mountain (scanned PDF, partial text) | 6 | 4 Supported, 2 Partly supported | Both flags are probably caused by our copy's garbled text, not by the page: the model could not find a Preamble in text it could not read. |

What the run taught, which the design below follows:

1. **Send the whole document when it is short.** Checking all of a source's facts in one call with the whole document was both more accurate and cheaper (35 to 51 Neurons a fact) than one call per fact with searched passages (66 to 116 Neurons a fact).
2. **Never show the model's copy of the words.** On scanned sources the model "cleaned up" the OCR in the words it returned, so its quotes matched our copy only loosely. The page must show the passage from our own copy, found by aligning the model's words with the quotation check, and only show it when the alignment holds.
3. **Text quality decides whether a flag is trustworthy.** Flags on documents with poor or partial text go to a person first, never straight to visitors.
4. **The check finds data problems too.** It surfaced the Bridgeport quote mismatches, and while looking up sources I found two documents served on the site whose text is a "Just a moment..." challenge page with no content (`tribal-law/documents/8c24a89ef39baa1ea2cd.html` and `adbfb8d9ba8491733265.html`).

**Second test, a prose page, Nov. 27, 2026.** To see whether the same check works on prose and not only on governance facts, I ran Inkling 2 Small on six cited sentences from the Worcester v. Georgia page against the library's copy of the opinion (31 U.S. 515 (1832)). All six came back Supported. Each pinpoint the page gives also matched the official report: in our copy, the U.S. Reports page is the PDF page plus 514, so a claim cited "at 516" can be looked up on PDF page 2 without a search. The words shown in the mockups are our copy's own, for example "all white persons, residing within the limits of the Cherokee nation … without a license or permit from his excellency the governor … shall be guilty of a high misdemeanour" (31 U.S. at 516), including the OCR's stray period in "four. years" (at 536), which shows the page is quoting our copy and not a model's tidied version.

## 4. Fact check

### 4.1 What it checks

A **claim** is one fact or sentence with its citation markers, taken from what the page build already knows: the text, the source record behind each marker, the pinpoint (article, section or page) and, for governance facts, the stored quote. Sentences in prose with no marker are listed separately as "No source cited" for staff; they are not judged.

For each claim the pipeline:

1. **Finds the source text.** The source record's documents come from `citing_records`. If the library holds no text for it, or the text is a held or restricted copy, the result is **Can't check** with the reason, and no model is called.
2. **Checks stored quotes by rule.** A stored quote is aligned against the document with the quotation check: exact, close (differing words shown), or not found. No model is needed for this part.
3. **Gathers evidence.** If the document is under about 40,000 tokens, it is sent whole, once for all the claims that cite it on the page. Longer documents are narrowed first: the pinpoint's page or section if there is one, then the best keyword matches in the library's full-text index.
4. **Asks the model** for a verdict per claim (Supported, Partly supported, Not supported, Not found in this source), the passage it relied on, the words that bear on it, and one sentence of reasons, through a strict tool schema.
5. **Verifies the answer in code.** The words are aligned against the named passage. If they cannot be found there, the verdict becomes **Can't tell** and goes to a person. The words shown are always our copy's, never the model's.
6. **Takes a second look** at every Partly supported, Not supported and Can't tell at high effort, and at a weekly random sample of Supported results, the same pattern as the source watch.

Results are kept per claim, keyed by the page's text, the source document's text digest, the instructions' version and the model, so a claim is checked again only when one of those changes.

### 4.2 Who sees what

Fact check has no panel and no header button. It lives in the page itself, in three places a reader already looks: the citation marks, the section headings, and the badge line under the title. (This replaces the first round's side panel.)

**Marks on citations.** Trevor Goldsmith asked on Nov. 26, 2026 that the marks not take up space. Round 2 put an icon after each citation number (clear, but about 13px each); round 3 tried an underline and a small dot on the number, which he found odd. Round 4 (`round-4/marks-options-facts-*.png` and `marks-options-prose-*.png`) compares the icon, a colored number, a check inside the number, and a check in the margin. The recommendation, waiting for his choice, is **a check in the margin**: one icon per fact row, lined up at the right edge of the value column, and one per paragraph in the left margin for prose, so nothing is added inside a line. Hovering or focusing the check names its status, source and date. A paragraph with several sources shows its lowest status (Can't check over Checked by computer over Confirmed by our team), and opening the section shows each fact on its own. Color alone and bold or italic text were set aside: color alone would undo the site's color-blindness work, italics already mark case names, and bold reads as emphasis.

| Mark | Icon in the margin, card and legend | Means |
| --- | --- | --- |
| Checked by computer | outline circle with a check | The nightly check found the fact in the cited source and the words were found in our copy. |
| Confirmed by our team | filled badge with a check | A person compared the fact with the source and agreed. On a claimed nation's page, the nation's team can confirm too, shown as "Confirmed by the nation". |
| Can't check | circle with a minus | We do not hold the source's text, or may not show it. |

Flags (Partly or Not supported) have no mark for visitors until a person confirms them (section 4.3 and 4.4 rules still apply). A reader who does not want the marks turns them off in Settings, under Citations, with "Show fact check marks" (on by default).

**How people get into it.**

1. **The badge line.** Beside the page's Verified or Unverified badge, a "Fact check" badge with a count (for example "Fact check 11") opens a short legend: what the three marks mean, that a computer did the checking and can be wrong, the date of the last run, that it does not change whether the page is Verified, and "How Fact check works". This is the page-level entry, and it is where a first-time reader learns what the marks are.
2. **Each section heading.** Each section with checked facts gets a small button at the right of its heading, an icon with a count ("8"), labeled for screen readers "Fact check this section: 8 checked". Pressing it opens the checked words inside that section: under each fact, the matching words from our copy of the source, with the citation and date ("Constitution, Article V · Nov. 27, 2026"). Pressing it again closes them. This is the per-section check Trevor asked for; it reads stored results, so it costs nothing and opens at once. Sections can be opened one at a time or all together from the legend. An open section also offers **Check again now**, which rechecks every fact in the section live while the reader watches: a progress line ("Checking 5 of 8…"), each fact turning from Waiting to Checking to its result, and the date becoming "checked just now". Trevor's reason: a reader trusts what they saw happen. The new result is saved, so the next reader sees today's date. If the live check finds a possible problem, the reader who ran it sees it, worded as "Our check found the source may not say this. Sent to our team."; other visitors see no change until a person confirms it. Check again needs a Turnstile pass, and is limited per person (for example 5 sections an hour) and by a daily budget for all readers. A 10-fact section costs about half a cent (section 8).
3. **The citation card.** Hovering or focusing a citation marker on a desktop already shows the source card. The card gains a line for the check, "Checked by computer · Nov. 27, 2026" or "Confirmed by our team · Nov. 27, 2026", the words from our copy with their pinpoints ("at 516"), and Copy, Show the paragraph and Report a problem buttons. On phones, tapping a marker goes to References as it does today, and each reference shows the same check details under the fact it supports.
4. **Readers' answers.** Under the check, signed-in readers see "Does this match the source?" with Matches the source and Doesn't match (with an optional reason). Answers go to the team's review queue, ranked by how many readers disagree; they never change the public mark, because a few accounts could game it. A mark becomes Confirmed only when someone accountable confirms it: our team, or the nation's own team on a page the nation has claimed, shown as "Confirmed by the nation".

Every place that shows words says whose they are: our copy of the source, found by alignment. "Think a result is wrong? Report a problem" opens the existing report form with the fact and source filled in.

**Team.** `/workspace/fact-check` lists results that need a person: flags, quote mismatches, Can't check and Can't tell, with the page, the fact, the model's reasons, the quality of our copy's text and Right or Wrong buttons. Right on a supported fact turns its mark into Confirmed by our team. Right on a flag makes it visible to visitors and opens a task to fix the page; Wrong records a mistake for tuning. "Check a page now" re-runs one page. Signed-in team members also see unconfirmed flags on the page itself, marked "Being reviewed". A new permission, `review-fact-check`, controls it. The page is built only after its mockup is approved.

**Never.** Fact check never edits a page, never changes Verified or Unverified, and never writes a quote. Confirmed by our team is about one fact and its source; Verified stays a statement about the whole page.

### 4.3 Privacy and nations' choices

- Only text a visitor could see is ever shown to visitors: served copies, not hidden by a nation, not held for privacy. For a source a nation set to Cite only, the verdict shows but not the source's words. For private copies (articles, Westlaw prints and other copyrighted works), the verdict shows with "Our copy of this source is private" and no text, as the library's rules already require.
- The 477 Tribal court opinions held for a privacy review are never sent to a model, only their redacted versions once filed. Text from hosts that signal against AI use (Municode, eCode360) is never sent to a model, as decision record 0059 already rules.
- A claimed nation can turn Fact check and Ask off for its own pages from its team's Laws and cases page (a new choice beside Show, Cite only and Hide).

### 4.4 When it runs

A nightly job (a Cloudflare Workflow started by the site's cron) checks claims whose page or source changed since the last run, newest pages first, and stops at a nightly budget. A change to a source document (a new copy found by the source watch, new OCR text) rechecks every fact that cites it. On top of that, every result is rechecked on a rolling monthly cycle, so no result is more than about a month old, as Trevor asked on Nov. 26, 2026 ("we should always be checking sources, even when they change"). The first full run is spread over a few nights. Staff can check one page at once. The results live in D1 (two new tables), not in the Worker bundle, and the page reads them as a small JSON file per page through the edge cache (decision record [0061](decisions/0061-keep-public-worker-answers-at-the-edge.md)).

## 5. Ask

### 5.1 What it is

An Ask button in the header (a speech-bubble icon, after Search) opens a panel with a switch: **This page** (the default on any page) or **Whole site**. The visitor types a question; the answer comes in short paragraphs, every sentence with a citation to our pages, and a list of those sources under it. The panel always shows: "Answers come only from this site's records and can be wrong; check the sources. General legal information, not legal advice." with a link to a How Ask works page. There is also a full page at `/ask` for the Whole site mode.

### 5.2 How it answers

- **This page.** The model gets the page's text and the text of the sources it cites (within the same privacy rules as Fact check), answers from them only, or says the page does not cover it and offers Whole site. One model call, no search.
- **Whole site.** The model works in a short loop with four read-only tools: search the site (the search index of about 22,400 entries, including aliases such as "Marshall Trilogy"), search the sources (the library's full-text index, served documents only), read a page, and read a passage with its neighbors. At most six tool calls, then it must answer or say it found nothing. Each tool filters by the visitor's rights before returning anything, so a model can never see what the visitor cannot.
- **After the answer, in code:** every citation must point to a page or passage that a tool returned in this conversation; sentences without one are removed; any quotation is aligned against the passage and dropped if it is not there; links can only go to our own site. If nothing is left, the answer is "I couldn't find this in our records", with a link to search.
- **Answers are cached** for seven days per page and question (after trimming and lowercasing), so repeated questions cost nothing.

### 5.3 Legal advice

The model also returns whether the question asks about the person's own situation ("can I", "my case", "should I", deadlines, what will happen). When it does, the answer opens with a fixed callout: it cannot say what applies to them, who can (the nation's own office, a court, a lawyer), and a link to Legal help on the nation's page or the Find recourse pages; it then gives only what the records say, cited. Ask never says what someone should do, never predicts an outcome, never drafts a filing for someone's case, and never fills in a form. A question that mentions violence or danger gets emergency services and the StrongHearts Native Helpline first. The mockup shows this with "I live in Portland. Can I run for Chairperson?"

### 5.4 CARE principles and nations

Following the CARE Principles for Indigenous Data Governance ([Global Indigenous Data Alliance](https://www.gida-global.org/care)):

- **Collective benefit.** Free to use, no account needed, aimed at helping Native people and the people who serve them find their nations' law and the federal law that bears on it.
- **Authority to control.** Every nation's restrictions apply to both tools, and a claimed nation can leave its pages out of both (section 4.3). Ask never speaks for a nation: answers about an Unclaimed page say the page was not written by the nation.
- **Responsibility.** A public How Ask works page says what it reads, what it cannot see, how often it is wrong in testing, and how to report a mistake. Staff review a sample of answers weekly.
- **Ethics.** Ask links to peacemaking stories and cultural material but does not retell or summarize them, and is never pointed at cultural knowledge a nation has not chosen to share.

### 5.5 Abuse and cost limits

- **Turnstile** in managed mode once per visit before the first question, checked by the Worker as on the forms today; the pass is kept as a short-lived signed cookie.
- **Rate limits:** a rate-limit binding of 3 questions a minute per address, plus a count in D1 of 30 questions a day per address (looser for signed-in team members), and a 500-character limit on questions.
- **A daily budget** for all of Ask (for example $3 a day, a setting). When it is spent, Ask says it is resting until tomorrow and offers search. The budget is read from the token counts Workers AI returns, the same way the source watch counts its spend.
- **Prompt injection.** Every tool is read-only, nothing fetches outside pages, retrieved text is passed as data, and output is rendered as plain text with our own links only.

### 5.6 Logs

Each question, answer, citations, tools used, tokens and verdict of the post-checks are kept for 90 days without the address, with email addresses and phone numbers removed from the question, the same spirit as the search logs (decision record [0025](decisions/0025-search-logs.md)). Unanswered questions feed the source watch and the data roadmap, as failed searches do today.

### 5.7 Testing before each public step

A fixed set of about 150 questions (from the search logs, plus questions from Trevor Goldsmith, Patrick Chapin and Danielle Finn), each with the pages a correct answer must cite. Scored on: correct, misgrounded (Stanford's term), refused when it should have answered, and answered when it should have refused. The bar for opening Ask to visitors is a choice for Trevor; a reasonable start is 95% of citations supporting their sentence, as judged by Fact check and by a person, and no answers to personal legal questions.

## 6. Summarize, Timeline and Top questions

- **Summarize: no.** Pages already open with At a glance (under review in the thread "At a glance review"), and every fact there is cited. A generated summary would put uncited paraphrase above cited facts, the opposite of the site's citation rule. "Ask about this page" covers the need for long documents.
- **Timeline: no AI timeline.** Pages already draw timelines from recorded dates only (`DocumentTimeline`, the shared timeline). Dates pulled out of prose by a model would be unverified. A model could later propose missing dates into the review queue, as the source watch does, which is a separate idea parked in the roadmap.
- **Top questions: yes, inside Ask.** Two or three suggested questions per kind of page (nation, case, law, person), written from the search logs and reviewed once, shown as buttons in the Ask panel. No model call per visit.

## 7. Retrieval options

| | Our library in D1 (recommended) | Add Vectorize (if needed) | Cloudflare AI Search |
| --- | --- | --- | --- |
| What it is | The existing full-text index (porter stemming) over 299,511 passages, plus the site search index | Embeddings of the same passages (EmbeddingGemma 2 on Workers AI) in a Vectorize index, searched alongside the keyword index | A managed service that reads an R2 bucket, a website or a D1 query, chunks and embeds it, and searches by keyword and meaning together |
| Page numbers and star pages | Kept | Kept (passage ids in metadata) | Lost unless rebuilt; it re-parses files itself |
| Privacy filters | Any SQL condition, applied at query time | Filter by passage id after the query | Up to 5 custom metadata fields, 64 bytes filterable |
| File limits | None beyond the library's | None | PDFs over 4 MiB without OCR are not indexed; 10 MiB with OCR |
| Cost | Nothing new | About $2 a month (section 8) | About $54 to $110 to ingest, then $0.75 per 1,000 searches |
| Work | Two query functions | An embedding job and one index | Least code, but the restrictions and page labels have to be rebuilt around it |

Keyword search is weak at plain-language questions, but in Whole site mode the model writes its own search terms and can search again, which closes much of the gap; Free Law Project's experience suggests meaning-based search helps most for natural-language questions ([Free Law Project, May 4, 2026](https://free.law/2026/05/04/semantic-search-on-courtlistener)). So the plan is to start with keyword search, measure on the test questions, and add Vectorize only if they show misses. Sources: [AI Search limits and pricing](https://developers.cloudflare.com/ai-search/platform/limits-pricing/), [AI Search D1 data source](https://developers.cloudflare.com/ai-search/configuration/data-source/), [Vectorize pricing](https://developers.cloudflare.com/vectorize/platform/pricing/).

## 8. Cost model

Prices, read Nov. 27, 2026: Workers AI bills $0.011 per 1,000 Neurons above 10,000 free Neurons a day ([Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)); Inkling 2 Small is $0.30 per million input tokens, $0.10 cached, $1.00 output ([model page](https://developers.cloudflare.com/workers-ai/models/inkling-2-small/)); EmbeddingGemma 2 is $0.0017 per million tokens ([changelog, Nov. 12, 2026](https://developers.cloudflare.com/changelog/post/2026-11-12-embeddinggemma-2-workers-ai/)); Vectorize includes 50 million queried and 10 million stored dimensions a month, then $0.01 per million queried and $0.05 per 100 million stored ([Vectorize pricing](https://developers.cloudflare.com/vectorize/platform/pricing/)); AI Search charges $0.75 per million ingestion tokens beyond 5 million and $0.75 per 1,000 searches beyond 1,000 a month, with billing starting Dec. 1, 2026 ([AI Search pricing](https://developers.cloudflare.com/ai-search/platform/limits-pricing/)); D1 includes 25 billion rows read a month on Workers Paid ([D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)). The arithmetic below is mine.

**How many facts.** I counted citation markers on a random sample of six pages of each kind from the search index: nations averaged 18.8, people 4.2, stories 2.2, glossary terms 2.8; the sampled case, law and reference pages had none. Across 946 nations, 1,617 people, 121 stories and 27 terms, that is about 25,000 markers, plus essays and the case pages that do carry markers. I use 30,000 claims; this is a rough estimate.

**Fact check.**

| | Neurons | Cost |
| --- | --- | --- |
| One claim, whole-document mode (measured: 35 to 51) | about 45 | about $0.0005 |
| One claim, one call each (measured: 66 to 116) | about 76 | about $0.0008 |
| First full run, 30,000 claims | about 1.35 million | about $15 |
| Second looks at high effort on about 5% of claims | about 0.2 million | about $2.50 |
| Each month after: about 2,000 changed claims | about 90,000 | about $1, mostly inside the free 10,000 a day |
| Each month: rechecking all 30,000 claims on a rolling cycle | about 1.35 million, less about 300,000 free | about $12 (about $3 on a 90-day cycle) |
| A reader's Check again now on a 10-fact section | about 450 | about $0.005, under a daily budget for all readers |
| Visitors opening a section or a card | none | nothing beyond ordinary Worker requests |

**Ask.** Estimated, not yet measured: a Whole site answer takes about three model calls with about 12,000 input tokens in all (instructions and tool descriptions repeated, search results, passages) and about 900 output tokens, so about $0.0045, or about $0.0033 with the repeated part cached. A This page answer is one call of about 6,000 tokens, about $0.0025.

| Questions a month | Whole site, Inkling 2 Small | With Claude Haiku 5.5 through AI Gateway |
| --- | --- | --- |
| 1,000 | about $4 to $5 | about $1.50 to $2 |
| 10,000 | about $40 to $50 | about $15 to $20 |
| 100,000 | about $400 to $500 (the daily budget stops it first) | about $150 to $200 |

Claude Haiku 5.5 is cheaper per token ($0.10 input, $0.50 output, as listed in `site/src/lib/server/watch/model-prices.ts`) and did as well as Inkling in the source watch comparison, but needs AI Gateway credits, which is why the source watch moved to Inkling; it stays a setting.

**Retrieval extras.** Vectorize, if added: about 340,000 vectors of 768 dimensions (library passages plus site pages) is about 261 million stored dimensions, about $0.13 a month, and searching runs about $2 a month at these volumes; embedding everything once with EmbeddingGemma 2 is about 150 million tokens, about $0.26. AI Search instead: about $54 to ingest the served documents (about 77 million tokens) or about $110 for the whole library, then $2.25 per 1,000 questions at three searches each, before any model costs.

## 9. Phases

1. **Fact check for the team.** Claims written per page at build time, nightly Workflow, two D1 tables, the review queue, and the marks, section buttons and citation card for signed-in team members. Hand-label 200 results. About $15 for the first run.
2. **Fact check for visitors.** The marks, section buttons, badge and citation card for everyone, reading stored results; confirmed flags only; the Settings choice to hide marks.
3. **Ask about this page.** One call, page text and cited sources only; Turnstile, limits, budget, logs, How Ask works page; test questions first.
4. **Ask the whole site.** The tool loop over the search index and the library; Vectorize only if the test questions call for it; suggested questions.

Each phase is its own pull request, built only after its mockups are approved, with side-by-side screenshots against them.

## 10. Choices for Trevor

1. Which plan. Decided: Fact check first, then Ask (Trevor Goldsmith, Nov. 26, 2026, Pacific time).
2. Whether the round-2 mockups (marks, section buttons, badge, citation card) are approved for phase 1.
3. Whether visitors see a flag before a person confirms it (recommended: no).
4. The daily budget for Ask (suggested $3 a day) and the bar for opening it to visitors (suggested in section 5.7).
5. Whether a claimed nation may turn both tools off for its pages (recommended: yes).

## Sources

- Wikiwand, [About](https://www.wikiwand.com/about); [Chrome Web Store listing](https://chromewebstore.google.com/detail/wikiwand-wikipedia-modern/emffkefkbkpkgpdeeooapgaicgmcbolj?hl=en) (version 11.0.0, updated Mar. 11, 2026).
- LLM Pulse, [How does Perplexity work?](https://llmpulse.ai/blog/how-perplexity-works/) (a third party's description, not Perplexity's).
- Consensus, [How it works](https://consensus.app/home/blog/how-consensus-works/); [Introducing the Consensus Meter](https://consensus.app/home/blog/introducing-the-consensus-meter/); Aaron Tay, [A 2025 deep dive of Consensus](https://aarontay.substack.com/p/a-2025-deep-dive-of-consensus-promises).
- Stanford HAI, [AI on Trial: Legal Models Hallucinate in 1 out of 6 (or More) Benchmarking Queries](https://hai.stanford.edu/news/ai-trial-legal-models-hallucinate-1-out-6-or-more-benchmarking-queries); Varun Magesh et al., [Hallucination-Free? Assessing the Reliability of Leading AI Legal Research Tools](https://arxiv.org/abs/2405.20362).
- Free Law Project, [semantic search (Mar. 11, 2025)](https://free.law/2025/03/11/semantic-search/); [Semantic search on CourtListener (May 4, 2026)](https://free.law/2026/05/04/semantic-search-on-courtlistener).
- Global Indigenous Data Alliance, [CARE Principles for Indigenous Data Governance](https://www.gida-global.org/care).
- Cloudflare, [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/); [Inkling 2 Small](https://developers.cloudflare.com/workers-ai/models/inkling-2-small/); [EmbeddingGemma 2](https://developers.cloudflare.com/changelog/post/2026-11-12-embeddinggemma-2-workers-ai/); [Vectorize pricing](https://developers.cloudflare.com/vectorize/platform/pricing/); [AI Search limits and pricing](https://developers.cloudflare.com/ai-search/platform/limits-pricing/); [AI Search data sources](https://developers.cloudflare.com/ai-search/configuration/data-source/); [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/); [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).
- This repository: decision records 0025, 0051, 0056, 0057, 0059, 0061 and 0062; [source-watch.md](source-watch.md); `site/src/lib/quote-context.ts`; `site/src/lib/server/watch/model-prices.ts`; [research/analyses/2026-11-26-workers-ai-vs-claude-triage.md](../research/analyses/2026-11-26-workers-ai-vs-claude-triage.md).
- The Nov. 27, 2026 test runs: library database queries and Workers AI calls made for this note (Karuk Tribe, Bridgeport Indian Colony and Native Village of White Mountain constitutions, and Worcester v. Georgia, 31 U.S. 515 (1832)); the mockup scripts are in the project files at `design/fact-check-and-ask/mockup-script.js` and `design/fact-check-and-ask/round-2/mock2.js`.
- Lucide icons (circle-check, badge-check, circle-minus), the icon set the site already uses.
