<script lang="ts">
	import { onMount } from 'svelte';
	import { version } from '$app/env';
	import Download from '@lucide/svelte/icons/download';
	import FileCheck from '@lucide/svelte/icons/file-check';
	import Fingerprint from '@lucide/svelte/icons/fingerprint';
	import { buildTime, formatBytes } from '#lib/offline-collections.ts';
	import { citationDate, fileExtension, mapFiles, pageFormats } from '#lib/page-downloads.ts';
	import { downloadChecksums, fileName, verifyAddress, verifyLink, type ChecksumEntry } from '#lib/checksums.ts';
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
		id: string;
		heading: string;
		lead: string;
		files: { label: string; description: string; links: { format: string; href: string }[]; checking?: string }[];
		after: string;
	}[] = $derived([
		{
			id: 'data',
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
					label: 'The timeline',
					description: 'Every dated treaty, law, agreement, court decision and federal law, with its citation',
					links: [
						{ format: 'CSV', href: '/nations/timeline/entries.csv' },
						{ format: 'JSON', href: '/nations/timeline/entries.json' }
					]
				},
				{
					label: 'The glossary',
					description: 'Every term with its short definition',
					links: [{ format: 'JSON', href: '/glossary/terms.json' }]
				},
				{
					label: 'All the data in one file',
					description: 'Every nation’s record and sources, the list of nations, the provisions, the timeline, the glossary and the stories',
					links: [{ format: 'ZIP', href: '/zip/data.zip' }]
				}
			],
			after: 'In the ZIP file, a story’s full text is included where it is in the public domain or a nation’s law; for the others, the file gives the story’s page.'
		},
		{
			id: 'maps',
			heading: 'Maps',
			lead: 'The map’s layers, for mapping programs such as QGIS or ArcGIS.',
			// The same list the map page's Download menu offers (src/lib/page-downloads.ts).
			files: mapFiles.map((file) => ({ label: file.label, description: file.description, links: file.links.map((link) => ({ format: link.format, href: link.link })) })),
			after: 'Simplified for a national map. The land areas are the Census Bureau’s, not a statement of any nation’s territory, and an area a nation asked to leave off the map is left out.'
		},
		{
			id: 'documents',
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
			after: 'A nation’s own documents download from its page: see From a page, below.'
		}
	]);

	// What the Download menu offers on a page, so this page says where those files are without
	// repeating a list for every nation. Kept beside the groups above so the two are read as one list.
	const fromPages = $derived([
		{
			page: 'Any page',
			offers: [{ what: 'The page itself, to print, edit or keep as plain text', formats: ['.pdf', ...pageFormats.map((format) => `.${format.extension}`)] }]
		},
		{
			page: 'A nation’s page',
			offers: [
				{ what: 'The nation’s record, every fact with its source', formats: ['.json'] },
				{ what: 'The page’s sources, for a citation manager: Citation Style Language JSON, RIS and BibTeX', formats: ['.json', '.ris', '.bib'] },
				{ what: 'The government offices’ contacts, for an address book', formats: ['.vcf'] },
				{
					what: `Under “Laws and agreements”: the nation’s constitutions, laws and court opinions we hold, for ${numbers.format(data.nationsWithDocuments)} nations`,
					formats: ['.zip']
				}
			]
		}
	]);

	const contents = [
		{ id: 'data', label: 'Data' },
		{ id: 'maps', label: 'Maps' },
		{ id: 'documents', label: 'Documents' },
		{ id: 'from-a-page', label: 'From a page' },
		{ id: 'book-heading', label: 'The book' },
		{ id: 'never', label: 'Never in a download' }
	];

	// Each file's SHA-256 shows only when the reader asks for it (Trevor, Nov. 24, 2026: the hashes read as clutter).
	let shown = $state<Record<string, boolean>>({});

	// A file's .sha256, one line in the form sha256sum -c reads.
	function checksumFile(sha256: string, href: string): string {
		return `data:text/plain;charset=utf-8,${encodeURIComponent(`${sha256}  ${fileName(href)}\n`)}`;
	}

	onMount(() => {
		// Checking a file was a section of this page until Nov. 24, 2026; its links now open Verify File.
		if (location.hash === '#checking') {
			location.replace(`${verifyAddress}${location.search}`);
			return;
		}
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
	<title>Data sets · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Data sets</h1>
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
		To read the site without a connection instead, see <a href="/offline">Read offline</a>. To check a file you downloaded, see <a href={verifyAddress}>Verify File</a>.
	</p>
	<nav class="contents" aria-label="On this page">
		<ul>
			{#each contents as item (item.id)}
				<li><a href="#{item.id}">{item.label}</a></li>
			{/each}
		</ul>
	</nav>

	{#each groups as group (group.heading)}
		<h2 id={group.id} class="group-heading">{group.heading}</h2>
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
								{fileExtension(link.href)}<span class="visually-hidden"> ({link.format}), {file.label}</span>
							</a>
						{/each}
						{#if !file.checking && file.links.some((link) => hashes[link.href])}
							<button
								class="icon-button"
								type="button"
								aria-expanded={shown[file.label] ?? false}
								aria-label="SHA-256, {file.label}"
								title="SHA-256"
								onclick={() => (shown[file.label] = !shown[file.label])}
							>
								<Fingerprint size={20} aria-hidden="true" />
							</button>
						{/if}
					</p>
					{#if file.checking}
						<p class="hint file-hashes">{file.checking}</p>
					{:else if shown[file.label]}
						<ul class="file-hashes">
							{#each file.links as link (link.href)}
								{#if hashes[link.href]}
									<li>
										<span class="hint">SHA-256{file.links.length > 1 ? ` (${fileExtension(link.href)})` : ''}</span>
										<code>{hashes[link.href].sha256}</code>
										<a class="hash-file" href={checksumFile(hashes[link.href].sha256, link.href)} download="{fileName(link.href)}.sha256">.sha256<span class="visually-hidden"> file for the {fileExtension(link.href)} file, {file.label}</span></a>
										<a class="icon-button" href={verifyLink(hashes[link.href].sha256, fileName(link.href))} aria-label="Verify File: the {fileExtension(link.href)} file, {file.label}" title="Verify File">
											<FileCheck size={18} aria-hidden="true" />
										</a>
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

	<h2 id="from-a-page" class="group-heading">From a page</h2>
	<p>These are in the Download menu on the page they belong to, built from what that page shows.</p>
	{#each fromPages as from (from.page)}
		<h3>{from.page}</h3>
		<ul class="files">
			{#each from.offers as offer (offer.what)}
				<li>
					<p class="file-text">{offer.what}</p>
					<p class="file-links">
						{#each offer.formats as format (format)}
							<span class="format-tag">{format}</span>
						{/each}
					</p>
				</li>
			{/each}
		</ul>
	{/each}

	<!-- Empty state: says what will appear and when (site/DESIGN.md, section 12). -->
	<section class="panel panel-filled empty-state" aria-labelledby="book-heading">
		<h2 id="book-heading">The book</h2>
		<p>
			Not out yet. The first edition will appear here as a PDF for printing and an EPUB for e-readers,
			each with its edition number and the date it was made.
		</p>
	</section>

	<h2 id="never" class="group-heading">Never in a download</h2>
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
	.contents ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		list-style: none;
		padding: 0;
		margin: var(--space-3) 0 var(--space-4);
	}

	/* A rule above each group, so where one kind of download ends and the next begins is plain. */
	.group-heading {
		margin-top: var(--space-6);
		padding-top: var(--space-4);
		border-top: 2px solid var(--color-line);
	}

	.format-tag {
		display: inline-block;
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

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
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 var(--space-2);
		padding: 0;
		border: 0;
	}

	.file-hashes code {
		overflow-wrap: anywhere;
		min-width: 0;
	}

	.file-links .icon-button {
		align-self: center;
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
