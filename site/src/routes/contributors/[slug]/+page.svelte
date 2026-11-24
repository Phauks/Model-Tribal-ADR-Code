<!--
	@component
	A contributor's public page (docs/contributor-profiles.md, "Contributor
	pages"), as an info page (site/DESIGN.md, "Info pages"): the picture and
	key facts At a glance, the person's own words, then their work on this
	site.
-->
<script lang="ts">
	import InfoPage from '#lib/components/InfoPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hasWork = $derived(data.essays.length > 0 || data.reviewedGroups.length > 0);
	const picture = $derived(data.picture ? { src: data.picture, alt: `Picture of ${data.name}`, width: 160, height: 160 } : undefined);
	const glance = $derived(
		[
			{ field: 'pronouns', label: 'Pronouns', items: data.pronouns ? [{ text: data.pronouns }] : [] },
			{
				field: 'nations',
				label: data.nations.length === 1 ? 'Nation' : 'Nations',
				items: data.nations.map((nation) => ({ text: nation.name, link: nation.path ?? undefined }))
			},
			{ field: 'organization', label: 'Organization', items: data.organization ? [{ text: data.organization }] : [] },
			{ field: 'board', label: 'Board', items: data.board ? [{ text: data.board }] : [] },
			{
				field: 'specialties',
				label: 'Specialties',
				items: data.specialties.length > 0 ? [{ text: data.specialties.join(', '), badges: data.specialties.map((specialty) => ({ text: specialty })) }] : []
			},
			{ field: 'languages', label: 'Languages', items: data.languages.map((language) => ({ text: language })) },
			{ field: 'credit', label: 'Credited under', items: [{ text: data.sectionHeading, note: data.since ? `Since ${data.since}` : undefined }] }
		].filter((group) => group.items.length > 0)
	);
</script>

<svelte:head>
	<title>{data.name} · Contributors · Model Tribal ADR Code</title>
	<meta name="description" content="{data.name}: credit and published work on the Model Tribal ADR Code." />
</svelte:head>

<InfoPage title={data.name} {picture} {glance} trail={[{ label: 'People', href: '/people' }]}>
	{#if data.biography}
		<p class="biography">{data.biography}</p>
	{/if}

	<section aria-labelledby="work">
		<h2 id="work">Work on this site</h2>
		{#if hasWork}
			{#if data.essays.length > 0}
				<section aria-labelledby="helped-write">
					<h3 id="helped-write">Helped write</h3>
					<ul>
						{#each data.essays as essay (essay.path)}<li><a href={essay.path}>{essay.title}</a></li>{/each}
					</ul>
				</section>
			{/if}
			{#each data.reviewedGroups as group (group.heading)}
				<section aria-label="Reviewed: {group.heading}">
					<h3>Reviewed: {group.heading}</h3>
					<ul>
						{#each group.items as item (item.path)}<li><a href={item.path}>{item.title}</a></li>{/each}
					</ul>
				</section>
			{/each}
		{:else}
			<p>Work {data.name} helps with is listed here once it is published.</p>
		{/if}
	</section>
</InfoPage>

<style>
	.biography {
		white-space: pre-line;
	}
</style>
