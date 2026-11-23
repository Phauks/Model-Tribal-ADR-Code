<script lang="ts">
	import { onMount } from 'svelte';
	import { deliveryLabels, formatAddress, messageStatusLabels } from '#lib/mail.ts';
	import LabelChip from '../LabelChip.svelte';
	import { fullDate, localInputValue } from '../dates.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const thread = $derived(data.thread);
	const labelled = $derived(new Set(thread.labels.map((label) => label.identifier)));
	// The browser's time zone, so times typed in the forms mean the reader's own time.
	let zone = $state('America/Denver');
	let quoted = $state(true);
	onMount(() => {
		zone = Intl.DateTimeFormat().resolvedOptions().timeZone || zone;
	});

	function size(bytes: number): string {
		return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
	}
</script>

<svelte:head>
	<title>{thread.subject} · Inbox · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<p class="small"><a href="/workspace/inbox">Inbox</a></p>
<h1>{thread.subject}</h1>
<p class="muted">
	With {thread.counterpartName ? `${thread.counterpartName} <${thread.counterpartAddress}>` : thread.counterpartAddress}
	{#if thread.nationIdentifier}· <a href="/nations/{thread.nationIdentifier}">The nation’s page</a>{/if}
	{#if thread.outreach}· From the outreach batch <a href="/workspace/outreach/{thread.outreach.batchIdentifier}">{thread.outreach.batchName}</a>{/if}
</p>

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
				<button class="button-quiet" type="submit" name="confirm" value="no">It does not ask that</button>
			</form>
		{/if}
	</div>
{/if}

<div class="conversation">
	<div class="messages">
		{#each thread.messages as message (message.identifier)}
			<article class="message" class:outgoing={message.direction === 'out'} aria-label="Message from {message.from.name ?? message.from.email}">
				<header>
					<p>
						<strong>{message.from.name ?? message.from.email}</strong>
						<span class="muted small">&lt;{message.from.email}&gt;</span>
					</p>
					<p class="small muted">
						To {message.to.map(formatAddress).join(', ')}
						{#if message.cc.length}· Cc {message.cc.map(formatAddress).join(', ')}{/if}
						{#if message.bcc.length}· Bcc {message.bcc.map(formatAddress).join(', ')}{/if}
					</p>
					<p class="small">
						{#if message.direction === 'in'}
							Received {fullDate(message.receivedAt ?? message.createdAt)}
						{:else if message.status === 'sent'}
							Sent {fullDate(message.sentAt)}{#if message.sentByName} by {message.sentByName}{/if}
							{#if message.carrier === 'smtp'}through the outreach mailbox{/if}
						{:else if message.status === 'scheduled'}
							Scheduled for {fullDate(message.scheduledFor)}
						{:else}
							{messageStatusLabels[message.status] ?? message.status}
						{/if}
						{#if message.automatic}· Automatic reply{/if}
					</p>
					{#if message.direction === 'out' && message.status === 'sent'}
						<p class="small">
							{message.deliveryStatus ? deliveryLabels[message.deliveryStatus] : 'Sent; no delivery report yet'}{#if message.deliveryDetail}: {message.deliveryDetail}{/if}
							{#if message.acknowledgedAt}· They said they got it on {fullDate(message.acknowledgedAt)}{/if}
						</p>
					{/if}
					{#if message.spamReason}<p class="small warning">In Spam because: {message.spamReason}</p>{/if}
					{#if message.error}<p class="small warning">Not sent: {message.error}</p>{/if}
				</header>
				<div class="text">{message.text}</div>
				{#if message.hasHtml}
					<details>
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
							<li><a href="/workspace/inbox/attachments/{attachment.identifier}" download>{attachment.filename}</a> <span class="small muted">{size(attachment.size)}</span></li>
						{/each}
					</ul>
				{/if}
				{#if message.status === 'scheduled' || message.status === 'failed'}
					<form method="post" class="actions">
						<input type="hidden" name="message" value={message.identifier} />
						{#if message.carrier !== 'smtp'}
							<button class="button-quiet" type="submit" formaction="?/again">{message.status === 'failed' ? 'Send again' : 'Send now'}</button>
						{/if}
						<button class="button-quiet" type="submit" formaction="?/cancel">Cancel this message</button>
					</form>
				{/if}
			</article>
		{/each}

		{#each thread.notes as note (note.identifier)}
			<aside class="note panel" aria-label="Note">
				<p class="small"><strong>Note</strong> from {note.personName ?? 'someone'}, {fullDate(note.createdAt)}. Only the project team sees notes.</p>
				<p class="text">{note.body}</p>
			</aside>
		{/each}

		<section class="panel" aria-labelledby="reply-heading">
			<h2 id="reply-heading">Reply</h2>
			{#if !data.emailOn}<p class="small muted">Email is not switched on yet, so a reply would be kept but not sent.</p>{/if}
			<form method="post" action="?/reply" enctype="multipart/form-data">
				<input type="hidden" name="zone" value={zone} />
				<div class="field">
					<label for="reply-from">From</label>
					<select id="reply-from" name="from">
						{#each data.addresses as address (address)}<option value={address} selected={address === data.reply.from}>{address}</option>{/each}
					</select>
				</div>
				<div class="field">
					<label for="reply-to">To</label>
					<input type="text" id="reply-to" name="to" value={data.reply.to} required />
				</div>
				<details>
					<summary class="small">Cc and Bcc</summary>
					<div class="field"><label for="reply-cc">Cc</label><input type="text" id="reply-cc" name="cc" /></div>
					<div class="field"><label for="reply-bcc">Bcc</label><input type="text" id="reply-bcc" name="bcc" /></div>
				</details>
				<div class="field">
					<label for="reply-subject">Subject</label>
					<input type="text" id="reply-subject" name="subject" value={data.reply.subject} required />
				</div>
				<div class="field">
					<label for="reply-text">Message</label>
					<textarea id="reply-text" name="text" rows="10" required>{quoted ? data.reply.quote : ''}</textarea>
				</div>
				{#if data.reply.quote}
					<p class="small"><label><input type="checkbox" bind:checked={quoted} /> Quote the last message</label></p>
				{/if}
				<div class="field">
					<label for="reply-files">Attachments</label>
					<input id="reply-files" type="file" name="attachments" multiple />
				</div>
				<div class="field">
					<label for="reply-later">Send later <span class="small muted">(optional, your time)</span></label>
					<input id="reply-later" type="datetime-local" name="sendAt" />
				</div>
				<div class="field">
					<label for="reply-follow">Remind me if no reply by <span class="small muted">(optional)</span></label>
					<input id="reply-follow" type="datetime-local" name="followUpAt" />
				</div>
				<button class="button" type="submit">Send</button>
			</form>
		</section>

		<section class="panel" aria-labelledby="note-heading">
			<h2 id="note-heading">Add a note</h2>
			<form method="post" action="?/note">
				<div class="field">
					<label for="note-body">Note <span class="small muted">(only the project team sees it)</span></label>
					<textarea id="note-body" name="body" rows="3" required></textarea>
				</div>
				<button class="button-quiet" type="submit">Add the note</button>
			</form>
		</section>
	</div>

	<aside class="side" aria-label="Conversation actions">
		<form method="post" action="?/move" class="actions">
			{#if thread.folder === 'inbox'}
				<button class="button-quiet" type="submit" name="folder" value="archive">Archive</button>
			{:else}
				<button class="button-quiet" type="submit" name="folder" value="inbox">Move to the inbox</button>
			{/if}
			{#if thread.folder !== 'spam'}<button class="button-quiet" type="submit" name="folder" value="spam">Spam</button>{/if}
			{#if thread.folder !== 'trash'}<button class="button-quiet" type="submit" name="folder" value="trash">Delete</button>{/if}
		</form>
		<form method="post" action="?/read" class="actions">
			<button class="button-quiet" type="submit" name="read" value="no">Mark unread</button>
		</form>
		{#if thread.folder === 'trash'}<p class="small muted">Deleted conversations are removed for good after 30 days.</p>{/if}

		<h2 class="small">Assigned to</h2>
		<form method="post" action="?/assign" class="actions">
			<label for="assignee" class="visually-hidden">Assigned to</label>
			<select id="assignee" name="assignee">
				<option value="">Nobody</option>
				{#each data.people as person (person.identifier)}
					<option value={person.identifier} selected={person.identifier === thread.assigneeIdentifier}>{person.name}</option>
				{/each}
			</select>
			<button class="button-quiet" type="submit">Assign</button>
		</form>

		<h2 class="small">Labels</h2>
		<ul class="plain">
			{#each data.labels as label (label.identifier)}
				<li>
					<form method="post" action="?/label">
						<input type="hidden" name="label" value={label.identifier} />
						<button class="button-quiet small" type="submit" name="on" value={labelled.has(label.identifier) ? 'no' : 'yes'} aria-pressed={labelled.has(label.identifier)}>
							<LabelChip {label} />
						</button>
					</form>
				</li>
			{/each}
		</ul>

		<h2 class="small">Snooze</h2>
		{#if thread.snoozedUntil}
			<p class="small">Snoozed until {fullDate(thread.snoozedUntil)}.</p>
			<form method="post" action="?/snooze"><button class="button-quiet" type="submit" name="clear" value="yes">End the snooze</button></form>
		{:else}
			<form method="post" action="?/snooze">
				<input type="hidden" name="zone" value={zone} />
				<label for="snooze-until" class="small">Hide until</label>
				<input id="snooze-until" type="datetime-local" name="until" value={localInputValue(24)} />
				<button class="button-quiet" type="submit">Snooze</button>
			</form>
		{/if}

		<h2 class="small">Reminder if no reply</h2>
		{#if thread.followUpAt}
			<p class="small">Reminder on {fullDate(thread.followUpAt)}, unless they reply first.</p>
			<form method="post" action="?/followUp"><button class="button-quiet" type="submit" name="clear" value="yes">Clear the reminder</button></form>
		{:else}
			<form method="post" action="?/followUp">
				<input type="hidden" name="zone" value={zone} />
				<label for="follow-at" class="small">Remind me on</label>
				<input id="follow-at" type="datetime-local" name="at" value={localInputValue(24 * 7)} />
				<button class="button-quiet" type="submit">Set the reminder</button>
			</form>
		{/if}

		{#if thread.actions.length}
			<details>
				<summary class="small">History</summary>
				<ul class="plain small">
					{#each thread.actions as action, index (index)}
						<li>{fullDate(action.createdAt)}: {action.action}{#if action.personName} by {action.personName}{/if}{#if action.note} ({action.note}){/if}</li>
					{/each}
				</ul>
			</details>
		{/if}
	</aside>
</div>

<style>
	.conversation {
		display: grid;
		gap: var(--space-5);
	}
	@media (min-width: 60rem) {
		.conversation {
			grid-template-columns: minmax(0, 1fr) 16rem;
		}
	}
	.message {
		border-top: 1px solid var(--color-line);
		padding-block: var(--space-3);
	}
	.message header p {
		margin: 0;
	}
	.outgoing {
		padding-left: var(--space-3);
		border-left: 3px solid var(--color-link);
	}
	.text {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		margin-block: var(--space-3);
	}
	.warning {
		color: var(--color-danger);
	}
	iframe {
		width: 100%;
		min-height: 24rem;
		border: 1px solid var(--color-control-border);
		background: var(--color-surface-raised);
	}
	.attachments {
		margin: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-block: var(--space-2);
	}
	.note {
		margin-block: var(--space-3);
	}
	.plain {
		list-style: none;
		padding: 0;
		margin: 0 0 var(--space-3);
	}
	.side h2 {
		margin-top: var(--space-4);
	}
	.side input[type='datetime-local'] {
		display: block;
		margin-block: var(--space-1);
	}
	button[aria-pressed='true'] {
		font-weight: var(--font-weight-bold);
	}
</style>
