<script lang="ts">
	import { keyboardScroll } from '#lib/keyboard-scroll.ts';
	import { decisionLabels, roleDescriptions, roleLabels, subjectKindLabels } from '#lib/permissions.ts';
	import { requestKindLabels, requestStatusLabels } from '#lib/requests.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const overdue = $derived(
		(data.openRequests ?? []).filter((request) => request.deadlines.some((deadline) => deadline.overdue))
	);

	function date(value: string): string {
		return new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' });
	}
</script>

<svelte:head>
	<title>Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Co-author workspace</h1>
<p class="lead">
	{roleLabels[data.person.role]}: {roleDescriptions[data.person.role]}
</p>

{#if data.ownNation}
	<section class="panel">
		<h2>Your nation’s record</h2>
		<p>
			You review the record for <strong>{data.ownNation.title}</strong> on behalf of the nation.
		</p>
		<p><a class="button" href="/workspace/reviews/nation/{data.ownNation.identifier}">Review the record</a></p>
	</section>
{/if}

{#if data.openRequests}
	<section>
		<h2>Requests</h2>
		{#if data.openRequests.length === 0}
			<p>No open requests.</p>
		{:else}
			<p>
				{data.openRequests.length} open {data.openRequests.length === 1 ? 'request' : 'requests'};
				{overdue.length} past a target date. <a href="/workspace/requests">See all requests</a>
			</p>
			{#if overdue.length > 0}
				<div class="table-scroll" role="region" aria-label="Table: requests past a target date" {@attach keyboardScroll}>
					<table>
						<thead>
							<tr><th scope="col">Reference</th><th scope="col">Kind</th><th scope="col">Status</th><th scope="col">Past target</th></tr>
						</thead>
						<tbody>
							{#each overdue as request (request.identifier)}
								<tr>
									<td><a href="/workspace/requests/{request.reference}">{request.reference}</a></td>
									<td>{requestKindLabels[request.kind]}</td>
									<td>{requestStatusLabels[request.status]}</td>
									<td>
										{#each request.deadlines.filter((deadline) => deadline.overdue) as deadline (deadline.label)}
											<div>{deadline.label} {date(deadline.due)}</div>
										{/each}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	</section>
{/if}

{#if data.recentReviews}
	<section>
		<h2>Latest reviews</h2>
		{#if data.recentReviews.length === 0}
			<p>No reviews recorded yet. <a href="/workspace/reviews">Find something to review</a></p>
		{:else}
			<ul>
				{#each data.recentReviews as review (review.identifier)}
					<li>
						<a href="/workspace/reviews/{review.subjectKind}/{review.subjectIdentifier}"
							>{review.title}</a
						> ({subjectKindLabels[review.subjectKind].toLocaleLowerCase('en-US')}): {decisionLabels[review.decision].toLocaleLowerCase('en-US')} by {review.personName},
						{date(review.createdAt)}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<section>
	<h2>How content changes</h2>
	<p>
		The text of the code, the essays and the nation records lives in the project’s files and changes
		only by pull request, so every change has a history. This workspace records who approved which
		version, handles requests from nations, and manages who can do what.
	</p>
</section>
