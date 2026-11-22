<script lang="ts">
	// An essay as readers see it (src/lib/server/essay-pages.ts): the text with
	// its case, quotation and analysis boxes, numbered citation markers that
	// open their source in place (CitationPopup.svelte), the Sources list,
	// and when this version was published.
	import SourceList from '#lib/components/SourceList.svelte';
	import type { SourceEntry } from '#lib/server/source-uses.ts';

	interface Publication {
		number: number;
		publishedAtText: string;
		link: string;
	}

	let {
		section,
		sectionLink,
		title,
		html,
		sources,
		publication,
		isNewest,
		newest,
		publicationCount,
		path
	}: {
		section: string;
		sectionLink: string;
		title: string;
		html: string;
		sources: SourceEntry[];
		publication: Publication;
		isNewest: boolean;
		newest: Publication;
		publicationCount: number;
		path: string;
	} = $props();
</script>

<svelte:head>
	<title>{title} · {section} · Model Tribal ADR Code</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="small no-print">
	<a href={sectionLink}>{section}</a> › {title}
</nav>

<article class="reading essay">
	<h1>{title}</h1>
	{#if !isNewest}
		<div class="notice" role="note">
			<p>
				This is an earlier version, published {publication.publishedAtText}. <a href={newest.link}>Read the current version</a>, published {newest.publishedAtText}.
			</p>
		</div>
	{/if}
	<div class="essay-text">
		{@html html}
	</div>
	<SourceList {sources} />
	<p class="small muted essay-dateline" data-print-part="pageDetails">
		Published {publication.publishedAtText}.
		{#if publicationCount > 1}<a class="no-print" href="{path}/history">Earlier versions</a>{/if}
	</p>
</article>
