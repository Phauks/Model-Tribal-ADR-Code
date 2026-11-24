<script lang="ts">
	import CountBadge from '#lib/components/CountBadge.svelte';
	import NationTable from '#lib/components/NationTable.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Native nations · Model Tribal ADR Code</title>
</svelte:head>

<h1>
	Native nations{#if data.nationGroup}{' '}<CountBadge count={data.nationGroup.rows.length} label="nations" />{/if}
</h1>
{#if data.example}
	<div class="notice" role="note">
		<p>The nation records are not published yet. The page below is a fictitious example that shows the layout.</p>
	</div>
{/if}

{#if data.nationGroup}
	<NationTable group={data.nationGroup} identifier="nations" searchLabel="Search Native nations" regions count={false} />
{/if}

{#each data.otherGroups as group (group.entityType)}
	<section aria-labelledby="group-{group.entityType}">
		<h2 id="group-{group.entityType}">{group.label} <CountBadge count={group.rows.length} /></h2>
		<NationTable {group} identifier="nations-{group.entityType}" count={false} />
	</section>
{/each}
