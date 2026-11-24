<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import TopicBadges from '#lib/components/TopicBadges.svelte';
	import { mentionsColumn, opinionsMentioning, opinionsTable } from '#lib/opinion-mentions.ts';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { fillNationSlots, restrictionsInPage } from '#lib/nation-page-slots.ts';
	import { copyItemId, noPageRestrictions, opinionsNote, withheldLine, type PageRestrictions } from '#lib/nation-restrictions.ts';
	import { readableDate } from '#lib/readable-date.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// What the nation chose the site shows of its court opinions, which the
	// Worker puts in the page, or the page asks for after a move within the
	// site (src/lib/nation-restrictions.ts): hidden opinions are left out,
	// cited ones link to the Caselaw Access Project without their Mentions.
	let restrictions = $state<PageRestrictions>(noPageRestrictions);
	afterNavigate(async (navigation) => {
		if (navigation.type !== 'enter') {
			restrictions = noPageRestrictions;
			await fillNationSlots(data.nation.id, `/nations/${data.nation.id}/opinions`);
		}
		restrictions = restrictionsInPage();
	});
	const levelOf = (key: string) => restrictions.levels[`copy:${key}`] ?? 'show';
	const allCited = $derived(restrictions.opinions.kind === 'cite' && restrictions.opinions.cited === restrictions.opinions.total - restrictions.opinions.hidden);

	const columns: TableColumn[] = $derived([
		{ key: 'name', header: 'Case', isRowHeader: true, sortable: true, searchable: true, custom: true },
		{ key: 'court', header: 'Court', sortable: true, searchable: true, filterable: true },
		{ key: 'decided', header: 'Decided', type: 'date', sortable: true },
		{ key: 'citation', header: 'Citation', sortable: true, searchable: true },
		...(allCited ? [] : [{ key: mentionsColumn, header: 'Mentions', sortable: true, searchable: true, filterable: true, custom: true }]),
		{ key: 'removal', header: 'Remove', custom: true }
	]);

	const opinions = $derived(data.opinions.filter((opinion) => levelOf(opinion.key) !== 'hide'));
	const rows: TableRow[] = $derived(
		opinions.map((opinion) => {
			const cited = levelOf(opinion.key) === 'cite';
			return {
				key: opinion.path,
				cells: {
					name: { text: opinion.name, href: cited ? opinion.original : opinion.path },
					court: { text: opinion.court },
					decided: { text: readableDate(opinion.decided), sortValue: opinion.decided },
					citation: { text: opinion.docket ? `${opinion.citation} (${opinion.docket})` : opinion.citation },
					[mentionsColumn]: cited ? { text: '', values: [] } : { text: opinion.topics.join(', '), values: opinion.topics },
					removal: { text: 'Ask to remove', href: opinion.removal }
				}
			};
		})
	);
</script>

<svelte:head>
	<title>Court opinions · {data.nation.name} · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<Breadcrumbs
		trail={[
			{ label: 'Nations', href: '/nations' },
			{ label: data.nation.name, href: `/nations/${data.nation.id}` }
		]}
	/>
	<h1>Court opinions: {data.nation.name}</h1>
	<p>
		These are the opinions of courts serving the nation that are published in the American Tribal Law Reporter or the Navajo Reporter, as the Caselaw Access Project at Harvard Law School Library released them in 2024.{#if restrictions.opinions.cited === 0} Each opens as its own page, with the publisher’s headnotes removed.{/if}
	</p>
	{#if allCited}
		<p>{opinionsNote(restrictions.opinions.kind, restrictions.opinions.cited, 0)}</p>
	{:else}
		{#if restrictions.opinions.cited > 0}
			<p>{opinionsNote(restrictions.opinions.kind, restrictions.opinions.cited, restrictions.opinions.total - restrictions.opinions.cited - restrictions.opinions.hidden)}</p>
		{/if}
		<p>
			“Mentions” lists words the opinion uses. It does not say what the court decided about them.
		</p>
	{/if}
	{#if restrictions.opinions.hidden > 0}<p class="small muted">{withheldLine}</p>{/if}
</div>
<div data-nation-slot="restrict" hidden></div>

<!-- A Mentions badge links to this page narrowed to its word, so the table is drawn again from the new address. -->
{#key page.url.search}
<DataTable
	identifier={opinionsTable}
	label="Table: court opinions, {data.nation.name}"
	{columns}
	{rows}
	defaultSort={{ key: 'decided', direction: 'descending' }}
	searchLabel="Search these opinions"
	rowName={['opinion', 'opinions']}
	filters
	shareable
>
	{#snippet cell(row: TableRow, column: TableColumn)}
		{#if column.key === 'name'}
			{@const id = copyItemId(row.key)}
			<span data-restrict-item={id}
				>{#if restrictions.levels[id] === 'cite'}<a class="original" href={row.cells.name.href} rel="noopener noreferrer"
						>{row.cells.name.text}<ExternalLink size={14} aria-hidden="true" /></a
					>{:else}<a href={row.cells.name.href}>{row.cells.name.text}</a>{/if}</span
			>
		{/if}
		{#if column.key === 'removal'}<a href={row.cells.removal.href}>Ask to remove</a>{/if}
		{#if column.key === mentionsColumn}<span data-restrict-text><TopicBadges
				topics={(row.cells[mentionsColumn].values ?? []).map((word) => ({ text: word, link: opinionsMentioning(data.nation.id, word) }))}
			/></span>{/if}
	{/snippet}
</DataTable>
{/key}

<style>
	/* An opinion the nation chose to cite only links to the Caselaw Access Project. */
	.original {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
</style>
