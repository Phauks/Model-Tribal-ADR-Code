<script lang="ts">
	// The left sidebar, on every page. It always lists the site's sections and
	// opens the current one into the outline of the page being read: the
	// divisions, chapters and sections of the model code, the headings of an
	// essay, the parts of a nation's page. The home page shows the sections only.
	//
	// It works without JavaScript: the wide-screen sidebar and the phone menu are
	// each a <details> element, and the current page is marked when the page is
	// built. A script, when it runs, adds two things: it remembers whether the
	// reader hid the sidebar, and it marks the heading being read as the page
	// scrolls. On paper the sidebar is not printed.
	//
	// For someone signed in with workspace access, a Workspace section lists
	// the workspace pages their role opens. Workspace pages know this when the
	// Worker renders them; the pages built ahead of time read it from the
	// signed-in hint (src/lib/signed-in-hint.ts) once the script runs.
	import { page } from '$app/state';
	import History from '@lucide/svelte/icons/history';
	import Menu from '@lucide/svelte/icons/menu';
	import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
	import PanelLeftOpen from '@lucide/svelte/icons/panel-left-open';
	import Star from '@lucide/svelte/icons/star';
	import type { Permission } from '#lib/permissions.ts';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';
	import { sectionOf, siteSections, type OutlineItem, type PageOutline } from '#lib/site-sections.ts';
	import {
		isCurrentWorkspacePage,
		workspacePagesFor,
		workspacePagesNamed,
		type WorkspacePage
	} from '#lib/workspace-menu.ts';

	const outline = $derived(page.data.outline as PageOutline | undefined);
	const path = $derived(page.url.pathname);

	const currentSection = $derived(sectionOf(path));

	// The workspace pages to list: from the page itself in the workspace,
	// otherwise from the signed-in hint, read in the browser.
	let hintedPageNames = $state<string[]>([]);
	$effect(() => {
		hintedPageNames = readSignedInHint(document.cookie).workspacePageNames;
	});
	const permissions = $derived(page.data.permissions as Permission[] | undefined);
	const workspaceMenu = $derived<WorkspacePage[]>(
		permissions ? workspacePagesFor(permissions) : workspacePagesNamed(hintedPageNames)
	);
	const currentWorkspacePage = $derived(
		workspaceMenu.find((item) => isCurrentWorkspacePage(item.link, path))
	);

	// Where the phone menu says the reader is, beside the word "Menu".
	const whereLabel = $derived(
		currentItemLabel(outline?.items ?? []) ??
			outline?.title ??
			currentSection?.label ??
			(currentWorkspacePage ? `Workspace: ${currentWorkspacePage.label}` : 'Home')
	);

	function currentItemLabel(items: OutlineItem[]): string | undefined {
		for (const item of items) {
			if (isCurrentPage(item)) return [item.number, item.label].filter(Boolean).join(' ');
			const inside = currentItemLabel(item.children ?? []);
			if (inside) return inside;
		}
		return undefined;
	}

	const storageKey = 'sidebar-hidden';
	let open = $state(true);
	let activeHeading = $state<string | undefined>(undefined);
	let wideSidebar: HTMLDetailsElement | undefined = $state();

	// On wide screens the sidebar scrolls on its own, separately from the page
	// (Trevor, Nov. 22, 2026). It stays in view as the page scrolls, and its
	// height follows the part of the window it can use: below the masthead
	// at the top of the page and above the footer at the end, so its last
	// entries can always be scrolled into view without moving the page.
	// Without scripts it is one window tall.
	$effect(() => {
		const sidebar = wideSidebar;
		const column = sidebar?.parentElement;
		if (!sidebar || !column) return;
		let frame = 0;
		const fit = () => {
			frame = 0;
			const area = column.getBoundingClientRect();
			const top = Math.max(0, area.top);
			const bottom = Math.min(window.innerHeight, area.bottom);
			sidebar.style.height = `${Math.max(bottom - top, 0)}px`;
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
			sidebar.style.height = '';
		};
	});

	$effect(() => {
		try {
			open = localStorage.getItem(storageKey) !== 'true';
		} catch {
			// Storage can be blocked; the sidebar then simply starts open.
		}
	});

	function remember(event: Event) {
		open = (event.currentTarget as HTMLDetailsElement).open;
		try {
			localStorage.setItem(storageKey, String(!open));
		} catch {
			// Nothing to remember with; the choice lasts for this page only.
		}
	}

	// Mark the heading nearest the top of the screen as the one being read.
	$effect(() => {
		const ids = collectHeadingIds(outline?.items ?? []);
		const headings = ids
			.map((id) => document.getElementById(id))
			.filter((element): element is HTMLElement => element !== null);
		if (headings.length === 0) return;
		// The heading nearest above the top third of the screen, by position, so a
		// heading in a side column (such as "At a glance") is not marked early.
		const update = () => {
			let current = headings[0];
			let nearest = -Infinity;
			if (window.scrollY > 40) {
				for (const heading of headings) {
					const top = heading.getBoundingClientRect().top;
					if (top < window.innerHeight * 0.3 && top > nearest) {
						nearest = top;
						current = heading;
					}
				}
			}
			activeHeading = current.id;
		};
		update();
		window.addEventListener('scroll', update, { passive: true });
		return () => window.removeEventListener('scroll', update);
	});

	function collectHeadingIds(items: OutlineItem[]): string[] {
		return items.flatMap((item) => [
			...(item.link.startsWith('#') ? [item.link.slice(1)] : []),
			...collectHeadingIds(item.children ?? [])
		]);
	}

	// An entry is the page being read when its page says so or its link is this address.
	function isCurrentPage(item: OutlineItem): boolean {
		return Boolean(item.current) || item.link === path;
	}

	function isActive(item: OutlineItem): boolean {
		return item.link.startsWith('#') ? item.link.slice(1) === activeHeading : isCurrentPage(item);
	}
</script>

{#snippet outlineList(items: OutlineItem[], depth: number)}
	<ul class="outline" data-depth={depth}>
		{#each items as item (item.link)}
			<li>
				<a
					href={item.link}
					class:active={isActive(item)}
					aria-current={isCurrentPage(item)
						? 'page'
						: item.link.startsWith('#') && isActive(item)
							? 'location'
							: undefined}
				>
					{#if item.number}<span class="number">{item.number}</span>{/if}
					<span class="label"
						>{item.label}{#if item.note}{' '}<span class="note">({item.note})</span>{/if}</span
					>
				</a>
				{#if item.children?.length}
					{@render outlineList(item.children, depth + 1)}
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet sections(idSuffix: string)}
	<ul class="sections">
		{#each siteSections as section (section.link)}
			{@const current = section === currentSection}
			<li class:current>
				{#if section.built}
					<a href={section.link} aria-current={current && path === section.link ? 'page' : undefined}>
						{section.label}
					</a>
				{:else}
					<span class="unbuilt">{section.label}<span class="visually-hidden"> (not yet published)</span></span>
				{/if}
				{#if current && outline?.items.length}
					{#if outline.title}<p class="outline-title">{outline.title}</p>{/if}
					{@render outlineList(outline.items, 1)}
				{/if}
			</li>
		{/each}
	</ul>
	{#if workspaceMenu.length > 0}
		<!-- The workspace, for people signed in with access to it (site/COLLABORATION.md). -->
		<div class="workspace-links">
			<p class="group-title" id="sidebar-workspace-{idSuffix}">Workspace</p>
			<ul class="sections" aria-labelledby="sidebar-workspace-{idSuffix}">
				{#each workspaceMenu as item (item.link)}
					<li>
						<a href={item.link} aria-current={item === currentWorkspacePage ? 'page' : undefined}>
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
	<!-- Every change to the site's pages, like a wiki's (site/COLLABORATION.md, "Recent changes"),
	     and the reader's own pages, kept on this device (site/DESIGN.md, section 6, "Star"). -->
	<ul class="sections reader-links">
		<li>
			<a href="/changes" aria-current={path === '/changes' ? 'page' : undefined}>
				<History size={18} aria-hidden="true" />
				Recent changes
			</a>
		</li>
		<li class="needs-scripts">
			<a href="/starred" aria-current={path === '/starred' ? 'page' : undefined}>
				<Star size={18} aria-hidden="true" />
				Starred pages
			</a>
		</li>
	</ul>
{/snippet}

<!-- Wide screens: a column beside the page that the reader can hide. -->
<details class="sidebar-wide no-print" bind:this={wideSidebar} {open} ontoggle={remember}>
	<summary>
		<span class="when-open"><PanelLeftClose size={20} aria-hidden="true" /> Hide sidebar</span>
		<span class="when-closed" title="Show sidebar"
			><PanelLeftOpen size={20} aria-hidden="true" /><span class="visually-hidden">Show sidebar</span></span
		>
	</summary>
	<nav aria-label="Site">
		{@render sections('wide')}
	</nav>
</details>

<!-- Phones and narrow windows: a menu bar under the masthead that opens the same list. -->
<details class="sidebar-narrow no-print">
	<summary>
		<Menu size={20} aria-hidden="true" />
		<span class="menu-word">Menu</span>
		<span class="where">{whereLabel}</span>
	</summary>
	<nav aria-label="Site">
		{@render sections('narrow')}
	</nav>
</details>

<style>
	/* ---- Shared list styles ---- */
	nav ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.sections > li > a,
	.sections > li > .unbuilt {
		display: flex;
		align-items: center;
		min-height: 2.5rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-control);
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
	}

	/* Sections whose pages are not published yet: named, not linked. */
	.sections > li > .unbuilt {
		color: var(--color-ink-muted);
		font-weight: var(--font-weight-regular);
	}

	.sections > li > a:hover,
	.outline a:hover {
		background: var(--color-surface);
		text-decoration: underline;
	}

	.sections > li.current > a {
		color: var(--color-link);
		font-weight: var(--font-weight-bold);
	}

	.workspace-links {
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}

	.group-title {
		margin: 0 0 var(--space-1);
		padding: 0 var(--space-3);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink-muted);
	}

	.workspace-links .sections > li > a {
		font-weight: var(--font-weight-regular);
	}

	.workspace-links .sections > li > a[aria-current='page'] {
		border-left: 3px solid var(--color-action);
		border-radius: 0;
		background: var(--color-surface);
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}

	.reader-links {
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}

	.reader-links a {
		gap: var(--space-2);
	}

	.reader-links a[aria-current='page'] {
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

	.outline {
		font-size: var(--font-size-small);
		border-left: 1px solid var(--color-line);
		margin-left: var(--space-3) !important;
	}

	.outline .outline {
		margin-left: var(--space-3) !important;
	}

	.outline a {
		display: flex;
		gap: var(--space-2);
		align-items: baseline;
		padding: 0.35rem var(--space-3);
		margin-left: -1px;
		border-left: 3px solid transparent;
		color: var(--color-ink-muted);
		text-decoration: none;
		line-height: 1.35;
	}

	.outline .number {
		flex: none;
		font-variant-numeric: tabular-nums;
		color: var(--color-ink-muted);
	}

	.outline .note {
		font-style: italic;
	}

	/* The page or heading being read: an orange bar and ink text. */
	.outline a.active,
	.outline a[aria-current='page'] {
		border-left-color: var(--color-action);
		background: var(--color-surface);
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}

	.outline a.active .number,
	.outline a[aria-current='page'] .number {
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
		.sidebar-wide {
			display: block;
			position: sticky;
			top: 0;
			align-self: start;
			height: 100dvh;
			overflow-y: auto;
			overscroll-behavior: contain;
			border-right: 1px solid var(--color-line);
			padding: var(--space-3) var(--space-3) var(--space-6);
			box-sizing: border-box;
		}

		.sidebar-wide > summary {
			display: flex;
			justify-content: flex-end;
			margin-bottom: var(--space-2);
		}

		.sidebar-wide > summary > span {
			display: inline-flex;
			align-items: center;
			gap: var(--space-2);
			min-height: 2.25rem;
			padding: 0 var(--space-2);
			border-radius: var(--radius-control);
			font-size: var(--font-size-small);
			color: var(--color-ink-muted);
		}

		.sidebar-wide > summary:hover > span {
			background: var(--color-surface);
			color: var(--color-ink);
		}

		.sidebar-wide .when-closed {
			display: none !important;
		}

		.sidebar-wide:not([open]) {
			padding: var(--space-3) var(--space-1);
		}

		.sidebar-wide:not([open]) > summary {
			justify-content: center;
		}

		.sidebar-wide:not([open]) .when-open {
			display: none !important;
		}

		.sidebar-wide:not([open]) .when-closed {
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

	.sidebar-narrow .sections > li > a,
	.sidebar-narrow .sections > li > .unbuilt,
	.sidebar-narrow .outline a {
		min-height: var(--layout-target-minimum);
		align-items: center;
	}

	@media (min-width: 64rem) {
		.sidebar-narrow {
			display: none;
		}
	}
</style>
