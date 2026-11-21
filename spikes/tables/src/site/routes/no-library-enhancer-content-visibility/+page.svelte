<script>
  import StaticTable from '#lib/tables/StaticTable.svelte';
  let { data } = $props();
</script>

<svelte:head>
  <title>No library (small script, off-screen rows skipped)</title>
  <script type="module" src="/enhancers/enhance-table.js"></script>
</svelte:head>
<h1>Nations directory: no library, small script, off-screen rows skipped</h1>
<StaticTable definition={data.definition} skipOffscreenRows />
