<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import { decisionLabels, subjectKindLabels, subjectKinds } from '#lib/permissions.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';
	import { mediumDate } from '#lib/readable-date.ts';

	let { data }: PageProps = $props();
	const searching = $derived(data.query !== '' || data.kind !== undefined);

	const columns: TableColumn[] = [
		{ key: 'name', header: 'Name', isRowHeader: true, sortable: true },
		{ key: 'kind', header: 'Kind', sortable: true },
		{ key: 'latest', header: 'Latest review', type: 'date', sortable: true, custom: true }
	];
	const rows: TableRow[] = $derived(
		data.subjects.map((subject) => ({
			key: `${subject.kind}/${subject.identifier}`,
			cells: {
				name: { text: subject.title, href: `/workspace/reviews/${subject.kind}/${subject.identifier}` },
				kind: { text: subjectKindLabels[subject.kind] },
				latest: subject.latest
					? {
							text: `${decisionLabels[subject.latest.decision]}, ${subject.latest.personName}, ${mediumDate(subject.latest.createdAt)}`,
							sortValue: subject.latest.createdAt
						}
					: { text: '' }
			}
		}))
	);
</script>

{#snippet cell(row: TableRow, column: TableColumn)}
	{@const text = row.cells[column.key].text}
	{#if text}{text}{:else}<span class="muted">None</span>{/if}
{/snippet}

<svelte:head>
	<title>Reviews · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Reviews</h1>
<p>
	Find a record to sign off on, ask for changes, or comment. Each review records the content version it
	applies to, so a later change to the text shows which approvals came before it.
</p>

<form method="get" class="search">
	<div class="field">
		<label for="search">Name or identifier</label>
		<input type="search" id="search" name="search" value={data.query} />
	</div>
	<div class="field">
		<label for="kind">Kind</label>
		<select id="kind" name="kind">
			<option value="">Any</option>
			{#each subjectKinds as kind (kind)}
				{#if data.counts[kind] > 0}
					<option value={kind} selected={data.kind === kind}>{subjectKindLabels[kind]} ({data.counts[kind]})</option>
				{/if}
			{/each}
		</select>
	</div>
	<button class="button" type="submit">Search</button>
</form>

{#if searching}
	<p>
		{data.matchCount.toLocaleString('en-US')} found{data.matchCount > data.shown ? `; the first ${data.shown} are shown` : ''}.
	</p>
{:else}
	<h2>Reviewed most recently</h2>
{/if}

{#if data.subjects.length === 0}
	<p>{searching ? 'Nothing matches.' : 'No reviews recorded yet. Search above to find a record.'}</p>
{:else}
	<DataTable identifier="reviews" label="Table: content to review" {columns} {rows} {cell} />
{/if}

<style>
	.search {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0 var(--space-4);
		margin-bottom: var(--space-4);
	}

	.search .field {
		flex: 1 1 14rem;
	}

	.search .button {
		margin-bottom: var(--space-4);
	}
</style>
