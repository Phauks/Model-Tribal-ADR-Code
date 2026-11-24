<script lang="ts">
	// Label and value pairs for a nation's facts (site/DESIGN.md, "Summary list").
	// Each fact ends with the markers of its sources (CitationMarks). A label
	// with one value shows it plainly. Several values never get bullets
	// (Trevor, Nov. 23, 2026, "label rows"): values that each have a label,
	// such as a governing body's name, members and term, make small label rows;
	// other values stack, one per line, with a thin rule between them. A note
	// that every value shares, such as "Law code", is said once under the
	// fact's label. A value's legal basis or note sits on its own line under
	// it, in smaller type.
	import type { CitationMark } from '#lib/citation-marks.ts';
	import CitationMarks from './CitationMarks.svelte';
	import TopicBadges from './TopicBadges.svelte';

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
		/** Short tags, such as topics, shown as badges in place of the text. */
		badges?: { text: string; link?: string }[];
	}

	interface FactGroup {
		field: string;
		label: string;
		items: FactItem[];
		/** The note every value shares, in the words to say it once, such as "Law codes". */
		note?: string;
	}

	let { groups }: { groups: FactGroup[] } = $props();

	/** Every value has its own label, so they show as label rows. */
	const labeled = (group: FactGroup) => group.items.every((item) => item.label);

	/**
	 * The detail and note every value of the group shares, said once under the
	 * group's label. Only plain words; a detail with links stays with its value.
	 */
	function sharedNote(group: FactGroup): string | undefined {
		if (group.items.length < 2) return undefined;
		if (group.note) return group.note;
		const [first, ...rest] = group.items;
		if (group.items.some((item) => item.detailParts)) return undefined;
		const words = [first.detail, first.note].filter(Boolean).join('. ');
		if (!words) return undefined;
		return rest.every((item) => item.detail === first.detail && item.note === first.note) ? words : undefined;
	}

	/** The values as shown: without the shared note, which the label carries. */
	function shownItems(group: FactGroup): FactItem[] {
		if (!sharedNote(group) || group.note) return group.items;
		return group.items.map((item) => ({ ...item, detail: undefined, note: undefined }));
	}
</script>

{#snippet value(item: FactItem)}
	{#if item.badges}<TopicBadges topics={item.badges} />{:else if item.link}<a href={item.link}>{item.text}</a>{:else}{item.text}{/if}<CitationMarks
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

{#snippet fact(item: FactItem)}
	{#if item.label}{item.label}:{' '}{/if}{@render value(item)}
{/snippet}

<dl class="summary-list">
	{#each groups as group (group.field)}
		{@const note = sharedNote(group)}
		{@const items = shownItems(group)}
		<div>
			<dt>{group.label}{#if note}<span class="group-note muted small">{note}</span>{/if}</dt>
			<dd>
				{#if items.length === 1}
					{@render fact(items[0])}
				{:else if labeled(group)}
					<dl class="label-rows">
						{#each items as item, index (index)}
							<div>
								<dt>{item.label}</dt>
								<dd>{@render value(item)}</dd>
							</div>
						{/each}
					</dl>
				{:else}
					<ul class="stacked-list">
						{#each items as item, index (index)}
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
	 * word; the room is after the number, which stays against the words. The
	 * padding is in pixels and sized for the 16 px standard text, so the box
	 * reaches 24 by 24 pixels without growing the line. It leaves a pixel or
	 * two to spare, because a fallback font draws the number smaller than the
	 * site's own font does (23.5 by 23 pixels in Liberation Sans with 4 and 8
	 * pixels; measured Nov. 23, 2026).
	 *
	 * A link that is the whole fact gets the same treatment: two pixels above
	 * and below take a line of it from 21 to 25 pixels, so it is a full target
	 * on its own and does not depend on its distance from the marker after it,
	 * which changes wherever the link wraps.
	 */
	.summary-list :global(.note-marker) {
		padding: 5px 9px 5px 0.05em;
	}

	.summary-list dd > a,
	.summary-list li > a {
		padding-block: 2px;
	}

	.fact-detail {
		display: block;
		line-height: 1.4;
		margin-top: 2px;
	}
</style>
