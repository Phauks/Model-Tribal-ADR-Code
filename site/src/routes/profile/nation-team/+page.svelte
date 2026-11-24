<script lang="ts">
	// Asking to edit a nation's page, in four steps with a step bar (design/nation-editors,
	// screen 1, approved by Trevor on Nov. 23, 2026). All four steps are one form: without
	// scripts they show one under the other and the form is sent the same way.
	import { onMount } from 'svelte';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import FileDropField from '#lib/components/FileDropField.svelte';
	import {
		applicationStatusLabels,
		describeParts,
		pagePartLabels,
		proofRouteLabels,
		proofRoutes,
		teamLevelLabels,
		type PagePart
	} from '#lib/nation-teams.ts';
	import { teamAnswerDays } from '#lib/nation-team-reports.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const errors: Record<string, string> = $derived(form && 'errors' in form ? (form.errors ?? {}) : {});
	const values: Record<string, string> = $derived(
		form && 'values' in form ? ((form.values as Record<string, string>) ?? {}) : {}
	);

	const steps = ['Your nation', 'Who chose you', 'We check with your nation', 'Check your answers'] as const;
	/** Which step each answer is asked in, so a problem opens its step. */
	const stepOf: Record<string, number> = { nation: 0, name: 0, route: 1, proof: 1, office: 1, parts: 1, details: 2 };

	const proofHints: Record<(typeof proofRoutes)[number], string> = {
		letter: 'On the nation’s letterhead, naming you and what you may update.',
		resolution: 'For example, a council resolution naming the office that keeps the page.',
		office: 'Such as chair, clerk of court or legal counsel. We confirm with the office listed for the nation before you can edit.'
	};

	/** The choices for which parts, as the approved mockup words them. */
	const scopes: { value: 'whole' | PagePart; label: string }[] = [
		{ value: 'whole', label: 'All of the page' },
		{ value: 'courts-and-dispute-resolution', label: `${pagePartLabels['courts-and-dispute-resolution']} only` },
		{ value: 'contacts', label: `${pagePartLabels.contacts} only` }
	];

	// svelte-ignore state_referenced_locally
	let nation = $state(values.nation ?? data.chosenNation);
	// svelte-ignore state_referenced_locally
	let name = $state(values.name ?? '');
	// svelte-ignore state_referenced_locally
	let route = $state(values.route ?? '');
	// svelte-ignore state_referenced_locally
	let office = $state(values.office ?? '');
	// svelte-ignore state_referenced_locally
	let scope = $state(values.scope ?? 'whole');
	// svelte-ignore state_referenced_locally
	let details = $state(values.details ?? '');
	let proofName = $state('');
	let scripted = $state(false);
	let step = $state(0);
	let problem = $state('');

	onMount(() => {
		scripted = true;
		const withError = Object.keys(errors).map((key) => stepOf[key] ?? 0);
		if (withError.length > 0) step = Math.min(...withError);
	});

	function nationTitle(identifier: string): string {
		return data.nations.find((found) => found.identifier === identifier)?.title ?? identifier;
	}

	function the(title: string): string {
		return /^the\s/i.test(title) ? title : `the ${title}`;
	}

	function date(value: string | null): string {
		return value ? new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '';
	}

	/** What is still missing before leaving a step, as one sentence, or empty. */
	function missing(index: number): string {
		if (index === 0) {
			if (!nation) return 'Choose your nation.';
			if (!name.trim()) return 'Give the name the nation’s office will know you by.';
		}
		if (index === 1) {
			if (!route) return 'Choose how your nation chose you.';
			if ((route === 'letter' || route === 'resolution') && !proofName) return 'Upload the letter or resolution.';
			if (!office.trim()) return 'Give your title or office at the nation.';
		}
		return '';
	}

	function go(index: number): void {
		// Forward only past steps that are answered; back at any time.
		for (let earlier = step; earlier < index; earlier += 1) {
			problem = missing(earlier);
			if (problem) {
				step = earlier;
				return;
			}
		}
		problem = '';
		step = index;
		document.getElementById('steps')?.scrollIntoView({ block: 'nearest' });
	}

	function checkBeforeSending(event: SubmitEvent): void {
		for (const index of [0, 1]) {
			problem = missing(index);
			if (problem) {
				event.preventDefault();
				step = index;
				return;
			}
		}
	}

	function proofChanged(event: Event): void {
		const target = event.target as HTMLInputElement | null;
		if (target?.type === 'file') proofName = target.files?.[0]?.name ?? '';
	}
</script>

<svelte:head>
	<title>Ask to edit your nation’s page · Model Tribal ADR Code</title>
</svelte:head>

<p class="small"><a href="/profile">Your profile</a></p>
<h1>Ask to edit your nation’s page</h1>
<p class="lede">
	A nation’s page can be kept up to date by the people the nation chooses. Once your nation confirms you, your changes go live right away, labeled as coming from the nation. Your team also answers readers who write to it about the page; if nobody answers within {teamAnswerDays} days, the project steps in.
</p>

{#if form && 'sent' in form}
	<div class="notice" role="status">
		<p>
			<strong>Your request is sent. Its reference is {form.sent}.</strong> We now write to your nation’s office to confirm it. You will see the answer on this page.
		</p>
	</div>
{:else if form && 'withdrawn' in form}
	<div class="notice" role="status"><p>Request {form.withdrawn} is withdrawn.</p></div>
{:else if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if Object.keys(errors).length > 0}
	<div class="notice notice-problem" role="alert"><p>Some answers need a change. They are marked below.</p></div>
{/if}

{#if data.places.length > 0}
	<section aria-labelledby="places-heading">
		<h2 id="places-heading">Your places on nations’ teams</h2>
		<ul>
			{#each data.places as place (place.identifier)}
				<li>
					<a href="/workspace/nation-teams/{place.nationIdentifier}">{nationTitle(place.nationIdentifier)}</a>:
					{teamLevelLabels[place.level]}, {describeParts(place.parts)}, until {date(place.expiresAt)}.
					<a href="/workspace/nation-teams/{place.nationIdentifier}/edit">Edit the page</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if scripted}
	<ol class="steps" id="steps" aria-label="Steps">
		{#each steps as label, index (label)}
			<li>
				<button type="button" class="step" class:current={step === index} aria-current={step === index ? 'step' : undefined} onclick={() => go(index)}>
					{index + 1}. {label}
				</button>
			</li>
		{/each}
	</ol>
{/if}

<div class="columns">
	<form method="post" action="?/send" enctype="multipart/form-data" class="ask" onchange={proofChanged} onsubmit={checkBeforeSending} novalidate={scripted}>
		{#if problem}<p class="field-error" role="alert">{problem}</p>{/if}

		<fieldset class="step-panel" hidden={scripted && step !== 0}>
			<legend class:visually-hidden={scripted}>1. Your nation</legend>
			<div class="field">
				<label for="nation">Your nation</label>
				{#if errors.nation}<p class="field-error" id="nation-error">{errors.nation}</p>{/if}
				<select id="nation" name="nation" required bind:value={nation} aria-invalid={Boolean(errors.nation)} aria-describedby={errors.nation ? 'nation-error' : undefined}>
					<option value="">Choose your nation</option>
					{#each data.nations as option (option.identifier)}
						<option value={option.identifier}>{option.title}</option>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="name">Your name</label>
				<p class="hint" id="name-hint">As the nation’s office knows you.</p>
				{#if errors.name}<p class="field-error">{errors.name}</p>{/if}
				<input type="text" id="name" name="name" autocomplete="name" required bind:value={name} aria-describedby="name-hint" aria-invalid={Boolean(errors.name)} />
			</div>
		</fieldset>

		<div class="step-panel" hidden={scripted && step !== 1}>
			<fieldset>
				<legend>How did your nation choose you?</legend>
				<p class="hint">Pick the one that fits. Any of them works; we always confirm with the nation’s office as well.</p>
				{#if errors.route}<p class="field-error">{errors.route}</p>{/if}
				{#each proofRoutes as option (option)}
					<label class="choice-card">
						<input type="radio" name="route" value={option} required bind:group={route} />
						<span>
							<strong>{proofRouteLabels[option]}</strong>
							<span class="hint">{proofHints[option]}</span>
						</span>
					</label>
				{/each}
			</fieldset>

			<div class="field" hidden={scripted && route === 'office'}>
				<label for="proof">Upload the letter or resolution</label>
				{#if errors.proof}<p class="field-error" id="proof-error">{errors.proof}</p>{/if}
				<FileDropField
					id="proof"
					name="proof"
					accept="application/pdf,image/png,image/jpeg,image/webp"
					what="a PDF or photo"
					hint="Kept private. Never published or put in the public record."
					invalid={Boolean(errors.proof)}
					describedBy={errors.proof ? 'proof-error' : undefined}
				/>
			</div>

			<div class="field">
				<label for="office">Your title or office</label>
				{#if errors.office}<p class="field-error">{errors.office}</p>{/if}
				<input type="text" id="office" name="office" required bind:value={office} placeholder="Court administrator, Judicial Branch" aria-invalid={Boolean(errors.office)} />
			</div>

			<fieldset>
				<legend>Which parts may you update?</legend>
				<p class="hint">Your nation can widen or narrow this later.</p>
				<div class="chips">
					{#each scopes as option (option.value)}
						<label class="choice-chip">
							<input type="radio" name="scope" value={option.value} bind:group={scope} />
							<span>{option.label}</span>
						</label>
					{/each}
				</div>
			</fieldset>
		</div>

		<fieldset class="step-panel" hidden={scripted && step !== 2}>
			<legend class:visually-hidden={scripted}>3. We check with your nation</legend>
			<p>
				We write to {nation ? the(nationTitle(nation)) : 'your nation'} through the contact already listed for its government, never through an address given here. You can edit once its office says yes.
			</p>
			<div class="field">
				<label for="details">Anything else we should know</label>
				<p class="hint" id="details-hint">Optional. For example, a link to a public resolution.</p>
				<textarea id="details" name="details" rows="4" bind:value={details} aria-describedby="details-hint"></textarea>
			</div>
		</fieldset>

		<div class="step-panel" hidden={scripted && step !== 3}>
			{#if scripted}
				<dl class="summary-list">
					<div><dt>Your nation</dt><dd>{nation ? nationTitle(nation) : ''} <button class="link-button" type="button" onclick={() => go(0)}>Change<span class="visually-hidden"> your nation</span></button></dd></div>
					<div><dt>Your name</dt><dd>{name} <button class="link-button" type="button" onclick={() => go(0)}>Change<span class="visually-hidden"> your name</span></button></dd></div>
					<div><dt>How your nation chose you</dt><dd>{route ? proofRouteLabels[route as (typeof proofRoutes)[number]] : ''}{#if proofName}<br /><span class="small muted">{proofName}</span>{/if} <button class="link-button" type="button" onclick={() => go(1)}>Change<span class="visually-hidden"> how your nation chose you</span></button></dd></div>
					<div><dt>Your title or office</dt><dd>{office} <button class="link-button" type="button" onclick={() => go(1)}>Change<span class="visually-hidden"> your title or office</span></button></dd></div>
					<div><dt>Parts you may update</dt><dd>{scopes.find((option) => option.value === scope)?.label} <button class="link-button" type="button" onclick={() => go(1)}>Change<span class="visually-hidden"> the parts</span></button></dd></div>
					{#if details.trim()}<div><dt>Anything else</dt><dd>{details} <button class="link-button" type="button" onclick={() => go(2)}>Change<span class="visually-hidden"> what else we should know</span></button></dd></div>{/if}
				</dl>
			{/if}
			<button class="button" type="submit">Send the request</button>
		</div>

		{#if scripted && step < 3}
			<div class="step-buttons">
				<button class="button" type="button" onclick={() => go(step + 1)}>Continue</button>
				{#if step > 0}<button class="button button-quiet" type="button" onclick={() => go(step - 1)}>Back</button>{/if}
			</div>
		{/if}
	</form>

	<aside class="panel confirm" aria-labelledby="confirm-heading">
		<h2 id="confirm-heading"><ShieldCheck size={20} aria-hidden="true" />How we confirm</h2>
		<p>
			Before you can edit, we write to {nation ? the(nationTitle(nation)) : 'your nation'} through the contact listed for its government in the Tribal Leaders Directory, not through any address you give us.
		</p>
		<p>The office sees your name, title and what you asked to update, and can say yes or no.</p>
		<p>The office is also told each time someone is added or removed, and gets a short summary of changes each week.</p>
	</aside>
</div>

{#if data.applications.length > 0}
	<section aria-labelledby="sent-heading">
		<h2 id="sent-heading">Requests you have sent</h2>
		<dl class="summary-list">
			{#each data.applications as application (application.identifier)}
				<div>
					<dt>{nationTitle(application.nationIdentifier)} <span class="small muted">({application.reference}, {date(application.submittedAt)})</span></dt>
					<dd>
						{applicationStatusLabels[application.status]}
						{#if application.status === 'declined' && application.decisionNote}
							<p class="small">{application.decisionNote}</p>
						{/if}
						{#if application.status === 'received' || application.status === 'confirming-with-nation'}
							<form method="post" action="?/withdraw">
								<input type="hidden" name="reference" value={application.reference} />
								<button class="button button-quiet" type="submit">Withdraw this request</button>
							</form>
						{/if}
					</dd>
				</div>
			{/each}
		</dl>
	</section>
{/if}

<style>
	.lede {
		color: var(--color-ink-muted);
	}

	.steps {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: var(--space-4) 0 var(--space-5);
		padding: 0;
		list-style: none;
	}

	.step {
		min-height: var(--layout-target-minimum);
		padding: var(--space-1) var(--space-3);
		border: 0;
		border-radius: 999px;
		background: var(--color-surface);
		color: var(--color-ink-muted);
		font: inherit;
		font-size: var(--font-size-small);
		cursor: pointer;
	}

	.step.current {
		background: var(--color-band);
		color: var(--color-band-text);
		font-weight: var(--font-weight-semibold);
	}

	.columns {
		display: grid;
		gap: var(--space-5) var(--space-6);
	}

	@media (min-width: 60rem) {
		.columns {
			grid-template-columns: minmax(0, 1fr) minmax(16rem, 21rem);
			align-items: start;
		}
	}

	.ask {
		min-width: 0;
	}

	fieldset {
		border: 0;
		padding: 0;
		margin: 0 0 var(--space-4);
		min-width: 0;
	}

	legend {
		padding: 0;
	}

	#office {
		max-width: none;
	}

	.step-panel > fieldset:last-child {
		margin-bottom: 0;
	}

	[hidden] {
		display: none !important;
	}

	select {
		min-width: min(100%, 22rem);
	}

	.choice-card {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		margin: var(--space-2) 0;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		cursor: pointer;
	}

	.choice-card:has(input:checked) {
		border-color: var(--color-band);
		box-shadow: inset 0 0 0 1px var(--color-band);
	}

	.choice-card input {
		margin-top: 0.3em;
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
		accent-color: var(--color-band);
	}

	.choice-card .hint {
		display: block;
		margin: var(--space-1) 0 0;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.choice-chip {
		position: relative;
		display: inline-flex;
		align-items: center;
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: 999px;
		background: var(--color-surface);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	.choice-chip input {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
		cursor: pointer;
	}

	.choice-chip:has(input:checked) {
		border-color: var(--color-link);
		background: var(--color-notice-background);
		color: var(--color-band);
	}

	.choice-chip:has(input:focus-visible) {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: 2px;
	}

	.step-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-top: var(--space-5);
	}

	.link-button {
		margin-left: var(--space-2);
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-link);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	.confirm {
		margin: 0;
		background: var(--color-notice-background);
		border-color: var(--color-line);
	}

	.confirm h2 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--font-size-body);
		color: var(--color-link);
	}
</style>
