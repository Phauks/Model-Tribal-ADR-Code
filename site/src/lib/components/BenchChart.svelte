<!--
	@component
	Who sat on the Supreme Court, and when, with the cases on this site they
	decided: a row for each Justice with a bar for their service, and above
	the bars a strip with a diamond for each case, filled when the Court was
	unanimous and hollow when it was divided, stacked where cases fall close
	together. No case names are written on the chart, where many would stack
	(Trevor, Nov. 23, 2026: "remove names there").

	Pointing at a case, moving to it with the keyboard or tapping it opens a
	card with its name, citation, date and outcome and how each Justice voted,
	and draws one line down through the bench with each Justice's vote on
	their bar: a dot for the majority, a cross for a dissent, a dash for took
	no part, ringed where the Justice wrote an opinion (Trevor, Nov. 27, 2026:
	"while hovering over a case, showcase the name of the case, show which
	justices were involved"). The cases take one stop in the tab order; the
	arrow keys move between them, Enter opens the case and Escape closes the
	card. On a narrow screen the card is a sheet along the bottom.

	A bar above the chart steps through the cases one at a time, earlier and
	later (CaseStepper; Trevor, Nov. 27, 2026: "a nav bar for the judicial
	timelines so that you can navigate through each case as they go by"). Its
	case stays drawn down through the bench until another is chosen, and it
	stays in view while the chart does.

	On a Justice's page (`self`), each diamond is that Justice's own vote
	instead, with the totals in the key.

	Use:
	<BenchChart rows={data.bench} start={data.start} end={data.end} cases={data.chartCases} allLink />
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { outcomeText, type BenchVote, type ChartCase } from '#lib/bench-chart.ts';
	import { surname } from '#lib/case-opinions.ts';
	import CaseDiamond from './CaseDiamond.svelte';
	import CaseStepper from './CaseStepper.svelte';
	import CaseVoteCard from './CaseVoteCard.svelte';
	import CountBadge from './CountBadge.svelte';
	import VoteMark from './VoteMark.svelte';

	interface Row {
		name: string;
		/** The Justice's key, which each case's votes carry too. */
		person: string;
		role: string;
		from: string;
		to: string;
		/** The Justice's page, when the name should open it. */
		link?: string;
	}

	interface Props {
		rows: Row[];
		start: string;
		end: string;
		cases?: ChartCase[];
		/** On a Justice's own page: that Justice's key. Each diamond is then their own vote. */
		self?: string;
		/** Link to the Supreme Court timeline beside the key. */
		allLink?: boolean;
		/** The drawing's width in its own units: smaller draws the type larger in a narrow column. */
		width?: number;
		/** Room for the names on the left. */
		labelWidth?: number;
	}

	let { rows, start, end, cases = [], self, allLink = false, width = 760, labelWidth = 170 }: Props = $props();

	const rowHeight = 24;
	const tickRow = 24;
	const right = 14;
	const cardId = $props.id();

	/** A date as a fractional year, so bars start and stop on the day. */
	function yearValue(date: string): number {
		const [year, month = 1, day = 1] = date.split('-').map(Number);
		return year + (month - 1) / 12 + (day - 1) / 365;
	}

	const first = $derived(yearValue(start));
	const last = $derived(yearValue(end));
	const span = $derived(Math.max(last - first, 0.1));
	const x = (date: string) => labelWidth + ((yearValue(date) - first) / span) * (width - labelWidth - right);

	const marked = $derived(cases.filter((item) => item.decided && item.decided >= start && item.decided <= end));

	/** Each case's place in the strip: cases closer than `gap` stack upward. */
	const gap = $derived(self ? 13 : 11);
	const levelHeight = $derived(self ? 14 : 11);
	const placed = $derived.by(() => {
		const levelEnds: number[] = [];
		return marked.map((item) => {
			const cx = x(item.decided!);
			let level = levelEnds.findIndex((lastX) => cx - lastX >= gap);
			if (level === -1) level = levelEnds.length;
			levelEnds[level] = cx;
			return { item, cx, level };
		});
	});
	const levels = $derived(Math.max(1, ...placed.map((entry) => entry.level + 1)));
	const railHeight = $derived(marked.length ? levels * levelHeight + 8 : 0);
	const railBottom = $derived(tickRow + railHeight - 4);
	const top = $derived(tickRow + railHeight + 4);
	const height = $derived(top + rows.length * rowHeight + 6);
	const markY = (level: number) => railBottom - level * levelHeight - levelHeight / 2 + 2;

	/** Tick years: every 10, 5, 2 or 1 years, whichever gives a handful. */
	const ticks = $derived.by(() => {
		const step = span > 50 ? 10 : span > 12 ? 5 : span > 4 ? 2 : 1;
		const years: number[] = [];
		for (let year = Math.ceil(first / step) * step; year <= last; year += step) years.push(year);
		return years;
	});
	const tickX = (year: number) => labelWidth + ((year - first) / span) * (width - labelWidth - right);

	/** This Justice's own vote in a case, on their own page. */
	const ownVote = (item: ChartCase) => item.votes.find((vote) => vote.person === self);

	const counts = $derived.by(() => {
		const own = marked.map(ownVote).filter((vote) => vote !== undefined);
		return {
			majority: own.filter((vote) => vote.vote === 'majority').length,
			dissent: own.filter((vote) => vote.vote === 'dissent').length,
			wrote: own.filter((vote) => vote.wrote).length,
			other: own.filter((vote) => vote.vote === 'none' || vote.vote === 'unknown').length
		};
	});

	/* The chosen case ------------------------------------------------------- */

	let chosen = $state<number | undefined>();
	/** The case the bar above the chart is on, which stays marked when a card closes. */
	let stepped = $state<number | undefined>();
	/** How the card was opened: a pointer resting on the mark, keyboard focus, or a click or tap that keeps it. */
	let how = $state<'hover' | 'focus' | 'kept'>('hover');
	/** Which mark takes the tab stop. */
	let current = $state(0);
	let anchor = $state<{ left: number; right: number; top: number; bottom: number }>();
	let narrow = $state(false);
	let svg = $state<SVGSVGElement>();
	let frame = $state<HTMLDivElement>();
	let closing: ReturnType<typeof setTimeout> | undefined;

	const onBar = $derived(stepped !== undefined && stepped < placed.length ? stepped : undefined);
	/** The case drawn down through the bench: the card's, or else the bar's. */
	const marking = $derived(chosen ?? onBar);
	const active = $derived(marking === undefined ? undefined : placed[marking]);
	const carded = $derived(chosen === undefined ? undefined : placed[chosen]);

	function place() {
		if (!carded || !svg) return;
		const box = svg.getBoundingClientRect();
		const scale = box.width / width;
		const left = box.left + carded.cx * scale;
		anchor = { left, right: left, top: box.top + (top - 2) * scale, bottom: box.top + height * scale };
	}

	function open(index: number, by: typeof how) {
		clearTimeout(closing);
		chosen = index;
		current = index;
		how = by;
		if (by !== 'hover') stepped = index;
		place();
	}

	/** The bar moved: mark that case, close any card, and bring it into view where the chart scrolls sideways. */
	function onStep(index: number) {
		close();
		stepped = index;
		current = index;
		const entry = placed[index];
		if (!frame || !svg || !entry) return;
		const scale = svg.getBoundingClientRect().width / width;
		const at = entry.cx * scale;
		if (at < frame.scrollLeft + 40 || at > frame.scrollLeft + frame.clientWidth - 40) frame.scrollLeft = at - frame.clientWidth / 2;
	}

	function close() {
		clearTimeout(closing);
		chosen = undefined;
	}

	/** A short wait before closing a pointed-at card, so the pointer can move onto it. */
	function closeSoon() {
		clearTimeout(closing);
		if (how === 'hover') closing = setTimeout(close, 150);
	}

	function markElement(index: number): SVGElement | null {
		return svg?.querySelector(`[data-index="${index}"]`) ?? null;
	}

	function step(by: number) {
		const next = Math.min(Math.max((chosen ?? current) + by, 0), placed.length - 1);
		open(next, how === 'hover' ? 'kept' : how);
		if (how === 'focus') markElement(next)?.focus();
	}

	function onKey(event: KeyboardEvent, index: number) {
		const moves: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
		if (event.key in moves) {
			event.preventDefault();
			const next = Math.min(Math.max(index + moves[event.key], 0), placed.length - 1);
			markElement(next)?.focus();
		} else if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			markElement(event.key === 'Home' ? 0 : placed.length - 1)?.focus();
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			const link = placed[index].item.link;
			if (link) location.assign(link);
		} else if (event.key === 'Escape') {
			close();
		}
	}

	function onBlur(event: FocusEvent) {
		const next = event.relatedTarget as Element | null;
		if (how === 'focus' && !next?.closest?.('.case-vote-card, .bench-chart .case')) close();
	}

	onMount(() => {
		const query = window.matchMedia('(max-width: 40rem)');
		narrow = query.matches;
		const onQuery = () => (narrow = query.matches);
		query.addEventListener('change', onQuery);
		const onMove = () => place();
		const onDown = (event: PointerEvent) => {
			const target = event.target as Element | null;
			if (chosen !== undefined && how === 'kept' && !target?.closest?.('.case-vote-card, .bench-chart .case')) close();
		};
		const onEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && chosen !== undefined) close();
		};
		window.addEventListener('scroll', onMove, { passive: true, capture: true });
		window.addEventListener('resize', onMove);
		document.addEventListener('pointerdown', onDown);
		document.addEventListener('keydown', onEscape);
		return () => {
			query.removeEventListener('change', onQuery);
			window.removeEventListener('scroll', onMove, { capture: true });
			window.removeEventListener('resize', onMove);
			document.removeEventListener('pointerdown', onDown);
			document.removeEventListener('keydown', onEscape);
			clearTimeout(closing);
		};
	});

	/** The chosen case's vote for a row, when the row's Justice was serving that day. */
	function voteOnRow(row: Row): { vote: BenchVote; wrote: boolean } | undefined {
		if (!active) return undefined;
		const day = active.item.decided!;
		if (row.from > day || row.to < day) return undefined;
		const vote = active.item.votes.find((each) => each.person === row.person);
		return vote ? { vote: vote.vote, wrote: Boolean(vote.wrote) } : undefined;
	}

	function label(item: ChartCase): string {
		const own = self ? ownVote(item) : undefined;
		const ownWords = own ? `, ${own.vote === 'majority' ? 'with the majority' : own.vote === 'dissent' ? 'dissented' : own.vote === 'none' ? 'took no part' : 'vote not recorded'}` : '';
		return `${item.name}, ${item.decidedText ?? ''}, ${outcomeText(item)}${ownWords}`;
	}
</script>

<figure class="bench-chart">
	{#if placed.length > 0}
		<div class="bar-holder">
			<CaseStepper cases={placed.map((entry) => entry.item)} index={onBar} onmove={onStep} showCourt={!self} />
		</div>
	{/if}
	<div class="frame" bind:this={frame}>
		<!-- Narrow drawings may shrink as far as wide ones, scale for scale, before the frame scrolls. -->
		<svg bind:this={svg} viewBox="0 0 {width} {height}" width="100%" style:min-width="{(width * 34) / 760}rem" role="group" aria-label="Cases on this site, by date">
			<g aria-hidden="true">
				{#each ticks as year}
					<line class="grid" x1={tickX(year)} x2={tickX(year)} y1={tickRow - 4} y2={height - 4} />
					<text class="tick" x={tickX(year)} y={tickRow - 10} text-anchor={tickX(year) > width - right - 16 ? 'end' : 'middle'}>{year}</text>
				{/each}
				{#if marked.length}
					<line class="rail-base" x1={labelWidth} x2={width - right} y1={top - 4} y2={top - 4} />
				{/if}
				{#each rows as row, index (row.person + row.role + row.from)}
					{@const y = top + index * rowHeight}
					{#if row.link}
						<a href={row.link} tabindex="-1" class="name-link">
							<text class="name" class:chief={row.role === 'Chief Justice'} x={labelWidth - 10} y={y + rowHeight / 2 + 4} text-anchor="end">{surname(row.name)}</text>
						</a>
					{:else}
						<text class="name" class:chief={row.role === 'Chief Justice'} x={labelWidth - 10} y={y + rowHeight / 2 + 4} text-anchor="end">{surname(row.name)}</text>
					{/if}
					<rect class="bar" class:chief={row.role === 'Chief Justice'} x={x(row.from)} y={y + 5} width={Math.max(x(row.to) - x(row.from), 2)} height={rowHeight - 10} rx="3" />
				{/each}
				{#if active && !self}
					<line class="cursor" x1={active.cx} x2={active.cx} y1={markY(active.level) - 4} y2={height - 4} />
				{/if}
			</g>
			{#each placed as entry, index (entry.item.key)}
				{@const cy = markY(entry.level)}
				{@const isActive = marking === index}
				{@const own = self ? ownVote(entry.item) : undefined}
				<!-- svelte-ignore a11y_click_events_have_key_events -- the keys are handled in onkeydown -->
				<g
					class="case"
					data-index={index}
					role="button"
					tabindex={index === current ? 0 : -1}
					aria-label={label(entry.item)}
					aria-expanded={chosen === index}
					aria-controls={chosen === index ? cardId : undefined}
					onpointerenter={(event) => {
						if (event.pointerType === 'mouse' && how !== 'kept') open(index, 'hover');
					}}
					onpointerleave={(event) => {
						if (event.pointerType === 'mouse') closeSoon();
					}}
					onclick={() => (isActive && how === 'kept' ? close() : open(index, 'kept'))}
					onfocus={() => {
						if (how !== 'kept' || chosen !== index) open(index, 'focus');
					}}
					onblur={onBlur}
					onkeydown={(event) => onKey(event, index)}
				>
					<!-- A wider target than the mark itself, and the site's focus look (yellow with an ink ring) behind it. -->
					<rect class="hit" x={entry.cx - gap / 2} y={cy - levelHeight / 2} width={gap} height={levelHeight} />
					<circle class="focus" cx={entry.cx} {cy} r="9.5" />
					{#if self}
						<VoteMark vote={own?.vote ?? 'unknown'} cx={entry.cx} cy={cy} size={0.8} wrote={Boolean(own?.wrote)} />
						{#if isActive}<circle class="chosen-ring" cx={entry.cx} {cy} r="10" />{/if}
					{:else}
						<CaseDiamond cx={entry.cx} {cy} size={isActive ? 6.5 : 5} divided={entry.item.outcome === 'divided' || entry.item.outcome === 'equally divided'} active={isActive} />
					{/if}
				</g>
			{/each}
			{#if active && !self}
				{#each rows as row, index (row.person + row.role + row.from)}
					{@const vote = voteOnRow(row)}
					{#if vote}
						<VoteMark vote={vote.vote} cx={active.cx} cy={top + index * rowHeight + rowHeight / 2} wrote={vote.wrote} />
					{/if}
				{/each}
			{/if}
		</svg>
	</div>
	{#if marked.length > 0}
		<p class="key small">
			{#if self}
				<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><VoteMark vote="majority" cx={8} cy={8} size={0.95} /></svg> Majority <CountBadge count={counts.majority} /></span>
				<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><VoteMark vote="dissent" cx={8} cy={8} size={0.95} /></svg> Dissent <CountBadge count={counts.dissent} /></span>
				<span><svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true"><VoteMark vote="majority" cx={10} cy={8} size={0.75} wrote /></svg> Wrote an opinion <CountBadge count={counts.wrote} /></span>
				{#if counts.other > 0}
					<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><VoteMark vote="none" cx={8} cy={8} size={0.95} /></svg> Took no part or not recorded <CountBadge count={counts.other} /></span>
				{/if}
			{:else}
				<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><CaseDiamond cx={8} cy={8} size={5.5} /></svg> Unanimous</span>
				<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><CaseDiamond cx={8} cy={8} size={5.5} divided /></svg> Divided</span>
				<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><VoteMark vote="majority" cx={8} cy={8} size={0.95} /></svg> Majority</span>
				<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><VoteMark vote="dissent" cx={8} cy={8} size={0.95} /></svg> Dissent</span>
				<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><VoteMark vote="none" cx={8} cy={8} size={0.95} /></svg> Took no part</span>
				<span><svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true"><VoteMark vote="majority" cx={10} cy={8} size={0.75} wrote /></svg> Wrote an opinion</span>
			{/if}
			{#if allLink}
				<a class="all" href="/supreme-court/timeline">All cases</a>
			{/if}
		</p>
	{/if}
	{#if carded}
		<CaseVoteCard
			id={cardId}
			item={carded.item}
			anchor={narrow ? undefined : anchor}
			sheet={narrow}
			position="{(chosen ?? 0) + 1} of {placed.length}"
			onstep={step}
			onclose={close}
			onpointerenter={() => clearTimeout(closing)}
			onpointerleave={closeSoon}
		/>
	{/if}
</figure>

<style>
	.bench-chart {
		position: relative;
		margin: var(--space-3) 0 var(--space-4);
	}

	.frame {
		overflow-x: auto;
	}

	/* Held in view while the chart is, under the masthead. */
	.bar-holder {
		position: sticky;
		top: calc(var(--masthead-stuck, 0px) + var(--space-2));
		z-index: 2;
		margin-bottom: var(--space-2);
	}

	/* Below the Menu strip, which stays at the top on narrower screens. */
	@media (max-width: 63.99rem) {
		.bar-holder {
			top: calc(var(--masthead-stuck, 0px) + var(--layout-target-minimum) + 1px + var(--space-1));
		}
	}

	svg {
		display: block;
		font-family: inherit;
		overflow: visible;
	}

	.grid {
		stroke: var(--color-line);
		stroke-width: 1;
	}

	.rail-base {
		stroke: var(--color-line);
		stroke-width: 1;
	}

	.tick {
		fill: var(--color-ink-muted);
		font-size: 12px;
	}

	.name {
		fill: var(--color-ink);
		font-size: 13px;
	}

	.name.chief {
		font-weight: 700;
	}

	.name-link .name {
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, var(--color-link) 60%, transparent);
	}

	.bar {
		fill: var(--color-link);
		opacity: 0.75;
	}

	.bar.chief {
		fill: var(--color-action);
		opacity: 1;
	}

	.cursor {
		stroke: var(--color-ink);
		stroke-width: 1.5;
	}

	.case {
		cursor: pointer;
		outline: none;
	}

	.case .hit {
		fill: transparent;
	}

	.chosen-ring {
		fill: none;
		stroke: var(--color-ink);
		stroke-width: 2.5;
	}

	.case .focus {
		fill: none;
	}

	.case:focus-visible .focus {
		fill: none;
		stroke: var(--focus-ring);
		stroke-width: 3;
	}

	.key {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-4);
		margin: var(--space-2) 0 0;
		color: var(--color-ink-muted);
	}

	.key span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.key svg {
		overflow: visible;
	}

	.key :global(.count-badge) {
		margin-left: 0;
		color: var(--color-ink);
	}

	.all {
		margin-left: auto;
	}

	@media (forced-colors: active) {
		.bar,
		.bar.chief {
			fill: CanvasText;
		}

		.cursor,
		.grid,
		.rail-base,
		.chosen-ring {
			stroke: CanvasText;
		}
	}
</style>
