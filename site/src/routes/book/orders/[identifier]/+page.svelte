<script lang="ts">
	import { formatDollars } from '#lib/book-order.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const statusText: Record<string, string> = {
		'awaiting-payment': 'Waiting for payment. If you closed the payment page, you can order again from the book page.',
		paid: 'Paid. The order is on its way to the printer.',
		'sent-to-printer': 'With Lulu. Printing starts within two hours and takes about 3 to 5 business days, then the copy ships.',
		'printer-refused': 'Lulu could not print this order. The project will fix it or refund you, and will write to you by email.',
		shipped: 'Shipped.',
		canceled: 'Canceled.',
		expired: 'The payment page expired before payment, so nothing was charged.'
	};
</script>

<svelte:head>
	<title>Your printed copy · Model Tribal ADR Code</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="reading">
	<h1>Your printed copy</h1>
	{#if data.justPaid}
		<p class="lead">Thank you. Stripe has emailed your receipt. Keep this page’s address to check on the order.</p>
	{/if}
	{#if data.order.mode === 'test'}
		<div class="notice" role="status"><p>Test order: nothing was charged and nothing will be printed.</p></div>
	{/if}
	<div class="panel">
		<p><strong>{data.order.title}</strong>, {data.order.pages} pages, {formatDollars(data.order.priceCents / 100)}</p>
		{#if data.order.giftCents > 0}
			<p>And a gift to the project of {formatDollars(data.order.giftCents / 100)}. Thank you.</p>
		{/if}
		<p>{statusText[data.order.status] ?? data.order.status}</p>
		{#if data.order.trackingLink}
			<p><a href={data.order.trackingLink} rel="noreferrer">Track the package</a></p>
		{/if}
	</div>
	<p class="muted">
		Something wrong with your copy? <a href="/requests?kind=question&record=book-order">Tell us</a> and give
		this page’s address.
	</p>
</div>
