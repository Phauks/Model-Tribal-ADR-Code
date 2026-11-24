<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import SponsorCard from '#lib/components/SponsorCard.svelte';
	import { earmarkLabels } from '#lib/sponsorship.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.sponsor.name} · Sponsors · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<Breadcrumbs trail={[{ label: 'Sponsorship', href: '/sponsor' }]} />
	<h1>{data.sponsor.name}</h1>
	<SponsorCard sponsor={data.sponsor} linkName={false} />
	<p>
		{data.sponsor.name} helps keep the project free to read and use. Their gift goes toward
		{earmarkLabels[data.sponsor.earmark].charAt(0).toLowerCase() + earmarkLabels[data.sponsor.earmark].slice(1)}.
	</p>
	<p class="small muted">Amounts are never shown. <a href="/sponsor">See every sponsor, or become one</a>.</p>
</div>
