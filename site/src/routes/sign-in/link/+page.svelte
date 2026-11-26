<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Sign in with a link · Tribal Law Project</title>
</svelte:head>

<div class="reading">
	<h1>Sign in</h1>
	{#if form?.problem}
		<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
	{/if}
	{#if data.works}
		<form method="post" class="panel">
			<input type="hidden" name="token" value={data.token} />
			<input type="hidden" name="returnTo" value={data.returnTo} />
			<p>Press the button to finish signing in on this browser. The link works once.</p>
			<button class="button" type="submit">Sign in</button>
		</form>
	{:else}
		<div class="notice" role="note">
			<p>
				This sign-in link has expired or was already used. Links in a sign-in email work for 15
				minutes; links from the lead author work for 7 days.
			</p>
		</div>
		<p><a class="button" href="/sign-in">Ask for a new code</a></p>
	{/if}
</div>
