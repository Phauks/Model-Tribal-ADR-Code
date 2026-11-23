<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>Stop email from the project · Model Tribal ADR Code</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="reading">
	<h1>Stop email from the project</h1>
	{#if form?.done}
		<p class="lead">Done. The project will not write to {form.email} again.</p>
		<p>
			If this was a mistake, or you would like to hear from us after all, write to the project from the address you would like us to use.
		</p>
	{:else if form && !form.done}
		<p class="lead">This link is not valid. It may have been copied only in part.</p>
		<p>You can also reply “stop” to the message you received, and a person will take your address off the list.</p>
	{:else}
		<p class="lead">Press the button to stop all further email from the Model Tribal ADR Code project to the address this message went to.</p>
		<form method="post">
			<p><button class="button" type="submit">Stop email to this address</button></p>
		</form>
		<p class="small muted">Nothing changes until you press the button, because some mail systems open links in messages by themselves.</p>
	{/if}
</div>
