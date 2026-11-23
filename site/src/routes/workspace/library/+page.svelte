<script lang="ts">
	import { copyAddress, documentHeading, excerptPieces, placeLabel } from '#lib/source-library-text.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function pageLink(page: number): string {
		const parameters = new URLSearchParams();
		for (const [name, value] of Object.entries({
			q: data.filters.query,
			nation: data.filters.nation ?? '',
			topic: data.filters.topic ?? '',
			format: data.filters.format ?? '',
			served: data.filters.served ? '1' : '',
			mode: data.mode === 'titles' ? 'titles' : ''
		})) {
			if (value) parameters.set(name, value);
		}
		if (page > 0) parameters.set('page', String(page));
		return `/workspace/library?${parameters}`;
	}

	const statusText: Record<string, string> = {
		partial: 'Some pages are scans the library could not read',
		none: 'The library could not read this file’s text'
	};

	function built(value: string): string {
		return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
	}
</script>

<svelte:head>
	<title>Source library · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Source library</h1>
<p>
	Search the words of every document the project has saved: constitutions, codes and ordinances, gaming compacts,
	tribal court opinions, Federal Register notices, saved web pages, articles and Westlaw prints. Each result names the
	page to cite. Read the passage in context before you rely on it, and cite the published source, not this library.
</p>
<p class="small muted">
	Some documents here are private copies (articles, Westlaw prints, copies from the National Indian Law Library). Do not
	quote them on the website unless the document’s rights allow it.
</p>

{#if !data.status.build}
	<p class="notice">The library has not been loaded yet. It appears here after its first load.</p>
{:else}
	<form method="get" class="search" role="search">
		<div class="field wide">
			<label for="library-query">Words</label>
			<input type="search" id="library-query" name="q" value={data.filters.query} aria-describedby="library-query-help" />
			<p class="hint small muted" id="library-query-help">
				All the words must appear. Use “quotation marks” for a phrase, OR between alternatives, a star for word
				endings (mediat*), and NEAR(peacemaker elder, 10) for words close together. Words match their other forms:
				mediate finds mediation.
			</p>
		</div>
		<div class="field">
			<label for="library-mode">Search in</label>
			<select id="library-mode" name="mode">
				<option value="">The text</option>
				<option value="titles" selected={data.mode === 'titles'}>Titles and citations</option>
			</select>
		</div>
		<div class="field">
			<label for="library-topic">Kind of source</label>
			<select id="library-topic" name="topic">
				<option value="">Any</option>
				{#each data.topics as topic (topic.topic)}
					<option value={topic.topic} selected={data.filters.topic === topic.topic}>
						{topic.topic} ({topic.documents.toLocaleString('en-US')})
					</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="library-nation">Nation’s identifier</label>
			<input type="text" id="library-nation" name="nation" value={data.filters.nation ?? ''} placeholder="navajo-nation" />
		</div>
		<div class="field checkbox">
			<label><input type="checkbox" name="served" value="1" checked={data.filters.served} /> Only copies the website shows</label>
		</div>
		<button class="button" type="submit">Search</button>
	</form>

	{#if data.search}
		{#if data.search.readAs}
			<p class="small muted">Searched for the words themselves: {data.search.readAs}</p>
		{/if}
		{#if data.search.results.length === 0}
			<p>Nothing matches. Try fewer words, OR between other words for the same idea, or a star for word endings.</p>
		{:else}
			<ol class="results" start={(data.filters.page ?? 0) * 20 + 1}>
				{#each data.search.results as result (result.documentId)}
					<li>
						<h2 class="result-title">
							<a href="/workspace/library/{result.documentId}?q={encodeURIComponent(data.filters.query)}">{documentHeading(result)}</a>
						</h2>
						<p class="small muted">
							{result.topic}{#if result.nations.length > 0}
								· {result.nations.slice(0, 3).join(', ')}{result.nations.length > 3 ? ' and others' : ''}{/if}
							{#if result.served}· <a href={copyAddress(result.key)}>Website copy</a>{/if}
							{#if statusText[result.textStatus]}· {statusText[result.textStatus]}{/if}
						</p>
						<ul class="passages">
							{#each result.passages as passage (passage.passageId)}
								<li>
									<a href="/workspace/library/{result.documentId}?passage={passage.passageId}&q={encodeURIComponent(data.filters.query)}#passage-{passage.passageId}">{placeLabel(passage)}</a>:
									{#each excerptPieces(passage.excerpt) as piece, index (index)}{#if piece.matched}<mark>{piece.text}</mark>{:else}{piece.text}{/if}{/each}
								</li>
							{/each}
						</ul>
						{#if result.records.length > 0}
							<p class="small muted">Cited by the source records {result.records.slice(0, 4).join(', ')}{result.records.length > 4 ? ' and others' : ''}.</p>
						{/if}
					</li>
				{/each}
			</ol>
			<nav class="pages" aria-label="More results">
				{#if (data.filters.page ?? 0) > 0}<a href={pageLink((data.filters.page ?? 0) - 1)}>Earlier results</a>{/if}
				{#if data.search.more}<a href={pageLink((data.filters.page ?? 0) + 1)}>More results</a>{/if}
			</nav>
		{/if}
	{:else if data.titles}
		{#if data.titles.length === 0}
			<p>No title or citation matches.</p>
		{:else}
			<ul class="titles">
				{#each data.titles as document (document.documentId)}
					<li>
						<a href="/workspace/library/{document.documentId}">{documentHeading(document)}</a>
						<span class="small muted">· {document.topic}{document.pageCount ? ` · ${document.pageCount} pages` : ''}</span>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}

	<p class="small muted status">
		{data.status.documents.toLocaleString('en-US')} documents, as of {built(data.status.build)}.
		{#if data.status.newest && data.status.newest !== data.status.build}A newer build is being loaded.{/if}
	</p>
{/if}

<style>
	.search {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0 var(--space-4);
		margin-bottom: var(--space-4);
	}

	.search .field {
		flex: 1 1 12rem;
	}

	.search .field.wide {
		flex-basis: 100%;
	}

	.search .checkbox {
		align-self: center;
	}

	.search .button {
		margin-bottom: var(--space-4);
	}

	.hint {
		margin-top: var(--space-1);
	}

	.results {
		padding-left: var(--space-5);
	}

	.results > li {
		margin-bottom: var(--space-5);
	}

	.result-title {
		font-size: 1.125rem;
		margin-bottom: var(--space-1);
	}

	.passages {
		list-style: none;
		padding-left: 0;
	}

	.passages li {
		margin-bottom: var(--space-2);
		overflow-wrap: anywhere;
	}

	mark {
		background: var(--color-notice-background);
		color: inherit;
	}

	.pages {
		display: flex;
		gap: var(--space-4);
	}

	.titles li {
		margin-bottom: var(--space-2);
	}

	.status {
		margin-top: var(--space-6);
	}
</style>
