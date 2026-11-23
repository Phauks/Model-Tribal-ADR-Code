<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import { repositoryLink } from '#lib';
	import { decisionLabels, subjectKindLabels } from '#lib/permissions.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const capacityLabels: Record<string, string> = {
		'lead-author': 'as lead author',
		editor: 'as editor',
		'co-author': 'as co-author',
		advisor: 'as advisor',
		contributor: 'as contributor',
		nation: 'for the nation'
	};

	function date(value: string): string {
		return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
	}
</script>

<svelte:head>
	<title>{data.subject.title} · Reviews · Workspace · Model Tribal ADR Code</title>
</svelte:head>

{#if data.allowed.capacity !== 'nation'}
	<Breadcrumbs
		trail={[
			{ label: 'Workspace', href: '/workspace' },
			{ label: 'Reviews', href: '/workspace/reviews' }
		]}
	/>
{/if}
<h1>{data.subject.title}</h1>
<p class="muted">{subjectKindLabels[data.subject.kind]} · <code>{data.subject.identifier}</code></p>

<ul>
	{#if data.subject.page}
		<li><a href={data.subject.page}>Read it on the site</a></li>
	{:else if data.subject.kind === 'nation'}
		<li>Not on the public site yet: it is held back until the nation approves it.</li>
	{:else}
		<li>Not on the public site yet.</li>
	{/if}
	<li><a href="{repositoryLink}/blob/main/{data.subject.file}">Read the record’s file, with its sources, on GitHub</a></li>
	<li><a href="{repositoryLink}/commits/main/{data.subject.file}">See every change to it on GitHub</a></li>
</ul>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

<form method="post" class="panel">
	<h2>Your review</h2>
	<p class="small">Recorded {capacityLabels[data.allowed.capacity]}, for {data.version}.</p>
	<fieldset>
		<legend>Decision</legend>
		{#each data.allowed.decisions as decision, index (decision)}
			<div class="choice">
				<input type="radio" id="decision-{decision}" name="decision" value={decision} checked={index === 0} />
				<label for="decision-{decision}">{decisionLabels[decision]}</label>
			</div>
		{/each}
	</fieldset>
	<div class="field">
		<label for="note">Note (required unless approving)</label>
		<textarea id="note" name="note" rows="4">{form && 'note' in form ? (form.note ?? '') : ''}</textarea>
	</div>
	<button class="button" type="submit">Record the review</button>
</form>

<h2>Earlier reviews</h2>
{#if data.reviews.length === 0}
	<p>None yet.</p>
{:else}
	<ol class="reviews">
		{#each data.reviews as review (review.identifier)}
			<li>
				<strong>{decisionLabels[review.decision]}</strong>
				by {review.personName} {capacityLabels[review.capacity]}, {date(review.createdAt)}
				<span class="small muted">({review.contentVersion})</span>
				{#if review.note}<div class="note">{review.note}</div>{/if}
			</li>
		{/each}
	</ol>
{/if}

<style>
	fieldset {
		border: 0;
		margin: 0 0 var(--space-4);
		padding: 0;
	}

	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		margin: var(--space-2) 0;
	}

	.choice input {
		width: 1.25rem;
		height: 1.25rem;
	}

	.reviews {
		padding-left: var(--space-5);
	}

	.reviews li {
		margin-bottom: var(--space-4);
	}

	.note {
		white-space: pre-wrap;
	}
</style>
