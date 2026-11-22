<script lang="ts">
	// Label and value pairs for a nation's facts (site/DESIGN.md, "Summary list").
	// Each fact's source is listed in the page's Sources section, not beside it.
	interface FactGroup {
		field: string;
		label: string;
		items: {
			label?: string;
			text: string;
			link?: string;
			detail?: string;
			/** A detail with linked citations, such as a recognition status's legal basis. */
			detailParts?: { text: string; link?: string }[];
		}[];
	}

	let { groups }: { groups: FactGroup[] } = $props();
</script>

<dl class="summary-list">
	{#each groups as group (group.field)}
		<div>
			<dt>{group.label}</dt>
			<dd>
				<ul>
					{#each group.items as item, index (index)}
						<li>
							{#if item.label}{item.label}:{' '}{/if}{#if item.link}<a href={item.link}>{item.text}</a>{:else}{item.text}{/if}
							{#if item.detailParts}{' '}<span class="muted small"
									>({#each item.detailParts as part, partIndex (partIndex)}{#if part.link}<a
												href={part.link}>{part.text}</a
											>{:else}{part.text}{/if}{/each})</span
								>{:else if item.detail}{' '}<span class="muted small">({item.detail})</span>{/if}
						</li>
					{/each}
				</ul>
			</dd>
		</div>
	{/each}
</dl>
