<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import FormDocument from '#lib/components/FormDocument.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.title} · Request {data.reference} · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Workspace', href: '/workspace' },
		{ label: 'Requests', href: '/workspace/requests' },
		{ label: `Request ${data.reference}`, href: `/workspace/requests/${data.reference}` }
	]}
/>
<h1>{data.title}</h1>
<p class="small muted">
	Version {data.version}. Signed online as “{data.signedName}”{#if data.signedAt}
		on {new Date(data.signedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}{/if}.
	{#if data.hasCopy}
		<a href="/workspace/requests/{data.reference}/forms/{data.identifier}/copy" download>Download the stored copy</a>
	{/if}
</p>

<FormDocument html={data.html} mode="filled" />
