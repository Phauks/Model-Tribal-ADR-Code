<script lang="ts">
	// One outreach batch (design/outreach-redesign, approved by Trevor on Nov. 27, 2026): its name with where it stands and buttons to pause or start, copy, and more; a line of what it sends and how fast; chips for each kind of recipient; a toolbar for the ticked ones with Add at its end, which opens a line for adding from the address book or by address; and the recipients as the inbox lists conversations, each with a mark for where its letter stands.
	import { onMount, type Component } from 'svelte';
	import BellRing from '@lucide/svelte/icons/bell-ring';
	import Ban from '@lucide/svelte/icons/ban';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Clock from '@lucide/svelte/icons/clock';
	import Copy from '@lucide/svelte/icons/copy';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import FileText from '@lucide/svelte/icons/file-text';
	import Gauge from '@lucide/svelte/icons/gauge';
	import MessagesSquare from '@lucide/svelte/icons/messages-square';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import Plus from '@lucide/svelte/icons/plus';
	import Reply from '@lucide/svelte/icons/reply';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import Send from '@lucide/svelte/icons/send';
	import Tag from '@lucide/svelte/icons/tag';
	import UserMinus from '@lucide/svelte/icons/user-minus';
	import UserX from '@lucide/svelte/icons/user-x';
	import Users from '@lucide/svelte/icons/users';
	import X from '@lucide/svelte/icons/x';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import { deliveryLabels, tagColors } from '#lib/mail.ts';
	import Avatar from '../../inbox/Avatar.svelte';
	import TagChip from '../../inbox/TagChip.svelte';
	import { listDate } from '../../inbox/dates.ts';
	import { outreachBase as base } from '../views.ts';
	import { whenWords } from '../when.ts';
	import { recipientViews } from './recipient-views.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const batch = $derived(data.batch);
	const open = $derived(batch.status !== 'done' && batch.status !== 'cancelled');

	const stages: Record<string, { label: string; icon: Component }> = {
		sending: { label: 'Sending', icon: Send },
		scheduled: { label: 'Scheduled', icon: CalendarClock },
		paused: { label: 'Paused', icon: Pause },
		done: { label: 'Finished', icon: CircleCheck },
		cancelled: { label: 'Cancelled', icon: CircleX },
		draft: { label: 'Draft', icon: FileText }
	};
	const stage = $derived(stages[batch.stage] ?? stages.sending);

	function hour(value: number): string {
		if (value === 0 || value === 24) return '12 AM';
		if (value === 12) return '12 PM';
		return value < 12 ? `${value} AM` : `${value - 12} PM`;
	}

	function viewLink(key: string): string {
		return key === 'all' ? `${base}/${batch.identifier}` : `${base}/${batch.identifier}?show=${key}`;
	}

	let selected = $state<string[]>([]);
	let ready = $state(false);
	// svelte-ignore state_referenced_locally
	let adding = $state(form !== null && 'adding' in (form ?? {}));
	let renaming = $state(false);
	let addTag = $state('');
	let addFrom = $state<'linked' | 'any'>('linked');
	onMount(() => (ready = true));
	const none = $derived(ready && selected.length === 0);
	const allTicked = $derived(data.recipients.length > 0 && selected.length === data.recipients.length);
	const tickedStatuses = $derived(new Set(data.recipients.filter((recipient) => selected.includes(recipient.identifier)).map((recipient) => recipient.status)));
	const canRemove = $derived(!ready || tickedStatuses.has('queued') || tickedStatuses.has('skipped'));
	const canRetry = $derived(!ready || tickedStatuses.has('failed'));

	function tickAll(event: Event): void {
		selected = (event.currentTarget as HTMLInputElement).checked ? data.recipients.map((recipient) => recipient.identifier) : [];
	}

	const tagChoices = $derived([{ value: '', label: 'Any tag' }, ...data.tags.map((tag) => ({ value: tag, label: tag }))]);
	const fromChoices = [
		{ value: 'linked', label: 'From the address book' },
		{ value: 'any', label: 'Every contact in the address book' }
	];

	type Recipient = (typeof data.recipients)[number];
	function statusOf(recipient: Recipient): { text: string; tone: '' | 'link' | 'warning'; icon: Component } {
		switch (recipient.status) {
			case 'replied':
				return { text: `Replied ${listDate(recipient.repliedAt ?? recipient.sentAt ?? '')}`, tone: 'link', icon: Reply };
			case 'sent': {
				const delivery = recipient.deliveryStatus === 'delivered' ? ' · delivered' : recipient.deliveryStatus ? ` · ${deliveryLabels[recipient.deliveryStatus]?.toLowerCase() ?? recipient.deliveryStatus}` : '';
				return { text: `Sent ${recipient.sentAt ? listDate(recipient.sentAt) : ''}${delivery}${recipient.acknowledgedAt ? ' · said they got it' : ''}`, tone: '', icon: Check };
			}
			case 'bounced':
				return { text: `Bounced${recipient.sentAt ? ` ${listDate(recipient.sentAt)}` : ''}`, tone: 'warning', icon: CircleAlert };
			case 'failed':
				return { text: `Could not be sent${recipient.error ? `: ${recipient.error}` : ''}`, tone: 'warning', icon: CircleAlert };
			case 'unsubscribed':
				return { text: recipient.skipReason ?? 'Asked not to be written to', tone: '', icon: Ban };
			case 'skipped':
				return { text: `Left out${recipient.skipReason ? `: ${recipient.skipReason}` : ''}`, tone: '', icon: UserX };
			default:
				return { text: recipient.next ? `Waiting · ${whenWords(recipient.next)}` : 'Waiting', tone: '', icon: Clock };
		}
	}
</script>

<svelte:head>
	<title>{batch.name} · Outreach · Workspace · Tribal Law Project</title>
</svelte:head>

<div class="title-line">
	{#if renaming}
		<form method="post" action="?/rename" class="rename">
			<label for="batch-name" class="visually-hidden">The batch’s name</label>
			<input type="text" id="batch-name" name="name" value={batch.name} maxlength="120" required />
			<button class="button" type="submit">Save</button>
			<button class="button-quiet" type="button" onclick={() => (renaming = false)}>Cancel</button>
		</form>
	{:else}
		<h1>{batch.name}</h1>
	{/if}
	<span class="pill pill-{batch.stage}"><stage.icon size={14} aria-hidden="true" />{stage.label}</span>
	<span class="acts">
		{#if open}
			<form method="post" action="?/status">
				{#if batch.stage === 'sending' || batch.stage === 'scheduled'}
					<button class="icon-button" type="submit" name="status" value="paused" title="Pause" aria-label="Pause"><Pause size={20} aria-hidden="true" /></button>
				{:else}
					<button class="icon-button" type="submit" name="status" value="running" title={batch.stage === 'paused' ? 'Start again' : 'Start now'} aria-label={batch.stage === 'paused' ? 'Start again' : 'Start now'}><Play size={20} aria-hidden="true" /></button>
				{/if}
			</form>
		{/if}
		<form method="post" action="?/copy">
			<button class="icon-button" type="submit" title="Copy as a new batch" aria-label="Copy as a new batch"><Copy size={20} aria-hidden="true" /></button>
		</form>
		<details class="menu">
			<summary class="icon-button" title="More" aria-label="More"><Ellipsis size={20} aria-hidden="true" /></summary>
			<div class="popover">
				<button type="button" class="menu-item" onclick={(event) => { renaming = true; (event.currentTarget.closest('details') as HTMLDetailsElement).open = false; }}>Rename</button>
				{#if batch.stage === 'scheduled'}
					<form method="post" action="?/status"><button type="submit" class="menu-item" name="status" value="running">Start now</button></form>
				{/if}
				{#if open}
					<form method="post" action="?/status"><button type="submit" class="menu-item danger" name="status" value="cancelled">Cancel the batch</button></form>
				{/if}
			</div>
		</details>
	</span>
</div>
<p class="facts">
	{#if batch.templateName}<span><FileText size={14} aria-hidden="true" />{#if batch.templateIdentifier}<a href="{base}/templates/{batch.templateIdentifier}">{batch.templateName} (v{batch.templateVersion})</a>{:else}{batch.templateName}{/if}</span>{/if}
	{#if data.repliesTo}<span><Users size={14} aria-hidden="true" />Replies to {data.repliesTo}</span>{/if}
	{#if batch.stage === 'scheduled' && batch.startsAt}<span><CalendarClock size={14} aria-hidden="true" />Starts {whenWords(batch.startsAt)}</span>{/if}
	<span><Gauge size={14} aria-hidden="true" />At most {batch.perDay} a day, {batch.weekdaysOnly ? 'weekdays, ' : ''}{hour(batch.windowStartHour)} to {hour(batch.windowEndHour)} their time</span>
	<span><BellRing size={14} aria-hidden="true" />{batch.followUpDays ? `Follow up after ${batch.followUpDays} days` : 'No follow-up'}</span>
</p>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

<nav class="filter-chips" aria-label="Recipients">
	<ul>
		{#each recipientViews as view (view.key)}
			{#if view.always || data.viewCounts[view.key]}
				<li><a href={viewLink(view.key)} aria-current={data.show === view.key ? 'page' : undefined}>{view.label}<span class="chip-count">{data.viewCounts[view.key] ?? 0}</span></a></li>
			{/if}
		{/each}
	</ul>
</nav>

<form method="post" action="?/recipients" id="recipients-form">
	<div class="toolbar" role="toolbar" aria-label="Change the ticked recipients">
		<label class="tick-all" title="Tick every recipient shown">
			<input type="checkbox" checked={allTicked} indeterminate={selected.length > 0 && !allTicked} onchange={tickAll} disabled={data.recipients.length === 0} />
			<span class="visually-hidden">Tick every recipient shown</span>
		</label>
		{#if ready && selected.length > 0}<span class="small picked">{selected.length} ticked</span>{/if}
		<span class="tool-group">
			<button class="tool" type="submit" name="do" value="remove" disabled={none || !canRemove}><UserMinus size={18} aria-hidden="true" /><span>Remove</span></button>
			<button class="tool" type="submit" name="do" value="retry" disabled={none || !canRetry}><RotateCw size={18} aria-hidden="true" /><span>Try again</span></button>
			<button class="tool" type="submit" name="do" value="suppress" disabled={none}><Ban size={18} aria-hidden="true" /><span>Do not email</span></button>
		</span>
		{#if open}
			<button class="tool add" type="button" aria-expanded={adding} aria-controls="add-row" onclick={() => (adding = !adding)}><Plus size={18} aria-hidden="true" /><span>Add</span></button>
		{/if}
	</div>
</form>

{#if open && (adding || !ready)}
	<form method="post" action="?/add" class="add-row" id="add-row">
		<span class="chip-select"><Dropdown label="Add from" hideLabel id="add-from" name="nations" choices={fromChoices} bind:value={addFrom} /></span>
		<span class="chip-select"><Dropdown label="With the tag" hideLabel id="add-tag" name="tag" icon={Tag} choices={tagChoices} bind:value={addTag} /></span>
		<span class="muted small">or</span>
		<label for="add-email" class="visually-hidden">An email address</label>
		<input type="email" id="add-email" name="email" class="field-inline" placeholder="name@office.example" autocomplete="off" />
		<button type="submit" class="go" title="Add" aria-label="Add"><Check size={16} aria-hidden="true" /></button>
		{#if ready}<button type="button" class="stop" title="Close" aria-label="Close" onclick={() => (adding = false)}><X size={16} aria-hidden="true" /></button>{/if}
	</form>
{/if}

{#if data.recipients.length === 0}
	<p class="empty muted">{data.show === 'all' ? 'No recipients yet.' : 'None here.'}</p>
{:else}
	<ol class="threads">
		{#each data.recipients as recipient (recipient.identifier)}
			{@const status = statusOf(recipient)}
			<li class:unread={recipient.status === 'replied'} class:ticked={selected.includes(recipient.identifier)}>
				<label class="tick">
					<input type="checkbox" name="recipient" value={recipient.identifier} form="recipients-form" bind:group={selected} />
					<span class="visually-hidden">Tick {recipient.nationName ?? recipient.name}</span>
				</label>
				<svelte:element this={recipient.threadIdentifier ? 'a' : 'div'} class="row" href={recipient.threadIdentifier ? `/workspace/inbox/${recipient.threadIdentifier}` : undefined}>
					<Avatar name={recipient.nationName ?? recipient.name} />
					<span class="who">{recipient.nationName ?? recipient.name}<span class="sub">{recipient.nationName ? recipient.name : ''}</span></span>
					<span class="line">{recipient.email}</span>
					<span class="when">{#if recipient.threadIdentifier}<span class="mark mark-link"><MessagesSquare size={14} aria-hidden="true" />Conversation</span>{/if}</span>
					<span class="marks">
						<span class="mark" class:mark-link={status.tone === 'link'} class:mark-warning={status.tone === 'warning'}><status.icon size={14} aria-hidden="true" />{status.text}</span>
						{#if recipient.status === 'replied'}<TagChip tag={{ name: 'Outreach reply', color: tagColors[0] }} size="small" />{/if}
					</span>
				</svelte:element>
			</li>
		{/each}
	</ol>
	<p class="small muted showing">
		Showing {data.shownCount.toLocaleString('en-US')} of {data.matchingCount.toLocaleString('en-US')}.
		{#if data.shownCount < data.matchingCount}<a href="{viewLink(data.show)}{data.show === 'all' ? '?' : '&'}count={data.nextCount}">Show more</a>{/if}
	</p>
{/if}

<style>
	.title-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin-bottom: var(--space-1);
	}
	.title-line h1 {
		margin: 0;
	}
	.rename {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		flex: 1 1 20rem;
	}
	.rename input {
		flex: 1;
		min-width: 12rem;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.15rem 0.6rem;
		border-radius: 999px;
		background: var(--color-surface);
		color: var(--color-ink);
		font-size: var(--font-size-small);
	}
	.pill-sending {
		background: var(--color-link);
		color: var(--color-paper);
	}
	.pill-scheduled {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--color-link);
		color: var(--color-link);
	}
	.acts {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
	.acts form {
		margin: 0;
	}
	.menu {
		position: relative;
	}
	.menu > summary {
		list-style: none;
	}
	.menu > summary::-webkit-details-marker {
		display: none;
	}
	.menu[open] > summary {
		background: var(--color-surface);
	}
	.popover {
		position: absolute;
		right: 0;
		top: calc(100% + 0.3rem);
		z-index: 6;
		min-width: 13rem;
		padding: var(--space-1);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		box-shadow: 0 6px 24px color-mix(in srgb, var(--color-ink) 18%, transparent);
	}
	.popover form {
		margin: 0;
	}
	.menu-item {
		display: block;
		width: 100%;
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-control);
		background: none;
		color: var(--color-ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.menu-item:hover {
		background: var(--color-surface);
	}
	.menu-item.danger {
		color: var(--color-danger);
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 1rem;
		margin: 0 0 var(--space-3);
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}
	.facts span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.facts a {
		color: inherit;
	}
	/* The chips are the Outreach views' chips on a phone (../+layout.svelte). */
	.filter-chips ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0 0 var(--space-2);
		padding: 0;
		list-style: none;
	}
	.filter-chips a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		color: var(--color-ink);
		text-decoration: none;
		white-space: nowrap;
	}
	.filter-chips a[aria-current='page'] {
		background: var(--color-band);
		border-color: var(--color-band);
		color: var(--color-band-text);
		font-weight: var(--font-weight-semibold);
	}
	.chip-count {
		margin-left: var(--space-1);
		font-variant-numeric: tabular-nums;
	}
	/* The toolbar and rows are the Outreach list's and the inbox's (../+page.svelte). */
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-3);
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--color-line);
		background: var(--color-paper);
	}
	.tick-all,
	.tick {
		display: grid;
		place-items: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		cursor: pointer;
	}
	input[type='checkbox'] {
		width: 1.1rem;
		height: 1.1rem;
		accent-color: var(--color-link);
		cursor: pointer;
	}
	.picked {
		font-weight: var(--font-weight-semibold);
	}
	.tool-group {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
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
	.tool:hover:not(:disabled) {
		background: var(--color-surface);
	}
	.tool:disabled {
		color: var(--color-ink-muted);
		cursor: default;
		opacity: 0.6;
	}
	.add {
		margin-left: auto;
	}
	.add[aria-expanded='true'] {
		background: var(--color-surface);
	}
	.add-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}
	.chip-select :global(.dropdown) {
		margin: 0;
	}
	.chip-select :global(.dropdown-control) {
		width: auto;
	}
	.chip-select :global(.dropdown-button) {
		min-height: 2.1rem;
		gap: 0.3rem;
		padding: 0 0.4rem 0 0.7rem;
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		background: transparent;
		font-size: var(--font-size-small);
	}
	.chip-select :global(.dropdown-button svg:last-child) {
		width: 16px;
		height: 16px;
		color: var(--color-ink-muted);
	}
	.chip-select :global(.dropdown-list) {
		min-width: 16rem;
		right: auto;
	}
	.field-inline {
		width: auto;
		flex: 0 1 16rem;
		min-width: 12rem;
		min-height: 2.1rem;
		padding: 0 0.6rem;
		border-width: 1px;
		font-size: var(--font-size-small);
	}
	.go,
	.stop {
		display: inline-grid;
		place-items: center;
		width: 2.1rem;
		height: 2.1rem;
		border: 0;
		border-radius: 999px;
		cursor: pointer;
	}
	.go {
		background: var(--color-action);
		color: var(--color-action-text);
	}
	.stop {
		background: none;
		color: var(--color-ink-muted);
	}
	.threads {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.threads li {
		display: flex;
		align-items: stretch;
		border-bottom: 1px solid var(--color-line);
		background: var(--color-paper);
	}
	.threads li.unread {
		background: var(--color-surface-raised);
		box-shadow: inset 3px 0 0 var(--color-link);
	}
	.threads li:hover {
		background: var(--color-surface);
	}
	.threads li.ticked {
		background: color-mix(in srgb, var(--color-link) 12%, var(--color-paper));
	}
	.row {
		flex: 1;
		min-width: 0;
		display: grid;
		grid-template-columns: auto minmax(0, 17rem) minmax(0, 1fr) auto;
		grid-template-areas:
			'avatar who line when'
			'avatar who marks marks';
		column-gap: var(--space-3);
		row-gap: var(--space-1);
		align-items: center;
		padding: var(--space-2) var(--space-3) var(--space-2) 0;
		color: var(--color-ink);
		text-decoration: none;
	}
	.row > :global(.avatar) {
		grid-area: avatar;
	}
	.who {
		grid-area: who;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.unread .who {
		font-weight: var(--font-weight-bold);
	}
	a.row:hover .who {
		text-decoration: underline;
	}
	.sub {
		display: block;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-regular);
		color: var(--color-ink-muted);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.line {
		grid-area: line;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--color-ink-muted);
	}
	.when {
		grid-area: when;
		display: inline-flex;
		justify-content: flex-end;
	}
	.marks {
		grid-area: marks;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		min-width: 0;
	}
	.mark {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		min-height: 1.5rem;
		padding: 0 0.5rem;
		border-radius: 999px;
		background: var(--color-surface);
		font-size: var(--font-size-small);
		overflow-wrap: anywhere;
	}
	.mark-link {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--color-link);
		color: var(--color-link);
	}
	.mark-warning {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--color-action);
		color: var(--color-action);
	}
	.showing {
		margin-top: var(--space-3);
	}
	.empty {
		padding: var(--space-5) 0;
	}
	@media (max-width: 40rem) {
		.row {
			grid-template-columns: auto minmax(0, 1fr) auto;
			grid-template-areas:
				'avatar who when'
				'avatar line line'
				'avatar marks marks';
		}
		.add {
			margin-left: 0;
		}
	}
</style>
