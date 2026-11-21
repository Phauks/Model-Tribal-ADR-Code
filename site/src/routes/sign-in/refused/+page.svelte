<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Not signed in · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Not signed in</h1>
	<div class="notice" role="note">
		<p>{data.message}</p>
	</div>
	<p><a class="button" href="/sign-in">Sign in again</a></p>
	<p>
		Nobody needs an account to read the site or to send a request:
		<a href="/requests">make a request</a> instead.
	</p>
</div>
