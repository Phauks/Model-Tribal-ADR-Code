<script lang="ts">
	// Settings, Data section (site/DESIGN.md, section 6, "Settings"): reset
	// the reading settings, export and import them (with starred pages) as a
	// file, and delete what the site keeps on this device, all of it or chosen
	// parts. Importing and
	// deleting ask once more before they run, because they replace or remove
	// what is there.
	import Download from '@lucide/svelte/icons/download';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Upload from '@lucide/svelte/icons/upload';
	import { tick } from 'svelte';
	import { forgetSidebarChoices } from './sidebar/sidebar-state.svelte.ts';
	import { collections } from '#lib/offline-collections.ts';
	import { controllingWorker, documentsStatus, offlineStatus, removeCollection, removeDocuments } from '#lib/offline-saving.ts';
	import { defaultPrintOptions, loadPrintOptions, savePrintOptions } from '#lib/print-options.ts';
	import { buildReaderData, parseReaderData, readerDataFileName, readerDataSizeLimit, type ReaderData } from '#lib/reader-data.ts';
	import { loadSettings, loadTheme, saveSettings, saveTheme } from '#lib/reading-settings.ts';
	import { loadStarred, mergeStarred, saveStarred } from '#lib/starred-items.ts';

	type Part = 'settings' | 'print' | 'starred' | 'pages';

	let {
		headingLevel = 4,
		onreset,
		ondeleted,
		onimported
	}: {
		headingLevel?: 3 | 4;
		/** Puts the reading settings and theme back to their defaults. */
		onreset: () => void;
		/** Runs after a delete, so the parts of the dialog showing saved data can read it again. */
		ondeleted?: () => void;
		/** Runs after an import, so the dialog shows the imported settings. */
		onimported?: () => void;
	} = $props();

	const parts: { id: Part; label: string; hint: string }[] = [
		{ id: 'settings', label: 'Settings', hint: 'Text, colors, citations and glossary choices' },
		{ id: 'print', label: 'Print choices', hint: 'What you chose to include when printing' },
		{ id: 'starred', label: 'Starred pages', hint: 'The pages you starred and your notes on them' },
		{ id: 'pages', label: 'Saved pages', hint: 'Pages and documents saved for reading without a connection' }
	];

	const heading = $derived(`h${headingLevel}`);
	let chosen = $state<Part[]>(['settings', 'print', 'starred', 'pages']);
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

	let importing = $state<ReaderData | undefined>();
	let importProblem = $state<string | undefined>();
	let importInput: HTMLInputElement | undefined = $state();
	let importQuestion: HTMLParagraphElement | undefined = $state();
	const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

	async function exportData(): Promise<void> {
		let savedParts: ReaderData['savedParts'] = [];
		if (controllingWorker()) {
			const status = await offlineStatus().catch(() => undefined);
			savedParts = status?.collections.filter((item) => item.kept).map((item) => item.id) ?? [];
		}
		const data = buildReaderData(loadSettings(), loadTheme(), loadPrintOptions(), savedParts, loadStarred());
		const file = new Blob([`${JSON.stringify(data, null, '\t')}\n`], { type: 'application/json' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(file);
		link.download = readerDataFileName();
		link.click();
		URL.revokeObjectURL(link.href);
		message = `Exported to ${link.download}.`;
	}

	async function chooseFile(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		message = undefined;
		importProblem = undefined;
		if (!file) return;
		const data = file.size > readerDataSizeLimit ? undefined : parseReaderData(await file.text());
		if (!data) {
			importProblem = 'That file is not a data file exported from this site. Choose a file whose name starts with model-tribal-adr-code-data.';
			return;
		}
		importing = data;
		await tick();
		importQuestion?.focus();
	}

	function applyImport(): void {
		if (!importing) return;
		saveSettings(importing.settings);
		saveTheme(importing.theme);
		savePrintOptions(importing.printOptions);
		const starredBefore = loadStarred();
		const starred = mergeStarred(starredBefore, importing.starred);
		const starredAdded = starred.length - starredBefore.length;
		if (importing.starred.length > 0) saveStarred(starred);
		const starredMessage =
			starredAdded > 0 ? ` Added ${starredAdded === 1 ? 'one starred page' : `${starredAdded} starred pages`} to yours.` : '';
		const parts = collections.filter((collection) => importing?.savedParts.includes(collection.id)).map((collection) => collection.label);
		message =
			parts.length > 0
				? `Imported.${starredMessage} The file lists ${listed(parts)} as saved for offline reading; save ${parts.length === 1 ? 'it' : 'them'} above to have ${parts.length === 1 ? 'it' : 'them'} on this device too.`
				: `Imported your settings, theme and print choices.${starredMessage}`;
		importing = undefined;
		onimported?.();
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
		if (chosen.includes('settings')) {
			onreset();
			// What the sidebar remembers: hidden or not, and which sections are open.
			forgetSidebarChoices();
		}
		if (chosen.includes('print')) savePrintOptions({ ...defaultPrintOptions });
		if (chosen.includes('starred')) saveStarred([]);
		if (chosen.includes('pages')) {
			if (controllingWorker()) {
				for (const collection of collections) {
					await removeCollection(collection.id).catch(() => notDone.push(collection.label));
				}
				// Saved copies of documents go too (src/lib/offline-documents.ts).
				try {
					for (const { set } of (await documentsStatus()).sets) await removeDocuments(set);
				} catch {
					notDone.push('saved documents');
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

	<svelte:element this={heading} class="data-heading">Export and import</svelte:element>
	<p class="hint">Carry your settings, theme, print choices, starred pages with your notes, and the list of parts saved for offline to another browser or device. The saved pages themselves are not in the file.</p>
	{#if importing}
		<div class="confirm confirm-import" role="group" aria-labelledby="local-data-import-question">
			<p id="local-data-import-question" tabindex="-1" bind:this={importQuestion}>
				<strong>Replace your settings, theme and print choices on this device with the ones in this file?</strong>
				{#if importing.exported}It was exported {dateFormat.format(new Date(importing.exported))}.{/if}
				{#if importing.starred.length > 0}Its {importing.starred.length === 1 ? 'starred page is' : `${importing.starred.length} starred pages are`} added to yours, and your own notes are kept.{/if}
			</p>
			<p class="actions">
				<button class="button" type="button" onclick={applyImport}>Yes, replace</button>
				<button class="button button-quiet" type="button" onclick={() => (importing = undefined)}>Cancel</button>
			</p>
		</div>
	{:else}
		<p class="transfer-actions">
			<button class="button button-quiet" type="button" onclick={exportData}>
				<Download size={20} strokeWidth={1.75} />
				Export to a file
			</button>
			<button class="button button-quiet" type="button" onclick={() => importInput?.click()}>
				<Upload size={20} strokeWidth={1.75} />
				Import from a file
			</button>
			<input bind:this={importInput} class="visually-hidden" type="file" accept="application/json,.json" tabindex="-1" aria-hidden="true" onchange={chooseFile} />
		</p>
	{/if}
	{#if importProblem}<p class="field-error" role="alert">{importProblem}</p>{/if}

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

	.confirm-import {
		border-color: var(--color-control-border);
	}

	.transfer-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
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
