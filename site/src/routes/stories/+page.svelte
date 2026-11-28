<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Stories · Tribal Law Project</title>
	<meta
		name="description"
		content="Stories, accounts and teachings about law, justice and governance, quoted in the words of the Native nations and people who tell them."
	/>
</svelte:head>

<div class="reading">
	<h1>Stories</h1>
	<p class="lead">
		Stories, accounts and teachings about law, justice and governance, as Native nations and their people tell them. They are never retold or summarized here. Each page gives the whole story in the teller’s own words wherever it can be found, with credit and a link to where the nation or teller published it.
	</p>

	{#if data.count === 0}
		<p>No stories are published yet.</p>
	{:else}
		<p>{data.count} {data.count === 1 ? 'story' : 'stories'}, listed by nation. A story that belongs to several nations is listed under each of them.</p>

		<nav aria-label="Nations with stories" class="small">
			<ul class="nation-index">
				{#each data.groups as group (group.id)}
					<li><a href="#nation-{group.id}">{group.name}</a></li>
				{/each}
			</ul>
		</nav>

		{#each data.groups as group (group.id)}
			<section aria-labelledby="nation-{group.id}" class="nation-group">
				<h2 id="nation-{group.id}">
					{group.name}
				</h2>
				{#if group.link}
					<p class="small"><a href={group.link}>Nation page</a></p>
				{/if}
				<ul class="story-list">
					{#each group.stories as story (story.id)}
						<li>
							<h3><a href="/stories/{story.id}">{story.title}</a></h3>
							<p class="small muted">
								{story.kind}{#if story.community}{' · '}{story.community}{/if}{#if story.nations.length > 1}{' · '}Shared with {story.nations
										.filter((nation) => nation.id !== group.id)
										.map((nation) => nation.name)
										.join(', ')}{/if}
							</p>
							{#if story.excerpt?.text}
								<blockquote>
									<p>{story.excerpt.text}</p>
									<footer class="small">{story.excerpt.credit}</footer>
								</blockquote>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}

	<p class="small muted">
		More stories are being gathered. A nation or teller can <a href="#request=contribute&record=stories">offer a story</a>.
	</p>
</div>

<style>
	.nation-index {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		padding: 0;
		list-style: none;
	}

	.nation-group {
		margin-top: var(--space-6);
	}

	.nation-group h2 {
		margin-bottom: var(--space-1);
	}

	.story-list {
		padding: 0;
		list-style: none;
	}

	.story-list > li {
		margin: var(--space-4) 0;
	}

	.story-list h3 {
		margin: 0;
	}

	.story-list p {
		margin: var(--space-1) 0;
	}
</style>
