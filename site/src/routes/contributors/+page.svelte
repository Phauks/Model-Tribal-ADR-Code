<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Contributors · Model Tribal ADR Code</title>
	<meta name="description" content="People who helped write and review the Model Tribal ADR Code." />
</svelte:head>

<div class="reading">
	<h1>Contributors</h1>
	<p class="lead">People who helped write and review this work, credited as each chose.</p>

	{#each data.sections as section (section.heading)}
		<section>
			<h2>{section.heading}</h2>
			{#each section.entries as entry, position (position)}
				<div class="credit">
					<p class="name">{entry.line}</p>
					{#if entry.biography}<p class="biography">{entry.biography}</p>{/if}
				</div>
			{/each}
		</section>
	{:else}
		<p>No one is listed yet.</p>
	{/each}

	<p class="small muted">Want to help? <a href="/join">Sign up</a>.</p>
</div>

<style>
	.credit {
		margin: 0 0 var(--space-4);
	}

	.name {
		font-weight: var(--font-weight-semibold);
		margin: 0;
	}

	.biography {
		margin: var(--space-1) 0 0;
	}
</style>
