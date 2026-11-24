<!--
	@component
	The site's switch between ways of showing the same thing: icon buttons, the one on screen underlined in the link color. Charts use it for Bars, Pie and Table; the map uses it for Nations and States (Trevor, 2026-11-24, mockup 2A), so the two read the same way.
-->
<script lang="ts" generics="Value extends string">
	import type { Component } from 'svelte';

	let {
		label,
		choices,
		value,
		onchange
	}: {
		/** What the group switches, for screen readers, such as "Show Public Law 280 by". */
		label: string;
		/** Each way to show it. With showLabel the name is written beside the icon; without it the name is the button's label and tooltip. */
		choices: { value: Value; label: string; title?: string; icon: Component<{ size?: string | number; strokeWidth?: number; 'aria-hidden'?: 'true' }>; showLabel?: boolean }[];
		value: Value;
		onchange: (value: Value) => void;
	} = $props();
</script>

<div class="view-switch" role="group" aria-label={label}>
	{#each choices as choice (choice.value)}
		{@const Icon = choice.icon}
		<button
			type="button"
			class="view-button"
			class:labeled={choice.showLabel}
			aria-pressed={value === choice.value}
			aria-label={choice.showLabel ? undefined : choice.label}
			title={choice.title ?? choice.label}
			onclick={() => onchange(choice.value)}
		>
			<Icon aria-hidden="true" size="1.25em" strokeWidth={1.75} />{#if choice.showLabel}<span>{choice.label}</span>{/if}
		</button>
	{/each}
</div>

<style>
	.view-switch {
		display: flex;
		gap: var(--space-1);
	}

	.view-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-width: 2.75rem;
		min-height: 2.75rem;
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink-muted);
		font: inherit;
		cursor: pointer;
	}

	.view-button.labeled {
		padding: 0 var(--space-3);
	}

	.view-button:hover {
		color: var(--color-ink);
		background: var(--color-surface);
	}

	.view-button[aria-pressed='true'] {
		color: var(--color-link);
		box-shadow: inset 0 -2px 0 var(--color-link);
	}

	.view-button[aria-pressed='true'].labeled {
		font-weight: var(--font-weight-bold);
	}
</style>
