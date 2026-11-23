<script lang="ts">
	import { keyboardScroll } from '#lib/keyboard-scroll.ts';
	import {
		accessLevelDescriptions,
		accessLevelLabels,
		accessLevels,
		everyDocument,
		roleLabels,
		roles,
		subjectKindLabels,
		subjectKinds,
		type AccessSource
	} from '#lib/permissions.ts';
	import type { PageProps } from './$types';
	import DateField from '#lib/components/DateField.svelte';

	let { data, form }: PageProps = $props();

	let kind = $state<(typeof subjectKinds)[number]>('essay');
	let scope = $state<'one' | 'every'>('one');

	const sourceLabels: Record<AccessSource, string> = {
		administrator: 'lead author',
		'document-grant': 'grant for one document',
		'nation-team': 'place on the nation’s team',
		'kind-grant': 'grant for every document of this kind',
		role: 'role default'
	};

	function date(value: string | null): string {
		return value ? new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '';
	}

	function documentTitle(grantKind: string, identifier: string): string {
		if (identifier === everyDocument) {
			return `Every ${subjectKindLabels[grantKind as keyof typeof subjectKindLabels].toLocaleLowerCase('en-US')}`;
		}
		return (
			data.documents.find((document) => document.kind === grantKind && document.identifier === identifier)
				?.title ?? `${identifier} (no file yet)`
		);
	}

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
	<title>Access · Workspace · Model Tribal ADR Code</title>
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
						Latest: {data.summary.lastRefused.personName ?? 'someone'}, {date(data.summary.lastRefused.createdAt)}
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
			<label for="person-filter">Person</label>
			<select id="person-filter" name="person">
				<option value="">Everyone</option>
				{#each data.people as listed (listed.identifier)}
					<option value={listed.identifier} selected={listed.identifier === data.chosen?.identifier}>
						{listed.displayName} ({roleLabels[listed.role].toLocaleLowerCase('en-US')})
					</option>
				{/each}
			</select>
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
					{subjectKindLabels[row.kind]}s: {accessLevelLabels[row.general.level].toLocaleLowerCase('en-US')}
					({sourceLabels[row.general.source]}); can open {row.opened} of {row.count}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section aria-labelledby="grants-heading">
	<h2 id="grants-heading">
		{data.chosen ? `${data.chosen.displayName}’s grants` : 'Every grant in force'}
	</h2>
	{#if data.grants.length === 0}
		<p>No grants{data.chosen ? ' for this person' : ''}. Everyone has their role’s default.</p>
	{:else}
		<div class="table-scroll" role="region" aria-label="Table: grants" {@attach keyboardScroll}>
			<table>
				<thead>
					<tr>
						<th scope="col">Person</th>
						<th scope="col">Document</th>
						<th scope="col">Level</th>
						<th scope="col">Ends</th>
						<th scope="col">Granted</th>
						<th scope="col"><span class="visually-hidden">Action</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.grants as grant (grant.identifier)}
						<tr>
							<td>
								<a href="?person={grant.personIdentifier}">{grant.personName}</a>
								<div class="small muted">{roleLabels[grant.personRole as keyof typeof roleLabels] ?? grant.personRole}</div>
							</td>
							<td>
								{documentTitle(grant.subjectKind, grant.subjectIdentifier)}
								<div class="small muted">{subjectKindLabels[grant.subjectKind]}</div>
							</td>
							<td>{accessLevelLabels[grant.level]}</td>
							<td>{grant.expiresAt ? date(grant.expiresAt) : 'No end date'}</td>
							<td>
								{date(grant.grantedAt)}{#if grant.grantedByName}<div class="small muted">by {grant.grantedByName}</div>{/if}
								{#if grant.note}<div class="small">{grant.note}</div>{/if}
							</td>
							<td>
								<form method="post" action="?/end">
									<input type="hidden" name="grant" value={grant.identifier} />
									<button class="button button-quiet" type="submit">End grant</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<form method="post" action="?/grant" class="panel">
	<h2>Grant or restrict access</h2>
	<p class="small">
		A new grant replaces any grant for the same person and document. Choose “No access” to keep someone
		out of a document their role would otherwise open.
	</p>
	<div class="field">
		<label for="grant-person">Person</label>
		<select id="grant-person" name="person">
			{#each data.people.filter((listed) => listed.role !== 'lead-author') as listed (listed.identifier)}
				<option value={listed.identifier} selected={listed.identifier === data.chosen?.identifier}>
					{listed.displayName} ({roleLabels[listed.role].toLocaleLowerCase('en-US')})
				</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="grant-kind">Kind of document</label>
		<select id="grant-kind" name="kind" bind:value={kind}>
			{#each subjectKinds as option (option)}
				<option value={option}>{subjectKindLabels[option]}</option>
			{/each}
		</select>
	</div>
	<fieldset class="field">
		<legend>Which documents</legend>
		<label><input type="radio" name="scope" value="one" bind:group={scope} /> One document</label>
		<label>
			<input type="radio" name="scope" value="every" bind:group={scope} />
			Every {subjectKindLabels[kind].toLocaleLowerCase('en-US')}, including drafts not written yet
		</label>
	</fieldset>
	{#if scope === 'one'}
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
		<label for="grant-level">Level</label>
		<select id="grant-level" name="level">
			{#each accessLevels as level (level)}
				<option value={level}>{accessLevelLabels[level]}</option>
			{/each}
		</select>
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

	fieldset.field {
		border: 0;
		padding: 0;
		margin-inline: 0;
	}

	fieldset.field label {
		display: block;
	}
</style>
