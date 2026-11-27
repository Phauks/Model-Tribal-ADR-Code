<!--
	@component
	A code's outline in the side column (Trevor chose on Nov. 27, 2026,
	design/title-25-navigation, option A): a box to find a section, then the
	chapter's subchapters and parts, which fold, and its sections, the one
	being read marked. Every name is shown whole, wrapping onto more lines
	("we should be able to fully read the name in the left sidebar"). Runs of
	sections no longer in force read as one quieter row. Nested rows step in
	as the side column's other nested lists do (PR 575).
-->
<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Search from '@lucide/svelte/icons/search';
	import type { CodeTree, CodeTreeItem } from '#lib/code-outline.ts';

	let { tree, idSuffix }: { tree: CodeTree; idSuffix: string } = $props();
	let list: HTMLUListElement | undefined = $state();

	// With every name shown whole, a long chapter can push the section being read below the column's fold: bring it into view in the column, not the page.
	$effect(() => {
		const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
		const column = list?.closest<HTMLElement>('.sidebar-wide');
		if (!current || !column || column.scrollHeight <= column.clientHeight) return;
		const offset = current.getBoundingClientRect().top - column.getBoundingClientRect().top;
		if (offset > column.clientHeight * 0.75) column.scrollTop += offset - column.clientHeight / 3;
	});
</script>

{#snippet row(item: CodeTreeItem)}
	{#if item.children}
		<details class="group" open={item.open}>
			<summary>
				<ChevronRight size={14} aria-hidden="true" class="caret" />
				<span class="name"><span class="number">{item.number}.</span> {item.label}</span>
				{#if item.count}<span class="count" title="Sections in force">{item.count}</span>{/if}
			</summary>
			<ul>
				{#each item.children as child, index (index)}<li>{@render row(child)}</li>{/each}
			</ul>
		</details>
	{:else}
		<a class="entry" class:gone={item.gone} href={item.link} aria-current={item.current ? 'page' : undefined}>
			<span class="number">{item.number}</span>
			<span class="name">{item.label}</span>
		</a>
	{/if}
{/snippet}

<form class="find" action={tree.find.link} method="get" role="search">
	<label class="visually-hidden" for="code-find-{idSuffix}">{tree.find.label}</label>
	<Search size={16} aria-hidden="true" />
	<input id="code-find-{idSuffix}" name="find" type="search" placeholder={tree.find.label} autocomplete="off" />
</form>
<ul class="code-outline" bind:this={list}>
	{#each tree.items as item, index (index)}<li>{@render row(item)}</li>{/each}
</ul>

<style>
	.find {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0.25rem 0 0.9rem;
		padding: 0 0.6rem;
		border: 1px solid var(--color-control-border);
		border-radius: 8px;
		background: var(--color-surface-raised);
		color: var(--color-ink-muted);
	}

	/* The box is the field: the input fills its height, 2.25rem, which is still a comfortable target. */
	.find input[type='search'] {
		flex: 1;
		min-width: 0;
		border: 0;
		padding: 0;
		min-height: 2.25rem;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		font-size: 0.95rem;
		line-height: 1.4;
	}

	.find input[type='search']:focus {
		outline: none;
	}

	.find:focus-within {
		outline: 3px solid var(--color-focus-ring);
	}

	.code-outline,
	.code-outline ul {
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: 0.9rem;
		line-height: 1.35;
	}

	/* Each level steps in 1.25rem, with a guide line from the parent's caret (PR 575). */
	.code-outline ul {
		margin-left: 0.55rem;
		padding-left: 0.7rem;
		border-left: 1px solid var(--color-line);
	}

	.entry,
	summary {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		padding: 0.3rem 0.5rem;
		border-radius: 6px;
		color: var(--color-ink);
		text-decoration: none;
	}

	summary {
		cursor: pointer;
		font-weight: 600;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary :global(.caret) {
		flex: none;
		align-self: center;
		color: var(--color-ink-muted);
		transition: transform var(--motion-duration-short);
	}

	details[open] > summary :global(.caret) {
		transform: rotate(90deg);
	}

	.entry:hover,
	summary:hover {
		background: var(--color-surface);
	}

	.number {
		flex: none;
		color: var(--color-ink-muted);
		font-variant-numeric: tabular-nums;
	}

	.entry .number {
		min-width: 3.4rem;
	}

	.name {
		flex: 1;
		min-width: 0;
		overflow-wrap: break-word;
	}

	summary .number {
		color: inherit;
	}

	.count {
		flex: none;
		border: 1px solid var(--color-line);
		border-radius: 999px;
		padding: 0 0.4rem;
		color: var(--color-ink-muted);
		font-size: 0.75rem;
		font-weight: 400;
	}

	.entry.gone .name {
		color: var(--color-ink-muted);
		font-style: italic;
	}

	.entry[aria-current='page'] {
		background: var(--color-surface);
		box-shadow: inset 3px 0 0 var(--color-action);
		font-weight: 600;
	}

	.entry[aria-current='page'] .number {
		color: var(--color-ink);
	}
</style>
