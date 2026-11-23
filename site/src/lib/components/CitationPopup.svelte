<script lang="ts">
	// Shows a source in place when a reader selects its marker, so the page
	// never jumps to the Sources list (Trevor, Nov. 22, 2026; site/DESIGN.md,
	// section 6, "Citations"). It follows Wikipedia: on wide screens,
	// pointing at a marker or moving to it with the keyboard shows the
	// citation in a small window beside it (Reference Previews), and selecting
	// the marker keeps the window open; on phones and other touch screens,
	// selecting a marker opens the citation in a drawer from the bottom of the
	// screen. Escape closes either and puts focus back on the marker.
	//
	// The window and drawer show a copy of the source's entry in the Sources
	// list (src/lib/note-copies.ts), the place in the source the marker cites,
	// and a link to the entry. The marker stays a link to that entry, so
	// without scripts, with the "Go to the Sources list" setting, or when
	// printed, the list is where the source is read.
	import { afterNavigate } from '$app/navigation';
	import X from '@lucide/svelte/icons/x';
	import { onMount, tick } from 'svelte';
	import { citationHtml, noteEntry } from '#lib/note-copies.ts';

	const previewId = 'citation-preview';
	const showDelay = 250;
	const hideDelay = 300;
	// Phones, and screens with no pointer that can hover, get the drawer.
	const drawerQuery = '(max-width: 40rem), (hover: none)';

	interface Shown {
		number: string;
		html: string;
		where?: string;
		entry: string;
	}

	let shown = $state<Shown | undefined>();
	/** "preview" follows the pointer or focus; "pinned" stays until closed; "drawer" is the phone view. */
	let mode = $state<'preview' | 'pinned' | 'drawer'>('preview');
	let position = $state({ top: 0, left: 0 });
	let popup: HTMLDivElement | undefined = $state();
	let drawer: HTMLDialogElement | undefined = $state();
	let marker: HTMLAnchorElement | undefined;
	let showTimer: ReturnType<typeof setTimeout> | undefined;
	let hideTimer: ReturnType<typeof setTimeout> | undefined;

	/** True unless the reader chose to go to the list or to open notes under the paragraph. */
	function enabled(): boolean {
		const choice = document.documentElement.dataset.noteDisplay;
		return choice === undefined || choice === 'popup';
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
		return {
			number: link.textContent?.trim() ?? '',
			html: citationHtml(entry, { newTab: true }),
			where: link.dataset.where,
			entry: link.hash
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

	async function open(link: HTMLAnchorElement, how: typeof mode, moveFocus = false): Promise<void> {
		const content = read(link);
		if (!content) return;
		close({ restoreFocus: false });
		marker = link;
		shown = content;
		mode = how;
		if (how === 'preview') link.setAttribute('aria-describedby', previewId);
		else link.setAttribute('aria-expanded', 'true');
		await tick();
		if (how === 'drawer') {
			drawer?.showModal();
		} else {
			place(link);
			if (moveFocus) popup?.focus();
		}
	}

	function close({ restoreFocus = true } = {}): void {
		cancelTimers();
		if (!shown) return;
		const last = marker;
		const hadFocus = within(document.activeElement, popup) || within(document.activeElement, drawer);
		if (drawer?.open) drawer.close();
		last?.removeAttribute('aria-describedby');
		last?.removeAttribute('aria-expanded');
		marker = undefined;
		shown = undefined;
		if (restoreFocus && hadFocus) last?.focus();
	}

	function laterHide(): void {
		if (mode !== 'preview') return;
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => close(), hideDelay);
	}

	afterNavigate(() => close({ restoreFocus: false }));

	onMount(() => {
		const onClick = (event: MouseEvent) => {
			if (!enabled() || event.defaultPrevented) return;
			if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const link = markerFrom(event.target);
			if (!link) return;
			event.preventDefault();
			if (link === marker && mode !== 'preview') {
				close();
				return;
			}
			if (window.matchMedia(drawerQuery).matches) {
				void open(link, 'drawer');
			} else if (link === marker && event.detail > 0) {
				// A mouse click on a marker already previewed keeps the window open where it is.
				mode = 'pinned';
				link.removeAttribute('aria-describedby');
				link.setAttribute('aria-expanded', 'true');
			} else {
				// From the keyboard (detail 0), focus moves into the window so its links can be reached.
				void open(link, 'pinned', event.detail === 0);
			}
		};
		const onPointerOver = (event: PointerEvent) => {
			if (event.pointerType !== 'mouse' || !enabled()) return;
			if (within(event.target, popup)) {
				clearTimeout(hideTimer);
				return;
			}
			const link = markerFrom(event.target);
			if (!link || window.matchMedia(drawerQuery).matches) return;
			clearTimeout(hideTimer);
			if (link === marker || (shown && mode !== 'preview')) return;
			clearTimeout(showTimer);
			showTimer = setTimeout(() => void open(link, 'preview'), showDelay);
		};
		const onPointerOut = (event: PointerEvent) => {
			if (event.pointerType !== 'mouse') return;
			const link = markerFrom(event.target);
			if (link) clearTimeout(showTimer);
			if ((link && link === marker) || within(event.target, popup)) {
				if (!within(event.relatedTarget, popup) && markerFrom(event.relatedTarget) !== marker) laterHide();
			}
		};
		const onFocusIn = (event: FocusEvent) => {
			if (!enabled() || (shown && mode !== 'preview')) return;
			const link = markerFrom(event.target);
			if (link && link !== marker && !window.matchMedia(drawerQuery).matches) void open(link, 'preview');
		};
		const onFocusOut = (event: FocusEvent) => {
			if (!shown || mode === 'drawer') return;
			const next = event.relatedTarget;
			if (within(next, popup) || markerFrom(next) === marker) return;
			if (mode === 'preview') {
				// Focus can leave while the page is updating, so the window closes just after.
				if (markerFrom(event.target) === marker) queueMicrotask(() => close({ restoreFocus: false }));
			} else if (within(event.target, popup) && next) {
				// Tabbing out of the open window goes back to its marker, so the reader keeps their place.
				const last = marker;
				queueMicrotask(() => {
					close({ restoreFocus: false });
					last?.focus();
				});
			}
		};
		const onPointerDown = (event: PointerEvent) => {
			if (!shown || mode !== 'pinned') return;
			if (within(event.target, popup) || markerFrom(event.target) === marker) return;
			close({ restoreFocus: false });
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || !shown || mode === 'drawer') return;
			const last = marker;
			const pinned = mode === 'pinned';
			const focusInside = within(document.activeElement, popup);
			close({ restoreFocus: false });
			if (focusInside || pinned) last?.focus();
		};
		const onResize = () => {
			if (shown && mode !== 'drawer') close({ restoreFocus: false });
		};
		document.addEventListener('click', onClick, true);
		document.addEventListener('pointerover', onPointerOver);
		document.addEventListener('pointerout', onPointerOut);
		document.addEventListener('focusin', onFocusIn);
		document.addEventListener('focusout', onFocusOut);
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		window.addEventListener('resize', onResize);
		return () => {
			close({ restoreFocus: false });
			document.removeEventListener('click', onClick, true);
			document.removeEventListener('pointerover', onPointerOver);
			document.removeEventListener('pointerout', onPointerOut);
			document.removeEventListener('focusin', onFocusIn);
			document.removeEventListener('focusout', onFocusOut);
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('resize', onResize);
		};
	});
</script>

{#snippet content(source: Shown, titleId: string)}
	<div class="citation-top">
		<p class="citation-title" id={titleId}>Source {source.number}</p>
		{#if mode !== 'preview'}
			<button class="button button-quiet citation-close" type="button" onclick={() => close()}>
				<X size={20} strokeWidth={1.75} />
				<span class="visually-hidden">Close</span>
			</button>
		{/if}
	</div>
	<div class="citation-text">{@html source.html}</div>
	{#if source.where}<p class="citation-where muted">Cited at: {source.where}</p>{/if}
	<p class="citation-list-link">
		<a href={source.entry} onclick={() => close({ restoreFocus: false })}>See it in the Sources list</a>
	</p>
{/snippet}

{#if shown && mode !== 'drawer'}
	<!--
		The preview describes the marker for screen readers (aria-describedby);
		once selected, the window is a small non-modal dialog.
	-->
	<div
		bind:this={popup}
		id={previewId}
		class="citation-popup no-print"
		role={mode === 'pinned' ? 'dialog' : undefined}
		aria-labelledby={mode === 'pinned' ? 'citation-popup-title' : undefined}
		tabindex="-1"
		style:top="{position.top}px"
		style:left="{position.left}px"
	>
		{@render content(shown, 'citation-popup-title')}
	</div>
{/if}

<dialog
	bind:this={drawer}
	class="citation-drawer no-print"
	aria-labelledby="citation-drawer-title"
	onclose={() => {
		// Escape, or the drawer closed from inside; a drawer opened again since stays open.
		if (mode === 'drawer' && !drawer?.open) close();
	}}
	onclick={(event) => {
		// A tap on the shaded page behind the drawer closes it.
		if (event.target === drawer) close();
	}}
>
	{#if shown && mode === 'drawer'}
		{@render content(shown, 'citation-drawer-title')}
	{/if}
</dialog>

<style>
	.citation-popup {
		position: absolute;
		z-index: 20;
		width: min(26rem, calc(100vw - 16px));
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

	.citation-drawer {
		position: fixed;
		inset: auto 0 0 0;
		width: 100%;
		max-width: none;
		max-height: 70vh;
		margin: 0;
		padding: var(--space-3) var(--space-4) var(--space-5);
		border: 0;
		border-top: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel) var(--radius-panel) 0 0;
		background: var(--color-paper);
		color: var(--color-ink);
		font-size: var(--font-size-body);
		overflow-y: auto;
	}

	/* The drawer slides up from the bottom edge (site/DESIGN.md, section 6, "Motion"). */
	.citation-drawer[open] {
		transition: translate var(--motion-duration-medium) var(--motion-easing-enter);

		@starting-style {
			translate: 0 100%;
		}
	}

	/* The same shade as the site's other dialogs (Modal.svelte). */
	.citation-drawer::backdrop {
		background: var(--color-band);
		opacity: 0.6;
		transition: opacity var(--motion-duration-medium) var(--motion-easing-enter);
	}

	.citation-drawer[open]::backdrop {
		@starting-style {
			opacity: 0;
		}
	}

	.citation-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	p,
	.citation-text {
		margin: 0 0 var(--space-2);
	}

	p:last-child {
		margin-bottom: 0;
	}

	.citation-title {
		font-weight: var(--font-weight-semibold);
	}

	.citation-close {
		margin: calc(-1 * var(--space-2)) calc(-1 * var(--space-2)) 0 0;
	}

	/* Long web addresses in citations break anywhere rather than widen the window. */
	.citation-text :global(a) {
		overflow-wrap: anywhere;
	}
</style>
