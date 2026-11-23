<script lang="ts">
	import { onMount } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import Video from '@lucide/svelte/icons/video';
	import CopyLink from '#lib/components/CopyLink.svelte';
	import { recordingChoiceLabels, recordingChoices } from '#lib/event-calendar.ts';
	import { instantRoomHours } from '#lib/video-rooms.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const started = $derived(form && 'started' in form ? form.started : undefined);
	const problem = $derived(form && 'problem' in form ? form.problem : undefined);
	// The browser's own zone, when it is one an event can use, so an instant room's times read right.
	let zone = $state('');
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
			<a class="button" href={started.roomLink}><Video size={20} strokeWidth={1.75} /> Go to the room</a>
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
			<fieldset>
				<legend>Recording</legend>
				{#each recordingChoices as choice (choice)}
					<div class="choice">
						<input type="radio" id="instant-recording-{choice}" name="recording" value={choice} checked={choice === 'undecided'} />
						<label for="instant-recording-{choice}">{recordingChoiceLabels[choice]}</label>
					</div>
				{/each}
			</fieldset>
			<p><button class="button" type="submit"><Video size={20} strokeWidth={1.75} /> Start a room now</button></p>
		</form>
	{/if}
</section>

<p><a class="button button-quiet" href="/workspace/rooms/new"><Plus size={20} strokeWidth={1.75} /> Plan a room for later</a></p>

<h2>Open and coming up</h2>
{#if data.current.length === 0}
	<p class="muted">No rooms are open or planned.</p>
{:else}
	{@render table(data.current)}
{/if}

{#if data.past.length > 0}
	<h2>Closed</h2>
	{@render table(data.past)}
{/if}

{#snippet table(rooms: typeof data.current)}
	<div class="table-scroll">
		<table>
			<thead>
				<tr><th scope="col">Room</th><th scope="col">Who may join</th><th scope="col">When</th><th scope="col">People</th><th scope="col">Recordings</th></tr>
			</thead>
			<tbody>
				{#each rooms as room (room.identifier)}
					<tr>
						<td><a href="/workspace/rooms/{room.identifier}">{room.title}</a>{#if room.open}<span class="chip">Open now</span>{/if}</td>
						<td>{room.visibility}</td>
						<td>{room.when}</td>
						<td>{room.visitors}</td>
						<td>{room.recordings}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

<style>
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
