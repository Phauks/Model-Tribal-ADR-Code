<script lang="ts">
	// The box for writing mail, shared by a new message and a reply
	// (site/MAIL.md): address rows, the message, and a bar with Send, attach,
	// and "send later" or "remind me if no reply". It works without scripts;
	// with them, Cc and Bcc fold away and chosen files are listed.
	import { onMount } from 'svelte';
	import Clock from '@lucide/svelte/icons/clock';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import SendIcon from '@lucide/svelte/icons/send';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { localInputValue } from './dates.ts';

	let {
		action,
		addresses,
		from,
		to = '',
		subject = '',
		text = '',
		quote = '',
		suggestions = [],
		discard = null,
		idPrefix
	}: {
		action: string;
		addresses: readonly string[];
		from: string;
		to?: string;
		subject?: string;
		text?: string;
		/** The last message, quoted, which the writer can leave out. */
		quote?: string;
		suggestions?: { email: string; label: string }[];
		/** Where "Discard" goes, or null for no Discard. */
		discard?: string | null;
		idPrefix: string;
	} = $props();

	let ready = $state(false);
	let zone = $state('America/Denver');
	let showCopies = $state(false);
	let quoted = $state(true);
	// The text starts as what the page passed (a draft kept after a problem, plus the quote) and is the writer's from then on.
	const startingText = () => `${text}${quote}`;
	let message = $state(startingText());
	let files = $state<string[]>([]);
	let sendAt = $state('');
	let followUpAt = $state('');
	onMount(() => {
		zone = Intl.DateTimeFormat().resolvedOptions().timeZone || zone;
		ready = true;
	});

	function chose(event: Event): void {
		files = [...((event.currentTarget as HTMLInputElement).files ?? [])].map((file) => file.name);
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

<form method="post" {action} enctype="multipart/form-data" class="composer">
	<input type="hidden" name="zone" value={zone} />
	<div class="rows">
		<div class="row">
			<label for="{idPrefix}-from">From</label>
			{#if addresses.length > 1}
				<select id="{idPrefix}-from" name="from">
					{#each addresses as address (address)}<option value={address} selected={address === from}>{address}</option>{/each}
				</select>
			{:else}
				<input type="text" id="{idPrefix}-from" name="from" value={from || addresses[0] || ''} readonly />
			{/if}
		</div>
		<div class="row">
			<label for="{idPrefix}-to">To</label>
			<input type="text" id="{idPrefix}-to" name="to" value={to} list="{idPrefix}-book" required autocomplete="off" placeholder="Name or address; commas between several" />
			{#if ready && !showCopies}
				<button type="button" class="link-button" onclick={() => (showCopies = true)}>Cc Bcc</button>
			{/if}
		</div>
		{#if showCopies || !ready}
			<div class="row">
				<label for="{idPrefix}-cc">Cc</label>
				<input type="text" id="{idPrefix}-cc" name="cc" list="{idPrefix}-book" autocomplete="off" />
			</div>
			<div class="row">
				<label for="{idPrefix}-bcc">Bcc</label>
				<input type="text" id="{idPrefix}-bcc" name="bcc" list="{idPrefix}-book" autocomplete="off" />
			</div>
		{/if}
		<div class="row">
			<label for="{idPrefix}-subject">Subject</label>
			<input type="text" id="{idPrefix}-subject" name="subject" value={subject} required />
		</div>
	</div>
	{#if suggestions.length}
		<datalist id="{idPrefix}-book">
			{#each suggestions as suggestion (suggestion.email)}<option value={suggestion.email}>{suggestion.label}</option>{/each}
		</datalist>
	{/if}

	<label for="{idPrefix}-text" class="visually-hidden">Message</label>
	<textarea id="{idPrefix}-text" name="text" rows="12" required placeholder="Write your message" bind:value={message}></textarea>

	{#if quote}
		<label class="option small"><input type="checkbox" bind:checked={quoted} onchange={toggleQuote} /> Quote the last message</label>
	{/if}
	{#if files.length}
		<ul class="files small" aria-label="Attached files">
			{#each files as file (file)}<li><Paperclip size={14} aria-hidden="true" />{file}</li>{/each}
		</ul>
	{/if}
	{#if sendAt || followUpAt}
		<p class="small timing">
			{#if sendAt}Goes {new Date(sendAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.{/if}
			{#if followUpAt}Reminder {new Date(followUpAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} if no reply.{/if}
		</p>
	{/if}

	<div class="bar">
		<button class="button send" type="submit"><SendIcon size={18} aria-hidden="true" />{sendAt ? 'Schedule' : 'Send'}</button>
		<label class="icon-button attach" title="Attach files">
			<Paperclip size={20} aria-hidden="true" />
			<span class="visually-hidden">Attach files</span>
			<input type="file" name="attachments" multiple onchange={chose} />
		</label>
		<details class="timing-menu">
			<summary class="icon-button" title="Send later, or be reminded if no reply" aria-label="Send later, or be reminded if no reply">
				<Clock size={20} aria-hidden="true" />
			</summary>
			<div class="popover">
				<div class="field">
					<label for="{idPrefix}-later">Send later <span class="hint">your time</span></label>
					<input id="{idPrefix}-later" type="datetime-local" name="sendAt" bind:value={sendAt} />
					{#if ready}
						<span class="quick">
							<button type="button" class="link-button" onclick={() => (sendAt = morning(1))}>Tomorrow 8 AM</button>
							<button type="button" class="link-button" onclick={() => (sendAt = morning('monday'))}>Monday 8 AM</button>
							{#if sendAt}<button type="button" class="link-button" onclick={() => (sendAt = '')}>Send now</button>{/if}
						</span>
					{/if}
				</div>
				<div class="field">
					<label for="{idPrefix}-follow">Remind me if no reply by</label>
					<input id="{idPrefix}-follow" type="datetime-local" name="followUpAt" bind:value={followUpAt} />
					{#if ready}
						<span class="quick">
							<button type="button" class="link-button" onclick={() => (followUpAt = morning(3))}>In 3 days</button>
							<button type="button" class="link-button" onclick={() => (followUpAt = morning(7))}>In a week</button>
							{#if followUpAt}<button type="button" class="link-button" onclick={() => (followUpAt = '')}>No reminder</button>{/if}
						</span>
					{/if}
				</div>
			</div>
		</details>
		{#if discard}
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
	.row label {
		flex: none;
		width: 4rem;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}
	.row input,
	.row select {
		flex: 1;
		min-width: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		padding-inline: 0;
	}
	.row input:focus,
	.row select:focus {
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
	.timing {
		margin: var(--space-2) var(--space-4) 0;
		color: var(--color-link);
	}
	.bar {
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
		outline: 3px solid var(--color-focus-ring);
		background: var(--color-focus);
	}
	.attach input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		width: 100%;
	}
	.timing-menu {
		position: relative;
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
		bottom: calc(100% + var(--space-2));
		left: 0;
		z-index: 5;
		width: min(22rem, 80vw);
		padding: var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		box-shadow: 0 6px 24px color-mix(in srgb, var(--color-ink) 18%, transparent);
	}
	.popover .field:last-child {
		margin-bottom: 0;
	}
	.popover input[type='datetime-local'] {
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
	.quick {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.discard {
		margin-left: auto;
		color: var(--color-ink-muted);
	}
</style>
