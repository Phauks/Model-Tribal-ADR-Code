<script lang="ts">
	import { applicationStatusLabels, proofRouteLabels } from '#lib/nation-teams.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const open = $derived(
		data.applications.filter((application) => application.status === 'received' || application.status === 'confirming-with-nation')
	);
	const decided = $derived(data.applications.filter((application) => !open.includes(application)));

	function date(value: string | null): string {
		return value ? new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '';
	}
</script>

<svelte:head>
	<title>Nation teams · Workspace · Model Tribal ADR Code</title>
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
		<div class="table-scroll" tabindex="-1">
			<table>
				<thead>
					<tr><th scope="col">Reference</th><th scope="col">Nation</th><th scope="col">Person</th><th scope="col">How chosen</th><th scope="col">Status</th><th scope="col">Sent</th></tr>
				</thead>
				<tbody>
					{#each open as application (application.identifier)}
						<tr>
							<td><a href="/workspace/nation-teams/requests/{application.reference}">{application.reference}</a></td>
							<td>{application.nationTitle}</td>
							<td>{application.displayName}<br /><span class="small muted">{application.office}</span></td>
							<td>{proofRouteLabels[application.route]}</td>
							<td>{applicationStatusLabels[application.status]}</td>
							<td>{date(application.submittedAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	{#if decided.length > 0}
		<details>
			<summary>Answered requests ({decided.length})</summary>
			<ul>
				{#each decided as application (application.identifier)}
					<li>
						<a href="/workspace/nation-teams/requests/{application.reference}">{application.reference}</a>:
						{application.displayName}, {application.nationTitle}, {applicationStatusLabels[application.status].toLocaleLowerCase('en-US')}
						{date(application.decidedAt)}
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
