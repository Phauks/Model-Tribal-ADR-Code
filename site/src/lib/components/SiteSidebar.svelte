<script lang="ts">
	// The side column, on every page, and the phone strip under the masthead.
	//
	// Trevor chose on Nov. 27, 2026 to put the site's six sections in a row
	// under the masthead (SectionBar.svelte) and to keep this column to where
	// the reader is (design/navigation-models, model C, mockups/C-*.png):
	//
	// - the pages the page belongs with: a nation's own pages under "‹ Nations"
	//   and its name, or the essays of Foundations (page.data.family,
	//   src/lib/server/section-contents.ts, src/lib/nation-family.ts);
	// - then "On this page": the page's headings, the one being read marked as
	//   the page scrolls (src/lib/active-heading.ts);
	// - then "Changes to This Page", where the site records the page's changes
	//   (Trevor, Nov. 23, 2026), and Your work while an essay is edited.
	//
	// The column navigates only the pages beneath the page being read and
	// never repeats the top navigation (Trevor, Nov. 27, 2026: "left nav
	// becomes navigation for pages beneath, it should not be double nav for
	// what is already in the top nav"). So it does not list a section's menu
	// (the section bar has it), the Account pages (the profile button's menu
	// has them) or the Workspace's pages (the Workspace tab has them), and a
	// nation's pages have no "‹ Nations" link (the section bar's Nations and
	// the breadcrumbs go there). Where nothing is left to show, as on the
	// home page, there is no column and the page takes the whole width
	// (Trevor, Nov. 27, 2026: "the home tribal law page should not have a
	// left sidebar"); +layout.svelte reads the column's `empty` class.
	//
	// Long lists, such as every nation, are no longer in the column: the
	// Nations menu has a box to go straight to a nation.
	//
	// On phones a strip under the masthead holds two buttons: "Menu", which
	// opens the sections as a sheet over the page, the section being read open
	// and the Workspace after them for people with access,
	// and the name of where the reader is, which opens this column as a sheet.
	// Both are <details> elements, so they work without JavaScript; with it a
	// sheet closes on Escape and when a link is followed.
	//
	// On wide screens the masthead's hamburger, or Ctrl+\, hides the column
	// (sidebar/sidebar-visibility.svelte.ts). On paper it is not printed.
	import { tick, untrack } from 'svelte';
	import { building } from '$app/env';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import Briefcase from '@lucide/svelte/icons/briefcase';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import FileClock from '@lucide/svelte/icons/file-clock';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import { followActiveHeading, headingIds } from '#lib/active-heading.ts';
	import { isUnfolded } from '#lib/outline-folding.ts';
	import { editingOutline } from '#lib/essays/editing-outline.svelte.ts';
	import { followedPageAddress, pageChangesLink } from '#lib/page-history.ts';
	import { personalSectionOf, workspaceSection } from '#lib/personal-navigation.ts';
	import { currentNavigationLink, navigationSectionOf, navigationSections, type NavigationCounts, type NavigationSection } from '#lib/site-navigation.ts';
	import type { OutlineItem, PageFamily, PageOutline } from '#lib/site-sections.ts';
	import { WorkspaceAccess } from '#lib/workspace-access.svelte.ts';
	import CountBadge from './CountBadge.svelte';
	import CodeOutline from './sidebar/CodeOutline.svelte';
	import SidebarTree from './sidebar/SidebarTree.svelte';
	import YourWork from './sidebar/YourWork.svelte';
	import { SidebarState } from './sidebar/sidebar-state.svelte.ts';
	import { isSidebarShortcut, restoreSidebarVisibility, sidebarVisibility, toggleSidebar } from './sidebar/sidebar-visibility.svelte.ts';

	const sidebar = new SidebarState();

	const path = $derived(page.url.pathname);
	// Pages built ahead of time cannot read the query while being built.
	const search = $derived(building ? '' : page.url.search);
	const counts = $derived(page.data.navigationCounts as NavigationCounts | undefined);
	// The page the reader is on, when the site records its changes: "Changes to This Page" ends the column.
	// On the page's own Changes view the link stays, marked as where the reader is (src/lib/server/page-changes.ts).
	const changesOf = $derived(page.error ? undefined : (page.data.historyOf as string | undefined));
	const followedPage = $derived(page.error ? undefined : (changesOf ?? followedPageAddress(path)));

	// The page's title, for the phone strip on pages with nothing else to name them.
	let pageTitle = $state<string | undefined>(undefined);

	// ---- Where the reader is ----
	const family = $derived(page.data.family as PageFamily | undefined);
	const currentSection = $derived(navigationSectionOf(path));
	// The Workspace, for people with access to it, and the Account pages, as places of their own, for the phone Menu sheet.
	const access = new WorkspaceAccess();
	const workspace = $derived(workspaceSection(access.pages));
	const personalSection = $derived(currentSection ? undefined : personalSectionOf(path, workspace));

	// The page's own headings. While an essay is edited or commented on, its
	// outline is the draft's, with what changed marked (src/lib/essays/editor-outline.ts).
	const editing = $derived(editingOutline.current?.path === path ? editingOutline.current : undefined);
	const publishedOutline = $derived(page.data.outline as PageOutline | undefined);
	const outlineItems = $derived<OutlineItem[]>(editing ? editing.items : (publishedOutline?.items ?? []));
	// An outline of the page's headings is "On this page", a name only screen readers hear (Trevor, Nov. 27, 2026: "don't need to say On This Page"); one that lists other pages, such as the back matter's, is headed "Contents".
	const outlineOfHeadings = $derived(outlineItems.every((item) => item.link.startsWith('#')));
	const outlineLabel = $derived(outlineOfHeadings ? 'On This Page' : 'Contents');

	// Whether the wide column has anything to show. The home page never has a column.
	const columnEmpty = $derived(path === '/' || !(family || outlineItems.length > 0 || followedPage || editing?.work));

	// What the phone strip names beside "Menu".
	const localTitle = $derived(
		family?.short ??
			family?.title ??
			publishedOutline?.title ??
			(path === '/' ? 'Home' : (pageTitle ?? ''))
	);

	// ---- The headings ----
	function isCurrentHeading(_item: OutlineItem): boolean {
		return false;
	}

	function isActive(item: OutlineItem): boolean {
		return item.link.startsWith('#') ? item.link.slice(1) === sidebar.activeHeading : item.link === path;
	}

	// Headings open along the way to the one being read (src/lib/outline-folding.ts);
	// while editing, also along the way to what changed or is in review.
	function isItemOpen(item: OutlineItem): boolean {
		return isUnfolded(item, sidebar.itemChoices, editing ? (entry) => isActive(entry) || Boolean(entry.mark) : isActive);
	}

	function toggleItem(item: OutlineItem): void {
		sidebar.toggleItem(item.link, isItemOpen(item));
	}

	// The reader's choices, read once when the column starts.
	$effect(() => {
		untrack(() => sidebar.restore());
	});

	// On a new page: headings open along the way to it again, the phone
	// sheets close, and the strip learns the page's title.
	afterNavigate(() => {
		sidebar.resetItems();
		if (menuSheet) menuSheet.open = false;
		if (localSheet) localSheet.open = false;
		pageTitle = document.title.replace(/\s·\s[^·]*$/, '') || undefined;
	});

	// Mark the heading being read as the page scrolls (src/lib/active-heading.ts).
	$effect(() => {
		const ids = headingIds(outlineItems);
		return followActiveHeading(ids, (id) => (sidebar.activeHeading = id));
	});

	// ---- The wide column ----
	let wideSidebar: HTMLElement | undefined = $state();
	let wideColumn: HTMLElement | undefined = $state();

	// On wide screens the column scrolls on its own, separately from the page
	// (Trevor, Nov. 22, 2026). It stays in view as the page scrolls, and its
	// height follows the part of the window it can use: below the masthead
	// and the section bar at the top of the page and above the footer at the
	// end. Without scripts it is one window tall.
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

	// Whether the reader hid the column, with the masthead's button or Ctrl+\
	// (sidebar/sidebar-visibility.svelte.ts). app.html reads the same setting
	// before the page paints, so a hidden column never flashes open.
	$effect(() => {
		untrack(() => restoreSidebarVisibility());
	});

	function toggleFromKey(event: KeyboardEvent): void {
		if (!isSidebarShortcut(event) || event.defaultPrevented) return;
		event.preventDefault();
		toggleSidebar();
	}

	// Keep the heading being read in sight in the column, scrolling only the column, never the page.
	$effect(() => {
		void sidebar.activeHeading;
		const nav = wideColumn;
		if (!nav || !sidebarVisibility.shown) return;
		tick().then(() => {
			const marked = nav.querySelector<HTMLElement>('.entry.active');
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

	// ---- The phone sheets ----
	let menuSheet: HTMLDetailsElement | undefined = $state();
	let localSheet: HTMLDetailsElement | undefined = $state();

	// Choosing a link closes the sheet, including a heading on this page.
	function closeOnLink(event: MouseEvent) {
		if (!(event.target as HTMLElement).closest('a')) return;
		if (menuSheet) menuSheet.open = false;
		if (localSheet) localSheet.open = false;
	}

	function closeOnEscape(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		for (const sheet of [menuSheet, localSheet]) {
			if (!sheet?.open) continue;
			sheet.open = false;
			sheet.querySelector('summary')?.focus();
		}
	}

	// One sheet at a time.
	function opened(sheet: HTMLDetailsElement | undefined) {
		if (!sheet?.open) return;
		for (const other of [menuSheet, localSheet]) if (other && other !== sheet) other.open = false;
	}
</script>

{#snippet local(idSuffix: string)}
	{#if family}
		<!-- The pages the page belongs with, such as a nation's own pages. -->
		<div class="local-head">
			{#if family.link}
				<a class="local-title" href={family.link} aria-current={family.link === path ? 'page' : undefined}>{family.title}</a>
			{:else}
				<p class="local-title">{family.title}</p>
			{/if}
		</div>
		{#if family.tree}<CodeOutline tree={family.tree} {idSuffix} />{/if}
		<!-- The page being read is named but not linked, since a link to it would go nowhere (Trevor, Nov. 27, 2026). A list holding only that page is left out: the title above already names it. -->
		{#if family.pages.some((item) => item.link !== path)}
			<ul class="local-pages">
				{#each family.pages as item (item.link)}
					{#if item.link === path}
						<li>
							<span class="local-link" aria-current="page">
								<span>{#if item.number}<span class="number">{item.number}</span>{' '}{/if}{item.label}</span>
								{#if item.count}<CountBadge count={item.count} />{/if}
							</span>
						</li>
					{:else}
						<li>
							<a class="local-link" href={item.link}>
								<span>{#if item.number}<span class="number">{item.number}</span>{' '}{/if}{item.label}</span>
								{#if item.count}<CountBadge count={item.count} />{/if}
							</a>
						</li>
					{/if}
				{/each}
			</ul>
		{/if}
	{:else if publishedOutline?.title && outlineItems.length > 0}
		<div class="local-head"><p class="local-title">{publishedOutline.title}</p></div>
	{/if}
	{#if outlineItems.length > 0}
		<p class="local-label on-this-page" class:visually-hidden={outlineOfHeadings} id="sidebar-on-this-page-{idSuffix}">{outlineLabel}</p>
		<div class="headings" class:unlabeled={outlineOfHeadings}>
			<SidebarTree
				items={outlineItems}
				listIdentifier="sidebar-outline-{idSuffix}"
				{isActive}
				isCurrent={isCurrentHeading}
				isOpen={isItemOpen}
				ontoggle={toggleItem}
			/>
		</div>
	{/if}
	{#if followedPage}
		<!-- Opens the history of the page the reader is on, not every page's (Trevor, Nov. 23, 2026), in the
		     page's own place, so this column stays (Trevor, Nov. 27, 2026, design/page-changes-in-page, option B). -->
		<p class="page-changes">
			<a href={pageChangesLink(followedPage)} aria-current={changesOf ? 'page' : undefined}
				><FileClock size={18} aria-hidden="true" />Changes to This Page</a
			>
		</p>
	{/if}
{/snippet}

<!-- Wide screens: a column beside the page. The reader hides and shows it with
     the hamburger at the top left of the masthead, or with Ctrl+\ (Trevor,
     Nov. 23, 2026); hidden, the page takes the whole width. Without scripts it
     always shows. -->
<div class="sidebar-wide no-print" class:empty={columnEmpty} id="site-sidebar" bind:this={wideSidebar}>
	<nav aria-label="Where you are" class="local-column" bind:this={wideColumn}>
		{@render local('wide')}
		{#if editing?.work}<YourWork work={editing.work} {path} />{/if}
	</nav>
</div>

<svelte:window
	onkeydown={(event) => {
		toggleFromKey(event);
		closeOnEscape(event);
	}}
/>

<!-- Phones and narrow windows: a strip under the masthead with Menu and where the reader is. -->
<!-- A followed link closes its sheet; Enter on a link fires the same click, so keys need nothing more. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="sidebar-narrow no-print" onclick={closeOnLink}>
	<details class="sheet menu-sheet" bind:this={menuSheet} ontoggle={() => opened(menuSheet)}>
		<summary>
			<Menu size={22} aria-hidden="true" class="when-shut" />
			<span class="sheet-word">Menu</span>
			<X size={24} aria-hidden="true" class="when-open" />
			<span class="visually-hidden when-open">Close</span>
		</summary>
		<nav aria-label="Sections" class="sheet-body">
			<ul class="phone-sections">
				{#each navigationSections as section (section.key)}
					{@render phoneSection(section)}
				{/each}
				{#if workspace}{@render phoneSection(workspace)}{/if}
			</ul>
		</nav>
	</details>
	{#if family || outlineItems.length > 0}
		<details class="sheet local-sheet" bind:this={localSheet} ontoggle={() => opened(localSheet)}>
			<summary>
				<span class="sheet-word where">{localTitle}</span>
				<ChevronDown size={20} aria-hidden="true" class="when-shut" />
				<X size={24} aria-hidden="true" class="when-open" />
				<span class="visually-hidden when-open">Close</span>
			</summary>
			<nav aria-label="Where you are" class="sheet-body local-column">
				{@render local('narrow')}
			</nav>
		</details>
	{:else if localTitle}
		<span class="where plain">{localTitle}</span>
	{/if}
</div>

{#snippet phoneSection(section: NavigationSection)}
	{@const current = section === (currentSection ?? personalSection)}
	{@const sectionLink = currentNavigationLink(section, path, search)}
	<li class:personal={section === workspace} class:linked={!!section.home}>
		<!-- The name goes to the section's own page; the chevron beside it opens the section's groups (Trevor, Nov. 27, 2026: no "All of …" link). -->
		{#if section.home}
			<a class="phone-name" class:current href={section.home} aria-current={section.home === path ? 'page' : current ? 'true' : undefined}
				><span class:personal-label={section === workspace}>{#if section === workspace}<Briefcase size={20} aria-hidden="true" />{/if}{section.label}</span></a
			>
		{/if}
		<details name="phone-section" open={current}>
			<summary class:current={current && !section.home} class:toggle={!!section.home}>
				{#if section.home}
					<span class="visually-hidden">{section.label} pages</span>
				{:else}
					<span class:personal-label={section === workspace}
						>{#if section === workspace}<Briefcase size={20} aria-hidden="true" />{/if}{section.label}{#if current}<span class="visually-hidden"> (the section you are in)</span>{/if}</span
					>
				{/if}
				<ChevronDown size={20} aria-hidden="true" />
			</summary>
			<div class="phone-groups">
				{#each section.groups as group (group.title)}
					{#if group.title}<p class="local-label">{group.title}</p>{/if}
					<ul>
						{#each group.links as item (item.link)}
							<li>
								{#if item.soon}
									<span class="soon">{item.label} <span class="soon-note">soon</span></span>
								{:else}
									<a href={item.link} aria-current={item === sectionLink ? 'page' : undefined}>{item.label}</a
									>{#if item.count && counts?.[item.count]}<CountBadge count={counts[item.count]} />{/if}
								{/if}
							</li>
						{/each}
					</ul>
				{/each}
			</div>
		</details>
	</li>
{/snippet}

<style>
	/*
	 * Nesting in the page's headings (sidebar/SidebarTree.svelte): a heading
	 * under another starts one step to the right, with no guide line
	 * (Trevor, Nov. 27, 2026, design/nation-column-restyle).
	 */
	.sidebar-wide,
	.sidebar-narrow {
		--sidebar-step: 1rem;
	}

	summary {
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	/* ---- Where the reader is (both the wide column and the phone sheet) ---- */
	.local-head {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
		margin: 0 0 var(--space-2);
	}


	.local-title {
		margin: 0;
		color: var(--color-ink);
		font-size: 1.15rem;
		font-weight: var(--font-weight-bold);
		line-height: 1.3;
		text-decoration: none;
	}

	a.local-title:hover {
		text-decoration: underline;
	}

	.local-label {
		margin: var(--space-4) 0 var(--space-2);
		color: var(--color-ink-muted);
		font-size: 0.78rem;
		font-weight: var(--font-weight-bold);
		letter-spacing: var(--font-letter-spacing-wide);
		text-transform: uppercase;
	}

	/* The page's own history, after its headings, with a rule above it. */
	.page-changes {
		margin: var(--space-4) 0 0;
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}

	.page-changes a {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.5rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-control);
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
	}

	.page-changes a:hover {
		background: var(--color-surface);
		text-decoration: underline;
	}

	/* On the page's Changes view: marked like the page being read in the list above. */
	.page-changes a[aria-current='page'] {
		border-left: 3px solid var(--color-action);
		border-radius: 0 var(--radius-control) var(--radius-control) 0;
		padding-left: calc(var(--space-3) - 3px);
		background: var(--color-surface);
		font-weight: var(--font-weight-bold);
	}

	.sidebar-narrow .page-changes a {
		min-height: var(--layout-target-minimum);
	}

	.local-pages {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.local-link {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0; /* The badge keeps its own space from the label. */
		min-height: 2.25rem;
		margin-left: calc(-1 * var(--space-3) + 3px);
		padding: 0.2rem var(--space-3) 0.2rem calc(var(--space-3) - 3px);
		border-left: 3px solid transparent;
		border-radius: 0 var(--radius-control) var(--radius-control) 0;
		box-sizing: border-box;
		color: var(--color-ink);
		text-decoration: none;
		line-height: 1.35;
	}

	a.local-link:hover {
		background: var(--color-surface);
		text-decoration: underline;
	}

	/* The page being read: an orange bar and the surface behind it. */
	.local-link[aria-current='page'] {
		border-left-color: var(--color-action);
		background: var(--color-surface);
		font-weight: var(--font-weight-bold);
	}

	/* A page under one of the links, such as one chart under Data and charts. */
	.number {
		font-variant-numeric: tabular-nums;
		color: var(--color-ink-muted);
	}

	.soon {
		color: var(--color-ink-muted);
	}

	.soon-note {
		font-size: var(--font-size-small);
		font-style: italic;
	}

	/* The page's headings: their text lines up with the pages above them, and the one being read is marked as a page is. */
	.headings {
		font-size: 0.9rem;
	}

	/* With no label above them, a gap sets the headings apart from the pages. */
	.headings.unlabeled {
		margin-top: var(--space-4);
	}

	/* ---- Wide screens ---- */
	.sidebar-wide {
		display: none;
	}

	@media (min-width: 64rem) {
		/* The column stays in view as the page scrolls, and scrolls on its own. */
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

		.sidebar-wide > .local-column {
			height: 100%;
			overflow-y: auto;
			overscroll-behavior: contain;
			padding: 1.1rem var(--space-3) var(--space-6) 1.5rem;
			box-sizing: border-box;
			font-size: 0.95rem;
		}

		/* The headings sit closer together than the pages, as in the mockup. */
		.local-column .headings :global(a) {
			padding-top: 0.2rem;
			padding-bottom: 0.2rem;
		}

		/* A column the reader hid stays hidden from the first paint (app.html). */
		:global(:root[data-sidebar-hidden='true']) .sidebar-wide,
		.sidebar-wide.empty {
			display: none;
		}
	}

	/* ---- Narrow screens: the strip and its sheets ---- */
	.sidebar-narrow {
		position: sticky;
		top: var(--masthead-stuck, 0px);
		z-index: 5;
		display: flex;
		align-items: stretch;
		min-height: var(--layout-target-minimum);
		border-bottom: 1px solid var(--color-line);
		background: var(--color-surface);
	}

	@media (min-width: 64rem) {
		.sidebar-narrow {
			display: none;
		}
	}

	.sheet > summary {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		height: 100%;
		box-sizing: border-box;
		padding: 0 var(--space-4);
		font-weight: var(--font-weight-semibold);
	}

	.menu-sheet {
		flex: none;
	}

	.menu-sheet > summary {
		border-right: 1px solid var(--color-line);
	}

	.local-sheet {
		flex: 1;
		min-width: 0;
	}

	.local-sheet > summary {
		justify-content: space-between;
	}

	.where {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.where.plain {
		align-self: center;
		padding: 0 var(--space-4);
		font-weight: var(--font-weight-semibold);
	}

	.sheet :global(.when-open) {
		display: none;
	}

	/*
	 * An open sheet covers the screen under a bar in the band's colors that
	 * names it, with a cross to close it; the page behind does not scroll.
	 */
	.sheet[open] > summary {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 31;
		height: 3.5rem;
		justify-content: space-between;
		padding: 0 var(--space-4);
		border: 0;
		background: var(--color-band);
		color: var(--color-band-text);
		font-size: var(--font-size-lead);
		font-weight: var(--font-weight-bold);
	}

	.sheet[open] :global(.when-shut) {
		display: none;
	}

	.sheet[open] :global(.when-open) {
		display: inline;
	}

	.sheet-body {
		position: fixed;
		top: 3.5rem;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 30;
		overflow-y: auto;
		overscroll-behavior: contain;
		background: var(--color-paper);
	}

	.local-sheet .sheet-body {
		padding: var(--space-4) var(--space-4) var(--space-6);
		font-size: var(--font-size-base, 1rem);
	}

	:global(:root:has(.sidebar-narrow .sheet[open])) {
		overflow: hidden;
	}

	/* On phones each link is at least the site's touch size. */
	.sidebar-narrow .local-link {
		min-height: var(--layout-target-minimum);
		margin-left: calc(-1 * var(--space-3) + 3px);
	}

	/* The sections, each opening its groups; the section being read starts open. */
	.phone-sections {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.phone-sections > li {
		border-bottom: 1px solid var(--color-line);
	}

	.phone-sections summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 3.5rem;
		padding: 0 var(--space-4);
		border-left: 4px solid transparent;
		font-size: var(--font-size-lead);
		font-weight: var(--font-weight-semibold);
	}

	.phone-sections summary.current,
	.phone-name.current {
		border-left-color: var(--color-action);
	}

	/* A section with a page of its own: its name is a link across the row, and its chevron, at the row's right end, opens its groups. */
	.phone-sections > li.linked {
		position: relative;
	}

	.phone-name {
		display: flex;
		align-items: center;
		min-height: 3.5rem;
		padding: 0 calc(3.5rem + var(--space-2)) 0 var(--space-4);
		border-left: 4px solid transparent;
		color: var(--color-ink);
		font-size: var(--font-size-lead);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
	}

	.phone-name:focus-visible,
	.phone-sections summary.toggle:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: -3px;
	}

	.phone-sections summary.toggle {
		position: absolute;
		top: 0;
		right: 0;
		justify-content: center;
		width: 3.5rem;
		height: 3.5rem;
		min-height: 0;
		padding: 0;
		border-left: 1px solid var(--color-line);
	}

	.phone-sections summary > :global(svg) {
		color: var(--color-ink-muted);
		transform: rotate(-90deg);
		transition: transform var(--motion-duration-short) var(--motion-easing-standard);
	}

	.phone-sections details[open] > summary > :global(svg) {
		transform: none;
	}

	.phone-groups {
		padding: 0 var(--space-4) var(--space-4) calc(var(--space-4) + 4px);
	}

	.phone-groups ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.phone-groups li {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-1) 0;
		min-height: var(--layout-target-minimum);
	}

	.phone-groups a {
		color: var(--color-link);
		font-weight: var(--font-weight-semibold);
	}

	.phone-groups a[aria-current='page'] {
		color: var(--color-ink);
		font-weight: var(--font-weight-bold);
	}

	/* The Workspace comes after the six sections, set apart by a wider rule, as in mockups/B-phone-menu-light.png. */
	.phone-sections > li.personal {
		border-top: 6px solid var(--color-line);
	}

	.phone-sections .personal-label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.phone-sections .personal-label :global(svg) {
		color: var(--color-ink);
	}
</style>
