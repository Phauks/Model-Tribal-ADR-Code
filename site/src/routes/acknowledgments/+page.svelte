<script lang="ts">
	import SourceList from '#lib/components/SourceList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.title} · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>{data.title}</h1>
	{@html data.html}
	<p>People who helped write and review this work are listed on the <a href="/contributors">Contributors</a> page and the <a href="/people">People</a> page.</p>
	<SourceList sources={data.sources} />
</div>
