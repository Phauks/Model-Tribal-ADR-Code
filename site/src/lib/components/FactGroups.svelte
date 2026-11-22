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
			<dt>{group.label}</dt>
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
	 * target (WCAG 2.2, 2.5.8 Target Size (Minimum)). Padding gives the room
	 * and keeps the marker inline, so it never wraps away from the fact's last
	 * word; the room is after the number, which stays against the words.
	 */
	.summary-list :global(.note-marker) {
		padding: 2px 6px 2px 0.05em;
	}

	.fact-detail {
		display: block;
		line-height: 1.4;
		margin-top: 2px;
	}
</style>
