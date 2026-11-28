<script lang="ts">
	// The About section's own page: a picture card for each group of its menu (design/section-homes/landing-v2/5-about.png). The About essay itself is at /about/project.
	import SectionHome from '#lib/components/SectionHome.svelte';
	import { navigationSections } from '#lib/site-navigation.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const section = navigationSections.find((item) => item.key === 'about')!;
</script>

<svelte:head>
	<title>About · Tribal Law Project</title>
	<meta name="description" content="What the Tribal Law Project is, its timeline to public review, recent changes, how to contribute, and its news and events." />
</svelte:head>

<SectionHome {section} counts={data.counts} lead="The Tribal Law Project, how it is going, and its news and events." />
