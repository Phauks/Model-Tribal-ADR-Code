<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import {
		creditSectionLabels,
		creditSections,
		interestLabels,
		profileStatusLabels
	} from '#lib/contributors.ts';
	import type { PageProps } from './$types';
	import { mediumDate } from '#lib/readable-date.ts';

	let { data }: PageProps = $props();

	const columns: TableColumn[] = [
		{ key: 'name', header: 'Name', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'status', header: 'Status', sortable: true, filterable: true },
		{ key: 'interests', header: 'Would like to', searchable: true, filterable: true },
		{ key: 'nations', header: 'Native nations', searchable: true },
		{ key: 'sent', header: 'Sent', type: 'date', sortable: true }
	];
	const rows: TableRow[] = $derived(
		data.profiles.map((profile) => {
			const interests = profile.interests.map((interest) => interestLabels[interest]);
			return {
				key: profile.identifier,
				cells: {
					name: { text: profile.name, href: `/workspace/contributors/${profile.identifier}` },
					status: {
						text: `${profileStatusLabels[profile.status]}${profile.hasWorkspaceAccess ? '; has workspace access' : ''}`,
						values: [profileStatusLabels[profile.status]]
					},
					interests: { text: interests.join('; '), values: interests },
					nations: { text: profile.nations.join('; ') },
					sent: { text: mediumDate(profile.submittedAt), sortValue: profile.submittedAt ?? undefined }
				}
			};
		})
	);
</script>

<svelte:head>
	<title>Contributors · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Contributors</h1>
<p class="lead">
	People who signed up to help. Everyone who confirms is signed up; you can remove anyone from their
	page. Profiles that were started but not confirmed stay private to the person.
</p>

{#if data.profiles.length === 0}
	<p>Nobody has signed up yet. People sign up at <a href="/join">/join</a>.</p>
{:else}
	<DataTable identifier="contributors" label="Table: contributors" {columns} {rows} rowName={['person', 'people']} filters />
{/if}

<section>
	<h2>Credits as they would be printed today</h2>
	<p>
		Signed-up contributors placed in a section, from the version each person last confirmed, in order
		of family name. Changes a person has not confirmed are never used. Website credits show on the
		public <a href="/contributors">Contributors</a> page at once.
	</p>
	{#if data.canExport}
		<p>
			<a class="button button-quiet" href="/workspace/contributors/credits.md" download>Download the book’s Credits page</a>
		</p>
		<p class="small muted">
			Before each edition, ask everyone credited to check their credit, then download this file and add
			it to the book’s front matter. It holds only credits chosen for the book.
		</p>
	{/if}
	{#each creditSections as section (section)}
		{@const entries = data.credits.filter((credit) => credit.section === section)}
		{#if entries.length > 0}
			<h3>{creditSectionLabels[section]}</h3>
			<ul>
				{#each entries as entry, position (position)}
					<li>
						{entry.line}
						<span class="small muted">
							({[entry.inBook ? 'book' : '', entry.onWebsite ? 'website' : ''].filter(Boolean).join(' and ')})
						</span>
						{#if entry.biography}<p class="small">{entry.biography}</p>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/each}
	{#if data.credits.length === 0}<p>No credits yet.</p>{/if}
</section>
