<script lang="ts">
	// Saving for offline reading, live (site/DESIGN.md, section 10): what the service worker says is saved, drawn by
	// OfflineSummary.svelte and, on the Read offline page, by OfflineSavingView.svelte. Settings > This device shows
	// the summary with a link to that page; the page shows the summary and the outline to choose from (Trevor,
	// Nov. 26, 2026: the outline needs more room than Settings has). Everything here talks to the service worker
	// through src/lib/offline-saving.ts.
	import { onMount } from 'svelte';
	import OfflineSavingView from './OfflineSavingView.svelte';
	import OfflineSummary from './OfflineSummary.svelte';
	import { catalogAddress, type Catalog, type ChoicesStatus, type OfflineView, type PendingChange } from '#lib/offline-choices.ts';
	import {
		applyChoices,
		askToKeepStorage,
		choicesStatus,
		clearReadPages,
		controllingWorker,
		storageUse,
		type Progress,
		type StorageUse
	} from '#lib/offline-saving.ts';
	import { siteUpdates } from '#lib/site-updates.svelte.ts';
	import { sendProblem } from '#lib/problem-reports.ts';

	let {
		layout,
		headingLevel = 2
	}: {
		/** "summary" in Settings, with a link to the Read offline page; "page" on that page. */
		layout: 'summary' | 'page';
		headingLevel?: 2 | 3 | 4;
	} = $props();

	let online = $state(true);
	let available = $state(true);
	let storage = $state<StorageUse>({});
	let catalog = $state<Catalog | undefined>();
	let status = $state<ChoicesStatus | undefined>();
	let saving = $state<{ keys: string[]; progress?: Progress } | undefined>();
	let problem = $state<string | undefined>();

	const nodes = $derived.by(() => {
		const all = { ...(status?.nodes ?? {}) };
		if (saving?.progress) {
			for (const key of saving.keys) all[key] = { ...(all[key] ?? { chosen: 0, bytes: 0 }), saving: { done: saving.progress.done, total: saving.progress.total } };
		}
		return all;
	});

	const view = $derived<OfflineView>({
		online,
		available,
		storage,
		catalog,
		nodes,
		pages: status?.pages ?? {},
		read: status?.read ?? { pages: 0, bytes: 0 },
		update: {
			checking: siteUpdates.checking,
			checkedAt: siteUpdates.lastChecked,
			waiting: siteUpdates.waiting ? (status?.waiting ?? { changedPages: 0, bytes: 0 }) : undefined
		},
		missing: status?.missing ?? 0,
		problem
	});

	function explain(error: unknown): string {
		return error instanceof Error && error.message === 'newer-build'
			? 'A newer version of the site is out. Update the site first, then save again.'
			: 'Saving stopped, perhaps because the connection dropped. Apply again to continue where it stopped.';
	}

	async function loadCatalog(): Promise<void> {
		try {
			const response = await fetch(catalogAddress);
			if (response.ok) catalog = (await response.json()) as Catalog;
		} catch (problem) {
			// The summary shows without the outline.
			sendProblem(problem, { code: 'offline.catalog' });
		}
	}

	async function refresh(): Promise<void> {
		available = controllingWorker() !== null;
		storage = await storageUse();
		if (!available) return;
		try {
			status = await choicesStatus();
		} catch (error) {
			if (error instanceof Error && error.message === 'newer-build') problem = explain(error);
			else if (error instanceof Error && error.message === 'no-worker') available = false;
		}
	}

	async function apply(changes: PendingChange[]): Promise<void> {
		problem = undefined;
		const keys = changes.filter((change) => change.save && change.kind === 'node').map((change) => change.key);
		saving = { keys };
		try {
			status = await applyChoices(
				changes.map(({ key, kind, save }) => ({ key, kind, save })),
				{
					onProgress: (progress) => (saving = { keys, progress }),
					onDone: (done) => {
						status = done;
						saving = undefined;
						void storageUse().then((use) => (storage = use));
					},
					onFailed: (message) => {
						problem = explain(new Error(message));
						saving = undefined;
						void refresh();
					}
				}
			);
			if (!changes.some((change) => change.save)) saving = undefined;
			storage = await storageUse();
		} catch (error) {
			problem = explain(error);
			saving = undefined;
			await refresh();
		}
	}

	async function clearRead(): Promise<void> {
		status = await clearReadPages().catch((problem) => {
			sendProblem(problem, { code: 'offline.clear-read' });
			return status;
		});
		storage = await storageUse();
	}

	async function keepStorage(): Promise<void> {
		await askToKeepStorage();
		storage = await storageUse();
	}

	// A waiting update is found: the status says how many saved pages it changes.
	$effect(() => {
		if (siteUpdates.waiting && available) void refresh();
	});

	onMount(() => {
		const update = () => (online = navigator.onLine);
		update();
		window.addEventListener('online', update);
		window.addEventListener('offline', update);
		void loadCatalog();
		void refresh();
		// A quick check for a newer version each time this opens, so the Updates card says when it last looked.
		if (navigator.onLine && !siteUpdates.lastChecked) void siteUpdates.check();
		return () => {
			window.removeEventListener('online', update);
			window.removeEventListener('offline', update);
		};
	});
</script>

{#if layout === 'summary'}
	<p>Pages you open are saved on this device as you read them.</p>
	<OfflineSummary
		{view}
		headingLevel={(headingLevel + 1) as 3 | 4 | 5}
		manageLink="/offline"
		oncheck={() => siteUpdates.check()}
		onupdate={() => siteUpdates.apply()}
		onkeepstorage={keepStorage}
	/>
{:else}
	<OfflineSummary {view} {headingLevel} oncheck={() => siteUpdates.check()} onupdate={() => siteUpdates.apply()} onkeepstorage={keepStorage} />
	<svelte:element this={`h${headingLevel}`} class="choose-heading">Choose what to save</svelte:element>
	<OfflineSavingView {view} headingLevel={(headingLevel + 1) as 3 | 4} onapply={apply} onclearread={clearRead} />
{/if}

<style>
	.choose-heading {
		margin-top: var(--space-6);
	}
</style>
