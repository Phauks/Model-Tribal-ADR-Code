<!--
	@component
	The "At a glance" panel of a record page (site/DESIGN.md, "Record pages"):
	a filled box, like a reference work's fact box, with an optional picture on
	top (such as a nation's seal) and the key facts under a heading the reader
	can fold away. It takes any content, usually FactGroups and a map.

	On a phone the panel comes before the page's sections, so it shows its
	first few facts and keeps the rest, and anything marked
	`data-glance-more` (such as a map), behind a "Show all" button (Trevor
	chose this on Nov. 26, 2026; project files design/at-a-glance-review/).
	Without scripts, beside the text, and on paper, everything shows.

	Use:
	<GlancePanel facts={data.glance.length} more="the map">
		{#snippet picture()}<figure>…</figure>{/snippet}
		<FactGroups groups={data.glance} />
		<div data-glance-more>…map…</div>
	</GlancePanel>
-->
<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { glancePhoneRows } from '#lib/info-page.ts';
	import Collapsible from './Collapsible.svelte';

	interface Props {
		heading?: string;
		/** The heading's id, unique on the page. */
		identifier?: string;
		/** How many facts the panel lists, so a phone can say how many "Show all" brings. */
		facts?: number;
		/** What else waits behind "Show all" on a phone, such as "the map", marked data-glance-more. */
		more?: string;
		picture?: Snippet;
		children: Snippet;
	}

	let { heading = 'At a glance', identifier = 'glance-heading', facts = 0, more, picture, children }: Props = $props();

	let unfolded = $state(false);
	let box = $state<HTMLElement>();

	/** Shows everything, and moves focus to the first part that was hidden, since the button goes away. */
	async function unfold() {
		unfolded = true;
		await tick();
		const first = box?.querySelector<HTMLElement>(`.summary-list > div:nth-child(${glancePhoneRows + 1}), [data-glance-more]`);
		if (!first) return;
		first.tabIndex = -1;
		first.focus({ preventScroll: true });
	}
	const showAll = $derived.by(() => {
		const rest = facts > glancePhoneRows;
		if (rest && more) return `Show all ${facts} facts and ${more}`;
		if (rest) return `Show all ${facts} facts`;
		return more ? `Show ${more}` : undefined;
	});
</script>

<div class="glance-box" class:unfolded bind:this={box}>
	{@render picture?.()}
	<Collapsible {heading} {identifier}>
		{@render children()}
		{#if showAll && !unfolded}
			<button type="button" class="button button-quiet show-all no-print" onclick={unfold}>{showAll}</button>
		{/if}
	</Collapsible>
</div>

<style>
	.glance-box {
		padding: var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface);
	}

	.glance-box > :global(.collapsible) {
		margin-top: 0;
	}

	.show-all {
		display: none;
		margin-top: var(--space-4);
	}

	/*
	 * Only on screen, where the panel sits above the text (RecordPage.svelte
	 * puts it beside the text from 52 rem), and only with scripts, which the
	 * button needs. The 5 is glancePhoneRows plus one (src/lib/info-page.ts).
	 */
	@media screen {
		@container page not (min-width: 52rem) {
			:global(:root[data-scripts='on']) .glance-box:not(.unfolded) :global(.summary-list > div:nth-child(n + 5)),
			:global(:root[data-scripts='on']) .glance-box:not(.unfolded) :global([data-glance-more]) {
				display: none;
			}

			:global(:root[data-scripts='on']) .show-all {
				display: inline-flex;
			}
		}
	}
</style>
