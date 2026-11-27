<!--
	@component
	One glossary entry on its own page: the dictionary entry, its status and
	basis At a glance, the other entries that use the term, and References. An
	info page (site/DESIGN.md, "Info pages").
-->
<script lang="ts">
	import Collapsible from '#lib/components/Collapsible.svelte';
	import GlossaryEntry from '#lib/components/GlossaryEntry.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import { basisLabels, statusLabels } from '#lib/glossary-labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const entry = $derived(data.entry);
	// The breadcrumbs lead to the list of terms, so At a glance keeps only facts about the term (Trevor, Nov. 26, 2026; src/lib/info-page.ts).
	const glance = $derived(
		[
			{ field: 'status', label: 'Status', items: [{ text: statusLabels[entry.status] ?? entry.status }] },
			{ field: 'basis', label: 'Basis', items: entry.basis ? [{ text: basisLabels[entry.basis] ?? entry.basis }] : [] },
			{ field: 'code', label: 'Model code', items: entry.codeDefinition ? [{ text: `Defined in ${entry.codeDefinition}` }] : [] }
		].filter((group) => group.items.length > 0)
	);
</script>

<svelte:head>
	<title>{entry.term} · Glossary · Tribal Law Project</title>
</svelte:head>

<InfoPage title={entry.term} {glance} sources={data.sources} trail={[{ label: 'Glossary', href: '/glossary' }]}>
	{#snippet status()}<GlossaryEntry {entry} part="head" />{/snippet}
	<GlossaryEntry {entry} headingLevel={1} part="body" />

	{#if data.linkedFrom.length > 0}
		<Collapsible heading="Other entries that use this term" identifier="linked-from" count={data.linkedFrom.length}>
			<ul>
				{#each data.linkedFrom as other (other.id)}
					<li><a class="term-link" href="/glossary/{other.id}">{other.term}</a></li>
				{/each}
			</ul>
		</Collapsible>
	{/if}
</InfoPage>
