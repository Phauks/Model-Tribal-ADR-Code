<script lang="ts">
	import { openToSearchEngines } from '#lib/search-engines.ts';
	// Self-hosted type (site/DESIGN.md, section 7): Atkinson Hyperlegible Next
	// in the three weights the site uses, then Noto fonts that the browser
	// downloads only for characters Atkinson Hyperlegible Next lacks, through
	// each file's unicode-range. Noto Serif and OpenDyslexic are the other
	// fonts a reader can pick in Settings; a browser downloads them only when
	// a reader picks one, and the service worker then keeps them for offline use.
	// OpenDyslexic's faces are a style sheet of their own, read only when a reader picks it or opens Settings (src/routes/opendyslexic.css, src/lib/reading-settings.ts).
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
	import 'virtual:design-tokens.css';
	import '#lib/styles/global.css';
	import { siteName } from '#lib';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import SiteSidebar from '#lib/components/SiteSidebar.svelte';
	import SectionBar from '#lib/components/SectionBar.svelte';
	import PrintDetails from '#lib/components/PrintDetails.svelte';
	import OfflineNotice from '#lib/components/OfflineNotice.svelte';
	import UpdateNotice from '#lib/components/UpdateNotice.svelte';
	import InlineNotes from '#lib/components/InlineNotes.svelte';
	import CitationPopup from '#lib/components/CitationPopup.svelte';
	import LinkPreviews from '#lib/components/LinkPreviews.svelte';
	import ImageViewer from '#lib/components/ImageViewer.svelte';
	import SiteTextEditor from '#lib/components/SiteTextEditor.svelte';
	import PageComments from '#lib/components/PageComments.svelte';
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { crossFadePages, startMotion } from '#lib/motion.ts';
	import { copyHashOnClick } from '#lib/copy-hash.ts';
	import { toggleReadingLinks } from '#lib/reading-links.ts';
	import { resizableTables } from '#lib/tables/resizable-columns.ts';
	import { markPageStarted } from '#lib/page-started.ts';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	// Pages cross-fade, and printing finishes any movement first (src/lib/motion.ts).
	onNavigate(crossFadePages);
	onMount(startMotion);
	// The book icon after a citation opens the list of places to read it, on any page (src/lib/reading-links.ts).
	onMount(() => {
		document.addEventListener('click', toggleReadingLinks);
		return () => document.removeEventListener('click', toggleReadingLinks);
	});
	// A click on a SHA-256 copies it, on any page (src/lib/copy-hash.ts).
	onMount(() => {
		const copy = (event: MouseEvent) => void copyHashOnClick(event);
		document.addEventListener('click', copy);
		return () => document.removeEventListener('click', copy);
	});
	// The layout's own start comes after every part inside it has started (src/lib/page-started.ts).
	onMount(markPageStarted);

	// A video call has the whole window: no header, sidebar or footer
	// (Trevor, Nov. 23, 2026). Links to these pages open them in a new tab.
	const callPages = new Set(['/rooms/[room]', '/rooms/[room]/invite/[secret]', '/events/[slug]/room']);
	const call = $derived(callPages.has(page.route.id ?? ''));

</script>

<svelte:head>
	<!-- Until the first release (src/lib/search-engines.ts). -->
	{#if !openToSearchEngines}<meta name="robots" content="noindex" />{/if}
	<meta name="theme-color" content={data.themeColor.light} media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content={data.themeColor.dark} media="(prefers-color-scheme: dark)" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="icon" href="/icon.svg" type="image/svg+xml" />
	<meta name="application-name" content={siteName} />
</svelte:head>

{#if call}
	<main id="main-content" class="call-page" tabindex="-1">
		{@render children()}
	</main>
{:else}
	<SiteHeader contentVersion={data.versions.content} />
	<!-- The site's six sections in a row under the masthead, on wide screens (SectionBar.svelte). -->
	<SectionBar />
	<PrintDetails />
	<OfflineNotice contentVersion={data.versions.content} />
	<UpdateNotice versions={data.versions} />
	<div class="site-body">
		<SiteSidebar />
		<main id="main-content" class="page-width" tabindex="-1" {@attach resizableTables}>
			{@render children()}
		</main>
	</div>
	<SiteFooter versions={data.versions} />
	<InlineNotes />
	<CitationPopup />
	<LinkPreviews />
	<ImageViewer />
	<SiteTextEditor />
	<PageComments />
{/if}

<style>
	/*
	 * Wide screens: the sidebar and the page side by side. The page is a size
	 * container, so a page's own two-column layout (such as a nation's "At a
	 * glance") follows the width it actually has, whether the sidebar is shown
	 * or hidden.
	 */
	/* The space before the footer is inside the page, so the sidebar's column
	   reaches the footer and its Hide sidebar button sits just above it at the
	   end of a page, not over empty space (Trevor, Nov. 23, 2026). */
	/* A call fills the window; the room's own bar is at the top and the call takes the rest. */
	main.call-page {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-height: 100dvh;
		padding: var(--space-2) var(--space-3);
	}

	/* Before joining, the notice and the join form keep a reading width. */
	main.call-page > :global(.panel),
	main.call-page > :global(.notice) {
		max-width: var(--layout-measure);
	}

	main:not(.call-page) {
		container: page / inline-size;
		min-width: 0;
		padding-top: var(--space-3);
		padding-bottom: var(--space-8);
	}

	@media (min-width: 64rem) {
		/* At least one screen tall, so on a short page the footer starts below the
		   first screen and the Hide sidebar button keeps its place at the bottom. */
		.site-body {
			display: grid;
			/* One width on every page, so the page never moves from page to page
			   (SiteSidebar.svelte; design/navigation-models, model C). */
			grid-template-columns: 16rem minmax(0, 1fr);
			align-items: start;
			min-height: 100dvh;
		}

		/* Hidden with the masthead's button, the sidebar is gone and the page takes the whole width. */
		:global(:root[data-sidebar-hidden='true']) .site-body {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media print {
		.site-body {
			display: block;
		}
	}
</style>
