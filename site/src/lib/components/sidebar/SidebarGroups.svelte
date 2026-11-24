<script lang="ts">
	// The groups under the site's sections in the sidebar (SiteSidebar.svelte):
	// the Account pages and the Workspace for people signed in, and the
	// reader's own links (Recent changes, Changes to this page, Starred pages).
	// The Your account and Workspace groups fold like a section; each starts
	// open on its own pages and shut elsewhere, until the reader chooses.
	import FileClock from '@lucide/svelte/icons/file-clock';
	import History from '@lucide/svelte/icons/history';
	import Star from '@lucide/svelte/icons/star';
	import type { AccountPage } from '#lib/account-menu.ts';
	import { followingState } from '#lib/following-state.svelte.ts';
	import { unreadLabel } from '#lib/following.ts';
	import { groupWorkspacePages, type WorkspaceGroup, type WorkspacePage } from '#lib/workspace-menu.ts';
	import FoldGroup from './FoldGroup.svelte';
	import type { SidebarState } from './sidebar-state.svelte.ts';

	let {
		idSuffix,
		path,
		sidebar,
		accountPages,
		currentAccount,
		workspaceMenu,
		currentWorkspacePage,
		followedPage
	}: {
		idSuffix: string;
		path: string;
		sidebar: SidebarState;
		/** Listed for someone signed in, and on the Account pages. */
		accountPages: AccountPage[];
		currentAccount: AccountPage | undefined;
		workspaceMenu: WorkspacePage[];
		currentWorkspacePage: WorkspacePage | undefined;
		/** The page's address for "Changes to this page", when the site records its changes. */
		followedPage: string | undefined;
	} = $props();

	// The workspace pages under their categories, Overview first on its own (src/lib/workspace-menu.ts).
	const workspaceGroups = $derived(groupWorkspacePages(workspaceMenu));
	// Each category folds; it starts open only around the page being read, and
	// then as the reader last left it (Trevor, Nov. 23, 2026).
	const categoryKey = (group: WorkspaceGroup) => `workspace-${group.category}`;
	const categoryOpen = (group: WorkspaceGroup) =>
		sidebar.isOpen(categoryKey(group), currentWorkspacePage !== undefined && group.pages.includes(currentWorkspacePage));
	const workspaceOpen = $derived(sidebar.isOpen('workspace', Boolean(currentWorkspacePage)));
	const accountOpen = $derived(sidebar.isOpen('account', Boolean(currentAccount)));
	// Updates to followed pages not yet seen, beside Following (site/DESIGN.md, section 6, "Follow").
	const unread = $derived(followingState.current.signedIn ? followingState.current.unread : 0);
</script>

{#if accountPages.length > 0}
	<!-- The Account pages and Following, for someone signed in (site/DESIGN.md, section 6, "Settings and Account"). -->
	<div class="group">
		<FoldGroup
			id="sidebar-account-{idSuffix}"
			title="Your account"
			open={accountOpen}
			ontoggle={() => sidebar.setOpen('account', !accountOpen)}
		>
			{#snippet after()}
				{#if unread > 0 && !accountOpen}
					<span class="unread-count" title="{unread} new {unread === 1 ? 'update' : 'updates'} to pages you follow"
						>{unreadLabel(unread)}<span class="visually-hidden"> new</span></span
					>
				{/if}
			{/snippet}
			{#each accountPages as item (item.link)}
				<li>
					<a href={item.link} aria-current={item === currentAccount ? 'page' : undefined}>
						{item.label}
						{#if item.link === '/following' && unread > 0}<span class="unread-count">{unreadLabel(unread)} new</span>{/if}
					</a>
				</li>
			{/each}
		</FoldGroup>
	</div>
{/if}
{#if workspaceMenu.length > 0}
	<!-- The workspace, for people signed in with access to it (site/COLLABORATION.md). -->
	{#snippet workspaceLinks(pages: WorkspacePage[])}
		{#each pages as item (item.link)}
			<li>
				<a href={item.link} aria-current={item === currentWorkspacePage ? 'page' : undefined}>{item.label}</a>
			</li>
		{/each}
	{/snippet}
	<div class="group">
		<FoldGroup
			id="sidebar-workspace-{idSuffix}"
			title="Workspace"
			open={workspaceOpen}
			ontoggle={() => sidebar.setOpen('workspace', !workspaceOpen)}
		>
			{#each workspaceGroups as group, index (group.category ?? index)}
				{#if group.category}
					{@const open = categoryOpen(group)}
					<!-- Each category folds the same way as the groups around it. -->
					<li>
						<FoldGroup
							id="sidebar-workspace-{idSuffix}-{index}"
							title={group.category}
							{open}
							nested
							ontoggle={() => sidebar.setOpen(categoryKey(group), !open)}
						>
							{@render workspaceLinks(group.pages)}
						</FoldGroup>
					</li>
				{:else}
					{@render workspaceLinks(group.pages)}
				{/if}
			{/each}
		</FoldGroup>
	</div>
{/if}
<!-- Every change to the site's pages, like a wiki's (site/COLLABORATION.md, "Recent changes"),
     and the reader's own pages, kept on this device (site/DESIGN.md, section 6, "Star"). -->
<ul class="group reader-links">
	<li>
		<a href="/changes" aria-current={path === '/changes' ? 'page' : undefined}>
			<History size={18} aria-hidden="true" />
			Recent changes
		</a>
	</li>
	{#if followedPage}
		<!-- Opens the history of the page the reader is on, not every page's (Trevor, Nov. 23, 2026). -->
		<li>
			<a href="/changes?page={encodeURIComponent(followedPage)}">
				<FileClock size={18} aria-hidden="true" />
				Changes to this page
			</a>
		</li>
	{/if}
	<li class="needs-scripts">
		<a href="/starred" aria-current={path === '/starred' ? 'page' : undefined}>
			<Star size={18} aria-hidden="true" />
			Starred pages
		</a>
	</li>
</ul>

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.group {
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}

	/* The number of updates not yet seen, in the action color. */
	.unread-count {
		margin-left: auto;
		padding: 0 var(--space-3) 0 var(--space-2);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-action);
	}

	/* The reader's own links look like the groups' (sidebar/FoldGroup.svelte). */
	.reader-links a {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.5rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-control);
		color: var(--color-ink);
		text-decoration: none;
	}

	.reader-links a:hover {
		background: var(--color-surface);
		text-decoration: underline;
	}

	.reader-links a {
		font-weight: var(--font-weight-semibold);
	}

	.reader-links a[aria-current='page'] {
		color: var(--color-link);
		font-weight: var(--font-weight-bold);
	}

	:global(.sidebar-narrow) .reader-links a {
		min-height: var(--layout-target-minimum);
	}
</style>
