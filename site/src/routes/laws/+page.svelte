<script lang="ts">
	// The Federal law section's own page: its pages, in the groups of its menu (SectionHome.svelte).
	import SectionHome from '#lib/components/SectionHome.svelte';
	import { navigationSections } from '#lib/site-navigation.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const section = navigationSections.find((item) => item.key === 'federal-law')!;
</script>

<svelte:head>
	<title>Federal law · Tribal Law Project</title>
	<meta name="description" content="The United States’ treaties, statutes, the U.S. Code’s Title 25, executive orders, regulations, Federal Register notices and agency records about Native nations." />
</svelte:head>

<SectionHome {section} counts={data.counts} />
