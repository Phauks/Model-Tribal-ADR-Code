<script lang="ts">
	// A page's own Changes view (Trevor, Nov. 27, 2026, option B of
	// design/page-changes-in-page): the page's breadcrumbs with "Changes" after
	// them, its title and, on a nation's page, its badges, then the list. The
	// side column stays the page's own, with "Changes to This Page" marked as
	// the place the reader is (SiteSidebar.svelte). Drawn for src/routes/[...address]/changes and src/routes/licenses/changes.
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import PageHistory from '#lib/components/PageHistory.svelte';
	import RecognitionBadges from '#lib/components/RecognitionBadges.svelte';
	import ReviewStatus from '#lib/components/ReviewStatus.svelte';
	import { unclaimedPage } from '#lib/review-status.ts';
	import type { PageChangesData } from '#lib/server/page-changes.ts';

	let { data }: { data: PageChangesData } = $props();
	const nation = $derived(data.nation);
</script>

<svelte:head>
	<title>Changes to {data.pageTitle} · Tribal Law Project</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Breadcrumbs trail={data.trail} current="Changes" />

<div class="page-changes-view">
	<h1>{data.pageTitle}</h1>
	{#if nation && !nation.withdrawn}
		<!-- The nation page's badge line, as on the page (src/routes/nations/[id]/+page.svelte); the
		     history badge is marked as the place the reader is. -->
		<div class="badge-line">
			{#if nation.badges.length > 0}<RecognitionBadges badges={nation.badges} explanations={nation.badgeExplanations} />{/if}
			{#if nation.claimedBadge}
				<!-- Written and escaped by the server (claimedBadge in src/lib/server/nation-page-overlay.ts). -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- written and escaped by the server -->
				{@html nation.claimedBadge}
			{:else}
				<ReviewStatus status={unclaimedPage} description="Who keeps this page:">
					<p class="no-print"><a href="/profile/nation-team?nation={nation.identifier}">Work for this nation? Claim this page</a></p>
				</ReviewStatus>
			{/if}
			{#if nation.historyBadge}
				<!-- Written and escaped by the server (historyBadge in src/lib/server/nation-page-overlay.ts). -->
				<span class="history-here">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- written and escaped by the server -->
					{@html nation.historyBadge}
				</span>
			{/if}
		</div>
	{/if}

	<PageHistory
		heading
		changes={data.changes}
		address={data.historyOf}
		kind={data.pageKind}
		pageOnSite={data.pageOnSite}
		recordedSince={data.recordedSince}
	/>
</div>

<style>
	h1 {
		margin-block-end: var(--space-3);
	}

	/* Without a badge line, the list keeps the same room below the title. */
	h1 + :global(.page-history) {
		margin-block-start: var(--space-5);
	}

	.badge-line {
		margin-block-end: var(--space-5);
	}

	/* The history badge is where the reader is, so it shows pressed (approved mockup B). */
	.history-here :global(summary.review-badge) {
		background: var(--color-ink);
		border-color: var(--color-ink);
		color: var(--color-paper);
	}
</style>
