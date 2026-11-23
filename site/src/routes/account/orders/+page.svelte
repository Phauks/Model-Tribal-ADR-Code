<script lang="ts">
	import { formatDollars } from '#lib/book-order.ts';
	import { orderStatusLabels } from '#lib/book-order-problems.ts';
	import { readableDate } from '#lib/readable-date.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const money = (cents: number) => formatDollars(cents / 100);
	const day = (stamp: string) => readableDate(stamp.slice(0, 10));
</script>

<svelte:head>
	<title>Your orders · Model Tribal ADR Code</title>
</svelte:head>

<h1>Your orders</h1>
<p class="lead">
	Printed copies you ordered while signed in. Open an order to see where it stands, track the package, or tell the project
	about a problem, such as a damaged copy, one that never arrived, or a refund.
</p>

{#if data.orders.length === 0}
	<p>
		No orders yet. <a href="/book">Order a printed copy</a>. An order placed while signed out is not listed here; its own page,
		linked from your Stripe receipt, still works.
	</p>
{:else}
	<div class="table-scroll">
		<table>
			<thead>
				<tr>
					<th scope="col">Ordered</th>
					<th scope="col">Book</th>
					<th scope="col">Paid</th>
					<th scope="col">Where it stands</th>
					<th scope="col">Tracking</th>
				</tr>
			</thead>
			<tbody>
				{#each data.orders as order (order.identifier)}
					<tr>
						<td><a href="/book/orders/{order.identifier}">{day(order.placedAt)}</a></td>
						<td>{order.title}, {order.pages} pages{order.mode === 'test' ? ' (test)' : ''}</td>
						<td>
							{money(order.priceCents)}
							{#if order.refundedCents > 0}<br /><span class="small">Refunded {money(order.refundedCents)}</span>{/if}
						</td>
						<td>
							{orderStatusLabels[order.status] ?? order.status}
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
