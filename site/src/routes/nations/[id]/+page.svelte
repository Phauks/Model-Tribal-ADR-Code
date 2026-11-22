<script lang="ts">
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import ContactCard from '#lib/components/ContactCard.svelte';
	import DocumentHistoryList from '#lib/components/DocumentHistoryList.svelte';
	import FactGroups from '#lib/components/FactGroups.svelte';
	import NationServices from '#lib/components/NationServices.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import StatePresenceMap from '#lib/components/StatePresenceMap.svelte';
	import { newTabNoteId, outsideLinksOpenInNewTab } from '#lib/new-tab-links.ts';
	import { contactsHeading } from '#lib/contact-card.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const page = $derived(data.page);
	const record = $derived(`tribes/${data.page.id}`);
	// Set when the image cannot be loaded, for example once the nation's website
	// no longer publishes the reviewed copy; the figure is then hidden.
	let imageFailed = $state(false);
</script>

<svelte:head>
	<title>{page.officialName} · Nations · Model Tribal ADR Code</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="small">
	<a href="/nations">Nations</a> › {page.officialName}
</nav>

<!--
	On wide screens the page has two columns: the text, held to a readable
	line length, and beside it "At a glance" with the map, set off by a rule.
	"At a glance" comes after the text in the page's order, so a selection in
	one column stays in it; on narrow screens it sits after Document history,
	before Sources.
-->
<span id={newTabNoteId} hidden>Opens in a new tab</span>
<article class="profile" {@attach outsideLinksOpenInNewTab}>
	<div class="profile-introduction">
		{#if page.example}
			<div class="notice" role="note">
				<p>
					<strong>This is a fictitious example.</strong> It describes no real nation. It shows how each
					nation’s page will be laid out once the records are published.
				</p>
			</div>
		{/if}

		<!-- 1. Name, with the nation's seal or logo when it may be shown (docs/official-images.md) -->
		<h1>{page.officialName}</h1>
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
		{#if !page.withdrawn}
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

		<!-- 2. Review status: a small badge and one line, not a panel (Trevor, Nov. 22, 2026) -->
		<p class="review-status small" id="review-status" data-print-part="reviewStatus">
			<span class="visually-hidden">Review status:</span>
			<span class="status-badge">{page.review.label}</span>
			<span class="muted">
				{page.review.meaning}{#if page.review.lastVerified}{' '}Sources last checked {page.review.lastVerified}.{/if}
			</span>
			<a class="no-print" href="/requests?record={record}">Is this about your nation? Make a request</a>
		</p>

		{#if !page.withdrawn && data.features.length > 0}
			<!-- 3. About this Nation: the recorded features. The placeholder for the
			     nation's own description was removed (Trevor, Nov. 22, 2026); the
			     description is shown once a nation writes or approves one. -->
			<Collapsible heading="About this Nation" identifier="about-heading">
				<ul>
					{#each data.features as feature, index (index)}
						<li>{feature.text}<CitationMarks marks={feature.citations} /></li>
					{/each}
				</ul>
			</Collapsible>
		{/if}
	</div>

	{#if !page.withdrawn}
		<div class="profile-details">
			<!-- 5. Courts and dispute resolution -->
			{#if data.courts.length > 0}
				<Collapsible heading="Courts and dispute resolution" identifier="courts-heading">
					<NationServices categories={data.courts} />
				</Collapsible>
			{/if}

			<!-- 6. Published dispute resolution law: linked, not reproduced -->
			{#if data.law.length > 0}
				<Collapsible heading="Published law" identifier="law-heading">
					<FactGroups groups={data.law} />
				</Collapsible>
			{/if}

			<!-- 7. Document history: every recorded version, oldest first (decision record 0018) -->
			{#if data.documents.length > 0}
				<div data-print-part="documentHistory">
				<Collapsible heading="Document history" identifier="documents-heading">
					<DocumentHistoryList documents={data.documents} />
				</Collapsible>
				</div>
			{/if}
		</div>

		<!--
			4. At a glance, with the map of states. It comes after the main text in
			the page's order, so selecting text in the main column never takes in
			the fact box (Trevor, Nov. 22, 2026); on wide pages it sits beside the
			text, set off by a rule.
		-->
		{#if data.glance.length > 0 || data.contacts.websites.length > 0 || data.contacts.offices.length > 0 || data.map}
			<aside class="profile-glance" aria-labelledby="glance-heading">
				<Collapsible heading="At a glance" identifier="glance-heading">
					{#if data.map}
						<StatePresenceMap map={data.map} nationName={page.officialName} />
					{/if}
					<FactGroups groups={data.glance} />
					{#if data.contacts.websites.length > 0 || data.contacts.offices.length > 0}
						<h3 id="contacts-heading">{contactsHeading}</h3>
						<ContactCard cards={data.contacts} headingLevel={4} />
					{/if}
				</Collapsible>
			</aside>
		{/if}


		<!-- 9. Sources -->
		<div class="profile-sources">
			<SourceList sources={data.sources} />
		</div>
	{/if}
</article>

<style>
	.review-status {
		margin: var(--space-3) 0 var(--space-5);
	}

	.status-badge {
		display: inline-block;
		margin-right: var(--space-2);
		padding: 0 var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		background: var(--color-surface);
		font-weight: var(--font-weight-semibold);
	}

	.nation-image {
		margin: var(--space-3) 0;
	}

	/* Seals are square and logos are often wide, so the box sets only the limits. */
	.nation-image img {
		display: block;
		width: auto;
		height: auto;
		max-width: min(18rem, 100%);
		max-height: 6rem;
	}

	.profile-introduction,
	.profile-details,
	.profile-sources,
	.profile-glance {
		max-width: var(--layout-measure);
	}

	/*
	 * Two columns once the page itself is wide enough. This follows the width
	 * of the page's own column (the layout makes <main> a size container), so
	 * it changes when the sidebar is shown or hidden, not only with the window.
	 */
	@container page (min-width: 62rem) {
		.profile {
			display: grid;
			grid-template-columns: minmax(0, var(--layout-measure)) minmax(22rem, 1fr);
			column-gap: var(--space-6);
			align-items: start;
		}

		.profile-introduction {
			grid-column: 1;
			grid-row: 1;
		}

		.profile-details {
			grid-column: 1;
			grid-row: 2;
		}

		.profile-sources {
			grid-column: 1;
			grid-row: 3;
		}

		/* A rule between the columns marks the fact box as its own region. */
		.profile-glance {
			grid-column: 2;
			grid-row: 1 / span 3;
			align-self: stretch;
			max-width: var(--layout-side-column);
			/* Lines up with the page's first heading. */
			margin-top: var(--space-5);
			padding-left: var(--space-6);
			border-left: 1px solid var(--color-line);
		}

		.profile-glance > :global(.collapsible) {
			margin-top: 0;
		}

		.profile-glance {
			container: glance / inline-size;
		}
	}

	/* In a narrow fact box, each label sits above its values. */
	@container glance (max-width: 30rem) {
		.profile-glance :global(.summary-list) {
			grid-template-columns: 1fr;
		}

		.profile-glance :global(.summary-list dt) {
			border-bottom: 0;
			padding-bottom: 0;
		}
	}

	@container glance (min-width: 30rem) {
		.profile-glance :global(.summary-list) {
			grid-template-columns: minmax(7rem, 11rem) 1fr;
		}
	}
</style>
