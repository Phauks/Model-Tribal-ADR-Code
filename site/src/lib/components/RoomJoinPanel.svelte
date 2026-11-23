<script lang="ts">
	/**
	 * What everyone sees before joining a video room: whether it is recorded
	 * and who may watch, the box to agree to that when it is or may be
	 * recorded, and the join button. People with an invite link and no
	 * account also give the name shown in the room.
	 */
	import { enhance } from '$app/forms';
	import Video from '@lucide/svelte/icons/video';

	interface Props {
		notice: { heading: string; text: string; needsAgreement: boolean };
		agreeLabel: string;
		problem?: string;
		/** Which field the last try was refused for. */
		field?: string;
		/** For someone joining with an invite link: the name to show, as the hosts wrote it. */
		name?: string;
	}

	let { notice, agreeLabel, problem, field, name }: Props = $props();
</script>

<section class="panel" aria-labelledby="notice-heading">
	<h2 id="notice-heading">{notice.heading}</h2>
	<p>{notice.text}</p>
	{#if problem}
		<div class="notice notice-problem" role="alert"><p>{problem}</p></div>
	{/if}
	<form method="post" action="?/join" use:enhance>
		{#if name !== undefined}
			<div class="field">
				<label for="room-name">Your name, as others in the room will see it</label>
				<input
					type="text"
					id="room-name"
					name="name"
					value={name}
					maxlength="120"
					required
					autocomplete="name"
					aria-invalid={field === 'name' ? 'true' : undefined}
				/>
			</div>
		{/if}
		{#if notice.needsAgreement}
			<div class="field checkbox">
				<input type="checkbox" id="agree" name="agree" value="yes" required aria-invalid={field === 'agree' ? 'true' : undefined} />
				<label for="agree">{agreeLabel}</label>
			</div>
		{/if}
		<p><button class="button" type="submit"><Video size={20} strokeWidth={1.75} /> Join the room</button></p>
	</form>
	<p class="hint">Your browser will ask before it uses your camera or microphone. You can join with both off.</p>
</section>

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
