<!--
	@component
	The site search, in the masthead itself (site/DESIGN.md, section 6, "Search").
	Trevor asked on Nov. 27, 2026 for the search to sit in the masthead rather
	than open as a panel under it, and chose design A (project files
	design/header-search): on wide screens one search box always shows in the
	middle of the masthead, between the site's name and the icon buttons. As
	the reader types, the matches from the index built with the site
	(src/lib/site-search.ts) drop down attached under the box, the
	same width, grouped by kind, each group foldable. Arrow keys move between
	the box and the results, Escape closes the results, the X clears the box,
	and Enter opens the search page with every match. The results search what
	the search page searches, with the same words (src/lib/search-everything.ts),
	so their counts are the search page's counts; each group lists its first
	few and says how many more the search page has. A nation with a seal its
	page may show has the seal beside its name. The / key puts focus in the box
	from anywhere on the page (SiteHeader.svelte).

	Below 64rem there is no room for the box beside the buttons, so the masthead
	shows the search icon instead; pressing it turns the masthead's row into the
	search box, with a back arrow, and the results fill the screen under it.
	Without scripts the box is a plain form that opens the search page, and the
	icon is a link to /search.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import CountBadge from './CountBadge.svelte';
	import RecognitionBadges from './RecognitionBadges.svelte';
	import { page } from '$app/state';
	import { SvelteSet } from 'svelte/reactivity';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { matchEverything, panelAnswer, resultGroupLabels, type PanelAnswer, type ResultGroup } from '#lib/search-everything.ts';
	import { loadSearchRecords, type SearchRecords } from '#lib/search-records.ts';
	import { loadSearchIndex, prepareSearchIndex, type SearchEntry } from '#lib/site-search.ts';
	import { sendProblem } from '#lib/problem-reports.ts';

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
	let box: HTMLDivElement | undefined = $state();
	/** The box's width, so a narrow box gets a short placeholder; and the phone bar's height, so the results start under it. */
	let fieldWidth = $state(0);
	let barHeight = $state(0);
	/** Seals that failed to load, so a broken image is never shown. */
	const failedImages = new SvelteSet<string>();

	onMount(() => {
		scripted = true;
	});

	// A new page closes the results and empties the box.
	$effect(() => {
		void page.url.pathname;
		expanded = false;
		query = '';
	});

	/** The long placeholder where the box has room for it, as in the approved mockup; "Search" where it is narrow. */
	const placeholder = $derived(fieldWidth && fieldWidth < 320 ? 'Search' : 'Search nations, laws, cases and terms');

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
			} catch (problem) {
				// The files answer when they come; offline or cancelled is not sent (sendProblem).
				sendProblem(problem, { code: 'search.query' });
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

	/** Whether the masthead shows the search icon rather than the box (below 64rem): then the box opens as a bar over the masthead. */
	const compact = () => Boolean(opener && opener.offsetParent !== null);

	/** Puts focus in the box, opening the phone bar where the masthead has only the icon; exported so the / key can call it. */
	export async function open() {
		expanded = true;
		await tick();
		input?.focus();
		input?.select();
	}

	/** Focus in the box shows the results for what it holds and starts fetching the search files. */
	function started() {
		if (refocusing) {
			refocusing = false;
			return;
		}
		expanded = true;
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

	/** Set while focus is put back in the box after closing the results, so that focus does not open them again. */
	let refocusing = false;

	/**
	 * Closes the results. The phone bar closes too, and focus goes back to the icon that opened it. On wide screens
	 * focus goes back to the box, and when it is already there with the results closed, it leaves the box.
	 */
	async function close() {
		const fromBar = compact();
		const wasOpen = showResults;
		expanded = false;
		await tick();
		if (fromBar) opener?.focus();
		else if (wasOpen && document.activeElement !== input) {
			refocusing = true;
			input?.focus();
		} else if (!wasOpen) input?.blur();
	}

	/** The X empties the box and keeps focus in it. */
	function clear() {
		query = '';
		input?.focus();
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

	// A click or focus outside the box and its results closes them.
	function closeWhenLeft(event: FocusEvent) {
		const next = event.relatedTarget as Node | null;
		if (next && !box?.contains(next)) expanded = false;
	}

	function closeOnOutsideClick(event: MouseEvent) {
		if (expanded && !box?.contains(event.target as Node)) expanded = false;
	}

	/** The results show under the box once there are words to show them for. */
	const showResults = $derived(expanded && trimmed !== '' && (answer !== undefined || failed));
</script>

<svelte:document onclick={closeOnOutsideClick} />

<!-- The box's keys and leaving it work from anywhere inside; the search box, results and buttons are the controls. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="site-search" class:is-open={expanded} bind:this={box} onkeydown={onKey} onfocusout={closeWhenLeft} style:--search-bar-height="{barHeight}px">
	{#if scripted}
		<button
			bind:this={opener}
			class="icon-button opener"
			type="button"
			aria-label="Search"
			aria-keyshortcuts="/"
			title="Search (press /)"
			aria-expanded={expanded}
			aria-controls="{identifier}-box"
			onclick={() => (expanded ? close() : open())}
		>
			<Search size={24} />
		</button>
	{:else}
		<a class="icon-button opener" href="/search" aria-label="Search" title="Search">
			<Search size={24} />
		</a>
	{/if}

	<form class="search-bar" id="{identifier}-box" role="search" action="/search" method="get" bind:offsetHeight={barHeight}>
		{#if scripted}
			<button class="icon-button back" type="button" aria-label="Close search" title="Close search" onclick={close}>
				<ArrowLeft size={24} />
			</button>
		{/if}
		<div class="search-field" class:has-results={showResults} bind:clientWidth={fieldWidth}>
			<label class="visually-hidden" for={identifier}>Search nations, laws, cases and terms</label>
			<Search size={20} strokeWidth={1.75} aria-hidden="true" />
			<input
				bind:this={input}
				id={identifier}
				type="search"
				name="q"
				autocomplete="off"
				enterkeyhint="search"
				{placeholder}
				aria-keyshortcuts="/"
				aria-describedby="{identifier}-hint"
				bind:value={query}
				onfocus={started}
				oninput={() => (expanded = true)}
			/>
			{#if query}
				<button class="icon-button clear" type="button" aria-label="Clear search" title="Clear search" onclick={clear}>
					<X size={20} strokeWidth={1.75} />
				</button>
			{/if}
		</div>
	</form>
	<p class="visually-hidden" id="{identifier}-hint">Results appear below as you type. Use the down arrow to reach them, and Enter to see every result.</p>
	<p class="visually-hidden" role="status">{status}</p>

	{#if showResults}
		<div bind:this={panel} class="search-panel" id="{identifier}-panel">
			{#if failed && !answer}
				<p class="message">The search index could not be loaded. Press Enter to open the search page.</p>
			{:else if answer}
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
	/* The results are placed against this box, so they hang from the search box's lower edge. */
	.site-search {
		position: relative;
		display: flex;
		align-items: center;
	}

	/* Wide screens: the box shows in the masthead and the icon does not. */
	.opener {
		display: none;
	}

	.search-bar {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		width: 100%;
		margin: 0;
	}

	.back {
		display: none;
		color: var(--color-band-text);
	}

	/*
	 * The box: at rest a darker strip set into the band (closed look 2, which
	 * Trevor chose on Nov. 27, 2026, with no / key hint; project files
	 * design/header-search/closed-looks); with focus in it, a paper pill that
	 * opens into the results (design A).
	 */
	.search-field {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex: 1 1 auto;
		min-width: 0;
		height: 2.5rem;
		padding: 0 var(--space-1) 0 var(--space-3);
		border: 1px solid transparent;
		border-radius: 8px;
		background: var(--color-band-inset);
		color: var(--color-band-text);
	}

	.search-field:focus-within {
		border-color: var(--color-paper);
		border-radius: 1.25rem;
		background: var(--color-paper);
		color: var(--color-ink-muted);
		/* The site's focus ring (F1), 2 px off the box, in the band's ring color. */
		box-shadow:
			0 0 0 2px var(--color-band),
			0 0 0 5px var(--focus-ring);
	}

	/* With results under it, the box and the results are one card. */
	.search-field.has-results {
		border-color: var(--color-control-border);
		border-bottom-color: var(--color-line);
		border-radius: 1.25rem 1.25rem 0 0;
		box-shadow: none;
	}

	input {
		flex: 1 1 auto;
		min-width: 0;
		width: auto;
		height: 100%;
		min-height: 0;
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: inherit;
		font: inherit;
	}

	.search-field:focus-within input {
		color: var(--color-ink);
	}

	/* The box itself shows focus (the ring and paper above), so the input does not fill with the focus color. */
	input:focus-visible {
		outline: none;
		box-shadow: none;
		background: transparent;
		color: var(--color-ink);
	}

	input::placeholder {
		color: inherit;
		opacity: 0.85;
	}

	.search-field:focus-within input::placeholder {
		color: var(--color-ink-muted);
		opacity: 1;
	}

	input::-webkit-search-cancel-button {
		appearance: none;
	}


	.clear {
		min-width: 2.25rem;
		min-height: 2.25rem;
		border-radius: 50%;
		color: var(--color-ink-muted);
	}

	.search-panel {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 20;
		max-height: min(36rem, calc(100vh - 8rem));
		overflow-y: auto;
		border: 1px solid var(--color-control-border);
		border-top: 0;
		border-radius: 0 0 var(--radius-panel) var(--radius-panel);
		background: var(--color-paper);
		color: var(--color-ink);
		box-shadow: 0 var(--space-2) var(--space-5) color-mix(in srgb, var(--color-ink) 22%, transparent);
		text-align: left;
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

	/*
	 * Below 64rem the masthead has no room for the box beside its buttons:
	 * it shows the search icon, which turns the masthead's row into the box,
	 * with a back arrow, and the results fill the screen under it.
	 */
	@media (max-width: 63.99rem) {
		.opener {
			display: inline-grid;
		}

		.site-search > .opener[aria-expanded='true'] {
			background: color-mix(in srgb, currentColor 14%, transparent);
		}

		.search-bar {
			display: none;
		}

		.site-search.is-open .search-bar {
			display: flex;
			position: fixed;
			inset: 0 0 auto;
			z-index: 30;
			min-height: 3.25rem;
			padding: var(--space-1) var(--space-2) var(--space-1) var(--space-1);
			background: var(--color-band);
		}

		.back {
			display: inline-grid;
		}

		.search-field.has-results {
			border-radius: 1.25rem;
			border-color: var(--color-paper);
		}

		.search-panel {
			position: fixed;
			top: var(--search-bar-height, 3.25rem);
			bottom: 0;
			max-height: none;
			border: 0;
			border-radius: 0;
			box-shadow: none;
		}
	}
</style>
