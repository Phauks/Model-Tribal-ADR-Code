<!--
	@component
	A document's versions on a line, the shared timeline drawn small for one
	document (src/lib/timeline.ts places the dates; Timeline.svelte draws a
	nation's whole timeline). Each version is placed by the earliest date its
	sources give, so the gaps between versions show at a glance. It draws only
	recorded dates and kinds, never generated text. The list below it says the
	same things in words and links each version, so the drawing is hidden from
	screen readers and needs no scripts.

	Use:
	<DocumentTimeline versions={document.versions} />
-->
<script lang="ts">
	import type { VersionView } from '#lib/server/document-history.ts';
	import { yearOf } from '#lib/timeline.ts';

	let { versions }: { versions: VersionView[] } = $props();

	/** Labels this close to an end line up with that end, so they stay inside the line. */
	const edge = 12;

	const marks = $derived.by(() => {
		const dated = versions.filter((version) => version.date);
		if (dated.length < 2) return [];
		const years = dated.map((version) => yearOf(version.date ?? ''));
		const first = Math.min(...years);
		const span = Math.max(...years) - first || 1;
		return dated.map((version, index) => {
			const position = ((years[index] - first) / span) * 100;
			return {
				id: version.id,
				year: version.date?.slice(0, 4),
				event: version.event,
				inEffect: version.inEffect,
				position,
				side: index % 2 === 0 ? 'above' : 'below',
				align: position < edge ? 'start' : position > 100 - edge ? 'end' : 'middle'
			};
		});
	});
</script>

{#if marks.length > 0}
	<div class="timeline" aria-hidden="true">
		<div class="timeline-line"></div>
		{#each marks as mark (mark.id)}
			<div
				class="timeline-mark {mark.side} align-{mark.align}"
				class:in-effect={mark.inEffect}
				style:left="{mark.position}%"
			>
				<span class="timeline-dot"></span>
				<span class="timeline-label"><strong>{mark.year}</strong> {mark.event}</span>
			</div>
		{/each}
	</div>
	<p class="timeline-key small muted" aria-hidden="true">
		<span class="timeline-dot key-dot in-effect"></span> In effect
		<span class="timeline-dot key-dot"></span> No longer in effect
	</p>
{/if}

<style>
	.timeline {
		position: relative;
		height: 7.5rem;
		margin: var(--space-4) var(--space-2) 0;
		font-size: var(--font-size-small);
	}

	.timeline-line {
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		border-top: 2px solid var(--color-line);
	}

	.timeline-mark {
		position: absolute;
		top: 50%;
		width: 0;
	}

	.timeline-dot {
		display: inline-block;
		width: 0.875rem;
		height: 0.875rem;
		border: 2px solid var(--color-link);
		border-radius: 50%;
		background: var(--color-paper);
	}

	.timeline-mark .timeline-dot {
		position: absolute;
		top: 0;
		left: 0;
		transform: translate(-50%, -50%);
	}

	.in-effect .timeline-dot,
	.key-dot.in-effect {
		background: var(--color-link);
	}

	.timeline-label {
		position: absolute;
		width: max-content;
		max-width: 8.5rem;
		line-height: 1.25;
	}

	.timeline-label strong {
		display: block;
	}

	.above .timeline-label {
		bottom: 0.75rem;
	}

	.below .timeline-label {
		top: 0.75rem;
	}

	.align-middle .timeline-label {
		left: 0;
		transform: translateX(-50%);
		text-align: center;
	}

	.align-start .timeline-label {
		left: -0.4rem;
	}

	.align-end .timeline-label {
		right: -0.4rem;
		text-align: right;
	}

	.timeline-key {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-top: 0;
	}

	.key-dot {
		vertical-align: middle;
	}

	.key-dot + .key-dot,
	.timeline-key .key-dot:not(:first-child) {
		margin-left: var(--space-3);
	}
</style>
