<script lang="ts">
	import {
		contactKindLabels,
		contactMethods,
		methodLabelNames,
		methodLabels,
		methodStatusNames,
		shortDate,
		sourceKindNames,
		sourceKinds
	} from '#lib/address-book.ts';
	import type { PageProps } from './$types';
	import DateField from '#lib/components/DateField.svelte';

	let { data, form }: PageProps = $props();
	const contact = $derived(data.contact);

	function when(value: string): string {
		return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
	}
</script>

<svelte:head>
	<title>{contact.name} · Address book · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<p class="small"><a href="/workspace/address-book">Address book</a></p>
<h1>{contact.name}</h1>
<p class="muted">
	{contactKindLabels[contact.kind]}{#if contact.role}, {contact.role}{/if}{#if data.organization}, for
		<a href="/workspace/address-book/{data.organization.identifier}">{data.organization.name}</a>{/if}{#if contact.nationTitle}.
		Nation: <a href="/nations/{contact.nationIdentifier}">{contact.nationTitle}</a>{/if}
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

{#if contact.tags.length > 0}
	<p class="small">Tags: {contact.tags.join(', ')}</p>
{/if}
{#if contact.notes}<p class="preserve">{contact.notes}</p>{/if}

{#if data.members.length > 0}
	<h2>People who act for it</h2>
	<ul>
		{#each data.members as member (member.identifier)}
			<li><a href="/workspace/address-book/{member.identifier}">{member.name}</a>{#if member.role}, {member.role}{/if}</li>
		{/each}
	</ul>
{/if}

<h2>Emails and phones</h2>
{#if contact.methods.length === 0}
	<p>None yet.</p>
{/if}
{#each contact.methods as method (method.identifier)}
	<section class="panel" class:retired={method.status !== 'current'}>
		<h3>
			{method.method === 'email' ? 'Email' : 'Phone'}: {method.value}
			{#if method.preferred}<span class="small">(first choice)</span>{/if}
		</h3>
		{#if method.staleness.stale}
			<div class="notice notice-problem">
				{#each method.staleness.reasons as reason (reason)}<p>{reason}</p>{/each}
			</div>
		{/if}
		<dl class="summary-list">
			<div><dt>Kind</dt><dd>{methodLabelNames[method.label]}</dd></div>
			<div><dt>Status</dt><dd>{methodStatusNames[method.status]}</dd></div>
			<div>
				<dt>Found on</dt>
				<dd>
					{sourceKindNames[method.sourceKind]}:
					{#if method.sourceLink}<a href={method.sourceLink} rel="noreferrer">{method.sourceLabel}</a>{:else}{method.sourceLabel}{/if}
					{#if method.directoryName}<span class="small">(listed as “{method.directoryName}”)</span>{/if}
				</dd>
			</div>
			<div><dt>First recorded</dt><dd>{shortDate(method.firstRecordedOn)}</dd></div>
			<div><dt>Last seen at the source</dt><dd>{shortDate(method.verifiedOn)}</dd></div>
			{#if method.nextElectionOn}<div><dt>Nation's next election</dt><dd>{shortDate(method.nextElectionOn)}</dd></div>{/if}
			{#if method.note}<div><dt>Note</dt><dd class="preserve">{method.note}</dd></div>{/if}
		</dl>
		<div class="actions">
			<form method="post" action="?/verify">
				<input type="hidden" name="method" value={method.identifier} />
				<button class="button button-quiet" type="submit">Checked it today</button>
			</form>
			{#if method.status === 'current' && !method.preferred}
				<form method="post" action="?/prefer">
					<input type="hidden" name="method" value={method.identifier} />
					<button class="button button-quiet" type="submit">Make first choice</button>
				</form>
			{/if}
		</div>
		<details>
			<summary>Change the status</summary>
			<form method="post" action="?/status">
				<input type="hidden" name="method" value={method.identifier} />
				<div class="field">
					<label for="status-{method.identifier}">Status</label>
					<select id="status-{method.identifier}" name="status">
						{#each Object.entries(methodStatusNames) as [value, name] (value)}
							<option {value} selected={value === method.status}>{name}</option>
						{/each}
					</select>
				</div>
				<div class="field">
					<label for="status-note-{method.identifier}">Why (added to the note)</label>
					<input id="status-note-{method.identifier}" name="note" type="text" />
				</div>
				<button class="button" type="submit">Change status</button>
			</form>
		</details>
		<details>
			<summary>Edit</summary>
			<form method="post" action="?/editMethod">
				<input type="hidden" name="method" value={method.identifier} />
				<div class="field">
					<label for="value-{method.identifier}">{method.method === 'email' ? 'Email' : 'Phone'}</label>
					<input id="value-{method.identifier}" name="value" type="text" value={method.value} required />
				</div>
				<div class="field">
					<label for="label-{method.identifier}">Kind</label>
					<select id="label-{method.identifier}" name="label">
						{#each methodLabels as label (label)}
							<option value={label} selected={label === method.label}>{methodLabelNames[label]}</option>
						{/each}
					</select>
				</div>
				<div class="field">
					<label for="source-kind-{method.identifier}">Where it was found</label>
					<select id="source-kind-{method.identifier}" name="sourceKind">
						{#each sourceKinds as kind (kind)}
							<option value={kind} selected={kind === method.sourceKind}>{sourceKindNames[kind]}</option>
						{/each}
					</select>
				</div>
				<div class="field">
					<label for="source-label-{method.identifier}">Source, in words</label>
					<input id="source-label-{method.identifier}" name="sourceLabel" type="text" value={method.sourceLabel} required />
				</div>
				<div class="field">
					<label for="source-link-{method.identifier}">Source link</label>
					<input id="source-link-{method.identifier}" name="sourceLink" type="url" value={method.sourceLink ?? ''} />
				</div>
				<div class="field">
					<label for="verified-{method.identifier}">Last seen at the source</label>
					<DateField id="verified-{method.identifier}" name="verifiedOn" value={method.verifiedOn} max={data.today} required hint="" />
				</div>
				<div class="field">
					<label for="election-{method.identifier}">Nation's next election (optional)</label>
					<DateField id="election-{method.identifier}" name="nextElectionOn" value={method.nextElectionOn ?? ''} />
				</div>
				<div class="field">
					<label for="note-{method.identifier}">Note</label>
					<textarea id="note-{method.identifier}" name="note" rows="2">{method.note ?? ''}</textarea>
				</div>
				<button class="button" type="submit">Save</button>
			</form>
		</details>
	</section>
{/each}

<details class="panel">
	<summary>Add an email or phone</summary>
	<form method="post" action="?/addMethod">
		<div class="field">
			<label for="new-kind">Email or phone</label>
			<select id="new-kind" name="kind">
				{#each contactMethods as kind (kind)}
					<option value={kind}>{kind === 'email' ? 'Email' : 'Phone'}</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="new-value">Address or number</label>
			<input id="new-value" name="value" type="text" required />
		</div>
		<div class="field">
			<label for="new-label">Kind</label>
			<select id="new-label" name="label">
				{#each methodLabels as label (label)}
					<option value={label} selected={label === (contact.kind === 'organization' ? 'general-office' : 'work')}
						>{methodLabelNames[label]}</option
					>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="new-source-kind">Where it was found</label>
			<select id="new-source-kind" name="sourceKind">
				{#each sourceKinds as kind (kind)}
					<option value={kind} selected={kind === 'told-us'}>{sourceKindNames[kind]}</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="new-source-label">Source, in words</label>
			<input id="new-source-label" name="sourceLabel" type="text" required />
		</div>
		<div class="field">
			<label for="new-source-link">Source link (optional)</label>
			<input id="new-source-link" name="sourceLink" type="url" />
		</div>
		<div class="field">
			<label for="new-verified">Last seen at the source</label>
			<DateField id="new-verified" name="verifiedOn" value={data.today} max={data.today} hint="" />
		</div>
		<div class="field">
			<label for="new-election">Nation's next election (optional)</label>
			<DateField id="new-election" name="nextElectionOn" />
		</div>
		<div class="field">
			<label><input name="preferred" type="checkbox" /> Make it the first choice</label>
		</div>
		<div class="field">
			<label for="new-note">Note (optional)</label>
			<textarea id="new-note" name="note" rows="2"></textarea>
		</div>
		<button class="button" type="submit">Add</button>
	</form>
</details>

<details class="panel">
	<summary>Edit the contact</summary>
	<form method="post" action="?/edit">
		<div class="field">
			<label for="name">Name</label>
			<input id="name" name="name" type="text" value={contact.name} required maxlength="300" />
		</div>
		<div class="field">
			<label for="role">Role or title</label>
			<input id="role" name="role" type="text" value={contact.role ?? ''} maxlength="300" />
		</div>
		<div class="field">
			<label for="organization">Acts for</label>
			<select id="organization" name="organizationIdentifier">
				<option value="">None</option>
				{#each data.organizations as organization (organization.identifier)}
					<option value={organization.identifier} selected={organization.identifier === contact.organizationIdentifier}
						>{organization.name}</option
					>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="nation">Nation</label>
			<select id="nation" name="nationIdentifier">
				<option value="">None</option>
				{#each data.nations as nation (nation.identifier)}
					<option value={nation.identifier} selected={nation.identifier === contact.nationIdentifier}>{nation.title}</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="tags">Tags (separated by commas)</label>
			<input id="tags" name="tags" type="text" value={contact.tags.join(', ')} />
		</div>
		<div class="field">
			<label for="notes">Notes</label>
			<textarea id="notes" name="notes" rows="3">{contact.notes ?? ''}</textarea>
		</div>
		<button class="button" type="submit">Save</button>
	</form>
</details>

<h2>History</h2>
<ul class="history">
	{#each data.changes as change (change.identifier)}
		<li>
			{when(change.createdAt)}: {change.change}{#if change.methodIdentifier}
				({contact.methods.find((method) => method.identifier === change.methodIdentifier)?.value ?? 'an email or phone'}){/if},
			by {change.personName ?? 'the site'}
		</li>
	{/each}
</ul>

<style>
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-block: var(--space-2);
	}

	.retired h3 {
		color: var(--color-ink-muted);
	}

	.history {
		font-size: var(--font-size-small);
	}
</style>
