<!--
	@component
	One group of the Native nations index as a table: name, recognition (with
	its legal basis linked to the official text), states and review status.
	The rows are few enough on each index page (one letter or one state) that
	the table has no search box; the site search in the masthead finds a
	nation by name. Readers can narrow it by recognition, state or review
	status, copy a link that keeps those choices, and download the rows as CSV.
-->
<script lang="ts">
	import DataTable from './DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { NationGroup } from '#lib/server/nation-index.ts';
	import { stateName } from '#lib/nation-labels.ts';

	let { group, identifier }: { group: NationGroup; identifier: string } = $props();

	const columns: TableColumn[] = [
		{ key: 'name', header: 'Name', isRowHeader: true, sortable: true },
		{ key: 'recognition', header: 'Recognition', sortable: true, custom: true, filterable: true },
		{ key: 'states', header: 'States', sortable: true, filterable: true },
		{ key: 'review', header: 'Review status', sortable: true, filterable: true }
	];

	const rows: TableRow[] = $derived(
		group.rows.map((row) => ({
			key: row.id,
			cells: {
				name: { text: row.name, href: `/nations/${row.id}` },
				recognition: {
					text: row.recognition
						.map((view) => (view.short ? `${view.label} (${view.short.text})` : view.label))
						.join('; '),
					values: row.recognition.map((view) => view.label)
				},
				states: { text: row.statesText, values: row.states.map(stateName) },
				review: { text: row.review }
			}
		}))
	);

	const recognitionById = $derived(new Map(group.rows.map((row) => [row.id, row.recognition])));
</script>

<DataTable
	{identifier}
	label="Table: {group.label}"
	{columns}
	{rows}
	defaultSort={{ key: 'name', direction: 'ascending' }}
	rowName={['page', 'pages']}
	filters={group.rows.length > 5}
	download={identifier}
	shareable
>
	{#snippet cell(row)}
		<ul class="recognition">
			{#each recognitionById.get(row.key) ?? [] as view, index (index)}
				<li>
					{view.label}{#if view.short}{' '}<span class="small"
							>({#if view.short.link}<a href={view.short.link}>{view.short.text}</a
								>{:else}{view.short.text}{/if})</span
						>{/if}
				</li>
			{/each}
		</ul>
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
