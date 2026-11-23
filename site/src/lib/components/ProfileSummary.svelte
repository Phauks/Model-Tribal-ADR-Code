<!--
	A contributor's answers as a check-answers list (docs/contributor-profiles.md):
	each answer with who can see it, and, on the person's own review page, a
	"Change" link to the part of the form that holds it.
-->
<script lang="ts">
	import {
		ageGroupLabels,
		availabilityLabels,
		contactMethodLabels,
		creditFormLabels,
		creditOf,
		fullName,
		interestLabels,
		nationAnswerLabels,
		type ProfileAnswers
	} from '#lib/contributors.ts';

	let {
		answers,
		email,
		changeLinks = false,
		showContact = true
	}: {
		answers: ProfileAnswers;
		email: string;
		/** Show "Change" links to the profile form. */
		changeLinks?: boolean;
		/** Show the email address and phone number. Off for anyone without permission to read contact details. */
		showContact?: boolean;
	} = $props();

	const credit = $derived(creditOf(answers));
	const team = 'The lead author and editors';
	const notGiven = 'Not given';
</script>

{#snippet change(section: string, what: string)}
	{#if changeLinks}
		<a class="change" href="/profile/edit#{section}">Change<span class="visually-hidden"> {what}</span></a>
	{/if}
{/snippet}

<section aria-labelledby="summary-about">
	<h2 id="summary-about">About you</h2>
	<dl class="summary-list profile-summary">
		<div>
			<dt>Name</dt>
			<dd>{fullName(answers) || notGiven} <span class="who">{team}</span></dd>
			<dd class="action">{@render change('about', 'name')}</dd>
		</div>
		{#if answers.nativeName}
			<div>
				<dt>Native name or other name</dt>
				<dd>{answers.nativeName} <span class="who">{team}</span></dd>
				<dd class="action">{@render change('about', 'Native name or other name')}</dd>
			</div>
		{/if}
		<div>
			<dt>Age</dt>
			<dd>{answers.ageGroup ? ageGroupLabels[answers.ageGroup] : 'Not answered'}</dd>
			<dd class="action">{@render change('about', 'age')}</dd>
		</div>
		{#if showContact}
			<div>
				<dt>Email</dt>
				<dd>{email} <span class="who">{team}. Never printed or published.</span></dd>
				<dd class="action">
					{#if changeLinks}<span class="small muted">Comes from sign-in</span>{/if}
				</dd>
			</div>
			<div>
				<dt>Phone</dt>
				<dd>{answers.phone ?? notGiven} <span class="who">{team}. Never printed or published.</span></dd>
				<dd class="action">{@render change('contact', 'phone')}</dd>
			</div>
		{/if}
		<div>
			<dt>Best way to reach you</dt>
			<dd>{answers.preferredContact ? contactMethodLabels[answers.preferredContact] : 'Email'}</dd>
			<dd class="action">{@render change('contact', 'how to reach you')}</dd>
		</div>
	</dl>
</section>

<section aria-labelledby="summary-nations">
	<h2 id="summary-nations">Native nations</h2>
	<dl class="summary-list profile-summary">
		<div>
			<dt>Connection to a Native nation</dt>
			<dd>
				{#if answers.nationAnswer === 'listed' && answers.nations.length > 0}
					<ul>
						{#each answers.nations as nation, position (position)}
							<li>
								{nation.nationName}{nation.connection ? `: ${nation.connection}` : ''}
								{#if nation.showInCredit}<span class="who">Shown with your name in credits</span>{/if}
							</li>
						{/each}
					</ul>
				{:else if answers.nationAnswer}
					{nationAnswerLabels[answers.nationAnswer]}
				{:else}
					{notGiven}
				{/if}
				<span class="who">{team}, unless shown with your name</span>
			</dd>
			<dd class="action">{@render change('nations', 'Native nations')}</dd>
		</div>
	</dl>
</section>

<section aria-labelledby="summary-background">
	<h2 id="summary-background">Background and help</h2>
	<dl class="summary-list profile-summary">
		<div>
			<dt>Background</dt>
			<dd class="preserve">{answers.background ?? notGiven} <span class="who">{team}</span></dd>
			<dd class="action">{@render change('your-background', 'background')}</dd>
		</div>
		<div>
			<dt>Languages</dt>
			<dd>{answers.languages ?? notGiven}</dd>
			<dd class="action">{@render change('your-background', 'languages')}</dd>
		</div>
		<div>
			<dt>Organization or school</dt>
			<dd>{answers.organization ?? notGiven}</dd>
			<dd class="action">{@render change('your-background', 'organization')}</dd>
		</div>
		<div>
			<dt>Would like to help by</dt>
			<dd>
				{#if answers.interests.length > 0}
					<ul>
						{#each answers.interests as interest (interest)}<li>{interestLabels[interest]}</li>{/each}
					</ul>
				{:else}
					{notGiven}
				{/if}
			</dd>
			<dd class="action">{@render change('help', 'how you would like to help')}</dd>
		</div>
		<div>
			<dt>Time</dt>
			<dd>{answers.availability ? availabilityLabels[answers.availability] : notGiven}</dd>
			<dd class="action">{@render change('help', 'time')}</dd>
		</div>
	</dl>
</section>

<section aria-labelledby="summary-credit">
	<h2 id="summary-credit">Credit</h2>
	<dl class="summary-list profile-summary">
		<div>
			<dt>Kind of credit</dt>
			<dd>{answers.creditForm ? creditFormLabels[answers.creditForm] : notGiven}</dd>
			<dd class="action">{@render change('credit', 'kind of credit')}</dd>
		</div>
		<div>
			<dt>Where</dt>
			<dd>
				{#if !credit}
					Nowhere
				{:else}
					{[credit.inBook ? 'The book' : '', credit.onWebsite ? 'the website' : ''].filter(Boolean).join(' and ')}
				{/if}
			</dd>
			<dd class="action">{@render change('credit', 'where you are credited')}</dd>
		</div>
		<div>
			<dt>Biography</dt>
			<dd class="preserve">
				{answers.biography ?? notGiven}
				<span class="who">
					{credit?.biography ? 'Printed with your credit' : team}
				</span>
			</dd>
			<dd class="action">{@render change('credit', 'biography')}</dd>
		</div>
	</dl>
	<div class="panel panel-filled credit-preview">
		<p class="small muted">Your credit will read:</p>
		{#if credit}
			<p class="credit-line">{credit.line}</p>
			{#if credit.biography}<p class="small preserve">{credit.biography}</p>{/if}
		{:else}
			<p class="credit-line">You will not be credited by name.</p>
		{/if}
	</div>
</section>

<style>
	.profile-summary {
		grid-template-columns: minmax(8rem, 14rem) 1fr auto;
	}

	.who {
		display: block;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.action {
		text-align: right;
	}

	.change {
		white-space: nowrap;
	}

	.preserve {
		white-space: pre-line;
	}

	.credit-line {
		font-size: var(--font-size-lead);
		font-weight: var(--font-weight-semibold);
	}

	@media (max-width: 40rem) {
		.profile-summary {
			grid-template-columns: 1fr;
		}

		.action {
			text-align: left;
		}
	}
</style>
