<!--
	@component
	The parts of a case's or a law's box (Background, Question, Holding,
	Summary, Quotes, Treatment), each one of the page's folding sections
	(Collapsible.svelte), as every section of an item page folds (Trevor,
	Nov. 24, 2026: "each header section in a page, such as a case page, should
	be collapsible"). The parts are one essay's text, so the "Show the
	paragraph" buttons under quotations still come from one place.

	Use:
	<RecordBoxSections sections={data.boxSections} />
-->
<script lang="ts">
	import type { BoxSection } from '#lib/server/case-pages.ts';
	import { quoteContext } from '#lib/essays/quote-context-view.ts';
	import Collapsible from './Collapsible.svelte';

	let { sections }: { sections: BoxSection[] } = $props();
	const allHtml = $derived(sections.map((section) => section.html).join('\n'));
</script>

{#if sections.length > 0}
	<div class="essay-text record-box" use:quoteContext={allHtml}>
		{#each sections as section (section.id)}
			<Collapsible heading={section.heading} identifier={section.id} count={section.count}>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- built from the repository's own Markdown -->
				{@html section.html}
			</Collapsible>
		{/each}
	</div>
{/if}

<style>
	/* Each part of the box is a section with its own heading here, so the part's small label is not repeated. */
	.record-box :global(.essay-case-part > .essay-block-label) {
		display: none;
	}

	.record-box :global(.essay-case-part) {
		margin: 0;
		padding: 0;
		border: none;
	}

	.record-box :global(figure) {
		max-width: var(--layout-measure);
	}
</style>
