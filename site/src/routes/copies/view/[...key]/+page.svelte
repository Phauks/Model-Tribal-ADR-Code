<script lang="ts">
	import { courtPagePath } from '#lib/court-pages.ts';
	import Download from '@lucide/svelte/icons/download';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Shield from '@lucide/svelte/icons/shield';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CopyHash from '#lib/components/CopyHash.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const details = $derived(data.details);
	const opinion = $derived(details?.opinion);
	const italic = $derived(Boolean(opinion || details?.isCase));
	const publishedAt = $derived(URL.canParse(data.original) ? new URL(data.original).hostname : data.original);
	const sourceName = 'Caselaw Access Project';
	// A link to one page of a PDF, such as where an opinion starts on a case's page ("#page=22"), opens the file at that page.
	let pdfPage = $state('');
	$effect(() => {
		const read = () => (pdfPage = /^#page=\d{1,5}$/.test(location.hash) ? location.hash : '');
		read();
		addEventListener('hashchange', read);
		return () => removeEventListener('hashchange', read);
	});
</script>

<svelte:head>
	<title>{data.title} · Source documents · Tribal Law Project</title>
</svelte:head>

<div class="reading">
	<Breadcrumbs
		trail={[
			{ label: 'Source documents', href: '/copies' },
			...(details ? [{ label: details.list.title, href: `/copies/list/${details.list.slug}` }] : [])
		]}
		current={data.title}
	/>
	<h1>
		{#if italic}<i>{data.title}</i>{:else}{data.title}{/if}
	</h1>
	{#if opinion}
		<p class="lead">
			{opinion.citation} (<a href={courtPagePath(opinion.court)}>{opinion.court}</a>{data.decidedText ? `, decided ${data.decidedText}` : ''}){#if opinion.docket}<span class="small muted">
					· Docket {opinion.docket}</span
				>{/if}
		</p>
	{:else if details?.citation}
		<!-- How the project cites it (Trevor, Nov. 24, 2026: "we should include more info, such as the citation on this page"). -->
		<p class="lead citation">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- the project's own citation, built at build time from its source records -->
			{@html details.citation}{#if details.casePage}<a class="case-link small" href={details.casePage}>Case page</a>{/if}
		</p>
	{/if}

	{#if data.namesReplaced}
		<!-- Policy: research/analyses/2026-11-24-redaction-practices-for-opinions.md, section 1. -->
		<p class="names-replaced">
			<Shield size={18} aria-hidden="true" /><span
				>Names replaced to protect privacy. Our changes are in [brackets]. <a href={data.nameRequest}>Ask to replace a name</a>.</span
			>
		</p>
	{/if}

	{#if data.citeOnly}
		<p class="restricted">
			At the nation’s request, this site does not show the text of this {opinion ? 'opinion' : 'document'}.{#if data.original}
				<a href={data.original} rel="noopener noreferrer">Read it at {opinion ? 'the Caselaw Access Project' : publishedAt}<ExternalLink size={14} aria-hidden="true" /></a>.{/if}
		</p>
	{/if}
</div>

{#if !data.citeOnly}
	<section class="document" aria-label="The document">
		{#if data.isPdf}
			{#key pdfPage}<iframe class="frame" src={data.file + pdfPage} title="{data.title} ({data.kind})"></iframe>{/key}
		{:else}
			<!-- A saved web page runs nothing and loads nothing: its own response says so too (src/lib/server/public-copy-serving.ts). -->
			<iframe class="frame" src={data.file} title="{data.title} ({data.kind})" sandbox="" referrerpolicy="no-referrer"></iframe>
		{/if}
		<!--
			Small links under the document, in place of the buttons above it: the browser's own viewer
			has its download and new tab buttons too, and on phones that show no PDF in a frame these
			are the way to the file (Trevor, Nov. 24, 2026).
		-->
		<p class="file-links small muted">
			<a href={data.file} target="_blank" rel="noopener"><ExternalLink size={14} aria-hidden="true" />Open in New Tab</a>
			<a href={data.file} download={data.fileName}><Download size={14} aria-hidden="true" />Download</a>
			<a href={data.removal}>Ask to remove or redact this copy</a>
		</p>
		<!-- Where the copy came from, out of the way under the document. -->
		<p class="provenance small muted">
			{#if details && details.nations.length > 0}<span
					>{#each details.nations as nation, index (nation.id)}{index > 0 ? '; ' : ''}<a href="/nations/{nation.id}">{nation.name}</a>{/each}</span
				>{/if}
			<span>{data.fileName}</span>
			<span>{data.size}</span>
			<span>Published at {#if data.original}<a href={data.original} rel="noopener noreferrer">{publishedAt}</a>{:else}{sourceName}{/if}</span>
			{#if data.capturedText}<span>Copy made {data.capturedText}</span>{/if}
		</p>
		<p class="provenance small muted">
			<span>SHA-256 <CopyHash sha256={data.sha256} label="this document" /></span>
			<span><a href={data.verify}>Verify File</a></span>
		</p>
		<p class="print-only">This copy is at {data.file} on this site{#if data.original}, and was published at {data.original}{/if}.</p>
	</section>
{/if}

<style>
	h1 {
		overflow-wrap: anywhere;
		margin-bottom: var(--space-1);
	}

	.names-replaced {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		margin: var(--space-3) 0;
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--color-link);
		background: var(--color-surface-raised);
	}

	.names-replaced :global(svg) {
		flex: none;
		margin-top: 0.2em;
	}

	.lead {
		margin-top: 0;
	}

	.citation .case-link {
		margin-left: var(--space-3);
		white-space: nowrap;
	}

	.frame {
		display: block;
		width: 100%;
		height: 85vh;
		min-height: 30rem;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
	}

	.file-links {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-4);
		margin: var(--space-2) 0 0;
	}

	/* Running text, so a separator stays at the end of the item before it when the line wraps. */
	.provenance {
		margin: var(--space-1) 0 0;
	}

	.provenance + .provenance {
		margin-top: 0;
	}

	.provenance > span:not(:last-child)::after {
		content: '·';
		margin: 0 var(--space-2);
	}

	.provenance > span {
		overflow-wrap: anywhere;
	}

	.file-links a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.restricted a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.print-only {
		display: none;
	}

	@media print {
		.file-links,
		.frame {
			display: none;
		}

		.print-only {
			display: block;
		}
	}
</style>
