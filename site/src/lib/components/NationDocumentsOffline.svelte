<script lang="ts">
	// On a nation's page, under "Laws and agreements": the copies this site holds of the nation's
	// constitutions and laws, to download as a ZIP or to save for offline reading and remove again
	// (site/DESIGN.md, section 10; src/lib/offline-documents.ts). Shows nothing when the site holds
	// no copies for the nation. Saving shows only while offline saving is running.
	import { onMount } from 'svelte';
	import Download from '@lucide/svelte/icons/download';
	import { verifyAddress } from '#lib/checksums.ts';
	import { formatBytes } from '#lib/offline-collections.ts';
	import { nationSet, type DocumentSetStatus } from '#lib/offline-documents.ts';
	import {
		controllingWorker,
		documentsStatus,
		removeDocuments,
		saveDocuments,
		type DocumentsProgress
	} from '#lib/offline-saving.ts';

	let { nation, held }: { nation: string; held: { count: number; bytes: number } } = $props();

	const set = $derived(nationSet(nation));
	let saved = $state<DocumentSetStatus | undefined>();
	let progress = $state<DocumentsProgress | undefined>();
	let problem = $state<string | undefined>();
	let online = $state(true);
	const numbers = new Intl.NumberFormat('en-US');

	async function refresh(): Promise<void> {
		if (!controllingWorker()) return;
		try {
			saved = (await documentsStatus([set])).sets.find((item) => item.set === set);
		} catch {
			saved = undefined;
		}
	}

	async function save(): Promise<void> {
		problem = undefined;
		try {
			const status = await saveDocuments(set, (update) => (progress = update));
			saved = status.sets.find((item) => item.set === set);
			if (saved && saved.saved < saved.total) {
				problem = `${saved.total - saved.saved} files could not be saved. Press the button again to try them once more.`;
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
		saved = (await removeDocuments(set).catch(() => undefined))?.sets.find((item) => item.set === set);
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

{#if held.count > 0}
	<div class="documents-offline no-print">
		<p>
			{#if saved && saved.total > 0 && saved.saved === saved.total}
				<strong>All {numbers.format(saved.total)} of this nation’s documents are saved on this device</strong>, {formatBytes(saved.bytes)}.
			{:else if saved && saved.saved > 0}
				<strong>{numbers.format(saved.saved)} of this nation’s {numbers.format(saved.total)} documents are saved on this device.</strong>
			{:else}
				This site holds {numbers.format(held.count)} of this nation’s documents, about {formatBytes(held.bytes)}. Download them, or save them to read without a connection.
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
				<a class="button button-quiet" href="/zip/nations/{nation}.zip" download>
					<Download size={18} aria-hidden="true" />
					Download as a ZIP
				</a>
				{#if saved && saved.saved < saved.total}
					<button class="button" type="button" disabled={!online} onclick={save}>
						{saved.saved === 0 ? 'Save on this device' : `Save the other ${numbers.format(saved.total - saved.saved)}`}
					</button>
				{/if}
				{#if saved && (saved.saved > 0 || saved.kept)}
					<button class="button button-quiet" type="button" onclick={remove}>Remove from this device</button>
				{/if}
			</p>
			{#if !online}<p class="hint">Downloading and saving need a connection.</p>{/if}
		{/if}
		<p class="hint checking">The ZIP lists each document’s SHA-256, so you can <a href={verifyAddress}>verify the files</a>.</p>
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

	.documents-offline > .checking {
		flex: 1 1 100%;
	}

	.actions a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	progress {
		display: block;
		width: 100%;
		max-width: 20rem;
		accent-color: var(--color-action);
	}
</style>
