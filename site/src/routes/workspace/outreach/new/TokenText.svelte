<script lang="ts">
	// A box for a letter's subject or words in which each merge field, such as {{nation.name}}, is marked (design/outreach-redesign). The words are typed in a plain text box; a copy of them behind it, with the fields marked, shows through. The box grows with what is written, so the two never scroll apart. A subject stays on one line: Enter does nothing there.
	import { onMount } from 'svelte';

	let {
		id,
		name,
		value = $bindable(''),
		multiline = false,
		label,
		required = false,
		placeholder = '',
		box = $bindable()
	}: {
		id: string;
		name: string;
		value?: string;
		multiline?: boolean;
		/** For screen readers; the row or the page says it on screen. */
		label: string;
		required?: boolean;
		placeholder?: string;
		box?: HTMLTextAreaElement;
	} = $props();

	/** The words cut at each field, with the fields marked. */
	const pieces = $derived(value.split(/(\{\{\s*[a-z]+\.[a-z]+\s*\}\})/g).map((text, index) => ({ text, field: index % 2 === 1 })));

	function grow(): void {
		if (!box) return;
		box.style.height = 'auto';
		box.style.height = `${box.scrollHeight}px`;
	}

	$effect(() => {
		void value;
		grow();
	});
	onMount(() => {
		grow();
		const observer = new ResizeObserver(grow);
		if (box) observer.observe(box.parentElement ?? box);
		return () => observer.disconnect();
	});
</script>

<div class="token-text" class:multiline>
	<div class="marks" aria-hidden="true">{#each pieces as piece, index (index)}{#if piece.field}<mark>{piece.text}</mark>{:else}{piece.text}{/if}{/each}{' '}</div>
	<label for={id} class="visually-hidden">{label}</label>
	<textarea
		{id}
		{name}
		{required}
		{placeholder}
		rows="1"
		bind:this={box}
		bind:value
		spellcheck="true"
		onkeydown={(event) => {
			if (!multiline && event.key === 'Enter') event.preventDefault();
		}}
	></textarea>
</div>

<style>
	.token-text {
		position: relative;
		flex: 1;
		min-width: 0;
	}
	.marks,
	textarea {
		box-sizing: border-box;
		margin: 0;
		padding: var(--space-2) 0;
		font: inherit;
		line-height: var(--font-line-height-reading);
		letter-spacing: inherit;
		white-space: pre-wrap;
		overflow-wrap: break-word;
		word-break: normal;
	}
	.multiline .marks,
	.multiline textarea {
		padding: var(--space-3) var(--space-4);
	}
	.marks {
		position: absolute;
		inset: 0;
		color: transparent;
		pointer-events: none;
		overflow: hidden;
	}
	mark {
		color: transparent;
		border-radius: 4px;
		background: color-mix(in srgb, var(--color-link) 16%, transparent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-link) 16%, transparent);
	}
	textarea {
		position: relative;
		display: block;
		width: 100%;
		min-height: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--color-ink);
		resize: none;
		overflow: hidden;
	}
	.multiline textarea {
		min-height: 15rem;
	}
	/* The row or the box around shows focus; the site's yellow fill would hide the marks. */
	textarea:focus,
	textarea:focus-visible {
		outline: none;
		background: transparent;
		color: var(--color-ink);
		box-shadow: none;
	}
</style>
