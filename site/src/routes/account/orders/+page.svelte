<script lang="ts">
	// Everything bought from the Store while signed in (docs/store.md). An order
	// placed while signed out keeps only its own page, linked from the Stripe
	// receipt, and is never matched by email.
	import YourOrders from '#lib/components/orders/YourOrders.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Your orders · Tribal Law Project</title>
</svelte:head>

<h1>Your orders</h1>
<YourOrders orders={data.orders} />
