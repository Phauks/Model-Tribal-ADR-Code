<script lang="ts">
	import { courtPagePath } from '#lib/court-pages.ts';
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
	import NationPageControls from '#lib/components/NationPageControls.svelte';
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
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import { fillNationSlots, restrictionsInPage } from '#lib/nation-page-slots.ts';
	import { noPageRestrictions, opinionsNote, withheldLine, type PageRestrictions } from '#lib/nation-restrictions.ts';
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
	// The land the nation's predecessors ceded, from Royce's schedule (Trevor, 2026-11-26, historic maps mockup 6). A treaty with no page here is named by Royce's schedule alone; each map sheet opens in the image viewer.
	const cessionColumns: TableColumn[] = [
		{ key: 'royce', header: 'Royce no.', type: 'number', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'ceded', header: 'Ceded', type: 'date', sortable: true },
		{ key: 'by', header: 'By', sortable: true, searchable: true, custom: true },
		{ key: 'maps', header: 'Royce’s map', searchable: true, filterable: true, custom: true }
	];
	const cessionRows: TableRow[] = $derived(
		data.landCessions.map((cession) => ({
			key: cession.royce,
			cells: {
				royce: { text: cession.royce, sortValue: Number.parseFloat(cession.royce) },
				ceded: { text: cession.dates.map((date) => readableDate(date)).join('; '), sortValue: cession.dates[0] ?? '' },
				by: { text: cession.treaties.length > 0 ? cession.treaties.map((treaty) => treaty.name).join('; ') : cession.schedule },
				maps: { text: cession.sheets.map((sheet) => sheet.name).join(', '), values: cession.sheets.map((sheet) => sheet.name) }
			}
		}))
	);
	const cessionsByRoyce = $derived(new Map(data.landCessions.map((cession) => [cession.royce, cession])));
	const treatyMarks = $derived(new Map(data.treaties.map((treaty) => [treaty.key, treaty.citations])));

	// The self-governance and federal programs table: Program, Agency, Dates,
	// Through (only when an organization holds a program for the nation) and
	// Latest amount (Trevor chose mockup B, Nov. 26, 2026: "just providing the
	// value is interesting enough"). The program's markers follow its name.
	const programColumns: TableColumn[] = $derived([
		{ key: 'program', header: 'Program', isRowHeader: true, sortable: true, searchable: true, custom: true },
		{ key: 'agency', header: 'Agency', sortable: true, searchable: true },
		{ key: 'dates', header: 'Dates', type: 'date', sortable: true },
		...(data.programs.some((row) => row.through) ? [{ key: 'through', header: 'Through', sortable: true, searchable: true }] : []),
		...(data.programs.some((row) => row.amount) ? [{ key: 'amount', header: 'Latest amount', sortable: true }] : [])
	]);
	const programRows: TableRow[] = $derived(
		data.programs.map((row) => ({
			key: row.key,
			cells: {
				program: { text: row.name, href: row.link },
				agency: { text: row.agency },
				dates: { text: row.dates, sortValue: row.datesSort },
				through: { text: row.through ?? '' },
				amount: { text: row.amount ?? '', sortValue: row.amountSort === undefined ? undefined : String(row.amountSort) }
			}
		}))
	);
	const programMarks = $derived(new Map(data.programs.map((row) => [row.key, row.citations])));

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
				court: { text: entry.court ?? '', href: entry.courtLink },
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
	// What the nation chose the site shows of its laws and court opinions
	// comes the same way (src/lib/nation-restrictions.ts). Until the page has
	// read it, the Worker's style has already taken hidden items off.
	let restrictions = $state<PageRestrictions>(noPageRestrictions);
	afterNavigate(async (navigation) => {
		if (navigation.type !== 'enter') {
			restrictions = noPageRestrictions;
			await fillNationSlots(data.page.id);
		}
		restrictions = restrictionsInPage();
	});
	const levelOf = (key: string) => restrictions.levels[`copy:${key}`] ?? 'show';
	const opinionsCount = $derived((data.opinions?.count ?? 0) - restrictions.opinions.hidden);
	const opinionsShown = $derived((data.opinions?.shown ?? []).filter((opinion) => levelOf(opinion.key) !== 'hide'));
	const opinionsCited = $derived(restrictions.opinions.kind === 'cite');
	const heldCopies = $derived({
		count: data.page.heldCopies.count - restrictions.withheldCopies.count,
		bytes: data.page.heldCopies.bytes - restrictions.withheldCopies.bytes
	});
</script>

<svelte:head>
	<title>{page.officialName} · Nations · Tribal Law Project</title>
</svelte:head>

<!-- For someone on the nation's team: Edit, History and Your nation's team in the masthead (decision record 0041). -->
{#if !page.withdrawn}<NationPageControls nation={page.id} />{/if}

<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} current={page.officialName} />

<!--
	A record page (site/DESIGN.md, "Record pages", "Nation pages"): the text on
	the left, held to a readable line length, and beside it "At a glance" (the
	seal, key facts and map) and the contacts. On a narrow screen "At a glance"
	comes right after the title, so the key facts come first.
-->
<RecordPage glance={!page.withdrawn && (data.glance.length > 0 || data.map || hasContacts) ? glance : undefined}>
	{#snippet title()}
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
	{/snippet}
	{#snippet introduction()}
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
			<!-- Other names, one labeled line each in one style, each with its marker (Trevor, Nov. 23 and 24, 2026):
			     the listed name as an alias, whose marker leads to the list in References, then each name the
			     nation uses for itself or its people, with its language where the record names it, then how to
			     say it, copied from the cited source and never worked out from the spelling. -->
			{#if page.listedName !== page.officialName || data.selfDesignations.length > 0 || data.pronunciations.length > 0}
				<div class="other-names small muted">
					{#if page.listedName !== page.officialName}
						<p>Alias: {page.listedName}<CitationMarks marks={data.nameCitations} /></p>
					{/if}
					{#each data.selfDesignations as designation (designation.name)}
						<p>
							Own name:
							<span lang={designation.languageTag}>{designation.name}</span>{#if designation.language}{' '}({designation.language}){/if}<CitationMarks
								marks={designation.citations}
							/>
						</p>
					{/each}
					{#each data.pronunciations as entry, index (index)}
						<p>
							How to say <span lang={entry.languageTag}>{entry.name}</span>:
							{#if entry.respelling}{entry.respelling}{/if}
							{#if entry.phoneticTranscription}/{entry.phoneticTranscription}/{/if}
							{#if entry.recording}<a href={entry.recording}>Listen to the recording</a>{/if}<CitationMarks
								marks={entry.citations}
							/>
						</p>
					{/each}
				</div>
			{/if}
		{/if}

		{#if page.withdrawn}
			<p class="review-status small" id="review-status" data-print-part="reviewStatus">
				<span class="review-badge"><Clock size={16} strokeWidth={2} aria-hidden="true" />{page.review.label}</span>
				<span class="muted">{page.review.meaning}</span>
			</p>
		{/if}
		<!-- The nation's own words and pictures, filled in by the Worker from what its team published (decision record 0041). -->
		{#if !page.withdrawn}<div class="nation-slot" data-nation-slot="top"></div><div data-nation-slot="restrict" hidden></div>{/if}
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

		<!-- 5b. Legal help: the nation's own legal aid office, Native legal aid,
		     self-help centers and legal information sites that serve the nation
		     (src/lib/server/legal-help.ts; Trevor chose its own section, Nov. 24, 2026). -->
		<Collapsible heading="Legal help" identifier="legal-help-heading">
			{#if data.empty.legalHelp}
				{@render emptySection(data.empty.legalHelp)}
			{:else}
				<FactGroups groups={data.legalHelp} />
			{/if}
		</Collapsible>

		<!-- 5a. Court opinions: the nation's opinions in the Caselaw Access Project's
		     tribal reporters, each served as its own page with a removal link
		     (decision record 0047). -->
		{#if data.opinions && opinionsCount > 0}
			{@const opinions = data.opinions}
			<Collapsible heading="Court opinions" identifier="opinions-heading">
				<p>
					{opinionsCount === 1 ? 'One opinion' : `${opinionsCount.toLocaleString('en-US')} opinions`} of courts serving the nation {opinionsCount === 1 ? 'is' : 'are'} published in the American Tribal Law Reporter or the Navajo Reporter{opinions.from === opinions.to ? `, from ${opinions.from}` : `, from ${opinions.from} to ${opinions.to}`}.<CitationMarks
						marks={opinions.citations}
					/>
				</p>
				<ul class="opinions stacked-list">
					{#each opinionsShown as opinion (opinion.path)}
						{@const cited = levelOf(opinion.key) === 'cite'}
						<li data-restrict-item="copy:{opinion.key}">
							{#if cited}<a class="original" href={opinion.original} rel="noopener noreferrer"><i>{opinion.name}</i><ExternalLink size={14} aria-hidden="true" /></a
								>{:else}<a href={opinion.path}><i>{opinion.name}</i></a>{/if}, {opinion.citation} (<a href={courtPagePath(opinion.court)}>{opinion.court}</a> {opinion.year}){#if opinion.topics.length > 0 && !cited}<span class="small mentions" data-restrict-text><span class="muted">Mentions</span>{' '}<TopicBadges topics={opinion.topics.map((topic) => ({ text: topic, link: opinionsMentioning(data.page.id, topic) }))} /></span>{/if}
						</li>
					{/each}
				</ul>
				{#if opinionsCount > opinionsShown.length}
					<p><a href={opinions.link}>All {opinionsCount.toLocaleString('en-US')} opinions</a>, {opinionsCited ? 'with their courts and dates.' : 'with their courts, dates and the words they mention.'}</p>
				{:else}
					<p><a href={opinions.link}>The opinions as a table</a>, {opinionsCited ? 'with their courts and dates.' : 'with their courts, dates and the words they mention.'}</p>
				{/if}
				{#if restrictions.opinions.cited > 0}
					<p class="small muted">
						{opinionsNote(restrictions.opinions.kind, restrictions.opinions.cited, restrictions.opinions.total - restrictions.opinions.cited - restrictions.opinions.hidden)}
					</p>
				{:else}
					<p class="small muted">
						Each opinion is a copy of the Caselaw Access Project’s text, with the publisher’s headnotes removed. A word listed means only that it appears in the opinion, not what the court decided.
					</p>
				{/if}
				{#if restrictions.opinions.hidden > 0}<p class="small muted">{withheldLine}</p>{/if}
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

		<!-- 5c. People: Native people of the nation with a page of their own
		     (content/biographies/), in the cases or the nation's history. -->
		{#if data.people.length > 0}
			<Collapsible heading="People" identifier="people-heading">
				<dl class="summary-list people-list">
					{#each data.people as person (person.link)}
						<div>
							<dt><a href={person.link}>{person.name}</a></dt>
							<dd>{person.lead}</dd>
						</div>
					{/each}
				</dl>
			</Collapsible>
		{/if}

		<!-- 6. Laws and agreements: where the nation publishes its laws, linked, not
		     reproduced, and each document with recorded versions, oldest first
		     (decision record 0018). -->
		<div data-print-part="documentHistory">
			<Collapsible heading="Laws and agreements" identifier="law-heading" actions={heldCopies.count > 0 ? documentTools : undefined}>
				{@render editLink('statements', 'statement-law-heading', 'Laws and agreements')}
				{#if data.law.length > 0}
					<FactGroups groups={data.law} />
				{/if}
				<DocumentHistoryList documents={data.documents} {restrictions} />
				<div class="nation-slot" data-nation-slot="law"></div>
				{#if restrictions.lawsWithheld || (restrictions.opinions.total > 0 && restrictions.opinions.hidden === restrictions.opinions.total)}
					<p class="small muted">{withheldLine}</p>
				{/if}
			</Collapsible>
			{#snippet documentTools()}
				<NationDocumentsOffline nation={data.page.id} held={heldCopies} />
			{/snippet}
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

		<!-- 7a. Treaties and federal ties: treaties with links to Kappler, how the land was set aside, Indian Health Service, self-governance and federal programs -->
		{#if data.treaties.length > 0 || data.ties.length > 0 || data.programs.length > 0 || data.enforcement.length > 0}
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
				{#if data.programs.length > 0}
					<h3 id="federal-programs-heading">Self-governance and federal programs</h3>
					<DataTable
						identifier="federal-programs"
						label="Table: self-governance and federal programs"
						columns={programColumns}
						rows={programRows}
						rowName={['program', 'programs']}
						download="{data.page.id}-federal-programs"
					>
						{#snippet cell(row: TableRow, column: TableColumn)}
							{#if column.key === 'program'}
								<span class="treaty-cell"
									>{#if row.cells.program.href}<a href={row.cells.program.href}>{row.cells.program.text}</a
										>{:else}{row.cells.program.text}{/if}<CitationMarks marks={programMarks.get(row.key)} /></span
								>
							{/if}
						{/snippet}
					</DataTable>
				{/if}
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

		<!-- 7a''. Land cessions: Royce's schedule (1899), with the present-day nations the Forest Service lists (historic maps mockup 6). -->
		{#if data.landCessions.length > 0}
			<Collapsible heading="Land cessions" identifier="cessions-heading" count={data.landCessions.length}>
				<DataTable
					identifier="land-cessions"
					label="Table: land cessions"
					columns={cessionColumns}
					rows={cessionRows}
					defaultSort={{ key: 'ceded', direction: 'ascending' }}
					rowName={['cession', 'cessions']}
					download="{data.page.id}-land-cessions"
				>
					{#snippet cell(row: TableRow, column: TableColumn)}
						{@const cession = cessionsByRoyce.get(row.key)}
						{#if cession && column.key === 'by'}
							{#if cession.treaties.length > 0}
								{#each cession.treaties as treaty, index (treaty.key)}{#if index > 0}{'; '}{/if}<a href="/laws/{treaty.key}">{treaty.name}</a>{/each}
							{:else}
								{cession.schedule}
							{/if}
						{:else if cession && column.key === 'maps'}
							{#each cession.sheets as sheet, index (sheet.plate)}{#if index > 0}{', '}{/if}<a href={sheet.image} {...imageViewerAttributes(`Royce’s map: ${sheet.name}`, { title: `Royce’s map: ${sheet.name}`, original: sheet.link })}>{sheet.name}</a>{/each}
						{/if}
					{/snippet}
				</DataTable>
				<p class="small muted">From Royce’s schedule (1899), with the present-day nations the U.S. Forest Service lists.</p>
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

<!-- "Edit" on a part of the page, shown only to someone on the nation's team whose place covers it (NationPageControls.svelte). -->
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
		<!-- On a phone the first facts show and the rest, with the map, wait behind "Show all" (GlancePanel.svelte). -->
		<GlancePanel facts={data.glance.length} more={data.map ? 'the map' : undefined}>
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
								class="image-backing"
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
				<div class="glance-map" data-glance-more>
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
	/* The listed name, own names and how to say them: one short line each, set close together. */
	.other-names {
		margin: 0 0 var(--space-3);
	}

	.other-names p {
		margin: 0 0 var(--space-1);
	}

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

	/* An opinion the nation chose to cite only links to the Caselaw Access Project. */
	.original {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
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
