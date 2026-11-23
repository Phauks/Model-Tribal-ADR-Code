<script lang="ts">
	import { batchStatusLabels } from '#lib/mail.ts';
	import { fullDate } from '../inbox/dates.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const liveTemplates = $derived(data.templates.filter((template) => !template.archived));
</script>

<svelte:head>
	<title>Outreach · Workspace · Model Tribal ADR Code</title>
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
	<table>
		<thead><tr><th scope="col">Batch</th><th scope="col">Status</th><th scope="col">Sent</th><th scope="col">Waiting</th><th scope="col">Replied</th><th scope="col">Made</th></tr></thead>
		<tbody>
			{#each data.batches as batch (batch.identifier)}
				<tr>
					<td><a href="/workspace/outreach/{batch.identifier}">{batch.name}</a></td>
					<td>{batchStatusLabels[batch.status] ?? batch.status}</td>
					<td>{(batch.counts.sent ?? 0) + (batch.counts.replied ?? 0)}</td>
					<td>{batch.counts.queued ?? 0}</td>
					<td>{batch.counts.replied ?? 0}</td>
					<td>{fullDate(batch.createdAt)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<section class="panel" aria-labelledby="new-batch">
	<h3 id="new-batch">Make a batch</h3>
	{#if liveTemplates.length === 0}
		<p>Write a template first.</p>
	{:else}
		<form method="post" action="?/newBatch">
			<div class="field"><label for="batch-name">Name</label><input type="text" id="batch-name" name="name" required maxlength="120" /></div>
			<div class="field">
				<label for="batch-template">Template</label>
				<select id="batch-template" name="template" required>
					{#each liveTemplates as template (template.identifier)}<option value={template.identifier}>{template.name} (version {template.version})</option>{/each}
				</select>
			</div>
			<div class="field">
				<label for="per-day">At most this many a day <span class="small muted">(start low; a new mailbox is trusted slowly)</span></label>
				<input id="per-day" name="perDay" type="number" min="1" max="200" value="40" />
			</div>
			<div class="field">
				<label for="window-start">Sending hours, in each nation’s time zone</label>
				<span class="hours">
					from <input id="window-start" name="windowStart" type="number" min="0" max="23" value="9" aria-label="Start hour" />
					to <input name="windowEnd" type="number" min="1" max="24" value="15" aria-label="End hour" />
				</span>
			</div>
			<p><label><input type="checkbox" name="weekdaysOnly" value="yes" checked /> Weekdays only</label></p>
			<div class="field">
				<label for="follow-up-days">Remind me if no reply after this many days <span class="small muted">(optional)</span></label>
				<input id="follow-up-days" name="followUpDays" type="number" min="1" max="90" value="14" />
			</div>
			<p>
				<label><input type="checkbox" name="askAcknowledgment" value="yes" /> Add a visible “let us know you got this” link</label>
				<span class="small muted">It records only that the person pressed it.</span>
			</p>
			<button class="button" type="submit">Make the batch</button>
		</form>
	{/if}
</section>

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
	<table>
		<thead><tr><th scope="col">Address</th><th scope="col">Why</th><th scope="col">Since</th>{#if data.canManage}<th scope="col"><span class="visually-hidden">Change</span></th>{/if}</tr></thead>
		<tbody>
			{#each data.suppressions as item (item.email)}
				<tr>
					<td>{item.email}</td>
					<td>{data.suppressionLabels[item.reason]}{#if item.note} ({item.note}){/if}</td>
					<td>{fullDate(item.createdAt)}</td>
					{#if data.canManage}
						<td>
							<form method="post" action="?/lift">
								<input type="hidden" name="email" value={item.email} />
								<button class="button-quiet small" type="submit">Take off the list</button>
							</form>
						</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		margin-block: var(--space-3);
	}
	th,
	td {
		text-align: left;
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--color-line);
	}
	.hours input {
		width: 5rem;
	}
	.inline-form {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: end;
	}
</style>
