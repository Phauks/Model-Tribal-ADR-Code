<script lang="ts">
	// The masthead (site/DESIGN.md, section 6, "Masthead"). One row: the
	// sidebar button and the site's name at the left; at the right one evenly
	// spaced row of icon buttons (search, Report a problem as a flag, Star,
	// Follow, Print, Download, theme, Settings), then sign-in or the account
	// menu at the far right (Trevor, Nov. 23, 2026). Contribute left the
	// masthead for the sidebar's list of sections, so the row holds only the
	// buttons (Trevor, Nov. 24, 2026; src/lib/site-sections.ts). Star and
	// Follow show only where the page can be starred or followed; Star, Print
	// and Download act on the page the reader is on, and Download opens a list
	// of what the page offers (DownloadMenu.svelte). The site's sections are in
	// the sidebar (SiteSidebar.svelte), so the masthead has no menu row. The
	// content version shows only on paper; on screen it is in the footer.
	//
	// On wide screens a hamburger button near the page's left edge, before the
	// name, hides and shows the sidebar, so a hidden sidebar leaves nothing
	// behind on the page (Trevor, Nov. 23, 2026; sidebar/sidebar-visibility.svelte.ts).
	// It needs scripts; without them the sidebar always shows.
	//
	// On phones (Trevor approved this from the Wikiwand review, Nov. 22,
	// 2026) the masthead is one short row: the name, search, and a "More"
	// button. The other controls move, in the same order, into a panel that
	// More opens. The panel is a native popover, so it opens without scripts;
	// on wider screens CSS shows its contents in the row, and More is hidden.
	//
	// For a person who can work on the page, the page's own controls (Reading,
	// Commenting, Editing, draft changes, History and Publish) follow the
	// site's name, and while editing the editor's tools fill a second row that
	// stays at the top of the screen, so the page starts where it does for
	// readers (PageControls.svelte, src/lib/page-editing.svelte.ts; Trevor,
	// Nov. 23, 2026). On phones the page's controls lead the More panel.
	import { page } from '$app/state';
	import { siteName } from '#lib';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Menu from '@lucide/svelte/icons/menu';
	import { sidebarVisibility, toggleSidebar } from './sidebar/sidebar-visibility.svelte.ts';
	import { currentPageTools } from '#lib/page-editing.svelte.ts';
	import PageControls from './PageControls.svelte';
	import AccountLink from './AccountLink.svelte';
	import DownloadMenu from './DownloadMenu.svelte';
	import PrintOptions from './PrintOptions.svelte';
	import ReportProblem from './ReportProblem.svelte';
	import SettingsPanel from './SettingsPanel.svelte';
	import SiteSearch from './SiteSearch.svelte';
	import FollowButton from './FollowButton.svelte';
	import StarButton from './StarButton.svelte';
	import ThemeSetting from './ThemeSetting.svelte';

	let { contentVersion }: { contentVersion: string } = $props();

	/**
	 * "Report a problem" opens a dialog with the request form (ReportProblem),
	 * where the reader picks what is wrong, including "Add a nation that is
	 * missing"; without scripts it goes to the request page. On a nation or
	 * glossary page, or a story's page, it names that record, so the report
	 * says which page it is
	 * about. Trevor asked on Nov. 22, 2026 for this one link in the masthead in
	 * place of a link on each page.
	 */
	const reportLink = $derived.by(() => {
		const path = page.url.pathname;
		const nation = /^\/nations\/([^/]+)$/.exec(path)?.[1];
		const term = /^\/glossary\/([^/]+)$/.exec(path)?.[1];
		const story = /^\/stories\/([^/]+)$/.exec(path)?.[1];
		const record =
			nation && nation !== 'map' && nation !== 'recourse' && nation !== 'data' && nation !== 'timeline' && nation !== 'federal-offices'
				? `tribes/${nation}`
				: term
					? `glossary/${term}`
					: story
						? `stories/${story}`
						: path === '/glossary' || path === '/stories'
							? path.slice(1)
							: undefined;
		return record ? `/requests?record=${encodeURIComponent(record).replaceAll('%2F', '/')}` : '/requests';
	});

	let search: SiteSearch | undefined = $state();

	const tools = $derived(currentPageTools());
	let mastheadHeight = $state(0);

	// While the masthead stays at the top of the screen, the sidebar and the editor's panels start below it.
	$effect(() => {
		const root = document.documentElement.style;
		if (tools) root.setProperty('--masthead-stuck', `${mastheadHeight}px`);
		else root.removeProperty('--masthead-stuck');
		return () => root.removeProperty('--masthead-stuck');
	});
	let printOptions: PrintOptions | undefined = $state();

	/**
	 * The / key opens the search, as on Wikipedia, Wikiwand and GitHub (Trevor
	 * approved this from the Wikiwand review, Nov. 22, 2026). It is ignored
	 * while the reader types in a field or an editor, holds a modifier key, or
	 * has a dialog open.
	 */
	function openSearchFromKey(event: KeyboardEvent) {
		if (event.key !== '/' || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
		const target = event.target instanceof HTMLElement ? event.target : undefined;
		if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
		if (document.querySelector('dialog[open]')) return;
		event.preventDefault();
		search?.open();
	}
</script>

<svelte:window onkeydown={openSearchFromKey} />

<a class="skip-link" href="#main-content">Skip to main content</a>
<header class="masthead" class:is-stuck={tools !== null} bind:offsetHeight={mastheadHeight}>
	<div class="page-width masthead-row">
		<div class="masthead-start">
			<button
				type="button"
				class="icon-button sidebar-toggle needs-scripts no-print"
				aria-controls="site-sidebar"
				aria-expanded={sidebarVisibility.shown}
				title="{sidebarVisibility.shown ? 'Hide' : 'Show'} sidebar (Ctrl+\)"
				onclick={toggleSidebar}
			>
				<Menu size={24} aria-hidden="true" />
				<span class="visually-hidden">{sidebarVisibility.shown ? 'Hide' : 'Show'} sidebar</span>
			</button>
			<p class="wordmark">
				<a href="/">{siteName}</a>
				<span class="edition print-only">Draft, content {contentVersion}</span>
			</p>
			<span class="page-controls-row no-print"><PageControls place="row" /></span>
		</div>
		<div class="masthead-controls no-print">
			<SiteSearch bind:this={search} />
			<button
				class="more-button"
				type="button"
				popovertarget="masthead-more"
				aria-label="More: report a problem, star, follow, print, download, theme, settings and sign in"
			>
				<Ellipsis size={24} /><span aria-hidden="true">More</span>
			</button>
			<div class="masthead-more" id="masthead-more" popover>
				<span class="page-controls-panel"><PageControls place="panel" /></span>
				<ReportProblem link={reportLink} />
				<StarButton />
				<FollowButton />
				<PrintOptions bind:this={printOptions} />
				<DownloadMenu onpdf={() => printOptions?.open()} />
				<ThemeSetting />
				<SettingsPanel />
				<AccountLink />
			</div>
		</div>
	</div>
	{#if tools}
		<div class="page-width masthead-tools no-print">{@render tools()}</div>
	{/if}
</header>

<style>
	.skip-link {
		position: absolute;
		left: var(--space-3);
		top: -10rem;
		padding: var(--space-2) var(--space-3);
		background: var(--color-focus);
		color: var(--focus-text);
		z-index: 10;
	}

	.skip-link:focus {
		top: var(--space-3);
	}

	/* The masthead band (site/DESIGN.md, section 7). */
	.masthead {
		background: var(--color-band);
		color: var(--color-band-text);
	}

	/* While editing, the masthead and its row of tools stay at the top of the screen. */
	.masthead.is-stuck {
		position: sticky;
		top: 0;
		z-index: 6;
	}

	.masthead-tools {
		border-top: 1px solid color-mix(in srgb, var(--color-band-text) 22%, transparent);
	}

	.page-controls-row {
		display: contents;
	}

	.page-controls-panel {
		display: none;
	}

	.masthead-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-1) var(--space-5);
		/* Only a thin margin around the 44 px controls, so the band takes little height (Trevor, Nov. 23, 2026). */
		padding-top: var(--space-1);
		padding-bottom: var(--space-1);
	}

	.masthead-start {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	/* The sidebar is on wide screens only; on phones the Menu bar holds it. */
	.sidebar-toggle {
		display: none;
		color: var(--color-band-text);
	}

	/*
	 * The hamburger sits near the page's left edge, closer than the page's
	 * usual margin, with the name just after it (Trevor, Nov. 23, 2026).
	 */
	@media (min-width: 64rem) {
		:global(:root[data-scripts='on']) .sidebar-toggle {
			display: inline-grid;
		}

		:global(:root[data-scripts='on']) .masthead-row {
			padding-left: var(--space-2);
		}
	}

	.wordmark {
		margin: 0;
		display: flex;
		flex-direction: column;
	}

	.wordmark a {
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-lead);
		color: var(--color-band-text);
		text-decoration: none;
	}

	.edition {
		font-size: var(--font-size-small);
		color: var(--color-band-text);
	}

	/*
	 * Every control at the right, search through sign-in, sits in one row
	 * with one gap between each pair (Trevor, Nov. 23, 2026). The More panel's
	 * contents join that row on wide screens (display: contents overrides the
	 * popover's hidden state), and the More button is not shown.
	 */
	.masthead-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		margin-left: auto;
	}

	.masthead-more {
		display: contents;
		/*
		 * The browser's popover styles set their own colors and a fixed position;
		 * keep the band's colors and the row's flow (axe reads the position too).
		 */
		position: static;
		color: inherit;
		background: none;
	}

	.more-button {
		display: none;
	}

	/*
	 * Phones: one row with the name, search and More. More opens the panel
	 * under the masthead, in the band's colors, with the controls from the
	 * left in the same order as on wide screens.
	 */
	@media (max-width: 40rem) {
		.masthead-row {
			flex-wrap: nowrap;
			gap: var(--space-2);
		}

		.wordmark a {
			font-size: var(--font-size-body);
		}

		.more-button {
			display: inline-flex;
			align-items: center;
			gap: var(--space-1);
			min-height: var(--layout-target-minimum);
			padding: 0 var(--space-2);
			border: 0;
			border-radius: var(--radius-control);
			background: none;
			color: var(--color-band-text);
			font: inherit;
			font-weight: var(--font-weight-semibold);
			cursor: pointer;
		}

		.more-button:hover {
			background: color-mix(in srgb, currentColor 14%, transparent);
		}

		.more-button:focus-visible {
			background-color: var(--color-focus);
			color: var(--focus-text);
		}

		.page-controls-row {
			display: none;
		}

		.page-controls-panel {
			display: contents;
		}

		.masthead-more:not(:popover-open) {
			display: none;
		}

		.masthead-more:popover-open {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: var(--space-2);
			position: fixed;
			/* Just under the one-row masthead (about 3.25rem tall). */
			inset: 3.5rem var(--space-2) auto;
			max-height: calc(100dvh - 4rem);
			overflow-y: auto;
			margin: 0;
			padding: var(--space-4);
			border: 1px solid var(--color-band-text);
			border-radius: var(--radius-panel);
			background: var(--color-band);
			color: var(--color-band-text);
		}
	}

	/* On paper the band is not filled, so the site's name prints in ink. */
	@media print {
		.masthead,
		.wordmark a,
		.edition {
			background: none;
			color: var(--color-ink);
		}
	}
</style>
