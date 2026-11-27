<!--
	@component
	The section or chapter before and after this one in a code
	(design/title-25-navigation, option A): a thin line of two links under the
	lead, and two cards with the headings under the text.
-->
<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import type { Neighbor } from '#lib/code-outline.ts';

	let { previous, next, look = 'cards', line }: { previous?: Neighbor; next?: Neighbor; look?: 'line' | 'cards'; line?: 'number' | 'heading' } = $props();
	const label = (neighbor: Neighbor) => (line === 'heading' ? `${neighbor.number}. ${neighbor.heading}` : neighbor.number);
</script>

{#if previous || next}
	{#if look === 'line'}
		<nav class="pager-line no-print" aria-label="Previous and next">
			{#if previous}<a href={previous.link} rel="prev"><ChevronLeft size={14} aria-hidden="true" /><span>{label(previous)}</span></a>{:else}<span></span>{/if}
			{#if next}<a href={next.link} rel="next"><span>{label(next)}</span><ChevronRight size={14} aria-hidden="true" /></a>{/if}
		</nav>
	{:else}
		<nav class="pager-cards no-print" aria-label="Previous and next">
			{#if previous}
				<a class="previous" href={previous.link} rel="prev"><small><ChevronLeft size={14} aria-hidden="true" />Previous</small><span><strong>{previous.number}</strong> {previous.heading}</span></a>
			{:else}<span></span>{/if}
			{#if next}
				<a class="next" href={next.link} rel="next"><small>Next<ChevronRight size={14} aria-hidden="true" /></small><span><strong>{next.number}</strong> {next.heading}</span></a>
			{/if}
		</nav>
	{/if}
{/if}

<style>
	.pager-line {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin: 0 0 1.25rem;
		padding: 0.5rem 0;
		border-block: 1px solid var(--color-line);
		font-size: 0.92rem;
	}

	.pager-line a {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--color-link);
		text-decoration: none;
	}

	.pager-line a span {
		text-decoration: underline;
	}

	.pager-cards {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin: 2rem 0 1rem;
	}

	.pager-cards a {
		display: block;
		border: 1px solid var(--color-line);
		border-radius: 10px;
		padding: 0.75rem 1rem;
		background: var(--color-surface-raised);
		color: var(--color-ink);
		text-decoration: none;
	}

	.pager-cards a:hover {
		border-color: var(--color-link);
	}

	.pager-cards small {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-bottom: 0.2rem;
		color: var(--color-ink-muted);
		font-size: 0.8rem;
	}

	.pager-cards strong {
		color: var(--color-link);
	}

	.pager-cards .next {
		text-align: right;
	}

	.pager-cards .next small {
		justify-content: flex-end;
	}

	@media (max-width: 44rem) {
		.pager-cards {
			grid-template-columns: 1fr;
		}
	}
</style>
