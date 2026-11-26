<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import { applicationStatusLabels, proofRouteLabels } from '#lib/nation-teams.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';
	import { mediumDate } from '#lib/readable-date.ts';

	let { data }: PageProps = $props();

	const open = $derived(
		data.applications.filter((application) => application.status === 'received' || application.status === 'confirming-with-nation')
	);
	const decided = $derived(data.applications.filter((application) => !open.includes(application)));

	const columns: TableColumn[] = [
		{ key: 'reference', header: 'Reference', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'nation', header: 'Nation', sortable: true, searchable: true },
		{ key: 'person', header: 'Person', sortable: true, searchable: true, custom: true },
		{ key: 'how', header: 'How chosen', sortable: true },
		{ key: 'status', header: 'Status', sortable: true },
		{ key: 'sent', header: 'Sent', type: 'date', sortable: true }
	];
	const rows: TableRow[] = $derived(
		open.map((application) => ({
			key: application.identifier,
			cells: {
				reference: { text: application.reference, href: `/workspace/nation-teams/requests/${application.reference}` },
				nation: { text: application.nationTitle },
				person: { text: [application.displayName, application.office].filter(Boolean).join(', ') },
				how: { text: proofRouteLabels[application.route] },
				status: { text: applicationStatusLabels[application.status] },
				sent: { text: mediumDate(application.submittedAt), sortValue: application.submittedAt }
			}
		}))
	);
	const applications = $derived(new Map(open.map((application) => [application.identifier, application])));

</script>

<svelte:head>
	<title>Nation teams · Workspace · Tribal Law Project</title>
</svelte:head>

<h1>Nation teams</h1>
<p>
	The people each nation has chosen to keep its own page up to date. A person joins a team after the project
	confirms their request with the nation’s office, using a contact the project already had for the nation.
	A steward can then add and remove people for that nation only. Every change is in the
	<a href="/workspace/activity?kind=grant">activity log</a>.
</p>

<section aria-labelledby="requests-heading">
	<h2 id="requests-heading">Requests to join a team</h2>
	{#if open.length === 0}
		<p>No requests are waiting.</p>
	{:else}
		<DataTable
			identifier="team-requests"
			label="Table: requests to join a team"
			{columns}
			{rows}
			defaultSort={{ key: 'sent', direction: 'ascending' }}
			rowName={['request', 'requests']}
		>
			{#snippet cell(row)}
				{@const application = applications.get(row.key)}
				{#if application}{application.displayName}<br /><span class="small muted">{application.office}</span>{/if}
			{/snippet}
		</DataTable>
	{/if}
	{#if decided.length > 0}
		<details>
			<summary>Answered requests ({decided.length})</summary>
			<ul>
				{#each decided as application (application.identifier)}
					<li>
						<a href="/workspace/nation-teams/requests/{application.reference}">{application.reference}</a>:
						{application.displayName}, {application.nationTitle}, {applicationStatusLabels[application.status].toLocaleLowerCase('en-US')}
						{mediumDate(application.decidedAt)}
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</section>

<section aria-labelledby="teams-heading">
	<h2 id="teams-heading">Teams</h2>
	{#if data.teams.length === 0}
		<p>No nation has a team yet.</p>
	{:else}
		<ul>
			{#each data.teams as team (team.nationIdentifier)}
				<li>
					<a href="/workspace/nation-teams/{team.nationIdentifier}">{team.title}</a>:
					{team.count} {team.count === 1 ? 'person' : 'people'}{#if team.stewards.length > 0}; stewards {team.stewards.join(', ')}{:else}; no steward{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
