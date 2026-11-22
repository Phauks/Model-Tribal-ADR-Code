<script lang="ts">
	// Saving for offline, in Settings under "Data" (site/DESIGN.md, section 10): what is saved on this
	// device, buttons to save or remove whole collections, the space used, and
	// the edition saved, with a check for updates. Used in the Settings dialog
	// and on the /offline page. Everything here talks to the service worker
	// through src/lib/offline-saving.ts.
	import { onMount } from 'svelte';
	import { version } from '$app/env';
	import { page } from '$app/state';
	import {
		buildTime,
		collections,
		formatBytes,
		type CollectionIdentifier,
		type OfflineStatus
	} from '#lib/offline-collections.ts';
	import {
		askToKeepStorage,
		controllingWorker,
		offlineStatus,
		removeCollection,
		saveCollection,
		storageUse,
		type Progress,
		type StorageUse
	} from '#lib/offline-saving.ts';
	import { siteUpdates } from '#lib/site-updates.svelte.ts';

	let { headingLevel = 4 }: { headingLevel?: 3 | 4 } = $props();

	let status = $state<OfflineStatus | undefined>();
	let storage = $state<StorageUse>({});
	let progress = $state<Partial<Record<CollectionIdentifier, Progress>>>({});
	let problem = $state<string | undefined>();
	let available = $state(true);
	let online = $state(true);

	const versions = $derived(page.data.versions as { content: string; site: string; print: string } | undefined);
	const built = buildTime(version);
	const numbers = new Intl.NumberFormat('en-US');
	const heading = $derived(`h${headingLevel}`);

	async function refresh(): Promise<void> {
		available = controllingWorker() !== null;
		storage = await storageUse();
		if (!available) return;
		try {
			status = await offlineStatus();
		} catch {
			available = false;
		}
	}

	async function save(id: CollectionIdentifier): Promise<void> {
		problem = undefined;
		try {
			status = await saveCollection(id, (update) => (progress = { ...progress, [id]: update }));
			storage = await storageUse();
		} catch (error) {
			problem =
				error instanceof Error && error.message === 'newer-build'
					? 'A newer version of the site is out. Update the site first, then save again.'
					: 'Saving stopped, perhaps because the connection dropped. Press the button again to continue where it stopped.';
			await refresh();
		} finally {
			const { [id]: _finished, ...rest } = progress;
			progress = rest;
		}
	}

	async function remove(id: CollectionIdentifier): Promise<void> {
		problem = undefined;
		status = await removeCollection(id).catch(() => status);
		storage = await storageUse();
	}

	async function keepStorage(): Promise<void> {
		await askToKeepStorage();
		storage = await storageUse();
	}

	function timeOf(date: Date): string {
		return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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

<div class="offline-saving">
	<p>
		Every page you open is saved on this device as you read it. You can also save a whole part of
		the site now, to read later without a connection. Parts you save are saved again, from the new
		version, each time the site is updated.
	</p>

	{#if !online}
		<p class="notice" role="note">
			You are offline. Saving more pages and checking for updates need a connection.
		</p>
	{/if}

	{#if !available}
		<p class="notice" role="note">
			Saving for offline starts once the site has loaded fully with a connection. Reload the page and
			open this again.
		</p>
	{:else if status}
		<ul class="collections">
			{#each collections as collection (collection.id)}
				{@const state = status.collections.find((item) => item.id === collection.id)}
				{@const running = progress[collection.id]}
				{#if state}
					<li class="collection">
						<svelte:element this={heading} class="collection-name">
							{collection.label}
						</svelte:element>
						<p class="hint">{collection.hint}</p>
						<p>
							{#if state.saved === 0}
								Not saved yet. {numbers.format(state.total)} pages.
							{:else}
								{numbers.format(state.saved)} of {numbers.format(state.total)} pages saved, {formatBytes(
									state.bytes
								)}.
							{/if}
							{#if state.kept}Kept: saved again after each update.{/if}
						</p>
						{#if running}
							<p role="status">
								<label>
									Saving: {numbers.format(running.done)} of {numbers.format(running.total)} files
									<progress max={running.total} value={running.done}></progress>
								</label>
							</p>
						{:else}
							<p class="collection-actions">
								{#if state.saved < state.total}
									<button
										class="button"
										type="button"
										disabled={!online}
										onclick={() => save(collection.id)}
									>
										{state.saved === 0
											? `Save all ${numbers.format(state.total)} pages`
											: state.total - state.saved === 1
												? 'Save the other page'
												: `Save the other ${numbers.format(state.total - state.saved)} pages`}
									</button>
								{/if}
								{#if state.saved > 0 || state.kept}
									<button class="button button-quiet" type="button" onclick={() => remove(collection.id)}>
										Remove saved pages
									</button>
								{/if}
							</p>
						{/if}
					</li>
				{/if}
			{/each}
		</ul>
		{#if problem}<p class="field-error" role="alert">{problem}</p>{/if}
	{/if}

	{#if storage.usedBytes !== undefined}
		<p>This site uses about {formatBytes(storage.usedBytes)} on this device.</p>
	{/if}
	{#if storage.persisted === true}
		<p>Your browser will keep the saved pages when the device runs low on space.</p>
	{:else if storage.persisted === false}
		<p>
			<button class="button button-quiet" type="button" onclick={keepStorage}>
				Keep saved pages when space runs low
			</button>
		</p>
		<p class="hint">
			Without this, the browser may clear saved pages when the device runs low on space. Some
			browsers decide this on their own.
		</p>
	{/if}

	<svelte:element this={heading} class="updates-heading">Updates</svelte:element>
	<p>
		{#if versions}
			You are reading content version {versions.content}, website version {versions.site}{#if built},
				built {built.toLocaleDateString('en-US', { dateStyle: 'medium' })}{/if}.
		{/if}
		<a href="/changelog">What changed in each version</a>
	</p>
	{#if siteUpdates.waiting}
		<p>
			<strong>An update is ready.</strong>
			{#if siteUpdates.available}It brings content version {siteUpdates.available.content}.{/if}
		</p>
		<p>
			<button class="button" type="button" onclick={() => siteUpdates.apply()}>Update now</button>
		</p>
	{:else}
		<p>
			<button
				class="button button-quiet"
				type="button"
				disabled={!online || siteUpdates.checking}
				onclick={() => siteUpdates.check()}
			>
				{siteUpdates.checking ? 'Checking…' : 'Check for updates'}
			</button>
		</p>
		{#if siteUpdates.lastChecked}
			<p role="status">
				Checked at {timeOf(siteUpdates.lastChecked)}. {siteUpdates.waiting
					? ''
					: 'This is the latest version.'}
			</p>
		{/if}
	{/if}
</div>

<style>
	.collections {
		list-style: none;
		padding: 0;
		margin: 0 0 var(--space-4);
	}

	.collection {
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.collection-name {
		margin: 0;
		font-size: var(--font-size-body);
	}

	.collection p {
		margin: 0 0 var(--space-2);
	}

	.collection-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	progress {
		display: block;
		width: 100%;
		max-width: 24rem;
		accent-color: var(--color-action);
	}

	.updates-heading {
		font-size: var(--font-size-lead);
		margin: var(--space-5) 0 var(--space-2);
	}

	.button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
