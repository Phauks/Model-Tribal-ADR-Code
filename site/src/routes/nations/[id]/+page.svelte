<script lang="ts">
	import DocumentHistoryList from '#lib/components/DocumentHistoryList.svelte';
	import FactGroups from '#lib/components/FactGroups.svelte';
	import PageTools from '#lib/components/PageTools.svelte';
	import ReportLink from '#lib/components/ReportLink.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import StatePresenceMap from '#lib/components/StatePresenceMap.svelte';
	import { newTabNoteId, outsideLinksOpenInNewTab } from '#lib/new-tab-links.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const page = $derived(data.page);
	const record = $derived(`tribes/${data.page.id}`);
	// Set when the image cannot be loaded, for example once the nation's website
	// no longer publishes the reviewed copy; the figure is then hidden.
	let imageFailed = $state(false);
	const removalRequest = $derived(
		`/requests?${new URLSearchParams({ kind: 'remove', record, field: 'official_images' })
			.toString()
			.replaceAll('%2F', '/')}`
	);
</script>

<svelte:head>
	<title>{page.officialName} · Nations · Model Tribal ADR Code</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="small">
	<a href="/nations">Nations</a> › {page.officialName}
</nav>

<!--
	On wide screens the page has two columns: the text, held to a readable
	line length, and beside it "At a glance" with the map. On narrow screens
	the parts stack in the order of site/DESIGN.md, "Nation pages".
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
				<figcaption class="small muted">
					{data.image.kind} of {page.officialName}, as
					{#if data.image.foundOn}<a href={data.image.foundOn}>the nation’s website</a
						>{:else}the nation’s website{/if} publishes it. It belongs to the nation, which does
					not endorse this project.
					<a class="no-print" href={removalRequest}>Ask for it to be removed</a>.
				</figcaption>
			</figure>
		{/if}
		{#if !page.withdrawn}
			<p class="small muted">Name as the recognizing list gives it.</p>
			{#each data.selfDesignations as designation (designation.name)}
				<p class="lead" lang={designation.languageTag}>{designation.name}</p>
			{/each}
			<!-- Pronunciation: copied from the cited source, never worked out from the spelling -->
			{#each data.pronunciations as entry, index (index)}
				<p>
					<span class="muted">How to say</span>
					<span lang={entry.languageTag}>{entry.name}</span>:
					{#if entry.respelling}{entry.respelling}{/if}
					{#if entry.phoneticTranscription}/{entry.phoneticTranscription}/{/if}
					{#if entry.recording}<a href={entry.recording}>Listen to the recording</a>{/if}
				</p>
			{/each}
		{/if}
		<ReportLink {record} />
		<PageTools
			downloads={[{ label: 'Download this record', format: 'JSON', link: `/nations/${page.id}/record.json` }]}
		/>

		<!-- 2. Review panel -->
		<section class="panel panel-filled" aria-labelledby="review-heading" data-print-part="reviewStatus">
			<h2 id="review-heading">Review status: {page.review.label}</h2>
			<p>{page.review.meaning}</p>
			{#if page.review.lastVerified}
				<p class="small muted">Sources last checked {page.review.lastVerified}.</p>
			{/if}
			<p class="no-print">
				<a class="button" href="/requests?record={record}">Is this about your nation? Make a request</a>
			</p>
		</section>

		{#if !page.withdrawn}
			<!-- 3. What is distinctive here -->
			<section aria-labelledby="distinctive-heading">
				<h2 id="distinctive-heading">What is distinctive here</h2>
				<h3>In the nation’s own words</h3>
				<p class="muted">
					This space is for a short description that the nation writes or approves. The project does not
					write it for the nation.
					<a href="/requests?kind=contribute&record={record}">Contribute a description</a>.
				</p>
				{#if data.features.length > 0}
					<h3>Recorded features</h3>
					<ul>
						{#each data.features as feature, index (index)}
							<li>{feature.text}</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	</div>

	{#if !page.withdrawn}
		<!-- 4. At a glance, with the map of states -->
		{#if data.glance.length > 0 || data.map}
			<section class="profile-glance" aria-labelledby="glance-heading">
				<h2 id="glance-heading">At a glance</h2>
				{#if data.map}
					<StatePresenceMap map={data.map} nationName={page.officialName} />
				{/if}
				<FactGroups groups={data.glance} />
			</section>
		{/if}

		<div class="profile-details">
			<!-- 5. Courts and dispute resolution -->
			{#if data.courts.length > 0}
				<h2>Courts and dispute resolution</h2>
				<FactGroups groups={data.courts} />
			{/if}

			<!-- 6. Published dispute resolution law: linked, not reproduced -->
			{#if data.law.length > 0}
				<h2>Published law</h2>
				<p class="small muted">
					Laws are linked, not reproduced, until the nation permits more.
				</p>
				<FactGroups groups={data.law} />
			{/if}

			<!-- 7. Document history: every recorded version, oldest first (decision record 0018) -->
			{#if data.documents.length > 0}
				<div data-print-part="documentHistory">
					<h2>Document history</h2>
					<p class="small muted">
						Each document below lists every version the project has found, what each version did to
						the ones before it, and how its key clauses changed.
					</p>
					<DocumentHistoryList documents={data.documents} />
				</div>
			{/if}

			<!-- 9. Sources -->
			<p class="no-print">
				Know of a published source we have missed?
				<a href="/requests?kind=contribute&record={record}">Add it</a>.
			</p>
			<SourceList sources={data.sources} />
		</div>
	{/if}
</article>

<style>
	.nation-image {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		margin: var(--space-3) 0;
	}

	.nation-image img {
		flex: none;
		width: 6rem;
		height: 6rem;
		object-fit: contain;
	}

	.nation-image figcaption {
		margin: 0;
	}

	.profile-introduction,
	.profile-details,
	.profile-glance {
		max-width: var(--layout-measure);
	}

	@media (min-width: 64rem) {
		.profile {
			display: grid;
			grid-template-columns: minmax(0, var(--layout-measure)) minmax(22rem, 1fr);
			column-gap: var(--space-7);
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

		.profile-glance {
			grid-column: 2;
			grid-row: 1 / span 2;
			max-width: var(--layout-side-column);
			/* Lines up with the page's first heading. */
			margin-top: var(--space-5);
		}

		.profile-glance > h2 {
			margin-top: 0;
		}

		.profile-glance {
			container-type: inline-size;
		}
	}

	/* In a narrow fact box, each label sits above its values. */
	@container (max-width: 30rem) {
		.profile-glance :global(.summary-list) {
			grid-template-columns: 1fr;
		}

		.profile-glance :global(.summary-list dt) {
			border-bottom: 0;
			padding-bottom: 0;
		}
	}

	@container (min-width: 30rem) {
		.profile-glance :global(.summary-list) {
			grid-template-columns: minmax(7rem, 11rem) 1fr;
		}
	}
</style>
