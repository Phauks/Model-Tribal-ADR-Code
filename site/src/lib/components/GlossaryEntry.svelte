<script lang="ts">
	// One glossary entry: headword, usage, definition, how the project uses
	// it, and the entries to use instead or see also. The glossary page shows
	// every entry with it, and each entry's own page shows one
	// (src/lib/server/glossary-entries.ts). The entry's id is its anchor, so
	// another page can link to /glossary#native-nations as well as to
	// /glossary/native-nations.
	import Link from '@lucide/svelte/icons/link';
	import type { Snippet } from 'svelte';
	import type { GlossaryEntryView } from '#lib/server/glossary-entries.ts';

	let {
		entry,
		headingLevel = 2,
		onGlossaryPage = false,
		children
	}: {
		entry: GlossaryEntryView;
		/** Shown under the headword, such as the page's "Report a problem" link. */
		children?: Snippet;
		/** The level of the headword's heading; the entry's own subheadings sit one below. */
		headingLevel?: 1 | 2 | 3;
		/** On the glossary page, links to other entries go to their place on the same page. */
		onGlossaryPage?: boolean;
	} = $props();

	const termHeading = $derived(`h${headingLevel}`);
	const partHeading = $derived(`h${headingLevel + 1}`);
	const linkTo = (id: string) => (onGlossaryPage ? `#${id}` : `/glossary/${id}`);
</script>

<article class="glossary-entry" id={onGlossaryPage ? entry.id : undefined} aria-labelledby="term-{entry.id}">
	<svelte:element this={termHeading} id="term-{entry.id}" class="term">
		{entry.term}
		{#if entry.expansion}<span class="expansion muted">({entry.expansion})</span>{/if}
	</svelte:element>
	<p class="usage">
		<span class="chip">{entry.usageLabel}</span>
		{#if onGlossaryPage}
			<a class="permalink no-print" href="#{entry.id}">
				<Link size={16} strokeWidth={1.75} />
				<span>Link to this term<span class="visually-hidden">: {entry.term}</span></span>
			</a>
			<a class="no-print" href="/glossary/{entry.id}">
				Full entry<span class="visually-hidden"> for {entry.term}</span>
			</a>
		{/if}
	</p>
	{@render children?.()}

	<div class="definition">{@html entry.definition}</div>

	{#if entry.usageNote}
		<svelte:element this={partHeading} class="part">How the project uses it</svelte:element>
		{@html entry.usageNote}
	{/if}

	{#if entry.useInstead.length > 0}
		<p class="related">
			<span class="related-label">Use instead:</span>
			{#each entry.useInstead as other, index (other.id)}{index > 0 ? ', ' : ''}<a
					class="term-link"
					href={linkTo(other.id)}>{other.term}</a
				>{/each}
		</p>
	{/if}

	{#if entry.seeAlso.length > 0}
		<p class="related">
			<span class="related-label">Related terms:</span>
			{#each entry.seeAlso as other, index (other.id)}{index > 0 ? ', ' : ''}<a
					class="term-link"
					href={linkTo(other.id)}>{other.term}</a
				>{/each}
		</p>
	{/if}
</article>

<style>
	.glossary-entry {
		scroll-margin-top: var(--space-6);
	}

	.expansion {
		font-size: var(--font-size-body);
		font-weight: var(--font-weight-regular);
	}

	.usage {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-3);
		margin-top: 0;
		font-size: var(--font-size-small);
	}

	.usage a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--layout-target-minimum);
	}

	.part {
		font-size: var(--font-size-body);
	}

	.related-label {
		font-weight: var(--font-weight-semibold);
	}
</style>
