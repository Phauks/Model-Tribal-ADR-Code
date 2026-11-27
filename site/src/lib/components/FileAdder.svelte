<script lang="ts">
	// Files added one or several at a time, each listed with a button to take
	// it off, up to a limit (Trevor, Nov. 27, 2026, for the Request a Change
	// form: "make file adding modular"). It is one <input type="file"
	// multiple>, so the form sends every file under one name; each new choice
	// is added to the list rather than replacing it. Without scripts the plain
	// input shows and takes several files at once.
	import { onMount } from 'svelte';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import X from '@lucide/svelte/icons/x';
	import { readableSize } from '#lib/uploads.ts';

	let {
		id,
		name,
		accept,
		maximum,
		invalid = false,
		describedBy
	}: {
		id: string;
		name: string;
		accept: string;
		/** The most files the form takes. */
		maximum: number;
		invalid?: boolean;
		describedBy?: string;
	} = $props();

	let input: HTMLInputElement | undefined = $state();
	let scripted = $state(false);
	let files = $state<File[]>([]);

	onMount(() => {
		scripted = true;
	});

	/** Puts the listed files back in the input, which the browser sends with the form. */
	function sync() {
		if (!input) return;
		const transfer = new DataTransfer();
		for (const file of files) transfer.items.add(file);
		input.files = transfer.files;
	}

	function picked() {
		const chosen = [...(input?.files ?? [])];
		files = [...files, ...chosen].slice(0, maximum);
		sync();
	}

	function remove(index: number) {
		files = files.filter((_, at) => at !== index);
		sync();
	}
</script>

<div class="file-adder">
	<input
		bind:this={input}
		type="file"
		{id}
		{name}
		{accept}
		multiple
		class:visually-hidden={scripted}
		tabindex={scripted ? -1 : undefined}
		aria-invalid={invalid ? 'true' : undefined}
		aria-describedby={describedBy}
		onchange={picked}
	/>
	{#if scripted}
		{#if files.length > 0}
			<ul class="added-files">
				{#each files as file, index (index)}
					<li>
						<span class="file-name">{file.name}</span>
						<span class="small muted">{readableSize(file.size)}</span>
						<button type="button" class="icon-button" aria-label="Remove {file.name}" title="Remove" onclick={() => remove(index)}>
							<X size={18} />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		{#if files.length < maximum}
			<button type="button" class="button button-quiet add-file" onclick={() => input?.click()}>
				<Paperclip size={18} />
				{files.length === 0 ? 'Add a file' : 'Add another file'}
			</button>
		{/if}
	{/if}
</div>

<style>
	.added-files {
		list-style: none;
		margin: 0 0 var(--space-2);
		padding: 0;
	}

	.added-files li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		border-bottom: 1px solid var(--color-line);
	}

	.file-name {
		flex: 1 1 auto;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.add-file {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
</style>
