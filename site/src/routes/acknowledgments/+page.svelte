<script lang="ts">
	import PageTools from '#lib/components/PageTools.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.title} · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>{data.title}</h1>
	<PageTools />
	{@html data.html}
	<SourceList
		sources={data.sources}
		introduction="Each source below is followed by the sentence on this page that cites it."
	/>
</div>
