<script lang="ts">
	// One glossary entry, laid out as a dictionary entry: the headword in bold,
	// an italic label for the part of speech, the usage label, other forms,
	// then the senses, each numbered. "As used here" follows as a usage paragraph, then the
	// cross-references in small capitals. The glossary page shows every entry
	// with it, and each entry's own page shows one
	// (src/lib/server/glossary-entries.ts). The entry's id is its anchor on the
	// glossary page.
	import Ban from '@lucide/svelte/icons/ban';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
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
		/** Shown under the headword, such as the page's tools. */
		children?: Snippet;
		/** The level of the headword's heading; the entry's own subheadings sit one below. */
		headingLevel?: 1 | 2 | 3;
		/** On the glossary page, links to other entries go to their place on the same page. */
		onGlossaryPage?: boolean;
	} = $props();

	const termHeading = $derived(`h${headingLevel}`);
	const partHeading = $derived(`h${headingLevel + 1}`);
	const linkTo = (id: string) => (onGlossaryPage ? `#${id}` : `/glossary/${id}`);
	const usageIcons = { preferred: CircleCheck, acceptable: CircleCheck, 'context-only': CircleAlert, avoid: Ban };
	const UsageIcon = $derived(usageIcons[entry.usage]);
</script>

<article
	class="glossary-entry"
	class:on-glossary-page={onGlossaryPage}
	id={onGlossaryPage ? entry.id : undefined}
	aria-labelledby="term-{entry.id}"
>
	<div class="entry-head">
		<svelte:element this={termHeading} id="term-{entry.id}" class="headword">{entry.term}</svelte:element>
		{#if onGlossaryPage}
			<a class="permalink no-print" href="#{entry.id}">
				<Link size={18} strokeWidth={1.75} aria-hidden="true" />
				<span class="visually-hidden">Link to {entry.term}</span>
			</a>
		{/if}
	</div>
	<p class="labels">
		<i class="functional-label">{entry.functionalLabel}</i>
		{#if entry.expansion}<span class="expansion">of <b>{entry.expansion}</b></span>{/if}
		<span class="usage-label usage-{entry.usage}">
			<UsageIcon size={16} strokeWidth={2} aria-hidden="true" />
			{entry.usageLabel}
		</span>
	</p>
	{#if entry.aliases.length > 0}
		<p class="forms">
			<i>other forms</i>
			{#each entry.aliases as form, index (form)}{index > 0 ? ', ' : ' '}<b>{form}</b>{/each}
		</p>
	{/if}
	{@render children?.()}

	<ol class="senses">
		{#each entry.senses as sense, index (index)}
			<li class="sense">
				<span class="sense-number" aria-hidden="true">{index + 1}</span>
				<div class="sense-text">
					{#if sense.label}<i class="sense-label">{sense.label}</i>{/if}
					{@html sense.definition}
				</div>
			</li>
		{/each}
	</ol>

	{#if entry.codeDefinition}
		<aside class="code-definition" aria-label="Definition in the model code">
			<span class="section-mark" aria-hidden="true">§</span>
			<p>
				<b>Defined in the code.</b> Section {entry.codeDefinition.replace('§ ', '')} of the model code defines this term. That definition is the one with legal effect; this entry explains the word.
			</p>
		</aside>
	{/if}

	{#if entry.usageNote}
		<section class="usage-paragraph">
			<svelte:element this={partHeading} class="part">As used here</svelte:element>
			{@html entry.usageNote}
		</section>
	{/if}

	{#if entry.useInstead.length > 0}
		<p class="cross-reference">
			<span class="cross-reference-label">Use instead</span>
			{#each entry.useInstead as other, index (other.id)}{index > 0 ? ', ' : ''}<a class="term-link" href={linkTo(other.id)}>{other.term}</a>{/each}
		</p>
	{/if}

	{#if entry.seeAlso.length > 0}
		<p class="cross-reference">
			<span class="cross-reference-label">See also</span>
			{#each entry.seeAlso as other, index (other.id)}{index > 0 ? ', ' : ''}<a class="term-link" href={linkTo(other.id)}>{other.term}</a>{/each}
		</p>
	{/if}

	{#if onGlossaryPage}
		<p class="entry-foot no-print">
			<a href="/glossary/{entry.id}">Full entry<span class="visually-hidden"> for {entry.term}</span></a>
		</p>
	{/if}
</article>

<style>
	.glossary-entry {
		scroll-margin-top: var(--space-6);
	}

	.entry-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
	}

	.headword {
		margin-bottom: 0;
		color: var(--color-ink);
		letter-spacing: -0.01em;
	}

	h1.headword {
		font-size: var(--font-size-display);
	}

	.permalink {
		display: inline-grid;
		place-items: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		color: var(--color-ink-muted);
	}

	.permalink:hover,
	.permalink:focus-visible {
		color: var(--color-link);
	}

	.labels {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) var(--space-4);
		margin: var(--space-1) 0 0;
	}

	.functional-label {
		font-size: var(--font-size-lead);
		color: var(--color-link);
	}

	.expansion {
		color: var(--color-ink-muted);
	}

	.expansion b {
		color: var(--color-ink);
	}

	.usage-label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0 var(--space-2);
		border: 1px solid currentColor;
		border-radius: 999px;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		align-self: center;
	}

	.usage-preferred {
		color: var(--color-link);
	}

	.usage-acceptable {
		color: var(--color-ink-muted);
	}

	.usage-context-only {
		color: var(--color-placeholder-rule);
	}

	.usage-avoid {
		color: var(--color-danger);
	}

	.forms {
		margin: var(--space-1) 0 0;
		color: var(--color-ink-muted);
	}

	.forms b {
		color: var(--color-ink);
	}

	.senses {
		list-style: none;
		margin: var(--space-4) 0 0;
		padding: var(--space-4) 0 0;
		border-top: 1px solid var(--color-line);
	}

	/* On the glossary page entries run closer together, as in a printed dictionary. */
	.on-glossary-page .senses {
		margin-top: var(--space-2);
		padding-top: 0;
		border-top: none;
	}

	.sense {
		display: grid;
		grid-template-columns: 2rem 1fr;
		margin-bottom: var(--space-3);
	}

	.sense-number {
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-lead);
		line-height: 1.2;
	}

	.sense-label {
		color: var(--color-link);
		margin-right: var(--space-1);
	}

	.sense-text :global(p:first-of-type) {
		display: inline;
	}

	.sense-text :global(p + p) {
		margin-top: var(--space-3);
	}

	.code-definition {
		display: grid;
		grid-template-columns: 2rem 1fr;
		margin: var(--space-4) 0;
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface);
		border-left: 4px solid var(--color-track-alternative-dispute-resolution);
	}

	.code-definition p {
		margin: 0;
	}

	.section-mark {
		font-size: var(--font-size-heading-3);
		font-weight: var(--font-weight-bold);
		line-height: 1;
		color: var(--color-track-alternative-dispute-resolution);
	}

	.usage-paragraph {
		margin: var(--space-4) 0;
		padding-left: var(--space-4);
		border-left: 3px solid var(--color-link);
	}

	.part {
		margin: 0 0 var(--space-1);
		font-size: var(--font-size-body);
		font-style: italic;
	}

	.usage-paragraph :global(p) {
		margin-top: 0;
	}

	.cross-reference {
		margin: var(--space-2) 0;
	}

	.cross-reference-label {
		font-style: italic;
		color: var(--color-ink-muted);
		margin-right: var(--space-2);
	}

	/* Cross-references in capitals, as a dictionary sets them. */
	.cross-reference a {
		font-size: 0.85em;
		font-weight: var(--font-weight-semibold);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.entry-foot {
		margin: var(--space-3) 0 0;
		font-size: var(--font-size-small);
	}
</style>
