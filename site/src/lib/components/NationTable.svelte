<!--
	@component
	One group of the Native nations index as a table: name, recognition badges
	(each opens how the nation holds that status, with its legal basis linked
	to the official text; no federal recognition shows no badge,
	src/lib/recognition-badges.ts), states and review status, and columns a
	reader can add: the name as the federal or state list gives it, Indian
	Health Service areas, languages and citizens.
	The table has no search box; the site search in the masthead finds a
	nation by name, and the Name column's filter narrows the table by name.
	Readers can narrow it by recognition, state or review status from the
	column headers, copy a link that keeps those choices, and download the
	rows as CSV.
	Each state opens the list of nations in it (Trevor, Nov. 23, 2026: every
	table opens to the data behind it).
-->
<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Clock from '@lucide/svelte/icons/clock';
	import DataTable from './DataTable.svelte';
	import RecognitionBadges from './RecognitionBadges.svelte';
	import { compareBadges } from '#lib/recognition-badges.ts';
	import type { RecognitionView } from '#lib/server/recognition.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { NationGroup } from '#lib/server/nation-index.ts';
	import { stateName } from '#lib/nation-labels.ts';
	import { bureauRegionPage } from '#lib/federal-offices.ts';

	let {
		group,
		identifier,
		searchLabel,
		regions = false,
		count = true,
		filters
	}: {
		group: NationGroup;
		identifier: string;
		/** Shows a search box with this label, for a table long enough to need one. */
		searchLabel?: string;
		/** Adds the Bureau of Indian Affairs region, as a column readers can filter by. */
		regions?: boolean;
		/** False leaves out the row count until a search or filter narrows the table, as when the heading shows it. */
		count?: boolean;
		/** Whether the column filters show; by default, when the table has more than five rows. */
		filters?: boolean;
	} = $props();

	const columns: TableColumn[] = $derived([
		{ key: 'name', header: 'Name', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'recognition', header: 'Recognition', sortable: true, custom: true, filterable: true },
		{ key: 'states', header: 'States', sortable: true, filterable: true, custom: true, searchable: true },
		...(regions ? [{ key: 'region', header: 'Region', sortable: true, filterable: true, custom: true, searchable: true }] : []),
		{ key: 'review', header: 'Review status', sortable: true, filterable: true, custom: true },
		// More columns a reader can add from the list of columns (Trevor, Nov. 24, 2026: "add ability to hide or add columns to tables").
		{ key: 'listedName', header: 'Name as listed', sortable: true, searchable: true, optional: true },
		{ key: 'healthAreas', header: 'Indian Health Service area', sortable: true, filterable: true, optional: true },
		{ key: 'languages', header: 'Languages', sortable: true, filterable: true, optional: true },
		{ key: 'citizens', header: 'Citizens', type: 'number', sortable: true, optional: true }
	]);

	const rows: TableRow[] = $derived(
		group.rows.map((row) => ({
			key: row.id,
			cells: {
				name: { text: row.name, href: `/nations/${row.id}` },
				recognition: {
					// The download keeps the full wording and legal basis; sorting and
					// filtering follow the badges shown (no federal recognition has none).
					text: row.recognition
						.map((view) => (view.short ? `${view.label} (${view.short.text})` : view.label))
						.join('; '),
					sortValue: badged(row.recognition)
						.map((view) => view.badge.label)
						.join('; '),
					values: badged(row.recognition).map((view) => view.badge.label)
				},
				states: { text: row.statesText, values: row.states.map(stateName) },
				region: { text: row.region },
				review: { text: row.review },
				listedName: { text: row.listedName },
				healthAreas: { text: row.healthAreas.join(', '), values: row.healthAreas },
				languages: { text: row.languages.join(', '), values: row.languages },
				citizens: row.citizens === undefined ? { text: '' } : { text: row.citizens.toLocaleString('en-US'), sortValue: row.citizens }
			}
		}))
	);

	/** The statuses that have a badge, federal first. */
	function badged(views: RecognitionView[]): (RecognitionView & { badge: NonNullable<RecognitionView['badge']> })[] {
		return views
			.filter((view): view is RecognitionView & { badge: NonNullable<RecognitionView['badge']> } => view.badge !== undefined)
			.sort((first, second) => compareBadges(first.badge, second.badge));
	}

	const recognitionById = $derived(new Map(group.rows.map((row) => [row.id, badged(row.recognition)])));
	const statesById = $derived(new Map(group.rows.map((row) => [row.id, row.states])));
	const verifiedById = $derived(new Map(group.rows.map((row) => [row.id, row.verified])));
	const explanationsById = $derived(new Map(group.rows.map((row) => [row.id, row.explanations])));
</script>

<DataTable
	{identifier}
	label="Table: {group.label}"
	{searchLabel}
	{columns}
	{rows}
	defaultSort={{ key: 'name', direction: 'ascending' }}
	rowName={['nation', 'nations']}
	{count}
	filters={filters ?? group.rows.length > 5}
	download={identifier}
	shareable
>
	{#snippet cell(row, column)}
		{#if column.key === 'region'}
			{@const regionPage = bureauRegionPage(row.cells.region.text)}
			{#if regionPage}<a href={regionPage}>{row.cells.region.text}</a>{:else}{row.cells.region.text}{/if}
		{:else if column.key === 'review'}
			{@const verified = verifiedById.get(row.key) ?? false}
			<span class="review-badge" class:review-badge-verified={verified}>{#if verified}<Check size={14} strokeWidth={2} aria-hidden="true" />{:else}<Clock
						size={14}
						strokeWidth={2}
						aria-hidden="true"
					/>{/if}{row.cells.review.text}</span
			>
		{:else if column.key === 'states'}
			{#each statesById.get(row.key) ?? [] as code, index (code)}{index > 0 ? ', ' : ''}<a href="/nations/state/{code.toLocaleLowerCase('en-US')}">{stateName(code)}</a>{/each}
		{:else}
		{@const views = recognitionById.get(row.key) ?? []}
		{#if views.length > 0}
			<!-- Each badge opens its source, rather than the source sitting beside it (Trevor, Nov. 24, 2026: "it should appear if you click the button that says the Federal or State"). -->
			<RecognitionBadges badges={views.map((view) => view.badge)} size="small" explanations={explanationsById.get(row.key)} />
		{/if}
		{/if}
	{/snippet}
</DataTable>

