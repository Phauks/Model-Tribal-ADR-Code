<script>
  import SvarTable from '#lib/tables/SvarTable.svelte';
  let { data } = $props();
</script>

<svelte:head><title>SVAR Svelte DataGrid</title></svelte:head>
<h1>Nations directory: SVAR Svelte DataGrid</h1>
<SvarTable definition={data.definition} />
