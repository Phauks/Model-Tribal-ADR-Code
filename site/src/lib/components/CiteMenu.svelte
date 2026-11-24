<script lang="ts">
	// The masthead's Cite button, on pages about one record: a nation, a case,
	// a Justice, a glossary term, a story (improvements report, Nov. 24, 2026,
	// idea 2: "Stable citations to every page and record"). It opens a panel
	// with the citation in Indigo Book form, each with a copy button, and the
	// same citation as a file for a citation manager. A case page also gives
	// the citation to the case itself, which is what a brief cites. The panel
	// follows the disclosure pattern of the Download list: Escape closes it
	// and returns to the button, and a click elsewhere closes it.
	import { page } from '$app/state';
	import { siteName } from '#lib';
	import { bibtexFile, risFile, type CitationItem } from '#lib/citation-formats.ts';
	import { datedName } from '#lib/download-names.ts';
	import { pageCitation, pageDownloads } from '#lib/page-downloads.ts';
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import Quote from '@lucide/svelte/icons/quote';

	interface Citation {
		key: string;
		heading: string;
		text: string;
		html: string;
	}

	const citable = $derived(pageDownloads(page.url.pathname).citable);

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

	// A case page cites the case first, from its record: the name in italics and the reporter citation.
	const record = $derived.by((): Citation | undefined => {
		const data = page.data as { name?: unknown; citation?: unknown };
		if (!/^\/cases\/[^/]+$/.test(page.url.pathname) || typeof data.name !== 'string' || typeof data.citation !== 'string') return undefined;
		return {
			key: 'record',
			heading: 'The case',
			text: `${data.name}, ${data.citation}.`,
			html: `<i>${escape(data.name)}</i>, ${escape(data.citation)}.`
		};
	});

	let citations = $state<Citation[]>([]);

	function refresh(): void {
		visited = new Date();
		const versions = page.data.versions as { content?: string } | undefined;
		const self = pageCitation(pageTitle(), siteName, versions?.content, address(), visited);
		citations = [...(record ? [record] : []), { key: 'page', heading: 'This page', ...self }];
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
		const link = document.createElement('a');
		const url = URL.createObjectURL(new Blob([contents], { type }));
		link.href = url;
		link.download = datedName(`${item.id}-citation.${extension}`, new Date());
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 0);
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
			{#each citations as citation (citation.key)}
				<section class="citation">
					<p class="group-heading">{citation.heading}</p>
					<div class="citation-row">
						<!-- The citation is built here from the page's own title and address, so its HTML is ours. -->
						<p class="citation-text">{@html citation.html}</p>
						<button
							type="button"
							class="icon-button copy"
							aria-label="Copy the citation to {citation.heading === 'The case' ? 'the case' : 'this page'}"
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
