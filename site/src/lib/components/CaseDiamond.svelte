<!--
	@component
	A Supreme Court case as a diamond inside an SVG, centred on (cx, cy):
	filled when the Court was unanimous, hollow when it was divided. The
	Justice timelines' case strip and key, and the Supreme Court timeline's
	rail, draw it.

	Use, inside an <svg>:
	<CaseDiamond cx={7} cy={8} divided />
-->
<script lang="ts">
	interface Props {
		cx: number;
		cy: number;
		/** Half the diamond's height. */
		size?: number;
		divided?: boolean;
		/** The case the card is open for. */
		active?: boolean;
	}

	let { cx, cy, size = 5, divided = false, active = false }: Props = $props();
</script>

<path
	class="case-diamond"
	class:divided
	class:active
	d="M{cx} {cy - size}l{size * 0.85} {size}l{-size * 0.85} {size}l{-size * 0.85} {-size}z"
	aria-hidden="true"
/>

<style>
	.case-diamond {
		fill: var(--color-timeline-case);
		stroke: var(--color-timeline-case);
		stroke-width: 1.5;
		stroke-linejoin: round;
	}

	.divided {
		fill: var(--color-paper);
	}

	.active {
		stroke: var(--color-ink);
		stroke-width: 2;
	}

	@media (forced-colors: active) {
		.case-diamond {
			fill: CanvasText;
			stroke: CanvasText;
		}

		.divided {
			fill: Canvas;
		}
	}
</style>
