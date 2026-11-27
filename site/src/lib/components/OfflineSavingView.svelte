<script lang="ts">
	// "Choose what to save" on the Read offline page (site/DESIGN.md, section 10), drawn from plain data
	// (src/lib/offline-choices.ts) so the live page (OfflineSaving.svelte) and a fixed sample look the same: one outline
	// of the site (OfflineOutline.svelte), shown whole or only what the reader saved, with a box to find a page; ticks
	// wait in a bar at the bottom until the reader saves or removes them; then the pages saved as the reader read.
	// Trevor asked for this on Nov. 26, 2026.
	import Check from '@lucide/svelte/icons/check';
	import ListTree from '@lucide/svelte/icons/list-tree';
	import Search from '@lucide/svelte/icons/search';
	import OfflineOutline from './OfflineOutline.svelte';
	import ViewSwitch from './ViewSwitch.svelte';
	import { formatBytes } from '#lib/offline-collections.ts';
	import { countOf, type CatalogNode, type CatalogPage, type OfflineView, type PendingChange } from '#lib/offline-choices.ts';

	let {
		view,
		headingLevel = 4,
		initialShow = 'all',
		initialExpanded = [],
		initialPending = {},
		initialFilter = '',
		loadList = async (address: string) => (await (await fetch(address)).json()) as CatalogPage[],
		loadIndex = async () => (await (await fetch('/offline-catalog/index.json')).json()) as [string, string, string][],
		onapply,
		onclearread
	}: {
		view: OfflineView;
		headingLevel?: 3 | 4;
		initialShow?: 'all' | 'saved';
		initialExpanded?: string[];
		initialPending?: Record<string, PendingChange>;
		initialFilter?: string;
		loadList?: (address: string) => Promise<CatalogPage[]>;
		loadIndex?: () => Promise<[string, string, string][]>;
		onapply?: (changes: PendingChange[]) => void;
		onclearread?: () => void;
	} = $props();

	const heading = $derived(`h${headingLevel}`);
	// svelte-ignore state_referenced_locally
	let show = $state<'all' | 'saved'>(initialShow);
	// svelte-ignore state_referenced_locally
	let pending = $state<Record<string, PendingChange>>({ ...initialPending });
	// svelte-ignore state_referenced_locally
	let expanded = $state<string[]>([...initialExpanded]);
	let lists = $state<Record<string, CatalogPage[]>>({});
	// svelte-ignore state_referenced_locally
	let filter = $state(initialFilter);
	let index = $state<[string, string, string][] | undefined>();

	const changes = $derived(Object.values(pending));
	const toSave = $derived(changes.filter((change) => change.save));
	const toRemove = $derived(changes.filter((change) => !change.save));
	const sum = (items: PendingChange[], field: 'pages' | 'bytes') => items.reduce((total, item) => total + item[field], 0);
	const chosenBytes = $derived(Object.entries(view.nodes).filter(([key]) => view.catalog?.parts.some((part) => part.key === key)).reduce((total, [, state]) => total + state.bytes, 0));

	function allNodes(nodes: CatalogNode[]): CatalogNode[] {
		return nodes.flatMap((node) => [node, ...allNodes(node.children ?? [])]);
	}

	/** Lists asked for, so a list is read once however often a row or an effect asks for it. */
	const requested = new Set<string>();

	async function openList(node: CatalogNode): Promise<void> {
		if (!node.list || requested.has(node.key)) return;
		requested.add(node.key);
		const pages = await loadList(node.list).catch(() => undefined);
		if (pages) lists = { ...lists, [node.key]: pages };
		else requested.delete(node.key);
	}

	// In "Saved by you", the lists holding saved pages are read so the pages show.
	$effect(() => {
		if (show !== 'saved' || !view.catalog) return;
		for (const node of allNodes(view.catalog.parts)) {
			const state = view.nodes[node.key];
			// Only a list partly saved, or changed by the update, has pages to show here; a whole saved list shows as one row.
			if (node.list && state && ((state.chosen > 0 && state.chosen < node.pages) || (state.changed ?? 0) > 0)) void openList(node);
		}
	});

	// Expanded lists are read (a sample may start with some open).
	$effect(() => {
		if (!view.catalog) return;
		for (const node of allNodes(view.catalog.parts)) if (node.list && expanded.includes(node.key)) void openList(node);
	});

	const words = $derived(filter.toLowerCase().split(/\s+/).filter(Boolean));
	$effect(() => {
		if (words.length > 0 && !index) void loadIndex().then((loaded) => (index = loaded));
	});
	const found = $derived(
		words.length === 0 || !index ? [] : index.filter(([, label]) => words.every((word) => label.toLowerCase().includes(word)))
	);
	const listOf = $derived(new Map(allNodes(view.catalog?.parts ?? []).map((node) => [node.key, node])));
	/** Where a page sits in the outline: "Cases", "Laws › Executive orders". */
	function placeOf(listKey: string): string {
		const trail: string[] = [];
		const walk = (nodes: CatalogNode[], path: string[]): boolean => {
			for (const node of nodes) {
				if (node.key === listKey) {
					trail.push(...path, node.label);
					return true;
				}
				if (node.children && walk(node.children, [...path, node.label])) return true;
			}
			return false;
		};
		walk(view.catalog?.parts ?? [], []);
		// A run's own name ("Adkins – Brendale") adds nothing to where a page is.
		return trail.filter((_, at) => !(at === trail.length - 1 && listOf.get(listKey)?.label.includes('–'))).join(' › ');
	}

	function tickFound(path: string, label: string, listKey: string, on: boolean): void {
		const savedNow = view.pages[path]?.chosen === true;
		const next = { ...pending };
		if (on === savedNow) delete next[path];
		else next[path] = { key: path, kind: 'page', save: on, pages: 1, bytes: lists[listKey]?.find((page) => page.path === path)?.bytes ?? 0 };
		pending = next;
		void label;
	}

	function apply(): void {
		onapply?.(changes);
		pending = {};
	}

</script>

<div class="offline-saving">
	{#if !view.online}
		<p class="notice" role="note">You are offline. Saving more and checking for updates need a connection.</p>
	{/if}

	{#if !view.available}
		<p class="notice" role="note">Saving for offline starts once the site has loaded fully with a connection. Reload the page and open this again.</p>
	{:else if !view.catalog}
		<p class="hint">{view.online ? 'Loading…' : 'The list of what can be saved loads once you are online.'}</p>
	{:else}
		<div class="toolbar">
			<ViewSwitch
				label="Show"
				value={show}
				onchange={(value) => (show = value)}
				choices={[
					{ value: 'all', label: 'Everything', icon: ListTree, showLabel: true },
					{ value: 'saved', label: `Saved by you, ${formatBytes(chosenBytes)}`, icon: Check, showLabel: true }
				]}
			/>
			<label class="filter">
				<Search size={18} aria-hidden="true" />
				<span class="visually-hidden">Find a page</span>
				<input type="search" placeholder="Find a page" bind:value={filter} />
			</label>
		</div>

		{#if words.length > 0}
			{#if !index}
				<p class="hint">Loading…</p>
			{:else if found.length === 0}
				<p>No page has those words.</p>
			{:else}
				<p class="hint" role="status">{countOf(found.length)} found{#if found.length > 50}; the first 50 are shown{/if}</p>
				<ul class="found">
					{#each found.slice(0, 50) as [path, label, listKey] (path)}
						{@const ticked = pending[path] ? pending[path].save : view.pages[path]?.chosen === true}
						<li>
							<input
								type="checkbox"
								id="found-{path}"
								aria-label="Save {label}"
								checked={ticked}
								disabled={!view.online}
								onchange={(event) => tickFound(path, label, listKey, event.currentTarget.checked)}
							/>
							<span class="found-name"><a href={path}>{label}</a><span class="hint">{placeOf(listKey)}</span></span>
						</li>
					{/each}
				</ul>
			{/if}
		{:else}
			<OfflineOutline {view} {show} {lists} bind:pending bind:expanded onopenlist={openList} />
			{#if show === 'saved' && Object.values(view.nodes).every((state) => state.chosen === 0) && changes.length === 0}
				<p>Nothing yet. Tick a part, a group or a page under Everything, or use the save icon at the top of any page.</p>
			{/if}
		{/if}

		{#if (view.missing ?? 0) > 0 && changes.length === 0 && !Object.values(view.nodes).some((state) => state.saving)}
			<p class="missing">
				<span>{countOf(view.missing ?? 0)} you chose {view.missing === 1 ? 'is' : 'are'} not saved yet.</span>
				<button class="button button-quiet" type="button" disabled={!view.online} onclick={() => onapply?.([])}>Save {view.missing === 1 ? 'it' : 'them'}</button>
			</p>
		{/if}
		{#if changes.length > 0}
			<div class="apply-bar">
				<p>
					{#if toSave.length > 0}<span>Save {countOf(sum(toSave, 'pages'))}, {formatBytes(sum(toSave, 'bytes'))}</span>{/if}
					{#if toRemove.length > 0}<span>Remove {countOf(sum(toRemove, 'pages'))}, {formatBytes(sum(toRemove, 'bytes'))}</span>{/if}
				</p>
				<span class="apply-buttons">
					<button class="button button-quiet" type="button" onclick={() => (pending = {})}>Cancel</button>
					<button class="button" type="button" disabled={!view.online && toSave.length > 0} onclick={apply}>Apply</button>
				</span>
			</div>
		{/if}
		{#if view.problem}<p class="field-error" role="alert">{view.problem}</p>{/if}
	{/if}

	<svelte:element this={heading} class="group-heading">Saved as you read</svelte:element>
	<div class="read">
		<p>
			{#if view.read.pages === 0}
				None yet.
			{:else}
				{countOf(view.read.pages)} you opened, {formatBytes(view.read.bytes)}. They are kept while they stay the same.
			{/if}
		</p>
		{#if view.read.pages > 0}
			<button class="button button-quiet" type="button" onclick={() => onclearread?.()}>Clear</button>
		{/if}
	</div>

</div>

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-3);
		margin: 0 0 var(--space-2);
	}

	.filter {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex: 0 1 16rem;
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-2);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		color: var(--color-ink-muted);
	}

	.filter input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
	}

	.filter input:focus {
		outline: none;
	}

	.filter:focus-within {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.found {
		list-style: none;
		padding: 0;
		margin: 0;
		border-top: 1px solid var(--color-line);
	}

	.found li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.found input {
		width: 1.25rem;
		height: 1.25rem;
		margin: 0;
		accent-color: var(--color-action);
	}

	.found-name {
		display: flex;
		flex-direction: column;
	}

	.found-name .hint {
		margin: 0;
	}

	.apply-bar {
		position: sticky;
		bottom: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-3);
		padding: var(--space-2) 0;
		border-top: 1px solid var(--color-line);
		background: var(--color-paper);
	}

	.apply-bar p {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-3);
		margin: 0;
		font-weight: 600;
	}

	.apply-buttons {
		display: flex;
		gap: var(--space-2);
	}

	.missing {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin: var(--space-3) 0 0;
	}

	.group-heading {
		font-size: var(--font-size-lead);
		margin: var(--space-5) 0 var(--space-2);
	}

	.read {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-3);
	}

	.read p {
		margin: 0;
	}


	.button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
