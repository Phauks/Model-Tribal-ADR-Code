<script>
  import TanStackTable from '#lib/tables/TanStackTable.svelte';
  let { data } = $props();
</script>

<svelte:head><title>TanStack Table</title></svelte:head>
<h1>Nations directory: TanStack Table v9</h1>
<TanStackTable definition={data.definition} />
