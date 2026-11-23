<script lang="ts">
	import NationChangeContent from '#lib/components/NationChangeContent.svelte';
	import { changeKindLabels } from '#lib/nation-page-changes.ts';
	import { reviewDays, reviewOutcomeLabels } from '#lib/nation-page-review.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const overdue = $derived(data.queue.filter((change) => change.overdue).length);

	function when(value: string | null): string {
		return value ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
	}

	/** Who published the change and when, as one sentence. */
	function byline(change: PageProps['data']['queue'][number]): string {
		const parts = [`Published ${when(change.publishedAt)}${change.publishedByName ? ` by ${change.publishedByName}` : ''}`];
		if (change.writtenByName && change.writtenByName !== change.publishedByName) parts.push(`written by ${change.writtenByName}`);
		if (change.approvedByName) parts.push(`approved early by ${change.approvedByName}`);
		if (change.restored) parts.push('an earlier version put back');
		return `${parts.join(', ')}. Credited to ${change.credit}.`;
	}

	/** Ends a summary with a full stop unless it already ends in punctuation. */
	function sentence(text: string): string {
		return /[.!?…]$/u.test(text) ? text : `${text}.`;
	}

	function day(value: string): string {
		return new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' });
	}
</script>

<svelte:head>
	<title>Nations’ changes · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Nations’ changes</h1>
<p>
	What nations’ teams published on their own pages. Their changes go live without waiting for the project, so read
	each one within {reviewDays} days. Mark it read to leave it as it is. Undo it to put the page back to the version
	before, with a note the team sees. Pause the nation’s publishing to ask its team a question first. Every step is in
	the <a href="/workspace/activity">activity log</a>.
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

{#if data.pauses.length > 0}
	<section class="panel panel-filled" aria-labelledby="paused-heading">
		<h2 id="paused-heading">Publishing paused</h2>
		<ul class="review-list">
			{#each data.pauses as pause (pause.identifier)}
				<li>
					<p>
						<strong>{pause.nation.title}</strong>
						<span class="small muted">{`paused ${when(pause.pausedAt)}${pause.pausedByName ? ` by ${pause.pausedByName}` : ''}`}</span>
					</p>
					<p class="small"><span class="muted">The project asked:</span></p>
					<blockquote class="review-quote">{pause.question}</blockquote>
					{#if pause.answer}
						<p class="small"><span class="muted">The team answered</span> ({pause.answeredByName ?? 'the team'}, {when(pause.answeredAt)}):</p>
						<blockquote class="review-quote">{pause.answer}</blockquote>
					{:else}
						<p class="small muted">No answer from the team yet.</p>
					{/if}
					<form method="post" action="?/resume">
						<input type="hidden" name="nation" value={pause.nation.identifier} />
						<button class="button button-quiet" type="submit">Resume publishing</button>
					</form>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section aria-labelledby="queue-heading">
	<h2 id="queue-heading">To read</h2>
	{#if data.queue.length === 0}
		<p>Nothing is waiting. Every change nations published has been read.</p>
	{:else}
		<p class="small">
			{data.queue.length} {data.queue.length === 1 ? 'change' : 'changes'}, oldest first{#if overdue}; <strong>{overdue} past {reviewDays} days</strong>{/if}.
		</p>
		<ol class="review-list">
			{#each data.queue as change (change.identifier)}
				<li>
					<article aria-labelledby="change-{change.identifier}">
						<h3 id="change-{change.identifier}">
							{change.nation.title}: {changeKindLabels[change.kind]}
						</h3>
						<p class="small muted">{byline(change)}</p>
						<p class="small">
							{#if change.waiting}
								<span class="review-flag">Goes live {when(change.liveAt)}</span>
							{/if}
							{#if change.overdue}
								<span class="review-flag review-flag-late">Past {reviewDays} days</span>
							{:else}
								<span class="muted">Read by {day(change.due)}</span>
							{/if}
							{#if change.paused}<span class="review-flag">Publishing paused</span>{/if}
							{#if change.nation.page}· <a href={change.nation.page}>View the page</a>{/if}
						</p>
						<div class="review-content">
							<NationChangeContent kind={change.kind} content={change.content} pictureBase="/workspace/nation-pages/pictures/{change.nation.identifier}" />
						</div>
						<form method="post" class="review-actions">
							<input type="hidden" name="change" value={change.identifier} />
							<label for="note-{change.identifier}" class="small">Note <span class="muted">(needed to undo; the team sees it)</span></label>
							<input type="text" id="note-{change.identifier}" name="note" />
							<div class="button-row">
								<button class="button" type="submit" formaction="?/read">Mark read</button>
								<button class="button button-quiet" type="submit" formaction="?/undo">Undo</button>
							</div>
						</form>
						{#if !change.paused}
							<details class="review-more">
								<summary>Pause publishing and ask the team</summary>
								<form method="post" action="?/pause" class="review-actions">
									<input type="hidden" name="nation" value={change.nation.identifier} />
									<label for="question-{change.identifier}">Your question for the team of {change.nation.title}</label>
									<textarea id="question-{change.identifier}" name="question" rows="3" required></textarea>
									<p class="small muted">Their drafts and hiding keep working; nothing else goes live until you resume.</p>
									<div class="button-row"><button class="button button-quiet" type="submit">Pause and ask</button></div>
								</form>
							</details>
						{/if}
						{#if change.canSuspend}
							<details class="review-more">
								<summary>Suspend {change.publishedByName ?? 'this person'}</summary>
								<form method="post" action="?/suspend" class="review-actions">
									<input type="hidden" name="change" value={change.identifier} />
									<p class="small">
										Ends their place on the team, and the places of everyone they added. Their changes stay on the page until
										you undo them.
									</p>
									<div class="button-row"><button class="button button-quiet" type="submit">Suspend them and everyone they added</button></div>
								</form>
							</details>
						{/if}
					</article>
				</li>
			{/each}
		</ol>
	{/if}
</section>

{#if data.recent.length > 0}
	<section aria-labelledby="recent-heading">
		<h2 id="recent-heading">Read lately</h2>
		<ul class="recent-list">
			{#each data.recent as review (review.identifier)}
				<li>
					<strong>{review.nation.title}</strong>: {sentence(review.summary)}
					<span class="small muted">
						{reviewOutcomeLabels[review.outcome]}, {review.reviewedByName ?? 'the project'}, {when(review.reviewedAt)}{#if review.note}: “{review.note}”{/if}
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.review-list {
		display: grid;
		gap: var(--space-4);
		padding: 0;
		list-style: none;
	}

	.review-list > li {
		border-bottom: 1px solid var(--color-line);
		padding-bottom: var(--space-4);
	}

	.review-list > li:last-child {
		border-bottom: none;
	}

	.review-list h3 {
		margin-bottom: var(--space-1);
	}

	.review-content {
		border-left: 4px solid var(--color-line);
		margin: var(--space-2) 0;
		padding-left: var(--space-3);
	}

	.review-quote {
		margin: var(--space-1) 0 var(--space-2);
		border-left: 4px solid var(--color-line);
		padding-left: var(--space-3);
		white-space: pre-wrap;
	}

	.review-actions {
		display: grid;
		gap: var(--space-2);
		max-width: var(--layout-measure);
	}

	.review-more {
		margin-top: var(--space-2);
	}

	.review-more summary {
		cursor: pointer;
	}

	.review-flag {
		display: inline-block;
		margin-right: var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		padding: 0 var(--space-1);
	}

	.review-flag-late {
		border-color: currentColor;
		font-weight: 700;
	}

	.recent-list {
		display: grid;
		gap: var(--space-2);
	}
</style>
