<script lang="ts">
	// For someone on a nation's team, a banner at the top of the nation's page,
	// "You can edit this page for the Navajo Nation.", with "Your nation's team"
	// and "Edit this page", and an Edit link on each part their place covers
	// (design/nation-editors, screen 2, approved by Trevor on Nov. 23, 2026).
	// Nation pages are built ahead of time and the same for every reader, so the
	// page asks who is reading after it loads (/profile/nation-team/place.json),
	// and only when the signed-in hint says someone is signed in. The Edit links
	// are already in the page, hidden; the attribute set here on the root shows
	// the ones for the person's parts (site/src/lib/styles/global.css).
	import Landmark from '@lucide/svelte/icons/landmark';
	import Pencil from '@lucide/svelte/icons/pencil';
	import { atLeastTeamLevel, pageParts, type PagePart, type TeamLevel } from '#lib/nation-teams.ts';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';

	let { nation }: { nation: string } = $props();

	let place = $state<{ nation: string; level: TeamLevel; parts: PagePart[] | null } | null>(null);

	const writes = $derived(place !== null && atLeastTeamLevel(place.level, 'drafter'));
	const publishes = $derived(place !== null && atLeastTeamLevel(place.level, 'editor'));
	const name = $derived(place ? (/^the\s/i.test(place.nation) ? place.nation : `the ${place.nation}`) : '');

	$effect(() => {
		const identifier = nation;
		place = null;
		if (!readSignedInHint(document.cookie).signedIn) return;
		let current = true;
		fetch(`/profile/nation-team/place.json?nation=${encodeURIComponent(identifier)}`, { headers: { accept: 'application/json' } })
			.then((response) => (response.ok ? response.json() : { place: null }))
			.then((answer: { place: typeof place }) => {
				if (current) place = answer.place;
			})
			.catch(() => {
				// Offline or signed out: the page is shown as to any reader.
			});
		return () => {
			current = false;
		};
	});

	$effect(() => {
		const root = document.documentElement;
		if (place && writes) root.dataset.nationEdit = (place.parts ?? pageParts).join(' ');
		else delete root.dataset.nationEdit;
		return () => {
			delete root.dataset.nationEdit;
		};
	});
</script>

{#if place}
	<div class="editor-banner no-print" role="region" aria-label="Your nation’s team">
		<Landmark size={20} aria-hidden="true" />
		<p>
			{#if publishes}
				<strong>You can edit this page for {name}.</strong> Changes go live as soon as you publish them.
			{:else if writes}
				<strong>You can write changes to this page for {name}.</strong> An editor or steward publishes them.
			{:else}
				<strong>You review this page for {name}.</strong>
			{/if}
		</p>
		<span class="actions">
			<a class="button button-quiet" href="/workspace/nation-teams/{nation}">Your nation’s team</a>
			{#if writes}
				<a class="button" href="/workspace/nation-teams/{nation}/edit"><Pencil size={18} aria-hidden="true" />Edit this page</a>
			{/if}
		</span>
	</div>
{/if}

<style>
	.editor-banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin: 0 0 var(--space-4);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-notice-background);
		color: var(--color-ink);
	}

	.editor-banner > :global(svg) {
		flex: none;
		color: var(--color-link);
	}

	.editor-banner p {
		flex: 1 1 18rem;
		margin: 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.actions .button {
		gap: var(--space-2);
		min-height: auto;
		padding: var(--space-1) var(--space-3);
	}

	.actions .button-quiet {
		border-color: var(--color-link);
		background: var(--color-surface-raised);
		color: var(--color-link);
	}
</style>
