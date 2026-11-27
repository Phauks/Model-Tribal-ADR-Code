<script lang="ts">
	// The Library section's own page: its pages, in the groups of its menu (SectionHome.svelte).
	import SectionHome from '#lib/components/SectionHome.svelte';
	import { navigationSections } from '#lib/site-navigation.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const section = navigationSections.find((item) => item.key === 'library')!;
</script>

<svelte:head>
	<title>Library · Tribal Law Project</title>
	<meta name="description" content="The glossary, biographies, historic maps, source documents, data sets, forms and statistics." />
</svelte:head>

<SectionHome {section} counts={data.counts} />
