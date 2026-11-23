<!--
	Whether one piece of a profile may be used in the person's credit (Trevor,
	Nov. 23, 2026: "for all info, denote what can and cannot be used"). A
	checkbox that reads "Shown" when ticked and "Hidden" when not; the words
	change with CSS, so it works before scripts run. Things the project never
	shows get PrivateMark instead.
-->
<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';

	let {
		name,
		label,
		checked = $bindable(false),
		disabled = false,
		value = 'yes'
	}: {
		name: string;
		/** What a screen reader hears, such as "Show your Native name in your credit". */
		label: string;
		checked?: boolean;
		disabled?: boolean;
		value?: string;
	} = $props();
</script>

<label class="shown-toggle" title={label}>
	<input type="checkbox" {name} {value} bind:checked {disabled} aria-label={label} />
	<span class="on" aria-hidden="true"><Eye size={18} strokeWidth={1.75} /> Shown</span>
	<span class="off" aria-hidden="true"><EyeOff size={18} strokeWidth={1.75} /> Hidden</span>
</label>

<style>
	.shown-toggle {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 2px solid var(--color-control-border);
		border-radius: 999px;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		white-space: nowrap;
		cursor: pointer;
		user-select: none;
	}

	.shown-toggle input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: inherit;
	}

	.shown-toggle span {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.shown-toggle:has(input:checked) {
		border-color: var(--color-link);
		background: var(--color-notice-background);
		color: var(--color-ink);
	}

	.shown-toggle:has(input:checked) .off,
	.shown-toggle:not(:has(input:checked)) .on {
		display: none;
	}

	.shown-toggle:not(:has(input:checked)) {
		color: var(--color-ink-muted);
	}

	.shown-toggle:has(input:focus-visible) {
		outline: 3px solid var(--color-focus-ring);
		box-shadow: 0 0 0 6px var(--color-focus);
	}

	.shown-toggle:has(input:disabled) {
		border-style: dashed;
		cursor: not-allowed;
	}
</style>
