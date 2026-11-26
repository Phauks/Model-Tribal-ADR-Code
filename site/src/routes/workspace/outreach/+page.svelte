<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import { batchStatusLabels } from '#lib/mail.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import { fullDate } from '../inbox/dates.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const liveTemplates = $derived(data.templates.filter((template) => !template.archived));

	const batchColumns: TableColumn[] = [
		{ key: 'batch', header: 'Batch', isRowHeader: true, sortable: true },
		{ key: 'status', header: 'Status', sortable: true },
		{ key: 'sent', header: 'Sent', type: 'number', sortable: true },
		{ key: 'waiting', header: 'Waiting', type: 'number', sortable: true },
		{ key: 'replied', header: 'Replied', type: 'number', sortable: true },
		{ key: 'made', header: 'Made', type: 'date', sortable: true }
	];
	const batchRows: TableRow[] = $derived(
		data.batches.map((batch) => {
			const sent = (batch.counts.sent ?? 0) + (batch.counts.replied ?? 0);
			return {
				key: batch.identifier,
				cells: {
					batch: { text: batch.name, href: `/workspace/outreach/${batch.identifier}` },
					status: { text: batchStatusLabels[batch.status] ?? batch.status },
					sent: { text: String(sent), sortValue: sent },
					waiting: { text: String(batch.counts.queued ?? 0), sortValue: batch.counts.queued ?? 0 },
					replied: { text: String(batch.counts.replied ?? 0), sortValue: batch.counts.replied ?? 0 },
					made: { text: fullDate(batch.createdAt), sortValue: batch.createdAt }
				}
			};
		})
	);

	const suppressionColumns: TableColumn[] = $derived([
		{ key: 'address', header: 'Address', isRowHeader: true, sortable: true },
		{ key: 'why', header: 'Why', sortable: true },
		{ key: 'since', header: 'Since', type: 'date', sortable: true },
		...(data.canManage ? [{ key: 'change', header: 'Change', custom: true, keepOutOfDownload: true }] : [])
	]);
	const suppressionRows: TableRow[] = $derived(
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
	<title>Outreach · Workspace · Tribal Law Project</title>
</svelte:head>

<h1>Outreach</h1>
<p class="lead">
	Letters to nations from the address book, sent a few at a time, in working hours in each nation’s time zone, through the outreach mailbox.
	Every letter says how to stop further mail, and nothing hidden tracks whether it was opened.
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

{#if data.problems.length}
	<div class="notice" role="status">
		<p>Batches can be prepared now, but nothing can be sent until these are set up (site/MAIL.md, “Switching email on”):</p>
		<ul>{#each data.problems as problem (problem)}<li>{problem}</li>{/each}</ul>
	</div>
{:else if data.carrier}
	<p class="small muted">Outreach goes from {data.carrier}.</p>
{/if}

<h2>Batches</h2>
{#if data.batches.length === 0}
	<p class="muted">No batches yet.</p>
{:else}
	<DataTable
		identifier="outreach-batches"
		label="Table: outreach batches"
		columns={batchColumns}
		rows={batchRows}
		defaultSort={{ key: 'made', direction: 'descending' }}
		rowName={['batch', 'batches']}
	/>
{/if}

{#if liveTemplates.length === 0}
	<p>Write a template first, then make a batch.</p>
{:else}
	<p><a class="button" href="/workspace/outreach/new">New outreach batch</a></p>
{/if}

<h2>Templates</h2>
<p><a class="button-quiet" href="/workspace/outreach/templates/new">Write a template</a></p>
<ul>
	{#each data.templates as template (template.identifier)}
		<li>
			<a href="/workspace/outreach/templates/{template.identifier}">{template.name}</a>
			<span class="small muted">version {template.version}, {fullDate(template.updatedAt)}{template.archived ? ', archived' : ''}</span>
		</li>
	{/each}
</ul>

<h2>Do-not-email list</h2>
<p>
	Addresses here get no outreach. An address is added when its owner unsubscribes or asks in a reply, when mail to it bounces for good, or
	when they mark a message as spam. Nothing takes an address off by itself.
</p>
{#if data.canManage}
	<form method="post" action="?/suppress" class="inline-form">
		<div class="field"><label for="suppress-email">Add an address</label><input id="suppress-email" name="email" type="email" required /></div>
		<div class="field"><label for="suppress-note">Why <span class="small muted">(optional)</span></label><input type="text" id="suppress-note" name="note" /></div>
		<button class="button-quiet" type="submit">Add</button>
	</form>
{/if}
{#if data.suppressions.length === 0}
	<p class="muted">Nobody yet.</p>
{:else}
	<DataTable
		identifier="do-not-email"
		label="Table: do-not-email list"
		columns={suppressionColumns}
		rows={suppressionRows}
		defaultSort={{ key: 'since', direction: 'descending' }}
		rowName={['address', 'addresses']}
		cell={liftCell}
	/>
{/if}

<style>
	.inline-form {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: end;
	}
</style>
