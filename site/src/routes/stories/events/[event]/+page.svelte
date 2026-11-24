<!--
	@component
	One federal policy or event, such as allotment, with every account of it
	(src/lib/server/impact-accounts.ts; Trevor, Nov. 24, 2026).
-->
<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import ImpactAccounts from '#lib/components/ImpactAccounts.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.name} · Stories · Model Tribal ADR Code</title>
	<meta name="description" content="Accounts of {data.name.toLocaleLowerCase('en-US')}, each in the teller’s own words." />
</svelte:head>

<Breadcrumbs trail={[{ label: 'Stories', href: '/stories' }]} />

<div class="reading">
	<h1><span class="muted event-kind">Event:</span> {data.name}</h1>
	<ImpactAccounts accounts={data.accounts} />
</div>

<style>
	.event-kind {
		font-weight: normal;
	}
</style>
