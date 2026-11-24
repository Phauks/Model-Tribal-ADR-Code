<script lang="ts">
	// One file for a form, chosen or dropped in a dashed box, like the box on
	// the Verify a file page (FileVerifier.svelte). The file goes with the form
	// that holds it; nothing is sent until the form is. Without scripts the box
	// is the browser's own file field, which works the same.
	import X from '@lucide/svelte/icons/x';
	import { onMount } from 'svelte';

	let {
		id,
		name,
		accept,
		what,
		hint,
		invalid = false,
		describedBy
	}: {
		id: string;
		name: string;
		accept: string;
		/** What may be dropped, such as "a PDF or photo". */
		what: string;
		/** A line under the box, such as who will see the file. */
		hint?: string;
		invalid?: boolean;
		describedBy?: string;
	} = $props();

	let input: HTMLInputElement | undefined = $state();
	let chosen = $state<string | null>(null);
	let dragging = $state(false);
	let scripted = $state(false);

	onMount(() => {
		scripted = true;
	});

	function changed(): void {
		chosen = input?.files?.[0]?.name ?? null;
	}

	function dropped(event: DragEvent): void {
		event.preventDefault();
		dragging = false;
		const files = event.dataTransfer?.files;
		if (!input || !files || files.length === 0) return;
		// Only the first file: the form takes one.
		const transfer = new DataTransfer();
		transfer.items.add(files[0]);
		input.files = transfer.files;
		// Tells the component and the form around it, as choosing the file would.
		input.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function clear(): void {
		if (!input) return;
		input.value = '';
		input.dispatchEvent(new Event('change', { bubbles: true }));
		input.focus();
	}
</script>

<div
	class="drop"
	class:dragging
	class:invalid
	class:scripted
	role="group"
	ondragover={(event) => {
		event.preventDefault();
		dragging = true;
	}}
	ondragleave={() => (dragging = false)}
	ondrop={dropped}
>
	<input
		bind:this={input}
		{id}
		{name}
		{accept}
		type="file"
		class:visually-hidden={scripted}
		aria-invalid={invalid || undefined}
		aria-describedby={[hint ? `${id}-hint` : '', describedBy ?? ''].join(' ').trim() || undefined}
		onchange={changed}
	/>
	{#if scripted}
		{#if chosen}
			<p class="chosen">
				<strong>{chosen}</strong>
				<button class="icon-button" type="button" aria-label="Remove {chosen}" title="Remove {chosen}" onclick={clear}><X size={18} /></button>
			</p>
		{:else}
			<p>Drop {what} here, or <label for={id} class="choose">choose a file</label></p>
		{/if}
	{/if}
	{#if hint}<p class="hint" id="{id}-hint">{hint}</p>{/if}
</div>

<style>
	.drop {
		padding: var(--space-4);
		margin: 0 0 var(--space-4);
		border: 2px dashed var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		color: var(--color-ink-muted);
		text-align: center;
	}

	.drop:not(.scripted) {
		text-align: start;
	}

	.drop.dragging {
		border-color: var(--color-link);
	}

	.drop.invalid {
		border-color: var(--color-danger);
	}

	.drop:focus-within {
		border-color: var(--color-link);
	}

	.drop p {
		margin: 0;
	}

	.drop .hint {
		margin-top: var(--space-1);
	}

	.choose {
		color: var(--color-link);
		text-decoration: underline;
		cursor: pointer;
	}

	.chosen {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		color: var(--color-ink);
	}
</style>
