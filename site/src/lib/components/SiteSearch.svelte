<!--
	@component
	The site search in the masthead (site/DESIGN.md, section 6, "Search").
	Trevor asked on Nov. 22, 2026 for a plain search icon that opens into the
	search, with nothing else in the masthead moving. The icon opens a panel
	over the page, under the masthead's right edge: a search box and, as the
	reader types, the matches from the index built with the site
	(src/lib/site-search.ts), grouped by kind, each group foldable. Arrow keys
	move between the box and the results, Escape or the X closes the panel and
	returns focus to the icon, and Enter in the box opens the search page with
	every match. The panel searches what the search page searches, with the
	same words (src/lib/search-everything.ts), so its counts are the search
	page's counts; each group lists its first few and says how many more the
	search page has. A nation with a seal its page may show has the seal beside
	its name. The / key opens the panel from anywhere on the page
	(SiteHeader.svelte). Without scripts the icon is a link to /search.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import CountBadge from './CountBadge.svelte';
	import RecognitionBadges from './RecognitionBadges.svelte';
	import { page } from '$app/state';
	import { SvelteSet } from 'svelte/reactivity';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { matchEverything, panelAnswer, resultGroupLabels, type PanelAnswer, type ResultGroup } from '#lib/search-everything.ts';
	import { loadSearchRecords, type SearchRecords } from '#lib/search-records.ts';
	import { loadSearchIndex, prepareSearchIndex, type SearchEntry } from '#lib/site-search.ts';

	let { identifier = 'site-search' }: { identifier?: string } = $props();

	/** Results shown per group in the panel; the search page shows them all. Keep in step with src/routes/search/query. */
	const perGroup = 5;
	/** How long typing must pause before the server is asked, in milliseconds. */
	const serverPause = 120;
	/** How long after opening the files start downloading when the server has not been asked, in milliseconds. */
	const filesWait = 1000;

	let scripted = $state(false);
	let expanded = $state(false);
	let query = $state('');
	// Raw, not deeply reactive: wrapping every one of the index's entries made each keystroke about three times slower.
	let entries = $state.raw<SearchEntry[] | undefined>();
	let records = $state.raw<SearchRecords | undefined>();
	let failed = $state(false);
	let input: HTMLInputElement | undefined = $state();
	let opener: HTMLButtonElement | undefined = $state();
	let panel: HTMLDivElement | undefined = $state();
	/** Seals that failed to load, so a broken image is never shown. */
	const failedImages = new SvelteSet<string>();

	onMount(() => {
		scripted = true;
	});

	// A new page closes the panel.
	$effect(() => {
		void page.url.pathname;
		expanded = false;
	});

	const trimmed = $derived(query.trim());
	const ready = $derived(entries !== undefined && records !== undefined);
	/**
	 * The server's answer while the files download (src/routes/search/query),
	 * for the words it answers; once the files are here, the device answers,
	 * faster and offline, with the same results (src/lib/server/search-tables.ts).
	 */
	let fromServer = $state.raw<{ words: string; answer: PanelAnswer } | undefined>();
	const answer = $derived(
		entries && records && trimmed ? panelAnswer(matchEverything(entries, records, trimmed), perGroup) : fromServer?.words === trimmed ? fromServer.answer : undefined
	);
	const total = $derived(answer?.total ?? 0);

	// Until the files arrive, ask the server a moment after typing stops. A newer search cancels an older one,
	// and an answer the server cannot give leaves the panel waiting for the files, as it always did.
	$effect(() => {
		const words = trimmed;
		if (!expanded || ready || !words || fromServer?.words === words) return;
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const response = await fetch(`/search/query?q=${encodeURIComponent(words)}`, { signal: controller.signal });
				if (response.ok) fromServer = { words, answer: (await response.json()) as PanelAnswer };
			} catch {
				// Offline or cancelled: the files answer when they come.
			}
			if (!controller.signal.aborted) loadFiles();
		}, serverPause);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});
	const allLink = $derived(`/search?q=${encodeURIComponent(trimmed)}`);
	const groupLink = (group: ResultGroup) => `${allLink}&type=${group}`;
	const status = $derived(
		!trimmed || !answer
			? ''
			: total === 0
				? `Nothing matches “${trimmed}”.`
				: `${total.toLocaleString('en-US')} ${total === 1 ? 'result' : 'results'}`
	);

	/** Opens the panel with focus in the box; exported so a keyboard shortcut can call it. */
	export async function open() {
		expanded = true;
		await tick();
		// On a phone the panel is fixed just under the masthead, wherever it ends.
		const masthead = opener?.closest('header');
		if (masthead && panel) panel.style.setProperty('--search-panel-top', `${Math.max(masthead.getBoundingClientRect().bottom, 0) + 8}px`);
		input?.focus();
		// The files start downloading once the server has answered the first search, so on a slow connection that
		// answer is not held up behind them, or after a short wait when nothing is typed.
		setTimeout(loadFiles, filesWait);
	}

	let loading = false;

	/** Downloads the search files, once, and searches them on the device from then on. */
	async function loadFiles() {
		if (ready || failed || loading) return;
		loading = true;
		try {
			const [index, recordsFile] = await Promise.all([loadSearchIndex(), loadSearchRecords()]);
			// Fold the names a part at a time before switching from the server's answers, so no keystroke waits for it.
			await prepareSearchIndex(index);
			[entries, records] = [index, recordsFile];
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	}

	async function close() {
		expanded = false;
		await tick();
		opener?.focus();
	}

	/** The box, then each group's heading and each result, in reading order. */
	function stops(): HTMLElement[] {
		const inside = panel ? [...panel.querySelectorAll<HTMLElement>('summary, details[open] a, a.all-results')] : [];
		return [input, ...inside].filter((element): element is HTMLElement => Boolean(element));
	}

	function onKey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		const list = stops();
		const index = list.indexOf(document.activeElement as HTMLElement);
		const next = event.key === 'ArrowDown' ? Math.min(index + 1, list.length - 1) : Math.max(index - 1, 0);
		event.preventDefault();
		list[next]?.focus();
	}

	// A click or focus outside the panel closes it.
	function closeWhenLeft(event: FocusEvent) {
		const next = event.relatedTarget as Node | null;
		if (next && !panel?.contains(next) && next !== opener) expanded = false;
	}

	function closeOnOutsideClick(event: MouseEvent) {
		const target = event.target as Node;
		if (expanded && !panel?.contains(target) && !opener?.contains(target)) expanded = false;
	}
</script>

<svelte:document onclick={closeOnOutsideClick} />

<div class="site-search">
	{#if scripted}
		<button
			bind:this={opener}
			class="icon-button"
			type="button"
			aria-label="Search"
			aria-keyshortcuts="/"
			title="Search (press /)"
			aria-expanded={expanded}
			aria-controls="{identifier}-panel"
			onclick={() => (expanded ? close() : open())}
		>
			<Search size={24} />
		</button>
	{:else}
		<a class="icon-button" href="/search" aria-label="Search" title="Search">
			<Search size={24} />
		</a>
	{/if}

	{#if expanded}
		<!-- The panel's keys and leaving it work from anywhere inside; the search box, results and buttons are the controls. -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div bind:this={panel} class="search-panel" id="{identifier}-panel" onkeydown={onKey} onfocusout={closeWhenLeft}>
			<form role="search" action="/search" method="get">
				<label class="visually-hidden" for={identifier}>Search nations, laws, stories and terms</label>
				<Search size={20} strokeWidth={1.75} aria-hidden="true" />
				<input
					bind:this={input}
					id={identifier}
					type="search"
					name="q"
					autocomplete="off"
					enterkeyhint="search"
					placeholder="Search nations, laws, stories and terms"
					aria-describedby="{identifier}-hint"
					bind:value={query}
				/>
				<button class="icon-button" type="button" aria-label="Close search" title="Close search" onclick={close}>
					<X size={20} strokeWidth={1.75} />
				</button>
			</form>
			<p class="visually-hidden" id="{identifier}-hint">Results appear below as you type. Use the down arrow to reach them, and Enter to see every result.</p>
			<p class="visually-hidden" role="status">{status}</p>

			{#if failed && !answer}
				<p class="message">The search index could not be loaded. Press Enter to open the search page.</p>
			{:else if trimmed && answer}
				{#if total === 0}
					<p class="message">Nothing matches “{trimmed}”. Check the spelling or try fewer words.</p>
				{:else}
					<div class="results">
						{#each answer.groups as { group, count, results } (group)}
							<details open>
								<summary>
									<span class="fold-mark"><ChevronDown size={18} /></span>
									<span>{resultGroupLabels[group]}</span>
									<CountBadge {count} />
								</summary>
								<ul>
									{#each results as result (`${result.link} ${result.title}`)}
										<li>
											{#if result.image && !failedImages.has(result.image)}<img
													class="seal image-backing"
													src={result.image}
													alt=""
													width="24"
													height="24"
													loading="lazy"
													decoding="async"
													onerror={() => failedImages.add(result.image ?? '')}
												/>{/if}
											<a href={result.link}>{result.title}</a>
											{#if result.matchedName}<span class="detail">also called {result.matchedName}</span>{:else if result.matchedGroup}<span class="detail">{result.matchedGroup}</span>{/if}
											{#if result.badges}<span class="detail"><RecognitionBadges badges={result.badges} size="small" /></span>{/if}
											{#if result.detail}<span class="detail">{result.detail}</span>{/if}
										</li>
									{/each}
									{#if count > results.length}
										<li><a class="more" href={groupLink(group)}>{(count - results.length).toLocaleString('en-US')} more</a></li>
									{/if}
								</ul>
							</details>
						{/each}
					</div>
					<a class="all-results" href={allLink}
						>{total === 1 ? 'Open the search page' : `See all ${total.toLocaleString('en-US')} results`} for “{trimmed}”</a
					>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	/* The panel is placed against this box, so opening it moves nothing else. */
	.site-search {
		position: relative;
		display: inline-flex;
	}

	.site-search > .icon-button[aria-expanded='true'] {
		background: color-mix(in srgb, currentColor 14%, transparent);
	}

	.search-panel {
		position: absolute;
		top: calc(100% + var(--space-2));
		right: 0;
		z-index: 20;
		width: min(34rem, calc(100vw - 2 * var(--space-4)));
		max-height: min(36rem, calc(100vh - 8rem));
		overflow-y: auto;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
		color: var(--color-ink);
		box-shadow: 0 var(--space-2) var(--space-5) color-mix(in srgb, var(--color-ink) 22%, transparent);
		text-align: left;
	}

	form {
		position: sticky;
		top: 0;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
		border-bottom: 1px solid var(--color-line);
		background: var(--color-paper);
		color: var(--color-ink-muted);
	}

	input {
		flex: 1 1 auto;
		min-width: 0;
		min-height: var(--layout-target-minimum);
		margin: 0;
		padding: 0 var(--space-2);
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
	}

	input::placeholder {
		color: var(--color-ink-muted);
		opacity: 1;
	}

	input::-webkit-search-cancel-button {
		appearance: none;
	}

	.message {
		margin: 0;
		padding: var(--space-3) var(--space-4);
	}

	.results {
		padding: var(--space-1) 0;
	}

	details + details {
		border-top: 1px solid var(--color-line);
	}

	summary {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-4);
		list-style: none;
		cursor: pointer;
		font-weight: var(--font-weight-semibold);
	}

	summary::-webkit-details-marker {
		display: none;
	}

	.fold-mark {
		display: inline-flex;
		transition: transform var(--motion-duration-short) var(--motion-easing-standard);
	}

	details:not([open]) .fold-mark {
		transform: rotate(-90deg);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0 0 var(--space-2);
	}

	li {
		position: relative;
	}

	/* A nation's seal, in the gutter beside its name, where its page may show one. */
	.seal {
		position: absolute;
		left: var(--space-4);
		top: calc(var(--space-1) + 2px);
		width: 20px;
		height: 20px;
		object-fit: contain;
	}

	li a {
		display: block;
		padding: var(--space-1) var(--space-4) 0 calc(var(--space-4) + 26px);
		font-weight: var(--font-weight-semibold);
	}

	li a.more {
		font-weight: normal;
		font-size: var(--font-size-small);
	}

	.detail {
		display: block;
		padding: 0 var(--space-4) var(--space-1) calc(var(--space-4) + 26px);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	/* Pinned to the panel's bottom edge, as the search box is to its top, so it shows however long the results run. */
	.all-results {
		position: sticky;
		bottom: 0;
		display: block;
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid var(--color-line);
		background: var(--color-paper);
		font-weight: var(--font-weight-semibold);
	}

	/* On a phone the panel spans the screen under the masthead. */
	@media (max-width: 40rem) {
		.search-panel {
			position: fixed;
			top: var(--search-panel-top, 3.5rem);
			left: var(--space-4);
			right: var(--space-4);
			width: auto;
		}
	}
</style>
