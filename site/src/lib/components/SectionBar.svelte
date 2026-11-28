<script lang="ts">
	// The row of the site's six sections under the masthead, on wide screens
	// (Trevor chose this on Nov. 27, 2026: design/navigation-models, model C).
	// Each section's name links to the section's own page, and the chevron
	// beside it opens a menu of its pages in groups, each link with an icon
	// and its count (Trevor, Nov. 27, 2026: the name goes to the page, with no
	// "All of …" link in the menu; design/section-home-links). The section
	// being read is underlined in orange. The open menu is mockup A of
	// design/section-menus (Trevor, Nov. 26, 2026), without a "Go to a nation"
	// box, since the masthead's search finds a nation.
	//
	// A menu opens when the mouse rests on its section, name or chevron, and
	// closes soon after the mouse leaves the bar and the menu, with nothing
	// shading the page (Trevor, Nov. 26, 2026). A click or tap on the name
	// follows the link; a click or tap on the chevron, or Enter or Space on it,
	// opens the menu: each chevron is the <summary> of a <details> element
	// sharing one name, so only one menu opens at a time and they work without
	// JavaScript. This is the disclosure pattern for navigation with top-level
	// links (WAI-ARIA Authoring Practices), so the name and the chevron are
	// each one stop for the Tab key. A menu also closes on Escape, which puts
	// the focus back on its chevron, on a click outside it and when a link is
	// followed. Phones list the same sections in the Menu sheet
	// (SiteSidebar.svelte).
	//
	// For people with workspace access, a seventh tab, Workspace, sits at the
	// row's right end, set apart by a rule, and its menu lists the workspace
	// pages their role opens under their categories (Trevor chose this on
	// Nov. 27, 2026: design/sidebar-workspace-profile, option B;
	// src/lib/personal-navigation.ts). Its name links to the Overview. Pages
	// built ahead of time show it once their script reads the signed-in hint.
	import { building } from '$app/env';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import Briefcase from '@lucide/svelte/icons/briefcase';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { navigationIcons } from '#lib/navigation-icons.ts';
	import { isWorkspacePath, workspaceSection } from '#lib/personal-navigation.ts';
	import {
		currentNavigationLink,
		holdingNavigationLink,
		navigationSectionOf,
		navigationSections,
		type NavigationCounts,
		type NavigationSection
	} from '#lib/site-navigation.ts';
	import { WorkspaceAccess } from '#lib/workspace-access.svelte.ts';
	import CountBadge from './CountBadge.svelte';

	const path = $derived(page.url.pathname);
	// Pages built ahead of time cannot read the query while being built.
	const search = $derived(building ? '' : page.url.search);
	const access = new WorkspaceAccess();
	const workspace = $derived(workspaceSection(access.pages));
	const currentSection = $derived(navigationSectionOf(path) ?? (workspace && isWorkspacePath(path) ? workspace : undefined));
	const currentLink = $derived(
		currentSection === workspace && workspace ? holdingNavigationLink(workspace, path, search) : currentNavigationLink(currentSection, path, search)
	);
	const counts = $derived(page.data.navigationCounts as NavigationCounts | undefined);

	// How long the mouse rests on a section before its menu opens, so a menu
	// does not open as the mouse crosses the bar on its way down the page,
	// and how long a menu stays open after the mouse leaves it.
	const openDelay = 120;
	const closeDelay = 250;

	let bar: HTMLElement | undefined = $state();
	// How the open menu was opened: by the mouse resting on it, by a click or
	// tap, or from the keyboard. Only a menu the mouse opened or clicked
	// closes when the mouse leaves; one opened from the keyboard stays open
	// until Escape, a click outside or a link.
	let openedBy: 'hover' | 'pointer' | 'keyboard' | undefined;
	let openTimer: ReturnType<typeof setTimeout> | undefined;
	let closeTimer: ReturnType<typeof setTimeout> | undefined;

	function menus(): HTMLDetailsElement[] {
		return bar ? [...bar.querySelectorAll<HTMLDetailsElement>('details.section-menu')] : [];
	}

	function openMenu(): HTMLDetailsElement | undefined {
		return menus().find((menu) => menu.open);
	}

	function stopTimers(): void {
		clearTimeout(openTimer);
		clearTimeout(closeTimer);
	}

	function closeAll(): void {
		stopTimers();
		for (const menu of menus()) menu.open = false;
		openedBy = undefined;
	}

	afterNavigate(() => closeAll());

	// The mouse rests on a section: open its menu, at once if another menu is
	// already open. Touch and pen taps open menus by their click instead.
	function pointerEntered(event: PointerEvent, menu: HTMLDetailsElement): void {
		if (event.pointerType !== 'mouse') return;
		stopTimers();
		if (menu.open) return;
		const open = () => {
			menu.open = true;
			openedBy = 'hover';
		};
		if (openMenu()) open();
		else openTimer = setTimeout(open, openDelay);
	}

	function pointerLeftBar(event: PointerEvent): void {
		if (event.pointerType !== 'mouse') return;
		clearTimeout(openTimer);
		if (openedBy !== 'hover' && openedBy !== 'pointer') return;
		closeTimer = setTimeout(closeAll, closeDelay);
	}

	function pointerEnteredBar(event: PointerEvent): void {
		if (event.pointerType === 'mouse') clearTimeout(closeTimer);
	}

	// A click on a section the mouse has just opened keeps it open, rather
	// than shutting it under the reader; the next click shuts it. Enter and
	// Space send a click with no mouse button (detail 0).
	function summaryClicked(event: MouseEvent, menu: HTMLDetailsElement): void {
		stopTimers();
		if (event.detail === 0) {
			openedBy = menu.open ? undefined : 'keyboard';
			return;
		}
		if (menu.open && openedBy === 'hover') {
			event.preventDefault();
			openedBy = 'pointer';
			return;
		}
		openedBy = menu.open ? undefined : 'pointer';
	}

	function closeOnEscape(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		const open = openMenu();
		if (!open) return;
		closeAll();
		open.querySelector('summary')?.focus();
	}

	function closeOnClickOutside(event: MouseEvent): void {
		if (!bar || bar.contains(event.target as Node) || !openMenu()) return;
		closeAll();
	}
</script>

<svelte:window onkeydown={closeOnEscape} onclick={closeOnClickOutside} />

{#snippet menu(section: NavigationSection)}
	{@const current = section === currentSection}
	<div class="section-tab" class:current>
		{#if section.home}
			<a
				class="section-name"
				href={section.home}
				aria-current={section.home === path ? 'page' : current ? 'true' : undefined}
				onpointerenter={(event) => pointerEntered(event, event.currentTarget.nextElementSibling as HTMLDetailsElement)}
				>{#if section === workspace}<Briefcase size={18} aria-hidden="true" />{/if}{section.label}</a
			>
		{/if}
		<details class="section-menu" name="section-menu" data-key={section.key}>
			<summary
				class:labelled={!section.home}
				onpointerenter={(event) => pointerEntered(event, event.currentTarget.parentElement as HTMLDetailsElement)}
				onclick={(event) => summaryClicked(event, event.currentTarget.parentElement as HTMLDetailsElement)}
			>
				{#if section.home}
					<span class="visually-hidden">{section.label} menu</span>
				{:else}
					{#if section === workspace}<Briefcase size={18} aria-hidden="true" />{/if}
					{section.label}
					{#if current}<span class="visually-hidden">(the section you are in)</span>{/if}
				{/if}
				<ChevronDown size={16} aria-hidden="true" />
			</summary>
			<div class="menu-panel">
				<div class="menu-columns page-width" class:workspace-columns={section === workspace} class:even-columns={section.groups.some((group) => group.beneath)} style:--columns={section.groups.filter((group) => !group.beneath).length}>
					{#each section.groups as group (group.title)}
						<div class="menu-group" class:beneath={group.beneath}>
							<h2 class="group-title">{group.title}</h2>
							<ul>
								{#each group.links as item (item.link)}
									{@const Icon = navigationIcons[item.icon]}
									<li>
										{#if item.soon}
											<span class="menu-link soon"
												><Icon size={18} aria-hidden="true" /><span class="menu-label">{item.label} <span class="soon-note">soon</span></span></span
											>
										{:else}
											<a class="menu-link" href={item.link} aria-current={item === currentLink ? 'page' : undefined}
												><Icon size={18} aria-hidden="true" /><span class="menu-label">{item.label}</span
												>{#if item.count && counts?.[item.count]}<CountBadge count={counts[item.count]} />{/if}</a
											>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
			</div>
		</details>
	</div>
{/snippet}

<nav class="section-bar no-print" aria-label="Sections" bind:this={bar} onpointerleave={pointerLeftBar} onpointerenter={pointerEnteredBar}>
	<ul class="page-width sections">
		{#each navigationSections as section (section.key)}
			<li>{@render menu(section)}</li>
		{/each}
		{#if workspace}
			<li class="personal">{@render menu(workspace)}</li>
		{/if}
	</ul>
</nav>

<style>
	/* Only on wide screens; phones have the Menu sheet (SiteSidebar.svelte). */
	.section-bar {
		display: none;
	}

	@media (min-width: 64rem) {
		.section-bar {
			display: block;
			position: relative;
			z-index: 8;
			background: var(--color-section-bar);
			border-bottom: 1px solid var(--color-line);
		}
	}

	/*
	 * The bar and its open menu are one surface (palette C, chosen by Trevor on
	 * Nov. 27, 2026; design/header-nav-colors): the page's paper in light, the
	 * panels' surface in dark. The side box, a row under the mouse and the
	 * count badges take the next step up.
	 */
	.section-bar {
		--color-surface: var(--color-section-bar-raised);
		--color-surface-raised: var(--color-section-bar);
	}

	.sections {
		display: flex;
		gap: var(--space-1);
		margin: 0;
		/* The first section lines up with the hamburger at the masthead's left (SiteHeader.svelte). */
		padding-left: var(--space-2);
		list-style: none;
	}

	.sections > li {
		display: flex;
	}

	/* The Workspace, for people with access, at the row's right end, set apart by a rule (design/sidebar-workspace-profile, option B). */
	.sections > li.personal {
		margin-left: auto;
		padding-left: var(--space-3);
		border-left: 1px solid var(--color-line);
	}

	/* A section: its name, linking to its own page, and the chevron that opens its menu, read as one tab. */
	.section-tab {
		display: flex;
		align-items: stretch;
		min-height: 2.875rem;
		border-top: 3px solid transparent;
		border-bottom: 3px solid transparent;
		box-sizing: border-box;
	}

	/* The section being read. */
	.section-tab.current {
		border-bottom-color: var(--color-action);
	}

	.section-name,
	summary {
		display: flex;
		align-items: center;
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}

	.section-name {
		gap: var(--space-2);
		padding: 0 0.2rem 0 0.85rem;
		text-decoration: none;
	}

	summary {
		gap: var(--space-1);
		/* The chevron alone is at least 24 px wide and the row's full height, the smallest target WCAG 2.5.8 allows and then some. */
		min-width: 1.75rem;
		/* The row's height inside the tab's two 3 px borders. */
		min-height: calc(2.875rem - 6px);
		box-sizing: border-box;
		justify-content: center;
		padding: 0 0.45rem 0 0.2rem;
		cursor: pointer;
		list-style: none;
		user-select: none;
	}

	/* A section with no page of its own (a Workspace without an Overview): the name opens the menu. */
	summary.labelled {
		padding: 0 0.85rem;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary :global(svg) {
		color: var(--color-ink-muted);
	}

	.personal .section-name > :global(svg:first-child),
	.personal summary > :global(svg:first-child) {
		color: inherit;
	}

	/* The section the mouse is on, the one whose menu is open, and the one being read read in the link color. */
	.section-tab:hover .section-name,
	.section-tab:hover summary,
	.section-tab:has(details[open]) .section-name,
	details[open] > summary,
	.section-tab.current .section-name,
	.section-tab.current summary {
		color: var(--color-link);
	}

	/*
	 * The name and its chevron read as one item (Trevor, Nov. 27, 2026): the
	 * mouse anywhere on either shades the whole tab and draws the bar under
	 * all of it, as an open menu does. They stay two stops for the Tab key and
	 * two targets for a tap, each with its own focus ring.
	 */
	.section-tab:hover,
	.section-tab:has(details[open]) {
		background: var(--color-surface);
		border-bottom-color: var(--color-link);
	}

	/* The section being read keeps its orange bar. */
	.section-tab.current:hover,
	.section-tab.current:has(details[open]) {
		border-bottom-color: var(--color-action);
	}

	.section-name:focus-visible,
	summary:focus-visible {
		outline-offset: -5px;
		border-radius: var(--radius-control);
	}

	/* The menu: the whole width under the row, its groups side by side. */
	.menu-panel {
		position: absolute;
		left: 0;
		right: 0;
		top: 100%;
		max-height: calc(100dvh - 8rem);
		overflow-y: auto;
		background: var(--color-section-bar);
		border-top: 1px solid var(--color-line);
		border-bottom: 1px solid var(--color-line);
		box-shadow: 0 18px 36px -18px var(--color-menu-shadow);
	}

	.menu-columns {
		display: flex;
		gap: var(--space-5);
		padding: var(--space-5) var(--space-5) 1.75rem;
	}

	/* The Workspace's eight categories sit in rows of four. */
	.workspace-columns {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-5) var(--space-6);
	}

	/* A section with a group beneath the others (Courts and Cases' Directory) sets the rest side by side in equal columns, and the group beneath across them all (Trevor, Nov. 27, 2026, design/section-homes/nav/2-balanced-menu-and-page.png). */
	.even-columns {
		display: grid;
		grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
		gap: var(--space-5) var(--space-5);
	}

	.even-columns .beneath {
		grid-column: 1 / -1;
	}

	.even-columns .beneath ul {
		max-width: 22rem;
	}

	/* Each group takes room by the length of its links, so long names wrap least. */
	/* A section with one group (Support, Store) keeps its links to a column's width rather than across the whole panel. */
	.menu-group:only-child ul {
		max-width: 22rem;
	}

	.menu-group {
		flex: 1 1 auto;
		min-width: 0;
	}

	.group-title {
		margin: 0 0 0.65rem;
		padding: 0 0.6rem 0.55rem;
		border-bottom: 1px solid var(--color-line);
		font-size: 0.75rem;
		font-weight: var(--font-weight-bold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink-muted);
	}

	.menu-group ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* A link is a whole row: icon, name, and its count at the right. */
	.menu-link {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.6rem;
		border-radius: var(--radius-control);
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
	}

	.menu-link :global(svg) {
		flex: none;
		color: var(--color-link);
	}

	.menu-link :global(.count-badge) {
		margin-left: auto;
	}

	a.menu-link:hover {
		background: var(--color-surface);
		color: var(--color-link);
	}

	/* The page being read. */
	a.menu-link[aria-current='page'] {
		background: var(--color-surface);
	}

	/* Not published yet: named, not linked. */
	.soon,
	.soon :global(svg) {
		color: var(--color-ink-muted);
	}

	.soon-note {
		font-size: var(--font-size-small);
		font-style: italic;
		font-weight: var(--font-weight-regular);
	}
</style>
