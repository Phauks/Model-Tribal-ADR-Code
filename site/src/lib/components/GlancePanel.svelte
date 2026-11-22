<!--
	@component
	The "At a glance" panel of a record page (site/DESIGN.md, "Record pages"):
	a filled box, like a reference work's fact box, with an optional picture on
	top (such as a nation's seal) and the key facts under a heading the reader
	can fold away. It takes any content, usually FactGroups and a map.

	Use:
	<GlancePanel>
		{#snippet picture()}<figure>…</figure>{/snippet}
		<FactGroups groups={data.glance} />
	</GlancePanel>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Collapsible from './Collapsible.svelte';

	interface Props {
		heading?: string;
		/** The heading's id, unique on the page. */
		identifier?: string;
		picture?: Snippet;
		children: Snippet;
	}

	let { heading = 'At a glance', identifier = 'glance-heading', picture, children }: Props = $props();
</script>

<div class="glance-box">
	{@render picture?.()}
	<Collapsible {heading} {identifier}>
		{@render children()}
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
</style>
