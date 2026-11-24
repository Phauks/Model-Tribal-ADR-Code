<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import { batchStatusLabels, deliveryLabels, recipientStatusLabels } from '#lib/mail.ts';
	import { fullDate } from '../../inbox/dates.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const batch = $derived(data.batch);
	const open = $derived(batch.status !== 'done' && batch.status !== 'cancelled');
</script>

<svelte:head>
	<title>{batch.name} · Outreach · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Workspace', href: '/workspace' },
		{ label: 'Outreach', href: '/workspace/outreach' }
	]}
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
			<label for="tag">With the tag</label>
			<select id="tag" name="tag">
				<option value="">Any tag</option>
				{#each data.tags as tag (tag)}<option value={tag}>{tag}</option>{/each}
			</select>
		</div>
		<div class="field">
			<label for="label">Kind of address</label>
			<select id="label" name="label">
				<option value="">Any</option>
				<option value="general-office">A general office address</option>
				<option value="leader">A leader’s own address</option>
				<option value="state-listed">Listed by a state government</option>
			</select>
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
	<table>
		<thead>
			<tr><th scope="col">Recipient</th><th scope="col">Nation</th><th scope="col">Status</th><th scope="col">Delivery</th><th scope="col"><span class="visually-hidden">Change</span></th></tr>
		</thead>
		<tbody>
			{#each data.recipients as recipient (recipient.identifier)}
				<tr>
					<td>{recipient.name}<br /><span class="small muted">{recipient.email}</span></td>
					<td>{recipient.nationIdentifier ? (data.nationNames[recipient.nationIdentifier] ?? recipient.nationIdentifier) : ''}</td>
					<td>
						{recipientStatusLabels[recipient.status] ?? recipient.status}
						{#if recipient.skipReason}<br /><span class="small muted">{recipient.skipReason}</span>{/if}
						{#if recipient.sentAt}<br /><span class="small muted">{fullDate(recipient.sentAt)}</span>{/if}
					</td>
					<td>
						{recipient.deliveryStatus ? deliveryLabels[recipient.deliveryStatus] : ''}
						{#if recipient.acknowledgedAt}<br /><span class="small">Said they got it</span>{/if}
						{#if recipient.threadIdentifier}<br /><a class="small" href="/workspace/inbox/{recipient.threadIdentifier}">Conversation</a>{/if}
					</td>
					<td>
						{#if recipient.status === 'queued' || recipient.status === 'skipped'}
							<form method="post" action="?/remove"><input type="hidden" name="recipient" value={recipient.identifier} /><button class="button-quiet small" type="submit">Remove</button></form>
						{:else if recipient.status === 'failed'}
							<form method="post" action="?/retry"><input type="hidden" name="recipient" value={recipient.identifier} /><button class="button-quiet small" type="submit">Try again</button></form>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
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
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		text-align: left;
		vertical-align: top;
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--color-line);
	}
</style>
