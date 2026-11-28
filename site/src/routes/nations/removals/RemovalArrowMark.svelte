<!--
	@component
	A small picture of how the Removals map draws a journey, for its key and its table: a solid arrow where the move is on record, a dashed one where only the order is, and the ring at the land left.
-->
<script lang="ts">
	let { style }: { style: 'solid' | 'dashed' | 'start' } = $props();
</script>

<svg class="arrow-mark" width="34" height="14" viewBox="0 0 34 14" aria-hidden="true" focusable="false">
	{#if style === 'start'}
		<circle cx="17" cy="7" r="4.5" class="ring" />
	{:else}
		<path d="M2 10 Q 16 1 28 7" class="under" />
		<path d="M2 10 Q 16 1 28 7" class="line" stroke-dasharray={style === 'dashed' ? '4 3' : undefined} />
		<path d="M33 9.5 L25 11.5 L27 7.5 L25.5 3.5 Z" class="head" />
	{/if}
</svg>

<style>
	.arrow-mark {
		flex: none;
		vertical-align: middle;
	}

	.under {
		fill: none;
		stroke: var(--color-paper);
		stroke-width: 5;
		stroke-linecap: round;
	}

	.line {
		fill: none;
		stroke: var(--color-action);
		stroke-width: 2.5;
		stroke-linecap: round;
	}

	.head {
		fill: var(--color-action);
		stroke: var(--color-paper);
		stroke-width: 1;
	}

	.ring {
		fill: var(--color-paper);
		stroke: var(--color-ink);
		stroke-width: 1.6;
	}
</style>
