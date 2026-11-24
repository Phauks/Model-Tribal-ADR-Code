<!--
	A nation's recognition badges (src/lib/recognition-badges.ts): a short
	label with an icon for each status it holds. Fill, border style and icon
	tell the kinds apart, so color is never the only cue: federal is filled,
	state is outlined, petitioning is a dashed outline, and the territorial and
	congressional statuses are outlined on the panel color. No federal
	recognition has no badge. The full wording is the tooltip and what a
	screen reader reads.

	On a nation's own page and in the Native nations table, a badge with an
	explanation is a button that opens a panel saying how the nation came to
	hold that status, when, and the document that shows it (Trevor, Nov. 23
	and 24, 2026; src/lib/recognition-explanation.ts).
	The panel is a native popover, so Escape and a click elsewhere close it.
-->
<script lang="ts">
	import FileClock from '@lucide/svelte/icons/file-clock';
	import Landmark from '@lucide/svelte/icons/landmark';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Scale from '@lucide/svelte/icons/scale';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import type { RecognitionBadge, RecognitionBadgeKind } from '#lib/recognition-badges.ts';
	import type { BadgeExplanation } from '#lib/recognition-explanation.ts';

	let {
		badges,
		size = 'normal',
		explanations
	}: { badges: RecognitionBadge[]; size?: 'normal' | 'small'; explanations?: Record<string, BadgeExplanation> } = $props();

	// Unique on the page, since a table shows one set of badges on every row.
	const own = $props.id();
	const panels: Record<string, HTMLElement | undefined> = $state({});
	const buttons: Record<string, HTMLElement | undefined> = $state({});

	function panelIdentifier(index: number): string {
		return `recognition-explanation-${own}-${index}`;
	}

	/** Opens the panel under its badge, inside the window. */
	function place(label: string) {
		const panel = panels[label];
		const button = buttons[label];
		if (!panel || !button) return;
		const box = button.getBoundingClientRect();
		const width = Math.min(panel.offsetWidth || 384, document.documentElement.clientWidth - 16);
		const left = Math.max(8, Math.min(box.left, document.documentElement.clientWidth - width - 8));
		panel.style.setProperty('--panel-top', `${box.bottom + 8}px`);
		panel.style.setProperty('--panel-left', `${left}px`);
	}

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
			{@const explanation = explanations?.[badge.label]}
			{#if explanation}
				<button
					bind:this={buttons[badge.label]}
					type="button"
					class="recognition-badge recognition-badge-{badge.kind} recognition-badge-button"
					popovertarget={panelIdentifier(index)}
					onclick={() => place(badge.label)}
				>
					<Icon size={size === 'small' ? 14 : 16} strokeWidth={2} aria-hidden="true" />
					<span aria-hidden="true">{badge.label}</span>
					<span class="visually-hidden">{badge.fullLabel}: how</span>
					<ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
				</button>
				<div
					bind:this={panels[badge.label]}
					id={panelIdentifier(index)}
					class="recognition-explanation"
					popover="auto"
					role="dialog"
					aria-label="How it is {explanation.label.toLowerCase()}"
				>
					<p class="recognition-explanation-heading">{explanation.label}</p>
					{#if explanation.lines.some((line) => line.legalBasis.length > 0)}
						<ul class="stacked-list">
							{#each explanation.lines.filter((line) => line.legalBasis.length > 0) as line, lineIndex (lineIndex)}
								<li>
									{#if line.how}<strong>{line.how}</strong>{line.since ? `, ${line.since}` : ''}{': '}{:else if line.since}{line.since}{': '}{/if}{#each line.legalBasis as part, partIndex (partIndex)}{#if part.link}<a
												href={part.link}>{part.text}</a
											>{:else}{part.text}{/if}{/each}
								</li>
							{/each}
						</ul>
					{/if}
					{#if explanation.gap}<p class="recognition-explanation-gap">{explanation.gap}</p>{/if}
				</div>
			{:else}
				<span class="recognition-badge recognition-badge-{badge.kind}" title={badge.fullLabel}>
					<Icon size={size === 'small' ? 14 : 16} strokeWidth={2} aria-hidden="true" />
					<span aria-hidden="true">{badge.label}</span>
					<span class="visually-hidden">{badge.fullLabel}{index < badges.length - 1 ? ';' : ''}</span>
				</span>
			{/if}
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
		/* A badge that is a button would otherwise take the browser's button fill, which the link color fails contrast on in the dark theme. */
		background: none;
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

	/* A badge that opens its explanation is a button that looks like the badge. */
	.recognition-badge-button {
		min-height: var(--layout-target-minimum);
		font-family: inherit;
		cursor: pointer;
	}

	/* In a table's small badges the button keeps the pill's height, still at least 24 px to tap (WCAG 2.5.8). */
	.recognition-badges-small .recognition-badge-button {
		min-height: 1.5rem;
	}

	.recognition-badge-button:hover {
		text-decoration: underline;
	}

	.recognition-badge-button:focus-visible {
		outline: 3px solid var(--color-focus, var(--color-link));
		outline-offset: 2px;
	}

	.recognition-explanation {
		position: fixed;
		inset: var(--panel-top, 6rem) auto auto var(--panel-left, var(--space-2));
		width: min(var(--layout-popover), calc(100vw - 2 * var(--space-2)));
		max-height: calc(100dvh - var(--panel-top, 6rem) - var(--space-3));
		overflow-y: auto;
		box-sizing: border-box;
		margin: 0;
		padding: var(--space-4);
		background: var(--color-surface-raised);
		color: var(--color-ink);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel);
		box-shadow: 0 var(--space-2) var(--space-5) color-mix(in srgb, var(--color-ink) 25%, transparent);
		font-size: var(--font-size-small);
		font-weight: normal;
		text-align: left;
		white-space: normal;
	}

	.recognition-explanation-heading {
		margin: 0 0 var(--space-2);
		font-weight: var(--font-weight-semibold);
	}


	.recognition-explanation-gap {
		margin: var(--space-2) 0 0;
		color: var(--color-ink-muted);
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
