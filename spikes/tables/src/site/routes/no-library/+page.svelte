<script>
  import NoLibraryTable from '#lib/tables/NoLibraryTable.svelte';
  let { data } = $props();
</script>

<svelte:head><title>No library (Svelte state)</title></svelte:head>
<h1>Nations directory: no library, Svelte state</h1>
<NoLibraryTable definition={data.definition} />
