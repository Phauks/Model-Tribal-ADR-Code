<script lang="ts">
	// The page a story's method or topic badge opens: every story tagged with it
	// (src/lib/server/story-tag-pages.ts).
	import type { StorySummary, StoryTag } from '#lib/server/stories.ts';
	import CountBadge from './CountBadge.svelte';

	let {
		kind,
		tag,
		provisions
	}: {
		kind: 'methods' | 'topics';
		tag: StoryTag & { stories: StorySummary[] };
		provisions?: { count: number; link: string };
	} = $props();
	const what = $derived(kind === 'methods' ? 'Method' : 'Topic');
	const title = $derived(tag.name.charAt(0).toLocaleUpperCase('en-US') + tag.name.slice(1));
</script>

<svelte:head>
	<title>{title} · Stories · Model Tribal ADR Code</title>
	<meta name="description" content="Stories about disputes and peace tagged with the {what.toLocaleLowerCase('en-US')} “{tag.name}”." />
</svelte:head>

<nav aria-label="Breadcrumb" class="small">
	<a href="/stories">Stories</a> › {what}
</nav>

<div class="reading">
	<h1><span class="muted tag-kind">{what}:</span> {title}</h1>

	<h2>Stories<CountBadge count={tag.stories.length} /></h2>
	<ul class="story-list">
		{#each tag.stories as story (story.id)}
			<li>
				<a href="/stories/{story.id}">{story.title}</a>
				<span class="small muted">{story.kind} · {story.nations.map((nation) => nation.name).join(', ')}</span>
			</li>
		{/each}
	</ul>

	{#if provisions}
		<h2>Nations’ laws<CountBadge count={provisions.count} /></h2>
		<p><a href={provisions.link}>Provisions in nations’ laws that use {tag.name.toLocaleLowerCase('en-US')}</a>, in Find recourse.</p>
	{/if}
</div>

<style>
	.tag-kind {
		font-weight: normal;
	}

	.story-list {
		display: grid;
		gap: var(--space-2);
		padding: 0;
		list-style: none;
	}

	.story-list span {
		display: block;
	}
</style>
