<script lang="ts">
	import {
		applicationStatusLabels,
		describeParts,
		pagePartLabels,
		pageParts,
		proofRouteLabels,
		proofRoutes,
		teamLevelLabels
	} from '#lib/nation-teams.ts';
	import { teamAnswerDays } from '#lib/nation-team-reports.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const errors: Record<string, string> = $derived(form && 'errors' in form ? (form.errors ?? {}) : {});
	const values: Record<string, string> = $derived(
		form && 'values' in form ? ((form.values as Record<string, string>) ?? {}) : {}
	);
	let scope = $state<'whole' | 'parts'>('whole');

	const proofHints: Record<(typeof proofRoutes)[number], string> = {
		letter: 'On the nation’s letterhead, naming you and what you may update.',
		resolution: 'For example, a council resolution naming you or the office that keeps the page.',
		office:
			'Such as chair, clerk of court or legal counsel. The project confirms with the office listed for the nation before you can edit.'
	};

	function nationTitle(identifier: string): string {
		return data.nations.find((nation) => nation.identifier === identifier)?.title ?? identifier;
	}

	function date(value: string | null): string {
		return value ? new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '';
	}
</script>

<svelte:head>
	<title>Ask to edit your nation’s page · Model Tribal ADR Code</title>
</svelte:head>

<p class="small"><a href="/profile">Your profile</a></p>
<h1>Ask to edit your nation’s page</h1>
<p>
	A nation’s page can be kept up to date by the people the nation chooses. Once your nation confirms you,
	your changes go live right away, labeled as coming from the nation. The project reads changes after they
	are live. Your team also answers readers who write to it about the page; if nobody answers within
	{teamAnswerDays} days, the project steps in.
</p>

{#if form && 'sent' in form}
	<div class="notice" role="status">
		<p>
			<strong>Your request is sent. Its reference is {form.sent}.</strong> The project will now write to your
			nation’s office to confirm it. You will see the answer on this page.
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

<aside class="panel panel-filled" aria-labelledby="confirm-heading">
	<h2 id="confirm-heading">How the project confirms</h2>
	<p>
		Before you can edit, the project writes to your nation through the contact already listed for its
		government, such as its own website or the Tribal Leaders Directory of the Bureau of Indian Affairs.
		It never uses an address or phone number given in this form.
	</p>
	<p>
		The office sees your name, your title and what you asked to update, and can say yes or no. It is also
		told each time someone joins or leaves your nation’s team.
	</p>
</aside>

<form method="post" action="?/send" enctype="multipart/form-data" class="panel">
	<div class="field">
		<label for="nation">Your nation</label>
		{#if errors.nation}<p class="field-error" id="nation-error">{errors.nation}</p>{/if}
		<select id="nation" name="nation" required aria-invalid={Boolean(errors.nation)} aria-describedby={errors.nation ? 'nation-error' : undefined}>
			<option value="">Choose your nation</option>
			{#each data.nations as nation (nation.identifier)}
				<option value={nation.identifier} selected={(values.nation ?? data.chosenNation) === nation.identifier}>{nation.title}</option>
			{/each}
		</select>
	</div>

	<div class="field">
		<label for="name">Your name</label>
		<p class="hint" id="name-hint">As the nation’s office knows you.</p>
		{#if errors.name}<p class="field-error">{errors.name}</p>{/if}
		<input type="text" id="name" name="name" autocomplete="name" required value={values.name ?? ''} aria-describedby="name-hint" aria-invalid={Boolean(errors.name)} />
	</div>

	<div class="field">
		<label for="office">Your title or office at the nation</label>
		<p class="hint" id="office-hint">For example, court administrator, Judicial Branch.</p>
		{#if errors.office}<p class="field-error">{errors.office}</p>{/if}
		<input type="text" id="office" name="office" required value={values.office ?? ''} aria-describedby="office-hint" aria-invalid={Boolean(errors.office)} />
	</div>

	<fieldset>
		<legend>How did your nation choose you?</legend>
		<p class="hint">Any of these works. The project confirms with the nation’s office as well, every time.</p>
		{#if errors.route}<p class="field-error">{errors.route}</p>{/if}
		{#each proofRoutes as route (route)}
			<div class="choice">
				<input type="radio" id="route-{route}" name="route" value={route} required checked={values.route === route} />
				<label for="route-{route}">
					{proofRouteLabels[route]}
					<span class="hint">{proofHints[route]}</span>
				</label>
			</div>
		{/each}
	</fieldset>

	<div class="field">
		<label for="proof">The letter or resolution</label>
		<p class="hint" id="proof-hint">
			A PDF or photo, up to 10 MB. Kept private: never published and never put in the public record.
		</p>
		{#if errors.proof}<p class="field-error">{errors.proof}</p>{/if}
		<input type="file" id="proof" name="proof" accept="application/pdf,image/png,image/jpeg,image/webp" aria-describedby="proof-hint" />
	</div>

	<fieldset>
		<legend>Which parts of the page may you update?</legend>
		<p class="hint">Your nation can widen or narrow this later.</p>
		{#if errors.parts}<p class="field-error">{errors.parts}</p>{/if}
		<div class="choice">
			<input type="radio" id="scope-whole" name="scope" value="whole" bind:group={scope} />
			<label for="scope-whole">The whole page</label>
		</div>
		<div class="choice">
			<input type="radio" id="scope-parts" name="scope" value="parts" bind:group={scope} />
			<label for="scope-parts">Only some parts</label>
		</div>
		{#if scope === 'parts'}
			<div class="parts">
				{#each pageParts as part (part)}
					<div class="choice">
						<input type="checkbox" id="part-{part}" name="parts" value={part} />
						<label for="part-{part}">{pagePartLabels[part]}</label>
					</div>
				{/each}
			</div>
		{/if}
	</fieldset>

	<div class="field">
		<label for="details">Anything else the project should know</label>
		<p class="hint" id="details-hint">Optional. For example, a link to a public resolution.</p>
		<textarea id="details" name="details" rows="4" aria-describedby="details-hint">{values.details ?? ''}</textarea>
	</div>

	<button class="button" type="submit">Send the request</button>
</form>

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
	fieldset {
		border: 0;
		padding: 0;
		margin: 0 0 var(--space-4);
	}

	select {
		font: inherit;
		min-height: var(--layout-target-minimum);
		max-width: 100%;
	}

	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		margin: var(--space-2) 0;
	}

	.choice input {
		margin-top: 0.3em;
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
	}

	.choice .hint {
		display: block;
		margin: 0;
	}

	.parts {
		margin-left: var(--space-6);
	}
</style>
