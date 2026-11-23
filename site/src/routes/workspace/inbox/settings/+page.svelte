<script lang="ts">
	// Settings for the project inbox (site/MAIL.md, "Inboxes" and "Writing"):
	// the inboxes and who is on each, signatures, saved replies, the pause
	// before mail goes, and the away message.
	import { onMount } from 'svelte';
	import Ban from '@lucide/svelte/icons/ban';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import UserRound from '@lucide/svelte/icons/user-round';
	import Users from '@lucide/svelte/icons/users';
	import X from '@lucide/svelte/icons/x';
	import CalendarOff from '@lucide/svelte/icons/calendar-off';
	import MessageSquareText from '@lucide/svelte/icons/message-square-text';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { fullDate } from '../dates.ts';
	import type { PageProps } from './$types';
	import DateTimeField from '#lib/components/DateTimeField.svelte';

	let { data, form }: PageProps = $props();

	// Times are kept as UTC and shown in the browser's own time zone once the page has loaded.
	let zone = $state('America/Denver');
	const localValue = (iso: string | null): string => {
		if (!iso) return '';
		const date = new Date(iso);
		const pad = (value: number) => String(value).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
	};
	const startingAway = () => ({ from: localValue(data.away.from), until: localValue(data.away.until) });
	let awayTimes = $state(startingAway());
	onMount(() => {
		zone = Intl.DateTimeFormat().resolvedOptions().timeZone || zone;
		awayTimes = startingAway();
	});

	// Whether the new inbox is someone's own, so the form asks whose it is.
	let newKind = $state<'shared' | 'personal'>('shared');
	const addressOf = (localPart: string) => `${localPart}@${data.domain ?? '…'}`;

	function notice(section: string): { problem?: string; done?: string } | null {
		return form && 'section' in form && form.section === section ? (form as { problem?: string; done?: string }) : null;
	}
</script>

<svelte:head>
	<title>Inbox settings · Inbox · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Inbox settings</h1>
<p class="lead">The project’s inboxes and who reads each one; how mail from them is written: a signature for each address, replies you give often, a pause to take a message back, and an away message; and the senders whose mail goes straight to Spam.</p>

{#snippet message(section: string)}
	{@const shown = notice(section)}
	{#if shown?.problem}
		<div class="notice notice-problem" role="alert"><p>{shown.problem}</p></div>
	{:else if shown?.done}
		<div class="notice" role="status"><p>{shown.done}</p></div>
	{/if}
{/snippet}

<div class="columns">
	<section class="card wide" id="inboxes" aria-labelledby="inboxes-heading">
		<h2 id="inboxes-heading"><InboxIcon size={20} aria-hidden="true" />Inboxes</h2>
		<p class="small muted">
			Each address has its own inbox. A shared inbox, such as contact@, is read and answered by everyone on it. A personal inbox is read only by the person it belongs to: nobody else, including whoever manages mail, sees what comes to it. Mail to an address no inbox has goes to the inbox marked “Gets other mail”.
		</p>
		{@render message('inboxes')}
		{#if !data.domain}
			<p class="small muted">Email is not switched on yet, so no mail comes in or goes out. You can still set up the inboxes now.</p>
		{/if}
		<ul class="inbox-list">
			{#each data.inboxes as inbox (inbox.identifier)}
				<li>
					<div class="inbox-head">
						{#if inbox.kind === 'personal'}<UserRound size={18} aria-hidden="true" />{:else}<Users size={18} aria-hidden="true" />{/if}
						<span class="what">
							<strong>{inbox.name}</strong>
							<span class="small muted break">{addressOf(inbox.localPart)}</span>
						</span>
						<span class="tag small">{inbox.kind === 'personal' ? 'Personal' : 'Shared'}</span>
						{#if inbox.catchAll}<span class="tag tag-strong small">Gets other mail</span>{/if}
					</div>
					{#if inbox.kind === 'personal'}
						<p class="small muted">Belongs to {inbox.ownerName ?? 'someone no longer on the project'}. Only they see its mail.</p>
					{:else}
						<p class="small muted">
							{inbox.conversationCount} conversation{inbox.conversationCount === 1 ? '' : 's'}{#if inbox.unread}, {inbox.unread} unread{/if}. Read by:
						</p>
						<ul class="members">
							{#each inbox.members as member (member.identifier)}
								<li>
									<span>{member.name}</span>
									{#if inbox.members.length > 1}
										<form method="post" action="?/removeMember">
											<input type="hidden" name="inbox" value={inbox.identifier} />
											<input type="hidden" name="member" value={member.identifier} />
											<button class="icon-button" type="submit" aria-label="Take {member.name} off {inbox.name}" title="Take off this inbox"><X size={16} aria-hidden="true" /></button>
										</form>
									{/if}
								</li>
							{/each}
						</ul>
						{@const others = data.candidates.filter((person) => !inbox.members.some((member) => member.identifier === person.identifier))}
						{#if others.length}
							<form method="post" action="?/addMember" class="inline-form">
								<input type="hidden" name="inbox" value={inbox.identifier} />
								<label class="visually-hidden" for="add-{inbox.identifier}">Person to add to {inbox.name}</label>
								<select id="add-{inbox.identifier}" name="member" required>
									{#each others as person (person.identifier)}
										<option value={person.identifier}>{person.name}</option>
									{/each}
								</select>
								<button class="button button-quiet small" type="submit"><Plus size={16} aria-hidden="true" />Add</button>
							</form>
						{/if}
					{/if}
					<details class="small more">
						<summary>Change or delete</summary>
						<form method="post" action="?/renameInbox" class="inline-form">
							<input type="hidden" name="inbox" value={inbox.identifier} />
							<label for="rename-{inbox.identifier}">Name</label>
							<input type="text" id="rename-{inbox.identifier}" name="name" value={inbox.name} maxlength="80" required />
							<button class="button button-quiet small" type="submit">Rename</button>
						</form>
						<div class="row-buttons">
							{#if inbox.kind === 'shared' && !inbox.catchAll}
								<form method="post" action="?/makeCatchAll">
									<input type="hidden" name="inbox" value={inbox.identifier} />
									<button class="button button-quiet small" type="submit">Send other mail here</button>
								</form>
							{/if}
							{#if !inbox.catchAll}
								<form method="post" action="?/deleteInbox">
									<input type="hidden" name="inbox" value={inbox.identifier} />
									<button class="button button-quiet small" type="submit"><Trash2 size={16} aria-hidden="true" />Delete the inbox</button>
								</form>
							{/if}
						</div>
						{#if !inbox.catchAll}
							<p class="muted">An inbox can be deleted once it has no conversations. Mail to its address then goes to the inbox that gets other mail.</p>
						{/if}
					</details>
				</li>
			{/each}
		</ul>
		<form method="post" action="?/createInbox" class="stack new">
			<h3><Plus size={18} aria-hidden="true" />New inbox</h3>
			<fieldset class="choices">
				<legend class="visually-hidden">Kind of inbox</legend>
				<label class="choice"><input type="radio" name="kind" value="shared" bind:group={newKind} />Shared, for a list of people</label>
				<label class="choice"><input type="radio" name="kind" value="personal" bind:group={newKind} />Personal, for one person only</label>
			</fieldset>
			<div class="dates">
				<div class="field">
					<label for="new-inbox-local">Address</label>
					<span class="address-field"><input type="text" id="new-inbox-local" name="localPart" maxlength="64" required placeholder={newKind === 'personal' ? 'trevor' : 'nations'} autocomplete="off" /><span class="muted">@{data.domain ?? 'the project’s domain'}</span></span>
				</div>
				<div class="field">
					<label for="new-inbox-name">Name</label>
					<input type="text" id="new-inbox-name" name="name" maxlength="80" required placeholder={newKind === 'personal' ? 'Trevor' : 'Nations'} />
				</div>
				{#if newKind === 'personal'}
					<div class="field">
						<label for="new-inbox-owner">Whose inbox</label>
						<select id="new-inbox-owner" name="owner" required>
							{#each data.candidates as person (person.identifier)}
								<option value={person.identifier}>{person.name}</option>
							{/each}
						</select>
					</div>
				{/if}
			</div>
			<div><button class="button" type="submit">Make the inbox</button></div>
		</form>
	</section>

	<section class="card" id="signatures" aria-labelledby="signatures-heading">
		<h2 id="signatures-heading"><PenLine size={20} aria-hidden="true" />Signatures</h2>
		<p class="small muted">Added below each new message and reply sent from that address, above any quoted message. You can change or delete it in the message before sending.</p>
		{@render message('signatures')}
		{#if data.addresses.length === 0}
			<p class="muted">The inbox has no addresses until email is switched on.</p>
		{/if}
		{#each data.addresses as address (address)}
			<form method="post" action="?/signature" class="stack">
				<input type="hidden" name="address" value={address} />
				<label for="signature-{address}"><strong>{address}</strong></label>
				<textarea id="signature-{address}" name="body" rows="4" maxlength="2000" placeholder="Name&#10;Model Tribal ADR Code&#10;Website">{data.signatures[address] ?? ''}</textarea>
				<div><button class="button button-quiet" type="submit">Save the signature</button></div>
			</form>
		{/each}
	</section>

	<section class="card" id="saved-replies" aria-labelledby="replies-heading">
		<h2 id="replies-heading"><MessageSquareText size={20} aria-hidden="true" />Saved replies</h2>
		<p class="small muted">Answers given often. Put one into any message with the <MessageSquareText size={14} aria-label="saved replies" /> button beside Send.</p>
		{@render message('saved-replies')}
		{#if data.savedReplies.length}
			<ul class="replies">
				{#each data.savedReplies as reply (reply.identifier)}
					<li>
						<details>
							<summary><strong>{reply.name}</strong> <span class="small muted">{reply.body.replace(/\s+/g, ' ').slice(0, 100)}</span></summary>
							<form method="post" action="?/reply" class="stack">
								<input type="hidden" name="identifier" value={reply.identifier} />
								<div class="field">
									<label for="reply-name-{reply.identifier}">Name</label>
									<input type="text" id="reply-name-{reply.identifier}" name="name" value={reply.name} maxlength="80" required />
								</div>
								<div class="field">
									<label for="reply-body-{reply.identifier}">Words</label>
									<textarea id="reply-body-{reply.identifier}" name="body" rows="8" required>{reply.body}</textarea>
								</div>
								<div class="row-buttons">
									<button class="button" type="submit">Save</button>
									<button class="button button-quiet" type="submit" formaction="?/deleteReply" formnovalidate><Trash2 size={16} aria-hidden="true" />Delete</button>
								</div>
								<p class="small muted">Changed {fullDate(reply.updatedAt)}</p>
							</form>
						</details>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">No saved replies yet.</p>
		{/if}
		<form method="post" action="?/reply" class="stack new">
			<h3><Plus size={18} aria-hidden="true" />New saved reply</h3>
			<div class="field">
				<label for="new-reply-name">Name</label>
				<input type="text" id="new-reply-name" name="name" maxlength="80" required placeholder="Thanks, we will look into it" />
			</div>
			<div class="field">
				<label for="new-reply-body">Words</label>
				<textarea id="new-reply-body" name="body" rows="6" required></textarea>
			</div>
			<details class="small fields-help">
				<summary>Fields you can use</summary>
				<p class="muted">Each is filled in for whoever the message is to, from the address book. One with nothing to fill stays in the message, so you can fill it by hand.</p>
				<dl>
					{#each data.mergeFields as field (field.key)}
						<dt><code>{`{{ ${field.key} }}`}</code></dt>
						<dd>{field.label}</dd>
					{/each}
				</dl>
			</details>
			<div><button class="button" type="submit">Make the saved reply</button></div>
		</form>
	</section>

	<section class="card" id="undo" aria-labelledby="undo-heading">
		<h2 id="undo-heading"><Undo2 size={20} aria-hidden="true" />Undo send</h2>
		<p class="small muted">After Send, a message waits this long before it goes, with an Undo button on the conversation. A message scheduled for later can be cancelled until its time.</p>
		{@render message('undo')}
		<form method="post" action="?/undo" class="stack">
			<fieldset class="choices">
				<legend class="visually-hidden">How long mail waits before it goes</legend>
				{#each data.undoChoices as seconds (seconds)}
					<label class="choice"><input type="radio" name="seconds" value={seconds} checked={seconds === data.undoSeconds} />{seconds === 0 ? 'Send at once' : `${seconds} seconds`}</label>
				{/each}
			</fieldset>
			<div><button class="button button-quiet" type="submit">Save</button></div>
		</form>
	</section>

	<section class="card" id="away" aria-labelledby="away-heading">
		<h2 id="away-heading"><CalendarOff size={20} aria-hidden="true" />Away message</h2>
		<p class="small muted">
			An answer sent by itself while nobody is reading the inbox, once to each person who writes. It is never sent to Spam, to automatic replies, to mailing lists, or to addresses on the do-not-email list.
		</p>
		{@render message('away')}
		{#if data.away.on}
			<p class="status-pill small" class:live={data.awayAnswering}>{data.awayAnswering ? 'On now' : 'On, outside its dates'}</p>
		{/if}
		<form method="post" action="?/away" class="stack">
			<input type="hidden" name="zone" value={zone} />
			<label class="choice"><input type="checkbox" name="on" value="yes" checked={data.away.on} />Send the away message</label>
			<div class="dates">
				<div class="field">
					<label for="away-from">Starting <span class="hint">optional, your time</span></label>
					<DateTimeField id="away-from" name="from" bind:value={awayTimes.from} defaultTime="00:00" hint="" />
				</div>
				<div class="field">
					<label for="away-until">Ending <span class="hint">optional, your time</span></label>
					<DateTimeField id="away-until" name="until" bind:value={awayTimes.until} defaultTime="23:59" hint="" />
				</div>
			</div>
			<div class="field">
				<label for="away-subject">Subject <span class="hint">optional; “Re:” and their subject when empty</span></label>
				<input type="text" id="away-subject" name="subject" maxlength="200" value={data.away.subject} />
			</div>
			<div class="field">
				<label for="away-text">Message</label>
				<textarea id="away-text" name="text" rows="6" placeholder="Thank you for writing. The project team is away until Monday, December 1, and will answer then.">{data.away.text}</textarea>
			</div>
			<p class="small muted">The signature of the address it was sent to is added below.</p>
			<div><button class="button" type="submit">Save the away message</button></div>
		</form>
	</section>

	<section class="card" id="blocked" aria-labelledby="blocked-heading">
		<h2 id="blocked-heading"><Ban size={20} aria-hidden="true" />Blocked senders</h2>
		<p class="small muted">Mail from these goes straight to Spam, in a conversation of its own, with no notice and no away message. Nothing tells the sender. You can also block from a conversation’s Sender card.</p>
		{@render message('blocked')}
		{#if data.blocked.length}
			<ul class="blocked-list">
				{#each data.blocked as blocked (blocked.pattern)}
					<li>
						<span class="what">
							<strong class="break">{blocked.pattern}</strong>
							<span class="small muted">{blocked.pattern.startsWith('@') ? 'Everyone at this domain' : 'This address'} · {fullDate(blocked.blockedAt)}{#if blocked.blockedByName}{' '}by {blocked.blockedByName}{/if}{#if blocked.note}{' '}· {blocked.note}{/if}</span>
						</span>
						<form method="post" action="?/unblock">
							<input type="hidden" name="pattern" value={blocked.pattern} />
							<button class="button button-quiet small" type="submit">Unblock</button>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">Nobody is blocked.</p>
		{/if}
		<form method="post" action="?/block" class="stack new">
			<div class="field">
				<label for="block-pattern">Address or domain</label>
				<input type="text" id="block-pattern" name="pattern" required placeholder="someone@example.com or @example.com" autocomplete="off" />
			</div>
			<div class="field">
				<label for="block-note">Why <span class="hint">optional, for the team</span></label>
				<input type="text" id="block-note" name="note" maxlength="300" />
			</div>
			<div><button class="button button-quiet" type="submit">Block</button></div>
		</form>
	</section>
</div>

<style>
	.columns {
		display: grid;
		gap: var(--space-5);
	}
	@media (min-width: 110rem) {
		.columns {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
	}
	@media (min-width: 110rem) {
		.wide {
			grid-column: 1 / -1;
		}
	}
	.card {
		min-width: 0;
		padding: var(--space-4) var(--space-5);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
	}
	.card h2,
	.card h3 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: 0;
	}
	.card h3 {
		font-size: var(--font-size-body);
	}
	.stack {
		display: grid;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
	}
	.stack .field {
		margin: 0;
	}
	textarea {
		width: 100%;
		font: inherit;
		line-height: var(--font-line-height-reading);
	}
	.replies {
		list-style: none;
		margin: 0 0 var(--space-3);
		padding: 0;
	}
	.replies li {
		border-bottom: 1px solid var(--color-line);
		padding-block: var(--space-2);
	}
	.replies summary {
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.replies form {
		margin: var(--space-3) 0 0;
	}
	.row-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.row-buttons .button {
		gap: var(--space-1);
	}
	.new {
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}
	.fields-help summary {
		cursor: pointer;
		color: var(--color-link);
	}
	.fields-help dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-1) var(--space-3);
		margin: var(--space-2) 0 0;
	}
	.fields-help dd {
		margin: 0;
	}
	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		border: 0;
		margin: 0;
		padding: 0;
	}
	.choice {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--layout-target-minimum);
	}
	.dates {
		display: grid;
		gap: var(--space-3);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 21rem), 1fr));
	}
	.hint {
		font-weight: var(--font-weight-regular);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}
	.blocked-list {
		list-style: none;
		margin: 0 0 var(--space-3);
		padding: 0;
	}
	.blocked-list li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding-block: var(--space-2);
		border-bottom: 1px solid var(--color-line);
	}
	.blocked-list .what {
		flex: 1;
		min-width: 0;
		display: grid;
	}
	.break {
		overflow-wrap: anywhere;
	}
	.inbox-list,
	.members {
		list-style: none;
		margin: 0 0 var(--space-3);
		padding: 0;
	}
	.inbox-list > li {
		padding-block: var(--space-3);
		border-bottom: 1px solid var(--color-line);
	}
	.inbox-list > li:last-child {
		border-bottom: 0;
	}
	.inbox-list p {
		margin: var(--space-1) 0;
	}
	.inbox-head {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.inbox-head .what {
		display: grid;
		flex: 1;
		min-width: 12rem;
	}
	.tag {
		padding: 0.1em 0.7em;
		border-radius: 999px;
		background: var(--color-surface);
		color: var(--color-ink-muted);
	}
	.tag-strong {
		background: var(--color-link);
		color: var(--color-paper);
	}
	.members {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-2);
		margin: 0 0 var(--space-2);
	}
	.members li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding-inline-start: var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: 999px;
		min-height: var(--layout-target-minimum);
	}
	.members li > span:only-child {
		padding-inline-end: var(--space-2);
	}
	.members form {
		display: contents;
	}
	.icon-button {
		display: inline-grid;
		place-items: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--color-ink-muted);
		cursor: pointer;
	}
	.icon-button:hover {
		color: var(--color-ink);
		background: var(--color-surface);
	}
	.inline-form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-2);
	}
	.inline-form .button,
	.row-buttons .button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
	.more {
		margin-top: var(--space-2);
	}
	.more summary {
		cursor: pointer;
		color: var(--color-link);
		margin-bottom: var(--space-2);
	}
	.address-field {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.address-field input {
		flex: 1;
		min-width: 0;
	}
	.status-pill {
		display: inline-block;
		margin: 0 0 var(--space-3);
		padding: 0.1em 0.7em;
		border-radius: 999px;
		background: var(--color-surface);
		color: var(--color-ink-muted);
	}
	.status-pill.live {
		background: var(--color-link);
		color: var(--color-paper);
	}
	@media (max-width: 40rem) {
		.fields-help dl {
			grid-template-columns: 1fr;
		}
	}
</style>
