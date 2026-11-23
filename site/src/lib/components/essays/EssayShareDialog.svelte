<!--
	Share an essay draft and ask for review (src/lib/essays/review-requests.ts):
	who can open the essay and at what level, which the lead author can change
	here, and a request to review the whole draft or one section, by a date
	and with a message. Lists the open requests, which their asker can close.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { accessLevelLabels, roleLabels, type AccessLevel, type Role } from '#lib/permissions.ts';
	import { inReviewText, isOpen, type ReviewRequest } from '#lib/essays/review-requests.ts';
	import DateField from '#lib/components/DateField.svelte';

	interface Person {
		identifier: string;
		name: string;
		role: Role;
		level: AccessLevel;
	}

	interface Section {
		slug: string;
		title: string;
		level: number;
	}

	let {
		essay,
		onchange
	}: {
		essay: string;
		onchange: (requests: ReviewRequest[]) => void;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let loaded = $state(false);
	let people = $state<Person[]>([]);
	let others = $state<{ identifier: string; name: string; role: Role }[]>([]);
	let requests = $state<ReviewRequest[]>([]);
	let you = $state<string | null>(null);
	let mayManage = $state(false);
	let mayAsk = $state(false);
	let mayCloseAny = $state(false);
	let sections = $state<Section[]>([]);
	let version = $state<number | null>(null);

	let adding = $state('');
	let addingLevel = $state<AccessLevel>('comment');
	let reviewers = $state<string[]>([]);
	let what = $state('');
	let dueOn = $state('');
	let message = $state('');
	let problem = $state('');
	let notice = $state('');
	let sending = $state(false);

	const open = $derived(requests.filter(isOpen));
	const askable = $derived(people.filter((person) => person.identifier !== you));
	const changeableLevels: AccessLevel[] = ['no-access', 'comment', 'contribute', 'full'];

	/** Opens the dialog, with the essay's sections as they stand and, optionally, one chosen to review. */
	export async function show(options: { sections: Section[]; version: number; section?: string }): Promise<void> {
		sections = options.sections;
		version = options.version;
		what = options.section ?? '';
		reviewers = [];
		dueOn = '';
		message = '';
		problem = '';
		notice = '';
		await tick();
		dialog?.showModal();
		await load();
	}

	async function load(): Promise<void> {
		const response = await fetch(`/workspace/essays/${essay}/sharing`).catch(() => null);
		const body = (await response?.json().catch(() => null)) as {
			people: Person[];
			others: typeof others;
			requests: ReviewRequest[];
			you: string;
			mayManage: boolean;
			mayAsk: boolean;
			mayCloseAny: boolean;
		} | null;
		if (!response?.ok || !body) {
			problem = 'The list of people could not be loaded. Try again.';
			return;
		}
		({ people, others, requests, you, mayManage, mayAsk, mayCloseAny } = body);
		loaded = true;
		onchange(requests);
	}

	async function send(method: string, payload: unknown, query = ''): Promise<Record<string, unknown> | null> {
		sending = true;
		problem = '';
		notice = '';
		const response = await fetch(`/workspace/essays/${essay}/sharing${query}`, {
			method,
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		}).catch(() => null);
		const body = (await response?.json().catch(() => null)) as Record<string, unknown> | null;
		sending = false;
		if (!response?.ok || !body) {
			problem = (body?.message as string) || 'That did not go through. Try again.';
			return null;
		}
		return body;
	}

	async function setLevel(person: string, level: AccessLevel): Promise<void> {
		const body = await send('PUT', { person, level });
		if (!body) return;
		people = body.people as Person[];
		others = body.others as typeof others;
		reviewers = reviewers.filter((reviewer) => people.some((candidate) => candidate.identifier === reviewer));
	}

	async function add(): Promise<void> {
		if (!adding) return;
		await setLevel(adding, addingLevel);
		adding = '';
	}

	function toggle(person: string): void {
		reviewers = reviewers.includes(person) ? reviewers.filter((chosen) => chosen !== person) : [...reviewers, person];
	}

	async function ask(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (reviewers.length === 0 || sending) return;
		const section = sections.find((candidate) => candidate.slug === what);
		const body = await send('POST', {
			reviewers,
			section: section ? { slug: section.slug, title: section.title } : null,
			dueOn: dueOn || null,
			message,
			version
		});
		if (!body) return;
		requests = body.requests as ReviewRequest[];
		onchange(requests);
		const names = people.filter((person) => reviewers.includes(person.identifier)).map((person) => person.name);
		notice = `Asked ${names.join(' and ')}. They find it on their Review requests page.`;
		reviewers = [];
		message = '';
	}

	async function close(request: ReviewRequest): Promise<void> {
		const body = await send('PATCH', { closed: true }, `?request=${encodeURIComponent(request.identifier)}`);
		if (!body) return;
		requests = body.requests as ReviewRequest[];
		onchange(requests);
	}

	async function copyLink(): Promise<void> {
		const link = `${location.origin}${location.pathname}`;
		try {
			await navigator.clipboard.writeText(link);
			notice = 'Link copied. People who can open the essay see the draft there; readers see only what is published.';
		} catch {
			notice = `The link is ${link}`;
		}
	}
</script>

<dialog bind:this={dialog} class="picker" aria-labelledby="share-heading">
	<h2 id="share-heading">Share this essay</h2>
	{#if !loaded}
		<p class="small muted">{problem || 'Loading…'}</p>
	{:else}
		<section aria-labelledby="share-people-heading">
			<h3 id="share-people-heading" class="small">Who can open the draft</h3>
			{#if mayManage && others.length}
				<p class="row">
					<label class="visually-hidden" for="share-add">Add someone</label>
					<select id="share-add" bind:value={adding} disabled={sending}>
						<option value="">Add someone from the workspace…</option>
						{#each others as person (person.identifier)}
							<option value={person.identifier}>{person.name} ({roleLabels[person.role]})</option>
						{/each}
					</select>
					<label class="visually-hidden" for="share-add-level">Their level</label>
					<select id="share-add-level" bind:value={addingLevel} disabled={sending}>
						{#each changeableLevels.slice(1) as level (level)}<option value={level}>{accessLevelLabels[level]}</option>{/each}
					</select>
					<button class="button" type="button" disabled={sending || !adding} onclick={add}>Add</button>
				</p>
			{/if}
			<ul class="people">
				{#each people as person (person.identifier)}
					<li>
						<span><strong>{person.name}</strong> <span class="small muted">{roleLabels[person.role]}</span></span>
						{#if mayManage && person.role !== 'lead-author'}
							<label class="visually-hidden" for="level-{person.identifier}">Level for {person.name}</label>
							<select id="level-{person.identifier}" value={person.level} disabled={sending} onchange={(event) => setLevel(person.identifier, event.currentTarget.value as AccessLevel)}>
								{#each changeableLevels as level (level)}<option value={level}>{accessLevelLabels[level]}</option>{/each}
							</select>
						{:else}
							<span class="small">{accessLevelLabels[person.level]}</span>
						{/if}
					</li>
				{/each}
			</ul>
			<p class="small muted">
				Comment: reads drafts and comments. Contribute: also edits. Full: also restores and publishes.{#if !mayManage} The lead author changes who can open an essay.{/if}
			</p>
		</section>

		{#if open.length}
			<section aria-labelledby="share-open-heading">
				<h3 id="share-open-heading" class="small">Open review requests</h3>
				<ul class="requests">
					{#each open as request (request.identifier)}
						<li>
							<strong>{request.sectionTitle ?? 'The whole draft'}</strong>: {inReviewText(request)}. <span class="muted">Asked by {request.requestedByName}.</span>
							{#if request.requestedBy === you || mayCloseAny}
								<button class="button button-quiet" type="button" disabled={sending} onclick={() => close(request)}>Close</button>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if mayAsk}
			<form onsubmit={ask} aria-labelledby="share-ask-heading">
				<h3 id="share-ask-heading" class="small">Ask for review</h3>
				{#if askable.length === 0}
					<p class="small muted">No one else can open this essay yet.</p>
				{:else}
					<div class="chips" role="group" aria-label="Who should review">
						{#each askable as person (person.identifier)}
							<button type="button" class="chip" aria-pressed={reviewers.includes(person.identifier)} onclick={() => toggle(person.identifier)}>{person.name}</button>
						{/each}
					</div>
					<div class="pair">
						<div class="field">
							<label for="share-what">What to review</label>
							<select id="share-what" bind:value={what}>
								<option value="">The whole draft</option>
								{#each sections as section (section.slug)}
									<option value={section.slug}>{section.level === 3 ? ' ' : ''}{section.title}</option>
								{/each}
							</select>
						</div>
						<div class="field">
							<label for="share-due">By (optional)</label>
							<DateField id="share-due" bind:value={dueOn} />
						</div>
					</div>
					<div class="field">
						<label for="share-message">Message (optional)</label>
						<textarea id="share-message" rows="2" maxlength="2000" bind:value={message} placeholder="Could you check the holdings in these two cases?"></textarea>
					</div>
					<p class="row">
						<button class="button" type="submit" disabled={sending || reviewers.length === 0}>{sending ? 'Sending…' : 'Send request'}</button>
						<span class="small muted">It shows on their Review requests page and on the essay.</span>
					</p>
				{/if}
			</form>
		{/if}
	{/if}
	{#if problem && loaded}<p class="field-error" role="alert">{problem}</p>{/if}
	{#if notice}<p class="small" role="status">{notice}</p>{/if}
	<p class="row footer">
		<span class="small muted">Readers see only what is published.</span>
		<button class="button button-quiet" type="button" onclick={copyLink}>Copy link</button>
		<button class="button button-quiet" type="button" onclick={() => dialog?.close()}>Close</button>
	</p>
</dialog>

<style>
	/* The same dialog as the editor's pickers (EssayEditor.svelte). */
	.picker {
		width: min(40rem, 100% - 2 * var(--space-4));
		max-height: 85vh;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	section,
	form {
		border-top: 1px solid var(--color-line);
		padding-top: var(--space-2);
		margin-top: var(--space-3);
	}

	h3 {
		margin: 0 0 var(--space-2);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.footer {
		border-top: 1px solid var(--color-line);
		padding-top: var(--space-2);
		margin-top: var(--space-3);
	}

	.footer .small {
		flex: 1;
	}

	.people,
	.requests {
		list-style: none;
		padding: 0;
		margin: 0 0 var(--space-2);
		display: grid;
		gap: var(--space-1);
	}

	.people li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin-bottom: var(--space-2);
	}

	.chip {
		border: 1px solid var(--color-line);
		border-radius: 999px;
		padding: 0.1rem var(--space-2);
		background: var(--color-paper);
		color: var(--color-ink);
		cursor: pointer;
	}

	.chip[aria-pressed='true'] {
		border-color: var(--color-link);
		background: var(--color-surface);
		color: var(--color-link);
		font-weight: var(--font-weight-semibold);
	}

	.chip[aria-pressed='true']::before {
		content: '✓ ';
	}

	.pair {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: var(--space-2);
	}

	@media (max-width: 36rem) {
		.pair {
			grid-template-columns: 1fr;
		}
	}

	select,
	textarea {
		width: 100%;
		max-width: 100%;
	}

	.row select {
		width: auto;
		flex: 1;
	}

	.people select {
		width: auto;
	}
</style>
