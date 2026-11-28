<!--
	@component
	A Federal collection's own page, such as the executive orders: the shared
	collection browser (src/lib/components/CollectionBrowser.svelte), with its
	filters in the side column.
-->
<script lang="ts">
	import CollectionBrowser from '#lib/components/CollectionBrowser.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.view.focus ? `${data.view.focus} · ` : ''}{data.view.title} · Federal Law · Tribal Law Project</title>
	<meta name="description" content="{data.view.lead}{data.view.years ? `, ${data.view.years}` : ''}." />
</svelte:head>

<CollectionBrowser view={data.view} section={data.section} />
