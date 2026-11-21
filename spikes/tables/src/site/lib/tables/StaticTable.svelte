<!-- The table with no interactive state, for pages that send no Svelte
     code to the browser (csr = false). Sort values are written as data
     attributes so a small script, or simple-datatables, can sort the existing
     rows without a second copy of the data. The attribute names start with
     data-table- because DataTables reads data-sortable, data-searchable and
     data-type on headers as its own options (measured). -->
<script>
  import { columnsFor } from '#tables/table-definition.mjs';
  import BodyCell from './BodyCell.svelte';

  let { definition, skipOffscreenRows = false } = $props();
  const columns = columnsFor(definition, 'website');
</script>

<div class="table-scroll" class:skip-offscreen-rows={skipOffscreenRows} role="region" aria-labelledby="{definition.identifier}-caption" tabindex="0">
  <table class="data-table" id={definition.identifier} data-enhance-table>
    <caption id="{definition.identifier}-caption">{definition.caption}</caption>
    <thead>
      <tr>
        {#each columns as column (column.key)}
          <th
            scope="col"
            class:align-end={column.align === 'end'}
            data-column-key={column.key}
            data-table-sortable={column.sortable ? '' : undefined}
            data-table-searchable={column.searchable ? '' : undefined}
            data-table-type={column.type}
            aria-sort={column.key === definition.defaultSort.key ? definition.defaultSort.direction : undefined}>{column.header}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each definition.rows as row (row.key)}
        <tr>
          {#each columns as column (column.key)}
            <BodyCell {column} cell={row.cells[column.key]} />
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
