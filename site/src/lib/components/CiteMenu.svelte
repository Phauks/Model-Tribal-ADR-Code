<script lang="ts">
	// The masthead's Cite button, on pages about one record: a nation, a case,
	// a law, an essay, a Justice, a glossary term, a story (improvements report,
	// Nov. 24, 2026, idea 2: "Stable citations to every page and record"). It
	// opens a panel with the citation, each with a copy button, and the same
	// citation as a file for a citation manager. A case or law page also gives
	// the citation to the case or law itself, which is what a brief cites. The
	// reader picks the style: the Indigo Book, Chicago, APA or MLA (Trevor,
	// Nov. 27, 2026; src/lib/citation-styles.ts), and the choice is remembered
	// in this browser. The panel follows the disclosure pattern of the Download
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
	import Quote from '@lucide/svelte/icons/quote';

	interface Citation {
		key: string;
		heading: string;
		text: string;
		html: string;
	}

	// An essay not yet published has nothing to cite.
	const citable = $derived(pageDownloads(page.url.pathname).citable && (page.data as { unpublished?: boolean }).unpublished !== true);

	const styleKey = 'citation-style';
	let style = $state<CitationStyle>(defaultCitationStyle);

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

	function escape(value: string): string {
		return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
	}

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
		if (typeof data.name !== 'string' || typeof data.citation !== 'string') return undefined;
		if (/^\/cases\/[^/]+$/.test(page.url.pathname)) return { heading: 'The case', kind: 'case', name: data.name, citation: data.citation, reference: data.reference };
		if (/^\/laws\/[^/]+$/.test(page.url.pathname) && data.citation) {
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
		const own = record ? [{ key: 'record', heading: record.heading, ...citeRecord(style, record) }] : [];
		return [...own, { key: 'page', heading: 'This page', ...self }];
	});

	function refresh(): void {
		visited = new Date();
		const kept = readStored(styleKey);
		if (isCitationStyle(kept)) style = kept;
	}

	function choose(next: CitationStyle): void {
		style = next;
		copied = null;
		writeStored(styleKey, next);
	}

	function toggle(): void {
		if (!open) refresh();
		open = !open;
		message = '';
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
			<fieldset class="styles">
				<legend class="visually-hidden">Citation style</legend>
				{#each citationStyles as option (option.key)}
					<label class="style" title={option.title}>
						<input type="radio" name="citation-style" value={option.key} checked={style === option.key} onchange={() => choose(option.key)} />
						<span>{option.label}</span>
					</label>
				{/each}
			</fieldset>
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
			<div class="formats">
				<button type="button" class="format" onclick={() => save('ris')} title="RIS: EndNote, Mendeley, Zotero">.ris</button>
				<button type="button" class="format" onclick={() => save('bib')} title="BibTeX: LaTeX">.bib</button>
				<button type="button" class="format" onclick={() => save('json')} title="CSL JSON: Zotero">.json</button>
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
		padding: var(--space-2) 0 var(--space-3);
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

	/* The style switch looks like the site's other view switches (ViewSwitch.svelte): the chosen one in the link color, underlined. */
	.styles {
		display: flex;
		gap: var(--space-1);
		margin: 0;
		padding: 0 var(--space-2) var(--space-1);
		border: 0;
		border-bottom: 1px solid var(--color-line);
	}

	.style {
		position: relative;
		display: flex;
	}

	.style input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.style span {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-2);
		border-radius: var(--radius-control);
		white-space: nowrap;
		color: var(--color-ink-muted);
	}

	.style:hover span {
		color: var(--color-ink);
		background: var(--color-surface);
	}

	.style input:checked + span {
		color: var(--color-link);
		font-weight: var(--font-weight-bold);
		box-shadow: inset 0 -2px 0 var(--color-link);
	}

	.style input:focus-visible + span {
		background-color: var(--color-focus);
		color: var(--focus-text);
	}

	.citation + .citation {
		margin-top: var(--space-1);
		border-top: 1px solid var(--color-line);
	}

	.group-heading {
		margin: 0;
		padding: var(--space-3) var(--space-4) var(--space-1);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink-muted);
	}

	.citation-row {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		padding: 0 var(--space-2) 0 var(--space-4);
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

	.formats {
		display: flex;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4) 0;
		border-top: 1px solid var(--color-line);
		margin-top: var(--space-2);
	}

	.format {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: var(--layout-target-minimum);
		min-width: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
		cursor: pointer;
	}

	.format:hover {
		background: var(--color-surface);
		text-decoration: underline;
	}

	.format:focus-visible {
		background-color: var(--color-focus);
		color: var(--focus-text);
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
