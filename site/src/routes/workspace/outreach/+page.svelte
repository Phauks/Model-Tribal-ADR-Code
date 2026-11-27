<script lang="ts">
	// The Outreach page (design/outreach-redesign, approved by Trevor on Nov.
	// 27, 2026): the batches as rows like the inbox's conversations, each with
	// a mark for where it stands, its template, how far it has got, and when it
	// next sends; a toolbar for the ticked ones; and, in Replies and Follow up
	// due, the conversations themselves, as the inbox lists them.
	import { onMount } from 'svelte';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Copy from '@lucide/svelte/icons/copy';
	import FilePen from '@lucide/svelte/icons/file-pen';
	import Layers from '@lucide/svelte/icons/layers';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import Reply from '@lucide/svelte/icons/reply';
	import Search from '@lucide/svelte/icons/search';
	import Send from '@lucide/svelte/icons/send';
	import X from '@lucide/svelte/icons/x';
	import type { Component } from 'svelte';
	import Avatar from '../inbox/Avatar.svelte';
	import { listDate } from '../inbox/dates.ts';
	import ReadinessNotice from './ReadinessNotice.svelte';
	import { whenWords } from './when.ts';
	import { outreachBase as base, outreachViews } from './views.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const heading = $derived(outreachViews.find((view) => view.key === data.view)?.label ?? 'Batches');
	const stageIcons: Record<string, Component> = { sending: Send, scheduled: CalendarClock, draft: FilePen, paused: Pause, done: CircleCheck, cancelled: CircleX };

	let selected = $state<string[]>([]);
	let ready = $state(false);
	onMount(() => (ready = true));
	const none = $derived(ready && selected.length === 0);
	const allTicked = $derived(data.batches.length > 0 && selected.length === data.batches.length);
	const tickedStages = $derived(new Set(data.batches.filter((batch) => selected.includes(batch.identifier)).map((batch) => batch.stage)));
	const canStart = $derived(!ready || [...tickedStages].some((stage) => stage === 'draft' || stage === 'paused' || stage === 'scheduled'));
	const canPause = $derived(!ready || tickedStages.has('sending') || tickedStages.has('scheduled'));
	const canCancel = $derived(!ready || [...tickedStages].some((stage) => stage !== 'done' && stage !== 'cancelled'));

	function tickAll(event: Event): void {
		selected = (event.currentTarget as HTMLInputElement).checked ? data.batches.map((batch) => batch.identifier) : [];
	}

	function searchLink(q: string | null): string {
		const query = new URLSearchParams();
		if (data.view !== 'all') query.set('view', data.view);
		if (q) query.set('q', q);
		const text = query.toString();
		return text ? `${base}?${text}` : base;
	}
</script>

<svelte:head>
	<title>{heading === 'Batches' ? 'Outreach' : `${heading} · Outreach`} · Workspace · Tribal Law Project</title>
</svelte:head>

<header class="list-head">
	<h1>{heading}</h1>
	<form method="get" action={base} role="search" class="search">
		{#if data.view !== 'all'}<input type="hidden" name="view" value={data.view} />{/if}
		<Search size={18} aria-hidden="true" />
		<label for="outreach-search" class="visually-hidden">Search batches and replies</label>
		<input id="outreach-search" type="search" name="q" value={data.search ?? ''} placeholder="Search batches and replies" />
		{#if data.search}
			<a class="icon-button clear" href={searchLink(null)} aria-label="Clear the search" title="Clear the search"><X size={18} aria-hidden="true" /></a>
		{/if}
	</form>
</header>
<p class="intro">
	Letters to nations from the address book, sent a few at a time in each nation’s working hours. Replies arrive in the inbox they are sent to. Nothing hidden tracks whether a letter was opened.
</p>

<ReadinessNotice problems={data.problems} />

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

{#if data.view === 'replies' || data.view === 'follow'}
	{#if data.conversations.length === 0}
		<div class="empty">
			<Reply size={48} aria-hidden="true" />
			<p class="lead">{data.search ? `Nothing matches “${data.search}”.` : data.view === 'replies' ? 'No replies yet.' : 'No follow-ups are due.'}</p>
			{#if data.search}<p><a href={searchLink(null)}>Clear the search</a></p>{/if}
		</div>
	{:else}
		<ol class="threads">
			{#each data.conversations as item (item.threadIdentifier)}
				<li class:unread={item.unread}>
					<a href="/workspace/inbox/{item.threadIdentifier}" class="conversation">
						<Avatar name={item.nationName ?? item.name} />
						<span class="who">
							{#if item.unread}<span class="visually-hidden">Unread: </span>{/if}{item.nationName ?? item.name}
							<span class="sub">{item.nationName ? item.name : item.email}</span>
						</span>
						<span class="line"><span class="subject">{item.subject}</span>{#if item.snippet}<span class="snippet"> — {item.snippet}</span>{/if}</span>
						<span class="when">{listDate(item.at)}</span>
						<span class="marks"><span class="mark"><Layers size={14} aria-hidden="true" />{item.batchName}</span></span>
					</a>
				</li>
			{/each}
		</ol>
	{/if}
{:else if data.batches.length === 0}
	<div class="empty">
		<Layers size={48} aria-hidden="true" />
		{#if data.search}
			<p class="lead">No batches match “{data.search}”.</p>
			<p><a href={searchLink(null)}>Clear the search</a></p>
		{:else}
			<p class="lead">{data.view === 'all' ? 'No batches yet.' : `Nothing in ${heading}.`}</p>
			<p><a href="{base}/new">New batch</a></p>
		{/if}
	</div>
{:else}
	<form method="post" action="?/bulk" class="list-form">
		<div class="toolbar" role="toolbar" aria-label="Change the ticked batches">
			<label class="tick-all" title="Tick every batch">
				<input type="checkbox" checked={allTicked} indeterminate={selected.length > 0 && !allTicked} onchange={tickAll} />
				<span class="visually-hidden">Tick every batch</span>
			</label>
			{#if ready && selected.length > 0}<span class="small picked">{selected.length} ticked</span>{/if}
			<span class="tool-group">
				<button class="tool" type="submit" name="do" value="start" disabled={none || !canStart}><Play size={18} aria-hidden="true" /><span>Start now</span></button>
				<button class="tool" type="submit" name="do" value="pause" disabled={none || !canPause}><Pause size={18} aria-hidden="true" /><span>Pause</span></button>
				<button class="tool" type="submit" name="do" value="copy" disabled={none}><Copy size={18} aria-hidden="true" /><span>Copy</span></button>
				<button class="tool" type="submit" name="do" value="cancel" disabled={none || !canCancel}><X size={18} aria-hidden="true" /><span>Cancel</span></button>
			</span>
		</div>

		<ol class="threads">
			{#each data.batches as batch (batch.identifier)}
				{@const Icon = stageIcons[batch.stage] ?? Layers}
				<li class:ticked={selected.includes(batch.identifier)}>
					<label class="tick">
						<input type="checkbox" name="batch" value={batch.identifier} bind:group={selected} />
						<span class="visually-hidden">Tick “{batch.name}”</span>
					</label>
					<a href={batch.stage === 'draft' ? `${base}/new?batch=${batch.identifier}` : `${base}/${batch.identifier}`} class="batch-row">
						<span class="state state-{batch.stage}" aria-hidden="true"><Icon size={18} /></span>
						<span class="who">
							<span class="subject">{batch.name}</span>
							{#if batch.template}<span class="sub">{batch.template}</span>{/if}
						</span>
						<span class="marks">
							{#if batch.stage === 'draft'}
								{#if batch.reach}<span class="progress-text">{batch.reach.recipients} {batch.reach.recipients === 1 ? 'contact' : 'contacts'}, {batch.reach.leftOut} left out</span>{/if}
							{:else}
								<span class="progress-text">
									<span class="progress" role="img" aria-label="{batch.sent} of {batch.total} sent"><span style="width: {batch.total ? Math.round((batch.sent / batch.total) * 100) : 0}%"></span></span>
									{batch.sent} of {batch.total} sent
								</span>
								{#if batch.replied}<span class="mark mark-link"><Reply size={14} aria-hidden="true" />{batch.replied} replied</span>{/if}
								{#if batch.bounced}<span class="mark mark-warning">{batch.bounced} bounced</span>{/if}
							{/if}
						</span>
						<span class="when">
							{#if batch.stage === 'sending'}{batch.nextAt ? `Next ${whenWords(batch.nextAt)}` : 'Sending'}
							{:else if batch.stage === 'scheduled' && batch.startsAt}Starts {whenWords(batch.startsAt)}
							{:else if batch.stage === 'draft'}Draft saved {listDate(batch.updatedAt)}
							{:else if batch.stage === 'paused'}Paused
							{:else if batch.stage === 'done'}Finished {listDate(batch.finishedAt ?? batch.updatedAt)}
							{:else if batch.stage === 'cancelled'}Cancelled {listDate(batch.finishedAt ?? batch.updatedAt)}{/if}
						</span>
					</a>
				</li>
			{/each}
		</ol>
	</form>
{/if}

<style>
	/* The list's header, toolbar and rows are the inbox's (inbox/+page.svelte). */
	.list-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-3);
	}
	.list-head h1 {
		margin: 0;
	}
	.intro {
		margin: 0 0 var(--space-3);
		color: var(--color-ink-muted);
	}
	.search {
		position: relative;
		display: flex;
		align-items: center;
		flex: 1 1 18rem;
		max-width: var(--layout-field);
	}
	.search > :global(svg) {
		position: absolute;
		left: var(--space-3);
		color: var(--color-ink-muted);
		pointer-events: none;
	}
	.search input {
		padding-left: 2.5rem;
		border-radius: 999px;
		background: var(--color-surface);
		border-color: transparent;
		border-bottom-color: var(--color-control-border);
	}
	.search input:focus {
		background: var(--color-paper);
		border-color: var(--color-control-border);
	}
	.clear {
		position: absolute;
		right: 0;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-3);
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--color-line);
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--color-paper);
	}
	.tick-all,
	.tick {
		display: grid;
		place-items: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		cursor: pointer;
	}
	input[type='checkbox'] {
		width: 1.1rem;
		height: 1.1rem;
		accent-color: var(--color-link);
		cursor: pointer;
	}
	.picked {
		font-weight: var(--font-weight-semibold);
	}
	.tool-group {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
	.tool {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-2);
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
		cursor: pointer;
	}
	.tool:hover:not(:disabled) {
		background: var(--color-surface);
	}
	.tool:disabled {
		color: var(--color-ink-muted);
		cursor: default;
		opacity: 0.6;
	}
	.threads {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.threads li {
		display: flex;
		align-items: stretch;
		border-bottom: 1px solid var(--color-line);
		background: var(--color-paper);
		transition: background-color var(--motion-duration-short) var(--motion-easing-standard);
	}
	.threads li.unread {
		background: var(--color-surface-raised);
		box-shadow: inset 3px 0 0 var(--color-link);
	}
	.threads li:hover {
		background: var(--color-surface);
	}
	.threads li.ticked {
		background: color-mix(in srgb, var(--color-link) 12%, var(--color-paper));
	}
	.threads a {
		flex: 1;
		min-width: 0;
		display: grid;
		column-gap: var(--space-3);
		row-gap: var(--space-1);
		align-items: center;
		padding: var(--space-2) var(--space-3) var(--space-2) 0;
		color: var(--color-ink);
		text-decoration: none;
	}
	.conversation {
		grid-template-columns: auto minmax(0, 13rem) minmax(0, 1fr) auto;
		grid-template-areas:
			'avatar who line when'
			'avatar who marks marks';
	}
	.conversation > :global(.avatar) {
		grid-area: avatar;
	}
	.threads a.conversation {
		padding-left: var(--space-3);
	}
	.batch-row {
		grid-template-columns: auto minmax(0, 17rem) minmax(0, 1fr) auto;
		grid-template-areas: 'avatar who marks when';
	}
	.threads a:hover .subject,
	.threads a:focus-visible .subject {
		text-decoration: underline;
	}
	.who {
		grid-area: who;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.batch-row .who {
		font-weight: var(--font-weight-semibold);
	}
	.sub {
		display: block;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-regular);
		color: var(--color-ink-muted);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.line {
		grid-area: line;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.snippet {
		color: var(--color-ink-muted);
	}
	.when {
		grid-area: when;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
		white-space: nowrap;
	}
	.unread .who,
	.unread .subject,
	.unread .when {
		font-weight: var(--font-weight-bold);
		color: var(--color-ink);
	}
	.marks {
		grid-area: marks;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		min-width: 0;
	}
	.mark {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		height: 1.5rem;
		padding: 0 0.5rem;
		border-radius: 999px;
		background: var(--color-surface);
		font-size: var(--font-size-small);
		white-space: nowrap;
	}
	.mark-link {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--color-link);
		color: var(--color-link);
	}
	.mark-warning {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--color-action);
		color: var(--color-action);
	}
	.progress-text {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
		white-space: nowrap;
	}
	.progress {
		width: 7rem;
		height: 0.45rem;
		border-radius: 999px;
		background: var(--color-surface);
		box-shadow: inset 0 0 0 1px var(--color-line);
		overflow: hidden;
	}
	.progress span {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--color-link);
	}
	.state {
		grid-area: avatar;
		display: inline-grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		background: var(--color-surface);
		color: var(--color-ink-muted);
	}
	.state-sending {
		background: var(--color-link);
		color: var(--color-paper);
	}
	.state-scheduled {
		background: transparent;
		box-shadow: inset 0 0 0 1.5px var(--color-link);
		color: var(--color-link);
	}
	.empty {
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		padding: var(--space-6) var(--space-4);
		text-align: center;
		color: var(--color-ink-muted);
	}
	.empty p {
		margin: 0;
	}
	@media (max-width: 40rem) {
		.batch-row,
		.conversation {
			grid-template-columns: auto minmax(0, 1fr);
			grid-template-areas:
				'avatar who'
				'avatar line'
				'avatar marks'
				'avatar when';
		}
		.search {
			flex-basis: 100%;
		}
		.progress {
			width: 4.5rem;
		}
	}
</style>
