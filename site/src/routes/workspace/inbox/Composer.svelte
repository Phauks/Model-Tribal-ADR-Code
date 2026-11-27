<script lang="ts">
	// The box for writing mail, shared by a new message, a reply, a reply to
	// all and a forward (site/MAIL.md): address rows, the message, and a bar
	// with Send, attach, saved replies, and "send later" or "remind me". The
	// signature of the From address starts below the message. It works
	// without scripts; with them, Cc and Bcc fold away, chosen files are
	// listed, saved replies can be put in, and what is written is saved as a
	// draft a moment after each change. Files too big to attach (over 18 MB
	// together) are sent up in pieces and go as download links instead
	// (site/MAIL.md, "Big files as links"); that needs scripts.
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import Check from '@lucide/svelte/icons/check';
	import Clock from '@lucide/svelte/icons/clock';
	import MessageSquareText from '@lucide/svelte/icons/message-square-text';
	import Link2 from '@lucide/svelte/icons/link-2';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import X from '@lucide/svelte/icons/x';
	import SendIcon from '@lucide/svelte/icons/send';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { attachmentLimitBytes, fillTemplate, parseAddressList, signatureBlock, type MergeValues } from '#lib/mail.ts';
	import { readableSize } from '#lib/uploads.ts';
	import { localInputValue } from './dates.ts';
	import DateTimeField from '#lib/components/DateTimeField.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';

	let {
		action,
		addresses,
		from,
		to = '',
		cc: startingCc = '',
		bcc: startingBcc = '',
		subject = '',
		text = '',
		quote = '',
		suggestions = [],
		discard = null,
		idPrefix,
		mode = null,
		message: answering = null,
		forwarded = [],
		focus = false,
		draft = null,
		thread = null,
		signed = false,
		signatures = {},
		savedReplies = [],
		mergeValues = {},
		senderName = '',
		manageLink = null
	}: {
		action: string;
		addresses: readonly string[];
		from: string;
		to?: string;
		cc?: string;
		bcc?: string;
		subject?: string;
		text?: string;
		/** The message being answered, quoted, which the writer can leave out. */
		quote?: string;
		suggestions?: { email: string; label: string }[];
		/** Where "Discard" goes, or null for no Discard. */
		discard?: string | null;
		idPrefix: string;
		/** In a conversation: reply, reply to all, or forward, and the message it answers. */
		mode?: 'reply' | 'all' | 'forward' | null;
		message?: string | null;
		/** A forwarded message's attachments, each sent along unless unticked. */
		forwarded?: { identifier: string; filename: string; size: number; held?: boolean; label?: string | null }[];
		/** Put the cursor in the box when the page opens, after a Reply, Reply all or Forward button. */
		focus?: boolean;
		/** The saved draft this box continues, if any. */
		draft?: string | null;
		/** The conversation a reply's draft belongs to; null for a new message. */
		thread?: string | null;
		/** Whether the text already has its signature (a draft, or a message sent back after a problem). */
		signed?: boolean;
		/** The signature of each of the inbox's addresses. */
		signatures?: Record<string, string>;
		savedReplies?: { identifier: string; name: string; body: string }[];
		/** Merge fields by email address, for saved replies. */
		mergeValues?: Record<string, MergeValues>;
		senderName?: string;
		/** Where saved replies and signatures are set up, for someone who may. */
		manageLink?: string | null;
	} = $props();

	let ready = $state(false);
	let zone = $state('America/Denver');
	// The page keys the box on what it answers, so these start values are meant to be read once.
	const startingCopies = () => startingCc;
	const startingBlind = () => startingBcc;
	let showCopies = $state(startingCopies() !== '' || startingBlind() !== '');
	let quoted = $state(true);
	// Every box keeps what was typed in it as state: a box written as value={…} would be reset whenever another part of the form changes.
	const startingFields = () => ({ to, subject, from: from || addresses[0] || '' });
	let fields = $state(startingFields());
	// The text starts as what the page passed (a draft, or what was written before a problem), the From address's signature, and the quote; it is the writer's from then on.
	const startingText = () => (signed ? `${text}${quote}` : `${text}${signatureBlock(signatures[fields.from])}${quote}`);
	let message = $state(startingText());
	let cc = $state(startingCopies());
	let bcc = $state(startingBlind());
	let signedAs = $state(startingFields().from);
	let files = $state<string[]>([]);
	let sendAt = $state('');
	let remindAt = $state('');
	let toBox: HTMLInputElement | undefined = $state();
	let textBox: HTMLTextAreaElement | undefined = $state();
	onMount(() => {
		zone = Intl.DateTimeFormat().resolvedOptions().timeZone || zone;
		ready = true;
		if (!focus) return;
		// A forward starts with whom to send it to; a reply starts above the quote.
		if (mode === 'forward') toBox?.focus();
		else if (textBox) {
			textBox.focus();
			textBox.setSelectionRange(0, 0);
		}
	});
	const forwarding = $derived(mode === 'forward');
	const addressChoices = $derived(addresses.map((address) => ({ value: address, label: address })));

	/** When From changes, its signature takes the place of the one before. */
	function changeSignature(): void {
		const before = signatureBlock(signatures[signedAs]);
		const after = signatureBlock(signatures[fields.from]);
		signedAs = fields.from;
		if (before === after) return;
		if (before && message.includes(before)) {
			message = message.replace(before, after);
		} else if (after) {
			const withQuote = quote && message.endsWith(quote);
			message = withQuote ? `${message.slice(0, -quote.length)}${after}${quote}` : `${message}${after}`;
		}
	}

	// ----- Drafts that save themselves --------------------------------------
	const startingDraft = () => draft;
	let draftIdentifier = $state(startingDraft());
	let saving = $state<'idle' | 'waiting' | 'saving' | 'saved' | 'failed'>('idle');
	let savedAt = $state('');
	let sending = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function draftBody(): string {
		return JSON.stringify({
			identifier: draftIdentifier,
			thread,
			fields: { from: fields.from, to: fields.to, cc, bcc, subject: fields.subject, text: message, mode, message: answering }
		});
	}

	async function saveDraft(keepalive = false): Promise<void> {
		clearTimeout(timer);
		timer = undefined;
		if (sending) return;
		saving = 'saving';
		try {
			const response = await fetch('/workspace/inbox/drafts/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: draftBody(), keepalive });
			if (!response.ok) throw new Error(String(response.status));
			const saved = (await response.json()) as { identifier: string; updatedAt: string };
			const isNew = draftIdentifier !== saved.identifier;
			draftIdentifier = saved.identifier;
			// A new draft changes the Drafts count in the inbox's left column, which a saved draft does not otherwise reload.
			if (isNew) void invalidate('mail:counts');
			savedAt = new Date(saved.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
			if (!timer) saving = 'saved';
		} catch {
			saving = 'failed';
		}
	}

	/** Each change waits a moment, so a draft is saved once someone pauses rather than at every key. */
	function changed(): void {
		if (sending) return;
		clearTimeout(timer);
		saving = 'waiting';
		timer = setTimeout(() => void saveDraft(), 2000);
	}

	onMount(() => {
		// Leaving the page before the moment is up still saves what was written.
		const leave = () => {
			if (timer && !sending) void saveDraft(true);
		};
		window.addEventListener('pagehide', leave);
		return () => {
			window.removeEventListener('pagehide', leave);
			// Moving to another inbox page before the moment is up saves what was written too.
			if (timer && !sending) void saveDraft(true);
			clearTimeout(timer);
		};
	});

	async function discardDraft(): Promise<void> {
		sending = true;
		clearTimeout(timer);
		if (draftIdentifier) await fetch(`/workspace/inbox/drafts/save?identifier=${encodeURIComponent(draftIdentifier)}`, { method: 'DELETE' }).catch(() => undefined);
		window.location.href = discard ?? window.location.pathname;
	}

	// ----- Saved replies ------------------------------------------------------
	let repliesMenu: HTMLDetailsElement | undefined = $state();

	/** The merge fields for whoever the message is to: the address book's, else the name typed with the address. */
	function valuesForRecipient(): MergeValues {
		const first = parseAddressList(fields.to).addresses[0];
		const known = first ? mergeValues[first.email.toLowerCase()] : undefined;
		const name = first?.name ?? '';
		return { ...(name ? { 'contact.name': name, 'contact.greeting': name } : {}), ...known, 'sender.name': senderName };
	}

	/** Puts a saved reply where the cursor is, with the recipient's fields filled in; a field with no value stays visible to fill by hand. */
	function useSavedReply(body: string): void {
		const filled = fillTemplate(body, valuesForRecipient(), { keepMissing: true });
		const start = textBox?.selectionStart ?? 0;
		const end = textBox?.selectionEnd ?? start;
		message = `${message.slice(0, start)}${filled}${message.slice(end)}`;
		if (repliesMenu) repliesMenu.open = false;
		changed();
		requestAnimationFrame(() => {
			textBox?.focus();
			textBox?.setSelectionRange(start + filled.length, start + filled.length);
		});
	}

	// ----- Big files as links ----------------------------------------------
	interface LinkedFile {
		key: string;
		name: string;
		size: number;
		/** Set once the server has started the file. */
		identifier: string | null;
		/** 0 to 1. */
		progress: number;
		done: boolean;
		problem: string | null;
	}
	let links = $state<LinkedFile[]>([]);
	let waitNotice = $state(false);
	const sendingUp = $derived(links.some((file) => !file.done && !file.problem));

	/**
	 * Chosen files that fit go as attachments. When they add up to more than
	 * the limit, the biggest go as links until the rest fit, as webmail does.
	 */
	function chose(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const chosen = [...(input.files ?? [])];
		const attached: File[] = [];
		const linked: File[] = [];
		let total = chosen.reduce((sum, file) => sum + file.size, 0);
		for (const file of [...chosen].sort((a, b) => b.size - a.size)) {
			if (total > attachmentLimitBytes) {
				linked.push(file);
				total -= file.size;
			} else attached.push(file);
		}
		if (linked.length && typeof DataTransfer !== 'undefined') {
			const kept = new DataTransfer();
			for (const file of chosen) if (attached.includes(file)) kept.items.add(file);
			input.files = kept.files;
			for (const file of linked) void sendUp(file);
		}
		files = [...(input.files ?? [])].map((file) => file.name);
	}

	/** Sends a file up in pieces, picking up where it stopped if it was started before. */
	async function sendUp(file: File): Promise<void> {
		const key = crypto.randomUUID();
		links = [...links, { key, name: file.name, size: file.size, identifier: null, progress: 0, done: false, problem: null }];
		const update = (change: Partial<LinkedFile>) => {
			links = links.map((item) => (item.key === key ? { ...item, ...change } : item));
		};
		const answer = async (response: Response) => {
			if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? `The server answered ${response.status}.`);
			return response.json();
		};
		try {
			const started = (await answer(
				await fetch('/workspace/inbox/links', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: file.name, size: file.size, type: file.type }) })
			)) as { identifier: string; pieceBytes: number; pieceCount: number; received: number[] };
			update({ identifier: started.identifier });
			const received = new Set(started.received);
			for (let number = 1; number <= started.pieceCount; number += 1) {
				if (!links.some((item) => item.key === key)) return;
				if (!received.has(number)) {
					const piece = file.slice((number - 1) * started.pieceBytes, number * started.pieceBytes);
					await answer(await fetch(`/workspace/inbox/links/${started.identifier}/${number}`, { method: 'PUT', body: piece }));
				}
				update({ progress: number / started.pieceCount });
			}
			await answer(await fetch(`/workspace/inbox/links/${started.identifier}`, { method: 'POST' }));
			update({ done: true, progress: 1 });
			waitNotice = false;
		} catch (problem) {
			update({ problem: problem instanceof Error ? problem.message : 'It could not be sent up.' });
		}
	}

	async function removeLink(item: LinkedFile): Promise<void> {
		links = links.filter((other) => other.key !== item.key);
		if (item.identifier) await fetch(`/workspace/inbox/links/${item.identifier}`, { method: 'DELETE' }).catch(() => undefined);
	}

	/** Tomorrow, or next Monday, at 8 in the morning, for the quick picks. */
	function morning(daysAhead: number | 'monday'): string {
		const now = new Date();
		const days = daysAhead === 'monday' ? ((8 - now.getDay()) % 7 || 7) : daysAhead;
		const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 8, 0);
		return localInputValue((at.getTime() - now.getTime()) / 3_600_000, now);
	}

	function toggleQuote(): void {
		if (!quoted && quote && message.endsWith(quote)) message = message.slice(0, -quote.length);
		else if (quoted && quote && !message.endsWith(quote)) message = `${message}${quote}`;
	}
</script>

<form
	method="post"
	{action}
	enctype="multipart/form-data"
	class="composer"
	oninput={changed}
	onsubmit={(event) => {
		if (sendingUp) {
			event.preventDefault();
			waitNotice = true;
			return;
		}
		sending = true;
		clearTimeout(timer);
	}}
>
	<input type="hidden" name="zone" value={zone} />
	{#if draftIdentifier}<input type="hidden" name="draft" value={draftIdentifier} />{/if}
	{#if mode}<input type="hidden" name="mode" value={mode} />{/if}
	{#if answering}<input type="hidden" name="message" value={answering} />{/if}
	<div class="rows">
		<div class="row">
			{#if addresses.length > 1}
				<!-- The row's own word for the box; the box carries the same label for screen readers. -->
				<span class="row-label" aria-hidden="true">From</span>
				<Dropdown label="From" hideLabel id="{idPrefix}-from" name="from" choices={addressChoices} bind:value={fields.from} onchange={changeSignature} />
			{:else}
				<label for="{idPrefix}-from">From</label>
				<input type="text" id="{idPrefix}-from" name="from" value={fields.from} readonly />
			{/if}
		</div>
		<div class="row">
			<label for="{idPrefix}-to">To</label>
			<input type="text" id="{idPrefix}-to" name="to" bind:this={toBox} bind:value={fields.to} list="{idPrefix}-book" required autocomplete="off" placeholder="Name or address; commas between several" />
			{#if ready && !showCopies}
				<button type="button" class="link-button" onclick={() => (showCopies = true)}>Cc Bcc</button>
			{/if}
		</div>
		{#if showCopies || !ready}
			<div class="row">
				<label for="{idPrefix}-cc">Cc</label>
				<input type="text" id="{idPrefix}-cc" name="cc" bind:value={cc} list="{idPrefix}-book" autocomplete="off" />
			</div>
			<div class="row">
				<label for="{idPrefix}-bcc">Bcc</label>
				<input type="text" id="{idPrefix}-bcc" name="bcc" bind:value={bcc} list="{idPrefix}-book" autocomplete="off" />
			</div>
		{/if}
		<div class="row">
			<label for="{idPrefix}-subject">Subject</label>
			<input type="text" id="{idPrefix}-subject" name="subject" bind:value={fields.subject} required />
		</div>
	</div>
	{#if suggestions.length}
		<datalist id="{idPrefix}-book">
			{#each suggestions as suggestion (suggestion.email)}<option value={suggestion.email}>{suggestion.label}</option>{/each}
		</datalist>
	{/if}

	<label for="{idPrefix}-text" class="visually-hidden">Message</label>
	<textarea
		id="{idPrefix}-text"
		name="text"
		rows="12"
		required={!forwarding}
		placeholder={forwarding ? 'Add a note above the forwarded message (optional)' : 'Write your message'}
		bind:this={textBox}
		bind:value={message}
	></textarea>

	{#if forwarded.length}
		<fieldset class="forwarded small">
			<legend>Attachments of the forwarded message</legend>
			{#each forwarded as file (file.identifier)}
				{#if file.held}
					<span class="held"><Paperclip size={14} aria-hidden="true" />{file.filename} <span class="muted">({file.label}; it cannot go yet)</span></span>
				{:else}
					<label><input type="checkbox" name="forwardAttachment" value={file.identifier} checked /><Paperclip size={14} aria-hidden="true" />{file.filename}</label>
				{/if}
			{/each}
		</fieldset>
	{/if}
	{#if quote && !forwarding}
		<label class="option small"><input type="checkbox" bind:checked={quoted} onchange={toggleQuote} /> Quote the message</label>
	{/if}
	{#if files.length}
		<ul class="files small" aria-label="Attached files">
			{#each files as file (file)}<li><Paperclip size={14} aria-hidden="true" />{file}</li>{/each}
		</ul>
	{/if}
	{#if links.length}
		<div class="links small">
			<p class="muted">Too big to attach, so {links.length === 1 ? 'this goes' : 'these go'} as a download link in the message. A link works for 30 days, once the file passes the virus check.</p>
			<ul aria-label="Files sent as links">
				{#each links as item (item.key)}
					<li class:problem={item.problem}>
						<Link2 size={14} aria-hidden="true" />
						<span class="link-name">{item.name} <span class="muted">({readableSize(item.size)})</span></span>
						{#if item.problem}
							<span role="alert">{item.problem}</span>
						{:else if item.done}
							<span class="muted">Ready</span>
							<input type="hidden" name="links" value={item.identifier} />
						{:else}
							<progress max="1" value={item.progress} aria-label="Sending up {item.name}"></progress>
						{/if}
						<button type="button" class="remove" onclick={() => removeLink(item)} aria-label="Remove {item.name}" title="Remove"><X size={14} aria-hidden="true" /></button>
					</li>
				{/each}
			</ul>
			{#if waitNotice && sendingUp}<p role="alert" class="wait">Wait until the big files finish sending up, then send.</p>{/if}
		</div>
	{/if}
	{#if sendAt || remindAt}
		<p class="small timing">
			{#if sendAt}Goes {new Date(sendAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.{/if}
			{#if remindAt}Back in your inbox {new Date(remindAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} unless they reply first.{/if}
		</p>
	{/if}

	<div class="bar">
		<button class="button send" type="submit"><SendIcon size={18} aria-hidden="true" />{sendAt ? 'Schedule' : forwarding ? 'Forward' : 'Send'}</button>
		<label class="icon-button attach" title="Attach files">
			<Paperclip size={20} aria-hidden="true" />
			<span class="visually-hidden">Attach files</span>
			<input type="file" name="attachments" multiple onchange={chose} />
		</label>
		{#if ready}
			<details class="timing-menu replies-menu" bind:this={repliesMenu}>
				<summary class="icon-button" title="Put in a saved reply" aria-label="Put in a saved reply">
					<MessageSquareText size={20} aria-hidden="true" />
				</summary>
				<div class="popover">
					<p class="popover-title">Saved replies</p>
					{#if savedReplies.length}
						<ul class="reply-list">
							{#each savedReplies as reply (reply.identifier)}
								<li>
									<button type="button" class="reply-choice" onclick={() => useSavedReply(reply.body)}>
										<strong>{reply.name}</strong>
										<span class="small muted">{reply.body.replace(/\s+/g, ' ').slice(0, 90)}</span>
									</button>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="small muted">No saved replies yet.</p>
					{/if}
					{#if manageLink}<p class="small"><a href={manageLink}>Make and change saved replies</a></p>{/if}
				</div>
			</details>
		{/if}
		<details class="timing-menu">
			<summary class="icon-button" title="Send later, or remind me" aria-label="Send later, or remind me">
				<Clock size={20} aria-hidden="true" />
			</summary>
			<div class="popover">
				<div class="field">
					<label for="{idPrefix}-later">Send later <span class="hint">your time</span></label>
					<DateTimeField id="{idPrefix}-later" name="sendAt" bind:value={sendAt} defaultTime="08:00" hint="" />
					{#if ready}
						<span class="quick">
							<button type="button" class="link-button" onclick={() => (sendAt = morning(1))}>Tomorrow 8 AM</button>
							<button type="button" class="link-button" onclick={() => (sendAt = morning('monday'))}>Monday 8 AM</button>
							{#if sendAt}<button type="button" class="link-button" onclick={() => (sendAt = '')}>Send now</button>{/if}
						</span>
					{/if}
				</div>
				<div class="field">
					<label for="{idPrefix}-remind">Remind me <span class="hint">unless they reply first</span></label>
					<DateTimeField id="{idPrefix}-remind" name="remindAt" bind:value={remindAt} defaultTime="08:00" hint="" />
					{#if ready}
						<span class="quick">
							<button type="button" class="link-button" onclick={() => (remindAt = morning(3))}>In 3 days</button>
							<button type="button" class="link-button" onclick={() => (remindAt = morning(7))}>In a week</button>
							{#if remindAt}<button type="button" class="link-button" onclick={() => (remindAt = '')}>No reminder</button>{/if}
						</span>
					{/if}
				</div>
			</div>
		</details>
		<span class="draft-state small muted" role="status">
			{#if saving === 'saving' || saving === 'waiting'}Saving…{:else if saving === 'saved'}<Check size={14} aria-hidden="true" />Draft saved {savedAt}{:else if saving === 'failed'}Draft not saved{/if}
		</span>
		{#if ready && draftIdentifier}
			<button type="button" class="icon-button discard" title="Discard the draft" aria-label="Discard the draft" onclick={discardDraft}><Trash2 size={20} aria-hidden="true" /></button>
		{:else if discard}
			<a class="icon-button discard" href={discard} title="Discard" aria-label="Discard"><Trash2 size={20} aria-hidden="true" /></a>
		{/if}
	</div>
</form>

<style>
	.composer {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--color-ink) 8%, transparent);
	}
	.rows {
		padding: 0 var(--space-4);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		border-bottom: 1px solid var(--color-line);
	}
	.row label,
	.row-label {
		flex: none;
		width: 4rem;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}
	.row input {
		flex: 1;
		min-width: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		padding-inline: 0;
	}
	.row input:focus {
		outline: none;
	}
	/* The From box sits in its row as the other boxes do: no border of its own, the row's line marks it. */
	.row :global(.dropdown) {
		flex: 1;
		min-width: 0;
		margin: 0;
	}
	.row :global(.dropdown-control) {
		width: 100%;
	}
	.row :global(.dropdown-button) {
		border: 0;
		border-radius: 0;
		background: transparent;
		padding-inline: 0;
	}
	.row :global(.dropdown-button:focus) {
		outline: none;
	}
	.row:focus-within {
		box-shadow: inset 0 -2px 0 var(--color-link);
	}
	.row input[readonly] {
		color: var(--color-ink-muted);
	}
	textarea {
		display: block;
		width: 100%;
		min-height: 14rem;
		border: 0;
		border-radius: 0;
		background: transparent;
		/* Its own ink, so the site's focus style (dark text meant for the yellow fill) does not turn the words dark on this clear background in dark mode. */
		color: var(--color-ink);
		padding: var(--space-4);
		resize: vertical;
		line-height: var(--font-line-height-reading);
	}
	textarea:focus {
		outline: none;
		box-shadow: inset 0 0 0 2px var(--color-link);
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
	.option {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-4);
	}
	.forwarded {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-3);
		margin: var(--space-2) var(--space-4) 0;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
	}
	.forwarded legend {
		padding: 0 var(--space-1);
		color: var(--color-ink-muted);
	}
	.forwarded .held {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
	.forwarded label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
	.files {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: var(--space-2) 0 0;
		padding: 0 var(--space-4);
	}
	.files li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0.1em 0.6em;
		border-radius: 999px;
		background: var(--color-surface);
	}
	.links {
		margin: var(--space-2) var(--space-4) 0;
	}
	.links p {
		margin: 0 0 var(--space-1);
	}
	.links ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-1);
	}
	.links li {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: 0.1em 0.2em 0.1em 0.6em;
		border-radius: var(--radius-control);
		background: var(--color-surface);
	}
	.links li.problem {
		color: var(--color-danger);
	}
	.link-name {
		flex: 1;
		min-width: 10rem;
		overflow-wrap: anywhere;
	}
	.links progress {
		width: 8rem;
		accent-color: var(--color-link);
	}
	.links .remove {
		display: inline-grid;
		place-items: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		border: 0;
		background: none;
		color: var(--color-ink-muted);
		cursor: pointer;
	}
	.links .wait {
		margin-top: var(--space-1);
		color: var(--color-link);
	}
	.timing {
		margin: var(--space-2) var(--space-4) 0;
		color: var(--color-link);
	}
	.bar {
		/* The send-later box opens above the bar, from its left edge, so it stays on a phone's screen. */
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
	}
	.send {
		gap: var(--space-2);
		border-radius: 999px;
		padding-inline: var(--space-5);
	}
	.attach {
		position: relative;
	}
	.attach:focus-within {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.attach input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		width: 100%;
	}

	.timing-menu > summary {
		list-style: none;
	}
	.timing-menu > summary::-webkit-details-marker {
		display: none;
	}
	.timing-menu[open] > summary {
		background: var(--color-surface);
	}
	.popover {
		position: absolute;
		bottom: calc(100% - var(--space-2));
		left: var(--space-4);
		z-index: 5;
		width: min(var(--layout-popover), 80vw);
		padding: var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		box-shadow: 0 6px 24px color-mix(in srgb, var(--color-ink) 18%, transparent);
	}
	.popover .field:last-child {
		margin-bottom: 0;
	}
	.hint {
		font-weight: var(--font-weight-regular);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}
	.quick {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.draft-state {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin-left: auto;
		min-width: 0;
		white-space: nowrap;
	}
	.discard {
		color: var(--color-ink-muted);
	}
	.popover-title {
		margin: 0 0 var(--space-2);
		font-weight: var(--font-weight-bold);
	}
	.reply-list {
		list-style: none;
		margin: 0 0 var(--space-2);
		padding: 0;
		max-height: 18rem;
		overflow-y: auto;
	}
	.reply-choice {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.1em;
		width: 100%;
		border: 0;
		border-radius: var(--radius-control);
		background: none;
		color: var(--color-ink);
		font: inherit;
		text-align: left;
		padding: var(--space-2);
		cursor: pointer;
	}
	.reply-choice:hover,
	.reply-choice:focus-visible {
		background: var(--color-surface);
	}
</style>
