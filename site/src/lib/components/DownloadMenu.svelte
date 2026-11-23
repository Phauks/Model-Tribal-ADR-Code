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
	import { page } from '$app/state';
	import { siteName } from '#lib';
	import { pageCitation, pageDownloads, type PageFile } from '#lib/page-downloads.ts';
	import Check from '@lucide/svelte/icons/check';
	import Download from '@lucide/svelte/icons/download';
	import FileBraces from '@lucide/svelte/icons/file-braces';
	import FileSpreadsheet from '@lucide/svelte/icons/file-spreadsheet';
	import FileText from '@lucide/svelte/icons/file-text';
	import HardDriveDownload from '@lucide/svelte/icons/hard-drive-download';
	import FileCheck from '@lucide/svelte/icons/file-check';
	import LibraryBig from '@lucide/svelte/icons/library-big';
	import Quote from '@lucide/svelte/icons/quote';

	let { onpdf }: { onpdf: () => void } = $props();

	const offers = $derived(pageDownloads(page.url.pathname));
	const fileIcons: Record<PageFile['kind'], typeof FileBraces> = {
		data: FileBraces,
		table: FileSpreadsheet,
		sources: LibraryBig
	};

	let open = $state(false);
	let copied = $state(false);
	let message = $state('');
	let container: HTMLDivElement | undefined = $state();
	let button: HTMLButtonElement | undefined = $state();
	let list: HTMLUListElement | undefined = $state();
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	// A new page starts closed, with no message.
	$effect(() => {
		void page.url.pathname;
		open = false;
		copied = false;
		message = '';
	});

	function items(): HTMLElement[] {
		return [...(list?.querySelectorAll<HTMLElement>('a, button') ?? [])];
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
		if (event.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % all.length;
		else if (event.key === 'ArrowUp') next = index <= 0 ? all.length - 1 : index - 1;
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

<a class="icon-button download-button without-scripts" href="/downloads" aria-label="Downloads" title="Downloads">
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
	<div class="download-panel" id="download-choices" hidden={!open}>
		<p class="download-heading" aria-hidden="true">Download</p>
		<ul bind:this={list} aria-label="Download">
			<li>
				<button type="button" onclick={savePdf}>
					<FileText size={20} strokeWidth={1.75} />
					<span class="choice">
						<span class="choice-name"><span class="choice-label">This page</span> <span class="format">PDF</span></span>
						<span class="choice-hint">Pick what to include, then choose Save as PDF in the print window</span>
					</span>
				</button>
			</li>
			{#each offers.files as file (file.link)}
				{@const Icon = fileIcons[file.kind]}
				<li>
					<a href={file.link} download onclick={() => close()}>
						<Icon size={20} strokeWidth={1.75} />
						<span class="choice">
							<span class="choice-name"><span class="choice-label">{file.label}</span> <span class="format">{file.format}</span></span>
							<span class="choice-hint">{file.description}</span>
						</span>
					</a>
				</li>
			{/each}
			{#if offers.citable}
				<li>
					<button type="button" onclick={copyCitation}>
						{#if copied}<Check size={20} strokeWidth={1.75} />{:else}<Quote size={20} strokeWidth={1.75} />{/if}
						<span class="choice">
							<span class="choice-name">{copied ? 'Citation copied' : 'Copy a citation'}</span>
							<span class="choice-hint">An Indigo Book citation to this page, to paste into your own writing</span>
						</span>
					</button>
				</li>
			{/if}
			<li class="divided">
				<a href="/offline" onclick={() => close()}>
					<HardDriveDownload size={20} strokeWidth={1.75} />
					<span class="choice">
						<span class="choice-name">Read offline</span>
						<span class="choice-hint">Save pages on this device to read without a connection</span>
					</span>
				</a>
			</li>
			<li>
				<a href="/downloads" onclick={() => close()}>
					<Download size={20} strokeWidth={1.75} />
					<span class="choice">
						<span class="choice-name">All downloads</span>
						<span class="choice-hint">The book and the data behind the site</span>
					</span>
				</a>
			</li>
			<li>
				<a href="/verify" onclick={() => close()}>
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

	/* Without scripts the list cannot open, so the icon links to the Downloads page. */
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
		width: min(24rem, calc(100vw - 2 * var(--space-3)));
		padding: var(--space-2) 0;
		background: var(--color-surface-raised);
		color: var(--color-ink);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		box-shadow: 0 var(--space-1) var(--space-3) color-mix(in srgb, var(--color-ink) 20%, transparent);
	}

	.download-panel[hidden] {
		display: none;
	}

	.download-heading {
		margin: 0;
		padding: var(--space-1) var(--space-4) var(--space-2);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink-muted);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li.divided {
		margin-top: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid var(--color-line);
	}

	li a,
	li button {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		width: 100%;
		min-height: var(--layout-target-minimum);
		padding: var(--space-2) var(--space-4);
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	li a:visited {
		color: var(--color-ink);
	}

	/* The icon sits on the first line of the name. */
	li :global(svg) {
		flex: none;
		margin-top: 0.15em;
	}

	li a:hover,
	li button:hover {
		background: var(--color-surface);
	}

	li a:hover .choice-name:not(:has(.choice-label)),
	li button:hover .choice-name:not(:has(.choice-label)),
	li a:hover .choice-label,
	li button:hover .choice-label {
		text-decoration: underline;
	}

	li a:focus-visible,
	li button:focus-visible {
		background-color: var(--color-focus);
		color: var(--focus-text);
	}

	li a:focus-visible .choice-hint,
	li button:focus-visible .choice-hint,
	li a:focus-visible .format,
	li button:focus-visible .format {
		color: inherit;
		border-color: currentColor;
	}

	.choice {
		display: flex;
		flex-direction: column;
		gap: 0.1em;
		min-width: 0;
	}

	.choice-name {
		font-weight: var(--font-weight-semibold);
	}

	.format {
		display: inline-block;
		margin-left: var(--space-1);
		padding: 0 0.4em;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		font-size: var(--font-size-small);
		font-weight: normal;
		color: var(--color-ink-muted);
		white-space: nowrap;
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
			top: 4.5rem;
			width: auto;
			max-height: calc(100dvh - 5rem);
			overflow-y: auto;
		}
	}
</style>
