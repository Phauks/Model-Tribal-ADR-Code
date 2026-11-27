<script lang="ts">
	// The News list (design/news-section/1 and 2, approved by Trevor on Nov. 26,
	// 2026): published posts, newest first, each with the day it was first
	// published, its title and its one-line summary. A feed button gives the
	// Atom feed (src/routes/news/feed.xml). For someone with access, as on the
	// essay lists (EssayIndex.svelte), the page also shows the drafts not
	// published yet and, for someone who may start posts, a "New post" button
	// beside the heading. Readers see only the published posts.
	import { onDestroy, onMount } from 'svelte';
	import Rss from '@lucide/svelte/icons/rss';
	import NewEssayButton from '#lib/components/essays/NewEssayButton.svelte';
	import { newEssayPlace } from '#lib/essays/new-essay.svelte.ts';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';

	let { posts }: { posts: { identifier: string; title: string; link: string; summary: string; postedAt: string; postedText: string }[] } = $props();

	let drafts = $state<{ identifier: string; title: string; link: string; canEdit: boolean }[]>([]);
	let canStart = $state(false);

	onMount(() => {
		if (!readSignedInHint(document.cookie).signedIn) return;
		void fetch('/workspace/essays/drafts.json?part=news', { headers: { Accept: 'application/json' }, redirect: 'manual' })
			.then((response) => (response.ok ? response.json() : null))
			.then((body: { drafts?: typeof drafts; canStart?: boolean } | null) => {
				drafts = body?.drafts ?? [];
				canStart = body?.canStart ?? false;
				if (canStart) newEssayPlace.current = { sectionLink: '/news', part: 'news' };
			})
			.catch(() => undefined);
	});

	onDestroy(() => {
		if (newEssayPlace.current?.part === 'news') newEssayPlace.current = null;
	});
</script>

<svelte:head>
	<title>News · Tribal Law Project</title>
	<meta name="description" content="News from the Tribal Law Project." />
	<link rel="alternate" type="application/atom+xml" title="News · Tribal Law Project" href="/news/feed.xml" />
</svelte:head>

<div class="reading">
	<div class="heading-row">
		<h1>News</h1>
		{#if canStart}<span class="no-print"><NewEssayButton part="news" sectionLabel="News" noun="post" size={22} /></span>{/if}
		<a class="icon-button feed no-print" href="/news/feed.xml" title="Atom feed (.xml): follow News in a feed reader" aria-label="Atom feed (.xml)">
			<Rss size={22} aria-hidden="true" />
		</a>
	</div>
	{#if drafts.length}
		<section class="drafts panel no-print" aria-labelledby="drafts-heading">
			<h2 id="drafts-heading">Drafts not published yet</h2>
			<p class="small muted">Only people working on them see these.</p>
			<ul class="essay-list">
				{#each drafts as draft (draft.identifier)}
					<li>
						<a href={draft.link}>{draft.title}</a>
						{#if draft.canEdit}<a class="small" href="{draft.link}?edit">Edit</a>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
	{#if posts.length === 0}
		<p>None Identified</p>
	{:else}
		<ol class="news-list">
			{#each posts as post (post.identifier)}
				<li>
					<time datetime={post.postedAt}>{post.postedText}</time>
					<div>
						<h2><a href={post.link}>{post.title}</a></h2>
						{#if post.summary}<p>{post.summary}</p>{/if}
					</div>
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.heading-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.heading-row h1 {
		margin: 0;
	}

	/* The feed button sits at the far end of the heading's row. */
	.feed {
		margin-left: auto;
		color: var(--color-ink);
	}

	.drafts {
		margin-top: var(--space-4);
	}

	.news-list {
		margin: var(--space-5) 0 0;
		padding: 0;
		max-width: none;
		list-style: none;
	}

	.news-list li {
		display: grid;
		grid-template-columns: 8.5rem 1fr;
		gap: var(--space-1) var(--space-4);
		padding: var(--space-4) 0;
		border-top: 1px solid var(--color-line);
	}

	.news-list li:last-child {
		border-bottom: 1px solid var(--color-line);
	}

	.news-list time {
		padding-top: 0.3rem;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
		font-variant-numeric: tabular-nums;
	}

	.news-list h2 {
		margin: 0;
		font-size: 1.25rem;
		line-height: 1.3;
	}

	.news-list p {
		margin: var(--space-1) 0 0;
	}

	/* On a phone the day sits above the title. */
	@media (max-width: 40rem) {
		.news-list li {
			grid-template-columns: 1fr;
		}

		.news-list time {
			padding-top: 0;
		}
	}
</style>
