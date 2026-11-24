<!--
	A contributor's answers as a check-answers list (docs/contributor-profiles.md):
	each answer with where it may appear (Book, Website, or Private), and, on
	the person's own review page, a "Change" link to the part of the form that
	holds it.
-->
<script lang="ts">
	import {
		availabilityLabels,
		creditsOf,
		fullName,
		interestLabels,
		nameKindLabels,
		nationAnswerLabels,
		nationRelationshipLabels,
		placementOf,
		pronounLabels,
		specialtiesShown,
		type Placement,
		type ProfileAnswers
	} from '#lib/contributors.ts';
	import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
	import { languageOf } from '#lib/languages.ts';

	let {
		answers,
		changeLinks = false,
		showContact = true,
		picture = null,
		curriculumVitae = null
	}: {
		answers: ProfileAnswers;
		/** Show "Change" links to the profile form. */
		changeLinks?: boolean;
		/** Show email addresses and phone numbers. Off for anyone without permission to read contact details. */
		showContact?: boolean;
		/** The address of the person's picture, when they have one. */
		picture?: string | null;
		/** The person's CV or résumé, by its file name and where to download it. */
		curriculumVitae?: { name: string; href: string } | null;
	} = $props();

	const credits = $derived(creditsOf(answers));
	const notGiven = 'Not given';
	const adult = $derived(answers.ageGroup === '18-or-older');

	/** Where an answer may appear, in words. */
	function where(placement: Placement): string {
		if (placement.book && placement.website) return 'Book and website';
		if (placement.book) return 'Book';
		if (placement.website) return 'Website';
		return 'Private';
	}

	/** Under 18 only a pen name may be published. */
	function nameWhere(name: ProfileAnswers['names'][number]): string {
		return adult || name.kind === 'pen-name' ? where(name) : 'Private';
	}

	/** A phone number written the usual way for reading, such as +1 702 555 0134. */
	function contactText(contact: ProfileAnswers['contacts'][number]): string {
		if (contact.kind !== 'phone') return contact.value;
		return parsePhoneNumberFromString(contact.value)?.formatInternational() ?? contact.value;
	}

	function uses(contact: ProfileAnswers['contacts'][number]): string {
		const ways = [contact.mayEmail ? 'Email' : '', contact.mayCall ? 'Call' : '', contact.mayText ? 'Text' : ''].filter(Boolean);
		return ways.length > 0 ? ways.join(', ') : 'Not to be used';
	}

	function languageName(language: ProfileAnswers['languages'][number]): string {
		return (language.code ? languageOf(language.code)?.name : null) ?? language.otherName ?? language.code ?? '';
	}

	function skills(language: ProfileAnswers['languages'][number]): string {
		return [language.speaks ? 'speak' : '', language.reads ? 'read' : '', language.writes ? 'write' : ''].filter(Boolean).join(', ');
	}

	const pronounText = $derived(
		answers.pronouns
			.map((choice) => (choice === 'other' ? (answers.pronounOther ?? pronounLabels.other) : pronounLabels[choice]))
			.join(', ')
	);
</script>

{#snippet change(section: string, what: string)}
	{#if changeLinks}
		<a class="change" href="/profile/edit#{section}">Change<span class="visually-hidden"> {what}</span></a>
	{/if}
{/snippet}

<section aria-labelledby="summary-about">
	<h2 id="summary-about">About you</h2>
	<dl class="summary-list profile-summary">
		{#if picture}
			<div>
				<dt>Picture</dt>
				<dd>
					<img class="summary-picture" src={picture} alt="On the profile" width="96" height="96" />
					<span class="who">{where(placementOf(answers, 'picture'))}</span>
				</dd>
				<dd class="action">{@render change('about', 'picture')}</dd>
			</div>
		{/if}
		<div>
			<dt>Name</dt>
			<dd>{fullName(answers) || notGiven} <span class="who">{where(placementOf(answers, 'full-name'))}</span></dd>
			<dd class="action">{@render change('about', 'name')}</dd>
		</div>
		{#each answers.names as name, position (position)}
			<div>
				<dt>{nameKindLabels[name.kind]}</dt>
				<dd>{name.name} <span class="who">{nameWhere(name)}</span></dd>
				<dd class="action">{@render change('about', nameKindLabels[name.kind])}</dd>
			</div>
		{/each}
		<div>
			<dt>Pronouns</dt>
			<dd>{pronounText || notGiven} {#if pronounText}<span class="who">{where(placementOf(answers, 'pronouns'))}</span>{/if}</dd>
			<dd class="action">{@render change('about', 'pronouns')}</dd>
		</div>
		<div>
			<dt>Birth year</dt>
			<dd>{answers.birthYear ?? 'Not answered'} <span class="who">Private</span></dd>
			<dd class="action">{@render change('about', 'birth year')}</dd>
		</div>
	</dl>
</section>

<section aria-labelledby="summary-contact">
	<h2 id="summary-contact">How to reach you</h2>
	<dl class="summary-list profile-summary">
		{#each answers.contacts as contact, position (position)}
			{#if showContact || contact.preferred}
				<div>
					<dt>{contact.kind === 'phone' ? 'Phone' : 'Email'}{contact.preferred ? ' (preferred)' : ''}</dt>
					<dd>
						{showContact ? contactText(contact) : contact.kind === 'phone' ? 'A phone number' : 'An email address'}
						<span class="who">{uses(contact)}. Private{contact.signIn ? '; signed in with' : ''}.</span>
					</dd>
					<dd class="action">{@render change('contact', 'how to reach you')}</dd>
				</div>
			{/if}
		{/each}
	</dl>
</section>

<section aria-labelledby="summary-nations">
	<h2 id="summary-nations">Native nations</h2>
	<dl class="summary-list profile-summary">
		<div>
			<dt>Nations</dt>
			<dd>
				{#if answers.nationAnswer === 'listed' && answers.nations.length > 0}
					<ul>
						{#each answers.nations as nation, position (position)}
							<li>
								{nation.nationName}{#if nation.relationships.length > 0}:
									{nation.relationships
										.map((relationship) => (relationship === 'other' ? (nation.relationshipOther ?? nationRelationshipLabels.other) : nationRelationshipLabels[relationship]))
										.join(', ')}{/if}
								<span class="who">{where(nation)}</span>
							</li>
						{/each}
					</ul>
				{:else if answers.nationAnswer}
					{nationAnswerLabels[answers.nationAnswer]}
				{:else}
					{notGiven}
				{/if}
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
			<dd class="preserve">{answers.background ?? notGiven} <span class="who">Private</span></dd>
			<dd class="action">{@render change('your-background', 'background')}</dd>
		</div>
		{#if curriculumVitae}
			<div>
				<dt>CV or résumé</dt>
				<dd><a href={curriculumVitae.href}>{curriculumVitae.name}</a> <span class="who">Private</span></dd>
				<dd class="action">{@render change('your-background', 'CV or résumé')}</dd>
			</div>
		{/if}
		<div>
			<dt>Languages</dt>
			<dd>
				{#if answers.languages.length > 0}
					<ul>
						{#each answers.languages as language, position (position)}
							<li>
								{languageName(language)}{#if skills(language)}: {skills(language)}{/if}
								<span class="who">{language.website ? 'Website' : 'Private'}</span>
							</li>
						{/each}
					</ul>
				{:else}
					{notGiven}
				{/if}
			</dd>
			<dd class="action">{@render change('your-background', 'languages')}</dd>
		</div>
		<div>
			<dt>Organization, office or school</dt>
			<dd>{answers.organization ?? notGiven} {#if answers.organization}<span class="who">{where(placementOf(answers, 'organization'))}</span>{/if}</dd>
			<dd class="action">{@render change('your-background', 'organization')}</dd>
		</div>
		<div>
			<dt>Specialties</dt>
			<dd>
				{specialtiesShown(answers).join(', ') || notGiven}
				{#if specialtiesShown(answers).length > 0}<span class="who">{where(placementOf(answers, 'specialties'))}</span>{/if}
			</dd>
			<dd class="action">{@render change('your-background', 'specialties')}</dd>
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
			<dt>Description</dt>
			<dd>{answers.description ?? notGiven} {#if answers.description}<span class="who">{where(placementOf(answers, 'description'))}</span>{/if}</dd>
			<dd class="action">{@render change('credit', 'description')}</dd>
		</div>
		<div>
			<dt>Biography</dt>
			<dd class="preserve">{answers.biography ?? notGiven} {#if answers.biography}<span class="who">{where(placementOf(answers, 'biography'))}</span>{/if}</dd>
			<dd class="action">{@render change('credit', 'biography')}</dd>
		</div>
	</dl>
	<div class="panel panel-filled credit-preview">
		{#if credits.length === 0}
			<p class="small muted">Your credit will read:</p>
			<p class="credit-line">You will not be credited.</p>
		{:else}
			{#each credits as credit, position (position)}
				<p class="small muted">{credit.inBook && credit.onWebsite ? 'In the book and on the website' : credit.inBook ? 'In the book' : 'On the website'}:</p>
				<p class="credit-line">{credit.line}</p>
				{#if credit.biography}<p class="small preserve">{credit.biography}</p>{/if}
			{/each}
		{/if}
	</div>
</section>

<style>
	.profile-summary {
		grid-template-columns: minmax(8rem, var(--layout-label-column)) 1fr auto;
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

	.summary-picture {
		width: 6rem;
		height: 6rem;
		border-radius: 50%;
		object-fit: cover;
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
