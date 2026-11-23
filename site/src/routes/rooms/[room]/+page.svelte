<script lang="ts">
	import Video from '@lucide/svelte/icons/video';
	import RoomJoinPanel from '#lib/components/RoomJoinPanel.svelte';
	import VideoRoom from '#lib/components/VideoRoom.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const token = $derived(form && 'token' in form ? form.token : undefined);
	const problem = $derived(form && 'problem' in form && typeof form.problem === 'string' ? form.problem : undefined);
	const field = $derived(form && 'field' in form && typeof form.field === 'string' ? form.field : undefined);
	const returnTo = $derived(`/rooms/${data.room?.identifier ?? ''}`);
</script>

<svelte:head>
	<title>{data.room ? `${data.room.title} · ` : ''}Video rooms · Model Tribal ADR Code</title>
</svelte:head>

<p class="small"><a href="/rooms">Video rooms</a></p>
{#if !data.room}
	<h1>Video room</h1>
	<div class="notice" role="note"><p>{data.refusal.words}</p></div>
	{#if data.refusal.reason === 'sign-in'}
		<p><a class="button" href="/sign-in?returnTo={encodeURIComponent(returnTo)}">Sign in</a></p>
	{/if}
{:else}
	<h1>{data.room.title}</h1>
	<p>{data.room.when}</p>
	{#if data.host}
		<p class="small"><a href="/workspace/rooms/{data.room.identifier}">Manage this room</a> (invite links, recordings, who was told)</p>
	{/if}

	{#if token}
		<VideoRoom {token} host={data.host} told={data.room.recording} />
	{:else if data.refusal}
		<div class="notice" role="note"><p>{data.refusal.words}</p></div>
		{#if data.refusal.reason === 'not-open-yet'}
			<p>The room opens {data.room.opens}.</p>
		{:else if data.refusal.reason === 'sign-in'}
			<p><a class="button" href="/sign-in?returnTo={encodeURIComponent(returnTo)}">Sign in</a></p>
		{/if}
	{:else if !data.ready}
		<div class="notice" role="note"><p>The video room is not switched on yet.</p></div>
	{:else}
		<RoomJoinPanel notice={data.notice} agreeLabel={data.agreeLabel} {problem} {field} />
	{/if}

	{#if data.recordings.length > 0}
		<h2>Recordings</h2>
		{#each data.recordings as recording, index (recording.address)}
			{#if recording.ready}
				<p class="recording">
					<a class="button" href={recording.address}><Video size={20} strokeWidth={1.75} /> Watch the recording{data.recordings.length > 1 ? ` (part ${index + 1})` : ''}</a>
					{#if recording.length}<span class="hint">{recording.length}</span>{/if}
					{#if recording.hidden}<span class="chip">Hidden from everyone but the hosts</span>{/if}
				</p>
			{:else if recording.checking}
				<p class="hint">A recording is being saved and checked for viruses. It will be here soon.</p>
			{/if}
		{/each}
	{/if}
{/if}

<style>
	.recording {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.button {
		gap: var(--space-2);
	}
</style>
