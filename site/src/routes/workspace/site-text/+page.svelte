<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import Search from '@lucide/svelte/icons/search';
	import Send from '@lucide/svelte/icons/send';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import X from '@lucide/svelte/icons/x';
	import { enhance } from '$app/forms';
	import { dateTime } from '#lib/change-dates.ts';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const filterLabels = { all: 'All', edited: 'Edited', drafts: 'Drafts', gone: 'No longer on the site' } as const;

	const live = $derived(data.built >= data.latest);
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
		<div class="table-scroll">
			<table>
				<thead><tr><th scope="col">Publication</th><th scope="col">Changes</th><th scope="col">By</th><th scope="col">When</th><th scope="col"><span class="visually-hidden">Undo</span></th></tr></thead>
				<tbody>
					{#each data.publications as publication, index (publication.number)}
						<tr>
							<td>{publication.number}{#if publication.undoes}<span class="muted"> · undid {publication.undoes}</span>{/if}</td>
							<td>{publication.changes}</td>
							<td>{publication.personName ?? ''}</td>
							<td>{dateTime(publication.publishedAt)}</td>
							<td>
								{#if index === 0 && data.canPublish}
									<form method="POST" action="?/undo" use:enhance>
										<input type="hidden" name="publication" value={publication.number} />
										<button class="icon-button" type="submit" title="Undo publication {publication.number}"><Undo2 size={20} aria-hidden="true" /><span class="visually-hidden">Undo publication {publication.number}</span></button>
									</form>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<section aria-labelledby="all-heading">
	<h2 id="all-heading">All text</h2>
	<form class="search" method="GET" role="search">
		<label class="visually-hidden" for="text-search">Search the site text</label>
		<input id="text-search" type="search" name="q" value={data.query} />
		<label class="visually-hidden" for="text-filter">Show</label>
		<select id="text-filter" name="show" value={data.filter}>
			{#each Object.entries(filterLabels) as [value, label] (value)}
				<option {value}>{label}</option>
			{/each}
		</select>
		<button class="icon-button" type="submit" title="Search"><Search size={20} aria-hidden="true" /><span class="visually-hidden">Search</span></button>
	</form>
	<p class="muted small">{data.rows.length < data.total ? `${data.rows.length.toLocaleString('en-US')} of ${data.total.toLocaleString('en-US')}` : data.total.toLocaleString('en-US')}</p>
	<div class="table-scroll">
		<table>
			<thead><tr><th scope="col">Text</th><th scope="col">Where</th><th scope="col">Status</th></tr></thead>
			<tbody>
				{#each data.rows as row (row.key)}
					<tr>
						<td><a href="/workspace/site-text/{row.key}">{row.words}</a>{#if row.attribute}<span class="muted small"> · {row.attribute}</span>{/if}</td>
						<td>{row.place}</td>
						<td>
							{#if row.gone}<span class="tag">No longer on the site</span>{/if}
							{#if row.draft !== null}<span class="tag draft">Draft</span>{/if}
							{#if row.edited}<span class="tag">Edited</span>{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
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
