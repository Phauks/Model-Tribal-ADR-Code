<!--
	@component
	Who sat on one Court of the Supreme Court, and when: a row for each
	Justice, the Chief Justice first, with a bar for the part of their service
	that fell within the Court, and a line at the date of each case on this
	site that the Court decided. Hidden from screen readers, since the table
	of Justices and the list of cases under it say the same.

	Use:
	<BenchChart rows={data.bench} start={data.start} end={data.end} cases={data.cases} />
-->
<script lang="ts">
	interface Row {
		name: string;
		role: string;
		from: string;
		to: string;
	}

	interface Marked {
		key: string;
		name: string;
		decided?: string;
		link?: string;
	}

	let { rows, start, end, cases = [] }: { rows: Row[]; start: string; end: string; cases?: Marked[] } = $props();

	const width = 760;
	const labelWidth = 170;
	const rowHeight = 24;
	const top = 26;
	const right = 12;

	/** A date as a fractional year, so bars start and stop on the day. */
	function yearValue(date: string): number {
		const [year, month = 1, day = 1] = date.split('-').map(Number);
		return year + (month - 1) / 12 + (day - 1) / 365;
	}

	function surname(name: string): string {
		return name.replace(/,\s*(?:Jr\.|Sr\.)$/, '').trim().split(/\s+/).pop() ?? name;
	}

	const first = $derived(yearValue(start));
	const last = $derived(yearValue(end));
	const x = (date: string) => labelWidth + ((yearValue(date) - first) / Math.max(last - first, 0.1)) * (width - labelWidth - right);
	const height = $derived(top + rows.length * rowHeight + 8);

	/** Tick years: every 5, 10 or 2 years, whichever gives 4 to 10 ticks. */
	const ticks = $derived.by(() => {
		const span = last - first;
		const step = span > 50 ? 10 : span > 12 ? 5 : span > 4 ? 2 : 1;
		const years: number[] = [];
		for (let year = Math.ceil(first / step) * step; year <= last; year += step) years.push(year);
		return years;
	});
	const tickX = (year: number) => labelWidth + ((year - first) / Math.max(last - first, 0.1)) * (width - labelWidth - right);
	const marked = $derived(cases.filter((item) => item.decided));
</script>

<figure class="bench-chart" aria-hidden="true">
	<div class="frame">
		<svg viewBox="0 0 {width} {height}" width="100%" role="presentation">
			{#each ticks as year (year)}
				<line class="grid" x1={tickX(year)} x2={tickX(year)} y1={top - 6} y2={height - 4} />
				<text class="tick" x={tickX(year)} y={top - 12} text-anchor="middle">{year}</text>
			{/each}
			{#each rows as row, index (row.name + row.role)}
				{@const y = top + index * rowHeight}
				<text class="name" class:chief={row.role === 'Chief Justice'} x={labelWidth - 10} y={y + rowHeight / 2 + 4} text-anchor="end"
					>{surname(row.name)}</text
				>
				<rect
					class="bar"
					class:chief={row.role === 'Chief Justice'}
					x={x(row.from)}
					y={y + 5}
					width={Math.max(x(row.to) - x(row.from), 2)}
					height={rowHeight - 10}
					rx="3"
				/>
			{/each}
			{#each marked as item (item.key)}
				<line class="case" x1={x(item.decided!)} x2={x(item.decided!)} y1={top - 4} y2={height - 4} />
				<path class="case-mark" d="M {x(item.decided!)} {top - 9} l 4 4 l -4 4 l -4 -4 z" />
			{/each}
		</svg>
	</div>
	{#if marked.length > 0}
		<figcaption class="small muted"><span class="key" aria-hidden="true"></span>Case on this site</figcaption>
	{/if}
</figure>

<style>
	.bench-chart {
		margin: var(--space-3) 0 var(--space-4);
	}

	.frame {
		overflow-x: auto;
	}

	svg {
		display: block;
		min-width: 34rem;
		font-family: inherit;
	}

	.grid {
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

	.bar {
		fill: var(--color-link);
		opacity: 0.75;
	}

	.bar.chief {
		fill: var(--color-action);
		opacity: 1;
	}

	.case {
		stroke: var(--color-timeline-case);
		stroke-width: 1.5;
		stroke-dasharray: 3 3;
	}

	.case-mark {
		fill: var(--color-timeline-case);
	}

	figcaption {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.key {
		display: inline-block;
		width: 0;
		height: 1em;
		border-left: 2px dashed var(--color-timeline-case);
	}

	@media (forced-colors: active) {
		.bar,
		.bar.chief,
		.case-mark {
			fill: CanvasText;
		}

		.case,
		.grid {
			stroke: CanvasText;
		}
	}
</style>
