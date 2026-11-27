<script lang="ts">
	// The Writing section's own page: its pages, in the groups of its menu (SectionHome.svelte).
	import SectionHome from '#lib/components/SectionHome.svelte';
	import { navigationSections } from '#lib/site-navigation.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const section = navigationSections.find((item) => item.key === 'writing')!;
</script>

<svelte:head>
	<title>Writing · Tribal Law Project</title>
	<meta name="description" content="The project’s foundations, essays, methods and stories, and the model code and peacemaking code being written." />
</svelte:head>

<SectionHome {section} counts={data.counts} />
