<script lang="ts">
	import { labelColors } from '#lib/mail.ts';
	import LabelChip from './LabelChip.svelte';
	import { listDate } from './dates.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	function viewLink(view: string, label: string | null = null): string {
		const query = new URLSearchParams();
		if (view !== 'inbox') query.set('view', view);
		if (label) query.set('label', label);
		const text = query.toString();
		return `/workspace/inbox${text ? `?${text}` : ''}`;
	}

	function pageLink(page: number): string {
		const query = new URLSearchParams();
		if (data.view !== 'inbox') query.set('view', data.view);
		if (data.label) query.set('label', data.label);
		if (data.search) query.set('q', data.search);
		if (page > 0) query.set('page', String(page));
		return `/workspace/inbox?${query.toString()}`;
	}

	const currentLabel = $derived(data.labels.find((item) => item.identifier === data.label));
	const heading = $derived(
		currentLabel ? `Label: ${currentLabel.name}` : (data.views.find((item) => item.key === data.view)?.label ?? 'Inbox')
	);
</script>

<svelte:head>
	<title>{heading === 'Inbox' ? 'Inbox' : `${heading} · Inbox`} · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<div class="inbox">
	<nav class="views" aria-label="Inbox views">
		<p><a class="button" href="/workspace/inbox/new">Write a message</a></p>
		<ul>
			{#each data.views as view (view.key)}
				<li>
					<a href={viewLink(view.key)} aria-current={view.key === data.view && !data.label ? 'page' : undefined}>
						<span>{view.label}</span>
						{#if data.counts[view.key]}<span class="count">{data.counts[view.key]}</span>{/if}
					</a>
				</li>
			{/each}
		</ul>
		<h2 class="small">Labels</h2>
		<ul>
			{#each data.labels as label (label.identifier)}
				<li>
					<a href={viewLink('inbox', label.identifier)} aria-current={label.identifier === data.label ? 'page' : undefined}>
						<LabelChip {label} />
					</a>
				</li>
			{/each}
		</ul>
		{#if data.canManage}
			<details>
				<summary class="small">Change labels</summary>
				<form method="post" action="?/makeLabel" class="label-form">
					<div class="field">
						<label for="label-name">New label</label>
						<input type="text" id="label-name" name="name" maxlength="60" required />
					</div>
					<div class="field">
						<label for="label-color">Color</label>
						<select id="label-color" name="color">
							{#each labelColors as color (color)}<option value={color}>{color}</option>{/each}
						</select>
					</div>
					<button class="button-quiet" type="submit">Make the label</button>
				</form>
				{#each data.labels as label (label.identifier)}
					<form method="post" action="?/removeLabel" class="inline">
						<input type="hidden" name="label" value={label.identifier} />
						<button class="button-quiet small" type="submit">Remove “{label.name}”</button>
					</form>
				{/each}
			</details>
		{/if}
	</nav>

	<section class="list" aria-labelledby="inbox-heading">
		<h1 id="inbox-heading">{heading}</h1>
		{#if !data.emailOn}
			<div class="notice" role="status">
				<p>Email is not switched on yet, so nothing arrives or goes out. The steps are in site/MAIL.md, “Switching email on”.</p>
			</div>
		{/if}
		{#if form && 'problem' in form}
			<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
		{:else if form && 'done' in form}
			<div class="notice" role="status"><p>{form.done}</p></div>
		{/if}

		<form method="get" action="/workspace/inbox" role="search" class="search">
			{#if data.view !== 'inbox'}<input type="hidden" name="view" value={data.view} />{/if}
			{#if data.label}<input type="hidden" name="label" value={data.label} />{/if}
			<label for="inbox-search" class="visually-hidden">Search mail</label>
			<input id="inbox-search" type="search" name="q" value={data.search ?? ''} placeholder="Search subject, sender and text" />
			<button class="button-quiet" type="submit">Search</button>
		</form>

		{#if data.threads.length === 0}
			<p class="muted">{data.search ? 'No conversations match.' : 'Nothing here.'}</p>
		{:else}
			<ol class="threads">
				{#each data.threads as thread (thread.identifier)}
					<li class:unread={thread.unread}>
						<a href="/workspace/inbox/{thread.identifier}">
							<span class="who">
								{thread.counterpartName ?? thread.counterpartAddress ?? 'Unknown sender'}
								{#if thread.messageCount > 1}<span class="muted small">({thread.messageCount})</span>{/if}
							</span>
							<span class="subject">{#if thread.unread}<span class="visually-hidden">Unread: </span>{/if}{thread.subject}</span>
							<span class="snippet muted">{thread.snippet}</span>
							<span class="when small muted">
								{#if data.view === 'scheduled' && thread.scheduledFor}Goes {listDate(thread.scheduledFor)}
								{:else if data.view === 'snoozed' && thread.snoozedUntil}Back {listDate(thread.snoozedUntil)}
								{:else}{listDate(thread.lastMessageAt)}{/if}
							</span>
						</a>
						<span class="marks small">
							{#if thread.stopRequested}<span class="mark mark-warning">Asked not to be emailed</span>{/if}
							{#if thread.followUpAt}<span class="mark">Reminder {listDate(thread.followUpAt)}</span>{/if}
							{#if thread.assigneeName}<span class="mark">{thread.assigneeName}</span>{/if}
							{#if thread.hasAttachments}<span class="mark">Attachment</span>{/if}
							{#each thread.labels as label (label.identifier)}<LabelChip {label} />{/each}
						</span>
					</li>
				{/each}
			</ol>
			<p class="paging">
				{#if data.page > 0}<a href={pageLink(data.page - 1)}>Newer</a>{/if}
				{#if data.more}<a href={pageLink(data.page + 1)}>Older</a>{/if}
			</p>
		{/if}
	</section>
</div>

<style>
	.inbox {
		display: grid;
		gap: var(--space-5);
	}
	@media (min-width: 50rem) {
		.inbox {
			grid-template-columns: 14rem minmax(0, 1fr);
		}
	}
	.views ul {
		list-style: none;
		margin: 0 0 var(--space-4);
		padding: 0;
	}
	.views li a {
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		min-height: var(--layout-target-minimum);
		align-items: center;
		border-radius: var(--radius-control);
	}
	.views a[aria-current='page'] {
		background: var(--color-surface);
		font-weight: var(--font-weight-semibold);
	}
	.count {
		font-weight: var(--font-weight-semibold);
	}
	.label-form {
		margin-block: var(--space-3);
	}
	.search {
		display: flex;
		gap: var(--space-2);
		margin-block: var(--space-3);
	}
	.search input {
		flex: 1;
	}
	.threads {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--color-line);
	}
	.threads li {
		border-bottom: 1px solid var(--color-line);
		padding: var(--space-2) 0;
	}
	.threads a {
		display: grid;
		grid-template-columns: minmax(0, 12rem) minmax(0, 1fr) auto;
		grid-template-areas: 'who subject when' 'who snippet when';
		column-gap: var(--space-3);
		text-decoration: none;
		color: var(--color-ink);
	}
	.threads a:hover .subject,
	.threads a:focus-visible .subject {
		text-decoration: underline;
	}
	.who {
		grid-area: who;
		overflow-wrap: anywhere;
	}
	.subject {
		grid-area: subject;
	}
	.snippet {
		grid-area: snippet;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.when {
		grid-area: when;
		white-space: nowrap;
	}
	.unread .who,
	.unread .subject {
		font-weight: var(--font-weight-bold);
	}
	.marks {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin-top: var(--space-1);
	}
	.mark {
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		padding: 0 var(--space-1);
	}
	.mark-warning {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}
	.paging {
		display: flex;
		gap: var(--space-4);
	}
	.inline {
		display: inline;
	}
	@media (max-width: 40rem) {
		.threads a {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas: 'who when' 'subject subject' 'snippet snippet';
		}
	}
</style>
