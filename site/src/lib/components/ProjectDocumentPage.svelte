<!--
	@component
	One of the project's documents a reader may need (the charter, the
	licenses) as a site page, rendered at build time by
	src/lib/server/project-documents.ts. The only link to GitHub is the one at
	the end that says it goes there.
-->
<script lang="ts">
	import Breadcrumbs, { type Crumb } from './Breadcrumbs.svelte';
	import ProjectDocumentText from './ProjectDocumentText.svelte';

	let {
		title,
		html,
		sourceLink,
		historyLink,
		crumbs = []
	}: {
		title: string;
		html: string;
		file: string;
		sourceLink: string;
		historyLink: string;
		crumbs?: Crumb[];
	} = $props();
</script>

<svelte:head>
	<title>{title} · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs trail={crumbs} />

<div class="reading">
	<h1>{title}</h1>
	<ProjectDocumentText {html} {sourceLink} {historyLink} />
</div>
