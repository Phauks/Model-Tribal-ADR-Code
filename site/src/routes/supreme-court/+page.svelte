<!--
	@component
	The Supreme Court of the United States: the Courts that decided a case
	this site cites, each named for its Chief Justice, oldest first; then every
	Justice and every President who appointed one, each with a page.
-->
<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const justiceColumns: TableColumn[] = [
		{ key: 'name', header: 'Justice', isRowHeader: true, sortable: true },
		{ key: 'roles', header: 'Role', sortable: true },
		{ key: 'years', header: 'Years', sortable: true },
		{ key: 'appointedBy', header: 'Appointed by', sortable: true },
		{ key: 'cases', header: 'Cases on this site', type: 'number', sortable: true }
	];
	const justiceRows: TableRow[] = $derived(
		data.justices.map((justice) => ({
			key: justice.key,
			cells: {
				name: { text: justice.name, href: justice.link },
				roles: { text: justice.roles },
				years: { text: justice.years, sortValue: justice.start },
				appointedBy: { text: justice.appointedBy.join(', ') },
				cases: { text: String(justice.cases), sortValue: justice.cases }
			}
		}))
	);

	const presidentColumns: TableColumn[] = [
		{ key: 'name', header: 'President', isRowHeader: true, sortable: true },
		{ key: 'years', header: 'Years', sortable: true },
		{ key: 'justices', header: 'Justices appointed', type: 'number', sortable: true },
		{ key: 'cases', header: 'Cases on this site', type: 'number', sortable: true }
	];
	const presidentRows: TableRow[] = $derived(
		data.presidents.map((president) => ({
			key: president.key,
			cells: {
				name: { text: president.name, href: president.link },
				years: { text: president.years, sortValue: president.start },
				justices: { text: String(president.justices), sortValue: president.justices },
				cases: { text: String(president.cases), sortValue: president.cases }
			}
		}))
	);
</script>

<svelte:head>
	<title>Supreme Court · Model Tribal ADR Code</title>
</svelte:head>

<Breadcrumbs trail={[{ label: 'Library', href: '/library' }]} />

<div class="reading">
	<h1>Supreme Court of the United States</h1>
	<ul class="court-list">
		{#each data.courts as court (court.key)}
			<li>
				<a href="/supreme-court/{court.key}">{court.name}</a>
				<span class="muted">{court.years}</span>
				<CountBadge count={court.cases} label={court.cases === 1 ? 'case' : 'cases'} />
			</li>
		{/each}
	</ul>
</div>

<section aria-labelledby="justices">
	<h2 id="justices">Justices <CountBadge count={data.justices.length} /></h2>
	<DataTable identifier="justices" label="Table: Justices of the Supreme Court" columns={justiceColumns} rows={justiceRows} rowName={['Justice', 'Justices']} download="supreme-court-justices" searchLabel="Search Justices" />
</section>

<section aria-labelledby="presidents">
	<h2 id="presidents">Presidents <CountBadge count={data.presidents.length} /></h2>
	<DataTable identifier="presidents" label="Table: Presidents who appointed a Justice" columns={presidentColumns} rows={presidentRows} rowName={['President', 'Presidents']} download="supreme-court-presidents" />
</section>

<style>
	.court-list {
		padding: 0;
		list-style: none;
	}

	.court-list li {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}
</style>
