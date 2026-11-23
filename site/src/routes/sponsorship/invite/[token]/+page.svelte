<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Invitation to manage a sponsorship · Model Tribal ADR Code</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="reading">
	<h1>Manage a sponsorship</h1>
	{#if form?.problem}
		<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
	{/if}
	{#if data.sponsor}
		<p>
			You have been invited to manage <strong>{data.sponsor}</strong>’s sponsorship of the project. You will be able to
			change how it is listed, give, and change billing.
		</p>
		<form method="post">
			<button class="button" type="submit">Accept</button>
		</form>
	{:else}
		<p>This invitation has been used, withdrawn or has expired. Ask the person who sent it for a new one.</p>
	{/if}
</div>
