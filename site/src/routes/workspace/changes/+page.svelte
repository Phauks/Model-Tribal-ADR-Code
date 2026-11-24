<script lang="ts">
	import { dateTime } from '#lib/change-dates.ts';
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import { hideReasons, isHideReason } from '#lib/page-history.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function parts(hidden: (typeof data.hidden)[number]): string {
		return [hidden.hideText && 'text', hidden.hideSummary && 'summary', hidden.hidePerson && 'name'].filter(Boolean).join(', ');
	}

	const columns: TableColumn[] = [
		{ key: 'change', header: 'Change', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'hidden', header: 'Hidden', sortable: true },
		{ key: 'reason', header: 'Reason readers see', sortable: true, filterable: true },
		{ key: 'by', header: 'By', sortable: true },
		{ key: 'when', header: 'When', type: 'date', sortable: true }
	];
	const rows: TableRow[] = $derived(
		data.hidden.map((hidden) => ({
			key: String(hidden.id),
			cells: {
				change: { text: String(hidden.id), href: `/workspace/changes/${hidden.id}` },
				hidden: { text: parts(hidden) },
				reason: { text: isHideReason(hidden.reason) ? hideReasons[hidden.reason] : hidden.reason },
				by: { text: hidden.hiddenBy ?? '' },
				when: { text: dateTime(hidden.hiddenAt), sortValue: hidden.hiddenAt }
			}
		}))
	);
</script>

<svelte:head>
	<title>Hidden changes · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Hidden changes</h1>
<p>
	Changes in Recent changes with a part hidden, the way a wiki hides a revision: the text of a version, its summary, or
	who made it. A hidden change stays in the list with a line through what is hidden. To hide part of another change,
	open it from <a href="/changes">Recent changes</a> and choose “Hide part of this change”. Each hiding is recorded in the
	<a href="/workspace/activity">activity log</a>.
</p>
<p class="small muted">
	An essay publication held back from the essay’s page in the workspace is hidden from Recent changes too, and is not
	listed here.
</p>

{#if data.hidden.length === 0}
	<p>Nothing is hidden.</p>
{:else}
	<DataTable
		identifier="hidden-changes"
		label="Table: hidden changes"
		{columns}
		{rows}
		defaultSort={{ key: 'when', direction: 'descending' }}
		rowName={['change', 'changes']}
		filters
	/>
{/if}
