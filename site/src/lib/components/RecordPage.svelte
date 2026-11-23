<!--
	@component
	The layout of a page about one record, such as a nation or a story
	(site/DESIGN.md, "Record pages"). It knows nothing about the record: each
	page passes its parts as snippets.

	- `introduction`: the title and anything that belongs right under it.
	- `glance`: the key facts, usually in a GlancePanel, and other short
	  panels such as contacts. Optional.
	- `children`: the record's sections.
	- `sources`: the Sources list. Optional.

	When the page's column has room for both, the record's sections are held to
	the reading measure on the left and the glance column sits on the right,
	set off by a rule. Otherwise the glance column follows the introduction, so
	on a phone the key facts come first. Links to other websites inside the
	page open in a new tab.

	Use:
	<RecordPage glanceLabel="At a glance">
		{#snippet introduction()}<h1>…</h1>{/snippet}
		{#snippet glance()}<GlancePanel>…</GlancePanel>{/snippet}
		…sections…
		{#snippet sources()}<SourceList sources={data.sources} />{/snippet}
	</RecordPage>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { newTabNoteId, outsideLinksOpenInNewTab } from '#lib/new-tab-links.ts';

	interface Props {
		introduction: Snippet;
		glance?: Snippet;
		/** The accessible name of the glance column. */
		glanceLabel?: string;
		children?: Snippet;
		sources?: Snippet;
	}

	let { introduction, glance, glanceLabel = 'At a glance', children, sources }: Props = $props();
</script>

<span id={newTabNoteId} hidden>Opens in a new tab</span>
<article class="record-page" class:has-glance={glance !== undefined} {@attach outsideLinksOpenInNewTab}>
	<div class="record-introduction">
		{@render introduction()}
	</div>

	{#if glance}
		<aside class="record-glance" aria-label={glanceLabel}>
			{@render glance()}
		</aside>
	{/if}

	{#if children}
		<div class="record-details">
			{@render children()}
		</div>
	{/if}

	{#if sources}
		<div class="record-sources">
			{@render sources()}
		</div>
	{/if}
</article>

<style>
	/*
	 * Sources is one of the page's folding sections, spaced like the others;
	 * the rule other pages draw above their notes would sit right under the
	 * last fact table's own line.
	 */
	.record-sources :global(.notes) {
		margin-top: 0;
		padding-top: 0;
		border-top: 0;
	}

	/*
	 * Running text is held to the reading measure; headings, tables, lists
	 * set in columns and other wide blocks are not, so they can use the room
	 * under the glance column once the text passes it (Trevor, Nov. 23,
	 * 2026). A label and value list keeps its label column plus the measure
	 * for the values. :where() keeps these at no specificity, so a block's
	 * own width wins.
	 */
	:global(:where(.record-introduction) > :where(:not(h1, h2))),
	:global(:where(.record-details, .record-sources) :where(p, ul, ol, dl, blockquote)) {
		max-width: var(--layout-measure);
	}

	:global(:where(.record-details, .record-sources) :where(.summary-list)) {
		max-width: calc(14rem + var(--layout-measure));
	}

	/*
	 * The glance column holds boxes, not running text, so a text size below
	 * 100 percent does not narrow it: it keeps the width it has at the
	 * standard size (Trevor, Nov. 22, 2026: only text changes size).
	 */
	.record-glance {
		max-width: max(var(--layout-measure), calc(var(--layout-measure) / var(--text-scale)));
	}

	/*
	 * Beside the text whenever the page's own column has room for the text at
	 * a readable width and a glance column at least 17 rem wide. The page
	 * follows the width of <main> (a size container), not the window, so it
	 * changes when the sidebar is shown or hidden. At the threshold the text
	 * gives up width first, down to about 45 characters, and the glance
	 * column never drops below 17 rem; on a 1,280 pixel laptop with the
	 * sidebar open the text keeps its full measure (measured Nov. 22, 2026).
	 *
	 * The glance column floats on the right under the title, as an infobox
	 * does, so the sections run beside it and, once they pass its bottom, use
	 * the whole width under it instead of leaving an empty column (Trevor,
	 * Nov. 23, 2026). Blocks that draw a box or a rule keep clear of it, so
	 * nothing runs underneath; grids, flex rows, lists set in columns and
	 * scrolling tables do this by themselves.
	 */
	@container page (min-width: 52rem) {
		.record-page.has-glance {
			display: flow-root;
		}

		.record-glance {
			float: right;
			clear: right;
			width: clamp(17rem, 100% - var(--layout-measure) - var(--space-6), var(--layout-side-column));
			max-width: var(--layout-side-column);
			margin: var(--space-4) 0 var(--space-5) var(--space-6);
			container: glance / inline-size;
		}

		.record-glance > :global(.collapsible:first-child) {
			margin-top: 0;
		}

		.has-glance :global(:is(.record-details, .record-sources) :is(.notice, .panel, .timeline, figure, hr)) {
			display: flow-root;
		}
	}

	/*
	 * In a narrow glance column, each label sits above its values. The column
	 * is measured outside the panel's padding, so 22 rem leaves the values
	 * about 13 rem, enough that a language name does not break mid-word.
	 */
	@container glance (max-width: 22rem) {
		.record-glance :global(.summary-list) {
			grid-template-columns: 1fr;
		}

		.record-glance :global(.summary-list dt) {
			border-bottom: 0;
			padding-bottom: 0;
		}
	}

	@container glance (min-width: 22rem) {
		.record-glance :global(.summary-list) {
			grid-template-columns: minmax(6.5rem, 9rem) 1fr;
		}
	}
</style>
