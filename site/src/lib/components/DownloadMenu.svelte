<script lang="ts">
	// The masthead's Download button (site/DESIGN.md, section 6, "Download").
	// Trevor asked on Nov. 22, 2026 that it open a list of the kinds of
	// download a reader may want rather than fetch one JSON file. The list
	// follows the WAI-ARIA disclosure pattern, as the account list does,
	// since its items are plain links and buttons: Up and Down move between
	// them, Escape closes the list and returns to the button, and a click
	// elsewhere closes it. Each item names what it gives, its format and one
	// line on what it is for. What a page offers is in
	// src/lib/page-downloads.ts. Without scripts the button is a link to the
	// Downloads page.
	//
	// Trevor asked on Nov. 23, 2026 that downloads be better separated. The
	// list is in labeled groups: this page itself, then the page's files by
	// what they are for (data, sources for a citation manager, contacts, map
	// layers), then the places to go for more. A file offered in several
	// formats is one row with a button for each format, so a format is never
	// mistaken for a different file.
	import { version } from '$app/env';
	import { page } from '$app/state';
	import { siteName } from '#lib';
	import { datedFileName, datedName } from '#lib/download-names.ts';
	import { mapTableOnScreen } from '#lib/map-table-on-screen.svelte.ts';
	import { buildTime } from '#lib/offline-collections.ts';
	import { fileExtension, groupedFiles, pageCitation, pageDownloads, pageFormats, type PageFile, type PageFormat } from '#lib/page-downloads.ts';
	import Check from '@lucide/svelte/icons/check';
	import Download from '@lucide/svelte/icons/download';
	import FileBraces from '@lucide/svelte/icons/file-braces';
	import FileSpreadsheet from '@lucide/svelte/icons/file-spreadsheet';
	import FileText from '@lucide/svelte/icons/file-text';
	import HardDriveDownload from '@lucide/svelte/icons/hard-drive-download';
	import FileCheck from '@lucide/svelte/icons/file-check';
			import ContactRound from '@lucide/svelte/icons/contact-round';
	import MapIcon from '@lucide/svelte/icons/map';
	import LibraryBig from '@lucide/svelte/icons/library-big';
	import Quote from '@lucide/svelte/icons/quote';

	let { onpdf }: { onpdf: () => void } = $props();

	// Saved files carry the date of the build they came from, as record-2026-11-23.json (src/lib/download-names.ts).
	const built = buildTime(version);
	const offers = $derived(pageDownloads(page.url.pathname, mapTableOnScreen));
	const groups = $derived(groupedFiles(offers.files));
	const fileIcons: Record<PageFile['kind'], typeof FileBraces> = {
		data: FileBraces,
		table: FileSpreadsheet,
		sources: LibraryBig,
		contact: ContactRound,
		map: MapIcon
	};

	let open = $state(false);
	let copied = $state(false);
	let message = $state('');
	let container: HTMLDivElement | undefined = $state();
	let button: HTMLButtonElement | undefined = $state();
	let panel: HTMLDivElement | undefined = $state();
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	// A new page starts closed, with no message.
	$effect(() => {
		void page.url.pathname;
		open = false;
		copied = false;
		message = '';
	});

	function items(): HTMLElement[] {
		return [...(panel?.querySelectorAll<HTMLElement>('a, button') ?? [])];
	}

	function toggle() {
		open = !open;
		message = '';
	}

	function close(returnFocus = false) {
		open = false;
		if (returnFocus) button?.focus();
	}

	function closeOnOutside(event: FocusEvent | MouseEvent) {
		const target = (event instanceof FocusEvent ? event.relatedTarget : event.target) as Node | null;
		if (open && container && target && !container.contains(target)) open = false;
	}

	function onkeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			close(true);
			return;
		}
		const all = items();
		if (all.length === 0) return;
		const index = all.indexOf(document.activeElement as HTMLElement);
		let next: number | undefined;
		if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = index < 0 ? 0 : (index + 1) % all.length;
		else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = index <= 0 ? all.length - 1 : index - 1;
		else if (event.key === 'Home' && index >= 0) next = 0;
		else if (event.key === 'End' && index >= 0) next = all.length - 1;
		if (next === undefined) return;
		event.preventDefault();
		all[next].focus();
	}

	function savePdf() {
		close();
		onpdf();
	}

	// The page as Word, OpenDocument or Markdown, made in the browser from what is shown, from one
	// reading of the page (src/lib/page-document.ts); the code loads only when asked for. Trevor asked
	// for these on Nov. 23, 2026.
	async function savePage(format: PageFormat) {
		const main = document.querySelector('#main-content');
		if (!main) return;
		try {
			const { pageFileName, readPage } = await import('#lib/page-document.ts');
			const versions = page.data.versions as { content?: string } | undefined;
			const read = readPage(main, {
				title: pageTitle(),
				address: location.href.split('#')[0],
				siteName,
				contentVersion: versions?.content,
				made: new Date()
			});
			let body: BlobPart;
			if (format.id === 'markdown') body = (await import('#lib/page-markdown.ts')).pageMarkdown(read);
			else {
				const office = await import('#lib/office-documents.ts');
				body = (format.id === 'word' ? office.pageWord(read) : office.pageOpenDocument(read)) as Uint8Array<ArrayBuffer>;
			}
			const link = document.createElement('a');
			link.href = URL.createObjectURL(new Blob([body], { type: format.mediaType }));
			link.download = datedName(pageFileName(location.pathname, format.extension), built);
			document.body.append(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
			close(true);
			message = `Saved ${link.download}.`;
		} catch {
			message = `The page could not be saved as ${format.format}. Please try again.`;
		}
	}

	function pageTitle(): string {
		const heading = document.querySelector('#main-content h1')?.textContent?.replace(/\s+/g, ' ').trim();
		return heading || document.title.split(' · ')[0];
	}

	async function copyCitation() {
		const versions = page.data.versions as { content?: string } | undefined;
		const citation = pageCitation(pageTitle(), siteName, versions?.content, location.href.split('#')[0], new Date());
		try {
			if (typeof ClipboardItem === 'function' && navigator.clipboard?.write) {
				await navigator.clipboard.write([
					new ClipboardItem({
						'text/plain': new Blob([citation.text], { type: 'text/plain' }),
						'text/html': new Blob([citation.html], { type: 'text/html' })
					})
				]);
			} else {
				await navigator.clipboard.writeText(citation.text);
			}
			copied = true;
			message = `Citation copied: ${citation.text}`;
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (copied = false), 4000);
		} catch {
			message = `Your browser did not allow copying. The citation is: ${citation.text}`;
		}
	}
</script>

<svelte:document onclick={closeOnOutside} />

<a class="icon-button download-button without-scripts" href="/downloads" aria-label="Data sets" title="Data sets">
	<Download size={24} />
</a>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="download needs-scripts" bind:this={container} onfocusout={closeOnOutside} {onkeydown}>
	<button
		bind:this={button}
		class="icon-button download-button"
		type="button"
		aria-expanded={open}
		aria-controls="download-choices"
		aria-label="Download"
		title="Download"
		onclick={toggle}
	>
		<Download size={24} />
	</button>
	<div class="download-panel" id="download-choices" hidden={!open} bind:this={panel}>
		<p class="group-heading" id="download-this-page">This page</p>
		<ul aria-labelledby="download-this-page">
			<li class="file">
				<FileText size={20} strokeWidth={1.75} />
				<span class="choice">
					<span class="choice-top">
					<span class="choice-name">Save this page as</span>
					<span class="formats">
						<button type="button" class="format" onclick={savePdf} aria-label="Save this page as a PDF file, .pdf" title="PDF: pick what to include, then choose Save as PDF in the print window">.pdf</button>
						{#each pageFormats as format (format.id)}
							<button type="button" class="format" onclick={() => savePage(format)} aria-label="Save this page as a {format.format} file, .{format.extension}" title="{format.format}: {format.description}">.{format.extension}</button>
						{/each}
					</span>
					</span>
				</span>
			</li>
			{#if offers.citable}
				<li>
					<button type="button" class="row" onclick={copyCitation}>
						{#if copied}<Check size={20} strokeWidth={1.75} />{:else}<Quote size={20} strokeWidth={1.75} />{/if}
						<span class="choice">
							<span class="choice-name">{copied ? 'Citation copied' : 'Copy a citation'}</span>
							<span class="choice-hint">An Indigo Book citation to this page, to paste into your own writing</span>
						</span>
					</button>
				</li>
			{/if}
		</ul>
		{#each groups as group, index (group.heading)}
			<p class="group-heading" id="download-group-{index}">{group.heading}</p>
			<ul aria-labelledby="download-group-{index}">
				{#each group.files as file (file.label)}
					{@const Icon = fileIcons[file.kind]}
					<li class="file">
						<Icon size={20} strokeWidth={1.75} />
						<span class="choice">
							<span class="choice-top">
							<span class="choice-name">{file.label}</span>
							<span class="formats">
								{#each file.links as link (link.link)}
									<a class="format" href={link.link} download={datedFileName(link.link, built)} onclick={() => close()} aria-label="{file.label}, {link.format} file, {fileExtension(link.link)}" title={link.format}>{fileExtension(link.link)}</a>
								{/each}
							</span>
							</span>
							<span class="choice-hint">{file.description}</span>
						</span>
					</li>
				{/each}
			</ul>
		{/each}
		<p class="group-heading" id="download-more">More</p>
		<ul aria-labelledby="download-more">
			<li>
				<a class="row" href="/offline" onclick={() => close()}>
					<HardDriveDownload size={20} strokeWidth={1.75} />
					<span class="choice">
						<span class="choice-name">Read offline</span>
						<span class="choice-hint">Save pages on this device to read without a connection</span>
					</span>
				</a>
			</li>
			<li>
				<a class="row" href="/downloads" onclick={() => close()}>
					<Download size={20} strokeWidth={1.75} />
					<span class="choice">
						<span class="choice-name">All downloads</span>
						<span class="choice-hint">The book and the data behind the site</span>
					</span>
				</a>
			</li>
			<li>
				<a class="row" href="/verify" onclick={() => close()}>
					<FileCheck size={20} strokeWidth={1.75} />
					<span class="choice">
						<span class="choice-name">Verify a file</span>
						<span class="choice-hint">Check that a downloaded file is the one published here</span>
					</span>
				</a>
			</li>
		</ul>
	</div>
	<p class="visually-hidden" role="status">{message}</p>
</div>

<style>
	.download {
		position: relative;
	}

	/* Without scripts the list cannot open, so the icon links to the Data sets page. */
	:global(:root[data-scripts='on']) .without-scripts {
		display: none;
	}

	.download-button,
	.download-button:visited {
		color: var(--color-band-text);
	}

	.download-button[aria-expanded='true'] {
		background: var(--color-band-text);
		color: var(--color-band);
	}

	.download-panel {
		position: absolute;
		right: 0;
		top: calc(100% + var(--space-2));
		z-index: 20;
		width: min(var(--layout-popover), calc(100vw - 2 * var(--space-3)));
		padding: var(--space-2) 0;
		background: var(--color-surface-raised);
		color: var(--color-ink);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		box-shadow: 0 var(--space-1) var(--space-3) color-mix(in srgb, var(--color-ink) 20%, transparent);
		max-height: calc(100dvh - 6rem);
		overflow-y: auto;
	}

	.download-panel[hidden] {
		display: none;
	}

	/* Each group has a small heading and a rule above it, so the groups read as separate lists. */
	.group-heading {
		margin: 0;
		padding: var(--space-2) var(--space-4) var(--space-1);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink-muted);
	}

	.group-heading:not(:first-child) {
		margin-top: var(--space-1);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li.file,
	.row {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-2) var(--space-4);
	}

	.row {
		min-height: var(--layout-target-minimum);
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.row:visited {
		color: var(--color-ink);
	}

	/* The icon sits on the first line of the name. */
	li :global(svg) {
		flex: none;
		margin-top: 0.15em;
	}

	/* Beside a row of format buttons, the icon lines up with the name in the middle of the buttons. */
	li.file > :global(svg) {
		margin-top: calc((var(--layout-target-minimum) - 20px) / 2);
	}

	.row:hover {
		background: var(--color-surface);
	}

	.row:hover .choice-name {
		text-decoration: underline;
	}

	.row:focus-visible,
	.format:focus-visible {
		background-color: var(--color-focus);
		color: var(--focus-text);
	}

	.row:focus-visible .choice-hint {
		color: inherit;
	}

	.choice {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.1em;
		min-width: 0;
	}

	.choice-name {
		font-weight: var(--font-weight-semibold);
	}

	/* As tall as a format button, so the icon lines up with the name whether the buttons sit beside it or under it. */
	.choice-top .choice-name {
		display: inline-flex;
		align-items: center;
		min-height: var(--layout-target-minimum);
	}

	/* The file's name, with its format buttons beside it where they fit and under it where not. */
	.choice-top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-1) var(--space-3);
	}

	/* One button for each format of a file. */
	.formats {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.format,
	.format:visited {
		display: inline-flex;
		align-items: center;
		min-height: var(--layout-target-minimum);
		min-width: var(--layout-target-minimum);
		justify-content: center;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
	}

	.format:hover {
		background: var(--color-surface);
		text-decoration: underline;
	}

	.choice-hint {
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	/*
	 * Phones: the button is inside the More panel, so the list opens across
	 * the screen just under the masthead rather than under the button.
	 */
	@media (max-width: 40rem) {
		.download-panel {
			position: fixed;
			left: var(--space-2);
			right: var(--space-2);
			top: 3.5rem;
			width: auto;
			max-height: calc(100dvh - 4rem);
			overflow-y: auto;
		}
	}
</style>
