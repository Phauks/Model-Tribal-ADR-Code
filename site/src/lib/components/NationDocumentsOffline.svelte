<script lang="ts">
	// On a nation's page, under "Laws and agreements": saves the copies this site holds of the
	// nation's constitutions and laws for offline reading, or removes them (site/DESIGN.md,
	// section 10; src/lib/offline-documents.ts). Shows nothing when the site holds no copies for the
	// nation or offline saving is not running.
	import { onMount } from 'svelte';
	import { formatBytes } from '#lib/offline-collections.ts';
	import { nationSet, type DocumentSetStatus } from '#lib/offline-documents.ts';
	import {
		controllingWorker,
		documentsStatus,
		removeDocuments,
		saveDocuments,
		type DocumentsProgress
	} from '#lib/offline-saving.ts';

	let { nation }: { nation: string } = $props();

	const set = $derived(nationSet(nation));
	let held = $state<DocumentSetStatus | undefined>();
	let progress = $state<DocumentsProgress | undefined>();
	let problem = $state<string | undefined>();
	let online = $state(true);
	const numbers = new Intl.NumberFormat('en-US');

	async function refresh(): Promise<void> {
		if (!controllingWorker()) return;
		try {
			held = (await documentsStatus([set])).sets.find((item) => item.set === set);
		} catch {
			held = undefined;
		}
	}

	async function save(): Promise<void> {
		problem = undefined;
		try {
			const status = await saveDocuments(set, (update) => (progress = update));
			held = status.sets.find((item) => item.set === set);
			if (held && held.saved < held.total) {
				problem = `${held.total - held.saved} files could not be saved. Press the button again to try them once more.`;
			}
		} catch {
			problem = 'Saving stopped, perhaps because the connection dropped. Press the button again to continue.';
			await refresh();
		} finally {
			progress = undefined;
		}
	}

	async function remove(): Promise<void> {
		problem = undefined;
		held = (await removeDocuments(set).catch(() => undefined))?.sets.find((item) => item.set === set);
		await refresh();
	}

	onMount(() => {
		const update = () => (online = navigator.onLine);
		update();
		window.addEventListener('online', update);
		window.addEventListener('offline', update);
		void refresh();
		return () => {
			window.removeEventListener('online', update);
			window.removeEventListener('offline', update);
		};
	});
</script>

{#if held && held.total > 0}
	<div class="documents-offline no-print">
		<p>
			{#if held.saved === 0}
				This site holds {numbers.format(held.total)} of this nation’s documents, about {formatBytes(held.totalBytes)}. Save
				them to read without a connection.
			{:else if held.saved === held.total}
				<strong>All {numbers.format(held.total)} of this nation’s documents are saved on this device</strong>, {formatBytes(held.bytes)}.
			{:else}
				<strong>{numbers.format(held.saved)} of this nation’s {numbers.format(held.total)} documents are saved on this device.</strong>
			{/if}
		</p>
		{#if progress}
			<p role="status">
				<label>
					Saving: {numbers.format(progress.done)} of {numbers.format(progress.total)} files
					<progress max={progress.total} value={progress.done}></progress>
				</label>
			</p>
		{:else}
			<p class="actions">
				{#if held.saved < held.total}
					<button class="button" type="button" disabled={!online} onclick={save}>
						{held.saved === 0 ? 'Save this nation’s documents' : `Save the other ${numbers.format(held.total - held.saved)}`}
					</button>
				{/if}
				{#if held.saved > 0 || held.kept}
					<button class="button button-quiet" type="button" onclick={remove}>Remove from this device</button>
				{/if}
			</p>
			{#if !online && held.saved < held.total}<p class="hint">Saving needs a connection.</p>{/if}
		{/if}
		{#if problem}<p class="field-error" role="alert">{problem}</p>{/if}
	</div>
{/if}

<style>
	.documents-offline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
		padding: var(--space-3);
		margin: var(--space-3) 0;
		border-radius: var(--radius-panel);
		background: var(--color-surface);
	}

	.documents-offline > p {
		margin: 0;
		flex: 1 1 18rem;
	}

	.documents-offline > .actions {
		flex: 0 1 auto;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	progress {
		display: block;
		width: 100%;
		max-width: 20rem;
		accent-color: var(--color-action);
	}
</style>
