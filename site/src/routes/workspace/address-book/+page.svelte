<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import {
		contactKindLabels,
		contactKinds,
		methodLabelNames,
		methodLabels,
		shortDate,
		sourceKindNames,
		sourceKinds
	} from '#lib/address-book.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const views = [
		{ value: 'all', label: 'All' },
		{ value: 'stale', label: 'Needs checking' },
		{ value: 'no-email', label: 'No email' },
		{ value: 'people', label: 'People' },
		{ value: 'organizations', label: 'Organizations' }
	];

	function viewLink(show: string, tag: string | null): string {
		const query = new URLSearchParams();
		if (show !== 'all') query.set('show', show);
		if (tag) query.set('tag', tag);
		const text = query.toString();
		return text ? `?${text}` : '?';
	}

	const columns: TableColumn[] = [
		{ key: 'name', header: 'Name', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'nation', header: 'Nation', sortable: true, searchable: true },
		{ key: 'role', header: 'Role', sortable: true, searchable: true },
		{ key: 'email', header: 'Email', sortable: true, searchable: true },
		{ key: 'checked', header: 'Oldest check', type: 'date', sortable: true },
		{ key: 'status', header: 'Up to date', sortable: true, custom: true }
	];
	const rowsByKey = $derived(new Map(data.rows.map((row) => [row.identifier, row])));
	const rows: TableRow[] = $derived(
		data.rows.map((row) => ({
			key: row.identifier,
			cells: {
				name: { text: row.name, href: `/workspace/address-book/${row.identifier}` },
				nation: { text: row.nationTitle ?? '' },
				role: { text: [row.role, row.organizationName].filter(Boolean).join(', ') },
				email: { text: row.email ? `${row.email} (${methodLabelNames[row.emailLabel ?? 'other']})` : '' },
				checked: { text: row.oldestCheck ? shortDate(row.oldestCheck) : '', sortValue: row.oldestCheck ?? '' },
				status: { text: row.stale ? 'Needs checking' : 'Yes', sortValue: row.stale ? 0 : 1 }
			}
		}))
	);
</script>

{#snippet cell(row: TableRow)}
	{@const entry = rowsByKey.get(row.key)}
	{#if entry?.stale}
		<span class="stale" title={entry.reasons.join('\n')}>Needs checking</span>
	{:else}
		Yes
	{/if}
{/snippet}

<svelte:head>
	<title>Address book · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Address book</h1>
<p>
	The project's private contacts: Native nations' offices and the people who lead or work for them, and anyone else
	the project writes to. Only the lead author sees this page. Each email and phone records where it was read and the
	last day it was seen there. One counts as needing a check when that day is more than 180 days ago for a leader's or a
	state-listed address, more than a year ago for any other, or when the nation has held an election since.
</p>
<p class="small">
	{data.totals.contacts} contacts, {data.totals.withEmail} with an email in use, {data.totals.stale} needing a check.
	<a href="/workspace/address-book/mailing-list.csv" download>Download the mailing list (CSV)</a>: one email per
	contact, the preferred one in use. <a href="/workspace/address-book/differences">Differences with the nation pages</a>.
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status">
		<p>
			{form.done}
			{#if 'added' in form && form.added}<a href="/workspace/address-book/{form.added}">Open it</a>{/if}
		</p>
	</div>
{/if}

<p class="views">
	Show:
	{#each views as view (view.value)}
		{#if view.value === data.show}
			<strong aria-current="page">{view.label}</strong>
		{:else}
			<a href={viewLink(view.value, data.tag)}>{view.label}</a>
		{/if}
	{/each}
</p>
{#if data.tags.length > 0}
	<p class="views small">
		Tag:
		{#if data.tag}<a href={viewLink(data.show, null)}>Any</a>{:else}<strong aria-current="page">Any</strong>{/if}
		{#each data.tags as tag (tag)}
			{#if tag === data.tag}
				<strong aria-current="page">{tag}</strong>
			{:else}
				<a href={viewLink(data.show, tag)}>{tag}</a>
			{/if}
		{/each}
	</p>
{/if}

{#if data.rows.length === 0}
	<p>No contacts here.</p>
{:else}
	<DataTable
		identifier="address-book"
		label="Table: contacts"
		{columns}
		{rows}
		defaultSort={{ key: 'name', direction: 'ascending' }}
		rowName={['contact', 'contacts']}
		{cell}
	/>
{/if}

<form method="post" action="?/refresh" class="panel">
	<h2>Check against the directories</h2>
	<p class="small">
		Reads the federal Tribal Leaders Directory and the State of Alaska's list of tribes, and checks every email in use
		that came from one of them. An email still listed counts as checked today; one no longer listed is marked replaced,
		and the address now listed is added to the same contact. Then it brings in any office email or phone a nation page
		shows that the book lacks. Emails read on a nation's own website are checked by hand on each contact's page. The same check runs by itself every Monday morning.
	</p>
	<button class="button" type="submit">Check now</button>
</form>

<form method="post" action="?/add" class="panel">
	<h2>Add a contact</h2>
	<div class="field">
		<label for="kind">Kind</label>
		<select id="kind" name="kind">
			{#each contactKinds as kind (kind)}
				<option value={kind}>{contactKindLabels[kind]}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="name">Name</label>
		<input id="name" name="name" type="text" required maxlength="300" />
	</div>
	<div class="field">
		<label for="role">Role or title (optional)</label>
		<input id="role" name="role" type="text" maxlength="300" />
	</div>
	<div class="field">
		<label for="organization">Acts for (optional)</label>
		<select id="organization" name="organizationIdentifier">
			<option value="">None</option>
			{#each data.organizations as organization (organization.identifier)}
				<option value={organization.identifier}>{organization.name}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="nation">Nation (optional)</label>
		<select id="nation" name="nationIdentifier">
			<option value="">None</option>
			{#each data.nations as nation (nation.identifier)}
				<option value={nation.identifier}>{nation.title}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="tags">Tags (optional, separated by commas)</label>
		<input id="tags" name="tags" type="text" />
	</div>
	<div class="field">
		<label for="email">Email (optional)</label>
		<input id="email" name="email" type="email" maxlength="320" />
	</div>
	<div class="field">
		<label for="label">Kind of email</label>
		<select id="label" name="label">
			{#each methodLabels as label (label)}
				<option value={label} selected={label === 'work'}>{methodLabelNames[label]}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="source-kind">Where it was found</label>
		<select id="source-kind" name="sourceKind">
			{#each sourceKinds as kind (kind)}
				<option value={kind} selected={kind === 'told-us'}>{sourceKindNames[kind]}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="source-label">Source, in words (optional)</label>
		<input id="source-label" name="sourceLabel" type="text" maxlength="300" />
	</div>
	<div class="field">
		<label for="source-link">Source link (optional)</label>
		<input id="source-link" name="sourceLink" type="url" maxlength="2000" />
	</div>
	<div class="field">
		<label for="notes">Notes (optional)</label>
		<textarea id="notes" name="notes" rows="2"></textarea>
	</div>
	<button class="button" type="submit">Add</button>
</form>

<style>
	.views {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.stale {
		color: var(--color-danger);
		font-weight: var(--font-weight-semibold);
	}
</style>
