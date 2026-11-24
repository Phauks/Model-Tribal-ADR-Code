<!--
	@component
	Who sat on one Court of the Supreme Court, and when: a row for each
	Justice, the Chief Justice first, with a bar for the part of their service
	that fell within the Court, and a line at the date of each case on this
	site that the Court decided, linked to the case. Pointing at a case shows
	its name and date; the names are not written on the chart, where many
	cases would stack (Trevor, Nov. 23, 2026: "remove names there"). Hidden
	from screen readers, and its links kept out of the keyboard order, since
	the table of Justices and the table of cases under it say the same.

	Use:
	<BenchChart rows={data.bench} start={data.start} end={data.end} cases={data.cases} />
-->
<script lang="ts">
	interface Row {
		name: string;
		role: string;
		from: string;
		to: string;
		/** The Justice's page, when the name should open it. */
		link?: string;
	}

	interface Marked {
		key: string;
		name: string;
		decided?: string;
		decidedText?: string;
		link?: string;
	}

	interface Props {
		rows: Row[];
		start: string;
		end: string;
		cases?: Marked[];
		/** The drawing's width in its own units: smaller draws the type larger in a narrow column. */
		width?: number;
		/** Room for the names on the left. */
		labelWidth?: number;
	}

	let { rows, start, end, cases = [], width = 760, labelWidth = 170 }: Props = $props();

	const rowHeight = 24;
	const tickRow = 26;
	const right = 12;

	/** A date as a fractional year, so bars start and stop on the day. */
	function yearValue(date: string): number {
		const [year, month = 1, day = 1] = date.split('-').map(Number);
		return year + (month - 1) / 12 + (day - 1) / 365;
	}

	function surname(name: string): string {
		return name.replace(/,?\s+(?:Jr\.|Sr\.|II|III)$/, '').trim().split(/\s+/).pop() ?? name;
	}

	const first = $derived(yearValue(start));
	const last = $derived(yearValue(end));
	const x = (date: string) => labelWidth + ((yearValue(date) - first) / Math.max(last - first, 0.1)) * (width - labelWidth - right);
	const marked = $derived(cases.filter((item) => item.decided).sort((one, two) => one.decided!.localeCompare(two.decided!)));
	const top = $derived(tickRow + (marked.length ? 14 : 0));
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
</script>

<figure class="bench-chart" aria-hidden="true">
	<div class="frame">
		<!-- Narrow drawings may shrink as far as wide ones, scale for scale, before the frame scrolls. -->
		<svg viewBox="0 0 {width} {height}" width="100%" role="presentation" style:min-width="{(width * 34) / 760}rem">
			{#each ticks as year (year)}
				<line class="grid" x1={tickX(year)} x2={tickX(year)} y1={top - 6} y2={height - 4} />
				<text class="tick" x={tickX(year)} y={tickRow - 12} text-anchor={tickX(year) > width - right - 16 ? 'end' : 'middle'}>{year}</text>
			{/each}
			{#each rows as row, index (row.name + row.role + row.from)}
				{@const y = top + index * rowHeight}
				{#if row.link}
					<a href={row.link} tabindex="-1" class="name-link">
						<text class="name" class:chief={row.role === 'Chief Justice'} x={labelWidth - 10} y={y + rowHeight / 2 + 4} text-anchor="end"
							>{surname(row.name)}</text
						>
					</a>
				{:else}
					<text class="name" class:chief={row.role === 'Chief Justice'} x={labelWidth - 10} y={y + rowHeight / 2 + 4} text-anchor="end"
						>{surname(row.name)}</text
					>
				{/if}
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
				{@const at = x(item.decided!)}
				{#if item.link}
					<a class="case" href={item.link} tabindex="-1">
						<title>{item.name}, {item.decidedText ?? item.decided}</title>
						<line x1={at} x2={at} y1={top - 5} y2={height - 4} />
						<path d="M {at} {top - 13} l 4 4 l -4 4 l -4 -4 z" />
						<!-- A wider strip to point at than the thin line. -->
						<rect class="hit" x={at - 5} y={top - 14} width="10" height={height - top + 10} />
					</a>
				{:else}
					<g class="case">
						<title>{item.name}, {item.decidedText ?? item.decided}</title>
						<line x1={at} x2={at} y1={top - 5} y2={height - 4} />
						<path d="M {at} {top - 13} l 4 4 l -4 4 l -4 -4 z" />
						<rect class="hit" x={at - 5} y={top - 14} width="10" height={height - top + 10} />
					</g>
				{/if}
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

	.name-link:hover .name {
		text-decoration: underline;
	}

	.bar {
		fill: var(--color-link);
		opacity: 0.75;
	}

	.bar.chief {
		fill: var(--color-action);
		opacity: 1;
	}

	.case line {
		stroke: var(--color-timeline-case);
		stroke-width: 1.5;
		stroke-dasharray: 3 3;
	}

	.case path {
		fill: var(--color-timeline-case);
	}

	.case .hit {
		fill: transparent;
	}

	a.case:hover line {
		stroke-dasharray: none;
		stroke-width: 2.5;
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
		.case path {
			fill: CanvasText;
		}

		.case line,
		.grid {
			stroke: CanvasText;
		}
	}
</style>
