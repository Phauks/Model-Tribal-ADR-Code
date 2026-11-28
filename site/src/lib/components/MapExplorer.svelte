<!--
	@component
	The controls that float on the Map page's map (Trevor, 2026-11-26, map redesign D, in one visual language): search and Layers at the top left, the Layers list in sections that fold (Layers today, Color, Layers in history, Base map), a key that lists only what is on and folds away, a timeline along the bottom that rests on Today and can be stepped through by hand or played at a chosen speed, and the chosen place's details on the right. The map's own buttons (zoom, flat or globe, full screen) stand at the top right (TileMap.svelte). Every part takes its look from global.css, "Controls that float on a map".
-->
<script lang="ts" module>
	import type { TileMapBase, TileMapLayers } from './TileMap.svelte';

	/** One layer the reader can turn on or off, with where its shapes come from. */
	export interface MapExplorerLayer {
		key: keyof TileMapLayers | 'cessions';
		label: string;
		source?: string;
		group: 'today' | 'history';
	}

	export const mapExplorerLayers: MapExplorerLayer[] = [
		{ key: 'lands', label: 'Nations’ land', source: 'Census Bureau, 2020', group: 'today' },
		{ key: 'states', label: 'States', group: 'today' },
		{ key: 'offices', label: 'Offices of nations without land', group: 'today' },
		{ key: 'regions', label: 'Bureau of Indian Affairs regions', group: 'today' },
		{ key: 'borders', label: 'Borders over time', source: 'Newberry Library', group: 'history' },
		{ key: 'cessions', label: 'Land cessions', source: 'Royce, 1899', group: 'history' },
		{ key: 'routes', label: 'Removal routes', source: 'National Park Service', group: 'history' },
		{ key: 'homelands', label: 'Homelands found by the Indian Claims Commission', source: '1978 map', group: 'history' },
		{ key: 'reservations1909', label: 'Reservations on the 1909 map', source: 'Office of Indian Affairs, 1909', group: 'history' }
	];

	/** The Layers list's sections, each of which folds (Trevor, 2026-11-27). */
	type Section = 'today' | 'color' | 'history' | 'base';

	/** How fast Play moves through the years: the time each step stays on screen is 900 ms divided by the speed. */
	const speeds = [
		{ value: 0.5, label: 'Slow, 0.5×' },
		{ value: 1, label: 'Normal, 1×' },
		{ value: 2, label: 'Fast, 2×' },
		{ value: 4, label: 'Fastest, 4×' }
	];

	/** What the reader chose here is remembered on the device; storage that is missing or refused leaves the defaults. */
	function readStored(key: string): string | null {
		try {
			return localStorage.getItem(key);
		} catch {
			// expected: storage is blocked, as in a private window; the defaults apply.
			return null;
		}
	}
	function writeStored(key: string, value: string): void {
		try {
			localStorage.setItem(key, value);
		} catch {
			// expected: the choice lasts for this visit only.
		}
	}
</script>

<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import Funnel from '@lucide/svelte/icons/funnel';
	import Layers from '@lucide/svelte/icons/layers';
	import List from '@lucide/svelte/icons/list';
	import Play from '@lucide/svelte/icons/play';
	import Pause from '@lucide/svelte/icons/pause';
	import Search from '@lucide/svelte/icons/search';
	import SkipBack from '@lucide/svelte/icons/skip-back';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import SearchableDropdown, { type SearchableChoice } from './SearchableDropdown.svelte';
	import CountBadge from './CountBadge.svelte';
	import { tileMapBases } from './TileMap.svelte';

	let {
		layers = $bindable(),
		cessions = $bindable(),
		colorBy = $bindable(),
		colorChoices,
		statesColor = $bindable(),
		statesColorChoices,
		baseMap = $bindable(),
		year = $bindable(),
		first,
		last,
		marks,
		places,
		onplace,
		key,
		details,
		filter,
		restLabel = 'Today',
		searchLabel = 'Find a nation or place',
		ticks,
		thinMarks = true,
		yearTurnsOnBorders = true
	}: {
		layers: TileMapLayers;
		/** Royce's land cessions, a switch the nation and treaty pages share. */
		cessions: boolean;
		/** How the land is colored: '' by kind of land, or a shaded view's key. */
		colorBy: string;
		colorChoices: SearchableChoice<string>[];
		/** How the states are colored: 'count' by number of nations, a shaded view's key, or '' for outlines only. */
		statesColor: string;
		statesColorChoices: SearchableChoice<string>[];
		baseMap: TileMapBase;
		/** The timeline's year; undefined is Today. */
		year: number | undefined;
		first: number;
		last: number;
		/** The years in which something on the map changes, marked on the timeline. */
		marks: number[];
		/** What the search finds: places, states and nations. */
		places: SearchableChoice<string>[];
		onplace: (value: string) => void;
		/** The key's rows, for what is on. */
		key: Snippet;
		/** The chosen place's details, over the map on the right. */
		details?: Snippet;
		/** In place of Layers, a filter of what the map shows, with its own panel, such as the Removals page's "Kind of move" (Removals mockup v2): its label, how many choices are on, and the panel. */
		filter?: { label: string; count: number; panel: Snippet };
		/** What the timeline rests on, at its end: Today, or "All years" on a map of the past. */
		restLabel?: string;
		searchLabel?: string;
		/** The years written under the timeline's bar; by default its ends and every fifty years from 1830. */
		ticks?: number[];
		/** Whether the marks on the bar are thinned to about twenty; a short span of years, such as the removals', shows every one. */
		thinMarks?: boolean;
		/** Whether moving back in time turns on the borders of that time; a map of one subject, such as the removals, keeps its own layers. */
		yearTurnsOnBorders?: boolean;
	} = $props();

	const identifier = $props.id();
	const isOn = (layer: MapExplorerLayer['key']) => (layer === 'cessions' ? cessions : layers[layer]);
	function setOn(layer: MapExplorerLayer['key'], on: boolean): void {
		// A layer the reader sets is theirs, even one the timeline turned on.
		if (layer === 'borders') bordersByTimeline = false;
		if (layer === 'cessions') cessions = on;
		else layers = { ...layers, [layer]: on, ...(layer === 'reservations1909' && !on ? { scan1909: false } : {}) };
		// The 1909 map is of one year, so turning it on at Today takes the timeline there (1909 reservations mockup 1).
		if (layer === 'reservations1909' && on && year === undefined) moveTo(1909);
	}
	const onCount = $derived(mapExplorerLayers.filter((layer) => isOn(layer.key)).length);

	let layersOpen = $state(false);
	let layersButton = $state<HTMLButtonElement | undefined>();
	let layersPanel = $state<HTMLElement | undefined>();
	async function toggleLayers(): Promise<void> {
		layersOpen = !layersOpen;
		if (layersOpen) {
			await tick();
			layersPanel?.querySelector<HTMLElement>('input, .explorer-fold')?.focus();
		}
	}

	/** Which of the Layers list's sections are folded, remembered on the device. Each opens by default. */
	const foldedStorage = 'map-layers-folded';
	let folded = $state<Record<Section, boolean>>({ today: false, color: false, history: false, base: false });
	function toggleSection(section: Section): void {
		folded = { ...folded, [section]: !folded[section] };
		writeStored(foldedStorage, JSON.stringify(folded));
	}

	/** Whether the key is folded down to its button, remembered on the device. A phone starts with it folded, since it would cover much of the map. */
	const keyStorage = 'map-key-folded';
	let keyFolded = $state(false);
	function toggleKey(): void {
		keyFolded = !keyFolded;
		writeStored(keyStorage, keyFolded ? 'yes' : 'no');
	}

	/** Play's speed, remembered on the device. */
	const speedStorage = 'map-play-speed';
	let speed = $state(1);
	let speedOpen = $state(false);
	let speedButton = $state<HTMLButtonElement | undefined>();
	let speedMenu = $state<HTMLElement | undefined>();
	async function toggleSpeed(): Promise<void> {
		speedOpen = !speedOpen;
		if (speedOpen) {
			await tick();
			speedMenu?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
		}
	}
	function chooseSpeed(value: number): void {
		speed = value;
		writeStored(speedStorage, String(value));
		speedOpen = false;
		speedButton?.focus();
		// A new speed takes effect at once while playing.
		if (playing) restartTimer();
	}

	onMount(() => {
		try {
			const stored = JSON.parse(readStored(foldedStorage) ?? '{}') as Partial<Record<Section, boolean>>;
			folded = { ...folded, ...Object.fromEntries(Object.entries(stored).filter(([, value]) => typeof value === 'boolean')) };
		} catch {
			// expected: a damaged entry leaves every section open.
		}
		const keyChoice = readStored(keyStorage);
		keyFolded = keyChoice === null ? matchMedia('(max-width: 40rem)').matches : keyChoice === 'yes';
		const storedSpeed = Number(readStored(speedStorage));
		if (speeds.some((entry) => entry.value === storedSpeed)) speed = storedSpeed;

		const outside = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (!target) return;
			if (layersOpen && !layersPanel?.contains(target) && !layersButton?.contains(target)) layersOpen = false;
			if (speedOpen && !speedMenu?.contains(target) && !speedButton?.contains(target)) speedOpen = false;
		};
		document.addEventListener('pointerdown', outside);
		return () => document.removeEventListener('pointerdown', outside);
	});

	let searched = $state('');

	/**
	 * Search rests folded to a button beside Layers, to leave the map room, and opens in place when pressed (Trevor, 2026-11-27: "search should collapse in map until used to save space"). It folds again once a place is picked, on Escape, and when the reader moves away with the box empty.
	 */
	let searchOpen = $state(false);
	let searchBox: HTMLDivElement | undefined = $state();
	let searchButton: HTMLButtonElement | undefined = $state();
	async function openSearch(): Promise<void> {
		searchOpen = true;
		await tick();
		searchBox?.querySelector('input')?.focus();
	}
	async function foldSearch(returnFocus: boolean): Promise<void> {
		searchOpen = false;
		searched = '';
		if (!returnFocus) return;
		await tick();
		searchButton?.focus();
	}

	/** Where the timeline's slider is: the year, or the end at Today. */
	const sliderValue = $derived(year ?? last);
	const at = (value: number) => `${((value - first) / (last - first)) * 100}%`;
	/** The notches on the bar, thinned so that each stands clear of the last (about twenty across the bar, as in mockup D1); playing and stepping still go through every year in marks. */
	const notches = $derived.by(() => {
		const gap = thinMarks ? (last - first) / 24 : 0;
		const kept: number[] = [];
		for (const value of [...marks].sort((a, b) => a - b)) {
			if (value <= first || value >= last - gap / 2) continue;
			if (kept.length && value - kept[kept.length - 1] < gap) continue;
			if (!kept.length && value - first < gap / 2) continue;
			kept.push(value);
		}
		return kept;
	});
	const tickYears = $derived((ticks ?? [first, 1830, 1880, 1930, 1980, last]).filter((value, index, all) => value >= first && value <= last && all.indexOf(value) === index));
	/** The years in which the map changes, in order, which Play and the step buttons go through. */
	const steps = $derived([...new Set(marks)].filter((value) => value >= first && value < last).sort((a, b) => a - b));

	/**
	 * Dragging back in time turns on the borders of that time, as the mockup's note says. Back at Today they go off again if the timeline turned them on, so the timeline never leaves a layer on that the reader did not choose (Trevor, 2026-11-27: settings overriding each other).
	 */
	let bordersByTimeline = false;
	function moveTo(value: number): void {
		if (value >= last) return backToToday();
		year = value;
		if (yearTurnsOnBorders && !layers.borders) {
			layers = { ...layers, borders: true };
			bordersByTimeline = true;
		}
	}
	function backToToday(): void {
		year = undefined;
		if (bordersByTimeline && layers.borders) layers = { ...layers, borders: false };
		bordersByTimeline = false;
	}

	/** The step buttons go to the year before or after in which the map changes (Trevor, 2026-11-27); past the last one is Today. */
	const atFirst = $derived(year !== undefined && year <= (steps[0] ?? first));
	function stepBack(): void {
		stop();
		const now = year ?? last;
		const earlier = steps.filter((value) => value < now);
		moveTo(earlier[earlier.length - 1] ?? steps[0] ?? first);
	}
	function stepForward(): void {
		stop();
		if (year === undefined) return;
		const later = steps.find((value) => value > (year ?? last));
		if (later === undefined) backToToday();
		else moveTo(later);
	}

	/** Play steps through the years in which the map changes, from where the slider is (or the start) to Today, at the chosen speed. */
	let playing = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;
	let playIndex = 0;
	function stop(): void {
		playing = false;
		if (timer) clearInterval(timer);
		timer = undefined;
	}
	function restartTimer(): void {
		if (timer) clearInterval(timer);
		timer = setInterval(() => {
			playIndex += 1;
			if (playIndex >= steps.length) {
				stop();
				backToToday();
				return;
			}
			moveTo(steps[playIndex]);
		}, 900 / speed);
	}
	function play(): void {
		if (playing) return stop();
		playIndex = year === undefined ? 0 : steps.findIndex((value) => value > (year ?? first));
		if (playIndex < 0) playIndex = 0;
		playing = true;
		moveTo(steps[playIndex] ?? first);
		restartTimer();
	}
	onMount(() => stop);
</script>

{#snippet foldButton(section: Section, heading: string)}
	<button type="button" class="explorer-fold" aria-expanded={!folded[section]} aria-controls="{identifier}-{section}" onclick={() => toggleSection(section)}>
		<span class="map-panel-heading">{heading}</span>
		{#if folded[section]}<ChevronDown aria-hidden="true" size={18} />{:else}<ChevronUp aria-hidden="true" size={18} />{/if}
	</button>
{/snippet}

{#snippet layerRows(group: MapExplorerLayer['group'])}
	{#each mapExplorerLayers.filter((layer) => layer.group === group) as layer (layer.key)}
		{@const pastOnly = group === 'today' && year !== undefined && layer.key !== 'lands'}
		<label class="explorer-layer" class:explorer-layer-resting={pastOnly && isOn(layer.key)}>
			<input type="checkbox" checked={isOn(layer.key)} onchange={(event) => setOn(layer.key, event.currentTarget.checked)} />
			<span class="explorer-layer-words"
				>{layer.label}{#if pastOnly}<span class="explorer-layer-source">Shown at Today only</span>{:else if layer.source}<span class="explorer-layer-source">{layer.source}</span>{/if}</span
			>
			<span class="swatch swatch-{layer.key}" class:swatch-states-colored={layer.key === 'states' && statesColor !== ''} aria-hidden="true"></span>
		</label>
		{#if layer.key === 'reservations1909' && layers.reservations1909}
			<!-- The map itself under the tracing, so the two can be compared (1909 reservations mockup 3). -->
			<label class="explorer-layer explorer-sublayer"><input type="checkbox" bind:checked={layers.scan1909} /><span class="explorer-layer-words">Show the original map</span></label>
		{/if}
	{/each}
{/snippet}

<div class="explorer-top">
	{#if searchOpen}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="explorer-search map-float"
			bind:this={searchBox}
			onkeydowncapture={(event) => {
				if (event.key !== 'Escape') return;
				event.preventDefault();
				void foldSearch(true);
			}}
			onfocusout={(event) => {
				const next = event.relatedTarget as Node | null;
				if (next && searchBox?.contains(next)) return;
				if (!searchBox?.querySelector('input')?.value) void foldSearch(false);
			}}
		>
			<Search class="explorer-search-icon" aria-hidden="true" size={18} />
			<SearchableDropdown label={searchLabel} hideLabel placeholder={searchLabel} choices={places} bind:value={searched} onchange={(value) => {
				onplace(value);
				void foldSearch(true);
			}} />
		</div>
	{:else}
		<button
			type="button"
			class="map-control map-control-square map-float explorer-search-button"
			aria-label={searchLabel}
			title={searchLabel}
			bind:this={searchButton}
			onclick={() => void openSearch()}
		>
			<Search aria-hidden="true" size={18} />
		</button>
	{/if}
	<button
		type="button"
		class="map-control map-float explorer-layers-button"
		aria-expanded={layersOpen}
		aria-controls="{identifier}-layers"
		bind:this={layersButton}
		onclick={() => void toggleLayers()}
	>
		{#if filter}
			<Funnel aria-hidden="true" size={18} /><span class="explorer-layers-word">{filter.label}</span>
			<CountBadge count={filter.count} label="shown" />
		{:else}
			<Layers aria-hidden="true" size={18} /><span class="explorer-layers-word">Layers</span>
			<CountBadge count={onCount} label="on" />
		{/if}
	</button>
</div>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="explorer-layers map-float map-panel"
	id="{identifier}-layers"
	role="group"
	aria-label={filter?.label ?? 'Layers'}
	hidden={!layersOpen}
	bind:this={layersPanel}
	onkeydown={(event) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			layersOpen = false;
			layersButton?.focus();
		}
	}}
>
	{#if filter}
		{@render filter.panel()}
	{:else}
	<section class="explorer-group" aria-label="Layers today">
		{@render foldButton('today', 'Layers today')}
		<div id="{identifier}-today" hidden={folded.today}>{@render layerRows('today')}</div>
	</section>
	<!-- Each layer that can be colored has its own choice, so coloring one never recolors another (Trevor, 2026-11-27). -->
	<section class="explorer-group" aria-label="Color">
		{@render foldButton('color', 'Color')}
		<div id="{identifier}-color" class="explorer-colors" hidden={folded.color}>
			<div class="explorer-color">
				<span class="explorer-color-label" id="{identifier}-color-lands" aria-hidden="true">Nations’ land</span>
				<SearchableDropdown label="Color nations’ land by" hideLabel choices={colorChoices} bind:value={colorBy} disabled={!layers.lands} />
				{#if !layers.lands}<span class="explorer-layer-source">Turn on Nations’ land to color it</span>{/if}
			</div>
			<div class="explorer-color">
				<span class="explorer-color-label" aria-hidden="true">States</span>
				<SearchableDropdown label="Color states by" hideLabel choices={statesColorChoices} bind:value={statesColor} disabled={!layers.states} />
				{#if !layers.states}<span class="explorer-layer-source">Turn on States to color them</span>{/if}
			</div>
		</div>
	</section>
	<section class="explorer-group" aria-label="Layers in history">
		{@render foldButton('history', 'Layers in history')}
		<div id="{identifier}-history" hidden={folded.history}>{@render layerRows('history')}</div>
	</section>
	<section class="explorer-group" aria-label="Base map">
		{@render foldButton('base', 'Base map')}
		<div id="{identifier}-base" hidden={folded.base}>
			<div class="explorer-bases" role="radiogroup" aria-label="Base map">
				{#each tileMapBases as choice (choice.value)}
					<label class="explorer-base" class:map-control-on={baseMap === choice.value}>
						<input class="visually-hidden" type="radio" name="{identifier}-base" value={choice.value} checked={baseMap === choice.value} onchange={() => (baseMap = choice.value)} />
						<img src="/map-bases/{choice.value}.png" alt="" width="96" height="54" />
						<span>{choice.label}</span>
					</label>
				{/each}
			</div>
		</div>
	</section>
	{/if}
</div>

<!-- The key folds down to one button, so it never has to cover the map (Trevor, 2026-11-27). -->
<div class="explorer-key" class:map-float={!keyFolded} class:map-panel={!keyFolded} class:folded={keyFolded} class:beside-details={details !== undefined} aria-label="Key" role="group">
	{#if keyFolded}
		<button type="button" class="map-control map-float" aria-expanded="false" aria-controls="{identifier}-key" onclick={toggleKey}>
			<List aria-hidden="true" size={18} /><span class="explorer-key-word">Key</span><ChevronDown aria-hidden="true" size={18} />
		</button>
	{:else}
		<button type="button" class="explorer-fold" aria-expanded="true" aria-controls="{identifier}-key" onclick={toggleKey}>
			<span class="map-panel-heading">Key</span><ChevronUp aria-hidden="true" size={18} />
		</button>
	{/if}
	<div id="{identifier}-key" hidden={keyFolded}>{@render key()}</div>
</div>

{#if details}
	<div class="explorer-details">
		{@render details()}
	</div>
{/if}

<div class="explorer-timeline map-float map-panel">
	<button type="button" class="map-control map-control-square map-float explorer-flat explorer-play" aria-label={playing ? 'Stop' : 'Play the years'} title={playing ? 'Stop' : 'Play the years'} onclick={play}>
		{#if playing}<Pause aria-hidden="true" size={20} />{:else}<Play aria-hidden="true" size={20} />{/if}
	</button>
	<button type="button" class="map-control map-control-square map-float explorer-flat explorer-back" aria-label="Go back to the last change" title="Go back to the last change" disabled={atFirst} onclick={stepBack}>
		<SkipBack aria-hidden="true" size={20} />
	</button>
	<button type="button" class="map-control map-control-square map-float explorer-flat explorer-forward" aria-label="Go forward to the next change" title="Go forward to the next change" disabled={year === undefined} onclick={stepForward}>
		<SkipForward aria-hidden="true" size={20} />
	</button>
	{#if year !== undefined}<output class="explorer-year" for="{identifier}-year">{year}</output>{/if}
	<div class="explorer-track">
		<div class="explorer-rail" aria-hidden="true">
			<span class="explorer-fill" style:width={at(sliderValue)}></span>
			{#each notches as value (value)}
				<span class="explorer-mark" style:left={at(value)}></span>
			{/each}
		</div>
		<label class="visually-hidden" for="{identifier}-year">Year</label>
		<input
			id="{identifier}-year"
			type="range"
			min={first}
			max={last}
			step="1"
			value={sliderValue}
			aria-valuetext={year === undefined ? restLabel : String(year)}
			oninput={(event) => {
				stop();
				moveTo(Number(event.currentTarget.value));
			}}
		/>
		<div class="explorer-ticks" aria-hidden="true">
			{#each tickYears as value (value)}
				<span style:left={at(value)}>{value}</span>
			{/each}
		</div>
	</div>
	<div class="explorer-speed">
		<button type="button" class="map-control map-float explorer-flat" aria-expanded={speedOpen} aria-controls="{identifier}-speed" aria-label="Speed, {speed}×" title="Speed" bind:this={speedButton} onclick={() => void toggleSpeed()}>
			{speed}×<ChevronDown aria-hidden="true" size={18} />
		</button>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="explorer-speed-menu map-float map-panel"
			id="{identifier}-speed"
			role="radiogroup"
			tabindex="-1"
			aria-label="Speed"
			hidden={!speedOpen}
			bind:this={speedMenu}
			onkeydown={(event) => {
				if (event.key === 'Escape') {
					event.preventDefault();
					speedOpen = false;
					speedButton?.focus();
				}
			}}
		>
			<p class="map-panel-heading" aria-hidden="true">Speed</p>
			{#each speeds as choice (choice.value)}
				<button type="button" role="radio" aria-checked={speed === choice.value} class="map-control explorer-speed-choice" class:map-control-on={speed === choice.value} onclick={() => chooseSpeed(choice.value)}>
					<span class="explorer-speed-check">{#if speed === choice.value}<Check class="map-control-check" aria-hidden="true" size={18} strokeWidth={2.5} />{/if}</span>{choice.label}
				</button>
			{/each}
		</div>
	</div>
	<button type="button" class="map-control map-float explorer-flat explorer-today" aria-pressed={year === undefined} onclick={() => {
		stop();
		backToToday();
	}}>
		{#if year === undefined}<Check class="map-control-check" aria-hidden="true" size={18} strokeWidth={2.5} />{/if}{restLabel}
	</button>
</div>

<style>
	/* Everything here sits over the map (the page's .map-frame), clear of the map's own buttons at the top right. */
	.explorer-top {
		position: absolute;
		z-index: 2;
		top: var(--space-3);
		left: var(--space-3);
		right: calc(var(--layout-target-minimum) + var(--space-3) * 2);
		display: flex;
		gap: var(--space-2);
		align-items: center;
		pointer-events: none;
	}

	.explorer-top > :global(*) {
		pointer-events: auto;
	}

	.explorer-search {
		position: relative;
		flex: 0 1 16rem;
		min-width: 12rem;
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
	}

	/* The search box takes the controls' look: their height, corner and border. */
	.explorer-search :global(.explorer-search-icon) {
		position: absolute;
		z-index: 1;
		top: 50%;
		left: var(--space-3);
		transform: translateY(-50%);
		color: var(--color-ink-muted);
		pointer-events: none;
	}

	/* A search box, not a list to open: the magnifier at its start stands for the arrow at its end. */
	.explorer-search :global(.searchable-dropdown-toggle) {
		display: none;
	}

	.explorer-search :global(input) {
		padding-left: calc(var(--space-3) + 18px + var(--space-2));
		min-height: var(--layout-target-minimum);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
	}

	.explorer-layers {
		position: absolute;
		z-index: 3;
		top: calc(var(--space-3) * 2 + var(--layout-target-minimum));
		left: var(--space-3);
		width: min(21rem, calc(100% - var(--space-3) * 2));
		max-height: calc(100% - var(--layout-target-minimum) - var(--space-3) * 3 - 6.75rem);
		overflow-y: auto;
		padding: var(--space-1) var(--space-4) var(--space-3);
	}

	.explorer-layers[hidden] {
		display: none;
	}

	.explorer-group + .explorer-group {
		border-top: 1px solid var(--color-line);
	}

	.explorer-group > div {
		padding-bottom: var(--space-2);
	}

	.explorer-group > div[hidden] {
		display: none;
	}

	/* A section's heading is the button that folds it, as on the key. */
	.explorer-fold {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-height: var(--layout-target-minimum);
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-ink);
		cursor: pointer;
	}

	.explorer-fold .map-panel-heading {
		margin: 0;
	}

	.explorer-fold:focus-visible {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-control);
	}

	/* A layer of today that is on but not drawn, because the timeline shows a past year. */
	.explorer-layer-resting .explorer-layer-words,
	.explorer-layer-resting .swatch {
		opacity: 0.6;
	}

	.explorer-colors {
		display: grid;
		gap: var(--space-3);
	}

	.explorer-color {
		display: grid;
		gap: var(--space-1);
	}

	.explorer-color-label {
		font-weight: var(--font-weight-bold);
	}

	.explorer-layer {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 3px 0;
		line-height: 1.25;
		cursor: pointer;
	}

	.explorer-layer input {
		flex: none;
		width: 1.25rem;
		height: 1.25rem;
		margin: 0;
		accent-color: var(--color-action);
	}

	.explorer-layer-words {
		flex: 1;
	}

	.explorer-layer-source {
		display: block;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.swatch {
		flex: none;
		width: 1.4rem;
		height: 1rem;
		border: 1px solid var(--color-control-border);
		border-radius: 2px;
	}

	.swatch-lands {
		background: var(--color-map-class-4);
	}

	/* The States swatch shows how they are drawn: outlined, or shaded when they are colored. */
	.swatch-states {
		border-color: var(--color-ink);
		background: transparent;
	}

	.swatch-states.swatch-states-colored {
		border-color: var(--color-control-border);
		background: linear-gradient(90deg, var(--color-map-class-1), var(--color-map-class-3));
	}

	.swatch-offices {
		width: 0.8rem;
		height: 0.8rem;
		margin-right: 0.3rem;
		border: 2px solid var(--color-ink);
		border-radius: 50%;
		background: var(--color-paper);
	}

	.swatch-regions {
		border: 2px solid var(--color-action);
	}

	.swatch-borders {
		background: var(--color-status-published-background);
	}

	.swatch-cessions {
		border-color: var(--color-timeline-treaty);
		background: color-mix(in srgb, var(--color-timeline-treaty) 40%, transparent);
	}

	.swatch-routes {
		height: 0;
		border: 0;
		border-top: 3px solid var(--color-action);
	}

	.swatch-homelands {
		border: 2px dashed var(--color-status-draft-rule);
		background: color-mix(in srgb, var(--color-status-draft-rule) 18%, transparent);
	}

	.swatch-reservations1909 {
		border-color: var(--color-map-reservation-1909-line);
		background: var(--color-map-reservation-1909);
	}

	/* A switch that belongs to the layer above it sits under that layer's name. */
	.explorer-sublayer {
		padding-left: calc(1.25rem + var(--space-3));
	}

	.explorer-layer.explorer-sublayer input {
		width: 1rem;
		height: 1rem;
	}

	.explorer-color :global(input) {
		min-height: var(--layout-target-minimum);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
	}

	.explorer-bases {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-2);
		margin-bottom: var(--space-1);
	}

	.explorer-base {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--space-1);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-bold);
		text-align: center;
		cursor: pointer;
	}

	.explorer-base img {
		width: 100%;
		height: auto;
		aspect-ratio: 16 / 9;
		object-fit: cover;
		border-radius: 3px;
	}

	.explorer-base:has(input:focus-visible) {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.explorer-key {
		position: absolute;
		z-index: 1;
		right: var(--space-3);
		bottom: 6.75rem;
		max-width: 19rem;
		padding: var(--space-1) var(--space-3) var(--space-2);
		font-size: var(--font-size-small);
	}

	.explorer-key .explorer-fold {
		min-height: 2rem;
	}

	.explorer-key > div[hidden] {
		display: none;
	}

	/* Folded, the key is one button. */
	.explorer-key.folded {
		padding: 0;
	}

	.explorer-key-word {
		font-weight: var(--font-weight-bold);
	}

	/* With a place's details open on the right, the key moves to the left. */
	.explorer-key.beside-details {
		right: auto;
		left: var(--space-3);
	}

	.explorer-details {
		position: absolute;
		z-index: 2;
		top: calc(var(--space-3) * 2 + var(--layout-target-minimum));
		right: calc(var(--layout-target-minimum) + var(--space-3) * 2);
		width: min(21rem, calc(100% - var(--layout-target-minimum) - var(--space-3) * 3));
		max-height: calc(100% - var(--layout-target-minimum) - 10rem);
		overflow-y: auto;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
		box-shadow: var(--map-float-shadow);
	}

	.explorer-timeline {
		position: absolute;
		z-index: 1;
		left: var(--space-3);
		right: var(--space-3);
		bottom: 2rem;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
	}

	/* Buttons inside a panel are already lifted by it. */
	.explorer-flat {
		box-shadow: none;
	}

	.explorer-timeline button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.explorer-speed {
		position: relative;
		flex: none;
	}

	.explorer-speed-menu {
		position: absolute;
		z-index: 4;
		right: 0;
		bottom: calc(100% + var(--space-3));
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		width: 11.5rem;
		padding: var(--space-2);
	}

	.explorer-speed-menu[hidden] {
		display: none;
	}

	.explorer-speed-menu .map-panel-heading {
		margin: var(--space-1) var(--space-2);
	}

	.explorer-speed-choice {
		justify-content: flex-start;
		width: 100%;
		box-shadow: none;
	}

	.explorer-speed-choice:not(.map-control-on) {
		border-color: transparent;
		background: transparent;
	}

	.explorer-speed-check {
		display: inline-flex;
		width: 18px;
	}

	.explorer-year {
		min-width: 3.5rem;
		font-size: 1.4rem;
		font-weight: var(--font-weight-bold);
		text-align: center;
	}

	.explorer-track {
		position: relative;
		flex: 1;
		min-width: 0;
		height: var(--layout-target-minimum);
	}

	.explorer-rail {
		position: absolute;
		top: 0.75rem;
		left: 0;
		right: 0;
		height: 6px;
		border-radius: 3px;
		background: var(--color-line);
	}

	.explorer-fill {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		border-radius: 3px;
		background: var(--color-control-border);
	}

	/* A year in which the map changes, as a notch in the bar. */
	.explorer-mark {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--color-paper);
	}

	.explorer-track input {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 1.9rem;
		margin: 0;
		background: transparent;
		appearance: none;
		cursor: pointer;
	}

	.explorer-track input::-webkit-slider-runnable-track {
		height: 1.9rem;
		background: transparent;
	}

	.explorer-track input::-moz-range-track {
		background: transparent;
	}

	.explorer-track input::-webkit-slider-thumb {
		width: 1.4rem;
		height: 1.4rem;
		margin-top: 0.25rem;
		border: 3px solid var(--color-action);
		border-radius: 50%;
		background: var(--color-paper);
		appearance: none;
	}

	.explorer-track input::-moz-range-thumb {
		width: 1rem;
		height: 1rem;
		border: 3px solid var(--color-action);
		border-radius: 50%;
		background: var(--color-paper);
	}

	.explorer-track input:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.explorer-ticks {
		position: absolute;
		top: 1.6rem;
		left: 0;
		right: 0;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.explorer-ticks span {
		position: absolute;
		transform: translateX(-50%);
	}

	.explorer-ticks span:first-child {
		transform: none;
	}

	.explorer-ticks span:last-child {
		transform: translateX(-100%);
	}

	/* On a narrow map (a phone), the folded search, Layers and the key share the top row; search, opened, lies over that row; the key folds away under the timeline. */
	@container map-frame (max-width: 40rem) {
		.explorer-top {
			right: var(--space-3);
		}

		.explorer-search {
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			z-index: 1;
			min-width: 0;
		}

		.explorer-layers-word {
			display: none;
		}

		/* The key, folded, sits beside search and Layers on the top row; open, it hangs down from there, clear of the map's buttons on the right. */
		.explorer-key {
			top: var(--space-3);
			bottom: auto;
			left: calc(var(--space-3) + var(--layout-target-minimum) + var(--space-2) + 5.5rem);
			right: auto;
			max-width: calc(100% - var(--space-3) * 4 - var(--layout-target-minimum) * 2 - var(--space-2) - 5.5rem);
		}

		.explorer-key.beside-details {
			left: calc(var(--space-3) + var(--layout-target-minimum) + var(--space-2) + 5.5rem);
		}

		.explorer-key-word {
			display: none;
		}

		/* The timeline takes two rows: the bar and Today, then play, the steps and the speed. */
		.explorer-timeline {
			/* Clear of the map's credits, which take two lines on a phone. */
			bottom: 2.75rem;
			display: grid;
			grid-template-columns: repeat(3, var(--layout-target-minimum)) auto minmax(0, 1fr);
			grid-template-areas:
				'track track track track today'
				'play back forward speed year';
			gap: var(--space-2) var(--space-1);
		}

		.explorer-today {
			justify-self: end;
		}

		.explorer-track {
			grid-area: track;
		}

		.explorer-today {
			grid-area: today;
			margin-left: var(--space-2);
		}

		.explorer-play {
			grid-area: play;
		}

		.explorer-back {
			grid-area: back;
		}

		.explorer-forward {
			grid-area: forward;
		}

		.explorer-speed {
			grid-area: speed;
		}

		.explorer-year {
			grid-area: year;
			text-align: right;
		}

		.explorer-details {
			left: var(--space-3);
			right: var(--space-3);
			width: auto;
		}

		.explorer-ticks span:not(:first-child, :last-child),
		.explorer-mark {
			display: none;
		}
	}
</style>
