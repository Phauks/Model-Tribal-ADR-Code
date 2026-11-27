<script lang="ts">
	import type { Snippet } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { enhance } from '$app/forms';
	import { dateTime } from '#lib/change-dates.ts';
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const columns: TableColumn[] = $derived([
		{ key: 'text', header: 'Text', isRowHeader: true, sortable: true, custom: true },
		{ key: 'by', header: 'By', sortable: true },
		{ key: 'when', header: 'When', type: 'date', sortable: true },
		{ key: 'published', header: 'Published', sortable: true },
		...(data.canEdit ? [{ key: 'restore', header: 'Restore', custom: true, hiddenHeader: true, keepOutOfDownload: true }] : [])
	]);
	const rows: TableRow[] = $derived(
		data.versions.map((version) => ({
			key: String(version.identifier),
			cells: {
				text: { text: version.words ?? `${version.builtInWords} · built-in` },
				by: { text: version.personName ?? '' },
				when: { text: dateTime(version.createdAt), sortValue: version.createdAt },
				published: { text: version.publications.join(', ') },
				restore: { text: '' }
			}
		}))
	);
	const versions = $derived(new Map(data.versions.map((version) => [String(version.identifier), version])));
</script>

<svelte:head>
	<title>Site text · Workspace · Tribal Law Project</title>
</svelte:head>

<p class="small"><a href="/workspace/site-text">Site text</a></p>
<h1>{data.record ? data.place : (data.draft ?? data.published ?? data.builtIn)}</h1>

<dl class="facts" class:record={data.record}>
	<div><dt>Where</dt><dd>{#if data.page}<a href={data.page}>{data.place}</a>{:else}{data.place}{/if}{#if data.attribute} · {data.attribute}{/if}</dd></div>
	{#if data.file}<div><dt>File</dt><dd><code>{data.file}</code></dd></div>{/if}
	<div><dt>Built-in</dt><dd>{data.builtIn}</dd></div>
	<div><dt>Published</dt><dd>{data.published ?? data.builtIn}</dd></div>
	{#if data.draft !== null}<div><dt>Draft</dt><dd>{data.draft}</dd></div>{/if}
	{#if data.gone}<div><dt>Status</dt><dd>No longer on the site</dd></div>{/if}
</dl>

{#if form?.problem}
	<p class="problem" role="alert">{form.problem}</p>
{/if}

{#if data.canEdit}
	<form class="edit" method="POST" action="?/save" use:enhance>
		<label class="visually-hidden" for="words">Text</label>
		<textarea id="words" name="words" rows={data.record ? 9 : 2} maxlength="2000">{data.draft ?? data.published ?? data.builtIn}</textarea>
		<div class="buttons">
			<button class="icon-button outline" type="submit" name="reset" value="yes" title="Reset to built-in text"><RotateCcw size={20} aria-hidden="true" /><span class="visually-hidden">Reset to built-in text</span></button>
			<span class="space"></span>
			<button class="save" type="submit" title="Save draft"><Check size={20} aria-hidden="true" /><span class="visually-hidden">Save draft</span></button>
		</div>
	</form>
{/if}

{#if data.versions.length === 0}
	<h2>History</h2>
	<p class="muted">None</p>
{:else}
	<DataTable
		identifier="versions"
		label="Table: versions of this text"
		{columns}
		{rows}
		defaultSort={{ key: 'when', direction: 'descending' }}
		rowName={['version', 'versions']}
	>
		{#snippet heading(count: Snippet)}<h2>History {@render count()}</h2>{/snippet}
		{#snippet cell(row, column)}
			{@const version = versions.get(row.key)}
			{#if version && column.key === 'text'}
				{version.words ?? version.builtInWords}{#if version.words === null}<span class="muted small"> · built-in</span>{/if}
			{:else if version}
				<form method="POST" action="?/save" use:enhance>
					{#if version.words === null}
						<input type="hidden" name="reset" value="yes" />
					{:else}
						<input type="hidden" name="words" value={version.words} />
					{/if}
					<button class="icon-button" type="submit" title="Restore as a draft"><Undo2 size={20} aria-hidden="true" /><span class="visually-hidden">Restore as a draft</span></button>
				</form>
			{/if}
		{/snippet}
	</DataTable>
{/if}

<style>
	.facts div {
		display: grid;
		grid-template-columns: var(--layout-label-column) 1fr;
		gap: var(--space-3);
	}
	.facts dd {
		margin: 0;
	}
	.edit textarea {
		width: 100%;
		box-sizing: border-box;
	}
	.buttons {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	.space {
		flex: 1;
	}
	.outline {
		border: 1px solid var(--color-control-border);
	}
	.save {
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
	.problem {
		color: var(--color-danger);
	}
	/* A part of a case's or law's box keeps its paragraphs. */
	.facts.record dd {
		white-space: pre-line;
	}
</style>
