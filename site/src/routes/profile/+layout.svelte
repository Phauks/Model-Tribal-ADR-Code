<script lang="ts">
	// Who is signed in, Password and Sign out are in the masthead's account
	// menu (src/lib/components/AccountLink.svelte), as Trevor asked on Nov. 22,
	// 2026, in place of a bar across the top of each profile page.
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="reading">
	{@render children()}
</div>
