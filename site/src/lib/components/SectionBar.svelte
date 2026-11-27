<script lang="ts">
	// The row of the site's six sections under the masthead, on wide screens
	// (Trevor chose this on Nov. 27, 2026: design/navigation-models, model C,
	// mockups/C-desktop-menu-open.png). Each section opens a menu of its pages
	// in groups, with counts beside the lists, and the Nations menu has a box
	// to go straight to a nation. The section being read is underlined in orange.
	//
	// Each menu is a <details> element sharing one name, so only one opens at a
	// time and they work without JavaScript. With it, a menu also closes on
	// Escape, on a click outside it and when a link is followed, and a shade
	// covers the page behind it. Phones list the same sections in the Menu
	// sheet (SiteSidebar.svelte).
	import { building } from '$app/env';
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Search from '@lucide/svelte/icons/search';
	import { nationNames } from 'virtual:section-lists';
	import { filterEntries } from '#lib/sidebar-outline.ts';
	import { currentNavigationLink, navigationSectionOf, navigationSections, type NavigationCounts } from '#lib/site-navigation.ts';
	import CountBadge from './CountBadge.svelte';

	const path = $derived(page.url.pathname);
	// Pages built ahead of time cannot read the query while being built.
	const search = $derived(building ? '' : page.url.search);
	const currentSection = $derived(navigationSectionOf(path));
	const currentLink = $derived(currentNavigationLink(currentSection, path, search));
	const counts = $derived(page.data.navigationCounts as NavigationCounts | undefined);

	let bar: HTMLElement | undefined = $state();
	let openKey = $state<string | undefined>(undefined);

	function menus(): HTMLDetailsElement[] {
		return bar ? [...bar.querySelectorAll<HTMLDetailsElement>('details.section-menu')] : [];
	}

	function closeAll(): void {
		for (const menu of menus()) menu.open = false;
		openKey = undefined;
	}

	// Read from the page, since the browser shuts one menu as another opens
	// and may send only one toggle event for several changes.
	function toggled(): void {
		openKey = menus().find((menu) => menu.open)?.dataset.key;
	}

	afterNavigate(() => {
		closeAll();
		nationFilter = '';
	});

	function closeOnEscape(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;
		const open = menus().find((menu) => menu.open);
		if (!open) return;
		closeAll();
		open?.querySelector('summary')?.focus();
	}

	function closeOnClickOutside(event: MouseEvent): void {
		if (!bar || bar.contains(event.target as Node) || !menus().some((menu) => menu.open)) return;
		closeAll();
	}

	// "Go to a nation": the nations whose names hold every word typed.
	let nationFilter = $state('');
	const nationItems = nationNames.map(([label, id]) => ({ label, link: `/nations/${id}` }));
	const nationMatches = $derived(nationFilter.trim() ? filterEntries(nationItems, nationFilter).slice(0, 8) : []);

	function goToFirstNation(event: SubmitEvent): void {
		event.preventDefault();
		const first = nationMatches[0];
		if (first) void goto(first.link);
	}
</script>

<svelte:window onkeydown={closeOnEscape} onclick={closeOnClickOutside} />

<nav class="section-bar no-print" aria-label="Sections" bind:this={bar}>
	<ul class="page-width sections">
		{#each navigationSections as section (section.key)}
			{@const current = section === currentSection}
			<li>
				<details class="section-menu" name="section-menu" data-key={section.key} ontoggle={toggled}>
					<summary class:current>
						{section.label}
						{#if current}<span class="visually-hidden">(the section you are in)</span>{/if}
						<ChevronDown size={16} aria-hidden="true" />
					</summary>
					<div class="menu-panel">
						<div class="menu-columns">
							{#each section.groups as group (group.title)}
								<div class="menu-group">
									<h2 class="group-title">{group.title}</h2>
									<ul>
										{#each group.links as item (item.link)}
											<li>
												{#if item.soon}
													<span class="soon">{item.label} <span class="soon-note">soon</span></span>
												{:else}
													<a href={item.link} aria-current={item === currentLink ? 'page' : undefined}>{item.label}</a
													>{#if item.count && counts?.[item.count]}<CountBadge count={counts[item.count]} />{/if}
												{/if}
											</li>
										{/each}
									</ul>
								</div>
							{/each}
							<div class="menu-side">
								{#if section.key === 'nations'}
									<form class="go-to-nation needs-scripts" role="search" onsubmit={goToFirstNation}>
										<label for="go-to-nation">Go to a nation</label>
										<div class="nation-field">
											<Search size={18} aria-hidden="true" />
											<input
												id="go-to-nation"
												type="search"
												placeholder="Type a nation’s name"
												autocomplete="off"
												bind:value={nationFilter}
											/>
										</div>
										{#if nationMatches.length > 0}
											<ul class="nation-matches">
												{#each nationMatches as nation (nation.link)}
													<li><a href={nation.link}>{nation.label}</a></li>
												{/each}
											</ul>
										{:else if nationFilter.trim()}
											<p class="no-match" role="status">No nations match.</p>
										{/if}
									</form>
								{/if}
								{#if section.home}
									<a class="section-home" href={section.home}>All of {section.label} <ChevronRight size={18} aria-hidden="true" /></a>
								{/if}
							</div>
						</div>
					</div>
				</details>
			</li>
		{/each}
	</ul>
</nav>
{#if openKey}
	<!-- The page behind an open menu is shaded; a click on the shade closes the menu. -->
	<div class="shade no-print" aria-hidden="true"></div>
{/if}

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

	summary:hover {
		background: var(--color-surface);
	}

	/* The section being read. */
	summary.current {
		border-bottom-color: var(--color-action);
		color: var(--color-link);
	}

	details[open] > summary {
		background: var(--color-surface);
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
		border-bottom: 1px solid var(--color-line);
		box-shadow: 0 12px 28px color-mix(in srgb, var(--color-ink) 16%, transparent);
	}

	.menu-columns {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr)) 18rem;
		gap: 1.25rem;
		padding: 1.5rem 2rem 1.75rem;
	}

	.group-title {
		margin: 0 0 var(--space-3);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-bold);
		letter-spacing: var(--font-letter-spacing-wide);
		text-transform: uppercase;
		color: var(--color-ink-muted);
	}

	.menu-group ul,
	.nation-matches {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.menu-group li {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0 0 0.55rem;
	}

	.menu-group a,
	.section-home {
		color: var(--color-link);
		font-weight: var(--font-weight-semibold);
	}

	.menu-group a[aria-current='page'] {
		color: var(--color-ink);
	}

	/* Not published yet: named, not linked. */
	.soon {
		color: var(--color-ink-muted);
		font-weight: var(--font-weight-semibold);
	}

	.soon-note {
		font-size: var(--font-size-small);
		font-style: italic;
		font-weight: var(--font-weight-regular);
	}

	.menu-side {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-4);
		/* The "All of" link lines up with the groups' first links when there is no box above it. */
		padding-top: calc(var(--font-size-small) * 1.6 + var(--space-3));
	}

	.menu-side:has(.go-to-nation) {
		padding-top: 0;
	}

	.go-to-nation {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
	}

	.go-to-nation label {
		font-weight: var(--font-weight-bold);
	}

	.nation-field {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink-muted);
	}

	.nation-field:focus-within {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: 1px;
	}

	.nation-field input {
		flex: 1;
		min-width: 0;
		min-height: var(--layout-target-minimum);
		border: 0;
		outline: 0;
		background: none;
		color: var(--color-ink);
		font: inherit;
	}

	.nation-matches li {
		margin: 0 0 var(--space-2);
	}

	.nation-matches a {
		color: var(--color-link);
	}

	.no-match {
		margin: 0;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.section-home {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-weight: var(--font-weight-bold);
	}

	.shade {
		position: fixed;
		inset: 0;
		z-index: 7;
		background: color-mix(in srgb, var(--color-ink) 28%, transparent);
	}
</style>
