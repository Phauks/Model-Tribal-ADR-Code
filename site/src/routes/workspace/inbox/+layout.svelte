<script lang="ts">
	// The inbox's left column (site/MAIL.md): Compose, the person's inboxes
	// when they have more than one, the views and Drafts, the folders the lead
	// author made, the tags, the rules and the settings. Choosing an inbox
	// narrows the views, folders and tags to it (?inbox=). On a phone the
	// views are a row of chips above the mail and Write is a floating button,
	// as in the approved mockup (design/email-inbox, 4-phone); the inboxes,
	// folders, tags and tools fold away under them.
	import { onMount } from 'svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import { page } from '$app/state';
	import Archive from '@lucide/svelte/icons/archive';
	import BellRing from '@lucide/svelte/icons/bell-ring';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import FilePen from '@lucide/svelte/icons/file-pen';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import FolderCog from '@lucide/svelte/icons/folder-cog';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import Layers from '@lucide/svelte/icons/layers';
	import ListFilter from '@lucide/svelte/icons/list-filter';
	import OctagonAlert from '@lucide/svelte/icons/octagon-alert';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Send from '@lucide/svelte/icons/send';
	import Settings from '@lucide/svelte/icons/settings';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import UserRound from '@lucide/svelte/icons/user-round';
	import type { Component } from 'svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const icons: Record<string, Component> = {
		inbox: InboxIcon,
		mine: UserCheck,
		reminders: BellRing,
		scheduled: CalendarClock,
		sent: Send,
		archive: Archive,
		spam: OctagonAlert,
		trash: Trash2
	};

	const base = '/workspace/inbox';
	const onList = $derived(page.url.pathname === base);
	const currentView = $derived(onList && !page.url.searchParams.get('folder') && !page.url.searchParams.get('tag') ? (page.url.searchParams.get('view') ?? 'inbox') : null);
	const currentFolder = $derived(onList ? page.url.searchParams.get('folder') : null);
	const currentTag = $derived(onList ? page.url.searchParams.get('tag') : null);

	/** A list link, keeping the chosen inbox. */
	function listLink(query: Record<string, string> = {}): string {
		const parameters = new URLSearchParams(query);
		if (data.chosenInbox) parameters.set('inbox', data.chosenInbox);
		const text = parameters.toString();
		return text ? `${base}?${text}` : base;
	}

	const composeLink = $derived(data.chosenInbox ? `${base}/new?inbox=${data.chosenInbox}` : `${base}/new`);
	const foldLabel = $derived(data.inboxes.length > 1 ? 'Inboxes, folders and tags' : 'Folders and tags');

	let open = $state(true);
	onMount(() => {
		// Folded on a phone, so the mail comes first.
		if (window.matchMedia('(max-width: 49.99rem)').matches) open = false;
	});
</script>

<div class="mail">
	<nav class="view-chips" aria-label="Views">
		<ul>
			{#each data.views as view (view.key)}
				<li>
					<a
						href={view.key === 'inbox' ? listLink() : listLink({ view: view.key })}
						aria-current={currentView === view.key ? 'page' : undefined}
						>{view.label}{#if data.counts[view.key]}<span class="chip-count">{data.counts[view.key]}</span>{/if}</a
					>
				</li>
				{#if view.key === 'scheduled'}
					<li>
						<a href="{base}/drafts" aria-current={page.url.pathname === `${base}/drafts` ? 'page' : undefined}
							>Drafts{#if data.drafts}<span class="chip-count">{data.drafts}</span>{/if}</a
						>
					</li>
				{/if}
			{/each}
		</ul>
	</nav>
	<details class="mail-nav" bind:open>
		<summary><ChevronDown size={18} aria-hidden="true" class="fold" />{foldLabel}</summary>
		<nav aria-label="Mailboxes">
			<a class="button compose" href={composeLink}><SquarePen size={18} aria-hidden="true" /> Compose</a>
			{#if data.inboxes.length > 1}
				<div class="section-head"><h2>Inboxes</h2></div>
				<ul class="nav-list">
					<li>
						<a href={base} aria-current={onList && !data.chosenInbox && currentView === 'inbox' ? 'page' : undefined}>
							<Layers size={18} aria-hidden="true" />
							<span class="name">All inboxes</span>
						</a>
					</li>
					{#each data.inboxes as inbox (inbox.identifier)}
						<li>
							<a href="{base}?inbox={inbox.identifier}" aria-current={onList && data.chosenInbox === inbox.identifier && currentView === 'inbox' ? 'page' : undefined} title={inbox.address}>
								{#if inbox.kind === 'personal'}<UserRound size={18} aria-hidden="true" />{:else}<InboxIcon size={18} aria-hidden="true" />{/if}
								<span class="name">{inbox.name}<span class="visually-hidden">, {inbox.kind === 'personal' ? 'your own inbox' : 'shared'}, {inbox.address}</span></span>
								{#if inbox.unread}<CountBadge count={inbox.unread} label="unread" />{/if}
							</a>
						</li>
					{/each}
				</ul>
				{#if data.chosenInbox}
					{@const chosen = data.inboxes.find((inbox) => inbox.identifier === data.chosenInbox)}
					<div class="section-head"><h2>In {chosen?.name}</h2></div>
				{/if}
			{/if}
			<ul class="nav-list views">
				{#each data.views as view (view.key)}
					{@const Icon = icons[view.key]}
					<li>
						<a href={view.key === 'inbox' ? listLink() : listLink({ view: view.key })} aria-current={currentView === view.key && (data.inboxes.length <= 1 || view.key !== 'inbox') ? 'page' : undefined}>
							<Icon size={18} aria-hidden="true" />
							<span class="name">{view.label}</span>
							{#if data.counts[view.key]}<CountBadge count={data.counts[view.key] ?? 0} label={view.key === 'reminders' || view.key === 'scheduled' ? 'waiting' : 'unread'} />{/if}
						</a>
					</li>
					{#if view.key === 'scheduled'}
						<li>
							<a href="{base}/drafts" aria-current={page.url.pathname === `${base}/drafts` ? 'page' : undefined}>
								<FilePen size={18} aria-hidden="true" />
								<span class="name">Drafts</span>
								{#if data.drafts}<CountBadge count={data.drafts} label="drafts" />{/if}
							</a>
						</li>
					{/if}
				{/each}
			</ul>

			<div class="section-head">
				<h2>Folders</h2>
				{#if data.canManage}
					<a class="icon-button small-icon" href="{base}/organize#new-folder" aria-label="Make a folder" title="Make a folder"><Plus size={16} aria-hidden="true" /></a>
				{/if}
			</div>
			{#if data.mailFolders.length}
				<ul class="nav-list">
					{#each data.mailFolders as folder (folder.identifier)}
						<li>
							<a
								href={listLink({ folder: folder.identifier })}
								aria-current={currentFolder === folder.identifier ? 'page' : undefined}
								style="padding-left: calc(var(--space-2) + {folder.depth} * var(--space-4))"
								title={folder.path}
							>
								<FolderIcon size={18} aria-hidden="true" />
								<span class="name">{folder.name}</span>
								{#if folder.unread}<CountBadge count={folder.unread} label="unread" />{/if}
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty small muted">No folders yet.</p>
			{/if}

			<div class="section-head">
				<h2>Tags</h2>
				{#if data.canManage}
					<a class="icon-button small-icon" href="{base}/organize#new-tag" aria-label="Make a tag" title="Make a tag"><Plus size={16} aria-hidden="true" /></a>
				{/if}
			</div>
			{#if data.tags.length}
				<ul class="nav-list">
					{#each data.tags as tag (tag.identifier)}
						<li>
							<a href={listLink({ tag: tag.identifier })} aria-current={currentTag === tag.identifier ? 'page' : undefined}>
								<span class="dot dot-{tag.color}" aria-hidden="true"></span>
								<span class="name">{tag.name}</span>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty small muted">No tags yet.</p>
			{/if}

			<!-- Everyone on an inbox opens Inbox settings for their own alerts; the rest of it, rules and folders are for whoever manages mail. -->
			<ul class="nav-list tools">
				{#if data.canManage}
					<li>
						<a href="{base}/rules" aria-current={page.url.pathname.startsWith(`${base}/rules`) ? 'page' : undefined}>
							<ListFilter size={18} aria-hidden="true" /><span class="name">Auto-sort rules</span>
						</a>
					</li>
					<li>
						<a href="{base}/organize" aria-current={page.url.pathname === `${base}/organize` ? 'page' : undefined}>
							<FolderCog size={18} aria-hidden="true" /><span class="name">Folders and tags</span>
						</a>
					</li>
				{/if}
				<li>
					<a href="{base}/settings" aria-current={page.url.pathname === `${base}/settings` ? 'page' : undefined}>
						<Settings size={18} aria-hidden="true" /><span class="name">Inbox settings</span>
					</a>
				</li>
			</ul>
		</nav>
	</details>

	<div class="mail-main">
		{#if !data.emailOn}
			<div class="notice" role="status">
				<p>Email is not switched on yet, so nothing arrives or goes out. The steps are in site/MAIL.md, “Switching email on”.</p>
			</div>
		{/if}
		{@render children()}
	</div>
	{#if onList}
		<a class="button write" href={composeLink}><Pencil size={18} aria-hidden="true" /> Write</a>
	{/if}
</div>

<style>
	.mail {
		display: grid;
		/* One column on a phone, no wider than the screen however long the row of chips is. */
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-5);
		align-items: start;
	}
	.mail-nav > summary {
		font-weight: var(--font-weight-semibold);
		min-height: var(--layout-target-minimum);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
		list-style: none;
	}
	.mail-nav > summary::-webkit-details-marker {
		display: none;
	}
	.mail-nav:not([open]) > summary :global(.fold) {
		transform: rotate(-90deg);
	}
	/* Phones: the views as chips that scroll sideways, and Write as a floating button (design/email-inbox, 4-phone). */
	.view-chips ul {
		display: flex;
		gap: var(--space-2);
		margin: 0;
		padding: 0 0 var(--space-1);
		list-style: none;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.view-chips a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		color: var(--color-ink);
		text-decoration: none;
		white-space: nowrap;
	}
	.view-chips a[aria-current='page'] {
		background: var(--color-band);
		border-color: var(--color-band);
		color: var(--color-band-text);
		font-weight: var(--font-weight-semibold);
	}
	.chip-count {
		font-variant-numeric: tabular-nums;
	}
	.write {
		position: fixed;
		right: var(--space-4);
		bottom: var(--space-4);
		z-index: 5;
		gap: var(--space-2);
		border-radius: 999px;
		padding-inline: var(--space-5);
		box-shadow: 0 var(--space-1) var(--space-3) color-mix(in srgb, var(--color-ink) 30%, transparent);
	}
	@media (max-width: 49.99rem) {
		.mail {
			gap: var(--space-3);
		}
		.compose,
		.nav-list.views {
			display: none;
		}
		/* Room under the last conversation for the floating Write button. */
		.mail-main {
			padding-bottom: calc(var(--layout-target-minimum) + var(--space-5));
		}
	}
	@media (min-width: 50rem) {
		.mail {
			grid-template-columns: 15rem minmax(0, 1fr);
		}
		.view-chips,
		.write {
			display: none;
		}
		.mail-nav {
			grid-column: 1;
			grid-row: 1;
		}
		.mail-main {
			grid-column: 2;
			grid-row: 1;
		}
		.mail-nav > summary {
			display: none;
		}
		.mail-nav {
			position: sticky;
			top: var(--space-4);
		}
	}
	.compose {
		width: 100%;
		justify-content: center;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
		border-radius: 999px;
		box-shadow: 0 1px 3px color-mix(in srgb, var(--color-ink) 20%, transparent);
	}
	.nav-list {
		list-style: none;
		margin: 0 0 var(--space-3);
		padding: 0;
	}
	.nav-list a {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 2.5rem;
		padding: 0 var(--space-3) 0 var(--space-2);
		border-radius: 0 999px 999px 0;
		color: var(--color-ink);
		text-decoration: none;
	}
	.nav-list a:hover {
		background: var(--color-surface);
	}
	.nav-list a[aria-current='page'] {
		background: color-mix(in srgb, var(--color-link) 16%, transparent);
		font-weight: var(--font-weight-semibold);
		box-shadow: inset 3px 0 0 var(--color-link);
	}
	.nav-list :global(svg) {
		flex: none;
		color: var(--color-ink-muted);
	}
	.nav-list a[aria-current='page'] :global(svg) {
		color: var(--color-link);
	}
	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: var(--space-4) 0 var(--space-1);
		padding-left: var(--space-2);
	}
	.section-head h2 {
		margin: 0;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.empty {
		padding-left: var(--space-2);
		margin: 0 0 var(--space-3);
	}
	.tools {
		border-top: 1px solid var(--color-line);
		padding-top: var(--space-3);
		margin-top: var(--space-4);
	}
	.dot {
		flex: none;
		width: 0.7rem;
		height: 0.7rem;
		margin-inline: 0.2rem;
		border-radius: 50%;
		background: var(--color-link);
	}
	.dot-orange {
		background: var(--color-action);
	}
	.dot-gray {
		background: var(--color-ink-muted);
	}
	.dot-gold {
		background: var(--color-placeholder-rule);
	}
	.dot-green {
		background: var(--color-map-class-2);
	}
	.dot-purple {
		background: var(--color-band);
	}
	.mail-main {
		min-width: 0;
	}
	.mail-main > :global(.notice:first-child) {
		margin-top: 0;
	}
</style>
