<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>People · Tribal Law Project</title>
	<meta name="description" content="The people who write, review and support the Tribal Law Project." />
</svelte:head>

{#snippet person(entry: { name: string; path: string; initials: string; picture: string | null; work: string; specialties: string[] }, large: boolean, office: string | null)}
	<a class="person" class:large href={entry.path}>
		{#if entry.picture}
			<img class="avatar" src={entry.picture} alt="" width={large ? 96 : 56} height={large ? 96 : 56} loading="lazy" />
		{:else}
			<span class="avatar initials" aria-hidden="true">{entry.initials}</span>
		{/if}
		<span class="text">
			<span class="name">{entry.name}</span>
			{#if office}<span class="detail">{office}</span>{/if}
			{#if entry.work}<span class="detail">{entry.work}</span>{/if}
			{#if large && entry.specialties.length > 0}<span class="detail muted">{entry.specialties.join(', ')}</span>{/if}
		</span>
	</a>
{/snippet}

<div class="people-page">
	<h1>People</h1>
	<p class="lead">
		The people who write, review and support this work. Everyone here chose to be credited on the website, and each
		name opens that person’s page.
	</p>

	{#if data.board.length > 0}
		<section aria-labelledby="board-heading">
			<h2 id="board-heading">Board of directors</h2>
			<p class="small muted">The board of the nonprofit that publishes this work.</p>
			<ul class="cards board">
				{#each data.board as member (member.path)}<li>{@render person(member, true, member.office)}</li>{/each}
			</ul>
		</section>
	{/if}

	<section aria-labelledby="everyone-heading">
		<div class="everyone-header">
			<h2 id="everyone-heading">Contributors and reviewers</h2>
			<nav class="group-by" aria-label="Group people by">
				<span>Group by</span>
				<a href="/people" aria-current={data.groupBy === 'contribution' ? 'page' : undefined}>Contribution</a>
				<a href="/people?group=specialty" aria-current={data.groupBy === 'specialty' ? 'page' : undefined}>Specialty</a>
			</nav>
		</div>
		{#each data.groups as group (group.heading)}
			<h3>{group.heading}</h3>
			{#if group.description}<p class="small muted">{group.description}</p>{/if}
			<ul class="cards">
				{#each group.people as entry (entry.path)}<li>{@render person(entry, false, null)}</li>{/each}
			</ul>
		{:else}
			<p>No one is listed yet.</p>
		{/each}
	</section>

	<p class="small closing">
		People credited by a description, or only in the book, are thanked on the <a href="/contributors">Contributors</a>
		list. Want to help? <a href="/join">Sign up</a>.
	</p>
</div>

<style>
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(var(--layout-card-min), 1fr));
		gap: var(--space-3);
		list-style: none;
		margin: 0 0 var(--space-5);
		padding: 0;
	}

	.cards.board {
		grid-template-columns: repeat(auto-fill, minmax(var(--layout-card-min), 1fr));
	}

	.person {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		height: 100%;
		box-sizing: border-box;
		padding: var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface);
		color: inherit;
		text-decoration: none;
	}

	.person.large {
		flex-direction: column;
		align-items: flex-start;
	}

	.person:hover .name {
		text-decoration: underline;
	}

	.avatar {
		flex: none;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 50%;
		object-fit: cover;
	}

	.large .avatar {
		width: 6rem;
		height: 6rem;
	}

	.initials {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-placeholder-background);
		font-weight: var(--font-weight-semibold);
	}

	.large .initials {
		font-size: var(--font-size-lead);
	}

	.text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.name {
		font-weight: var(--font-weight-semibold);
		color: var(--color-link);
	}

	.detail {
		font-size: var(--font-size-small);
	}

	.everyone-header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.group-by {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.group-by a {
		display: inline-flex;
		align-items: center;
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
	}

	.group-by a[aria-current='page'] {
		font-weight: var(--font-weight-semibold);
		border-color: currentColor;
	}

	.closing {
		margin-top: var(--space-5);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}
</style>
