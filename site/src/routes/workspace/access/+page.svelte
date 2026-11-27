<script lang="ts">
	import type { Snippet } from 'svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import {
		accessLevelDescriptions,
		accessLevelLabels,
		accessLevels,
		everyDocument,
		roleLabels,
		roles,
		accessKindLabels,
		accessKinds,
		type AccessSource
	} from '#lib/permissions.ts';
	import type { PageProps } from './$types';
	import DateField from '#lib/components/DateField.svelte';
	import { mediumDate } from '#lib/readable-date.ts';

	let { data, form }: PageProps = $props();

	let kind = $state<(typeof accessKinds)[number]>('essay');
	let scope = $state<'one' | 'every'>('one');

	const sourceLabels: Record<AccessSource, string> = {
		administrator: 'lead author',
		'document-grant': 'grant for one document',
		'nation-team': 'place on the nation’s team',
		'kind-grant': 'grant for every document of this kind',
		role: 'role default'
	};

	function documentTitle(grantKind: string, identifier: string): string {
		if (grantKind === 'site-text') return 'The site text';
		if (identifier === everyDocument) {
			return `Every ${accessKindLabels[grantKind as keyof typeof accessKindLabels].toLocaleLowerCase('en-US')}`;
		}
		return (
			data.documents.find((document) => document.kind === grantKind && document.identifier === identifier)
				?.title ?? `${identifier} (no file yet)`
		);
	}

	const personLabel = (listed: (typeof data.people)[number]) => `${listed.displayName} (${roleLabels[listed.role].toLocaleLowerCase('en-US')})`;
	const filterChoices = $derived([{ value: '', label: 'Everyone' }, ...data.people.map((listed) => ({ value: listed.identifier, label: personLabel(listed) }))]);
	const grantPersonChoices = $derived(
		data.people.filter((listed) => listed.role !== 'lead-author').map((listed) => ({ value: listed.identifier, label: personLabel(listed) }))
	);
	const kindChoices = accessKinds.map((option) => ({ value: option, label: accessKindLabels[option] }));
	const levelChoices = accessLevels.map((level) => ({ value: level as string, label: accessLevelLabels[level] }));

	const grantColumns: TableColumn[] = [
		{ key: 'person', header: 'Person', isRowHeader: true, sortable: true, searchable: true, custom: true },
		{ key: 'document', header: 'Document', sortable: true, searchable: true, custom: true },
		{ key: 'level', header: 'Level', sortable: true },
		{ key: 'ends', header: 'Ends', type: 'date', sortable: true },
		{ key: 'granted', header: 'Granted', type: 'date', sortable: true, custom: true },
		{ key: 'action', header: 'Action', custom: true, hiddenHeader: true, keepOutOfDownload: true }
	];
	const grantRows: TableRow[] = $derived(
		data.grants.map((grant) => ({
			key: grant.identifier,
			cells: {
				person: { text: grant.personName, href: `?person=${grant.personIdentifier}` },
				document: { text: documentTitle(grant.subjectKind, grant.subjectIdentifier) },
				level: { text: accessLevelLabels[grant.level] },
				ends: { text: grant.expiresAt ? mediumDate(grant.expiresAt) : 'No end date', sortValue: grant.expiresAt ?? '9999' },
				granted: { text: [mediumDate(grant.grantedAt), grant.grantedByName ? `by ${grant.grantedByName}` : '', grant.note ?? ''].filter(Boolean).join(' '), sortValue: grant.grantedAt },
				action: { text: '' }
			}
		}))
	);
	const grants = $derived(new Map(data.grants.map((grant) => [grant.identifier, grant])));
	const grantsHeading = $derived(data.chosen ? `${data.chosen.displayName}’s grants` : 'Every grant in force');

	const peopleCounts = $derived(
		roles
			.map((role) => ({
				role,
				active: data.summary.people.find((row) => row.role === role && row.status === 'active')?.count ?? 0,
				invited: data.summary.people.find((row) => row.role === role && row.status === 'invited')?.count ?? 0,
				removed: data.summary.people.find((row) => row.role === role && row.status === 'removed')?.count ?? 0
			}))
			.filter((row) => row.active + row.invited + row.removed > 0)
	);
</script>

<svelte:head>
	<title>Access · Workspace · Tribal Law Project</title>
</svelte:head>

<h1>Access</h1>
<p>
	Who can open, comment on and change each document. A person’s role gives them a starting level on
	every document; a grant here raises or lowers it for one document, or for every document of a kind.
	The lead author always has full access. Every change is recorded in the
	<a href="/workspace/activity">activity log</a>.
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

<section aria-labelledby="overview-heading">
	<h2 id="overview-heading">Overview</h2>
	<dl class="summary-list">
		<div>
			<dt>People</dt>
			<dd>
				{#each peopleCounts as row (row.role)}
					<div>
						{roleLabels[row.role]}: {row.active} active{#if row.invited}, {row.invited} invited{/if}{#if row.removed}, {row.removed} removed{/if}
					</div>
				{:else}
					Nobody yet.
				{/each}
				<a class="small" href="/workspace/people">Manage people</a>
			</dd>
		</div>
		<div>
			<dt>Grants in force</dt>
			<dd>
				{data.summary.grants}{#if data.summary.grantsExpiringSoon}; {data.summary.grantsExpiringSoon} end within 14 days{/if}
			</dd>
		</div>
		<div>
			<dt>Refused attempts, last 30 days</dt>
			<dd>
				{data.summary.refusedLastThirtyDays}
				{#if data.summary.lastRefused}
					<div class="small muted">
						Latest: {data.summary.lastRefused.personName ?? 'someone'}, {mediumDate(data.summary.lastRefused.createdAt)}
						({data.summary.lastRefused.note})
					</div>
				{/if}
			</dd>
		</div>
		<div>
			<dt>Activity log</dt>
			<dd>
				{#if data.summary.seals.intact}
					Intact: {data.summary.seals.checked} entries checked against their seals.
				{:else}
					<strong>Check failed</strong> at entry {data.summary.seals.brokenAt}. See the
					<a href="/workspace/activity">activity log</a>.
				{/if}
			</dd>
		</div>
	</dl>
</section>

<section aria-labelledby="levels-heading">
	<h2 id="levels-heading">Levels</h2>
	<p class="small">
		There is no view-only level: anyone who can open a document can comment on it.
	</p>
	<dl class="summary-list">
		{#each accessLevels as level (level)}
			<div><dt>{accessLevelLabels[level]}</dt><dd>{accessLevelDescriptions[level]}</dd></div>
		{/each}
	</dl>
	<h3>Where each role starts</h3>
	<ul>
		{#each roles as role (role)}
			<li>
				{roleLabels[role]}: {accessLevelLabels[data.roleDefaultLevels[role]].toLocaleLowerCase('en-US')}
				{#if role === 'nation-reviewer'}, except comment and approve on their own nation’s record{/if}
				{#if role === 'lead-author'}, always{/if}
			</li>
		{/each}
	</ul>
</section>

<section aria-labelledby="person-heading">
	<h2 id="person-heading">One person’s access</h2>
	<form method="get" class="inline-form">
		<div class="field">
			<Dropdown label="Person" id="person-filter" name="person" choices={filterChoices} value={data.chosen?.identifier ?? ''} />
		</div>
		<button class="button button-quiet" type="submit">Show</button>
	</form>

	{#if data.chosen && data.effective}
		<p>
			<strong>{data.chosen.displayName}</strong>, {roleLabels[data.chosen.role].toLocaleLowerCase('en-US')}:
		</p>
		<ul>
			{#each data.effective as row (row.kind)}
				<li>
					{accessKindLabels[row.kind]}s: {accessLevelLabels[row.general.level].toLocaleLowerCase('en-US')}
					({sourceLabels[row.general.source]}); can open {row.opened} of {row.count}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section aria-labelledby="grants-heading">
	{#if data.grants.length === 0}
		<h2 id="grants-heading">{grantsHeading}</h2>
		<p>No grants{data.chosen ? ' for this person' : ''}. Everyone has their role’s default.</p>
	{:else}
		<DataTable
			identifier="grants"
			label="Table: grants"
			columns={grantColumns}
			rows={grantRows}
			defaultSort={{ key: 'granted', direction: 'descending' }}
			rowName={['grant', 'grants']}
		>
			{#snippet heading(count: Snippet)}<h2 id="grants-heading">{grantsHeading} {@render count()}</h2>{/snippet}
			{#snippet cell(row, column)}
				{@const grant = grants.get(row.key)}
				{#if !grant}
					<!-- Every row is a grant. -->
				{:else if column.key === 'person'}
					<a href="?person={grant.personIdentifier}">{grant.personName}</a>
					<div class="small muted">{roleLabels[grant.personRole as keyof typeof roleLabels] ?? grant.personRole}</div>
				{:else if column.key === 'document'}
					{documentTitle(grant.subjectKind, grant.subjectIdentifier)}
					<div class="small muted">{accessKindLabels[grant.subjectKind]}</div>
				{:else if column.key === 'granted'}
					{mediumDate(grant.grantedAt)}{#if grant.grantedByName}<div class="small muted">by {grant.grantedByName}</div>{/if}
					{#if grant.note}<div class="small">{grant.note}</div>{/if}
				{:else}
					<form method="post" action="?/end">
						<input type="hidden" name="grant" value={grant.identifier} />
						<button class="button button-quiet" type="submit">End grant</button>
					</form>
				{/if}
			{/snippet}
		</DataTable>
	{/if}
</section>

<form method="post" action="?/grant" class="panel">
	<h2>Grant or restrict access</h2>
	<p class="small">
		A new grant replaces any grant for the same person and document. Choose “No access” to keep someone
		out of a document their role would otherwise open.
	</p>
	<div class="field">
		<Dropdown label="Person" id="grant-person" name="person" choices={grantPersonChoices} value={data.chosen?.identifier ?? grantPersonChoices[0]?.value ?? ''} />
	</div>
	<div class="field">
		<Dropdown label="Kind of document" id="grant-kind" name="kind" choices={kindChoices} bind:value={kind} />
	</div>
	{#if kind !== 'site-text'}
	<fieldset class="field">
		<legend>Which documents</legend>
		<label><input type="radio" name="scope" value="one" bind:group={scope} /> One document</label>
		<label>
			<input type="radio" name="scope" value="every" bind:group={scope} />
			Every {accessKindLabels[kind].toLocaleLowerCase('en-US')}, including drafts not written yet
		</label>
	</fieldset>
	{/if}
	{#if scope === 'one' && kind !== 'site-text'}
		<div class="field">
			<label for="grant-document">Document</label>
			<p class="hint">
				Start typing its name or identifier. For an essay or provision with no file yet, type its planned
				identifier.
			</p>
			<input id="grant-document" name="document" list="grant-documents" autocomplete="off" />
			<datalist id="grant-documents">
				{#each data.documents.filter((document) => document.kind === kind) as document (document.identifier)}
					<option value={document.identifier}>{document.title}</option>
				{/each}
			</datalist>
		</div>
	{/if}
	<div class="field">
		<Dropdown label="Level" id="grant-level" name="level" choices={levelChoices} value={accessLevels[0]} />
	</div>
	<div class="field">
		<label for="grant-expires">Ends (optional)</label>
		<p class="hint" id="grant-expires-hint">The grant stops counting after this day. Leave empty to keep it until you end it.</p>
		<DateField id="grant-expires" name="expires" describedby="grant-expires-hint" />
	</div>
	<div class="field">
		<label for="grant-note">Note (optional)</label>
		<input type="text" id="grant-note" name="note" maxlength="500" />
	</div>
	<button class="button" type="submit">Save the grant</button>
</form>

<style>
	.inline-form {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-3);
	}

	/* Level with the dropdown, which keeps a field's space below it. */
	.inline-form .button {
		margin-bottom: var(--space-4);
	}

	fieldset.field {
		border: 0;
		padding: 0;
		margin-inline: 0;
	}

	fieldset.field label {
		display: block;
	}
</style>
