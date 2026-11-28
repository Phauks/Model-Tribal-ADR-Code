<script lang="ts">
	// Every Native nation in one table, the Directory of the Nations section; it left /nations, which became the section's own page, on Nov. 28, 2026.
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import NationTable from '#lib/components/NationTable.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Directory of Native nations · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs trail={[{ label: 'Nations', href: '/nations' }]} current="Directory" />
<h1>
	Native nations{#if data.nationGroup}{' '}<CountBadge count={data.nationGroup.rows.length} label="nations" />{/if}
</h1>
{#if data.example}
	<div class="notice" role="note">
		<p>The nation records are not published yet. The page below is a fictitious example that shows the layout.</p>
	</div>
{/if}

{#if data.nationGroup}
	<!-- No search box: the site search at the top finds a nation, and the Name column filters by name (Trevor, Nov. 24, 2026). -->
	<NationTable group={data.nationGroup} identifier="nations" regions count={false} />
{/if}

{#each data.otherGroups as group (group.entityType)}
	<section aria-labelledby="group-{group.entityType}">
		<NationTable {group} identifier="nations-{group.entityType}" headingLevel={2} headingIdentifier="group-{group.entityType}" />
	</section>
{/each}
