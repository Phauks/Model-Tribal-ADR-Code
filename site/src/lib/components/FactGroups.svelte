<script lang="ts">
	import NoteMarkers from './NoteMarkers.svelte';
	import ReportLink from './ReportLink.svelte';

	interface FactGroup {
		field: string;
		label: string;
		items: { text: string; link?: string; detail?: string; notes: number[] }[];
	}

	let { groups, record }: { groups: FactGroup[]; record: string } = $props();
</script>

<dl class="summary-list">
	{#each groups as group (group.field)}
		<div>
			<dt>
				{group.label}
				<br /><ReportLink {record} field={group.field} label={group.label} />
			</dt>
			<dd>
				<ul>
					{#each group.items as item, index (index)}
						<li>
							{#if item.link}<a href={item.link}>{item.text}</a>{:else}{item.text}{/if}<NoteMarkers
								numbers={item.notes}
							/>
							{#if item.detail}<span class="muted small"> ({item.detail})</span>{/if}
						</li>
					{/each}
				</ul>
			</dd>
		</div>
	{/each}
</dl>
