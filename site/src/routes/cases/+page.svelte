<script lang="ts">
	// The Courts and cases section's own page: its pages, in the groups of its menu (SectionHome.svelte).
	import SectionHome from '#lib/components/SectionHome.svelte';
	import { navigationSections } from '#lib/site-navigation.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const section = navigationSections.find((item) => item.key === 'courts-and-cases')!;
</script>

<svelte:head>
	<title>Courts and cases · Tribal Law Project</title>
	<meta name="description" content="Cases of the Supreme Court of the United States, opinions of tribal, state and other courts, decisions of the Interior Board of Indian Appeals and a directory of courts." />
</svelte:head>

<SectionHome {section} counts={data.counts} />
