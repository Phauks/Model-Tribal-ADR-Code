<!--
	@component
	The layout of a page about one record, such as a nation or a story
	(site/DESIGN.md, "Record pages"). It knows nothing about the record: each
	page passes its parts as snippets.

	- `title`: the page's title (its `<h1>`), across the full width. Optional,
	  but a page with a glance column should pass it, so the column starts
	  right under the title on every page.
	- `introduction`: anything that belongs right under the title, such as
	  other names, a lead and badges.
	- `glance`: the key facts, usually in a GlancePanel, and other short
	  panels such as contacts. Optional.
	- `children`: the record's sections.
	- `sources`: the Sources list. Optional.

	When the page's column has room for both, the record's sections are held to
	the reading measure on the left and the glance column sits on the right,
	its top level with the line under the title. Otherwise the glance column
	follows the introduction, so on a phone the key facts come first. Links to other websites inside the
	page open in a new tab.

	Use:
	<RecordPage glanceLabel="At a glance">
		{#snippet title()}<h1>…</h1>{/snippet}
		{#snippet introduction()}<p class="lead">…</p>{/snippet}
		{#snippet glance()}<GlancePanel>…</GlancePanel>{/snippet}
		…sections…
		{#snippet sources()}<SourceList sources={data.sources} />{/snippet}
	</RecordPage>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { newTabNoteIdentifier, outsideLinksOpenInNewTab } from '#lib/new-tab-links.ts';

	interface Props {
		title?: Snippet;
		introduction?: Snippet;
		glance?: Snippet;
		/** The accessible name of the glance column. */
		glanceLabel?: string;
		children?: Snippet;
		sources?: Snippet;
	}

	let { title, introduction, glance, glanceLabel = 'At a glance', children, sources }: Props = $props();
</script>

<span id={newTabNoteIdentifier} hidden>Opens in a new tab</span>
<article class="record-page" class:has-glance={glance !== undefined} {@attach outsideLinksOpenInNewTab}>
	{#if title}
		<div class="record-title">
			{@render title()}
		</div>
	{/if}

	<div class="record-introduction">
		{@render introduction?.()}
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
	:global(:where(.record-title, .record-introduction) > :where(:not(h1, h2))),
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
	 * does, its top level with the first line under the title on every page
	 * (Trevor, Nov. 24, 2026: "The right side starts much too low on some
	 * pages, it is never the same"). Until then it started after everything
	 * under the title (badges, other names, pronunciations), from 65 to 296
	 * pixels lower depending on the page. A float cannot start above its own
	 * place in the page, and the glance column stays after the introduction
	 * so a phone shows it after the introduction and selecting the text never
	 * takes in the panel (Trevor, Nov. 22, 2026). So the introduction floats
	 * too, on the left, in the width the glance column leaves, and both start
	 * on the line under the title. The sections clear the introduction only,
	 * so they run beside the glance column and, once they pass its bottom,
	 * use the whole width under it instead of leaving an empty column (Trevor,
	 * Nov. 23, 2026). Blocks that draw a box or a rule keep clear of it, so
	 * nothing runs underneath, such as the References list's groups and
	 * rows, whose rules showed through the contact card; grids, flex rows,
	 * lists set in columns and scrolling tables do this by themselves.
	 *
	 * A section's own box still runs under the glance column, and a
	 * positioned box is painted and clicked above a float, so a positioned
	 * section beside the column (a nation's Courts, which holds the team's
	 * hidden Edit link, or a section with heading buttons) covered the
	 * contact card: its email, phone and contact page could not be clicked
	 * or selected (Trevor, Nov. 24, 2026). The glance column is lifted above
	 * the sections, so whatever sits beside it, it stays on top.
	 */
	@container page (min-width: 52rem) {
		.record-page.has-glance {
			display: flow-root;
			/* Two fifths of the column, or the room the text width leaves, whichever is wider. */
			--record-glance-width: min(
				max(min(40%, var(--layout-side-column)), 17rem, 100% - var(--layout-measure) - var(--space-6)),
				var(--layout-side-column)
			);
		}

		.has-glance > .record-introduction {
			float: left;
			width: calc(100% - var(--record-glance-width) - var(--space-6));
		}

		/*
		 * Both columns start on the line under the title, with no gap of their
		 * own above. Weaker than a class, so a page can still tuck its first
		 * line under the title, as InfoPage does with other names.
		 */
		:global(:where(.record-page.has-glance > .record-introduction) > :first-child) {
			margin-top: 0;
		}

		/*
		 * The sections start under the introduction. Clearing a float swallows
		 * the top margin of the first section's heading, which put "Cases"
		 * right against a biography's status badge; the hairline of padding
		 * keeps that margin inside, so the space above the first section is the
		 * same as before. The introduction's last line that shows gives up its
		 * own bottom margin for it, since the two margins used to overlap (a
		 * nation page ends its introduction with empty or hidden places the
		 * Worker fills).
		 */
		.has-glance > :is(.record-details, .record-sources) {
			clear: left;
			padding-top: 1px;
		}

		:global(:where(.record-page.has-glance > .record-introduction) > :nth-last-child(1 of :not([hidden], :empty))) {
			margin-bottom: 0;
		}

		.record-glance {
			position: relative;
			z-index: 1;
			float: right;
			clear: right;
			width: var(--record-glance-width);
			max-width: none;
			margin: 0 0 var(--space-5) var(--space-6);
			container: glance / inline-size;
		}

		.record-glance > :global(.collapsible:first-child) {
			margin-top: 0;
		}

		.has-glance :global(:is(.record-details, .record-sources) :is(.notice, .panel, .timeline, figure, hr, .source-group, .source-list > li)) {
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
