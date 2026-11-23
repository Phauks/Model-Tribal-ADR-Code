<script lang="ts">
	import {
		applicationStatusLabels,
		describeParts,
		pagePartLabels,
		pageParts,
		proofRouteLabels,
		teamLevelDescriptions,
		teamLevelLabels,
		teamLevels
	} from '#lib/nation-teams.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const application = $derived(data.application);
	const isOpen = $derived(application.status === 'received' || application.status === 'confirming-with-nation');
	let scope = $state<'whole' | 'parts'>('whole');

	function date(value: string | null): string {
		return value ? new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '';
	}
</script>

<svelte:head>
	<title>Request {application.reference} · Nation teams · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<p class="small"><a href="/workspace/nation-teams">Nation teams</a></p>
<h1>Request {application.reference}</h1>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

<dl class="summary-list">
	<div><dt>Nation</dt><dd>{#if data.nationPage}<a href={data.nationPage}>{data.nationTitle}</a>{:else}{data.nationTitle}{/if}</dd></div>
	<div><dt>Person</dt><dd>{application.displayName}, {application.email}</dd></div>
	<div><dt>Title or office</dt><dd>{application.office}</dd></div>
	<div><dt>How the nation chose them</dt><dd>{proofRouteLabels[application.route]}</dd></div>
	<div>
		<dt>Proof</dt>
		<dd>
			{#if application.hasProof}
				<a href="/workspace/nation-teams/requests/{application.reference}/proof">Download {application.proofName}</a>
				<span class="small muted">(always downloaded, never opened in the site)</span>
			{:else}
				None sent
			{/if}
		</dd>
	</div>
	<div><dt>Parts asked for</dt><dd>{describeParts(application.parts)}</dd></div>
	{#if application.details}<div><dt>Anything else</dt><dd>{application.details}</dd></div>{/if}
	<div><dt>Sent</dt><dd>{date(application.submittedAt)}</dd></div>
	<div>
		<dt>Status</dt>
		<dd>
			{applicationStatusLabels[application.status]}
			{#if application.officeContact}<p class="small">Wrote to {application.officeContact} on {date(application.officeContactedAt)}.</p>{/if}
			{#if application.decidedAt}<p class="small">{application.decidedByName ?? 'The person'}, {date(application.decidedAt)}{#if application.decisionNote}: {application.decisionNote}{/if}</p>{/if}
		</dd>
	</div>
	<div>
		<dt>Team now</dt>
		<dd>
			{#if data.team.length === 0}
				Nobody yet
			{:else}
				{data.team.map((place) => `${place.personName} (${teamLevelLabels[place.level].toLocaleLowerCase('en-US')})`).join(', ')}
			{/if}
		</dd>
	</div>
</dl>

{#if isOpen}
	<form method="post" action="?/confirming" class="panel">
		<h2>1. Write to the nation’s office</h2>
		<p>
			Use a contact the project already had for the nation: its own website, the Tribal Leaders Directory of
			the Bureau of Indian Affairs, or a state’s list of the Tribes it recognizes, as listed on the nation’s
			page. Never use an address or phone number the person gave. Ask the office to confirm the person, their
			title and the parts asked for.
		</p>
		{#if data.representatives.length > 0 || data.officeContacts.length > 0}
			<dl class="summary-list">
				{#if data.representatives.length > 0}
					<div>
						<dt>Offices official lists name</dt>
						<dd>
							<ul>
								{#each data.representatives as representative, index (index)}
									<li>
										{representative.office}, listed by
										<a href={representative.link} target="_blank" rel="noopener noreferrer"
											>{representative.listedBy}<span class="visually-hidden"> (opens in a new tab)</span></a
										>{#if representative.listedAs}{' '}under “{representative.listedAs}”{/if}
									</li>
								{/each}
							</ul>
						</dd>
					</div>
				{/if}
				{#if data.officeContacts.length > 0}
					<div>
						<dt>Office email and phone on the nation’s page</dt>
						<dd>
							<ul>
								{#each data.officeContacts as contact, index (index)}
									<li>{contact.value} <span class="small muted">({contact.sourceTitle})</span></li>
								{/each}
							</ul>
						</dd>
					</div>
				{/if}
			</dl>
		{:else}
			<p class="small muted">No official list names an office for this nation, and its page shows no office email or phone. Use its own website.</p>
		{/if}
		<div class="field">
			<label for="contact">Which contact you wrote to</label>
			<input type="text" id="contact" name="contact" required value={application.officeContact ?? ''} />
		</div>
		<div class="choice">
			<input type="checkbox" id="listed" name="listed" value="yes" required />
			<label for="listed">This contact was already listed for the nation, not given by the person asking</label>
		</div>
		<button class="button button-quiet" type="submit">Record that you wrote</button>
	</form>

	<form method="post" action="?/confirm" class="panel">
		<h2>2. The office confirmed: add them to the team</h2>
		<fieldset>
			<legend>Level</legend>
			{#each teamLevels as level (level)}
				<div class="choice">
					<input type="radio" id="level-{level}" name="level" value={level} checked={level === 'steward'} />
					<label for="level-{level}">{teamLevelLabels[level]} <span class="hint">{teamLevelDescriptions[level]}</span></label>
				</div>
			{/each}
		</fieldset>
		<fieldset>
			<legend>Parts of the page</legend>
			<div class="choice">
				<input type="radio" id="scope-whole" name="scope" value="whole" bind:group={scope} />
				<label for="scope-whole">The whole page</label>
			</div>
			<div class="choice">
				<input type="radio" id="scope-parts" name="scope" value="parts" bind:group={scope} />
				<label for="scope-parts">Only some parts</label>
			</div>
			{#if scope === 'parts'}
				{#each pageParts as part (part)}
					<div class="choice indented">
						<input type="checkbox" id="part-{part}" name="parts" value={part} checked={application.parts?.includes(part) ?? false} />
						<label for="part-{part}">{pagePartLabels[part]}</label>
					</div>
				{/each}
			{/if}
		</fieldset>
		<div class="field">
			<label for="expires">Until</label>
			<p class="hint">Two years at most. The person and the office are asked to renew before it ends.</p>
			<input type="date" id="expires" name="expires" required value={data.usualEnd} />
		</div>
		<div class="field">
			<label for="basis">How the nation confirmed it</label>
			<p class="hint">Shown to the nation’s team, for example “Letter of Nov. 18, 2026, confirmed by the Office of the President by email on Nov. 20.”</p>
			<input type="text" id="basis" name="basis" required />
		</div>
		<button class="button" type="submit">Confirm and add to the team</button>
	</form>

	<form method="post" action="?/decline" class="panel">
		<h2>Or decline</h2>
		<div class="field">
			<label for="reason">Reason</label>
			<p class="hint">The person sees this. For example, “The nation’s office did not confirm the request.”</p>
			<textarea id="reason" name="reason" rows="3" required></textarea>
		</div>
		<button class="button button-quiet" type="submit">Decline the request</button>
	</form>
{/if}

<style>
	fieldset {
		border: 0;
		padding: 0;
		margin: 0 0 var(--space-4);
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

	.indented {
		margin-left: var(--space-6);
	}

	input[type='date'] {
		font: inherit;
		min-height: var(--layout-target-minimum);
	}
</style>
