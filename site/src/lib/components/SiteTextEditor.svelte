<script lang="ts">
	// Editing the site's own wording where it shows (docs/site-text.md; mockup
	// design/site-text-editing, approved by Trevor on Nov. 23, 2026). For a
	// person with Contribute or Full on the site text, the masthead offers
	// Reading and Editing on every page that offers nothing of its own
	// (src/lib/page-editing.svelte.ts). While editing, each piece of fixed
	// text the build marked (src/lib/site-text-markers.ts) shows a faint
	// underline, and clicking it opens a small box to change it. Saved
	// changes are drafts, shown in place; Publish lists them and publishes
	// them, and the site then rebuilds with the new words.
	import Check from '@lucide/svelte/icons/check';
	import History from '@lucide/svelte/icons/history';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Send from '@lucide/svelte/icons/send';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import X from '@lucide/svelte/icons/x';
	import { onMount, tick } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { offerPageControls, type PageMode } from '#lib/page-editing.svelte.ts';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';
	import { shownWords, type SiteTextPiece } from '#lib/site-text.ts';
	import { readStored, writeStored } from '#lib/browser-storage.ts';

	type Level = 'no-access' | 'comment' | 'contribute' | 'full';
	interface Draft {
		key: string;
		place: string;
		before: string;
		after: string;
		published: string | null;
	}

	const modeKey = 'site-text-mode';
	const levelKey = 'site-text-level';
	const attributeNames: Record<string, string> = { 'aria-label': 'Label', title: 'Tooltip', placeholder: 'Placeholder', alt: 'Description' };

	let level = $state<Level>('no-access');
	let mode = $state<PageMode>('reading');
	let draftsShown = $state(false);
	let waiting = $state(0);
	let pieces = $state.raw<Map<string, SiteTextPiece>>(new Map());

	// The open editing box.
	let open = $state<{ key: string; attribute: string | null; top: number; left: number; sheet: boolean } | null>(null);
	let words = $state('');
	let saving = $state(false);
	let problem = $state('');
	let field = $state<HTMLTextAreaElement>();

	// The open Publish list.
	let list = $state<{ top: number; left: number; drafts: Draft[]; done: boolean } | null>(null);

	const editing = $derived(mode === 'editing');
	const showing = $derived(editing || draftsShown);
	// The piece the box is open for, outlined like the box.
	let openElement: Element | null = null;
	const openPiece = $derived(open ? pieces.get(open.key) : undefined);

	/** Every piece of text the page shows, by name. */
	function keysOnPage(): string[] {
		const keys = new Set<string>();
		for (const element of document.querySelectorAll('[data-text]')) keys.add(element.getAttribute('data-text') ?? '');
		for (const element of document.querySelectorAll('[data-text-attributes]')) {
			for (const mark of (element.getAttribute('data-text-attributes') ?? '').split(' ')) keys.add(mark.split(':')[1] ?? '');
		}
		keys.delete('');
		return [...keys];
	}

	async function load(keys: string[]) {
		const response = await fetch('/workspace/site-text/pieces.json', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ keys })
		}).catch(() => null);
		if (!response?.ok) {
			if (response && (response.status === 401 || response.status === 403)) {
				level = 'no-access';
				writeStored(levelKey, 'no-access', 'session');
			}
			return;
		}
		const answer = (await response.json()) as { level: Level; pieces: SiteTextPiece[]; waiting: number };
		level = answer.level;
		waiting = answer.waiting;
		writeStored(levelKey, `${answer.level} ${Date.now()}`, 'session');
		pieces = new Map([...pieces, ...answer.pieces.map((piece) => [piece.key, piece] as const)]);
	}

	// What each changed element said before, so Reading puts it back.
	const originals = new Map<Element, { text?: string; attributes: Record<string, string> }>();

	function remember(element: Element) {
		if (!originals.has(element)) originals.set(element, { attributes: {} });
		return originals.get(element)!;
	}

	/** Shows each piece's draft (or the published words) on the page, and marks drafts. */
	function apply() {
		for (const element of document.querySelectorAll('[data-text]')) {
			const piece = pieces.get(element.getAttribute('data-text') ?? '');
			if (!piece) continue;
			const shown = shownWords(piece);
			if (element.textContent !== shown) {
				const original = remember(element);
				original.text ??= element.textContent ?? '';
				element.textContent = shown;
			}
			element.classList.toggle('site-text-draft', piece.draft !== null);
		}
		for (const element of document.querySelectorAll('[data-text-attributes]')) {
			let draft = false;
			for (const mark of (element.getAttribute('data-text-attributes') ?? '').split(' ')) {
				const [attribute, key] = mark.split(':');
				const piece = pieces.get(key ?? '');
				if (!attribute || !piece) continue;
				const shown = shownWords(piece);
				if (element.getAttribute(attribute) !== shown) {
					const original = remember(element);
					original.attributes[attribute] ??= element.getAttribute(attribute) ?? '';
					element.setAttribute(attribute, shown);
				}
				draft ||= piece.draft !== null;
			}
			element.classList.toggle('site-text-draft', draft);
		}
	}

	/** Puts back what the built page said. */
	function restore() {
		for (const [element, original] of originals) {
			if (original.text !== undefined) element.textContent = original.text;
			for (const [attribute, value] of Object.entries(original.attributes)) element.setAttribute(attribute, value);
		}
		originals.clear();
		for (const element of document.querySelectorAll('.site-text-draft')) element.classList.remove('site-text-draft');
	}

	async function refresh() {
		if (!showing) return;
		await load(keysOnPage());
		apply();
	}

	function setMode(next: PageMode) {
		mode = next;
		writeStored(modeKey, next === 'editing' ? 'editing' : null, 'session');
		close();
		if (showing) void refresh();
		else restore();
	}

	function close() {
		openElement?.classList.remove('site-text-open');
		openElement = null;
		open = null;
		problem = '';
	}

	/** Opens the box for the piece of text at an element. */
	async function openFor(element: Element, key: string, attribute: string | null) {
		if (!pieces.has(key)) await load([key]);
		const piece = pieces.get(key);
		if (!piece) return;
		const box = element.getBoundingClientRect();
		const sheet = window.matchMedia('(max-width: 37.5rem)').matches;
		const width = Math.min(380, window.innerWidth - 32);
		open = {
			key,
			attribute,
			sheet,
			top: box.bottom + window.scrollY + 14,
			left: Math.max(16, Math.min(box.left + window.scrollX - 8, window.scrollX + window.innerWidth - width - 16))
		};
		words = shownWords(piece);
		problem = '';
		openElement?.classList.remove('site-text-open');
		openElement = element;
		element.classList.add('site-text-open');
		await tick();
		field?.focus();
		field?.setSelectionRange(words.length, words.length);
	}

	function pieceAt(target: Element): { element: Element; key: string; attribute: string | null } | null {
		const text = target.closest('[data-text]');
		if (text) return { element: text, key: text.getAttribute('data-text') ?? '', attribute: null };
		const labelled = target.closest('[data-text-attributes]');
		if (labelled) {
			const [attribute, key] = (labelled.getAttribute('data-text-attributes') ?? '').split(' ')[0].split(':');
			if (key) return { element: labelled, key, attribute };
		}
		return null;
	}

	function onClick(event: MouseEvent) {
		if (!editing || !(event.target instanceof Element)) return;
		if (event.target.closest('.site-text-box, .site-text-list, .page-controls')) return;
		const found = pieceAt(event.target);
		if (!found) {
			if (open) close();
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		void openFor(found.element, found.key, found.attribute);
	}

	function onKey(event: KeyboardEvent) {
		if (event.key === 'Escape' && (open || list)) {
			close();
			list = null;
			return;
		}
		if (!editing || event.key !== 'Enter' || !(document.activeElement instanceof Element)) return;
		if (document.activeElement.closest('.site-text-box, .site-text-list, .page-controls')) return;
		const inside = document.activeElement.querySelector('[data-text]') ?? document.activeElement;
		const found = pieceAt(inside);
		if (!found) return;
		event.preventDefault();
		event.stopPropagation();
		void openFor(found.element, found.key, found.attribute);
	}

	async function save(next: string | null) {
		if (!open) return;
		saving = true;
		problem = '';
		const response = await fetch('/workspace/site-text/save', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key: open.key, words: next, page: location.pathname })
		}).catch(() => null);
		saving = false;
		if (!response?.ok) {
			problem = response ? ((await response.json().catch(() => null)) as { message?: string } | null)?.message ?? 'Not saved.' : 'Not saved. Check the connection.';
			return;
		}
		const answer = (await response.json()) as Pick<SiteTextPiece, 'key' | 'published' | 'draft'> & { waiting: number };
		const piece = pieces.get(answer.key);
		if (piece) pieces = new Map([...pieces, [answer.key, { ...piece, published: answer.published, draft: answer.draft }]]);
		waiting = answer.waiting;
		apply();
		close();
	}

	async function showList() {
		const button = document.querySelector('.page-controls .publish');
		const box = button?.getBoundingClientRect();
		const width = Math.min(440, window.innerWidth - 32);
		const response = await fetch('/workspace/site-text/drafts.json').catch(() => null);
		if (!response?.ok) return;
		const answer = (await response.json()) as { drafts: Draft[] };
		list = {
			drafts: answer.drafts,
			done: false,
			top: (box?.bottom ?? 60) + window.scrollY + 10,
			left: Math.max(16, Math.min((box?.left ?? 16) + window.scrollX - 8, window.scrollX + window.innerWidth - width - 16))
		};
	}

	async function discard(draft: Draft) {
		const response = await fetch('/workspace/site-text/save', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key: draft.key, words: draft.published, page: null })
		}).catch(() => null);
		if (!response?.ok || !list) return;
		const answer = (await response.json()) as Pick<SiteTextPiece, 'key' | 'published' | 'draft'> & { waiting: number };
		waiting = answer.waiting;
		list = { ...list, drafts: list.drafts.filter((each) => each.key !== draft.key) };
		const piece = pieces.get(draft.key);
		if (piece) {
			pieces = new Map([...pieces, [draft.key, { ...piece, published: answer.published, draft: answer.draft }]]);
			apply();
		}
	}

	async function publishAll() {
		if (!list) return;
		const response = await fetch('/workspace/site-text/publish', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ keys: list.drafts.map((draft) => draft.key) })
		}).catch(() => null);
		if (!response?.ok) return;
		list = { ...list, done: true };
		waiting = 0;
		pieces = new Map([...pieces].map(([key, piece]) => [key, piece.draft ? { ...piece, published: piece.draft.words, draft: null } : piece]));
		apply();
	}

	onMount(() => {
		if (!readSignedInHint(document.cookie).signedIn) return;
		const remembered = readStored(levelKey, 'session')?.split(' ');
		const fresh = remembered && Date.now() - Number(remembered[1] ?? 0) < 10 * 60 * 1000;
		if (fresh) level = remembered[0] as Level;
		const asked = new URLSearchParams(location.search).has('edit-text');
		if (asked) {
			writeStored(modeKey, 'editing', 'session');
			const address = new URL(location.href);
			address.searchParams.delete('edit-text');
			history.replaceState(history.state, '', address);
		}
		if (readStored(modeKey, 'session') === 'editing') mode = 'editing';
		if (!(fresh && level === 'no-access')) void load(showing ? keysOnPage() : []).then(() => showing && apply());

		document.addEventListener('click', onClick, true);
		document.addEventListener('keydown', onKey, true);
		// Parts of a page drawn again, such as an opened panel, show drafts too.
		const watcher = new MutationObserver(() => {
			if (showing && pieces.size > 0) apply();
		});
		watcher.observe(document.body, { childList: true, subtree: true });
		return () => {
			document.removeEventListener('click', onClick, true);
			document.removeEventListener('keydown', onKey, true);
			watcher.disconnect();
		};
	});

	afterNavigate(({ type }) => {
		if (type === 'enter') return;
		originals.clear();
		close();
		list = null;
		void refresh();
	});

	$effect(() => {
		document.documentElement.classList.toggle('site-text-editing', editing);
		return () => document.documentElement.classList.remove('site-text-editing');
	});

	// The masthead's controls, on every page that offers none of its own.
	$effect(() => {
		if (level !== 'contribute' && level !== 'full') return;
		return offerPageControls({
			modes: ['reading', 'editing'],
			get mode() {
				return mode;
			},
			setMode,
			drafts: {
				get shown() {
					return showing;
				},
				set(shown: boolean) {
					draftsShown = shown;
					if (showing) void refresh();
					else restore();
				}
			},
			history: { title: 'Site text history', href: '/workspace/site-text' },
			get publish() {
				if (level !== 'full' || waiting === 0) return null;
				return { title: `Publish ${waiting === 1 ? '1 change' : `${waiting} changes`}`, count: waiting, onclick: () => void showList() };
			}
		}, { fallback: true });
	});
</script>

{#if open && openPiece}
	<div
		class="site-text-box"
		class:sheet={open.sheet}
		style:top={open.sheet ? null : `${open.top}px`}
		style:left={open.sheet ? null : `${open.left}px`}
		role="dialog"
		aria-label="Edit text"
	>
		{#if open.sheet}<span class="grabber" aria-hidden="true"></span>{:else}<span class="arrow" aria-hidden="true"></span>{/if}
		{#if open.attribute}<p class="kind">{attributeNames[open.attribute] ?? open.attribute}</p>{/if}
		<label class="visually-hidden" for="site-text-words">Text</label>
		<textarea
			id="site-text-words"
			bind:this={field}
			bind:value={words}
			rows="2"
			maxlength="2000"
			onkeydown={(event) => {
				if (event.key === 'Enter' && !event.shiftKey) {
					event.preventDefault();
					void save(words);
				}
			}}
		></textarea>
		{#if words.trim() !== openPiece.builtIn}
			<p class="built-in">Built-in: <s>{openPiece.builtIn}</s></p>
		{/if}
		{#if problem}<p class="problem" role="alert">{problem}</p>{/if}
		<div class="buttons">
			<button type="button" class="icon-button outline" title="Reset to built-in text" disabled={saving} onclick={() => save(null)}>
				<RotateCcw size={20} aria-hidden="true" /><span class="visually-hidden">Reset to built-in text</span>
			</button>
			<a class="icon-button outline" href="/workspace/site-text/{open.key}" title="History"><History size={20} aria-hidden="true" /><span class="visually-hidden">History</span></a>
			<span class="space"></span>
			<button type="button" class="icon-button" title="Cancel" onclick={close}><X size={20} aria-hidden="true" /><span class="visually-hidden">Cancel</span></button>
			<button type="button" class="icon-button save" title="Save draft" disabled={saving} onclick={() => save(words)}>
				<Check size={20} aria-hidden="true" /><span class="visually-hidden">Save draft</span>
			</button>
		</div>
	</div>
{/if}

{#if list}
	<div class="site-text-list" style:top="{list.top}px" style:left="{list.left}px" role="dialog" aria-label="Publish">
		{#if list.done}
			<p class="heading"><Check size={18} aria-hidden="true" />Live in a few minutes</p>
		{:else}
			<p class="heading"><Send size={18} aria-hidden="true" />{list.drafts.length === 1 ? '1 change' : `${list.drafts.length} changes`}</p>
			<ol>
				{#each list.drafts as draft (draft.key)}
					<li>
						<span class="where">{draft.place}</span>
						<s class="before">{draft.before}</s>
						<span class="after">{draft.after}</span>
						<button type="button" class="icon-button" title="Undo this change" onclick={() => discard(draft)}><Undo2 size={20} aria-hidden="true" /><span class="visually-hidden">Undo this change</span></button>
					</li>
				{/each}
			</ol>
			{#if list.drafts.length > 0}
				<div class="go">
					<button type="button" class="icon-button publish" title="Publish" onclick={publishAll}><Send size={22} aria-hidden="true" /><span class="visually-hidden">Publish</span></button>
				</div>
			{/if}
		{/if}
	</div>
{/if}

<style>
	/* While editing, each piece of text is shown as text with a faint dotted underline. */
	:global(html.site-text-editing site-text) {
		display: inline !important;
		text-decoration: underline dotted;
		text-decoration-color: color-mix(in srgb, currentColor 45%, transparent);
		text-underline-offset: 4px;
		cursor: text;
	}
	/* Labels a reader cannot see (a button's name, a picture's description) show when pointed at. */
	:global(html.site-text-editing [data-text-attributes]:is(:hover, :focus-visible)) {
		outline: 1px dotted color-mix(in srgb, currentColor 60%, transparent);
		outline-offset: 2px;
	}
	:global(html.site-text-editing .site-text-open) {
		outline: 2px solid var(--color-ink);
		outline-offset: 3px;
		border-radius: 4px;
	}
	:global(html.site-text-editing .site-text-draft),
	:global(html:not(.site-text-editing) site-text.site-text-draft) {
		background: var(--color-status-draft-background);
		box-shadow: inset 3px 0 0 var(--color-status-draft-rule);
		text-decoration: none;
	}
	:global(html:not(.site-text-editing) site-text.site-text-draft) {
		display: inline !important;
	}

	.site-text-box,
	.site-text-list {
		position: absolute;
		z-index: 60;
		box-sizing: border-box;
		padding: var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		color: var(--color-ink);
		box-shadow: 0 12px 32px color-mix(in srgb, var(--color-ink) 22%, transparent);
		font-family: var(--font-family-sans);
		font-size: var(--font-size-body);
		line-height: var(--font-line-height-body, 1.4);
		text-align: left;
	}
	.site-text-box {
		width: min(380px, calc(100vw - 32px));
	}
	.site-text-box.sheet {
		position: fixed;
		inset: auto 0 0 0;
		width: auto;
		border-radius: var(--radius-panel) var(--radius-panel) 0 0;
		box-shadow: 0 -24px 48px color-mix(in srgb, var(--color-ink) 16%, transparent);
	}
	.grabber {
		display: block;
		width: 40px;
		height: 4px;
		margin: 0 auto var(--space-3);
		border-radius: 2px;
		background: var(--color-line);
	}
	.arrow {
		position: absolute;
		top: -7px;
		left: 28px;
		width: 12px;
		height: 12px;
		background: inherit;
		border-left: 1px solid var(--color-line);
		border-top: 1px solid var(--color-line);
		transform: rotate(45deg);
	}
	textarea {
		display: block;
		box-sizing: border-box;
		width: 100%;
		min-height: 4rem;
		font: inherit;
	}
	.kind,
	.built-in {
		margin: var(--space-2) 0 0;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}
	.kind {
		margin: 0 0 var(--space-1);
	}
	.problem {
		margin: var(--space-2) 0 0;
		color: var(--color-danger);
	}
	.buttons {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin-top: var(--space-3);
	}
	.space {
		flex: 1;
	}
	.outline {
		border: 1px solid var(--color-control-border);
	}
	.save,
	.publish {
		background: var(--color-action);
		color: var(--color-action-text);
	}
	.site-text-list {
		width: min(440px, calc(100vw - 32px));
	}
	.heading {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-2);
		font-weight: 700;
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-1) var(--space-2);
		padding: var(--space-2) 0;
		border-top: 1px solid var(--color-line);
	}
	li > :not(button) {
		grid-column: 1;
	}
	li > button {
		grid-column: 2;
		grid-row: 1 / span 3;
		align-self: center;
	}
	.where {
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}
	.before {
		color: var(--color-ink-muted);
	}
	.after {
		font-weight: 600;
	}
	.go {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--space-2);
	}
</style>
