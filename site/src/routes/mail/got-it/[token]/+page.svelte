<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>Let us know you got our message · Model Tribal ADR Code</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="reading">
	<h1>Let us know you got our message</h1>
	{#if form?.done}
		<p class="lead">Thank you. We have noted that our message reached you, and nothing else.</p>
	{:else if form}
		<p class="lead">This link is not valid. It may have been copied only in part.</p>
	{:else}
		<p class="lead">Press the button to tell the Model Tribal ADR Code project that our message reached you. It records only that you pressed it.</p>
		<form method="post">
			<p><button class="button" type="submit">Yes, I got it</button></p>
		</form>
	{/if}
</div>
