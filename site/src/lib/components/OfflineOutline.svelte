<script lang="ts">
	// The outline of what a reader can save for offline reading, in Settings > This device (site/DESIGN.md, section 10;
	// src/lib/offline-choices.ts). Each row is a part of the site, a group, a run of pages or a page, with a box to tick
	// for saving or removing it, how much of it is saved and how much space it takes. Rows open one level at a time,
	// and a long group opens as runs of 50 pages, so no list is long (tools/write-offline-catalog.mjs). "Saved by you"
	// shows only the rows that hold something the reader chose. Ticks wait in `pending` until the reader applies them.
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Check from '@lucide/svelte/icons/check';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { formatBytes } from '#lib/offline-collections.ts';
	import {
		countOf,
		type CatalogNode,
		type CatalogPage,
		type NodeState,
		type OfflineView,
		type PageState,
		type PendingChange
	} from '#lib/offline-choices.ts';

	let {
		view,
		show,
		pending = $bindable(),
		lists,
		expanded = $bindable(),
		onopenlist
	}: {
		view: OfflineView;
		show: 'all' | 'saved';
		pending: Record<string, PendingChange>;
		/** The lists read so far, by node key. */
		lists: Record<string, CatalogPage[]>;
		expanded: string[];
		onopenlist: (node: CatalogNode) => void;
	} = $props();

	const numbers = new Intl.NumberFormat('en-US');

	function stateOf(node: CatalogNode): NodeState {
		return view.nodes[node.key] ?? { chosen: 0, bytes: 0 };
	}

	function pageState(page: CatalogPage): PageState {
		return view.pages[page.path] ?? {};
	}

	/** A pending tick on this node or one above it decides; otherwise what is saved. */
	function nodeTicked(node: CatalogNode, above: string[]): 'all' | 'some' | 'none' {
		for (const key of [node.key, ...above.toReversed()]) {
			const change = pending[key];
			if (change) return change.save ? 'all' : 'none';
		}
		const state = stateOf(node);
		const inside = Object.values(pending).some((change) => change.kind === 'page' && pageIn(change.key, node));
		if (state.chosen >= node.pages && node.pages > 0) return inside ? 'some' : 'all';
		return state.chosen > 0 || inside ? 'some' : 'none';
	}

	function pageIn(path: string, node: CatalogNode): boolean {
		return (lists[node.key] ?? []).some((page) => page.path === path) || (node.children ?? []).some((child) => pageIn(path, child));
	}

	function pageTicked(page: CatalogPage, above: string[]): boolean {
		const own = pending[page.path];
		if (own) return own.save;
		for (const key of above.toReversed()) {
			const change = pending[key];
			if (change) return change.save;
		}
		return pageState(page).chosen === true;
	}

	function tickNode(node: CatalogNode, above: string[], on: boolean): void {
		const next = { ...pending };
		// A tick replaces the ticks below it.
		for (const key of Object.keys(next)) if (isBelow(key, node)) delete next[key];
		const state = stateOf(node);
		const savedNow = state.chosen >= node.pages;
		const inherited = above.some((key) => next[key]);
		if ((on && savedNow && !inherited) || (!on && state.chosen === 0 && !inherited)) delete next[node.key];
		else next[node.key] = { key: node.key, kind: 'node', save: on, pages: on ? node.pages - state.chosen : state.chosen, bytes: on ? node.bytes - state.bytes : state.bytes };
		pending = next;
	}

	function isBelow(key: string, node: CatalogNode): boolean {
		if (pageIn(key, node)) return true;
		return (node.children ?? []).some((child) => child.key === key || isBelow(key, child));
	}

	function tickPage(page: CatalogPage, on: boolean): void {
		const next = { ...pending };
		const savedNow = pageState(page).chosen === true;
		if (on === savedNow) delete next[page.path];
		else next[page.path] = { key: page.path, kind: 'page', save: on, pages: 1, bytes: page.bytes };
		pending = next;
	}

	function toggle(node: CatalogNode): void {
		if (expanded.includes(node.key)) expanded = expanded.filter((key) => key !== node.key);
		else {
			expanded = [...expanded, node.key];
			if (node.list && !lists[node.key]) onopenlist(node);
		}
	}

	/** In "Saved by you", a row shows when it holds something chosen or ticked. */
	function shown(node: CatalogNode): boolean {
		if (show === 'all') return true;
		return stateOf(node).chosen > 0 || Object.keys(pending).some((key) => key === node.key || isBelow(key, node));
	}

	/** Partly saved, or changed by the waiting update: "Saved by you" opens it to show which pages. */
	function partly(node: CatalogNode): boolean {
		const state = stateOf(node);
		return (state.chosen > 0 && state.chosen < node.pages) || (state.changed ?? 0) > 0;
	}

	/** In "Saved by you", a group cut into runs lists its saved pages straight under it. */
	function runPages(node: CatalogNode): { run: CatalogNode; page: CatalogPage }[] {
		return (node.children ?? []).flatMap((run) => (lists[run.key] ?? []).map((page) => ({ run, page })));
	}

	function statusOf(node: CatalogNode): string {
		const state = stateOf(node);
		if (state.chosen === 0) return '';
		if (state.chosen >= node.pages) return 'All saved';
		return `${numbers.format(state.chosen)} of ${numbers.format(node.pages)} saved`;
	}
</script>

{#snippet pageRow(page: CatalogPage, list: CatalogNode, above: string[], depth: number)}
	{@const own = pageState(page)}
	{@const wholeList = stateOf(list).chosen >= list.pages && list.pages > 0}
	{@const ticks = pending[page.path] ? pending[page.path].save : pageTicked(page, above) || (wholeList && !above.some((key) => pending[key]))}
	{#if show === 'all' || own.chosen || own.changed || pending[page.path]}
		<li class="row page-row" style:--depth={depth}>
			<span class="opener-space"></span>
			<input
				type="checkbox"
				id="save-{page.path}"
				aria-label="Save {page.label}"
				checked={ticks}
				disabled={!view.online}
				onchange={(event) => tickPage(page, event.currentTarget.checked)}
			/>
			<span class="name">
				<a href={page.path}>{page.label}</a>
			</span>
			<span class="about">
				{#if own.changed}
					<span class="changed"><RefreshCw size={14} aria-hidden="true" /> Changes</span>
				{:else if own.read && !own.chosen}
					<span class="status" title="Saved as you read"><BookOpen size={14} aria-hidden="true" /> Read</span>
				{/if}
				<span class="size">{#if page.count}{countOf(page.count, 'document')}<span aria-hidden="true">&nbsp;·&nbsp;</span><span class="visually-hidden">, </span>{/if}{formatBytes(page.bytes)}</span>
			</span>
		</li>
	{/if}
{/snippet}

{#snippet nodeRow(node: CatalogNode, above: string[], depth: number)}
	{#if shown(node)}
		{@const open = expanded.includes(node.key) || (show === 'saved' && partly(node))}
		{@const ticked = nodeTicked(node, above)}
		{@const state = stateOf(node)}
		{@const status = statusOf(node)}
		<li class="row-item">
			<div class="row" style:--depth={depth}>
				<button
					class="icon-button opener"
					type="button"
					aria-expanded={open}
					aria-label="{open ? 'Close' : 'Open'} {node.label}"
					onclick={() => toggle(node)}
				>
					<ChevronRight size={20} />
				</button>
				<input
					type="checkbox"
					id="save-{node.key}"
					checked={ticked === 'all'}
					indeterminate={ticked === 'some'}
					disabled={!view.online}
					aria-describedby="about-{node.key}"
					onchange={(event) => tickNode(node, above, event.currentTarget.checked)}
				/>
				<label class="name" for="save-{node.key}">
					{node.label}
					{#if node.hint}<span class="hint">{node.hint}</span>{/if}
				</label>
				<span class="about" id="about-{node.key}">
					{#if state.saving}
						<span class="saving">
							Saving {numbers.format(state.saving.done)} of {numbers.format(state.saving.total)}
							<progress max={state.saving.total} value={state.saving.done}></progress>
						</span>
					{:else if state.changed}
						<span class="changed"><RefreshCw size={14} aria-hidden="true" /> {countOf(state.changed)} {state.changed === 1 ? 'changes' : 'change'}</span>
					{:else if status}
						<span class="status">{#if status === 'All saved'}<Check size={14} aria-hidden="true" />{/if}{status}</span>
					{/if}
					<span class="size">{countOf(node.pages, node.unit)}<span aria-hidden="true">&nbsp;·&nbsp;</span><span class="visually-hidden">, </span>{formatBytes(node.bytes)}</span>
				</span>
			</div>
			{#if open}
				{#if node.children && show === 'saved' && node.children.every((child) => child.run)}
					<ul class="rows">
						{#each runPages(node) as { run, page } (page.path)}
							{@render pageRow(page, run, [...above, node.key, run.key], depth + 1)}
						{/each}
					</ul>
				{:else if node.children}
					<ul class="rows">
						{#each node.children as child (child.key)}
							{@render nodeRow(child, [...above, node.key], depth + 1)}
						{/each}
					</ul>
				{:else if node.list}
					{@const pages = lists[node.key]}
					{#if !pages}
						<p class="loading hint" style:--depth={depth + 1}>Loading…</p>
					{:else}
						<ul class="rows">
							{#each pages as page (page.path)}
								{@render pageRow(page, node, [...above, node.key], depth + 1)}
							{/each}
						</ul>
					{/if}
				{/if}
			{/if}
		</li>
	{/if}
{/snippet}

<ul class="rows outline">
	{#each view.catalog?.parts ?? [] as part (part.key)}
		{@render nodeRow(part, [], 0)}
	{/each}
</ul>

<style>
	.rows {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.outline {
		border-top: 1px solid var(--color-line);
	}

	.row {
		display: grid;
		grid-template-columns: var(--layout-target-minimum) auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0 var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: var(--space-1) 0 var(--space-1) calc(var(--depth) * var(--space-4));
		border-bottom: 1px solid var(--color-line);
	}

	.loading {
		margin: 0;
		padding: var(--space-2) 0 var(--space-2) calc(var(--depth) * var(--space-4) + var(--layout-target-minimum));
	}

	.opener :global(svg) {
		transition: transform var(--motion-duration-short) var(--motion-easing-standard);
	}

	.opener[aria-expanded='true'] :global(svg) {
		transform: rotate(90deg);
	}

	.opener-space {
		width: var(--layout-target-minimum);
	}

	.row input {
		width: 1.25rem;
		height: 1.25rem;
		margin: 0;
		accent-color: var(--color-action);
	}

	.name {
		display: flex;
		flex-direction: column;
		min-width: 0;
		font-weight: 600;
		cursor: pointer;
	}

	.page-row .name {
		font-weight: 400;
	}

	.name .hint {
		margin: 0;
		font-weight: 400;
	}

	.about {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-1) var(--space-3);
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.size {
		min-width: 9.5rem;
		text-align: end;
	}

	.page-row .size {
		min-width: 5rem;
	}

	.status,
	.changed {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.changed {
		color: var(--color-action);
		font-weight: 600;
	}

	.saving {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.saving progress {
		width: 6rem;
		accent-color: var(--color-action);
	}

	@media (max-width: 40rem) {
		.row {
			grid-template-columns: var(--layout-target-minimum) auto minmax(0, 1fr);
			padding-left: calc(var(--depth) * var(--space-3));
		}

		.about {
			grid-column: 3;
			justify-content: flex-start;
			flex-wrap: wrap;
		}

		.size {
			min-width: 0;
			text-align: start;
		}

		.loading {
			padding-left: calc(var(--depth) * var(--space-3) + var(--layout-target-minimum));
		}
	}
</style>
