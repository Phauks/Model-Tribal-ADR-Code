<script lang="ts">
	// The row of the site's six sections under the masthead, on wide screens
	// (Trevor chose this on Nov. 27, 2026: design/navigation-models, model C).
	// Each section opens a menu of its pages in groups, each link with an icon
	// and its count, and a box with the link to the section's own page. The
	// section being read is underlined in orange. The open menu is mockup A of
	// design/section-menus (Trevor, Nov. 26, 2026), without a "Go to a nation"
	// box, since the masthead's search finds a nation.
	//
	// A menu opens when the mouse rests on its section and closes soon after
	// the mouse leaves the bar and the menu, with nothing shading the page
	// (Trevor, Nov. 26, 2026). A click, a tap or Enter or Space opens it too:
	// each menu is a <details> element sharing one name, so only one opens at
	// a time and they work without JavaScript. A menu also closes on Escape, on
	// a click outside it and when a link is followed. Phones list the same
	// sections in the Menu sheet (SiteSidebar.svelte).
	//
	// For people with workspace access, a seventh tab, Workspace, sits at the
	// row's right end, set apart by a rule, and its menu lists the workspace
	// pages their role opens under their categories (Trevor chose this on
	// Nov. 27, 2026: design/sidebar-workspace-profile, option B;
	// src/lib/personal-navigation.ts). Pages built ahead of time show it once
	// their script reads the signed-in hint.
	import { building } from '$app/env';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
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
	<details class="section-menu" name="section-menu" data-key={section.key}>
		<summary
			class:current
			onpointerenter={(event) => pointerEntered(event, event.currentTarget.parentElement as HTMLDetailsElement)}
			onclick={(event) => summaryClicked(event, event.currentTarget.parentElement as HTMLDetailsElement)}
		>
			{#if section === workspace}<Briefcase size={18} aria-hidden="true" />{/if}
			{section.label}
			{#if current}<span class="visually-hidden">(the section you are in)</span>{/if}
			<ChevronDown size={16} aria-hidden="true" />
		</summary>
		<div class="menu-panel">
			<div class="menu-columns page-width" class:workspace-columns={section === workspace}>
				{#each section.groups as group (group.title)}
					<div class="menu-group">
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
				{#if section.home}
					<div class="menu-side">
						<a class="section-home" href={section.home}
							>{section === workspace ? 'Workspace Overview' : `All of ${section.label}`} <ArrowRight size={18} aria-hidden="true" /></a
						>
					</div>
				{/if}
			</div>
		</div>
	</details>
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
			background: var(--color-paper);
			border-bottom: 1px solid var(--color-line);
		}
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

	.personal summary {
		gap: var(--space-2);
	}

	.personal summary > :global(svg:first-child) {
		color: inherit;
	}

	summary {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 2.875rem;
		padding: 0 0.85rem;
		border-top: 3px solid transparent;
		border-bottom: 3px solid transparent;
		box-sizing: border-box;
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
		list-style: none;
		user-select: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary :global(svg) {
		color: var(--color-ink-muted);
	}

	/* The section the mouse is on, or whose menu is open, reads in the link color. */
	summary:hover,
	details[open] > summary {
		color: var(--color-link);
	}

	/* The section being read. */
	summary.current {
		border-bottom-color: var(--color-action);
		color: var(--color-link);
	}

	summary:focus-visible {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: -3px;
		background: var(--color-focus);
		color: var(--focus-text);
	}

	/* The menu: the whole width under the row, its groups side by side. */
	.menu-panel {
		position: absolute;
		left: 0;
		right: 0;
		top: 100%;
		max-height: calc(100dvh - 8rem);
		overflow-y: auto;
		background: var(--color-surface-raised);
		border-top: 1px solid var(--color-line);
		border-bottom: 1px solid var(--color-line);
		box-shadow: 0 18px 36px -18px color-mix(in srgb, var(--color-ink) 35%, transparent);
	}

	.menu-columns {
		display: flex;
		gap: var(--space-5);
		padding: var(--space-5) var(--space-5) 1.75rem;
	}

	/* The Workspace's eight categories sit in rows of four, beside the Overview box. */
	.workspace-columns {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr)) 17rem;
		gap: var(--space-5) var(--space-6);
	}

	.workspace-columns .menu-side {
		grid-column: 5;
		grid-row: 1;
	}

	/* Each group takes room by the length of its links, so long names wrap least. */
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

	a.menu-link:focus-visible {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: -3px;
		background: var(--color-focus);
		color: var(--focus-text);
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

	/* The box with the link to the section's own page. */
	.menu-side {
		display: flex;
		flex-direction: column;
		flex: 0 0 17rem;
		box-sizing: border-box;
		align-self: flex-start;
		padding: 1.1rem 1.1rem 1.25rem;
		border-radius: var(--radius-panel);
		background: var(--color-surface);
	}

	.section-home {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.55rem 0.9rem;
		border: 1px solid var(--color-link);
		border-radius: 999px;
		color: var(--color-link);
		font-weight: var(--font-weight-bold);
		text-decoration: none;
	}

	.section-home:hover {
		background: var(--color-surface-raised);
	}
</style>
