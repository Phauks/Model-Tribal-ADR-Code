<!--
	@component
	A chapter's contents in the Code's order, under its subchapters and parts
	(design/title-25-navigation, option A, chapter page): each section in force
	links to its page; one no longer in force keeps its number, a label saying
	what became of it, and the Code's own words for it.
-->
<script lang="ts">
	import type { ContentsGroup } from '#lib/code-outline.ts';
	import StatusTag from './StatusTag.svelte';

	let { groups }: { groups: ContentsGroup[] } = $props();
</script>

<ul class="code-contents">
	{#each groups as group, index (index)}
		{#if group.label}
			<li class="group-head" class:part={group.part} id={group.anchor}>
				<span>{group.label}. {group.heading}</span>
				<small>{group.inForce.toLocaleString('en-US')} in force</small>
			</li>
		{/if}
		{#each group.rows as row, rowIndex (rowIndex)}
			<li class="row" class:gone={row.status !== 'in force'} class:in-part={group.part}>
				{#if row.link}<a href={row.link}>{row.label}</a>{:else}<span>{row.label}</span>{/if}
				<span class="heading">
					{#if row.status === 'in force'}
						{row.heading}
					{:else}
						<StatusTag status={row.status} movedTo={row.movedTo} />
						{#if row.note}{' '}{row.note}{/if}
					{/if}
				</span>
			</li>
		{/each}
	{/each}
</ul>

<style>
	.code-contents {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.group-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 0.5rem;
		margin: 1.25rem 0 0.35rem;
		font-weight: 700;
		font-size: 1.05rem;
		scroll-margin-top: 4.5rem;
	}

	.group-head.part {
		margin-left: 1.25rem;
		font-size: 1rem;
	}

	.group-head small {
		color: var(--color-ink-muted);
		font-weight: 400;
		font-size: 0.85rem;
	}

	.group-head:target {
		background: var(--color-surface);
	}

	.row {
		display: grid;
		grid-template-columns: 7.5rem minmax(0, 1fr);
		gap: 0.75rem;
		padding: 0.4rem 0.25rem;
		border-bottom: 1px solid var(--color-line);
	}

	.row.in-part {
		margin-left: 1.25rem;
	}

	.row a {
		color: var(--color-link);
	}

	.row.gone {
		color: var(--color-ink-muted);
	}

	.row.gone .heading {
		font-size: 0.9rem;
	}

	@media (max-width: 44rem) {
		.row {
			grid-template-columns: 5.6rem minmax(0, 1fr);
		}
	}
</style>
