<script lang="ts">
	import { onMount } from 'svelte';
	import Archive from '@lucide/svelte/icons/archive';
	import BellRing from '@lucide/svelte/icons/bell-ring';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import FolderInput from '@lucide/svelte/icons/folder-input';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import Mail from '@lucide/svelte/icons/mail';
	import MailOpen from '@lucide/svelte/icons/mail-open';
	import OctagonAlert from '@lucide/svelte/icons/octagon-alert';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Search from '@lucide/svelte/icons/search';
	import Tag from '@lucide/svelte/icons/tag';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import X from '@lucide/svelte/icons/x';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import Avatar from './Avatar.svelte';
	import TagChip from './TagChip.svelte';
	import { listDate } from './dates.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const base = '/workspace/inbox';

	/** The address of this list with other search words or another page. */
	function listLink(changes: { page?: number; q?: string | null }): string {
		const query = new URLSearchParams();
		if (data.inbox) query.set('inbox', data.inbox);
		if (data.folder) query.set('folder', data.folder);
		else if (data.tag) query.set('tag', data.tag);
		else if (data.view !== 'inbox') query.set('view', data.view);
		const search = changes.q === undefined ? data.search : changes.q;
		if (search) query.set('q', search);
		const page = changes.page ?? 0;
		if (page > 0) query.set('page', String(page));
		const text = query.toString();
		return `${base}${text ? `?${text}` : ''}`;
	}

	const currentFolder = $derived(data.folder ? data.mailFolders.find((item) => item.identifier === data.folder) : undefined);
	const currentTag = $derived(data.tag ? data.tags.find((item) => item.identifier === data.tag) : undefined);
	const heading = $derived(
		currentFolder
			? currentFolder.path
			: currentTag
				? currentTag.name
				: (data.views.find((item) => item.key === data.view)?.label ?? 'Inbox')
	);
	const place = $derived(data.folder ? 'folder' : data.view);
	// The inbox the left column chose, named above the list when the person has more than one.
	const chosenInbox = $derived(data.inbox ? data.inboxes.find((item) => item.identifier === data.inbox) : undefined);

	// Which rows are ticked. The buttons work without scripts too; with them, they wait for a tick.
	let selected = $state<string[]>([]);
	let ready = $state(false);
	onMount(() => (ready = true));
	const allTicked = $derived(data.threads.length > 0 && selected.length === data.threads.length);
	const none = $derived(ready && selected.length === 0);
	const moveChoices = $derived([
		{ value: '', label: 'Move to…' },
		...data.mailFolders.map((folder) => ({ value: folder.identifier, label: `${'\u2003'.repeat(folder.depth)}${folder.name}` })),
		{ value: 'archive', label: 'Archive' }
	]);
	const tagChoices = $derived([
		{ value: '', label: 'Tag…' },
		...data.tags.map((tag) => ({ value: `tag:${tag.identifier}`, label: tag.name, group: 'Add' })),
		...data.tags.map((tag) => ({ value: `untag:${tag.identifier}`, label: tag.name, group: 'Take off' }))
	]);

	function tickAll(event: Event): void {
		selected = (event.currentTarget as HTMLInputElement).checked ? data.threads.map((thread) => thread.identifier) : [];
	}
</script>

<svelte:head>
	<title>{heading === 'Inbox' ? 'Inbox' : `${heading} · Inbox`} · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<header class="list-head">
	<h1>
		{#if currentTag}<span class="visually-hidden">Tag: </span>{/if}{heading}
		{#if chosenInbox}<span class="inbox-name">{chosenInbox.name}</span>{/if}
	</h1>
	<form method="get" action={base} role="search" class="search">
		{#if data.inbox}<input type="hidden" name="inbox" value={data.inbox} />{/if}
		{#if data.folder}<input type="hidden" name="folder" value={data.folder} />
		{:else if data.tag}<input type="hidden" name="tag" value={data.tag} />
		{:else if data.view !== 'inbox'}<input type="hidden" name="view" value={data.view} />{/if}
		<Search size={18} aria-hidden="true" />
		<label for="inbox-search" class="visually-hidden">Search mail</label>
		<input id="inbox-search" type="search" name="q" value={data.search ?? ''} placeholder="Search mail" />
		{#if data.search}
			<a class="icon-button clear" href={listLink({ q: null })} aria-label="Clear the search" title="Clear the search"><X size={18} aria-hidden="true" /></a>
		{/if}
	</form>
</header>
<p class="intro">Mail to the project’s addresses. Only people with the read-mail permission see this page.</p>

{#if data.stuck.length}
	<div class="notice notice-problem stuck" role="alert">
		<p>
			<strong>{data.stuck.length === 1 ? 'A message' : `${data.stuck.length} messages`} could not be filed</strong>, even after trying again for about a day. {data.stuck.length === 1 ? 'It is' : 'They are'} kept safe, unread by anyone, until filing works. Last problem: {data.stuck[data.stuck.length - 1].lastError}
		</p>
		<form method="post" action="?/fileAgain"><button class="button button-quiet" type="submit">Try again now</button></form>
	</div>
{/if}

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

{#if data.threads.length === 0}
	<div class="empty">
		<InboxIcon size={48} aria-hidden="true" />
		{#if data.search}
			<p class="lead">No conversations match “{data.search}”.</p>
			<p><a href={listLink({ q: null })}>Clear the search</a></p>
		{:else if place === 'inbox'}
			<p class="lead">You’re all caught up.</p>
			<p class="muted">New mail to the project’s addresses shows up here.</p>
		{:else}
			<p class="lead">Nothing here.</p>
		{/if}
	</div>
{:else}
	<form method="post" action="?/bulk" class="list-form">
		<div class="toolbar" role="toolbar" aria-label="Change the ticked conversations">
			<label class="tick-all" title="Tick every conversation on this page">
				<input type="checkbox" checked={allTicked} indeterminate={selected.length > 0 && !allTicked} onchange={tickAll} />
				<span class="visually-hidden">Tick every conversation on this page</span>
			</label>
			{#if ready && selected.length > 0}<span class="small picked">{selected.length} ticked</span>{/if}
			<span class="tool-group">
				{#if place === 'inbox' || place === 'folder' || place === 'mine'}
					<button class="tool" type="submit" name="do" value="archive" disabled={none}><Archive size={18} aria-hidden="true" /><span>Archive</span></button>
				{:else}
					<button class="tool" type="submit" name="do" value="inbox" disabled={none}><InboxIcon size={18} aria-hidden="true" /><span>To inbox</span></button>
				{/if}
				{#if place !== 'trash'}
					<button class="tool" type="submit" name="do" value="trash" disabled={none}><Trash2 size={18} aria-hidden="true" /><span>Delete</span></button>
				{/if}
				{#if place !== 'spam'}
					<button class="tool" type="submit" name="do" value="spam" disabled={none}><OctagonAlert size={18} aria-hidden="true" /><span>Spam</span></button>
				{/if}
				<button class="tool" type="submit" name="do" value="read" disabled={none}><MailOpen size={18} aria-hidden="true" /><span>Read</span></button>
				<button class="tool" type="submit" name="do" value="unread" disabled={none}><Mail size={18} aria-hidden="true" /><span>Unread</span></button>
			</span>
			<span class="tool-group">
				<Dropdown label="Move the ticked conversations to" hideLabel id="move-to" name="moveTo" disabled={none} choices={moveChoices} value="" />
				<button class="tool" type="submit" name="do" value="move" disabled={none}><FolderInput size={18} aria-hidden="true" /><span>Move</span></button>
				{#if data.tags.length}
					<Dropdown label="Tag the ticked conversations" hideLabel id="tag-with" name="tagWith" disabled={none} choices={tagChoices} value="" />
					<button class="tool" type="submit" name="do" value="tag" disabled={none}><Tag size={18} aria-hidden="true" /><span>Tag</span></button>
				{/if}
			</span>
		</div>

		<ol class="threads">
			{#each data.threads as thread (thread.identifier)}
				{@const who = thread.counterpartName ?? thread.counterpartAddress ?? 'Unknown sender'}
				<li class:unread={thread.unread} class:ticked={selected.includes(thread.identifier)}>
					<label class="tick">
						<input type="checkbox" name="thread" value={thread.identifier} bind:group={selected} />
						<span class="visually-hidden">Tick “{thread.subject}”</span>
					</label>
					<a href="{base}/{thread.identifier}">
						<Avatar name={who} />
						<span class="who">
							{#if thread.unread}<span class="visually-hidden">Unread: </span>{/if}{who}
							{#if thread.messageCount > 1}<span class="number">{thread.messageCount}</span>{/if}
						</span>
						<span class="line">
							<span class="subject">{thread.subject}</span>
							{#if thread.snippet}<span class="snippet"> — {thread.snippet}</span>{/if}
						</span>
						<span class="when">
							{#if thread.hasAttachments}<span title="Has an attachment"><Paperclip size={16} aria-label="Has an attachment" /></span>{/if}
							{#if thread.remindAt && data.view !== 'reminders'}<span title="Reminder {listDate(thread.remindAt)}"><BellRing size={16} aria-label="Reminder {listDate(thread.remindAt)}" /></span>{/if}
							{#if data.view === 'scheduled' && thread.scheduledFor}Goes {listDate(thread.scheduledFor)}
							{:else if data.view === 'reminders' && thread.remindAt}Back {listDate(thread.remindAt)}
							{:else}{listDate(thread.lastMessageAt)}{/if}
						</span>
						{#if thread.tags.length || thread.stopRequested || thread.assigneeName || (thread.folder === 'folder' && !data.folder)}
							<span class="marks">
								{#if thread.stopRequested}<span class="mark mark-warning">Asked not to be emailed</span>{/if}
								{#if thread.folder === 'folder' && !data.folder}
									{@const home = data.mailFolders.find((item) => item.identifier === thread.folderIdentifier)}
									{#if home}<span class="mark"><FolderInput size={14} aria-hidden="true" />{home.name}</span>{/if}
								{/if}
								{#if thread.assigneeName}<span class="mark"><UserCheck size={14} aria-hidden="true" />{thread.assigneeName}</span>{/if}
								{#each thread.tags as tag (tag.identifier)}<TagChip {tag} size="small" />{/each}
							</span>
						{/if}
					</a>
				</li>
			{/each}
		</ol>
	</form>
	{#if data.page > 0 || data.more}
		<nav class="paging" aria-label="More conversations">
			<span class="small muted">{data.page * 50 + 1}–{data.page * 50 + data.threads.length}</span>
			{#if data.page > 0}
				<a class="icon-button" href={listLink({ page: data.page - 1 })} aria-label="Newer" title="Newer"><ChevronLeft size={20} aria-hidden="true" /></a>
			{/if}
			{#if data.more}
				<a class="icon-button" href={listLink({ page: data.page + 1 })} aria-label="Older" title="Older"><ChevronRight size={20} aria-hidden="true" /></a>
			{/if}
		</nav>
	{/if}
{/if}

<style>
	.stuck {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.stuck p {
		flex: 1;
		min-width: 16rem;
		overflow-wrap: anywhere;
	}
	.inbox-name {
		display: block;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-regular);
		color: var(--color-ink-muted);
	}
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
	.toolbar :global(.dropdown) {
		margin: 0;
	}
	.toolbar :global(.dropdown-control) {
		width: 11rem;
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
		grid-template-columns: auto minmax(0, 11rem) minmax(0, 1fr) auto;
		grid-template-areas:
			'avatar who line when'
			'avatar who marks marks';
		column-gap: var(--space-3);
		row-gap: var(--space-1);
		align-items: center;
		padding: var(--space-2) var(--space-3) var(--space-2) 0;
		color: var(--color-ink);
		text-decoration: none;
	}
	.threads a > :global(.avatar) {
		grid-area: avatar;
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
	.number {
		margin-left: var(--space-1);
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
		font-weight: var(--font-weight-regular);
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
		gap: var(--space-1);
	}
	.mark {
		display: inline-flex;
		align-items: center;
		gap: 0.3em;
		padding: 0 0.5em;
		border-radius: 999px;
		border: 1px solid var(--color-line);
		font-size: 0.8rem;
		color: var(--color-ink-muted);
	}
	.mark-warning {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}
	.empty {
		display: grid;
		justify-items: center;
		text-align: center;
		padding: var(--space-8) var(--space-4);
		color: var(--color-ink-muted);
	}
	.empty .lead {
		color: var(--color-ink);
		margin: var(--space-3) 0 var(--space-1);
	}
	.paging {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-1);
		margin-top: var(--space-2);
	}
	@media (max-width: 40rem) {
		.tool span {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
		.threads a {
			grid-template-columns: auto minmax(0, 1fr) auto;
			grid-template-areas:
				'avatar who when'
				'avatar line line'
				'avatar marks marks';
		}
		.threads a > :global(.avatar) {
			align-self: start;
		}
	}
</style>
