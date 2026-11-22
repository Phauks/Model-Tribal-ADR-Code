<script lang="ts">
	// The masthead (site/DESIGN.md, section 6, "Masthead"). Two rows: the
	// site's name, then the reader's controls (search, theme, Settings, then
	// sign-in or the account menu at the far right); under them, the main menu
	// and, at its right end, Print, Download (where the page has a file),
	// Report a problem and Contribute (Trevor, Nov. 22, 2026). Print and
	// Download act on the page the reader is on. The content version shows
	// only on paper; on screen it is in the footer.
	import { page } from '$app/state';
	import { siteName } from '#lib';
	import Download from '@lucide/svelte/icons/download';
	import { downloadFor } from '#lib/page-downloads.ts';
	import AccountLink from './AccountLink.svelte';
	import PrintOptions from './PrintOptions.svelte';
	import SettingsPanel from './SettingsPanel.svelte';
	import SiteSearch from './SiteSearch.svelte';
	import ThemeSetting from './ThemeSetting.svelte';

	let { contentVersion }: { contentVersion: string } = $props();

	// Only pages that exist are listed. "The code", "Peacemaking", "Sources"
	// and "About" join the menu when their pages are built (site/DESIGN.md,
	// section 4). Downloads and the changelog are linked from the footer.
	const menu = [
		{ label: 'Nations', link: '/nations' },
		{ label: 'Stories', link: '/stories' },
		{ label: 'Glossary', link: '/glossary' }
	];

	/**
	 * "Report a problem" goes to the request form, where the reader picks
	 * what is wrong, including "Add a nation that is missing". On a nation or
	 * glossary page, or a story's page, it names that record, so the report says which page it is
	 * about. Trevor asked on Nov. 22, 2026 for this one link in the masthead in
	 * place of a link on each page.
	 */
	const reportLink = $derived.by(() => {
		const path = page.url.pathname;
		const nation = /^\/nations\/([^/]+)$/.exec(path)?.[1];
		const term = /^\/glossary\/([^/]+)$/.exec(path)?.[1];
		const story = /^\/stories\/([^/]+)$/.exec(path)?.[1];
		const record =
			nation && nation !== 'map'
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

	const download = $derived(downloadFor(page.url.pathname));

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
			<span class="edition print-only">Draft, content {contentVersion}</span>
		</p>
		<div class="masthead-tools no-print">
			<SiteSearch />
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
				<li class="page-actions"><PrintOptions /></li>
				{#if download}
					<li>
						<a class="download-link" href={download.link} download>
							<Download size={20} strokeWidth={1.75} />
							<span>{download.label} <span class="format">({download.format})</span></span>
						</a>
					</li>
				{/if}
				<li><a href={reportLink}>Report a problem</a></li>
				<li><a class="button" href="/requests?kind=contribute">Contribute</a></li>
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

	.masthead-top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3) var(--space-5);
		padding-top: var(--space-3);
		padding-bottom: var(--space-3);
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

	/* The controls keep to the right; an open search box grows to their left. */
	.masthead-tools {
		display: flex;
		flex: 1 1 auto;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
	}

	/* Phones: an open search box takes a line of its own above the buttons. */
	@media (max-width: 40rem) {
		.masthead-tools {
			justify-content: flex-start;
		}

		.masthead-tools > :global(.site-search) {
			flex: 1 0 100%;
			width: 100%;
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

	nav .page-actions {
		margin-left: auto;
	}

	nav .download-link {
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-band-text);
		border-radius: var(--radius-control);
	}

	nav .download-link:hover {
		border-bottom-color: var(--color-band-text);
		text-decoration: underline;
	}

	.format {
		font-weight: var(--font-weight-regular);
		font-size: var(--font-size-small);
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
