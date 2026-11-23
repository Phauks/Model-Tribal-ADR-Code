<script lang="ts">
	import RoomJoinPanel from '#lib/components/RoomJoinPanel.svelte';
	import VideoRoom from '#lib/components/VideoRoom.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const token = $derived(form && 'token' in form ? form.token : undefined);
	const problem = $derived(form && 'problem' in form && typeof form.problem === 'string' ? form.problem : undefined);
	const field = $derived(form && 'field' in form && typeof form.field === 'string' ? form.field : undefined);
	const typed = $derived(form && 'name' in form && typeof form.name === 'string' ? form.name : undefined);
</script>

<svelte:head>
	<title>{data.room.title} · Video room · Model Tribal ADR Code</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<h1>{data.room.title}</h1>
<p>{data.room.when}</p>
<p class="small">You were invited to this room{data.role === 'host' ? ' as a host' : ''}. You do not need an account to join.</p>

{#if token}
	<VideoRoom {token} host={data.role === 'host'} told={data.room.recording} />
{:else if data.refusal}
	<div class="notice" role="note"><p>{data.refusal.words}</p></div>
	{#if data.refusal.reason === 'not-open-yet'}
		<p>The room opens {data.room.opens}. Come back to this link then.</p>
	{/if}
{:else if !data.ready}
	<div class="notice" role="note"><p>The video room is not switched on yet.</p></div>
{:else}
	<RoomJoinPanel notice={data.notice} agreeLabel={data.agreeLabel} {problem} {field} name={typed ?? data.name} />
{/if}
