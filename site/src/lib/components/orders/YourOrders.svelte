<script lang="ts">
	// Account, Your orders: everything bought from the Store while signed in
	// (docs/store.md). Each order opens its own page with tracking and the
	// problem form.
	import { formatDollars } from '#lib/book-order.ts';
	import { orderStatusLabels, type OrderSummary } from '#lib/orders.ts';
	import { readableDate } from '#lib/readable-date.ts';
	import OrderLines from './OrderLines.svelte';

	let { orders }: { orders: OrderSummary[] } = $props();

	const money = (cents: number) => formatDollars(cents / 100);
	const day = (stamp: string) => readableDate(stamp.slice(0, 10));
</script>

{#if orders.length === 0}
	<p>No orders yet. <a href="/store">Store</a></p>
{:else}
	<div class="table-scroll">
		<table>
			<thead>
				<tr>
					<th scope="col">Ordered</th>
					<th scope="col">Items</th>
					<th scope="col">Paid</th>
					<th scope="col">Where it stands</th>
					<th scope="col">Tracking</th>
				</tr>
			</thead>
			<tbody>
				{#each orders as order (order.identifier)}
					<tr>
						<td><a href="/orders/{order.identifier}">{day(order.placedAt)}</a>{#if order.mode === 'test'}<br /><span class="small muted">Test</span>{/if}</td>
						<td><OrderLines lines={order.lines} /></td>
						<td class="amount">
							{money(order.priceCents + order.giftCents)}
							{#if order.giftCents > 0}<br /><span class="small">Gift {money(order.giftCents)}</span>{/if}
							{#if order.refundedCents > 0}<br /><span class="small">Refunded {money(order.refundedCents)}</span>{/if}
						</td>
						<td>
							{orderStatusLabels[order.status]}
							{#if order.openProblems > 0}<br /><span class="small">Problem reported</span>{/if}
						</td>
						<td>
							{#if order.trackingLink}<a href={order.trackingLink} rel="noreferrer">Track</a>{:else}<span class="muted">Not yet</span>{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.amount {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
</style>
