<script lang="ts">
	// Self-hosted type (site/DESIGN.md, section 7): Atkinson Hyperlegible Next
	// in the three weights the site uses, then Noto fonts that the browser
	// downloads only for characters Atkinson Hyperlegible Next lacks, through
	// each file's unicode-range. Noto Serif and OpenDyslexic are the other
	// fonts a reader can pick in Settings; a browser downloads them only when
	// a reader picks one, and the service worker then keeps them for offline use.
	import '@fontsource/atkinson-hyperlegible-next/400.css';
	import '@fontsource/atkinson-hyperlegible-next/400-italic.css';
	import '@fontsource/atkinson-hyperlegible-next/600.css';
	import '@fontsource/atkinson-hyperlegible-next/700.css';
	import '@fontsource/noto-sans/400.css';
	import '@fontsource/noto-sans/700.css';
	import '@fontsource/noto-sans-cherokee/400.css';
	import '@fontsource/noto-sans-cherokee/700.css';
	import '@fontsource/noto-sans-osage/400.css';
	import '@fontsource/noto-sans-canadian-aboriginal/400.css';
	import '@fontsource/noto-sans-canadian-aboriginal/700.css';
	import '@fontsource/noto-serif/400.css';
	import '@fontsource/noto-serif/400-italic.css';
	import '@fontsource/noto-serif/600.css';
	import '@fontsource/noto-serif/700.css';
	import '@fontsource/opendyslexic/400.css';
	import '@fontsource/opendyslexic/400-italic.css';
	import '@fontsource/opendyslexic/700.css';
	import '@fontsource/opendyslexic/700-italic.css';
	import 'virtual:design-tokens.css';
	import '#lib/styles/global.css';
	import { siteName } from '#lib';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import SiteSidebar from '#lib/components/SiteSidebar.svelte';
	import PrintDetails from '#lib/components/PrintDetails.svelte';
	import OfflineNotice from '#lib/components/OfflineNotice.svelte';
	import UpdateNotice from '#lib/components/UpdateNotice.svelte';
	import InlineNotes from '#lib/components/InlineNotes.svelte';
	import GlossaryCards from '#lib/components/GlossaryCards.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

</script>

<svelte:head>
	<meta name="robots" content="noindex" />
	<meta name="theme-color" content={data.themeColor.light} media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content={data.themeColor.dark} media="(prefers-color-scheme: dark)" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="icon" href="/icon.svg" type="image/svg+xml" />
	<meta name="application-name" content={siteName} />
</svelte:head>

<SiteHeader contentVersion={data.versions.content} />
<PrintDetails />
<OfflineNotice contentVersion={data.versions.content} />
<UpdateNotice versions={data.versions} />
<div class="site-body">
	<SiteSidebar />
	<main id="main-content" class="page-width" tabindex="-1">
		{@render children()}
	</main>
</div>
<SiteFooter versions={data.versions} />
<InlineNotes />
<GlossaryCards />

<style>
	/*
	 * Wide screens: the sidebar and the page side by side. The page is a size
	 * container, so a page's own two-column layout (such as a nation's "At a
	 * glance") follows the width it actually has, whether the sidebar is shown
	 * or hidden.
	 */
	main {
		container: page / inline-size;
		min-width: 0;
		padding-top: var(--space-3);
	}

	@media (min-width: 64rem) {
		.site-body {
			display: grid;
			grid-template-columns: 18rem minmax(0, 1fr);
			align-items: start;
		}

		.site-body:has(> :global(.sidebar-wide:not([open]))) {
			grid-template-columns: 3.5rem minmax(0, 1fr);
		}
	}

	@media print {
		.site-body {
			display: block;
		}
	}
</style>
