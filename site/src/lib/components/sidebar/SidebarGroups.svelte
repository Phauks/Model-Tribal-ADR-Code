<script lang="ts">
	// The groups under the site's sections in the sidebar (SiteSidebar.svelte):
	// the Account pages on those pages, the Workspace for people who can use it,
	// and the reader's own links (Recent changes, Changes to this page, Starred
	// pages). The Workspace group folds like a section; it starts open on
	// workspace pages and shut elsewhere, until the reader chooses.
	import FileClock from '@lucide/svelte/icons/file-clock';
	import History from '@lucide/svelte/icons/history';
	import Star from '@lucide/svelte/icons/star';
	import type { AccountPage } from '#lib/account-menu.ts';
	import type { WorkspacePage } from '#lib/workspace-menu.ts';
	import FoldButton from './FoldButton.svelte';
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
		/** Listed only on the Account pages. */
		accountPages: AccountPage[];
		currentAccount: AccountPage | undefined;
		workspaceMenu: WorkspacePage[];
		currentWorkspacePage: WorkspacePage | undefined;
		/** The page's address for "Changes to this page", when the site records its changes. */
		followedPage: string | undefined;
	} = $props();

	const workspaceOpen = $derived(sidebar.isOpen('workspace', Boolean(currentWorkspacePage)));
</script>

{#if accountPages.length > 0}
	<!-- The Account pages, on those pages only (site/DESIGN.md, section 6, "Settings and Account"). -->
	<div class="group">
		<p class="group-title" id="sidebar-account-{idSuffix}">Your account</p>
		<ul aria-labelledby="sidebar-account-{idSuffix}">
			{#each accountPages as item (item.link)}
				<li>
					<a href={item.link} aria-current={item === currentAccount ? 'page' : undefined}>{item.label}</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}
{#if workspaceMenu.length > 0}
	<!-- The workspace, for people signed in with access to it (site/COLLABORATION.md). -->
	<div class="group">
		<div class="group-heading">
			<FoldButton
				controls="sidebar-workspace-list-{idSuffix}"
				expanded={workspaceOpen}
				name="Pages in Workspace"
				onclick={() => sidebar.setOpen('workspace', !workspaceOpen)}
			/>
			<p class="group-title" id="sidebar-workspace-{idSuffix}">Workspace</p>
		</div>
		<ul id="sidebar-workspace-list-{idSuffix}" aria-labelledby="sidebar-workspace-{idSuffix}" hidden={!workspaceOpen}>
			{#each workspaceMenu as item (item.link)}
				<li>
					<a href={item.link} aria-current={item === currentWorkspacePage ? 'page' : undefined}>{item.label}</a>
				</li>
			{/each}
		</ul>
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

	.group-heading {
		display: flex;
		align-items: center;
	}

	.group-title {
		margin: 0 0 var(--space-1);
		padding: 0 var(--space-3);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink-muted);
	}

	.group-heading .group-title {
		margin: 0;
		padding-left: var(--space-1);
	}

	/* Without scripts the Workspace group cannot fold, so it shows. */
	:global(:root:not([data-scripts='on'])) ul[hidden] {
		display: block;
	}

	:global(:root:not([data-scripts='on'])) .group-heading .group-title {
		padding-left: var(--space-3);
	}

	a {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.5rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-control);
		color: var(--color-ink);
		text-decoration: none;
	}

	a:hover {
		background: var(--color-surface);
		text-decoration: underline;
	}

	.group:not(.reader-links) a[aria-current='page'] {
		border-left: 3px solid var(--color-action);
		border-radius: 0;
		background: var(--color-surface);
		font-weight: var(--font-weight-semibold);
	}

	.reader-links a {
		font-weight: var(--font-weight-semibold);
	}

	.reader-links a[aria-current='page'] {
		color: var(--color-link);
		font-weight: var(--font-weight-bold);
	}

	:global(.sidebar-narrow) a {
		min-height: var(--layout-target-minimum);
	}
</style>
