<!--
	@component
	One of the project's documents a reader may need (the charter, the
	licenses) as a site page, rendered at build time by
	src/lib/server/project-documents.ts. The only link to GitHub is the one at
	the end that says it goes there.
-->
<script lang="ts">
	import GithubMark from './GithubMark.svelte';

	interface Crumb {
		label: string;
		href: string;
	}

	let {
		title,
		html,
		file,
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
	<title>{title} · Model Tribal ADR Code</title>
</svelte:head>

{#if crumbs.length > 0}
	<nav aria-label="Breadcrumb" class="small">
		{#each crumbs as crumb (crumb.href)}<a href={crumb.href}>{crumb.label}</a>{' › '}{/each}{title}
	</nav>
{/if}

<div class="reading project-document">
	<h1>{title}</h1>
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
