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

{#if data.profileState !== 'confirmed'}
	<div class="notice" role="note">
		<p>
			{data.profileState === 'missing'
				? 'You have not set up your contributor profile yet. It records how you want to be credited in the book and on the website.'
				: 'Your contributor profile has changes you have not confirmed yet.'}
			<a href="/profile">{data.profileState === 'missing' ? 'Set up your profile' : 'Check and confirm'}</a>
		</p>
	</div>
{/if}

{#if data.ownNation}
	<section class="panel">
		<h2>Your nation’s record</h2>
		<p>
			You review the record for <strong>{data.ownNation.title}</strong> on behalf of the nation.
		</p>
		<p><a class="button" href="/workspace/reviews/nation/{data.ownNation.identifier}">Review the record</a></p>
	</section>
{/if}

{#if data.administration}
	<section class="panel">
		<h2>Administration</h2>
		<ul>
			<li>
				{data.administration.grants} access {data.administration.grants === 1 ? 'grant' : 'grants'} in force{#if data.administration.grantsExpiringSoon}, {data.administration.grantsExpiringSoon} ending within 14 days{/if}.
				<a href="/workspace/access">Manage access</a>
			</li>
			<li>
				{data.administration.refusedLastThirtyDays} refused {data.administration.refusedLastThirtyDays === 1 ? 'attempt' : 'attempts'} in the last 30 days.
				<a href="/workspace/activity">See the activity log</a>
			</li>
			<li>
				{#if data.administration.seals.intact}
					Activity log intact ({data.administration.seals.checked} entries checked).
				{:else}
					<strong>Activity log check failed at entry {data.administration.seals.brokenAt}.</strong>
					<a href="/workspace/activity">See why</a>
				{/if}
			</li>
		</ul>
	</section>
{/if}

{#if data.granted.length > 0}
	<section>
		<h2>Documents opened to you</h2>
		<ul>
			{#each data.granted as subject (`${subject.kind}/${subject.identifier}`)}
				<li>
					<a href="/workspace/reviews/{subject.kind}/{subject.identifier}">{subject.title}</a>
					({subjectKindLabels[subject.kind].toLocaleLowerCase('en-US')})
				</li>
			{/each}
		</ul>
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
		The text of the code, the essays and the nation records lives in the repository’s files and changes
		only by pull request, so every change has a history. This workspace records who approved which
		version, handles requests from nations, and manages who can do what.
	</p>
</section>
