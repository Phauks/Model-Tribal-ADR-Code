<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import { readableDate } from '#lib/readable-date.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import ContactCard from '#lib/components/ContactCard.svelte';
	import DocumentHistoryList from '#lib/components/DocumentHistoryList.svelte';
	import FactGroups from '#lib/components/FactGroups.svelte';
	import GlancePanel from '#lib/components/GlancePanel.svelte';
	import NationServices from '#lib/components/NationServices.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import NationMap from '#lib/components/NationMap.svelte';
	import NationEditorBanner from '#lib/components/NationEditorBanner.svelte';
	import Pencil from '@lucide/svelte/icons/pencil';
	import NationDocumentsOffline from '#lib/components/NationDocumentsOffline.svelte';
	import RecognitionBadges from '#lib/components/RecognitionBadges.svelte';
	import RecordPage from '#lib/components/RecordPage.svelte';
	import { contactsHeading } from '#lib/contact-card.ts';
	import ReviewStatus from '#lib/components/ReviewStatus.svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Clock from '@lucide/svelte/icons/clock';
	import History from '@lucide/svelte/icons/history';
	import TopicBadges from '#lib/components/TopicBadges.svelte';
	import { opinionsMentioning } from '#lib/opinion-mentions.ts';
	import Timeline from '#lib/components/Timeline.svelte';
	import { unclaimedPage } from '#lib/review-status.ts';
	import { afterNavigate } from '$app/navigation';
	import { fillNationSlots } from '#lib/nation-page-slots.ts';
	import { imageViewerAttributes } from '#lib/image-viewer.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const page = $derived(data.page);
	const record = $derived(`tribes/${data.page.id}`);

	// The Gaming Commission's enforcement actions table: Date, Type, Number,
	// Document and Source (Trevor, Nov. 23, 2026). The Source column shows
	// each action's citation markers; its text, for search and the .csv file,
	// is the source numbers.
	const enforcementColumns: TableColumn[] = [
		{ key: 'date', header: 'Date', type: 'date', sortable: true },
		{ key: 'kind', header: 'Type', isRowHeader: true, sortable: true, searchable: true, filterable: true },
		{ key: 'number', header: 'Number', sortable: true, searchable: true },
		{ key: 'document', header: 'Document', custom: true },
		{ key: 'source', header: 'Source', custom: true }
	];
	const enforcementRows: TableRow[] = $derived(
		data.enforcement.map((action) => ({
			key: action.key,
			cells: {
				date: { text: readableDate(action.date), sortValue: action.date },
				kind: { text: action.kind },
				number: { text: action.number },
				document: { text: action.link ? 'Read it' : '', href: action.link },
				source: { text: action.citations.map((mark) => mark.number).join(', ') }
			}
		}))
	);
	const enforcementMarks = $derived(new Map(data.enforcement.map((action) => [action.key, action.citations])));

	// The Treaties table: Signed, Treaty, Statutes at Large, Kappler and Signed
	// as (Trevor chose "label rows", Nov. 23, 2026: records with dates and
	// citations go in the shared data table). The treaty's markers follow its
	// title, as in the mockup.
	const treatyColumns: TableColumn[] = [
		{ key: 'signed', header: 'Signed', type: 'date', sortable: true },
		{ key: 'treaty', header: 'Treaty', isRowHeader: true, sortable: true, searchable: true, custom: true },
		{ key: 'statutes', header: 'Statutes at Large', sortable: true, searchable: true },
		{ key: 'kappler', header: 'Kappler', sortable: true, searchable: true },
		{ key: 'signedAs', header: 'Signed as', sortable: true, searchable: true, filterable: true }
	];
	const treatyRows: TableRow[] = $derived(
		data.treaties.map((treaty) => ({
			key: treaty.key,
			cells: {
				signed: { text: readableDate(treaty.signed), sortValue: treaty.signed },
				treaty: { text: treaty.title, href: treaty.link },
				statutes: { text: treaty.statutesAtLarge ?? '' },
				kappler: { text: treaty.kappler ?? '' },
				signedAs: { text: treaty.signedAs ?? '' }
			}
		}))
	);
	const treatyMarks = $derived(new Map(data.treaties.map((treaty) => [treaty.key, treaty.citations])));

	// The court cases that name the nation, as a party or as what the case is
	// about (Trevor, Nov. 23, 2026). Four short columns; under the case's name,
	// its citation and source marker, then the name the case gives the nation
	// when it is not today's name, such as a former name or a historical nation.
	const caseColumns: TableColumn[] = [
		{ key: 'year', header: 'Year', type: 'date', sortable: true },
		{ key: 'name', header: 'Case', isRowHeader: true, sortable: true, searchable: true, custom: true },
		{ key: 'court', header: 'Court', sortable: true },
		{ key: 'role', header: 'Role', sortable: true }
	];
	const caseRows: TableRow[] = $derived(
		data.cases.map((entry) => ({
			key: entry.key,
			cells: {
				year: { text: entry.decided?.slice(0, 4) ?? '', sortValue: entry.decided },
				name: { text: [entry.name, entry.citation].filter(Boolean).join(', '), sortValue: entry.name, href: entry.link },
				court: { text: entry.court ?? '' },
				role: { text: entry.role }
			}
		}))
	);
	const casesByKey = $derived(new Map(data.cases.map((entry) => [entry.key, entry])));
	// Set when the image cannot be loaded, for example once the nation's website
	// no longer publishes the reviewed copy; the figure is then hidden.
	let imageFailed = $state(false);
	const hasContacts = $derived(data.contacts.websites.length > 0 || data.contacts.offices.length > 0);

	// The Worker fills the nation's own changes into the page before it is
	// sent. After a move within the site the page came from the build, so it
	// asks for them itself (src/lib/nation-page-slots.ts).
	afterNavigate((navigation) => {
		if (navigation.type !== 'enter') void fillNationSlots(data.page.id);
	});
</script>

<svelte:head>
	<title>{page.officialName} · Nations · Model Tribal ADR Code</title>
</svelte:head>

<!-- For someone on the nation's team: "You can edit this page" (decision record 0041). -->
{#if !page.withdrawn}<NationEditorBanner nation={page.id} />{/if}

<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} />

<!--
	A record page (site/DESIGN.md, "Record pages", "Nation pages"): the text on
	the left, held to a readable line length, and beside it "At a glance" (the
	seal, key facts and map) and the contacts. On a narrow screen "At a glance"
	comes right after the title, so the key facts come first.
-->
<RecordPage glance={!page.withdrawn && (data.glance.length > 0 || data.map || hasContacts) ? glance : undefined}>
	{#snippet introduction()}
		{#if page.example}
			<div class="notice" role="note">
				<p>
					<strong>This is a fictitious example.</strong> It describes no real nation. It shows how each
					nation’s page will be laid out once the records are published.
				</p>
			</div>
		{/if}

		<!-- 1. Name. The nation's seal or logo heads At a glance (docs/official-images.md). -->
		<h1>{page.officialName}</h1>
		{#if !page.withdrawn}
			<!-- Recognition badges (Trevor, Nov. 22, 2026; the full wording and legal basis
			     are in At a glance), then who keeps the page, on the same line since both
			     are badges (Trevor, Nov. 23, 2026). The build always says "Unclaimed"; for
			     a claimed page the Worker hides it and fills the status place with the
			     claimed badge (src/lib/server/nation-page-overlay.ts). -->
			<div class="badge-line" id="review-status">
				{#if page.badges.length > 0}<RecognitionBadges badges={page.badges} explanations={page.badgeExplanations} />{/if}
				<span data-build-status data-print-part="reviewStatus">
					<ReviewStatus status={unclaimedPage} description="Who keeps this page:">
						<p class="no-print"><a href="/profile/nation-team?nation={page.id}">Work for this nation? Claim this page</a></p>
					</ReviewStatus>
				</span>
				<span class="nation-slot-status" data-nation-slot="status"></span>
				<!-- The page's history, its own badge apart from who keeps the page (Trevor, Nov. 23, 2026,
				     option A of design/page-history-badge/). The build cannot know how many changes there
				     are, so it says "History"; the Worker puts the count and the newest change in its place
				     (historyBadge in src/lib/server/nation-page-overlay.ts). Same markup as ReviewStatus. -->
				<span class="no-print" data-build-history>
					<details class="status-popover">
						<summary class="review-badge"
							><span class="visually-hidden">Page history:</span><History size={16} strokeWidth={2} aria-hidden="true" />History<ChevronDown
								class="status-popover-mark"
								size={14}
								strokeWidth={2}
								aria-hidden="true"
							/></summary
						>
						<div class="status-panel">
							<p class="muted">Nation pages show when they changed and which parts, never earlier wording.</p>
							<p><a href="/changes?page={encodeURIComponent(`/nations/${page.id}`)}">See all changes to this page</a></p>
						</div>
					</details>
				</span>
				<span data-nation-slot="history"></span>
			</div>
			{#if page.listedName !== page.officialName}
				<p class="small muted">
					<!-- The listed name as an alias; its marker leads to the list in References (Trevor, Nov. 23, 2026). -->
					Alias: {page.listedName}<CitationMarks
						marks={data.nameCitations}
					/>
				</p>
			{/if}
			{#each data.selfDesignations as designation (designation.name)}
				<p class="lead">
					<span lang={designation.languageTag}>{designation.name}</span><CitationMarks
						marks={designation.citations}
					/>
				</p>
			{/each}
			<!-- Pronunciation: copied from the cited source, never worked out from the spelling -->
			{#each data.pronunciations as entry, index (index)}
				<p>
					<span class="muted">How to say</span>
					<span lang={entry.languageTag}>{entry.name}</span>:
					{#if entry.respelling}{entry.respelling}{/if}
					{#if entry.phoneticTranscription}/{entry.phoneticTranscription}/{/if}
					{#if entry.recording}<a href={entry.recording}>Listen to the recording</a>{/if}<CitationMarks
						marks={entry.citations}
					/>
				</p>
			{/each}
		{/if}

		{#if page.withdrawn}
			<p class="review-status small" id="review-status" data-print-part="reviewStatus">
				<span class="review-badge"><Clock size={16} strokeWidth={2} aria-hidden="true" />{page.review.label}</span>
				<span class="muted">{page.review.meaning}</span>
			</p>
		{/if}
		<!-- The nation's own words and pictures, filled in by the Worker from what its team published (decision record 0041). -->
		{#if !page.withdrawn}<div class="nation-slot" data-nation-slot="top"></div>{/if}
	{/snippet}

	{#if !page.withdrawn}
		<!-- 4-7. The legal sections always show, and say plainly when nothing was
		     found, so a reader can see whether recourse may be available (Trevor,
		     Nov. 22, 2026; src/lib/search-status.ts). -->
		<!-- 4. Government: how the government is set up, one plain fact per line,
		     each from the nation's governing document, its website or an official
		     directory; never a summary of a constitution (decision record 0042). -->
		<Collapsible heading="Government" identifier="government-heading">
			{#if data.empty.government}
				{@render emptySection(data.empty.government)}
			{:else}
				<FactGroups groups={data.government} />
			{/if}
		</Collapsible>

		<!-- 5. Courts -->
		<Collapsible heading="Courts" identifier="courts-heading">
			{@render editLink('courts-and-dispute-resolution', 'courts-heading', 'Courts')}
			{#if data.empty.courts}
				{@render emptySection(data.empty.courts)}
			{:else}
				<NationServices categories={data.courts} />
				{#if data.practice.length > 0}<FactGroups groups={data.practice} />{/if}
			{/if}
			<div class="nation-slot" data-nation-slot="courts"></div>
		</Collapsible>

		<!-- 5a. Court opinions: the nation's opinions in the Caselaw Access Project's
		     tribal reporters, each served as its own page with a removal link
		     (decision record 0047). -->
		{#if data.opinions}
			{@const opinions = data.opinions}
			<Collapsible heading="Court opinions" identifier="opinions-heading">
				<p>
					{opinions.count === 1 ? 'One opinion' : `${opinions.count.toLocaleString('en-US')} opinions`} of courts serving the nation {opinions.count === 1 ? 'is' : 'are'} published in the American Tribal Law Reporter or the Navajo Reporter{opinions.from === opinions.to ? `, from ${opinions.from}` : `, from ${opinions.from} to ${opinions.to}`}.<CitationMarks
						marks={opinions.citations}
					/>
				</p>
				<ul class="opinions stacked-list">
					{#each opinions.shown as opinion (opinion.path)}
						<li>
							<a href={opinion.path}><i>{opinion.name}</i></a>, {opinion.citation} ({opinion.court} {opinion.year}){#if opinion.topics.length > 0}<span class="small mentions"><span class="muted">Mentions</span>{' '}<TopicBadges topics={opinion.topics.map((topic) => ({ text: topic, link: opinionsMentioning(data.page.id, topic) }))} /></span>{/if}
						</li>
					{/each}
				</ul>
				{#if opinions.count > opinions.shown.length}
					<p><a href={opinions.link}>All {opinions.count.toLocaleString('en-US')} opinions</a>, with their courts, dates and the words they mention.</p>
				{:else}
					<p><a href={opinions.link}>The opinions as a table</a>, with their courts, dates and the words they mention.</p>
				{/if}
				<p class="small muted">
					Each opinion is a copy of the Caselaw Access Project’s text, with the publisher’s headnotes removed. A word listed means only that it appears in the opinion, not what the court decided.
				</p>
			</Collapsible>
		{/if}

		<!-- 5b. Cases involving the nation: court cases in the project's sources
		     that name the nation, as a party or as what the case is about; each
		     case's record says how (nations_in_case). -->
		{#if data.cases.length > 0}
			<Collapsible heading="Cases involving the nation" identifier="cases-heading">
				<DataTable
					identifier="nation-cases"
					label="Table: cases involving the nation"
					columns={caseColumns}
					rows={caseRows}
					defaultSort={{ key: 'year', direction: 'ascending' }}
					rowName={['case', 'cases']}
					count={false}
					download="{data.page.id}-cases"
				>
					{#snippet cell(row: TableRow, column: TableColumn)}
						{@const entry = casesByKey.get(row.key)}
						{#if entry && column.key === 'name'}
							<span class="case-name">{#if entry.link}<a href={entry.link}><i>{entry.name}</i></a>{:else}<i>{entry.name}</i>{/if}</span>
							<span class="case-detail small muted">{#if entry.citation}{entry.citation}{/if}<CitationMarks marks={entry.citations} /></span>
							<span class="case-detail case-phone small muted">{[entry.court, entry.role].filter(Boolean).join(' · ')}</span>
							{#if entry.namedAs || entry.note}
								<span class="case-detail small muted">{#if entry.namedAs}Named as “{entry.namedAs}.”{/if}{#if entry.namedAs && entry.note}{' '}{/if}{#if entry.note}{entry.note}{/if}</span>
							{/if}
						{/if}
					{/snippet}
				</DataTable>
			</Collapsible>
		{/if}

		<!-- 6. Laws and agreements: where the nation publishes its laws, linked, not
		     reproduced, and each document with recorded versions, oldest first
		     (decision record 0018). -->
		<div data-print-part="documentHistory">
			<Collapsible heading="Laws and agreements" identifier="law-heading">
				{@render editLink('statements', 'statement-law-heading', 'Laws and agreements')}
				{#if data.law.length > 0}
					<FactGroups groups={data.law} />
				{/if}
				<DocumentHistoryList documents={data.documents} />
				<div class="nation-slot" data-nation-slot="law"></div>
				<NationDocumentsOffline nation={data.page.id} held={data.page.heldCopies} />
			</Collapsible>
		</div>

		<!-- 7. Jurisdiction: Public Law 280, Indian Child Welfare Act agents and the like -->
		<Collapsible heading="Jurisdiction" identifier="jurisdiction-heading">
			{@render editLink('statements', 'statement-jurisdiction-heading', 'Jurisdiction')}
			{#if data.empty.jurisdiction}
				{@render emptySection(data.empty.jurisdiction)}
			{:else}
				<FactGroups groups={data.jurisdiction} />
			{/if}
			<div class="nation-slot" data-nation-slot="jurisdiction"></div>
		</Collapsible>

		<!-- 7a. Treaties and federal ties: treaties with links to Kappler, how the land was set aside, Indian Health Service -->
		{#if data.treaties.length > 0 || data.ties.length > 0 || data.enforcement.length > 0}
			<Collapsible heading="Treaties and federal ties" identifier="ties-heading">
				{#if data.treaties.length > 0}
					<h3 id="treaties-heading">Treaties</h3>
					<DataTable
						identifier="treaties"
						label="Table: treaties"
						columns={treatyColumns}
						rows={treatyRows}
						defaultSort={{ key: 'signed', direction: 'ascending' }}
						rowName={['treaty', 'treaties']}
						download="{data.page.id}-treaties"
					>
						{#snippet cell(row: TableRow, column: TableColumn)}
							{#if column.key === 'treaty'}
								<span class="treaty-cell"
									>{#if row.cells.treaty.href}<a href={row.cells.treaty.href}>{row.cells.treaty.text}</a
										>{:else}{row.cells.treaty.text}{/if}<CitationMarks marks={treatyMarks.get(row.key)} /></span
								>
							{/if}
						{/snippet}
					</DataTable>
				{/if}
				{#if data.ties.length > 0}<FactGroups groups={data.ties} />{/if}
				{#if data.enforcement.length > 0}
					<!-- The Gaming Commission's enforcement actions, as a table (Trevor, Nov. 23, 2026). -->
					<h3 id="enforcement-heading">Gaming Commission enforcement actions</h3>
					<DataTable
						identifier="enforcement-actions"
						label="Table: Gaming Commission enforcement actions"
						columns={enforcementColumns}
						rows={enforcementRows}
						defaultSort={{ key: 'date', direction: 'ascending' }}
						rowName={['action', 'actions']}
						filters
						download="{data.page.id}-enforcement-actions"
					>
						{#snippet cell(row: TableRow, column: TableColumn)}
							{#if column.key === 'document'}
								{#if row.cells.document.href}<a href={row.cells.document.href}>{row.cells.document.text}</a>{/if}
							{:else if column.key === 'source'}
								<CitationMarks marks={enforcementMarks.get(row.key)} />
							{/if}
						{/snippet}
					</DataTable>
				{/if}
			</Collapsible>
		{/if}

		<!-- 7a'. Timeline: every dated record on the page on one line and in one
		     list, with federal laws that apply to every nation drawn faintly
		     for context (Trevor, Nov. 23, 2026; src/lib/components/Timeline.svelte). -->
		{#if data.timeline}
			<Collapsible heading="Timeline" identifier="timeline-heading">
				<Timeline
					entries={data.timeline.entries}
					opinions={data.timeline.opinions}
					opinionsLink={data.timeline.opinionsLink}
					opinionCitations={data.timeline.opinionCitations}
					fullLink="/nations/timeline?nation={page.id}"
					besideHeading
				/>
			</Collapsible>
		{/if}

		<!-- 7b. Stories: the nation's stories about disputes and peace, each linked
		     to its own page, which quotes the teller and cites the source. A
		     restricted or withdrawn story is never listed (decision record 0029). -->
		{#if data.stories.length > 0}
			<Collapsible heading="Stories" identifier="stories-heading">
				<ul class="stories stacked-list">
					{#each data.stories as story (story.id)}
						{@const shared = story.nations.filter((nation) => nation.id !== data.page.id)}
						<li>
							<a href="/stories/{story.id}">{story.title}</a>
							<span class="small muted story-kind">{story.kind}{#if story.community}{' · '}{story.community}{/if}{#if shared.length > 0}{' · '}Shared with {shared.map((nation) => nation.name).join(', ')}{/if}</span>
						</li>
					{/each}
				</ul>
			</Collapsible>
		{/if}

		<!-- 8. Nearby Nations, the other nations in the same states: plain lists, never a ranking. It starts folded (nation page review, layout A). -->
		{#if data.neighbors.length > 0}
			<div class="no-print">
				<Collapsible heading="Nearby Nations" identifier="neighbors-heading" open={false}>
					{#each data.neighbors as entry (entry.state)}
						<h3 class="neighbors-state">{entry.stateName}</h3>
						{#if entry.nations.length > 0}
							<ul class="neighbors">
								{#each entry.nations as nation (nation.id)}
									<li><a href="/nations/{nation.id}">{nation.name}</a></li>
								{/each}
							</ul>
						{:else}
							<p>
								<a href={entry.link}>All {entry.count} other nations in {entry.stateName}</a>
							</p>
						{/if}
					{/each}
				</Collapsible>
			</div>
		{/if}
	{/if}

	{#snippet sources()}
		<!-- 9. Sources -->
		{#if !page.withdrawn}
			<SourceList sources={data.sources} />
		{/if}
	{/snippet}
</RecordPage>

<!-- "Edit" on a part of the page, shown only to someone on the nation's team whose place covers it (NationEditorBanner.svelte). -->
{#snippet editLink(part: string, anchor: string, name: string)}
	<a class="nation-edit-link no-print" data-edit-part={part} href="/workspace/nation-teams/{page.id}/edit#{anchor}"
		><Pencil size={16} aria-hidden="true" />Edit<span class="visually-hidden"> {name}</span></a
	>
{/snippet}

<!-- A legal section with nothing to show: the short answer, then how far the search went once one is finished. -->
{#snippet emptySection(empty: { text: string })}
	<p class="empty-section">{empty.text}</p>
{/snippet}

<!-- 3. At a glance, with the seal and the map, then the contacts. -->
{#snippet glance()}
	{#if data.glance.length > 0 || data.map}
		<GlancePanel>
			{#snippet picture()}
				{#if data.image && !imageFailed}
					<!-- Selecting the seal opens it larger, as on Wikipedia (src/lib/image-viewer.ts). -->
					{@const description = `${data.image.kind} of ${page.officialName}`}
					<figure class="nation-image" data-print-part="officialImages">
						<a
							href={data.image.src}
							{...imageViewerAttributes(description, {
								title: description,
								original: data.image.original,
								source: data.image.source
							})}
						>
							<img
								src={data.image.src}
								alt={description}
								loading="lazy"
								decoding="async"
								onerror={() => (imageFailed = true)}
							/>
						</a>
					</figure>
				{/if}
			{/snippet}
			<FactGroups groups={data.glance} />
			<div class="nation-slot" data-nation-slot="glance"></div>
			{#if data.map}
				<div class="glance-map">
					<NationMap map={data.map} nationName={page.officialName} />
				</div>
			{/if}
		</GlancePanel>
	{/if}
	{#if hasContacts}
		<Collapsible heading={contactsHeading} identifier="contacts-heading">
			{@render editLink('contacts', 'contacts-heading', contactsHeading)}
			<ContactCard cards={data.contacts} headingLevel={3} />
		</Collapsible>
	{/if}
	<div class="nation-slot" data-nation-slot="contacts"></div>
{/snippet}

<style>
	.case-name,
	.case-detail {
		display: block;
	}
	.case-detail {
		font-weight: normal;
	}
	/* Room between the case's link and the source marker under it, so each
	   is a touch target of its own (WCAG 2.2, 2.5.8). */
	.case-name {
		margin-bottom: var(--space-2);
	}
	/* On a phone the Court and Role columns fold into a line under the case's
	   name, so the name keeps the width it needs. */
	.case-detail.case-phone {
		display: none;
	}
	@media (max-width: 40rem) {
		.case-detail.case-phone {
			display: block;
		}
		:global(#nation-cases th:nth-child(n + 3)),
		:global(#nation-cases td:nth-child(n + 3)) {
			display: none;
		}
	}
	/*
	 * A treaty's markers follow its title with no text around them, so each
	 * gets a full 24 by 24 pixel target, as in FactGroups (WCAG 2.2, 2.5.8),
	 * and the title link gets two pixels above and below.
	 */
	.treaty-cell :global(.note-marker) {
		padding: 5px 9px 5px 0.05em;
	}

	.treaty-cell > a {
		padding-block: 2px;
	}

	/* Room before the line that follows a list, such as "All 949 opinions". */
	.opinions,
	.stories {
		margin-bottom: var(--space-4);
	}

	.mentions {
		display: block;
		margin-top: var(--space-1);
	}
	.story-kind {
		display: block;
	}

	/* Its rules keep clear of the floated At a glance column and contacts (RecordPage.svelte). */
	.empty-section {
		display: flow-root;
		margin: 0 0 var(--space-5);
		padding: var(--space-3) 0;
		border-top: 1px solid var(--color-line);
		border-bottom: 1px solid var(--color-line);
	}

	.glance-map {
		margin-top: var(--space-4);
	}

	.nation-image {
		margin: 0 0 var(--space-3);
	}

	.nation-image a {
		display: block;
		width: fit-content;
		margin: 0 auto;
		border-radius: var(--radius-control);
		cursor: zoom-in;
	}

	/* Seals are square and logos are often wide, so the box sets only the limits. */
	.nation-image img {
		display: block;
		margin: 0 auto;
		width: auto;
		height: auto;
		max-width: min(18rem, 100%);
		max-height: 7rem;
	}

	.neighbors-state {
		font-size: var(--font-size-body);
	}

	/* As many columns as fit, so the list spreads out under At a glance. */
	.neighbors {
		columns: var(--layout-card-min);
		column-gap: var(--space-5);
		max-width: none;
		/* Names in columns need no bullets (Trevor, Nov. 23, 2026). */
		list-style: none;
		padding-left: 0;
	}

	.neighbors li {
		break-inside: avoid;
	}
</style>
