<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import Video from '@lucide/svelte/icons/video';
	import CopyLink from '#lib/components/CopyLink.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import RoomRecords from '#lib/components/RoomRecords.svelte';
	import RoomFields from '../RoomFields.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const values = $derived(form && 'values' in form && form.values ? form.values : data.values);
	const field = $derived(form && 'field' in form ? form.field : undefined);
	const problem = $derived(form && 'problem' in form ? form.problem : undefined);
	const done = $derived(form && 'done' in form ? form.done : undefined);
	const invite = $derived(form && 'invite' in form ? form.invite : undefined);
	const formField = $derived(typeof field === 'string' && field !== 'invite-name' ? field : undefined);

	// The times come formatted, so the table keeps the order it is given in rather than sorting by them.
	const inviteColumns: TableColumn[] = [
		{ key: 'for', header: 'For', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'as', header: 'As', sortable: true },
		{ key: 'made', header: 'Made' },
		{ key: 'used', header: 'Last used' },
		{ key: 'state', header: 'On or off', custom: true, hiddenHeader: true }
	];
	const inviteRows: TableRow[] = $derived(
		data.invites.map((item) => ({
			key: item.identifier,
			cells: {
				for: { text: item.name },
				as: { text: item.role },
				made: { text: item.made },
				used: { text: item.used ?? 'Not yet' },
				state: { text: item.revoked ? 'Off' : 'On' }
			}
		}))
	);
	const invites = $derived(new Map(data.invites.map((item) => [item.identifier, item])));
</script>

<svelte:head>
	<title>{data.room.title} · Video rooms · Workspace · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Workspace', href: '/workspace' },
		{ label: 'Video rooms', href: '/workspace/rooms' }
	]}
	current={data.room.title}
/>
<h1>{data.room.title}</h1>
<p>{data.room.when} · {data.room.visibility === 'public' ? 'Public' : 'Private'}{#if data.room.open}<span class="chip">Open now</span>{:else if data.room.closed}<span class="chip">Closed</span>{/if}</p>

{#if data.added}
	<div class="notice" role="status"><p>The room is made. Send invite links below, or share the room’s page if it is public.</p></div>
{/if}
{#if done}
	<div class="notice" role="status"><p>{done}</p></div>
{/if}
{#if problem && !formField}
	<div class="notice notice-problem" role="alert"><p>{problem}</p></div>
{/if}
{#if !data.ready}
	<div class="notice" role="note"><p>The video room is not switched on yet, so nobody can join. You can still set the room up and make links.</p></div>
{/if}

<div class="actions">
	{#if !data.room.closed}
		<a class="button" href="/rooms/{data.room.identifier}" target="_blank" rel="noopener"><Video size={20} strokeWidth={1.75} /> Go to the room<span class="visually-hidden"> (opens in a new tab)</span></a>
	{/if}
	<form method="post" action="?/keepOpen">
		<button class="button button-quiet" type="submit">{data.room.closed ? 'Open it again for an hour' : 'Keep it open an hour longer'}</button>
	</form>
	{#if !data.room.closed}
		<form method="post" action="?/close">
			<button class="button button-quiet" type="submit">Close the room and end the call</button>
		</form>
	{/if}
</div>

<h2>Invite links</h2>
<p>
	A link lets one person, or everyone you pass it to, into this room without an account, from 30 minutes before it
	starts until it closes. They give the name shown in the room. A link
	is shown once, when you make it; make another if one is lost, and turn off any you no longer want.
</p>
{#if invite}
	<div class="notice" role="status"><p>Here is the link for {invite.name}. Copy it now: it is not shown again.</p></div>
	<CopyLink link={invite.link} label="Invite link for {invite.name}" />
{/if}
<form method="post" action="?/invite" class="panel">
	{#if field === 'invite-name' && problem}<p class="field-error" id="invite-name-error">{problem}</p>{/if}
	<div class="field">
		<label for="invite-name">Who it is for</label>
		<p class="hint" id="invite-name-hint">Their name, which the room shows unless they type another. Use "Guest" for a link to pass around.</p>
		<input type="text" id="invite-name" name="name" maxlength="120" required aria-describedby="invite-name-hint" aria-invalid={field === 'invite-name' ? 'true' : undefined} />
	</div>
	<fieldset>
		<legend>They join as</legend>
		<div class="choice">
			<input type="radio" id="invite-role-guest" name="role" value="guest" checked />
			<label for="invite-role-guest">A guest</label>
		</div>
		<div class="choice">
			<input type="radio" id="invite-role-host" name="role" value="host" />
			<label for="invite-role-host">A host: may record, and in a webinar room, speak from the stage</label>
		</div>
	</fieldset>
	<button class="button" type="submit">Make a link</button>
</form>
{#if data.invites.length > 0}
	<DataTable identifier="invites" label="Table: invite links" columns={inviteColumns} rows={inviteRows} rowName={['link', 'links']}>
		{#snippet cell(row)}
			{@const item = invites.get(row.key)}
			{#if item?.revoked}
				Off
			{:else if item}
				<form method="post" action="?/revoke">
					<input type="hidden" name="invite" value={item.identifier} />
					<button class="button button-quiet" type="submit">Turn it off</button>
				</form>
			{/if}
		{/snippet}
	</DataTable>
{/if}

<RoomRecords recordings={data.recordings} visitors={data.visitors} level={2} />

<h2>Settings</h2>
<form method="post" action="?/save">
	<RoomFields {values} invalid={formField} problem={formField ? problem : undefined} />
	<p><button class="button" type="submit">Save the room</button></p>
</form>

{#if data.recordings.length === 0}
	<form method="post" action="?/remove">
		<button class="button button-quiet" type="submit">Delete the room</button>
	</form>
{/if}

<style>
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}

	.actions form {
		margin: 0;
	}

	.choice {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.choice input {
		margin-top: 0.3em;
	}

	.button {
		gap: var(--space-2);
	}

	.chip {
		margin-left: var(--space-2);
	}
</style>
