<!--
	@component
	The shared timeline (site/DESIGN.md, section 6, "Timeline"; Trevor asked
	for one consolidated timeline on Nov. 23, 2026). On top, a drawing with a
	row for each kind of record (treaties and land, laws and agreements, court
	decisions, Tribal court opinions, federal law) over the eras of federal
	Indian policy; below it, the same entries as a list grouped by era, each
	linked to its record with the markers of its sources. The drawing is
	hidden from screen readers because the list says the same. Icon buttons
	show or hide kinds, zoom, fit everything, flip the order and open the full
	timeline. Pointing at a mark shows a card; selecting it keeps the card,
	which opens the record or copies its citation or a link to its row.

	A row with many marks in view is drawn as bars that count them, so the
	full timeline stays readable. Kinds listed in `aggregate` are one line per
	era that opens into its entries.

	Two layouts, switched by arrow icons in the toolbar (Trevor asked on Nov.
	23, 2026 for a timeline that runs down the page as you scroll): across,
	the drawing over the list; and down, the list itself drawn as a line
	through time, with each era's heading held at the top while its entries
	scroll past and a thin rail beside it that marks the years in view. Each
	reader's choice is remembered on their device; down the page is the
	default (Trevor, Nov. 23, 2026).

	Without scripts the timeline runs down the page with every entry; the
	buttons and the rail's marker of the years on screen need scripts.

	Use:
	<Timeline entries={timeline.entries} opinions={timeline.opinions} fullLink="/nations/timeline?nation=navajo-nation" />
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import ArrowDownUp from '@lucide/svelte/icons/arrow-down-up';
	import Copy from '@lucide/svelte/icons/copy';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Funnel from '@lucide/svelte/icons/funnel';
	import Maximize2 from '@lucide/svelte/icons/maximize-2';
	import MoveHorizontal from '@lucide/svelte/icons/move-horizontal';
	import MoveVertical from '@lucide/svelte/icons/move-vertical';
	import Quote from '@lucide/svelte/icons/quote';
	import Scale from '@lucide/svelte/icons/scale';
	import Scan from '@lucide/svelte/icons/scan';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import type { CitationMark } from '#lib/citation-marks.ts';
	import { kindIcons } from '#lib/timeline-icons.ts';
	import {
		axisYears,
		barYears,
		byDate,
		clampRange,
		countsByBar,
		entryCitation,
		eraOf,
		eras,
		extentOf,
		inRange,
		isPartialDate,
		kindLabels,
		mostMarks,
		narrowestSpan,
		timelineDate,
		timelineKinds,
		yearOf,
		zoomRange,
		type Era,
		type OpinionYear,
		type TimelineEntry,
		type TimelineKind,
		type TimelineRange
	} from '#lib/timeline.ts';
	import CitationMarks from './CitationMarks.svelte';
	import { copyText } from '#lib/clipboard.ts';
	import { readStored, writeStored } from '#lib/browser-storage.ts';

	interface Props {
		entries: TimelineEntry[];
		/** Published court opinions counted by year, drawn as bars and listed as one line per era. */
		opinions?: OpinionYear[];
		/** Where the opinion counts lead on a nation's page: its list of opinions. */
		opinionsLink?: string;
		opinionCitations?: CitationMark[];
		/** Nations named under entries on the full timeline. */
		nations?: Record<string, { name: string }>;
		/** The full timeline, opened from a nation's page. */
		fullLink?: string;
		/** The heading level of the era headings in the list. */
		headingLevel?: 2 | 3 | 4;
		/** Kinds listed as one line per era that opens into its entries. */
		aggregate?: TimelineKind[];
		/** The kinds shown; a page with its own filters binds it. */
		shown?: TimelineKind[];
		/** The years in view; a page with its own filters binds it. */
		range?: TimelineRange;
		/** The extent the zoom buttons and "fit" use; by default, every entry's years. */
		extent?: TimelineRange;
		/** Show the kind buttons under the toolbar (a page with its own filters hides them). */
		chips?: boolean;
		/** Draw a small overview of every year above the rows, with the view marked on it. */
		overview?: boolean;
		/** Say how many entries are in view, and which years. Down the page it is always said. */
		summary?: boolean;
		/** Draw the toolbar on the line of the section heading just above, as on a nation's page. */
		besideHeading?: boolean;
		/** Say "in view" after each row's count, as the full timeline does. */
		countsInView?: boolean;
		/** Shown in the toolbar after the count, such as the chosen era with a button that clears it. */
		toolbarStart?: Snippet;
	}

	let {
		entries,
		opinions = [],
		opinionsLink,
		opinionCitations,
		nations = {},
		fullLink,
		headingLevel = 3,
		aggregate = [],
		shown = $bindable(),
		range = $bindable(),
		extent: givenExtent,
		chips = true,
		overview = false,
		summary = false,
		besideHeading = false,
		countsInView = false,
		toolbarStart
	}: Props = $props();

	const icons = kindIcons;
	/**
	 * Each kind's icon is drawn once, in a sprite, and every row of the list points at it: the full
	 * timeline lists about ten thousand entries, and an icon drawn in full in each row was a third of
	 * the page (5.7 of 16.7 MB on Nov. 27, 2026) and many thousands of elements to build.
	 */
	const spriteId = $props.id();
	const iconHref = (kind: TimelineKind) => `#${spriteId}-${kind}`;

	const extent = $derived(givenExtent ?? extentOf(entries, opinions));
	/** The kinds that have anything to show, in row order. */
	const present = $derived(
		timelineKinds
			.map(({ kind }) => kind)
			.filter((kind) => (kind === 'opinion' ? opinions.length > 0 : entries.some((entry) => entry.kind === kind)))
	);
	const visibleKinds = $derived((shown ?? present).filter((kind) => present.includes(kind)));
	const view = $derived(range ?? extent);

	let interactive = $state(false);
	let newestFirst = $state(false);
	let chipsOpen = $state(true);
	let width = $state(760);
	let publishedHistory = $state<string[]>([]);

	/* The layout ------------------------------------------------------------- */

	type Layout = 'across' | 'down';
	const layoutKey = 'timeline-layout';
	// Down the page from the first paint, so the page does not jump when scripts start.
	let layout = $state<Layout>('down');
	const down = $derived(layout === 'down');

	function chooseLayout(next: Layout) {
		layout = next;
		active = undefined;
		writeStored(layoutKey, next);
	}

	onMount(() => {
		interactive = true;
		layout = readStored(layoutKey) === 'across' ? 'across' : 'down';
		// Each era heading links to its chapter of the legal history timeline once that chapter is published.
		fetch('/foundations/published.json')
			.then((response) => (response.ok ? response.json() : []))
			.then((items: { link?: string }[]) => {
				publishedHistory = Array.isArray(items) ? items.flatMap((item) => (item.link ? [item.link] : [])) : [];
			})
			.catch(() => {});
	});

	function toggleKind(kind: TimelineKind) {
		const current = shown ?? present;
		shown = current.includes(kind) ? current.filter((each) => each !== kind) : present.filter((each) => current.includes(each) || each === kind);
	}

	function zoom(factor: number) {
		range = zoomRange(view, factor, extent);
	}

	/** The overview from the keyboard: the arrows move the view a tenth of its width, Page Up and Page Down a whole width, Home and End to either end. */
	function moveOverview(event: KeyboardEvent) {
		const steps: Record<string, number> = { ArrowLeft: -0.1, ArrowDown: -0.1, ArrowRight: 0.1, ArrowUp: 0.1, PageDown: -1, PageUp: 1 };
		const step = steps[event.key];
		let next: TimelineRange | undefined;
		if (step !== undefined) next = { from: view.from + step * span, to: view.to + step * span };
		else if (event.key === 'Home') next = { from: extent.from, to: extent.from + span };
		else if (event.key === 'End') next = { from: extent.to - span, to: extent.to };
		if (!next) return;
		event.preventDefault();
		range = clampRange(next, extent);
	}

	const span = $derived(view.to - view.from);
	const canZoomIn = $derived(span > narrowestSpan + 0.01);
	const canZoomOut = $derived(view.from > extent.from + 0.01 || view.to < extent.to - 0.01);

	/* The drawing ------------------------------------------------------------ */

	const narrow = $derived(width < 560);
	const labelWidth = $derived(narrow ? 30 : 176);
	const right = 10;
	const rowHeight = 36;
	const eraBand = 22;
	const axisHeight = 22;
	const chartHeight = $derived(eraBand + visibleKinds.length * rowHeight + axisHeight);
	const plotWidth = $derived(Math.max(100, width - labelWidth - right));
	const x = (year: number) => labelWidth + ((year - view.from) / span) * plotWidth;

	const entriesInView = $derived(
		entries.filter((entry) => visibleKinds.includes(entry.kind) && inRange(yearOf(entry.date), view))
	);
	const opinionsInView = $derived(
		visibleKinds.includes('opinion') ? opinions.filter((year) => year.year + 1 > view.from && year.year < view.to) : []
	);

	interface Row {
		kind: TimelineKind;
		count: number;
		marks: TimelineEntry[];
		bars: { start: number; width: number; count: number }[];
		top: number;
	}

	const rows = $derived.by((): Row[] =>
		visibleKinds.map((kind, index) => {
			const top = eraBand + index * rowHeight;
			const years = barYears(view);
			if (kind === 'opinion') {
				const bars = [...countsByBar(opinionsInView, years).entries()].map(([start, bar]) => ({ start, width: years, ...bar }));
				return { kind, count: opinionsInView.reduce((total, year) => total + year.count, 0), marks: [], bars, top };
			}
			const own = entriesInView.filter((entry) => entry.kind === kind);
			if (own.length > mostMarks) {
				const points = own.map((entry) => ({ year: Math.floor(yearOf(entry.date)), count: 1 }));
				const bars = [...countsByBar(points, years).entries()].map(([start, bar]) => ({ start, width: years, ...bar }));
				return { kind, count: own.length, marks: [], bars, top };
			}
			return { kind, count: own.length, marks: own, bars: [], top };
		})
	);

	/** Each row's bars are scaled to its own tallest bar; the row's label gives its count. */
	const barHeight = (count: number, row: Row) => {
		const own = Math.max(1, ...row.bars.map((bar) => bar.count));
		return Math.max(3, (Math.sqrt(count) / Math.sqrt(own)) * (rowHeight - 12));
	};

	// None when the whole view lies in one era: the list's heading names it, as in the approved mockup.
	const eraBands = $derived.by(() => {
		const bands = eras
			.map((era, index) => ({ era, index, from: Math.max(era.start, view.from), to: Math.min(era.end, view.to) }))
			.filter((band) => band.to > band.from);
		return bands.length > 1 ? bands : [];
	});

	// The era's name in its band: the whole name, else its first word, else nothing, whichever fits (about 7.5 pixels a capital letter).
	const eraLabel = (name: string, room: number) =>
		[name, name.split(' ')[0].replace(/-$/, '')].map((each) => each.toLocaleUpperCase('en-US')).find((each) => each.length * 7.5 + 12 <= room) ?? '';

	const ticks = $derived(axisYears(view, narrow ? 4 : 8));

	/* The card --------------------------------------------------------------- */

	let active = $state<{ entry: TimelineEntry; left: number; top: number; pinned: boolean } | undefined>();
	let copied = $state('');

	function show(entry: TimelineEntry, cx: number, cy: number, pinned: boolean) {
		const cardWidth = Math.min(300, width);
		const left = Math.min(Math.max(0, cx - cardWidth / 2), width - cardWidth);
		active = { entry, left, top: cy + 14, pinned };
		copied = '';
	}

	function leave() {
		if (active && !active.pinned) active = undefined;
	}

	async function copy(text: string, what: string) {
		try {
			await copyText(text);
			copied = `${what} copied`;
		} catch {
			copied = text;
		}
	}

	function entryAddress(entry: TimelineEntry): string {
		const url = new URL(location.href);
		url.hash = `timeline-${entry.id}`;
		return url.href;
	}

	function onKey(event: KeyboardEvent) {
		if (event.key === 'Escape' && active) active = undefined;
	}

	/** A kept card closes when the reader selects anything outside it other than a mark. */
	function onPointerDown(event: PointerEvent) {
		const target = event.target as Element | null;
		if (active?.pinned && !target?.closest?.('.card, .mark')) active = undefined;
	}

	/* The list --------------------------------------------------------------- */

	interface EraGroup {
		era: Era;
		entries: TimelineEntry[];
		aggregated: Map<TimelineKind, TimelineEntry[]>;
		opinions: { count: number; from: number; to: number; byNation: Map<string, number>; byYear: Map<number, number> } | undefined;
	}

	const groups = $derived.by((): EraGroup[] => {
		const sorted = [...entriesInView].sort(byDate);
		if (newestFirst) sorted.reverse();
		const byEra = new Map<Era, EraGroup>();
		const groupOf = (era: Era) => {
			let group = byEra.get(era);
			if (!group) {
				group = { era, entries: [], aggregated: new Map(), opinions: undefined };
				byEra.set(era, group);
			}
			return group;
		};
		for (const entry of sorted) {
			// A law shown for context is drawn, not listed: the list is the records of what is filtered.
			// Down the page, the list is the drawing, so it keeps them, drawn faintly.
			if (entry.context && !down) continue;
			const group = groupOf(eraOf(Math.floor(yearOf(entry.date))));
			if (aggregate.includes(entry.kind)) group.aggregated.set(entry.kind, [...(group.aggregated.get(entry.kind) ?? []), entry]);
			else group.entries.push(entry);
		}
		for (const year of opinionsInView) {
			const group = groupOf(eraOf(year.year));
			const counts = group.opinions ?? { count: 0, from: year.year, to: year.year, byNation: new Map(), byYear: new Map() };
			counts.byYear.set(year.year, (counts.byYear.get(year.year) ?? 0) + year.count);
			counts.count += year.count;
			counts.from = Math.min(counts.from, year.year);
			counts.to = Math.max(counts.to, year.year);
			if (year.nation) counts.byNation.set(year.nation, (counts.byNation.get(year.nation) ?? 0) + year.count);
			group.opinions = counts;
		}
		const ordered = eras.filter((era) => byEra.has(era)).map((era) => byEra.get(era)!);
		return newestFirst ? ordered.reverse() : ordered;
	});

	const listed = $derived(entriesInView.filter((entry) => down || !entry.context));
	const inViewCount = $derived(listed.length + opinionsInView.reduce((total, year) => total + year.count, 0));
	const shownYears = $derived.by(() => {
		const years = [...listed.map((entry) => Math.floor(yearOf(entry.date))), ...opinionsInView.map((year) => year.year)];
		if (years.length === 0) return `${Math.ceil(view.from)}–${Math.floor(view.to)}`;
		const first = Math.min(...years);
		const last = Math.max(...years);
		return first === last ? String(first) : `${first}–${last}`;
	});

	/* The rail, down the page --------------------------------------------- */

	let list = $state<HTMLElement>();
	let railHeight = $state(400);
	/** The years of the entries on screen, and the year at the reading line a third of the way down. */
	let onScreen = $state<{ from: number; to: number; at: number } | undefined>();
	const railYear = (year: number) => ((year - view.from) / span) * railHeight;
	const railTicks = $derived(axisYears(view, Math.max(3, Math.round(railHeight / 90))));
	const railLanes = $derived(visibleKinds);
	/** One mark for each kind at each pixel of the rail: marks in the same place look like one, and the full timeline has thousands. */
	const railMarks = $derived.by(() => {
		const marks = new Map<string, { kind: TimelineKind; top: number }>();
		const add = (kind: TimelineKind, year: number) => {
			const top = Math.round(railYear(year));
			marks.set(`${kind}|${top}`, { kind, top });
		};
		for (const entry of entriesInView) add(entry.kind, yearOf(entry.date));
		for (const year of opinionsInView) add('opinion', year.year + 0.5);
		return [...marks.values()];
	});

	function measure() {
		if (!down || !list) return;
		const rows = [...list.querySelectorAll<HTMLElement>('[data-year]')];
		const reading = innerHeight / 3;
		let from = Infinity;
		let to = -Infinity;
		let at: number | undefined;
		for (const row of rows) {
			const box = row.getBoundingClientRect();
			if (box.bottom < 0 || box.top > innerHeight) continue;
			const year = Number(row.dataset.year);
			from = Math.min(from, year);
			to = Math.max(to, year);
			if (at === undefined && box.bottom >= reading) at = year;
		}
		onScreen = Number.isFinite(from) ? { from, to, at: at ?? from } : undefined;
	}

	let measuring = false;
	function onScroll() {
		if (measuring) return;
		measuring = true;
		requestAnimationFrame(() => {
			measuring = false;
			measure();
		});
	}

	$effect(() => {
		// Measure again when the layout, the order or the entries in view change.
		void [down, groups];
		requestAnimationFrame(measure);
	});

	/** Selecting a year on the rail brings its first entry to the top. */
	function jumpTo(event: MouseEvent) {
		if (!list) return;
		const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const year = view.from + ((event.clientY - box.top) / box.height) * span;
		railChosen = undefined;
		const rows = [...list.querySelectorAll<HTMLElement>('[data-year]')];
		const target = rows.find((row) => (newestFirst ? Number(row.dataset.year) <= year : Number(row.dataset.year) >= year)) ?? rows.at(-1);
		target?.scrollIntoView({ block: 'center' });
	}

	/** The year last chosen on the rail from the keyboard, while its entries are still on screen. */
	let railChosen = $state<number | undefined>();
	const railValue = $derived(
		railChosen !== undefined && onScreen && railChosen >= onScreen.from && railChosen <= onScreen.to ? railChosen : onScreen?.at
	);

	/**
	 * The rail from the keyboard, drawn with the earliest year at the top: Down and Right go to the next year with
	 * entries a decade or more on, Up and Left back, Page Down and Page Up five decades, Home and End to the first
	 * and last years.
	 */
	function railKey(event: KeyboardEvent) {
		if (!list) return;
		const rows = [...list.querySelectorAll<HTMLElement>('[data-year]')];
		const years = [...new Set(rows.map((row) => Number(row.dataset.year)))].sort((first, second) => first - second);
		if (years.length === 0) return;
		const step = span >= 40 ? 10 : 1;
		const steps: Record<string, number> = { ArrowDown: step, ArrowRight: step, ArrowUp: -step, ArrowLeft: -step, PageDown: 5 * step, PageUp: -5 * step };
		const base = railValue ?? years[0];
		let year: number | undefined;
		if (event.key === 'Home') year = years[0];
		else if (event.key === 'End') year = years.at(-1);
		else if (steps[event.key] > 0) year = years.find((each) => each >= base + steps[event.key]) ?? years.at(-1);
		else if (steps[event.key] < 0) year = years.findLast((each) => each <= base + steps[event.key]) ?? years[0];
		if (year === undefined) return;
		event.preventDefault();
		railChosen = year;
		rows.find((row) => Number(row.dataset.year) === year)?.scrollIntoView({ block: 'center' });
	}

	/** Years between one entry and the next, said down the page where they are far apart. */
	const gapBefore = (list: TimelineEntry[], index: number) => {
		if (!down || index === 0) return 0;
		const gap = Math.abs(Math.floor(yearOf(list[index].date)) - Math.floor(yearOf(list[index - 1].date)));
		return gap >= 15 ? gap : 0;
	};

	/** The aggregated lines that are open, by era and kind. */
	let opened = $state<Record<string, boolean>>({});

	const plural = (count: number, one: string, many: string) => `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
	const aggregateWords: Record<TimelineKind, [string, string]> = {
		treaty: ['treaty or land base', 'treaties and land bases'],
		document: ['law or agreement', 'laws and agreements'],
		case: ['court decision', 'court decisions'],
		opinion: ['court opinion', 'court opinions'],
		federal: ['federal law', 'federal laws']
	};
	const external = (link: string | undefined) => !!link && /^https?:/.test(link);
</script>

<svelte:window onkeydown={onKey} onpointerdown={onPointerDown} onscroll={onScroll} onresize={onScroll} />

<div class="timeline" class:down data-ready={interactive ? '' : undefined}>
	<svg class="sprite" width="0" height="0" aria-hidden="true">
		{#each timelineKinds as { kind } (kind)}
			{@const Icon = icons[kind]}
			<symbol id="{spriteId}-{kind}" viewBox="0 0 24 24"><Icon size={24} /></symbol>
		{/each}
	</svg>
	{#if interactive}
		<div class="toolbar no-print" class:beside={besideHeading && !down}>
			{#if summary || down}
				<p class="summary"><strong>{plural(inViewCount, 'entry', 'entries')}, {shownYears}</strong></p>
			{/if}
			{@render toolbarStart?.()}
			{#if chips && !down}
				<button type="button" class="icon-button" aria-label="Kinds shown" title="Kinds shown" aria-expanded={chipsOpen} onclick={() => (chipsOpen = !chipsOpen)}>
					<Funnel size={20} aria-hidden="true" />
				</button>
			{/if}
			<button type="button" class="icon-button" aria-label="Zoom out" title="Zoom out" disabled={!canZoomOut} onclick={() => zoom(2)}>
				<ZoomOut size={20} aria-hidden="true" />
			</button>
			<button type="button" class="icon-button" aria-label="Zoom in" title="Zoom in" disabled={!canZoomIn} onclick={() => zoom(0.5)}>
				<ZoomIn size={20} aria-hidden="true" />
			</button>
			<button type="button" class="icon-button" aria-label="Show every year" title="Show every year" disabled={!canZoomOut} onclick={() => (range = undefined)}>
				<Scan size={20} aria-hidden="true" />
			</button>
			<span class="separator" aria-hidden="true"></span>
			<button type="button" class="icon-button" aria-label="Across" title="Across" aria-pressed={layout === 'across'} onclick={() => chooseLayout('across')}>
				<MoveHorizontal size={20} aria-hidden="true" />
			</button>
			<button type="button" class="icon-button" aria-label="Down the page" title="Down the page" aria-pressed={layout === 'down'} onclick={() => chooseLayout('down')}>
				<MoveVertical size={20} aria-hidden="true" />
			</button>
			<span class="separator" aria-hidden="true"></span>
			<button
				type="button"
				class="icon-button"
				aria-label="Newest first"
				title={newestFirst ? 'Oldest first' : 'Newest first'}
				aria-pressed={newestFirst}
				onclick={() => (newestFirst = !newestFirst)}
			>
				<ArrowDownUp size={20} aria-hidden="true" />
			</button>
			{#if fullLink}
				<a class="icon-button" href={fullLink} aria-label="Open in the full timeline" title="Open in the full timeline">
					<Maximize2 size={20} aria-hidden="true" />
				</a>
			{/if}
		</div>
		{#if chips && chipsOpen && !down}
			<div class="chips no-print" role="group" aria-label="Kinds shown">
				{#each present as kind (kind)}
					<button type="button" class="chip kind-{kind}" aria-pressed={visibleKinds.includes(kind)} onclick={() => toggleKind(kind)}>
						<span class="swatch" aria-hidden="true"></span>{kindLabels[kind]}
					</button>
				{/each}
			</div>
		{/if}
	{/if}

	{#if overview && !down}
		{@const decades = (() => {
			const counts = new Map<number, Map<TimelineKind, number>>();
			const add = (year: number, kind: TimelineKind, count: number) => {
				const decade = Math.floor(year / 10) * 10;
				const byKind = counts.get(decade) ?? new Map();
				byKind.set(kind, (byKind.get(kind) ?? 0) + count);
				counts.set(decade, byKind);
			};
			for (const entry of entries) if (visibleKinds.includes(entry.kind)) add(Math.floor(yearOf(entry.date)), entry.kind, 1);
			if (visibleKinds.includes('opinion')) for (const year of opinions) add(year.year, 'opinion', year.count);
			return counts;
		})()}
		{@const most = Math.max(1, ...[...decades.values()].map((byKind) => [...byKind.values()].reduce((total, count) => total + count, 0)))}
		{@const ox = (year: number) => ((year - extent.from) / (extent.to - extent.from)) * width}
		<svg
			class="overview"
			width={width}
			height="64"
			viewBox="0 0 {width} 64"
			role="slider"
			tabindex="0"
			aria-label="Years shown"
			aria-orientation="horizontal"
			aria-valuemin={Math.floor(extent.from)}
			aria-valuemax={Math.ceil(extent.to)}
			aria-valuenow={Math.round((view.from + view.to) / 2)}
			aria-valuetext="{Math.ceil(view.from)} to {Math.floor(view.to)}"
			onkeydown={moveOverview}
			onclick={(event) => {
				const box = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
				const year = extent.from + ((event.clientX - box.left) / box.width) * (extent.to - extent.from);
				range = zoomRange({ from: year - span / 2, to: year + span / 2 }, 1, extent);
			}}
		>
			{#each [...decades.entries()] as [decade, byKind] (decade)}
				{@const total = [...byKind.values()].reduce((sum, count) => sum + count, 0)}
				{@const full = (Math.sqrt(total) / Math.sqrt(most)) * 46}
				{@const stack = timelineKinds.filter(({ kind }) => byKind.has(kind)).map(({ kind }) => ({ kind, share: (byKind.get(kind) ?? 0) / total }))}
				{#each stack as part, index (part.kind)}
					{@const below = stack.slice(0, index).reduce((sum, each) => sum + each.share, 0)}
					<rect
						class="fill-{part.kind}"
						x={ox(decade) + 1}
						y={48 - full * (below + part.share)}
						width={Math.max(1, ox(decade + 10) - ox(decade) - 2)}
						height={Math.max(0.5, full * part.share)}
					/>
				{/each}
			{/each}
			<rect class="overview-window" x={ox(view.from)} y="1" width={Math.max(4, ox(view.to) - ox(view.from))} height="47" rx="3" />
			{#each axisYears(extent, narrow ? 4 : 7) as year}
				<text class="tick" x={ox(year)} y="62" text-anchor="middle">{year}</text>
			{/each}
		</svg>
	{/if}

	<div class="chart" class:hidden={down} bind:clientWidth={width}>
		<!-- The drawing is hidden from screen readers and its marks are a pointer shortcut: the list below names the same records. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<svg width={width} height={chartHeight} viewBox="0 0 {width} {chartHeight}" aria-hidden="true" onpointerleave={leave}>
			{#each eraBands as band (band.era.name)}
				<rect class="era-band" class:alternate={band.index % 2 === 1} x={x(band.from)} y="0" width={x(band.to) - x(band.from)} height={chartHeight - axisHeight} />
				{@const label = eraLabel(band.era.name, x(band.to) - x(band.from))}
				{#if label}
					<text class="era-label" x={x(band.from) + 6} y="15">{label}</text>
				{/if}
			{/each}
			{#each rows as row (row.kind)}
				{@const middle = row.top + rowHeight / 2}
				{@const Icon = icons[row.kind]}
				<g class="kind-{row.kind}">
					<Icon x={4} y={middle - 9} size={18} />
					{#if !narrow}
						<text class="row-label" x="28" y={middle - 2}>{kindLabels[row.kind]}</text>
						<text class="row-count" x="28" y={middle + 12}
								>{row.count.toLocaleString('en-US')}{row.marks.length > 0 && row.marks.every((entry) => entry.context) ? ' for context' : countsInView ? ' in view' : ''}</text
							>
					{/if}
					<line class="row-line" x1={labelWidth} x2={width - right} y1={middle} y2={middle} />
					{#each row.bars as bar (bar.start)}
						{@const height = barHeight(bar.count, row)}
						{@const left = Math.max(labelWidth, x(bar.start))}
						{@const barWidth = Math.max(1.5, Math.min(width - right, x(bar.start + bar.width)) - left - 1)}
						<rect class="bar" x={left} y={middle + (rowHeight - 12) / 2 - height} width={barWidth} height={height} rx="1" />
					{/each}
					{#each row.marks as entry (entry.id)}
						{@const cx = x(yearOf(entry.date))}
						{@const selected = active?.entry.id === entry.id}
						{#if entry.context}
							<rect
								class="mark context"
								class:selected
								x={cx - 5}
								y={middle - 5}
								width="10"
								height="10"
								transform="rotate(45 {cx} {middle})"
								onpointerenter={() => !active?.pinned && show(entry, cx, middle, false)}
								onclick={() => show(entry, cx, middle, true)}
							/>
						{:else}
							<circle
								class="mark"
								class:partial={isPartialDate(entry.date)}
								class:selected
								cx={cx}
								cy={middle}
								r={selected ? 8 : 6}
								onpointerenter={() => !active?.pinned && show(entry, cx, middle, false)}
								onclick={() => show(entry, cx, middle, true)}
							/>
						{/if}
					{/each}
				</g>
			{/each}
			<line class="axis" x1={labelWidth} x2={width - right} y1={chartHeight - axisHeight} y2={chartHeight - axisHeight} />
			{#each ticks as year}
				<line class="axis" x1={x(year)} x2={x(year)} y1={chartHeight - axisHeight} y2={chartHeight - axisHeight + 4} />
				<text class="tick" x={x(year)} y={chartHeight - 5} text-anchor="middle">{year}</text>
			{/each}
		</svg>
		{#if active}
			{@const entry = active.entry}
			{@const Icon = icons[entry.kind]}
			<div class="card kind-{entry.kind}" style:left="{active.left}px" style:top="{active.top}px" role="group" aria-label={entry.title}>
				<p class="card-kind"><Icon size={16} aria-hidden="true" /> {kindLabels[entry.kind]} · {timelineDate(entry.date)}</p>
				<p class="card-title">{#if entry.italic}<i>{entry.title}</i>{:else}{entry.title}{/if}{#if entry.citation}, {entry.citation}{/if}{#if entry.citations?.length}<sup class="card-marks"
							>{entry.citations.map((mark) => `[${mark.number}]`).join('')}</sup
						>{/if}</p>
				{#if entry.detail}<p class="card-detail">{entry.detail}</p>{/if}
				{#if active.pinned}
					<div class="card-actions">
						{#if entry.link}
							<a class="icon-button" href={entry.link} aria-label="Open the record" title="Open the record"><ExternalLink size={18} aria-hidden="true" /></a>
						{/if}
						<button type="button" class="icon-button" aria-label="Copy the citation" title="Copy the citation" onclick={() => copy(entryCitation(entry), 'Citation')}>
							<Quote size={18} aria-hidden="true" />
						</button>
						<button type="button" class="icon-button" aria-label="Copy a link to this entry" title="Copy a link to this entry" onclick={() => copy(entryAddress(entry), 'Link')}>
							<Copy size={18} aria-hidden="true" />
						</button>
					</div>
					<p class="card-status small" role="status">{copied}</p>
				{/if}
			</div>
		{/if}
	</div>
	{#if down}
		<p class="key small muted" aria-hidden="true">
			{#each visibleKinds as kind (kind)}
				{@const Icon = icons[kind]}
				<span class="kind-{kind}"><span class="key-icon"><Icon size={16} aria-hidden="true" /></span>{kindLabels[kind]}</span>
			{/each}
			<span><span class="key-ring partial"></span>Year or month only</span>
			{#if entries.some((entry) => entry.context)}
				<span><svg width="12" height="12"><rect class="key-context" x="2" y="2" width="8" height="8" transform="rotate(45 6 6)" /></svg> Applies to every nation</span>
			{/if}
		</p>
	{:else}
	<p class="key small muted" aria-hidden="true">
		<span><svg width="12" height="12"><circle class="key-mark" cx="6" cy="6" r="5" /></svg> Exact date</span>
		<span><svg width="12" height="12"><circle class="key-mark partial" cx="6" cy="6" r="4.5" /></svg> Year or month only</span>
		{#if entries.some((entry) => entry.context)}
			<span><svg width="12" height="12"><rect class="key-context" x="2" y="2" width="8" height="8" transform="rotate(45 6 6)" /></svg> Applies to every nation</span>
		{/if}
	</p>
	{/if}

	<div class="body">
	<!-- The rail comes first, so the keyboard reaches it before the list's many links; the grid draws it on the right. -->
	{#if down}
		<div
			class="rail no-print"
			role="slider"
			tabindex="0"
			aria-label="Jump to a year"
			aria-orientation="vertical"
			aria-valuemin={Math.floor(view.from)}
			aria-valuemax={Math.ceil(view.to)}
			aria-valuenow={railValue ?? Math.floor(view.from)}
			bind:clientHeight={railHeight}
			onclick={jumpTo}
			onkeydown={railKey}
		>
			{#each railLanes as kind, lane (kind)}
				{@const Icon = icons[kind]}
				<span class="rail-lane-icon kind-{kind}" style:--lane={lane} aria-hidden="true"><Icon size={12} strokeWidth={2.25} /></span>
			{/each}
			{#each railTicks as year}
				<span class="rail-tick" style:top="{railYear(year)}px">{year}</span>
			{/each}
			{#each railMarks as mark, index (index)}
				<span class="rail-mark kind-{mark.kind}" style:top="{mark.top}px" style:--lane={railLanes.indexOf(mark.kind)}></span>
			{/each}
			{#if onScreen}
				<span class="rail-window" style:top="{railYear(onScreen.from)}px" style:height="{Math.max(6, railYear(onScreen.to + 1) - railYear(onScreen.from))}px"></span>
				<span class="rail-year" style:top="{railYear(onScreen.at)}px">{onScreen.at}</span>
			{/if}
		</div>
	{/if}
	<div class="list" bind:this={list}>
		{#each groups as group (group.era.name)}
			<!-- Each era in its own box, so its held heading leaves the screen with its last entry. -->
			<div class="era">
			<div class="era-heading">
				<svelte:element this={`h${headingLevel}`}>{group.era.name}</svelte:element>
				<span class="muted small">{group.era.years}</span>
				{#if publishedHistory.includes(group.era.page)}
					<a class="small history" href={group.era.page}>The history of this era</a>
				{/if}
			</div>
			<ol class="entries">
				{#each group.entries as entry, index (entry.id)}
					{@const gap = gapBefore(group.entries, index)}
					{#if gap}<li class="gap" aria-hidden="true">{gap} years</li>{/if}
					{@render row(entry)}
				{/each}
				{#each [...group.aggregated.entries()] as [kind, list] (kind)}
					{@const key = `${group.era.name}|${kind}`}
					<li class="entry kind-{kind}" data-year={Math.floor(yearOf(list[0].date))}>
						<span class="date">{Math.floor(yearOf(list[0].date))}–{Math.floor(yearOf(list.at(-1)!.date))}</span>
						<span class="icon"><svg width="16" height="16" aria-hidden="true"><use href={iconHref(kind)} /></svg></span>
						<details class="aggregate" bind:open={() => opened[key] ?? false, (value) => (opened[key] = value)}>
							<summary>{plural(list.length, aggregateWords[kind][0], aggregateWords[kind][1])}</summary>
							{#if opened[key]}
								<ol class="entries nested">
									{#each list as entry (entry.id)}
										{@render row(entry)}
									{/each}
								</ol>
							{/if}
						</details>
					</li>
				{/each}
				{#if group.opinions}
					{@const counts = group.opinions}
					<li class="entry kind-opinion" data-year={counts.from}>
						<span class="date">{counts.from === counts.to ? counts.from : `${counts.from}–${counts.to}`}</span>
						<span class="icon"><Scale size={16} aria-hidden="true" /></span>
						<span class="what">
							{#if opinionsLink}
								<a href={opinionsLink}>{plural(counts.count, 'opinion', 'opinions')} of the nation’s courts</a><CitationMarks marks={opinionCitations} />
							{:else}
								<details class="aggregate" bind:open={() => opened[`${group.era.name}|opinion`] ?? false, (value) => (opened[`${group.era.name}|opinion`] = value)}>
									<summary>{plural(counts.count, 'Tribal court opinion', 'Tribal court opinions')}</summary>
									{#if opened[`${group.era.name}|opinion`]}
										<ul class="by-nation">
											{#each [...counts.byNation.entries()].sort((first, second) => second[1] - first[1]) as [nation, count] (nation)}
												<li><a href="/nations/{nation}/opinions">{nations[nation]?.name ?? nation}</a> <span class="muted">{count.toLocaleString('en-US')}</span></li>
											{/each}
										</ul>
									{/if}
								</details>
							{/if}
							{#if down}
								{@const most = Math.max(1, ...counts.byYear.values())}
								<svg class="by-year" width={(counts.to - counts.from + 1) * 7} height="32" aria-hidden="true">
									{#each [...counts.byYear.entries()] as [year, count] (year)}
										{@const height = Math.max(2, Math.sqrt(count / most) * 26)}
										<rect class="bar" x={(year - counts.from) * 7} y={27 - height} width="6" height={height} />
									{/each}
								</svg>
							{/if}
						</span>
					</li>
				{/if}
			</ol>
			</div>
		{/each}
	</div>
	</div>
</div>

{#snippet row(entry: TimelineEntry)}
	<li class="entry kind-{entry.kind}" class:partial={isPartialDate(entry.date)} class:context={entry.context} id="timeline-{entry.id}" data-year={Math.floor(yearOf(entry.date))}>
		<span class="date">{timelineDate(entry.date)}</span>
		<span class="icon"><svg width="16" height="16" aria-hidden="true"><use href={iconHref(entry.kind)} /></svg><span class="visually-hidden">{kindLabels[entry.kind]}:</span></span>
		<span class="what">
			{#if entry.link}<a href={entry.link} rel={external(entry.link) ? 'noopener' : undefined}>{#if entry.italic}<i>{entry.title}</i>{:else}{entry.title}{/if}</a>{:else if entry.italic}<i>{entry.title}</i>{:else}{entry.title}{/if}{#if entry.citation}, {entry.citation}{/if}<CitationMarks marks={entry.citations} />
			{#if entry.detail}<span class="detail">{entry.detail}</span>{:else if entry.context && down}<span class="detail">Applies to every nation</span>{/if}
			{#if entry.nations?.length}
				<span class="detail">{entry.nations.map((nation) => nations[nation]?.name ?? nation).join(' · ')}</span>
			{/if}
		</span>
	</li>
{/snippet}

<style>
	.timeline {
		margin: var(--space-3) 0 var(--space-5);
	}

	.sprite {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-1);
		border-bottom: 1px solid var(--color-line);
		padding-bottom: var(--space-1);
	}

	.summary {
		margin: 0 auto 0 0;
	}

	/*
	 * On a nation's page the buttons sit on the line of the section's heading, as in the approved
	 * mockup. The folding section clips its contents to animate their height (Collapsible.svelte), so
	 * a toolbar pulled up over the heading was clipped away and the heading took its clicks: once
	 * across, the timeline could not be turned back (Trevor, Nov. 24, 2026). The toolbar is placed
	 * from the section itself instead, which the clip does not reach. On narrow screens, where the
	 * heading and the buttons do not fit on one line, it keeps its own line.
	 */
	:global(details:has(.toolbar.beside)) {
		position: relative;
	}

	.toolbar.beside {
		position: absolute;
		z-index: 1;
		top: var(--space-1);
		right: 0;
		width: max-content;
		border-bottom: 0;
	}

	@media (max-width: 40rem) {
		.toolbar.beside {
			position: static;
			width: auto;
			border-bottom: 1px solid var(--color-line);
		}
	}

	.key-ring {
		display: inline-block;
		width: 0.75rem;
		height: 0.75rem;
		border: 2px solid var(--kind-color, var(--color-ink-muted));
		border-radius: 50%;
	}

	.key-ring.partial {
		border-style: dashed;
	}

	/* Each kind in the key shows its icon, the same one its entries carry, so the key reads without telling colors apart (WCAG 1.4.1). */
	.key-icon {
		display: inline-flex;
		color: var(--kind-color);
	}

	@media (max-width: 30rem) {
		.summary {
			flex-basis: 100%;
		}
	}

	.toolbar .icon-button[disabled] {
		opacity: 0.4;
		cursor: default;
	}

	.toolbar .icon-button[aria-pressed='true'],
	.toolbar .icon-button[aria-expanded='true'] {
		color: var(--color-link);
		box-shadow: inset 0 -2px 0 var(--color-link);
	}

	.separator {
		width: 1px;
		height: 1.5rem;
		background: var(--color-line);
		margin: 0 var(--space-1);
	}

	/* Small pills on one line, as in the approved mockup; 28px high, over the 24px target minimum. */
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) 0.375rem;
		margin: var(--space-2) 0 0;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		min-height: 1.75rem;
		padding: 0 0.5rem;
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		background: var(--color-surface-raised);
		color: var(--color-ink);
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.chip[aria-pressed='false'] {
		background: transparent;
		color: var(--color-ink-muted);
		text-decoration: line-through;
	}

	.swatch {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 50%;
		background: var(--kind-color);
	}

	.chip[aria-pressed='false'] .swatch {
		background: transparent;
		border: 1.5px solid var(--kind-color);
	}

	.kind-treaty {
		--kind-color: var(--color-timeline-treaty);
	}
	.kind-document {
		--kind-color: var(--color-timeline-document);
	}
	.kind-case {
		--kind-color: var(--color-timeline-case);
	}
	.kind-opinion {
		--kind-color: var(--color-timeline-opinion);
	}
	.kind-federal {
		--kind-color: var(--color-timeline-federal);
	}

	.overview {
		display: block;
		margin-top: var(--space-3);
		cursor: pointer;
	}

	.fill-treaty {
		fill: var(--color-timeline-treaty);
	}
	.fill-document {
		fill: var(--color-timeline-document);
	}
	.fill-case {
		fill: var(--color-timeline-case);
	}
	.fill-opinion {
		fill: var(--color-timeline-opinion);
	}
	.fill-federal {
		fill: var(--color-timeline-federal);
	}

	.overview-window {
		fill: none;
		stroke: var(--color-ink);
		stroke-width: 2.5;
	}

	.chart {
		position: relative;
		margin-top: var(--space-3);
	}

	.chart svg {
		display: block;
		overflow: visible;
	}

	.era-band {
		fill: var(--color-surface);
	}

	.era-band.alternate {
		fill: var(--color-paper);
	}

	.era-label {
		font-size: 0.6875rem;
		font-weight: var(--font-weight-bold);
		letter-spacing: 0.02em;
		fill: var(--color-ink-muted);
	}

	.row-label {
		font-size: 0.8125rem;
		font-weight: var(--font-weight-bold);
		fill: var(--color-ink);
	}

	.row-count,
	.tick {
		font-size: 0.75rem;
		fill: var(--color-ink-muted);
	}

	g {
		color: var(--kind-color);
	}

	.row-line {
		stroke: var(--color-line);
		stroke-width: 1.5;
	}

	.axis {
		stroke: var(--color-control-border);
	}

	.bar {
		fill: var(--kind-color);
		opacity: 0.85;
	}

	.mark {
		fill: var(--kind-color);
		stroke: var(--kind-color);
		stroke-width: 2;
		cursor: pointer;
	}

	.mark.partial {
		fill: var(--color-paper);
		stroke-dasharray: 2 2;
	}

	.mark.context {
		fill: var(--color-paper);
	}

	.mark.selected {
		stroke: var(--color-ink);
		stroke-width: 3;
	}

	.card {
		position: absolute;
		z-index: 3;
		width: min(300px, 100%);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		box-shadow: 0 8px 24px color-mix(in srgb, var(--color-ink) 18%, transparent);
		font-size: var(--font-size-small);
	}

	.card p {
		margin: 0;
	}

	.card-kind {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--kind-color);
	}

	.card-title {
		font-size: var(--font-size-body);
		margin: var(--space-1) 0 !important;
	}

	.card-detail,
	.card-status {
		color: var(--color-ink-muted);
	}

	.card-actions {
		display: flex;
		gap: var(--space-1);
		margin-top: var(--space-2);
		padding-top: var(--space-1);
		border-top: 1px solid var(--color-line);
	}

	.card-marks {
		color: var(--color-link);
	}

	.key {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		margin: var(--space-1) 0 0;
	}

	.key span {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}

	.key-mark {
		fill: var(--color-ink);
	}

	.key-mark.partial {
		fill: none;
		stroke: var(--color-ink);
		stroke-width: 1.5;
		stroke-dasharray: 2 2;
	}

	.key-context {
		fill: none;
		stroke: var(--color-timeline-federal);
		stroke-width: 2;
	}

	.era-heading {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) var(--space-3);
		margin-top: var(--space-5);
		padding-bottom: var(--space-1);
		border-bottom: 2px solid var(--color-ink);
	}

	.era-heading :global(h2),
	.era-heading :global(h3),
	.era-heading :global(h4) {
		margin: 0;
		font-size: var(--font-size-heading-3);
	}

	.history {
		margin-left: auto;
	}

	.entries {
		list-style: none;
		margin: 0;
		padding: 0;
		max-width: none;
	}

	/*
	 * An entry's title is a link, so markers right after it have little plain text around them, and WCAG 2.5.8 (target size) applies to each. Padding on the inline link gives each a box about 24px high without making its line taller, as an inline-block would.
	 */
	.entry :global(.note-marker) {
		padding: 6px 4px;
	}

	.entry {
		display: grid;
		grid-template-columns: 8.5rem 1.25rem minmax(0, 1fr);
		gap: var(--space-1) var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
		align-items: start;
	}

	.nested .entry:last-child {
		border-bottom: 0;
	}

	/*
	 * The browser lays out and paints only the rows near the screen. The full timeline lists about ten
	 * thousand, and switching its layout spent over two seconds laying out rows nobody could see
	 * (measured Nov. 27, 2026; with this, about a third of that). The rows stay in the page, so finding
	 * in the page, links to a row and screen readers still reach every one. The sizes are the typical
	 * row's height until a row has been drawn once, then its own.
	 */
	.entries > li {
		content-visibility: auto;
		contain-intrinsic-size: auto 4rem;
	}

	@media (max-width: 40rem) {
		.entries > li {
			contain-intrinsic-size: auto 7.5rem;
		}
	}

	.date {
		color: var(--color-ink-muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.icon {
		color: var(--kind-color);
		padding-top: 0.15em;
	}

	.detail {
		display: block;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.aggregate summary {
		cursor: pointer;
		color: var(--color-link);
		text-decoration: underline;
	}

	.nested {
		margin-top: var(--space-2);
	}

	.nested .entry {
		grid-template-columns: 7rem 1.25rem minmax(0, 1fr);
	}

	.by-nation {
		columns: 16rem;
		margin: var(--space-2) 0 0;
		padding-left: var(--space-4);
	}

	/* The entry a link goes to is shaded for a moment, then not (src/lib/arrival-highlight.ts); without scripts, while the address points to it. */
	:global(:root:not([data-scripts='on'])) .entry:target,
	.entry:global([data-arrived]) {
		background: var(--color-notice-background);
	}

	/* Down the page ------------------------------------------------------- */

	.hidden {
		display: none;
	}

	.down .body {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 7.5rem;
		gap: 1.5rem;
		align-items: start;
	}

	.down .list {
		grid-column: 1;
		grid-row: 1;
	}

	.down .rail {
		grid-column: 2;
		grid-row: 1;
	}

	/* Below 64rem the sidebar's Menu bar stays at the top of the screen, so held headings and the rail stop below it. */
	.timeline {
		--held-top: 0px;
	}

	@media (max-width: 63.99rem) {
		.timeline {
			--held-top: calc(var(--layout-target-minimum) + 1px);
		}
	}

	/* Down the page the toolbar stays at the top too, with each era's heading under it, as in the approved mockup. */
	.down .toolbar {
		position: sticky;
		top: var(--held-top);
		z-index: 3;
		background: var(--color-paper);
		padding-top: var(--space-1);
	}

	.down {
		--held-under-toolbar: calc(var(--held-top) + 3.3rem);
	}

	@media (max-width: 30rem) {
		.down {
			--held-under-toolbar: calc(var(--held-top) + 5.2rem);
		}
	}

	.down .era-heading {
		position: sticky;
		top: var(--held-under-toolbar);
		z-index: 2;
		background: var(--color-paper);
		padding-top: var(--space-2);
	}

	.down .entries {
		position: relative;
		padding: var(--space-2) 0;
	}

	/* The line through time runs down the middle of the icons' column. */
	.down .entries:not(.nested)::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: calc(7rem + var(--space-3) + 0.8125rem - 1px);
		width: 2px;
		background: var(--color-line);
	}

	.down .entry {
		grid-template-columns: 7rem 1.625rem minmax(0, 1fr);
		border-bottom: 0;
		padding: 7px 0;
	}

	.down .era-heading :global(h2),
	.down .era-heading :global(h3),
	.down .era-heading :global(h4) {
		font-size: 1.3125rem;
	}

	.down .entries:not(.nested) > .entry > .icon :global(svg) {
		width: 14px;
		height: 14px;
	}

	.down .entries:not(.nested) > .entry > .date {
		text-align: right;
		padding-top: 0.2em;
	}

	.down .entries:not(.nested) > .entry > .icon {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 1.625rem;
		height: 1.625rem;
		padding: 0;
		border: 2px solid var(--kind-color);
		border-radius: 50%;
		background: var(--color-paper);
	}

	.down .entry.partial > .icon {
		border-style: dashed !important;
	}

	.down .entry.context > .icon {
		border-color: var(--color-timeline-federal) !important;
		border-radius: 3px !important;
		transform: rotate(45deg) scale(0.8);
	}

	.down .entry.context > .icon :global(svg) {
		transform: rotate(-45deg);
	}

	.down .entry.context > .what,
	.down .entry.context > .what a {
		color: var(--color-ink-muted);
	}

	.gap {
		padding: 0 0 var(--space-2) calc(7rem + 1.625rem + 2 * var(--space-3));
		color: var(--color-ink-muted);
		font-size: 0.8125rem;
		font-style: italic;
	}

	.by-year {
		display: block;
		margin-top: var(--space-1);
		max-width: 100%;
	}

	.rail {
		position: sticky;
		top: calc(var(--held-under-toolbar, var(--held-top)) + var(--space-4));
		height: calc(100vh - var(--held-under-toolbar, var(--held-top)) - 2 * var(--space-4));
		max-height: 48rem;
		margin-top: var(--space-5);
		border-left: 1px solid var(--color-line);
		font-size: 0.75rem;
		color: var(--color-ink-muted);
		cursor: pointer;
	}
	.rail:focus-visible {
		color: var(--color-ink-muted);
	}

	.rail-tick {
		position: absolute;
		left: 0;
		padding-left: 0.5rem;
		transform: translateY(-50%);
		font-variant-numeric: tabular-nums;
	}

	.rail-tick::before {
		content: '';
		position: absolute;
		left: 0;
		top: 50%;
		width: 0.3rem;
		border-top: 1px solid var(--color-control-border);
	}

	.rail-mark {
		position: absolute;
		left: calc(2.75rem + var(--lane) * 0.875rem);
		width: 0.625rem;
		height: 3px;
		border-radius: 1px;
		background: var(--kind-color);
	}

	/* Each lane of the rail is headed by its kind's icon, above the rail, so the lanes are told apart by more than color. */
	.rail-lane-icon {
		position: absolute;
		top: -1.125rem;
		left: calc(2.75rem + var(--lane) * 0.875rem + 0.3125rem - 6px);
		display: flex;
		color: var(--kind-color);
	}

	.rail-window {
		position: absolute;
		left: -0.35rem;
		right: 0;
		border: 2px solid var(--color-ink);
		border-radius: 4px;
		background: color-mix(in srgb, var(--color-ink) 6%, transparent);
	}

	.rail-year {
		position: absolute;
		right: 0;
		transform: translateY(-50%);
		padding: 0 0.3rem;
		border-radius: 4px;
		background: var(--color-ink);
		color: var(--color-paper);
		font-weight: var(--font-weight-bold);
	}

	@media (max-width: 36rem) {
		.down .body {
			grid-template-columns: minmax(0, 1fr) 2.125rem;
			gap: var(--space-2);
		}

		/* On a phone the rail keeps its tick marks and the year at the reading line, without the tick years. */
		.rail-tick {
			font-size: 0;
		}

		.rail-mark {
			left: calc(0.2rem + var(--lane) * 0.3rem);
			width: 0.25rem;
		}

		/* A phone's rail is too narrow for the lane icons; the key above names each kind with its icon. */
		.rail-lane-icon {
			display: none;
		}

		.down .entries:not(.nested)::before {
			left: calc(0.8125rem - 1px);
		}

		.down .entry {
			grid-template-columns: 1.625rem minmax(0, 1fr);
		}

		/* On a phone the date follows the title, as in the approved mockup. */
		.down .entries:not(.nested) > .entry > .date {
			text-align: left;
			grid-row: 2;
		}

		.down .entries:not(.nested) > .entry > .what {
			grid-row: 1;
		}

		.gap {
			padding-left: calc(1.625rem + var(--space-3));
		}

		.entry,
		.nested .entry {
			grid-template-columns: 1.25rem minmax(0, 1fr);
		}

		.date {
			grid-column: 2;
			font-size: var(--font-size-small);
		}

		.icon {
			grid-row: 1 / span 2;
			grid-column: 1;
		}

		.what,
		.aggregate {
			grid-column: 2;
		}
	}
</style>
