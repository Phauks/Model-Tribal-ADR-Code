<script lang="ts">
	// The masthead's Cite button, on pages about one record: a nation, a case,
	// a law, an essay, a Justice, a glossary term, a story (improvements report,
	// Nov. 24, 2026, idea 2: "Stable citations to every page and record"). It
	// opens a dropdown with the page's citation in the style the reader picks
	// in a rounded switch: the Indigo Book, Chicago, APA or MLA (Trevor, Nov.
	// 27, 2026, mockup B1 in project files design/citation-styles/
	// rounded-switch/; the forms are in src/lib/citation-styles.ts). The choice
	// is remembered in this browser. A case or law page first gives the
	// citation to the case or law itself, which is what a brief cites. Each
	// citation has a copy button. The download icon beside the switch shows the
	// page's citation as a file for a citation manager in place of the
	// citations. The dropdown follows the disclosure pattern of the Download
	// list: Escape closes it and returns to the button, and a click elsewhere
	// closes it.
	import { page } from '$app/state';
	import { siteName } from '#lib';
	import { readStored, writeStored } from '#lib/browser-storage.ts';
	import { bibtexFile, risFile, type CitationItem } from '#lib/citation-formats.ts';
	import { citationStyles, citePage, citeRecord, defaultCitationStyle, isCitationStyle, type CitationStyle, type CitedRecord } from '#lib/citation-styles.ts';
	import { copyRichText } from '#lib/clipboard.ts';
	import { datedName } from '#lib/download-names.ts';
	import { saveFile } from '#lib/save-file.ts';
	import { pageDownloads } from '#lib/page-downloads.ts';
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import Download from '@lucide/svelte/icons/download';
	import Quote from '@lucide/svelte/icons/quote';
	import RoundedSwitch from './RoundedSwitch.svelte';

	interface Citation {
		key: string;
		heading: string;
		text: string;
		html: string;
	}

	// An essay not yet published has nothing to cite.
	const citable = $derived(pageDownloads(page.url.pathname).citable && (page.data as { unpublished?: boolean }).unpublished !== true);

	const styleKey = 'citation-style';
	const styleOptions = citationStyles.map((option) => ({ id: option.key, label: option.label, title: option.title }));
	let style = $state<CitationStyle>(defaultCitationStyle);
	let showFiles = $state(false);
	let open = $state(false);
	let copied = $state<string | null>(null);
	let message = $state('');
	let visited = $state(new Date());
	let container: HTMLDivElement | undefined = $state();
	let button: HTMLButtonElement | undefined = $state();
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		void page.url.pathname;
		open = false;
		copied = null;
		message = '';
	});

	function pageTitle(): string {
		const heading = document.querySelector('#main-content h1')?.textContent?.replace(/\s+/g, ' ').trim();
		return heading || document.title.split(' · ')[0];
	}

	function address(): string {
		return `${location.origin}${location.pathname}`;
	}

	// A case or law page cites the case or law first, from its record.
	const record = $derived.by((): (CitedRecord & { heading: string }) | undefined => {
		const data = page.data as { name?: unknown; citation?: unknown; reference?: CitedRecord['reference']; kind?: unknown };
		if (typeof data.name !== 'string' || typeof data.citation !== 'string' || !data.citation) return undefined;
		if (/^\/cases\/[^/]+$/.test(page.url.pathname)) return { heading: 'The case', kind: 'case', name: data.name, citation: data.citation, reference: data.reference };
		if (/^\/laws\/[^/]+$/.test(page.url.pathname)) {
			return { heading: data.kind === 'intergovernmental-agreement' ? 'The treaty' : 'The law', kind: 'law', name: data.name, citation: data.citation, lawKind: typeof data.kind === 'string' ? data.kind : undefined };
		}
		return undefined;
	});

	/** The day an essay's publication came out, which the styles give as its date. */
	function published(): Date | undefined {
		const when = (page.data as { publication?: { publishedAt?: unknown } }).publication?.publishedAt;
		if (typeof when !== 'string') return undefined;
		const date = new Date(when);
		return Number.isNaN(date.getTime()) ? undefined : date;
	}

	const citations = $derived.by((): Citation[] => {
		void visited;
		if (!open) return [];
		const versions = page.data.versions as { content?: string } | undefined;
		const self = citePage(style, {
			title: pageTitle(),
			titleIsCaseName: /^\/cases\/[^/]+$/.test(page.url.pathname),
			siteName,
			contentVersion: versions?.content,
			address: address(),
			visited,
			published: published()
		});
		const own = record ? [{ key: `record-${style}`, heading: record.heading, ...citeRecord(style, record) }] : [];
		return [...own, { key: `page-${style}`, heading: 'This page', ...self }];
	});

	function toggle(): void {
		if (!open) {
			visited = new Date();
			const kept = readStored(styleKey);
			if (isCitationStyle(kept)) style = kept;
			showFiles = false;
		}
		open = !open;
		message = '';
	}

	function chooseStyle(next: CitationStyle): void {
		showFiles = false;
		copied = null;
		writeStored(styleKey, next);
	}

	function close(returnFocus = false): void {
		open = false;
		if (returnFocus) button?.focus();
	}

	function closeOnOutside(event: FocusEvent | MouseEvent): void {
		const target = (event instanceof FocusEvent ? event.relatedTarget : event.target) as Node | null;
		if (open && container && target && !container.contains(target)) open = false;
	}

	function onkeydown(event: KeyboardEvent): void {
		if (open && event.key === 'Escape') {
			event.preventDefault();
			close(true);
		}
	}

	async function copy(citation: Citation): Promise<void> {
		try {
			await copyRichText(citation.text, citation.html);
			copied = citation.key;
			message = `Copied: ${citation.text}`;
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (copied = null), 4000);
		} catch {
			// expected: the browser would not copy; the message shows the citation.
			message = `Your browser did not allow copying. The citation is: ${citation.text}`;
		}
	}

	/** This page as one Citation Style Language item, for the citation-manager files. */
	function pageItem(): CitationItem {
		const versions = page.data.versions as { content?: string } | undefined;
		const day = (date: Date) => [[date.getFullYear(), date.getMonth() + 1, date.getDate()]];
		return {
			id: page.url.pathname.replace(/^\//, '').replaceAll('/', '-') || 'home',
			type: 'webpage',
			title: pageTitle(),
			'container-title': siteName,
			medium: versions?.content ? `Draft content ver. ${versions.content}` : undefined,
			URL: address(),
			accessed: { 'date-parts': day(visited) }
		};
	}

	function save(extension: 'ris' | 'bib' | 'json'): void {
		const item = pageItem();
		const [contents, type] =
			extension === 'ris'
				? [risFile([item]), 'application/x-research-info-systems']
				: extension === 'bib'
					? [bibtexFile([item]), 'application/x-bibtex']
					: [JSON.stringify([item], null, 2), 'application/vnd.citationstyles.csl+json'];
		saveFile(new Blob([contents], { type }), datedName(`${item.id}-citation.${extension}`, new Date()));
	}

	const files = [
		{ extension: 'ris', programs: 'EndNote, Mendeley, Zotero' },
		{ extension: 'bib', programs: 'LaTeX, BibDesk' },
		{ extension: 'json', programs: 'Zotero, Pandoc' }
	] as const;
</script>

<svelte:document onclick={closeOnOutside} />

{#if citable}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="cite needs-scripts" bind:this={container} onfocusout={closeOnOutside} {onkeydown}>
		<button
			bind:this={button}
			class="icon-button cite-button"
			type="button"
			aria-expanded={open}
			aria-controls="cite-panel"
			aria-label="Cite"
			title="Cite"
			onclick={toggle}
		>
			<Quote size={24} />
		</button>
		<div class="cite-panel" id="cite-panel" hidden={!open} role="group" aria-label="Cite">
			<div class="controls">
				<RoundedSwitch options={styleOptions} bind:selected={style} label="Citation style" panel="cite-citations" onchange={chooseStyle} />
				<button
					type="button"
					class="icon-button files-button"
					aria-pressed={showFiles}
					aria-controls="cite-citations"
					aria-label="Files for a citation manager"
					title="Files for a citation manager"
					onclick={() => (showFiles = !showFiles)}
				>
					<Download size={20} />
				</button>
			</div>
			<div class="citations" id="cite-citations" role="tabpanel" aria-label={showFiles ? 'Files for a citation manager' : 'Citations'}>
				{#if showFiles}
					<p class="files-hint">This page’s citation as a file to import.</p>
					<ul class="files">
						{#each files as file (file.extension)}
							<li>
								<button type="button" class="file" onclick={() => save(file.extension)}>
									<span class="file-name">.{file.extension}</span>
									<span class="file-programs">{file.programs}</span>
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					{#each citations as citation (citation.key)}
						<section class="citation">
							<p class="group-heading">{citation.heading}</p>
							<div class="citation-row">
								<!-- The citation is built here from the page's own title and address, so its HTML is ours. -->
								<p class="citation-text">{@html citation.html}</p>
								<button
									type="button"
									class="icon-button copy"
									aria-label="Copy the citation to {citation.heading === 'This page' ? 'this page' : citation.heading.toLowerCase()}"
									title="Copy"
									onclick={() => copy(citation)}
								>
									{#if copied === citation.key}<Check size={20} />{:else}<Copy size={20} />{/if}
								</button>
							</div>
						</section>
					{/each}
				{/if}
			</div>
		</div>
		<p class="visually-hidden" role="status">{message}</p>
	</div>
{/if}

<style>
	.cite {
		position: relative;
	}

	.cite-button,
	.cite-button:visited {
		color: var(--color-band-text);
	}

	.cite-button[aria-expanded='true'] {
		background: var(--color-band-text);
		color: var(--color-band);
	}

	.cite-panel {
		position: absolute;
		right: 0;
		top: calc(100% + var(--space-2));
		z-index: 20;
		width: min(var(--layout-popover), calc(100vw - 2 * var(--space-3)));
		background: var(--color-surface-raised);
		color: var(--color-ink);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		box-shadow: 0 var(--space-1) var(--space-3) color-mix(in srgb, var(--color-ink) 20%, transparent);
		max-height: calc(100dvh - 6rem);
		overflow-y: auto;
	}

	.cite-panel[hidden] {
		display: none;
	}

	/* The switch and, at the right, the files. */
	.controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-line);
	}

	.files-button {
		flex: none;
		color: var(--color-ink);
	}

	.files-button[aria-pressed='true'] {
		background: var(--color-surface);
		box-shadow: inset 0 -2px 0 var(--color-action);
	}

	.citations {
		padding: var(--space-2) 0;
	}

	.citation + .citation {
		border-top: 1px solid var(--color-line);
	}

	.group-heading {
		margin: 0;
		padding: var(--space-3) var(--space-4) 0;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink-muted);
	}

	.citation-row {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
	}

	.citation-text {
		flex: 1;
		margin: var(--space-2) 0;
		overflow-wrap: anywhere;
	}

	.copy {
		flex: none;
		color: var(--color-ink);
	}

	.files-hint {
		margin: var(--space-3) var(--space-4) var(--space-2);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.files {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: 0 var(--space-4) var(--space-2);
		list-style: none;
	}

	.file {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		min-height: var(--layout-target-minimum);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
		color: var(--color-ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.file:hover {
		background: var(--color-surface);
	}

	.file:focus-visible {
		outline-offset: -3px;
	}

	.file-name {
		min-width: 3.5rem;
		font-weight: var(--font-weight-semibold);
	}

	.file-programs {
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	@media (max-width: 40rem) {
		.cite-panel {
			position: fixed;
			left: var(--space-2);
			right: var(--space-2);
			top: 3.5rem;
			width: auto;
		}
	}
</style>
