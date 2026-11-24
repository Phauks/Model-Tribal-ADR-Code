<!--
	@component
	Who sat on one Court of the Supreme Court, and when: a row for each
	Justice, the Chief Justice first, with a bar for the part of their service
	that fell within the Court, and a line at the date of each case on this
	site that the Court decided, labeled with the case's short name and linked
	to the case (Trevor, Nov. 24, 2026: "should be clearer which case").
	Pointing at a label shows the full name and the date. Labels that would
	overlap go on separate lines. Hidden from screen readers, and its links
	kept out of the keyboard order, since the table of Justices and the
	table of cases under it say the same.

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
		/** The label: "Worcester". */
		shortName: string;
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
	const laneHeight = 17;
	const right = 12;
	/** About how wide a label of 12-pixel type is drawn, to keep labels apart. */
	const labelSpan = (text: string) => text.length * 7.4 + 12;

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

	/** Each case's label: centered on its line where it fits, on the first line of labels where it overlaps none. */
	const labels = $derived.by(() => {
		const laneEnds: number[] = [];
		return marked.map((item) => {
			const span = labelSpan(item.shortName);
			const at = x(item.decided!);
			const left = Math.min(Math.max(at - span / 2, labelWidth - 40), width - right - span);
			let lane = laneEnds.findIndex((end) => end <= left);
			if (lane === -1) lane = laneEnds.push(0) - 1;
			laneEnds[lane] = left + span + 6;
			return { item, at, center: left + span / 2, lane };
		});
	});
	const lanes = $derived(labels.reduce((most, label) => Math.max(most, label.lane + 1), 0));
	const top = $derived(tickRow + lanes * laneHeight + (lanes ? 4 : 0));
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
	const laneY = (lane: number) => tickRow + 4 + lane * laneHeight + 12;
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
			{#each labels as { item, at, lane } (item.key)}
				<line class="case" x1={at} x2={at} y1={laneY(lane) + 4} y2={height - 4} />
				<path class="case-mark" d="M {at} {top - 9} l 4 4 l -4 4 l -4 -4 z" />
			{/each}
			<!-- Labels last, so no case's line is drawn over another's label. -->
			{#each labels as { item, center, lane } (item.key)}
				{@const y = laneY(lane)}
				{#if item.link}
					<a class="case-label" href={item.link} tabindex="-1">
						<title>{item.name}, {item.decidedText ?? item.decided}</title>
						<text x={center} y={y} text-anchor="middle">{item.shortName}</text>
					</a>
				{:else}
					<g class="case-label">
						<title>{item.name}, {item.decidedText ?? item.decided}</title>
						<text x={center} y={y} text-anchor="middle">{item.shortName}</text>
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

	.case {
		stroke: var(--color-timeline-case);
		stroke-width: 1.5;
		stroke-dasharray: 3 3;
	}

	.case-mark {
		fill: var(--color-timeline-case);
	}

	.case-label text {
		fill: var(--color-timeline-case);
		font-size: 12px;
		font-weight: 700;
		paint-order: stroke;
		stroke: var(--color-paper);
		stroke-width: 5px;
		stroke-linejoin: round;
	}

	a.case-label:hover text {
		text-decoration: underline;
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

		.case-label text {
			fill: LinkText;
		}

		.case,
		.grid {
			stroke: CanvasText;
		}
	}
</style>
