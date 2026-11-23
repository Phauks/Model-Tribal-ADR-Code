<script lang="ts">
	import { onMount } from 'svelte';
	import { version } from '$app/env';
	import Download from '@lucide/svelte/icons/download';
	import { buildTime } from '#lib/offline-collections.ts';
	import { citationDate } from '#lib/page-downloads.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// A downloaded book or ebook prints this page's address with its own
	// edition, as /downloads?edition=0.2.0, so a reader can check whether a
	// newer edition is out (site/DESIGN.md, section 10, "Updates"). The page is
	// built ahead of time, so the address is read in the browser.
	let readerEdition = $state<string | undefined>();
	const built = buildTime(version);

	// The files a reader can keep today, each built with the site (Trevor asked on Nov. 23, 2026
	// that this page list what may be downloaded). Copies of documents are listed, not bundled:
	// each copy opens from its own page.
	const groups: {
		heading: string;
		lead: string;
		files: { label: string; description: string; links: { format: string; href: string }[] }[];
		after: string;
	}[] = [
		{
			heading: 'Data',
			lead: 'The facts behind the site, each with its source.',
			files: [
				{
					label: 'The list of nations',
					description: 'Every nation and community with its recognition and states',
					links: [{ format: 'CSV', href: '/nations/nations.csv' }]
				},
				{
					label: 'Dispute resolution provisions',
					description: 'The provisions behind Find recourse, with their citations',
					links: [
						{ format: 'CSV', href: '/nations/recourse/provisions.csv' },
						{ format: 'JSON', href: '/nations/recourse/provisions.json' }
					]
				},
				{
					label: 'The glossary',
					description: 'Every term with its short definition',
					links: [{ format: 'JSON', href: '/glossary/terms.json' }]
				}
			],
			after: 'A single nation’s record and its sources are in the Download menu on the nation’s page.'
		},
		{
			heading: 'Documents',
			lead: 'Copies of documents we cite and are allowed to share, each with where it came from.',
			files: [
				{
					label: 'The list of every document we hold',
					description: 'Title, nation, our copy, where it was published, the date it was saved and its fingerprint',
					links: [{ format: 'CSV', href: '/copies/list.csv' }]
				}
			],
			after: 'Each copy opens from the list, or from the page that cites it. If a nation asks us to remove a document, it leaves the site and this list at the next update.'
		}
	];

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
		Files to keep, open in a spreadsheet or share.
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

	<p class="muted">
		{#if built}Made {citationDate(built)}, content version {data.versions.content}.{:else}Content version {data.versions.content}.{/if}
		To read the site without a connection instead, see <a href="/offline">Read offline</a>.
	</p>

	{#each groups as group (group.heading)}
		<h2>{group.heading}</h2>
		<p>{group.lead}</p>
		<ul class="files">
			{#each group.files as file (file.label)}
				<li>
					<div class="file-text">
						<h3>{file.label}</h3>
						<p class="hint">{file.description}</p>
					</div>
					<p class="file-links">
						{#each file.links as link (link.href)}
							<a class="button button-quiet" href={link.href} download>
								<Download size={18} aria-hidden="true" />
								{link.format}<span class="visually-hidden">, {file.label}</span>
							</a>
						{/each}
					</p>
				</li>
			{/each}
		</ul>
		<p class="hint">{group.after}</p>
	{/each}

	<!-- Empty state: says what will appear and when (site/DESIGN.md, section 12). -->
	<section class="panel panel-filled empty-state" aria-labelledby="book-heading">
		<h2 id="book-heading">The book</h2>
		<p>
			Not out yet. The first edition will appear here as a PDF for printing and an EPUB for e-readers,
			each with its edition number and the date it was made.
		</p>
	</section>

	<h2>Never in a download</h2>
	<ul>
		<li>Material a nation has asked us to restrict</li>
		<li>A nation’s seal or logo</li>
		<li>
			Documents held by the National Indian Law Library or by code publishers, and articles and
			books: the files give their links
		</li>
		<li>Video and sound</li>
		<li>Anything about the people who use the site</li>
	</ul>
</div>

<style>
	.files {
		list-style: none;
		padding: 0;
		margin: 0 0 var(--space-2);
		border-top: 1px solid var(--color-line);
	}

	.files li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.file-text {
		flex: 1 1 20rem;
		min-width: 0;
	}

	.file-text h3 {
		margin: 0;
		font-size: var(--font-size-body);
	}

	.file-text p,
	.file-links {
		margin: 0;
	}

	.file-links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.file-links a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.empty-state {
		margin-top: var(--space-5);
	}

	.empty-state h2 {
		margin-top: 0;
		/* At the largest text size in a wide font, a long word breaks rather
		   than widening the page (WCAG 1.4.10). */
		overflow-wrap: anywhere;
	}
</style>
