<script lang="ts">
	// The masthead (site/DESIGN.md, section 6, "Masthead"). Two rows: the
	// site's name, the search box and the reader's controls (theme, Settings,
	// then sign-in or the account menu at the far right); under them, the main
	// menu and Contribute. Print and Download act on one page, so they sit on
	// that page (PageTools.svelte), not here.
	import { page } from '$app/state';
	import { siteName } from '#lib';
	import AccountLink from './AccountLink.svelte';
	import SettingsPanel from './SettingsPanel.svelte';
	import SiteSearch from './SiteSearch.svelte';
	import ThemeSetting from './ThemeSetting.svelte';

	let { contentVersion }: { contentVersion: string } = $props();

	// Only pages that exist are listed. "The code", "Peacemaking", "Sources"
	// and "About" join the menu when their pages are built (site/DESIGN.md,
	// section 4). Downloads and the changelog are linked from the footer.
	const menu = [
		{ label: 'Nations', link: '/nations' },
		{ label: 'Glossary', link: '/glossary' }
	];

	function isCurrent(link: string): boolean {
		const path = page.url.pathname;
		return path === link || path.startsWith(`${link}/`);
	}
</script>

<a class="skip-link" href="#main-content">Skip to main content</a>
<header class="masthead">
	<div class="page-width masthead-top">
		<p class="wordmark">
			<a href="/">{siteName}</a>
			<span class="edition">Draft, content {contentVersion}</span>
		</p>
		<div class="masthead-search no-print">
			<SiteSearch />
		</div>
		<div class="masthead-tools no-print">
			<ThemeSetting />
			<SettingsPanel />
			<AccountLink />
		</div>
	</div>
	<div class="masthead-menu no-print">
		<nav aria-label="Main" class="page-width">
			<ul>
				{#each menu as item (item.link)}
					<li>
						<a href={item.link} aria-current={isCurrent(item.link) ? 'page' : undefined}>
							{item.label}
						</a>
					</li>
				{/each}
				<li class="contribute"><a class="button" href="/requests?kind=contribute">Contribute</a></li>
			</ul>
		</nav>
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

	/*
	 * Wide screens: name, search and controls on one line. Narrow screens: the
	 * name and controls share the first line and the search box takes the
	 * whole second line, so it never shrinks below a usable width.
	 */
	.masthead-top {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		grid-template-areas: 'name search tools';
		align-items: center;
		gap: var(--space-3) var(--space-5);
		padding-top: var(--space-3);
		padding-bottom: var(--space-3);
	}

	.wordmark {
		grid-area: name;
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

	.masthead-search {
		grid-area: search;
		display: flex;
		justify-content: center;
	}

	.masthead-tools {
		grid-area: tools;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
	}

	@media (max-width: 60rem) {
		.masthead-top {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas:
				'name tools'
				'search search';
		}

		.masthead-search {
			justify-content: stretch;
		}

		.masthead-search :global(.site-search) {
			max-width: none;
		}
	}

	/* Phones: the name gets its own line, then the controls, then the search box. */
	@media (max-width: 40rem) {
		.masthead-top {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas:
				'name'
				'tools'
				'search';
		}

		.masthead-tools {
			justify-content: flex-start;
		}
	}

	/* The menu row: a thin rule divides it from the row above. */
	.masthead-menu {
		border-top: 1px solid color-mix(in srgb, var(--color-band-text) 25%, transparent);
	}

	nav ul {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-5);
		list-style: none;
		margin: 0;
		padding: var(--space-1) 0;
	}

	nav .contribute {
		margin-left: auto;
	}

	nav a:not(.button) {
		display: inline-flex;
		align-items: center;
		min-height: var(--layout-target-minimum);
		color: var(--color-band-text);
		text-decoration: none;
		font-weight: var(--font-weight-semibold);
		border-bottom: 3px solid transparent;
	}

	nav a:not(.button):hover {
		border-bottom-color: var(--color-band-text);
	}

	nav a[aria-current='page'] {
		border-bottom-color: var(--color-band-text);
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
