<!--
	@component
	The text of one of the project's documents (the charter, the licenses), as
	src/lib/server/project-documents.ts renders it, then the line that links to
	its file and history on GitHub, the only link to GitHub, which says it goes
	there. ProjectDocumentPage shows it as a page of its own; each license's
	page shows it on an info page (site/DESIGN.md, "Info pages").
-->
<script lang="ts">
	import GithubMark from './GithubMark.svelte';

	let { html, sourceLink, historyLink }: { html: string; sourceLink: string; historyLink: string } = $props();
</script>

<div class="project-document">
	{@html html}

	<p class="document-source small no-print">
		<GithubMark size={16} />
		<span>
			<a href={sourceLink}>This document’s file on GitHub</a> ·
			<a href={historyLink}>Every change to it on GitHub</a>
		</span>
	</p>
</div>

<style>
	.project-document :global(.license-text) {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-size: var(--font-size-small);
	}

	.project-document :global(.github-note) {
		white-space: nowrap;
	}

	.document-source {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		margin-top: var(--space-6);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-line);
	}
</style>
