<!--
	@component
	The "Text" section of every page that shows a source's text: a law's, a
	case's, a copy's own page and a Title 25 section's (Trevor, Nov. 27, 2026:
	"when showing text source info, lets try one consolidated method"; he
	chose design B and approved the rich mockups the same day,
	design/document-text/ in the project files).

	One card, the same everywhere:

	- Its header names the file: its format by extension, its pages and size,
	  the date the copy was made and how far its words can be trusted, then
	  icon buttons to find in the document, open the file in a new tab,
	  download it (the original byte for byte, or the reading version as .md
	  or .html) and ask for it to be removed or redacted.
	- Its toolbar, where it applies: View (Text, Scan or Both, when a scan of
	  the same document is kept), Lines (As printed or Flowing, when the copy
	  keeps the printed lines; Flowing on phones) and Text size.
	- Its body is the text: a transcribed text or a saved web page as page
	  text in the site's type (src/lib/reading-text.ts, read when the card
	  comes near the screen), with its citations linked; a PDF in the site's
	  own viewer (PdfViewer.svelte), titled with the record's name. A long
	  text shows its first part, with a button to show it all. Selecting a
	  passage offers its citation with a pinpoint page and a link to it.
	- Its footer says where the original was published, the SHA-256 and
	  Verify File.

	With no copy, the section says "None Identified", or shows what the page
	gives it instead (the children snippet). A page can also give the card a
	body of its own, as a case's opinions do (CaseOpinions.svelte), and keep
	the header, footer and tools.
-->
<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import Clock from '@lucide/svelte/icons/clock';
	import Copy from '@lucide/svelte/icons/copy';
	import Download from '@lucide/svelte/icons/download';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Flag from '@lucide/svelte/icons/flag';
	import Quote from '@lucide/svelte/icons/quote';
	import Search from '@lucide/svelte/icons/search';
	import Shield from '@lucide/svelte/icons/shield';
	import X from '@lucide/svelte/icons/x';
	import Collapsible from './Collapsible.svelte';
	import CopyHash from './CopyHash.svelte';
	import PdfViewer from './PdfViewer.svelte';
	import { pinpointCitation, pageSpan, type DocumentFile, type ReadingAnswer } from '#lib/document-text.ts';
	import { readingText } from '#lib/reading-text.ts';
	import { linkSigners } from '#lib/text-links.ts';

	interface Props {
		/** The copy the card shows; with none, the section says "None Identified" or shows `children`. */
		file?: DocumentFile;
		/** The section's heading. */
		heading?: string;
		/** The section's id on the page. */
		identifier?: string;
		/** A count after the heading, such as the number of opinions. */
		count?: number;
		/** The law's or case's name, for a passage's citation. */
		name: string;
		/** Whether the name is a case's, set in italics. */
		italic?: boolean;
		/** The page's Indigo Book citation, which a cited passage takes its pinpoint page in. */
		citation?: string;
		/** The printed page the document starts on, for a passage before the first page break and for a PDF's pages. */
		firstPage?: string;
		/** People with a page here who signed it, so a signature links to them. */
		signers?: { name: string; link: string }[];
		/** A nation chose to have the document cited only: the card says so, without the text. */
		citeOnly?: boolean;
		/** Where the original is, for a document shown cited only. */
		original?: { link: string; name: string };
		/** What the section shows with no copy, in place of "None Identified". */
		fallback?: Snippet;
		/** A body of the page's own inside the card, such as a case's opinions. */
		children?: Snippet;
	}

	let { file, heading = 'Text', identifier = 'text', count, name, italic = false, citation, firstPage, signers = [], citeOnly = false, original, fallback, children }: Props = $props();

	/** A text longer than this many words shows its first part, with a button for the rest. */
	const longText = 600;
	const sizes = [0.85, 1, 1.15, 1.3, 1.5];
	const sizeKey = 'document-text-size';

	let reading = $state<ReadingAnswer>();
	let failed = $state(false);
	let restricted = $state(false);
	let asked = false;
	let card = $state<HTMLElement>();
	let body = $state<HTMLElement>();
	let wholeShown = $state(false);
	let sizeStep = $state(1);
	let lines = $state<'printed' | 'flowing'>('printed');
	let view = $state<'text' | 'scan' | 'both'>('text');
	let menuOpen = $state(false);
	let findOpen = $state(false);
	let query = $state('');
	let hits = $state<Range[]>([]);
	let hitAt = $state(0);
	let findBox = $state<HTMLInputElement>();
	let pdfPages = $state(0);
	let cite = $state<{ top: number; left: number; quote: string; first?: string; last?: string; link: string; open: boolean; copied: boolean }>();

	const isText = $derived(file?.shown === 'text' || file?.shown === 'page');
	const html = $derived(reading ? linkSigners(reading.html, signers) : '');
	const clipped = $derived(Boolean(reading && reading.words > longText && !wholeShown));
	const pagesLabel = $derived(file?.pages ?? (pdfPages || undefined));
	const toolbar = $derived(Boolean(file && !children && isText && (file.scan || reading?.printedLines)) || Boolean(file && (isText || children)));

	onMount(() => {
		try {
			const kept = Number(localStorage.getItem(sizeKey));
			if (kept >= 0 && kept < sizes.length && localStorage.getItem(sizeKey) !== null) sizeStep = kept;
		} catch {
			// Without storage, the size starts at its default.
		}
		// Flowing lines on a phone, where printed lines would not fit.
		if (matchMedia('(max-width: 40rem)').matches) lines = 'flowing';
		else if (file?.scan) view = 'both';
	});

	function setSize(step: number) {
		sizeStep = Math.min(sizes.length - 1, Math.max(0, step));
		try {
			localStorage.setItem(sizeKey, String(sizeStep));
		} catch {
			// The size still changes for this page.
		}
	}

	async function load() {
		if (asked || !file?.reading || children || citeOnly) return;
		asked = true;
		const address = `${file.reading.path}.json${file.codeTitle ? `?title=${file.codeTitle}` : ''}`;
		try {
			const response = await fetch(address);
			if (response.status === 403) {
				restricted = true;
				return;
			}
			if (!response.ok) throw new Error(String(response.status));
			reading = (await response.json()) as ReadingAnswer;
		} catch {
			// Offline, the copy itself may be saved on the device (src/lib/offline-documents.ts): its words are read here, without linked citations.
			try {
				const response = await fetch(file.file);
				if (!response.ok) throw new Error(String(response.status));
				const words = await response.text();
				const read = readingText(words, file.shown === 'page' ? 'text/html' : 'text/plain', file.publishedAt?.link);
				if (!read) throw new Error('No text');
				reading = read;
			} catch {
				failed = true;
			}
		}
	}

	$effect(() => {
		if (!card || !file?.reading) return;
		// Read once the card is near the screen, so a reader who never scrolls to it does not wait for it.
		const watcher = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					void load();
					watcher.disconnect();
				}
			},
			{ rootMargin: '800px 0px' }
		);
		watcher.observe(card);
		return () => watcher.disconnect();
	});

	// Before printing, the whole text: paper has no button to press.
	$effect(() => {
		const before = () => {
			wholeShown = true;
			void load();
		};
		addEventListener('beforeprint', before);
		return () => removeEventListener('beforeprint', before);
	});

	// ---- Download menu

	function closeMenu(event: MouseEvent | KeyboardEvent) {
		if (!menuOpen) return;
		if (event instanceof KeyboardEvent) {
			if (event.key === 'Escape') menuOpen = false;
			return;
		}
		if (!(event.target instanceof Node) || !card?.querySelector('.download-tool')?.contains(event.target)) menuOpen = false;
	}

	// ---- Find in this document

	const highlightName = 'document-find';
	const currentName = 'document-find-current';

	function textRanges(term: string): Range[] {
		if (!body || term.trim().length === 0) return [];
		const wanted = term.toLocaleLowerCase('en-US');
		const found: Range[] = [];
		const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const text = (node.nodeValue ?? '').toLocaleLowerCase('en-US');
			let at = text.indexOf(wanted);
			while (at >= 0) {
				const range = document.createRange();
				range.setStart(node, at);
				range.setEnd(node, at + wanted.length);
				found.push(range);
				at = text.indexOf(wanted, at + wanted.length);
			}
		}
		return found;
	}

	function paint() {
		const highlights = (globalThis as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights;
		const Painter = (globalThis as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
		if (highlights && Painter) {
			highlights.set(highlightName, new Painter(...hits));
			if (hits[hitAt]) highlights.set(currentName, new Painter(hits[hitAt]));
			else highlights.delete(currentName);
		} else if (hits[hitAt]) {
			// Without highlights, the match is selected.
			const selection = getSelection();
			selection?.removeAllRanges();
			selection?.addRange(hits[hitAt]);
		}
		const target = hits[hitAt]?.startContainer.parentElement;
		target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	}

	async function search() {
		// A match beyond the first part shows the whole text.
		if (clipped && query.trim()) {
			wholeShown = true;
			await tick();
		}
		hits = textRanges(query);
		hitAt = 0;
		paint();
	}

	function step(by: number) {
		if (hits.length === 0) return;
		hitAt = (hitAt + by + hits.length) % hits.length;
		paint();
	}

	function clearFind() {
		const highlights = (globalThis as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights;
		highlights?.delete(highlightName);
		highlights?.delete(currentName);
		hits = [];
	}

	async function toggleFind() {
		findOpen = !findOpen;
		if (findOpen) {
			void load();
			await tick();
			findBox?.focus();
		} else clearFind();
	}

	function findKeys(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			if (hits.length === 0) void search();
			else step(event.shiftKey ? -1 : 1);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			findOpen = false;
			clearFind();
		}
	}

	// ---- Cite a passage

	/** The printed page a point in the text is on: the last page rule before it, else the page the document starts on. */
	function pageAt(node: Node, offset: number): string | undefined {
		const pdfPage = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('.pdf-page')?.dataset.page;
		if (pdfPage) {
			const start = Number(firstPage);
			return firstPage && /^\d+$/.test(firstPage) ? String(start + Number(pdfPage) - 1) : undefined;
		}
		let page = firstPage;
		const point = document.createRange();
		point.setStart(node, offset);
		for (const rule of body?.querySelectorAll<HTMLElement>('.page-rule, .page-mark') ?? []) {
			const place = document.createRange();
			place.selectNode(rule);
			if (place.compareBoundaryPoints(Range.START_TO_START, point) <= 0) page = rule.dataset.page ?? rule.id.replace(/^page-/, '');
			else break;
		}
		return page;
	}

	function fragmentWords(text: string): string {
		const words = text.replace(/\s+/g, ' ').trim().split(' ');
		const encode = (part: string) => encodeURIComponent(part).replace(/-/g, '%2D').replace(/,/g, '%2C');
		if (words.length <= 8) return encode(words.join(' '));
		return `${encode(words.slice(0, 4).join(' '))},${encode(words.slice(-4).join(' '))}`;
	}

	function noticeSelection() {
		if (cite?.open) return;
		const selection = getSelection();
		const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : undefined;
		if (!range || range.collapsed || !body || !card || !body.contains(range.commonAncestorContainer)) {
			cite = undefined;
			return;
		}
		const quote = selection?.toString().replace(/\s+/g, ' ').trim() ?? '';
		if (quote.length < 2) {
			cite = undefined;
			return;
		}
		const first = pageAt(range.startContainer, range.startOffset);
		const last = pageAt(range.endContainer, range.endOffset);
		const pdfPage = (range.startContainer.parentElement ?? undefined)?.closest<HTMLElement>('.pdf-page')?.dataset.page;
		const place = `${location.origin}${location.pathname}`;
		const link = pdfPage ? `${place}#page=${pdfPage}` : `${place}#${first && body.querySelector(`#page-${CSS.escape(first)}`) ? `page-${first}` : identifier}:~:text=${fragmentWords(quote)}`;
		const box = range.getBoundingClientRect();
		const frame = card.getBoundingClientRect();
		cite = { top: box.bottom - frame.top + 6, left: Math.max(0, Math.min(box.left - frame.left, frame.width - 240)), quote, first, last, link, open: false, copied: false };
	}

	const citedText = $derived.by(() => {
		if (!cite) return '';
		// A law's citation often begins with its name already; a case's does not.
		const lead = citation && citation.startsWith(name) ? '' : `${name}, `;
		if (!citation) return `${name.replace(/\.\s*$/, '')}.`;
		const cited = cite.first ? pinpointCitation(citation, cite.first, cite.last ?? cite.first) : `${citation.replace(/\.\s*$/, '')}.`;
		return `${lead}${cited}`;
	});

	async function copyCitation() {
		if (!cite) return;
		const text = `“${cite.quote}” ${citedText} ${cite.link}`;
		try {
			await navigator.clipboard.writeText(text);
			cite.copied = true;
		} catch {
			cite.copied = false;
		}
	}

	$effect(() => {
		const changed = () => {
			// After the browser has finished moving the selection.
			setTimeout(noticeSelection, 0);
		};
		document.addEventListener('selectionchange', changed);
		return () => document.removeEventListener('selectionchange', changed);
	});
</script>

<svelte:window onclick={closeMenu} onkeydown={closeMenu} />

<Collapsible {heading} {identifier} {count}>
	{#if !file}
		{#if fallback}{@render fallback()}{:else}<p class="none-identified">None Identified</p>{/if}
	{:else if citeOnly || restricted}
		<p class="restricted">
			At the nation’s request, this site does not show the text of this document.{#if original}
				<a href={original.link} rel="noopener noreferrer">Read it at {original.name}<ExternalLink size={14} aria-hidden="true" /></a>.{/if}
		</p>
	{:else}
		<!-- Its own block, so the card takes the width beside At a glance instead of dropping below it. -->
		<div class="document-card" bind:this={card} data-document-card>
			<div class="card-head">
				<span class="file-facts">
					<span class="format" title="The file’s format">{file.extension}</span>
					<span>{#if pagesLabel}{pagesLabel.toLocaleString('en-US')} {pagesLabel === 1 ? 'page' : 'pages'} · {/if}{file.size}</span>
					{#if file.captured}<span class="captured">Copy made {file.captured}</span>{/if}
					<span class="review-badge trust" class:review-badge-verified={file.trust.verified} title={file.trust.detail}
						>{#if file.trust.verified}<BadgeCheck size={14} strokeWidth={2} aria-hidden="true" />{:else}<Clock size={14} strokeWidth={2} aria-hidden="true" />{/if}{file.trust.label}<span class="visually-hidden">: {file.trust.detail}</span></span
					>
				</span>
				<span class="card-tools no-print">
					<button type="button" class="card-tool" class:on={findOpen} aria-pressed={findOpen} aria-label="Find in this document" title="Find in this document" onclick={toggleFind}><Search size={18} strokeWidth={2} aria-hidden="true" /></button>
					<a class="card-tool" href={file.file} target="_blank" rel="noopener" aria-label="Open in New Tab" title="Open in New Tab"><ExternalLink size={18} strokeWidth={2} aria-hidden="true" /></a>
					<span class="download-tool">
						<button type="button" class="card-tool" class:on={menuOpen} aria-expanded={menuOpen} aria-haspopup="true" aria-label="Download" title="Download" onclick={() => (menuOpen = !menuOpen)}><Download size={18} strokeWidth={2} aria-hidden="true" /></button>
						{#if menuOpen}
							<span class="download-menu" role="group" aria-label="Download">
								<span class="menu-group">The copy we keep</span>
								<a class="menu-row menu-original" href={file.file} download={file.name}>
									<span class="format">{file.extension}</span>
									<span>Original file, {file.size}<small>Exactly as published, byte for byte. SHA-256 <span class="hash-start">{file.sha256.slice(0, 12)}…</span></small></span>
								</a>
								{#if file.reading}
									<span class="menu-group">Our reading version</span>
									<a class="menu-row" href="{file.reading.path}.md" download="{file.reading.name}.md">
										<span class="format">.md</span>
										<span>Markdown<small>Headings, pages, footnotes and links kept, for reuse and comparison.</small></span>
									</a>
									<a class="menu-row" href="{file.reading.path}.html" download="{file.reading.name}.html">
										<span class="format">.html</span>
										<span>Web page<small>Opens in any browser or in Word.</small></span>
									</a>
								{/if}
							</span>
						{/if}
					</span>
					<a class="card-tool" href={file.removal} aria-label="Ask to remove or redact this copy" title="Ask to remove or redact this copy"><Flag size={18} strokeWidth={2} aria-hidden="true" /></a>
				</span>
			</div>

			{#if findOpen}
				<div class="find-bar no-print" role="search">
					<label class="visually-hidden" for="{identifier}-find">Find in this document</label>
					<input id="{identifier}-find" type="search" placeholder="Find in this document" bind:this={findBox} bind:value={query} oninput={() => void search()} onkeydown={findKeys} />
					<span class="find-count" aria-live="polite">{query.trim() ? (hits.length === 0 ? 'No matches' : `${hitAt + 1} of ${hits.length.toLocaleString('en-US')}`) : ''}</span>
					<button type="button" class="card-tool" aria-label="Previous match" title="Previous match" disabled={hits.length === 0} onclick={() => step(-1)}><ChevronUp size={18} strokeWidth={2} aria-hidden="true" /></button>
					<button type="button" class="card-tool" aria-label="Next match" title="Next match" disabled={hits.length === 0} onclick={() => step(1)}><ChevronDown size={18} strokeWidth={2} aria-hidden="true" /></button>
					<button
						type="button"
						class="card-tool"
						aria-label="Close find"
						title="Close find"
						onclick={() => {
							findOpen = false;
							clearFind();
						}}><X size={18} strokeWidth={2} aria-hidden="true" /></button
					>
				</div>
			{/if}

			{#if toolbar}
				<div class="card-bar no-print">
					{#if file.scan}
						<span class="bar-label" id="{identifier}-view">View</span>
						<span class="segments" role="group" aria-labelledby="{identifier}-view">
							<button type="button" aria-pressed={view === 'text'} onclick={() => (view = 'text')}>Text</button>
							<button type="button" aria-pressed={view === 'scan'} onclick={() => (view = 'scan')}>Scan</button>
							<button type="button" class="wide-only" aria-pressed={view === 'both'} onclick={() => (view = 'both')}>Both</button>
						</span>
					{/if}
					{#if reading?.printedLines}
						<span class="bar-label" id="{identifier}-lines">Lines</span>
						<span class="segments" role="group" aria-labelledby="{identifier}-lines">
							<button type="button" aria-pressed={lines === 'printed'} onclick={() => (lines = 'printed')}>As printed</button>
							<button type="button" aria-pressed={lines === 'flowing'} onclick={() => (lines = 'flowing')}>Flowing</button>
						</span>
					{/if}
					<span class="bar-label">Text size</span>
					<span class="size-buttons">
						<button type="button" aria-label="Smaller text" title="Smaller text" disabled={sizeStep === 0} onclick={() => setSize(sizeStep - 1)}>A−</button>
						<button type="button" aria-label="Larger text" title="Larger text" disabled={sizeStep === sizes.length - 1} onclick={() => setSize(sizeStep + 1)}>A+</button>
					</span>
				</div>
			{/if}

			<div class="card-body" class:both={view === 'both' && file.scan} style:--document-text-scale={sizes[sizeStep]} bind:this={body}>
				{#if file.namesReplaced}
					<!-- Policy: research/analyses/2026-11-24-redaction-practices-for-opinions.md, section 1. Said once, here. -->
					<p class="names-replaced">
						<Shield size={18} aria-hidden="true" /><span>Names replaced to protect privacy. Our changes are in [brackets]. <a href={file.namesReplaced.request}>Ask to replace a name</a>.</span>
					</p>
				{/if}
				{#if children}
					<div class="own-body">{@render children()}</div>
				{:else if file.shown === 'pdf'}
					<PdfViewer file={file.file} title={file.title} name={file.name} onpages={(count) => (pdfPages = count)} />
					<p class="print-only">This copy is at {file.file} on this site{#if file.publishedAt}, and was published at {file.publishedAt.link}{/if}.</p>
				{:else if file.shown === 'image'}
					<p class="image-holder image-backing"><img src={file.file} alt={file.title} /></p>
				{:else}
					{#if view !== 'scan'}
						<div class="reading-column">
							{#if reading}
								{#if reading.note}<p class="text-note">{reading.note}</p>{/if}
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- the served copy's words, cleaned to a short list of elements (src/lib/reading-text.ts) -->
								<div class="reading-text" class:flowing={lines === 'flowing'} class:clipped>{@html html}</div>
								{#if clipped}
									<p class="show-whole no-print">
										<button type="button" class="button-quiet" onclick={() => (wholeShown = true)}><ChevronDown size={16} strokeWidth={2} aria-hidden="true" />Show the whole text</button>
									</p>
								{/if}
							{:else if failed}
								<p class="text-note">The text could not be read just now. <a href={file.file} target="_blank" rel="noopener">Open the file</a>.</p>
							{:else}
								<p class="text-note" aria-live="polite">Loading the text…</p>
							{/if}
						</div>
					{/if}
					{#if file.scan && view !== 'text'}
						<div class="scan-column">
							<PdfViewer file={file.scan.file} title={file.title} name={file.scan.name} startPage={file.scan.page} />
						</div>
					{/if}
				{/if}
			</div>

			{#if cite}
				<div class="cite-pop no-print" style:top="{cite.top}px" style:left="{cite.left}px">
					{#if !cite.open}
						<button type="button" class="cite-open" onmousedown={(event) => event.preventDefault()} onclick={() => cite && (cite.open = true)}><Quote size={14} strokeWidth={2} aria-hidden="true" />Cite this passage</button>
					{:else}
						<div class="cite-panel" role="dialog" aria-label="Cite this passage">
							<p class="cite-quote">“{cite.quote.length > 280 ? `${cite.quote.slice(0, 277)}…` : cite.quote}”</p>
							<p class="cite-text">{#if italic && citedText.startsWith(name)}<i>{name}</i>{citedText.slice(name.length)}{:else}{citedText}{/if}{#if cite.first && cite.last && citation}<span class="visually-hidden"> (page {pageSpan(cite.first, cite.last)})</span>{/if}</p>
							<p class="cite-link"><a href={cite.link}>{cite.link}</a></p>
							<p class="cite-actions">
								<button type="button" class="button-quiet" onclick={copyCitation}>{#if cite.copied}<Check size={14} aria-hidden="true" />Copied{:else}<Copy size={14} aria-hidden="true" />Copy quotation and citation{/if}</button>
								<button type="button" class="card-tool" aria-label="Close" title="Close" onclick={() => (cite = undefined)}><X size={16} aria-hidden="true" /></button>
							</p>
						</div>
					{/if}
				</div>
			{/if}

			<p class="card-foot">
				{#if file.publishedAt}<span>Published at <a href={file.publishedAt.link} rel="noopener noreferrer">{file.publishedAt.host}</a></span>{/if}
				<span class="foot-hash">SHA-256 <CopyHash sha256={file.sha256} label="this document" /></span>
				<span><a href={file.verify}>Verify File</a></span>
			</p>
		</div>
	{/if}
</Collapsible>

<style>
	.none-identified {
		margin: 0;
		color: var(--color-ink-muted);
	}

	.document-card {
		position: relative;
		display: flow-root;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
	}

	.card-head,
	.card-foot {
		background: var(--color-surface);
	}

	.card-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--color-line);
		border-radius: var(--radius-panel) var(--radius-panel) 0 0;
		font-size: var(--font-size-small);
	}

	.file-facts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-3);
		color: var(--color-ink-muted);
	}

	.format {
		display: inline-block;
		padding: 0 var(--space-1);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		font-weight: var(--font-weight-bold);
		line-height: 1.5;
	}

	.trust {
		margin-right: 0;
		font-weight: var(--font-weight-regular);
	}

	.card-tools {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin-left: auto;
	}

	.card-tool {
		display: inline-grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		cursor: pointer;
	}

	.card-tool:hover,
	.card-tool.on {
		background: color-mix(in srgb, currentColor 12%, var(--color-paper));
	}

	.card-tool:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.download-tool {
		position: relative;
	}

	.download-menu {
		position: absolute;
		z-index: 5;
		top: calc(100% + var(--space-1));
		right: 0;
		display: grid;
		gap: var(--space-1);
		width: min(23rem, 80vw);
		padding: var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
		box-shadow: 0 4px 16px color-mix(in srgb, var(--color-ink) 22%, transparent);
	}

	.menu-group {
		padding: var(--space-1) var(--space-1) 0;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-bold);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.menu-row {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-control);
		color: var(--color-ink);
		text-decoration: none;
	}

	.menu-row:hover,
	.menu-original {
		background: var(--color-surface);
	}

	.menu-row small {
		display: block;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.hash-start {
		font-family: var(--font-family-mono, monospace);
	}

	.find-bar,
	.card-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--color-line);
		font-size: var(--font-size-small);
	}

	.find-bar input {
		flex: 1 1 12rem;
		min-height: 2.25rem;
		padding: 0 var(--space-2);
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		font: inherit;
	}

	.find-count {
		min-width: 6rem;
		color: var(--color-ink-muted);
	}

	.bar-label {
		color: var(--color-ink-muted);
	}

	.bar-label:not(:first-child) {
		margin-left: var(--space-3);
	}

	.segments {
		display: inline-flex;
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		overflow: hidden;
	}

	.segments button {
		min-height: 2rem;
		padding: 0 var(--space-3);
		border: 0;
		background: var(--color-paper);
		color: var(--color-ink);
		font: inherit;
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	.segments button + button {
		border-left: 1px solid var(--color-control-border);
	}

	.segments button[aria-pressed='true'] {
		background: var(--color-action);
		color: var(--color-action-text);
	}

	.size-buttons {
		display: inline-flex;
		gap: var(--space-1);
	}

	.size-buttons button {
		min-width: 2rem;
		min-height: 2rem;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		font: inherit;
		font-weight: var(--font-weight-bold);
		cursor: pointer;
	}

	.size-buttons button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.card-body {
		padding: var(--space-3) var(--space-4);
		font-size: calc(var(--font-size-body) * var(--document-text-scale, 1));
	}

	.card-body:has(> :global(.pdf-viewer)),
	.card-body:has(> .print-only + :global(.pdf-viewer)) {
		padding: 0;
	}

	.card-body.both {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-4);
		align-items: start;
	}

	.scan-column {
		position: sticky;
		top: 4.5rem;
		border-radius: var(--radius-panel);
		overflow: hidden;
	}

	.text-note {
		margin: 0 0 var(--space-3);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.names-replaced {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		margin: 0 0 var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--color-link);
		background: var(--color-surface-raised);
	}

	.names-replaced :global(svg) {
		flex: none;
		margin-top: 0.2em;
	}

	.reading-text {
		overflow-wrap: break-word;
	}

	.reading-text.clipped {
		max-height: 58rem;
		overflow: hidden;
		mask-image: linear-gradient(to bottom, currentColor 85%, transparent);
	}

	.reading-text :global(p) {
		margin: 0 0 var(--space-3);
	}

	.reading-text :global(h3),
	.reading-text :global(h4),
	.reading-text :global(h5),
	.reading-text :global(h6) {
		margin: var(--space-4) 0 var(--space-2);
		font-size: 1.05em;
	}

	.reading-text :global(blockquote) {
		margin: 0 0 var(--space-3);
		padding-left: var(--space-3);
		border-left: 3px solid var(--color-line);
	}

	.reading-text :global(.centered) {
		text-align: center;
	}

	.reading-text :global(.right) {
		text-align: right;
	}

	.reading-text :global(.small-caps) {
		font-variant: small-caps;
	}

	.reading-text :global(.opinion-author) {
		font-weight: var(--font-weight-bold);
	}

	/* A signature: right-aligned on a signing line with a pen mark, as printed. */
	.reading-text :global(.signature) {
		display: flex;
		justify-content: flex-end;
		margin-top: calc(-1 * var(--space-1));
	}

	.reading-text :global(.signer) {
		min-width: min(12rem, 60%);
		padding-top: var(--space-1);
		border-top: 1px solid var(--color-ink-muted);
		text-align: right;
		font-variant: small-caps;
	}

	.reading-text :global(.signer)::before {
		content: '✎ ';
		color: var(--color-ink-muted);
		font-variant: normal;
	}

	/* Where a printed page turns: a dashed rule with the page's number, which links to itself. */
	.reading-text :global(.page-rule) {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin: var(--space-3) 0;
		scroll-margin-top: 4.5rem;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.reading-text :global(.page-rule)::before,
	.reading-text :global(.page-rule)::after {
		content: '';
		flex: 1;
		border-top: 1px dashed var(--color-line);
	}

	.reading-text :global(.page-rule a) {
		color: var(--color-ink-muted);
	}

	.reading-text :global(.page-mark) {
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.reading-text :global(.page-mark)::before {
		content: 'p. ';
	}

	.reading-text :global(p[data-continued]) {
		text-indent: 0;
	}

	.reading-text :global(.footnote) {
		margin-top: var(--space-2);
		font-size: 0.875em;
	}

	.reading-text :global(.footnote p) {
		display: inline;
	}

	.reading-text :global(table) {
		display: block;
		max-width: 100%;
		overflow-x: auto;
		margin: 0 0 var(--space-3);
		border-collapse: collapse;
	}

	.reading-text :global(td),
	.reading-text :global(th) {
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--color-line);
		vertical-align: top;
	}

	.reading-text :global(img) {
		max-width: 100%;
		height: auto;
	}

	/* A link that leaves the site is marked as it is in the rest of the site's text. */
	.reading-text :global(a.external)::after {
		content: '\2197';
		margin-left: 0.1em;
		font-size: 0.75em;
	}

	/* A drawing the text refers to but the copy does not hold. */
	.reading-text :global(.figure-missing) {
		margin: 0 0 var(--space-3);
		padding: var(--space-2) var(--space-3);
		border: 1px dashed var(--color-control-border);
		border-radius: var(--radius-panel);
		background: var(--color-surface);
	}

	.reading-text :global(.figure-missing strong) {
		display: block;
	}

	/* Flowing: the printed line breaks give way, and a word broken over a line joins up. */
	.reading-text.flowing :global(br.printed),
	.reading-text.flowing :global(.printed-hyphen) {
		display: none;
	}

	.show-whole {
		margin: var(--space-2) 0 0;
	}

	.show-whole button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		border-radius: 999px;
	}

	.image-holder {
		margin: 0;
		text-align: center;
	}

	.image-holder img {
		max-width: 100%;
		height: auto;
	}

	.card-foot {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-top: 1px solid var(--color-line);
		border-radius: 0 0 var(--radius-panel) var(--radius-panel);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	/* Running text, so a separator stays at the end of the item before it when the line wraps. */
	.card-foot > span:not(:last-child)::after {
		content: '·';
		margin: 0 var(--space-2);
	}

	.foot-hash {
		overflow-wrap: anywhere;
	}

	.cite-pop {
		position: absolute;
		z-index: 6;
		max-width: min(30rem, calc(100% - var(--space-4)));
	}

	.cite-open {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 2rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		background: var(--color-paper);
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--color-ink) 20%, transparent);
		cursor: pointer;
	}

	.cite-panel {
		padding: var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
		box-shadow: 0 4px 16px color-mix(in srgb, var(--color-ink) 22%, transparent);
		font-size: var(--font-size-small);
	}

	.cite-panel p {
		margin: 0 0 var(--space-2);
	}

	.cite-quote {
		color: var(--color-ink-muted);
	}

	.cite-link {
		overflow-wrap: anywhere;
	}

	.cite-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		margin-bottom: 0;
	}

	.cite-actions .button-quiet {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.restricted a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.print-only {
		display: none;
	}

	@media (max-width: 40rem) {
		.card-body {
			padding: var(--space-3);
		}

		.card-body.both {
			display: block;
		}

		.card-body.both .scan-column,
		.wide-only {
			display: none;
		}

		.captured {
			display: none;
		}
	}

	@media print {
		.document-card {
			border: 0;
		}

		.card-head,
		.card-foot {
			background: none;
		}

		.reading-text.clipped {
			max-height: none;
			overflow: visible;
			mask-image: none;
		}

		.print-only {
			display: block;
		}
	}
</style>
