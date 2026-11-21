<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Sign in · Model Tribal ADR Code</title>
</svelte:head>

<div class="reading">
	<h1>Sign in</h1>
	<div class="notice" role="note">
		<p>
			Sign-in is not set up yet. The site needs these settings in Cloudflare before co-authors can
			sign in:
		</p>
		<ul>
			{#each data.missing as name (name)}
				<li><code>{name}</code></li>
			{/each}
		</ul>
		<p>site/COLLABORATION.md explains where to set them.</p>
	</div>
	<p>
		Nobody needs to sign in to read the site or to send a request. To ask the project something, use
		<a href="/requests">Make a request</a>.
	</p>
</div>
