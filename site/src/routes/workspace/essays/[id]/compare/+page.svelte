<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let showAll = $state(false);
</script>

<svelte:head>
	<title>Compare versions · {data.title} · Workspace · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Workspace', href: '/workspace' },
		{ label: 'Essays', href: '/workspace/essays' },
		{ label: data.title, href: `/workspace/essays/${data.identifier}` }
	]}
	current="Version {data.from.number} to version {data.to.number}"
/>

<h1>Version {data.from.number} to version {data.to.number}</h1>
<p class="small muted">
	Version {data.from.number}: {data.from.by}, {data.from.at}. Version {data.to.number}: {data.to.by}, {data.to.at}.
	{data.changed} {data.changed === 1 ? 'paragraph differs' : 'paragraphs differ'}.
</p>
<p><label><input type="checkbox" bind:checked={showAll} /> Show unchanged paragraphs too</label></p>

<div class="comparison reading">
	{#each data.changes as change, index (index)}
		{#if change.kind === 'same'}
			{#if showAll}<p class="same">{change.text}</p>{/if}
		{:else if change.kind === 'added'}
			<p class="added"><span class="visually-hidden">Added: </span><ins>{change.text}</ins></p>
		{:else if change.kind === 'removed'}
			<p class="removed"><span class="visually-hidden">Removed: </span><del>{change.text}</del></p>
		{:else}
			<p class="changed">
				{#each change.pieces as piece, pieceIndex (pieceIndex)}{#if piece.kind === 'same'}{piece.text}{:else if piece.kind === 'added'}<ins>{piece.text}</ins>{:else}<del>{piece.text}</del>{/if}{/each}
			</p>
		{/if}
	{/each}
</div>

<style>
	.comparison p {
		white-space: pre-wrap;
		padding: var(--space-2) var(--space-3);
		border-left: 4px solid var(--color-line);
	}

	.comparison .same {
		color: var(--color-ink-muted);
	}

	.comparison .added,
	.comparison .changed {
		border-left-color: var(--color-link);
	}

	.comparison .removed {
		border-left-color: var(--color-danger);
	}

	ins {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		background: var(--color-surface);
	}

	del {
		color: var(--color-danger);
	}
</style>
