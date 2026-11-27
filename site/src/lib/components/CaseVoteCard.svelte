<!--
	@component
	The card for one Supreme Court case on the Justice timelines: its name,
	citation and date, the outcome, and who was in the majority, who dissented
	and who took no part, with each opinion's writer named; buttons step to the
	earlier or later case, copy the citation and open the case (Trevor, Nov.
	27, 2026: "while hovering over a case, showcase the name of the case, show
	which justices were involved"). Pointing, keyboard focus and a tap all open
	it, so it never depends on hover.

	It is drawn in the top layer (a manual popover), so a section that clips
	its content cannot cut it off, beside `anchor` (the mark's box on screen),
	or on a narrow screen as a sheet along the bottom of the window.

	Use:
	<CaseVoteCard item={chosen} anchor={box} position="29 of 132" onstep={step} onclose={close} />
-->
<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Copy from '@lucide/svelte/icons/copy';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Scale from '@lucide/svelte/icons/scale';
	import X from '@lucide/svelte/icons/x';
	import { outcomeText, voteLabels, type BenchVote, type ChartCase } from '#lib/bench-chart.ts';
	import { copyText } from '#lib/clipboard.ts';

	interface Props {
		item: ChartCase;
		/** Where the mark is on screen; the card opens beside it. */
		anchor?: { left: number; right: number; top: number; bottom: number };
		/** "29 of 132". */
		position?: string;
		/** Name the Court after the outcome, where the list around the card does not. */
		showCourt?: boolean;
		/** Open as a sheet along the bottom of the window, with a close button. */
		sheet?: boolean;
		onstep?: (by: number) => void;
		onclose?: () => void;
		onpointerenter?: () => void;
		onpointerleave?: () => void;
		id?: string;
	}

	let { item, anchor, position, showCourt = false, sheet = false, onstep, onclose, onpointerenter, onpointerleave, id }: Props = $props();

	let card = $state<HTMLDivElement>();
	let copied = $state('');
	const width = 320;

	const groups = $derived(
		(['majority', 'dissent', 'none', 'unknown'] as BenchVote[])
			.map((vote) => ({ vote, votes: item.votes.filter((each) => each.vote === vote) }))
			.filter((group) => group.votes.length > 0)
	);

	/** The citation as copied: "Donnelly v. United States, 228 U.S. 243 (1913)". */
	const citationText = $derived(`${item.name}, ${item.citation}${item.decided ? ` (${item.decided.slice(0, 4)})` : ''}`);

	async function copy() {
		try {
			await copyText(citationText);
			copied = 'Citation copied';
		} catch {
			copied = citationText;
		}
	}

	// Into the top layer, then beside the mark: to its right where it fits, else to its left.
	$effect(() => {
		if (!card) return;
		if (!card.matches(':popover-open')) card.showPopover?.();
		if (sheet || !anchor) return;
		const room = window.innerWidth;
		const left = anchor.right + 16 + width <= room - 8 ? anchor.right + 16 : Math.max(8, anchor.left - width - 16);
		const height = card.offsetHeight;
		const top = Math.max(8, Math.min(anchor.top, window.innerHeight - height - 8));
		card.style.left = `${left}px`;
		card.style.top = `${top}px`;
	});

	$effect(() => {
		void item;
		copied = '';
	});
</script>

{#snippet voteIcon(vote: BenchVote)}
	<svg class="vote-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
		{#if vote === 'majority'}
			<circle cx="8" cy="8" r="5" class="majority" />
		{:else if vote === 'dissent'}
			<path d="M3.8 3.8L12.2 12.2M12.2 3.8L3.8 12.2" class="dissent" />
		{:else if vote === 'none'}
			<path d="M4 8H12" class="none" />
		{:else}
			<circle cx="8" cy="8" r="4" class="unknown" />
		{/if}
	</svg>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -- pointing at the card keeps it open; it is not a control -->
<div
	bind:this={card}
	{id}
	class="case-vote-card"
	class:sheet
	popover="manual"
	role="group"
	aria-label={item.name}
	style:width={sheet ? undefined : `${width}px`}
	onpointerenter={() => onpointerenter?.()}
	onpointerleave={() => onpointerleave?.()}
>
	{#if sheet}
		<span class="grip" aria-hidden="true"></span>
		<button type="button" class="icon-button close" aria-label="Close" title="Close" onclick={() => onclose?.()}><X size={20} aria-hidden="true" /></button>
	{/if}
	<p class="kind"><Scale size={16} aria-hidden="true" /> Supreme Court{#if item.decidedText}{' '}· {item.decidedText}{/if}</p>
	<p class="title"><i>{item.name}</i>, {item.citation}</p>
	<p class="outcome">{outcomeText(item)}{#if showCourt}{' '}· {#if item.courtLink}<a href={item.courtLink}>{item.court}</a>{:else}{item.court}{/if}{/if}</p>
	{#each groups as group (group.vote)}
		<p class="side">
			{@render voteIcon(group.vote)}
			<span
				><b>{voteLabels[group.vote]}</b>{#if group.vote === 'majority' || group.vote === 'dissent'}{' '}<span class="muted">{group.votes.length}</span>{/if}
				·{#each group.votes as vote, index (vote.person)}{index > 0 ? ',' : ''}
					{vote.name}{#if vote.opinion}{' '}<span class="muted">({vote.opinion})</span>{/if}{/each}</span
			>
		</p>
	{/each}
	<div class="actions">
		{#if onstep}
			<button type="button" class="icon-button" aria-label="Earlier case" title="Earlier case" onclick={() => onstep(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
			<button type="button" class="icon-button" aria-label="Later case" title="Later case" onclick={() => onstep(1)}><ChevronRight size={20} aria-hidden="true" /></button>
		{/if}
		<span class="position">{position ?? ''}</span>
		<button type="button" class="icon-button" aria-label="Copy the citation" title="Copy the citation" onclick={copy}><Copy size={18} aria-hidden="true" /></button>
		{#if item.link}
			<a class="icon-button open" href={item.link} aria-label="Open the case" title="Open the case"><ExternalLink size={20} aria-hidden="true" /></a>
		{/if}
	</div>
	<p class="status small" role="status">{copied}</p>
</div>

<style>
	.case-vote-card {
		position: fixed;
		inset: auto;
		margin: 0;
		max-width: calc(100vw - 16px);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		box-shadow: 0 8px 24px color-mix(in srgb, var(--color-ink) 18%, transparent);
		color: var(--color-ink);
		font-size: var(--font-size-small);
		text-align: left;
		overflow: visible;
	}

	.sheet {
		left: 0;
		right: 0;
		bottom: 0;
		top: auto;
		max-width: none;
		max-height: 70vh;
		overflow-y: auto;
		border-radius: 14px 14px 0 0;
		padding: var(--space-3) var(--space-4);
		box-shadow: 0 -6px 24px color-mix(in srgb, var(--color-ink) 22%, transparent);
	}

	.grip {
		display: block;
		width: 40px;
		height: 4px;
		margin: -4px auto var(--space-2);
		border-radius: 2px;
		background: var(--color-line);
	}

	.close {
		position: absolute;
		top: 6px;
		right: 6px;
	}

	p {
		margin: 0;
	}

	.kind {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-timeline-case);
	}

	.title {
		margin: var(--space-1) 0 2px;
		font-size: var(--font-size-body);
		line-height: 1.35;
	}

	.outcome {
		margin-bottom: var(--space-2);
		color: var(--color-ink-muted);
	}

	.side {
		display: grid;
		grid-template-columns: 18px 1fr;
		gap: 0 4px;
		margin-top: 4px;
		line-height: 1.45;
	}

	.side b {
		font-weight: 600;
	}

	.muted,
	.position,
	.status {
		color: var(--color-ink-muted);
	}

	.vote-icon {
		margin-top: 3px;
		overflow: visible;
	}

	.vote-icon .majority {
		fill: var(--color-vote-majority);
	}

	.vote-icon .dissent {
		fill: none;
		stroke: var(--color-vote-dissent);
		stroke-width: 2.4;
		stroke-linecap: round;
	}

	.vote-icon .none {
		stroke: var(--color-ink-muted);
		stroke-width: 2.4;
		stroke-linecap: round;
	}

	.vote-icon .unknown {
		fill: none;
		stroke: var(--color-ink-muted);
		stroke-width: 1.5;
		stroke-dasharray: 2 2;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin-top: var(--space-2);
		padding-top: var(--space-1);
		border-top: 1px solid var(--color-line);
	}

	.position {
		margin-right: auto;
		padding-left: 4px;
	}

	.open {
		color: var(--color-link);
	}

	.status:empty {
		display: none;
	}

	@media (forced-colors: active) {
		.vote-icon .majority {
			fill: CanvasText;
		}

		.vote-icon .dissent,
		.vote-icon .none,
		.vote-icon .unknown {
			stroke: CanvasText;
		}
	}
</style>
