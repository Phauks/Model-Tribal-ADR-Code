<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const columns: TableColumn[] = [
		{ key: 'name', header: 'Name', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'states', header: 'States', sortable: true, searchable: true },
		{ key: 'review', header: 'Review status', sortable: true, searchable: true }
	];

	/** Groups this long get a search box; a short list is quicker to scan. */
	const searchFrom = 10;

	function rowsOf(group: PageProps['data']['groups'][number]): TableRow[] {
		return group.rows.map((row) => ({
			key: row.id,
			cells: {
				name: { text: row.name, href: `/nations/${row.id}` },
				states: { text: row.states },
				review: { text: row.review }
			}
		}));
	}
</script>

<svelte:head>
	<title>Nations · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Native nations</h1>
	<p class="lead">
		One page for every nation and community, drafted from public sources, with a way for each nation
		to correct, restrict or remove what the project says about it.
	</p>
	{#if data.example}
		<div class="notice" role="note">
			<p>
				The nation records are not published yet. The page below is a fictitious example that shows
				the layout.
			</p>
		</div>
	{/if}
	<p>
		<a href="/nations/map">See the map</a> of nations by state, with the Bureau of Indian Affairs
		regions.
	</p>
	<p>
		<strong>Is your nation missing?</strong>
		<a href="/requests?kind=add-nation">Ask to be added</a>. One federal or state government source
		that names the nation is enough.
	</p>
	<p class="small muted">
		The Native Hawaiian community and the Indigenous peoples of the territories are listed in their
		own groups, not as tribes.
	</p>
</div>

{#each data.groups as group (group.entityType)}
	<section aria-labelledby="group-{group.entityType}">
		<h2 id="group-{group.entityType}">{group.label}</h2>
		<p class="small muted">{group.rows.length.toLocaleString('en-US')} pages</p>
		<DataTable
			identifier="nations-{group.entityType}"
			label="Table: {group.label}"
			{columns}
			rows={rowsOf(group)}
			defaultSort={{ key: 'name', direction: 'ascending' }}
			searchLabel={group.rows.length >= searchFrom ? `Search ${group.label}` : undefined}
			rowName={['page', 'pages']}
		>
			{#snippet empty(query)}
				<p>
					No page in this list matches “{query}”. <strong>Is your nation missing?</strong>
					<a href="/requests?kind=add-nation">Ask to be added</a>.
				</p>
			{/snippet}
		</DataTable>
	</section>
{/each}
