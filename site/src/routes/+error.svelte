<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title
		>{page.status === 404 ? 'Page not found' : page.status === 403 ? 'Not allowed' : 'Something went wrong'} · Model Tribal ADR Code</title
	>
</svelte:head>

<div class="reading">
	{#if page.status === 404}
		<h1>Page not found</h1>
		<p>
			No page has this address. If you typed it, check the spelling. If you followed a link, the page
			may have moved; every moved page is meant to leave a redirect, so please
			<a href="/requests">tell us about the broken link</a>.
		</p>
	{:else if page.status === 403}
		<h1>Not allowed</h1>
		<p>{page.error?.message}</p>
		<p>If you think you should have access, ask the lead author.</p>
	{:else}
		<h1>Something went wrong</h1>
		<!-- Messages the site wrote itself, such as "Sign-in is not available right now", are shown; others are not. -->
		<p>{page.status === 500 ? 'The page could not be shown. Try again in a moment.' : page.error?.message}</p>
	{/if}
	<p><a href="/">Go to the home page</a></p>
</div>
