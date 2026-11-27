<!--
	@component
	The site's own PDF viewer, for the document text card
	(DocumentText.svelte). The browser's viewer showed a PDF's own embedded
	title, such as "C:\03wpd\03ibi" on the Interior Board of Indian Appeals'
	files, and on phones often showed nothing at all. This one draws each page
	with pdf.js (pdfjs-dist, Apache 2.0), loaded only when a PDF is shown, so
	no other page carries it.

	Its bar names the record, not the file's metadata; the card above it gives the page count.
	Pages are drawn as they come near the screen, each with a layer of its
	words over it, so a reader can select, find and cite a passage as in a
	text. The file is never changed: its SHA-256 must match the publisher's.
	Every page has an anchor, #pdf-page-N, and #page=N in the address opens
	the file at that page, as the browser's viewer did.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import FileText from '@lucide/svelte/icons/file-text';

	interface Props {
		/** The file's address on this site, /copies/<key>. */
		file: string;
		/** The record's title, shown in the bar. */
		title: string;
		/** The file's name, shown after the title. */
		name: string;
		/** The page to open at, from 1. */
		startPage?: number;
		/** Says how many pages the file has once it is read. */
		onpages?: (count: number) => void;
	}

	let { file, title, name, startPage, onpages }: Props = $props();

	let pageCount = $state(0);
	let failed = $state(false);
	let frame = $state<HTMLDivElement>();
	let width = $state(0);

	// pdf.js's own types are large; the viewer uses a few calls of its API.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdf.js document proxy
	let pdf: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the pdf.js module, loaded on demand
	let library: any;
	const drawn = new Set<number>();
	/** Each page's size at scale 1, once known, for its placeholder. */
	let sizes = $state<{ width: number; height: number }[]>([]);

	onMount(() => {
		let stopped = false;
		let watcher: IntersectionObserver | undefined;
		(async () => {
			try {
				const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
				library = pdfjs;
				pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
				pdf = await pdfjs.getDocument({ url: file }).promise;
				if (stopped) return;
				pageCount = pdf.numPages;
				onpages?.(pageCount);
				const first = await pdf.getPage(1);
				const viewport = first.getViewport({ scale: 1 });
				sizes = Array.from({ length: pageCount }, () => ({ width: viewport.width, height: viewport.height }));
				await Promise.resolve();
				watcher = new IntersectionObserver(
					(entries) => {
						for (const entry of entries) {
							if (!entry.isIntersecting) continue;
							const number = Number((entry.target as HTMLElement).dataset.page);
							void draw(number, entry.target as HTMLElement);
						}
					},
					{ root: frame, rootMargin: '600px 0px' }
				);
				for (const element of frame?.querySelectorAll<HTMLElement>('.pdf-page') ?? []) watcher.observe(element);
				const hash = /^#page=(\d{1,5})$/.exec(location.hash)?.[1];
				const opening = Number(hash ?? startPage ?? 0);
				if (opening > 1) frame?.querySelector(`#pdf-page-${opening}`)?.scrollIntoView({ block: 'start' });
			} catch {
				failed = true;
			}
		})();
		return () => {
			stopped = true;
			watcher?.disconnect();
			void pdf?.destroy?.();
		};
	});

	/** The scale that fits a page to the width it is shown at, so its words lie over the drawn ones. */
	function fitScale(pageWidth: number, holder: HTMLElement): number {
		return Math.max(0.25, (holder.clientWidth || width || 800) / pageWidth);
	}

	async function draw(number: number, holder: HTMLElement): Promise<void> {
		if (drawn.has(number) || !pdf) return;
		drawn.add(number);
		try {
			const page = await pdf.getPage(number);
			const base = page.getViewport({ scale: 1 });
			const scale = fitScale(base.width, holder);
			const viewport = page.getViewport({ scale });
			const ratio = window.devicePixelRatio || 1;
			const canvas = holder.querySelector('canvas') as HTMLCanvasElement;
			canvas.width = Math.floor(viewport.width * ratio);
			canvas.height = Math.floor(viewport.height * ratio);
			await page.render({ canvas, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] }).promise;
			const layer = holder.querySelector('.textLayer') as HTMLDivElement;
			layer.style.setProperty('--scale-factor', String(scale));
			layer.style.setProperty('--total-scale-factor', String(scale));
			const textLayer = new library.TextLayer({ textContentSource: page.streamTextContent(), container: layer, viewport });
			await textLayer.render();
			holder.classList.add('drawn');
		} catch {
			drawn.delete(number);
		}
	}
</script>

<div class="pdf-viewer" bind:clientWidth={width}>
	<p class="pdf-bar">
		<FileText size={16} strokeWidth={2} aria-hidden="true" />
		<span class="pdf-title">{title}</span>
		<span class="pdf-name">{name}</span>
	</p>
	<div class="pdf-pages" bind:this={frame}>
		{#if failed}
			<p class="pdf-failed">This PDF could not be shown here. <a href={file} target="_blank" rel="noopener">Open the file</a>.</p>
		{:else if sizes.length === 0}
			<p class="pdf-loading" aria-live="polite">Loading the PDF…</p>
		{:else}
			{#each sizes as size, index (index)}
				<section class="pdf-page" id="pdf-page-{index + 1}" data-page={index + 1} aria-label="Page {index + 1}" style:aspect-ratio="{size.width} / {size.height}">
					<canvas aria-hidden="true"></canvas>
					<div class="textLayer"></div>
				</section>
			{/each}
		{/if}
	</div>
</div>

<style>
	.pdf-viewer {
		background: color-mix(in srgb, var(--color-ink) 62%, var(--color-paper));
	}

	.pdf-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		margin: 0;
		padding: var(--space-1) var(--space-3);
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-line);
		font-size: var(--font-size-small);
	}

	.pdf-title {
		font-weight: var(--font-weight-semibold);
		overflow-wrap: anywhere;
	}

	.pdf-name {
		color: var(--color-ink-muted);
		overflow-wrap: anywhere;
	}

	.pdf-pages {
		display: grid;
		gap: var(--space-3);
		justify-items: center;
		max-height: 80vh;
		overflow: auto;
		padding: var(--space-3);
	}

	.pdf-page {
		position: relative;
		width: min(100%, 36rem);
		background: var(--color-paper);
		scroll-margin-top: var(--space-3);
		box-shadow: 0 1px 4px color-mix(in srgb, var(--color-ink) 40%, transparent);
	}

	.pdf-page canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.pdf-loading,
	.pdf-failed {
		margin: 0;
		padding: var(--space-4);
		color: var(--color-paper);
	}

	.pdf-failed a {
		color: inherit;
	}

	/* The words over each page, from pdf.js's own viewer styles (pdfjs-dist/web/pdf_viewer.css, Apache 2.0), cut to what selection needs. */
	.pdf-page :global(.textLayer) {
		position: absolute;
		inset: 0;
		overflow: clip;
		line-height: 1;
		text-align: initial;
		transform-origin: 0 0;
		z-index: 0;
		--min-font-size: 1;
		--text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
		--min-font-size-inv: calc(1 / var(--min-font-size));
	}

	.pdf-page :global(.textLayer :is(span, br)) {
		color: transparent;
		position: absolute;
		white-space: pre;
		cursor: text;
		transform-origin: 0% 0%;
	}

	.pdf-page :global(.textLayer > :not(.markedContent)),
	.pdf-page :global(.textLayer .markedContent span:not(.markedContent)) {
		z-index: 1;
		--font-height: 0;
		font-size: calc(var(--text-scale-factor) * var(--font-height));
		--scale-x: 1;
		--rotate: 0deg;
		transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
	}

	.pdf-page :global(.textLayer .markedContent) {
		display: contents;
	}

	.pdf-page :global(.textLayer ::selection) {
		background: color-mix(in srgb, var(--color-selection) 70%, transparent);
		color: transparent;
	}

	.pdf-page :global(.textLayer .endOfContent) {
		display: block;
		position: absolute;
		inset: 100% 0 0;
		z-index: 0;
		cursor: default;
		user-select: none;
	}

	@media print {
		.pdf-pages {
			max-height: none;
			overflow: visible;
		}
	}
</style>
