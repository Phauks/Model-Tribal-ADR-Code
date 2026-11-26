<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';
	import { mediumDateAndTime } from '#lib/readable-date.ts';

	let { data }: PageProps = $props();

	const kindLabels: Record<string, string> = {
		person: 'People and access',
		request: 'Requests',
		review: 'Reviews',
		grant: 'Grants',
		document: 'Documents',
		profile: 'Contributor profiles'
	};

	const problemLabels = {
		changed: 'was changed after it was recorded',
		'missing-entry': 'is missing',
		'missing-seal': 'has lost its seal'
	};

	const kindChoices = [{ value: '', label: 'Everything' }, ...Object.entries(kindLabels).map(([value, label]) => ({ value, label }))];
	const personChoices = $derived([{ value: '', label: 'Anyone' }, ...data.people.map((listed) => ({ value: listed.identifier, label: listed.displayName }))]);

	const columns: TableColumn[] = [
		{ key: 'entry', header: 'Entry', type: 'number', sortable: true },
		{ key: 'when', header: 'When', type: 'date', sortable: true },
		{ key: 'who', header: 'Who', sortable: true, searchable: true },
		{ key: 'what', header: 'What', searchable: true, custom: true },
		{ key: 'about', header: 'About', sortable: true, searchable: true, custom: true }
	];
	const entries = $derived(new Map(data.entries.map((entry) => [String(entry.sequence), entry])));
	const rows: TableRow[] = $derived(
		data.entries.map((entry) => ({
			key: String(entry.sequence),
			cells: {
				entry: { text: String(entry.sequence), sortValue: entry.sequence },
				when: { text: mediumDateAndTime(entry.createdAt), sortValue: entry.createdAt },
				who: { text: entry.actorName ?? 'The site or a requester' },
				what: { text: [entry.action, entry.note].filter(Boolean).join(' ') },
				about: { text: `${kindLabels[entry.targetKind] ?? entry.targetKind} ${entry.targetName ?? entry.targetIdentifier}` }
			}
		}))
	);

	function olderLink(sequence: number): string {
		const search = new URLSearchParams();
		if (data.targetKind) search.set('kind', data.targetKind);
		if (data.personIdentifier) search.set('person', data.personIdentifier);
		search.set('before', String(sequence));
		return `?${search}`;
	}
</script>

<svelte:head>
	<title>Activity log · Workspace · Tribal Law Project</title>
</svelte:head>

<h1>Activity log</h1>
<p>
	Everything done in the workspace, newest first: invitations, role and access changes, reviews,
	requests, saved versions of documents, and attempts that were refused. Entries cannot be changed or
	deleted, and each is sealed to the one before it, so a change made behind the website’s back shows
	up here.
</p>

{#if data.seals.intact}
	<div class="notice" role="status">
		<p>
			<strong>Intact.</strong> All {data.seals.checked} sealed entries match their seals{#if data.seals.unsealed}; {data.seals.unsealed} newer entries are sealed on the next change{/if}.
		</p>
		{#if data.seals.latestSeal}
			<p class="small">
				Latest seal (entry {data.seals.latestSequence}): <code class="seal">{data.seals.latestSeal}</code>.
				Keeping a copy of this somewhere outside Cloudflare, now and then, lets you prove later that
				nothing before it was rewritten. <a href="/workspace/activity/export" download>Download the whole log with its seals</a>.
			</p>
		{/if}
	</div>
{:else}
	<div class="notice notice-problem" role="alert">
		<p>
			<strong>The check failed.</strong> Entry {data.seals.brokenAt} {problemLabels[data.seals.problem]}.
			Entries before it ({data.seals.checked}) are intact. Someone with access to the database itself may
			have changed it; compare with a downloaded copy and with Cloudflare’s D1 Time Travel history.
		</p>
	</div>
{/if}

<form method="get" class="filters">
	<div class="field">
		<Dropdown label="About" id="activity-kind" name="kind" choices={kindChoices} value={data.targetKind ?? ''} />
	</div>
	<div class="field">
		<Dropdown label="Person" id="activity-person" name="person" choices={personChoices} value={data.personIdentifier ?? ''} />
	</div>
	<button class="button button-quiet" type="submit">Show</button>
</form>

{#if data.entries.length === 0}
	<p>Nothing recorded{data.targetKind || data.personIdentifier ? ' that matches' : ' yet'}.</p>
{:else}
	<DataTable
		identifier="activity"
		label="Table: activity"
		{columns}
		{rows}
		defaultSort={{ key: 'entry', direction: 'descending' }}
		rowName={['entry', 'entries']}
		download="activity-log"
	>
		{#snippet cell(row, column)}
			{@const entry = entries.get(row.key)}
			{#if entry && column.key === 'what'}
				<!-- A refused attempt stands out in bold. -->
				<span class:refused={entry.action.startsWith('Refused')}>{entry.action}</span>
				{#if entry.note}<div class="small">{entry.note}</div>{/if}
			{:else if entry}
				{kindLabels[entry.targetKind] ?? entry.targetKind}
				<div class="small muted">{entry.targetName ?? entry.targetIdentifier}</div>
			{/if}
		{/snippet}
	</DataTable>
	{#if data.older}
		<p><a href={olderLink(data.older)}>Older entries</a></p>
	{/if}
{/if}

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-3);
	}

	/* Level with the dropdowns, which keep a field's space below them. */
	.filters .button {
		margin-bottom: var(--space-4);
	}

	.seal {
		overflow-wrap: anywhere;
	}

	.refused {
		font-weight: var(--font-weight-semibold);
	}
</style>
