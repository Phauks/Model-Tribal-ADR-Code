<!--
	@component
	The year slider under a map (Trevor, 2026-11-26, historic maps mockup A): it picks the year the map shows, from Royce's first land cession (1784) to the newest Census year. The track is tinted where there is something to show: the cession years in the cessions' color and the Census years in the land areas' color. ‹ and › jump to the year before or after in which the map changes; the arrow keys move a year, Page Up and Page Down ten, Home and End to the ends. The year shows in a box at the end and is read out with what the map shows for it.
-->
<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	let {
		value = $bindable(),
		minimum,
		maximum,
		stops,
		bands,
		compact = false,
		describe
	}: {
		value: number;
		minimum: number;
		maximum: number;
		/** The years in which the map changes, in order, for the ‹ and › buttons. */
		stops: number[];
		/** Stretches of the track to tint: which data each covers, from and to a year. */
		bands: { kind: 'cessions' | 'census'; from: number; to: number }[];
		/** A narrow map's slider (a nation's page, a phone): no ‹ and › buttons, ticks at the ends only. */
		compact?: boolean;
		/** What the map shows for a year, read out with the year. */
		describe?: (year: number) => string;
	} = $props();

	const identifier = $props.id();
	const span = $derived(maximum - minimum);
	const at = (year: number) => `${((year - minimum) / span) * 100}%`;
	const ticks = $derived(compact ? [minimum, maximum] : [minimum, 1850, 1900, 1950, maximum].filter((year) => year >= minimum && year <= maximum));
	const previous = $derived([...stops].reverse().find((year) => year < value));
	const next = $derived(stops.find((year) => year > value));
</script>

<div class="year-slider-frame">
<div class="year-slider" class:compact>
	<label class="year-label" for="{identifier}-year">Year</label>
	{#if !compact}
		<button type="button" class="step" aria-label={previous ? `Back to ${previous}` : 'Back'} title={previous ? `Back to ${previous}` : undefined} disabled={previous === undefined} onclick={() => previous !== undefined && (value = previous)}>
			<ChevronLeft aria-hidden="true" size={20} />
		</button>
	{/if}
	<div class="track">
		<div class="rail" aria-hidden="true">
			{#each bands as band (band.kind)}
				<span class="band {band.kind}" style:left={at(band.from)} style:width="calc({at(band.to)} - {at(band.from)})"></span>
			{/each}
		</div>
		<input
			id="{identifier}-year"
			type="range"
			min={minimum}
			max={maximum}
			step="1"
			bind:value
			aria-valuetext={describe ? `${value}: ${describe(value)}` : String(value)}
		/>
		<div class="ticks" aria-hidden="true">
			{#each ticks as year (year)}
				<span style:left={at(year)}>{year}</span>
			{/each}
		</div>
	</div>
	{#if !compact}
		<button type="button" class="step" aria-label={next ? `Forward to ${next}` : 'Forward'} title={next ? `Forward to ${next}` : undefined} disabled={next === undefined} onclick={() => next !== undefined && (value = next)}>
			<ChevronRight aria-hidden="true" size={20} />
		</button>
	{/if}
	<output class="year" for="{identifier}-year" aria-hidden="true">{value}</output>
</div>
</div>

<style>
	.year-slider-frame {
		container: year-slider / inline-size;
	}

	.year-slider {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}

	.year-slider.compact {
		grid-template-columns: auto minmax(0, 1fr) auto;
	}

	.year-label {
		font-weight: var(--font-weight-bold);
	}

	.step {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-small, 4px);
		background: var(--color-paper);
		color: var(--color-ink);
		cursor: pointer;
	}

	.step:disabled {
		color: var(--color-ink-muted);
		cursor: default;
		opacity: 0.6;
	}

	.track {
		position: relative;
		min-height: var(--layout-target-minimum);
		padding-bottom: 1.1rem;
	}

	/* The tinted track sits under the browser's own slider, whose track is made clear. */
	.rail {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(var(--layout-target-minimum) / 2 - 3px);
		height: 6px;
		border-radius: 3px;
		background: var(--color-line);
	}

	.band {
		position: absolute;
		top: 0;
		bottom: 0;
		border-radius: 3px;
	}

	.band.cessions {
		background: var(--color-timeline-treaty);
		opacity: 0.6;
	}

	.band.census {
		background: var(--color-map-class-2);
	}

	input {
		position: relative;
		display: block;
		width: 100%;
		min-height: var(--layout-target-minimum);
		margin: 0;
		background: transparent;
		accent-color: var(--color-action);
		cursor: pointer;
		appearance: none;
	}

	input::-webkit-slider-runnable-track {
		height: 6px;
		background: transparent;
	}

	input::-moz-range-track {
		height: 6px;
		background: transparent;
	}

	input::-webkit-slider-thumb {
		appearance: none;
		width: 24px;
		height: 24px;
		margin-top: -9px;
		border: 3px solid var(--color-paper);
		border-radius: 50%;
		background: var(--color-action);
		box-shadow: 0 0 0 1px var(--color-action);
	}

	input::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border: 3px solid var(--color-paper);
		border-radius: 50%;
		background: var(--color-action);
		box-shadow: 0 0 0 1px var(--color-action);
	}

	input:focus-visible {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: 2px;
	}

	.ticks {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 1.1rem;
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	.ticks span {
		position: absolute;
		transform: translateX(-50%);
		line-height: 1;
	}

	.ticks span:first-child {
		transform: none;
	}

	.ticks span:last-child {
		transform: translateX(-100%);
	}

	.year {
		min-width: 4.25rem;
		padding: var(--space-1) var(--space-2);
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-small, 4px);
		font-size: 1.25rem;
		font-weight: var(--font-weight-bold);
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.compact .year {
		min-width: 3.75rem;
		font-size: 1.05rem;
	}

	/* On a phone the ‹ and › buttons drop away and only the ends are marked (mockup 9A); the arrow keys still step. */
	@container year-slider (max-width: 30rem) {
		.year-slider {
			grid-template-columns: auto minmax(0, 1fr) auto;
		}

		.step,
		.ticks span:not(:first-child, :last-child) {
			display: none;
		}
	}
</style>
