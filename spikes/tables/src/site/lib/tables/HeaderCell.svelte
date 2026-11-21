<!-- A column header. Before scripts run (or without them) it is plain text.
     Once the page is interactive, a sortable header holds a button, and the
     header carries aria-sort when the table is sorted by it, following the
     WAI-ARIA Authoring Practices sortable table example. -->
<script>
  let { column, interactive, sortDirection, onsort } = $props();
  const ariaSort = $derived(sortDirection ? sortDirection : undefined);
  const indicator = $derived(sortDirection === 'ascending' ? '▲' : sortDirection === 'descending' ? '▼' : '↕');
</script>

<th scope="col" class:align-end={column.align === 'end'} aria-sort={ariaSort} data-column-key={column.key}>
  {#if interactive && column.sortable}
    <button type="button" class="sort-button" onclick={() => onsort(column.key)}>
      {column.header}<span class="sort-indicator" aria-hidden="true">{indicator}</span>
    </button>
  {:else}
    {column.header}
  {/if}
</th>
