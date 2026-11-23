<script lang="ts">
	// Settings for writing mail (site/MAIL.md, "Writing"): signatures, saved
	// replies, the pause before mail goes, and the away message.
	import { onMount } from 'svelte';
	import CalendarOff from '@lucide/svelte/icons/calendar-off';
	import MessageSquareText from '@lucide/svelte/icons/message-square-text';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { fullDate } from '../dates.ts';
	import type { PageProps } from './$types';

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

	function notice(section: string): { problem?: string; done?: string } | null {
		return form && 'section' in form && form.section === section ? (form as { problem?: string; done?: string }) : null;
	}
</script>

<svelte:head>
	<title>Inbox settings · Inbox · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Inbox settings</h1>
<p class="lead">How mail from the project inbox is written: a signature for each address, replies you give often, a pause to take a message back, and an away message. These are shared by everyone who answers the inbox.</p>

{#snippet message(section: string)}
	{@const shown = notice(section)}
	{#if shown?.problem}
		<div class="notice notice-problem" role="alert"><p>{shown.problem}</p></div>
	{:else if shown?.done}
		<div class="notice" role="status"><p>{shown.done}</p></div>
	{/if}
{/snippet}

<div class="columns">
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
					<input type="datetime-local" id="away-from" name="from" bind:value={awayTimes.from} />
				</div>
				<div class="field">
					<label for="away-until">Ending <span class="hint">optional, your time</span></label>
					<input type="datetime-local" id="away-until" name="until" bind:value={awayTimes.until} />
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
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
	}
	.dates input {
		width: 100%;
		font: inherit;
		min-height: var(--layout-target-minimum);
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		padding: 0 var(--space-2);
	}
	.hint {
		font-weight: var(--font-weight-regular);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
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
