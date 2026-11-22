<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import { roleDescriptions, roleLabels, roles } from '#lib/permissions.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const values = $derived(form && 'values' in form ? form.values : undefined);
	const statusLabels = { invited: 'Invited, not signed in yet', active: 'Active', removed: 'Access removed' };

	function date(value: string | null): string {
		return value ? new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '';
	}

	function nationTitle(identifier: string | null): string {
		return data.nations.find((nation) => nation.identifier === identifier)?.title ?? identifier ?? '';
	}

	const columns: TableColumn[] = [
		{ key: 'name', header: 'Name', sortable: true, custom: true },
		{ key: 'role', header: 'Role', sortable: true, custom: true },
		{ key: 'status', header: 'Status', sortable: true, custom: true },
		{ key: 'added', header: 'Added', type: 'date', sortable: true, custom: true },
		{ key: 'access', header: 'Access', custom: true }
	];
	const peopleByKey = $derived(new Map(data.people.map((listed) => [listed.identifier, listed])));
	const rows: TableRow[] = $derived(
		data.people.map((listed) => ({
			key: listed.identifier,
			cells: {
				name: { text: `${listed.displayName} ${listed.email}`, sortValue: listed.displayName },
				role: { text: roleLabels[listed.role] },
				status: { text: statusLabels[listed.status] },
				added: { text: date(listed.addedAt), sortValue: listed.addedAt },
				access: { text: '' }
			}
		}))
	);
</script>

{#snippet cell(row: TableRow, column: TableColumn)}
	{@const listed = peopleByKey.get(row.key)}
	{#if listed}
		{#if column.key === 'name'}
			{listed.displayName}<br /><span class="small muted">{listed.email}</span>
		{:else if column.key === 'role'}
			{roleLabels[listed.role]}
			{#if listed.nationIdentifier}<br /><span class="small">for {nationTitle(listed.nationIdentifier)}</span>{/if}
		{:else if column.key === 'status'}
			{statusLabels[listed.status]}
			{#if listed.lastSignedInAt}<br /><span class="small muted">Last signed in {date(listed.lastSignedInAt)}</span>{/if}
		{:else if column.key === 'added'}
			{date(listed.addedAt)}{#if listed.addedByName}<br /><span class="small muted">by {listed.addedByName}</span>{/if}
		{:else}
			{#if listed.role !== 'lead-author'}
				<a class="small" href="/workspace/access?person={listed.identifier}">Document access</a>
			{/if}
			{#if listed.status === 'invited'}
				<form method="post" action="?/link" class="row-form">
					<input type="hidden" name="identifier" value={listed.identifier} />
					<button class="button button-quiet" type="submit">Make a sign-in link</button>
				</form>
			{/if}
			<form method="post" action="?/access" class="row-form">
				<input type="hidden" name="identifier" value={listed.identifier} />
				{#if listed.status === 'removed'}
					<input type="hidden" name="change" value="restore" />
					<button class="button button-quiet" type="submit">Restore access</button>
				{:else if listed.identifier !== data.person.identifier}
					<input type="hidden" name="change" value="remove" />
					<button class="button button-quiet" type="submit">Remove access</button>
				{/if}
			</form>
		{/if}
	{/if}
{/snippet}

<svelte:head>
	<title>People · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>People</h1>
<p>
	Who can sign in and what each person can do. Nobody can sign in until they are added here. Every
	change is recorded below.
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status">
		<p>{form.done}</p>
		{#if 'link' in form && form.link}
			<p><label for="invitation-link">Sign-in link</label></p>
			<input id="invitation-link" class="link-box" type="text" readonly value={form.link} onfocus={(event) => event.currentTarget.select()} />
			<p class="small">Send it by a private message or email. Anyone who has the link can sign in as this person, once.</p>
		{/if}
	</div>
{/if}

<h2>Roles</h2>
<dl class="summary-list">
	{#each roles as role (role)}
		<div><dt>{roleLabels[role]}</dt><dd>{roleDescriptions[role]}</dd></div>
	{/each}
</dl>

<h2>Everyone on the list</h2>
<DataTable identifier="people" label="Table: people" {columns} {rows} rowName={['person', 'people']} {cell} />

<form method="post" action="?/role" class="panel">
	<h2>Change a role</h2>
	<div class="field">
		<label for="role-person">Person</label>
		<select id="role-person" name="identifier">
			{#each data.people.filter((listed) => listed.status !== 'removed') as listed (listed.identifier)}
				<option value={listed.identifier}>{listed.displayName} ({roleLabels[listed.role].toLocaleLowerCase('en-US')})</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="role-role">New role</label>
		<select id="role-role" name="role">
			{#each roles as role (role)}
				<option value={role}>{roleLabels[role]}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="role-nation">Nation (nation reviewers only)</label>
		<select id="role-nation" name="nationIdentifier">
			<option value="">Choose…</option>
			{#each data.nations as nation (nation.identifier)}
				<option value={nation.identifier}>{nation.title}</option>
			{/each}
		</select>
	</div>
	<button class="button" type="submit">Change the role</button>
</form>

<form method="post" action="?/invite" class="panel">
	<h2>Add a person</h2>
	<p class="small">
		They sign in with this email address, using a code the site emails them. You also get a sign-in
		link to send them yourself, which works once, for 7 days.
	</p>
	<div class="field">
		<label for="displayName">Name</label>
		<input type="text" id="displayName" name="displayName" value={values?.displayName ?? ''} />
	</div>
	<div class="field">
		<label for="email">Email address</label>
		<input type="email" id="email" name="email" value={values?.email ?? ''} autocomplete="off" />
	</div>
	<div class="field">
		<label for="invite-role">Role</label>
		<select id="invite-role" name="role">
			{#each roles as role (role)}
				<option value={role}>{roleLabels[role]}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="invite-nation">Nation (nation reviewers only)</label>
		<p class="hint">A nation reviewer sees and reviews only this nation’s record, unless you open more to them on the Access page.</p>
		<select id="invite-nation" name="nationIdentifier">
			<option value="">Choose…</option>
			{#each data.nations as nation (nation.identifier)}
				<option value={nation.identifier}>{nation.title}</option>
			{/each}
		</select>
	</div>
	<button class="button" type="submit">Add the person</button>
</form>

<h2>Changes to access</h2>
{#if data.history.length === 0}
	<p>None yet.</p>
{:else}
	<ol class="history">
		{#each data.history as event (event.identifier)}
			<li>
				<span class="small muted">{date(event.createdAt)}</span>
				{event.targetName ?? 'Someone'}: {event.action}{#if event.note} ({event.note}){/if}{#if event.actorName && event.actorName !== event.targetName}, by {event.actorName}{/if}
			</li>
		{/each}
	</ol>
{/if}

<style>
	.row-form {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.history {
		padding-left: var(--space-5);
	}

	.link-box {
		width: 100%;
		font-family: monospace;
	}
</style>
