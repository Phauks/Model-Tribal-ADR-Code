<script lang="ts">
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import ContactCard from '#lib/components/ContactCard.svelte';
	import DocumentHistoryList from '#lib/components/DocumentHistoryList.svelte';
	import FactGroups from '#lib/components/FactGroups.svelte';
	import GlancePanel from '#lib/components/GlancePanel.svelte';
	import NationServices from '#lib/components/NationServices.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import NationMap from '#lib/components/NationMap.svelte';
	import RecognitionBadges from '#lib/components/RecognitionBadges.svelte';
	import RecordPage from '#lib/components/RecordPage.svelte';
	import { contactsHeading } from '#lib/contact-card.ts';
	import Clock from '@lucide/svelte/icons/clock';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const page = $derived(data.page);
	const record = $derived(`tribes/${data.page.id}`);
	// Set when the image cannot be loaded, for example once the nation's website
	// no longer publishes the reviewed copy; the figure is then hidden.
	let imageFailed = $state(false);
	const hasContacts = $derived(data.contacts.websites.length > 0 || data.contacts.offices.length > 0);
</script>

<svelte:head>
	<title>{page.officialName} · Nations · Model Tribal ADR Code</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="small">
	<a href="/nations">Nations</a> › {page.officialName}
</nav>

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
			<!-- Recognition badges (Trevor, Nov. 22, 2026); the full wording and legal basis are in At a glance. -->
			{#if page.badges.length > 0}
				<p class="recognition-line"><RecognitionBadges badges={page.badges} /></p>
			{/if}
			{#if page.listedName !== page.officialName}
				<p class="small muted">
					Listed as “{page.listedName}” on the list that recognizes it.<CitationMarks
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

		<!-- 2. Review status: a small badge and one line, not a panel (Trevor, Nov. 22, 2026).
		     Report a problem in the masthead takes requests, so the line has no link of its own. -->
		<p class="review-status small" id="review-status" data-print-part="reviewStatus">
			<span class="visually-hidden">Review status:</span>
			<span class="status-badge"><Clock size={16} strokeWidth={2} aria-hidden="true" />{page.review.label}</span>
			<span class="muted">
				{page.review.meaning}{#if page.review.lastVerified}{' '}Sources checked {page.review.lastVerified}.{/if}
			</span>
		</p>
	{/snippet}

	{#if !page.withdrawn}
		<!-- 4-6. The legal sections always show, and say plainly when nothing was
		     found, so a reader can see whether recourse may be available (Trevor,
		     Nov. 22, 2026; src/lib/search-status.ts). -->
		<!-- 4. Courts and dispute resolution -->
		<Collapsible heading="Courts and dispute resolution" identifier="courts-heading">
			{#if data.empty.courts}
				{@render emptySection(data.empty.courts)}
			{:else}
				<NationServices categories={data.courts} />
			{/if}
		</Collapsible>

		<!-- 5. Laws and agreements: where the nation publishes its laws, linked, not
		     reproduced, and each document with recorded versions, oldest first
		     (decision record 0018). -->
		<div data-print-part="documentHistory">
			<Collapsible heading="Laws and agreements" identifier="law-heading">
				{#if data.law.length > 0}
					<FactGroups groups={data.law} />
				{/if}
				<DocumentHistoryList documents={data.documents} />
			</Collapsible>
		</div>

		<!-- 6. Jurisdiction: Public Law 280, Indian Child Welfare Act agents and the like -->
		<Collapsible heading="Jurisdiction" identifier="jurisdiction-heading">
			{#if data.empty.jurisdiction}
				{@render emptySection(data.empty.jurisdiction)}
			{:else}
				<FactGroups groups={data.jurisdiction} />
			{/if}
		</Collapsible>

		<!-- 6a. Treaties and federal ties: treaties with links to Kappler, how the land was set aside, Indian Health Service -->
		{#if data.ties.length > 0}
			<Collapsible heading="Treaties and federal ties" identifier="ties-heading">
				<FactGroups groups={data.ties} />
			</Collapsible>
		{/if}

		<!-- 7. Other nations in the same states: plain lists, never a ranking -->
		{#if data.neighbors.length > 0}
			<div class="no-print">
				<Collapsible heading="Other nations in the same states" identifier="neighbors-heading">
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
		<!-- 8. Sources -->
		{#if !page.withdrawn}
			<SourceList sources={data.sources} />
		{/if}
	{/snippet}
</RecordPage>

<!-- A legal section with nothing to show: the short answer, then how far the search went. -->
{#snippet emptySection(empty: { text: string; note: string })}
	<p class="empty-section"><strong>{empty.text}.</strong> {empty.note}</p>
{/snippet}

<!-- 3. At a glance, with the seal and the map, then the contacts. -->
{#snippet glance()}
	{#if data.glance.length > 0 || data.map}
		<GlancePanel>
			{#snippet picture()}
				{#if data.image && !imageFailed}
					<figure class="nation-image" data-print-part="officialImages">
						<img
							src={data.image.src}
							alt="{data.image.kind} of {page.officialName}"
							loading="lazy"
							decoding="async"
							onerror={() => (imageFailed = true)}
						/>
					</figure>
				{/if}
			{/snippet}
			<FactGroups groups={data.glance} />
			{#if data.map}
				<div class="glance-map">
					<NationMap map={data.map} nationName={page.officialName} />
				</div>
			{/if}
		</GlancePanel>
	{/if}
	{#if hasContacts}
		<Collapsible heading={contactsHeading} identifier="contacts-heading">
			<ContactCard cards={data.contacts} headingLevel={3} />
		</Collapsible>
	{/if}
{/snippet}

<style>
	.review-status {
		margin: var(--space-3) 0 var(--space-5);
	}

	.recognition-line {
		margin: 0 0 var(--space-3);
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin-right: var(--space-2);
		padding: 0 var(--space-2);
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		background: var(--color-surface);
		font-weight: var(--font-weight-semibold);
	}

	.empty-section {
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

	.neighbors {
		columns: 2 14rem;
		column-gap: var(--space-5);
	}

	.neighbors li {
		break-inside: avoid;
	}
</style>
