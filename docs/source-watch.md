# Source watch

A design for the part of the project that looks for new and changed legal material on the internet: new cases, laws, regulations, compacts and their amendments, changes to nations' constitutions and codes, new court and contact details, and the rest of what the site holds. Trevor Goldsmith asked for it on Nov. 26, 2026 ("a special worker that will analyze the Internet for new documents, cases, and information that we should add to the website. Changes to compacts, laws, etc."), asked that it cover every collection the site has, and asked that it be modular so it grows as new kinds of items are added. Decision record [0059](decisions/0059-watch-for-new-legal-sources-with-plug-in-watchers.md) (accepted Nov. 26, 2026) records the choices; this page is the working design and the catalog of watchers, and is meant to be kept current as watchers are added.

Nothing on this page is built yet. Statements about how a source behaves were checked by request from the project's cloud environment on Nov. 26, 2026, unless a citation says otherwise. Estimates of volume and cost are the project's own arithmetic from those counts and are labeled as estimates.

## In short

- **One new Worker, many small watchers.** A watch Worker (`model-tribal-adr-code-watch`, or `tribal-law-project-watch` if the Workers are renamed first) runs plug-in modules called watchers. A watcher knows one source: how to ask it what is new since last time, and which collections its items belong to. Adding a source or a collection means adding one watcher file and one line in the watcher list, the same way a new data set adds one entry to the collections registry (`site/src/lib/server/collections.ts`).
- **Feeds and APIs first, pages last.** Federal Register, eCFR, GovInfo and Congress.gov have APIs that answer "what changed since this date"; NIGC publishes a sitemap with a modified date for every document; alert services can email the project. Page watching (fetching a page and comparing its text with last time) is the fallback, used mainly for nations' own sites, and is slow and polite.
- **Scripts decide first.** Every candidate goes through script rules (identifiers, agency, C.F.R. part, nation name matching, known-record lookup). Only the ones the rules cannot settle go to a cheap model (Claude Haiku), and only the hard ones (does this amend a compact we hold, is this a child case) go to the top model.
- **Nothing publishes without a person.** Candidates land in a review queue in the workspace (`/workspace/watch`). A person accepts, links to an existing record, or dismisses each one. Accepted items become record drafts that go through a pull request like any other record, and start as Unverified. The watcher never writes a quote.
- **Every file is kept privately, scanned, and served only by the hosting rules.** Each document the watcher fetches is stored in the private bucket and put through the malware scanner before anything opens it. The site serves only works of the United States government and nations' governing documents, as today ([data roadmap, hosting rules](data-roadmap.md#hosting-rules)).
- **Nations' choices and privacy come first.** The watcher reads each nation's restrictions (decision record 0056) before it queues anything, holds anything that looks like a child or protection order case (decision record 0057), and does not collect post-2017 Tribal court opinions from a nation without its consent.

## How it fits with what exists

| Existing piece | What the watch Worker takes from it |
| --- | --- |
| Scanner Worker (`site/scanner`, decision record 0046) | Every fetched file is stored with `requestScan` and opened only when `mayServe` allows it, so the scan guard test (`tests/scan-guard.test.ts`) covers the watcher like any other way in. A new scan purpose, `watch-capture`, names these files. |
| Wayback Worker (`site/wayback`, `site/WAYBACK.md`, PRs #490 and #505) | The pattern: a Worker on a one-minute cron, its progress as one JSON object in the bucket, a read-only progress page, a Service checks row, and a workspace page for failures with "Send a file". Accepted items with an original link join `research/wayback-queue.tsv` through the existing script, so the Wayback Worker archives them. |
| Collections registry (`site/src/lib/server/collections.ts`) | The list of what must be watched. A test fails if a collection has no watcher and is not listed as not watched, with a reason, the same way `kindsCountedOnlyAsSources` catches a source kind nobody counts. |
| Nightly source library update (scheduled task, 1:47 AM Pacific) | The model triage step in the recommended first version runs as a second nightly scheduled task beside it, reading and writing files in the bucket with the same credentials (see "Where the models run"). Captured files are already in the bucket, so the nightly library update reads them into the full-text library without changes. |
| Document version history (decision record 0018, `content/documents/`) | A changed constitution, code, compact or court rule becomes a candidate new version of an existing history record, with `changes: not-compared` until a person or the top model compares clauses. |
| Nation restrictions (decision record 0056) and privacy holds (0057) | Read before a candidate is queued or shown; the strictest choice wins. |
| Review status (Verified / Unverified) | Every record a watcher proposes starts Unverified. |

## The parts

### Watchers

A watcher is a TypeScript module in `site/watch/watchers/` that exports one definition. Most are a few lines of settings for a shared driver; a few need their own parsing.

```ts
export default defineWatcher({
	identifier: 'federal-register',
	title: 'Federal Register',
	tier: 1,
	// Collections (registry identifiers) and nation page parts it can add to.
	feeds: ['federal-register-notices', 'federal-regulations', 'executive-orders', 'intergovernmental-agreements', 'tribal-codes', 'nation:recognition'],
	driver: 'api', // api | feed | sitemap | page | email | bulk | by-hand
	schedule: '7 * * * 1-5',
	hosts: ['www.federalregister.gov'],
	hosting: 'serve', // serve | private | link-only | by-consent
	documentation: ['https://www.federalregister.gov/developers/documentation/api/v1'],
	check: async (context) => {
		/* ask for documents published since context.cursor; return candidates */
	}
});
```

The drivers do the common work so a watcher only says what is particular to its source:

- **api**: paged JSON with a "since" cursor (Federal Register, eCFR, GovInfo, Congress.gov, CourtListener, Wikidata).
- **feed**: RSS, Atom or iCalendar (GAO reports, organizations' event calendars).
- **sitemap**: a sitemap's `lastmod` dates (NIGC, and any nation site that publishes one).
- **page**: fetch a page, keep only its main text, and compare a SHA-256 of that text with last time; on a change, store both versions and the difference.
- **email**: parse alert emails that sources send to a project address, routed to the Worker's `email()` handler by Cloudflare Email Routing ([Cloudflare, "Workers API" for routed email](https://developers.cloudflare.com/email-service/api/route-emails/email-handler/)).
- **bulk**: large periodic files (CourtListener's quarterly bulk data) too big for a Worker; the nightly scheduled task handles these and writes candidates to the bucket.
- **by-hand**: a source that turns scripts away. The watcher adds a reminder card to the queue on its schedule ("Check the National Indian Law Library bulletin"), with the same "Send a file" link as the Wayback captures page.

Each definition must name its documentation, its hosts, its hosting rule and its tier; a test checks that every watcher does, and that every collection in the registry and every part of a nation's profile is fed by a watcher or listed in `notWatched` with a reason.

### How a run works

The Worker's cron runs every minute, like the Wayback Worker's, and starts the watchers that are due as Cloudflare Workflows instances, one per watcher run. Each step of a run (ask the source, fetch a file, store it, put it in line for a scan, apply the rules, write the candidates) is a durable step that is retried on its own if it fails, so a slow host does not hold up the rest ([Cloudflare, Workflows](https://developers.cloudflare.com/workflows/)). Every fetch goes through the host's desk, a Durable Object per host that spaces requests (see "Politeness"). What the Worker has done is one JSON object in the bucket at `watch/progress.json`, shown on a read-only progress page and as a "Source watch" row on Service checks, with the same states as the Wayback Worker (running, waiting to retry, idle, paused, not running), and per watcher the last run, the cursor, and counts of candidates found, closed by rules and waiting for review.

### Candidates

A watcher returns candidates in one shape, so everything after it is shared:

| Field | Meaning |
| --- | --- |
| `watcher`, `sourceIdentifier` | The watcher and the source's own stable identifier (Federal Register document number, GovInfo package identifier, docket number, CourtListener cluster number, page address). Together they are unique, so seeing the same item twice does nothing. |
| `kind`, `feeds` | What it seems to be, and which collections it might join. |
| `title`, `date`, `link` | As the source gives them. |
| `nations` | Nations named, from the name matcher. |
| `capture` | The private bucket key and SHA-256 of the fetched file, if one was fetched. |
| `change` | For a changed page or file: the previous capture and a short difference. |
| `match` | What the dedupe step found: none, the same item, a new version of a record, or a possible duplicate. |
| `triage` | The rules' answer, then the model's, with the reason and the model used. |
| `sensitivity` | Flags: child or family case, protection order, nation restriction, rights not settled. |

Candidates and each watcher's cursor live in the site's D1 database (new tables `watch_candidates`, `watch_cursors` and `watch_runs`), which the site reads for the workspace page. The project lets threads change the D1 schema freely while building (Trevor, Nov. 22, 2026).

### Change detection

1. **Ask only for what is new.** API watchers keep a cursor: the last publication date, `lastModified` time or update date the source reported. Sitemap watchers keep each address's `lastmod`. Feed watchers keep the newest entry's date and identifier.
2. **Ask cheaply.** Page and file checks send `If-None-Match` and `If-Modified-Since` when the server gave an ETag or Last-Modified date, and stop on 304 Not Modified.
3. **Don't trust a header alone.** The Interior Department's Drupal sites (bia.gov, doi.gov) answered with a Last-Modified time minutes before the request on pages that had not changed, so for those hosts the watcher compares a hash of the page's main text instead. The main text is what remains after menus, headers, footers, dates printed on every page and session tokens are removed (an HTMLRewriter pass per host, with host-specific rules in the watcher).
4. **Keep both versions.** A changed page or file is stored again under its new SHA-256; the candidate shows the difference, so a reviewer sees "Section 5 now says 30 days instead of 60" rather than "the page changed".

### Dedupe against the records we have

The Worker cannot read `content/`, so each site build writes an index of known identifiers, read by the watch Worker through a service binding to the site (an internal route, not public):

- Federal Register document numbers (`citation.number`, such as "FR Doc. 2022-01789"), volume and page.
- U.S. Reports volume and page, docket numbers, CourtListener cluster numbers (the `courtlistener` block).
- GovInfo package identifiers and links, normalized original links and Wayback links.
- SHA-256 of every file in the capture index (`research/capture-index.csv`) and every record's `file.checksum`.
- Each document history's identifier and the links of its versions.
- Nation names and aliases, for the name matcher.

A candidate whose identifier or file hash is already known is closed as "already have it" without a person seeing it. One whose link is known but whose file hash is new is proposed as a new version of that record. One that matches only on normalized title, date and nation is shown as "possibly the same as" with the record linked, for a person to decide.

### Triage

Most candidates never need a model. The design uses three steps and counts how often each is used, so the rules can be improved where the model keeps being asked the same question.

1. **Rules (scripts).** Each watcher's own filters (agency, document type, C.F.R. title and part, search terms), the name matcher, the dedupe step, and labels for patterns that are always the same, such as Federal Register titles beginning "Indian Gaming; Approval of Tribal-State Class III Gaming Compact" or "Indian Gaming; Extension of", which are compact approvals and amendments, and "Liquor Control Ordinance", which is a nation's law published by the Bureau of Indian Affairs. Rules give each candidate a relevance score and a proposed collection. Clear matches go straight to the queue; clear misses are closed with the rule that closed them, and a sample of closed ones is shown each week so a person can catch a bad rule.
2. **Cheap model (Claude Haiku 5.5).** Candidates the rules leave in the middle band: is this relevant to Native nations' law at all, which collection, which nations, and is there any sign of a child or family case. The answer is structured (JSON against a schema) with a short reason. This matters most for the Federal Register search across all agencies: in 2025 the API found 4,920 documents across all agencies containing "tribe" or "tribal", most of them consultation notices from other agencies, against 76 from the Bureau of Indian Affairs, 13 from NIGC and 10 from the Indian Health Service.
3. **Top model (Claude Opus 5.5).** Only for hard questions: does this document amend, extend or replace a compact or code we hold, and which clauses changed (the document history's `changes`); do two sources disagree; is a sensitivity flag right. It also checks a small random sample of the cheap model's answers each week, and the rate of disagreement is shown on the progress page.

Names in Tribal court opinions are replaced with initials by the existing script (decision record 0057) before any model reads them.

### Where the models run

Three ways were weighed. Trevor chose B on Nov. 26, 2026 (decision record 0059); the provider stays a setting so A remains a fallback.

- **A. A nightly scheduled task (recommended to start).** The watch Worker writes the candidates that need a model to the bucket as one file a night (`_watch/triage/inbox/<date>.jsonl`). A second nightly scheduled task, set up like the existing library update, reads it, has Claude Haiku subagents classify it and the top model take the hard cases, and writes `_watch/triage/results/<date>.jsonl`; the Worker reads the results on its next run. It needs no new key: the task uses the plan and the bucket credentials the library update already has. The cost is a delay of up to a day, and plan usage.
- **B. The Worker calls the Claude API through Cloudflare AI Gateway.** The Worker reaches the gateway through its AI binding and holds no secret. AI Gateway's Unified Billing charges the calls to credits loaded on the project's Cloudflare account, so no Anthropic key or account is needed ([Cloudflare, Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/); [Cloudflare, Claude Code with AI Gateway](https://developers.cloudflare.com/ai-gateway/integrations/coding-agents/claude-code/)). An Anthropic key stored in the gateway as a provider key (kept in Secrets Store) is the alternative, billed by Anthropic instead ([Cloudflare, "Bring Your Own Keys"](https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/)). Triage happens within minutes instead of a day. The Worker cannot use the Claude plan: the plan covers Claude sessions such as the nightly task, not API calls from the project's own code. Estimated cost below.
- **C. Workers AI open models.** A Workers AI binding needs no key at all, but the project chose Haiku for this kind of classification, and open models would need their own testing for legal relevance. Kept as a fallback, and possibly for text embeddings to catch near-duplicates later.

### The review queue

A workspace page, `/workspace/watch`, for the lead author and anyone given the new `review-watch` permission. It will be designed as a mockup and approved before it is built, and the built page compared with the approved mockup side by side (project rule, Nov. 23, 2026). What it needs to do:

- List candidates by collection and tier, newest first, with filters for nation, watcher and sensitivity, and counts in badges.
- For each candidate: the source and its link, the private copy, the difference for a changed document, the proposed action and collection, the nations, the rules' and models' reasons, and any sensitivity flags.
- Actions: **Add** (makes a record draft), **New version of** (an existing record or document history), **Same as** (links it to an existing record and closes it), **Not relevant** (with a reason that can become a rule), **Hold** (for a nation's or privacy question), and **Ask a nation** (opens the nation team contact flow for claimed pages).
- Show held and restricted candidates only to the lead author, and show no names from a held child case anywhere on the page.

**From queue to site.** Records are files in git (decision record 0004), so an accepted candidate becomes a record draft, not a published page. Drafts are written to the bucket; a nightly step (in the same scheduled task as option A) turns the day's drafts into record files with the existing record scripts (`scripts/law/`, `scripts/gaming/`, `scripts/tribes/`) and opens one pull request, "Watch: items accepted on <date>", which lands through the merge-queue thread like every other pull request. D1-backed items (events, nation page contact details that nation teams keep) become drafts in their own workspace pages instead. Everything a watcher proposes starts Unverified.

**Quotes.** The watcher never writes or changes a quote, holding, summary or "Treatment" text. When a Supreme Court case is first added from a slip opinion, its record notes that the page numbers are the slip opinion's; the GovInfo watcher looks for the case in the U.S. Reports collection (`USREPORTS`) and the Court's preliminary prints, and when the official pagination appears it opens a candidate to re-check every quote in records and essays that cite the case against the official report (`scripts/gaming/check_quotes.py` and the quote checks already in use).

### Storage and hosting

- Every file a watcher fetches is stored in the private bucket at `watch/captures/<watcher>/<year>/<source identifier>/<sha256>.<extension>`, with its headers and the time it was fetched, and put in line for a malware scan. Nothing opens it, including the models, until the scan says clean.
- A candidate carries the hosting rule from its watcher and its rights: **Serve** for works of the United States government and nations' governing documents; **Private copy, link** for copyrighted works and works whose rights are not settled; **Link only** for state material (tier 3), with a private copy only where a page quotes it; **By consent** for material a nation controls. When a record lands, the capture index and its existing scripts decide what the site serves, exactly as today (decision records 0030, 0031, 0037 and [public copies](public-copies.md)).
- Page snapshots of nations' sites are kept privately as evidence of what changed and when. They are not served.

### Politeness, terms and cost of fetching

- **One desk per host.** A Durable Object per host spaces requests and keeps a daily count: no faster than the host's robots.txt Crawl-delay and the API's published limit, one request every 5 seconds by default for government sites without a stated limit, and one every 30 seconds for a nation's own site, which is often small and hosted cheaply. On 429 or 503 it waits as long as Retry-After says, or backs off from 1 minute to 6 hours.
- **robots.txt and content signals.** Each host's robots.txt is read once a day and obeyed under RFC 9309 ([IETF, RFC 9309](https://www.rfc-editor.org/rfc/rfc9309)). Where a site's robots.txt carries a content signal against AI use, or turns away Anthropic's crawler, the watcher still notes that a page changed (its date or hash) but never sends that site's text to a model; a person reads it. On Nov. 26, 2026, both Municode (library.municode.com) and eCode360, which host many nations' codes, published `Content-Signal: search=yes, ai-train=no` and disallowed ClaudeBot ([Content Signals Policy](https://contentsignals.org/)).
- **An honest name.** Requests identify the project and link to a page explaining the watcher, for example `TribalLawProjectWatch/1.0 (+https://triballawproject.org/about/watch)`.
- **Terms of use.** Each watcher's documentation field links the source's terms, and a source whose terms bar automated use is a by-hand watcher. Known limits are in the source table below.
- **Hosts that turn the cloud away.** On Nov. 26, 2026 the Bureau of Indian Affairs' Tribal Leaders Directory page answered 403 to a script and ihs.gov did not answer at all from the cloud (as on Nov. 24). These start as by-hand watchers; if Trevor wants them automated, a scheduled Remote Control session on his own computer can fetch them and upload the files.

## Sources and how each is watched

Checked by request on Nov. 26, 2026 unless noted.

| Source | Driver and method | Limits and terms | Feeds | Tier |
| --- | --- | --- | --- | --- |
| Federal Register API ([documentation](https://www.federalregister.gov/developers/documentation/api/v1)) | api: `documents.json` by agency (`indian-affairs-bureau`, `national-indian-gaming-commission`, `indian-health-service`, `hearings-and-appeals-office-interior-department`, `special-trustee-for-american-indians-office`, `navajo-and-hopi-indian-relocation-office`, `indian-arts-and-crafts-board`), by C.F.R. title 25, presidential documents, and a term search across all agencies; newest first since the cursor. `public-inspection-documents` gives a day's notice. | No key. Its robots.txt bars only search pages. Hourly on weekdays. Counted for 2025: 76 BIA, 13 NIGC, 10 IHS, 9 affecting 25 C.F.R., 23 presidential documents with tribal terms, 4,920 all-agency documents with "tribe" or "tribal". | Federal Register notices; compact approvals, extensions and amendments; Secretarial Procedures; liquor and other ordinances; recognition lists and acknowledgment findings; fee-to-trust and reservation proclamations; regulations; executive orders | 1 and 2 |
| eCFR API ([documentation](https://www.ecfr.gov/developers/documentation/api/v1)) | api: `versioner/v1/titles.json` daily; when title 25's `latest_amended_on` moves, `versions/title-25.json` lists the changed sections, which are then fetched. Other titles with Indian parts (for example 42 C.F.R. part 136 and 43 C.F.R. part 4) are listed in the watcher's settings. | No key. The API answered from the cloud, though ecfr.gov pages send Save Page Now to a block page (site/WAYBACK.md). 672 section versions in title 25 since Jan. 1, 2025. | Regulations (25 C.F.R.) | 1 |
| GovInfo API ([documentation](https://api.govinfo.gov/docs/); [GPO, usgpo/api](https://github.com/usgpo/api)) | api: the `published` service by date for the collections `USCODE`, `PLAW`, `STATUTE`, `USCOURTS`, `USREPORTS`, `CHRG`, `CRPT`, `BUDGET` and `GAOREPORTS`, filtered by title, committee and terms. | Needs an api.data.gov key ([api.data.gov developer manual](https://api.data.gov/docs/developer-manual/)); GPO lists a default of 36,000 requests an hour. The key goes in Cloudflare Secrets Store, read through a binding. | Statutes and session laws; Title 25 releases; lower federal court opinions; official U.S. Reports pagination; hearings and reports | 1 and 2 |
| Office of the Law Revision Counsel ([prior release points](https://uscode.house.gov/download/priorreleasepoints.htm)) | page: the release point list, weekly; a new release point that touches Title 25 is a candidate to refresh the Title 25 records. | No key. | Statutes (Title 25) | 1 |
| Congress.gov API ([LOC, api.congress.gov](https://github.com/LibraryOfCongress/api.congress.gov)) | api: bills in the "Native Americans" policy area by update date; laws; CRS reports. | Same api.data.gov key; 5,000 requests an hour. | Statutes (bills that become law); federal reports | 1 and 2 |
| Supreme Court ([slip opinions](https://www.supremecourt.gov/opinions/slipopinion/25)) | page: the term's slip opinion page and orders lists, daily in term, matched against parties and terms. | robots.txt sets Crawl-delay 1 and disallows `/rss/`. The Court's docket files are under `/RSS/Cases/JSON/`; robots.txt paths are case-sensitive, but the watcher treats them as off-limits because the intent is plain, and uses CourtListener's docket data instead. | Supreme Court cases | 1 |
| CourtListener ([REST API](https://www.courtlistener.com/help/api/rest/), [search alerts](https://www.courtlistener.com/help/api/rest/alerts/), [webhooks](https://www.courtlistener.com/help/api/webhooks/)) | api: search for opinions filed since the cursor, with saved queries ("Indian tribe", "Indian country", "Indian Child Welfare Act", nation names); email: daily search alert emails to the project's watch address; bulk: the quarterly bulk files in the nightly task. | Needs a token; free accounts get 5 requests a minute, 50 an hour and 125 a day. Free Law Project says it charges "reasonable fees to organizations using advanced features like Webhooks and APIs" and gets in touch with organizations starting projects on webhooks, so the design asks before using the API this way (see "What Trevor needs to do"). Until then, email alerts and bulk files only. | Other court cases (federal and, link only, state); courts | 1 to 3 |
| National Indian Gaming Commission ([sitemap](https://www.nigc.gov/wp-sitemap.xml)) | sitemap: the document sitemaps (`wp-sitemap-posts-wpdmpro-*.xml`, each address with a `lastmod`), daily. | robots.txt bars only admin pages. | Gaming ordinances (nations' laws), NIGC decisions and notices of violation, bulletins, NIGC events | 2 |
| Interior Board of Indian Appeals ([decisions](https://www.doi.gov/oha/ibia/decisions)) | page: weekly, main-text hash. | Last-Modified is not reliable on this host. | IBIA decisions | 2 |
| Solicitor's opinions ([doi.gov/solicitor/opinions](https://www.doi.gov/solicitor/opinions)) | page: weekly. | | M-Opinions | 2 |
| Bureau of Indian Affairs: [gaming compacts](https://www.bia.gov/service/tribal-state-gaming-compacts), [Office of Federal Acknowledgment](https://www.bia.gov/as-ia/ofa), regions and agencies | page: weekly. The Federal Register watcher is the authority for compact approvals; this page is a cross-check and holds the compact texts. | Last-Modified not reliable. | Compacts and Secretarial Procedures; acknowledgment petitions; BIA regions and agencies pages | 1 and 2 |
| Bureau of Indian Affairs, Tribal Leaders Directory | by-hand monthly (403 to scripts on Nov. 26, 2026). | | Nation contacts (office details) | 1 |
| Indian Health Service | by-hand monthly (no answer from the cloud on Nov. 24 and 26, 2026). | | IHS Areas and service units on nation pages | 1 |
| Senate Committee on Indian Affairs ([hearings](https://www.indian.senate.gov/hearings)) | page: weekly. GovInfo's `CHRG` collection gives the printed hearing later. | | Congressional hearings | 2 |
| GAO ([reports feed](https://www.gao.gov/rss/reports.xml)) | feed: daily, terms filter. | Sends an ETag. | Federal reports | 2 |
| Wikidata Query Service ([user manual](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual)) | api: weekly SPARQL for the people in biographies, Justices and Presidents who have Wikidata identifiers: date of death, offices held. | Data is CC0. Query time is limited per client; one small query a week. | Biographies, Justices, Presidents | 1 |
| Census Bureau, TIGER/Line | page: yearly, the new year's American Indian/Alaska Native/Native Hawaiian areas directory. The Census data API needs a key (Trevor's keys tracker). | | Census boundary files; population | 2 |
| Indian law journals (OAI-PMH, `scripts/review/journal_oai_harvest.py`) | api: monthly, the journals' OAI-PMH sets. | Private copy, link. | Source documents (journal articles) | 2 |
| National Indian Law Library bulletins | by-hand monthly. NILL bars systematic requests ([free legal information note](../research/analyses/2026-11-23-free-legal-information-sources.md)). | | Leads for Tribal and federal cases | 2 |
| Nations' own sites | sitemap where a nation publishes one, otherwise page; weekly rotation (see below). | robots.txt and content signals obeyed per host; one request per 30 seconds per host. | Constitutions, codes, court rules, courts, contacts, forms, government structure | Nations |
| Alert emails (Federal Register, Interior and IHS email subscriptions, Congress.gov alerts, CourtListener) | email: a project address routed to the Worker. | Push, so no polling. | Same as the source | All |

## Every collection and data type, and its watcher

Collections are the identifiers in the collections registry. Nation page parts are the top-level fields of a nation's profile (`content/tribes/`), which the guard test reads from the schema.

### Native nations

| Collection or part | Watchers | Notes |
| --- | --- | --- |
| Native Nations (`native-nations`); recognition | `federal-register` (the yearly list of recognized entities, usually in January, and acknowledgment findings); `interior-pages` (Office of Federal Acknowledgment); by-hand for state recognition lists | A new or renamed entity on the list becomes a candidate to add or rename a profile; state lists are link only. |
| Governing Document Histories (`governing-documents`), Constitutions (`tribal-constitutions`), Codes and Laws (`tribal-codes`) | `nation-sites`; `cited-links`; `federal-register` (liquor and other ordinances the Bureau of Indian Affairs publishes); `nigc` (gaming ordinances) | A changed text becomes a new version of the document history (decision record 0018) with `changes: not-compared` until compared. Hosting: serve (governing documents), within each nation's restrictions. |
| Compacts and Agreements (`intergovernmental-agreements`) | `federal-register` (approvals, "deemed approved" notices, extensions, amendments, Secretarial Procedures); `interior-pages` (BIA compact list and texts); by-hand for state gaming agencies | The most common kind of change, for example the Federal Register notices extending the Picayune Rancheria of Chukchansi Indians and Flandreau Santee Sioux Tribe compacts (Nov. 18 and Oct. 21, 2026); 344 Federal Register documents mention a "Class III Gaming Compact". |
| Stories (`stories`) | Not watched | Stories come from people, with their consent and their nations' protocols (decision records 0019, 0036). |
| Contacts (`contacts`) | `leaders-directory` (by hand until the directory accepts scripts); `nation-sites` | Office details only. Leaders' personal names stay off the public site (decision record 0051). Claimed nation pages are kept by their teams (0041), so changes for those go to the team as a suggestion. |
| Government (`governance`, `government_structure`) | `nation-sites`; document history changes | Facts from governing documents (decision record 0042). |
| Gaming (`gaming`) | `federal-register`; `nigc` | |
| Indian Health Service (`indian_health_service`) and the IHS Area pages | by-hand `indian-health-service` | |
| Bureau of Indian Affairs region and agency (`federal_administration`) and their pages | `interior-pages` | |
| Courts and judicial bodies (`justice_institutions`, `court_practice`) and the Courts list (`courts`) | `nation-sites` (court pages); `courtlistener` (new court names); by-hand for NAICJA's directory | Judges' names are not collected (data roadmap). |
| Jurisdiction and agreements (`jurisdiction`, `jurisdiction_agreements`) | `federal-register` (retrocession notices); `nation-sites`; by-hand state commission pages | |
| Treaties on profiles (`treaties`) | Not watched for new items | A closed set; `cited-links` checks the links. |
| Land (`land_establishment`), census areas and population (`census_areas`, `population`) | `federal-register` (reservation proclamations, fee-to-trust decisions); `census` | |
| Languages, memberships, related entities | Not watched automatically | Changes are rare and come from nations and organizations; `nation-sites` may show them. |
| Official images (`official_images`) | Not watched for new images | Nation editors add pictures (project rule); `cited-links` checks the existing source links. |
| Dispute resolution (`dispute_resolution`) | Derived | Comes from the codes and court rules above, through the existing provision review. |
| Nearby state courts (`nearby_state_courts`) | `cited-links` | Link only. |

### Federal law

| Collection | Watchers | Notes |
| --- | --- | --- |
| Treaties and Agreements (`treaties`) | `cited-links` only | Closed set. |
| Statutes (`federal-statutes`) | `govinfo` (`PLAW`, `STATUTE`, `USCODE`); `congress`; `us-code-release-points` | Title 25 is refreshed when a release point changes it. |
| Regulations (`federal-regulations`) | `ecfr`; `federal-register` (rules and proposed rules) | A proposed rule is a candidate to note, not a record, until final. |
| Executive Orders (`executive-orders`) | `federal-register` (presidential documents) | |
| Federal Register Notices (`federal-register-notices`) | `federal-register` | |

### Courts and cases

| Collection | Watchers | Notes |
| --- | --- | --- |
| U.S. Supreme Court Cases (`supreme-court-cases`) | `supreme-court`; `courtlistener`; `govinfo` (`USREPORTS`) | Quotes re-checked when official pagination appears. |
| Other Court Cases (`other-court-cases`) | `courtlistener`; `govinfo` (`USCOURTS`) | State cases are link only (tier 3). |
| Tribal Court Opinions (`tribal-court-opinions`) | `consented-courts` only | The Caselaw Access Project set does not change. Later opinions only from nations that publish them and agree (data roadmap, "By consent"); the watcher's list of courts starts empty. Initials and privacy holds apply before anything is shown or sent to a model. |
| U.S. Supreme Courts (`supreme-courts`) | Derived | From the Justices. |
| Courts (`courts`) | See Native nations, courts | |

### People

| Collection | Watchers | Notes |
| --- | --- | --- |
| Biographies (`biographies`) | `wikidata`; new parties and leaders in accepted cases and treaties | No automatic people pages (stub pages note). |
| Justices (`justices`), Presidents (`presidents`) | `supreme-court` (the Court's members page); `wikidata` | |

### Reference and the rest of the site

| Collection or data | Watchers | Notes |
| --- | --- | --- |
| Source Documents (`source-copies`) | Every watcher above; `cited-links` | `cited-links` re-checks every source record's original link on a 60-day rotation (about 9,300 records, so about 155 checks a day, estimate): a changed file is a candidate new version, a dead link goes to the Wayback queue and the workspace. |
| Charts (`charts`) and data sets on Data and charts | Derived | Rebuilt from records; the census watcher feeds their inputs. |
| Glossary Terms (`glossary-terms`) | Not watched | Definitions come only from Black's Law Dictionary, 12th ed. (project rule). Words in newly accepted records that are not in the glossary are listed for a person, from the records, not the internet. |
| Forms (`forms`) | Not watched | The project's own forms. Nations' court forms are found by `nation-sites` as part of court practice. |
| Events (`/events`, stored in D1) | `events`: organizations' calendars (feed), NIGC's events sitemap | Accepted events become draft events on the workspace Events page. |
| Legal help providers (`research/legal-help/`) | `cited-links`; by-hand yearly for the Legal Services Corporation's Native American grantees | |
| Federal reports, international documents (`research/data-roadmap/small-sets.yaml`) | `govinfo`, `gao`, `congress`; by-hand for UN and OAS documents (oas.org turns scripts away) | |
| Dispute resolution methods (`content/methods/`) | Derived | |
| Data roadmap rows marked Planned or Spiked | Each gets its watcher when its collection is built | The data roadmap's "How to use" asks for this. |

## Nations' own sites

Nations' sites are where changes to constitutions, codes, courts and contacts first appear, and they are also the most sensitive to watch: many are small, some are run by the nation's own staff, and a nation may restrict how the site shows its material.

- **Which addresses.** Only addresses already in the records: each profile's website, its governing documents' and codes' source links, and its courts' pages. On Nov. 26, 2026 the profiles held 9,099 links on 770 hosts. The watcher does not crawl beyond them, except to read a sitemap the nation publishes, which is the cheapest way to see a new page.
- **How often.** Each address about once a week, spread over the week; at one request every 30 seconds per host that is far below any normal site's traffic (about 1,300 requests a day in all, estimate).
- **What it keeps.** The main text's hash, and a private snapshot only when it changes.
- **What it does with a change.** A candidate on the review page; for a claimed nation page, the change is offered to the nation's team as a suggestion rather than applied by the project.
- **Restrictions.** A nation that hides its laws or opinions (decision record 0056) still has its copies kept privately, as the standing rule requires, but nothing new from its site is listed on the review page beyond "a restricted item changed", and nothing is proposed for publication. Cite-only nations get "cite only" records.
- **Codes on Municode, eCode360 and similar hosts.** Watched by their "last updated" date only, with no text sent to a model (see "robots.txt and content signals").

## Privacy

- **Child and family cases.** Any candidate whose title, docket or text suggests a juvenile, child welfare, Indian Child Welfare Act, adoption, guardianship, custody or protection order matter is flagged by rule before any model sees it, held from the queue's ordinary view, and never shows names; Tribal court opinions get initials (decision record 0057) before anything else. Federal and state appellate opinions usually use initials already, but the flag still applies.
- **No personal data in prompts.** Prompts carry document text, never information about the project's users, reviewers or nation teams.
- **Logs.** The watcher logs hosts, addresses and counts, not document text.

## Rate of work and cost (estimates)

These are the project's own estimates from the counts above.

- **Candidates.** The Federal Register term search is the largest stream (about 4,900 documents a year); agency feeds, eCFR, GovInfo and Congress.gov add perhaps 2,000; court sources perhaps 2,000; nations' sites, once watched, perhaps 100 to 300 changed pages a week. About 15,000 to 25,000 candidates a year.
- **Model use.** If rules settle two-thirds, about 6,000 candidates a year reach Claude Haiku 5.5. At about 3,000 tokens in and 200 out each, and Anthropic's list price of $0.10 per million input tokens and $0.50 per million output tokens ([Anthropic, pricing](https://platform.claude.com/docs/en/about-claude/pricing), as cached on Nov. 3, 2026), that is about $2.40 a year. About 300 hard cases a year at the top model (Claude Opus 5.5, $4 and $20 per million) at 20,000 tokens in and 2,000 out is about $36 a year. These are Anthropic's API prices. Under option B with Unified Billing, Cloudflare passes Anthropic's per-token prices through with no markup and adds a 5% fee when credits are bought, so the same figures plus 5% ([Cloudflare, Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/)); Unified Billing also limits a gateway to 200 requests a minute, far above this need. Whether the Message Batches discount applies through the gateway was not checked. Under option A these come out of the plan instead.
- **What the figures rest on.** Counted: the Federal Register numbers (4,920 all-agency documents in 2025 with "tribe" or "tribal"; about 100 from the Indian affairs agencies), the 672 title 25 section versions in eCFR since Jan. 1, 2025, the 9,099 links on nation profiles and the 9,318 source records. Assumed, not counted: about 2,000 a year each from the GovInfo and Congress.gov feeds and from courts, 100 to 300 changed nation pages a week, rules settling two-thirds of candidates, about 3,000 tokens read per candidate (instructions, title, summary and the first pages, not whole documents), about 200 tokens written (a short structured answer), and about 300 hard cases a year at about 20,000 tokens each. The arithmetic: 6,000 × 3,000 = 18 million tokens read at $0.10 a million is $1.80, plus 6,000 × 200 = 1.2 million written at $0.50 a million is $0.60; 300 × 20,000 = 6 million read at $4 a million is $24, plus 300 × 2,000 = 0.6 million written at $20 a million is $12.
- **If the guesses are wrong.** If Haiku had to read whole documents (about 30,000 tokens each) the Haiku line becomes about $20 a year; if there were 1,000 hard cases a year the top-model line becomes about $120. Even with both, the total stays under about $150 a year. Prompt caching of the fixed instructions would lower all of these. The first month of running will replace the guesses with real counts, and AI Gateway shows spend per model.
- **Cloudflare.** The Worker runs on the existing paid plan; requests, D1 rows and R2 storage for a few gigabytes of captures a year should be a few dollars a month at most.

## Building it, in phases

1. **Tier 1 federal core, APIs only, no models.** The Worker, the watcher list and its guard test, the D1 tables, capture and scan, dedupe index, rules triage, the review page (after its mockup is approved), a progress page and a Service checks row. Watchers: `federal-register`, `ecfr`, `govinfo`, `us-code-release-points`, `congress`, `supreme-court`, `cited-links`, and the by-hand cards. Needs the api.data.gov key.
2. **Model triage and tier 2.** The AI Gateway triage provider (option B), then `nigc`, `interior-pages`, `gao`, `senate-indian-affairs`, `wikidata`, `census`, `journals`, the email driver and the watch address, and `courtlistener` once Free Law Project has answered.
3. **Nations' own sites and events.** `nation-sites`, `leaders-directory`, `consented-courts`, `events`.
4. **Tier 3 states.** Link-only watchers for state statutes and cases, possibly on a separate site (Trevor, Nov. 24, 2026).

## What Trevor needs to do (when building starts)

- An api.data.gov key (free) for GovInfo and Congress.gov, stored in Cloudflare Secrets Store.
- A CourtListener account token, and a short note to Free Law Project describing the project's use, since it asks organizations to get in touch before building on its API.
- For option B only: an AI Gateway with Unified Billing credits loaded on the Cloudflare account (no Anthropic key needed), or, instead, an Anthropic API key stored in the gateway as a provider key.
- An email address on the project's domain (for example `watch@`) routed to the watch Worker, and subscriptions from it to the Federal Register, Interior and IHS email updates.
- Whether to rename the Workers to `tribal-law-project-*` before the watch Worker is first deployed: renaming a Worker later removes its Email Routing rules and breaks service bindings that name it ([Cloudflare, Email Routing rules](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/)), so it is cheaper to start under the new name.

## Sources

- Requests to each API and page named above from the project's cloud environment, Nov. 26, 2026 (status, headers, robots.txt and counts).
- Federal Register, [API documentation](https://www.federalregister.gov/developers/documentation/api/v1).
- eCFR, [API documentation](https://www.ecfr.gov/developers/documentation/api/v1).
- U.S. Government Publishing Office, [GovInfo API documentation](https://api.govinfo.gov/docs/) and [usgpo/api README](https://github.com/usgpo/api) (rate limits).
- api.data.gov, [developer manual](https://api.data.gov/docs/developer-manual/) (keys and default limits).
- Library of Congress, [api.congress.gov README](https://github.com/LibraryOfCongress/api.congress.gov) (5,000 requests an hour).
- Free Law Project, CourtListener [REST API](https://www.courtlistener.com/help/api/rest/) (rate limits), [alerts](https://www.courtlistener.com/help/api/rest/alerts/) and [webhooks](https://www.courtlistener.com/help/api/webhooks/) (pricing for organizations).
- Supreme Court of the United States, [robots.txt](https://www.supremecourt.gov/robots.txt) and [slip opinions](https://www.supremecourt.gov/opinions/slipopinion/25).
- National Indian Gaming Commission, [sitemap](https://www.nigc.gov/wp-sitemap.xml).
- Wikimedia, [Wikidata Query Service user manual](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual).
- IETF, [RFC 9309, Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309); [Content Signals Policy](https://contentsignals.org/).
- Cloudflare, [Workflows](https://developers.cloudflare.com/workflows/), [routed email to a Worker](https://developers.cloudflare.com/email-service/api/route-emails/email-handler/), [AI Gateway, Bring Your Own Keys](https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/), [Email Routing rules](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/).
- Anthropic, [pricing](https://platform.claude.com/docs/en/about-claude/pricing).
