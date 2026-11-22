<script lang="ts">
	// A password field with a "Show" button beside it, so people can check what they typed. It follows the GOV.UK Design System's password input: an eye icon with a word beside it, an announcement for screen readers when the password is shown or hidden, and the field hidden again when the form is sent, so the browser does not keep the password as ordinary text (DESIGN.md, section 6, "Password fields").
	//
	// Without scripts the button never appears and the field is an ordinary password field.
	import { onMount } from 'svelte';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import type { HTMLInputAttributes } from 'svelte/elements';

	let { id, ...attributes }: { id: string } & Omit<HTMLInputAttributes, 'id' | 'type'> = $props();

	let ready = $state(false);
	let shown = $state(false);
	let announcement = $state('');
	let field: HTMLInputElement | undefined = $state();

	function toggle() {
		shown = !shown;
		announcement = shown ? 'Your password is visible' : 'Your password is hidden';
	}

	onMount(() => {
		ready = true;
		const form = field?.form;
		if (!form) return;
		const hide = () => {
			shown = false;
			announcement = '';
		};
		form.addEventListener('submit', hide);
		return () => form.removeEventListener('submit', hide);
	});
</script>

<div class="password-input">
	<input
		bind:this={field}
		{id}
		type={shown ? 'text' : 'password'}
		spellcheck="false"
		autocapitalize="none"
		{...attributes}
	/>
	{#if ready}
		<button
			type="button"
			class="button button-quiet show-button"
			aria-controls={id}
			aria-label={shown ? 'Hide password' : 'Show password'}
			onclick={toggle}
		>
			{#if shown}
				<EyeOff size={20} strokeWidth={1.75} />
				Hide
			{:else}
				<Eye size={20} strokeWidth={1.75} />
				Show
			{/if}
		</button>
	{/if}
	<span class="visually-hidden" aria-live="polite">{announcement}</span>
</div>

<style>
	.password-input {
		display: flex;
		gap: var(--space-2);
		align-items: stretch;
	}

	.password-input input {
		flex: 1;
		min-width: 0;
	}

	.show-button {
		flex: none;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
	}
</style>
