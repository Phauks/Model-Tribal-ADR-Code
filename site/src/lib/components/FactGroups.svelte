<script lang="ts">
	// Label and value pairs for a nation's facts (site/DESIGN.md, "Summary list").
	// Each fact ends with the markers of its sources (CitationMarks). A label
	// with one value shows it plainly; several values make a list. A value's
	// legal basis or note sits on its own line under it, in smaller type.
	import type { CitationMark } from '#lib/citation-marks.ts';
	import CitationMarks from './CitationMarks.svelte';

	interface FactItem {
		label?: string;
		text: string;
		link?: string;
		detail?: string;
		/** A detail with linked citations, such as a recognition status's legal basis. */
		detailParts?: { text: string; link?: string }[];
		/** A short line under the value, such as what sources record in each state. */
		note?: string;
		citations?: CitationMark[];
	}

	interface FactGroup {
		field: string;
		label: string;
		/** The id of a heading below that shows these facts in full; the label links to it. */
		section?: string;
		items: FactItem[];
	}

	let { groups }: { groups: FactGroup[] } = $props();
</script>

{#snippet fact(item: FactItem)}
	{#if item.label}{item.label}:{' '}{/if}{#if item.link}<a href={item.link}>{item.text}</a>{:else}{item.text}{/if}<CitationMarks
		marks={item.citations}
	/>
	{#if item.detailParts}
		<span class="fact-detail muted small"
			>{#each item.detailParts as part, partIndex (partIndex)}{#if part.link}<a href={part.link}>{part.text}</a
					>{:else}{part.text}{/if}{/each}</span
		>
	{:else if item.detail}
		<span class="fact-detail muted small">{item.detail}</span>
	{/if}
	{#if item.note}<span class="fact-detail muted small">{item.note}</span>{/if}
{/snippet}

<dl class="summary-list">
	{#each groups as group (group.field)}
		<div>
			<dt>{#if group.section}<a href="#{group.section}">{group.label}</a>{:else}{group.label}{/if}</dt>
			<dd>
				{#if group.items.length === 1}
					{@render fact(group.items[0])}
				{:else}
					<ul>
						{#each group.items as item, index (index)}
							<li>{@render fact(item)}</li>
						{/each}
					</ul>
				{/if}
			</dd>
		</div>
	{/each}
</dl>

<style>
	/*
	 * A fact here is often only a link, such as a region or a law's title, so
	 * its markers are not inside running text and need a full 24 by 24 pixel
	 * target (WCAG 2.2, 2.5.8 Target Size (Minimum)).
	 */
	.summary-list :global(.note-marker) {
		display: inline-block;
		min-width: 24px;
		min-height: 24px;
		line-height: 24px;
		/* The number stays against the fact's words; the extra room is after it. */
		text-align: start;
	}

	.fact-detail {
		display: block;
		line-height: 1.4;
		margin-top: 2px;
	}
</style>
