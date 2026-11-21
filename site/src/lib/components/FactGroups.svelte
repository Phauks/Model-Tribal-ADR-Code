<script lang="ts">
	// Label and value pairs for a nation's facts (site/DESIGN.md, "Summary list").
	// Each fact's source is listed in the page's Sources section, not beside it.
	interface FactGroup {
		field: string;
		label: string;
		items: { label?: string; text: string; link?: string; linkHint?: string; detail?: string }[];
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
							{#if item.label}{item.label}:{' '}{/if}{#if item.link}<a href={item.link}
									>{item.text}{#if item.linkHint}<span class="visually-hidden">
											{item.linkHint}</span
										>{/if}</a
								>{:else}{item.text}{/if}
							{#if item.detail}{' '}<span class="muted small">({item.detail})</span>{/if}
						</li>
					{/each}
				</ul>
			</dd>
		</div>
	{/each}
</dl>
