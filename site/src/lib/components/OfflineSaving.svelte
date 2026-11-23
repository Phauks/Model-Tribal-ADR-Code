<script lang="ts">
	// Saving for offline, in Settings under "Data" (site/DESIGN.md, section 10): the space used,
	// then what can be saved grouped by kind (pages of this site; pictures, sound and video),
	// what stays online and why, and the edition saved, with a check for updates. Trevor picked
	// this grouped layout on Nov. 23, 2026. Used in the Settings dialog and on the /offline page.
	// Everything here talks to the service worker through src/lib/offline-saving.ts.
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
	/** About how many bytes each whole collection takes, from /offline-sizes.json (written after the build). */
	let sizes = $state<Partial<Record<CollectionIdentifier, number>>>({});

	const versions = $derived(page.data.versions as { content: string; site: string; print: string } | undefined);
	const built = buildTime(version);
	const numbers = new Intl.NumberFormat('en-US');
	const heading = $derived(`h${headingLevel}`);
	const subheading = $derived(`h${headingLevel + 1}`);

	async function loadSizes(): Promise<void> {
		try {
			const response = await fetch('/offline-sizes.json');
			if (response.ok) sizes = await response.json();
		} catch {
			// Offline or missing: the sizes are left out.
		}
	}

	/** About how much more saving the rest of a collection would take, or undefined when not known. */
	function sizeToSave(id: CollectionIdentifier, savedBytes: number): string | undefined {
		const total = sizes[id];
		if (typeof total !== 'number') return undefined;
		return `about ${formatBytes(Math.max(total - savedBytes, 1000))}`;
	}

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
		void loadSizes();
		return () => {
			window.removeEventListener('online', update);
			window.removeEventListener('offline', update);
		};
	});
</script>

<div class="offline-saving">
	<p>
		Pages you open are saved on this device as you read them. You can also save a whole part of the
		site now, to read later without a connection. Parts you save are saved again, from the new
		version, each time the site is updated.
	</p>

	{#if !online}
		<p class="notice" role="note">
			You are offline. Saving more pages and checking for updates need a connection.
		</p>
	{/if}

	{#if storage.usedBytes !== undefined || storage.persisted !== undefined}
		<div class="storage">
			{#if storage.usedBytes !== undefined}
				<p><strong>This site uses about {formatBytes(storage.usedBytes)} on this device.</strong></p>
			{/if}
			{#if storage.persisted === true}
				<p>Your browser will keep what is saved when the device runs low on space.</p>
			{:else if storage.persisted === false}
				<p>
					<button class="button button-quiet" type="button" onclick={keepStorage}>
						Keep saved files when space runs low
					</button>
				</p>
				<p class="hint">
					Without this, the browser may clear saved pages when the device runs low on space. Some
					browsers decide this on their own.
				</p>
			{/if}
		</div>
	{/if}

	<svelte:element this={heading} class="group-heading">Pages of this site</svelte:element>
	<p class="hint">Everything here is written or gathered by the project, so all of it can be saved.</p>
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
				{@const toSave = state ? sizeToSave(collection.id, state.bytes) : undefined}
				{#if state}
					<li class="collection">
						<div class="collection-text">
							<svelte:element this={subheading} class="collection-name">
								{collection.label}
							</svelte:element>
							<p class="hint">{collection.hint}</p>
							<p>
								{#if state.saved === 0}
									Not saved yet. {numbers.format(state.total)} pages{#if toSave}, {toSave}{/if}.
								{:else if state.saved === state.total}
									All {numbers.format(state.total)} pages saved, {formatBytes(state.bytes)}.
								{:else}
									{numbers.format(state.saved)} of {numbers.format(state.total)} pages saved, {formatBytes(
										state.bytes
									)}.{#if toSave}{' '}Saving the rest takes {toSave}.{/if}
								{/if}
								{#if state.kept}{' '}<span class="kept">Kept: saved again after each update.</span>{/if}
							</p>
						</div>
						{#if running}
							<p class="collection-actions" role="status">
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

	<svelte:element this={heading} class="group-heading">Pictures, sound and video</svelte:element>
	<ul class="plain-list">
		<li>
			<strong>Pictures</strong> on a page are saved with the page, except a nation’s seal or logo.
		</li>
		<li>
			<strong>Video and sound</strong> play only with a connection. Where a page has a transcript,
			it is saved with the page.
		</li>
	</ul>

	<details class="online-only">
		<summary>Online only, never saved on this device</summary>
		<ul>
			<li>A nation’s seal or logo, so that a nation can withdraw it at once</li>
			<li>Our copies of documents, such as laws and constitutions; the pages that cite them are saved</li>
			<li>
				Documents held by the National Indian Law Library or by code publishers, and articles and
				books: pages link to them
			</li>
			<li>Videos on YouTube, and other video and sound</li>
			<li>The zoomable map; the drawn map works offline</li>
			<li>Your workspace, messages and anything else that needs you to sign in</li>
		</ul>
		<p><a href="/offline#what-stays-online">Why some things stay online</a></p>
	</details>

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
	.storage {
		padding: var(--space-3);
		margin: 0 0 var(--space-5);
		border-radius: var(--radius-panel);
		background: var(--color-surface);
	}

	.storage p {
		margin: 0 0 var(--space-2);
	}

	.storage > :last-child {
		margin-bottom: 0;
	}

	.group-heading {
		font-size: var(--font-size-lead);
		margin: var(--space-5) 0 var(--space-1);
	}

	.group-heading + .hint {
		margin-top: 0;
	}

	.collections {
		list-style: none;
		padding: 0;
		margin: 0 0 var(--space-4);
		border-top: 1px solid var(--color-line);
	}

	.collection {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.collection-text {
		flex: 1 1 20rem;
		min-width: 0;
	}

	.collection-name {
		margin: 0;
		font-size: var(--font-size-body);
	}

	.collection p {
		margin: 0 0 var(--space-2);
	}

	.collection .collection-text > :last-child,
	.collection .collection-actions {
		margin-bottom: 0;
	}

	.kept {
		font-weight: 600;
		color: var(--color-action);
	}

	.collection-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.plain-list {
		padding: 0;
		margin: 0 0 var(--space-4);
		list-style: none;
		border-top: 1px solid var(--color-line);
	}

	.plain-list li {
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.online-only {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		padding: 0 var(--space-3);
		margin: 0 0 var(--space-4);
	}

	.online-only summary {
		min-height: 44px;
		display: flex;
		align-items: center;
		font-weight: 700;
		cursor: pointer;
	}

	.online-only ul {
		margin: 0 0 var(--space-2);
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
