<!--
	@component
	One President of the United States, laid out like a nation's page (Trevor,
	Nov. 27, 2026: "U.S. President pages should be treated like a nation page,
	and have left nav and different sections. we should show executive orders
	and other things they signed on their pages as well";
	design/president-pages/mockup/A-*.png, approved the same day). The
	portrait and key facts beside the opening, then a section each for the
	executive orders and proclamations the President signed, the treaties they
	proclaimed, the Acts of Congress that became law in the term, the Justices
	they appointed, the Supreme Court cases decided in the term and, for a
	President who appointed Justices, the cases those Justices heard. The side
	column lists the sections (page.data.outline).
-->
<script lang="ts">
	import BenchChart from '#lib/components/BenchChart.svelte';
	import CitationMarks from '#lib/components/CitationMarks.svelte';
	import Collapsible from '#lib/components/Collapsible.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import InfoPage from '#lib/components/InfoPage.svelte';
	import { readableDate } from '#lib/readable-date.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const orderColumns: TableColumn[] = [
		{ key: 'date', header: 'Signed', type: 'date', sortable: true },
		{ key: 'title', header: 'Order', isRowHeader: true, sortable: true },
		{ key: 'kind', header: 'Kind', sortable: true }
	];
	const orderRows: TableRow[] = $derived(
		data.orders.map((order) => ({
			key: order.key,
			cells: {
				date: { text: order.dateText, sortValue: order.date },
				title: { text: order.title, href: order.link },
				kind: { text: order.kind ?? '' }
			}
		}))
	);

	const treatyColumns: TableColumn[] = [
		{ key: 'date', header: 'Proclaimed', type: 'date', sortable: true },
		{ key: 'title', header: 'Treaty', isRowHeader: true, sortable: true },
		{ key: 'signed', header: 'Signed', type: 'date', sortable: true },
		{ key: 'citation', header: 'Citation', sortable: true }
	];
	const treatyRows: TableRow[] = $derived(
		data.treaties.map((treaty) => ({
			key: treaty.key,
			cells: {
				date: { text: treaty.dateText, sortValue: treaty.date },
				title: { text: treaty.title, href: treaty.link },
				signed: { text: treaty.signedText ?? '', sortValue: treaty.signed ?? '' },
				citation: { text: treaty.citation ?? '' }
			}
		}))
	);

	const actColumns: TableColumn[] = [
		{ key: 'date', header: 'Became law', type: 'date', sortable: true },
		{ key: 'title', header: 'Act', isRowHeader: true, sortable: true },
		{ key: 'citation', header: 'Citation', sortable: true }
	];
	const actRows: TableRow[] = $derived(
		data.acts.map((act) => ({
			key: act.key,
			cells: {
				date: { text: act.dateText, sortValue: act.date },
				title: { text: act.title, href: act.link },
				citation: { text: act.citation ?? '' }
			}
		}))
	);

	const decidedColumns: TableColumn[] = [
		{ key: 'decided', header: 'Decided', type: 'date', sortable: true },
		{ key: 'name', header: 'Case', isRowHeader: true, sortable: true, custom: true },
		{ key: 'court', header: 'Court', sortable: true },
		{ key: 'vote', header: 'Vote', sortable: true }
	];
	const decidedRows: TableRow[] = $derived(
		data.decided.map((item) => ({
			key: item.key,
			cells: {
				decided: { text: item.decidedText, sortValue: item.decided },
				name: { text: `${item.name}, ${item.citation}`, href: item.link, sortValue: item.name },
				court: { text: item.court, href: item.courtLink },
				vote: { text: item.vote ?? '' }
			}
		}))
	);
	const decidedByKey = $derived(new Map(data.decided.map((item) => [item.key, item])));

	const justiceColumns: TableColumn[] = [
		{ key: 'name', header: 'Justice', isRowHeader: true, sortable: true },
		{ key: 'role', header: 'Role', sortable: true },
		{ key: 'joined', header: 'Joined the Court', type: 'date', sortable: true },
		{ key: 'left', header: 'Left the Court', type: 'date', sortable: true },
		{ key: 'cases', header: 'Cases on this site', type: 'number', sortable: true }
	];
	const justiceRows: TableRow[] = $derived(
		data.appointees.map((justice) => ({
			key: justice.key,
			cells: {
				name: { text: justice.name, href: justice.link },
				role: { text: justice.role },
				joined: { text: readableDate(justice.joined), sortValue: justice.joined },
				left: { text: justice.left ? readableDate(justice.left) : 'Serving', sortValue: justice.left ?? '9999' },
				cases: { text: String(justice.cases), sortValue: justice.cases }
			}
		}))
	);

	const caseColumns: TableColumn[] = [
		{ key: 'name', header: 'Case', isRowHeader: true, sortable: true, custom: true },
		{ key: 'decided', header: 'Decided', type: 'date', sortable: true },
		{ key: 'court', header: 'Court', sortable: true },
		{ key: 'vote', header: 'Vote', sortable: true },
		{ key: 'parts', header: 'Appointees', sortable: true, custom: true }
	];
	const caseRows: TableRow[] = $derived(
		data.cases.map((item) => ({
			key: item.key,
			cells: {
				name: { text: `${item.name}, ${item.citation}`, href: item.link, sortValue: item.name },
				decided: { text: item.decidedText ?? '', sortValue: item.decided ?? '' },
				court: { text: item.court, href: item.courtLink },
				vote: { text: item.vote ?? '' },
				parts: { text: item.parts.map((part) => `${part.name}: ${part.part}`).join('; ') }
			}
		}))
	);
	const caseByKey = $derived(new Map(data.cases.map((item) => [item.key, item])));
</script>

<svelte:head>
	<title>{data.name} · U.S. Presidents · Tribal Law Project</title>
	<meta name="description" content="{data.name}, {data.summary}: the executive orders, treaties and Acts on this site from the term, the Justices appointed, and the Supreme Court cases decided." />
</svelte:head>

<InfoPage title={data.name} lead={data.summary} picture={data.portrait} glance={data.glance} sources={data.sources} trail={[{ label: 'U.S. Presidents', href: '/stats/presidents' }]}>
	<Collapsible heading="Executive orders and proclamations" identifier="orders-heading" count={data.orders.length || undefined}>
		{#if data.orders.length > 0}
			<DataTable identifier="orders-{data.key}" label="Table: executive orders and proclamations signed by {data.name}" columns={orderColumns} rows={orderRows} rowName={['order', 'orders']} download="{data.key}-orders" />
			{#if data.ordersLink}<p class="small section-foot"><a href={data.ordersLink}>Open in Executive Orders</a></p>{/if}
		{:else}
			<p>None Identified</p>
		{/if}
	</Collapsible>

	<Collapsible heading="Treaties proclaimed" identifier="treaties-heading" count={data.treaties.length || undefined}>
		{#if data.treaties.length > 0}
			<DataTable identifier="treaties-{data.key}" label="Table: treaties proclaimed by {data.name}" columns={treatyColumns} rows={treatyRows} rowName={['treaty', 'treaties']} download="{data.key}-treaties" />
			<p class="small muted section-foot">Dates from Kappler's headers<CitationMarks marks={data.treatyMarks} /></p>
		{:else}
			<p>None Identified</p>
		{/if}
	</Collapsible>

	<Collapsible heading="Acts of Congress" identifier="acts-heading" count={data.acts.length || undefined}>
		{#if data.acts.length > 0}
			<DataTable identifier="acts-{data.key}" label="Table: Acts of Congress that became law while {data.name} was President" columns={actColumns} rows={actRows} rowName={['Act', 'Acts']} download="{data.key}-acts" />
		{:else}
			<p>None Identified</p>
		{/if}
	</Collapsible>

	<Collapsible heading="Justices appointed" identifier="justices-heading" count={data.appointees.length || undefined}>
		{#if data.appointees.length > 0}
			<BenchChart rows={data.rows} start={data.start} end={data.end} cases={data.chartCases} width={560} labelWidth={110} allLink />
			<DataTable identifier="justices-{data.key}" label="Table: Justices appointed by {data.name}" columns={justiceColumns} rows={justiceRows} rowName={['Justice', 'Justices']} download="{data.key}-justices" />
			<p class="small muted section-foot">Source<CitationMarks marks={data.appointeeMarks} /></p>
		{:else}
			<p>None Identified.{#each data.nominees as nominee (nominee)}{' '}{nominee}{/each}<CitationMarks marks={data.nomineeMarks} /></p>
		{/if}
	</Collapsible>

	<Collapsible heading="Supreme Court cases decided" identifier="decided-heading" count={data.decided.length || undefined}>
		{#if data.decided.length > 0}
			<DataTable identifier="decided-{data.key}" label="Table: Supreme Court cases on this site decided while {data.name} was President" columns={decidedColumns} rows={decidedRows} rowName={['case', 'cases']} download="{data.key}-cases-decided">
				{#snippet cell(row)}
					{@const item = decidedByKey.get(row.key)}
					{#if item}{#if item.link}<a href={item.link}><i>{item.name}</i></a>{:else}<i>{item.name}</i>{/if}, {item.citation}{/if}
				{/snippet}
			</DataTable>
			<p class="small muted section-foot">Cases decided while he was President<CitationMarks marks={data.decidedMarks} /></p>
		{:else}
			<p>None Identified</p>
		{/if}
	</Collapsible>

	{#if data.cases.length > 0}
		<Collapsible heading="Cases heard by Justices he appointed" identifier="cases-heading" count={data.cases.length}>
			<DataTable identifier="cases-{data.key}" label="Table: cases on this site in which Justices appointed by {data.name} took part" columns={caseColumns} rows={caseRows} rowName={['case', 'cases']} download="{data.key}-cases">
				{#snippet cell(row, column)}
					{@const item = caseByKey.get(row.key)}
					{#if item && column.key === 'name'}
						{#if item.link}<a href={item.link}><i>{item.name}</i></a>{:else}<i>{item.name}</i>{/if}, {item.citation}
					{:else if item}
						<ul class="parts">
							{#each item.parts as part (part.link)}
								<li><a href={part.link}>{part.name}</a>{' '}<span class="muted">({part.part[0].toLowerCase() + part.part.slice(1)})</span></li>
							{/each}
						</ul>
					{/if}
				{/snippet}
			</DataTable>
		</Collapsible>
	{/if}
</InfoPage>

<style>
	.parts {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Stacked names a full touch target apart. */
	.parts li + li {
		margin-top: var(--space-1);
	}

	.section-foot {
		margin-top: var(--space-2);
	}
</style>
