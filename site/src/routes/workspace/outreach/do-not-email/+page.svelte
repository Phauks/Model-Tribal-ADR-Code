<script lang="ts">
	// The do-not-email list, in Outreach's left column (design/outreach-redesign). It was a section of the old Outreach page.
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import { fullDate } from '../../inbox/dates.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const columns: TableColumn[] = $derived([
		{ key: 'address', header: 'Address', isRowHeader: true, sortable: true },
		{ key: 'why', header: 'Why', sortable: true },
		{ key: 'since', header: 'Since', type: 'date', sortable: true },
		...(data.canLift ? [{ key: 'change', header: 'Change', custom: true, keepOutOfDownload: true }] : [])
	]);
	const rows: TableRow[] = $derived(
		data.suppressions.map((item) => ({
			key: item.email,
			cells: {
				address: { text: item.email },
				why: { text: `${data.suppressionLabels[item.reason]}${item.note ? ` (${item.note})` : ''}` },
				since: { text: fullDate(item.createdAt), sortValue: item.createdAt },
				change: { text: '' }
			}
		}))
	);
</script>

{#snippet liftCell(row: TableRow)}
	<form method="post" action="?/lift">
		<input type="hidden" name="email" value={row.key} />
		<button class="button-quiet small" type="submit">Take off the list</button>
	</form>
{/snippet}

<svelte:head>
	<title>Do-not-email list · Outreach · Workspace · Tribal Law Project</title>
</svelte:head>

<h1>Do-not-email list</h1>
<p class="intro">
	Addresses here get no outreach. An address is added when its owner unsubscribes or asks in a reply, when mail to it bounces for good, or when they mark a message as spam. Nothing takes an address off by itself.
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

<form method="post" action="?/suppress" class="inline-form">
	<div class="field"><label for="suppress-email">Add an address</label><input id="suppress-email" name="email" type="email" required /></div>
	<div class="field"><label for="suppress-note">Why <span class="small muted">(optional)</span></label><input type="text" id="suppress-note" name="note" /></div>
	<button class="button-quiet" type="submit">Add</button>
</form>

{#if data.suppressions.length === 0}
	<p class="muted">Nobody yet.</p>
{:else}
	<DataTable
		identifier="do-not-email"
		label="Table: do-not-email list"
		{columns}
		{rows}
		defaultSort={{ key: 'since', direction: 'descending' }}
		rowName={['address', 'addresses']}
		cell={liftCell}
	/>
{/if}

<style>
	.intro {
		color: var(--color-ink-muted);
	}
	.inline-form {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: end;
		margin-bottom: var(--space-4);
	}
</style>
