<script lang="ts">
	// Label and value pairs for a nation's facts (site/DESIGN.md, "Summary list").
	// Each fact ends with the markers of its sources (CitationMarks). A label
	// with one value shows it plainly. Several values never get bullets
	// (Trevor, Nov. 23, 2026, "label rows"): values that each have a label,
	// such as a governing body's name, members and term, make small label rows;
	// other values stack, one per line, with a thin rule between them. A note
	// that every value shares, such as "Law code", is said once under the
	// fact's label. A value's legal basis or note sits on its own line under
	// it, in smaller type. A link to another website shows the external-link
	// icon (nation page review, Nov. 22, 2026); it opens in a new tab
	// (src/lib/new-tab-links.ts).
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import { imageViewerAttributes } from '#lib/image-viewer.ts';
	import type { CitationMark } from '#lib/citation-marks.ts';
	import CitationMarks from './CitationMarks.svelte';
	import TopicBadges from './TopicBadges.svelte';

	interface FactItem {
		label?: string;
		text: string;
		link?: string;
		detail?: string;
		/** A detail with linked citations, such as a recognition status's legal basis. */
		detailParts?: { text: string; link?: string; viewer?: string; original?: string }[];
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

	const outside = (link: string) => /^https?:\/\//i.test(link);
	// The icon and the markers after it never wrap apart: a browser may break
	// a line after an icon, so they share one unbreakable span, and a word
	// joiner keeps that span on the line of the link's last word.
	const joiner = '\u2060';

	/** Every value has its own label, so they show as label rows. */
	const labeled = (group: FactGroup) => group.items.every((item) => item.label);

	/**
	 * The value a group is named for comes first with no label of its own,
	 * such as a governing body's name before its members and term; the
	 * labeled values under it stay label rows (Trevor, Nov. 27, 2026).
	 */
	const leadThenLabeled = (group: FactGroup) =>
		group.items.length > 1 && !group.items[0].label && group.items.slice(1).every((item) => item.label);

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
	{#if item.badges}<TopicBadges topics={item.badges} /><CitationMarks marks={item.citations} />{:else if item.link && outside(item.link)}<a
			href={item.link}>{item.text}</a
		><span class="link-tail"
			>{joiner}<ExternalLink class="external-icon" size={14} strokeWidth={1.75} aria-hidden="true" /><CitationMarks
				marks={item.citations}
			/></span
		>{:else if item.link}<a href={item.link}>{item.text}</a><CitationMarks marks={item.citations} />{:else}{item.text}<CitationMarks
			marks={item.citations}
		/>{/if}
	{#if item.detailParts}
		<span class="fact-detail muted small"
			>{#each item.detailParts as part, partIndex (partIndex)}{#if part.link && part.viewer}<a href={part.link} {...imageViewerAttributes(part.viewer, { title: part.viewer, original: part.original })}>{part.text}</a
					>{:else if part.link}<a href={part.link}>{part.text}</a
					>{:else}{part.text}{/if}{/each}</span
		>
	{:else if item.detail}
		<span class="fact-detail muted small">{item.detail}</span>
	{/if}
	{#if item.note}<span class="fact-detail muted small">{item.note}</span>{/if}
{/snippet}

{#snippet labelRows(rows: FactItem[])}
	<dl class="label-rows">
		{#each rows as item, index (index)}
			<div>
				<dt>{item.label}</dt>
				<dd>{@render value(item)}</dd>
			</div>
		{/each}
	</dl>
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
					{@render labelRows(items)}
				{:else if leadThenLabeled(group)}
					<div class="lead-value">{@render value(items[0])}</div>
					{@render labelRows(items.slice(1))}
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

	/* The same gap as between two label rows. */
	.lead-value {
		margin-bottom: var(--space-1);
	}

	.link-tail {
		white-space: nowrap;
	}

	.summary-list :global(.external-icon),
	.label-rows :global(.external-icon) {
		display: inline;
		margin-left: 0.2em;
		vertical-align: -0.1em;
	}

	.fact-detail {
		display: block;
		line-height: 1.4;
		margin-top: 2px;
	}
</style>
