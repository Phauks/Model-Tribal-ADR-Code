<!--
	The Credits popover under a section heading in the editor, as in the
	approved credits mockup (essay-editor/screenshots/attest-proposal-mockup.png,
	chosen by the lead author on Nov. 24, 2026): who wrote and edited the
	section from the edit history, who is reviewing it or reviewed it, the
	credits added by hand, and, for someone with full access, a way to add
	someone. It is a native popover, so Escape and a click elsewhere close it.
-->
<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import PersonAvatar from '#lib/components/essays/PersonAvatar.svelte';
	import { creditRoleChoices, creditRoleDoings, creditRoles, type CreditRole, type EssayCredits, type HistoryCredit } from '#lib/essays/credits.ts';
	import { essayDateRange, essayShortDate } from '#lib/essays/dates.ts';
	import { dueDate, isOpen, type ReviewRequest } from '#lib/essays/review-requests.ts';
	import { sendJson } from '#lib/send-json.ts';

	let {
		essay,
		credits,
		requests,
		onchange
	}: {
		essay: string;
		credits: EssayCredits | null;
		requests: ReviewRequest[];
		onchange: (credits: EssayCredits) => void;
	} = $props();

	let panel: HTMLDivElement | undefined = $state();
	let section = $state<{ slug: string; title: string; level: 2 | 3 } | null>(null);
	let anchor: HTMLElement | null = null;
	let place = $state({ top: 0, left: 0 });
	let person = $state('');
	let role = $state<CreditRole>('researched');
	let busy = $state(false);
	let problem = $state('');
	/** When the popover last closed, and for which section, so a click on its own button closes it rather than opening it again. */
	let lastClosed = { slug: '', at: 0 };

	const history = $derived(credits?.sections.find((candidate) => candidate.slug === section?.slug));
	const hand = $derived((credits?.hand ?? []).filter((credit) => credit.sectionSlug === section?.slug));
	const reviews = $derived.by(() => {
		const rows: { person: string; name: string; text: string; done: boolean }[] = [];
		for (const request of requests) {
			if (request.sectionSlug !== section?.slug) continue;
			for (const reviewer of request.reviewers) {
				if (reviewer.doneAt) rows.push({ person: reviewer.personIdentifier, name: reviewer.personName, text: essayShortDate(reviewer.doneAt), done: true });
				else if (isOpen(request)) rows.push({ person: reviewer.personIdentifier, name: reviewer.personName, text: request.dueOn ? `due ${dueDate(request.dueOn)}` : '', done: false });
			}
		}
		return rows;
	});

	function placeBelow(): void {
		if (!anchor?.isConnected || !panel) return;
		const box = anchor.getBoundingClientRect();
		const line = (anchor.closest('.essay-credits') as HTMLElement | null)?.getBoundingClientRect() ?? box;
		const width = panel.offsetWidth || 544;
		place = { top: box.bottom + 8, left: Math.max(8, Math.min(line.left, window.innerWidth - width - 8)) };
	}

	/** Opens the popover for a section, under its Credits button. */
	export function show(chosen: { slug: string; title: string; level: 2 | 3 }, button: HTMLElement): void {
		if (lastClosed.slug === chosen.slug && performance.now() - lastClosed.at < 300) return;
		section = chosen;
		anchor = button;
		problem = '';
		person = '';
		panel?.showPopover();
		placeBelow();
		requestAnimationFrame(placeBelow);
	}

	function toggled(event: ToggleEvent): void {
		if (event.newState === 'closed') {
			lastClosed = { slug: section?.slug ?? '', at: performance.now() };
			anchor?.focus({ preventScroll: true });
		} else {
			panel?.focus({ preventScroll: true });
		}
	}

	function wroteText(credit: HistoryCredit, total: number): string {
		const when = credit.wordsFrom && credit.wordsTo ? `, ${essayDateRange(credit.wordsFrom, credit.wordsTo)}` : '';
		return `${credit.words} of the ${total} words now here${when}`;
	}

	function editedText(credit: HistoryCredit): string {
		const when = credit.changedFrom && credit.changedTo ? `, ${essayDateRange(credit.changedFrom, credit.changedTo)}` : '';
		const paragraphs = credit.paragraphs === 1 ? '1 paragraph' : `${credit.paragraphs} paragraphs`;
		return credit.paragraphs > 0 ? `changed ${paragraphs}${when}` : `${credit.words} words now here${when}`;
	}

	async function change(body: { person: string; role: CreditRole; action: 'add' | 'remove' }): Promise<void> {
		if (!section) return;
		busy = true;
		problem = '';
		const sent = await sendJson<EssayCredits>(
			`/workspace/essays/${essay}/credits`,
			'POST',
			{ ...body, slug: section.slug, title: section.title },
			{ complete: (answer) => !!answer.sections }
		);
		busy = false;
		if (!sent.ok) {
			problem = sent.problem;
			return;
		}
		if (body.action === 'add') person = '';
		onchange(sent.answer);
	}
</script>

<svelte:window onscroll={placeBelow} onresize={placeBelow} />

<div
	bind:this={panel}
	class="credits-popover"
	popover="auto"
	role="dialog"
	aria-labelledby="credits-popover-title"
	tabindex="-1"
	style:top="{place.top}px"
	style:left="{place.left}px"
	ontoggle={toggled}
>
	{#if section}
		<h2 id="credits-popover-title">Credits for “{section.title}”</h2>
		<div class="group">
			<p class="label">From the edit history</p>
			{#if !credits}
				<p class="none">Loading.</p>
			{:else if !history}
				<p class="none">Not in a saved version yet.</p>
			{:else if history.history.length === 0}
				<p class="none">None Identified.</p>
			{:else}
				{#each history.history as credit (credit.person)}
					<div class="row">
						<PersonAvatar name={credit.name} size="small" />
						<strong>{credit.name}</strong>
						<span class="what"
							><b>{creditRoleDoings[credit.role]}</b>: {credit.role === 'wrote' ? wroteText(credit, history.total) : editedText(credit)}</span
						>
					</div>
				{/each}
			{/if}
		</div>
		{#if reviews.length > 0}
			<div class="group">
				<p class="label">From review requests</p>
				{#each reviews as review (review.person)}
					<div class="row">
						<PersonAvatar name={review.name} size="small" />
						<strong>{review.name}</strong>
						{#if review.done}
							<span class="what"><b>Reviewed it</b>, {review.text}</span>
						{:else}
							<span class="what"><b>Reviewing</b>{review.text ? `, ${review.text}` : ''}. Becomes “Reviewed by” on Done reviewing.</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
		{#if hand.length > 0 || credits?.canAdd}
			<div class="group">
				<p class="label">Added by hand</p>
				{#each hand as credit (credit.identifier)}
					<div class="row">
						<PersonAvatar name={credit.name} size="small" />
						<strong>{credit.name}</strong>
						<span class="what"
							><b>{creditRoleDoings[credit.role]}</b>, added by {credit.addedByName}, {essayShortDate(credit.addedAt)}{#if credits?.canAdd}{' · '}<button type="button" class="link-button" disabled={busy} onclick={() => change({ person: credit.person, role: credit.role, action: 'remove' })}>Remove</button
								>{/if}</span
						>
					</div>
				{/each}
				{#if credits?.canAdd}
					<form
						class="add"
						onsubmit={(event) => {
							event.preventDefault();
							if (person) void change({ person, role, action: 'add' });
						}}
					>
						<select bind:value={person} aria-label="Person" required>
							<option value="" disabled>Choose a person…</option>
							{#each credits.people as candidate (candidate.identifier)}
								<option value={candidate.identifier}>{candidate.name}</option>
							{/each}
						</select>
						<select bind:value={role} aria-label="What they did">
							{#each creditRoles as choice (choice)}
								<option value={choice}>{creditRoleChoices[choice]}</option>
							{/each}
						</select>
						<button type="submit" class="button add-button" disabled={busy || !person}><Plus size={15} aria-hidden="true" /> Add</button>
					</form>
				{/if}
				{#if problem}<p class="field-error" role="alert">{problem}</p>{/if}
			</div>
		{/if}
		<p class="foot">Readers see a name only when that person chose to show it, once, in <a href="/profile">Your account</a>.</p>
	{/if}
</div>

<style>
	.credits-popover {
		position: fixed;
		inset: auto;
		width: min(34rem, calc(100vw - 1rem));
		max-height: calc(100dvh - 2rem);
		overflow-y: auto;
		box-sizing: border-box;
		margin: 0;
		padding: var(--space-4);
		background: var(--color-surface-raised);
		color: var(--color-ink);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		box-shadow: 0 var(--space-2) var(--space-5) color-mix(in srgb, var(--color-ink) 25%, transparent);
		font-size: var(--font-size-small);
		line-height: 1.4;
	}

	.credits-popover:focus {
		outline: none;
	}

	h2 {
		margin: 0 0 var(--space-3);
		font-size: 1rem;
		font-weight: var(--font-weight-semibold);
	}

	.group {
		margin: 0 0 var(--space-3);
	}

	.label {
		margin: 0 0 var(--space-1);
		font-size: 0.72rem;
		font-weight: var(--font-weight-semibold);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-ink-muted);
	}

	.none {
		margin: 0;
		color: var(--color-ink-muted);
	}

	.row {
		display: grid;
		grid-template-columns: 1.6rem 9.5rem 1fr;
		align-items: center;
		gap: var(--space-2);
		padding: 0.3rem 0;
	}

	.row strong {
		font-weight: var(--font-weight-semibold);
	}

	.what {
		color: var(--color-ink-muted);
	}

	.what b {
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}

	.link-button {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	.add {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	/* Compact, as in the approved mockup; a full-size target where the pointer is a finger. */
	select {
		min-height: 2.25rem;
		font: inherit;
		padding: 0.25rem var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.add-button {
		gap: var(--space-1);
		min-height: 0;
		padding: 0.15rem var(--space-2);
		border-width: 1px;
		font-size: var(--font-size-small);
	}

	@media (pointer: coarse) {
		select,
		.add-button {
			min-height: var(--layout-target-minimum);
		}
	}

	.foot {
		margin: var(--space-3) 0 0;
		padding-top: var(--space-2);
		border-top: 1px solid var(--color-line);
		color: var(--color-ink-muted);
	}

	.foot a {
		color: inherit;
	}

	@media (max-width: 40rem) {
		.row {
			grid-template-columns: 1.6rem 1fr;
		}

		.what {
			grid-column: 2;
		}
	}
</style>
