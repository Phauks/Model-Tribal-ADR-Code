<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CopyHash from '#lib/components/CopyHash.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const details = $derived(data.details);
	const opinion = $derived(details?.opinion);
	const publishedAt = $derived(URL.canParse(data.original) ? new URL(data.original).hostname : data.original);
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
	<title>{data.title} · Source documents · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<Breadcrumbs
		trail={[
			{ label: 'Source documents', href: '/copies' },
			...(details ? [{ label: details.list.title, href: `/copies/list/${details.list.slug}` }] : [])
		]}
	/>
	<h1>
		{#if opinion}<i>{opinion.name}</i>{:else}{data.title}{/if}
	</h1>
	{#if opinion}
		<p class="lead">
			{opinion.citation} ({opinion.court}{data.decidedText ? `, decided ${data.decidedText}` : ''}){#if opinion.docket}<span
					class="small muted"
				>
					· Docket {opinion.docket}</span
				>{/if}
		</p>
	{/if}

	{#if data.citeOnly}
		<p class="restricted">
			At the nation’s request, this site does not show the text of this {opinion ? 'opinion' : 'document'}. <a href={data.original} rel="noopener noreferrer">Read it at {opinion ? 'the Caselaw Access Project' : publishedAt}<ExternalLink size={14} aria-hidden="true" /></a>.
		</p>
	{:else}
		<p class="actions">
			<a class="button" href={data.file} download={data.fileName}><Download size={18} aria-hidden="true" />Download ({data.kind}, {data.size})</a>
			<a class="button button-quiet" href={data.file}><ExternalLink size={18} aria-hidden="true" />Open the file alone</a>
		</p>

		<dl class="details small">
			{#if details && details.nations.length > 0}
				<dt>{details.nations.length === 1 ? 'Nation' : 'Nations'}</dt>
				<dd>
					{#each details.nations as nation, index (nation.id)}{index > 0 ? '; ' : ''}<a href="/nations/{nation.id}">{nation.name}</a>{/each}
				</dd>
			{/if}
			<dt>Published at</dt>
			<dd><a href={data.original} rel="noopener noreferrer">{publishedAt}</a></dd>
			{#if data.capturedText}
				<dt>Copy made</dt>
				<dd>{data.capturedText}</dd>
			{/if}
			<dt>SHA-256</dt>
			<dd><CopyHash sha256={data.sha256} label="this document" /> · <a href={data.verify}>Verify File</a></dd>
			<dt>Take it down</dt>
			<dd><a href={data.removal}>Ask to remove or redact this copy</a></dd>
		</dl>
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
		<p class="small muted fallback">
			If the document does not show above, as on some phones, <a href={data.file}>open the file alone</a> or <a href={data.file} download={data.fileName}>download it</a>.
		</p>
		<p class="print-only">This copy is at {data.file} on this site, and was published at {data.original}.</p>
	</section>
{/if}

<style>
	h1 {
		overflow-wrap: anywhere;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin: var(--space-4) 0;
	}

	.actions .button {
		gap: var(--space-2);
	}

	.details {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--space-1) var(--space-3);
		margin: 0 0 var(--space-4);
		overflow-wrap: anywhere;
	}

	.details dt {
		font-weight: var(--font-weight-semibold);
	}

	.details dd {
		margin: 0;
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

	.fallback {
		margin-top: var(--space-2);
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
		.actions,
		.frame,
		.fallback {
			display: none;
		}

		.print-only {
			display: block;
		}
	}
</style>
