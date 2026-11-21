<!-- Candidate "TanStack Table v9": the library keeps sorting and search
     state and produces the row order; the markup is the same semantic table
     as the other candidates (TanStack is headless). The sort and search
     rules are the shared ones from tables/table-definition.mjs, passed in as
     functions, so all media sort the same way. -->
<script>
  import { onMount } from 'svelte';
  import {
    columnFilteringFeature,
    createFilteredRowModel,
    createSortedRowModel,
    createTable,
    globalFilteringFeature,
    rowSortingFeature,
    tableFeatures,
  } from '@tanstack/svelte-table';
  import { columnsFor, compareCells, foldForSearch, sortValueOf } from '#tables/table-definition.mjs';
  import BodyCell from './BodyCell.svelte';
  import HeaderCell from './HeaderCell.svelte';
  import SearchBox from './SearchBox.svelte';

  let { definition } = $props();
  const shownColumns = columnsFor(definition, 'website');

  const features = tableFeatures({
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    columnFilteringFeature,
    globalFilteringFeature,
    filteredRowModel: createFilteredRowModel(),
  });
  const columns = shownColumns.map((column) => ({
    id: column.key,
    accessorFn: (row) => sortValueOf(row.cells[column.key]),
    header: column.header,
    enableSorting: column.sortable,
    enableGlobalFilter: Boolean(column.searchable),
    sortFn: (first, second) => compareCells(column, first.original.cells[column.key], second.original.cells[column.key]),
  }));
  const searchableKeys = shownColumns.filter((column) => column.searchable).map((column) => column.key);

  let query = $state('');
  let interactive = $state(false);

  const table = createTable({
    features,
    columns,
    get data() {
      return definition.rows;
    },
    getRowId: (row) => row.key,
    initialState: {
      sorting: [{ id: definition.defaultSort.key, desc: definition.defaultSort.direction === 'descending' }],
    },
    enableSortingRemoval: false,
    // Search: every word must appear in one of the searchable cells, the same rule as the other media.
    getColumnCanGlobalFilter: (column) => searchableKeys.includes(column.id),
    globalFilterFn: (row, _columnId, filterValue) => {
      const words = foldForSearch(filterValue).split(/\s+/).filter(Boolean);
      const haystack = foldForSearch(searchableKeys.map((key) => row.original.cells[key].text).join(' '));
      return words.every((word) => haystack.includes(word));
    },
  });

  $effect(() => {
    table.setGlobalFilter(query);
  });

  const rows = $derived(table.getRowModel().rows);
  const headers = $derived(table.getHeaderGroups()[0].headers);

  function directionOf(header) {
    const sorted = header.column.getIsSorted();
    return sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : null;
  }
  function sortBy(key) {
    const column = table.getColumn(key);
    column.toggleSorting(column.getIsSorted() === 'asc');
  }
  onMount(() => {
    interactive = true;
    document.documentElement.dataset.tableReady = 'true';
  });
</script>

{#if interactive}
  <SearchBox identifier={definition.identifier} label="Search nations" bind:value={query} shownCount={rows.length} totalCount={definition.rows.length} />
{/if}
<div class="table-scroll" role="region" aria-labelledby="{definition.identifier}-caption" tabindex="0">
  <table class="data-table" id={definition.identifier}>
    <caption id="{definition.identifier}-caption">{definition.caption}</caption>
    <thead>
      <tr>
        {#each headers as header, index (header.id)}
          <HeaderCell column={shownColumns[index]} {interactive} sortDirection={directionOf(header)} onsort={sortBy} />
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.id)}
        <tr>
          {#each shownColumns as column (column.key)}
            <BodyCell {column} cell={row.original.cells[column.key]} />
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
