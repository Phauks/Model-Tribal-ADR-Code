<script lang="ts">
	// On a nation's page, on the "Laws and agreements" heading: how many of the nation's constitutions, laws and court opinions this site holds, with icon buttons to download them as a ZIP and to save them for offline reading or remove them again (Trevor picked this layout, mockup A, on Nov. 24, 2026; site/DESIGN.md, section 10; src/lib/offline-documents.ts). The page passes it only when the site holds copies for the nation. The save button shows once the site's worker runs the page, since the worker does the saving.
	import { onMount } from 'svelte';
	import Download from '@lucide/svelte/icons/download';
	import HardDriveDownload from '@lucide/svelte/icons/hard-drive-download';
	import Trash2 from '@lucide/svelte/icons/trash-2';
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

	const documents = $derived(`${numbers.format(held.count)} ${held.count === 1 ? 'document' : 'documents'}`);
	const size = $derived(formatBytes(held.bytes));
	const allSaved = $derived(saved !== undefined && saved.total > 0 && saved.saved === saved.total);
	const missing = $derived(saved ? saved.total - saved.saved : 0);
	const saveLabel = $derived(
		saved && saved.saved > 0 ? `Save the other ${numbers.format(missing)} on this device` : `Save the ${documents} on this device`
	);

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
			if (saved && saved.saved < saved.total) problem = `${numbers.format(saved.total - saved.saved)} not saved. Try again.`;
		} catch {
			problem = 'Saving stopped. Try again.';
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
		// On a first visit the worker takes over the page a moment after it loads.
		const takeover = () => void refresh();
		navigator.serviceWorker?.addEventListener('controllerchange', takeover);
		void refresh();
		return () => {
			window.removeEventListener('online', update);
			window.removeEventListener('offline', update);
			navigator.serviceWorker?.removeEventListener('controllerchange', takeover);
		};
	});
</script>

<span class="documents-offline">
	{#if problem}
		<span class="state small field-error" role="alert">{problem}</span>
	{/if}
	<span class="state small muted" role="status">
		{#if progress}
			Saving {numbers.format(progress.done)} of {numbers.format(progress.total)}
		{:else if allSaved && saved}
			{numbers.format(saved.total)} saved · {formatBytes(saved.bytes)}
		{:else if saved && saved.saved > 0}
			{numbers.format(saved.saved)} of {numbers.format(saved.total)} saved
		{:else if !online}
			Needs a connection
		{:else}
			{documents} · {size}
		{/if}
	</span>
	<a class="icon-button" href="/zip/nations/{nation}.zip" download aria-label="Download the {documents} (.zip, {size})" title="Download the {documents} (.zip, {size})">
		<Download size={24} aria-hidden="true" />
	</a>
	{#if saved && !allSaved}
		<button class="icon-button" type="button" disabled={!online || progress !== undefined} onclick={save} aria-label={saveLabel} title={saveLabel}>
			<HardDriveDownload size={24} aria-hidden="true" />
		</button>
	{/if}
	{#if saved && (saved.saved > 0 || saved.kept) && !progress}
		<button class="icon-button" type="button" onclick={remove} aria-label="Remove from this device" title="Remove from this device">
			<Trash2 size={24} aria-hidden="true" />
		</button>
	{/if}
</span>

<style>
	.documents-offline {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--color-ink);
	}

	.state {
		margin-inline-end: var(--space-2);
		white-space: nowrap;
	}

	.state:empty {
		display: none;
	}

	/* On a phone the heading needs the room; the buttons still say what they hold. */
	@media (max-width: 30rem) {
		.state.muted {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
	}

	.icon-button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}
</style>
