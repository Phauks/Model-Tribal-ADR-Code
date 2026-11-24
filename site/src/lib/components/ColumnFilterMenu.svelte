<!--
	@component
	What a column's filter menu holds (Trevor, Nov. 24, 2026: "filters should
	be on the top of the columns of tables, not in a separate area"): for a
	column of values, a list to tick, each value with how many rows it leaves,
	an "All" box, and a "Find a value" box when the list is long; for a column
	of free text, a "Contains" box; and Clear. The shared table opens it from
	the funnel in a column's header (DataTable.svelte), and Build a table from
	a grouped table's filters, so a filter works the same everywhere. The
	popover around it, and its styles (.table-popover in global.css), belong to
	the page that opens it.
-->
<script lang="ts">
	import type { ColumnFilter, FilterChoice } from '#lib/tables/table-definition.ts';

	interface Props {
		/** Makes the field ids unique on the page. */
		identifier: string;
		/** The column's header. */
		title: string;
		kind: 'values' | 'contains';
		/** For a column of values: what it can be narrowed to, with each one's row count. */
		choices?: FilterChoice[];
		/** The filter as it is now. */
		filter?: ColumnFilter;
		/** The filter as the reader changed it; undefined when cleared. */
		onchange: (filter: ColumnFilter | undefined) => void;
	}

	let { identifier, title, kind, choices = [], filter, onchange }: Props = $props();

	let findText = $state('');
	const ticked = $derived(filter?.values ?? []);
	const found = $derived(
		findText.trim() === '' ? choices : choices.filter((choice) => choice.value.toLocaleLowerCase('en-US').includes(findText.trim().toLocaleLowerCase('en-US')))
	);

	function tick(value: string, on: boolean) {
		onchange({ values: on ? [...ticked, value] : ticked.filter((other) => other !== value) });
	}
</script>

<p class="popover-title">{title}</p>
{#if kind === 'values'}
	{#if choices.length > 8}
		<input type="search" class="popover-find" aria-label="Find a value" placeholder="Find a value" autocomplete="off" bind:value={findText} />
	{/if}
	<ul class="popover-list">
		{#if findText.trim() === ''}
			<li class="all">
				<label>
					<input
						type="checkbox"
						checked={ticked.length === 0}
						onchange={(event) => {
							event.currentTarget.checked = true;
							onchange(undefined);
						}}
					/>
					All
				</label>
			</li>
		{/if}
		{#each found as choice (choice.value)}
			<li>
				<label>
					<input type="checkbox" checked={ticked.includes(choice.value)} onchange={(event) => tick(choice.value, event.currentTarget.checked)} />
					<span class="choice-value">{choice.value}</span>
					<span class="choice-count">{choice.count.toLocaleString('en-US')}</span>
				</label>
			</li>
		{:else}
			<li class="none">Nothing matches.</li>
		{/each}
	</ul>
{:else}
	<label class="popover-label" for="{identifier}-contains">Contains</label>
	<input
		id="{identifier}-contains"
		type="text"
		class="popover-find"
		autocomplete="off"
		value={filter?.contains ?? ''}
		oninput={(event) => onchange({ contains: event.currentTarget.value })}
	/>
{/if}
<div class="popover-foot">
	<button type="button" class="popover-button" onclick={() => onchange(undefined)}>Clear</button>
</div>
