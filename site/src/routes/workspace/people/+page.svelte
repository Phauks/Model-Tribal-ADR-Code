<script lang="ts">
	import { roleDescriptions, roleLabels, roles } from '#lib/permissions.ts';
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
</script>

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
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

<h2>Roles</h2>
<dl class="summary-list">
	{#each roles as role (role)}
		<div><dt>{roleLabels[role]}</dt><dd>{roleDescriptions[role]}</dd></div>
	{/each}
</dl>

<h2>Everyone on the list</h2>
<div class="table-scroll" role="region" aria-label="Table: people" tabindex="-1">
	<table>
		<thead>
			<tr>
				<th scope="col">Name</th>
				<th scope="col">Role</th>
				<th scope="col">Status</th>
				<th scope="col">Added</th>
				<th scope="col">Access</th>
			</tr>
		</thead>
		<tbody>
			{#each data.people as listed (listed.identifier)}
				<tr>
					<td>{listed.displayName}<br /><span class="small muted">{listed.email}</span></td>
					<td>
						{roleLabels[listed.role]}
						{#if listed.nationIdentifier}<br /><span class="small">for {nationTitle(listed.nationIdentifier)}</span>{/if}
					</td>
					<td>
						{statusLabels[listed.status]}
						{#if listed.lastSignedInAt}<br /><span class="small muted">Last signed in {date(listed.lastSignedInAt)}</span>{/if}
					</td>
					<td>{date(listed.addedAt)}{#if listed.addedByName}<br /><span class="small muted">by {listed.addedByName}</span>{/if}</td>
					<td>
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
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

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
		They sign in with Auth0 using this email address. Auth0 must have verified the address, for
		example by signing in with Google or by the link Auth0 emails after sign-up.
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
		<p class="hint">A nation reviewer sees and reviews only this nation’s record, and nothing else.</p>
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
</style>
