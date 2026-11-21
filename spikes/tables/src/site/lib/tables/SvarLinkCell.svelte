<!-- SVAR cell component for linked cells (nation name, report link). -->
<script>
  let { row, column } = $props();
  const cell = $derived(row.cells[column.id]);
</script>

<a href={cell.href}>{cell.text}{#if cell.hiddenText}<span class="visually-hidden">{cell.hiddenText}</span>{/if}</a>
