<script lang="ts">
	// The masthead (site/DESIGN.md, section 6, "Masthead"). One row: the
	// site's name, Report a problem and Contribute, then the reader's controls:
	// search, Print and Download as icons (Download only where the page has a
	// file), theme, Settings, and sign-in or the account menu at the far right
	// (Trevor, Nov. 22, 2026). Print and Download act on the page the reader is on. The
	// site's sections are in the sidebar (SiteSidebar.svelte), so the masthead
	// has no menu row. The content version shows only on paper; on screen it
	// is in the footer.
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

	/**
	 * "Report a problem" goes to the request form, where the reader picks
	 * what is wrong, including "Add a nation that is missing". On a nation or
	 * glossary page it names that record, so the report says which page it is
	 * about. Trevor asked on Nov. 22, 2026 for this one link in the masthead in
	 * place of a link on each page.
	 */
	const reportLink = $derived.by(() => {
		const path = page.url.pathname;
		const nation = /^\/nations\/([^/]+)$/.exec(path)?.[1];
		const term = /^\/glossary\/([^/]+)$/.exec(path)?.[1];
		const record =
			nation && nation !== 'map'
				? `tribes/${nation}`
				: term
					? `glossary/${term}`
					: path === '/glossary'
						? 'glossary'
						: undefined;
		return record ? `/requests?record=${encodeURIComponent(record).replaceAll('%2F', '/')}` : '/requests';
	});

	const download = $derived(downloadFor(page.url.pathname));
</script>

<a class="skip-link" href="#main-content">Skip to main content</a>
<header class="masthead">
	<div class="page-width masthead-top">
		<p class="wordmark">
			<a href="/">{siteName}</a>
			<span class="edition print-only">Draft, content {contentVersion}</span>
		</p>
		<ul class="masthead-actions no-print">
			<li><a class="report-link" href={reportLink}>Report a problem</a></li>
			<li><a class="button" href="/requests?kind=contribute">Contribute</a></li>
		</ul>
		<div class="masthead-tools no-print">
			<SiteSearch />
			<PrintOptions />
			{#if download}
				<a
					class="icon-button download-link"
					href={download.link}
					download
					aria-label="{download.label} ({download.format})"
					title="{download.label} ({download.format})"
				>
					<Download size={24} />
				</a>
			{/if}
			<ThemeSetting />
			<SettingsPanel />
			<AccountLink />
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
		flex: 0 1 auto;
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

	/* Print, Download, Report a problem and Contribute, before the controls. */
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

	/* Download is a link styled as an icon button, in the band's text color. */
	.download-link,
	.download-link:visited {
		color: var(--color-band-text);
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
