<script lang="ts">
	import ReportLink from '#lib/components/ReportLink.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Stories · Model Tribal ADR Code</title>
	<meta
		name="description"
		content="Stories, accounts and teachings about resolving disputes and making peace, quoted in the words of the Native nations and people who tell them."
	/>
</svelte:head>

<div class="reading">
	<h1>Stories</h1>
	<ReportLink record="stories" />
	<p class="lead">
		Stories, accounts and teachings about resolving disputes, making peace and restoring relationships, as Native nations and their people tell them. The project does not retell or summarize them. Each page quotes short passages in the teller’s own words and links to where the nation or teller published the story, so you can read it there in full.
	</p>

	{#if data.awaitingReview > 0}
		<div class="notice" role="note">
			<p>
				<strong>Not yet reviewed by the nations.</strong>
				{data.awaitingReview === data.count ? 'None' : `${data.awaitingReview} of the ${data.count}`} of these stories {data.awaitingReview === data.count ? 'has' : 'have'} been reviewed by the nation{data.awaitingReview === 1 ? '' : 's'} they come from yet. They are shown while the project asks each nation to review them. Each story page has a link to ask for it to be removed.
			</p>
		</div>
	{/if}

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
		Stories are recorded under the project’s decision records <a href="https://github.com/Phauks/Model-Tribal-ADR-Code/blob/main/docs/decisions/0019-story-records.md">0019</a> and <a href="https://github.com/Phauks/Model-Tribal-ADR-Code/blob/main/docs/decisions/0027-show-stories-while-nations-review-them.md">0027</a>. More are being gathered. A nation or teller can <a href="/requests?kind=contribute&record=stories">offer a story</a>, or ask for one to be corrected or removed.
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
