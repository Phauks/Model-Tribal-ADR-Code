<script lang="ts">
	// The left sidebar, on every page. It always lists the site's sections. The
	// section being read lists its pages, with the page being read opened into
	// its own outline: the headings of an essay, the parts of a nation's page
	// (src/lib/sidebar-outline.ts). Any other section opens from here too, to
	// list its pages (Trevor, Nov. 23, 2026).
	//
	// It works without JavaScript: the wide-screen sidebar and the phone menu are
	// each a <details> element, and the current page is marked when the page is
	// built. A script, when it runs, adds the carets that fold sections and
	// entries, remembers what the reader opened and whether they hid the
	// sidebar, and marks the heading being read as the page scrolls. On paper
	// the sidebar is not printed.
	//
	// The pieces: what is open (sidebar/sidebar-state.svelte.ts), one level of
	// an outline (sidebar/SidebarTree.svelte), the caret
	// (sidebar/FoldButton.svelte) and the groups under the sections
	// (sidebar/SidebarGroups.svelte). For someone signed in with workspace
	// access, a Workspace group lists the workspace pages their role opens;
	// for anyone signed in, a Your account group lists the account pages and
	// Following, which the profile button in the masthead no longer holds
	// (Trevor, Nov. 23, 2026).
	// Workspace pages know this when the Worker renders them; the pages built
	// ahead of time read it from the signed-in hint (src/lib/signed-in-hint.ts).
	import { tick, untrack } from 'svelte';
	import { building } from '$app/env';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import Menu from '@lucide/svelte/icons/menu';
	import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
	import PanelLeftOpen from '@lucide/svelte/icons/panel-left-open';
	import { accountPages, currentAccountPage, isAccountPath } from '#lib/account-menu.ts';
	import { followActiveHeading, headingIds } from '#lib/active-heading.ts';
	import { isUnfolded } from '#lib/outline-folding.ts';
	import { followedPageAddress } from '#lib/page-history.ts';
	import type { Permission } from '#lib/permissions.ts';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';
	import { composeSectionOutline, currentLinkIn } from '#lib/sidebar-outline.ts';
	import { sectionOf, siteSections, type OutlineItem, type PageOutline, type SiteSection } from '#lib/site-sections.ts';
	import {
		isCurrentWorkspacePage,
		workspacePagesFor,
		workspacePagesNamed,
		type WorkspacePage
	} from '#lib/workspace-menu.ts';
	import FoldButton from './sidebar/FoldButton.svelte';
	import SidebarGroups from './sidebar/SidebarGroups.svelte';
	import SidebarTree from './sidebar/SidebarTree.svelte';
	import { SidebarState, sidebarHiddenKey } from './sidebar/sidebar-state.svelte.ts';

	const sidebar = new SidebarState();

	const path = $derived(page.url.pathname);
	// Pages built ahead of time cannot read the query while being built.
	const search = $derived(building ? '' : page.url.search);
	// The page the reader is on, when the site records its changes ("Changes to this page").
	const followedPage = $derived(page.error ? undefined : followedPageAddress(path));
	const currentSection = $derived(sectionOf(path));

	// The page's title, for the phone menu bar on pages outside the sections.
	let pageTitle = $state<string | undefined>(undefined);

	// The section being read: its pages (from the root layout), with this page's outline in place.
	const pageOutline = $derived(page.data.outline as PageOutline | undefined);
	// Every section's pages: with the page, or read in the browser for the
	// essays on a page built ahead of time (sidebar/sidebar-state.svelte.ts).
	const pageLists = $derived((page.data.sidebarLists ?? {}) as Record<string, OutlineItem[]>);
	const lists = $derived<Record<string, OutlineItem[]>>({ ...sidebar.fetched, ...pageLists });
	const sectionPages = $derived(currentSection ? lists[currentSection.link] : undefined);
	const currentItems = $derived(
		composeSectionOutline(currentSection?.opens ? sectionPages : undefined, pageOutline, path, pageTitle)
	);
	// A page outside any list of pages keeps its outline's title above it.
	const outlineTitle = $derived(currentSection?.opens && sectionPages?.length ? undefined : pageOutline?.title);
	const currentLink = $derived(currentLinkIn(currentItems, path, search));

	// The workspace pages to list: from the page itself in the workspace,
	// otherwise from the signed-in hint, read in the browser.
	let hintedPageNames = $state<string[]>([]);
	let hintedSignedIn = $state(false);
	$effect(() => {
		const hint = readSignedInHint(document.cookie);
		hintedPageNames = hint.workspacePageNames;
		hintedSignedIn = hint.signedIn;
	});
	const permissions = $derived(page.data.permissions as Permission[] | undefined);
	const workspaceMenu = $derived<WorkspacePage[]>(
		permissions ? workspacePagesFor(permissions) : workspacePagesNamed(hintedPageNames)
	);
	const currentWorkspacePage = $derived(workspaceMenu.find((item) => isCurrentWorkspacePage(item.link, path)));

	// For someone signed in, a "Your account" group lists the Account pages
	// (src/lib/account-menu.ts). The pages the Worker renders know at once who
	// is signed in; the others wait for the hint.
	const signedIn = $derived(hintedSignedIn || page.data.person !== undefined || page.data.email !== undefined);
	const onAccountPage = $derived(isAccountPath(path));
	const currentAccount = $derived(onAccountPage ? currentAccountPage(path) : undefined);

	// Where the phone menu bar says the reader is, beside the word "Menu".
	const whereLabel = $derived(
		currentItemLabel(currentItems) ??
			outlineTitle ??
			currentSection?.label ??
			(currentWorkspacePage ? `Workspace: ${currentWorkspacePage.label}` : undefined) ??
			(currentAccount ? `Your account: ${currentAccount.label}` : undefined) ??
			(path === '/' ? 'Home' : (pageTitle ?? ''))
	);

	function currentItemLabel(items: OutlineItem[]): string | undefined {
		for (const item of items) {
			if (isCurrentPage(item)) return [item.number, item.label].filter(Boolean).join(' ');
			const inside = currentItemLabel(item.children ?? []);
			if (inside) return inside;
		}
		return undefined;
	}

	// An entry is the page being read when its page says so or its link is this address.
	function isCurrentPage(item: OutlineItem): boolean {
		return Boolean(item.current) || item.link === currentLink;
	}

	function isActive(item: OutlineItem): boolean {
		return item.link.startsWith('#') ? item.link.slice(1) === sidebar.activeHeading : isCurrentPage(item);
	}

	// Entries inside an outline open along the way to where the reader is (src/lib/outline-folding.ts).
	function isItemOpen(item: OutlineItem): boolean {
		return isUnfolded(item, sidebar.itemChoices, isActive);
	}

	function toggleItem(item: OutlineItem): void {
		sidebar.toggleItem(item.link, isItemOpen(item));
	}

	/** Whether a section has something to open: its pages, or the page's own outline. */
	function opens(section: SiteSection): boolean {
		if (!section.built) return false;
		return section === currentSection ? currentItems.length > 0 : Boolean(section.opens && lists[section.link]?.length);
	}

	/** The section being read starts open; the others start shut, until the reader chooses. */
	function isSectionOpen(section: SiteSection): boolean {
		return sidebar.isOpen(section.link, section === currentSection);
	}

	// The reader's choices, read once when the sidebar starts.
	$effect(() => {
		untrack(() => sidebar.restore());
	});

	// A page built ahead of time came without the essays' lists; read them now,
	// before the reader opens them.
	$effect(() => {
		for (const section of siteSections) {
			if (section.built && section.opens && !pageLists[section.link]) untrack(() => sidebar.fetchList(section.link));
		}
	});

	// On a new page: entries open along the way to it again, the phone menu
	// closes, and the menu bar learns the page's title.
	afterNavigate(() => {
		sidebar.resetItems();
		if (narrowMenu) narrowMenu.open = false;
		pageTitle = document.title.replace(/\s·\s[^·]*$/, '') || undefined;
	});

	// Mark the heading being read as the page scrolls (src/lib/active-heading.ts).
	$effect(() => {
		const ids = headingIds(currentItems);
		return followActiveHeading(ids, (id) => (sidebar.activeHeading = id));
	});

	// ---- The wide column ----
	let open = $state(true);
	let wideSidebar: HTMLDetailsElement | undefined = $state();
	let wideNav: HTMLElement | undefined = $state();

	// On wide screens the sidebar scrolls on its own, separately from the page
	// (Trevor, Nov. 22, 2026). It stays in view as the page scrolls, and its
	// height follows the part of the window it can use: below the masthead
	// at the top of the page and above the footer at the end, so its last
	// entries can always be scrolled into view without moving the page.
	// Without scripts it is one window tall.
	$effect(() => {
		const column = wideSidebar?.parentElement;
		const element = wideSidebar;
		if (!element || !column) return;
		let frame = 0;
		const fit = () => {
			frame = 0;
			const area = column.getBoundingClientRect();
			const top = Math.max(0, area.top);
			const bottom = Math.min(window.innerHeight, area.bottom);
			element.style.height = `${Math.max(bottom - top, 0)}px`;
		};
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(fit);
		};
		fit();
		window.addEventListener('scroll', schedule, { passive: true });
		window.addEventListener('resize', schedule);
		const observer = new ResizeObserver(schedule);
		for (const child of column.children) observer.observe(child);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('scroll', schedule);
			window.removeEventListener('resize', schedule);
			observer.disconnect();
			element.style.height = '';
		};
	});

	// Whether the reader hid the column. app.html reads the same setting before
	// the page paints and marks the page, so a hidden column never flashes open.
	$effect(() => {
		try {
			open = localStorage.getItem(sidebarHiddenKey) !== 'true';
		} catch {
			// Storage can be blocked; the sidebar then simply starts open.
		}
	});

	function remember(event: Event) {
		open = (event.currentTarget as HTMLDetailsElement).open;
		if (open) delete document.documentElement.dataset.sidebarHidden;
		else document.documentElement.dataset.sidebarHidden = 'true';
		try {
			localStorage.setItem(sidebarHiddenKey, String(!open));
		} catch {
			// Nothing to remember with; the choice lasts for this page only.
		}
	}

	// Keep the entry being read in sight in the column, scrolling only the
	// column, never the page.
	$effect(() => {
		void sidebar.activeHeading;
		void path;
		const nav = wideNav;
		if (!nav || !open) return;
		tick().then(() => {
			const marked = [...nav.querySelectorAll<HTMLElement>('.entry.active, [aria-current="page"]')].at(-1);
			if (!marked) return;
			const area = nav.getBoundingClientRect();
			const box = marked.getBoundingClientRect();
			const margin = 48;
			let shift = 0;
			if (box.top < area.top + margin) shift = box.top - area.top - margin;
			else if (box.bottom > area.bottom - margin) shift = box.bottom - area.bottom + margin;
			if (shift === 0) return;
			const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
			nav.scrollBy({ top: shift, behavior: reduce ? 'auto' : 'smooth' });
		});
	});

	// ---- The phone menu ----
	let narrowMenu: HTMLDetailsElement | undefined = $state();

	// Choosing a link closes the menu, including a heading on this page.
	function closeOnLink(event: MouseEvent) {
		if ((event.target as HTMLElement).closest('a') && narrowMenu) narrowMenu.open = false;
	}

	function closeOnEscape(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !narrowMenu?.open) return;
		narrowMenu.open = false;
		narrowMenu.querySelector('summary')?.focus();
	}
</script>

{#snippet sections(idSuffix: string)}
	<ul class="sections">
		{#each siteSections as section, index (section.link)}
			{@const current = section === currentSection}
			{@const expandable = opens(section)}
			{@const sectionOpen = expandable && isSectionOpen(section)}
			{@const listId = `sidebar-${current ? 'outline' : 'pages'}-${idSuffix}-${index}`}
			<li class:current data-sidebar-section={section.link}>
				<div class="entry">
					<FoldButton
						size="section"
						controls={expandable ? listId : undefined}
						expanded={sectionOpen}
						name={section.opens ? `Pages in ${section.label}` : `Contents of ${section.label}`}
						onclick={() => sidebar.setOpen(section.link, !sectionOpen)}
					/>
					{#if section.built}
						<a href={section.link} aria-current={current && currentLink === section.link ? 'page' : undefined}>
							{section.label}
						</a>
					{:else}
						<span class="unbuilt">{section.label}<span class="visually-hidden"> (not yet published)</span></span>
					{/if}
				</div>
				{#if current && expandable}
					<div id={listId} class="section-contents" data-sidebar-list hidden={!sectionOpen}>
						{#if outlineTitle}<p class="outline-title">{outlineTitle}</p>{/if}
						<SidebarTree
							items={currentItems}
							listId="{listId}-list"
							isActive={isActive}
							isCurrent={isCurrentPage}
							isOpen={isItemOpen}
							ontoggle={toggleItem}
						/>
					</div>
				{:else if expandable}
					<div id={listId} data-sidebar-list hidden={!sectionOpen}>
						<SidebarTree
							items={lists[section.link]}
							listId="{listId}-list"
							isActive={isActive}
							isCurrent={isCurrentPage}
							isOpen={isItemOpen}
							ontoggle={toggleItem}
						/>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
	<SidebarGroups
		{idSuffix}
		{path}
		{sidebar}
		accountPages={signedIn || onAccountPage ? [...accountPages] : []}
		{currentAccount}
		{workspaceMenu}
		{currentWorkspacePage}
		{followedPage}
	/>
{/snippet}

<!-- Wide screens: a column beside the page that the reader can hide. The
     button that hides it is pinned to the bottom of the column (Trevor, Nov. 23,
     2026); it stays the <summary>, and so the first thing in the column for a
     keyboard or screen reader, because a <summary> must come first. -->
<details class="sidebar-wide no-print" bind:this={wideSidebar} {open} ontoggle={remember}>
	<summary title={open ? undefined : 'Show sidebar'}>
		<span class="toggle">
			<span class="when-open"><PanelLeftClose size={20} aria-hidden="true" /> Hide sidebar</span>
			<span class="when-closed"
				><PanelLeftOpen size={20} aria-hidden="true" /><span class="visually-hidden">Show sidebar</span></span
			>
		</span>
	</summary>
	<nav aria-label="Site" bind:this={wideNav}>
		{@render sections('wide')}
	</nav>
</details>

<!-- Phones and narrow windows: a menu bar under the masthead that opens the same list.
     Choosing a link or pressing Escape closes it. -->
<svelte:window onkeydown={closeOnEscape} />
<details class="sidebar-narrow no-print" bind:this={narrowMenu}>
	<summary>
		<Menu size={20} aria-hidden="true" />
		<span class="menu-word">Menu</span>
		{#if whereLabel}<span class="where">{whereLabel}</span>{/if}
	</summary>
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<nav aria-label="Site" onclick={closeOnLink}>
		{@render sections('narrow')}
	</nav>
</details>

<style>
	.entry {
		display: flex;
		align-items: flex-start;
	}

	.entry > a,
	.entry > .unbuilt {
		flex: 1;
		min-width: 0;
	}

	/* Without scripts nothing can fold, so the section being read shows its contents. */
	:global(:root:not([data-scripts='on'])) .section-contents[hidden] {
		display: block;
	}

	/* ---- Shared list styles ---- */
	nav ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.sections > li > .entry > a,
	.sections > li > .entry > .unbuilt {
		display: flex;
		align-items: center;
		min-height: 2.5rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-control);
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
	}

	.sections > li > .entry > a,
	.sections > li > .entry > .unbuilt {
		padding-left: var(--space-1);
	}

	:global(:root:not([data-scripts='on'])) .sections > li > .entry > a,
	:global(:root:not([data-scripts='on'])) .sections > li > .entry > .unbuilt {
		padding-left: var(--space-3);
	}

	/* Sections whose pages are not published yet: named, not linked. */
	.sections > li > .entry > .unbuilt {
		color: var(--color-ink-muted);
		font-weight: var(--font-weight-regular);
	}

	.sections > li > .entry > a:hover {
		background: var(--color-surface);
		text-decoration: underline;
	}

	.sections > li.current > .entry > a {
		color: var(--color-link);
		font-weight: var(--font-weight-bold);
	}

	.sections > li.current {
		margin: var(--space-1) 0 var(--space-3);
	}

	.outline-title {
		margin: var(--space-2) var(--space-3) var(--space-1);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink-muted);
	}


	summary {
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	/* ---- Wide screens ---- */
	.sidebar-wide {
		display: none;
	}

	@media (min-width: 64rem) {
		/*
		 * The column itself does not scroll. Its links scroll in the space above
		 * a footer row pinned to the bottom of the column, which holds the
		 * button that hides the sidebar, so the button is always in the same
		 * place, however long the outline is. Hidden, the column is a narrow
		 * strip with only the button that shows it again, in the same place, so
		 * the pointer is already on it to undo.
		 */
		.sidebar-wide {
			--sidebar-footer-height: calc(var(--layout-target-minimum) + 2 * var(--space-2) + 1px);
			display: block;
			position: sticky;
			top: 0;
			align-self: start;
			height: 100dvh;
			overflow: hidden;
			border-right: 1px solid var(--color-line);
			box-sizing: border-box;
		}

		.sidebar-wide > nav {
			position: absolute;
			inset: 0 0 var(--sidebar-footer-height);
			overflow-y: auto;
			overscroll-behavior: contain;
			padding: var(--space-4) var(--space-3) var(--space-4);
		}

		/* A column the reader hid stays hidden from the first paint (app.html). */
		:global(:root[data-sidebar-hidden='true']) .sidebar-wide > nav {
			display: none;
		}

		.sidebar-wide > summary {
			position: absolute;
			inset: auto 0 0;
			height: var(--sidebar-footer-height);
			display: flex;
			align-items: center;
			padding: 0 var(--space-3);
			border-top: 1px solid var(--color-line);
			background: var(--color-paper);
			box-sizing: border-box;
		}

		/* The summary is the control; focus shows on the button inside it, in the site's focus colors. */
		.sidebar-wide > summary:focus-visible {
			outline: none;
			background-color: var(--color-paper);
			box-shadow: none;
		}

		.sidebar-wide .toggle {
			display: flex;
			flex: 1;
			align-items: center;
			min-height: var(--layout-target-minimum);
			padding: 0 var(--space-3);
			border-radius: var(--radius-control);
			color: var(--color-ink-muted);
			font-size: var(--font-size-small);
			font-weight: var(--font-weight-semibold);
			transition:
				background-color var(--motion-duration-short) var(--motion-easing-standard),
				color var(--motion-duration-short) var(--motion-easing-standard);
		}

		.sidebar-wide .toggle > span {
			display: inline-flex;
			align-items: center;
			gap: var(--space-3);
		}

		.sidebar-wide .toggle :global(svg) {
			flex: none;
			transition: transform var(--motion-duration-short) var(--motion-easing-standard);
		}

		.sidebar-wide > summary:hover .toggle {
			background: var(--color-surface);
			color: var(--color-ink);
		}

		/* A nudge toward where the column goes: left to hide, right to show. */
		:global(:root:not([data-sidebar-hidden='true'])) .sidebar-wide[open] > summary:hover .toggle :global(svg) {
			transform: translateX(-2px);
		}

		.sidebar-wide:not([open]) > summary:hover .toggle :global(svg),
		:global(:root[data-sidebar-hidden='true']) .sidebar-wide > summary:hover .toggle :global(svg) {
			transform: translateX(2px);
		}

		.sidebar-wide > summary:focus-visible .toggle {
			outline: 3px solid var(--color-focus-ring);
			background-color: var(--color-focus);
			color: var(--focus-text);
			box-shadow: 0 0 0 3px var(--color-focus);
		}

		.sidebar-wide .when-closed {
			display: none !important;
		}

		.sidebar-wide:not([open]) > summary,
		:global(:root[data-sidebar-hidden='true']) .sidebar-wide > summary {
			padding: 0 var(--space-1);
			justify-content: center;
		}

		.sidebar-wide:not([open]) .toggle,
		:global(:root[data-sidebar-hidden='true']) .sidebar-wide .toggle {
			flex: none;
			justify-content: center;
			min-width: var(--layout-target-minimum);
			padding: 0;
		}

		.sidebar-wide:not([open]) .when-open,
		:global(:root[data-sidebar-hidden='true']) .sidebar-wide .when-open {
			display: none !important;
		}

		.sidebar-wide:not([open]) .when-closed,
		:global(:root[data-sidebar-hidden='true']) .sidebar-wide .when-closed {
			display: inline-flex !important;
		}
	}

	/* ---- Narrow screens ---- */
	/* The menu bar stays at the top of the screen as the page scrolls. */
	.sidebar-narrow {
		position: sticky;
		top: 0;
		z-index: 5;
		border-bottom: 1px solid var(--color-line);
		background: var(--color-surface);
	}

	.sidebar-narrow[open] > nav {
		max-height: calc(100dvh - var(--layout-target-minimum));
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.sidebar-narrow > summary {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: 0 clamp(var(--space-4), 3vw, var(--space-7));
		font-weight: var(--font-weight-semibold);
	}

	.sidebar-narrow .where {
		margin-left: var(--space-2);
		padding-left: var(--space-3);
		border-left: 1px solid var(--color-line);
		font-weight: var(--font-weight-regular);
		color: var(--color-ink-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sidebar-narrow > nav {
		padding: 0 clamp(var(--space-4), 3vw, var(--space-7)) var(--space-4);
		background: var(--color-paper);
		border-top: 1px solid var(--color-line);
	}

	.sidebar-narrow .sections > li > .entry > a,
	.sidebar-narrow .sections > li > .entry > .unbuilt {
		min-height: var(--layout-target-minimum);
		align-items: center;
	}

	@media (min-width: 64rem) {
		.sidebar-narrow {
			display: none;
		}
	}
</style>
