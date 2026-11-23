<script lang="ts">
	// Tells the reader that a newer edition is ready and asks before using it
	// (site/DESIGN.md, section 10, "Updates"). A small card fixed at the
	// bottom left of the window, not a block in the page, as Trevor asked on
	// Nov. 22, 2026. A notice, not an alert: it does not interrupt reading or
	// take focus.
	import { onMount } from 'svelte';
	import { page, updated } from '$app/state';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { version } from '$app/env';
	import { buildTime } from '#lib/offline-collections.ts';
	import { changesSince } from '#lib/recent-changes.ts';
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
	/** The pull requests merged since the build this page runs, so the reader sees what the update applies. */
	const changes = $derived(changesSince(available?.changes, buildTime(version)));
	/** Whether the update changes the page being read, when both builds' fingerprints could be read. */
	const pageChange = $derived(siteUpdates.changeTo(page.url.pathname));
	const shownChanges = 8;
</script>

<div class="update-toasts no-print">
	{#if siteUpdates.waiting && !siteUpdates.dismissed}
		<div class="notice update-toast" role="note" aria-labelledby="update-heading">
			<p id="update-heading">
				<strong>An update to this site is ready.</strong>
				{#if available && contentChanged}
					It brings content version {available.content}; you are reading {versions.content}.
				{:else if available && available.site !== versions.site}
					It brings website version {available.site}; the content stays at {versions.content}.
				{:else}
					It brings changes to the website; the content stays at {versions.content}.
				{/if}
				Pages saved on this device carry over, and only the ones that changed are downloaded again.
			</p>
			{#if pageChange === 'changed'}
				<p>This update changes the page you are reading.</p>
			{:else if pageChange === 'unchanged'}
				<p>This update does not change the page you are reading.</p>
			{:else if pageChange === 'removed'}
				<p>This update removes the page you are reading.</p>
			{/if}
			{#if changes.length > 0}
				<p class="changes-heading" id="update-changes">
					It applies {changes.length === 1 ? 'this change' : `these ${changes.length} changes`}:
				</p>
				<ul class="changes" aria-labelledby="update-changes">
					{#each changes.slice(0, shownChanges) as change (change.number)}
						<li><span class="change-number">#{change.number}</span> {change.title}</li>
					{/each}
					{#if changes.length > shownChanges}
						<li>and {changes.length - shownChanges} more</li>
					{/if}
				</ul>
			{/if}
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
		<div class="notice update-toast" role="status">
			<p>
				Saving the latest copies of the pages you keep: {siteUpdates.resaving.done} of {siteUpdates
					.resaving.total} files.
			</p>
		</div>
	{/if}
</div>

<style>
	/* Fixed to the bottom left, above the page; on a phone it spans the width less the side gutters. */
	.update-toasts {
		position: fixed;
		left: var(--space-4);
		bottom: var(--space-4);
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: min(var(--layout-popover), calc(100% - 2 * var(--space-4)));
		pointer-events: none;
	}

	.update-toast {
		pointer-events: auto;
		margin: 0;
		border: 2px solid var(--color-control-border);
		border-left-width: 6px;
		border-left-color: var(--color-link);
		font-size: var(--font-size-small);
	}

	.update-toast p:not(:last-child) {
		margin: 0 0 var(--space-3);
	}

	.update-toast .changes-heading {
		margin-bottom: var(--space-1);
	}

	.changes {
		margin: 0 0 var(--space-3);
		padding-left: var(--space-4);
	}

	.changes li {
		margin: 0;
	}

	.change-number {
		font-variant-numeric: tabular-nums;
		color: var(--color-ink-muted);
	}

	.update-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.update-actions .button {
		gap: var(--space-2);
	}
</style>
