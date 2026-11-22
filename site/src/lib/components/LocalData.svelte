<script lang="ts">
	// Settings, Data section (site/DESIGN.md, section 6, "Settings"): reset
	// the reading settings, and delete what the site keeps on this device,
	// all of it or chosen parts. Deleting asks once more before it runs,
	// because it cannot be undone.
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { tick } from 'svelte';
	import { collections } from '#lib/offline-collections.ts';
	import { controllingWorker, removeCollection } from '#lib/offline-saving.ts';
	import { defaultPrintOptions, savePrintOptions } from '#lib/print-options.ts';

	type Part = 'settings' | 'print' | 'pages';

	let {
		headingLevel = 4,
		onreset,
		ondeleted
	}: {
		headingLevel?: 3 | 4;
		/** Puts the reading settings and theme back to their defaults. */
		onreset: () => void;
		/** Runs after a delete, so the parts of the dialog showing saved data can read it again. */
		ondeleted?: () => void;
	} = $props();

	const parts: { id: Part; label: string; hint: string }[] = [
		{ id: 'settings', label: 'Settings', hint: 'Text, colors, citations and glossary choices' },
		{ id: 'print', label: 'Print choices', hint: 'What you chose to include when printing' },
		{ id: 'pages', label: 'Saved pages', hint: 'Pages saved for reading without a connection' }
	];

	const heading = $derived(`h${headingLevel}`);
	let chosen = $state<Part[]>(['settings', 'print', 'pages']);
	let confirming = $state(false);
	let working = $state(false);
	let message = $state<string | undefined>();
	let confirmQuestion: HTMLParagraphElement | undefined = $state();

	const chosenLabels = $derived(
		parts.filter((part) => chosen.includes(part.id)).map((part) => part.label.toLowerCase())
	);

	function listed(words: string[]): string {
		if (words.length <= 1) return words.join('');
		return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
	}

	function reset(): void {
		onreset();
		message = 'Settings are back to their defaults.';
	}

	async function ask(): Promise<void> {
		message = undefined;
		confirming = true;
		await tick();
		confirmQuestion?.focus();
	}

	async function remove(): Promise<void> {
		working = true;
		const notDone: string[] = [];
		if (chosen.includes('settings')) onreset();
		if (chosen.includes('print')) savePrintOptions({ ...defaultPrintOptions });
		if (chosen.includes('pages')) {
			if (controllingWorker()) {
				for (const collection of collections) {
					await removeCollection(collection.id).catch(() => notDone.push(collection.label));
				}
			} else {
				notDone.push('saved pages');
			}
		}
		working = false;
		confirming = false;
		message =
			notDone.length === 0
				? `Deleted ${listed(chosenLabels)} from this device.`
				: `Deleted what could be deleted. Saved pages can be deleted once the site has loaded fully with a connection; reload the page and try again.`;
		ondeleted?.();
	}
</script>

<div class="local-data">
	<svelte:element this={heading} class="data-heading">Reset settings</svelte:element>
	<p>
		<button class="button button-quiet" type="button" onclick={reset}>
			<RotateCcw size={20} strokeWidth={1.75} />
			Reset settings to defaults
		</button>
	</p>

	<svelte:element this={heading} class="data-heading">Delete data on this device</svelte:element>
	<p class="hint">The site keeps these only on this device. Nothing is sent to the site.</p>
	<fieldset class="parts" disabled={confirming || working}>
		<legend class="visually-hidden">Data to delete</legend>
		{#each parts as part (part.id)}
			<div class="part">
				<input
					type="checkbox"
					id="local-data-{part.id}"
					value={part.id}
					bind:group={chosen}
					aria-describedby="local-data-{part.id}-hint"
				/>
				<div>
					<label for="local-data-{part.id}">{part.label}</label>
					<p class="hint" id="local-data-{part.id}-hint">{part.hint}</p>
				</div>
			</div>
		{/each}
	</fieldset>

	{#if confirming}
		<div class="confirm" role="group" aria-labelledby="local-data-confirm">
			<p id="local-data-confirm" tabindex="-1" bind:this={confirmQuestion}>
				<strong>Delete {listed(chosenLabels)} from this device?</strong> This cannot be undone.
			</p>
			<p class="actions">
				<button class="button button-danger" type="button" disabled={working} onclick={remove}>
					<Trash2 size={20} strokeWidth={1.75} />
					{working ? 'Deleting…' : 'Yes, delete'}
				</button>
				<button class="button button-quiet" type="button" disabled={working} onclick={() => (confirming = false)}>
					Cancel
				</button>
			</p>
		</div>
	{:else}
		<p>
			<button class="button button-quiet" type="button" disabled={chosen.length === 0} onclick={ask}>
				<Trash2 size={20} strokeWidth={1.75} />
				{chosen.length === parts.length ? 'Delete all data' : 'Delete chosen data'}
			</button>
		</p>
	{/if}

	<p role="status" class="result">{message ?? ''}</p>
</div>

<style>
	.data-heading {
		font-size: var(--font-size-lead);
		margin: var(--space-5) 0 var(--space-2);
	}

	.data-heading:first-child {
		margin-top: 0;
	}

	.local-data .button {
		gap: var(--space-2);
	}

	.parts {
		margin: 0 0 var(--space-3);
		padding: 0;
		border: 0;
	}

	.part {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		margin: var(--space-2) 0;
	}

	.part input {
		margin-top: 0.3em;
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
		accent-color: var(--color-action);
	}

	.part label {
		display: block;
		padding: var(--space-1) 0;
		cursor: pointer;
	}

	.part .hint {
		margin: 0;
	}

	/* The question is bordered in the danger color and starts with bold words, so it does not rely on color. */
	.confirm {
		padding: var(--space-3) var(--space-4);
		border: 2px solid var(--color-danger);
		border-radius: var(--radius-control);
		margin: 0 0 var(--space-3);
	}

	.confirm p {
		margin: 0 0 var(--space-3);
	}

	.confirm .actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin: 0;
	}

	.button-danger {
		background: var(--color-danger);
		border-color: var(--color-danger);
		color: var(--color-action-text);
	}

	.button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.result:empty {
		margin: 0;
	}
</style>
