<script lang="ts">
	// What nations published on their own pages, for the project to read
	// afterwards: three tabs (To read, Read, Paused) and a card for each change
	// with its actions in one row (design/nation-editors, screen 5, approved by
	// Trevor on Nov. 23, 2026). Undo, pause and suspend open their short form
	// under the row; without scripts every form shows.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Check from '@lucide/svelte/icons/check';
	import Clock from '@lucide/svelte/icons/clock';
	import Pause from '@lucide/svelte/icons/pause';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import NationChangeContent from '#lib/components/NationChangeContent.svelte';
	import { changeKindLabels } from '#lib/nation-page-changes.ts';
	import { reviewDays, reviewOutcomeLabels } from '#lib/nation-page-review.ts';
	import { teamLevelLabels } from '#lib/nation-teams.ts';
	import { restrictionLevelLabels } from '#lib/nation-restrictions.ts';
	import { mediumDateAndTime, readableDate } from '#lib/readable-date.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Change = PageProps['data']['queue'][number];
	type Opened = 'undo' | 'pause' | 'suspend' | 'ask';
	type Restriction = PageProps['data']['restrictions'][number];

	const tabs = [
		{ value: 'to-read', label: 'To read' },
		{ value: 'read', label: 'Read' },
		{ value: 'paused', label: 'Paused' }
	] as const;
	const tab = $derived(tabs.find((choice) => choice.value === page.url.searchParams.get('tab'))?.value ?? 'to-read');
	const counts = $derived({ 'to-read': data.queue.length + data.restrictions.length, read: null, paused: data.pauses.length } as Record<string, number | null>);

	let scripted = $state(false);
	let opened = $state<Record<string, Opened | undefined>>({});

	onMount(() => {
		scripted = true;
	});

	function toggle(identifier: string, what: Opened): void {
		opened[identifier] = opened[identifier] === what ? undefined : what;
	}

	function shows(identifier: string, what: Opened): boolean {
		return !scripted || opened[identifier] === what;
	}

	function day(value: string | null): string {
		return value ? readableDate(value.slice(0, 10)) : '';
	}

	/** "B. Example (Editor) · Nov. 23, 2026, 3:52 PM · live", as the card's top line says it. */
	function byline(change: Change): string {
		const who = change.publishedByName
			? `${change.publishedByName}${change.publishedByLevel ? ` (${teamLevelLabels[change.publishedByLevel]})` : ''}`
			: 'The team';
		const parts = [who, `${day(change.publishedAt)}, ${new Date(change.publishedAt).toLocaleTimeString('en-US', { timeStyle: 'short' })}`];
		if (!change.waiting) parts.push('live');
		return parts.join(' · ');
	}

	/** "A. Sample (Steward) · Nov. 24, 2026, 12:20 AM · live", for a nation's choice about its laws and cases, which is always live. */
	function restrictionByline(save: Restriction): string {
		const who = save.madeByName ? `${save.madeByName}${save.madeByLevel ? ` (${teamLevelLabels[save.madeByLevel]})` : ''}` : 'The team';
		return [who, `${day(save.madeAt)}, ${new Date(save.madeAt).toLocaleTimeString('en-US', { timeStyle: 'short' })}`, 'live'].join(' · ');
	}

	/** Ends a summary with a full stop unless it already ends in punctuation. */
	function sentence(text: string): string {
		return /[.!?…]$/u.test(text) ? text : `${text}.`;
	}
</script>

<svelte:head>
	<title>Changes made by nations · Workspace · Tribal Law Project</title>
</svelte:head>

<h1>Changes made by nations</h1>
<p class="lede">
	These are already live. Read each within {reviewDays} days. Undo or pause only for a safety problem (someone who may not be who they say, private details about a person, broken or harmful links); the nation is told why.
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

<nav class="tabs" aria-label="Changes">
	{#each tabs as choice (choice.value)}
		<a href={choice.value === 'to-read' ? '?' : `?tab=${choice.value}`} aria-current={tab === choice.value ? 'page' : undefined}>
			{choice.label}{#if counts[choice.value] !== null}{' '}({counts[choice.value]}){/if}
		</a>
	{/each}
</nav>

{#if tab === 'to-read'}
	{#if data.queue.length === 0 && data.restrictions.length === 0}
		<p>Nothing is waiting. Every change nations published has been read.</p>
	{:else}
		<ol class="cards">
			{#each data.queue as change (change.identifier)}
				<li class="card">
					<article aria-labelledby="change-{change.identifier}">
						<div class="card-top">
							<h2 id="change-{change.identifier}">{change.nation.title} · {changeKindLabels[change.kind]}</h2>
							{#if change.waiting}<span class="flag flag-held"><Clock size={14} aria-hidden="true" />Live {day(change.liveAt).replace(/, \d{4}$/, '')}</span>{/if}
							{#if change.overdue}<span class="flag flag-held">Past {reviewDays} days</span>{/if}
							{#if change.paused}<span class="flag">Publishing paused</span>{/if}
							<span class="grow"></span>
							<span class="small muted">{byline(change)}</span>
						</div>
						<div class="content">
							<NationChangeContent kind={change.kind} content={change.content} before={change.before ?? undefined} pictureBase="/workspace/nation-pages/pictures/{change.nation.identifier}" />
						</div>
						<div class="actions">
							<form method="post" action="?/read">
								<input type="hidden" name="change" value={change.identifier} />
								<button class="button small-button" type="submit"><Check size={16} aria-hidden="true" />Mark read</button>
							</form>
							{#if scripted}
								<button class="button button-quiet small-button" class:warn={change.waiting} type="button" aria-expanded={opened[change.identifier] === 'undo'} onclick={() => toggle(change.identifier, 'undo')}>
									{#if change.waiting}<Pause size={16} aria-hidden="true" />Stop it going live{:else}<Undo2 size={16} aria-hidden="true" />Undo{/if}
								</button>
								{#if !change.paused && !change.waiting}
									<button class="button button-quiet small-button warn" type="button" aria-expanded={opened[change.identifier] === 'pause'} onclick={() => toggle(change.identifier, 'pause')}>
										<Pause size={16} aria-hidden="true" />Pause and ask the nation
									</button>
								{/if}
								{#if change.canSuspend}
									<button class="button button-quiet small-button warn" type="button" aria-expanded={opened[change.identifier] === 'suspend'} onclick={() => toggle(change.identifier, 'suspend')}>
										Suspend {change.publishedByName ?? 'this person'} and everyone they added
									</button>
								{/if}
							{/if}
							<span class="grow"></span>
							<span class="small muted">{#if change.overdue}Was due {day(change.due)}{:else}Read by {day(change.due)}{/if} · {#if change.nation.page}<a href={change.nation.page}>View the page</a>{/if}</span>
						</div>

						{#if shows(change.identifier, 'undo')}
							<form method="post" action="?/undo" class="more">
								<input type="hidden" name="change" value={change.identifier} />
								<label for="note-{change.identifier}">{change.waiting ? 'Why it should not go live' : 'Why it is undone'} <span class="muted">(the team sees this)</span></label>
								<input type="text" id="note-{change.identifier}" name="note" required />
								<div><button class="button button-quiet" type="submit">{change.waiting ? 'Stop it going live' : 'Undo the change'}</button></div>
							</form>
						{/if}
						{#if !change.paused && !change.waiting && shows(change.identifier, 'pause')}
							<form method="post" action="?/pause" class="more">
								<input type="hidden" name="nation" value={change.nation.identifier} />
								<label for="question-{change.identifier}">Your question for the team of {change.nation.title}</label>
								<textarea id="question-{change.identifier}" name="question" rows="3" required></textarea>
								<p class="small muted">Their drafts and hiding keep working; nothing else goes live until you resume.</p>
								<div><button class="button button-quiet" type="submit">Pause and ask</button></div>
							</form>
						{/if}
						{#if change.canSuspend && shows(change.identifier, 'suspend')}
							<form method="post" action="?/suspend" class="more">
								<input type="hidden" name="change" value={change.identifier} />
								<p class="small">Ends their place on the team, and the places of everyone they added. Their changes stay on the page until you undo them.</p>
								<div><button class="button button-quiet" type="submit">Suspend them and everyone they added</button></div>
							</form>
						{/if}
					</article>
				</li>
			{/each}
			{#each data.restrictions as save (save.identifier)}
				<li class="card">
					<article aria-labelledby="restriction-{save.identifier}">
						<div class="card-top">
							<h2 id="restriction-{save.identifier}">{save.nation.title} · Laws and cases</h2>
							{#if save.overdue}<span class="flag flag-held">Past {reviewDays} days</span>{/if}
							<span class="grow"></span>
							<span class="small muted">{restrictionByline(save)}</span>
						</div>
						<div class="content">
							<ul class="restriction-changes">
								{#each save.changes as change (change.target)}
									<li>
										{#if change.caseName}<i>{change.label}</i>{:else}{change.label}{/if}:
										{#if change.from === change.to}kept at <strong>{restrictionLevelLabels[change.to]}</strong>{:else}{restrictionLevelLabels[change.from]} → <strong>{restrictionLevelLabels[change.to]}</strong>{/if}{#if change.count}{' '}({change.count.toLocaleString('en-US')} {change.target === 'kind:opinions' ? (change.count === 1 ? 'opinion' : 'opinions') : change.count === 1 ? 'document' : 'documents'}){/if}
									</li>
								{/each}
							</ul>
							<p class="small"><span class="muted">Note from the team:</span> {save.note ?? 'none.'}</p>
							{#if save.question}
								<p class="small"><span class="muted">You asked:</span> {save.question}</p>
								{#if save.answer}<p class="small"><span class="muted">The team answered ({save.answeredByName ?? 'the team'}):</span> {save.answer}</p>{:else}<p class="small muted">No answer from the team yet.</p>{/if}
							{/if}
						</div>
						<div class="actions">
							<form method="post" action="?/readRestrictions">
								<input type="hidden" name="save" value={save.identifier} />
								<button class="button small-button" type="submit"><Check size={16} aria-hidden="true" />Mark read</button>
							</form>
							{#if scripted}
								<button class="button button-quiet small-button" type="button" aria-expanded={opened[save.identifier] === 'ask'} onclick={() => toggle(save.identifier, 'ask')}>Ask the team</button>
								{#if save.canSuspend}
									<button class="button button-quiet small-button warn" type="button" aria-expanded={opened[save.identifier] === 'suspend'} onclick={() => toggle(save.identifier, 'suspend')}>
										Suspend {save.madeByName ?? 'this person'} and everyone they added
									</button>
								{/if}
							{/if}
							<span class="grow"></span>
							<span class="small muted">{#if save.overdue}Was due {day(save.due)}{:else}Read by {day(save.due)}{/if} · {#if save.nation.page}<a href={save.nation.page}>View the page</a>{' · '}{/if}<a href="/workspace/nation-teams/{save.nation.identifier}/laws-and-cases">The team’s choices</a></span>
						</div>
						{#if shows(save.identifier, 'ask')}
							<form method="post" action="?/askRestrictions" class="more">
								<input type="hidden" name="save" value={save.identifier} />
								<label for="ask-{save.identifier}">Your question for the team of {save.nation.title} <span class="muted">(the team sees it)</span></label>
								<textarea id="ask-{save.identifier}" name="question" rows="3" required></textarea>
								<div><button class="button button-quiet" type="submit">Ask the team</button></div>
							</form>
						{/if}
						{#if save.canSuspend && shows(save.identifier, 'suspend')}
							<form method="post" action="?/suspendRestrictions" class="more">
								<input type="hidden" name="save" value={save.identifier} />
								<p class="small">Ends their place on the team, and the places of everyone they added. Their choices stay in force until the nation’s office says otherwise.</p>
								<div><button class="button button-quiet" type="submit">Suspend them and everyone they added</button></div>
							</form>
						{/if}
						<p class="small muted stands">A nation’s choice about its own laws and opinions stands. If the nation’s leadership is in dispute, freeze the page instead.</p>
					</article>
				</li>
			{/each}
		</ol>
	{/if}
{:else if tab === 'read'}
	{#if data.recent.length === 0}
		<p>Nothing read yet.</p>
	{:else}
		<ul class="cards">
			{#each data.recent as review (review.identifier)}
				<li class="card">
					<div class="card-top">
						<h2>{review.nation.title} · {changeKindLabels[review.kind]}</h2>
						<span class="grow"></span>
						<span class="small muted">{reviewOutcomeLabels[review.outcome]}, {review.reviewedByName ?? 'the project'}, {mediumDateAndTime(review.reviewedAt)}</span>
					</div>
					<p class="small">{sentence(review.summary)}{#if review.note} “{review.note}”{/if}</p>
				</li>
			{/each}
		</ul>
	{/if}
{:else}
	{#if data.pauses.length === 0}
		<p>No nation’s publishing is paused.</p>
	{:else}
		<ul class="cards">
			{#each data.pauses as pause (pause.identifier)}
				<li class="card">
					<div class="card-top">
						<h2>{pause.nation.title}</h2>
						<span class="grow"></span>
						<span class="small muted">Paused {mediumDateAndTime(pause.pausedAt)}{pause.pausedByName ? ` by ${pause.pausedByName}` : ''}</span>
					</div>
					<p class="small"><span class="muted">The project asked:</span></p>
					<blockquote class="quote">{pause.question}</blockquote>
					{#if pause.answer}
						<p class="small"><span class="muted">The team answered</span> ({pause.answeredByName ?? 'the team'}, {mediumDateAndTime(pause.answeredAt)}):</p>
						<blockquote class="quote">{pause.answer}</blockquote>
					{:else}
						<p class="small muted">No answer from the team yet.</p>
					{/if}
					<form method="post" action="?/resume">
						<input type="hidden" name="nation" value={pause.nation.identifier} />
						<button class="button button-quiet small-button" type="submit">Resume publishing</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

<p class="small muted">Every step is in the <a href="/workspace/activity">activity log</a>.</p>

<style>
	.restriction-changes {
		margin: 0;
		padding-left: var(--space-4);
	}

	.stands {
		margin-top: var(--space-2);
	}

	.lede {
		color: var(--color-ink-muted);
	}

	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: var(--space-4) 0 var(--space-4);
		border-bottom: 1px solid var(--color-line);
	}

	.tabs a {
		padding: var(--space-2) var(--space-3);
		border-bottom: 3px solid transparent;
		color: var(--color-ink-muted);
		text-decoration: none;
	}

	.tabs a:hover {
		color: var(--color-ink);
	}

	.tabs a[aria-current='page'] {
		border-bottom-color: var(--color-link);
		color: var(--color-link);
		font-weight: var(--font-weight-semibold);
	}

	.cards {
		display: grid;
		gap: var(--space-4);
		margin: 0 0 var(--space-5);
		padding: 0;
		list-style: none;
	}

	.card {
		padding: var(--space-4) var(--space-5);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
	}

	.card-top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-3);
	}

	.card-top h2 {
		margin: 0;
		font-size: var(--font-size-large);
	}

	.grow {
		flex: 1;
	}

	.flag {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0 var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: 999px;
		background: var(--color-surface);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
	}

	.flag-held {
		border-color: var(--color-action);
		background: var(--color-removed-background);
		color: var(--color-action);
	}

	.content {
		margin: var(--space-3) 0;
	}

	.content :global(p) {
		margin: 0 0 var(--space-1);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.actions form {
		margin: 0;
	}

	.small-button {
		display: inline-flex;
		gap: var(--space-2);
		align-items: center;
		min-height: auto;
		padding: var(--space-1) var(--space-3);
		font-size: var(--font-size-small);
	}

	.button-quiet.small-button {
		border-color: var(--color-link);
		color: var(--color-link);
	}

	.button-quiet.small-button.warn {
		border-color: var(--color-action);
		color: var(--color-action);
	}

	.more {
		display: grid;
		gap: var(--space-2);
		max-width: var(--layout-measure);
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}

	.quote {
		margin: var(--space-1) 0 var(--space-2);
		white-space: pre-wrap;
	}
</style>
