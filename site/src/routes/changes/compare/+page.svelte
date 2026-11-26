<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import ChangeComparison from '#lib/components/changes/ChangeComparison.svelte';
	import { dateTime } from '#lib/change-dates.ts';
	import type { ChangeView } from '#lib/page-history.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const pageName = $derived(data.to.title ?? data.from.title ?? 'A page no longer on this site');

	function describe(view: ChangeView): string {
		return `${dateTime(view.madeAt)}, ${view.whoHidden ? 'name hidden' : view.who}`;
	}
</script>

<svelte:head>
	<title>Compare versions of {pageName} · Tribal Law Project</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Recent changes', href: '/changes' },
		{ label: `History of ${pageName}`, href: `/changes?page=${encodeURIComponent(data.to.address)}` }
	]}
/>

<h1>Compare two versions of {pageName}</h1>
<p class="small muted">
	Older: <a href="/changes/{data.from.id}/version">{describe(data.from)}</a>. Newer:
	<a href="/changes/{data.to.id}/version">{describe(data.to)}</a>.
</p>

{#if data.comparison.kind === 'compared'}
	<ChangeComparison
		blocks={data.comparison.blocks}
		beforeLabel={`Older: ${describe(data.from)}`}
		afterLabel={`Newer: ${describe(data.to)}`}
	/>
{:else if data.comparison.kind === 'parts'}
	<p>Earlier wording of this page is not shown on this site.</p>
{:else if data.comparison.kind === 'hidden'}
	<p>One of these versions is hidden, so they cannot be compared.</p>
{:else}
	<p>The text of one of these versions is not available to compare.</p>
{/if}
