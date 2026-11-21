<script lang="ts">
	import { page } from '$app/state';
	import { siteName } from '#lib';
	import AccountLink from './AccountLink.svelte';
	import SettingsPanel from './SettingsPanel.svelte';
	import ThemeSetting from './ThemeSetting.svelte';

	let { contentVersion }: { contentVersion: string } = $props();

	// Only pages that exist are listed. "The code", "Peacemaking", "Sources"
	// and "About" join the menu when their pages are built (site/DESIGN.md, section 4).
	const menu = [
		{ label: 'Nations', link: '/nations' },
		{ label: 'Glossary', link: '/glossary' },
		{ label: 'Downloads', link: '/downloads' },
		{ label: 'Changelog', link: '/changelog' }
	];

	function isCurrent(link: string): boolean {
		const path = page.url.pathname;
		return path === link || path.startsWith(`${link}/`);
	}
</script>

<a class="skip-link" href="#main-content">Skip to main content</a>
<header class="masthead">
	<div class="page-width masthead-inner">
		<p class="wordmark">
			<a href="/">{siteName}</a>
			<span class="edition">Draft, content {contentVersion}</span>
		</p>
		<nav aria-label="Main">
			<ul>
				{#each menu as item (item.link)}
					<li>
						<a href={item.link} aria-current={isCurrent(item.link) ? 'page' : undefined}>
							{item.label}
						</a>
					</li>
				{/each}
				<li><a class="button contribute" href="/requests?kind=contribute">Contribute</a></li>
			</ul>
		</nav>
		<div class="masthead-tools">
			<AccountLink />
			<ThemeSetting />
			<SettingsPanel />
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

	.masthead-inner {
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

	.masthead-tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-left: auto;
	}

	.edition {
		font-size: var(--font-size-small);
		color: var(--color-band-text);
	}

	nav ul {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-4);
		list-style: none;
		margin: 0;
		padding: 0;
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
</style>
