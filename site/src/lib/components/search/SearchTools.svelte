<!--
	@component
	The search page's tools in the left sidebar (src/lib/sidebar-tools.svelte.ts), as the approved
	mockup draws them (design/search-download/revision-3): Show, with a box for each kind of result
	and its count, so several kinds can be shown at once; Sort; Files, to keep only results with a copy
	to download; then the nation filters. Every group folds, and its heading says how many of its
	answers are ticked.

	The tools keep no choices themselves: each change is reported, and the page writes it into its address.
-->
<script lang="ts" module></script>

<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Dropdown, { type DropdownChoice } from '#lib/components/Dropdown.svelte';
	import { foldForSearch } from '#lib/tables/table-definition.ts';
	import { toggleChoice, type Facet, type FilterChoices } from '#lib/search-filters.ts';
	import type { ResultGroup } from '#lib/search-everything.ts';

	export type SortOrder = 'best' | 'newest' | 'oldest' | 'title';

	/** Facets of any rows: the tools only show their answers and counts. */
	type AnyFacet = Facet<never>;

	interface FacetSet {
		identifier: string;
		facets: AnyFacet[];
		choices: FilterChoices;
		counts: Record<string, Map<string, number>>;
		onchange: (choices: FilterChoices) => void;
	}

	interface Props {
		/** Keeps the ids of the wide column's tools apart from the phone sheet's. */
		place: string;
		kinds: { group: ResultGroup; label: string; count: number }[];
		/** The kinds ticked; none shows everything. */
		shown: ResultGroup[];
		/** Whether counts mean anything yet: nothing is counted before words or filters are given. */
		counting: boolean;
		onshow: (shown: ResultGroup[]) => void;
		sort: SortOrder;
		onsort: (sort: SortOrder) => void;
		filesOnly: boolean;
		fileCount: number;
		onfiles: (filesOnly: boolean) => void;
		/** The nation filters, and the documents' own when only laws are shown. */
		facetSets: FacetSet[];
	}

	let { place, kinds, shown, counting, onshow, sort, onsort, filesOnly, fileCount, onfiles, facetSets }: Props = $props();

	const sortChoices: DropdownChoice<SortOrder>[] = [
		{ value: 'best', label: 'Best match' },
		{ value: 'newest', label: 'Newest first' },
		{ value: 'oldest', label: 'Oldest first' },
		{ value: 'title', label: 'A to Z' }
	];

	/** What the reader typed in each long facet's own box. */
	let narrowing = $state<Record<string, string>>({});

	function shownOptions(set: FacetSet, facet: AnyFacet) {
		const chosen = new Set(set.choices[facet.key] ?? []);
		const words = foldForSearch(narrowing[facet.key] ?? '')
			.split(/\s+/)
			.filter(Boolean);
		return facet.options.filter((option) => {
			if (chosen.has(option.value)) return true;
			if ((set.counts[facet.key]?.get(option.value) ?? 0) === 0) return false;
			const label = foldForSearch(option.label);
			return words.every((word) => label.includes(word));
		});
	}

	function toggleKind(group: ResultGroup, on: boolean) {
		onshow(on ? [...shown, group] : shown.filter((each) => each !== group));
	}

	const number = (count: number) => count.toLocaleString('en-US');
</script>

<div class="search-tools">
	<details class="tool-group" open>
		<summary>
			<span class="fold-mark"><ChevronDown size={16} aria-hidden="true" /></span>
			<span class="group-name">Show</span>
			{#if shown.length > 0}<span class="ticked">{shown.length} of {kinds.length}</span>{/if}
		</summary>
		<fieldset>
			<legend class="visually-hidden">Show these kinds of results</legend>
			{#each kinds as kind (kind.group)}
				{@const id = `search-${place}-show-${kind.group}`}
				<div class="tool-choice" class:empty={counting && kind.count === 0}>
					<input {id} type="checkbox" checked={shown.includes(kind.group)} onchange={(event) => toggleKind(kind.group, event.currentTarget.checked)} />
					<label for={id}>
						<span>{kind.label}</span>
						{#if counting}<span class="count">{number(kind.count)}</span>{/if}
					</label>
				</div>
			{/each}
			{#if shown.length > 0}
				<button class="tool-link" type="button" onclick={() => onshow([])}>Show everything</button>
			{/if}
		</fieldset>
	</details>

	<details class="tool-group" open>
		<summary>
			<span class="fold-mark"><ChevronDown size={16} aria-hidden="true" /></span>
			<span class="group-name">Sort</span>
		</summary>
		<div class="tool-select">
			<Dropdown label="Sort results" hideLabel id="search-{place}-sort" choices={sortChoices} value={sort} onchange={(value) => onsort(value)} />
		</div>
	</details>

	<details class="tool-group" open>
		<summary>
			<span class="fold-mark"><ChevronDown size={16} aria-hidden="true" /></span>
			<span class="group-name">Files</span>
			{#if filesOnly}<span class="ticked">1 of 1</span>{/if}
		</summary>
		<fieldset>
			<legend class="visually-hidden">Files</legend>
			<div class="tool-choice">
				<input id="search-{place}-files" type="checkbox" checked={filesOnly} aria-describedby="search-{place}-files-hint" onchange={(event) => onfiles(event.currentTarget.checked)} />
				<label for="search-{place}-files">
					<span>Has a copy to download</span>
					{#if counting}<span class="count">{number(fileCount)}</span>{/if}
				</label>
			</div>
			<p class="tool-hint" id="search-{place}-files-hint">Copies this site may share</p>
		</fieldset>
	</details>

	{#each facetSets as set (set.identifier)}
		{#each set.facets as facet, index (facet.key)}
			{@const options = shownOptions(set, facet)}
			{@const chosen = set.choices[facet.key]?.length ?? 0}
			{#if options.length > 0 || narrowing[facet.key] || chosen > 0}
				<details class="tool-group" open={(index === 0 && !facet.long) || chosen > 0}>
					<summary>
						<span class="fold-mark"><ChevronDown size={16} aria-hidden="true" /></span>
						<span class="group-name">{facet.label}</span>
						{#if chosen > 0}<span class="ticked">{chosen} of {facet.options.length}</span>{/if}
					</summary>
					<fieldset>
						<legend class="visually-hidden">{facet.label}</legend>
						{#if facet.hint}<p class="tool-hint">{facet.hint}</p>{/if}
						{#if facet.long}
							<div class="field narrow">
								<label class="small" for="search-{place}-{set.identifier}-{facet.key}-narrow">Find a {facet.label.toLocaleLowerCase('en-US')}</label>
								<input
									id="search-{place}-{set.identifier}-{facet.key}-narrow"
									type="search"
									autocomplete="off"
									value={narrowing[facet.key] ?? ''}
									oninput={(event) => (narrowing[facet.key] = event.currentTarget.value)}
								/>
							</div>
						{/if}
						<div class:scrolls={facet.long}>
							{#each options as option (option.value)}
								{@const id = `search-${place}-${set.identifier}-${facet.key}-${option.value}`}
								<div class="tool-choice">
									<input
										{id}
										type="checkbox"
										checked={(set.choices[facet.key] ?? []).includes(option.value)}
										onchange={(event) => set.onchange(toggleChoice(set.choices, facet.key, option.value, event.currentTarget.checked))}
									/>
									<label for={id}>
										<span>{option.label}</span>
										<span class="count">{number(set.counts[facet.key]?.get(option.value) ?? 0)}</span>
									</label>
								</div>
							{:else}
								<p class="tool-hint">No {facet.label.toLocaleLowerCase('en-US')} matches.</p>
							{/each}
						</div>
					</fieldset>
				</details>
			{/if}
		{/each}
	{/each}
</div>

<style>
	.search-tools {
		padding-bottom: var(--space-6);
	}

	.tool-group summary {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		min-height: 2.25rem;
		margin-top: var(--space-3);
		padding: 0.2rem 0.5rem 0.2rem 0.25rem;
		list-style: none;
		cursor: pointer;
		color: var(--color-ink-muted);
		font-size: 0.75rem;
		font-weight: var(--font-weight-bold);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.tool-group summary::-webkit-details-marker {
		display: none;
	}

	.tool-group:not([open]) > summary {
		border-bottom: 1px solid var(--color-line);
	}

	.fold-mark {
		display: inline-flex;
		flex: none;
		transition: transform var(--motion-duration-short) var(--motion-easing-standard);
	}

	.tool-group:not([open]) .fold-mark {
		transform: rotate(-90deg);
	}

	.group-name {
		flex: 1;
	}

	.ticked {
		color: var(--color-link);
		font-size: 0.75rem;
		font-weight: var(--font-weight-semibold);
		letter-spacing: 0;
		text-transform: none;
	}

	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}

	.tool-choice {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0 0.5rem;
		border-radius: 6px;
	}

	.tool-choice input {
		flex: none;
		width: 1.05rem;
		height: 1.05rem;
		margin: 0;
		accent-color: var(--color-link);
	}

	.tool-choice label {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-height: 2.4rem;
		color: var(--color-ink);
		font-size: 0.92rem;
		cursor: pointer;
	}

	.tool-choice.empty label {
		color: var(--color-ink-muted);
	}

	.count {
		flex: none;
		color: var(--color-ink-muted);
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
	}

	.tool-link {
		margin: 0.2rem 0 0;
		padding: 0.3rem 0.5rem;
		border: 0;
		background: none;
		color: var(--color-link);
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.tool-link:hover {
		text-decoration: underline;
	}

	.tool-hint {
		margin: -0.2rem 0.5rem 0.2rem 2.1rem;
		color: var(--color-ink-muted);
		font-size: 0.8rem;
		line-height: 1.35;
	}

	.tool-select {
		padding: 0 0.5rem;
	}

	.tool-select :global(.dropdown) {
		width: 100%;
	}

	.narrow {
		margin: 0 0.5rem var(--space-2);
	}

	.scrolls {
		max-height: 18rem;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
</style>
