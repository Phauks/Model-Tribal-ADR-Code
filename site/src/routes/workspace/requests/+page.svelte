<script lang="ts">
	import { keyboardScroll } from '#lib/keyboard-scroll.ts';
	import { requestKindLabels, requestOutcomeLabels, requestStatusLabels } from '#lib/requests.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const views = [
		{ value: 'open', label: 'Open' },
		{ value: 'resolved', label: 'Resolved' },
		{ value: 'all', label: 'All' }
	];

	function date(value: string): string {
		return new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' });
	}
</script>

<svelte:head>
	<title>Requests · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Requests</h1>
<p>
	Requests sent through the website, newest first. Targets come from
	<em>docs/requests.md</em>: acknowledge within 7 days, hide material named in a restrict or remove request
	within 7 days, decide within 30 days of acknowledging.
</p>
{#if data.cleared > 0}
	<div class="notice" role="status">
		<p>
			Personal details were deleted from {data.cleared}
			{data.cleared === 1 ? 'request' : 'requests'} resolved more than 12 months ago.
		</p>
	</div>
{/if}

<p class="views">
	Show:
	{#each views as view (view.value)}
		{#if view.value === data.show}
			<strong aria-current="page">{view.label}</strong>
		{:else}
			<a href="?show={view.value}">{view.label}</a>
		{/if}
	{/each}
</p>

{#if data.requests.length === 0}
	<p>No requests here.</p>
{:else}
	<div class="table-scroll" role="region" aria-label="Table: requests" {@attach keyboardScroll}>
		<table>
			<thead>
				<tr>
					<th scope="col">Reference</th>
					<th scope="col">Kind</th>
					<th scope="col">About</th>
					<th scope="col">Status</th>
					<th scope="col">Received</th>
					<th scope="col">Next target</th>
				</tr>
			</thead>
			<tbody>
				{#each data.requests as request (request.identifier)}
					<tr>
						<td><a href="/workspace/requests/{request.reference}">{request.reference}</a></td>
						<td>{requestKindLabels[request.kind]}</td>
						<td>{request.missingNationOfficialName ?? request.nationIdentifier ?? ''}</td>
						<td>
							{requestStatusLabels[request.status]}{#if request.outcome}: {requestOutcomeLabels[request.outcome]}{/if}
						</td>
						<td>{date(request.receivedAt)}</td>
						<td>
							{#each request.deadlines.slice(0, 1) as deadline (deadline.label)}
								<span class:overdue={deadline.overdue}>
									{deadline.overdue ? 'Past: ' : ''}{deadline.label.toLocaleLowerCase('en-US')} {date(deadline.due)}
								</span>
							{/each}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.views {
		display: flex;
		gap: var(--space-3);
	}

	.overdue {
		color: var(--color-danger);
		font-weight: var(--font-weight-semibold);
	}
</style>
