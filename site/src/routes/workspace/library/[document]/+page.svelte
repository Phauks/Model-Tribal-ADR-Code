<script lang="ts">
	import { copyAddress, documentHeading, placeLabel } from '#lib/source-library-text.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const document = $derived(data.document);
	const last = $derived(data.pages.at(-1)?.sequence ?? data.from);

	/** The words of the search that led here, to mark in the text. */
	const words = $derived(
		(data.query.match(/[\p{L}\p{N}]+/gu) ?? [])
			.filter((word) => !['AND', 'OR', 'NOT', 'NEAR'].includes(word) && word.length > 2)
			.map((word) => word.toLocaleLowerCase('en-US'))
	);

	/** A passage cut into plain text and words the search asked for, so no HTML is made from document text. */
	function pieces(text: string): { text: string; matched: boolean }[] {
		if (words.length === 0) return [{ text, matched: false }];
		const result: { text: string; matched: boolean }[] = [];
		for (const part of text.split(/([\p{L}\p{N}]+)/u)) {
			const lowered = part.toLocaleLowerCase('en-US');
			const matched = words.some((word) => lowered.startsWith(word.slice(0, Math.max(4, word.length - 2))));
			const previous = result.at(-1);
			if (previous && previous.matched === matched) previous.text += part;
			else result.push({ text: part, matched });
		}
		return result;
	}

	function from(sequence: number): string {
		const parameters = new URLSearchParams({ from: String(Math.max(1, sequence)) });
		if (data.query) parameters.set('q', data.query);
		return `?${parameters}`;
	}

	const methodLabels: Record<string, string> = {
		ocr: 'read from a scan by OCR, so check words and numbers against the original'
	};
</script>

<svelte:head>
	<title>{document.title} · Source library · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<p class="small"><a href="/workspace/library{data.query ? `?q=${encodeURIComponent(data.query)}` : ''}">Source library</a></p>
<h1>{documentHeading(document)}</h1>

<dl class="details">
	<dt>Kind of source</dt>
	<dd>{document.topic}</dd>
	{#if document.nations.length > 0}
		<dt>Nations</dt>
		<dd>{document.nations.join(', ')}</dd>
	{/if}
	{#if document.link}
		<dt>Published at</dt>
		<dd><a href={document.link} rel="external noopener noreferrer">{document.link}</a></dd>
	{/if}
	{#if document.captured}
		<dt>Saved</dt>
		<dd>{document.captured}{document.obtained ? `, ${document.obtained}` : ''}</dd>
	{/if}
	{#if document.records.length > 0}
		<dt>Cited by the source records</dt>
		<dd>{document.records.join(', ')}</dd>
	{/if}
	{#if document.rights}
		<dt>Rights</dt>
		<dd>{document.rights}</dd>
	{/if}
	<dt>Text</dt>
	<dd>
		{document.pageCount ?? '?'} pages, {document.passageCount.toLocaleString('en-US')} passages.
		{#if document.ocrPages > 0}{document.ocrPages} pages were read from scans by OCR.{/if}
		{#if document.emptyPages > 0}{document.emptyPages} pages have no text the library could read.{/if}
	</dd>
	<dt>File</dt>
	<dd>
		<a href="/workspace/library/{document.documentId}/original">Open the original</a>
		{#if document.served}· <a href={copyAddress(document.key)}>the website’s copy</a>{/if}
		<span class="small muted">· {document.key}</span>
	</dd>
</dl>

<h2>Text</h2>
<nav class="pages" aria-label="Passages">
	{#if data.from > 1}<a href={from(data.from - data.perScreen)}>Earlier passages</a>{/if}
	<span class="small muted">Passages {data.from} to {last} of {document.passageCount}</span>
	{#if last < document.passageCount}<a href={from(last + 1)}>Later passages</a>{/if}
</nav>

{#each data.pages as passage (passage.passageId)}
	<section class="passage" class:highlight={passage.passageId === data.highlight} id="passage-{passage.passageId}" aria-label={placeLabel(passage)}>
		<p class="place small muted">
			{placeLabel(passage)}{#if passage.method && methodLabels[passage.method]} · {methodLabels[passage.method]}{/if}
		</p>
		<p class="text">{#each pieces(passage.text) as piece, index (index)}{#if piece.matched}<mark>{piece.text}</mark>{:else}{piece.text}{/if}{/each}</p>
	</section>
{:else}
	<p>This document has no text the library could read. Open the original to read it.</p>
{/each}

<nav class="pages" aria-label="More passages">
	{#if data.from > 1}<a href={from(data.from - data.perScreen)}>Earlier passages</a>{/if}
	{#if last < document.passageCount}<a href={from(last + 1)}>Later passages</a>{/if}
</nav>

<style>
	.details {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-1) var(--space-4);
		overflow-wrap: anywhere;
	}

	.details dt {
		font-weight: 600;
	}

	.details dd {
		margin: 0;
	}

	@media (max-width: 40rem) {
		.details {
			grid-template-columns: 1fr;
		}

		.details dd {
			margin-bottom: var(--space-2);
		}
	}

	.pages {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		margin: var(--space-4) 0;
	}

	.passage {
		border-top: 1px solid var(--color-line);
		padding-top: var(--space-2);
		margin-bottom: var(--space-4);
		scroll-margin-top: var(--space-6);
	}

	.passage.highlight {
		border-top-color: var(--color-focus);
		border-top-width: 3px;
	}

	.place {
		margin-bottom: var(--space-1);
	}

	.text {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	mark {
		background: var(--color-notice-background);
		color: inherit;
	}
</style>
