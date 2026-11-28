<script lang="ts">
	// The Nations section's own page: a picture card for each group of its menu (Trevor, Nov. 28, 2026, design/section-homes/landing-v2/2-nations.png). The table of every nation is the Directory, at /nations/directory.
	import SectionHome from '#lib/components/SectionHome.svelte';
	import { navigationSections } from '#lib/site-navigation.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const section = navigationSections.find((item) => item.key === 'nations')!;
</script>

<svelte:head>
	<title>Native nations · Tribal Law Project</title>
	<meta name="description" content="Every Native nation in a table and on a map, each nation’s own law, its history, data, federal offices and programs, and languages." />
</svelte:head>

<SectionHome {section} counts={data.counts} lead="Each Native nation, its own law, and where it meets the law of the United States." />
