<script lang="ts">
	import { keyboardScroll } from '#lib/keyboard-scroll.ts';
	import type { PageProps } from './$types';

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

	function time(value: string): string {
		return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
	}

	function olderLink(sequence: number): string {
		const search = new URLSearchParams();
		if (data.targetKind) search.set('kind', data.targetKind);
		if (data.personIdentifier) search.set('person', data.personIdentifier);
		search.set('before', String(sequence));
		return `?${search}`;
	}
</script>

<svelte:head>
	<title>Activity log · Workspace · Model Tribal ADR Code</title>
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
		<label for="activity-kind">About</label>
		<select id="activity-kind" name="kind">
			<option value="">Everything</option>
			{#each Object.entries(kindLabels) as [value, label] (value)}
				<option {value} selected={value === data.targetKind}>{label}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="activity-person">Person</label>
		<select id="activity-person" name="person">
			<option value="">Anyone</option>
			{#each data.people as listed (listed.identifier)}
				<option value={listed.identifier} selected={listed.identifier === data.personIdentifier}>{listed.displayName}</option>
			{/each}
		</select>
	</div>
	<button class="button button-quiet" type="submit">Show</button>
</form>

{#if data.entries.length === 0}
	<p>Nothing recorded{data.targetKind || data.personIdentifier ? ' that matches' : ' yet'}.</p>
{:else}
	<div class="table-scroll" role="region" aria-label="Table: activity" {@attach keyboardScroll}>
		<table>
			<thead>
				<tr>
					<th scope="col">Entry</th>
					<th scope="col">When</th>
					<th scope="col">Who</th>
					<th scope="col">What</th>
					<th scope="col">About</th>
				</tr>
			</thead>
			<tbody>
				{#each data.entries as entry (entry.sequence)}
					<tr class:refused={entry.action.startsWith('Refused')}>
						<td>{entry.sequence}</td>
						<td>{time(entry.createdAt)}</td>
						<td>{entry.actorName ?? 'The site or a requester'}</td>
						<td>
							{entry.action}
							{#if entry.note}<div class="small">{entry.note}</div>{/if}
						</td>
						<td>
							{kindLabels[entry.targetKind] ?? entry.targetKind}
							<div class="small muted">{entry.targetName ?? entry.targetIdentifier}</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
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

	.seal {
		overflow-wrap: anywhere;
	}

	tr.refused td {
		font-weight: var(--font-weight-semibold);
	}
</style>
