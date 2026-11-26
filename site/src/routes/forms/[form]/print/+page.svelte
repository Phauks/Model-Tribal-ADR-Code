<script lang="ts">
	import FormDocument from '#lib/components/FormDocument.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.title} (to print) · Forms · Tribal Law Project</title>
</svelte:head>

<div class="reading">
	<p class="small no-print"><a href="/forms">All forms</a> · <a href="/forms/{data.slug}">Fill in online instead</a></p>
	<h1>{data.title}</h1>
	<p class="no-print">
		Print this page with your browser’s Print command, fill it in by hand and sign it.
		{#if data.sendable}
			Then send us a photo or scan on the <a href="/forms/{data.slug}#upload">form’s page</a>.
		{/if}
	</p>
	<FormDocument html={data.html} mode="blank" />
	{#if data.sendable}
		<p class="small print-only">
			Send the signed form as a photo or scan through the Forms page of the Tribal Law Project website.
		</p>
	{/if}
</div>
