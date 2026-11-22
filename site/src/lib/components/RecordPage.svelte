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

	.record-introduction,
	.record-details,
	.record-sources {
		max-width: var(--layout-measure);
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
	 * Two columns whenever the page's own column has room for the text at a
	 * readable width beside a glance column at least 17 rem wide. The page
	 * follows the width of <main> (a size container), not the window, so it
	 * changes when the sidebar is shown or hidden. At the threshold the text
	 * column gives up width first, down to about 45 characters, and the
	 * glance column never drops below 17 rem; on a 1,280 pixel laptop with the
	 * sidebar open the text keeps its full measure (measured Nov. 22, 2026).
	 */
	@container page (min-width: 52rem) {
		.record-page.has-glance {
			display: grid;
			grid-template-columns: minmax(0, var(--layout-measure)) minmax(17rem, 1fr);
			/* The last row takes any height the right-hand column needs beyond the text's. */
			grid-template-rows: auto auto 1fr;
			column-gap: var(--space-6);
			align-items: start;
		}

		.has-glance .record-introduction {
			grid-column: 1;
			grid-row: 1;
		}

		.has-glance .record-details {
			grid-column: 1;
			grid-row: 2;
		}

		.has-glance .record-sources {
			grid-column: 1;
			grid-row: 3;
		}

		/* The glance column fills the room beside the text, up to the side-column width. */
		.record-glance {
			grid-column: 2;
			grid-row: 1 / span 3;
			max-width: var(--layout-side-column);
			/* Lines up with the page's title. */
			margin-top: var(--space-4);
			container: glance / inline-size;
		}

		.record-glance > :global(.collapsible:first-child) {
			margin-top: 0;
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
