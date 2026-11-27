<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Stop emails about pages you follow · Tribal Law Project</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="reading">
	{#if form?.done}
		<h1>Emails stopped</h1>
		<div class="notice" role="status">
			<p>You will get no more emails about pages you follow.</p>
		</div>
		<p>
			You still follow the same pages, and their updates still show on the site when you are signed in. To
			change this, or to stop following pages, go to <a href="/following">Following</a>.
		</p>
	{:else}
		<h1>Stop emails about pages you follow?</h1>
		<p>
			This stops the summary emails. You still follow the same pages, and their updates still show on the
			site when you are signed in.
		</p>
		{#if form?.problem}
			<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
		{/if}
		<form method="post">
			<input type="hidden" name="token" value={data.token} />
			<p><button class="button" type="submit">Stop the emails</button></p>
		</form>
	{/if}
</div>
