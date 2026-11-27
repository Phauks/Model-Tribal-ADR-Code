<!--
	@component
	A page's one or two key facts as a line of words, where they are too few
	for an Key facts panel (src/lib/info-page.ts, glancePanelMinimum): "Decided
	May 10, 1921" after a case's citation, or "Nation Comanche Nation ·
	Treaties signed …" under a person's lead. Each fact keeps its links and
	source markers, as in FactGroups, and a short note such as a person's role
	in a case; a note that is a sentence stays out of the line.

	Use: <FactLine groups={facts} />
-->
<script lang="ts">
	import type { CitationMark } from '#lib/citation-marks.ts';
	import CitationMarks from './CitationMarks.svelte';

	interface Props {
		groups: { field: string; label: string; items: { text: string; link?: string; detail?: string; citations?: CitationMark[] }[] }[];
	}

	let { groups }: Props = $props();
</script>

{#each groups as group, index (group.field)}{#if index > 0}{' · '}{/if}<span class="fact"
		>{group.label}{' '}{#each group.items as item, itemIndex (itemIndex)}{#if itemIndex > 0}{'; '}{/if}{#if item.link}<a href={item.link}>{item.text}</a>{:else}{item.text}{/if}{#if item.detail && !item.detail.includes('.')}{' '}({item.detail}){/if}<CitationMarks
				marks={item.citations ?? []}
			/>{/each}</span
	>{/each}
