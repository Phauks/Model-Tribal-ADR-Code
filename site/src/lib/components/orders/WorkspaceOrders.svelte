<script lang="ts">
	// The workspace's Orders page body: every order from the Store, books and
	// merchandise alike, filtered by kind and status (docs/store.md). Problems
	// and refunds are the same for every kind of item. The kind is a row of
	// buttons over the table; the status is the filter on the table's
	// "Where it stands" column.
	import { enhance } from '$app/forms';
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import { formatDollars } from '#lib/book-order.ts';
	import {
		itemKindLabels,
		itemKinds,
		kindsOf,
		orderStatusLabels,
		type ItemKind,
		type WorkspaceOrder
	} from '#lib/orders.ts';
	import { readableDate } from '#lib/readable-date.ts';
	import OrderLines from './OrderLines.svelte';

	let { orders, refundError }: { orders: WorkspaceOrder[]; refundError?: { order: string; message: string } } = $props();

	let kind = $state<ItemKind | 'all'>('all');
	const shown = $derived(orders.filter((order) => kind === 'all' || kindsOf(order).includes(kind)));

	const money = (cents: number) => formatDollars(cents / 100);
	const day = (stamp: string | null) => (stamp ? readableDate(stamp.slice(0, 10)) : '');
	const stripeLink = (mode: 'test' | 'live', session: string) =>
		`https://dashboard.stripe.com/${mode === 'test' ? 'test/' : ''}search?query=${encodeURIComponent(session)}`;
	const buyer = (order: WorkspaceOrder) =>
		order.recipientName ?? (order.status === 'awaiting-payment' || order.status === 'expired' ? 'Not given' : 'Details cleared');

	const columns: TableColumn[] = [
		{ key: 'ordered', header: 'Ordered', type: 'date', sortable: true, custom: true },
		{ key: 'items', header: 'Items', searchable: true, custom: true },
		{ key: 'buyer', header: 'Buyer', sortable: true, searchable: true, custom: true },
		{ key: 'status', header: 'Where it stands', sortable: true, filterable: true, custom: true },
		{ key: 'paid', header: 'Paid', type: 'number', sortable: true, custom: true },
		{ key: 'refund', header: 'Refund', custom: true }
	];
	const rows: TableRow[] = $derived(
		shown.map((order) => ({
			key: order.identifier,
			cells: {
				ordered: { text: `${day(order.placedAt)}${order.mode === 'test' ? ' (test)' : ''}`, sortValue: order.placedAt ?? '' },
				items: { text: order.lines.map((line) => `${line.quantity > 1 ? `${line.quantity} × ` : ''}${line.label}${line.detail ? ` · ${line.detail}` : ''}`).join('; ') },
				buyer: { text: [buyer(order), order.email ?? ''].filter(Boolean).join(', ') },
				status: { text: orderStatusLabels[order.status], values: [orderStatusLabels[order.status]] },
				paid: { text: money(order.priceCents + order.giftCents), sortValue: order.priceCents + order.giftCents },
				refund: { text: order.refundedCents > 0 ? `Refunded ${money(order.refundedCents)} on ${day(order.refundedAt)}` : '' }
			}
		}))
	);
	const byKey = $derived(new Map(orders.map((order) => [order.identifier, order])));
</script>

<div class="filters">
	<fieldset class="kinds">
		<legend class="visually-hidden">Kind of item</legend>
		<label class:chosen={kind === 'all'}><input type="radio" name="order-kind" value="all" bind:group={kind} />All</label>
		{#each itemKinds as option (option)}
			<label class:chosen={kind === option}><input type="radio" name="order-kind" value={option} bind:group={kind} />{itemKindLabels[option]}</label>
		{/each}
	</fieldset>
</div>

{#if shown.length === 0}
	<p>No orders.</p>
{:else}
	<DataTable
		identifier="orders"
		label="Table: orders"
		{columns}
		{rows}
		defaultSort={{ key: 'ordered', direction: 'descending' }}
		rowName={['order', 'orders']}
		filters
	>
		{#snippet cell(row, column)}
			{@const order = byKey.get(row.key)}
			{#if !order}
				<!-- Every row is an order. -->
			{:else if column.key === 'ordered'}
				<a href="/orders/{order.identifier}">{day(order.placedAt)}</a>
				{#if order.mode === 'test'}<br /><span class="small muted">Test</span>{/if}
			{:else if column.key === 'items'}
				<OrderLines lines={order.lines} showMaker />
			{:else if column.key === 'buyer'}
				{buyer(order)}
				{#if order.email}<br /><span class="small">{order.email}</span>{/if}
			{:else if column.key === 'status'}
				{orderStatusLabels[order.status]}
				{#if order.makerMessage}<br /><span class="small">{order.makerMessage}</span>{/if}
				{#if order.trackingLink}<br /><a class="small" href={order.trackingLink} rel="noreferrer">Tracking</a>{/if}
				{#if order.openProblems > 0}<br /><strong class="small">{order.openProblems} open {order.openProblems === 1 ? 'problem' : 'problems'}</strong>{/if}
			{:else if column.key === 'paid'}
				<span class="amount">{money(order.priceCents + order.giftCents)}</span>
				{#if order.giftCents > 0}<br /><span class="small">Gift {money(order.giftCents)}</span>{/if}
				{#if order.paymentSession}<br /><a class="small" href={stripeLink(order.mode, order.paymentSession)} rel="noreferrer">In Stripe</a>{/if}
			{:else}
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
			{/if}
		{/snippet}
	</DataTable>
{/if}

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		margin: 0 0 var(--space-3);
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
		outline: 3px solid var(--focus-ring);
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
