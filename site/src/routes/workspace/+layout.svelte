<script lang="ts">
	// The workspace's pages are listed in the left sidebar, under "Workspace"
	// (src/lib/workspace-menu.ts), and who is signed in, with Sign out, is in
	// the masthead's account menu (src/lib/components/AccountLink.svelte).
	// Trevor asked for both on Nov. 22, 2026, in place of a bar across the top
	// of each workspace page.
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{@render children()}
