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
		detailParts?: { text: string; link?: string; viewer?: string; original?: string; italic?: boolean }[];
		/** A short line under the value, such as what sources record in each state. */
		note?: string;
		citations?: CitationMark[];
		/** Short tags, such as topics, shown as badges in place of the text. */
		badges?: { text: string; link?: string }[];
		/** An estimate's margin of error, shown after it as "± 5" (Census figures). */
		margin?: string;
		/** In a wide group, the value goes on its own line under its label, as words such as a law's title do not fit beside it. */
		below?: boolean;
		/** Plain words after a linked value on its line, such as a law's citation after its name. */
		after?: string;
	}

	interface FactTable {
		headers: string[];
		rows: { text: string; link?: string; value: string; citations?: CitationMark[] }[];
		/** A short line under the table, such as the year of a count. */
		note?: string;
	}

	interface FactGroup {
		field: string;
		label: string;
		items: FactItem[];
		/** The note every value shares, in the words to say it once, such as "Law codes". */
		note?: string;
		/** The group takes the panel's full width, its label above its values, such as a Census area's figures. */
		wide?: boolean;
		/** Values shown as a small table, such as a nation's Census areas; any items follow it. */
		table?: FactTable;
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
	 * Several values with no label, such as the branches of a government,
	 * stack one per line, and the labeled values after them, such as
	 * "Separation of powers", stay label rows under them (Trevor chose this,
	 * "one line per branch", on Nov. 27, 2026; design/branches-of-government).
	 */
	function stackThenLabeled(group: FactGroup): number | undefined {
		const first = group.items.findIndex((item) => item.label);
		if (first < 2 || !group.items.slice(first).every((item) => item.label)) return undefined;
		return group.items.slice(0, first).some((item) => item.label) ? undefined : first;
	}

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

{#snippet main(item: FactItem)}
	{#if item.badges}<TopicBadges topics={item.badges} /><CitationMarks marks={item.citations} />{:else if item.link && outside(item.link)}<a
			href={item.link}>{item.text}</a
		><span class="link-tail"
			>{joiner}<ExternalLink class="external-icon" size={14} strokeWidth={1.75} aria-hidden="true" /><CitationMarks
				marks={item.citations}
			/></span
		>{:else if item.link}<a href={item.link}>{item.text}</a>{item.after ?? ''}<CitationMarks marks={item.citations} />{:else}{item.text}{#if item.margin}<span
				class="fact-margin muted small"
				><span class="visually-hidden">, margin of error</span> ± {item.margin}</span
			>{/if}<CitationMarks marks={item.citations} />{/if}
{/snippet}

{#snippet details(item: FactItem)}
	{#if item.detailParts}
		<span class="fact-detail muted small"
			>{#each item.detailParts as part, partIndex (partIndex)}{#if part.link && part.viewer}<a href={part.link} {...imageViewerAttributes(part.viewer, { title: part.viewer, original: part.original })}>{part.text}</a
					>{:else if part.link && part.italic}<a href={part.link}><i>{part.text}</i></a
					>{:else if part.link}<a href={part.link}>{part.text}</a
					>{:else}{part.text}{/if}{/each}</span
		>
	{:else if item.detail}
		<span class="fact-detail muted small">{item.detail}</span>
	{/if}
	{#if item.note}<span class="fact-detail muted small">{item.note}</span>{/if}
{/snippet}

{#snippet value(item: FactItem)}
	{@render main(item)}
	{@render details(item)}
{/snippet}

<!--
	In a wide group the numbers line up on the right and do not wrap, so a
	value's note or legal basis takes its own line under the row, the panel's
	full width, as a narrow column would break it into a stack of short lines
	on a phone (Trevor, Nov. 27, 2026, on the Land Buy-Back mockup).
-->
{#snippet labelRows(rows: FactItem[], wide = false)}
	<dl class="label-rows">
		{#each rows as item, index (index)}
			<div class:row-own={wide && (item.below || item.note || item.detail || item.detailParts)}>
				<dt>{item.label}</dt>
				{#if wide && item.below}
					<dd class="row-note row-below">{@render value(item)}</dd>
				{:else if wide && (item.note || item.detail || item.detailParts)}
					<dd>{@render main(item)}</dd>
					<dd class="row-note">{@render details(item)}</dd>
				{:else}
					<dd>{@render value(item)}</dd>
				{/if}
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
		<div class:wide={group.wide}>
			<dt>{group.label}{#if note}<span class="group-note muted small">{note}</span>{/if}</dt>
			<dd>
				{#if group.table}
					<!-- Two short columns in a narrow panel: no handles to resize them (src/lib/tables/resizable-columns.ts). -->
					<table class="fact-table" data-fixed-columns>
						<thead>
							<tr>
								{#each group.table.headers as header, index (index)}<th scope="col">{header}</th>{/each}
							</tr>
						</thead>
						<tbody>
							{#each group.table.rows as row, index (index)}
								<tr>
									<td>{#if row.link}<a href={row.link}>{row.text}</a>{:else}{row.text}{/if}</td>
									<td class="number">{row.value}<CitationMarks marks={row.citations} /></td>
								</tr>
							{/each}
						</tbody>
					</table>
					{#if group.table.note}<span class="fact-detail muted small">{group.table.note}</span>{/if}
					{#each items as item, index (index)}<div class="table-after">{@render fact(item)}</div>{/each}
				{:else if items.length === 1}
					{@render fact(items[0])}
				{:else if labeled(group)}
					{@render labelRows(items, group.wide)}
				{:else if leadThenLabeled(group)}
					<div class="lead-value">{@render value(items[0])}</div>
					{@render labelRows(items.slice(1), group.wide)}
				{:else if stackThenLabeled(group)}
					{@const first = stackThenLabeled(group) ?? 0}
					<ul class="stacked-list lead-value">
						{#each items.slice(0, first) as item, index (index)}
							<li>{@render fact(item)}</li>
						{/each}
					</ul>
					{@render labelRows(items.slice(first), group.wide)}
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
	 * pixels; measured Nov. 23, 2026). The right padding is 10 pixels: with 9,
	 * a [1], the narrowest marker, drew 23.9 pixels wide in the site's font,
	 * short of a full target where it follows a link (measured Nov. 27, 2026).
	 *
	 * A link that is the whole fact gets the same treatment: two pixels above
	 * and below take a line of it from 21 to 25 pixels, so it is a full target
	 * on its own and does not depend on its distance from the marker after it,
	 * which changes wherever the link wraps.
	 */
	.summary-list :global(.note-marker) {
		padding: 5px 10px 5px 0.05em;
	}

	.summary-list dd > a,
	.summary-list li > a {
		padding-block: 2px;
	}

	/* The same gap as between two label rows. */
	.lead-value {
		margin-bottom: var(--space-1);
	}

	/* Branches stacked above their label rows: the gap between stacked lines. */
	.stacked-list.lead-value {
		margin-bottom: var(--space-2);
	}

	.link-tail {
		white-space: nowrap;
	}

	/*
	 * A wide group, such as a Census area's figures, takes the panel's full
	 * width: its label above, then its values, the numbers lined up on the
	 * right (Trevor approved the mockup on Nov. 27, 2026; project files
	 * design/census-key-facts/).
	 */
	.summary-list > .wide > dt {
		grid-column: 1 / -1;
		border-bottom: 0;
		padding-bottom: var(--space-1);
	}

	.summary-list > .wide > dd {
		grid-column: 1 / -1;
	}

	.wide .lead-value {
		margin-bottom: var(--space-2);
	}

	.summary-list > .wide :global(.label-rows) {
		grid-template-columns: 1fr auto;
	}

	.summary-list > .wide :global(.label-rows dd) {
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	/*
	 * A row with a note is its own grid, so a wide number in another row, such
	 * as an amount with two markers, does not narrow its label to a stack of
	 * short lines in the narrow panel or on a phone.
	 */
	.summary-list > .wide .label-rows > div.row-own {
		display: grid;
		grid-column: 1 / -1;
		grid-template-columns: 1fr auto;
		column-gap: var(--space-4);
		row-gap: var(--space-1);
	}

	/* A row's note, under the label and the value, the full width of the group. */
	.summary-list > .wide .label-rows dd.row-note {
		grid-column: 1 / -1;
		margin-top: calc(-1 * var(--space-1));
		text-align: left;
		white-space: normal;
	}

	/* A value set under its label, such as a legal basis: the panel's type, not a note's. */
	.summary-list > .wide .label-rows dd.row-below {
		margin-top: 0;
	}

	.row-note .fact-detail:first-child {
		margin-top: 0;
	}

	/* The panel's own type size, as in the approved mockup, not the smaller size of a data table. */
	.fact-table {
		width: 100%;
		margin: 2px 0 0;
		border-collapse: collapse;
		font-size: inherit;
	}

	.fact-table th {
		padding: 2px 0 var(--space-1);
		border-bottom: 1px solid var(--color-line);
		background: none;
		font-weight: var(--font-weight-semibold);
		text-align: left;
	}

	.fact-table td {
		padding: 3px 0;
		font-size: inherit;
		border-bottom: 1px solid var(--color-line);
		vertical-align: top;
	}

	.fact-table th:last-child,
	.fact-table td.number {
		padding-left: var(--space-3);
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.table-after {
		margin-top: var(--space-2);
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
