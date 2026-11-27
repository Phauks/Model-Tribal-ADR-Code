<!--
	@component
	A sponsor's own page (docs/sponsorship.md), as an info page
	(site/DESIGN.md, "Info pages"): the logo and what the gift helps fund At a
	glance. The amount is never shown. The sponsor's link keeps
	rel="sponsored", so it sits in the text rather than Key facts.
-->
<script lang="ts">
	import InfoPage from '#lib/components/InfoPage.svelte';
	import { readableDate } from '#lib/readable-date.ts';
	import { earmarkShortLabels } from '#lib/sponsorship.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const sponsor = $derived(data.sponsor);
	const host = $derived.by(() => {
		if (!sponsor.link) return null;
		try {
			return new URL(sponsor.link).hostname.replace(/^www\./, '');
		} catch {
			return null;
		}
	});
	const picture = $derived(
		sponsor.hasLogo && sponsor.slug ? { src: `/sponsors/${sponsor.slug}/logo`, alt: `${sponsor.name} logo`, width: 160, height: 160 } : undefined
	);
	const glance = $derived([
		{ field: 'earmark', label: 'Helping fund', items: [{ text: earmarkShortLabels[sponsor.earmark] }] },
		{ field: 'since', label: 'Sponsor since', items: [{ text: readableDate(sponsor.since.slice(0, 7)) }] }
	]);
</script>

<svelte:head>
	<title>{sponsor.name} · Sponsors · Tribal Law Project</title>
</svelte:head>

<InfoPage title={sponsor.name ?? 'A sponsor'} lead={sponsor.oneLine ?? undefined} {picture} {glance} trail={[{ label: 'Sponsorship', href: '/sponsor' }]}>
	<p>
		{sponsor.name} helps keep the project free to read and use. Their gift goes toward
		{earmarkShortLabels[sponsor.earmark]}.
	</p>
	{#if host}<p>Website: <a href={sponsor.link} rel="sponsored noopener noreferrer">{host}</a></p>{/if}
	<p class="small muted">Amounts are never shown. <a href="/sponsor">See every sponsor, or become one</a>.</p>
</InfoPage>
