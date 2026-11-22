<script lang="ts">
	import { onMount } from 'svelte';
	import { repositoryLink } from '#lib';
	import Download from '@lucide/svelte/icons/download';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// A downloaded book or ebook prints this page's address with its own
	// edition, as /downloads?edition=0.2.0, so a reader can check whether a
	// newer edition is out (site/DESIGN.md, section 10, "Updates"). The page is
	// built ahead of time, so the address is read in the browser.
	let readerEdition = $state<string | undefined>();

	onMount(() => {
		const edition = new URLSearchParams(location.search).get('edition')?.trim();
		if (edition && /^\d+\.\d+\.\d+$/.test(edition)) readerEdition = edition;
	});

	function isOlder(have: string, current: string): boolean {
		const a = have.split('.').map(Number);
		const b = current.split('.').map(Number);
		for (let index = 0; index < 3; index += 1) {
			if (a[index] !== b[index]) return a[index] < b[index];
		}
		return false;
	}
</script>

<svelte:head>
	<title>Downloads · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Downloads</h1>
	<p class="lead">
		The book and the data behind this site, to keep, print or share.
	</p>

	{#if readerEdition}
		<div class="notice" role="note">
			{#if isOlder(readerEdition, data.versions.print)}
				<p>
					You have edition {readerEdition} of the book. A newer edition, {data.versions.print}, is
					out. <a href="/changelog">See what changed</a>.
				</p>
			{:else}
				<p>
					You have edition {readerEdition} of the book. That is the current edition.
				</p>
			{/if}
		</div>
	{/if}

	<!-- Empty state: says what will appear and when (site/DESIGN.md, section 12). -->
	<section class="panel panel-filled empty-state" aria-labelledby="nothing-yet-heading">
		<h2 id="nothing-yet-heading">
			<Download size={24} />
			Nothing to download yet
		</h2>
		<p>
			Downloads will appear here when the first edition is released. Each one will name its version
			and the date it was made.
		</p>
	</section>

	<h2>What this page will offer</h2>
	<ul>
		<li>The book as a PDF, for printing or reading on a screen.</li>
		<li>The book as an EPUB ebook, for e-readers and reading apps.</li>
		<li>
			The data behind the site, such as the nation profiles, the glossary and the sources, in open
			file formats.
		</li>
	</ul>
	<p>
		Material that a nation has asked the project to restrict is never included in a download.
	</p>

	<h2>Until then</h2>
	<p>
		Every page of this site can be saved on your device and read without a connection. See
		<a href="/offline">Read offline</a>. The files the site is built from are public on
		<a href={repositoryLink}>GitHub</a>.
	</p>
</div>

<style>
	.empty-state h2 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: 0;
		/* At the largest text size in a wide font, a long word breaks rather
		   than widening the page (WCAG 1.4.10). */
		overflow-wrap: anywhere;
	}
</style>
