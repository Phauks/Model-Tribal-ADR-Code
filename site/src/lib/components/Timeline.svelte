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

	Without scripts the drawing shows every year and the list every entry;
	the buttons need scripts and are hidden.

	Use:
	<Timeline entries={timeline.entries} opinions={timeline.opinions} fullLink="/nations/timeline?nation=navajo-nation" />
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import ArrowDownUp from '@lucide/svelte/icons/arrow-down-up';
	import Copy from '@lucide/svelte/icons/copy';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import FileText from '@lucide/svelte/icons/file-text';
	import Funnel from '@lucide/svelte/icons/funnel';
	import Gavel from '@lucide/svelte/icons/gavel';
	import Landmark from '@lucide/svelte/icons/landmark';
	import Link from '@lucide/svelte/icons/link';
	import Maximize2 from '@lucide/svelte/icons/maximize-2';
	import Quote from '@lucide/svelte/icons/quote';
	import Scale from '@lucide/svelte/icons/scale';
	import Scan from '@lucide/svelte/icons/scan';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import X from '@lucide/svelte/icons/x';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import type { CitationMark } from '#lib/citation-marks.ts';
	import {
		axisYears,
		barYears,
		byDate,
		countsByBar,
		entryCitation,
		eraOf,
		eras,
		extentOf,
		historyEssayPath,
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
		/** Say how many entries are in view, and which years. */
		summary?: boolean;
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
		summary = false
	}: Props = $props();

	const icons = { treaty: ScrollText, document: FileText, case: Gavel, opinion: Scale, federal: Landmark };

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
	let historyPublished = $state(false);

	onMount(() => {
		interactive = true;
		// The era headings link to the legal history essay once it is published.
		fetch('/foundations/published.json')
			.then((response) => (response.ok ? response.json() : []))
			.then((items: { link?: string }[]) => {
				historyPublished = Array.isArray(items) && items.some((item) => item.link === historyEssayPath);
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
		bars: { start: number; width: number; count: number; peacemaking: number }[];
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

	const eraBands = $derived(
		eras
			.map((era, index) => ({ era, index, from: Math.max(era.start, view.from), to: Math.min(era.end, view.to) }))
			.filter((band) => band.to > band.from)
	);

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
			await navigator.clipboard.writeText(text);
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

	/* The list --------------------------------------------------------------- */

	interface EraGroup {
		era: Era;
		entries: TimelineEntry[];
		aggregated: Map<TimelineKind, TimelineEntry[]>;
		opinions: { count: number; peacemaking: number; from: number; to: number; byNation: Map<string, number> } | undefined;
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
			if (entry.context) continue;
			const group = groupOf(eraOf(Math.floor(yearOf(entry.date))));
			if (aggregate.includes(entry.kind)) group.aggregated.set(entry.kind, [...(group.aggregated.get(entry.kind) ?? []), entry]);
			else group.entries.push(entry);
		}
		for (const year of opinionsInView) {
			const group = groupOf(eraOf(year.year));
			const counts = group.opinions ?? { count: 0, peacemaking: 0, from: year.year, to: year.year, byNation: new Map() };
			counts.count += year.count;
			counts.peacemaking += year.peacemaking;
			counts.from = Math.min(counts.from, year.year);
			counts.to = Math.max(counts.to, year.year);
			if (year.nation) counts.byNation.set(year.nation, (counts.byNation.get(year.nation) ?? 0) + year.count);
			group.opinions = counts;
		}
		const ordered = eras.filter((era) => byEra.has(era)).map((era) => byEra.get(era)!);
		return newestFirst ? ordered.reverse() : ordered;
	});

	const listed = $derived(entriesInView.filter((entry) => !entry.context));
	const inViewCount = $derived(listed.length + opinionsInView.reduce((total, year) => total + year.count, 0));
	const shownYears = $derived.by(() => {
		const years = [...listed.map((entry) => Math.floor(yearOf(entry.date))), ...opinionsInView.map((year) => year.year)];
		if (years.length === 0) return `${Math.ceil(view.from)}–${Math.floor(view.to)}`;
		const first = Math.min(...years);
		const last = Math.max(...years);
		return first === last ? String(first) : `${first}–${last}`;
	});

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

<svelte:window onkeydown={onKey} />

<div class="timeline">
	{#if interactive}
		<div class="toolbar no-print">
			{#if summary}
				<p class="summary"><strong>{plural(inViewCount, 'entry', 'entries')}, {shownYears}</strong></p>
			{/if}
			{#if chips}
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
		{#if chips && chipsOpen}
			<div class="chips no-print" role="group" aria-label="Kinds shown">
				{#each present as kind (kind)}
					<button type="button" class="chip kind-{kind}" aria-pressed={visibleKinds.includes(kind)} onclick={() => toggleKind(kind)}>
						<span class="swatch" aria-hidden="true"></span>{kindLabels[kind]}
					</button>
				{/each}
			</div>
		{/if}
	{/if}

	{#if overview}
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
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<svg
			class="overview"
			width={width}
			height="64"
			viewBox="0 0 {width} 64"
			aria-hidden="true"
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
			{#each axisYears(extent, narrow ? 4 : 7) as year (year)}
				<text class="tick" x={ox(year)} y="62" text-anchor="middle">{year}</text>
			{/each}
		</svg>
	{/if}

	<div class="chart" bind:clientWidth={width}>
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
						<text class="row-count" x="28" y={middle + 12}>{row.count.toLocaleString('en-US')}</text>
					{/if}
					<line class="row-line" x1={labelWidth} x2={width - right} y1={middle} y2={middle} />
					{#each row.bars as bar (bar.start)}
						{@const height = barHeight(bar.count, row)}
						{@const left = Math.max(labelWidth, x(bar.start))}
						{@const barWidth = Math.max(1.5, Math.min(width - right, x(bar.start + bar.width)) - left - 1)}
						<rect class="bar" x={left} y={middle + (rowHeight - 12) / 2 - height} width={barWidth} height={height} rx="1" />
						{#if bar.peacemaking > 0}
							<rect class="peacemaking" x={left} y={middle + (rowHeight - 12) / 2 + 2} width={barWidth} height="3" />
						{/if}
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
			{#each ticks as year (year)}
				<line class="axis" x1={x(year)} x2={x(year)} y1={chartHeight - axisHeight} y2={chartHeight - axisHeight + 4} />
				<text class="tick" x={x(year)} y={chartHeight - 5} text-anchor="middle">{year}</text>
			{/each}
		</svg>
		{#if active}
			{@const entry = active.entry}
			{@const Icon = icons[entry.kind]}
			<div class="card kind-{entry.kind}" style:left="{active.left}px" style:top="{active.top}px" role="group" aria-label={entry.title}>
				<p class="card-kind"><Icon size={16} aria-hidden="true" /> {kindLabels[entry.kind]} · {timelineDate(entry.date)}</p>
				<p class="card-title">{#if entry.italic}<i>{entry.title}</i>{:else}{entry.title}{/if}{#if entry.citation}, {entry.citation}{/if}</p>
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
							<Link size={18} aria-hidden="true" />
						</button>
						<button type="button" class="icon-button close" aria-label="Close" title="Close" onclick={() => (active = undefined)}>
							<X size={18} aria-hidden="true" />
						</button>
					</div>
					<p class="card-status small" role="status">{copied}</p>
				{/if}
			</div>
		{/if}
	</div>
	<p class="key small muted" aria-hidden="true">
		<span><svg width="12" height="12"><circle class="key-mark" cx="6" cy="6" r="5" /></svg> Exact date</span>
		<span><svg width="12" height="12"><circle class="key-mark partial" cx="6" cy="6" r="4.5" /></svg> Year or month only</span>
		{#if opinions.some((year) => year.peacemaking > 0)}
			<span><svg width="16" height="8"><rect class="peacemaking" y="5" width="16" height="3" /></svg> Mention peacemaking</span>
		{/if}
		{#if entries.some((entry) => entry.context)}
			<span><svg width="12" height="12"><rect class="key-context" x="2" y="2" width="8" height="8" transform="rotate(45 6 6)" /></svg> Applies to every nation</span>
		{/if}
	</p>

	<div class="list">
		{#each groups as group (group.era.name)}
			<div class="era-heading">
				<svelte:element this={`h${headingLevel}`}>{group.era.name}</svelte:element>
				<span class="muted small">{group.era.years}</span>
				{#if historyPublished}
					<a class="small history" href="{historyEssayPath}#{group.era.anchor}">The history of this era</a>
				{/if}
			</div>
			<ol class="entries">
				{#each group.entries as entry (entry.id)}
					{@render row(entry)}
				{/each}
				{#each [...group.aggregated.entries()] as [kind, list] (kind)}
					{@const Icon = icons[kind]}
					{@const key = `${group.era.name}|${kind}`}
					<li class="entry kind-{kind}">
						<span class="date">{Math.floor(yearOf(list[0].date))}–{Math.floor(yearOf(list.at(-1)!.date))}</span>
						<span class="icon"><Icon size={16} aria-hidden="true" /></span>
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
					<li class="entry kind-opinion">
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
							{#if counts.peacemaking > 0}
								<span class="detail">{plural(counts.peacemaking, 'mentions', 'mention')} peacemaking</span>
							{/if}
						</span>
					</li>
				{/if}
			</ol>
		{/each}
	</div>
</div>

{#snippet row(entry: TimelineEntry)}
	{@const Icon = icons[entry.kind]}
	<li class="entry kind-{entry.kind}" id="timeline-{entry.id}">
		<span class="date">{timelineDate(entry.date)}</span>
		<span class="icon"><Icon size={16} aria-hidden="true" /><span class="visually-hidden">{kindLabels[entry.kind]}:</span></span>
		<span class="what">
			{#if entry.link}<a href={entry.link} rel={external(entry.link) ? 'noopener' : undefined}>{#if entry.italic}<i>{entry.title}</i>{:else}{entry.title}{/if}</a>{:else if entry.italic}<i>{entry.title}</i>{:else}{entry.title}{/if}{#if entry.citation}, {entry.citation}{/if}<CitationMarks marks={entry.citations} />
			{#if entry.detail}<span class="detail">{entry.detail}</span>{/if}
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

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: var(--space-3) 0 0;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.25rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		background: var(--color-surface-raised);
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
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

	.peacemaking {
		fill: var(--color-action);
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

	.card-actions .close {
		margin-left: auto;
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
	 * An entry's title is a link, so markers right after it have little plain text around them, and WCAG 2.5.8 (target size) applies to each: each gets a 24px box, as in the services list.
	 */
	.entry :global(.note-marker) {
		display: inline-block;
		min-width: 24px;
		min-height: 24px;
		text-align: center;
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

	:target {
		background: var(--color-notice-background);
	}

	@media (max-width: 36rem) {
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
