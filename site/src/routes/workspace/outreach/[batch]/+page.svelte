<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import { batchStatusLabels, deliveryLabels, recipientStatusLabels } from '#lib/mail.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import { fullDate } from '../../inbox/dates.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const batch = $derived(data.batch);
	const open = $derived(batch.status !== 'done' && batch.status !== 'cancelled');

	const tagChoices = $derived([{ value: '', label: 'Any tag' }, ...data.tags.map((tag) => ({ value: tag, label: tag }))]);
	const addressKindChoices = [
		{ value: '', label: 'Any' },
		{ value: 'general-office', label: 'A general office address' },
		{ value: 'leader', label: 'A leader’s own address' },
		{ value: 'state-listed', label: 'Listed by a state government' }
	];

	const columns: TableColumn[] = [
		{ key: 'recipient', header: 'Recipient', isRowHeader: true, sortable: true, custom: true },
		{ key: 'nation', header: 'Nation', sortable: true },
		{ key: 'status', header: 'Status', sortable: true, custom: true },
		{ key: 'delivery', header: 'Delivery', sortable: true, custom: true },
		{ key: 'change', header: 'Change', custom: true, keepOutOfDownload: true }
	];
	const recipientsByKey = $derived(new Map(data.recipients.map((recipient) => [recipient.identifier, recipient])));
	const rows: TableRow[] = $derived(
		data.recipients.map((recipient) => ({
			key: recipient.identifier,
			cells: {
				recipient: { text: `${recipient.name} ${recipient.email}`, sortValue: recipient.name },
				nation: { text: recipient.nationIdentifier ? (data.nationNames[recipient.nationIdentifier] ?? recipient.nationIdentifier) : '' },
				status: { text: recipientStatusLabels[recipient.status] ?? recipient.status },
				delivery: { text: recipient.deliveryStatus ? deliveryLabels[recipient.deliveryStatus] : '' },
				change: { text: '' }
			}
		}))
	);
</script>

{#snippet cell(row: TableRow, column: TableColumn)}
	{@const recipient = recipientsByKey.get(row.key)}
	{#if recipient}
		{#if column.key === 'recipient'}
			{recipient.name}<br /><span class="small muted">{recipient.email}</span>
		{:else if column.key === 'status'}
			{recipientStatusLabels[recipient.status] ?? recipient.status}
			{#if recipient.skipReason}<br /><span class="small muted">{recipient.skipReason}</span>{/if}
			{#if recipient.sentAt}<br /><span class="small muted">{fullDate(recipient.sentAt)}</span>{/if}
		{:else if column.key === 'delivery'}
			{recipient.deliveryStatus ? deliveryLabels[recipient.deliveryStatus] : ''}
			{#if recipient.acknowledgedAt}<br /><span class="small">Said they got it</span>{/if}
			{#if recipient.threadIdentifier}<br /><a class="small" href="/workspace/inbox/{recipient.threadIdentifier}">Conversation</a>{/if}
		{:else if recipient.status === 'queued' || recipient.status === 'skipped'}
			<form method="post" action="?/remove"><input type="hidden" name="recipient" value={recipient.identifier} /><button class="button-quiet small" type="submit">Remove</button></form>
		{:else if recipient.status === 'failed'}
			<form method="post" action="?/retry"><input type="hidden" name="recipient" value={recipient.identifier} /><button class="button-quiet small" type="submit">Try again</button></form>
		{/if}
	{/if}
{/snippet}

<svelte:head>
	<title>{batch.name} · Outreach · Workspace · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Workspace', href: '/workspace' },
		{ label: 'Outreach', href: '/workspace/outreach' }
	]}
	current={batch.name}
/>
<h1>{batch.name}</h1>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

<dl class="summary-list">
	<div><dt>Status</dt><dd>{batchStatusLabels[batch.status] ?? batch.status}</dd></div>
	<div><dt>Pace</dt><dd>At most {batch.perDay} a day, {batch.windowStartHour}:00 to {batch.windowEndHour}:00 in each nation’s time zone{batch.weekdaysOnly ? ', weekdays only' : ''}</dd></div>
	<div><dt>Reminder</dt><dd>{batch.followUpDays ? `If no reply after ${batch.followUpDays} days` : 'None'}</dd></div>
	<div><dt>“Let us know you got this” link</dt><dd>{batch.askAcknowledgment ? 'Yes' : 'No'}</dd></div>
	<div>
		<dt>Recipients</dt>
		<dd>
			{#each Object.entries(batch.counts) as [status, count] (status)}<span class="count">{recipientStatusLabels[status] ?? status}: {count}</span>{/each}
		</dd>
	</div>
	{#if batch.startedAt}<div><dt>Started</dt><dd>{fullDate(batch.startedAt)}</dd></div>{/if}
	{#if batch.finishedAt}<div><dt>Finished</dt><dd>{fullDate(batch.finishedAt)}</dd></div>{/if}
</dl>

{#if open}
	<form method="post" action="?/status" class="actions">
		{#if (batch.status === 'draft' || batch.status === 'paused') && data.problems.length === 0 && batch.counts.queued > 0}
			<button class="button" type="submit" name="status" value="running">
				{batch.status === 'paused' ? 'Start again' : 'Start sending'}
			</button>
		{/if}
		{#if batch.status === 'running'}<button class="button-quiet" type="submit" name="status" value="paused">Pause</button>{/if}
		<button class="button-quiet" type="submit" name="status" value="cancelled">Cancel the batch</button>
	</form>
	{#if data.problems.length}
		<p class="small muted">Sending needs setting up first: {data.problems.join(' ')}</p>
	{/if}
{/if}

{#if data.preview}
	<h2>The first message, as it will read</h2>
	<div class="panel">
		<p class="small muted">To {data.preview.to}</p>
		<p><strong>{data.preview.subject}</strong></p>
		<p class="text">{data.preview.text}</p>
	</div>
{/if}

{#if open}
	<h2>Add recipients</h2>
	<form method="post" action="?/addFromAddressBook" class="panel">
		<h3>From the address book</h3>
		<p class="small">
			{data.addressBookSize} contacts have an email in use. Each gets the preferred email, once. Addresses on the do-not-email list are left out.
		</p>
		<div class="field">
			<Dropdown label="With the tag" name="tag" choices={tagChoices} value="" />
		</div>
		<div class="field">
			<Dropdown label="Kind of address" name="label" choices={addressKindChoices} value="" />
		</div>
		<p><label><input type="checkbox" name="nationsOnly" value="yes" checked /> Only contacts linked to a nation</label></p>
		<button class="button-quiet" type="submit">Add the matching contacts</button>
	</form>
	<form method="post" action="?/addOne" class="panel">
		<h3>One address</h3>
		<div class="field"><label for="one-email">Email</label><input id="one-email" name="email" type="email" required /></div>
		<div class="field"><label for="one-name">Name or office</label><input type="text" id="one-name" name="name" required /></div>
		<div class="field"><label for="one-role">Title <span class="small muted">(optional)</span></label><input type="text" id="one-role" name="role" /></div>
		<div class="field"><label for="one-nation">Nation’s id on the site <span class="small muted">(optional, such as hopi-tribe-of-arizona)</span></label><input type="text" id="one-nation" name="nation" /></div>
		<button class="button-quiet" type="submit">Add</button>
	</form>
{/if}

<h2>Recipients</h2>
{#if data.recipients.length === 0}
	<p class="muted">None yet.</p>
{:else}
	<DataTable identifier="recipients" label="Table: recipients" {columns} {rows} rowName={['recipient', 'recipients']} {cell} />
{/if}

<style>
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-block: var(--space-3);
	}
	.count {
		margin-right: var(--space-3);
	}
	.text {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
