<script lang="ts">
	import { onMount } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import Video from '@lucide/svelte/icons/video';
	import CopyLink from '#lib/components/CopyLink.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import { instantRoomHours } from '#lib/video-rooms.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const started = $derived(form && 'started' in form ? form.started : undefined);
	const problem = $derived(form && 'problem' in form ? form.problem : undefined);
	// The browser's own zone, when it is one an event can use, so an instant room's times read right.
	let zone = $state('');

	// The times come formatted, so the tables keep the order they are given in rather than sorting by them.
	const columns: TableColumn[] = [
		{ key: 'room', header: 'Room', isRowHeader: true, sortable: true, searchable: true, custom: true },
		{ key: 'visibility', header: 'Who may join', sortable: true },
		{ key: 'when', header: 'When' },
		{ key: 'visitors', header: 'People', type: 'number', sortable: true },
		{ key: 'recordings', header: 'Recordings', type: 'number', sortable: true }
	];
	const rowsOf = (rooms: typeof data.current): TableRow[] =>
		rooms.map((room) => ({
			key: room.identifier,
			cells: {
				room: { text: `${room.title}${room.open ? ' (open now)' : ''}`, href: `/workspace/rooms/${room.identifier}` },
				visibility: { text: room.visibility },
				when: { text: room.when },
				visitors: { text: String(room.visitors), sortValue: Number(room.visitors) },
				recordings: { text: String(room.recordings), sortValue: Number(room.recordings) }
			}
		}));
	const roomsByKey = $derived(new Map([...data.current, ...data.past].map((room) => [room.identifier, room])));
	onMount(() => {
		zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	});
</script>

<svelte:head>
	<title>Video rooms · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Video rooms</h1>
<p>
	Rooms of their own, apart from events: interviews, meetings and open conversations. Each room is its own meeting,
	so any number can run at the same time. A public room is listed on the <a href="/rooms">Rooms page</a> for anyone
	signed in; a private room lets in only its hosts and the people you send an invite link to. Invite links work
	without an account. Event rooms are set up on each event.
</p>
{#if !data.ready}
	<div class="notice" role="note">
		<p>The video room is not switched on yet, so nobody can join a room. You can still make rooms and invite links here.</p>
	</div>
{/if}

<section class="panel" aria-labelledby="instant-heading">
	<h2 id="instant-heading">Start a room now</h2>
	{#if started}
		<div class="notice" role="status">
			<p>Your room is open for the next {instantRoomHours} hours. Send this link to the people you want in it. It is shown only now; you can make more links on the room’s page.</p>
		</div>
		<CopyLink link={started.inviteLink} label="Invite link" />
		<p>
			<a class="button" href={started.roomLink} target="_blank" rel="noopener"><Video size={20} strokeWidth={1.75} /> Go to the room<span class="visually-hidden"> (opens in a new tab)</span></a>
			<a class="button button-quiet" href="/workspace/rooms/{started.room}">Manage it</a>
		</p>
	{:else}
		<p>A private room, open now for {instantRoomHours} hours, with an invite link to send. You can rename it, keep it open longer or close it afterward.</p>
		{#if problem}
			<div class="notice notice-problem" role="alert"><p>{problem}</p></div>
		{/if}
		<form method="post" action="?/startNow">
			<input type="hidden" name="time-zone" value={zone} />
			<div class="field">
				<label for="instant-title">Name <span class="hint">(optional)</span></label>
				<input type="text" id="instant-title" name="title" maxlength="200" />
			</div>
			<p><button class="button" type="submit"><Video size={20} strokeWidth={1.75} /> Start a room now</button></p>
		</form>
	{/if}
</section>

<p><a class="button button-quiet" href="/workspace/rooms/new"><Plus size={20} strokeWidth={1.75} /> Plan a room for later</a></p>

<h2>Open and coming up</h2>
{#if data.current.length === 0}
	<p class="muted">No rooms are open or planned.</p>
{:else}
	{@render table(data.current, 'rooms-open', 'Table: rooms open and coming up')}
{/if}

{#if data.past.length > 0}
	<h2>Closed</h2>
	{@render table(data.past, 'rooms-closed', 'Table: closed rooms')}
{/if}

{#snippet table(rooms: typeof data.current, identifier: string, label: string)}
	<DataTable {identifier} {label} {columns} rows={rowsOf(rooms)} rowName={['room', 'rooms']}>
		{#snippet cell(row)}
			{@const room = roomsByKey.get(row.key)}
			{#if room}<a href="/workspace/rooms/{room.identifier}">{room.title}</a>{#if room.open}<span class="chip">Open now</span>{/if}{/if}
		{/snippet}
	</DataTable>
{/snippet}

<style>
	.button {
		gap: var(--space-2);
	}

	.chip {
		margin-left: var(--space-2);
	}
</style>
