<script lang="ts">
	// The list of published essays in one part of the work (Foundations or Essays).
	// For someone signed in with access, the page also shows, from the
	// workspace, the drafts not published yet that they can open, a badge on
	// each essay with a draft newer than the published version or sections in
	// review, and, for someone who may start essays, a "New essay" button
	// beside the heading. These replace Workspace › Essays, which was removed
	// (lead author, Nov. 23, 2026). Readers see only the published essays.
	import { onDestroy, onMount } from 'svelte';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Pencil from '@lucide/svelte/icons/pencil';
	import NewEssayButton from '#lib/components/essays/NewEssayButton.svelte';
	import { newEssayPlace, partSections } from '#lib/essays/new-essay.svelte.ts';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';

	let {
		section,
		lead,
		part,
		essays
	}: {
		section: string;
		lead: string;
		/** The part's key, for its drafts: foundations, essays or back-matter. */
		part?: string;
		essays: { identifier: string; title: string; link: string; publishedAtText: string }[];
	} = $props();

	let drafts = $state<{ identifier: string; title: string; link: string; canEdit: boolean }[]>([]);
	let standing = $state<Record<string, { draft: boolean; inReview: number }>>({});
	let canStart = $state(false);

	onMount(() => {
		if (!part || !readSignedInHint(document.cookie).signedIn) return;
		const ownPart = part;
		void fetch(`/workspace/essays/drafts.json?part=${ownPart}`, { headers: { Accept: 'application/json' }, redirect: 'manual' })
			.then((response) => (response.ok ? response.json() : null))
			.then((body: { drafts?: typeof drafts; standing?: typeof standing; canStart?: boolean } | null) => {
				drafts = body?.drafts ?? [];
				standing = body?.standing ?? {};
				canStart = body?.canStart ?? false;
				if (canStart && partSections[ownPart]) newEssayPlace.current = { sectionLink: partSections[ownPart], part: ownPart };
			})
			.catch(() => undefined);
	});

	onDestroy(() => {
		if (part && newEssayPlace.current?.part === part) newEssayPlace.current = null;
	});
</script>

<svelte:head>
	<title>{section} · Model Tribal ADR Code</title>
	<meta name="description" content={lead} />
</svelte:head>

<div class="reading">
	<div class="heading-row">
		<h1>{section}</h1>
		{#if canStart && part}<span class="no-print"><NewEssayButton {part} sectionLabel={section} size={22} /></span>{/if}
	</div>
	<p class="lead">{lead}</p>
	{#if drafts.length}
		<section class="drafts panel no-print" aria-labelledby="drafts-heading">
			<h2 id="drafts-heading">Drafts not published yet</h2>
			<p class="small muted">Only people working on them see these.</p>
			<ul class="essay-list">
				{#each drafts as draft (draft.identifier)}
					<li>
						<a href={draft.link}>{draft.title}</a>
						{@render badges(draft.identifier)}
						{#if draft.canEdit}<a class="small" href="{draft.link}?edit">Edit</a>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
	{#if essays.length === 0}
		<p>Nothing is published here yet.</p>
	{:else}
		<ul class="essay-list">
			{#each essays as essay (essay.identifier)}
				<li>
					<a href={essay.link}>{essay.title}</a>
					{@render badges(essay.identifier)}
					<span class="small muted">Published {essay.publishedAtText}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#snippet badges(identifier: string)}
	{@const here = standing[identifier]}
	{#if here?.draft || here?.inReview}
		<span class="badges no-print">
			{#if here.draft}<a class="badge badge-draft" href="{essays.find((essay) => essay.identifier === identifier)?.link ?? ''}?edit" title="A saved draft is newer than the published version"><Pencil size={13} aria-hidden="true" /> Draft</a>{/if}
			{#if here.inReview}<span class="badge badge-review"><Inbox size={13} aria-hidden="true" /> In review</span>{/if}
		</span>
	{/if}
{/snippet}

<style>
	.heading-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.badges {
		display: inline-flex;
		gap: var(--space-1);
		margin-left: var(--space-2);
		vertical-align: middle;
	}

	/* The colors of the essay's own status labels (EssayStatusPills.svelte). */
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: 999px;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
	}

	.badge-draft {
		border-color: var(--color-status-draft-rule);
		background: var(--color-status-draft-background);
		color: var(--color-status-draft);
	}

	.badge-review {
		border-color: var(--color-status-review-rule);
		background: var(--color-status-review-background);
		color: var(--color-status-review);
	}
</style>
