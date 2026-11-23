<script lang="ts">
	// Link previews (site/DESIGN.md, section 6, "Link previews"). Pointing at a
	// link for a moment, or moving to it with the keyboard, shows a short
	// preview under it, the way Wikipedia and Wikiwand preview articles. Two
	// kinds of link get one:
	//
	// - a defined term (a.term-link): the term and its short definition, from
	//   /glossary/terms.json;
	// - a link to a nation's page inside the page's text: the nation's name,
	//   its seal where the page shows one, its recognition status, its states
	//   and the page's review status, from /nations/previews.json.
	//
	// As WCAG 2.2, 1.4.13 asks, the preview can be dismissed with Escape,
	// stays open while the pointer is over it, and stays until the pointer or
	// focus leaves. The link still goes where it says, so the preview is never
	// the only way to what it shows, and it holds no links of its own
	// (role="tooltip"). Links in menus, the sidebar, tables and search results
	// get no preview, since they sit in long lists. The "Previews" setting
	// (stored as glossaryCards) turns previews off. Each file is fetched once,
	// when first needed; without scripts there are no previews.
	import { onMount, tick } from 'svelte';

	interface Term {
		kind: 'term';
		id: string;
		term: string;
		expansion?: string;
		summary?: string;
	}

	interface Nation {
		kind: 'nation';
		id: string;
		name: string;
		recognition: string[];
		states: string;
		review: string;
		image?: string;
	}

	type Preview = Term | Nation;

	const cardId = 'link-preview';
	const showDelay = 400;
	const hideDelay = 250;
	// Links where a preview would get in the way: navigation, long lists and
	// tables, search results, and anything that asks for none.
	const noPreview = 'nav, header, table, dialog, [role="dialog"], .sidebar-wide, .sidebar-narrow, [data-no-preview]';
	// Addresses under /nations/ that are lists or maps, not a nation's page.
	const nationLists = new Set(['map', 'letter', 'state', 'previews.json', 'recourse', 'data']);

	let terms: Promise<Map<string, Term>> | undefined;
	let nations: Promise<Map<string, Nation>> | undefined;
	let shown = $state<Preview | undefined>();
	let imageFailed = $state(false);
	let position = $state({ top: 0, left: 0 });
	let card: HTMLDivElement | undefined = $state();
	let anchor: HTMLAnchorElement | undefined;
	let showTimer: ReturnType<typeof setTimeout> | undefined;
	let hideTimer: ReturnType<typeof setTimeout> | undefined;

	/** Fetches a list once; on failure the next preview tries again. */
	function load<Entry extends { id: string }>(
		address: string,
		key: string,
		kind: Entry extends { kind: infer Kind } ? Kind : never,
		reset: () => void
	): Promise<Map<string, Entry>> {
		return fetch(address)
			.then((response) => (response.ok ? response.json() : {}))
			.then((data: unknown) => {
				const list = ((data as Record<string, unknown>)?.[key] ?? []) as Entry[];
				return new Map(
					(Array.isArray(list) ? list : [])
						.filter((entry) => entry?.id)
						.map((entry) => [entry.id, { ...entry, kind }])
				);
			})
			.catch(() => {
				reset();
				return new Map();
			});
	}

	function loadTerms(): Promise<Map<string, Term>> {
		terms ??= load<Term>('/glossary/terms.json', 'terms', 'term', () => (terms = undefined));
		return terms;
	}

	function loadNations(): Promise<Map<string, Nation>> {
		nations ??= load<Nation>('/nations/previews.json', 'nations', 'nation', () => (nations = undefined));
		return nations;
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

	function nationIdOf(link: HTMLAnchorElement): string | undefined {
		const url = new URL(link.href);
		if (url.origin !== location.origin || url.hash) return undefined;
		const id = /^\/nations\/([a-z0-9-]+)$/.exec(url.pathname)?.[1];
		// A link to the page the reader is already on needs no preview.
		if (!id || nationLists.has(id) || url.pathname === location.pathname) return undefined;
		return id;
	}

	async function previewOf(link: HTMLAnchorElement): Promise<Preview | undefined> {
		if (link.classList.contains('term-link')) {
			const id = termIdOf(link);
			return id ? (await loadTerms()).get(id) : undefined;
		}
		const id = nationIdOf(link);
		return id ? (await loadNations()).get(id) : undefined;
	}

	function cancelTimers(): void {
		clearTimeout(showTimer);
		clearTimeout(hideTimer);
	}

	async function show(link: HTMLAnchorElement): Promise<void> {
		if (!enabled()) return;
		const entry = await previewOf(link);
		if (!entry || !link.isConnected) return;
		hide();
		anchor = link;
		shown = entry;
		imageFailed = false;
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

	/** The link under the pointer or focus, if it is one that gets a preview. */
	function previewLinkFrom(target: EventTarget | null): HTMLAnchorElement | undefined {
		const link = (target as Element | null)?.closest?.('a[href]');
		if (!(link instanceof HTMLAnchorElement)) return undefined;
		if (link.classList.contains('term-link')) return link;
		if (!link.closest('main') || link.closest(noPreview)) return undefined;
		return nationIdOf(link) ? link : undefined;
	}

	onMount(() => {
		const onPointerOver = (event: PointerEvent) => {
			if (event.pointerType !== 'mouse') return;
			const link = previewLinkFrom(event.target);
			if (!link) return;
			clearTimeout(hideTimer);
			if (link === anchor) return;
			clearTimeout(showTimer);
			showTimer = setTimeout(() => void show(link), showDelay);
		};
		const onPointerOut = (event: PointerEvent) => {
			const link = previewLinkFrom(event.target);
			if (!link) return;
			clearTimeout(showTimer);
			if (link === anchor) laterHide();
		};
		const onFocusIn = (event: FocusEvent) => {
			const link = previewLinkFrom(event.target);
			if (link) void show(link);
		};
		const onFocusOut = (event: FocusEvent) => {
			// Focus can leave while the page is updating, so the preview closes just after.
			if (anchor && previewLinkFrom(event.target) === anchor) queueMicrotask(hide);
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
		class="link-preview"
		role="tooltip"
		style:top="{position.top}px"
		style:left="{position.left}px"
		onpointerenter={() => clearTimeout(hideTimer)}
		onpointerleave={laterHide}
	>
		{#if shown.kind === 'term'}
			<p class="link-preview-title">
				<strong>{shown.term}</strong>{#if shown.expansion}{' '}({shown.expansion}){/if}
			</p>
			{#if shown.summary}<p>{shown.summary}</p>{/if}
		{:else}
			<div class="nation-preview">
				{#if shown.image && !imageFailed}
					<img src={shown.image} alt="" width="48" height="48" onerror={() => (imageFailed = true)} />
				{/if}
				<div>
					<p class="link-preview-title"><strong>{shown.name}</strong></p>
					{#if shown.recognition.length > 0}<p>{shown.recognition.join('; ')}</p>{/if}
					{#if shown.states}<p>{shown.states}</p>{/if}
					{#if shown.review}<p class="muted">Review status: {shown.review}</p>{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.link-preview {
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

	.link-preview p {
		margin: 0 0 var(--space-2);
	}

	.link-preview p:last-child {
		margin-bottom: 0;
	}

	.nation-preview {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
	}

	.nation-preview img {
		flex: none;
		width: 3rem;
		height: 3rem;
		object-fit: contain;
	}
</style>
