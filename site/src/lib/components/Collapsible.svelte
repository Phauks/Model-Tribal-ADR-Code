<!--
	@component
	A page section that a reader can fold away, with its heading as the
	control (Trevor asked for collapsible sections on Nov. 22, 2026). It is the
	browser's own <details> element, so it works without scripts, starts open,
	and find-in-page still reaches folded text in current browsers. Every
	folded section is opened before printing (PrintOptions.svelte), so paper
	always has the whole page.

	Use:
	<Collapsible heading="Published law" identifier="law-heading">…</Collapsible>

	A section can put a few icon buttons on its heading row with the actions
	snippet, such as a nation's documents to download or save (Trevor picked
	this on Nov. 24, 2026). They sit beside the summary, not inside it, because
	a control inside the heading's own button could not be reached on its own.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import CountBadge from './CountBadge.svelte';

	interface Props {
		heading: string;
		/** The heading's id, unique on the page. */
		identifier: string;
		/** Extra classes for the section, such as a layout class. */
		class?: string;
		/** A count shown small after the heading, such as the number of sources. */
		count?: number;
		/** Icon buttons shown at the end of the heading row. */
		actions?: Snippet;
		children: Snippet;
	}

	let { heading, identifier, class: extraClass = '', count, actions, children }: Props = $props();

	// The heading leaves room for the buttons, and the buttons take the
	// heading row's height, both measured once the page runs.
	let actionsWidth = $state(0);
	let summaryHeight = $state(0);
</script>

{#snippet section(summaryRoom: number | undefined)}
	<details class="collapsible {extraClass}" data-section={identifier} open>
		<summary style:padding-inline-end={summaryRoom ? `${summaryRoom}px` : undefined} bind:clientHeight={summaryHeight}>
			<span class="fold-mark no-print"><ChevronDown size={24} /></span>
			<h2 id={identifier}>{heading}{#if count !== undefined}<CountBadge {count} />{/if}</h2>
		</summary>
		{@render children()}
	</details>
{/snippet}

{#if actions}
	<div class="with-actions">
		{@render section(actionsWidth)}
		<div class="heading-actions no-print" style:height={summaryHeight ? `${summaryHeight}px` : undefined} bind:clientWidth={actionsWidth}>
			{@render actions()}
		</div>
	</div>
{:else}
	{@render section(undefined)}
{/if}

<style>
	/*
	 * The section opens and closes by its height (site/DESIGN.md, section 6,
	 * "Motion"). Browsers that cannot animate to a height of "auto" open and
	 * close at once, as before; the element stays a plain <details>, so
	 * find-in-page and printing still open it.
	 */
	.collapsible {
		margin-top: var(--space-5);
		interpolate-size: allow-keywords;
	}

	.collapsible::details-content {
		block-size: 0;
		overflow-y: clip;
		transition:
			block-size var(--motion-duration-medium) var(--motion-easing-standard),
			content-visibility var(--motion-duration-medium) allow-discrete;
	}

	.collapsible[open]::details-content {
		block-size: auto;
	}

	summary {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		list-style: none;
		cursor: pointer;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary h2 {
		margin: var(--space-3) 0;
	}

	.with-actions {
		position: relative;
		margin-top: var(--space-5);
	}

	.with-actions > .collapsible {
		margin-top: 0;
	}

	.heading-actions {
		position: absolute;
		inset-block-start: 0;
		inset-inline-end: 0;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		height: calc(var(--layout-target-minimum) + 2 * var(--space-3));
	}

	.fold-mark {
		display: inline-flex;
		flex: none;
		transition: transform var(--motion-duration-short) var(--motion-easing-standard);
	}

	.collapsible:not([open]) .fold-mark {
		transform: rotate(-90deg);
	}
</style>
