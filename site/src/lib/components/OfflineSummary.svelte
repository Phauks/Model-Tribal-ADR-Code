<script lang="ts">
	// What is saved for offline reading at a glance (site/DESIGN.md, section 10): the space the site uses on this device,
	// what the reader chose to save, and whether it is up to date, with the check and the update. Shown at the top of
	// the Read offline page (/offline), where the outline to choose from sits below it, and in Settings > This device,
	// with a link to that page (Trevor, Nov. 26, 2026: the outline needs more room than Settings has).
	import Check from '@lucide/svelte/icons/check';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { formatBytes } from '#lib/offline-collections.ts';
	import { countOf, type OfflineView } from '#lib/offline-choices.ts';

	let {
		view,
		manageLink,
		headingLevel = 2,
		oncheck,
		onupdate,
		onkeepstorage
	}: {
		view: OfflineView;
		/** In Settings: where the reader chooses what to save. */
		manageLink?: string;
		headingLevel?: 2 | 3 | 4 | 5;
		oncheck?: () => void;
		onupdate?: () => void;
		onkeepstorage?: () => void;
	} = $props();

	const parts = $derived(view.catalog?.parts ?? []);
	// Documents are counted on their own rows in the outline; the pages here are pages of the site.
	const chosenPages = $derived(parts.filter((part) => part.unit !== 'document').reduce((total, part) => total + (view.nodes[part.key]?.chosen ?? 0), 0));
	const chosenBytes = $derived(parts.reduce((total, part) => total + (view.nodes[part.key]?.bytes ?? 0), 0));

	const heading = $derived(`h${headingLevel}`);

	function timeOf(date: Date): string {
		return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}
</script>

<div class="offline-summary">
	<section class="card" aria-labelledby="summary-space">
		<svelte:element this={heading} class="card-title" id="summary-space">On this device</svelte:element>
		<p class="figure">{view.storage.usedBytes === undefined ? 'Not known' : formatBytes(view.storage.usedBytes)}</p>
		<p class="hint">
			{formatBytes(chosenBytes)} saved by you, {formatBytes(view.read.bytes)} as you read
		</p>
		{#if view.storage.persisted === false}
			<button class="button button-quiet" type="button" onclick={() => onkeepstorage?.()} title="Ask the browser to keep saved files when the device runs low on space">Keep when space runs low</button>
		{:else if view.storage.persisted === true}
			<p class="hint">Kept when the device runs low on space.</p>
		{/if}
	</section>

	<section class="card" aria-labelledby="summary-chosen">
		<svelte:element this={heading} class="card-title" id="summary-chosen">Saved by you</svelte:element>
		<p class="figure">{chosenPages === 0 ? 'Nothing yet' : countOf(chosenPages)}</p>
		{#if manageLink}
			<a class="button" href={manageLink}>Choose what to save</a>
		{:else}
			<p class="hint">Tick parts, groups or pages below, or use the save icon at the top of any page.</p>
		{/if}
	</section>

	<section class="card" class:attention={view.update.waiting} aria-labelledby="summary-updates">
		<svelte:element this={heading} class="card-title" id="summary-updates">Updates</svelte:element>
		{#if view.update.waiting}
			<p class="figure">{countOf(view.update.waiting.changedPages)} change</p>
			<p class="hint">Only those, about {formatBytes(view.update.waiting.bytes)}, are downloaded again.</p>
			<button class="button" type="button" disabled={!view.online} onclick={() => onupdate?.()}>Update now</button>
		{:else}
			<p class="figure">
				{#if view.update.checking}Checking…{:else}<Check size={22} aria-hidden="true" /> Up to date{/if}
			</p>
			<p class="checked hint">
				{#if view.update.checkedAt}Checked {timeOf(view.update.checkedAt)}{/if}
				<button
					class="icon-button"
					type="button"
					aria-label="Check for updates"
					title="Check for updates"
					disabled={!view.online || view.update.checking}
					onclick={() => oncheck?.()}
				>
					<RefreshCw size={20} />
				</button>
			</p>
		{/if}
	</section>
</div>

<style>
	.offline-summary {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		gap: var(--space-3);
		margin: 0 0 var(--space-5);
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
		padding: var(--space-3);
		border-radius: var(--radius-panel);
		background: var(--color-surface);
	}

	.card.attention {
		background: var(--color-paper);
		border: 1px solid var(--color-action);
	}

	.card p {
		margin: 0;
	}

	.card .button {
		margin-top: auto;
	}

	.card-title {
		margin: 0;
		font-size: var(--font-size-small);
		font-weight: 600;
		color: var(--color-ink-muted);
	}

	.figure {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--font-size-lead);
		font-weight: 700;
	}

	.checked {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.button:disabled,
	.icon-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
