<script lang="ts">
	// Label and value pairs for a nation's facts (site/DESIGN.md, "Summary list").
	// Each fact ends with the markers of its sources (CitationMarks).
	import type { CitationMark } from '#lib/citation-marks.ts';
	import CitationMarks from './CitationMarks.svelte';

	interface FactGroup {
		field: string;
		label: string;
		/** The id of a heading below that shows these facts in full; the label links to it. */
		section?: string;
		items: {
			label?: string;
			text: string;
			link?: string;
			detail?: string;
			/** A detail with linked citations, such as a recognition status's legal basis. */
			detailParts?: { text: string; link?: string }[];
			citations?: CitationMark[];
		}[];
	}

	let { groups }: { groups: FactGroup[] } = $props();
</script>

<dl class="summary-list">
	{#each groups as group (group.field)}
		<div>
			<dt>{#if group.section}<a href="#{group.section}">{group.label}</a>{:else}{group.label}{/if}</dt>
			<dd>
				<ul>
					{#each group.items as item, index (index)}
						<li>
							{#if item.label}{item.label}:{' '}{/if}{#if item.link}<a href={item.link}>{item.text}</a>{:else}{item.text}{/if}{#if item.detailParts}{' '}<span
									class="muted small"
									>({#each item.detailParts as part, partIndex (partIndex)}{#if part.link}<a
												href={part.link}>{part.text}</a
											>{:else}{part.text}{/if}{/each})</span
								>{:else if item.detail}{' '}<span class="muted small">({item.detail})</span
								>{/if}<CitationMarks marks={item.citations} />
						</li>
					{/each}
				</ul>
			</dd>
		</div>
	{/each}
</dl>
