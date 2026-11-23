<!--
	A nation's recognition badges (src/lib/recognition-badges.ts): a short
	label with an icon for each status it holds. Fill, border style and icon
	tell the kinds apart, so color is never the only cue: federal is filled,
	state is outlined, petitioning is a dashed outline, and the territorial and
	congressional statuses are outlined on the panel color. No federal
	recognition has no badge. The full wording is the tooltip and what a
	screen reader reads.
-->
<script lang="ts">
	import FileClock from '@lucide/svelte/icons/file-clock';
	import Landmark from '@lucide/svelte/icons/landmark';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Scale from '@lucide/svelte/icons/scale';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import type { RecognitionBadge, RecognitionBadgeKind } from '#lib/recognition-badges.ts';

	let { badges, size = 'normal' }: { badges: RecognitionBadge[]; size?: 'normal' | 'small' } = $props();

	const icons: Record<RecognitionBadgeKind, typeof Landmark> = {
		federal: Landmark,
		state: MapPin,
		petitioning: FileClock,
		territorial: ScrollText,
		congressional: Scale
	};
</script>

{#if badges.length > 0}
	<span class="recognition-badges recognition-badges-{size}">
		<span class="visually-hidden">Recognition:</span>
		{#each badges as badge, index (badge.label)}
			{@const Icon = icons[badge.kind]}
			<span class="recognition-badge recognition-badge-{badge.kind}" title={badge.fullLabel}>
				<Icon size={size === 'small' ? 14 : 16} strokeWidth={2} aria-hidden="true" />
				<span aria-hidden="true">{badge.label}</span>
				<span class="visually-hidden">{badge.fullLabel}{index < badges.length - 1 ? ';' : ''}</span>
			</span>
		{/each}
	</span>
{/if}

<style>
	.recognition-badges {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		vertical-align: middle;
	}

	.recognition-badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0 var(--space-2) 0 calc(var(--space-2) - 2px);
		border: 2px solid var(--color-link);
		border-radius: 999px;
		color: var(--color-link);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		line-height: 1.5;
		white-space: nowrap;
	}

	.recognition-badges-small .recognition-badge {
		border-width: 1.5px;
		font-size: 0.875em;
	}

	/* Federal: filled. The link color is dark in the light theme and light in the dark one, so paper text reads on it in both. */
	.recognition-badge-federal {
		background: var(--color-link);
		color: var(--color-paper);
	}

	/* Petitioning: a dashed outline, for a status still being decided. */
	.recognition-badge-petitioning {
		border-style: dashed;
		border-color: var(--color-control-border);
		color: var(--color-ink-muted);
	}

	.recognition-badge-territorial,
	.recognition-badge-congressional {
		border-color: var(--color-control-border);
		background: var(--color-surface);
		color: var(--color-ink);
	}

	/* Paper may drop backgrounds, so a filled badge prints as a solid outline. */
	@media print {
		.recognition-badge,
		.recognition-badge-federal {
			background: none;
			color: var(--color-ink);
		}

		.recognition-badge-federal {
			border-color: var(--color-ink);
		}
	}
</style>
