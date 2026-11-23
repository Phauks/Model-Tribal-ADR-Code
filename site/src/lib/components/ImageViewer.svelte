<script lang="ts">
	// The image viewer (site/DESIGN.md, section 6, "Image viewer"; Trevor,
	// Nov. 23, 2026). Like Wikipedia's Media Viewer, selecting a picture such as
	// a nation's seal opens it large over the dimmed page, with its caption,
	// who made it and on what terms, a link to its entry in the Sources list, a
	// link to where it is published and a link to the file itself. When a page
	// has more than one picture, Previous and Next (or the arrow keys, or a
	// swipe on a phone) step through them.
	//
	// It is mounted once, in the site's layout, and answers a click on any
	// picture link with the class `image-viewer-link` (src/lib/image-viewer.ts),
	// including links the Worker adds to a nation's page. Without scripts, or
	// with a click that opens a new tab, the link opens the file itself.
	//
	// It is the browser's own <dialog> opened as a modal, like Modal.svelte:
	// focus moves into it and stays there, the page behind is inert, and
	// Escape closes it. A click on the dark space around the picture also
	// closes it, and focus goes back to the picture's link on the page.
	import { afterNavigate } from '$app/navigation';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import X from '@lucide/svelte/icons/x';
	import { onMount, tick } from 'svelte';
	import {
		imageViewerLinkFrom,
		imageViewerLinksIn,
		imageViewerTitle,
		originalHost,
		readImageViewerItem,
		stepIndex,
		swipeStep,
		type ImageViewerItem
	} from '#lib/image-viewer.ts';

	const identifier = $props.id();
	let dialog: HTMLDialogElement | undefined = $state();
	let closeButton: HTMLButtonElement | undefined = $state();
	let links = $state.raw<HTMLAnchorElement[]>([]);
	let index = $state(0);
	let item = $state.raw<ImageViewerItem | undefined>();
	let failed = $state(false);
	/** Said aloud when the reader steps to another picture; the dialog's own name covers the first. */
	let announcement = $state('');
	let swipeStart: { x: number; y: number } | undefined;

	const count = $derived(links.length);
	const title = $derived(item ? imageViewerTitle(item) : '');
	const host = $derived(item?.original ? originalHost(item.original) : undefined);

	function show(at: number): void {
		const link = links[at];
		if (!link) return;
		index = at;
		item = readImageViewerItem(link);
		failed = false;
		preloadNeighbors();
	}

	/** Starts loading the pictures on either side, so stepping to them is quick. */
	function preloadNeighbors(): void {
		if (count < 2) return;
		for (const step of [-1, 1]) {
			const link = links[stepIndex(index, step, count)];
			if (link) new Image().src = link.href;
		}
	}

	async function open(link: HTMLAnchorElement): Promise<void> {
		const main = document.getElementById('main-content') ?? document.body;
		const found = imageViewerLinksIn(main);
		links = found.includes(link) ? found : [link];
		announcement = '';
		show(links.indexOf(link));
		await tick();
		if (dialog?.open) return;
		dialog?.showModal();
		// Focus starts on Close, so Enter or Space never steps away by surprise.
		closeButton?.focus();
	}

	function step(by: number): void {
		if (count < 2) return;
		show(stepIndex(index, by, count));
		announcement = `Picture ${index + 1} of ${count}: ${title}`;
	}

	function close(): void {
		if (dialog?.open) dialog.close();
	}

	/** After the dialog closes, focus goes back to the link of the picture last shown. */
	function closed(): void {
		const link = links[index];
		item = undefined;
		links = [];
		if (link?.isConnected) link.focus({ preventScroll: false });
	}

	function onKey(event: KeyboardEvent): void {
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		const moves: Record<string, () => void> = {
			ArrowLeft: () => step(-1),
			ArrowRight: () => step(1),
			Home: () => count > 1 && show(0),
			End: () => count > 1 && show(count - 1)
		};
		const move = moves[event.key];
		if (!move) return;
		event.preventDefault();
		move();
	}

	/** A click on the dark space around the picture, not on the picture or a control, closes the viewer. */
	function onDialogClick(event: MouseEvent): void {
		const target = event.target as Element | null;
		if (target === dialog || target?.classList.contains('viewer-stage')) close();
	}

	function onPointerDown(event: PointerEvent): void {
		swipeStart = event.pointerType === 'mouse' ? undefined : { x: event.clientX, y: event.clientY };
	}

	function onPointerUp(event: PointerEvent): void {
		if (!swipeStart) return;
		const by = swipeStep(event.clientX - swipeStart.x, event.clientY - swipeStart.y);
		swipeStart = undefined;
		if (by) step(by);
	}

	afterNavigate(() => close());

	onMount(() => {
		const onClick = (event: MouseEvent) => {
			if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const link = imageViewerLinkFrom(event.target);
			if (!link) return;
			event.preventDefault();
			void open(link);
		};
		// Caught on the way down, before the site's page loading sees the click.
		document.addEventListener('click', onClick, true);
		return () => document.removeEventListener('click', onClick, true);
	});
</script>

<dialog
	bind:this={dialog}
	class="image-viewer no-print"
	aria-labelledby="{identifier}-title"
	aria-describedby={item?.captionHtml ? `${identifier}-caption` : undefined}
	onclose={closed}
	onkeydown={onKey}
	onclick={onDialogClick}
>
	{#if item}
		<div class="viewer-top">
			<h2 id="{identifier}-title" class="viewer-title">{title}</h2>
			{#if count > 1}
				<div class="viewer-steps">
					<button type="button" class="viewer-step" onclick={() => step(-1)}>
						<ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />Previous<span class="visually-hidden"> picture</span>
					</button>
					<span class="viewer-count">{index + 1} of {count}</span>
					<button type="button" class="viewer-step" onclick={() => step(1)}>
						Next<span class="visually-hidden"> picture</span><ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
					</button>
				</div>
			{/if}
			<button bind:this={closeButton} class="icon-button viewer-close" type="button" aria-label="Close" title="Close" onclick={close}>
				<X size={24} />
			</button>
		</div>

		<!-- The picture fills the space it has; a swipe sideways on a touch screen steps to the next one. -->
		<div class="viewer-stage" onpointerdown={onPointerDown} onpointerup={onPointerUp} onpointercancel={() => (swipeStart = undefined)} role="presentation">
			{#if failed}
				<p class="viewer-failed">This picture could not be loaded.</p>
			{:else}
				{#key item.file}
					<img class="viewer-image" src={item.file} alt={item.description} onerror={() => (failed = true)} />
				{/key}
			{/if}
		</div>

		<div class="viewer-details">
			{#if item.captionHtml}
				<!-- A copy of the caption already on the page, made by the site's own renderer. -->
				<div id="{identifier}-caption" class="viewer-caption">{@html item.captionHtml}</div>
			{/if}
			{#if item.credit}
				<p class="viewer-credit">{item.credit}</p>
			{/if}
			<ul class="viewer-links">
				{#if item.source}
					<li><a href={item.source} onclick={close}>Source in the Sources list</a></li>
				{/if}
				{#if item.original}
					<li>
						<a href={item.original} target="_blank" rel="noopener noreferrer"
							>Where it is published{#if host}{' '}({host}){/if}<span class="visually-hidden"> (opens in a new tab)</span></a
						>
					</li>
				{/if}
				<li><a href={item.file}>Open the file by itself</a></li>
				{#if item.removal}
					<li><a href={item.removal} onclick={close}>Ask to have it removed</a></li>
				{/if}
			</ul>
		</div>
		<p class="visually-hidden" aria-live="polite">{announcement}</p>
	{/if}
</dialog>

<style>
	/*
	 * The viewer fills the window on a dark ground in both themes, as
	 * Wikipedia's does, so a picture is seen against the same plain dark
	 * space wherever it comes from. Its colors are the viewer-* tokens.
	 */
	.image-viewer {
		box-sizing: border-box;
		width: 100%;
		max-width: none;
		height: 100dvh;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		background: var(--color-viewer-background);
		color: var(--color-viewer-text);
		transition:
			opacity var(--motion-duration-medium) var(--motion-easing-enter),
			display var(--motion-duration-medium) allow-discrete,
			overlay var(--motion-duration-medium) allow-discrete;
	}

	.image-viewer[open] {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;

		@starting-style {
			opacity: 0;
		}
	}

	.image-viewer:not([open]) {
		opacity: 0;
	}

	.image-viewer::backdrop {
		background: var(--color-viewer-background);
	}

	.viewer-top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
	}

	.viewer-title {
		flex: 1 1 14rem;
		margin: 0;
		font-size: var(--font-size-body);
		font-weight: var(--font-weight-semibold);
		overflow-wrap: anywhere;
	}

	.viewer-steps {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.viewer-step {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-viewer-control-border);
		border-radius: var(--radius-control);
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.viewer-step:hover {
		background: color-mix(in srgb, currentColor 14%, transparent);
	}

	.viewer-count {
		min-width: 4.5em;
		text-align: center;
		color: var(--color-viewer-text-muted);
		font-variant-numeric: tabular-nums;
	}

	.viewer-close {
		margin-left: auto;
	}

	.viewer-stage {
		display: grid;
		place-items: center;
		min-height: 0;
		padding: var(--space-2) var(--space-4);
		touch-action: pan-y pinch-zoom;
	}

	/* The whole picture shows, as large as the window allows. */
	.viewer-image {
		display: block;
		width: auto;
		height: auto;
		max-width: 100%;
		max-height: 100%;
		min-width: min(16rem, 100%);
		object-fit: contain;
	}

	.viewer-failed {
		margin: 0;
		color: var(--color-viewer-text-muted);
	}

	.viewer-details {
		max-height: 35dvh;
		overflow-y: auto;
		padding: var(--space-3) var(--space-4) var(--space-4);
		border-top: 1px solid color-mix(in srgb, var(--color-viewer-text) 20%, transparent);
		font-size: var(--font-size-small);
	}

	.viewer-details > * {
		max-width: var(--layout-measure);
	}

	.viewer-caption :global(p) {
		margin: 0 0 var(--space-1);
		text-indent: 0;
	}

	.viewer-caption,
	.viewer-caption :global(*) {
		color: var(--color-viewer-text);
	}

	.viewer-credit {
		margin: var(--space-1) 0 0;
		color: var(--color-viewer-text-muted);
	}

	.viewer-links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin: var(--space-2) 0 0;
		padding: 0;
		list-style: none;
	}

	.image-viewer a,
	.image-viewer a:visited,
	.viewer-caption :global(a) {
		color: var(--color-viewer-link);
		text-decoration: underline;
	}

	.image-viewer a:focus-visible,
	.viewer-caption :global(a:focus-visible) {
		color: var(--focus-text);
	}

	@media (forced-colors: active) {
		.image-viewer {
			border: 1px solid CanvasText;
		}
	}
</style>
