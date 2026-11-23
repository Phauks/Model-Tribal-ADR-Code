<script lang="ts">
	import { onMount } from 'svelte';
	import Archive from '@lucide/svelte/icons/archive';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import BellRing from '@lucide/svelte/icons/bell-ring';
	import FolderInput from '@lucide/svelte/icons/folder-input';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import ListFilter from '@lucide/svelte/icons/list-filter';
	import Mail from '@lucide/svelte/icons/mail';
	import OctagonAlert from '@lucide/svelte/icons/octagon-alert';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Plus from '@lucide/svelte/icons/plus';
	import ShieldEllipsis from '@lucide/svelte/icons/shield-ellipsis';
	import ForwardIcon from '@lucide/svelte/icons/forward';
	import ReplyIcon from '@lucide/svelte/icons/reply';
	import ReplyAll from '@lucide/svelte/icons/reply-all';
	import StickyNote from '@lucide/svelte/icons/sticky-note';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import { deliveryLabels, formatAddress, messageStatusLabels, replyAllReach } from '#lib/mail.ts';
	import Avatar from '../Avatar.svelte';
	import Composer from '../Composer.svelte';
	import TagChip from '../TagChip.svelte';
	import { fullDate, listDate, localInputValue } from '../dates.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const thread = $derived(data.thread);
	const tagged = $derived(new Set(thread.tags.map((tag) => tag.identifier)));
	const untagged = $derived(data.tags.filter((tag) => !tagged.has(tag.identifier)));
	const home = $derived(thread.folder === 'folder' ? data.mailFolders.find((item) => item.identifier === thread.folderIdentifier) : undefined);
	const placeName = $derived(
		home ? home.path : ({ inbox: 'Inbox', archive: 'Archive', spam: 'Spam', trash: 'Deleted', folder: 'A folder' } as const)[thread.folder]
	);
	// The browser's time zone, so times typed in the forms mean the reader's own time.
	let zone = $state('America/Denver');
	let ready = $state(false);
	onMount(() => {
		zone = Intl.DateTimeFormat().resolvedOptions().timeZone || zone;
		ready = true;
		remindAt = morning(1);
	});

	/** Tomorrow, or next Monday, at 8 in the morning, for the reminder's quick picks. */
	function morning(daysAhead: number | 'monday'): string {
		const now = new Date();
		const days = daysAhead === 'monday' ? ((8 - now.getDay()) % 7 || 7) : daysAhead;
		const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 8, 0);
		return localInputValue((at.getTime() - now.getTime()) / 3_600_000, now);
	}
	let remindAt = $state(localInputValue(24 * 3));

	/** Where a Reply, Reply all or Forward button takes the reader: the box at the bottom, filled in for that message. */
	function composeLink(mode: 'reply' | 'all' | 'forward', message: string): string {
		return `?compose=${mode}&message=${encodeURIComponent(message)}#reply`;
	}
	const modeNames = { reply: 'Reply', all: 'Reply all', forward: 'Forward' } as const;
	const answering = $derived(thread.messages.find((message) => message.identifier === data.compose.message));
	const canReplyAll = $derived(
		answering
			? replyAllReach(
					{ ...answering, at: answering.receivedAt ?? answering.sentAt ?? answering.createdAt },
					data.addresses
				) > 1
			: false
	);

	function size(bytes: number): string {
		return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
	}
	function firstLine(text: string): string {
		const flat = text.replace(/\s+/g, ' ').trim();
		return flat.length > 120 ? `${flat.slice(0, 119)}…` : flat;
	}
</script>

<svelte:head>
	<title>{thread.subject} · Inbox · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<div class="topbar" role="toolbar" aria-label="Conversation">
	<a class="icon-button" href="/workspace/inbox" aria-label="Back to the inbox" title="Back to the inbox"><ArrowLeft size={20} aria-hidden="true" /></a>
	<form method="post" action="?/move" class="tools">
		{#if thread.folder === 'inbox'}
			<button class="tool" type="submit" name="folder" value="archive"><Archive size={18} aria-hidden="true" /><span>Archive</span></button>
		{:else}
			<button class="tool" type="submit" name="folder" value="inbox"><InboxIcon size={18} aria-hidden="true" /><span>To inbox</span></button>
		{/if}
		{#if thread.folder !== 'spam'}<button class="tool" type="submit" name="folder" value="spam"><OctagonAlert size={18} aria-hidden="true" /><span>Spam</span></button>{/if}
		{#if thread.folder !== 'trash'}<button class="tool" type="submit" name="folder" value="trash"><Trash2 size={18} aria-hidden="true" /><span>Delete</span></button>{/if}
	</form>
	<form method="post" action="?/read" class="tools">
		<button class="tool" type="submit" name="read" value="no"><Mail size={18} aria-hidden="true" /><span>Mark unread</span></button>
	</form>
	{#if data.mailFolders.length}
		<form method="post" action="?/move" class="tools move">
			<label for="move-folder" class="visually-hidden">Move to a folder</label>
			<select id="move-folder" name="folder" required>
				<option value="">Move to…</option>
				{#each data.mailFolders as folder (folder.identifier)}
					<option value={folder.identifier} disabled={folder.identifier === thread.folderIdentifier}>{' '.repeat(folder.depth)}{folder.name}</option>
				{/each}
			</select>
			<button class="tool" type="submit"><FolderInput size={18} aria-hidden="true" /><span>Move</span></button>
		</form>
	{/if}
</div>

<header class="thread-head">
	<h1>{thread.subject}</h1>
	<div class="tag-row">
		<span class="place small"><FolderInput size={14} aria-hidden="true" />{placeName}</span>
		{#each thread.tags as tag (tag.identifier)}
			<form method="post" action="?/tag" class="tag-form">
				<input type="hidden" name="tag" value={tag.identifier} />
				<TagChip {tag} />
				<button class="chip-x" type="submit" name="on" value="no" aria-label="Take off the tag {tag.name}" title="Take off the tag"><X size={14} aria-hidden="true" /></button>
			</form>
		{/each}
		{#if untagged.length}
			<details class="menu">
				<summary class="add-tag small"><Plus size={14} aria-hidden="true" />Tag</summary>
				<div class="popover">
					<ul>
						{#each untagged as tag (tag.identifier)}
							<li>
								<form method="post" action="?/tag">
									<input type="hidden" name="tag" value={tag.identifier} />
									<button type="submit" name="on" value="yes" class="menu-item"><TagChip {tag} /></button>
								</form>
							</li>
						{/each}
					</ul>
				</div>
			</details>
		{/if}
	</div>
	<p class="muted small with">
		With {thread.counterpartName ? `${thread.counterpartName} <${thread.counterpartAddress}>` : thread.counterpartAddress}
		{#if thread.nationIdentifier}· <a href="/nations/{thread.nationIdentifier}">The nation’s page</a>{/if}
		{#if thread.outreach}· From the outreach batch <a href="/workspace/outreach/{thread.outreach.batchIdentifier}">{thread.outreach.batchName}</a>{/if}
		{#if data.canManage && thread.counterpartAddress}
			· <a href="/workspace/inbox/rules/new?from={encodeURIComponent(thread.counterpartAddress)}" class="rule-link"><ListFilter size={14} aria-hidden="true" />Make a rule for mail from this sender</a>
		{/if}
	</p>
</header>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

{#if thread.stopRequested}
	<div class="notice notice-problem" role="status">
		<p>
			The latest reply seems to ask the project not to write again. Read it, and if that is what it says, put {thread.counterpartAddress} on the
			do-not-email list. Outreach will then leave the address out.
		</p>
		{#if data.canManage}
			<form method="post" action="?/stop" class="actions">
				<button class="button" type="submit" name="confirm" value="yes">Put the address on the list</button>
				<button class="button button-quiet" type="submit" name="confirm" value="no">It does not ask that</button>
			</form>
		{/if}
	</div>
{/if}

<div class="conversation">
	<div class="messages">
		{#each thread.messages as message, index (message.identifier)}
			{@const latest = index >= thread.messages.length - 2}
			<details class="message" class:outgoing={message.direction === 'out'} open={latest || message.status !== 'sent' && message.status !== 'received'}>
				<summary>
					<Avatar name={message.from.name ?? message.from.email} />
					<span class="sender">
						<strong>{message.from.name ?? message.from.email}</strong>
						{#if message.from.name}<span class="muted small address">&lt;{message.from.email}&gt;</span>{/if}
						<span class="preview muted small">{firstLine(message.text)}</span>
						<span class="recipients muted small">
							to {message.to.map(formatAddress).join(', ')}{#if message.cc.length}, cc {message.cc.map(formatAddress).join(', ')}{/if}{#if message.bcc.length}, bcc {message.bcc.map(formatAddress).join(', ')}{/if}
						</span>
					</span>
					<span class="stamp small muted" title={fullDate(message.sentAt ?? message.receivedAt ?? message.scheduledFor ?? message.createdAt)}>
						{#if message.attachments.some((item) => !item.inline)}<Paperclip size={14} aria-label="Has attachments" />{/if}
						{#if message.direction === 'in'}{listDate(message.receivedAt ?? message.createdAt)}
						{:else if message.status === 'sent'}{listDate(message.sentAt ?? message.createdAt)}
						{:else if message.status === 'scheduled'}<span class="status">Goes {listDate(message.scheduledFor ?? message.createdAt)}</span>
						{:else}<span class="status">{messageStatusLabels[message.status] ?? message.status}</span>{/if}
					</span>
				</summary>
				<div class="message-body">
					{#if message.direction === 'out' && message.status === 'sent'}
						<p class="small status-line">
							Sent {fullDate(message.sentAt)}{#if message.sentByName}{' '}by {message.sentByName}{/if}{#if message.carrier === 'smtp'}{' '}through the outreach mailbox{/if}.
							{message.deliveryStatus ? deliveryLabels[message.deliveryStatus] : 'No delivery report yet'}{#if message.deliveryDetail}: {message.deliveryDetail}{/if}.
							{#if message.acknowledgedAt}They said they got it on {fullDate(message.acknowledgedAt)}.{/if}
						</p>
					{/if}
					{#if message.automatic}<p class="small status-line">Automatic reply</p>{/if}
					{#if message.spamReason}<p class="small warning">In Spam because: {message.spamReason}</p>{/if}
					{#if message.error}<p class="small warning">Not sent: {message.error}</p>{/if}
					<div class="text">{message.text}</div>
					{#if message.hasHtml}
						<details class="formatted">
							<summary class="small">Show the formatted version</summary>
							<p class="small muted">Pictures from the web are not loaded, so the sender cannot tell the message was opened.</p>
							<iframe
								title="Formatted version of the message"
								src="/workspace/inbox/messages/{message.identifier}/html"
								sandbox=""
								loading="lazy"
								referrerpolicy="no-referrer"
							></iframe>
						</details>
					{/if}
					{#if message.attachments.some((item) => !item.inline)}
						<ul class="attachments">
							{#each message.attachments.filter((item) => !item.inline) as attachment (attachment.identifier)}
								<li>
									{#if attachment.check?.held}
										<span class="held" title={attachment.check.explanation}>
											<ShieldEllipsis size={16} aria-hidden="true" />
											<span class="file">{attachment.filename}</span>
											<span class="small muted">{attachment.check.label}</span>
										</span>
										{#if attachment.check.releasable && data.canManage}
											<form method="post" action="?/release" class="release small">
												<input type="hidden" name="attachment" value={attachment.identifier} />
												<label for="release-{attachment.identifier}" class="visually-hidden">Why it is safe to release</label>
												<input id="release-{attachment.identifier}" name="note" placeholder="Why it is safe (for the history)" />
												<button class="button button-quiet small" type="submit">Release anyway</button>
											</form>
										{/if}
									{:else}
										<a href="/workspace/inbox/attachments/{attachment.identifier}" download>
											<Paperclip size={16} aria-hidden="true" />
											<span class="file">{attachment.filename}</span>
											<span class="small muted">{size(attachment.size)}</span>
										</a>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
					{#if message.status === 'received' || message.status === 'sent'}
						{@const many = replyAllReach({ ...message, at: message.receivedAt ?? message.sentAt ?? message.createdAt }, data.addresses) > 1}
						<nav class="answer" aria-label="Answer this message">
							<a class="answer-link small" href={composeLink('reply', message.identifier)}><ReplyIcon size={16} aria-hidden="true" />Reply</a>
							{#if many}<a class="answer-link small" href={composeLink('all', message.identifier)}><ReplyAll size={16} aria-hidden="true" />Reply all</a>{/if}
							<a class="answer-link small" href={composeLink('forward', message.identifier)}><ForwardIcon size={16} aria-hidden="true" />Forward</a>
						</nav>
					{/if}
					{#if message.status === 'scheduled' || message.status === 'failed'}
						<form method="post" class="actions">
							<input type="hidden" name="message" value={message.identifier} />
							{#if message.carrier !== 'smtp'}
								<button class="button button-quiet" type="submit" formaction="?/again">{message.status === 'failed' ? 'Send again' : 'Send now'}</button>
							{/if}
							<button class="button button-quiet" type="submit" formaction="?/cancel">Cancel this message</button>
						</form>
					{/if}
				</div>
			</details>
		{/each}

		{#each thread.notes as note (note.identifier)}
			<aside class="note" aria-label="Note for the team">
				<p class="small note-head"><StickyNote size={16} aria-hidden="true" /><strong>{note.personName ?? 'Someone'}</strong> · {fullDate(note.createdAt)} · only the team sees this</p>
				<p class="text">{note.body}</p>
			</aside>
		{/each}

		<section class="reply" id="reply" aria-labelledby="reply-heading">
			<h2 id="reply-heading" class="visually-hidden">{modeNames[data.compose.mode]}</h2>
			{#if data.compose.message}
				<nav class="modes" aria-label="How to answer">
					<a href={composeLink('reply', data.compose.message)} aria-current={data.compose.mode === 'reply' ? 'true' : undefined}><ReplyIcon size={16} aria-hidden="true" />Reply</a>
					{#if canReplyAll || data.compose.mode === 'all'}
						<a href={composeLink('all', data.compose.message)} aria-current={data.compose.mode === 'all' ? 'true' : undefined}><ReplyAll size={16} aria-hidden="true" />Reply all</a>
					{/if}
					<a href={composeLink('forward', data.compose.message)} aria-current={data.compose.mode === 'forward' ? 'true' : undefined}><ForwardIcon size={16} aria-hidden="true" />Forward</a>
					{#if answering}<span class="small muted answering">{data.compose.mode === 'forward' ? 'Forwarding' : 'Answering'} {answering.from.name ?? answering.from.email}, {listDate(answering.receivedAt ?? answering.sentAt ?? answering.createdAt)}</span>{/if}
				</nav>
			{/if}
			{#key `${data.compose.mode}:${data.compose.message}`}
				<Composer
					action="?/reply"
					idPrefix="reply"
					addresses={data.addresses}
					from={data.compose.from}
					to={data.compose.to}
					cc={data.compose.cc}
					subject={data.compose.subject}
					quote={data.compose.quote}
					mode={data.compose.mode}
					message={data.compose.message}
					forwarded={data.compose.attachments}
					focus={data.compose.asked}
				/>
			{/key}
		</section>
	</div>

	<aside class="side" aria-label="About this conversation">
		<section class="card">
			<h2>Assigned to</h2>
			<form method="post" action="?/assign" class="inline-form">
				<label for="assignee" class="visually-hidden">Assigned to</label>
				<select id="assignee" name="assignee">
					<option value="">Nobody</option>
					{#each data.people as person (person.identifier)}
						<option value={person.identifier} selected={person.identifier === thread.assigneeIdentifier}>{person.name}</option>
					{/each}
				</select>
				<button class="button button-quiet small" type="submit">Save</button>
			</form>
		</section>

		<section class="card">
			<h2><BellRing size={16} aria-hidden="true" />Remind me</h2>
			{#if thread.remindAt}
				<p class="small">Out of the inbox until {fullDate(thread.remindAt)}. It comes back sooner if they reply.</p>
				<form method="post" action="?/remind"><button class="button button-quiet small" type="submit" name="clear" value="yes">Cancel the reminder</button></form>
			{:else}
				<form method="post" action="?/remind" class="stack">
					<input type="hidden" name="zone" value={zone} />
					<p class="small muted explain">The conversation leaves the inbox and comes back at this time, or as soon as they reply.</p>
					<label for="remind-at" class="small">Bring it back</label>
					<input id="remind-at" type="datetime-local" name="at" bind:value={remindAt} />
					{#if ready}
						<span class="quick">
							<button type="button" class="link-button" onclick={() => (remindAt = morning(1))}>Tomorrow</button>
							<button type="button" class="link-button" onclick={() => (remindAt = morning('monday'))}>Monday</button>
							<button type="button" class="link-button" onclick={() => (remindAt = morning(7))}>In a week</button>
						</span>
					{/if}
					<button class="button button-quiet small" type="submit">Remind me</button>
				</form>
			{/if}
		</section>

		<section class="card">
			<h2><StickyNote size={16} aria-hidden="true" />Note for the team</h2>
			<form method="post" action="?/note" class="stack">
				<label for="note-body" class="visually-hidden">Note (only the project team sees it)</label>
				<textarea id="note-body" name="body" rows="3" required placeholder="Only the team sees notes"></textarea>
				<button class="button button-quiet small" type="submit">Add the note</button>
			</form>
		</section>

		{#if thread.folder === 'trash'}<p class="small muted">Deleted conversations are removed for good after 30 days.</p>{/if}

		{#if thread.actions.length}
			<details class="card history">
				<summary class="small">History</summary>
				<ul class="small">
					{#each thread.actions as action, index (index)}
						<li>{fullDate(action.createdAt)}: {action.action}{#if action.personName} by {action.personName}{/if}{#if action.note} ({action.note}){/if}</li>
					{/each}
				</ul>
			</details>
		{/if}
	</aside>
</div>

<style>
	.topbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--color-line);
	}
	.tools {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
	.move select {
		min-height: 2.25rem;
	}
	.tool {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-2);
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
		cursor: pointer;
	}
	.tool:hover {
		background: var(--color-surface);
	}
	.thread-head {
		margin-block: var(--space-4);
	}
	.thread-head h1 {
		margin: 0 0 var(--space-2);
		overflow-wrap: anywhere;
	}
	.tag-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.place {
		display: inline-flex;
		align-items: center;
		gap: 0.3em;
		padding: 0.1em 0.6em;
		border-radius: 999px;
		border: 1px solid var(--color-line);
		color: var(--color-ink-muted);
	}
	.tag-form {
		display: inline-flex;
		align-items: center;
	}
	.chip-x {
		display: inline-grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		margin-left: -0.25rem;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--color-ink-muted);
		cursor: pointer;
	}
	.chip-x:hover {
		background: var(--color-surface);
		color: var(--color-ink);
	}
	.menu {
		position: relative;
	}
	.add-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.3em;
		min-height: 2rem;
		padding: 0 0.7em;
		border: 1px dashed var(--color-control-border);
		border-radius: 999px;
		cursor: pointer;
		list-style: none;
	}
	.add-tag::-webkit-details-marker {
		display: none;
	}
	.popover {
		position: absolute;
		top: calc(100% + var(--space-1));
		left: 0;
		z-index: 5;
		min-width: 14rem;
		padding: var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		box-shadow: 0 6px 24px color-mix(in srgb, var(--color-ink) 18%, transparent);
	}
	.popover ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.menu-item {
		display: flex;
		width: 100%;
		min-height: 2.5rem;
		align-items: center;
		padding: 0 var(--space-2);
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		cursor: pointer;
	}
	.menu-item:hover {
		background: var(--color-surface);
	}
	.with {
		margin: var(--space-2) 0 0;
	}
	.rule-link {
		display: inline-flex;
		align-items: center;
		gap: 0.3em;
	}
	.conversation {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-5);
		align-items: start;
	}
	@media (min-width: 70rem) {
		.conversation {
			grid-template-columns: minmax(0, 1fr) 16rem;
		}
	}
	.messages {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
	}
	.message {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
	}
	.message.outgoing {
		background: color-mix(in srgb, var(--color-link) 5%, var(--color-surface-raised));
	}
	.message > summary {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		cursor: pointer;
		list-style: none;
	}
	.message > summary::-webkit-details-marker {
		display: none;
	}
	.sender {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		column-gap: var(--space-2);
		align-items: baseline;
	}
	.address {
		overflow-wrap: anywhere;
	}
	.preview {
		flex-basis: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.recipients {
		flex-basis: 100%;
		display: none;
		overflow-wrap: anywhere;
	}
	.message[open] .preview {
		display: none;
	}
	.message[open] .recipients {
		display: block;
	}
	.stamp {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		white-space: nowrap;
	}
	.status {
		color: var(--color-link);
		font-weight: var(--font-weight-semibold);
	}
	.message-body {
		padding: 0 var(--space-4) var(--space-4) calc(var(--space-4) + 2.25rem + var(--space-3));
	}
	.status-line {
		color: var(--color-ink-muted);
		margin: 0 0 var(--space-2);
	}
	.text {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		line-height: var(--font-line-height-reading);
		margin: 0;
	}
	.warning {
		color: var(--color-danger);
	}
	.formatted {
		margin-top: var(--space-3);
	}
	iframe {
		width: 100%;
		min-height: 24rem;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
	}
	.attachments {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: var(--space-3) 0 0;
		padding: 0;
	}
	.attachments a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		text-decoration: none;
	}
	.attachments .held {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px dashed var(--color-control-border);
		border-radius: var(--radius-control);
		color: var(--color-ink-muted);
	}
	.release {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}
	.release input {
		font-size: var(--font-size-small);
	}
	.attachments a:hover .file {
		text-decoration: underline;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.answer {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}
	.answer-link {
		min-height: 2.25rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: 999px;
		color: var(--color-ink);
	}
	.answer-link:hover {
		background: var(--color-surface);
		border-color: var(--color-control-border);
	}
	.answer a,
	.modes a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		text-decoration: none;
	}
	.modes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		margin-bottom: var(--space-2);
	}
	.modes a {
		min-height: 2.25rem;
		padding: 0 var(--space-3);
		border-radius: 999px;
		color: var(--color-ink);
		font-size: var(--font-size-small);
	}
	.modes a:hover {
		background: var(--color-surface);
	}
	.modes a[aria-current='true'] {
		background: var(--color-surface);
		box-shadow: inset 0 0 0 1px var(--color-control-border);
		font-weight: var(--font-weight-semibold);
	}
	.answering {
		margin-left: var(--space-2);
	}
	.explain {
		margin: 0;
	}
	.quick {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.link-button {
		border: 0;
		background: none;
		color: var(--color-link);
		font: inherit;
		font-size: var(--font-size-small);
		cursor: pointer;
		padding: var(--space-1);
		min-height: 2rem;
		text-decoration: underline;
	}
	.note {
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-panel);
		background: var(--color-placeholder-background);
		border-left: 4px solid var(--color-placeholder-rule);
	}
	.note-head {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0 0 var(--space-1);
	}
	.reply {
		margin-top: var(--space-3);
	}
	.side {
		display: grid;
		gap: var(--space-3);
	}
	.card {
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
	}
	.card h2 {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
	}
	.inline-form {
		display: flex;
		gap: var(--space-2);
	}
	.inline-form select {
		flex: 1;
		min-width: 0;
	}
	.stack {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
	}
	.stack input[type='datetime-local'] {
		font: inherit;
		font-size: var(--font-size-small);
		min-height: var(--layout-target-minimum);
		width: 100%;
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		padding: 0 var(--space-2);
	}
	.stack textarea {
		font-size: var(--font-size-small);
	}
	.history ul {
		margin: var(--space-2) 0 0;
		padding-left: var(--space-4);
	}
	@media (max-width: 40rem) {
		.tool span {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
		.message-body {
			padding-left: var(--space-4);
		}
	}
</style>
