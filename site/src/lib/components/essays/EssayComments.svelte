<!--
	Comments on the draft in the right margin, as in the approved mockup
	(essay-editor-mockups/4-commenting.png; comments.ts). Each card sits beside
	the words it is about: the comment being written, with the words quoted,
	quick asks, an @ mention, Cancel and Send; and each open thread, with who
	wrote it, its asks as tags, the replies, Reply and Done. Cards push each
	other down rather than overlap. Threads whose words have since changed,
	and threads marked done, follow below. On a narrow window the cards stack
	in the order their words come.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { askSentence, commentAskLabels, commentAsks, commentThreads, type CommentAsk, type CommentDraft, type CommentThread, type EssayComment } from '#lib/essays/comments.ts';
	import { essayDate } from '#lib/essays/dates.ts';
	import PersonAvatar from '#lib/components/essays/PersonAvatar.svelte';
	import AtSign from '@lucide/svelte/icons/at-sign';
	import Check from '@lucide/svelte/icons/check';
	import CircleQuestionMark from '@lucide/svelte/icons/circle-question-mark';
	import CornerUpLeft from '@lucide/svelte/icons/corner-up-left';
	import LibraryBig from '@lucide/svelte/icons/library-big';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import Plus from '@lucide/svelte/icons/plus';
	import Quote from '@lucide/svelte/icons/quote';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Scale from '@lucide/svelte/icons/scale';
	import Scissors from '@lucide/svelte/icons/scissors';
	import SearchCheck from '@lucide/svelte/icons/search-check';

	let {
		essay,
		version,
		comments,
		you,
		mayResolveAny,
		positions,
		tops,
		aligned,
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
		/** How far down the text each thread's words are, in pixels, and `new` for the comment being written. */
		tops: Map<string, number>;
		/** Whether the cards sit beside their words (a wide window). */
		aligned: boolean;
		pending: CommentDraft | null;
		current: string | null;
		onchange: (comments: EssayComment[]) => void;
		ongo: (thread: string) => void;
	} = $props();

	const askIcons = {
		expand: Plus,
		rewrite: PenLine,
		sources: LibraryBig,
		citation: Quote,
		shorten: Scissors,
		check: SearchCheck,
		unclear: CircleQuestionMark,
		'case-box': Scale
	} satisfies Record<CommentAsk, unknown>;

	let body = $state('');
	let asks = $state<CommentAsk[]>([]);
	let mentioned = $state<{ identifier: string; name: string }[]>([]);
	let replies = $state<Record<string, string>>({});
	let replying = $state<string | null>(null);
	let problem = $state('');
	let sending = $state(false);
	let showDone = $state(false);
	let newBox: HTMLTextAreaElement | undefined = $state();

	/* @ mention: anyone who can open the essay (EssayShareDialog lists the same people). */
	let mentioning = $state(false);
	let people = $state<{ identifier: string; name: string }[] | null>(null);

	const threads = $derived(commentThreads(comments));
	const open = $derived(threads.filter((thread) => !thread.first.resolvedAt));
	const done = $derived(threads.filter((thread) => thread.first.resolvedAt));
	const placed = $derived(
		open
			.filter((thread) => positions.get(thread.first.identifier) != null)
			.sort(
				(first, second) =>
					(positions.get(first.first.identifier) ?? 0) - (positions.get(second.first.identifier) ?? 0) ||
					first.first.createdAt.localeCompare(second.first.createdAt)
			)
	);
	const moved = $derived(open.filter((thread) => positions.has(thread.first.identifier) && positions.get(thread.first.identifier) == null));
	/** The cards beside the text, the comment being written among them where its words are. */
	const cards = $derived.by(() => {
		const list: { key: string; thread: CommentThread | null }[] = placed.map((thread) => ({ key: thread.first.identifier, thread }));
		if (pending) {
			const at = tops.get('new') ?? 0;
			const index = list.findIndex((card) => (tops.get(card.key) ?? 0) > at);
			list.splice(index === -1 ? list.length : index, 0, { key: 'new', thread: null });
		}
		return list;
	});

	$effect(() => {
		if (pending) {
			body = pending.body;
			asks = [...pending.asks];
			mentioned = [];
			mentioning = false;
			problem = '';
			void tick().then(() => {
				newBox?.focus();
				if (pending?.suggest) newBox?.select();
			});
		}
	});

	$effect(() => {
		if (!current) return;
		const thread = threads.find((candidate) => candidate.first.identifier === current);
		if (thread?.first.resolvedAt) showDone = true;
		void tick().then(() => document.getElementById(`comment-thread-${current}`)?.scrollIntoView({ block: 'nearest' }));
	});

	/* Placing the cards ------------------------------------------------------ */

	let column: HTMLDivElement | undefined = $state();
	let at = $state<Record<string, number>>({});
	let columnHeight = $state(0);
	let resized = $state(0);
	const gap = 12;

	$effect(() => {
		if (!column) return;
		const observer = new ResizeObserver(() => (resized += 1));
		for (const card of column.querySelectorAll('[data-card]')) observer.observe(card);
		return () => observer.disconnect();
	});

	$effect(() => {
		void resized;
		const keys = cards.map((card) => card.key);
		const wanted = keys.map((key) => tops.get(key) ?? 0);
		const anchor = keys.indexOf(pending ? 'new' : (current ?? ''));
		if (!aligned || !column) return;
		void tick().then(() => {
			if (!column) return;
			const heights = keys.map((key) => (column!.querySelector(`[data-card="${key}"]`) as HTMLElement | null)?.offsetHeight ?? 0);
			const top = [...wanted];
			// The card being written or chosen sits level with its words; the others make room.
			if (anchor >= 0) {
				for (let index = anchor + 1; index < top.length; index += 1) top[index] = Math.max(wanted[index], top[index - 1] + heights[index - 1] + gap);
				for (let index = anchor - 1; index >= 0; index -= 1) top[index] = Math.min(wanted[index], top[index + 1] - heights[index] - gap);
			}
			for (let index = 0; index < top.length; index += 1) top[index] = Math.max(top[index], index === 0 ? 0 : top[index - 1] + heights[index - 1] + gap);
			at = Object.fromEntries(keys.map((key, index) => [key, top[index]]));
			columnHeight = top.length ? top[top.length - 1] + heights[heights.length - 1] + gap : 0;
		});
	});

	/* Sending ---------------------------------------------------------------- */

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
		const before = new Set(comments.map((comment) => comment.identifier));
		onchange(answer.comments);
		const added = answer.comments.find((comment) => !before.has(comment.identifier) && comment.threadIdentifier === null);
		if (added) current = added.identifier;
		else if (method === 'PATCH') current = null;
		return true;
	}

	async function comment(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!pending || (!body.trim() && asks.length === 0)) return;
		const text = pending.suggest && body.trim() ? `Suggested wording: “${body.trim()}”` : body;
		const mentions = mentioned.filter((person) => text.includes(`@${person.name}`)).map((person) => person.identifier);
		if (await send({ body: text, asks, quote: pending.quote, version, mentions })) {
			pending = null;
			body = '';
			asks = [];
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

	async function startMention(): Promise<void> {
		mentioning = !mentioning;
		if (!mentioning || people) return;
		const response = await fetch(`/workspace/essays/${essay}/sharing`).catch(() => null);
		const answer = (await response?.json().catch(() => null)) as { people?: { identifier: string; name: string }[] } | null;
		people = (answer?.people ?? []).filter((person) => person.identifier !== you);
	}

	function mention(person: { identifier: string; name: string }): void {
		const box = newBox;
		const start = box?.selectionStart ?? body.length;
		const end = box?.selectionEnd ?? body.length;
		const before = body.slice(0, start);
		const insert = `${before && !/\s$/.test(before) ? ' ' : ''}@${person.name} `;
		body = before + insert + body.slice(end);
		if (!mentioned.some((chosen) => chosen.identifier === person.identifier)) mentioned = [...mentioned, person];
		mentioning = false;
		void tick().then(() => {
			box?.focus();
			box?.setSelectionRange(start + insert.length, start + insert.length);
		});
	}

	function resolve(thread: CommentThread): void {
		if (current === thread.first.identifier) current = null;
		void send({ resolved: !thread.first.resolvedAt }, 'PATCH', `?thread=${encodeURIComponent(thread.first.identifier)}`);
	}

	function choose(event: MouseEvent, id: string): void {
		if ((event.target as Element).closest('button, a, textarea, input, label, form')) return;
		ongo(id);
	}

	function short(text: string): string {
		return text.length > 120 ? `${text.slice(0, 117)}…` : text;
	}

	/** The words of a comment, unless it is only a one-click ask, whose tag already says it. */
	function words(entry: EssayComment): string | null {
		return entry.threadIdentifier === null && entry.asks.length && entry.body === askSentence(entry.asks) ? null : entry.body;
	}
</script>

{#snippet askTag(ask: CommentAsk)}
	{@const Icon = askIcons[ask]}
	<span class="tag"><Icon size={14} aria-hidden="true" /> {commentAskLabels[ask]}</span>
{/snippet}

{#snippet newCard()}
	<form class="card new-card" data-card="new" style:top={aligned ? `${at.new ?? tops.get('new') ?? 0}px` : null} onsubmit={comment} aria-label="New comment">
		{#if pending}<p class="quote small">“{short(pending.quote.quote)}”</p>{/if}
		<div class="asks" role="group" aria-label="Quick asks">
			{#each commentAsks as ask (ask)}
				{@const Icon = askIcons[ask]}
				<button type="button" class="ask" aria-pressed={asks.includes(ask)} onclick={() => toggleAsk(ask)}><Icon size={14} aria-hidden="true" /> {commentAskLabels[ask]}</button>
			{/each}
		</div>
		<label class="visually-hidden" for="new-comment-text">{pending?.suggest ? 'Suggested wording' : 'Your comment'}</label>
		<textarea
			id="new-comment-text"
			rows="3"
			bind:this={newBox}
			bind:value={body}
			maxlength="5000"
			placeholder={asks.length ? 'Add a note (optional)' : 'What should change, or what is unclear?'}
			onkeydown={(event) => {
				if (event.key === 'Escape') pending = null;
				if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) (event.currentTarget.form as HTMLFormElement).requestSubmit();
			}}
		></textarea>
		{#if mentioning}
			<ul class="mention-list" aria-label="Mention someone">
				{#if people === null}<li class="small muted">Loading…</li>{:else if people.length === 0}<li class="small muted">No one else can open this essay yet.</li>{/if}
				{#each people ?? [] as person (person.identifier)}
					<li><button type="button" onclick={() => mention(person)}><PersonAvatar name={person.name} size="small" /> {person.name}</button></li>
				{/each}
			</ul>
		{/if}
		<p class="row">
			<button type="button" class="quiet mention" aria-expanded={mentioning} onclick={startMention}><AtSign size={16} aria-hidden="true" /> mention</button>
			<span class="push"></span>
			<button class="quiet" type="button" onclick={() => (pending = null)}>Cancel</button>
			<button class="button send" type="submit" disabled={sending || (!body.trim() && asks.length === 0)}>{sending ? 'Sending…' : 'Send'}</button>
		</p>
		{#if problem}<p class="field-error small" role="alert">{problem}</p>{/if}
	</form>
{/snippet}

{#snippet threadCard(thread: CommentThread, placement: 'beside' | 'moved' | 'done')}
	{@const id = thread.first.identifier}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<article
		id="comment-thread-{id}"
		class="card"
		class:is-current={current === id}
		data-card={placement === 'beside' ? id : undefined}
		style:top={aligned && placement === 'beside' ? `${at[id] ?? tops.get(id) ?? 0}px` : null}
		onclick={(event) => placement !== 'moved' && choose(event, id)}
	>
		{#if placement === 'moved'}
			<p class="quote small changed">“{short(thread.first.quote ?? '')}” <span class="muted">These words have since changed.</span></p>
		{/if}
		{#each [thread.first, ...thread.replies] as entry, index (entry.identifier)}
			{@const text = words(entry)}
			<div class="entry" class:reply={index > 0}>
				<p class="who">
					<PersonAvatar name={entry.personName} size="small" />
					<strong title={essayDate(entry.createdAt)}>{entry.personName}</strong>
					{#if index === 0}{#each entry.asks as ask (ask)}{@render askTag(ask)}{/each}{/if}
				</p>
				{#if text}<p class="body">{text}</p>{/if}
			</div>
		{/each}
		{#if thread.first.resolvedAt}
			<p class="small muted">Done{thread.first.resolvedByName ? `, by ${thread.first.resolvedByName}` : ''}, {essayDate(thread.first.resolvedAt)}.</p>
		{/if}
		{#if replying === id}
			<form class="reply-form" onsubmit={(event) => reply(event, id)}>
				<label class="visually-hidden" for="reply-{id}">Your reply</label>
				<!-- svelte-ignore a11y_autofocus -->
				<textarea id="reply-{id}" rows="2" maxlength="5000" bind:value={replies[id]} autofocus onkeydown={(event) => event.key === 'Escape' && (replying = null)}></textarea>
				<p class="row">
					<span class="push"></span>
					<button class="quiet" type="button" onclick={() => (replying = null)}>Cancel</button>
					<button class="button send" type="submit" disabled={sending || !(replies[id] ?? '').trim()}>Reply</button>
				</p>
			</form>
		{:else}
			<p class="row actions">
				<button class="quiet" type="button" onclick={() => (replying = id)}><CornerUpLeft size={16} aria-hidden="true" /> Reply</button>
				{#if mayResolveAny || thread.first.personIdentifier === you}
					<button class="quiet" type="button" disabled={sending} onclick={() => resolve(thread)}>
						{#if thread.first.resolvedAt}<RotateCcw size={16} aria-hidden="true" /> Reopen{:else}<Check size={16} aria-hidden="true" /> Done{/if}
					</button>
				{/if}
			</p>
		{/if}
	</article>
{/snippet}

<aside class="comments" class:aligned aria-label="Comments">
	<div class="beside" bind:this={column} style:height={aligned ? `${columnHeight}px` : null}>
		{#each cards as card (card.key)}
			{#if card.thread}{@render threadCard(card.thread, 'beside')}{:else}{@render newCard()}{/if}
		{/each}
	</div>
	{#if problem && !pending}<p class="field-error small" role="alert">{problem}</p>{/if}
	{#if moved.length}
		<h2 class="small muted">Words since changed</h2>
		{#each moved as thread (thread.first.identifier)}{@render threadCard(thread, 'moved')}{/each}
	{/if}
	{#if done.length}
		<button type="button" class="quiet done-toggle" aria-expanded={showDone} onclick={() => (showDone = !showDone)}><Check size={16} aria-hidden="true" /> Done ({done.length})</button>
		{#if showDone}
			{#each done as thread (thread.first.identifier)}{@render threadCard(thread, 'done')}{/each}
		{/if}
	{/if}
</aside>

<style>
	.comments {
		display: grid;
		align-content: start;
		gap: var(--space-2);
		min-width: 0;
	}

	.beside {
		display: grid;
		gap: var(--space-3);
	}

	.aligned .beside {
		position: relative;
		display: block;
	}

	.aligned .beside > :global(*) {
		position: absolute;
		left: 0;
		right: 0;
		transition: top var(--motion-duration-short) var(--motion-easing-standard);
	}

	h2 {
		margin: var(--space-2) 0 0;
	}

	.card {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		box-shadow: 0 1px 3px color-mix(in srgb, var(--color-ink) 10%, transparent);
		font-size: var(--font-size-small);
		cursor: pointer;
	}

	.card.is-current {
		border-color: var(--color-comment-rule);
		box-shadow: 0 0 0 1px var(--color-comment-rule);
	}

	.new-card {
		cursor: default;
		border: 2px solid var(--color-comment-rule);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--color-ink) 14%, transparent);
	}

	.quote {
		margin: 0;
		padding-left: var(--space-2);
		border-left: 3px solid var(--color-comment-rule);
		font-style: italic;
		color: var(--color-ink);
	}

	.quote.changed {
		border-left-color: var(--color-line);
	}

	.asks {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}

	.ask,
	.tag {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		padding: 0.15rem var(--space-2);
		background: var(--color-surface-raised);
		color: var(--color-ink);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		line-height: 1.3;
	}

	.ask {
		cursor: pointer;
	}

	.ask[aria-pressed='true'] {
		border-color: var(--color-link);
		background: var(--color-notice-background);
		color: var(--color-link);
	}

	.tag {
		padding: 0.05rem var(--space-2);
		font-size: 0.8rem;
	}

	textarea {
		width: 100%;
		border: 2px solid var(--color-link);
		border-radius: var(--radius-control);
		padding: var(--space-2);
		font: inherit;
		font-size: var(--font-size-body, 1rem);
	}

	/* Typing here keeps the card's white field; the focus ring still shows (no yellow fill). */
	textarea:focus-visible {
		background: var(--color-surface-raised);
		color: var(--color-ink);
		outline: 3px solid var(--color-focus-ring);
		outline-offset: 1px;
	}

	.reply-form textarea {
		border-width: 1px;
		border-color: var(--color-control-border);
	}

	.row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
	}

	.push {
		flex: 1;
	}

	.quiet {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-1);
		border: 0;
		background: none;
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}

	.quiet.mention {
		color: var(--color-ink-muted);
	}

	.actions .quiet {
		color: var(--color-ink-muted);
	}

	.send {
		background: var(--color-action);
		border-color: var(--color-action);
		color: var(--color-action-text);
	}

	.entry {
		display: grid;
		gap: var(--space-1);
	}

	.entry.reply {
		padding-left: var(--space-3);
		border-left: 2px solid var(--color-line);
	}

	.entry p {
		margin: 0;
	}

	.who {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.body {
		white-space: pre-wrap;
		font-size: var(--font-size-body, 1rem);
	}

	.mention-list {
		list-style: none;
		margin: 0;
		padding: var(--space-1);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		max-height: 12rem;
		overflow-y: auto;
	}

	.mention-list button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--layout-target-minimum);
		border: 0;
		background: none;
		color: var(--color-ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.mention-list button:hover {
		background: var(--color-surface);
	}

	.done-toggle {
		justify-self: start;
		color: var(--color-ink-muted);
	}
</style>
