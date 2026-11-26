<script lang="ts">
	// Every order from the Store, books and merchandise alike (docs/store.md):
	// problems buyers report come first, then every order, filtered by kind
	// and status. Answers show on the buyer's order page. Refunds are made in
	// Stripe's dashboard and recorded here.
	import { enhance } from '$app/forms';
	import Camera from '@lucide/svelte/icons/camera';
	import { problemKindLabels, problemStatusLabels } from '#lib/book-order-problems.ts';
	import WorkspaceOrders from '#lib/components/orders/WorkspaceOrders.svelte';
	import { readableDate } from '#lib/readable-date.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const day = (stamp: string | null) => (stamp ? readableDate(stamp.slice(0, 10)) : '');
	const refundError = $derived(form && 'refundError' in form && form.order && form.refundError ? { order: form.order, message: form.refundError } : undefined);
</script>

<svelte:head>
	<title>Orders · Workspace · Tribal Law Project</title>
</svelte:head>

<h1>Orders</h1>
{#if data.ordering.open}
	<p class="small"><strong>Ordering is open in {data.ordering.mode} mode.</strong></p>
{:else}
	<p class="small"><strong>Ordering is closed.</strong> Buyers read: “{data.ordering.reason}”</p>
{/if}

{#if data.problems.length > 0}
	<section aria-labelledby="problems-heading">
		<h2 id="problems-heading">Problems to deal with</h2>
		<ul class="problems">
			{#each data.problems as problem (problem.identifier)}
				<li class="panel">
					<p>
						<strong>{problemKindLabels[problem.kind]}</strong>
						<span class="muted">
							· {day(problem.reportedAt)} · {problemStatusLabels[problem.status]}{#if problem.orderMode === 'test'}{' · test order'}{/if}
						</span>
					</p>
					<p class="small">
						{#each problem.orderLines as line, index (index)}{line.label}{line.detail ? ` · ${line.detail}` : ''}{index < problem.orderLines.length - 1 ? '; ' : ''}{/each}
						· <a href="/orders/{problem.orderIdentifier}">the buyer’s page</a>
					</p>
					<p class="details">{problem.details}</p>
					{#if problem.hasPhoto}
						<p>
							<a class="icon-button" href="/workspace/orders/photos/{problem.identifier}" target="_blank" rel="noreferrer" aria-label="Open the photo" title="Open the photo"
								><Camera size={22} aria-hidden="true" /></a
							>
						</p>
					{/if}
					<form method="POST" action="?/answer" use:enhance>
						<input type="hidden" name="problem" value={problem.identifier} />
						<div class="field">
							<label for="answer-{problem.identifier}">Answer to the buyer</label>
							<textarea id="answer-{problem.identifier}" name="answer" rows="3" maxlength="4000">{problem.answer ?? ''}</textarea>
						</div>
						{#if form && 'answerError' in form && form.problem === problem.identifier}
							<p class="field-error" role="alert">{form.answerError}</p>
						{/if}
						<div class="actions">
							<button type="submit" class="button" name="status" value="answered">Send answer</button>
							<button type="submit" class="button button-quiet" name="status" value="closed">Close</button>
						</div>
					</form>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section aria-labelledby="orders-heading">
	<h2 id="orders-heading">Every order</h2>
	{#if data.orders.length === 0}
		<p>No orders yet.</p>
	{:else}
		<WorkspaceOrders orders={data.orders} {refundError} />
	{/if}
</section>

<style>
	.problems {
		display: grid;
		gap: var(--space-3);
		margin: 0 0 var(--space-5);
		padding: 0;
		list-style: none;
	}

	.details {
		white-space: pre-wrap;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
