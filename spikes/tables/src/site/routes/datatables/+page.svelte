<script>
  import StaticTable from '#lib/tables/StaticTable.svelte';
  let { data } = $props();
</script>

<svelte:head>
  <title>DataTables</title>
  <link rel="stylesheet" href="/enhancers/datatables.css" />
  <script type="module" src="/enhancers/datatables.js"></script>
</svelte:head>
<h1>Nations directory: DataTables 3</h1>
<StaticTable definition={data.definition} />
