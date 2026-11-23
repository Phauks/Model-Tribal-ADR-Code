<script lang="ts">
	import { onMount } from 'svelte';
	import { version } from '$app/env';
	import Download from '@lucide/svelte/icons/download';
	import { buildTime, formatBytes } from '#lib/offline-collections.ts';
	import { citationDate, mapFiles, pageFormats } from '#lib/page-downloads.ts';
	import { checksumsTextAddress, downloadChecksums, fileName, verifyAddress, verifyLink, type ChecksumEntry } from '#lib/checksums.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// A downloaded book or ebook prints this page's address with its own
	// edition, as /downloads?edition=0.2.0, so a reader can check whether a
	// newer edition is out (site/DESIGN.md, section 10, "Updates"). The page is
	// built ahead of time, so the address is read in the browser.
	let readerEdition = $state<string | undefined>();
	// Each file's SHA-256 (src/lib/checksums.ts), written after the build, so read in the browser.
	let hashes = $state<Record<string, ChecksumEntry>>({});
	const built = buildTime(version);

	// The files a reader can keep today, each built with the site (Trevor asked on Nov. 23, 2026
	// that this page list what may be downloaded). Copies of documents are listed, not bundled:
	// each copy opens from its own page.
	const numbers = new Intl.NumberFormat('en-US');
	const groups: {
		heading: string;
		lead: string;
		files: { label: string; description: string; links: { format: string; href: string }[]; checking?: string }[];
		after: string;
	}[] = $derived([
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
				},
				{
					label: 'All the data in one file',
					description: 'Every nation’s record and sources, the list of nations, the provisions, the glossary and the stories',
					links: [{ format: 'ZIP', href: '/zip/data.zip' }]
				}
			],
			after: 'A single nation’s record and its sources are in the Download menu on the nation’s page. In the ZIP file, a story’s full text is included where it is in the public domain or a nation’s law; for the others, the file gives the story’s page.'
		},
		{
			heading: 'Maps',
			lead: 'The map’s layers, for mapping programs such as QGIS or ArcGIS.',
			// The same list the map page's Download menu offers (src/lib/page-downloads.ts).
			files: mapFiles.map((file) => ({ label: file.label, description: file.description, links: [{ format: file.format, href: file.link }] })),
			after: 'Simplified for a national map. The land areas are the Census Bureau’s, not a statement of any nation’s territory, and an area a nation asked to leave off the map is left out.'
		},
		{
			heading: 'Documents',
			lead: 'Copies of documents we cite and are allowed to share, each with where it came from.',
			files: [
				{
					label: 'United States laws and government documents',
					description: `${numbers.format(data.federalDocuments.count)} statutes, regulations and reports, free for anyone to share, about ${formatBytes(data.federalDocuments.bytes)}`,
					links: [{ format: 'ZIP', href: '/zip/united-states-documents.zip' }],
					checking: 'Put together when you ask for it, so it has no SHA-256 of its own. Inside, SHA256SUMS.txt and documents.csv give the SHA-256 of every document.'
				},
				{
					label: 'The list of every document we hold',
					description: 'Title, nation, our copy, where it was published, the date it was saved and its SHA-256',
					links: [{ format: 'CSV', href: '/copies/list.csv' }]
				}
			],
			after: `A nation’s constitutions, laws and court opinions download as a ZIP from the nation’s page, under “Laws and agreements”; we hold them for ${numbers.format(data.nationsWithDocuments)} nations. If a nation asks us to remove a document, it leaves the site and these files at the next update. A file you already downloaded cannot be changed, so check this page for the current version.`
		}
	]);

	onMount(() => {
		void downloadChecksums().then((list) => (hashes = list?.files ?? {}));
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
	<p>
		Any page can also be saved from its Download menu as a PDF or as {pageFormats.map((format) => format.format).join(', ').replace(/, ([^,]*)$/, ' or $1')}. A nation’s page also offers its record, its sources for citation managers (CSL JSON, RIS and BibTeX) and its offices’ contact cards.
	</p>
	<p>
		Each file’s SHA-256 is shown with it, so you can check that a file you downloaded is the one published here, unchanged. <a href={verifyAddress}>Verify a file</a> does it in your browser without uploading anything, and <a href={checksumsTextAddress} download>checksums.txt</a> lists every file.
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
					{#if file.checking}
						<p class="hint file-hashes">{file.checking}</p>
					{:else if file.links.some((link) => hashes[link.href])}
						<ul class="file-hashes">
							{#each file.links as link (link.href)}
								{#if hashes[link.href]}
									<li>
										<span class="hint">SHA-256{file.links.length > 1 ? ` (${link.format})` : ''}</span>
										<a href={verifyLink(hashes[link.href].sha256, fileName(link.href))}>Check your copy<span class="visually-hidden"> of the {link.format} file, {file.label}</span></a>
										<code>{hashes[link.href].sha256}</code>
									</li>
								{/if}
							{/each}
						</ul>
					{/if}
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
		<li>The full text of stories from outside publishers: the file gives each story’s page</li>
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

	.files .file-hashes {
		flex: 1 1 100%;
		display: block;
		list-style: none;
		padding: 0;
		margin: 0;
		border: 0;
		font-size: var(--font-size-small);
	}

	.files .file-hashes li {
		display: block;
		padding: 0;
		border: 0;
	}

	.file-hashes code {
		display: block;
		overflow-wrap: anywhere;
	}

	.file-hashes .hint {
		margin-right: var(--space-2);
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
