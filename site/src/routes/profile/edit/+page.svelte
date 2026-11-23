<script lang="ts">
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import UserRound from '@lucide/svelte/icons/user-round';
	import SearchableDropdown, { type SearchableChoice } from '#lib/components/SearchableDropdown.svelte';
	import CheckDropdown from '#lib/components/profile/CheckDropdown.svelte';
	import PhoneField from '#lib/components/profile/PhoneField.svelte';
	import PrivateMark from '#lib/components/profile/PrivateMark.svelte';
	import ShownToggle from '#lib/components/profile/ShownToggle.svelte';
	import {
		availabilities,
		availabilityLabels,
		interestLabels,
		interestNextSteps,
		interests,
		nameKindLabels,
		nameKinds,
		nationAnswerLabels,
		nationAnswers,
		nationConnectionLabels,
		nationConnections,
		specialties,
		specialtyLabels,
		type NameKind,
		type NationConnection
	} from '#lib/contributors.ts';
	import { languageGroupLabels, languages } from '#lib/languages.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Mockup state: the answers Trevor will see filled in on the screenshots.
	let givenName = $state('Sample');
	let familyName = $state('Name');
	let fullNameShown = $state(true);
	let otherNames = $state<{ key: number; name: string; kind: NameKind; shown: boolean }[]>([
		{ key: 1, name: 'Sample Native Name', kind: 'native', shown: true },
		{ key: 2, name: 'Sam', kind: 'goes-by', shown: false }
	]);
	let birthYear = $state('1985');
	let hadBirthday = $state('');
	const thisYear = new Date().getFullYear();
	/** Years from 13 to 110 years ago, newest first. Signing up is for people 13 or older. */
	const birthYears = Array.from({ length: 98 }, (_, index) => String(thisYear - 13 - index));
	/** In the year someone turns 13 or 18, the year alone cannot say which side of the line they are on, so only then is a birthday asked. */
	const turning = $derived(birthYear ? thisYear - Number(birthYear) : 0);
	let pictureShown = $state(true);

	let emails = $state<{ key: number; value: string; mayEmail: boolean }[]>([]);
	let phones = $state<{ key: number; country: string; digits: string; mayCall: boolean; mayText: boolean }[]>([
		{ key: 1, country: 'US', digits: '7025550134', mayCall: true, mayText: true }
	]);
	let signInMayEmail = $state(true);
	let best = $state('phone-1');

	let nationAnswer = $state('listed');
	let nations = $state<{ key: number; name: string; connections: NationConnection[]; other: string; shown: boolean }[]>([
		{ key: 1, name: 'Navajo Nation', connections: ['citizen', 'works-for'], other: '', shown: true }
	]);

	let spoken = $state<{ key: number; code: string; other: string; speaks: boolean; reads: boolean; shown: boolean }[]>([
		{ key: 1, code: 'nav', other: '', speaks: true, reads: true, shown: true },
		{ key: 2, code: 'eng', other: '', speaks: true, reads: true, shown: false }
	]);
	let organization = $state('Navajo Nation Peacemaking Program');
	let organizationShown = $state(false);
	let chosenSpecialties = $state(['peacemaking', 'language']);
	let specialtiesShown = $state(true);
	let chosenInterests = $state(['review', 'share-knowledge', 'translate']);
	let availability = $state('monthly');
	let description = $state('');
	let descriptionShown = $state(false);
	let biography = $state('');
	let biographyShown = $state(false);
	let inBook = $state(true);
	let onWebsite = $state(true);

	let nextKey = 100;
	const key = () => nextKey++;

	const languageChoices: SearchableChoice<string>[] = [
		...languages.map((language) => ({
			value: language.code,
			label: language.name,
			group: languageGroupLabels[language.group],
			keywords: [language.code, ...(language.keywords ?? [])]
		})),
		{ value: 'other', label: 'Other', group: languageGroupLabels.other }
	];

	const minor = $derived(turning < 18 || (turning === 18 && hadBirthday !== 'yes'));

	/** The credit as it will read, from everything marked Shown. */
	const creditLine = $derived.by(() => {
		const names: string[] = [];
		if (fullNameShown && !minor) names.push([givenName, familyName].filter(Boolean).join(' '));
		const extra = otherNames.filter((name) => name.shown && name.name && (!minor || name.kind === 'pen-name')).map((name) => name.name);
		let line = names.length > 0 ? [names[0], ...extra.map((name) => `(${name})`)].join(' ') : extra.join(' ');
		if (!line && descriptionShown) line = description;
		if (!line) return '';
		const shownNations = nations.filter((nation) => nation.shown && nation.name).map((nation) => nation.name);
		if (shownNations.length > 0) line += `, ${shownNations.join('; ')}`;
		if (organizationShown && organization) line += `, ${organization}`;
		return line;
	});
</script>

<svelte:head>
	<title>Edit your profile · Model Tribal ADR Code</title>
</svelte:head>

<h1>Edit your profile</h1>
<p class="lead">Only the lead author and editors see your answers. Anything marked Shown may appear with your credit.</p>

<form method="post" enctype="multipart/form-data" novalidate class="profile-form">
	<section aria-labelledby="about-heading">
		<h2 id="about-heading">About you</h2>

		<div class="picture-row">
			<div class="avatar" aria-hidden="true"><UserRound size={44} strokeWidth={1.5} /></div>
			<div class="picture-actions">
				<label class="button button-quiet file-button">
					<ImagePlus size={20} strokeWidth={1.75} aria-hidden="true" />
					Add picture
					<input type="file" name="picture" accept="image/*" class="visually-hidden" />
				</label>
				<p class="hint">Square, from the middle. Checked for viruses; camera details removed.</p>
			</div>
			<div class="use">
				{#if minor}<PrivateMark />{:else}<ShownToggle name="pictureShown" label="Show your picture on your contributor page" bind:checked={pictureShown} />{/if}
			</div>
		</div>

		<table class="rows">
			<caption class="visually-hidden">Your names</caption>
			<thead>
				<tr><th scope="col">Name</th><th scope="col">Kind</th><th scope="col" class="use">Credit</th><th scope="col"><span class="visually-hidden">Remove</span></th></tr>
			</thead>
			<tbody>
				<tr>
					<td data-label="Name">
						<div class="name-pair">
							<input type="text" name="givenName" aria-label="First name" placeholder="First name" autocomplete="given-name" bind:value={givenName} />
							<input type="text" name="familyName" aria-label="Last name" placeholder="Last name" autocomplete="family-name" bind:value={familyName} />
						</div>
					</td>
					<td data-label="Kind" class="fixed-kind">First and last name</td>
					<td data-label="Credit" class="use">
						{#if minor}<PrivateMark />{:else}<ShownToggle name="fullNameShown" label="Show your first and last name in your credit" bind:checked={fullNameShown} />{/if}
					</td>
					<td></td>
				</tr>
				{#each otherNames as other, index (other.key)}
					<tr>
						<td data-label="Name"><input type="text" name="otherName" aria-label="Name {index + 2}" bind:value={other.name} /></td>
						<td data-label="Kind">
							<select name="otherNameKind" aria-label="Kind of name {index + 2}" bind:value={other.kind}>
								{#each nameKinds as kind (kind)}<option value={kind}>{nameKindLabels[kind]}</option>{/each}
							</select>
						</td>
						<td data-label="Credit" class="use">
							<ShownToggle name="otherNameShown" value={String(index)} label="Show {other.name || 'this name'} in your credit" bind:checked={other.shown} />
						</td>
						<td class="remove">
							<button type="button" class="icon-button" aria-label="Remove {other.name || 'this name'}" title="Remove" onclick={() => (otherNames = otherNames.filter((item) => item.key !== other.key))}>
								<Trash2 size={20} strokeWidth={1.75} />
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="add"><button type="button" class="button button-quiet" onclick={() => otherNames.push({ key: key(), name: '', kind: 'native', shown: false })}><Plus size={20} strokeWidth={1.75} aria-hidden="true" /> Add a name</button></p>

		<div class="field-with-use">
			<div class="field">
				<label for="birthYear">Birth year</label>
				<select id="birthYear" name="birthYear" bind:value={birthYear}>
					<option value="" disabled>Choose</option>
					{#each birthYears as year (year)}<option value={year}>{year}</option>{/each}
				</select>
				{#if turning === 13 || turning === 18}
					<fieldset class="birthday">
						<legend>Have you had your {turning}th birthday yet?</legend>
						<label class="choice"><input type="radio" name="hadBirthday" value="yes" bind:group={hadBirthday} /> Yes</label>
						<label class="choice"><input type="radio" name="hadBirthday" value="no" bind:group={hadBirthday} /> Not yet</label>
					</fieldset>
				{/if}
			</div>
			<div class="use"><PrivateMark /></div>
		</div>
	</section>

	<section aria-labelledby="contact-heading">
		<h2 id="contact-heading">How to reach you</h2>
		<table class="rows contacts">
			<caption class="visually-hidden">Ways to reach you, and what each may be used for</caption>
			<thead>
				<tr>
					<th scope="col">Contact</th>
					<th scope="col" class="mark">Email</th>
					<th scope="col" class="mark">Call</th>
					<th scope="col" class="mark">Text</th>
					<th scope="col" class="mark">Best</th>
					<th scope="col" class="use">Credit</th>
					<th scope="col"><span class="visually-hidden">Remove</span></th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td data-label="Contact"><span class="sign-in-email">{data.email}</span> <span class="small muted">Signed in with</span></td>
					<td data-label="Email" class="mark"><input type="checkbox" name="signInMayEmail" aria-label="Email {data.email}" bind:checked={signInMayEmail} /></td>
					<td data-label="Call" class="mark"><span class="not-applicable" aria-label="Not a phone">–</span></td>
					<td data-label="Text" class="mark"><span class="not-applicable" aria-label="Not a phone">–</span></td>
					<td data-label="Best" class="mark"><input type="radio" name="best" value="sign-in" aria-label="Best way: {data.email}" bind:group={best} /></td>
					<td data-label="Credit" class="use"><PrivateMark /></td>
					<td></td>
				</tr>
				{#each emails as email, index (email.key)}
					<tr>
						<td data-label="Contact"><input type="email" name="email" aria-label="Email address {index + 2}" autocomplete="email" bind:value={email.value} /></td>
						<td data-label="Email" class="mark"><input type="checkbox" name="emailMayEmail" value={String(index)} aria-label="Email this address" bind:checked={email.mayEmail} /></td>
						<td data-label="Call" class="mark"><span class="not-applicable" aria-label="Not a phone">–</span></td>
						<td data-label="Text" class="mark"><span class="not-applicable" aria-label="Not a phone">–</span></td>
						<td data-label="Best" class="mark"><input type="radio" name="best" value="email-{index}" aria-label="Best way: this address" bind:group={best} /></td>
						<td data-label="Credit" class="use"><PrivateMark /></td>
						<td class="remove"><button type="button" class="icon-button" aria-label="Remove this address" title="Remove" onclick={() => (emails = emails.filter((item) => item.key !== email.key))}><Trash2 size={20} strokeWidth={1.75} /></button></td>
					</tr>
				{/each}
				{#each phones as phone, index (phone.key)}
					<tr>
						<td data-label="Contact"><PhoneField name="phone{index}" label="Phone {index + 1}" bind:country={phone.country} bind:digits={phone.digits} /></td>
						<td data-label="Email" class="mark"><span class="not-applicable" aria-label="Not an email address">–</span></td>
						<td data-label="Call" class="mark"><input type="checkbox" name="phoneMayCall" value={String(index)} aria-label="Call this number" bind:checked={phone.mayCall} /></td>
						<td data-label="Text" class="mark"><input type="checkbox" name="phoneMayText" value={String(index)} aria-label="Text this number" bind:checked={phone.mayText} /></td>
						<td data-label="Best" class="mark"><input type="radio" name="best" value="phone-{phone.key}" aria-label="Best way: this number" bind:group={best} /></td>
						<td data-label="Credit" class="use"><PrivateMark /></td>
						<td class="remove"><button type="button" class="icon-button" aria-label="Remove this number" title="Remove" onclick={() => (phones = phones.filter((item) => item.key !== phone.key))}><Trash2 size={20} strokeWidth={1.75} /></button></td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="add">
			<button type="button" class="button button-quiet" onclick={() => emails.push({ key: key(), value: '', mayEmail: true })}><Plus size={20} strokeWidth={1.75} aria-hidden="true" /> Add email</button>
			<button type="button" class="button button-quiet" onclick={() => phones.push({ key: key(), country: 'US', digits: '', mayCall: true, mayText: false })}><Plus size={20} strokeWidth={1.75} aria-hidden="true" /> Add phone</button>
		</p>
	</section>

	<section aria-labelledby="nations-heading">
		<h2 id="nations-heading">Native nations</h2>
		<div class="field">
			<label for="nationAnswer">Are you a citizen of, or connected to, a Native nation?</label>
			<select id="nationAnswer" name="nationAnswer" bind:value={nationAnswer}>
				<option value="" disabled>Choose</option>
				{#each nationAnswers as option (option)}<option value={option}>{nationAnswerLabels[option]}</option>{/each}
			</select>
		</div>
		{#if nationAnswer === 'listed'}
			<table class="rows">
				<caption class="visually-hidden">Nations you are connected to</caption>
				<thead>
					<tr><th scope="col">Nation</th><th scope="col">Your connection</th><th scope="col" class="use">Credit</th><th scope="col"><span class="visually-hidden">Remove</span></th></tr>
				</thead>
				<tbody>
					{#each nations as nation, index (nation.key)}
						<tr>
							<td data-label="Nation"><input type="text" name="nationName" list="nation-titles" aria-label="Nation {index + 1}" bind:value={nation.name} /></td>
							<td data-label="Your connection">
								<CheckDropdown
									name="nationConnection{index}"
									label="Your connection to {nation.name || `nation ${index + 1}`}"
									choices={nationConnections}
									labels={nationConnectionLabels}
									bind:chosen={nation.connections}
								/>
								{#if nation.connections.includes('other')}
									<input type="text" class="other-text" name="nationConnectionOther{index}" aria-label="Other connection, in your own words" placeholder="In your own words" bind:value={nation.other} />
								{/if}
							</td>
							<td data-label="Credit" class="use"><ShownToggle name="nationShown" value={String(index)} label="Show {nation.name || 'this nation'} in your credit" bind:checked={nation.shown} /></td>
							<td class="remove"><button type="button" class="icon-button" aria-label="Remove {nation.name || 'this nation'}" title="Remove" onclick={() => (nations = nations.filter((item) => item.key !== nation.key))}><Trash2 size={20} strokeWidth={1.75} /></button></td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="add"><button type="button" class="button button-quiet" onclick={() => nations.push({ key: key(), name: '', connections: [], other: '', shown: false })}><Plus size={20} strokeWidth={1.75} aria-hidden="true" /> Add a nation</button></p>
			<datalist id="nation-titles">
				{#each data.nationTitles as title (title)}<option value={title}></option>{/each}
			</datalist>
		{/if}
	</section>

	<section aria-labelledby="background-heading">
		<h2 id="background-heading">Your background</h2>
		<div class="field-with-use">
			<div class="field">
				<label for="background">Tell us about yourself</label>
				<p class="hint" id="background-hint">For example: peacemaking, mediation, Tribal courts or law, community roles, writing or research.</p>
				<textarea id="background" name="background" rows="4" aria-describedby="background-hint"></textarea>
			</div>
			<div class="use"><PrivateMark /></div>
		</div>

		<h3 id="languages-heading">Languages</h3>
		<table class="rows languages">
			<caption class="visually-hidden">Languages you speak or read</caption>
			<thead>
				<tr>
					<th scope="col">Language</th>
					<th scope="col" class="mark">Speak</th>
					<th scope="col" class="mark">Read</th>
					<th scope="col" class="use">Credit</th>
					<th scope="col"><span class="visually-hidden">Remove</span></th>
				</tr>
			</thead>
			<tbody>
				{#each spoken as language, index (language.key)}
					<tr>
						<td data-label="Language">
							<SearchableDropdown label="Language {index + 1}" hideLabel name="language{index}" choices={languageChoices} value={language.code} onchange={(value) => (language.code = value)} />
							{#if language.code === 'other'}
								<input type="text" class="other-text" name="languageOther{index}" aria-label="Language name" placeholder="Language name" bind:value={language.other} />
							{/if}
						</td>
						<td data-label="Speak" class="mark"><input type="checkbox" name="languageSpeaks" value={String(index)} aria-label="Speak" bind:checked={language.speaks} /></td>
						<td data-label="Read" class="mark"><input type="checkbox" name="languageReads" value={String(index)} aria-label="Read" bind:checked={language.reads} /></td>
						<td data-label="Credit" class="use"><ShownToggle name="languageShown" value={String(index)} label="Show this language on your contributor page" bind:checked={language.shown} /></td>
						<td class="remove"><button type="button" class="icon-button" aria-label="Remove this language" title="Remove" onclick={() => (spoken = spoken.filter((item) => item.key !== language.key))}><Trash2 size={20} strokeWidth={1.75} /></button></td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="add"><button type="button" class="button button-quiet" onclick={() => spoken.push({ key: key(), code: '', other: '', speaks: true, reads: false, shown: false })}><Plus size={20} strokeWidth={1.75} aria-hidden="true" /> Add a language</button></p>

		<div class="field-with-use">
			<div class="field">
				<label for="organization">Organization, office or school</label>
				<input type="text" id="organization" name="organization" autocomplete="organization" bind:value={organization} />
			</div>
			<div class="use"><ShownToggle name="organizationShown" label="Show your organization in your credit" bind:checked={organizationShown} /></div>
		</div>

		<fieldset class="field-with-use">
			<div>
				<legend>Your specialties</legend>
				<div class="choices-inline">
					{#each specialties as option (option)}
						<label class="choice"><input type="checkbox" name="specialties" value={option} bind:group={chosenSpecialties} /> {specialtyLabels[option]}</label>
					{/each}
				</div>
				<input type="text" class="other-text" name="specialtyOther" aria-label="Other specialty" placeholder="Other, in your own words" maxlength="100" />
			</div>
			<div class="use"><ShownToggle name="specialtiesShown" label="Show your specialties on your contributor page" bind:checked={specialtiesShown} /></div>
		</fieldset>
	</section>

	<section aria-labelledby="help-heading">
		<h2 id="help-heading">How you would like to help</h2>
		<fieldset class="field-with-use">
			<div>
				<legend class="visually-hidden">How you would like to help</legend>
				{#each interests as option (option)}
					<label class="choice">
						<input type="checkbox" name="interests" value={option} bind:group={chosenInterests} />
						<span>{interestLabels[option]} <span class="hint">{interestNextSteps[option]}</span></span>
					</label>
				{/each}
			</div>
			<div class="use"><PrivateMark /></div>
		</fieldset>
		<div class="field-with-use">
			<div class="field">
				<label for="availability">How much time you have</label>
				<select id="availability" name="availability" bind:value={availability}>
					<option value="">Choose</option>
					{#each availabilities as option (option)}<option value={option}>{availabilityLabels[option]}</option>{/each}
				</select>
			</div>
			<div class="use"><PrivateMark /></div>
		</div>
	</section>

	<section aria-labelledby="credit-heading">
		<h2 id="credit-heading">Credit</h2>
		<div class="field-with-use">
			<div class="field">
				<label for="creditRole">A description, to use in place of a name</label>
				<input type="text" id="creditRole" name="creditRole" placeholder="For example: a peacemaker from the nation" bind:value={description} />
			</div>
			<div class="use"><ShownToggle name="creditRoleShown" label="Use this description in your credit" bind:checked={descriptionShown} /></div>
		</div>
		<div class="field-with-use">
			<div class="field">
				<label for="biography">A short biography</label>
				<p class="hint" id="biography-hint">Two or three sentences. Asked of writers.</p>
				<textarea id="biography" name="biography" rows="3" aria-describedby="biography-hint" bind:value={biography}></textarea>
			</div>
			<div class="use">{#if minor}<PrivateMark />{:else}<ShownToggle name="biographyShown" label="Print your biography with your credit" bind:checked={biographyShown} />{/if}</div>
		</div>
		<fieldset class="where">
			<legend>Where</legend>
			<label class="choice"><input type="checkbox" name="creditInBook" value="yes" bind:checked={inBook} /> In the book</label>
			<label class="choice"><input type="checkbox" name="creditOnWebsite" value="yes" bind:checked={onWebsite} /> On the website</label>
		</fieldset>
		<div class="credit-preview" aria-live="polite">
			<p class="small muted">Your credit</p>
			{#if creditLine && (inBook || onWebsite)}
				<p class="credit-line">{creditLine}</p>
			{:else}
				<p class="credit-line muted">No credit</p>
			{/if}
		</div>
	</section>

	<div class="actions">
		<button class="button" type="submit" name="next" value="review">Continue to check your answers</button>
		<button class="button button-quiet" type="submit" name="next" value="later">Save and finish later</button>
	</div>
</form>

<style>
	.profile-form section {
		margin: 0 0 var(--space-6);
	}

	.profile-form h2 {
		margin-bottom: var(--space-3);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--color-line);
	}

	.profile-form h3 {
		margin: var(--space-4) 0 var(--space-2);
	}

	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}

	legend {
		padding: 0;
		font-weight: var(--font-weight-semibold);
		margin-bottom: var(--space-1);
	}

	/* A field, or a group of choices, with whether it is used on the right, lined up with the Credit column of the tables. */
	.field-with-use {
		display: grid;
		/* The last track matches the tables' Remove column, so every Shown and Private mark lines up. */
		grid-template-columns: minmax(0, 1fr) 8.5rem var(--layout-target-minimum);
		gap: 0;
		align-items: end;
		margin: 0 0 var(--space-4);
	}

	.profile-form select {
		font-size: inherit;
		padding: 0 var(--space-3);
		min-width: 12rem;
	}

	.field-with-use > :first-child {
		min-width: 0;
	}

	.field-with-use .field {
		margin: 0;
	}

	/* The table cells' own padding, so the marks sit exactly under the Credit column. */
	.field-with-use > .use,
	.picture-row > .use {
		padding-left: var(--space-2);
		box-sizing: border-box;
		width: 8.5rem;
	}

	.use {
		width: 8.5rem;
	}

	.picture-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) 8.5rem var(--layout-target-minimum);
		column-gap: 0;
		align-items: center;
		margin: 0 0 var(--space-4);
	}

	.avatar {
		margin-right: var(--space-4);
		display: grid;
		place-items: center;
		width: 6rem;
		height: 6rem;
		border-radius: 50%;
		background: var(--color-surface);
		border: 2px dashed var(--color-control-border);
		color: var(--color-ink-muted);
	}

	.picture-actions .hint {
		margin: var(--space-1) 0 0;
	}

	.file-button {
		gap: var(--space-2);
		position: relative;
	}

	.file-button:focus-within {
		outline: 3px solid var(--color-focus-ring);
		box-shadow: 0 0 0 6px var(--color-focus);
	}

	table.rows {
		margin: 0;
		font-size: var(--font-size-base, 1rem);
	}

	table.rows th {
		font-size: var(--font-size-small);
		white-space: nowrap;
	}

	table.rows td {
		vertical-align: middle;
		padding: var(--space-2);
	}

	table.rows th {
		padding: var(--space-2);
	}

	table.rows .use {
		width: 8.5rem;
	}

	table.rows .mark {
		width: 3.5rem;
		text-align: center;
	}

	table.rows .mark input {
		width: 1.25rem;
		height: 1.25rem;
		margin: 0;
	}

	table.rows .remove,
	table.rows th:last-child {
		width: var(--layout-target-minimum);
		padding-left: 0;
		padding-right: 0;
	}

	table.rows input[type='text'],
	table.rows input[type='email'],
	table.rows select {
		width: 100%;
		max-width: none;
	}

	.name-pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
	}

	.fixed-kind {
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
	}

	.sign-in-email {
		font-weight: var(--font-weight-semibold);
		overflow-wrap: anywhere;
	}

	.not-applicable {
		color: var(--color-ink-muted);
	}

	.other-text {
		margin-top: var(--space-2);
	}

	.add {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: var(--space-2) 0 var(--space-4);
	}

	.add .button {
		gap: var(--space-2);
	}

	.choice {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		margin: var(--space-2) 0;
	}

	.choice input {
		width: 1.25rem;
		height: 1.25rem;
		margin-top: 0.15em;
		flex: none;
	}

	.choice .hint {
		display: block;
		margin: 0;
	}

	.choices-inline {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-4);
	}

	.birthday {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-4);
		align-items: center;
		margin-top: var(--space-3);
	}

	.birthday legend {
		width: 100%;
		font-weight: normal;
	}

	.where {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-5);
		align-items: center;
		margin: 0 0 var(--space-4);
	}

	.where legend {
		float: left;
		margin: 0 var(--space-2) 0 0;
	}

	.credit-preview {
		padding: var(--space-3) var(--space-4);
		border-left: 4px solid var(--color-link);
		background: var(--color-surface);
		border-radius: var(--radius-control);
	}

	.credit-preview p {
		margin: 0;
	}

	.credit-line {
		font-family: var(--font-family-reading);
		font-size: var(--font-size-lead);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-top: var(--space-5);
	}

	/* On a phone each row becomes a card, with the column names written beside the boxes. */
	@container (max-width: 40rem) {
		table.rows,
		table.rows tbody,
		table.rows tr,
		table.rows td {
			display: block;
			width: auto;
		}

		table.rows thead {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
		}

		table.rows tr {
			position: relative;
			margin: 0 0 var(--space-3);
			padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
			border: 1px solid var(--color-line);
			border-radius: var(--radius-control);
		}

		table.rows td {
			border: 0;
			padding: var(--space-1) 0;
		}

		table.rows td.mark,
		table.rows td.use {
			display: inline-flex;
			align-items: center;
			gap: var(--space-2);
			width: auto;
			margin-right: var(--space-3);
		}

		table.rows td.mark::before {
			content: attr(data-label);
			font-size: var(--font-size-small);
		}

		table.rows td.mark:has(.not-applicable) {
			display: none;
		}

		table.rows td.remove {
			position: absolute;
			top: var(--space-1);
			right: var(--space-1);
			width: auto;
		}

		table.rows td.remove:empty {
			display: none;
		}

		table.rows tr:has(td.remove:not(:empty)) td:first-child {
			padding-right: calc(var(--layout-target-minimum) + var(--space-1));
		}

		.fixed-kind {
			display: none !important;
		}

		.name-pair {
			grid-template-columns: 1fr;
		}

		.field-with-use,
		.picture-row {
			grid-template-columns: minmax(0, 1fr);
		}

		.picture-row {
			grid-template-columns: auto minmax(0, 1fr);
		}

		.picture-row > .use {
			grid-column: 1 / -1;
		}
	}
</style>
