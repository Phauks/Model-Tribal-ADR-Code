<script lang="ts">
	import { essayDate } from '#lib/essays/dates.ts';
	import { askSentence, commentAskLabels } from '#lib/essays/comments.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function short(text: string): string {
		return text.length > 160 ? `${text.slice(0, 157)}…` : text;
	}
</script>

<svelte:head>
	<title>Comments for you · Workspace · Tribal Law Project</title>
</svelte:head>

<h1>Comments for you</h1>
<p class="lead">Comments that mention you, and comments of yours someone has answered. Each opens the page at the comment.</p>

{#if data.threads.length === 0}
	<p class="muted">Nothing is waiting on you.</p>
{:else}
	<ul class="threads">
		{#each data.threads as thread (thread.thread)}
			<li class="panel">
				<p><a href={thread.link}><em>“{short(thread.quote)}”</em></a> in {thread.essayTitle}</p>
				{#if thread.asks.length}
					<p class="tags">{#each thread.asks as ask (ask)}<span class="tag">{commentAskLabels[ask]}</span>{/each}</p>
				{/if}
				<p class="small">
					<strong>{thread.lastName}</strong>, {essayDate(thread.lastAt)}{thread.reason === 'mentioned' ? ', mentioning you' : thread.reason === 'assigned' ? ', assigned to you' : ''}:
				</p>
				{#if thread.lastBody !== askSentence(thread.asks)}<p class="body">{short(thread.lastBody)}</p>{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.threads {
		list-style: none;
		padding: 0;
		display: grid;
		gap: var(--space-3);
	}

	.threads p {
		margin: 0 0 var(--space-1);
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}

	.tag {
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		padding: 0 var(--space-2);
		font-size: var(--font-size-small);
	}

	.body {
		white-space: pre-wrap;
	}
</style>
