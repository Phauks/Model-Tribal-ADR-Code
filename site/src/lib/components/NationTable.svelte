<!--
	@component
	One group of the Native nations index as a table: name, recognition badges
	(each with its legal basis linked to the official text; no federal
	recognition shows no badge, src/lib/recognition-badges.ts), states and
	review status.
	The rows are few enough on each index page (one letter or one state) that
	the table has no search box; the site search in the masthead finds a
	nation by name.
-->
<script lang="ts">
	import DataTable from './DataTable.svelte';
	import RecognitionBadges from './RecognitionBadges.svelte';
	import { compareBadges } from '#lib/recognition-badges.ts';
	import type { RecognitionView } from '#lib/server/recognition.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { NationGroup } from '#lib/server/nation-index.ts';

	let { group, identifier }: { group: NationGroup; identifier: string } = $props();

	const columns: TableColumn[] = [
		{ key: 'name', header: 'Name', isRowHeader: true, sortable: true },
		{ key: 'recognition', header: 'Recognition', sortable: true, custom: true },
		{ key: 'states', header: 'States', sortable: true },
		{ key: 'review', header: 'Review status', sortable: true }
	];

	const rows: TableRow[] = $derived(
		group.rows.map((row) => ({
			key: row.id,
			cells: {
				name: { text: row.name, href: `/nations/${row.id}` },
				recognition: {
					text: badged(row.recognition)
						.map((view) => view.badge?.label)
						.join('; ')
				},
				states: { text: row.statesText },
				review: { text: row.review }
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
</script>

<DataTable
	{identifier}
	label="Table: {group.label}"
	{columns}
	{rows}
	defaultSort={{ key: 'name', direction: 'ascending' }}
	rowName={['page', 'pages']}
>
	{#snippet cell(row)}
		{@const views = recognitionById.get(row.key) ?? []}
		{#if views.length > 0}
		<ul class="recognition">
			{#each views as view, index (index)}
				<li>
					<RecognitionBadges badges={[view.badge]} size="small" />{#if view.short}{' '}<span class="small"
							>({#if view.short.link}<a href={view.short.link}>{view.short.text}</a
								>{:else}{view.short.text}{/if})</span
						>{/if}
				</li>
			{/each}
		</ul>
		{/if}
	{/snippet}
</DataTable>

<style>
	.recognition {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.recognition li + li {
		margin-top: var(--space-1);
	}
</style>
