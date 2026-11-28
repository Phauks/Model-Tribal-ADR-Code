<script lang="ts">
	// The Courts and cases section's own page: a picture card for each court system, the same groups and links as the section's menu, and the directory of every court as a card of its own (Trevor, Nov. 28, 2026, design/section-homes/landing-v2/1-cases.png).
	import SectionHome from '#lib/components/SectionHome.svelte';
	import { navigationSections } from '#lib/site-navigation.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const section = navigationSections.find((item) => item.key === 'courts-and-cases')!;
</script>

<svelte:head>
	<title>Courts and cases · Tribal Law Project</title>
	<meta name="description" content="Opinions of Tribal, state and territorial courts, cases of the Supreme Court of the United States and other federal courts, decisions of federal agency boards, and a directory of courts." />
</svelte:head>

<SectionHome {section} counts={data.counts} lead="Decisions of the courts that shape Native law, by the kind of court that made them." />
