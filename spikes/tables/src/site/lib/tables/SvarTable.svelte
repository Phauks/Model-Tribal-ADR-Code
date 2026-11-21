<!-- Candidate "SVAR Svelte DataGrid": a complete grid component. It renders
     its own markup (div elements with ARIA grid roles) and its own theme. The
     theme's web fonts and icon font load from cdn.svar.dev unless fonts is
     false; the spike turns them off so nothing leaves the site. -->
<script>
  import { onMount } from 'svelte';
  import { Grid, Willow, WillowDark } from '@svar-ui/svelte-grid';
  import { columnsFor, compareCells, foldForSearch, sortValueOf } from '#tables/table-definition.mjs';
  import SvarLinkCell from './SvarLinkCell.svelte';

  let { definition } = $props();
  const shownColumns = columnsFor(definition, 'website');
  // SVAR wants flat rows with an id; keep the cell objects for the link cells.
  const data = definition.rows.map((row) => {
    const flat = { id: row.key, cells: row.cells };
    for (const column of shownColumns) flat[column.key] = sortValueOf(row.cells[column.key]);
    return flat;
  });
  const columns = shownColumns.map((column) => ({
    id: column.key,
    header: column.header,
    flexgrow: column.isRowHeader ? 2 : 1,
    width: column.isRowHeader ? 220 : 150,
    sort: column.sortable ? (first, second) => compareCells(column, first.cells[column.key], second.cells[column.key]) : false,
    template: column.type === 'date' || column.type === 'number' ? (_value, row) => row.cells[column.key].text : undefined,
    cell: definition.rows[0]?.cells[column.key]?.href ? SvarLinkCell : undefined,
  }));

  // The rows arrive sorted; tell the grid so its first click reverses the order.
  const sortMarks = { [definition.defaultSort.key]: { order: definition.defaultSort.direction === 'descending' ? 'desc' : 'asc' } };
  let api = $state();
  let query = $state('');
  let interactive = $state(false);
  let dark = $state(false);
  // SVAR's "search-rows" action marks matches but keeps every row, so
  // search uses "filter-rows" with the shared rule instead (measured).
  const searchableKeys = shownColumns.filter((column) => column.searchable).map((column) => column.key);
  $effect(() => {
    const words = foldForSearch(query).split(/\s+/).filter(Boolean);
    if (!api) return;
    if (words.length === 0) {
      api.exec('filter-rows', {});
      return;
    }
    api.exec('filter-rows', {
      filter: (row) => {
        const haystack = foldForSearch(searchableKeys.map((key) => row.cells[key].text).join(' '));
        return words.every((word) => haystack.includes(word));
      },
    });
  });
  onMount(() => {
    interactive = true;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const theme = document.documentElement.dataset.theme;
    dark = theme === 'dark' || (theme !== 'light' && media.matches);
    document.documentElement.dataset.tableReady = 'true';
  });
</script>

{#if interactive}
  <div class="table-tools">
    <div>
      <label for="svar-search">Search nations</label>
      <input id="svar-search" type="search" bind:value={query} autocomplete="off" />
    </div>
  </div>
{/if}
<p id="svar-caption"><strong>{definition.caption}</strong></p>
<div class="svar-box" aria-labelledby="svar-caption">
  {#if dark}
    <WillowDark fonts={false}>
      <Grid {data} {columns} {sortMarks} bind:this={api} />
    </WillowDark>
  {:else}
    <Willow fonts={false}>
      <Grid {data} {columns} {sortMarks} bind:this={api} />
    </Willow>
  {/if}
</div>

<style>
  .svar-box {
    height: 70vh;
    max-width: 100%;
  }
</style>
