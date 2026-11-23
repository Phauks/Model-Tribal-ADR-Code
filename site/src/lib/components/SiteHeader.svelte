<script lang="ts">
	// The masthead (site/DESIGN.md, section 6, "Masthead"). One row: the
	// site's name, Report a problem and Contribute, then the reader's controls:
	// search, Star, Follow, Print and Download as icons (Star and Follow only where the page can
	// be starred or followed), theme, Settings, and sign-in or the account menu at the far right
	// (Trevor, Nov. 22, 2026). Star, Print and Download act on the page the reader is on;
	// Download opens a list of what the page offers (DownloadMenu.svelte). The
	// site's sections are in the sidebar (SiteSidebar.svelte), so the masthead
	// has no menu row. The content version shows only on paper; on screen it
	// is in the footer.
	//
	// On phones (Trevor approved this from the Wikiwand review, Nov. 22,
	// 2026) the masthead is one short row: the name, search, and a "More"
	// button. Report a problem, Contribute, Star, Print, Download, theme,
	// Settings and sign-in move into a panel that More opens. The panel is a native
	// popover, so it opens without scripts; on wider screens CSS shows its
	// contents in the row as before, and the More button is hidden.
	import { page } from '$app/state';
	import { siteName } from '#lib';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
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
			nation && nation !== 'map' && nation !== 'recourse' && nation !== 'data' && nation !== 'timeline'
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
<header class="masthead">
	<div class="page-width masthead-top">
		<p class="wordmark">
			<a href="/">{siteName}</a>
			<span class="edition print-only">Draft, content {contentVersion}</span>
		</p>
		<div class="masthead-phone no-print">
			<SiteSearch bind:this={search} />
			<button
				class="more-button"
				type="button"
				popovertarget="masthead-more"
				aria-label="More: report a problem, contribute, star, follow, print, download, settings and sign in"
			>
				<Ellipsis size={24} /><span aria-hidden="true">More</span>
			</button>
		</div>
		<div class="masthead-more no-print" id="masthead-more" popover>
			<ul class="masthead-actions">
				<li><ReportProblem link={reportLink} /></li>
				<li><a class="button" href="/requests?kind=contribute">Contribute</a></li>
			</ul>
			<div class="masthead-tools">
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

	.masthead-top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-1) var(--space-5);
		/* Only a thin margin around the 44 px controls, so the band takes little height (Trevor, Nov. 23, 2026). */
		padding-top: var(--space-1);
		padding-bottom: var(--space-1);
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
	 * Wide screens: the More panel's contents sit in the row as flex items of
	 * .masthead-top (display: contents overrides the popover's hidden state),
	 * in the approved order: name, Report a problem and Contribute, search,
	 * then the other controls. The More button is not shown.
	 */
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

	.masthead-actions {
		order: 1;
	}

	.masthead-phone {
		order: 2;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.masthead-tools {
		order: 3;
	}

	.more-button {
		display: none;
	}

	/*
	 * Phones: one row with the name, search and More. More opens the panel
	 * under the masthead, in the band's colors, with the actions and controls
	 * from the left.
	 */
	@media (max-width: 40rem) {
		.masthead-top {
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

		.masthead-more:not(:popover-open) {
			display: none;
		}

		.masthead-more:popover-open {
			display: flex;
			flex-direction: column;
			gap: var(--space-4);
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

	/* The controls keep to the right; an open search box grows to their left. */
	.masthead-tools {
		display: flex;
		flex: 0 1 auto;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
	}

	@media (max-width: 40rem) {
		.masthead-tools {
			justify-content: flex-start;
		}
	}

	/* Report a problem and Contribute, before the controls. */
	.masthead-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2) var(--space-4);
		list-style: none;
		margin: 0 0 0 auto;
		padding: 0;
	}

	.masthead-actions a:not(.button) {
		display: inline-flex;
		align-items: center;
		min-height: var(--layout-target-minimum);
		color: var(--color-band-text);
		text-decoration: none;
		font-weight: var(--font-weight-semibold);
	}

	.masthead-actions a:not(.button):hover {
		text-decoration: underline;
	}

	/* Phones: the name, then the actions, then the controls, each from the left. */
	@media (max-width: 40rem) {
		.masthead-actions {
			margin-left: 0;
			justify-content: flex-start;
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
