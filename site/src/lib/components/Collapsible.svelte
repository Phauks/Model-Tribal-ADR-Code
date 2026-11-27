<!--
	@component
	A page section that a reader can fold away, with its heading as the
	control (Trevor asked for collapsible sections on Nov. 22, 2026). It is the
	browser's own <details> element, so it works without scripts, starts open (or folded, with
	open={false}),
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
		/** False for a section that starts folded, such as Nearby Nations. */
		open?: boolean;
		children: Snippet;
	}

	let { heading, identifier, class: extraClass = '', count, actions, open = true, children }: Props = $props();

	// The heading leaves room for the buttons, and the buttons sit at the end of the heading row with its height. Both are measured once the page runs, because the row can be narrower than the section: a heading beside a floated map ends where the map begins.
	let actionsWidth = $state(0);
	let wrapper = $state<HTMLElement>();
	let summary = $state<HTMLElement>();
	let row = $state<{ top: number; end: number; height: number }>();

	$effect(() => {
		if (!wrapper || !summary) return;
		const box = wrapper;
		const heading = summary;
		const measure = () => {
			const outer = box.getBoundingClientRect();
			const inner = heading.getBoundingClientRect();
			const rightToLeft = getComputedStyle(box).direction === 'rtl';
			// The rule under the heading is not part of its row, so the buttons line up with the heading's text, not with the rule.
			const rule = parseFloat(getComputedStyle(heading).borderBottomWidth) || 0;
			row = {
				top: inner.top - outer.top,
				end: rightToLeft ? inner.left - outer.left : outer.right - inner.right,
				height: inner.height - rule
			};
		};
		const observer = new ResizeObserver(measure);
		observer.observe(box);
		observer.observe(heading, { box: 'border-box' });
		measure();
		return () => observer.disconnect();
	});
</script>

{#snippet section(summaryRoom: number | undefined)}
	<details class="collapsible {extraClass}" data-section={identifier} {open}>
		<summary style:padding-inline-end={summaryRoom ? `${summaryRoom}px` : undefined} bind:this={summary}>
			<span class="fold-mark no-print"><ChevronDown size={24} /></span>
			<h2 id={identifier}>{heading}{#if count !== undefined}<CountBadge {count} />{/if}</h2>
		</summary>
		{@render children()}
	</details>
{/snippet}

{#if actions}
	<div class="with-actions" bind:this={wrapper}>
		{@render section(actionsWidth)}
		<div
			class="heading-actions no-print"
			class:placed={row !== undefined}
			style:inset-block-start={row ? `${row.top}px` : undefined}
			style:inset-inline-end={row ? `${row.end}px` : undefined}
			style:height={row ? `${row.height}px` : undefined}
			bind:clientWidth={actionsWidth}
		>
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

	/*
	 * A rule under each heading marks where a section begins (Trevor picked
	 * this on Nov. 26, 2026; site/DESIGN.md, "Section headings"). The rule is on the
	 * heading row, a flex box, so beside a floated At a glance box it stops at
	 * the box's edge instead of running under it. Sections inside the At a
	 * glance box have no rule, since the box already sets them apart.
	 */
	summary {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		list-style: none;
		cursor: pointer;
		border-bottom: 2px solid var(--color-line);
		margin-bottom: var(--space-4);
	}

	:global(.glance-box) .collapsible > summary {
		border-bottom: 0;
		margin-bottom: 0;
	}

	/* A list of facts right under the rule drops its own top line, so the two never sit as a double line. */
	.collapsible > summary + :global(.summary-list),
	.collapsible > summary + :global(.nation-edit-link) + :global(.summary-list) {
		border-top: 0;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary h2 {
		margin: var(--space-3) 0 var(--space-2);
	}

	:global(.glance-box) .collapsible > summary h2 {
		margin-bottom: var(--space-3);
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
		/* Hidden until placed, so they never show over a map beside the heading. */
		visibility: hidden;
	}

	.heading-actions.placed {
		visibility: visible;
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
