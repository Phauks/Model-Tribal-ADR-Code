<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import { dateTime } from '#lib/change-dates.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const change = $derived(data.change);
	const pageName = $derived(change.title ?? 'A page no longer on this site');
</script>

<svelte:head>
	<title>{pageName}, as of {dateTime(change.madeAt)} · Tribal Law Project</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Recent changes', href: '/changes' },
		{ label: `History of ${pageName}`, href: `/changes?page=${encodeURIComponent(change.address)}` }
	]}
	current="As of {dateTime(change.madeAt)}"
/>

<p class="notice">
	This is an old version of <a href={change.address}>{pageName}</a>, as it stood after the change of
	{dateTime(change.madeAt)}. It is shown as plain text, without the page’s layout, links or source notes.
	<a href="/changes/{change.id}">See what that change did</a>.
</p>

<article class="reading old-version">
	{#each data.blocks as block, index (index)}
		{#if block.level === 2}<h1>{block.text}</h1>
		{:else if block.level === 3}<h2>{block.text}</h2>
		{:else if block.level >= 4}<h3>{block.text}</h3>
		{:else}<p>{block.text}</p>{/if}
	{/each}
</article>

<style>
	.notice {
		background: var(--color-notice-background);
		border-radius: var(--radius-panel);
		padding: var(--space-3) var(--space-4);
		max-width: var(--layout-measure);
	}

	.old-version p {
		white-space: pre-wrap;
	}
</style>
