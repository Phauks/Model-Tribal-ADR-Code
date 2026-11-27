<!--
	@component
	One Justice's vote as a mark inside an SVG, centred on (cx, cy): a filled
	dot for the majority, a cross for a dissent, a dash for took no part and a
	dotted ring where the record does not say; a ring around it when the
	Justice wrote an opinion. Shape carries the meaning, so no reader needs the
	color (DESIGN.md, "Color vision"). A halo in the page color keeps the mark
	clear where it sits on a Justice's bar.

	Use, inside an <svg>:
	<VoteMark vote="dissent" cx={40} cy={12} wrote />
-->
<script lang="ts">
	import type { BenchVote } from '#lib/bench-chart.ts';

	interface Props {
		vote: BenchVote;
		cx: number;
		cy: number;
		/** 1 is the size on a Justice's bar. */
		size?: number;
		wrote?: boolean;
	}

	let { vote, cx, cy, size = 1, wrote = false }: Props = $props();

	const radius = $derived(5.2 * size);
	const arm = $derived(radius * 0.85);
</script>

<g class="vote-mark vote-{vote}" aria-hidden="true">
	{#if vote === 'majority'}
		<circle class="halo" {cx} {cy} r={radius + 2} />
		<circle class="majority" {cx} {cy} r={radius} />
	{:else if vote === 'dissent'}
		<circle class="halo" {cx} {cy} r={radius + 2} />
		<path class="dissent" d="M{cx - arm} {cy - arm}L{cx + arm} {cy + arm}M{cx + arm} {cy - arm}L{cx - arm} {cy + arm}" />
	{:else if vote === 'none'}
		<circle class="halo" {cx} {cy} r={radius + 1} />
		<path class="none" d="M{cx - radius * 0.8} {cy}H{cx + radius * 0.8}" />
	{:else}
		<circle class="unknown" {cx} {cy} r={radius * 0.8} />
	{/if}
	{#if wrote}
		<circle class="wrote" {cx} {cy} r={radius + 3.6} />
	{/if}
</g>

<style>
	.halo {
		fill: var(--color-paper);
	}

	.majority {
		fill: var(--color-vote-majority);
	}

	.dissent {
		fill: none;
		stroke: var(--color-vote-dissent);
		stroke-width: 2.75;
		stroke-linecap: round;
	}

	.none {
		stroke: var(--color-ink-muted);
		stroke-width: 2.5;
		stroke-linecap: round;
	}

	.unknown {
		fill: var(--color-paper);
		stroke: var(--color-ink-muted);
		stroke-width: 1.5;
		stroke-dasharray: 2 2;
	}

	.wrote {
		fill: none;
		stroke: var(--color-ink);
		stroke-width: 1.5;
	}

	@media (forced-colors: active) {
		.majority {
			fill: CanvasText;
		}

		.dissent,
		.none,
		.wrote {
			stroke: CanvasText;
		}

		.halo,
		.unknown {
			fill: Canvas;
		}
	}
</style>
