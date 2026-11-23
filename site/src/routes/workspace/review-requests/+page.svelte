<script lang="ts">
	import { essayDate } from '#lib/essays/dates.ts';
	import { dueDate, inReviewText } from '#lib/essays/review-requests.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const today = new Date().toISOString().slice(0, 10);
</script>

<svelte:head>
	<title>Review requests · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Review requests</h1>
<p class="lead">Drafts and sections people asked you to review. Each link opens the essay for commenting at the part to review; choose Done reviewing there when you have finished.</p>

<section aria-labelledby="for-you-heading">
	<h2 id="for-you-heading">For you</h2>
	{#if data.forYou.length === 0}
		<p class="muted">Nothing is waiting on you.</p>
	{:else}
		<ul class="requests">
			{#each data.forYou as request (request.identifier)}
				<li class="panel">
					<p>
						<a href={request.link}><strong>{request.sectionTitle ?? 'The whole draft'}</strong></a> in <em>{request.essayTitle}</em>
					</p>
					<p class="small">
						Asked by {request.requestedByName}, {essayDate(request.createdAt)}.
						{#if request.dueOn}<span class:overdue={request.dueOn < today}>Due {dueDate(request.dueOn)}{request.dueOn < today ? ', past due' : ''}.</span>{/if}
					</p>
					{#if request.message}<p class="message">“{request.message}”</p>{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if data.yours.length}
	<section aria-labelledby="yours-heading">
		<h2 id="yours-heading">You asked</h2>
		<ul class="requests">
			{#each data.yours as request (request.identifier)}
				<li class="panel">
					<p>
						<a href={request.link}><strong>{request.sectionTitle ?? 'The whole draft'}</strong></a> in <em>{request.essayTitle}</em>
					</p>
					<p class="small">{inReviewText(request)}.</p>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.requests {
		list-style: none;
		padding: 0;
		display: grid;
		gap: var(--space-3);
	}

	.requests p {
		margin: 0 0 var(--space-1);
	}

	.message {
		white-space: pre-wrap;
	}

	.overdue {
		color: var(--color-danger);
		font-weight: var(--font-weight-semibold);
	}
</style>
