<!--
	Comments on the draft (src/lib/essays/comments.ts): a new comment on the
	words selected, with quick asks, and every thread in the order its words
	come in the essay, with replies and Done. Choosing a thread's words selects
	them in the editor.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { commentAskLabels, commentAsks, commentThreads, type CommentAsk, type EssayComment } from '#lib/essays/comments.ts';
	import type { TextQuote } from '#lib/essays/comment-anchors.ts';
	import { essayDate } from '#lib/essays/dates.ts';

	let {
		essay,
		version,
		comments,
		you,
		mayResolveAny,
		positions,
		pending = $bindable(),
		current = $bindable(),
		onchange,
		ongo
	}: {
		essay: string;
		version: number;
		comments: EssayComment[];
		you: string | null;
		mayResolveAny: boolean;
		/** Where each thread's words are in the text now, or null when they changed. */
		positions: Map<string, number | null>;
		pending: TextQuote | null;
		current: string | null;
		onchange: (comments: EssayComment[]) => void;
		ongo: (thread: string) => void;
	} = $props();

	let showing = $state<'open' | 'done'>('open');
	let body = $state('');
	let asks = $state<CommentAsk[]>([]);
	let replies = $state<Record<string, string>>({});
	let replying = $state<string | null>(null);
	let problem = $state('');
	let sending = $state(false);
	let newBox: HTMLTextAreaElement | undefined = $state();

	const threads = $derived(commentThreads(comments));
	const open = $derived(threads.filter((thread) => !thread.first.resolvedAt));
	const done = $derived(threads.filter((thread) => thread.first.resolvedAt));
	/** In the order their words come in the essay; threads whose words changed come last. */
	const listed = $derived(
		[...(showing === 'open' ? open : done)].sort(
			(first, second) =>
				(positions.get(first.first.identifier) ?? Infinity) - (positions.get(second.first.identifier) ?? Infinity) ||
				first.first.createdAt.localeCompare(second.first.createdAt)
		)
	);

	$effect(() => {
		if (pending) {
			body = '';
			asks = [];
			problem = '';
			void tick().then(() => newBox?.focus());
		}
	});

	$effect(() => {
		if (!current) return;
		const thread = threads.find((candidate) => candidate.first.identifier === current);
		if (thread) showing = thread.first.resolvedAt ? 'done' : 'open';
		void tick().then(() => document.getElementById(`comment-thread-${current}`)?.scrollIntoView({ block: 'nearest' }));
	});

	async function send(payload: Record<string, unknown>, method = 'POST', query = ''): Promise<boolean> {
		sending = true;
		problem = '';
		const response = await fetch(`/workspace/essays/${essay}/comments${query}`, {
			method,
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		}).catch(() => null);
		const answer = (await response?.json().catch(() => null)) as { comments?: EssayComment[]; message?: string } | null;
		sending = false;
		if (!response?.ok || !answer?.comments) {
			problem = answer?.message || 'That did not go through. Try again.';
			return false;
		}
		onchange(answer.comments);
		return true;
	}

	async function comment(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!pending || !body.trim()) return;
		if (await send({ body, asks, quote: pending, version })) {
			pending = null;
			body = '';
			asks = [];
			showing = 'open';
		}
	}

	async function reply(event: SubmitEvent, thread: string): Promise<void> {
		event.preventDefault();
		const text = replies[thread] ?? '';
		if (!text.trim()) return;
		if (await send({ body: text, thread })) {
			replies = { ...replies, [thread]: '' };
			replying = null;
		}
	}

	function toggleAsk(ask: CommentAsk): void {
		asks = asks.includes(ask) ? asks.filter((chosen) => chosen !== ask) : [...asks, ask];
	}

	function short(text: string): string {
		return text.length > 140 ? `${text.slice(0, 137)}…` : text;
	}
</script>

<section class="comments panel" aria-labelledby="comments-heading">
	<h2 id="comments-heading" class="small">Comments</h2>
	{#if pending}
		<form class="new-comment" onsubmit={comment}>
			<p class="quote small">On “{short(pending.quote)}”</p>
			<div class="asks" role="group" aria-label="Quick asks">
				{#each commentAsks as ask (ask)}
					<button type="button" class="ask" aria-pressed={asks.includes(ask)} onclick={() => toggleAsk(ask)}>{commentAskLabels[ask]}</button>
				{/each}
			</div>
			<label class="visually-hidden" for="new-comment-text">Your comment</label>
			<textarea id="new-comment-text" rows="3" bind:this={newBox} bind:value={body} maxlength="5000" placeholder="What should change, or what is unclear?"></textarea>
			<p class="row">
				<button class="button" type="submit" disabled={sending || !body.trim()}>{sending ? 'Sending…' : 'Send'}</button>
				<button class="button button-quiet" type="button" onclick={() => (pending = null)}>Cancel</button>
			</p>
		</form>
	{:else}
		<p class="small muted">Select words in the essay and choose Comment (Ctrl+Alt+M) to comment on them.</p>
	{/if}
	{#if problem}<p class="field-error" role="alert">{problem}</p>{/if}

	<div class="tabs" role="group" aria-label="Which comments">
		<button type="button" class="tool" aria-pressed={showing === 'open'} onclick={() => (showing = 'open')}>Open ({open.length})</button>
		<button type="button" class="tool" aria-pressed={showing === 'done'} onclick={() => (showing = 'done')}>Done ({done.length})</button>
	</div>

	{#if listed.length === 0}
		<p class="small muted">{showing === 'open' ? 'No open comments.' : 'No comments marked done yet.'}</p>
	{/if}
	<ol class="threads">
		{#each listed as thread (thread.first.identifier)}
			{@const id = thread.first.identifier}
			{@const changed = positions.get(id) === null}
			<li id="comment-thread-{id}" class="thread" class:is-current={current === id}>
				{#if changed}
					<p class="quote small changed">On “{short(thread.first.quote ?? '')}”. <span class="muted">These words have since changed.</span></p>
				{:else}
					<button type="button" class="quote small" onclick={() => ongo(id)}>On “{short(thread.first.quote ?? '')}”</button>
				{/if}
				{#if thread.first.asks.length}
					<p class="tags">{#each thread.first.asks as ask (ask)}<span class="tag">{commentAskLabels[ask]}</span>{/each}</p>
				{/if}
				{#each [thread.first, ...thread.replies] as entry (entry.identifier)}
					<div class="entry">
						<p class="small"><strong>{entry.personName}</strong> <span class="muted">{essayDate(entry.createdAt)}</span></p>
						<p class="body">{entry.body}</p>
					</div>
				{/each}
				{#if thread.first.resolvedAt}
					<p class="small muted">Marked done{thread.first.resolvedByName ? ` by ${thread.first.resolvedByName}` : ''}, {essayDate(thread.first.resolvedAt)}.</p>
				{/if}
				{#if replying === id}
					<form onsubmit={(event) => reply(event, id)}>
						<label class="visually-hidden" for="reply-{id}">Your reply</label>
						<textarea id="reply-{id}" rows="2" maxlength="5000" bind:value={replies[id]}></textarea>
						<p class="row">
							<button class="button" type="submit" disabled={sending || !(replies[id] ?? '').trim()}>Reply</button>
							<button class="button button-quiet" type="button" onclick={() => (replying = null)}>Cancel</button>
						</p>
					</form>
				{:else}
					<p class="row">
						<button class="button button-quiet" type="button" onclick={() => (replying = id)}>Reply</button>
						{#if mayResolveAny || thread.first.personIdentifier === you}
							<button
								class="button button-quiet"
								type="button"
								disabled={sending}
								onclick={() => send({ resolved: !thread.first.resolvedAt }, 'PATCH', `?thread=${encodeURIComponent(id)}`)}
								>{thread.first.resolvedAt ? 'Reopen' : 'Done'}</button
							>
						{/if}
					</p>
				{/if}
			</li>
		{/each}
	</ol>
</section>

<style>
	.panel {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		padding: var(--space-3);
		background: var(--color-paper);
		max-height: 70vh;
		overflow-y: auto;
	}

	h2 {
		margin: 0 0 var(--space-2);
	}

	.new-comment {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3);
		margin-bottom: var(--space-3);
		border: 2px solid var(--color-action);
		border-radius: var(--radius-panel);
	}

	.quote {
		margin: 0;
		padding: 0 0 0 var(--space-2);
		border: 0;
		border-left: 3px solid var(--color-action);
		background: none;
		color: var(--color-ink);
		font-style: italic;
		text-align: left;
		cursor: pointer;
	}

	.quote.changed {
		cursor: default;
		border-left-color: var(--color-line);
	}

	.asks,
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0;
	}

	.ask,
	.tag {
		border: 1px solid var(--color-line);
		border-radius: 999px;
		padding: 0.1rem var(--space-2);
		background: var(--color-paper);
		color: var(--color-ink);
		font-size: var(--font-size-small);
	}

	.ask {
		cursor: pointer;
	}

	.ask[aria-pressed='true'] {
		border-color: var(--color-link);
		background: var(--color-surface);
		color: var(--color-link);
		font-weight: var(--font-weight-semibold);
	}

	textarea {
		width: 100%;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
	}

	.tabs {
		display: flex;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.threads {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-3);
	}

	.thread {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
	}

	.thread.is-current {
		border-color: var(--color-link);
		box-shadow: 0 0 0 1px var(--color-link);
	}

	.entry p {
		margin: 0;
	}

	.body {
		white-space: pre-wrap;
	}
</style>
