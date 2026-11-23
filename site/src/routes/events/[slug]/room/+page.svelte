<script lang="ts">
	import { enhance } from '$app/forms';
	import Video from '@lucide/svelte/icons/video';
	import VideoRoom from '#lib/components/VideoRoom.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const token = $derived(form && 'token' in form ? form.token : undefined);
	const problem = $derived(form && 'problem' in form ? form.problem : undefined);
	const agreeInvalid = $derived(Boolean(form && 'field' in form && form.field === 'agree'));
</script>

<svelte:head>
	<title>Room · {data.event.title} · Events · Model Tribal ADR Code</title>
</svelte:head>

<p class="small"><a href="/events/{data.event.slug}">{data.event.title}</a></p>
<h1>Video room</h1>
<p>{data.event.when}</p>

{#if token}
	<VideoRoom {token} host={data.host} mayRecord={data.event.recording === 'recorded'} />
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
	<section class="panel" aria-labelledby="notice-heading">
		<h2 id="notice-heading">{data.notice.heading}</h2>
		<p>{data.notice.text}</p>
		{#if problem}
			<div class="notice notice-problem" role="alert"><p>{problem}</p></div>
		{/if}
		<form method="post" action="?/join" use:enhance>
			{#if data.notice.needsAgreement}
				<div class="field checkbox">
					<input
						type="checkbox"
						id="agree"
						name="agree"
						value="yes"
						required
						aria-invalid={agreeInvalid ? 'true' : undefined}
					/>
					<label for="agree">I have read this and agree to join {data.event.recording === 'recorded' ? 'a recorded room' : 'a room that may be recorded'}.</label>
				</div>
			{/if}
			<p><button class="button" type="submit"><Video size={20} strokeWidth={1.75} /> Join the room</button></p>
		</form>
		<p class="hint">Your browser will ask before it uses your camera or microphone. You can join with both off.</p>
	</section>
{/if}

<style>
	.checkbox {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}

	.checkbox input {
		margin-top: 0.3em;
	}

	.button {
		gap: var(--space-2);
	}
</style>
