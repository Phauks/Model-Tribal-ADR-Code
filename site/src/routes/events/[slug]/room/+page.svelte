<script lang="ts">
	import RoomJoinPanel from '#lib/components/RoomJoinPanel.svelte';
	import VideoRoom from '#lib/components/VideoRoom.svelte';
	import CallBar from '#lib/components/CallBar.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const token = $derived(form && 'token' in form ? form.token : undefined);
	const problem = $derived(form && 'problem' in form && typeof form.problem === 'string' ? form.problem : undefined);
	const field = $derived(form && 'field' in form && typeof form.field === 'string' ? form.field : undefined);
</script>

<svelte:head>
	<title>Room · {data.event.title} · Events · Model Tribal ADR Code</title>
</svelte:head>

<CallBar title={data.event.title} when={data.event.when}>
	<a href="/events/{data.event.slug}" target="_blank" rel="noopener">The event’s page<span class="visually-hidden"> (opens in a new tab)</span></a>
</CallBar>

{#if token}
	<VideoRoom {token} host={data.host} told={data.event.recording} />
{:else if !data.hasRoom}
	<p>This event does not use the website’s video room. Its page says how to take part.</p>
{:else if data.refusal}
	<div class="notice" role="note"><p>{data.refusal.words}</p></div>
	{#if data.refusal.reason === 'not-open-yet'}
		<p>The room opens {data.event.opens}.</p>
	{:else if data.refusal.reason === 'sign-in'}
		<p><a class="button" href="/sign-in?returnTo={encodeURIComponent(`/events/${data.event.slug}/room`)}">Sign in</a></p>
	{/if}
{:else if !data.ready}
	<div class="notice" role="note"><p>The video room is not switched on yet. The event’s page will say how to take part.</p></div>
{:else}
	<RoomJoinPanel notice={data.notice} agreeLabel={data.agreeLabel} {problem} {field} />
{/if}
