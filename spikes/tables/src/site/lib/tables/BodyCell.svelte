<!-- One body cell from a table definition. The row header column becomes
     <th scope="row">; links carry hidden text so a screen reader hears
     "Report a problem with Sample Nation 2", not a list of identical links. -->
<script>
  let { column, cell } = $props();
</script>

{#snippet content()}
  {#if cell.href}
    <a href={cell.href}>{cell.text}{#if cell.hiddenText}<span class="visually-hidden">{cell.hiddenText}</span>{/if}</a>
  {:else}
    {cell.text}
  {/if}
{/snippet}

{#if column.isRowHeader}
  <th scope="row">{@render content()}</th>
{:else}
  <td class:align-end={column.align === 'end'} data-sort-value={cell.sortValue}>{@render content()}</td>
{/if}
