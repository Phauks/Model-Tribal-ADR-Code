<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import Search from '@lucide/svelte/icons/search';
	import Send from '@lucide/svelte/icons/send';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import X from '@lucide/svelte/icons/x';
	import { enhance } from '$app/forms';
	import { dateTime } from '#lib/change-dates.ts';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const filterLabels = { all: 'All', edited: 'Edited', drafts: 'Drafts', gone: 'No longer on the site' } as const;

	const live = $derived(data.built >= data.latest);

	const filterChoices = Object.entries(filterLabels).map(([value, label]) => ({ value, label }));

	const publicationColumns: TableColumn[] = [
		{ key: 'publication', header: 'Publication', type: 'number', sortable: true, custom: true },
		{ key: 'changes', header: 'Changes', type: 'number', sortable: true },
		{ key: 'by', header: 'By', sortable: true },
		{ key: 'when', header: 'When', type: 'date', sortable: true },
		{ key: 'undo', header: 'Undo', custom: true, hiddenHeader: true, keepOutOfDownload: true }
	];
	const publicationRows: TableRow[] = $derived(
		data.publications.map((publication) => ({
			key: String(publication.number),
			cells: {
				publication: { text: `${publication.number}${publication.undoes ? ` · undid ${publication.undoes}` : ''}`, sortValue: publication.number },
				changes: { text: String(publication.changes), sortValue: publication.changes },
				by: { text: publication.personName ?? '' },
				when: { text: dateTime(publication.publishedAt), sortValue: publication.publishedAt },
				undo: { text: '' }
			}
		}))
	);
	const publications = $derived(new Map(data.publications.map((publication) => [String(publication.number), publication])));

	const textColumns: TableColumn[] = [
		{ key: 'text', header: 'Text', isRowHeader: true, sortable: true, custom: true },
		{ key: 'where', header: 'Where', sortable: true },
		{ key: 'status', header: 'Status', sortable: true, custom: true }
	];
	const statusOf = (row: (typeof data.rows)[number]) =>
		[row.gone ? 'No longer on the site' : '', row.draft !== null ? 'Draft' : '', row.edited ? 'Edited' : ''].filter(Boolean);
	const textRows: TableRow[] = $derived(
		data.rows.map((row) => ({
			key: row.key,
			cells: {
				text: { text: row.attribute ? `${row.words} · ${row.attribute}` : row.words, sortValue: row.words, href: `/workspace/site-text/${row.key}` },
				where: { text: row.place },
				status: { text: statusOf(row).join(', ') }
			}
		}))
	);
	const texts = $derived(new Map(data.rows.map((row) => [row.key, row])));
</script>

<svelte:head>
	<title>Site text · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<div class="title-row">
	<h1>Site text</h1>
	{#if data.canEdit}
		<a class="icon-button" href="/?edit-text" title="Edit text on the site"><Pencil size={22} aria-hidden="true" /><span class="visually-hidden">Edit text on the site</span></a>
	{/if}
</div>

{#if form?.problem}
	<p class="problem" role="alert">{form.problem}</p>
{/if}

<section aria-labelledby="drafts-heading">
	<div class="title-row">
		<h2 id="drafts-heading">Drafts <CountBadge count={data.drafts.length} /></h2>
		{#if data.canPublish && data.drafts.length > 0}
			<form method="POST" action="?/publish" use:enhance>
				<button class="publish" type="submit" title="Publish {data.drafts.length === 1 ? '1 change' : `${data.drafts.length} changes`}">
					<Send size={22} aria-hidden="true" /><span class="visually-hidden">Publish</span>
				</button>
			</form>
		{/if}
	</div>
	{#if data.drafts.length === 0}
		<p class="muted">None</p>
	{:else}
		<ol class="changes">
			{#each data.drafts as draft (draft.key)}
				<li>
					<a class="where" href="/workspace/site-text/{draft.key}">{draft.page ?? draft.place}</a>
					<s class="before">{draft.before}</s>
					<span class="after">{draft.after}</span>
					<span class="who muted">{draft.personName ?? ''} · {dateTime(draft.createdAt)}</span>
					{#if data.canEdit}
						<form method="POST" action="?/discard" use:enhance>
							<input type="hidden" name="key" value={draft.key} />
							<button class="icon-button" type="submit" title="Discard this draft"><X size={20} aria-hidden="true" /><span class="visually-hidden">Discard this draft</span></button>
						</form>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</section>

<section aria-labelledby="published-heading">
	<h2 id="published-heading">Published</h2>
	{#if data.latest > 0}
		<p class="status" class:waiting={!live}>
			{#if live}
				Live
			{:else if !data.hook}
				Publication {data.latest} goes live with the next deploy
			{:else}
				Publication {data.latest} goes live in a few minutes{#if data.rebuild && data.rebuild.publication === data.latest && data.rebuild.outcome !== 'asked'}
					({data.rebuild.outcome}){/if}
			{/if}
		</p>
	{/if}
	{#if data.publications.length === 0}
		<p class="muted">None</p>
	{:else}
		<DataTable
			identifier="publications"
			label="Table: publications"
			columns={publicationColumns}
			rows={publicationRows}
			defaultSort={{ key: 'publication', direction: 'descending' }}
			rowName={['publication', 'publications']}
		>
			{#snippet cell(row, column)}
				{@const publication = publications.get(row.key)}
				{#if publication && column.key === 'publication'}
					{publication.number}{#if publication.undoes}<span class="muted"> · undid {publication.undoes}</span>{/if}
				{:else if publication && publication.number === data.publications[0]?.number && data.canPublish}
					<!-- Only the latest publication can be undone. -->
					<form method="POST" action="?/undo" use:enhance>
						<input type="hidden" name="publication" value={publication.number} />
						<button class="icon-button" type="submit" title="Undo publication {publication.number}"><Undo2 size={20} aria-hidden="true" /><span class="visually-hidden">Undo publication {publication.number}</span></button>
					</form>
				{/if}
			{/snippet}
		</DataTable>
	{/if}
</section>

<section aria-labelledby="all-heading">
	<h2 id="all-heading">All text</h2>
	<form class="search" method="GET" role="search">
		<label class="visually-hidden" for="text-search">Search the site text</label>
		<input id="text-search" type="search" name="q" value={data.query} />
		<Dropdown label="Show" hideLabel id="text-filter" name="show" choices={filterChoices} value={data.filter} />
		<button class="icon-button" type="submit" title="Search"><Search size={20} aria-hidden="true" /><span class="visually-hidden">Search</span></button>
	</form>
	<DataTable
		identifier="site-text"
		label="Table: site text"
		columns={textColumns}
		rows={textRows}
		total={data.total}
		rowName={['text', 'texts']}
	>
		{#snippet cell(row, column)}
			{@const text = texts.get(row.key)}
			{#if text && column.key === 'text'}
				<a href="/workspace/site-text/{text.key}">{text.words}</a>{#if text.attribute}<span class="muted small"> · {text.attribute}</span>{/if}
			{:else if text}
				{#if text.gone}<span class="tag">No longer on the site</span>{/if}
				{#if text.draft !== null}<span class="tag draft">Draft</span>{/if}
				{#if text.edited}<span class="tag">Edited</span>{/if}
			{/if}
		{/snippet}
	</DataTable>
</section>

<style>
	.title-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.publish {
		display: inline-grid;
		place-items: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		border: 0;
		border-radius: var(--radius-control);
		background: var(--color-action);
		color: var(--color-action-text);
		cursor: pointer;
	}
	.changes {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.changes li {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-1) var(--space-3);
		padding: var(--space-3) 0;
		border-top: 1px solid var(--color-line);
	}
	.changes li > :not(form) {
		grid-column: 1;
	}
	.changes form {
		grid-column: 2;
		grid-row: 1 / span 4;
		align-self: center;
	}
	.where,
	.who {
		font-size: var(--font-size-small);
	}
	.before {
		color: var(--color-ink-muted);
	}
	.after {
		font-weight: 600;
	}
	.status.waiting {
		font-weight: 600;
	}
	.search {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.search input {
		flex: 1 1 16rem;
	}
	.search :global(.dropdown) {
		margin: 0;
	}
	.tag {
		display: inline-block;
		margin-right: var(--space-1);
		padding: 0 var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		font-size: var(--font-size-small);
	}
	.tag.draft {
		border-color: var(--color-status-draft-rule);
		background: var(--color-status-draft-background);
	}
	.problem {
		color: var(--color-danger);
	}
</style>
