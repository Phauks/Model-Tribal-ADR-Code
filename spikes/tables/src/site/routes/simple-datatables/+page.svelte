<script>
  import StaticTable from '#lib/tables/StaticTable.svelte';
  let { data } = $props();
</script>

<svelte:head>
  <title>simple-datatables</title>
  <link rel="stylesheet" href="/enhancers/simple-datatables.css" />
  <script type="module" src="/enhancers/simple-datatables.js"></script>
</svelte:head>
<h1>Nations directory: simple-datatables</h1>
<StaticTable definition={data.definition} />
