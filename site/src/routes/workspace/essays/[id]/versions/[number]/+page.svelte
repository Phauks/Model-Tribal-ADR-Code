<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import SourceList from '#lib/components/SourceList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let showMarkdown = $state(false);
</script>

<svelte:head>
	<title>Version {data.number} · {data.title} · Workspace · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Workspace', href: '/workspace' },
		{ label: 'Essays', href: '/workspace/essays' },
		{ label: data.title, href: `/workspace/essays/${data.identifier}` }
	]}
	current={data.title}
/>

<div class="notice" role="note">
	<p>
		Version {data.number}, saved by {data.by}, {data.at}.{#if data.note} “{data.note}”{/if}
		<span class="small muted">SHA-256 {data.sha256.slice(0, 16)}…</span>
	</p>
	{#if data.problems.length > 0}
		<p><strong>Cannot be published yet:</strong> {data.problems.join(' ')}</p>
	{/if}
	{#if data.warnings?.length}
		<p><strong>Check before publishing:</strong></p>
		<ul>
			{#each data.warnings as warning, index (index)}
				<li>{warning}</li>
			{/each}
		</ul>
	{/if}
	<p><label><input type="checkbox" bind:checked={showMarkdown} /> Show the Markdown</label></p>
</div>

{#if showMarkdown}
	<pre class="markdown-source">{data.markdown}</pre>
{:else}
	<article class="reading essay">
		<h1>{data.title}</h1>
		<div class="essay-text">{@html data.html}</div>
		<SourceList sources={data.sources} />
	</article>
{/if}

<style>
	.markdown-source {
		white-space: pre-wrap;
		font-size: var(--font-size-small);
	}
</style>
