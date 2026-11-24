<script lang="ts">
	// A password field with an eye button inside its right edge, so people can check what they typed (Trevor, Nov. 22, 2026). The button names its action for screen readers ("Show password", "Hide password"), a polite announcement says when the password is shown or hidden, and the field goes back to hidden when the form is sent, so the browser does not keep the password as ordinary text (DESIGN.md, section 6, "Password fields").
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

<div class="password-input" class:ready>
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
			class="show-button"
			aria-controls={id}
			aria-label={shown ? 'Hide password' : 'Show password'}
			title={shown ? 'Hide password' : 'Show password'}
			onclick={toggle}
		>
			{#if shown}
				<EyeOff size={20} strokeWidth={1.75} aria-hidden="true" />
			{:else}
				<Eye size={20} strokeWidth={1.75} aria-hidden="true" />
			{/if}
		</button>
	{/if}
	<span class="visually-hidden" aria-live="polite">{announcement}</span>
</div>

<style>
	/* As wide as the field it holds, so the eye stays inside the field's right edge however wide the form is. */
	.password-input {
		position: relative;
		max-width: var(--layout-field);
	}

	/* Room on the right for the eye button, only once it is there. */
	.password-input.ready input {
		padding-inline-end: calc(var(--layout-target-minimum) + var(--space-1));
	}

	.show-button {
		position: absolute;
		inset-block: 2px;
		inset-inline-end: 2px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--layout-target-minimum);
		padding: 0;
		border: none;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink-muted);
		cursor: pointer;
	}

	.show-button:hover {
		color: var(--color-ink);
	}
</style>
