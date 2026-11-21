<script lang="ts">
	// Glossary cards (site/DESIGN.md, section 6, "Glossary link and hover
	// card"). Pointing at a defined term for a moment, or moving to it with the
	// keyboard, shows a short definition under it. As WCAG 2.2, 1.4.13 asks,
	// the card can be dismissed with Escape, stays open while the pointer is
	// over it, and stays until the pointer or focus leaves. The term stays a
	// link to its full entry, so the card is never the only way to the
	// definition, and it holds no links of its own (role="tooltip"). The
	// "Glossary cards" setting turns cards off. Definitions come from
	// /glossary/terms.json, fetched once when first needed.
	import { onMount, tick } from 'svelte';

	interface Term {
		id: string;
		term: string;
		expansion?: string;
		summary?: string;
	}

	const cardId = 'glossary-card';
	const showDelay = 400;
	const hideDelay = 250;

	let terms: Promise<Map<string, Term>> | undefined;
	let shown = $state<Term | undefined>();
	let position = $state({ top: 0, left: 0 });
	let card: HTMLDivElement | undefined = $state();
	let anchor: HTMLAnchorElement | undefined;
	let showTimer: ReturnType<typeof setTimeout> | undefined;
	let hideTimer: ReturnType<typeof setTimeout> | undefined;

	function loadTerms(): Promise<Map<string, Term>> {
		terms ??= fetch('/glossary/terms.json')
			.then((response) => (response.ok ? response.json() : []))
			.then((data: unknown) => {
				const list = (Array.isArray(data) ? data : ((data as { terms?: unknown })?.terms ?? [])) as Term[];
				return new Map(list.filter((entry) => entry?.id && entry.term).map((entry) => [entry.id, entry]));
			})
			.catch(() => {
				terms = undefined;
				return new Map();
			});
		return terms;
	}

	function enabled(): boolean {
		return document.documentElement.dataset.glossaryCards !== 'off';
	}

	function termIdOf(link: HTMLAnchorElement): string | undefined {
		const url = new URL(link.href);
		if (url.origin !== location.origin) return undefined;
		const match = /^\/glossary\/([a-z0-9-]+)$/.exec(url.pathname);
		return match?.[1] ?? (url.pathname === '/glossary' ? url.hash.slice(1) || undefined : undefined);
	}

	function cancelTimers(): void {
		clearTimeout(showTimer);
		clearTimeout(hideTimer);
	}

	async function show(link: HTMLAnchorElement): Promise<void> {
		const id = termIdOf(link);
		if (!id || !enabled()) return;
		const entry = (await loadTerms()).get(id);
		if (!entry) return;
		hide();
		anchor = link;
		shown = entry;
		link.setAttribute('aria-describedby', cardId);
		await tick();
		place(link);
	}

	function place(link: HTMLAnchorElement): void {
		if (!card) return;
		const gap = 6;
		const margin = 8;
		const box = link.getBoundingClientRect();
		const width = card.offsetWidth;
		const height = card.offsetHeight;
		let top = box.bottom + gap;
		if (top + height > window.innerHeight - margin && box.top - gap - height > margin) {
			top = box.top - gap - height;
		}
		const left = Math.min(Math.max(box.left, margin), window.innerWidth - width - margin);
		position = { top: top + window.scrollY, left: Math.max(margin, left) + window.scrollX };
	}

	function hide(): void {
		cancelTimers();
		if (!shown && !anchor) return;
		anchor?.removeAttribute('aria-describedby');
		anchor = undefined;
		shown = undefined;
	}

	function laterHide(): void {
		clearTimeout(hideTimer);
		hideTimer = setTimeout(hide, hideDelay);
	}

	function termLinkFrom(target: EventTarget | null): HTMLAnchorElement | undefined {
		const link = (target as Element | null)?.closest?.('a.term-link');
		return link instanceof HTMLAnchorElement ? link : undefined;
	}

	onMount(() => {
		const onPointerOver = (event: PointerEvent) => {
			if (event.pointerType !== 'mouse') return;
			const link = termLinkFrom(event.target);
			if (!link) return;
			clearTimeout(hideTimer);
			if (link === anchor) return;
			clearTimeout(showTimer);
			showTimer = setTimeout(() => void show(link), showDelay);
		};
		const onPointerOut = (event: PointerEvent) => {
			const link = termLinkFrom(event.target);
			if (!link) return;
			clearTimeout(showTimer);
			if (link === anchor) laterHide();
		};
		const onFocusIn = (event: FocusEvent) => {
			const link = termLinkFrom(event.target);
			if (link) void show(link);
		};
		const onFocusOut = (event: FocusEvent) => {
			// Focus can leave while the page is updating, so the card closes just after.
			if (anchor && termLinkFrom(event.target) === anchor) queueMicrotask(hide);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && shown) hide();
		};
		document.addEventListener('pointerover', onPointerOver);
		document.addEventListener('pointerout', onPointerOut);
		document.addEventListener('focusin', onFocusIn);
		document.addEventListener('focusout', onFocusOut);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			hide();
			document.removeEventListener('pointerover', onPointerOver);
			document.removeEventListener('pointerout', onPointerOut);
			document.removeEventListener('focusin', onFocusIn);
			document.removeEventListener('focusout', onFocusOut);
			document.removeEventListener('keydown', onKeyDown);
		};
	});
</script>

{#if shown}
	<div
		bind:this={card}
		id={cardId}
		class="glossary-card"
		role="tooltip"
		style:top="{position.top}px"
		style:left="{position.left}px"
		onpointerenter={() => clearTimeout(hideTimer)}
		onpointerleave={laterHide}
	>
		<p class="glossary-card-term">
			<strong>{shown.term}</strong>{#if shown.expansion}{' '}({shown.expansion}){/if}
		</p>
		{#if shown.summary}<p>{shown.summary}</p>{/if}
	</div>
{/if}

<style>
	.glossary-card {
		position: absolute;
		z-index: 20;
		width: min(24rem, calc(100vw - 16px));
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
		color: var(--color-ink);
		font-size: var(--font-size-small);
	}

	.glossary-card p {
		margin: 0 0 var(--space-2);
	}

	.glossary-card p:last-child {
		margin-bottom: 0;
	}
</style>
