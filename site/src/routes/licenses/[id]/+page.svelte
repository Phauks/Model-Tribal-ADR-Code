<!--
	@component
	The full text of one license in LICENSES/, as an info page (site/DESIGN.md,
	"Info pages"): its identifier and the material it covers At a glance, from
	the table in LICENSE.md, then the text.
-->
<script lang="ts">
	import InfoPage from '#lib/components/InfoPage.svelte';
	import ProjectDocumentText from '#lib/components/ProjectDocumentText.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const glance = $derived(
		[
			{ field: 'identifier', label: 'Identifier', items: [{ text: data.identifier }] },
			{ field: 'covers', label: 'Covers', items: data.materials.map((material) => ({ text: material })) },
			{ field: 'all', label: 'Licenses', items: [{ text: 'Licenses by material', link: '/licenses' }] }
		].filter((group) => group.items.length > 0)
	);
</script>

<svelte:head>
	<title>{data.title} · Model Tribal ADR Code</title>
</svelte:head>

<InfoPage title={data.title} {glance} trail={[{ label: 'Licenses', href: '/licenses' }]}>
	<ProjectDocumentText html={data.html} sourceLink={data.sourceLink} historyLink={data.historyLink} />
</InfoPage>
