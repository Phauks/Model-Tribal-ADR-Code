<!--
	@component
	A bar for going through the cases on a Justice timeline one at a time, in
	order (Trevor, Nov. 27, 2026: "a nav bar for the judicial timelines so
	that you can navigate through each case as they go by"; "it doesn't need
	a play button, but rather, just a left and a right"): a button for the
	earlier case and one for the later, and between them the case it is on,
	with its name, citation, date and outcome. The chart or list it belongs to
	marks that case as the bar moves.

	Each move tells a screen reader which case the bar is on.

	Use:
	<CaseStepper cases={placed.map((entry) => entry.item)} index={stepped} onmove={(index) => (stepped = index)} />
-->
<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { outcomeText, type ChartCase } from '#lib/bench-chart.ts';

	interface Props {
		cases: ChartCase[];
		/** The case the bar is on, or none yet. */
		index?: number;
		onmove: (index: number) => void;
		/** Name the Court after the outcome, where nothing around the bar does. */
		showCourt?: boolean;
	}

	let { cases, index, onmove, showCourt = false }: Props = $props();

	let said = $state('');

	const item = $derived(index === undefined ? undefined : cases[index]);
	const last = $derived(cases.length - 1);

	function move(by: number) {
		if (cases.length === 0) return;
		const next = index === undefined ? (by > 0 ? 0 : last) : Math.min(Math.max(index + by, 0), last);
		onmove(next);
		const each = cases[next];
		said = `${next + 1} of ${cases.length}: ${each.name}, ${each.decidedText ?? ''}, ${outcomeText(each)}`;
	}
</script>

<div class="case-stepper no-print" role="group" aria-label="Go through the cases">
	<button type="button" class="icon-button" aria-label="Earlier case" title="Earlier case" disabled={cases.length === 0 || index === 0} onclick={() => move(-1)}><ChevronLeft size={22} aria-hidden="true" /></button>
	<p class="now">
		{#if item}
			<span class="count">{index! + 1} of {cases.length.toLocaleString('en-US')}</span>
			<span class="title">{#if item.link}<a href={item.link}><i>{item.name}</i></a>{:else}<i>{item.name}</i>{/if}, {item.citation}</span>
			<span class="meta">{item.decidedText ?? ''} · {outcomeText(item)}{#if showCourt}<span class="court">{' · '}{item.court}</span>{/if}</span>
		{:else}
			<span class="count">{cases.length.toLocaleString('en-US')} {cases.length === 1 ? 'case' : 'cases'}</span>
			<span class="meta">Use the arrows to go through them in order.</span>
		{/if}
	</p>
	<button type="button" class="icon-button" aria-label="Later case" title="Later case" disabled={cases.length === 0 || index === last} onclick={() => move(1)}><ChevronRight size={22} aria-hidden="true" /></button>
	<p class="visually-hidden" aria-live="polite">{said}</p>
</div>

<style>
	.case-stepper {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		font-size: var(--font-size-small);
	}

	.icon-button {
		color: var(--color-link);
	}

	.icon-button:disabled {
		color: var(--color-ink-muted);
		opacity: 0.55;
		cursor: default;
	}

	.now {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: center;
		gap: 0 var(--space-2);
		margin: 0;
		min-width: 0;
		text-align: center;
	}

	.count {
		color: var(--color-ink-muted);
		font-variant-numeric: tabular-nums;
	}

	.title {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.meta {
		color: var(--color-ink-muted);
	}

	/* On a phone: the count and date on one line and the name on the next, cut short where it runs long. */
	@media (max-width: 40rem) {
		.case-stepper {
			gap: var(--space-1);
		}

		.now {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr);
			grid-template-areas: 'count meta' 'title title';
			gap: 0 var(--space-2);
			text-align: left;
		}

		.count {
			grid-area: count;
		}

		.meta {
			grid-area: meta;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.title {
			grid-area: title;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.court {
			display: none;
		}
	}
</style>
