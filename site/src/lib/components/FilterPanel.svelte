<!--
	@component
	The filters a reader ticks to narrow a list (src/lib/search-filters.ts):
	one fieldset of checkboxes per facet, each answer with how many rows it
	would show. Answers that would show nothing are left out unless ticked, so
	the panel never offers a dead end. A long facet, such as the states, gets a
	box for narrowing its own answers. Each facet folds, so a reader can put
	away the ones they do not need.

	The panel does not keep the choices itself: it reports each tick through
	onchange, and the page writes the choices into its address.

	Use:
	<FilterPanel identifier="nations" facets={facets} {choices} {counts} onchange={(next) => …} />
-->
<script lang="ts" generics="Row">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { foldForSearch } from '#lib/tables/table-definition.ts';
	import { toggleChoice, type Facet, type FilterChoices } from '#lib/search-filters.ts';

	interface Props {
		/** Unique on the page; used for element ids. */
		identifier: string;
		facets: Facet<Row>[];
		choices: FilterChoices;
		counts: Record<string, Map<string, number>>;
		onchange: (choices: FilterChoices) => void;
	}

	let { identifier, facets, choices, counts, onchange }: Props = $props();

	/** What the reader typed in each long facet's own box. */
	let narrowing = $state<Record<string, string>>({});

	function shownOptions(facet: Facet<Row>) {
		const chosen = new Set(choices[facet.key] ?? []);
		const words = foldForSearch(narrowing[facet.key] ?? '')
			.split(/\s+/)
			.filter(Boolean);
		return facet.options.filter((option) => {
			if (chosen.has(option.value)) return true;
			if ((counts[facet.key]?.get(option.value) ?? 0) === 0) return false;
			const label = foldForSearch(option.label);
			return words.every((word) => label.includes(word));
		});
	}

	function chosenCount(facet: Facet<Row>): number {
		return choices[facet.key]?.length ?? 0;
	}
</script>

<div class="filter-panel">
	{#each facets as facet (facet.key)}
		{@const options = shownOptions(facet)}
		{#if options.length > 0 || narrowing[facet.key] || chosenCount(facet) > 0}
			<details class="facet" open={!facet.long || chosenCount(facet) > 0}>
				<summary>
					<span class="fold-mark"><ChevronDown size={20} aria-hidden="true" /></span>
					<span class="facet-name">{facet.label}</span>
					{#if chosenCount(facet) > 0}
						<span class="chip">{chosenCount(facet)} chosen</span>
					{/if}
				</summary>
				<fieldset>
					<legend class="visually-hidden">{facet.label}</legend>
					{#if facet.hint}<p class="hint">{facet.hint}</p>{/if}
					{#if facet.long}
						<div class="field narrow">
							<label class="small" for="{identifier}-{facet.key}-narrow">Find a {facet.label.toLocaleLowerCase('en-US')}</label>
							<input
								id="{identifier}-{facet.key}-narrow"
								type="search"
								autocomplete="off"
								value={narrowing[facet.key] ?? ''}
								oninput={(event) => (narrowing[facet.key] = event.currentTarget.value)}
							/>
						</div>
					{/if}
					<ul class="options" class:scrolls={facet.long}>
						{#each options as option (option.value)}
							{@const id = `${identifier}-${facet.key}-${option.value}`}
							{@const count = counts[facet.key]?.get(option.value) ?? 0}
							<li class="choice">
								<input
									type="checkbox"
									{id}
									checked={(choices[facet.key] ?? []).includes(option.value)}
									onchange={(event) =>
										onchange(toggleChoice(choices, facet.key, option.value, event.currentTarget.checked))}
								/>
								<label for={id}>
									{option.label}
									<span class="count muted">{count.toLocaleString('en-US')}</span>
								</label>
							</li>
						{:else}
							<li class="small muted">No {facet.label.toLocaleLowerCase('en-US')} matches.</li>
						{/each}
					</ul>
				</fieldset>
			</details>
		{/if}
	{/each}
</div>

<style>
	.facet {
		border-top: 1px solid var(--color-line);
	}

	.facet summary {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		list-style: none;
		cursor: pointer;
		font-weight: var(--font-weight-semibold);
	}

	.facet summary::-webkit-details-marker {
		display: none;
	}

	.facet-name {
		flex: 1;
	}

	.fold-mark {
		display: inline-flex;
		transition: transform 0.15s;
	}

	.facet:not([open]) .fold-mark {
		transform: rotate(-90deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.fold-mark {
			transition: none;
		}
	}

	fieldset {
		border: 0;
		margin: 0 0 var(--space-3);
		padding: 0;
		min-width: 0;
	}

	.narrow {
		margin-bottom: var(--space-2);
	}

	.options {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	/* A long list scrolls inside its own box, so the other facets stay in reach. */
	.options.scrolls {
		max-height: 18rem;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-right: var(--space-2);
	}

	.choice {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}

	.choice input {
		flex: none;
		width: 1.25rem;
		height: 1.25rem;
		margin: 0.6rem 0 0;
		accent-color: var(--color-action);
	}

	.choice label {
		flex: 1;
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-2) 0;
		min-height: var(--layout-target-minimum);
		box-sizing: border-box;
		cursor: pointer;
		font-size: var(--font-size-small);
	}

	.count {
		font-variant-numeric: tabular-nums;
	}
</style>
