<!--
	@component
	One removal's page (Trevor approved the v2 mockups on Nov. 28, 2026, design/removals-page), on the site's one item layout (InfoPage.svelte): the kind of move, whether the move itself is on record, and the review status; what happened in a sentence; Key facts with the journey alone on a small map; then the record in three parts, the order, the move and the force, each record dated, said in a plain sentence and quoted verbatim with its citation; the nation's own account, linked and never quoted; and References.
-->
<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import { onMount } from 'svelte';
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import ReviewStatus from '#lib/components/ReviewStatus.svelte';
	import TileMap from '#lib/components/TileMap.svelte';
	import { journeyBounds, journeyYears, moveLabel, namesInWords, removalMoves } from '#lib/removal-journeys.ts';
	import { nationVerification } from '#lib/review-status.ts';
	import type { RemovalEvidence } from '#lib/server/removals.ts';
	import { closeStatusPopovers } from '#lib/status-popovers.ts';
	import RemovalArrowMark from '../RemovalArrowMark.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	onMount(closeStatusPopovers);

	const journey = $derived(data.journey);
	const years = $derived(journeyYears(journey.years));
	const title = $derived(`${journey.people} removal (${years})`);
	const kind = $derived(removalMoves.find((entry) => entry.value === journey.move));

	const glance = $derived([
		{ field: 'people', label: 'People', items: [{ text: journey.peopleFull }] },
		{ field: 'years', label: 'Years', items: [{ text: years }] },
		{ field: 'move', label: 'Kind of move', items: [{ text: moveLabel(journey.move), detail: `Record ${journey.record}` }] },
		{ field: 'from', label: 'From', items: [{ text: journey.fromDescription }] },
		{ field: 'to', label: 'To', items: [{ text: journey.toDescription }] },
		{
			field: 'ordered',
			label: 'Ordered by',
			items:
				journey.orderedBy.length > 0
					? journey.orderedBy.map((order) => (order.link && order.name ? { text: order.name, link: order.link, after: `, ${order.citation}` } : { text: order.name ? `${order.name}, ${order.citation}` : order.citation }))
					: [{ text: journey.orderedOtherwise }]
		},
		{ field: 'nations', label: 'Nations today', items: journey.nations.length > 0 ? journey.nations.map((nation) => ({ text: nation.name, link: `/nations/${nation.id}` })) : [{ text: 'None Identified' }] }
	]);

	const trail = [
		{ label: 'Nations', href: '/nations' },
		{ label: 'Removals', href: '/nations/removals' }
	];

	const parts = $derived([
		{ heading: 'The order', identifier: 'the-order', items: data.order },
		{ heading: 'The move', identifier: 'the-move', items: data.move },
		{ heading: 'The force', identifier: 'the-force', items: data.force }
	]);
</script>

<svelte:head>
	<title>{title} · Removals · Tribal Law Project</title>
	<meta name="description" content="{title}: from {namesInWords(journey.from)} to {journey.to}. The record of the order, the move and the force." />
</svelte:head>

<!-- The journey alone, fitted to its arrows, under Key facts, as a treaty's page draws the land it ceded. -->
{#snippet journeyMap()}
	{#if journey.arrows.length > 0 || journey.origin}
		<!-- Where the land sent to has no place on the map, such as Texas when it was outside the United States, the map shows the land left alone. -->
		<div class="journey-map no-print">
			<TileMap
				view="lands"
				label={journey.arrows.length > 0 ? `${title}: from the land left to the land sent to` : `${title}: the land left`}
				data={data.map}
				opening={journey.arrows.length > 0 ? journeyBounds(journey.arrows) : journeyBounds([{ from: journey.origin!, to: journey.origin!, years: journey.years }], 1.6)}
				journeys={journey.arrows.length > 0 ? { lines: [journey] } : undefined}
			/>
		</div>
	{/if}
{/snippet}

{#snippet status()}
	<div class="status-badges">
		<details class="status-popover">
			<summary class="review-badge"><span class="visually-hidden">Kind of move:</span>{moveLabel(journey.move)}<ChevronDown class="status-popover-mark" size={14} strokeWidth={2} aria-hidden="true" /></summary>
			<div class="status-panel">
				<p><strong>{moveLabel(journey.move)}.</strong> {kind?.meaning}.</p>
				<p><a href="/nations/removals">Every kind of move</a></p>
			</div>
		</details>
		{#if journey.arrow !== 'not carried out'}
			<details class="status-popover">
				<summary class="review-badge"
					><span class="visually-hidden">The move itself:</span><RemovalArrowMark style={journey.arrow === 'solid' ? 'solid' : 'dashed'} />{journey.arrow === 'solid' ? 'Move on record' : 'Move not yet found'}<ChevronDown
						class="status-popover-mark"
						size={14}
						strokeWidth={2}
						aria-hidden="true"
					/></summary
				>
				<div class="status-panel">
					{#if journey.arrow === 'solid'}
						<p><strong>Move on record.</strong> The record shows the nation was moved, not only ordered to move. The map draws a solid arrow.</p>
					{:else}
						<p><strong>Move not yet found.</strong> The order is on record; a record of the move itself has not yet been found. The map draws a dashed arrow.</p>
					{/if}
				</div>
			</details>
		{/if}
		<ReviewStatus status={nationVerification(undefined)} description="Review by the nations:">
			<p><strong>Unverified.</strong> The nations whose removal this page shows have not reviewed it yet.</p>
		</ReviewStatus>
	</div>
	<p class="summary">{journey.summary}</p>
{/snippet}

{#snippet evidence(items: RemovalEvidence[])}
	{#if items.length > 0}
		<ul class="evidence-list">
			{#each items as item, index (index)}
				<li>
					<p class="evidence-line"><span class="evidence-when">{item.date}</span>{item.sentence}<CitationMarks marks={item.marks} /></p>
					{#if item.quote}
						<blockquote class="evidence-words">
							<p>{item.quote}</p>
							<footer class="small muted">{item.citation}</footer>
						</blockquote>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="none-identified muted">None Identified</p>
	{/if}
{/snippet}

<InfoPage {title} lead="From {namesInWords(journey.from)} to {journey.to}" {glance} panels={journeyMap} sources={data.sources} {trail} {status}>
	{#each parts as part (part.identifier)}
		<Collapsible heading={part.heading} identifier={part.identifier} count={part.items.length || undefined}>
			{@render evidence(part.items)}
		</Collapsible>
	{/each}

	<Collapsible heading="The nation’s own account" identifier="nations-account" count={data.accounts.length || undefined}>
		{#if data.accounts.length > 0}
			<ul class="accounts">
				{#each data.accounts as account (account.url)}
					<li>
						<p class="account-title"><a href={account.url}>{account.title}</a><ExternalLink class="external-icon" size={14} strokeWidth={1.75} aria-hidden="true" /></p>
						{#if account.detail}<p class="small muted account-detail">{account.detail}</p>{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="none-identified muted">None Identified</p>
		{/if}
	</Collapsible>
</InfoPage>

<style>
	.journey-map {
		margin-top: var(--space-3);
	}

	/* The map draws the journey only with scripts; Key facts says it in words. */
	:global(html:not([data-scripts='on'])) .journey-map {
		display: none;
	}

	.status-badges {
		margin: var(--space-1) 0 var(--space-4);
	}

	.status-badges :global(.arrow-mark) {
		width: 30px;
		height: 12px;
	}

	.summary {
		max-width: 40rem;
		margin: 0 0 var(--space-4);
	}

	.evidence-list,
	.accounts {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.evidence-list > li {
		margin: 0 0 var(--space-5);
		padding: 0 0 var(--space-5);
		border-bottom: 1px solid var(--color-line);
	}

	.evidence-list > li:last-child {
		margin-bottom: 0;
		border-bottom: 0;
	}

	.evidence-line {
		margin: 0;
	}

	.evidence-when {
		margin-right: var(--space-2);
		font-weight: var(--font-weight-bold, 700);
	}

	.evidence-words {
		margin: var(--space-3) 0 0;
	}

	.evidence-words p {
		margin: 0;
	}

	.evidence-words footer {
		margin-top: var(--space-1);
	}

	.accounts li {
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--color-line);
	}

	.accounts p {
		margin: 0;
	}

	.account-title {
		font-weight: var(--font-weight-semibold);
	}

	.account-title :global(.external-icon) {
		margin-left: var(--space-1);
		vertical-align: -0.1em;
	}

	.account-detail {
		margin-top: var(--space-1);
	}

	.none-identified {
		margin: var(--space-1) 0 0;
	}
</style>
