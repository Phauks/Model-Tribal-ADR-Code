<script lang="ts">
	// Tells the reader that a newer edition is ready and asks before using it
	// (site/DESIGN.md, section 10, "Updates"). A notice, not an alert: it does
	// not interrupt reading or take focus.
	import { onMount } from 'svelte';
	import { updated } from '$app/state';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { siteUpdates } from '#lib/site-updates.svelte.ts';
	import type { TrackVersions } from '#lib/server/versions.ts';

	let { versions }: { versions: TrackVersions } = $props();

	onMount(() => {
		void siteUpdates.start();
	});

	$effect(() => {
		if (updated.current) siteUpdates.newBuildSeen();
	});

	const available = $derived(siteUpdates.available);
	const contentChanged = $derived(available !== undefined && available.content !== versions.content);
</script>

{#if siteUpdates.waiting && !siteUpdates.dismissed}
	<div class="notice page-width update-notice no-print" role="note" aria-labelledby="update-heading">
		<p id="update-heading">
			<strong>An update to this site is ready.</strong>
			{#if available && contentChanged}
				It brings content version {available.content}; you are reading {versions.content}.
			{:else if available && available.site !== versions.site}
				It brings website version {available.site}; the content stays at {versions.content}.
			{:else}
				It brings changes to the website; the content stays at {versions.content}.
			{/if}
			Pages you keep for offline reading are saved again from the new version.
		</p>
		<p class="update-actions">
			<button class="button" type="button" onclick={() => siteUpdates.apply()}>
				<RefreshCw size={20} strokeWidth={1.75} />
				Update now
			</button>
			<a class="button button-quiet" href="/changelog">What changed</a>
			<button class="button button-quiet" type="button" onclick={() => siteUpdates.later()}>
				Later
			</button>
		</p>
	</div>
{/if}

{#if siteUpdates.resaving}
	<div class="notice page-width no-print" role="status">
		<p>
			Saving the latest copies of the pages you keep: {siteUpdates.resaving.done} of {siteUpdates
				.resaving.total} files.
		</p>
	</div>
{/if}

<style>
	.update-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.update-actions .button {
		gap: var(--space-2);
	}
</style>
