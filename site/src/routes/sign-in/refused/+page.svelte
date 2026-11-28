<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Not signed in · Tribal Law Project</title>
</svelte:head>

<div class="reading">
	<h1>Not signed in</h1>
	<div class="notice" role="note">
		<p>{data.message}</p>
	</div>
	<p><a class="button" href="/sign-in">Sign in again</a></p>
	<p>
		Nobody needs an account to read the site or to send a request:
		use <a href="#request">Request a Change</a> instead.
	</p>
</div>
