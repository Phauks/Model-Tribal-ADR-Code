<script lang="ts">
	import { keyboardScroll } from '#lib/keyboard-scroll.ts';
	import { decisionLabels, subjectKindLabels, subjectKinds } from '#lib/permissions.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const searching = $derived(data.query !== '' || data.kind !== undefined);

	function date(value: string): string {
		return new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' });
	}
</script>

<svelte:head>
	<title>Reviews · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Reviews</h1>
<p>
	Find a record to sign off on, ask for changes, or comment. Each review records the content version it
	applies to, so a later change to the text shows which approvals came before it.
</p>

<form method="get" class="search">
	<div class="field">
		<label for="search">Name or identifier</label>
		<input type="search" id="search" name="search" value={data.query} />
	</div>
	<div class="field">
		<label for="kind">Kind</label>
		<select id="kind" name="kind">
			<option value="">Any</option>
			{#each subjectKinds as kind (kind)}
				{#if data.counts[kind] > 0}
					<option value={kind} selected={data.kind === kind}>{subjectKindLabels[kind]} ({data.counts[kind]})</option>
				{/if}
			{/each}
		</select>
	</div>
	<button class="button" type="submit">Search</button>
</form>

{#if searching}
	<p>
		{data.matchCount.toLocaleString('en-US')} found{data.matchCount > data.shown ? `; the first ${data.shown} are shown` : ''}.
	</p>
{:else}
	<h2>Reviewed most recently</h2>
{/if}

{#if data.subjects.length === 0}
	<p>{searching ? 'Nothing matches.' : 'No reviews recorded yet. Search above to find a record.'}</p>
{:else}
	<div class="table-scroll" role="region" aria-label="Table: content to review" {@attach keyboardScroll}>
		<table>
			<thead>
				<tr><th scope="col">Name</th><th scope="col">Kind</th><th scope="col">Latest review</th></tr>
			</thead>
			<tbody>
				{#each data.subjects as subject (`${subject.kind}/${subject.identifier}`)}
					<tr>
						<td><a href="/workspace/reviews/{subject.kind}/{subject.identifier}">{subject.title}</a></td>
						<td>{subjectKindLabels[subject.kind]}</td>
						<td>
							{#if subject.latest}
								{decisionLabels[subject.latest.decision]}, {subject.latest.personName}, {date(subject.latest.createdAt)}
							{:else}
								<span class="muted">None</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.search {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0 var(--space-4);
		margin-bottom: var(--space-4);
	}

	.search .field {
		flex: 1 1 14rem;
	}

	.search .button {
		margin-bottom: var(--space-4);
	}
</style>
