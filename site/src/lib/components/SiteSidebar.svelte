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
	// - otherwise the pages of the section being read, in the groups of its
	//   menu (src/lib/site-navigation.ts);
	// - then "On this page": the page's headings, the one being read marked as
	//   the page scrolls (src/lib/active-heading.ts);
	// - then the reader's groups: Your account, the Workspace and the reader's
	//   own links (sidebar/SidebarGroups.svelte), and Your work while an essay
	//   is edited.
	//
	// Long lists, such as every nation, are no longer in the column: the
	// Nations menu has a box to go straight to a nation.
	//
	// On phones a strip under the masthead holds two buttons: "Menu", which
	// opens the sections as a sheet over the page, the section being read open,
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
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import { accountPages, currentAccountPage, isAccountPath } from '#lib/account-menu.ts';
	import { followActiveHeading, headingIds } from '#lib/active-heading.ts';
	import { isUnfolded } from '#lib/outline-folding.ts';
	import { editingOutline } from '#lib/essays/editing-outline.svelte.ts';
	import { followedPageAddress } from '#lib/page-history.ts';
	import type { Permission } from '#lib/permissions.ts';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';
	import {
		currentNavigationLink,
		holdingNavigationLink,
		navigationSectionOf,
		navigationSections,
		type NavigationCounts,
		type NavigationLink,
		type NavigationSection
	} from '#lib/site-navigation.ts';
	import type { OutlineItem, PageFamily, PageOutline } from '#lib/site-sections.ts';
	import {
		isCurrentWorkspacePage,
		workspacePagesFor,
		workspacePagesNamed,
		type WorkspacePage
	} from '#lib/workspace-menu.ts';
	import CountBadge from './CountBadge.svelte';
	import CodeOutline from './sidebar/CodeOutline.svelte';
	import SidebarGroups from './sidebar/SidebarGroups.svelte';
	import SidebarTree from './sidebar/SidebarTree.svelte';
	import YourWork from './sidebar/YourWork.svelte';
	import { SidebarState } from './sidebar/sidebar-state.svelte.ts';
	import { isSidebarShortcut, restoreSidebarVisibility, sidebarVisibility, toggleSidebar } from './sidebar/sidebar-visibility.svelte.ts';

	const sidebar = new SidebarState();

	const path = $derived(page.url.pathname);
	// Pages built ahead of time cannot read the query while being built.
	const search = $derived(building ? '' : page.url.search);
	// The page the reader is on, when the site records its changes ("Changes to this page").
	const followedPage = $derived(page.error ? undefined : followedPageAddress(path));
	const counts = $derived(page.data.navigationCounts as NavigationCounts | undefined);

	// The page's title, for the phone strip on pages with nothing else to name them.
	let pageTitle = $state<string | undefined>(undefined);

	// ---- Where the reader is ----
	const family = $derived(page.data.family as PageFamily | undefined);
	const currentSection = $derived(navigationSectionOf(path));
	// A family takes the place of the section's pages.
	const shownSection = $derived(family ? undefined : currentSection);
	const heldLink = $derived(shownSection ? holdingNavigationLink(shownSection, path, search) : undefined);

	// The page's own headings. While an essay is edited or commented on, its
	// outline is the draft's, with what changed marked (src/lib/essays/editor-outline.ts).
	const editing = $derived(editingOutline.current?.path === path ? editingOutline.current : undefined);
	const publishedOutline = $derived(page.data.outline as PageOutline | undefined);
	const outlineItems = $derived<OutlineItem[]>(editing ? editing.items : (publishedOutline?.items ?? []));
	// Rows line up without room for carets when no heading has headings under it.
	const outlineNests = $derived(outlineItems.some((item) => item.children?.length));
	// An outline of the page's headings is "On this page"; one that lists other pages, such as the back matter's, is "Contents".
	const outlineLabel = $derived(outlineItems.every((item) => item.link.startsWith('#')) ? 'On this page' : 'Contents');

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

	// What the phone strip names beside "Menu".
	const localTitle = $derived(
		family?.short ??
			family?.title ??
			shownSection?.label ??
			(currentWorkspacePage ? 'Workspace' : undefined) ??
			(currentAccount ? 'Your account' : undefined) ??
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

{#snippet pageLink(item: NavigationLink, current: boolean, held: boolean)}
	{#if item.soon}
		<span class="local-link soon">{item.label} <span class="soon-note">soon</span></span>
	{:else}
		<a class="local-link" class:held={held && !current} href={item.link} aria-current={current ? 'page' : undefined}>
			<span>{item.label}</span>
			{#if item.count && counts?.[item.count]}<CountBadge count={counts[item.count]} />{/if}
		</a>
	{/if}
{/snippet}

{#snippet local(idSuffix: string)}
	{#if family}
		<!-- The pages the page belongs with, such as a nation's own pages. -->
		<div class="local-head">
			{#if family.back}
				<a class="back-link" href={family.back.link}><ChevronLeft size={18} aria-hidden="true" />{family.back.label}</a>
			{/if}
			{#if family.link}
				<a class="local-title" href={family.link} aria-current={family.link === path ? 'page' : undefined}>{family.title}</a>
			{:else}
				<p class="local-title">{family.title}</p>
			{/if}
		</div>
		{#if family.tree}<CodeOutline tree={family.tree} {idSuffix} />{/if}
		<ul class="local-pages">
			{#each family.pages as item (item.link)}
				{@const current = item.link === path}
				<li>
					<a class="local-link" href={item.link} aria-current={current ? 'page' : undefined}>
						<span>{#if item.number}<span class="number">{item.number}</span>{' '}{/if}{item.label}</span>
						{#if item.count}<CountBadge count={item.count} />{/if}
					</a>
				</li>
			{/each}
		</ul>
	{:else if shownSection}
		<!-- The section's pages, in the groups of its menu. -->
		<div class="local-head">
			{#if shownSection.home}
				<a class="local-title" href={shownSection.home} aria-current={shownSection.home === path ? 'page' : undefined}>{shownSection.label}</a>
			{:else}
				<p class="local-title">{shownSection.label}</p>
			{/if}
		</div>
		{#each shownSection.groups as group (group.title)}
			<p class="local-label">{group.title}</p>
			<ul class="local-pages">
				{#each group.links as item (item.link)}
					<li>{@render pageLink(item, item === currentNavigationLink(shownSection, path, search), item === heldLink)}</li>
				{/each}
			</ul>
		{/each}
	{:else if publishedOutline?.title && outlineItems.length > 0}
		<div class="local-head"><p class="local-title">{publishedOutline.title}</p></div>
	{/if}
	{#if outlineItems.length > 0}
		<p class="local-label on-this-page" id="sidebar-on-this-page-{idSuffix}">{outlineLabel}</p>
		<div class="headings" class:no-carets={!outlineNests}>
			<SidebarTree
				items={outlineItems}
				listIdentifier="sidebar-outline-{idSuffix}"
				flush
				{isActive}
				isCurrent={isCurrentHeading}
				isOpen={isItemOpen}
				ontoggle={toggleItem}
			/>
		</div>
	{/if}
{/snippet}

{#snippet groups(idSuffix: string)}
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

<!-- Wide screens: a column beside the page. The reader hides and shows it with
     the hamburger at the top left of the masthead, or with Ctrl+\ (Trevor,
     Nov. 23, 2026); hidden, the page takes the whole width. Without scripts it
     always shows. -->
<div class="sidebar-wide no-print" id="site-sidebar" bind:this={wideSidebar}>
	<nav aria-label="Where you are" class="local-column" bind:this={wideColumn}>
		{@render local('wide')}
		<div class="column-groups">{@render groups('wide')}</div>
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
			</ul>
			<div class="sheet-groups">{@render groups('narrow')}</div>
		</nav>
	</details>
	{#if family || shownSection || outlineItems.length > 0}
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
	{@const current = section === currentSection}
	{@const sectionLink = currentNavigationLink(section, path, search)}
	<li>
		<details name="phone-section" open={current}>
			<summary class:current>
				<span>{section.label}{#if current}<span class="visually-hidden"> (the section you are in)</span>{/if}</span>
				<ChevronDown size={20} aria-hidden="true" />
			</summary>
			<div class="phone-groups">
				{#each section.groups as group (group.title)}
					<p class="local-label">{group.title}</p>
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
				{#if section.home}
					<p class="phone-home"><a href={section.home}>All of {section.label}</a></p>
				{/if}
			</div>
		</details>
	</li>
{/snippet}

<style>
	/*
	 * Nesting, the same in every list of the column (Trevor chose option B,
	 * design/sidebar-nesting): a row is a caret, a small gap and its text; a
	 * list under an entry starts one step to the right of that entry, with a
	 * thin guide line down from the entry's caret beside it. The lists use
	 * these measures in sidebar/FoldGroup.svelte, sidebar/SidebarTree.svelte
	 * and here.
	 */
	.sidebar-wide,
	.sidebar-narrow {
		--sidebar-caret: 1.75rem;
		--sidebar-caret-gap: var(--space-1);
		--sidebar-step: 1.25rem;
		/* The guide line runs down the middle of the parent's caret. */
		--sidebar-line-at: calc(var(--sidebar-caret) / 2);
		/* From the guide line to where the list's rows start. */
		--sidebar-line-to-rows: calc(var(--sidebar-step) - var(--sidebar-line-at));
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

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 2rem;
		margin-left: -0.2rem;
		color: var(--color-link);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
	}

	.back-link:hover {
		text-decoration: underline;
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
	.local-link.held {
		border-left-color: var(--color-line-strong, var(--color-line));
		font-weight: var(--font-weight-semibold);
	}

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

	/* The page's headings: a guide line down their left, the one being read marked on it. */
	.headings {
		border-left: 1px solid var(--color-line);
		font-size: 0.9rem;
	}

	.headings :global(.outline.flush > li > .entry) {
		margin-left: -2px;
	}

	.headings.no-carets :global(.fold.space) {
		display: none;
	}

	.headings.no-carets :global(.outline.flush > li > .entry > a) {
		padding-left: var(--space-3);
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

		/* The reader's groups, after where the reader is; each draws its own rule above it. */
		.column-groups {
			margin-top: var(--space-4);
		}

		/* The headings sit closer together than the pages, as in the mockup. */
		.local-column .headings :global(a) {
			padding-top: 0.2rem;
			padding-bottom: 0.2rem;
		}

		.column-groups:empty {
			display: none;
		}

		/* A column the reader hid stays hidden from the first paint (app.html). */
		:global(:root[data-sidebar-hidden='true']) .sidebar-wide {
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

	.phone-sections summary.current {
		border-left-color: var(--color-action);
	}

	.phone-sections summary :global(svg) {
		color: var(--color-ink-muted);
		transform: rotate(-90deg);
		transition: transform var(--motion-duration-short) var(--motion-easing-standard);
	}

	.phone-sections details[open] > summary :global(svg) {
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

	.phone-groups a,
	.phone-home a {
		color: var(--color-link);
		font-weight: var(--font-weight-semibold);
	}

	.phone-groups a[aria-current='page'] {
		color: var(--color-ink);
		font-weight: var(--font-weight-bold);
	}

	.phone-home {
		margin: var(--space-2) 0 0;
	}

	.sheet-groups {
		padding: var(--space-3) var(--space-4) var(--space-6);
	}
</style>
