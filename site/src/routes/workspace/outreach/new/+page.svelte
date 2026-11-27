<script lang="ts">
	// New batch (design/outreach-redesign, approved by Trevor on Nov. 27, 2026): the inbox's box for writing mail (inbox/Composer.svelte), made for a batch. To is who in the address book it reaches, as chips, with who is left out and why under it; From is the outreach mailbox; Replies to is the inbox the replies arrive in, whose signature the letter carries; the template's words can be changed for this batch, with each {{field}} marked. The bar starts or schedules the batch and holds, as the inbox's bar does, small boxes for fields, saved replies, the start and pace, the follow-up, a test to oneself, and a preview of each letter. What is written saves itself as a draft a moment after each change.
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto, invalidate, replaceState } from '$app/navigation';
	import Avatar from '../../inbox/Avatar.svelte';
	import BellRing from '@lucide/svelte/icons/bell-ring';
	import Braces from '@lucide/svelte/icons/braces';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import Check from '@lucide/svelte/icons/check';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Clock from '@lucide/svelte/icons/clock';
	import Eye from '@lucide/svelte/icons/eye';
	import FileText from '@lucide/svelte/icons/file-text';
	import Gauge from '@lucide/svelte/icons/gauge';
	import MailCheck from '@lucide/svelte/icons/mail-check';
	import MessageSquareText from '@lucide/svelte/icons/message-square-text';
	import Plus from '@lucide/svelte/icons/plus';
	import Send from '@lucide/svelte/icons/send';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Tag from '@lucide/svelte/icons/tag';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import UserX from '@lucide/svelte/icons/user-x';
	import Users from '@lucide/svelte/icons/users';
	import X from '@lucide/svelte/icons/x';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import DateTimeField from '#lib/components/DateTimeField.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import { fillTemplate, mergeFields, outreachText, signatureBlock } from '#lib/mail.ts';
	import { localInputValue } from '../../inbox/dates.ts';
	import ReadinessNotice from '../ReadinessNotice.svelte';
	import { outreachBase as base } from '../views.ts';
	import { whenWords } from '../when.ts';
	import TokenText from './TokenText.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// The page's first data sets what the box starts with; from then on what is written is the writer's, and later loads (a new To) change only who it reaches.
	const first = () => data;
	const start = first();
	const startingTemplate = () => start.templates.find((template) => template.identifier === start.draft?.templateIdentifier) ?? start.templates[0] ?? null;
	const toLocal = (iso: string | null) => (iso && new Date(iso).getTime() > Date.now() ? localInputValue((new Date(iso).getTime() - Date.now()) / 3_600_000) : '');

	let draftIdentifier = $state(start.draft?.identifier ?? null);
	let templateIdentifier = $state(startingTemplate()?.identifier ?? '');
	let replyTo = $state(start.replyTo ?? '');
	let signedAs = $state(start.replyTo ?? '');
	let subject = $state(start.draft?.subject ?? startingTemplate()?.subject ?? '');
	let body = $state(start.draft ? start.draft.body : `${startingTemplate()?.body ?? ''}${signatureBlock(start.signatures[start.replyTo ?? ''])}`);
	let perDay = $state(start.draft?.perDay ?? 40);
	let windowStart = $state(String(start.draft?.windowStartHour ?? 9));
	let windowEnd = $state(String(start.draft?.windowEndHour ?? 15));
	let weekdaysOnly = $state(start.draft?.weekdaysOnly ?? true);
	let followUp = $state(start.draft ? start.draft.followUpDays !== null : true);
	let followUpDays = $state(start.draft?.followUpDays ?? 10);
	let askAcknowledgment = $state(start.draft?.askAcknowledgment ?? false);
	let startsAt = $state(toLocal(start.draft?.startsAt ?? null));
	let picking = $state(false);
	let previewing = $state(false);
	let showing = $state(0);
	let filter = $state({ ...start.filter });

	let ready = $state(false);
	let zone = $state('America/Denver');
	let formElement: HTMLFormElement | undefined = $state();
	let bodyBox: HTMLTextAreaElement | undefined = $state();
	onMount(() => {
		zone = Intl.DateTimeFormat().resolvedOptions().timeZone || zone;
		ready = true;
	});

	const template = $derived(data.templates.find((item) => item.identifier === templateIdentifier) ?? null);
	const templateChoices = $derived(data.templates.map((item) => ({ value: item.identifier, label: `${item.name} (v${item.version})` })));
	const replyChoices = $derived(data.replyChoices.map((choice) => ({ value: choice.value, label: choice.label })));
	const nationsChoices = [
		{ value: 'linked', label: 'Linked to a nation' },
		{ value: 'any', label: 'Every contact' }
	];
	const labelWords: Record<string, string> = {
		'general-office': 'General office addresses',
		leader: 'Leaders’ own addresses',
		'state-listed': 'Listed by a state'
	};
	const labelChoices = [{ value: '', label: 'Any kind of address' }, ...Object.entries(labelWords).map(([value, label]) => ({ value, label }))];
	const tagChoices = $derived([{ value: '', label: 'Any tag' }, ...data.tags.map((tag) => ({ value: tag, label: tag }))]);
	const hours = Array.from({ length: 25 }, (_, value) => ({ value: String(value), label: hour(value) }));

	const count = $derived(data.recipientCount);
	const who = $derived(data.filter.nationsOnly ? (count === 1 ? 'nation' : 'nations') : count === 1 ? 'contact' : 'contacts');
	const leftOutTotal = $derived(data.leftOut.reduce((sum, group) => sum + group.count, 0));
	const leftOutWords: Record<string, string> = {
		'Asked not to be emailed': 'asked not to be emailed',
		'Address bounced': 'bounced',
		'Already in another batch': 'in another batch',
		'Address may be out of date': 'may be out of date'
	};
	const review = $derived(data.leftOut.find((group) => group.review)?.review ?? null);
	const edited = $derived(template !== null && (subject !== template.subject || !body.startsWith(template.body.trimEnd())));
	const days = $derived(Math.max(1, Math.ceil(count / Math.max(1, perDay))));
	const startsIso = $derived(startsAt ? new Date(startsAt).toISOString() : null);
	const name = $derived(`${template?.name ?? 'Letter'}${filter.tag ? `, ${filter.tag}` : ''}`);

	const current = $derived(data.recipients[Math.min(showing, Math.max(0, data.recipients.length - 1))]);
	const letter = $derived.by(() => {
		const fields = current?.fields ?? { 'sender.name': data.senderName };
		const text = outreachText(body, fields, { ...data.links, acknowledgeLink: askAcknowledgment ? data.links.acknowledgeLink : null });
		const cut = text.lastIndexOf('\n--\n');
		return { subject: fillTemplate(subject, fields).trim(), words: cut >= 0 ? text.slice(0, cut) : text, footer: cut >= 0 ? text.slice(cut + 4) : '' };
	});

	function hour(value: number): string {
		if (value === 0 || value === 24) return '12 AM';
		if (value === 12) return '12 PM';
		return value < 12 ? `${value} AM` : `${value - 12} PM`;
	}

	/** Tomorrow, or next Monday, at 8 in the morning, for the quick picks (as inbox/Composer.svelte). */
	function morning(daysAhead: number | 'monday'): string {
		const now = new Date();
		const ahead = daysAhead === 'monday' ? (8 - now.getDay()) % 7 || 7 : daysAhead;
		const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead, 8, 0);
		return localInputValue((at.getTime() - now.getTime()) / 3_600_000, now);
	}
	const startPick = $derived(!startsAt && !picking ? 'now' : !picking && startsAt === morning(1) ? 'tomorrow' : !picking && startsAt === morning('monday') ? 'monday' : 'pick');

	// ----- The template and the signature ----------------------------------
	function chooseTemplate(identifier: string): void {
		const chosen = data.templates.find((item) => item.identifier === identifier);
		if (!chosen) return;
		subject = chosen.subject;
		body = `${chosen.body}${signatureBlock(data.signatures[replyTo])}`;
		changed();
	}

	/** When Replies to changes, its inbox's signature takes the place of the one before (as the inbox's From does). */
	function changeSignature(): void {
		changed();
		const before = signatureBlock(data.signatures[signedAs]);
		const after = signatureBlock(data.signatures[replyTo]);
		signedAs = replyTo;
		if (before === after) return;
		if (before && body.includes(before)) body = body.replace(before, after);
		else if (after) body = `${body.trimEnd()}${after}`;
	}

	// ----- Drafts that save themselves (as inbox/Composer.svelte) -------------
	let saving = $state<'idle' | 'waiting' | 'saving' | 'saved' | 'failed'>(start.draft ? 'saved' : 'idle');
	let savedAt = $state(start.draft ? new Date(start.draft.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '');
	let sending = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function saveDraft(keepalive = false): Promise<void> {
		clearTimeout(timer);
		timer = undefined;
		if (sending || !formElement) return;
		saving = 'saving';
		try {
			const response = await fetch(`${base}/drafts/save`, { method: 'POST', body: new FormData(formElement), keepalive });
			if (!response.ok) throw new Error(String(response.status));
			const saved = (await response.json()) as { identifier: string; updatedAt: string };
			if (draftIdentifier !== saved.identifier) {
				draftIdentifier = saved.identifier;
				// The address keeps the draft, so a reload continues it; the Drafts count in the left column changes.
				void replaceState(`${base}/new?batch=${saved.identifier}`, {});
				void invalidate('outreach:counts');
			}
			savedAt = new Date(saved.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
			if (!timer) saving = 'saved';
		} catch {
			saving = 'failed';
		}
	}

	function changed(): void {
		if (sending) return;
		clearTimeout(timer);
		saving = 'waiting';
		timer = setTimeout(() => void saveDraft(), 2000);
	}

	onMount(() => {
		const leave = () => {
			if (timer && !sending) void saveDraft(true);
		};
		window.addEventListener('pagehide', leave);
		return () => {
			window.removeEventListener('pagehide', leave);
			if (timer && !sending) void saveDraft(true);
			clearTimeout(timer);
		};
	});

	async function discardDraft(): Promise<void> {
		sending = true;
		clearTimeout(timer);
		if (draftIdentifier) await fetch(`${base}/drafts/save?identifier=${encodeURIComponent(draftIdentifier)}`, { method: 'DELETE' }).catch(() => undefined);
		await invalidate('outreach:counts');
		await goto(base);
	}

	// ----- Who it reaches ---------------------------------------------------
	let reaching = $state(false);

	/** A new To: saved with the draft, then the page loads who it reaches now. */
	async function changeFilter(change: Partial<typeof filter>): Promise<void> {
		filter = { ...filter, ...change };
		closeMenus();
		reaching = true;
		await new Promise((resolve) => requestAnimationFrame(resolve));
		await saveDraft();
		showing = 0;
		await goto(draftIdentifier ? `${base}/new?batch=${draftIdentifier}` : `${base}/new?${new URLSearchParams({ tag: filter.tag ?? '', label: filter.label ?? '', nations: filter.nationsOnly ? 'linked' : 'any' })}`, {
			replace: true,
			reset: false
		});
		reaching = false;
	}

	/** The choices of the who form, sent before scripts ran or by a Return in it. */
	function filterFromForm(element: HTMLFormElement): Partial<typeof filter> {
		const values = new FormData(element);
		return { tag: String(values.get('tag') ?? '') || null, label: String(values.get('label') ?? '') || null, nationsOnly: values.get('nations') !== 'any' };
	}

	// ----- The small boxes in the bar ---------------------------------------
	let menus: HTMLElement | undefined = $state();

	function closeMenus(except: HTMLDetailsElement | null = null): void {
		for (const menu of menus?.querySelectorAll('details') ?? []) if (menu !== except) menu.open = false;
		for (const menu of document.querySelectorAll<HTMLDetailsElement>('.to-row details')) if (menu !== except) menu.open = false;
	}

	/** One small box open at a time, and a click elsewhere closes it. */
	function opened(event: Event): void {
		const menu = event.currentTarget as HTMLDetailsElement;
		if (menu.open) closeMenus(menu);
	}
	onMount(() => {
		const away = (event: MouseEvent) => {
			const target = event.target as Node;
			for (const menu of document.querySelectorAll<HTMLDetailsElement>('.composer details[open]')) if (!menu.contains(target)) menu.open = false;
		};
		document.addEventListener('click', away);
		return () => document.removeEventListener('click', away);
	});

	/** Puts text where the cursor is in the letter. */
	function putIn(text: string): void {
		previewing = false;
		const at = bodyBox?.selectionStart ?? body.length;
		const end = bodyBox?.selectionEnd ?? at;
		body = `${body.slice(0, at)}${text}${body.slice(end)}`;
		closeMenus();
		changed();
		requestAnimationFrame(() => {
			bodyBox?.focus();
			bodyBox?.setSelectionRange(at + text.length, at + text.length);
		});
	}
</script>

<svelte:head>
	<title>New batch · Outreach · Workspace · Tribal Law Project</title>
</svelte:head>

<header class="list-head"><h1>New batch</h1></header>

<ReadinessNotice problems={data.problems} />

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

{#if data.templates.length === 0}
	<div class="notice" role="status"><p>A batch starts from a template. <a href="{base}/templates/new">Write a template</a></p></div>
{/if}

<!-- Who it reaches, as a form of its own, so the choices work before scripts run. -->
<form id="who-form" method="get" action="{base}/new" onsubmit={(event) => {
	event.preventDefault();
	void changeFilter(filterFromForm(event.currentTarget));
}}>
	{#if draftIdentifier}<input type="hidden" name="batch" value={draftIdentifier} />{/if}
</form>

<form
	method="post"
	action="?/start"
	class="composer"
	class:reaching
	bind:this={formElement}
	oninput={changed}
	use:enhance={({ action }) => {
		const starting = action.search === '?/start';
		if (starting) {
			sending = true;
			clearTimeout(timer);
		}
		return async ({ result, update }) => {
			if (result.type !== 'redirect') sending = false;
			if (result.type === 'redirect') await invalidate('outreach:counts');
			await update({ reset: false });
		};
	}}
>
	<input type="hidden" name="zone" value={zone} />
	<input type="hidden" name="name" value={name} />
	<input type="hidden" name="showing" value={showing} />
	<input type="hidden" name="tag" value={filter.tag ?? ''} />
	<input type="hidden" name="label" value={filter.label ?? ''} />
	<input type="hidden" name="nations" value={filter.nationsOnly ? 'linked' : 'any'} />
	{#if draftIdentifier}<input type="hidden" name="draft" value={draftIdentifier} />{/if}

	<div class="rows">
		<div class="row to-row">
			<span class="lab" id="to-label">To</span>
			<span class="val" role="group" aria-labelledby="to-label">
				<span class="chip-select">
					<Dropdown label="Which contacts" hideLabel id="nations" name="nations" form="who-form" choices={nationsChoices} value={filter.nationsOnly ? 'linked' : 'any'} onchange={(value) => void changeFilter({ nationsOnly: value !== 'any' })} />
				</span>
				{#if filter.tag}
					<span class="chip"><Tag size={14} aria-hidden="true" />{filter.tag}<button type="button" class="chip-x" aria-label="Take off the tag {filter.tag}" title="Take off" onclick={() => void changeFilter({ tag: null })}><X size={13} aria-hidden="true" /></button></span>
				{/if}
				{#if filter.label}
					<span class="chip">{labelWords[filter.label] ?? filter.label}<button type="button" class="chip-x" aria-label="Take off {labelWords[filter.label] ?? filter.label}" title="Take off" onclick={() => void changeFilter({ label: null })}><X size={13} aria-hidden="true" /></button></span>
				{/if}
				<details class="menu" ontoggle={opened}>
					<summary class="plus" title="Narrow who it reaches" aria-label="Narrow who it reaches"><Plus size={15} aria-hidden="true" /></summary>
					<div class="popover popover-down">
						<p class="popover-title">Narrow who it reaches</p>
						<Dropdown label="With the tag" id="tag" name="tag" form="who-form" choices={tagChoices} value={filter.tag ?? ''} onchange={(value) => void changeFilter({ tag: value || null })} />
						<Dropdown label="Kind of address" id="label" name="label" form="who-form" choices={labelChoices} value={filter.label ?? ''} onchange={(value) => void changeFilter({ label: value || null })} />
						<noscript><button class="button button-quiet" type="submit" form="who-form">Show who this reaches</button></noscript>
					</div>
				</details>
			</span>
			<span class="end"><b>{count.toLocaleString('en-US')} {who}</b></span>
		</div>
		<div class="leftout small">
			{#if leftOutTotal}
				<UserX size={14} aria-hidden="true" />
				<span>Left out <CountBadge count={leftOutTotal} label="left out" /></span>
				<span>{data.leftOut.map((group) => `${group.count} ${leftOutWords[group.reason] ?? group.reason.toLowerCase()}`).join(', ')}</span>
				{#if review}<a href={review}>Review</a>{/if}
			{:else}
				<UserX size={14} aria-hidden="true" /><span>Nobody is left out.</span>
			{/if}
		</div>
		<div class="row">
			<span class="lab">From</span>
			<span class="plain">{#if data.mailbox}{data.mailbox}{:else}<span class="muted">The outreach mailbox, once it is set up</span>{/if}</span>
		</div>
		<div class="row">
			<span class="lab" aria-hidden="true">Replies to</span>
			<span class="val">
				{#if replyChoices.length}
					<span class="chip-select">
						<Dropdown label="Replies to" hideLabel id="replyTo" name="replyTo" icon={Users} choices={replyChoices} bind:value={replyTo} onchange={changeSignature} />
					</span>
				{:else}
					<span class="muted small">No inbox has an address yet. <a href="/workspace/inbox/settings">Inbox settings</a></span>
				{/if}
			</span>
		</div>
		<div class="row">
			<span class="lab" aria-hidden="true">Template</span>
			<span class="val">
				{#if templateChoices.length}
					<span class="chip-select">
						<Dropdown label="Template" hideLabel id="template" name="template" icon={FileText} choices={templateChoices} bind:value={templateIdentifier} onchange={chooseTemplate} />
					</span>
					{#if edited}<span class="small muted">edited for this batch</span>{/if}
				{/if}
			</span>
		</div>
		<div class="row">
			<span class="lab" aria-hidden="true">Subject</span>
			<TokenText id="subject" name="subject" label="Subject" bind:value={subject} required />
		</div>
	</div>

	{#if previewing}
		<div class="stepper-strip">
			<button type="button" class="icon-button" aria-label="The letter before" title="The letter before" disabled={showing === 0} onclick={() => (showing = Math.max(0, showing - 1))}><ChevronLeft size={20} aria-hidden="true" /></button>
			{#if current}
				<Avatar name={current.nationName ?? current.name} />
				<span class="who2"><b>{current.nationName ?? current.name}</b> <span class="muted small">{current.nationName ? current.name : ''} · {showing + 1} of {count.toLocaleString('en-US')}</span></span>
			{:else}
				<span class="who2 muted">Nobody to preview: no one in the address book matches.</span>
			{/if}
			<button type="button" class="icon-button" aria-label="The next letter" title="The next letter" disabled={showing >= data.recipients.length - 1} onclick={() => (showing = Math.min(data.recipients.length - 1, showing + 1))}><ChevronRight size={20} aria-hidden="true" /></button>
		</div>
		<div class="letter-view" aria-live="polite">
			<p class="letter-subject">{letter.subject}</p>
			<p class="letter-words">{letter.words}</p>
			{#if letter.footer}<p class="letter-footer">{letter.footer}</p>{/if}
		</div>
	{/if}
	<div class="body" hidden={previewing}>
		<TokenText id="body" name="body" label="The letter" multiline bind:value={body} bind:box={bodyBox} required placeholder="Write the letter" />
	</div>

	<p class="stopline small"><ShieldCheck size={15} aria-hidden="true" />Added below every letter: how to stop further mail (a link, an address, or reply “stop”).</p>
	<label class="option small"><input type="checkbox" name="askAcknowledgment" value="yes" bind:checked={askAcknowledgment} /> Add a “Let us know you got this” link <span class="muted">(visible, optional for them)</span></label>
	<p class="timing small">
		<span><CalendarClock size={15} aria-hidden="true" />{startsIso ? `Starts ${whenWords(startsIso)}` : 'Starts as soon as it is started'}</span>
		<span><Gauge size={15} aria-hidden="true" />At most {perDay} a day, {weekdaysOnly ? 'weekdays, ' : ''}{hour(Number(windowStart))} to {hour(Number(windowEnd))} their time ({days} {days === 1 ? 'day' : 'days'})</span>
		<span><BellRing size={15} aria-hidden="true" />{followUp ? `Follow up after ${followUpDays} days with no reply` : 'No follow-up'}</span>
	</p>

	<div class="bar" bind:this={menus}>
		<button class="button send" type="submit" disabled={!templateIdentifier}>
			{#if startsAt}<CalendarClock size={18} aria-hidden="true" />Schedule the batch{:else}<Send size={18} aria-hidden="true" />Start the batch{/if}
		</button>

		<details class="menu" ontoggle={opened}>
			<summary class="icon-button" title="Put in a field" aria-label="Put in a field"><Braces size={20} aria-hidden="true" /></summary>
			<div class="popover">
				<p class="popover-title">Put in a field</p>
				<ul class="choice-list">
					{#each mergeFields as field (field.key)}
						<li>
							<button type="button" class="choice field-choice" title={field.label} onclick={() => putIn(`{{${field.key}}}`)}>
								<span class="token">{`{{${field.key}}}`}</span>
								<span class="muted">{current?.fields[field.key] || (field.key === 'sender.name' ? data.senderName : '')}</span>
							</button>
						</li>
					{/each}
				</ul>
				<p class="small rule">Saved replies use the same fields.</p>
			</div>
		</details>

		<details class="menu" ontoggle={opened}>
			<summary class="icon-button" title="Put in a saved reply" aria-label="Put in a saved reply"><MessageSquareText size={20} aria-hidden="true" /></summary>
			<div class="popover">
				<p class="popover-title">Saved replies</p>
				{#if data.savedReplies.length}
					<ul class="choice-list">
						{#each data.savedReplies as reply (reply.identifier)}
							<li>
								<button type="button" class="choice reply-choice" onclick={() => putIn(reply.body)}>
									<strong>{reply.name}</strong>
									<span class="small muted">{reply.body.replace(/\s+/g, ' ').slice(0, 90)}</span>
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="small muted">No saved replies yet.</p>
				{/if}
				<p class="small rule"><a href="/workspace/inbox/settings">Make and change saved replies</a></p>
			</div>
		</details>

		<details class="menu" ontoggle={opened}>
			<summary class="icon-button" title="Start later, and the pace" aria-label="Start later, and the pace"><Clock size={20} aria-hidden="true" /></summary>
			<div class="popover">
				<p class="popover-title">Start</p>
				<div class="quick">
					<button type="button" class:on={startPick === 'now'} onclick={() => { picking = false; startsAt = ''; changed(); }}>Now</button>
					<button type="button" class:on={startPick === 'tomorrow'} onclick={() => { picking = false; startsAt = morning(1); changed(); }}>Tomorrow 8 AM</button>
					<button type="button" class:on={startPick === 'monday'} onclick={() => { picking = false; startsAt = morning('monday'); changed(); }}>Monday 8 AM</button>
					<button type="button" class:on={startPick === 'pick'} onclick={() => (picking = true)}>Pick a time…</button>
				</div>
				<div class="field pick" hidden={ready && startPick !== 'pick'}>
					<label for="startsAt">Start at <span class="hint">your time</span></label>
					<DateTimeField id="startsAt" name="startsAt" bind:value={startsAt} defaultTime="08:00" hint="" />
				</div>
				<p class="popover-title">Pace</p>
				<div class="pace">
					<label for="perDay">At most</label>
					<input type="number" id="perDay" name="perDay" min="1" max="200" bind:value={perDay} class="number" />
					<span>a day,</span>
					<span class="hour"><Dropdown label="From" hideLabel id="windowStart" name="windowStart" choices={hours.slice(0, 24)} bind:value={windowStart} onchange={changed} /></span>
					<span>to</span>
					<span class="hour"><Dropdown label="Until" hideLabel id="windowEnd" name="windowEnd" choices={hours.slice(1)} bind:value={windowEnd} onchange={changed} /></span>
					<span>in each nation’s time zone</span>
				</div>
				<label class="switch"><input type="checkbox" role="switch" name="weekdaysOnly" value="yes" bind:checked={weekdaysOnly} /> Weekdays only</label>
				<p class="small muted rule">Start low: a new mailbox is trusted slowly. {count.toLocaleString('en-US')} {who} at {perDay} a day takes {days} {weekdaysOnly ? (days === 1 ? 'weekday' : 'weekdays') : days === 1 ? 'day' : 'days'}.</p>
			</div>
		</details>

		<details class="menu" ontoggle={opened}>
			<summary class="icon-button" title="Follow up" aria-label="Follow up"><BellRing size={20} aria-hidden="true" /></summary>
			<div class="popover">
				<p class="popover-title">Follow up</p>
				<div class="pace">
					<label class="switch"><input type="checkbox" role="switch" name="followUp" value="yes" bind:checked={followUp} /> Follow up after</label>
					<input type="number" id="followUpDays" name="followUpDays" min="1" max="90" bind:value={followUpDays} class="number" aria-label="Days with no reply" disabled={!followUp} />
					<span>days with no reply</span>
				</div>
				<p class="small muted rule">A letter with no reply by then shows in Follow up due. Nothing is sent on its own.</p>
			</div>
		</details>

		<button type="submit" class="icon-button" formaction="?/test" formnovalidate title="Send a test to me" aria-label="Send a test to me"><MailCheck size={20} aria-hidden="true" /></button>
		<button type="button" class="icon-button" class:on={previewing} aria-pressed={previewing} title="Preview each letter" aria-label="Preview each letter" onclick={() => (previewing = !previewing)}><Eye size={20} aria-hidden="true" /></button>

		<span class="draft-state small muted" role="status">
			{#if saving === 'saving' || saving === 'waiting'}Saving…{:else if saving === 'saved'}<Check size={14} aria-hidden="true" />Draft saved {savedAt}{:else if saving === 'failed'}Draft not saved{/if}
		</span>
		{#if ready && draftIdentifier}
			<button type="button" class="icon-button discard" title="Discard the draft" aria-label="Discard the draft" onclick={discardDraft}><Trash2 size={20} aria-hidden="true" /></button>
		{:else}
			<a class="icon-button discard" href={base} title="Discard" aria-label="Discard"><Trash2 size={20} aria-hidden="true" /></a>
		{/if}
	</div>
</form>

<style>
	.list-head h1 {
		margin: 0 0 var(--space-3);
	}
	/* The box, its rows and its bar are the inbox's (inbox/Composer.svelte). */
	.composer {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--color-ink) 8%, transparent);
	}
	.composer.reaching .end {
		opacity: 0.5;
	}
	.rows {
		padding: 0 var(--space-4);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		min-height: 2.75rem;
		padding: 0.3rem 0;
		border-bottom: 1px solid var(--color-line);
	}
	.row:focus-within {
		box-shadow: inset 0 -2px 0 var(--color-link);
	}
	.lab {
		flex: none;
		width: 5rem;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}
	.val {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
	}
	.plain {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.end {
		margin-left: auto;
		font-size: var(--font-size-small);
		white-space: nowrap;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		height: 1.75rem;
		padding: 0 0.15rem 0 0.55rem;
		border-radius: 999px;
		background: var(--color-surface);
		font-size: var(--font-size-small);
		white-space: nowrap;
	}
	.chip-x {
		display: inline-grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border: 0;
		border-radius: 50%;
		background: none;
		color: var(--color-ink-muted);
		cursor: pointer;
	}
	.chip-x:hover {
		background: color-mix(in srgb, var(--color-ink) 10%, transparent);
	}
	/* A dropdown drawn as a chip: a pill with a thin border, small type. */
	.chip-select :global(.dropdown) {
		margin: 0;
	}
	.chip-select :global(.dropdown-control) {
		width: auto;
	}
	.chip-select :global(.dropdown-button) {
		min-height: 1.75rem;
		height: 1.75rem;
		gap: 0.3rem;
		padding: 0 0.4rem 0 0.6rem;
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
	.chip-select :global(.dropdown-icon) {
		margin-right: 0;
	}
	.chip-select :global(.dropdown-list) {
		min-width: 16rem;
		right: auto;
	}
	.plus {
		display: inline-grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 999px;
		border: 1px dashed var(--color-control-border);
		color: var(--color-ink-muted);
		cursor: pointer;
		list-style: none;
	}
	.plus::-webkit-details-marker {
		display: none;
	}
	.leftout {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem 0.5rem;
		padding: var(--space-1) 0 var(--space-2) calc(5rem + var(--space-3));
		border-bottom: 1px solid var(--color-line);
		color: var(--color-ink-muted);
	}
	.leftout > span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.body[hidden] {
		display: none;
	}
	.stepper-strip {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-line);
	}
	.who2 {
		flex: 1;
		min-width: 0;
	}
	.letter-view {
		padding: var(--space-3) var(--space-4);
		min-height: 15rem;
		background: var(--color-paper);
		line-height: var(--font-line-height-reading);
	}
	.letter-view p {
		margin: 0 0 var(--space-3);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.letter-subject {
		font-weight: var(--font-weight-bold);
	}
	.letter-footer {
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}
	.stopline {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0 var(--space-4);
		padding: var(--space-2) 0;
		border-top: 1px dashed var(--color-line);
		color: var(--color-ink-muted);
	}
	.option {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4) 0;
	}
	input[type='checkbox'] {
		width: 1.1rem;
		height: 1.1rem;
		accent-color: var(--color-link);
	}
	.timing {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.9rem;
		margin: 0;
		padding: var(--space-2) var(--space-4) 0;
	}
	.timing span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.timing :global(svg) {
		color: var(--color-link);
	}
	.bar {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-3) var(--space-4);
	}
	.send {
		gap: var(--space-2);
		margin-right: var(--space-2);
		border-radius: 999px;
		padding-inline: var(--space-5);
	}
	.icon-button.on,
	.menu[open] > summary {
		color: var(--color-link);
		background: color-mix(in srgb, var(--color-link) 12%, transparent);
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
	.popover {
		position: absolute;
		bottom: calc(100% + 0.4rem);
		left: 0;
		z-index: 6;
		width: min(22rem, calc(100vw - 3rem));
		padding: var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		box-shadow: 0 6px 24px color-mix(in srgb, var(--color-ink) 18%, transparent);
		font-size: var(--font-size-small);
	}
	.popover-down {
		top: calc(100% + 0.4rem);
		bottom: auto;
	}
	.popover-title {
		margin: 0 0 var(--space-2);
		font-weight: var(--font-weight-semibold);
	}
	.popover :global(.dropdown) {
		margin: 0 0 var(--space-3);
	}
	.rule {
		margin: var(--space-3) 0 0;
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}
	.choice-list {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 18rem;
		overflow-y: auto;
	}
	.choice {
		display: flex;
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
	.choice:hover,
	.choice:focus-visible {
		background: var(--color-surface);
	}
	.field-choice {
		justify-content: space-between;
		gap: var(--space-3);
	}
	.field-choice .muted {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.token {
		flex: none;
		padding: 0 0.25rem;
		border-radius: 4px;
		background: color-mix(in srgb, var(--color-link) 16%, transparent);
	}
	.reply-choice {
		flex-direction: column;
		gap: 0.1em;
	}
	.quick {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0 0 var(--space-3);
	}
	.quick button {
		display: inline-flex;
		align-items: center;
		min-height: 2rem;
		padding: 0 0.7rem;
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		cursor: pointer;
	}
	.quick button.on {
		background: var(--color-band);
		border-color: var(--color-band);
		color: var(--color-band-text);
	}
	.pick {
		margin: 0 0 var(--space-3);
	}
	.pick[hidden] {
		display: none;
	}
	.pace {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		margin: 0 0 var(--space-2);
	}
	.number {
		width: 3.5rem;
		min-height: 2rem;
		padding: 0 0.4rem;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
		font: inherit;
	}
	.hour :global(.dropdown) {
		margin: 0;
	}
	.hour :global(.dropdown-control) {
		width: 5.75rem;
	}
	.hour :global(.dropdown-button) {
		min-height: 2rem;
		gap: var(--space-1);
		padding: 0 0.4rem;
		border-width: 1px;
	}
	.hour :global(.dropdown-button svg:last-child) {
		width: 16px;
		height: 16px;
	}
	.switch {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		cursor: pointer;
	}
	.switch input {
		appearance: none;
		position: relative;
		flex: none;
		width: 2.1rem;
		height: 1.2rem;
		margin: 0;
		border-radius: 999px;
		background: var(--color-control-border);
		cursor: pointer;
	}
	.switch input::after {
		content: '';
		position: absolute;
		left: 0.15rem;
		top: 0.15rem;
		width: 0.9rem;
		height: 0.9rem;
		border-radius: 50%;
		background: var(--color-paper);
		transition: left var(--motion-duration-short) var(--motion-easing-standard);
	}
	.switch input:checked {
		background: var(--color-link);
	}
	.switch input:checked::after {
		left: 1.05rem;
	}
	.draft-state {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-left: var(--space-2);
		white-space: nowrap;
	}
	.discard {
		margin-left: auto;
		color: var(--color-ink-muted);
	}
	@media (max-width: 40rem) {
		.end {
			flex-basis: 100%;
			padding-left: calc(3.5rem + var(--space-3));
		}
		.leftout {
			padding-left: 0;
		}
		.lab {
			width: auto;
			min-width: 3.5rem;
		}
	}
</style>
