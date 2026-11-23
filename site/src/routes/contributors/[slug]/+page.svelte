<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hasWork = $derived(data.essays.length > 0 || data.reviewedGroups.length > 0);
</script>

<svelte:head>
	<title>{data.name} · Contributors · Model Tribal ADR Code</title>
	<meta name="description" content="{data.name}: credit and published work on the Model Tribal ADR Code." />
</svelte:head>

<div class="reading">
	<Breadcrumbs trail={[{ label: 'People', href: '/people' }]} />
	<header class="person">
		{#if data.picture}
			<img class="picture" src={data.picture} alt="" width="160" height="160" />
		{/if}
		<div>
			<h1>{data.name}</h1>
			{#if data.nations.length > 0}
				<p class="nations">
					{#each data.nations as nation, position (position)}
						{#if position > 0}; {/if}
						{#if nation.path}<a href={nation.path}>{nation.name}</a>{:else}{nation.name}{/if}
					{/each}
				</p>
			{/if}
			{#if data.board}<p class="board">{data.board}</p>{/if}
			{#if data.specialties.length > 0}
				<ul class="specialties" aria-label="Specialties">
					{#each data.specialties as specialty (specialty)}<li>{specialty}</li>{/each}
				</ul>
			{/if}
			<p class="small muted">
				Credited under {data.sectionHeading}{#if data.since}, since {data.since}{/if}.
			</p>
		</div>
	</header>

	{#if data.biography}
		<p class="biography">{data.biography}</p>
	{/if}

	<h2>Work on this site</h2>
	{#if hasWork}
		{#if data.essays.length > 0}
			<section aria-labelledby="helped-write">
				<h3 id="helped-write">Helped write</h3>
				<ul>
					{#each data.essays as essay (essay.path)}<li><a href={essay.path}>{essay.title}</a></li>{/each}
				</ul>
			</section>
		{/if}
		{#each data.reviewedGroups as group (group.heading)}
			<section aria-label="Reviewed: {group.heading}">
				<h3>Reviewed: {group.heading}</h3>
				<ul>
					{#each group.items as item (item.path)}<li><a href={item.path}>{item.title}</a></li>{/each}
				</ul>
			</section>
		{/each}
	{:else}
		<p>Work {data.name} helps with is listed here once it is published.</p>
	{/if}
</div>

<style>
	.person {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4);
		margin-bottom: var(--space-4);
	}

	.person h1 {
		margin: 0;
	}

	.nations {
		margin: var(--space-1) 0 0;
	}

	.board {
		margin: var(--space-1) 0 0;
		font-weight: var(--font-weight-semibold);
	}

	.specialties {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		list-style: none;
		margin: var(--space-2) 0 0;
		padding: 0;
	}

	.specialties li {
		padding: 0 var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: 999px;
		font-size: var(--font-size-small);
	}

	.picture {
		width: 10rem;
		height: 10rem;
		border-radius: 50%;
		object-fit: cover;
		background: var(--color-surface);
	}

	.biography {
		white-space: pre-line;
	}
</style>
