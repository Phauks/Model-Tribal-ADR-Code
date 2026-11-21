<!-- Candidate "no library": Svelte 5 state plus the shared sort and search
     functions in tables/table-definition.mjs. The prerendered HTML holds every
     row; after hydration the same component sorts and searches. -->
<script>
  import { onMount } from 'svelte';
  import { columnsFor, filterRows, sortRows } from '#tables/table-definition.mjs';
  import BodyCell from './BodyCell.svelte';
  import HeaderCell from './HeaderCell.svelte';
  import SearchBox from './SearchBox.svelte';

  let { definition } = $props();
  const columns = columnsFor(definition, 'website');
  let sortKey = $state(definition.defaultSort.key);
  let direction = $state(definition.defaultSort.direction);
  let query = $state('');
  let interactive = $state(false);
  const visibleRows = $derived(sortRows(definition, filterRows(definition, definition.rows, query), sortKey, direction));

  function sortBy(key) {
    direction = key === sortKey && direction === 'ascending' ? 'descending' : 'ascending';
    sortKey = key;
  }
  onMount(() => {
    interactive = true;
    document.documentElement.dataset.tableReady = 'true';
  });
</script>

{#if interactive}
  <SearchBox identifier={definition.identifier} label="Search nations" bind:value={query} shownCount={visibleRows.length} totalCount={definition.rows.length} />
{/if}
<div class="table-scroll" role="region" aria-labelledby="{definition.identifier}-caption" tabindex="0">
  <table class="data-table" id={definition.identifier}>
    <caption id="{definition.identifier}-caption">{definition.caption}</caption>
    <thead>
      <tr>
        {#each columns as column (column.key)}
          <HeaderCell {column} {interactive} sortDirection={column.key === sortKey ? direction : null} onsort={sortBy} />
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each visibleRows as row (row.key)}
        <tr>
          {#each columns as column (column.key)}
            <BodyCell {column} cell={row.cells[column.key]} />
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
