<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDollars } from '#lib/book-order.ts';
	import { orderStatusLabels, problemKindLabels, problemStatusLabels } from '#lib/book-order-problems.ts';
	import { readableDate } from '#lib/readable-date.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const money = (cents: number) => formatDollars(cents / 100);
	const day = (stamp: string | null) => (stamp ? readableDate(stamp.slice(0, 10)) : '');
	const stripeLink = (mode: 'test' | 'live', session: string) =>
		`https://dashboard.stripe.com/${mode === 'test' ? 'test/' : ''}search?query=${encodeURIComponent(session)}`;
</script>

<svelte:head>
	<title>Book orders · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Book orders</h1>
<p>
	Every printed-copy order, the problems buyers report from their order’s page, and refunds. Answers you write here show on
	the buyer’s order page. Refunds are made in Stripe’s dashboard; record each one here so the buyer’s page says so.
</p>
{#if data.ordering.open}
	<p class="small"><strong>Ordering is open in {data.ordering.mode} mode.</strong></p>
{:else}
	<p class="small"><strong>Ordering is closed.</strong> Buyers read: “{data.ordering.reason}”</p>
{/if}

<section aria-labelledby="problems-heading">
	<h2 id="problems-heading">Problems to deal with</h2>
	{#if data.problems.length === 0}
		<p>None. Problems buyers report show here until you close them.</p>
	{:else}
		<ul class="problems">
			{#each data.problems as problem (problem.identifier)}
				<li class="panel">
					<p>
						<strong>{problemKindLabels[problem.kind]}</strong>
						<span class="muted">
							· {day(problem.reportedAt)} · {problemStatusLabels[problem.status]}
							{#if problem.orderMode === 'test'}· test order{/if}
						</span>
					</p>
					<p class="small">
						Order of {day(problem.orderPlacedAt)}, {problem.orderStatus ? (orderStatusLabels[problem.orderStatus] ?? problem.orderStatus) : 'unknown'}:
						<a href="/book/orders/{problem.orderIdentifier}">the buyer’s page</a>
					</p>
					<p class="details">{problem.details}</p>
					{#if problem.hasPhoto}
						<p><a href="/workspace/book-orders/photos/{problem.identifier}" target="_blank" rel="noreferrer">Open the photo</a></p>
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
	{/if}
</section>

<section aria-labelledby="orders-heading">
	<h2 id="orders-heading">Every order</h2>
	{#if data.orders.length === 0}
		<p>No orders yet.</p>
	{:else}
		<div class="table-scroll">
			<table>
				<thead>
					<tr>
						<th scope="col">Ordered</th>
						<th scope="col">Buyer</th>
						<th scope="col">Where it stands</th>
						<th scope="col">Paid</th>
						<th scope="col">Refund</th>
					</tr>
				</thead>
				<tbody>
					{#each data.orders as order (order.identifier)}
						<tr>
							<td>
								<a href="/book/orders/{order.identifier}">{day(order.placedAt)}</a>
								{#if order.mode === 'test'}<br /><span class="small muted">Test</span>{/if}
							</td>
							<td>
								{order.recipientName ?? 'Details cleared'}
								{#if order.email}<br /><span class="small">{order.email}</span>{/if}
							</td>
							<td>
								{orderStatusLabels[order.status] ?? order.status}
								{#if order.printJob}<br /><span class="small">Lulu job {order.printJob}{order.printerStatus ? `, ${order.printerStatus}` : ''}</span>{/if}
								{#if order.printerMessage}<br /><span class="small">{order.printerMessage}</span>{/if}
								{#if order.trackingLink}<br /><a class="small" href={order.trackingLink} rel="noreferrer">Tracking</a>{/if}
								{#if order.openProblems > 0}<br /><strong class="small">{order.openProblems} open {order.openProblems === 1 ? 'problem' : 'problems'}</strong>{/if}
							</td>
							<td>
								{money(order.priceCents)}
								{#if order.paymentSession}<br /><a class="small" href={stripeLink(order.mode, order.paymentSession)} rel="noreferrer">In Stripe</a>{/if}
							</td>
							<td>
								{#if order.refundedCents > 0}
									<span class="small">Refunded {money(order.refundedCents)} on {day(order.refundedAt)}</span>
								{/if}
								{#if order.status !== 'awaiting-payment' && order.status !== 'expired'}
									<form method="POST" action="?/refund" use:enhance class="refund">
										<input type="hidden" name="order" value={order.identifier} />
										<label class="visually-hidden" for="refund-{order.identifier}">Total refunded, in dollars</label>
										<input
											id="refund-{order.identifier}"
											name="amount"
											type="text"
											inputmode="decimal"
											autocomplete="off"
											placeholder="0.00"
											value={order.refundedCents > 0 ? (order.refundedCents / 100).toFixed(2) : ''}
										/>
										<button type="submit" class="button button-quiet">Record</button>
									</form>
									{#if form && 'refundError' in form && form.order === order.identifier}
										<p class="field-error" role="alert">{form.refundError}</p>
									{/if}
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="small muted">
			Record the total refunded so far, after refunding in Stripe. Lulu’s own reprint for a damaged or misprinted copy, or one
			that never arrived, is asked for through Lulu’s support form, with the buyer’s photo.
		</p>
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

	.refund {
		display: flex;
		gap: var(--space-1);
		margin-top: var(--space-1);
	}

	.refund input {
		width: 6rem;
	}
</style>
