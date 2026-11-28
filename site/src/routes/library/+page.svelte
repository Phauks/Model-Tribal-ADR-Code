<script lang="ts">
	// The Library section's own page: a picture card for each group of its menu (design/section-homes/landing-v2/3-library.png).
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

<SectionHome {section} counts={data.counts} lead="Reference works, files to download and what the collection holds." />
