<script lang="ts">
	import {
		ageGroupLabels,
		ageGroups,
		availabilities,
		availabilityLabels,
		contactMethodLabels,
		contactMethods,
		creditFormLabels,
		creditForms,
		emptyAnswers,
		interestLabels,
		interestNextSteps,
		interests,
		nationAnswerLabels,
		nationAnswers,
		specialties,
		specialtyLabels,
		type ProfileAnswers
	} from '#lib/contributors.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** The saved answers as form values, so the form opens as the person left it. */
	function valuesOf(answers: ProfileAnswers): Record<string, string> {
		const values: Record<string, string> = {};
		const set = (name: string, value: string | null | boolean) => {
			if (typeof value === 'boolean') {
				if (value) values[name] = 'yes';
			} else if (value) values[name] = value;
		};
		set('givenName', answers.givenName);
		set('familyName', answers.familyName);
		set('nativeName', answers.nativeName);
		set('phone', answers.phone);
		set('preferredContact', answers.preferredContact);
		set('ageGroup', answers.ageGroup);
		set('nationAnswer', answers.nationAnswer);
		answers.nations.forEach((nation, index) => {
			set(`nation${index + 1}Name`, nation.nationName);
			set(`nation${index + 1}Connection`, nation.connection);
			set(`nation${index + 1}Credit`, nation.showInCredit);
		});
		set('background', answers.background);
		set('languages', answers.languages);
		set('organization', answers.organization);
		values.interests = answers.interests.join('\n');
		values.specialties = (answers.specialties ?? []).join('\n');
		set('specialtyOther', answers.specialtyOther);
		set('availability', answers.availability);
		set('creditForm', answers.creditForm);
		set('creditName', answers.creditName);
		set('creditRole', answers.creditRole);
		set('creditPseudonym', answers.creditPseudonym);
		set('creditInBook', answers.creditInBook);
		set('creditOnWebsite', answers.creditOnWebsite);
		set('biography', answers.biography);
		set('biographyInCredits', answers.biographyInCredits);
		return values;
	}

	const values: Record<string, string> = $derived(
		form?.values ?? valuesOf(data.profile?.answers ?? emptyAnswers)
	);
	const errors: Record<string, string> = $derived(form?.errors ?? {});
	const errorCount = $derived(Object.keys(errors).length);
	const slots = $derived(Array.from({ length: data.nationSlots }, (_, index) => index + 1));

	function value(name: string): string {
		return values[name] ?? '';
	}

	function chosen(name: string, option: string): boolean {
		return (values[name] ?? '').split('\n').includes(option);
	}

	/** Moves focus to the error summary when the form comes back with problems (WCAG 3.3.1). */
	function focusOnArrival(node: HTMLElement) {
		node.focus();
	}

	function describedBy(name: string, hint = false): string | undefined {
		const ids = [hint ? `${name}-hint` : '', errors[name] ? `${name}-error` : ''].filter(Boolean);
		return ids.length > 0 ? ids.join(' ') : undefined;
	}
</script>

<svelte:head>
	<title>Edit your profile · Model Tribal ADR Code</title>
</svelte:head>

{#snippet fieldError(name: string)}
	{#if errors[name]}
		<p class="field-error" id="{name}-error"><span class="visually-hidden">Error:</span> {errors[name]}</p>
	{/if}
{/snippet}

<h1>{data.profile ? 'Edit your profile' : 'Help write the code'}</h1>
<p class="lead">
	Everything except your name is optional until you confirm. Only the lead author and editors see your
	answers; only the credit you choose is ever published.
</p>

{#if errorCount > 0}
	<div class="notice notice-problem" role="alert" tabindex="-1" {@attach focusOnArrival}>
		<p>
			<strong>Please check {errorCount === 1 ? 'one answer' : `${errorCount} answers`}.</strong> The messages
			are next to the questions below.
		</p>
	</div>
{/if}

<form method="post" novalidate>
	<fieldset id="about">
		<legend><h2>About you</h2></legend>
		<p class="hint">
			If your name does not have a first and last name, put your whole name in the first box. The last
			name is used only to sort the list of credits.
		</p>
		<div class="field-row">
			<div class="field">
				<label for="givenName">First name</label>
				{@render fieldError('givenName')}
				<input
					type="text"
					id="givenName"
					name="givenName"
					autocomplete="given-name"
					value={value('givenName')}
					aria-invalid={errors.givenName ? 'true' : undefined}
					aria-describedby={describedBy('givenName')}
				/>
			</div>
			<div class="field">
				<label for="familyName">Last name (optional)</label>
				{@render fieldError('familyName')}
				<input
					type="text"
					id="familyName"
					name="familyName"
					autocomplete="family-name"
					value={value('familyName')}
				/>
			</div>
		</div>
		<div class="field">
			<label for="nativeName">A Native name, or another name you go by (optional)</label>
			<p class="hint" id="nativeName-hint">
				For example, a name in your nation’s language. It is printed only if you write it in your credit
				below.
			</p>
			<input
				type="text"
				id="nativeName"
				name="nativeName"
				value={value('nativeName')}
				aria-describedby="nativeName-hint"
			/>
		</div>
		<fieldset aria-describedby="ageGroup-hint">
			<legend>How old are you?</legend>
			<p class="hint" id="ageGroup-hint">
				Signing up is for people 13 or older. Someone younger can still help, with a parent or guardian,
				through the <a href="/requests?kind=contribute">request form</a>. People under 18 are credited by a
				description or a name they choose.
			</p>
			{@render fieldError('ageGroup')}
			{#each ageGroups as option (option)}
				<div class="choice">
					<input type="radio" id="ageGroup-{option}" name="ageGroup" value={option} checked={value('ageGroup') === option} />
					<label for="ageGroup-{option}">{ageGroupLabels[option]}</label>
				</div>
			{/each}
		</fieldset>
	</fieldset>

	<fieldset id="contact">
		<legend><h2>How to reach you</h2></legend>
		<p class="hint">
			Your email address is <strong>{data.email}</strong>, the one you signed in with. Add a phone number
			only if you would like us to call or text you. Neither is ever printed or published.
		</p>
		<div class="field">
			<label for="phone">Phone number (optional)</label>
			<p class="hint" id="phone-hint">In any format, with the country or area code.</p>
			{@render fieldError('phone')}
			<input
				type="text"
				id="phone"
				name="phone"
				class="short"
				inputmode="tel"
				autocomplete="tel"
				value={value('phone')}
				aria-invalid={errors.phone ? 'true' : undefined}
				aria-describedby={describedBy('phone', true)}
			/>
		</div>
		<fieldset>
			<legend>Best way to reach you</legend>
			{#each contactMethods as option (option)}
				<div class="choice">
					<input
						type="radio"
						id="preferredContact-{option}"
						name="preferredContact"
						value={option}
						checked={value('preferredContact') === option || (option === 'email' && !value('preferredContact'))}
					/>
					<label for="preferredContact-{option}">{contactMethodLabels[option]}</label>
				</div>
			{/each}
		</fieldset>
	</fieldset>

	<fieldset id="nations">
		<legend><h2>Native nations</h2></legend>
		<p class="hint" id="nations-hint">
			This is optional and is never checked: we do not ask for enrollment numbers, cards or other proof.
			Listing a nation does not mean you speak for it, and we will never say you do. It
			appears in a credit only if you tick it below and choose “My name and nation”.
		</p>
		<fieldset>
			<legend>Are you a citizen of, or connected to, a Native nation?</legend>
			{#each nationAnswers as option (option)}
				<div class="choice">
					<input
						type="radio"
						id="nationAnswer-{option}"
						name="nationAnswer"
						value={option}
						checked={value('nationAnswer') === option}
					/>
					<label for="nationAnswer-{option}">{nationAnswerLabels[option]}</label>
				</div>
			{/each}
		</fieldset>
		<p class="hint">
			To list nations, start typing to pick from our list, or write any name, including First Nations,
			state-recognized nations and nations not on our list.
		</p>
		{#each slots as slot (slot)}
			<fieldset class="nation">
				<legend class="visually-hidden">Nation {slot}</legend>
				<div class="field-row">
					<div class="field">
						<label for="nation{slot}Name">Nation {slot}{slot > 1 ? ' (optional)' : ''}</label>
						{@render fieldError(`nation${slot}Name`)}
						<input
							type="text"
							id="nation{slot}Name"
							name="nation{slot}Name"
							list="nation-titles"
							value={value(`nation${slot}Name`)}
						/>
					</div>
					<div class="field">
						<label for="nation{slot}Connection">Your connection, in your own words (optional)</label>
						<input
							type="text"
							id="nation{slot}Connection"
							name="nation{slot}Connection"
							placeholder="For example: citizen, descendant, I work for the nation"
							value={value(`nation${slot}Connection`)}
						/>
					</div>
				</div>
				<div class="choice">
					<input
						type="checkbox"
						id="nation{slot}Credit"
						name="nation{slot}Credit"
						value="yes"
						checked={value(`nation${slot}Credit`) === 'yes'}
					/>
					<label for="nation{slot}Credit">Show this nation with my name in credits</label>
				</div>
			</fieldset>
		{/each}
		{@render fieldError('nations')}
		<datalist id="nation-titles">
			{#each data.nationTitles as title (title)}<option value={title}></option>{/each}
		</datalist>
	</fieldset>

	<fieldset id="your-background">
		<legend><h2>Your background</h2></legend>
		<div class="field">
			<label for="background">Tell us about yourself (optional)</label>
			<p class="hint" id="background-hint">
				For example: experience with peacemaking, mediation, Tribal courts or law; community roles;
				writing or research you have done. Share only what you are comfortable with.
			</p>
			{@render fieldError('background')}
			<textarea
				id="background"
				name="background"
				rows="6"
				aria-invalid={errors.background ? 'true' : undefined}
				aria-describedby={describedBy('background', true)}>{value('background')}</textarea
			>
		</div>
		<div class="field">
			<label for="languages">Languages you speak or read (optional)</label>
			<input type="text" id="languages" name="languages" value={value('languages')} />
		</div>
		<div class="field">
			<label for="organization">Organization, office or school (optional)</label>
			<input
				type="text"
				id="organization"
				name="organization"
				autocomplete="organization"
				value={value('organization')}
			/>
		</div>
		<fieldset aria-describedby="specialties-hint">
			<legend>Your specialties (optional)</legend>
			<p class="hint" id="specialties-hint">
				If you have a page on this website, these are shown with your name there and on the People page.
			</p>
			{#each specialties as option (option)}
				<div class="choice">
					<input
						type="checkbox"
						id="specialties-{option}"
						name="specialties"
						value={option}
						checked={chosen('specialties', option)}
					/>
					<label for="specialties-{option}">{specialtyLabels[option]}</label>
				</div>
			{/each}
			<div class="field">
				<label for="specialtyOther">Other, in your own words</label>
				{@render fieldError('specialtyOther')}
				<input
					type="text"
					id="specialtyOther"
					name="specialtyOther"
					maxlength="100"
					value={value('specialtyOther')}
					aria-invalid={errors.specialtyOther ? 'true' : undefined}
				/>
			</div>
		</fieldset>
	</fieldset>

	<fieldset id="help">
		<legend><h2>How you would like to help</h2></legend>
		{@render fieldError('interests')}
		{#each interests as option (option)}
			<div class="choice">
				<input
					type="checkbox"
					id="interests-{option}"
					name="interests"
					value={option}
					checked={chosen('interests', option)}
					aria-describedby="interests-{option}-hint"
				/>
				<label for="interests-{option}">
					{interestLabels[option]}
					<span class="hint" id="interests-{option}-hint">{interestNextSteps[option]}</span>
				</label>
			</div>
		{/each}
		<fieldset>
			<legend>How much time you have (optional)</legend>
			{#each availabilities as option (option)}
				<div class="choice">
					<input
						type="radio"
						id="availability-{option}"
						name="availability"
						value={option}
						checked={value('availability') === option}
					/>
					<label for="availability-{option}">{availabilityLabels[option]}</label>
				</div>
			{/each}
		</fieldset>
	</fieldset>

	<fieldset id="credit">
		<legend><h2>Credit</h2></legend>
		<p class="hint">
			People who help may be credited in the book and on the website. The lead author decides where a
			credit goes (for example the acknowledgments or the list of contributors); you decide how it
			reads. You will see it exactly as it will be printed before you confirm.
		</p>
		<fieldset>
			<legend>How would you like to be credited?</legend>
			{@render fieldError('creditForm')}
			{#each creditForms as option (option)}
				<div class="choice">
					<input
						type="radio"
						id="creditForm-{option}"
						name="creditForm"
						value={option}
						checked={value('creditForm') === option}
					/>
					<label for="creditForm-{option}">{creditFormLabels[option]}</label>
				</div>
			{/each}
		</fieldset>
		<div class="field">
			<label for="creditName">Your name as it should be printed, if different (optional)</label>
			<p class="hint" id="creditName-hint">
				For example with your Native name, a middle initial, or diacritics. Left empty, we print your
				first and last names.
			</p>
			<input
				type="text"
				id="creditName"
				name="creditName"
				value={value('creditName')}
				aria-describedby="creditName-hint"
			/>
		</div>
		<div class="field">
			<label for="creditRole">The description to print, if you chose a description</label>
			{@render fieldError('creditRole')}
			<input
				type="text"
				id="creditRole"
				name="creditRole"
				placeholder="For example: a peacemaker from the nation"
				value={value('creditRole')}
				aria-invalid={errors.creditRole ? 'true' : undefined}
				aria-describedby={describedBy('creditRole')}
			/>
		</div>
		<div class="field">
			<label for="creditPseudonym">The name to print, if you chose a name</label>
			{@render fieldError('creditPseudonym')}
			<input
				type="text"
				id="creditPseudonym"
				name="creditPseudonym"
				value={value('creditPseudonym')}
				aria-invalid={errors.creditPseudonym ? 'true' : undefined}
				aria-describedby={describedBy('creditPseudonym')}
			/>
		</div>
		<fieldset>
			<legend>Where</legend>
			<div class="choice">
				<input
					type="checkbox"
					id="creditInBook"
					name="creditInBook"
					value="yes"
					checked={value('creditInBook') === 'yes'}
				/>
				<label for="creditInBook">In the book (print and ebook)</label>
			</div>
			<div class="choice">
				<input
					type="checkbox"
					id="creditOnWebsite"
					name="creditOnWebsite"
					value="yes"
					checked={value('creditOnWebsite') === 'yes'}
				/>
				<label for="creditOnWebsite">On the website</label>
			</div>
		</fieldset>
		<div class="field">
			<label for="biography">A short biography (optional; asked of writers)</label>
			<p class="hint" id="biography-hint">
				Two or three sentences, written as you would like them printed in the list of contributors.
			</p>
			{@render fieldError('biography')}
			<textarea
				id="biography"
				name="biography"
				rows="4"
				aria-invalid={errors.biography ? 'true' : undefined}
				aria-describedby={describedBy('biography', true)}>{value('biography')}</textarea
			>
		</div>
		<div class="choice">
			<input
				type="checkbox"
				id="biographyInCredits"
				name="biographyInCredits"
				value="yes"
				checked={value('biographyInCredits') === 'yes'}
			/>
			<label for="biographyInCredits">
				Print my biography with my credit
				<span class="hint">Not used with a description-only credit, because it could identify you.</span>
			</label>
		</div>
	</fieldset>

	<div class="actions">
		<button class="button" type="submit" name="next" value="review">Continue to check your answers</button>
		<button class="button button-quiet" type="submit" name="next" value="later">Save and finish later</button>
	</div>
</form>

<style>
	fieldset {
		border: 0;
		margin: 0 0 var(--space-5);
		padding: 0;
		min-width: 0;
	}

	legend {
		padding: 0;
	}

	legend h2 {
		margin-bottom: var(--space-2);
	}

	fieldset > fieldset > legend {
		font-weight: var(--font-weight-semibold);
		margin-bottom: var(--space-1);
	}

	fieldset.nation {
		border-left: 4px solid var(--color-line);
		padding-left: var(--space-4);
		margin-bottom: var(--space-4);
	}

	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		margin: var(--space-3) 0;
	}

	.choice input {
		margin-top: 0.3em;
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
	}

	.choice .hint {
		display: block;
	}

	.field-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-4);
	}

	.field-row .field {
		flex: 1 1 14rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-top: var(--space-5);
	}
</style>
