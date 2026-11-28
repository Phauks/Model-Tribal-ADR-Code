<script lang="ts">
	// The site search page (site/DESIGN.md, section 6, "Search"). The page is
	// built ahead of time; in the browser it reads the words and filters from
	// the address (/search?q=…&type=law,case&state=NV), loads the indexes built
	// with the site and lists the matches, grouped by kind. Filters narrow the
	// nations by the facts their records hold, and with them the laws and
	// stories of those nations (Trevor asked for advanced search on Nov. 23,
	// 2026). The tools live in the left sidebar, and results can be ticked and
	// downloaded together as a .zip (Trevor, Nov. 27, 2026, the approved
	// mockup design/search-download/revision-3; src/lib/search-selection.ts).
	// Without scripts it says so and offers the ways to browse.
	import { onMount } from 'svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import RecognitionBadges from '#lib/components/RecognitionBadges.svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import DataTable from '#lib/components/DataTable.svelte';
	import SearchTools, { type SortOrder } from '#lib/components/search/SearchTools.svelte';
	import SelectionBar, { type ChosenResult } from '#lib/components/search/SelectionBar.svelte';
	import { dayOf } from '#lib/download-names.ts';
	import {
		activeChoices,
		choicesFromAddress,
		facetCounts,
		filterRows,
		hasChoices,
		writeChoices,
		type ActiveChoice,
		type FilterChoices
	} from '#lib/search-filters.ts';
	import {
		documentFacets,
		loadSearchRecords,
		nationFacets,
		type DocumentSearchRow,
		type NationSearchRow,
		type SearchRecords
	} from '#lib/search-records.ts';
	import { entryGroups, forEntryGroups, matchEverything, resultGroupLabels, resultGroups, type ResultGroup } from '#lib/search-everything.ts';
	import { extensionOf, fileOf, sizeText, type SearchFiles } from '#lib/search-selection.ts';
	import { sendProblem } from '#lib/problem-reports.ts';
	import { offerSidebarTools } from '#lib/sidebar-tools.svelte.ts';
	import { loadSearchIndex, prepareSearchIndex, type SearchEntry, type SearchResult } from '#lib/site-search.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';

	/** A result listed straight from the index; a story listed without words typed has no name that matched. */
	type ListedResult = SearchEntry & Partial<Pick<SearchResult, 'matchedName' | 'matchedGroup'>>;

	/** One row of the results, whatever its group. */
	interface ResultRow {
		link: string;
		title: string;
		group: ResultGroup;
		detail?: string;
		/** "also called …", or the set whose name matched. */
		aside?: string;
		nation?: string;
		year?: number;
	}

	const sortOrders: SortOrder[] = ['best', 'newest', 'oldest', 'title'];

	/** Results shown per group before "Show all". */
	const firstShown = 25;
	const firstNationsShown = 50;

	// Raw, not deeply reactive: wrapping every one of the index's entries made each keystroke about three times slower.
	let entries = $state.raw<SearchEntry[] | undefined>();
	let records = $state.raw<SearchRecords | undefined>();
	/** Each result's file, loaded after the indexes, since only the tags and the download need it. */
	let files = $state.raw<SearchFiles | undefined>();
	let failed = $state(false);
	let query = $state('');
	/** The words last written into the address, so typing is not undone when the address catches up. */
	let written: string | undefined;
	let expanded = $state<Partial<Record<ResultGroup, boolean>>>({});
	let folded = $state<Partial<Record<ResultGroup, boolean>>>({});
	let typingTimer: ReturnType<typeof setTimeout> | undefined;
	/** The ticked results, by link. They stay ticked through new searches, so a selection can gather several. */
	let selected = $state.raw(new Map<string, ResultRow>());

	// Follow the address, including a new search from the masthead's box.
	$effect(() => {
		const fromAddress = page.url.searchParams.get('q') ?? '';
		if (fromAddress !== written) {
			query = fromAddress;
			written = fromAddress;
			expanded = {};
		}
	});

	onMount(async () => {
		void fetch('/search/files.json')
			.then((response) => {
				if (!response.ok) throw new Error(`Reading /search/files.json failed: ${response.status}`);
				return response.json() as Promise<SearchFiles>;
			})
			.then((list) => (files = list))
			.catch((problem) => {
				// Results still show and can be ticked; their files are listed by link.
				files = {};
				sendProblem(problem, { code: 'search.files', path: location.pathname });
			});
		try {
			const [index, recordsFile] = await Promise.all([loadSearchIndex(), loadSearchRecords()]);
			await prepareSearchIndex(index);
			[entries, records] = [index, recordsFile];
		} catch {
			failed = true;
		}
	});

	// The tools go in the left sidebar while this page is open.
	$effect(() => offerSidebarTools({ title: 'Search', sheetLabel: 'Search tools', tools: searchTools }));

	const parameters = $derived(page.url.searchParams);
	/** The kinds ticked under Show; none shows every kind. */
	const shownKinds = $derived<ResultGroup[]>(
		resultGroups.filter((group) => (parameters.get('type') ?? '').split(',').includes(group))
	);
	const sort = $derived<SortOrder>(sortOrders.find((value) => value === parameters.get('sort')) ?? 'best');
	const filesOnly = $derived(parameters.get('files') === '1');
	/** The one kind shown, when only one is ticked: the filters then count what it lists. */
	const onlyKind = $derived(shownKinds.length === 1 ? shownKinds[0] : undefined);
	const facets = $derived(records ? nationFacets(records) : []);
	const choices = $derived(choicesFromAddress(parameters, facets));
	const documentChoices = $derived(choicesFromAddress(parameters, documentFacets));
	const filtering = $derived(hasChoices(choices));
	const showsDocumentFilters = $derived(shownKinds.includes('document'));
	const filterCount = $derived(
		Object.values(choices).flat().length + (showsDocumentFilters ? Object.values(documentChoices).flat().length : 0)
	);

	const trimmed = $derived(query.trim());
	/** What the words find, the same matches the masthead's search panel counts (src/lib/search-everything.ts). */
	const matches = $derived(entries && records && trimmed ? matchEverything(entries, records, trimmed) : undefined);

	const nationsByIdentifier = $derived(new Map((records?.nations ?? []).map((row) => [row.id, row])));
	/** Each nation's recognition badges, from the search index, by the nation's address. */
	const badgesByLink = $derived(
		new Map((entries ?? []).filter((entry) => entry.badges).map((entry) => [entry.link, entry.badges ?? []]))
	);
	/** The nations the words find, best first; every nation when no words are typed. */
	const nationPool = $derived.by<NationSearchRow[]>(() => {
		if (!records) return [];
		if (!trimmed) return records.nations;
		return (matches?.nation ?? []).map((match) => match.row);
	});

	const browsing = $derived(
		trimmed === '' && (filtering || filesOnly || shownKinds.some((kind) => kind === 'nation' || kind === 'document' || kind === 'story'))
	);
	const nations = $derived(trimmed || browsing ? filterRows(nationPool, facets, choices) : []);
	/** The nations the filters allow, by id; undefined when no filter is ticked. */
	const allowed = $derived(
		records && filtering ? new Set(filterRows(records.nations, facets, choices).map((row) => row.id)) : undefined
	);

	const documentPool = $derived(
		(trimmed ? (matches?.document ?? []) : (records?.documents ?? [])).filter((row) => !allowed || allowed.has(row.nation))
	);
	const documentCounts = $derived(facetCounts(documentPool, documentFacets, documentChoices));
	const documents = $derived<DocumentSearchRow[]>(
		trimmed || browsing ? filterRows(documentPool, documentFacets, showsDocumentFilters ? documentChoices : {}) : []
	);

	const storyPool = $derived<SearchEntry[]>(
		trimmed
			? (matches?.story ?? [])
			: browsing || onlyKind === 'story'
				? (entries ?? []).filter((entry) => entry.kind === 'story')
				: []
	);
	const stories = $derived(
		allowed
			? storyPool.filter((entry) => (records?.storyNations[entry.link] ?? []).some((id) => allowed.has(id)))
			: storyPool
	);
	/**
	 * The nation filters' counts. With only laws or only stories shown, each
	 * answer counts the documents or stories it would show, through their
	 * nations; otherwise it counts nations.
	 */
	const counts = $derived.by(() => {
		if (onlyKind === 'document') {
			const pool = trimmed ? (matches?.document ?? []) : (records?.documents ?? []);
			const found = filterRows(pool, documentFacets, documentChoices);
			return facetCounts(throughNations(found.map((row) => [row.nation])), facets, choices);
		}
		if (onlyKind === 'story') {
			return facetCounts(throughNations(storyPool.map((entry) => records?.storyNations[entry.link] ?? [])), facets, choices);
		}
		return facetCounts(nationPool, facets, choices);
	});

	/**
	 * One row per document or story, carrying the answers of all its nations,
	 * so a story told by two nations counts once under each of their states.
	 */
	function throughNations(nationLists: string[][]): NationSearchRow[] {
		return nationLists.flatMap((ids) => {
			const rows = ids.map((id) => nationsByIdentifier.get(id)).filter((row): row is NationSearchRow => row !== undefined);
			if (rows.length === 0) return [];
			if (rows.length === 1) return rows;
			const merged = { ...rows[0] };
			for (const key of ['recognition', 'states', 'region', 'courts', 'dispute', 'laws', 'gaming'] as const) {
				merged[key] = [...new Set(rows.flatMap((row) => row[key]))];
			}
			return [merged];
		});
	}

	/** The year a result gives in its line, such as "Statute · 1988", for sorting by date. */
	function yearIn(text: string | undefined): number | undefined {
		const years = text?.match(/\b(1[5-9]\d\d|20\d\d)\b/g);
		return years ? Number(years.at(-1)) : undefined;
	}

	/**
	 * Each group's rows. Stories follow the nation filters; the rest of the
	 * groups listed straight from the index belong to no nation in the index
	 * (federal law, cases, people, glossary terms, reference material and the
	 * site's pages), so nation filters put them away.
	 */
	const allRows = $derived.by<Record<Exclude<ResultGroup, 'nation'>, ResultRow[]>>(() => ({
		document: documents.map((row) => ({
			link: row.link,
			title: row.title,
			group: 'document' as const,
			detail: [row.kindLabel, row.year, row.nationName].filter(Boolean).join(' · '),
			nation: row.nationName,
			...(row.year ? { year: Number(row.year) } : {})
		})),
		...forEntryGroups<ResultRow[]>((group) =>
			((group === 'story' ? stories : filtering ? [] : (matches?.[group] ?? [])) as ListedResult[]).map((result) => ({
				link: result.link,
				title: result.title,
				group,
				...(result.detail ? { detail: result.detail } : {}),
				...(result.matchedName ? { aside: `also called ${result.matchedName}` } : result.matchedGroup ? { aside: result.matchedGroup } : {}),
				...(yearIn(result.detail) ? { year: yearIn(result.detail) } : {})
			}))
		)
	}));

	const hasFile = (link: string) => fileOf(files, link) !== undefined;

	function sorted(rows: ResultRow[]): ResultRow[] {
		if (sort === 'best') return rows;
		if (sort === 'title') return rows.toSorted((first, second) => first.title.localeCompare(second.title, 'en', { sensitivity: 'base' }));
		const direction = sort === 'newest' ? -1 : 1;
		// Results without a year go last either way.
		return rows.toSorted((first, second) => {
			if (first.year === undefined || second.year === undefined) return (first.year === undefined ? 1 : 0) - (second.year === undefined ? 1 : 0);
			return direction * (first.year - second.year);
		});
	}

	const rows = $derived.by(() => {
		const kept: Partial<Record<ResultGroup, ResultRow[]>> = {};
		for (const [group, list] of Object.entries(allRows) as [Exclude<ResultGroup, 'nation'>, ResultRow[]][]) {
			kept[group] = sorted(filesOnly ? list.filter((row) => hasFile(row.link)) : list);
		}
		return kept as Record<Exclude<ResultGroup, 'nation'>, ResultRow[]>;
	});
	const nationList = $derived(filesOnly ? [] : sort === 'title' ? nations.toSorted((first, second) => first.name.localeCompare(second.name, 'en', { sensitivity: 'base' })) : nations);

	const totals = $derived<Record<ResultGroup, number>>({
		...forEntryGroups((group) => rows[group].length),
		nation: nationList.length,
		document: rows.document.length
	});
	const isShown = (kind: ResultGroup) => shownKinds.length === 0 || shownKinds.includes(kind);
	const shows = (kind: ResultGroup) => isShown(kind) && totals[kind] > 0;
	const shownTotal = $derived(resultGroups.filter(isShown).reduce((total, group) => total + totals[group], 0));
	/** How many results of the kinds shown have a copy to download, whether or not only those are shown. */
	const fileCount = $derived(
		files
			? (Object.entries(allRows) as [ResultGroup, ResultRow[]][])
					.filter(([group]) => isShown(group))
					.reduce((total, [, list]) => total + list.filter((row) => hasFile(row.link)).length, 0)
			: 0
	);

	const chips = $derived<ActiveChoice[]>([
		...activeChoices(facets, choices),
		...(showsDocumentFilters ? activeChoices(documentFacets, documentChoices) : [])
	]);

	const counting = $derived(trimmed !== '' || browsing);

	const status = $derived.by(() => {
		if (!entries || !records) return '';
		if (!counting) return 'Type a name or a word, or choose filters.';
		const what = `${shownTotal.toLocaleString('en-US')} ${shownTotal === 1 ? 'result' : 'results'}`;
		const words = trimmed ? ` for “${trimmed}”` : '';
		const filters = filterCount > 0 ? ` with ${filterCount} ${filterCount === 1 ? 'filter' : 'filters'}` : '';
		return `${what}${words}${filters}`;
	});

	/** Writes the words, the kinds shown, the order and the filters into the address, replacing the current entry. */
	function writeAddress(
		next: { show?: ResultGroup[]; sort?: SortOrder; filesOnly?: boolean; choices?: FilterChoices; documentChoices?: FilterChoices } = {}
	) {
		const url = new URL(page.url.href);
		written = trimmed;
		if (trimmed) url.searchParams.set('q', trimmed);
		else url.searchParams.delete('q');
		const nextShow = next.show ?? shownKinds;
		if (nextShow.length === 0) url.searchParams.delete('type');
		else url.searchParams.set('type', resultGroups.filter((group) => nextShow.includes(group)).join(','));
		const nextSort = next.sort ?? sort;
		if (nextSort === 'best') url.searchParams.delete('sort');
		else url.searchParams.set('sort', nextSort);
		if (next.filesOnly ?? filesOnly) url.searchParams.set('files', '1');
		else url.searchParams.delete('files');
		writeChoices(url.searchParams, facets, next.choices ?? choices);
		writeChoices(url.searchParams, documentFacets, next.documentChoices ?? documentChoices);
		replaceState(url, {});
	}

	function search(event: SubmitEvent) {
		event.preventDefault();
		clearTimeout(typingTimer);
		writeAddress();
	}

	function typed() {
		expanded = {};
		clearTimeout(typingTimer);
		typingTimer = setTimeout(() => writeAddress(), 300);
	}

	function clearWords() {
		query = '';
		expanded = {};
		clearTimeout(typingTimer);
		writeAddress();
		document.getElementById('search-page-query')?.focus();
	}

	function removeChip(chip: ActiveChoice) {
		const from = facets.some((facet) => facet.key === chip.key) ? choices : documentChoices;
		const values = (from[chip.key] ?? []).filter((value) => value !== chip.value);
		const next = { ...from, [chip.key]: values };
		if (from === choices) writeAddress({ choices: next });
		else writeAddress({ documentChoices: next });
	}

	function shown<Item>(kind: ResultGroup, list: Item[], limit = firstShown): Item[] {
		return expanded[kind] ? list : list.slice(0, limit);
	}

	// ---- Ticking results ----

	function tick(row: ResultRow, on: boolean) {
		const next = new Map(selected);
		if (on) next.set(row.link, row);
		else next.delete(row.link);
		selected = next;
	}

	function tickAll(list: ResultRow[], on: boolean) {
		const next = new Map(selected);
		for (const row of list) {
			if (on) next.set(row.link, row);
			else next.delete(row.link);
		}
		selected = next;
	}

	function tickedOf(list: ResultRow[]): 'all' | 'some' | 'none' {
		const count = list.filter((row) => selected.has(row.link)).length;
		return count === 0 ? 'none' : count === list.length ? 'all' : 'some';
	}

	/** Every row on the screen, in every group shown and not folded. */
	const onScreen = $derived(
		(Object.keys(rows) as Exclude<ResultGroup, 'nation'>[]).filter((group) => shows(group) && !folded[group]).flatMap((group) => shown(group, rows[group]))
	);

	const chosen = $derived<ChosenResult[]>(
		[...selected.values()].map((row) => {
			const file = fileOf(files, row.link);
			return { link: row.link, title: row.title, group: row.group, ...(row.nation ? { nation: row.nation } : {}), ...(file ? { file } : {}) };
		})
	);

	const nationColumns: TableColumn[] = [
		{ key: 'name', header: 'Nation or community', sortable: true, isRowHeader: true },
		{ key: 'states', header: 'State or territory', sortable: true },
		{ key: 'recognition', header: 'Recognition', sortable: true, custom: true },
		{ key: 'found', header: 'Found on record' }
	];

	function nationRow(row: NationSearchRow): TableRow {
		return {
			key: row.id,
			cells: {
				name: { text: row.name, href: row.link },
				states: { text: row.statesText },
				recognition: { text: row.recognitionText },
				found: { text: row.foundText }
			}
		};
	}

	const nationRows = $derived(shown('nation', nationList, firstNationsShown).map(nationRow));
	const toolKinds = $derived(resultGroups.map((group) => ({ group, label: resultGroupLabels[group], count: totals[group] })));
	const today = dayOf(new Date());
</script>

<svelte:head>
	<title>{trimmed ? `“${trimmed}” · ` : ''}Search · Tribal Law Project</title>
</svelte:head>

{#snippet searchTools(place: string)}
	<SearchTools
		{place}
		kinds={toolKinds}
		shown={shownKinds}
		{counting}
		onshow={(next) => {
			expanded = {};
			writeAddress({ show: next });
		}}
		{sort}
		onsort={(next) => writeAddress({ sort: next })}
		{filesOnly}
		{fileCount}
		onfiles={(next) => writeAddress({ filesOnly: next })}
		facetSets={records
			? [
					...(showsDocumentFilters
						? [{ identifier: 'documents', facets: documentFacets, choices: documentChoices, counts: documentCounts, onchange: (next: FilterChoices) => writeAddress({ documentChoices: next }) }]
						: []),
					{ identifier: 'nations', facets, choices, counts, onchange: (next: FilterChoices) => writeAddress({ choices: next }) }
				]
			: []}
	/>
{/snippet}

{#snippet tag(row: ResultRow)}
	{@const file = fileOf(files, row.link)}
	{#if file}
		<span class="tag"><b>{extensionOf(file[1]) || 'file'}</b>{sizeText(file[0])}</span>
	{:else if !row.link.startsWith('/')}
		<span class="tag link-only">Link only <ExternalLink size={14} aria-hidden="true" /></span>
	{:else if files}
		<span class="tag">Page</span>
	{/if}
{/snippet}

<div class="search-page">
	<h1 class="visually-hidden">Search</h1>

	<form class="search-form needs-scripts" role="search" action="/search" method="get" onsubmit={search}>
		<label class="visually-hidden" for="search-page-query">Search nations, laws, cases, people, stories and pages</label>
		<div class="query-field">
			<Search size={18} aria-hidden="true" />
			<input
				id="search-page-query"
				type="search"
				name="q"
				autocomplete="off"
				placeholder="Search nations, laws, cases, people, stories and pages"
				bind:value={query}
				oninput={typed}
			/>
			{#if query}
				<button class="clear-words" type="button" aria-label="Clear the search" onclick={clearWords}><X size={20} aria-hidden="true" /></button>
			{/if}
		</div>
	</form>

	<noscript>
		<div class="notice" role="note">
			<p>
				Search needs scripts, which are off in this browser. You can still browse the <a href="/nations/directory">nations by first letter or state</a> and the <a href="/glossary">glossary from A to Z</a>.
			</p>
		</div>
	</noscript>

	{#if failed}
		<div class="notice notice-problem" role="note">
			<p>
				The search index could not be loaded. If you are offline, save the site for offline reading in Settings first. You can still browse the <a href="/nations/directory">nations</a>, the <a href="/stories">stories</a> and the <a href="/glossary">glossary</a>.
			</p>
		</div>
	{/if}

	{#if entries && records}
		<p class="status" role="status">{status}</p>

		{#if selected.size > 0}
			<SelectionBar
				{chosen}
				shownTicked={tickedOf(onScreen)}
				ontoggleshown={() => tickAll(onScreen, tickedOf(onScreen) !== 'all')}
				onclear={() => (selected = new Map())}
				query={trimmed}
				day={today}
			/>
		{/if}

		{#if chips.length > 0}
			<ul class="chips no-print" aria-label="Filters in use">
				{#each chips as chip (`${chip.key}=${chip.value}`)}
					<li>
						<button class="filter-chip" type="button" aria-label="Remove filter {chip.label}" onclick={() => removeChip(chip)}>
							{chip.label}
							<X size={16} aria-hidden="true" />
						</button>
					</li>
				{/each}
				<li>
					<button class="button button-quiet clear" type="button" onclick={() => writeAddress({ choices: {}, documentChoices: {} })}>
						Clear all filters
					</button>
				</li>
			</ul>
		{/if}

		{#if shows('nation')}
			<section class="result-group" aria-labelledby="results-nation">
				<div class="group-head">
					<button class="fold" type="button" aria-expanded={!folded.nation} aria-controls="results-nation-list" onclick={() => (folded.nation = !folded.nation)}>
						<span class="fold-mark"><ChevronDown size={24} aria-hidden="true" /></span>
						<span class="visually-hidden">Fold {resultGroupLabels.nation}</span>
					</button>
					<h2 id="results-nation">{resultGroupLabels.nation} <CountBadge count={nationList.length} /></h2>
				</div>
				<div id="results-nation-list" hidden={folded.nation}>
					<DataTable
						identifier="search-nations-table"
						label="Table: {resultGroupLabels.nation}"
						columns={nationColumns}
						rows={nationRows}
						rowName={['nation', 'nations']}
						total={nationList.length}
					>
						{#snippet cell(row, column)}
							{#if column.key === 'recognition'}
								<RecognitionBadges badges={badgesByLink.get(row.cells.name?.href ?? '') ?? []} size="small" />
							{/if}
						{/snippet}
					</DataTable>
					{#if nationList.length > firstNationsShown && !expanded.nation}
						<button class="show-all" type="button" onclick={() => (expanded.nation = true)}>
							Show all {nationList.length.toLocaleString('en-US')} nations and communities
						</button>
					{/if}
				</div>
			</section>
		{/if}

		{#each ['document', ...entryGroups] as const as group (group)}
			{@const items = rows[group]}
			{#if shows(group)}
				{@const visible = shown(group, items)}
				{@const ticked = tickedOf(visible)}
				<section class="result-group" aria-labelledby="results-{group}">
					<div class="group-head">
						<button class="fold" type="button" aria-expanded={!folded[group]} aria-controls="results-{group}-list" onclick={() => (folded[group] = !folded[group])}>
							<span class="fold-mark"><ChevronDown size={24} aria-hidden="true" /></span>
							<span class="visually-hidden">Fold {resultGroupLabels[group]}</span>
						</button>
						<h2 id="results-{group}">{resultGroupLabels[group]} <CountBadge count={items.length} /></h2>
						<label class="tick-group no-print">
							<input
								type="checkbox"
								checked={ticked === 'all'}
								indeterminate={ticked === 'some'}
								onchange={(event) => tickAll(visible, event.currentTarget.checked)}
							/>
							<span>{ticked === 'none' ? 'Select shown' : `${visible.filter((row) => selected.has(row.link)).length} of ${visible.length} shown`}</span>
						</label>
					</div>
					<div id="results-{group}-list" hidden={folded[group]}>
						<ol class="results">
							{#each visible as row (`${row.link} ${row.title}`)}
								{@const isTicked = selected.has(row.link)}
								<li class:ticked={isTicked}>
									<input
										class="tick no-print"
										type="checkbox"
										checked={isTicked}
										aria-label="Select {row.title}"
										onchange={(event) => tick(row, event.currentTarget.checked)}
									/>
									<a href={row.link}>{row.title}</a>
									{@render tag(row)}
									{#if row.aside || row.detail}
										<p class="small muted">
											{#if row.aside}<span>({row.aside})</span>{/if}
											{row.detail ?? ''}
										</p>
									{/if}
								</li>
							{/each}
						</ol>
						{#if items.length > firstShown && !expanded[group]}
							<button class="show-all" type="button" onclick={() => (expanded[group] = true)}>
								Show all {items.length.toLocaleString('en-US')}
								{resultGroupLabels[group].toLocaleLowerCase('en-US')} results
							</button>
						{/if}
					</div>
				</section>
			{/if}
		{/each}

		{#if counting && shownTotal === 0}
			<p>
				Nothing matches{trimmed ? ` “${trimmed}”` : ''}{filterCount > 0 || filesOnly ? ' with these filters' : ''}.
				{#if filterCount > 0 || filesOnly}Try removing a filter, or{:else}Check the spelling, try fewer words, or{/if}
				browse the <a href="/nations/directory">nations</a> and the <a href="/glossary">glossary</a>.
			</p>
		{/if}
	{/if}
</div>

<style>
	.search-page {
		container-type: inline-size;
	}

	/* A smaller box than a page heading would be: the sidebar already says this is search (Trevor, Nov. 27, 2026). */
	.query-field {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		max-width: 36rem;
		margin: var(--space-4) 0 0.6rem;
		padding: 0 0.4rem 0 0.7rem;
		border: 1px solid var(--color-control-border);
		border-radius: 8px;
		background: var(--color-surface-raised);
		color: var(--color-ink-muted);
	}

	.query-field:focus-within {
		outline: 3px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.query-field input {
		flex: 1;
		min-width: 0;
		min-height: 2.6rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		font-size: 1rem;
		appearance: none;
	}

	.query-field input:focus {
		outline: none;
	}

	.query-field input::-webkit-search-cancel-button {
		appearance: none;
	}

	.clear-words {
		display: inline-grid;
		place-items: center;
		width: var(--layout-target-minimum);
		height: var(--layout-target-minimum);
		margin: -0.2rem 0;
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-ink);
		cursor: pointer;
	}

	.status {
		margin: 0 0 0.25rem;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		list-style: none;
		margin: var(--space-2) 0 var(--space-3);
		padding: 0;
	}

	.filter-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-link);
		border-radius: 999px;
		background: var(--color-notice-background);
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
		cursor: pointer;
	}

	.filter-chip:hover {
		border-width: 2px;
		padding: 0 calc(var(--space-3) - 1px);
	}

	.clear {
		font-size: var(--font-size-small);
	}

	.result-group {
		margin-top: var(--space-4);
		border-top: 1px solid var(--color-line);
	}

	.group-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0.9rem 0 0.25rem;
	}

	.fold {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		min-height: var(--layout-target-minimum);
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-ink-muted);
		cursor: pointer;
	}

	.fold-mark {
		display: inline-flex;
		transition: transform var(--motion-duration-short) var(--motion-easing-standard);
	}

	.fold[aria-expanded='false'] .fold-mark {
		transform: rotate(-90deg);
	}

	.group-head h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
	}

	.tick-group {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin-left: auto;
		color: var(--color-ink-muted);
		font-size: 0.85rem;
		white-space: nowrap;
		cursor: pointer;
	}

	.tick-group input,
	.tick {
		width: 1.05rem;
		height: 1.05rem;
		margin: 0;
		accent-color: var(--color-link);
	}

	.results {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.results li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: start;
		gap: 0.15rem 0.75rem;
		padding: 0.6rem 0.35rem;
		border-bottom: 1px solid var(--color-line);
	}

	.results li.ticked {
		background: color-mix(in srgb, var(--color-link) 7%, transparent);
	}

	.results .tick {
		margin-top: 0.25rem;
	}

	.results li > a {
		font-weight: var(--font-weight-semibold);
	}

	.results p {
		grid-column: 2;
		margin: 0.1rem 0 0;
	}

	.tag {
		grid-column: 3;
		grid-row: 1;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.15rem;
		color: var(--color-ink-muted);
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.tag b {
		padding: 0 0.3rem;
		border: 1px solid var(--color-line);
		border-radius: 4px;
		background: var(--color-surface);
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}

	.tag.link-only {
		font-style: italic;
	}

	.show-all {
		margin: 0.5rem 0 0;
		padding: 0.3rem 0.35rem;
		border: 0;
		background: none;
		color: var(--color-link);
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.show-all:hover {
		text-decoration: underline;
	}

	@container (max-width: 40rem) {
		.results li {
			grid-template-columns: auto minmax(0, 1fr);
		}

		.tag {
			grid-column: 2;
			grid-row: auto;
		}

		.group-head h2 {
			font-size: 1.3rem;
		}
	}
</style>
