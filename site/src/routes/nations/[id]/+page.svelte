<script lang="ts">
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import ContactCard from '#lib/components/ContactCard.svelte';
	import DocumentHistoryList from '#lib/components/DocumentHistoryList.svelte';
	import FactGroups from '#lib/components/FactGroups.svelte';
	import NationServices from '#lib/components/NationServices.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import NationMap from '#lib/components/NationMap.svelte';
	import { newTabNoteId, outsideLinksOpenInNewTab } from '#lib/new-tab-links.ts';
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
	On wide screens the page has two columns: the text, held to a readable
	line length, and beside it "At a glance" (the seal, key facts and map) and
	the contacts, set off by a rule (site/DESIGN.md, "Nation pages"). In the
	page's order "At a glance" comes right after the title, so on a narrow
	screen it comes first, and the main column's sections all follow it.
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

		<!-- 1. Name. The nation's seal or logo heads At a glance (docs/official-images.md). -->
		<h1>{page.officialName}</h1>
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

		<!-- 2. Review status: a small badge and one line, not a panel (Trevor, Nov. 22, 2026).
		     Report a problem in the masthead takes requests, so the line has no link of its own. -->
		<p class="review-status small" id="review-status" data-print-part="reviewStatus">
			<span class="visually-hidden">Review status:</span>
			<span class="status-badge"><Clock size={16} strokeWidth={2} aria-hidden="true" />{page.review.label}</span>
			<span class="muted">
				{page.review.meaning}{#if page.review.lastVerified}{' '}Sources checked {page.review.lastVerified}.{/if}
			</span>
		</p>
	</div>

	{#if !page.withdrawn}
		<!--
			3. At a glance, with the seal and the map, then the contacts. On wide
			pages it is the right-hand column, set off by a rule; in the page's
			order it comes right after the title, so on a phone the key facts come
			first. Selecting text in the main column never takes it in, because the
			main column's sections all follow it.
		-->
		{#if data.glance.length > 0 || data.map || hasContacts}
			<aside class="profile-glance" aria-label="At a glance">
				{#if data.glance.length > 0 || data.map}
					<div class="glance-box">
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
						<Collapsible heading="At a glance" identifier="glance-heading">
							<FactGroups groups={data.glance} />
							{#if data.map}
								<div class="glance-map">
									<NationMap map={data.map} nationName={page.officialName} />
								</div>
							{/if}
						</Collapsible>
					</div>
				{/if}
				{#if hasContacts}
					<Collapsible heading={contactsHeading} identifier="contacts-heading">
						<ContactCard cards={data.contacts} headingLevel={3} />
					</Collapsible>
				{/if}
			</aside>
		{/if}

		<div class="profile-details">
			<!-- 4. Courts and dispute resolution -->
			{#if data.courts.length > 0}
				<Collapsible heading="Courts and dispute resolution" identifier="courts-heading">
					<NationServices categories={data.courts} />
				</Collapsible>
			{/if}

			<!-- 5. Laws and agreements: where the nation publishes its laws, linked, not
			     reproduced, and each document with recorded versions, oldest first
			     (decision record 0018). -->
			{#if data.law.length > 0 || data.documents.length > 0}
				<div data-print-part="documentHistory">
					<Collapsible heading="Laws and agreements" identifier="law-heading">
						{#if data.law.length > 0}
							<FactGroups groups={data.law} />
						{/if}
						<DocumentHistoryList documents={data.documents} />
					</Collapsible>
				</div>
			{/if}

			<!-- 6. Jurisdiction: Public Law 280, Indian Child Welfare Act agents and the like -->
			{#if data.jurisdiction.length > 0}
				<Collapsible heading="Jurisdiction" identifier="jurisdiction-heading">
					<FactGroups groups={data.jurisdiction} />
				</Collapsible>
			{/if}
		</div>

		<!-- 7. Sources -->
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

	/* The fact box: a filled panel, like a reference work's, with the seal on top. */
	.glance-box {
		padding: var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface);
	}

	.glance-box > :global(.collapsible) {
		margin-top: 0;
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

	/*
	 * Sources is one of the page's folding sections, spaced like the others;
	 * the rule other pages draw above their notes would sit right under the
	 * last fact table's own line.
	 */
	.profile-sources :global(.notes) {
		margin-top: 0;
		padding-top: 0;
		border-top: 0;
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
			/* The last row takes any height the right-hand column needs beyond the text's. */
			grid-template-rows: auto auto 1fr;
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

		/* The fact box and contacts form the right-hand column. */
		.profile-glance {
			grid-column: 2;
			grid-row: 1 / span 3;
			max-width: var(--layout-side-column);
			/* Lines up with the page's title. */
			margin-top: var(--space-4);
		}

		.profile-glance > :global(.collapsible) {
			margin-top: 0;
		}

		.profile-glance {
			container: glance / inline-size;
		}
	}

	/* In a narrow fact box, each label sits above its values. */
	@container glance (max-width: 18rem) {
		.profile-glance :global(.summary-list) {
			grid-template-columns: 1fr;
		}

		.profile-glance :global(.summary-list dt) {
			border-bottom: 0;
			padding-bottom: 0;
		}
	}

	@container glance (min-width: 18rem) {
		.profile-glance :global(.summary-list) {
			grid-template-columns: minmax(6.5rem, 9rem) 1fr;
		}
	}
</style>
