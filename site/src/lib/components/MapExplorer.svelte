<!--
	@component
	The controls that float on the Map page's map (Trevor, 2026-11-26, map redesign D, in one visual language): search and Layers at the top left with the main layers as buttons beside them, the Layers list grouped Today, Color land by, History and Base map, a key that lists only what is on, a timeline along the bottom that rests on Today, and the chosen place's details on the right. The map's own buttons (zoom, flat or globe, full screen) stand at the top right (TileMap.svelte). Every part takes its look from global.css, "Controls that float on a map".
-->
<script lang="ts" module>
	import type { TileMapBase, TileMapLayers } from './TileMap.svelte';

	/** One layer the reader can turn on or off, with where its shapes come from. */
	export interface MapExplorerLayer {
		key: keyof TileMapLayers | 'cessions';
		label: string;
		/** The shorter name on its button across the top. */
		button: string;
		source?: string;
		group: 'today' | 'history';
	}

	export const mapExplorerLayers: MapExplorerLayer[] = [
		{ key: 'lands', label: 'Nations’ land', button: 'Nations’ land', source: 'Census Bureau, 2020', group: 'today' },
		{ key: 'states', label: 'States, shaded by number of nations', button: 'States', group: 'today' },
		{ key: 'offices', label: 'Offices of nations with no land area', button: 'Offices', group: 'today' },
		{ key: 'regions', label: 'Bureau of Indian Affairs regions', button: 'Regions', group: 'today' },
		{ key: 'borders', label: 'Borders over time', button: 'Borders over time', source: 'Newberry Library', group: 'history' },
		{ key: 'cessions', label: 'Land cessions', button: 'Land cessions', source: 'Royce, 1899', group: 'history' },
		{ key: 'routes', label: 'Removal routes', button: 'Removal routes', source: 'National Park Service', group: 'history' },
		{ key: 'homelands', label: 'Homelands found by the Indian Claims Commission', button: 'Homelands', source: '1978 map', group: 'history' }
	];

	/** The layers with a button across the top of the map (mockup D1); the rest are in the Layers list only. */
	const buttonLayers: MapExplorerLayer['key'][] = ['lands', 'states', 'borders', 'cessions', 'routes', 'homelands'];
</script>

<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import Layers from '@lucide/svelte/icons/layers';
	import Play from '@lucide/svelte/icons/play';
	import Pause from '@lucide/svelte/icons/pause';
	import Search from '@lucide/svelte/icons/search';
	import SearchableDropdown, { type SearchableChoice } from './SearchableDropdown.svelte';
	import CountBadge from './CountBadge.svelte';
	import { tileMapBases } from './TileMap.svelte';

	let {
		layers = $bindable(),
		cessions = $bindable(),
		colorBy = $bindable(),
		colorChoices,
		baseMap = $bindable(),
		placeNames = $bindable(),
		year = $bindable(),
		first,
		last,
		marks,
		places,
		onplace,
		key,
		details
	}: {
		layers: TileMapLayers;
		/** Royce's land cessions, a switch the nation and treaty pages share. */
		cessions: boolean;
		/** How the land is colored: '' for one color, or a shaded view's key. */
		colorBy: string;
		colorChoices: SearchableChoice<string>[];
		baseMap: TileMapBase;
		placeNames: boolean;
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
	} = $props();

	const identifier = $props.id();
	const isOn = (layer: MapExplorerLayer['key']) => (layer === 'cessions' ? cessions : layers[layer]);
	function setOn(layer: MapExplorerLayer['key'], on: boolean): void {
		// A layer the reader sets is theirs, even one the timeline turned on.
		if (layer === 'borders') bordersByTimeline = false;
		if (layer === 'cessions') cessions = on;
		else layers = { ...layers, [layer]: on };
	}
	const onCount = $derived(mapExplorerLayers.filter((layer) => isOn(layer.key)).length);

	let layersOpen = $state(false);
	let layersButton = $state<HTMLButtonElement | undefined>();
	let layersPanel = $state<HTMLElement | undefined>();
	async function toggleLayers(): Promise<void> {
		layersOpen = !layersOpen;
		if (layersOpen) {
			await tick();
			layersPanel?.querySelector<HTMLElement>('input')?.focus();
		}
	}
	onMount(() => {
		const outside = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (layersOpen && target && !layersPanel?.contains(target) && !layersButton?.contains(target)) layersOpen = false;
		};
		document.addEventListener('pointerdown', outside);
		return () => document.removeEventListener('pointerdown', outside);
	});

	let searched = $state('');

	/** Where the timeline's slider is: the year, or the end at Today. */
	const sliderValue = $derived(year ?? last);
	const at = (value: number) => `${((value - first) / (last - first)) * 100}%`;
	/** The notches on the bar, thinned so that each stands clear of the last (about twenty across the bar, as in mockup D1); playing still steps through every year in marks. */
	const notches = $derived.by(() => {
		const gap = (last - first) / 24;
		const kept: number[] = [];
		for (const value of [...marks].sort((a, b) => a - b)) {
			if (value <= first || value >= last - gap / 2) continue;
			if (kept.length && value - kept[kept.length - 1] < gap) continue;
			if (!kept.length && value - first < gap / 2) continue;
			kept.push(value);
		}
		return kept;
	});
	const tickYears = $derived([first, 1830, 1880, 1930, 1980, last].filter((value, index, all) => value >= first && value <= last && all.indexOf(value) === index));
	/**
	 * Dragging back in time turns on the borders of that time, as the mockup's note says. Back at Today they go off again if the timeline turned them on, so the timeline never leaves a layer on that the reader did not choose (Trevor, 2026-11-27: settings overriding each other).
	 */
	let bordersByTimeline = false;
	function moveTo(value: number): void {
		year = value >= last ? undefined : value;
		if (year !== undefined && !layers.borders) {
			layers = { ...layers, borders: true };
			bordersByTimeline = true;
		}
		if (year === undefined) backToToday();
	}
	function backToToday(): void {
		year = undefined;
		if (bordersByTimeline && layers.borders) layers = { ...layers, borders: false };
		bordersByTimeline = false;
	}

	/** Play steps through the years in which the map changes, from where the slider is (or the start) to Today. */
	let playing = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;
	function stop(): void {
		playing = false;
		if (timer) clearInterval(timer);
		timer = undefined;
	}
	function play(): void {
		if (playing) return stop();
		const steps = marks.filter((value) => value >= first && value < last);
		let index = year === undefined ? 0 : steps.findIndex((value) => value > (year ?? first));
		if (index < 0) index = 0;
		playing = true;
		moveTo(steps[index] ?? first);
		timer = setInterval(() => {
			index += 1;
			if (index >= steps.length) {
				stop();
				backToToday();
				return;
			}
			moveTo(steps[index]);
		}, 900);
	}
	onMount(() => stop);
</script>

<div class="explorer-top">
	<div class="explorer-search map-float">
		<Search class="explorer-search-icon" aria-hidden="true" size={18} />
		<SearchableDropdown label="Find a nation or place" hideLabel placeholder="Find a nation or place" choices={places} bind:value={searched} onchange={(value) => {
			onplace(value);
			searched = '';
		}} />
	</div>
	<button
		type="button"
		class="map-control map-float explorer-layers-button"
		aria-expanded={layersOpen}
		aria-controls="{identifier}-layers"
		bind:this={layersButton}
		onclick={() => void toggleLayers()}
	>
		<Layers aria-hidden="true" size={18} /><span class="explorer-layers-word">Layers</span>
		<CountBadge count={onCount} label="on" />
	</button>
	<div class="explorer-buttons" role="group" aria-label="Main layers">
		{#each mapExplorerLayers.filter((layer) => buttonLayers.includes(layer.key)) as layer (layer.key)}
			<button type="button" class="map-control map-float" aria-pressed={isOn(layer.key)} onclick={() => setOn(layer.key, !isOn(layer.key))}>
				{#if isOn(layer.key)}<Check class="map-control-check" aria-hidden="true" size={18} strokeWidth={2.5} />{/if}{layer.button}
			</button>
		{/each}
	</div>
</div>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="explorer-layers map-float map-panel"
	id="{identifier}-layers"
	role="group"
	aria-label="Layers"
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
	{#each [{ group: 'today', heading: 'Today' }, { group: 'history', heading: 'History' }] as section (section.group)}
		{#if section.group === 'history'}
			<p class="map-panel-heading" id="{identifier}-color">Color land by</p>
			<div class="explorer-color">
				<SearchableDropdown label="Color land by" hideLabel choices={colorChoices} bind:value={colorBy} />
			</div>
		{/if}
		<fieldset class="explorer-group">
			<legend class="map-panel-heading">{section.heading}</legend>
			{#each mapExplorerLayers.filter((layer) => layer.group === section.group) as layer (layer.key)}
				<label class="explorer-layer">
					<input type="checkbox" checked={isOn(layer.key)} onchange={(event) => setOn(layer.key, event.currentTarget.checked)} />
					<span class="explorer-layer-words">{layer.label}{#if layer.source}<span class="explorer-layer-source">{layer.source}</span>{/if}</span>
					<span class="swatch swatch-{layer.key}" aria-hidden="true"></span>
				</label>
			{/each}
		</fieldset>
	{/each}
	<fieldset class="explorer-group">
		<legend class="map-panel-heading">Base map</legend>
		<div class="explorer-bases">
			{#each tileMapBases as choice (choice.value)}
				<label class="explorer-base" class:map-control-on={baseMap === choice.value}>
					<input class="visually-hidden" type="radio" name="{identifier}-base" value={choice.value} checked={baseMap === choice.value} onchange={() => (baseMap = choice.value)} />
					<img src="/map-bases/{choice.value}.png" alt="" width="96" height="54" />
					<span>{choice.label}</span>
				</label>
			{/each}
		</div>
		{#if baseMap !== 'map'}
			<label class="explorer-layer"><input type="checkbox" bind:checked={placeNames} /><span class="explorer-layer-words">Place names and roads</span></label>
		{/if}
	</fieldset>
</div>

<div class="explorer-key map-float map-panel" class:beside-details={details !== undefined} aria-label="Key" role="group">
	<p class="map-panel-heading">Key</p>
	{@render key()}
</div>

{#if details}
	<div class="explorer-details">
		{@render details()}
	</div>
{/if}

<div class="explorer-timeline map-float map-panel">
	<button type="button" class="map-control map-control-square map-float explorer-flat" aria-label={playing ? 'Stop' : 'Play the years'} title={playing ? 'Stop' : 'Play the years'} onclick={play}>
		{#if playing}<Pause aria-hidden="true" size={20} />{:else}<Play aria-hidden="true" size={20} />{/if}
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
			aria-valuetext={year === undefined ? 'Today' : String(year)}
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
	<button type="button" class="map-control map-float explorer-flat" aria-pressed={year === undefined} onclick={() => {
		stop();
		backToToday();
	}}>
		{#if year === undefined}<Check class="map-control-check" aria-hidden="true" size={18} strokeWidth={2.5} />{/if}Today
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

	.explorer-buttons {
		display: flex;
		gap: var(--space-2);
		min-width: 0;
		overflow-x: auto;
		/* Room for the buttons' shadow inside the scrolling row. */
		padding: var(--space-2) var(--space-1);
		margin: calc(var(--space-2) * -1) calc(var(--space-1) * -1);
		scrollbar-width: none;
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

	.explorer-group {
		margin: 0;
		padding: 0;
		border: 0;
	}

	.explorer-group legend {
		padding: 0;
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

	.swatch-states {
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
		outline: 3px solid var(--color-focus-ring);
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

	.explorer-key .map-panel-heading {
		margin-top: var(--space-1);
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
		outline: 3px solid var(--color-focus-ring);
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

	/* On a narrow map (a phone), search takes the top row; Layers and the layer buttons scroll sideways under it; the key folds away under the timeline. */
	@container map-frame (max-width: 40rem) {
		.explorer-top {
			right: var(--space-3);
			flex-wrap: wrap;
		}

		.explorer-search {
			flex: 1 0 100%;
		}

		.explorer-buttons {
			flex: 1;
		}

		.explorer-layers-word {
			display: none;
		}

		.explorer-key {
			display: none;
		}

		.explorer-layers {
			top: calc(var(--space-3) * 3 + var(--layout-target-minimum) * 2);
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
