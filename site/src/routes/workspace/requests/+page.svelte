<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import { requestKindLabels, requestOutcomeLabels, requestStatusLabels } from '#lib/requests.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const views = [
		{ value: 'open', label: 'Open' },
		{ value: 'resolved', label: 'Resolved' },
		{ value: 'all', label: 'All' }
	];

	function date(value: string): string {
		return new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' });
	}

	const columns: TableColumn[] = [
		{ key: 'reference', header: 'Reference', isRowHeader: true, sortable: true },
		{ key: 'kind', header: 'Kind', sortable: true },
		{ key: 'about', header: 'About', sortable: true },
		{ key: 'status', header: 'Status', sortable: true },
		{ key: 'received', header: 'Received', type: 'date', sortable: true },
		{ key: 'target', header: 'Next target', type: 'date', sortable: true, custom: true }
	];
	const requestsByKey = $derived(new Map(data.requests.map((request) => [request.identifier, request])));
	const rows: TableRow[] = $derived(
		data.requests.map((request) => {
			const next = request.deadlines[0];
			return {
				key: request.identifier,
				cells: {
					reference: { text: request.reference, href: `/workspace/requests/${request.reference}` },
					kind: { text: requestKindLabels[request.kind] },
					about: { text: request.missingNationOfficialName ?? request.nationIdentifier ?? '' },
					status: {
						text: request.outcome
							? `${requestStatusLabels[request.status]}: ${requestOutcomeLabels[request.outcome]}`
							: requestStatusLabels[request.status]
					},
					received: { text: date(request.receivedAt), sortValue: request.receivedAt },
					target: { text: next ? `${next.label} ${date(next.due)}` : '', sortValue: next?.due }
				}
			};
		})
	);
</script>

{#snippet cell(row: TableRow)}
	{#each requestsByKey.get(row.key)?.deadlines.slice(0, 1) ?? [] as deadline (deadline.label)}
		<span class:overdue={deadline.overdue}>
			{deadline.overdue ? 'Past: ' : ''}{deadline.label.toLocaleLowerCase('en-US')} {date(deadline.due)}
		</span>
	{/each}
{/snippet}

<svelte:head>
	<title>Requests · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Requests</h1>
<p>
	Requests sent through the website, newest first. Targets come from
	<em>docs/requests.md</em>: acknowledge within 7 days, hide material named in a restrict or remove request
	within 7 days, decide within 30 days of acknowledging.
</p>
{#if data.cleared > 0}
	<div class="notice" role="status">
		<p>
			Personal details were deleted from {data.cleared}
			{data.cleared === 1 ? 'request' : 'requests'} resolved more than 12 months ago.
		</p>
	</div>
{/if}

<p class="views">
	Show:
	{#each views as view (view.value)}
		{#if view.value === data.show}
			<strong aria-current="page">{view.label}</strong>
		{:else}
			<a href="?show={view.value}">{view.label}</a>
		{/if}
	{/each}
</p>

{#if data.requests.length === 0}
	<p>No requests here.</p>
{:else}
	<DataTable
		identifier="requests"
		label="Table: requests"
		{columns}
		{rows}
		defaultSort={{ key: 'received', direction: 'descending' }}
		rowName={['request', 'requests']}
		{cell}
	/>
{/if}

<style>
	.views {
		display: flex;
		gap: var(--space-3);
	}

	.overdue {
		color: var(--color-danger);
		font-weight: var(--font-weight-semibold);
	}
</style>
