<script lang="ts">
	// "Your work" under an essay's outline in the sidebar while the essay is
	// edited or commented on, as in essay-editor-mockups/4 and v2-1: the
	// review requests and comments waiting on the person, each with its count,
	// and the essays with drafts they saved that are not published yet. Your
	// drafts opens into the list of those essays, so it needs no page of its own.
	import FilePen from '@lucide/svelte/icons/file-pen';
	import Inbox from '@lucide/svelte/icons/inbox';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import type { YourWork } from '#lib/essays/editing-outline.svelte.ts';

	let { work, path }: { work: YourWork; path: string } = $props();
</script>

<section class="your-work" aria-labelledby="your-work-title">
	<h2 class="title" id="your-work-title">Your work</h2>
	<ul>
		<li>
			<a href="/workspace/review-requests">
				<Inbox size={18} aria-hidden="true" />
				<span class="label">Review requests</span>
				<CountBadge count={work.reviewRequests} />
			</a>
		</li>
		<li>
			<a href="/workspace/comments">
				<MessageSquare size={18} aria-hidden="true" />
				<span class="label">Comments for you</span>
				<CountBadge count={work.commentsForYou} />
			</a>
		</li>
		<li>
			<details>
				<summary>
					<FilePen size={18} aria-hidden="true" />
					<span class="label">Your drafts</span>
					<CountBadge count={work.drafts.length} />
				</summary>
				{#if work.drafts.length === 0}
					<p class="none">None.</p>
				{:else}
					<ul class="drafts">
						{#each work.drafts as draft (draft.link)}
							<li><a href="{draft.link}?edit" aria-current={draft.link === path ? 'page' : undefined}>{draft.title}</a></li>
						{/each}
					</ul>
				{/if}
			</details>
		</li>
	</ul>
</section>

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.your-work {
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}

	.title {
		margin: 0 0 var(--space-1);
		padding: 0 var(--space-3);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-ink-muted);
	}

	a,
	summary {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.5rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius-control);
		color: var(--color-ink);
		text-decoration: none;
		cursor: pointer;
	}

	summary {
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	a:hover,
	summary:hover {
		background: var(--color-surface);
	}

	a:hover .label,
	summary:hover .label {
		text-decoration: underline;
	}

	.label {
		flex: 1;
		min-width: 0;
	}

	.drafts a {
		min-height: 2.25rem;
		padding-left: calc(var(--space-3) + 18px + var(--space-2));
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	.drafts a[aria-current='page'] {
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}

	.none {
		margin: 0;
		padding: var(--space-1) var(--space-3) var(--space-2) calc(var(--space-3) + 18px + var(--space-2));
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	:global(.sidebar-narrow) a,
	:global(.sidebar-narrow) summary {
		min-height: var(--layout-target-minimum);
	}
</style>
