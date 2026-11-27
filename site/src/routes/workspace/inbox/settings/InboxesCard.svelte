<script lang="ts">
	// The Inboxes card of Inbox settings (site/MAIL.md, "Inboxes" and
	// "New-mail alerts"), laid out as the round-2 mockup Trevor approved on
	// Nov. 26, 2026 (design/inbox-routing/round-2): each inbox is two lines.
	// The first holds its kind, its name (click to rename), its addresses
	// with a + for another, "Gets other mail", its count and a ⋯ menu; the
	// second holds the people on it, each with how they hear about new mail.
	// Your own chip opens your alert choice; the + by the heading opens a
	// one-line row for a new inbox. Trevor asked for + buttons, no labels
	// above fields and changes made in place (Nov. 26, 2026), so the fields
	// carry visually hidden labels.
	//
	// Someone who does not manage mail sees only the inboxes they are on and
	// can change only their own chip.
	import { enhance } from '$app/forms';
	import Bell from '@lucide/svelte/icons/bell';
	import BellOff from '@lucide/svelte/icons/bell-off';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import Check from '@lucide/svelte/icons/check';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import UserRound from '@lucide/svelte/icons/user-round';
	import Users from '@lucide/svelte/icons/users';
	import X from '@lucide/svelte/icons/x';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import type { SubmitFunction } from '$app/forms';
	import { tick } from 'svelte';

	type Level = 'now' | 'daily' | 'none';
	type Person = { identifier: string; name: string };
	type Inbox = {
		identifier: string;
		localPart: string;
		aliases: string[];
		name: string;
		kind: 'shared' | 'personal';
		ownerIdentifier: string | null;
		ownerName: string | null;
		catchAll: boolean;
		members: (Person & { alerts: Level })[];
		conversationCount: number | null;
		unread: number | null;
	};

	let {
		inboxes,
		candidates,
		domain,
		me,
		canManage,
		notice
	}: {
		inboxes: Inbox[];
		candidates: Person[];
		domain: string | null;
		me: string;
		canManage: boolean;
		notice: { problem?: string; done?: string } | null;
	} = $props();

	const alertIcons = { now: Bell, daily: CalendarClock, none: BellOff } as const;
	const alertNames: Record<Level, string> = { now: 'At once', daily: 'Daily summary', none: 'No alerts' };
	const levels: Level[] = ['now', 'daily', 'none'];

	// A display name that is still an email address shows only the part before the @.
	const shortName = (name: string) => name.trim().replace(/@.*$/, '');
	const firstName = (name: string) => shortName(name).split(/\s+/)[0] || name;
	function initials(name: string): string {
		const words = shortName(name).split(/\s+/).filter((word) => /\p{L}/u.test(word));
		const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1);
		return letters.map((word) => [...word][0]?.toUpperCase() ?? '').join('') || '?';
	}
	const fullAddress = (localPart: string) => `${localPart}@${domain ?? '…'}`;

	function countText(inbox: Inbox): string {
		if (inbox.kind === 'personal') return inbox.ownerIdentifier === me ? 'Only you see it' : `Only ${firstName(inbox.ownerName ?? 'its owner')} sees it`;
		if (inbox.unread) return `${inbox.unread} unread`;
		if (inbox.conversationCount) return `${inbox.conversationCount} conversation${inbox.conversationCount === 1 ? '' : 's'}`;
		return 'No mail yet';
	}

	// What is open: one menu, one rename, one new address, the new-inbox row.
	let menu = $state<string | null>(null);
	let renaming = $state<string | null>(null);
	let renameValue = $state('');
	let addingAddress = $state<string | null>(null);
	let addressValue = $state('');
	let creating = $state(false);
	let newKind = $state<'shared' | 'personal'>('shared');

	function toggleMenu(key: string) {
		menu = menu === key ? null : key;
	}

	async function startRename(inbox: Inbox) {
		renaming = inbox.identifier;
		renameValue = inbox.name;
		await tick();
		document.getElementById(`rename-${inbox.identifier}`)?.focus();
	}

	async function startAddress(inbox: Inbox) {
		addingAddress = inbox.identifier;
		addressValue = '';
		await tick();
		document.getElementById(`address-${inbox.identifier}`)?.focus();
	}

	async function startCreating() {
		creating = !creating;
		if (!creating) return;
		await tick();
		document.getElementById('new-inbox-local')?.focus();
	}

	// Each change is sent without leaving the page; a change that worked closes what it came from.
	const close: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update();
			if (result.type === 'success') {
				menu = null;
				renaming = null;
				addingAddress = null;
				creating = false;
			}
		};
	};

	function closeOnOutside(event: MouseEvent) {
		if (menu && !(event.target as Element | null)?.closest('[data-menu]')) menu = null;
	}

	function closeOnEscape(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		if (menu) {
			const opener = document.querySelector<HTMLElement>(`[data-menu="${menu}"] > button`);
			menu = null;
			opener?.focus();
		} else if (renaming) renaming = null;
		else if (addingAddress) addingAddress = null;
		else if (creating) creating = false;
	}
</script>

<svelte:window onclick={closeOnOutside} onkeydown={closeOnEscape} />

<section class="card wide" id="inboxes" aria-labelledby="inboxes-heading">
	<div class="title">
		<h2 id="inboxes-heading"><InboxIcon size={20} aria-hidden="true" />Inboxes</h2>
		<span class="domain">{domain ? `@${domain}` : 'Email is off'}</span>
		{#if canManage}
			<button class="icon-button" type="button" aria-label="New inbox" title="New inbox" aria-expanded={creating} aria-controls="new-inbox" onclick={startCreating}><Plus size={20} aria-hidden="true" /></button>
		{/if}
	</div>
	<p class="small muted intro">Everyone on a shared inbox reads it; a personal one only its owner. Your own chip sets how you hear about new mail.</p>
	{#if notice?.problem}
		<div class="notice notice-problem" role="alert"><p>{notice.problem}</p></div>
	{:else if notice?.done}
		<div class="notice" role="status"><p>{notice.done}</p></div>
	{/if}

	{#if canManage && creating}
		<form method="post" action="?/createInbox" class="new-row" id="new-inbox" use:enhance={close}>
			<fieldset class="segments">
				<legend class="visually-hidden">Kind of inbox</legend>
				<label class:on={newKind === 'shared'}><input class="visually-hidden" type="radio" name="kind" value="shared" bind:group={newKind} /><Users size={14} aria-hidden="true" />Shared</label>
				<label class:on={newKind === 'personal'}><input class="visually-hidden" type="radio" name="kind" value="personal" bind:group={newKind} /><UserRound size={14} aria-hidden="true" />Personal</label>
			</fieldset>
			<span class="field-inline">
				<label class="visually-hidden" for="new-inbox-local">Address, before the @</label>
				<input type="text" id="new-inbox-local" name="localPart" maxlength="64" required placeholder={newKind === 'personal' ? 'trevor' : 'nations'} autocomplete="off" spellcheck="false" />
				<span class="muted" aria-hidden="true">@</span>
			</span>
			<span class="field-inline">
				<label class="visually-hidden" for="new-inbox-name">Name</label>
				<input type="text" id="new-inbox-name" name="name" maxlength="80" required placeholder={newKind === 'personal' ? 'Trevor' : 'Nations'} />
			</span>
			{#if newKind === 'personal'}
				<span class="owner">
					<Dropdown label="Whose inbox" hideLabel id="new-inbox-owner" name="owner" required choices={candidates.map((person) => ({ value: person.identifier, label: person.name }))} value={me} />
				</span>
			{/if}
			<button class="go" type="submit" aria-label="Make the inbox" title="Make the inbox"><Check size={16} aria-hidden="true" /></button>
			<button class="stop" type="button" aria-label="Cancel" title="Cancel" onclick={() => (creating = false)}><X size={16} aria-hidden="true" /></button>
		</form>
	{/if}

	<ul class="inbox-list">
		{#each inboxes as inbox (inbox.identifier)}
			{@const mine = inbox.members.find((member) => member.identifier === me)}
			{@const others = candidates.filter((person) => !inbox.members.some((member) => member.identifier === person.identifier))}
			<li>
				<div class="line-one">
					<span class="kind" title={inbox.kind === 'personal' ? 'Personal' : 'Shared'}>
						{#if inbox.kind === 'personal'}<UserRound size={18} aria-label="Personal" />{:else}<Users size={18} aria-label="Shared" />{/if}
					</span>
					{#if renaming === inbox.identifier}
						<form method="post" action="?/renameInbox" class="name renaming" use:enhance={close}>
							<input type="hidden" name="inbox" value={inbox.identifier} />
							<label class="visually-hidden" for="rename-{inbox.identifier}">Name of the {inbox.name} inbox</label>
							<input type="text" id="rename-{inbox.identifier}" name="name" bind:value={renameValue} maxlength="80" required onblur={(event) => { if (renameValue.trim() === inbox.name) renaming = null; else event.currentTarget.form?.requestSubmit(); }} />
						</form>
					{:else if canManage}
						<button class="name" type="button" title="Rename" onclick={() => startRename(inbox)}>
							{inbox.name}<span class="visually-hidden">, rename</span><span class="pen" aria-hidden="true"><Pencil size={13} /></span>
						</button>
					{:else}
						<strong class="name">{inbox.name}</strong>
					{/if}
					<span class="chip address" title={fullAddress(inbox.localPart)}><span>{inbox.localPart}</span><span class="at">@</span></span>
					{#each inbox.aliases as alias (alias)}
						<span class="chip address" title={fullAddress(alias)}>
							<span>{alias}</span><span class="at">@</span>
							{#if canManage}
								<form method="post" action="?/removeAddress" use:enhance={close}>
									<input type="hidden" name="inbox" value={inbox.identifier} />
									<input type="hidden" name="localPart" value={alias} />
									<button class="take-off" type="submit" aria-label="Take {alias}@ off {inbox.name}" title="Take off"><X size={13} aria-hidden="true" /></button>
								</form>
							{/if}
						</span>
					{/each}
					{#if canManage && inbox.kind === 'shared'}
						{#if addingAddress === inbox.identifier}
							<form method="post" action="?/addAddress" class="chip adding" use:enhance={close}>
								<input type="hidden" name="inbox" value={inbox.identifier} />
								<label class="visually-hidden" for="address-{inbox.identifier}">Another address for {inbox.name}, before the @</label>
								<input type="text" id="address-{inbox.identifier}" name="localPart" bind:value={addressValue} maxlength="64" required autocomplete="off" spellcheck="false" />
								<span class="at" aria-hidden="true">@</span>
								<button class="ok" type="submit" aria-label="Add the address" title="Add"><Check size={13} aria-hidden="true" /></button>
								<button class="no" type="button" aria-label="Cancel" title="Cancel" onclick={() => (addingAddress = null)}><X size={13} aria-hidden="true" /></button>
							</form>
						{:else}
							<button class="plus" type="button" aria-label="Add an address to {inbox.name}" title="Add an address" onclick={() => startAddress(inbox)}><Plus size={15} aria-hidden="true" /></button>
						{/if}
					{/if}
					<span class="end">
						{#if inbox.catchAll}<span class="pill" title="Mail to an address no inbox has comes here">Gets other mail</span>{/if}
						<span class="count">{countText(inbox)}</span>
						{#if canManage}
							<span class="menu-root" data-menu="more:{inbox.identifier}">
								<button class="icon-button" type="button" aria-label="More for {inbox.name}" title="More" aria-expanded={menu === `more:${inbox.identifier}`} onclick={() => toggleMenu(`more:${inbox.identifier}`)}><Ellipsis size={18} aria-hidden="true" /></button>
								{#if menu === `more:${inbox.identifier}`}
									<div class="menu menu-end">
										{#if inbox.kind === 'shared' && !inbox.catchAll}
											<form method="post" action="?/makeCatchAll" use:enhance={close}>
												<input type="hidden" name="inbox" value={inbox.identifier} />
												<button class="item" type="submit"><InboxIcon size={15} aria-hidden="true" />Send other mail here</button>
											</form>
										{/if}
										{#if inbox.catchAll}
											<p class="menu-note">It gets other mail, so send other mail to another inbox before deleting it.</p>
										{:else}
											<form method="post" action="?/deleteInbox" use:enhance={close}>
												<input type="hidden" name="inbox" value={inbox.identifier} />
												<button class="item" type="submit"><Trash2 size={15} aria-hidden="true" />Delete</button>
											</form>
										{/if}
									</div>
								{/if}
							</span>
						{/if}
					</span>
				</div>
				<div class="line-two">
					{#each inbox.members as member (member.identifier)}
						{@const AlertIcon = alertIcons[member.alerts]}
						{#if member.identifier === me}
							<span class="menu-root" data-menu="alerts:{inbox.identifier}">
								<button
									class="chip person mine"
									type="button"
									title="Your alerts: {alertNames[member.alerts]}"
									aria-label="Your alerts for {inbox.name}: {alertNames[member.alerts]}"
									aria-expanded={menu === `alerts:${inbox.identifier}`}
									onclick={() => toggleMenu(`alerts:${inbox.identifier}`)}
								>
									<span class="initials" aria-hidden="true">{initials(member.name)}</span>{inbox.kind === 'personal' ? 'Your alerts' : firstName(member.name)}<span class="alert"><AlertIcon size={14} aria-hidden="true" /></span>
								</button>
								{#if menu === `alerts:${inbox.identifier}`}
									<div class="menu">
										<p class="menu-head">Your alerts for {inbox.name}</p>
										{#each levels as level (level)}
											{@const LevelIcon = alertIcons[level]}
											<form method="post" action="?/alerts" use:enhance={close}>
												<input type="hidden" name="inbox" value={inbox.identifier} />
												<input type="hidden" name="level" value={level} />
												<button class="item" class:on={member.alerts === level} type="submit" aria-pressed={member.alerts === level}>
													<LevelIcon size={15} aria-hidden="true" />{alertNames[level]}{#if member.alerts === level}<span class="tick"><Check size={15} aria-hidden="true" /></span>{/if}
												</button>
											</form>
										{/each}
										{#if inbox.kind === 'shared' && inbox.members.length > 1}
											<hr />
											<form method="post" action="?/leaveInbox" use:enhance={close}>
												<input type="hidden" name="inbox" value={inbox.identifier} />
												<button class="item" type="submit"><X size={15} aria-hidden="true" />Leave this inbox</button>
											</form>
										{/if}
									</div>
								{/if}
							</span>
						{:else}
							<span class="chip person" title="{member.name}: {alertNames[member.alerts]}">
								<span class="initials" aria-hidden="true">{initials(member.name)}</span>{firstName(member.name)}<span class="alert"><AlertIcon size={14} aria-label={alertNames[member.alerts]} /></span>
								{#if canManage && inbox.kind === 'shared' && inbox.members.length > 1}
									<form method="post" action="?/removeMember" use:enhance={close}>
										<input type="hidden" name="inbox" value={inbox.identifier} />
										<input type="hidden" name="member" value={member.identifier} />
										<button class="take-off" type="submit" aria-label="Take {member.name} off {inbox.name}" title="Take off this inbox"><X size={13} aria-hidden="true" /></button>
									</form>
								{/if}
							</span>
						{/if}
					{/each}
					{#if canManage && inbox.kind === 'shared' && others.length}
						<span class="menu-root" data-menu="people:{inbox.identifier}">
							<button class="plus" type="button" aria-label="Add a person to {inbox.name}" title="Add a person" aria-expanded={menu === `people:${inbox.identifier}`} onclick={() => toggleMenu(`people:${inbox.identifier}`)}><Plus size={15} aria-hidden="true" /></button>
							{#if menu === `people:${inbox.identifier}`}
								<div class="menu">
									<p class="menu-head">Add to {inbox.name}</p>
									{#each others as person (person.identifier)}
										<form method="post" action="?/addMember" use:enhance={close}>
											<input type="hidden" name="inbox" value={inbox.identifier} />
											<input type="hidden" name="member" value={person.identifier} />
											<button class="item" type="submit"><span class="initials" aria-hidden="true">{initials(person.name)}</span>{person.name}</button>
										</form>
									{/each}
								</div>
							{/if}
						</span>
					{/if}
					{#if !mine && inbox.members.length === 0}
						<span class="small muted">Nobody is on it.</span>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
</section>

<style>
	.card {
		min-width: 0;
		padding: var(--space-4) var(--space-5);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
	}
	.title {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-1);
	}
	.title h2 {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		flex: 1;
		margin: 0;
	}
	.domain {
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}
	.intro {
		margin: 0 0 var(--space-3);
	}
	.icon-button {
		display: inline-grid;
		place-items: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--color-ink-muted);
		cursor: pointer;
	}
	.title .icon-button {
		color: var(--color-ink);
	}
	.icon-button:hover {
		color: var(--color-ink);
		background: var(--color-surface);
	}
	form {
		display: contents;
	}
	.inbox-list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--color-line);
	}
	.inbox-list > li {
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}
	.line-one {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem 0.4rem;
	}
	.line-two {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.3rem;
		padding-left: 2.1rem;
	}
	.kind {
		display: inline-grid;
		place-items: center;
		width: 1.7rem;
		color: var(--color-ink-muted);
	}
	.name {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		min-height: 2rem;
		margin-right: 0.35rem;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		font-weight: var(--font-weight-semibold);
	}
	button.name {
		cursor: text;
	}
	.name .pen {
		display: inline-flex;
		opacity: 0;
		color: var(--color-ink-muted);
	}
	.inbox-list > li:hover .name .pen,
	button.name:focus-visible .pen {
		opacity: 1;
	}
	.renaming {
		display: inline-flex;
	}
	.renaming input {
		width: 8.5rem;
		padding: 0.1rem 0.2rem;
		border: 0;
		border-bottom: 2px solid var(--color-link);
		border-radius: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-weight: var(--font-weight-semibold);
	}
	/* The teal underline, thicker while typing, shows where the focus is, as in the mockup. */
	.renaming input:focus,
	.adding input:focus,
	.field-inline input:focus {
		outline: none;
		box-shadow: none;
	}
	.renaming input:focus {
		border-bottom-width: 3px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		height: 1.75rem;
		padding: 0 0.55rem;
		border: 0;
		border-radius: 999px;
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
		white-space: nowrap;
	}
	.address .at {
		margin-left: -0.3rem;
		color: var(--color-ink-muted);
	}
	.take-off {
		display: none;
		place-items: center;
		width: 1.25rem;
		height: 1.25rem;
		margin-right: -0.3rem;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--color-ink-muted);
		cursor: pointer;
	}
	.chip:hover .take-off,
	.chip:focus-within .take-off {
		display: inline-grid;
	}
	.take-off:hover {
		color: var(--color-ink);
	}
	.person {
		gap: 0.35rem;
		padding-left: 0.2rem;
	}
	.initials {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 1.5rem;
		height: 1.5rem;
		border: 1px solid var(--color-line);
		border-radius: 999px;
		background: var(--color-paper);
		font-size: 0.7rem;
		font-weight: var(--font-weight-semibold);
	}
	.alert {
		display: inline-flex;
		color: var(--color-ink-muted);
	}
	.mine {
		box-shadow: inset 0 0 0 1.5px var(--color-link);
		cursor: pointer;
	}
	.mine .alert {
		color: var(--color-link);
	}
	.plus {
		display: inline-grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: 1px dashed var(--color-control-border);
		border-radius: 999px;
		background: transparent;
		color: var(--color-ink-muted);
		cursor: pointer;
	}
	.plus:hover {
		border-style: solid;
		color: var(--color-ink);
	}
	.adding {
		padding-right: 0.2rem;
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--color-link);
	}
	.adding input {
		width: 6rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
	}
	.adding .at {
		color: var(--color-ink-muted);
	}
	.adding .ok,
	.adding .no {
		display: inline-grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--color-ink-muted);
		cursor: pointer;
	}
	.adding .ok {
		background: var(--color-link);
		color: var(--color-paper);
	}
	.end {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin-left: auto;
	}
	.end .icon-button {
		min-width: 2.25rem;
		min-height: 2.25rem;
	}
	.count {
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
		white-space: nowrap;
	}
	.pill {
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		background: var(--color-link);
		color: var(--color-paper);
		font-size: 0.75rem;
		white-space: nowrap;
	}
	.menu-root {
		position: relative;
		display: inline-flex;
	}
	.menu {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 0;
		z-index: 5;
		min-width: 13rem;
		padding: 0.3rem;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		box-shadow: 0 var(--space-1) var(--space-3) color-mix(in srgb, var(--color-ink) 20%, transparent);
		white-space: normal;
	}
	.menu-end {
		left: auto;
		right: 0;
	}
	.menu-head {
		margin: 0;
		padding: 0.35rem 0.6rem 0.25rem;
		color: var(--color-ink-muted);
		font-size: 0.75rem;
	}
	.menu-note {
		margin: 0;
		padding: 0.45rem 0.6rem;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}
	.item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.45rem 0.6rem;
		border: 0;
		border-radius: var(--radius-control);
		background: none;
		color: var(--color-ink);
		font: inherit;
		font-size: var(--font-size-small);
		text-align: left;
		cursor: pointer;
	}
	.item:hover,
	.item.on {
		background: var(--color-surface);
	}
	.item .tick {
		display: inline-flex;
		margin-left: auto;
		color: var(--color-link);
	}
	.menu hr {
		margin: 0.3rem 0;
		border: 0;
		border-top: 1px solid var(--color-line);
	}
	.new-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		padding: var(--space-2) 0;
		border-top: 1px solid var(--color-line);
	}
	.segments {
		display: inline-flex;
		margin: 0;
		padding: 2px;
		border: 0;
		border-radius: 999px;
		background: var(--color-surface);
	}
	.segments label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
		cursor: pointer;
	}
	.segments label.on {
		background: var(--color-paper);
		color: var(--color-ink);
		box-shadow: 0 1px 2px color-mix(in srgb, var(--color-ink) 12%, transparent);
	}
	.segments label:focus-within {
		box-shadow: 0 0 0 3px var(--color-focus);
	}
	.field-inline {
		display: inline-flex;
		align-items: center;
		height: 2.1rem;
		padding: 0 0.6rem;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		font-size: var(--font-size-small);
	}
	.field-inline:focus-within {
		box-shadow: 0 0 0 3px var(--color-focus);
	}
	.field-inline input {
		width: 5.5rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		box-shadow: none;
	}
	.owner :global(.dropdown) {
		margin: 0;
	}
	.go,
	.stop {
		display: inline-grid;
		place-items: center;
		width: 2.1rem;
		height: 2.1rem;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: none;
		color: var(--color-ink-muted);
		cursor: pointer;
	}
	.go {
		background: var(--color-action);
		color: var(--color-action-text);
	}
	@media (max-width: 40rem) {
		.line-two {
			padding-left: 0;
		}
		.count {
			display: none;
		}
	}
</style>
