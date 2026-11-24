<script lang="ts">
	// The left sidebar, on every page, one column wide (Trevor, Nov. 23, 2026).
	// Outside the sections it lists the site's sections. In a section the
	// section's own panel lies over that list in the same space: its pages and
	// its long list with a filter, with the page being read opened into its own
	// outline, such as the headings of an essay or the parts of a nation's page
	// (sidebar/SectionColumn.svelte, src/lib/sidebar-outline.ts). "All sections"
	// at the top of the panel goes back out to the list of sections, and a caret
	// beside the section there goes back in. The column keeps one width on every
	// page, so the page beside it never moves (Trevor asked why clicking in the
	// sidebar made the page jump, Nov. 23, 2026). The phone menu works the same way.
	//
	// It works without JavaScript: the wide-screen sidebar and the phone menu are
	// each a <details> element, and the current page is marked when the page is
	// built. A script, when it runs, adds the filter and the carets that fold
	// entries, remembers whether the reader hid the sidebar, and marks the
	// heading being read as the page scrolls. On paper the sidebar is not
	// printed.
	//
	// The pieces: what is open (sidebar/sidebar-state.svelte.ts), the second
	// column (sidebar/SectionColumn.svelte), one level of an outline
	// (sidebar/SidebarTree.svelte) and the groups under the sections
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
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Menu from '@lucide/svelte/icons/menu';
	import { accountPages, currentAccountPage, isAccountPath } from '#lib/account-menu.ts';
	import { followActiveHeading, headingIds } from '#lib/active-heading.ts';
	import { isUnfolded } from '#lib/outline-folding.ts';
	import { editingOutline } from '#lib/essays/editing-outline.svelte.ts';
	import { followedPageAddress } from '#lib/page-history.ts';
	import type { Permission } from '#lib/permissions.ts';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';
	import { withSharedLists } from '#lib/section-lists.ts';
	import { composeSectionContents, currentLinkIn, type SectionContents } from '#lib/sidebar-outline.ts';
	import { sectionOf, siteSections, type OutlineItem, type PageOutline, type SiteSection } from '#lib/site-sections.ts';
	import {
		isCurrentWorkspacePage,
		workspacePagesFor,
		workspacePagesNamed,
		type WorkspacePage
	} from '#lib/workspace-menu.ts';
	import FoldButton from './sidebar/FoldButton.svelte';
	import FoldGroup from './sidebar/FoldGroup.svelte';
	import SectionColumn from './sidebar/SectionColumn.svelte';
	import SidebarGroups from './sidebar/SidebarGroups.svelte';
	import YourWork from './sidebar/YourWork.svelte';
	import { SidebarState, sectionsKey } from './sidebar/sidebar-state.svelte.ts';
	import { isSidebarShortcut, restoreSidebarVisibility, sidebarVisibility, toggleSidebar } from './sidebar/sidebar-visibility.svelte.ts';

	const sidebar = new SidebarState();

	const path = $derived(page.url.pathname);
	// Pages built ahead of time cannot read the query while being built.
	const search = $derived(building ? '' : page.url.search);
	// The page the reader is on, when the site records its changes ("Changes to this page").
	const followedPage = $derived(page.error ? undefined : followedPageAddress(path));
	const currentSection = $derived(sectionOf(path));

	// The page's title, for the phone menu bar on pages outside the sections.
	let pageTitle = $state<string | undefined>(undefined);

	// The section being read: its contents (from the root layout), with this page's outline in place.
	// While an essay is edited or commented on, its outline is the draft's, with
	// what changed marked (src/lib/essays/editor-outline.ts), and Your work follows it.
	const editing = $derived(editingOutline.current?.path === path ? editingOutline.current : undefined);
	const publishedOutline = $derived(page.data.outline as PageOutline | undefined);
	const pageOutline = $derived<PageOutline | undefined>(
		editing ? { title: publishedOutline?.title, items: editing.items } : publishedOutline
	);
	const sectionContents = $derived(withSharedLists(page.data.sectionContents as SectionContents | undefined));
	const composed = $derived(
		composeSectionContents(currentSection?.opens ? sectionContents : undefined, pageOutline, path, pageTitle)
	);
	const allItems = $derived([...composed.pages, ...(composed.entries?.items ?? [])]);
	// A published section with something to list has its own panel.
	const hasColumn = $derived(Boolean(currentSection?.built && allItems.length > 0));
	// A section without a list of pages keeps its outline's title above it.
	const outlineTitle = $derived(currentSection?.opens && sectionContents ? undefined : pageOutline?.title);
	const currentLink = $derived(currentLinkIn(allItems, path, search));

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
		currentItemLabel(allItems) ??
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
	// While editing, entries also open along the way to what changed or is in review (essay-editor-mockups/v2-1).
	function isItemOpen(item: OutlineItem): boolean {
		return isUnfolded(item, sidebar.itemChoices, editing ? (entry) => isActive(entry) || Boolean(entry.mark) : isActive);
	}

	// The sections fold like the Workspace and Your account groups, and start
	// open (Trevor, Nov. 23, 2026). A shut list stays shut from the first
	// paint: the script in app.html marks the page, and global.css hides it.
	const sectionsOpen = $derived(sidebar.isOpen(sectionsKey, true));

	// Each section's own pages start open in the section being read, and then as the reader last left them.
	const sectionPagesKey = (section: SiteSection) => `section-${section.link}`;
	const sectionPagesOpen = (section: SiteSection) => sidebar.isOpen(sectionPagesKey(section), section === currentSection);

	function toggleSections(): void {
		const open = !sectionsOpen;
		sidebar.setOpen(sectionsKey, open);
		if (open) delete document.documentElement.dataset.sidebarSectionsShut;
		else document.documentElement.dataset.sidebarSectionsShut = 'true';
	}

	function toggleItem(item: OutlineItem): void {
		sidebar.toggleItem(item.link, isItemOpen(item));
	}

	// The reader's choices, read once when the sidebar starts.
	$effect(() => {
		untrack(() => sidebar.restore());
	});

	// On a new page: entries open along the way to it again, the phone menu
	// closes and will open on the section's pages, and the menu bar learns the
	// page's title.
	afterNavigate(() => {
		sidebar.resetItems();
		phoneView = 'section';
		wideView = 'section';
		if (narrowMenu) narrowMenu.open = false;
		pageTitle = document.title.replace(/\s·\s[^·]*$/, '') || undefined;
	});

	// Mark the heading being read as the page scrolls (src/lib/active-heading.ts).
	$effect(() => {
		const ids = headingIds(allItems);
		return followActiveHeading(ids, (id) => (sidebar.activeHeading = id));
	});

	// ---- The wide column ----
	// Inside a section the column shows the section's panel; "All sections" shows the list of sections.
	let wideView = $state<'section' | 'sections'>('section');
	// Which way the column last moved, so the panel slides in from the side it comes from.
	let wideMove = $state<'in' | 'out' | undefined>(undefined);

	function showSections(): void {
		wideView = 'sections';
		wideMove = 'out';
	}

	function showSection(): void {
		wideView = 'section';
		wideMove = 'in';
		placedPath = undefined;
	}
	let wideSidebar: HTMLElement | undefined = $state();
	let wideColumn: HTMLElement | undefined = $state();

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

	// Whether the reader hid the sidebar, with the masthead's button or Ctrl+\
	// (sidebar/sidebar-visibility.svelte.ts). app.html reads the same setting
	// before the page paints and marks the page, so a hidden sidebar never flashes open.
	$effect(() => {
		untrack(() => restoreSidebarVisibility());
	});

	function toggleFromKey(event: KeyboardEvent): void {
		if (!isSidebarShortcut(event) || event.defaultPrevented) return;
		event.preventDefault();
		toggleSidebar();
	}

	// Keep the entry being read in sight in the second column, scrolling only
	// the column, never the page. On a new page it is placed a third of the way
	// down at once, since a long list such as the nations can be far to go;
	// as the reader scrolls the page, the column follows smoothly.
	let placedPath: string | undefined;
	$effect(() => {
		void sidebar.activeHeading;
		const here = path;
		const nav = wideColumn;
		if (!nav || !sidebarVisibility.shown) return;
		tick().then(() => {
			const marked = [...nav.querySelectorAll<HTMLElement>('.entry.active, [aria-current="page"]')].at(-1);
			if (!marked) return;
			const area = nav.getBoundingClientRect();
			const box = marked.getBoundingClientRect();
			if (placedPath !== here) {
				placedPath = here;
				if (box.top < area.top || box.bottom > area.bottom) nav.scrollTop += box.top - area.top - area.height / 3;
				return;
			}
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
	// Inside a section the menu opens on its pages; a switch shows all the sections.
	let phoneView = $state<'section' | 'sections'>('section');
	let menuOpened = $state(false);

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
	<!-- On phones the menu's "All sections" switch shows them, so they do not fold there. -->
	{@const folds = idSuffix === 'wide'}
	<FoldGroup
		id="sidebar-sections-{idSuffix}"
		title="Sections"
		open={sectionsOpen}
		{folds}
		listClass="sections"
		ontoggle={toggleSections}
	>
		{#each siteSections as section, sectionIndex (section.link)}
			{@const current = section === currentSection}
			{@const pagesId = `sidebar-section-pages-${idSuffix}-${sectionIndex}`}
			{@const pagesOpen = sectionPagesOpen(section)}
			<li class="section" class:current>
				<div class="section-row">
					<!-- A section's own pages fold open under it, as the Workspace's categories do (Trevor, Nov. 24, 2026). -->
					<FoldButton
						controls={section.built && section.pages?.length ? pagesId : undefined}
						expanded={pagesOpen}
						name="Pages in {section.label}"
						onclick={() => sidebar.setOpen(sectionPagesKey(section), !pagesOpen)}
					/>
					{#if section.built}
						<a href={section.link} aria-current={current && currentLink === section.link ? 'page' : undefined}>
							{section.label}
						</a>
						{#if current && hasColumn && idSuffix === 'wide'}
							<button type="button" class="drill needs-scripts" title="Everything in {section.label}" onclick={showSection}>
								<ChevronRight size={18} aria-hidden="true" />
								<span class="visually-hidden">Everything in {section.label}</span>
							</button>
						{/if}
					{:else}
						<span class="unbuilt">{section.label}<span class="visually-hidden"> (not yet published)</span></span>
					{/if}
				</div>
				{#if section.built && section.pages?.length}
					<ul class="section-pages" id={pagesId} hidden={!pagesOpen}>
						{#each section.pages as item (item.link)}
							<li>
								<a href={item.link} aria-current={current && currentLink === item.link ? 'page' : undefined}>{item.label}</a>
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</FoldGroup>
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

{#snippet column(idSuffix: string)}
	{#if currentSection}
		<SectionColumn
			{idSuffix}
			section={currentSection}
			contents={composed}
			{outlineTitle}
			sectionIsCurrent={currentLink === currentSection.link}
			{isActive}
			isCurrent={isCurrentPage}
			isOpen={isItemOpen}
			ontoggle={toggleItem}
		/>
	{/if}
{/snippet}

<!-- Wide screens: a column beside the page. The reader hides and shows it with
     the button at the top left of the masthead, beside the site's name, or with
     Ctrl+\ (Trevor, Nov. 23, 2026); hidden, it is gone and the page takes the
     whole width. Without scripts it always shows. -->
<div class="sidebar-wide no-print" id="site-sidebar" bind:this={wideSidebar}>
	<div class="panes">
	<nav
		aria-label="Site"
		class="sections-column"
		class:slide-back={wideMove === 'out'}
		hidden={hasColumn && wideView === 'section'}
	>
		{@render sections('wide')}
	</nav>
	{#if hasColumn}
		<nav
			aria-label="Pages in {currentSection?.label}"
			class="pages-column"
			class:slide-in={wideMove === 'in'}
			hidden={wideView !== 'section'}
		>
			<button type="button" class="back needs-scripts" onclick={showSections}>
				<ChevronLeft size={18} aria-hidden="true" />
				All sections
			</button>
			<!-- Only the list scrolls, so "All sections" stays at the top and nothing slides under it. -->
			<div class="pages-scroll" bind:this={wideColumn}>
				{@render column('wide')}
				{#if editing?.work}<YourWork work={editing.work} {path} />{/if}
			</div>
		</nav>
	{/if}
	</div>
</div>

<!-- Phones and narrow windows: a menu bar under the masthead that opens the same list.
     Choosing a link or pressing Escape closes it. -->
<svelte:window
	onkeydown={(event) => {
		toggleFromKey(event);
		closeOnEscape(event);
	}}
/>
<details class="sidebar-narrow no-print" bind:this={narrowMenu} ontoggle={() => (menuOpened ||= Boolean(narrowMenu?.open))}>
	<summary>
		<Menu size={20} aria-hidden="true" />
		<span class="menu-word">Menu</span>
		{#if whereLabel}<span class="where">{whereLabel}</span>{/if}
	</summary>
	<!-- Closes the menu once a link inside is followed; Enter on a link fires the same click, so keys need nothing more. -->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<nav aria-label="Site" onclick={closeOnLink}>
		{#if hasColumn}
			<div class="switch needs-scripts">
				<button type="button" aria-pressed={phoneView === 'section'} onclick={() => (phoneView = 'section')}>
					{currentSection?.label}
				</button>
				<button type="button" aria-pressed={phoneView === 'sections'} onclick={() => (phoneView = 'sections')}>
					All sections
				</button>
			</div>
			<div class="phone-part" hidden={menuOpened && phoneView !== 'sections'}>
				{@render sections('narrow')}
			</div>
			<!-- Drawn when the menu first opens, so a long list is not in the page twice. -->
			{#if menuOpened}
				<div class="phone-part phone-column" hidden={phoneView !== 'section'}>
					{@render column('narrow')}
				</div>
			{/if}
		{:else}
			{@render sections('narrow')}
		{/if}
	</nav>
</details>

<style>
	/* ---- The sections ---- */
	/* Their heading and links are the shared folding group's (sidebar/FoldGroup.svelte). */

	/* Shut by the reader on an earlier page, before the script takes over. */
	:global(:root[data-sidebar-sections-shut='true']) .sections-column :global(.sections) {
		display: none;
	}

	/* A section's row: its caret, its link and, in the section being read, the way into its panel. */
	.section-row {
		display: flex;
		align-items: center;
	}

	.section-row :global(.fold) {
		margin-top: 0;
	}

	.section-row > a,
	.section-row > .unbuilt {
		flex: 1;
		display: flex;
		align-items: center;
		min-height: 2.5rem;
		padding: 0 var(--space-3) 0 var(--space-1);
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
	}

	/* Sections whose pages are not published yet: named, not linked. */
	.section-row > .unbuilt {
		color: var(--color-ink-muted);
		font-weight: var(--font-weight-regular);
	}

	.section-row > a:hover,
	.section-pages a:hover {
		background: var(--color-surface);
		text-decoration: underline;
	}

	/* The section being read: an orange bar across its row, and the link color. */
	.section.current > .section-row {
		border-left: 3px solid var(--color-action);
		background: var(--color-surface);
	}

	.section.current > .section-row > a {
		color: var(--color-link);
		font-weight: var(--font-weight-bold);
	}

	/* A section's own pages: smaller and muted, under its name. */
	.section-pages {
		list-style: none;
		margin: 0 0 var(--space-1) 1.75rem;
		padding: 0;
	}

	.section-pages a {
		display: flex;
		align-items: center;
		min-height: 2.25rem;
		padding: 0 var(--space-3) 0 var(--space-1);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
		text-decoration: none;
	}

	.section-pages a[aria-current='page'] {
		border-left: 3px solid var(--color-action);
		background: var(--color-surface);
		color: var(--color-link);
		font-weight: var(--font-weight-bold);
	}

	/* Without scripts nothing folds, so every section's pages show. */
	:global(:root:not([data-scripts='on'])) .section-pages[hidden] {
		display: block;
	}

	:global(:root:not([data-scripts='on'])) .section-row > a,
	:global(:root:not([data-scripts='on'])) .section-row > .unbuilt {
		padding-left: var(--space-3);
	}

	:global(.sidebar-narrow) .section-row > a,
	:global(.sidebar-narrow) .section-row > .unbuilt,
	:global(.sidebar-narrow) .section-pages a {
		min-height: var(--layout-target-minimum);
	}

	/* Back into the section's panel, from the list of sections, and back out of it. */
	.drill,
	.back {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: var(--layout-target-minimum);
		border: 0;
		border-radius: var(--radius-control);
		background: none;
		color: var(--color-ink-muted);
		font: inherit;
		cursor: pointer;
	}

	.drill {
		min-width: var(--layout-target-minimum);
	}

	.back {
		flex: none;
		justify-content: flex-start;
		gap: var(--space-1);
		margin: 0 0 var(--space-2);
		padding: 0 var(--space-3) 0 var(--space-1);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
	}

	.drill:hover,
	.back:hover {
		background: var(--color-surface);
		color: var(--color-ink);
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
		 * The column stays in view as the page scrolls, and its lists scroll on
		 * their own. Its button is in the masthead (SiteHeader.svelte).
		 */
		.sidebar-wide {
			display: block;
			position: sticky;
			/* Below the masthead while it stays at the top of the screen for editing (SiteHeader.svelte). */
			top: var(--masthead-stuck, 0px);
			align-self: start;
			height: calc(100dvh - var(--masthead-stuck, 0px));
			overflow: hidden;
			border-right: 1px solid var(--color-line);
			box-sizing: border-box;
		}

		/* The list of sections, or the section's panel over it, in the same space; each scrolls on its own. */
		.panes {
			position: absolute;
			inset: 0;
			overflow: hidden;
		}

		.panes > nav {
			position: absolute;
			inset: 0;
			overflow-y: auto;
			overscroll-behavior: contain;
			padding: var(--space-4) var(--space-3) var(--space-4);
			box-sizing: border-box;
		}

		/* In the section's panel only the list under "All sections" scrolls. */
		.panes > .pages-column {
			display: flex;
			flex-direction: column;
			overflow: hidden;
			padding-bottom: 0;
		}

		.pages-column[hidden] {
			display: none;
		}

		.pages-scroll {
			flex: 1;
			min-height: 0;
			overflow-y: auto;
			overscroll-behavior: contain;
			margin: 0 calc(-1 * var(--space-3));
			padding: 0 var(--space-3) var(--space-4);
		}

		/* Going in, the panel slides over the sections from the right; going out, the sections come back from the left. */
		.panes > .slide-in {
			animation: sidebar-slide-in var(--motion-duration-medium) var(--motion-easing-standard);
		}

		.panes > .slide-back {
			animation: sidebar-slide-back var(--motion-duration-medium) var(--motion-easing-standard);
		}

		@keyframes sidebar-slide-in {
			from {
				transform: translateX(100%);
			}
		}

		@keyframes sidebar-slide-back {
			from {
				transform: translateX(-30%);
				opacity: 0;
			}
		}

		/* Without scripts nothing can go in or out, so the sections and the section's panel show one after the other. */
		:global(:root:not([data-scripts='on'])) .panes {
			overflow-y: auto;
		}

		:global(:root:not([data-scripts='on'])) .panes > nav,
		:global(:root:not([data-scripts='on'])) .pages-scroll {
			position: static;
			display: block;
			overflow: visible;
		}

		/* A sidebar the reader hid stays hidden from the first paint (app.html). */
		:global(:root[data-sidebar-hidden='true']) .sidebar-wide {
			display: none;
		}
	}

	/* ---- Narrow screens ---- */
	/* The menu bar stays at the top of the screen as the page scrolls. */
	.sidebar-narrow {
		position: sticky;
		top: var(--masthead-stuck, 0px);
		z-index: 5;
		border-bottom: 1px solid var(--color-line);
		background: var(--color-surface);
	}

	.sidebar-narrow[open] > nav {
		max-height: calc(100dvh - var(--layout-target-minimum) - var(--masthead-stuck, 0px));
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

	/* In a section the menu shows its pages or all the sections, one at a time. */
	.sidebar-narrow .switch {
		display: flex;
		gap: var(--space-1);
		margin: var(--space-3) 0;
		padding: var(--space-1);
		border-radius: var(--radius-control);
		background: var(--color-surface);
	}

	.sidebar-narrow .switch button {
		flex: 1;
		min-height: var(--layout-target-minimum);
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink-muted);
		font: inherit;
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	.sidebar-narrow .switch button[aria-pressed='true'] {
		background: var(--color-paper);
		color: var(--color-ink);
		box-shadow: 0 0 0 1px var(--color-line);
	}

	/* Without scripts there is no switch, so both lists show, the sections first. */
	:global(:root:not([data-scripts='on'])) .phone-part[hidden] {
		display: block;
	}

	:global(:root:not([data-scripts='on'])) .phone-column {
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-line);
	}

	@media (min-width: 64rem) {
		.sidebar-narrow {
			display: none;
		}
	}
</style>
