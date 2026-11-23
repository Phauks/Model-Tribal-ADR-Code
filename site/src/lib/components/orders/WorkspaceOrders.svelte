<script lang="ts">
	// The workspace's Orders page body: every order from the Store, books and
	// merchandise alike, filtered by kind and status (docs/store.md). Problems
	// and refunds are the same for every kind of item.
	import { enhance } from '$app/forms';
	import { formatDollars } from '#lib/book-order.ts';
	import {
		itemKindLabels,
		itemKinds,
		kindsOf,
		orderStatusLabels,
		orderStatuses,
		type ItemKind,
		type OrderStatus,
		type WorkspaceOrder
	} from '#lib/orders.ts';
	import { readableDate } from '#lib/readable-date.ts';
	import OrderLines from './OrderLines.svelte';

	let { orders, refundError }: { orders: WorkspaceOrder[]; refundError?: { order: string; message: string } } = $props();

	let kind = $state<ItemKind | 'all'>('all');
	let status = $state<OrderStatus | 'all'>('all');
	const shown = $derived(
		orders.filter((order) => (kind === 'all' || kindsOf(order).includes(kind)) && (status === 'all' || order.status === status))
	);

	const money = (cents: number) => formatDollars(cents / 100);
	const day = (stamp: string | null) => (stamp ? readableDate(stamp.slice(0, 10)) : '');
	const stripeLink = (mode: 'test' | 'live', session: string) =>
		`https://dashboard.stripe.com/${mode === 'test' ? 'test/' : ''}search?query=${encodeURIComponent(session)}`;
</script>

<div class="filters">
	<fieldset class="kinds">
		<legend class="visually-hidden">Kind of item</legend>
		<label class:chosen={kind === 'all'}><input type="radio" name="order-kind" value="all" bind:group={kind} />All</label>
		{#each itemKinds as option (option)}
			<label class:chosen={kind === option}><input type="radio" name="order-kind" value={option} bind:group={kind} />{itemKindLabels[option]}</label>
		{/each}
	</fieldset>
	<div class="field">
		<label class="visually-hidden" for="order-status">Where it stands</label>
		<select id="order-status" bind:value={status}>
			<option value="all">Any status</option>
			{#each orderStatuses as option (option)}<option value={option}>{orderStatusLabels[option]}</option>{/each}
		</select>
	</div>
</div>

{#if shown.length === 0}
	<p>No orders.</p>
{:else}
	<div class="table-scroll">
		<table>
			<thead>
				<tr>
					<th scope="col">Ordered</th>
					<th scope="col">Items</th>
					<th scope="col">Buyer</th>
					<th scope="col">Where it stands</th>
					<th scope="col">Paid</th>
					<th scope="col">Refund</th>
				</tr>
			</thead>
			<tbody>
				{#each shown as order (order.identifier)}
					<tr>
						<td>
							<a href="/orders/{order.identifier}">{day(order.placedAt)}</a>
							{#if order.mode === 'test'}<br /><span class="small muted">Test</span>{/if}
						</td>
						<td><OrderLines lines={order.lines} showMaker /></td>
						<td>
							{order.recipientName ?? (order.status === 'awaiting-payment' || order.status === 'expired' ? 'Not given' : 'Details cleared')}
							{#if order.email}<br /><span class="small">{order.email}</span>{/if}
						</td>
						<td>
							{orderStatusLabels[order.status]}
							{#if order.makerMessage}<br /><span class="small">{order.makerMessage}</span>{/if}
							{#if order.trackingLink}<br /><a class="small" href={order.trackingLink} rel="noreferrer">Tracking</a>{/if}
							{#if order.openProblems > 0}<br /><strong class="small">{order.openProblems} open {order.openProblems === 1 ? 'problem' : 'problems'}</strong>{/if}
						</td>
						<td class="amount">
							{money(order.priceCents + order.giftCents)}
							{#if order.giftCents > 0}<br /><span class="small">Gift {money(order.giftCents)}</span>{/if}
							{#if order.paymentSession}<br /><a class="small" href={stripeLink(order.mode, order.paymentSession)} rel="noreferrer">In Stripe</a>{/if}
						</td>
						<td>
							{#if order.refundedCents > 0}<span class="small">Refunded {money(order.refundedCents)} on {day(order.refundedAt)}</span>{/if}
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
								{#if refundError?.order === order.identifier}<p class="field-error" role="alert">{refundError.message}</p>{/if}
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		margin: 0 0 var(--space-3);
	}
	.filters .field {
		margin: 0;
	}
	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		border: 0;
		padding: 0;
		margin: 0;
	}
	.kinds label {
		display: inline-flex;
		align-items: center;
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-4);
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		cursor: pointer;
	}
	.kinds label.chosen {
		border-color: var(--color-action);
		box-shadow: inset 0 0 0 1px var(--color-action);
		font-weight: var(--font-weight-semibold);
	}
	.kinds input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.kinds label:has(input:focus-visible) {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: 2px;
	}
	.amount {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
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
