<script lang="ts">
	// Every Supreme Court case on this site on one timeline, down the page by
	// default (Trevor, Nov. 27, 2026: "we should enable having one timeline
	// for all cases as well"), as in the approved mockup
	// (design/justice-timelines): a heading for each Court, and for each case
	// its date, a diamond (filled when the Court was unanimous, hollow when it
	// was divided), its name and citation, a mark for each Justice's vote, the
	// tally and who wrote for the Court and in dissent. Pointing at a case's
	// diamond, moving to it with the keyboard or tapping it opens the same card
	// as the bench charts. Filters by Court, outcome and Justice and a search
	// by name are kept in the address (?court=, ?outcome=, ?justice=, ?q=), as
	// are newest first (?order=newest) and the across view (?view=across),
	// which draws every Justice's service as the Court pages' bench chart.
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import ArrowDownUp from '@lucide/svelte/icons/arrow-down-up';
	import Funnel from '@lucide/svelte/icons/funnel';
	import MoveHorizontal from '@lucide/svelte/icons/move-horizontal';
	import MoveVertical from '@lucide/svelte/icons/move-vertical';
	import Search from '@lucide/svelte/icons/search';
	import { outcomeText, writersText, type ChartCase } from '#lib/bench-chart.ts';
	import BenchChart from '#lib/components/BenchChart.svelte';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CaseDiamond from '#lib/components/CaseDiamond.svelte';
	import CaseVoteCard from '#lib/components/CaseVoteCard.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import SearchableDropdown from '#lib/components/SearchableDropdown.svelte';
	import VoteMark from '#lib/components/VoteMark.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Outcome = 'unanimous' | 'divided' | 'unknown';
	const outcomes: { value: Outcome; label: string }[] = [
		{ value: 'unanimous', label: 'Unanimous' },
		{ value: 'divided', label: 'Divided' },
		{ value: 'unknown', label: 'Tally not recorded' }
	];
	const outcomeOf = (item: ChartCase): Outcome => (item.outcome === 'unanimous' ? 'unanimous' : item.outcome === 'unknown' ? 'unknown' : 'divided');

	let query = $state('');
	let shownCourts = $state<string[] | undefined>();
	let shownOutcomes = $state<Outcome[] | undefined>();
	let justice = $state('');
	let newestFirst = $state(false);
	let across = $state(false);
	let filtersOpen = $state(false);
	let ready = $state(false);

	const courtNames = $derived(data.courts.map((court) => court.name));
	const visibleCourts = $derived(shownCourts ?? courtNames);
	const visibleOutcomes = $derived(shownOutcomes ?? outcomes.map((each) => each.value));

	/** Every Justice who sat in a case here, in the order they first did. */
	const justiceChoices = $derived.by(() => {
		const seen = new Map<string, string>();
		for (const item of data.cases) for (const vote of item.votes) if (!seen.has(vote.person)) seen.set(vote.person, vote.name);
		return [{ value: '', label: 'All Justices' }, ...[...seen.entries()].map(([value, name]) => ({ value, label: name, keywords: [value.replace(/-/g, ' ')] }))];
	});

	const words = $derived(query.trim().toLocaleLowerCase('en-US'));
	const matching = $derived(
		data.cases.filter(
			(item) =>
				visibleCourts.includes(item.court) &&
				visibleOutcomes.includes(outcomeOf(item)) &&
				(!justice || item.votes.some((vote) => vote.person === justice)) &&
				(!words || `${item.name} ${item.citation}`.toLocaleLowerCase('en-US').includes(words))
		)
	);
	const ordered = $derived(newestFirst ? [...matching].reverse() : matching);
	const groups = $derived.by(() => {
		const found: { court: (typeof data.courts)[number]; cases: ChartCase[] }[] = [];
		for (const item of ordered) {
			const last = found.at(-1);
			if (last?.court.name === item.court) last.cases.push(item);
			else found.push({ court: data.courts.find((court) => court.name === item.court) ?? { name: item.court, start: '', end: undefined, link: undefined }, cases: [item] });
		}
		return found;
	});
	const counts = $derived({
		courts: Object.fromEntries(courtNames.map((name) => [name, data.cases.filter((item) => item.court === name).length])),
		outcomes: Object.fromEntries(outcomes.map(({ value }) => [value, data.cases.filter((item) => outcomeOf(item) === value).length]))
	});
	const years = $derived(matching.length ? `${matching[0].decided?.slice(0, 4)}–${matching.at(-1)!.decided?.slice(0, 4)}` : '');

	function toggle<Value>(list: Value[], all: Value[], value: Value): Value[] | undefined {
		const next = list.includes(value) ? list.filter((each) => each !== value) : all.filter((each) => list.includes(each) || each === value);
		return next.length === all.length ? undefined : next;
	}

	const dateText = (item: ChartCase) => item.decidedText ?? '';

	/* The card ----------------------------------------------------------------- */

	let chosen = $state<string | undefined>();
	let how = $state<'hover' | 'focus' | 'kept'>('hover');
	let current = $state<string | undefined>();
	let anchor = $state<{ left: number; right: number; top: number; bottom: number }>();
	let narrow = $state(false);
	let closing: ReturnType<typeof setTimeout> | undefined;
	const chosenCase = $derived(chosen ? ordered.find((item) => item.key === chosen) : undefined);
	const tabStop = $derived(current && ordered.some((item) => item.key === current) ? current : ordered[0]?.key);

	function markOf(key: string): HTMLElement | null {
		return document.querySelector(`.supreme-timeline [data-case="${CSS.escape(key)}"]`);
	}

	function place() {
		if (!chosen) return;
		const mark = markOf(chosen);
		const row = mark?.closest('.case-row')?.querySelector('.case-title');
		if (!mark || !row) return;
		const box = mark.getBoundingClientRect();
		const title = row.getBoundingClientRect();
		// Under the case's first line, a little in from its name, so the name stays in view.
		anchor = { left: title.left + 60 - 16 - 320, right: title.left + 44, top: box.bottom + 34, bottom: box.bottom + 34 };
	}

	function open(key: string, by: typeof how) {
		clearTimeout(closing);
		chosen = key;
		current = key;
		how = by;
		place();
	}

	function close() {
		clearTimeout(closing);
		chosen = undefined;
	}

	function closeSoon() {
		clearTimeout(closing);
		if (how === 'hover') closing = setTimeout(close, 150);
	}

	function step(by: number) {
		const index = ordered.findIndex((item) => item.key === (chosen ?? current));
		const next = ordered[Math.min(Math.max(index + by, 0), ordered.length - 1)];
		if (!next) return;
		markOf(next.key)?.scrollIntoView({ block: 'nearest' });
		open(next.key, how === 'hover' ? 'kept' : how);
		if (how === 'focus') markOf(next.key)?.focus();
	}

	function onKey(event: KeyboardEvent, key: string) {
		const index = ordered.findIndex((item) => item.key === key);
		const moves: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
		if (event.key in moves) {
			event.preventDefault();
			const next = ordered[Math.min(Math.max(index + moves[event.key], 0), ordered.length - 1)];
			if (next) markOf(next.key)?.focus();
		} else if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			const next = event.key === 'Home' ? ordered[0] : ordered.at(-1);
			if (next) markOf(next.key)?.focus();
		} else if (event.key === 'Escape') {
			close();
		}
	}

	function onBlur(event: FocusEvent) {
		const next = event.relatedTarget as Element | null;
		if (how === 'focus' && !next?.closest?.('.case-vote-card, .case-mark')) close();
	}

	/* The overview: the Courts and the cases each year, down the page ------------ */

	const firstYear = 1800;
	const lastYear = $derived(Math.max(2026, Number(data.cases.at(-1)?.decided?.slice(0, 4) ?? 2026)));
	/** As tall as the window allows, up to 760 pixels, so it stays in view beside the list. */
	let overviewHeight = $state(760);
	const yearY = (year: number) => ((year - firstYear) / (lastYear - firstYear)) * overviewHeight;
	const perYear = $derived.by(() => {
		const found = new Map<number, number>();
		for (const item of matching) {
			const year = Number(item.decided?.slice(0, 4));
			if (year) found.set(year, (found.get(year) ?? 0) + 1);
		}
		return found;
	});
	const most = $derived(Math.max(1, ...perYear.values()));
	let inView = $state<{ from: number; to: number } | undefined>();

	function measureView() {
		const rows = [...document.querySelectorAll<HTMLElement>('.supreme-timeline .case-row')];
		const seen = rows.filter((row) => {
			const box = row.getBoundingClientRect();
			return box.bottom > 0 && box.top < window.innerHeight;
		});
		if (seen.length === 0) return (inView = undefined);
		const yearsSeen = seen.map((row) => Number(row.dataset.year)).filter(Boolean);
		inView = { from: Math.min(...yearsSeen), to: Math.max(...yearsSeen) + 1 };
	}

	/** Pressing the overview scrolls to the first case of that year or after. */
	function jump(event: MouseEvent) {
		const box = (event.currentTarget as SVGElement).getBoundingClientRect();
		const year = firstYear + ((event.clientY - box.top) / overviewHeight) * (lastYear - firstYear);
		const target = (newestFirst ? [...ordered].reverse() : ordered).find((item) => Number(item.decided?.slice(0, 4)) >= year) ?? ordered.at(-1);
		if (target) markOf(target.key)?.closest('.case-row')?.scrollIntoView({ block: 'center' });
	}

	/* The across view: the bench chart for every Justice in the cases shown -------- */

	const acrossRows = $derived.by(() => {
		const rows = new Map<string, { name: string; person: string; role: string; from: string; to: string; link: string }>();
		for (const item of matching) {
			for (const vote of item.votes) {
				const day = item.decided!;
				const key = `${vote.person}|${vote.chief ? 'c' : 'a'}`;
				const row = rows.get(key);
				if (row) {
					if (day < row.from) row.from = day;
					if (day > row.to) row.to = day;
				} else rows.set(key, { name: vote.name, person: vote.person, role: vote.chief ? 'Chief Justice' : 'Associate Justice', from: day, to: day, link: vote.link });
			}
		}
		return [...rows.values()].sort((first, second) => first.from.localeCompare(second.from));
	});

	onMount(() => {
		const params = new URLSearchParams(location.search);
		query = params.get('q') ?? '';
		const askedCourts = (params.get('court') ?? '').split(',').filter((name) => courtNames.includes(name));
		if (askedCourts.length) shownCourts = askedCourts;
		const askedOutcomes = (params.get('outcome') ?? '').split(',').filter((value): value is Outcome => outcomes.some((each) => each.value === value));
		if (askedOutcomes.length) shownOutcomes = askedOutcomes;
		const askedJustice = params.get('justice') ?? '';
		if (justiceChoices.some((choice) => choice.value === askedJustice)) justice = askedJustice;
		newestFirst = params.get('order') === 'newest';
		across = params.get('view') === 'across';
		ready = true;

		const media = window.matchMedia('(max-width: 40rem)');
		narrow = media.matches;
		const onMedia = () => (narrow = media.matches);
		media.addEventListener('change', onMedia);
		const fit = () => (overviewHeight = Math.max(320, Math.min(window.innerHeight - 110, 760)));
		fit();
		const onScroll = () => {
			place();
			measureView();
		};
		const onResize = () => {
			fit();
			onScroll();
		};
		const onDown = (event: PointerEvent) => {
			const target = event.target as Element | null;
			if (chosen && how === 'kept' && !target?.closest?.('.case-vote-card, .case-mark')) close();
		};
		const onEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && chosen) close();
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onResize);
		document.addEventListener('pointerdown', onDown);
		document.addEventListener('keydown', onEscape);
		requestAnimationFrame(measureView);
		return () => {
			media.removeEventListener('change', onMedia);
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onResize);
			document.removeEventListener('pointerdown', onDown);
			document.removeEventListener('keydown', onEscape);
		};
	});

	// The view in the address, so it can be shared.
	$effect(() => {
		if (!ready) return;
		const params = new URLSearchParams();
		if (query.trim()) params.set('q', query.trim());
		if (shownCourts) params.set('court', shownCourts.join(','));
		if (shownOutcomes) params.set('outcome', shownOutcomes.join(','));
		if (justice) params.set('justice', justice);
		if (newestFirst) params.set('order', 'newest');
		if (across) params.set('view', 'across');
		const url = new URL(location.href);
		url.search = params.toString();
		if (url.href !== location.href) replaceState(url, {});
	});

	$effect(() => {
		void ordered;
		void across;
		requestAnimationFrame(measureView);
	});

	const filterCount = $derived([query.trim(), shownCourts, shownOutcomes, justice].filter(Boolean).length);
</script>

<svelte:head>
	<title>Timeline · Supreme Court · Tribal Law Project</title>
	<meta name="description" content="Every Supreme Court case on this site on one timeline, from {data.cases[0]?.decided?.slice(0, 4)} to the present, with how each Justice voted." />
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Library', href: '/library' },
		{ label: 'Supreme Court', href: '/supreme-court' }
	]}
	current="Timeline"
/>
<h1>Timeline</h1>

<div class="layout supreme-timeline">
	<div class="phone-bar no-print">
		<span class="search">
			<Search size={18} aria-hidden="true" />
			<input type="search" placeholder="Find a case" aria-label="Find a case" bind:value={query} />
		</span>
		<button class="button button-quiet" type="button" aria-expanded={filtersOpen} aria-controls="supreme-timeline-filters" onclick={() => (filtersOpen = !filtersOpen)}>
			<Funnel size={20} aria-hidden="true" />
			<span>Filters{filterCount > 0 ? ` (${filterCount})` : ''}</span>
		</button>
	</div>
	<form class="filters no-print" class:open={filtersOpen} id="supreme-timeline-filters" onsubmit={(event) => event.preventDefault()} aria-label="Filters">
		<div class="filter wide-only">
			<label for="supreme-timeline-search" class="visually-hidden">Find a case</label>
			<span class="search">
				<Search size={18} aria-hidden="true" />
				<input id="supreme-timeline-search" type="search" placeholder="Find a case" bind:value={query} />
			</span>
		</div>
		<fieldset class="filter">
			<legend>Court</legend>
			{#each courtNames as name (name)}
				<label class="option">
					<input type="checkbox" checked={visibleCourts.includes(name)} onchange={() => (shownCourts = toggle(visibleCourts, courtNames, name))} />
					<span class="name">{name.replace(/ Court$/, '')}</span>
					<span class="count">{counts.courts[name].toLocaleString('en-US')}</span>
				</label>
			{/each}
		</fieldset>
		<fieldset class="filter">
			<legend>Outcome</legend>
			{#each outcomes as { value, label } (value)}
				<label class="option">
					<input
						type="checkbox"
						checked={visibleOutcomes.includes(value)}
						onchange={() =>
							(shownOutcomes = toggle(
								visibleOutcomes,
								outcomes.map((each) => each.value),
								value
							))}
					/>
					<span class="name">{label}</span>
					<span class="count">{counts.outcomes[value].toLocaleString('en-US')}</span>
				</label>
			{/each}
		</fieldset>
		<div class="filter">
			<SearchableDropdown label="Justice" id="supreme-timeline-justice" choices={justiceChoices} bind:value={justice} />
		</div>
	</form>

	<div class="results">
		<div class="head">
			<p class="summary" role="status">{matching.length.toLocaleString('en-US')} {matching.length === 1 ? 'case' : 'cases'}{years ? `, ${years}` : ''}</p>
			<div class="tools no-print">
				<button type="button" class="icon-button" class:on={across} aria-pressed={across} aria-label="Across the page" title="Across the page" onclick={() => (across = true)}>
					<MoveHorizontal size={20} aria-hidden="true" />
				</button>
				<button type="button" class="icon-button" class:on={!across} aria-pressed={!across} aria-label="Down the page" title="Down the page" onclick={() => (across = false)}>
					<MoveVertical size={20} aria-hidden="true" />
				</button>
				{#if !across}
					<button type="button" class="icon-button" class:on={newestFirst} aria-pressed={newestFirst} aria-label="Newest first" title="Newest first" onclick={() => (newestFirst = !newestFirst)}>
						<ArrowDownUp size={20} aria-hidden="true" />
					</button>
				{/if}
			</div>
		</div>

		{#if across}
			{#if acrossRows.length > 0}
				{@const from = matching[0].decided!}
				{@const to = matching.at(-1)!.decided!}
				{@const spanYears = Number(to.slice(0, 4)) - Number(from.slice(0, 4)) + 1}
				<BenchChart rows={acrossRows} start={from} end={to} cases={matching} width={Math.max(760, 170 + spanYears * 14)} />
			{/if}
		{:else}
			<p class="key small">
				<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><CaseDiamond cx={8} cy={8} size={5.5} /></svg> Unanimous</span>
				<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><CaseDiamond cx={8} cy={8} size={5.5} divided /></svg> Divided</span>
				<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><VoteMark vote="majority" cx={8} cy={8} size={0.95} /></svg> Majority</span>
				<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><VoteMark vote="dissent" cx={8} cy={8} size={0.95} /></svg> Dissent</span>
				<span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><VoteMark vote="none" cx={8} cy={8} size={0.95} /></svg> Took no part</span>
				<span><svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true"><VoteMark vote="majority" cx={10} cy={8} size={0.75} wrote /></svg> Wrote an opinion</span>
			</p>
			<div class="body">
				<div class="list">
					{#each groups as group, groupIndex (group.court.name + groupIndex)}
						<section class="court" aria-labelledby="court-{groupIndex}">
							<header class="court-head">
								<h2 id="court-{groupIndex}">{#if group.court.link}<a href={group.court.link}>{group.court.name}</a>{:else}{group.court.name}{/if}</h2>
								{#if group.court.start}<span class="years">{group.court.start.slice(0, 4)} to {group.court.end ? group.court.end.slice(0, 4) : 'today'}</span>{/if}
								<CountBadge count={group.cases.length} label={group.cases.length === 1 ? 'case' : 'cases'} />
							</header>
							<ol class="cases">
								{#each group.cases as item (item.key)}
									{@const writers = writersText(item)}
									<li class="case-row" class:chosen={chosen === item.key} data-year={item.decided?.slice(0, 4)}>
										<span class="date">{dateText(item)}</span>
										<span class="rail">
											<button
												type="button"
												class="case-mark"
												data-case={item.key}
												tabindex={item.key === tabStop ? 0 : -1}
												aria-label="{item.name}, {dateText(item)}, {outcomeText(item)}"
												aria-expanded={chosen === item.key}
												onpointerenter={(event) => {
													if (event.pointerType === 'mouse' && how !== 'kept') open(item.key, 'hover');
												}}
												onpointerleave={(event) => {
													if (event.pointerType === 'mouse') closeSoon();
												}}
												onclick={() => (chosen === item.key && how === 'kept' ? close() : open(item.key, 'kept'))}
												onfocus={() => {
													if (how !== 'kept' || chosen !== item.key) open(item.key, 'focus');
												}}
												onblur={onBlur}
												onkeydown={(event) => onKey(event, item.key)}
											>
												<svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true"><CaseDiamond cx={7} cy={8} size={6.5} divided={item.outcome === 'divided' || item.outcome === 'equally divided'} /></svg>
											</button>
										</span>
										<div class="what">
											<p class="case-title">{#if item.link}<a href={item.link}><i>{item.name}</i></a>{:else}<i>{item.name}</i>{/if}, {item.citation}</p>
											<p class="votes">
												<svg width={item.votes.length * (narrow ? 12 : 14)} height="14" viewBox="0 0 {item.votes.length * (narrow ? 12 : 14)} 14" aria-hidden="true">
													{#each item.votes as vote, index (vote.person)}
														<VoteMark vote={vote.vote} cx={index * (narrow ? 12 : 14) + 7} cy={7} size={0.78} />
													{/each}
												</svg>
												<span>{item.tally ?? 'Tally not recorded'}{writers ? ` · ${writers}` : ''}</span>
											</p>
										</div>
									</li>
								{/each}
							</ol>
						</section>
					{:else}
						<p class="none">No cases match these filters.</p>
					{/each}
				</div>
				<div class="overview no-print" aria-hidden="true">
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -- a shortcut for the pointer; the list itself is the way through by keyboard -->
					<svg width="118" height={overviewHeight + 10} onclick={jump}>
						{#each data.courts as court, index (court.name)}
							{@const from = yearY(Number(court.start.slice(0, 4)))}
							{@const to = yearY(court.end ? Number(court.end.slice(0, 4)) : lastYear)}
							{#if index % 2 === 0}<rect class="band" x="0" y={from} width="118" height={to - from} />{/if}
							{#if to - from > 11}<text class="band-name" x="116" y={(from + to) / 2 + 3} text-anchor="end">{court.name.replace(/ Court$/, '')}</text>{/if}
						{/each}
						{#each [...perYear] as [year, count] (year)}
							<rect class="year" x="0" y={yearY(year)} width={Math.max(2, (count / most) * 52)} height={Math.max(2, overviewHeight / (lastYear - firstYear) - 0.5)} />
						{/each}
						{#each [1800, 1850, 1900, 1950, 2000] as year (year)}
							<text class="tick" x="-6" y={yearY(year) + 3} text-anchor="end">{year}</text>
						{/each}
						{#if inView}
							<rect class="view" x="-3" y={yearY(inView.from) - 3} width="124" height={Math.max(8, yearY(inView.to) - yearY(inView.from) + 6)} rx="3" />
						{/if}
					</svg>
				</div>
			</div>
		{/if}
	</div>
</div>

{#if chosenCase && !across}
	<CaseVoteCard
		item={chosenCase}
		anchor={narrow ? undefined : anchor}
		sheet={narrow}
		showCourt
		position="{ordered.indexOf(chosenCase) + 1} of {ordered.length}"
		onstep={step}
		onclose={close}
		onpointerenter={() => clearTimeout(closing)}
		onpointerleave={closeSoon}
	/>
{/if}

<style>
	.layout {
		display: grid;
		grid-template-columns: 15rem minmax(0, 1fr);
		gap: var(--space-6);
		align-items: start;
	}

	.filters {
		position: sticky;
		top: var(--space-3);
		font-size: var(--font-size-small);
	}

	.phone-bar {
		display: none;
	}

	.filter {
		margin: 0 0 var(--space-3);
		padding: var(--space-3) 0 0;
		border: 0;
		border-top: 1px solid var(--color-line);
		min-width: 0;
	}

	.filter:first-child {
		border-top: 0;
		padding-top: 0;
	}

	legend {
		display: block;
		font-weight: var(--font-weight-bold);
		margin-bottom: var(--space-1);
		padding: var(--space-3) 0 0;
	}

	.search {
		position: relative;
		display: block;
	}

	.search :global(svg) {
		position: absolute;
		left: var(--space-3);
		top: 50%;
		transform: translateY(-50%);
		color: var(--color-ink-muted);
		pointer-events: none;
	}

	input[type='search'] {
		width: 100%;
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3) 0 calc(var(--space-3) + 1.625rem);
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		font: inherit;
	}

	.option {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
		min-height: 1.75rem;
	}

	.option input {
		width: 1.1rem;
		height: 1.1rem;
		margin: 0;
		accent-color: var(--color-link);
	}

	.option .count {
		color: var(--color-ink-muted);
		font-variant-numeric: tabular-nums;
	}

	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--color-line);
	}

	.summary {
		margin: 0 auto 0 0;
		font-weight: var(--font-weight-bold);
	}

	.tools {
		display: flex;
		gap: var(--space-1);
	}

	.tools .on {
		color: var(--color-link);
		box-shadow: inset 0 -3px 0 var(--color-link);
	}

	.key {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-4);
		margin: var(--space-2) 0 var(--space-3);
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

	.body {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 118px;
		gap: var(--space-4);
		align-items: start;
	}

	.court-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		margin: var(--space-4) 0 var(--space-2);
		padding-bottom: 6px;
		border-bottom: 2px solid var(--color-ink);
	}

	.court-head h2 {
		margin: 0;
		font-size: 1.35rem;
	}

	.court-head .years {
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.court-head :global(.count-badge) {
		margin-left: 0;
	}

	.cases {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.case-row {
		display: grid;
		grid-template-columns: 7rem 2.125rem minmax(0, 1fr);
		align-items: start;
		padding: 6px 0 8px;
		border-radius: var(--radius-control);
		content-visibility: auto;
		contain-intrinsic-size: auto 4.5rem;
	}

	.case-row.chosen {
		background: color-mix(in srgb, var(--color-link) 9%, transparent);
	}

	.date {
		padding-top: 2px;
		color: var(--color-ink-muted);
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.rail {
		position: relative;
		align-self: stretch;
		display: flex;
		justify-content: center;
	}

	.rail::before {
		content: '';
		position: absolute;
		left: 50%;
		top: -8px;
		bottom: -10px;
		border-left: 2px solid var(--color-line);
	}

	.case-mark {
		position: relative;
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		margin-top: -3px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		cursor: pointer;
	}

	.case-mark svg {
		overflow: visible;
	}

	/* The site's focus look, as on the bench chart: yellow with an ink ring behind the diamond. */
	.case-mark:focus-visible {
		outline: none;
		background: var(--color-focus);
		box-shadow: 0 0 0 2px var(--color-focus-ring);
	}

	.what p {
		margin: 0;
	}

	.case-title {
		line-height: 1.4;
	}

	.votes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		margin-top: 3px !important;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.votes svg {
		display: block;
		overflow: visible;
	}

	.overview {
		position: sticky;
		top: var(--space-6);
		cursor: pointer;
	}

	.overview svg {
		display: block;
		overflow: visible;
	}

	.band {
		fill: var(--color-surface);
	}

	.band-name,
	.tick {
		fill: var(--color-ink-muted);
		font-size: 10px;
	}

	.year {
		fill: var(--color-timeline-case);
	}

	.view {
		fill: none;
		stroke: var(--color-ink);
		stroke-width: 1.5;
	}

	.none {
		color: var(--color-ink-muted);
	}

	@media (max-width: 52rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-3);
		}

		.phone-bar {
			display: flex;
			gap: var(--space-2);
		}

		.phone-bar .search {
			flex: 1;
		}

		.phone-bar .button {
			gap: var(--space-2);
		}

		.wide-only {
			display: none;
		}

		.filters {
			position: static;
			display: none;
		}

		.filters.open {
			display: block;
			border: 1px solid var(--color-line);
			border-radius: var(--radius-panel);
			padding: var(--space-3) var(--space-4);
		}

		.filters.open .filter:nth-child(2) {
			border-top: 0;
			padding-top: 0;
		}

		.body {
			grid-template-columns: minmax(0, 1fr);
		}

		.overview {
			display: none;
		}
	}

	@media (max-width: 40rem) {
		.case-row {
			grid-template-columns: 4.5rem 1.625rem minmax(0, 1fr);
		}

		.date {
			font-size: var(--font-size-small);
		}
	}

	@media (forced-colors: active) {
		.year {
			fill: CanvasText;
		}

		.view {
			stroke: CanvasText;
		}

		.case-mark:focus-visible {
			outline: 2px solid Highlight;
		}
	}
</style>
