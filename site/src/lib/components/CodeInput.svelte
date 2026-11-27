<!--
	A field for a short numeric code, such as a six-digit sign-in code, shown
	as one box per digit (site/DESIGN.md, section 6, "Code fields").

	It is one ordinary text field underneath, with the boxes drawn over it, so
	pasting a whole code, a phone offering the code from a text message or
	email (autocomplete="one-time-code"), password managers and screen readers
	all work as they do with any field: a screen reader hears one field and
	its label, not six. Without scripts the plain field shows instead.

	The field is fully opaque, with clear text, under the boxes, and the boxes
	let clicks through to it. Password managers fill only fields they judge
	visible: Bitwarden skips a field with an opacity under 0.1 or one covered
	by another element at its center (bitwarden/clients,
	apps/browser/src/autofill/services/dom-element-visibility.service.ts), so
	an almost transparent field laid on top, as this was at first, could not
	be filled from Bitwarden (Trevor, Nov. 23, 2026).
-->
<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		id: string;
		name: string;
		/** How many digits the code has. */
		length?: number;
		/** Where to leave a wider gap between boxes, such as [3] for "482 913". */
		gapsAfter?: number[];
		describedBy?: string;
		invalid?: boolean;
		required?: boolean;
	}

	let { id, name, length = 6, gapsAfter = [3], describedBy, invalid = false, required = true }: Props = $props();

	let value = $state('');
	let enhanced = $state(false);
	let focused = $state(false);
	let field: HTMLInputElement | undefined = $state();

	onMount(() => {
		enhanced = true;
	});

	const active = $derived(Math.min(value.length, length - 1));

	/** Keeps digits only, so a pasted "482 913" or "482-913" fills the boxes. */
	function clean() {
		const digits = value.replace(/\D/g, '').slice(0, length);
		if (digits !== value) value = digits;
		keepCaretAtEnd();
	}

	/** Typing always goes into the next empty box, and Backspace clears the last one. */
	function keepCaretAtEnd() {
		const end = value.length;
		if (field && (field.selectionStart !== end || field.selectionEnd !== end)) field.setSelectionRange(end, end);
	}
</script>

<div class="code-boxes" class:enhanced class:invalid style="--code-length: {length}">
	<input
		bind:this={field}
		bind:value
		{id}
		{name}
		type="text"
		class="code-input"
		inputmode="numeric"
		autocomplete="one-time-code"
		pattern={enhanced ? '[0-9]*' : '[0-9 ]*'}
		maxlength={enhanced ? undefined : length + 2}
		spellcheck="false"
		aria-describedby={describedBy}
		aria-invalid={invalid ? 'true' : undefined}
		{required}
		oninput={clean}
		onfocus={() => {
			focused = true;
			keepCaretAtEnd();
		}}
		onblur={() => (focused = false)}
		onclick={keepCaretAtEnd}
		onkeyup={keepCaretAtEnd}
	/>
	{#if enhanced}
		<div class="boxes" aria-hidden="true">
			{#each { length }, index (index)}
				<span
					class="box"
					class:filled={index < value.length}
					class:active={focused && index === active}
					class:gap-after={gapsAfter.includes(index + 1) && index + 1 < length}
					>{value[index] ?? ''}{#if focused && index === active && index === value.length}<span class="caret"></span>{/if}</span
				>
			{/each}
		</div>
	{/if}
</div>

<style>
	.code-boxes {
		position: relative;
		max-width: calc(var(--code-length) * 3.25rem + 1rem);
	}

	/* Before scripts run, or without them: the plain field, spaced out. */
	.code-boxes:not(.enhanced) .code-input {
		max-width: 12ch;
		font-size: var(--font-size-lead);
		letter-spacing: 0.2em;
	}

	/*
	 * With scripts: the field fills the row under the boxes. It stays opaque
	 * (only its text, caret and background are clear) so password managers
	 * treat it as visible, and the boxes on top let clicks through to it.
	 */
	.code-boxes.enhanced .code-input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		min-height: 0;
		padding: 0;
		border: none;
		background: transparent;
		color: transparent;
		-webkit-text-fill-color: transparent;
		caret-color: transparent;
		cursor: text;
	}

	.code-boxes.enhanced .code-input::selection {
		background: transparent;
	}

	/* A browser that fills the code itself tints the field; the page's color covers the tint between the boxes. */
	.code-boxes.enhanced .code-input:autofill {
		box-shadow: 0 0 0 100vmax var(--color-paper) inset;
		-webkit-text-fill-color: transparent;
	}

	.code-boxes.enhanced .code-input:focus-visible {
		outline: none;
		box-shadow: none;
	}

	.boxes {
		position: relative;
		display: flex;
		gap: var(--space-2);
		pointer-events: none;
	}

	.box {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1 1 0;
		min-width: 0;
		max-width: 3rem;
		aspect-ratio: 5 / 6;
		box-sizing: border-box;
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		font-size: calc(var(--font-size-lead) * 1.35);
		font-weight: var(--font-weight-semibold);
		font-variant-numeric: tabular-nums;
	}

	.box.gap-after {
		margin-right: var(--space-3);
	}

	.invalid .box {
		border-color: var(--color-danger);
	}

	/* The box the next digit goes into shows the site's focus style. */
	.box.active {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.caret {
		width: 2px;
		height: 1.2em;
		background: var(--color-ink);
	}
</style>
