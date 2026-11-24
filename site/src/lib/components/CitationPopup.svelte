<script lang="ts">
	// A preview of a marker's source, as Wikipedia's Reference Previews show
	// it (site/DESIGN.md, section 6, "Citations"). On wide screens, pointing at
	// a marker or moving to it with the keyboard shows the citation in a small
	// window beside it; the window stays while the pointer is over it, so its
	// links and its copy button can be used. Selecting the marker (click, tap
	// or Enter) goes to the source in the Sources list, where the source is
	// highlighted and its number links back (Trevor, Nov. 23, 2026: "clicking
	// the number for source should jump to the bottom"). There is no second
	// window to open and close. Phones and screens without hover get no
	// preview: a tap goes to the list.
	//
	// From the keyboard, Tab on a marker whose preview is showing moves into
	// the window, Tab past its last control goes on to whatever follows the
	// marker, and Shift+Tab or Escape returns to the marker.
	//
	// The window shows a copy of the source's entry in the Sources list
	// (src/lib/note-copies.ts) and the place in the source the marker cites.
	// Copy puts the full citation, as the Sources list gives it in Indigo Book
	// form, on the clipboard (Trevor, Nov. 23, 2026).
	import { afterNavigate } from '$app/navigation';
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import { onMount, tick } from 'svelte';
	import { citationHtml, noteEntry } from '#lib/note-copies.ts';
	import { copyRichText } from '#lib/clipboard.ts';

	const previewIdentifier = 'citation-preview';
	const showDelay = 250;
	// Long enough to move the pointer from the marker onto the window.
	const hideDelay = 400;
	const copiedFor = 2500;
	const failedMessage = 'Your browser did not allow copying. Select the citation and copy it yourself.';
	// Phones, and screens with no pointer that can hover, get no preview.
	const noPreviewQuery = '(max-width: 40rem), (hover: none)';
	const focusableSelector = [
		'a[href]',
		'area[href]',
		'button:not([disabled])',
		'input:not([disabled]):not([type="hidden"])',
		'select:not([disabled])',
		'textarea:not([disabled])',
		'summary',
		'iframe',
		'[tabindex]:not([tabindex="-1"])',
		'[contenteditable="true"]'
	].join(', ');

	interface Shown {
		number: string;
		html: string;
		where?: string;
		/** The citation for the clipboard, as plain text and as HTML (so italics survive a paste). */
		copyText: string;
		copyHtml: string;
	}

	let shown = $state<Shown | undefined>();
	let position = $state({ top: 0, left: 0 });
	let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
	let popup: HTMLDivElement | undefined = $state();
	let marker: HTMLAnchorElement | undefined;
	let showTimer: ReturnType<typeof setTimeout> | undefined;
	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;
	/** Set while focus is put back on a marker, so its preview is not opened again. */
	let returningFocus = false;

	/** True unless the reader chose to go straight to the list or to open notes under the paragraph. */
	function enabled(): boolean {
		const choice = document.documentElement.dataset.noteDisplay;
		return choice === undefined || choice === 'popup';
	}

	function noPreview(): boolean {
		return window.matchMedia(noPreviewQuery).matches;
	}

	function markerFrom(target: EventTarget | null): HTMLAnchorElement | undefined {
		const found = (target as Element | null)?.closest?.('a.note-marker');
		return found instanceof HTMLAnchorElement ? found : undefined;
	}

	function within(target: EventTarget | null, element: Element | undefined): boolean {
		return !!element && target instanceof Node && element.contains(target);
	}

	function cancelTimers(): void {
		clearTimeout(showTimer);
		clearTimeout(hideTimer);
	}

	function read(link: HTMLAnchorElement): Shown | undefined {
		const entry = noteEntry(link);
		if (!entry) return undefined;
		const copyHtml = citationHtml(entry);
		const holder = document.createElement('div');
		holder.innerHTML = copyHtml;
		// A copied citation is the citation alone, without the places to read it.
		for (const hidden of holder.querySelectorAll('.visually-hidden, .reading-links')) hidden.remove();
		return {
			number: link.textContent?.trim() ?? '',
			html: citationHtml(entry, { newTab: true }),
			where: link.dataset.where,
			copyText: (holder.textContent ?? '').replace(/\s+/g, ' ').trim(),
			copyHtml: holder.innerHTML
		};
	}

	function place(link: HTMLAnchorElement): void {
		if (!popup) return;
		const gap = 6;
		const margin = 8;
		const box = link.getBoundingClientRect();
		const width = popup.offsetWidth;
		const height = popup.offsetHeight;
		let top = box.bottom + gap;
		if (top + height > window.innerHeight - margin && box.top - gap - height > margin) {
			top = box.top - gap - height;
		}
		const left = Math.min(Math.max(box.left - margin, margin), window.innerWidth - width - margin);
		position = { top: top + window.scrollY, left: Math.max(margin, left) + window.scrollX };
	}

	async function open(link: HTMLAnchorElement): Promise<void> {
		const content = read(link);
		if (!content) return;
		close();
		marker = link;
		shown = content;
		copyState = 'idle';
		link.setAttribute('aria-describedby', previewIdentifier);
		await tick();
		place(link);
	}

	function close(): void {
		cancelTimers();
		clearTimeout(copiedTimer);
		if (!shown) return;
		marker?.removeAttribute('aria-describedby');
		marker = undefined;
		shown = undefined;
	}

	/** Puts focus back on the marker without opening its preview again. */
	function backToMarker(keepOpen: boolean): void {
		const last = marker;
		if (!keepOpen) close();
		returningFocus = true;
		last?.focus();
		returningFocus = false;
	}

	function laterHide(): void {
		clearTimeout(hideTimer);
		hideTimer = setTimeout(close, hideDelay);
	}

	function controls(): HTMLElement[] {
		return popup ? [...popup.querySelectorAll<HTMLElement>(focusableSelector)] : [];
	}

	/** The first control after a marker in the page's Tab order, leaving out the preview. */
	function nextAfter(link: HTMLAnchorElement): HTMLElement | undefined {
		for (const element of document.querySelectorAll<HTMLElement>(focusableSelector)) {
			if (element === link || within(element, popup) || element.tabIndex < 0) continue;
			if (!(link.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
			if (!element.checkVisibility({ visibilityProperty: true })) continue;
			return element;
		}
		return undefined;
	}

	async function copyCitation(): Promise<void> {
		if (!shown) return;
		const { copyText, copyHtml } = shown;
		try {
			await copyRichText(copyText, copyHtml);
			copyState = 'copied';
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (copyState = 'idle'), copiedFor);
		} catch {
			// The message stays, so the reader can copy by hand.
			copyState = 'failed';
		}
	}

	afterNavigate(() => close());

	onMount(() => {
		const onClick = (event: MouseEvent) => {
			if (!enabled() || event.defaultPrevented) return;
			if (!markerFrom(event.target)) return;
			// The link goes to its entry in the Sources list (SourceList.svelte
			// opens the entry's group first); the preview is no longer needed.
			close();
		};
		const onPointerOver = (event: PointerEvent) => {
			if (event.pointerType !== 'mouse' || !enabled()) return;
			if (within(event.target, popup)) {
				clearTimeout(hideTimer);
				return;
			}
			const link = markerFrom(event.target);
			if (!link || noPreview()) return;
			clearTimeout(hideTimer);
			if (link === marker) return;
			clearTimeout(showTimer);
			showTimer = setTimeout(() => void open(link), showDelay);
		};
		const onPointerOut = (event: PointerEvent) => {
			if (event.pointerType !== 'mouse') return;
			const link = markerFrom(event.target);
			if (link) clearTimeout(showTimer);
			if ((link && link === marker) || within(event.target, popup)) {
				if (within(event.relatedTarget, popup) || markerFrom(event.relatedTarget) === marker) return;
				// Keep it open while the keyboard is using it.
				if (within(document.activeElement, popup)) return;
				laterHide();
			}
		};
		const onFocusIn = (event: FocusEvent) => {
			if (!enabled() || returningFocus || within(event.target, popup)) return;
			const link = markerFrom(event.target);
			if (link && link !== marker && !noPreview()) void open(link);
		};
		const onFocusOut = (event: FocusEvent) => {
			if (!shown) return;
			const next = event.relatedTarget;
			if (within(next, popup) || markerFrom(next) === marker) return;
			if (markerFrom(event.target) === marker || within(event.target, popup)) {
				// Focus can leave while the page is updating, so the window closes just after.
				queueMicrotask(close);
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (!shown || !marker) return;
			const active = document.activeElement;
			const inside = within(active, popup);
			if (event.key === 'Escape') {
				if (inside) backToMarker(false);
				else close();
				return;
			}
			if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
			const list = controls();
			if (active === marker && !event.shiftKey && list.length > 0) {
				// Into the window, as if it sat right after the marker.
				event.preventDefault();
				list[0].focus();
			} else if (inside && event.shiftKey && active === list[0]) {
				event.preventDefault();
				backToMarker(true);
			} else if (inside && !event.shiftKey && active === list.at(-1)) {
				event.preventDefault();
				const next = nextAfter(marker);
				close();
				next?.focus();
			}
		};
		const onResize = () => close();
		document.addEventListener('click', onClick, true);
		document.addEventListener('pointerover', onPointerOver);
		document.addEventListener('pointerout', onPointerOut);
		document.addEventListener('focusin', onFocusIn);
		document.addEventListener('focusout', onFocusOut);
		document.addEventListener('keydown', onKeyDown);
		window.addEventListener('resize', onResize);
		return () => {
			close();
			document.removeEventListener('click', onClick, true);
			document.removeEventListener('pointerover', onPointerOver);
			document.removeEventListener('pointerout', onPointerOut);
			document.removeEventListener('focusin', onFocusIn);
			document.removeEventListener('focusout', onFocusOut);
			document.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('resize', onResize);
		};
	});
</script>

{#if shown}
	<!--
		The preview describes the marker for screen readers (aria-describedby),
		and is a labeled group for the controls inside it.
	-->
	<div
		bind:this={popup}
		id={previewIdentifier}
		class="citation-popup no-print"
		role="group"
		aria-labelledby="citation-popup-title"
		style:top="{position.top}px"
		style:left="{position.left}px"
	>
		<div class="citation-top">
			<p class="citation-title" id="citation-popup-title">Source {shown.number}</p>
			<!-- Icon only (Trevor, Nov. 23, 2026); the icon turns to a check once copied. -->
			<button
				class="icon-button citation-copy"
				type="button"
				onclick={copyCitation}
				aria-label={copyState === 'copied' ? 'Citation copied' : `Copy citation ${shown.number}`}
				title={copyState === 'copied' ? 'Copied' : 'Copy the citation'}
			>
				{#if copyState === 'copied'}
					<Check size={18} strokeWidth={1.75} aria-hidden="true" />
				{:else}
					<Copy size={18} strokeWidth={1.75} aria-hidden="true" />
				{/if}
			</button>
			<span class="visually-hidden" role="status"
				>{copyState === 'copied' ? 'Citation copied.' : copyState === 'failed' ? failedMessage : ''}</span
			>
		</div>
		<div class="citation-text">{@html shown.html}</div>
		{#if shown.where}<p class="citation-where muted">Cited at: {shown.where}</p>{/if}
		{#if copyState === 'failed'}
			<!-- The status message in the top row says this to screen readers. -->
			<p class="citation-copy-failed" aria-hidden="true">{failedMessage}</p>
		{/if}
	</div>
{/if}

<style>
	.citation-popup {
		position: absolute;
		z-index: 20;
		width: min(var(--layout-popover), calc(100vw - 16px));
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
		color: var(--color-ink);
		font-size: var(--font-size-small);
		/* It eases in, rising a few pixels into place (site/DESIGN.md, section 6, "Motion"). */
		transition:
			opacity var(--motion-duration-medium) var(--motion-easing-enter),
			translate var(--motion-duration-medium) var(--motion-easing-enter);

		@starting-style {
			opacity: 0;
			translate: 0 var(--space-1);
		}
	}

	.citation-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	p,
	.citation-text {
		margin: 0 0 var(--space-2);
	}

	p:last-child {
		margin-bottom: 0;
	}

	.citation-top p {
		margin: 0;
	}

	.citation-title {
		font-weight: var(--font-weight-semibold);
	}

	.citation-copy {
		margin: calc(-1 * var(--space-2)) calc(-1 * var(--space-2)) calc(-1 * var(--space-2)) 0;
	}

	/* Long web addresses in citations break anywhere rather than widen the window. */
	.citation-text :global(a) {
		overflow-wrap: anywhere;
	}
</style>
