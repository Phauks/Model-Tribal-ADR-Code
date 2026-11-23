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
