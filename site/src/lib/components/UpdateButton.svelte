<script lang="ts">
	// Says that a newer edition is ready, from the masthead rather than a card
	// over the page (site/DESIGN.md, section 10, "Updates"). Trevor asked on
	// Nov. 27, 2026 for the update notice to live in the header, so it never
	// covers the page and its list of changes can grow. The button shows only
	// while an update waits, with the number of changes in a badge; it opens a
	// panel with what the update brings, every change since the build this
	// page runs, grouped by day, and "Update now" and "What changed". Closing
	// the panel is "later": the button stays until the reader updates or the
	// browser applies the update by itself once every tab of the site has
	// closed.
	//
	// The panel is a native popover, as Page settings is: Escape or a click
	// outside closes it. On phones the button stays in the masthead's row, not
	// in More, and the panel opens across the screen under the masthead.
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import { version } from '$app/env';
	import { newestChange } from 'virtual:build-change';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { buildTime } from '#lib/offline-collections.ts';
	import { changesByDay, changesSince, reachesBack } from '#lib/recent-changes.ts';
	import { siteUpdates } from '#lib/site-updates.svelte.ts';
	import type { TrackVersions } from '#lib/server/versions.ts';

	let { versions }: { versions: TrackVersions } = $props();

	let button: HTMLButtonElement | undefined = $state();
	let panel: HTMLDivElement | undefined = $state();

	/** What this page's build already has: its newest pull request, and when it was built. */
	const point = { newest: newestChange ?? undefined, built: buildTime(version) };
	const available = $derived(siteUpdates.available);
	const contentChanged = $derived(available !== undefined && available.content !== versions.content);
	/** Every pull request merged since the build this page runs (Trevor, Nov. 27, 2026). */
	const changes = $derived(changesSince(available?.changes, point));
	/** Grouped by the day they were merged, when they span more than one. */
	const days = $derived(changesByDay(changes));
	/** False when the list may not reach back to this page's build, so earlier changes may be missing. */
	const complete = $derived(reachesBack(available?.changes, point));
	const firstListed = $derived(days.at(-1)?.label);
	/** Whether the update changes the page being read, when both builds' fingerprints could be read. */
	const pageChange = $derived(siteUpdates.changeTo(page.url.pathname));
	const label = $derived(
		changes.length > 0 ? `Update ready: ${changes.length} ${changes.length === 1 ? 'change' : 'changes'}` : 'Update ready'
	);

	/** Puts the panel under the button, its right edge on the button's, on wider screens; phones place it with CSS. */
	function place() {
		if (!panel || !button) return;
		const box = button.getBoundingClientRect();
		if (box.width === 0) return;
		panel.style.setProperty('--panel-top', `${box.bottom + 8}px`);
		panel.style.setProperty('--panel-right', `${Math.max(8, document.documentElement.clientWidth - box.right)}px`);
	}

	async function toggled(event: ToggleEvent) {
		if (event.newState !== 'open') return;
		await tick();
		panel?.focus();
	}
</script>

{#if siteUpdates.waiting}
	<button
		bind:this={button}
		class="icon-button update-button"
		type="button"
		popovertarget="site-update"
		aria-label={label}
		title={label}
		onclick={place}
	>
		<RefreshCw size={24} aria-hidden="true" />
		{#if changes.length > 0}
			<span class="update-count" aria-hidden="true">{changes.length > 99 ? '99+' : changes.length}</span>
		{/if}
	</button>
	<div
		bind:this={panel}
		id="site-update"
		class="update-panel"
		popover="auto"
		tabindex="-1"
		role="dialog"
		aria-labelledby="site-update-heading"
		ontoggle={toggled}
	>
		<p id="site-update-heading" class="update-heading">An update to this site is ready</p>
		<p>
			{#if available && contentChanged}
				It brings content version {available.content}; you are reading {versions.content}.
			{:else if available && available.site !== versions.site}
				It brings website version {available.site}; the content stays at {versions.content}.
			{:else}
				It brings changes to the website; the content stays at {versions.content}.
			{/if}
			{#if pageChange === 'changed'}
				It changes the page you are reading.
			{:else if pageChange === 'unchanged'}
				It does not change the page you are reading.
			{:else if pageChange === 'removed'}
				It removes the page you are reading.
			{/if}
		</p>
		{#if changes.length > 0}
			<p class="changes-heading" id="site-update-changes">
				{changes.length === 1 ? 'The change' : `The ${changes.length} changes`}
			</p>
			<!-- Scrolls when long; focusable so the keyboard can scroll it. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div class="changes" role="region" aria-labelledby="site-update-changes" tabindex="0">
				{#each days as group (group.day)}
					{#if days.length > 1}
						<p class="change-day" id="site-update-day-{group.day}">{group.label}</p>
					{/if}
					<ul aria-labelledby={days.length > 1 ? `site-update-day-${group.day}` : 'site-update-changes'}>
						{#each group.changes as change (change.number)}
							<li><span class="change-number">#{change.number}</span> {change.title}</li>
						{/each}
					</ul>
				{/each}
				{#if !complete}
					<p class="changes-missing">Changes merged before {firstListed} are not listed.</p>
				{/if}
			</div>
		{/if}
		<p class="update-note">Pages saved on this device carry over; only the ones that changed are downloaded again.</p>
		<p class="update-actions">
			<button class="button" type="button" onclick={() => siteUpdates.apply()}>
				<RefreshCw size={20} strokeWidth={1.75} aria-hidden="true" />
				Update now
			</button>
			<a class="button button-quiet" href="/changelog">What changed</a>
		</p>
	</div>
{/if}

<style>
	.update-button {
		position: relative;
	}

	/* While the panel is open, the button shows in the band's colors reversed, as the cog does. */
	.update-button:has(+ .update-panel:popover-open) {
		background: var(--color-band-text);
		color: var(--color-band);
	}

	/* The number of changes, in the action color of "Update now", on the icon's top right corner. */
	.update-count {
		position: absolute;
		top: 2px;
		right: 0;
		min-width: 1.25rem;
		padding: 0 0.3rem;
		box-sizing: border-box;
		border: 2px solid var(--color-band);
		border-radius: 999px;
		background: var(--color-action);
		color: var(--color-action-text);
		font-size: 0.6875rem;
		font-weight: var(--font-weight-semibold);
		font-variant-numeric: tabular-nums;
		line-height: 1.1rem;
		text-align: center;
		pointer-events: none;
	}

	.update-panel {
		position: fixed;
		inset: var(--panel-top, 3.5rem) var(--panel-right, var(--space-2)) auto auto;
		width: min(var(--layout-popover-form), calc(100vw - 2 * var(--space-2)));
		max-height: min(36rem, calc(100dvh - var(--panel-top, 3.5rem) - var(--space-3)));
		box-sizing: border-box;
		margin: 0;
		padding: var(--space-4);
		flex-direction: column;
		background: var(--color-surface-raised);
		color: var(--color-ink);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel);
		box-shadow: 0 var(--space-2) var(--space-5) color-mix(in srgb, var(--color-ink) 25%, transparent);
		font-size: var(--font-size-small);
		text-align: left;
	}

	.update-panel:popover-open {
		display: flex;
	}

	.update-panel:not(:popover-open) {
		display: none;
	}

	.update-panel:focus:not(:focus-visible) {
		outline: none;
	}

	.update-panel p {
		margin: 0 0 var(--space-3);
	}

	.update-panel .update-heading {
		margin-bottom: var(--space-1);
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-body);
	}

	.update-panel .changes-heading {
		margin-bottom: var(--space-1);
		font-weight: var(--font-weight-semibold);
	}

	/* The list takes the room left in the panel and scrolls, so the buttons stay in view. */
	.changes {
		flex: 0 1 auto;
		min-height: 6rem;
		overflow-y: auto;
		overscroll-behavior: contain;
		margin: 0 0 var(--space-3);
		padding: var(--space-2) var(--space-2) var(--space-2) 0;
		border-block: 1px solid var(--color-line);
	}

	.changes:focus-visible {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 2px;
	}

	.changes ul {
		margin: 0;
		padding-left: var(--space-4);
	}

	.changes li {
		margin: 0;
	}

	.update-panel .changes .change-day {
		margin: var(--space-2) 0 0;
		font-weight: var(--font-weight-semibold);
	}

	.update-panel .changes .change-day:first-child {
		margin-top: 0;
	}

	.update-panel .changes .changes-missing {
		margin: var(--space-2) 0 0;
		color: var(--color-ink-muted);
	}

	.change-number {
		font-variant-numeric: tabular-nums;
		color: var(--color-ink-muted);
	}

	.update-panel .update-note {
		color: var(--color-ink-muted);
	}

	.update-panel .update-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin: 0;
	}

	.update-actions .button {
		gap: var(--space-2);
	}

	/* Phones: under the one-row masthead, across the screen. */
	@media (max-width: 40rem) {
		.update-panel {
			inset: 3.5rem var(--space-2) auto;
			width: auto;
			max-height: calc(100dvh - 4rem);
		}
	}
</style>
