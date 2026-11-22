<!--
	@component
	A page section that a reader can fold away, with its heading as the
	control (Trevor asked for collapsible sections on Nov. 22, 2026). It is the
	browser's own <details> element, so it works without scripts, starts open,
	and find-in-page still reaches folded text in current browsers. Every
	folded section is opened before printing (PrintOptions.svelte), so paper
	always has the whole page.

	Use:
	<Collapsible heading="Published law" identifier="law-heading">…</Collapsible>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	interface Props {
		heading: string;
		/** The heading's id, unique on the page. */
		identifier: string;
		/** The part's name in the print dialog (data-print-part), if it has one. */
		printPart?: string;
		/** Extra classes for the section, such as a layout class. */
		class?: string;
		children: Snippet;
	}

	let { heading, identifier, printPart, class: extraClass = '', children }: Props = $props();
</script>

<details class="collapsible {extraClass}" open data-print-part={printPart}>
	<summary>
		<span class="fold-mark no-print"><ChevronDown size={24} /></span>
		<h2 id={identifier}>{heading}</h2>
	</summary>
	{@render children()}
</details>

<style>
	.collapsible {
		margin-top: var(--space-5);
	}

	summary {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		list-style: none;
		cursor: pointer;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary h2 {
		margin: var(--space-3) 0;
	}

	.fold-mark {
		display: inline-flex;
		flex: none;
		transition: transform 0.15s;
	}

	.collapsible:not([open]) .fold-mark {
		transform: rotate(-90deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.fold-mark {
			transition: none;
		}
	}
</style>
