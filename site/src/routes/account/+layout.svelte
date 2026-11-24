<script lang="ts">
	// The Account pages: who you are to the project and what it keeps about
	// you, kept with your account (site/DESIGN.md, section 6, "Settings and
	// Account"). The left sidebar lists them under "Your account"
	// (src/lib/account-menu.ts). How the site looks on this screen is in
	// Settings, under the cog, instead.
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="reading">
	{@render children()}
</div>

<style>
	/* Each section of an account page is a card (design/settings-and-account). */
	.reading :global(.account-card) {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		padding: var(--space-4) var(--space-5);
		margin: 0 0 var(--space-4);
	}

	.reading :global(.account-card > h2) {
		margin-top: 0;
	}

	.reading :global(.account-card > :last-child) {
		margin-bottom: 0;
	}

	/* A card whose action cannot be undone. */
	.reading :global(.account-card.danger-card) {
		border: 1px dashed var(--color-danger);
	}

	.reading :global(.button-quiet.danger) {
		color: var(--color-danger);
		border-color: var(--color-danger);
	}
</style>
