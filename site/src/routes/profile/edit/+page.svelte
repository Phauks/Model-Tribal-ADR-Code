<script lang="ts">
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import FileUp from '@lucide/svelte/icons/file-up';
	import UserRound from '@lucide/svelte/icons/user-round';
	import SearchableDropdown, { type SearchableChoice } from '#lib/components/SearchableDropdown.svelte';
	import CheckDropdown from '#lib/components/profile/CheckDropdown.svelte';
	import PhoneField from '#lib/components/profile/PhoneField.svelte';
	import PrivateMark from '#lib/components/profile/PrivateMark.svelte';
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
		nationNameForCredit,
		pronounChoices,
		pronounLabels,
		type PronounChoice,
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
	let otherNames = $state<{ key: number; name: string; kind: NameKind }[]>([
		{ key: 1, name: 'Sample Native Name', kind: 'native' },
		{ key: 2, name: 'Sam', kind: 'goes-by' }
	]);
	let pronouns = $state<PronounChoice[]>(['she']);
	let pronounOther = $state('');
	let birthYear = $state('1985');
	let hadBirthday = $state('');
	const thisYear = new Date().getFullYear();
	/** Years from 13 to 110 years ago, newest first. Signing up is for people 13 or older. */
	const birthYears = Array.from({ length: 98 }, (_, index) => String(thisYear - 13 - index));
	/** In the year someone turns 13 or 18, the year alone cannot say which side of the line they are on, so only then is a birthday asked. */
	const turning = $derived(birthYear ? thisYear - Number(birthYear) : 0);

	let emails = $state<{ key: number; value: string; mayEmail: boolean }[]>([]);
	let phones = $state<{ key: number; country: string; digits: string; mayCall: boolean; mayText: boolean }[]>([
		{ key: 1, country: 'US', digits: '7025550134', mayCall: true, mayText: true }
	]);
	let signInMayEmail = $state(true);
	let preferred = $state('phone-1');

	let nationAnswer = $state('listed');
	/** A nation from the project's list by its identifier, so the person's page can link to it; "other" is written in. */
	let nations = $state<{ key: number; identifier: string; name: string; connections: NationConnection[]; other: string }[]>([
		{ key: 1, identifier: 'navajo-nation', name: '', connections: ['citizen', 'works-for'], other: '' }
	]);
	const nationChoices: SearchableChoice<string>[] = $derived([
		...data.nationChoices,
		{ value: 'other', label: 'Not on the list', keywords: ['other', 'First Nations', 'state recognized'] }
	]);
	const nationTitle = (identifier: string, written: string) =>
		identifier === 'other' ? written : (data.nationChoices.find((choice) => choice.value === identifier)?.label ?? '');

	let spoken = $state<{ key: number; code: string; other: string; speaks: boolean; reads: boolean; writes: boolean }[]>([
		{ key: 1, code: 'nav', other: '', speaks: true, reads: true, writes: false },
		{ key: 2, code: 'eng', other: '', speaks: true, reads: true, writes: true }
	]);
	let organization = $state('Navajo Nation Peacemaking Program');
	let chosenSpecialties = $state<string[]>(['peacemaking', 'language']);
	let specialtyOthers = $state<string[]>([]);
	let specialtyOtherDraft = $state('');
	let specialtyPick = $state('');
	/** Choices not yet picked, then "Other" for one in the person's own words. */
	const specialtyChoices: SearchableChoice<string>[] = $derived([
		...specialties.filter((option) => !chosenSpecialties.includes(option)).map((option) => ({ value: option as string, label: specialtyLabels[option] })),
		{ value: 'other', label: 'Other, in your own words' }
	]);
	function addSpecialty(value: string): void {
		if (value === 'other') specialtyPick = 'other';
		else {
			chosenSpecialties.push(value);
			specialtyPick = '';
		}
	}
	let chosenInterests = $state(['review', 'share-knowledge', 'translate']);
	let availability = $state('monthly');
	let description = $state('');
	let biography = $state('');

	/**
	 * Where each answer may appear (Trevor, Nov. 24, 2026: "Shown" did not say
	 * whether that meant online or in anything published). Book means the
	 * printed book and ebook; Website means the person's contributor page and
	 * the credits on the website. Anything not ticked is never published.
	 */
	let uses = $state<Record<string, { book: boolean; website: boolean }>>({
		picture: { book: false, website: true },
		pronouns: { book: false, website: true },
		name: { book: true, website: true },
		'name-1': { book: true, website: true },
		'name-2': { book: false, website: false },
		'nation-1': { book: true, website: true },
		'language-1': { book: false, website: true },
		'language-2': { book: false, website: false },
		organization: { book: false, website: true },
		specialties: { book: false, website: true },
		description: { book: false, website: false },
		biography: { book: false, website: false }
	});

	/** Adds a row's Book and Website choices, both unticked, so nothing new is published until the person ticks it. */
	function addUse(id: string): void {
		uses[id] = { book: false, website: false };
	}

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

	/** The credit as it will read in one place, from everything ticked for that place. */
	function creditIn(place: 'book' | 'website'): string {
		const on = (id: string) => uses[id]?.[place] ?? false;
		const full = on('name') && !minor ? [givenName, familyName].filter(Boolean).join(' ') : '';
		const extra = otherNames.filter((name) => on(`name-${name.key}`) && name.name && (!minor || name.kind === 'pen-name')).map((name) => name.name);
		let line = full ? [full, ...extra.map((name) => `(${name})`)].join(' ') : extra.join(' ');
		if (!line && on('description')) line = description;
		if (!line) return '';
		const shownNations = nations.map((nation) => (on(`nation-${nation.key}`) ? nationNameForCredit(nationTitle(nation.identifier, nation.name)) : '')).filter(Boolean);
		if (shownNations.length > 0) line += `, ${shownNations.join('; ')}`;
		if (on('organization') && organization) line += `, ${organization}`;
		return line;
	}

	const bookCredit = $derived(creditIn('book'));
	const websiteCredit = $derived(creditIn('website'));
	/** What the contributor page adds to the website credit. */
	const websiteExtras = $derived(
		[
			!minor && uses.picture?.website ? 'picture' : '',
			spoken.some((language) => uses[`language-${language.key}`]?.website) ? 'languages' : '',
			uses.specialties?.website ? 'specialties' : '',
			!minor && uses.biography?.website && biography ? 'biography' : ''
		].filter(Boolean)
	);
</script>

<svelte:head>
	<title>Edit your profile · Model Tribal ADR Code</title>
</svelte:head>

{#snippet useCells(id: string, what: string, printable = true, restricted = false)}
	{#if restricted && minor}
		<td class="use-private" colspan="2"><PrivateMark /></td>
	{:else}
		<td data-label="Book" class="mark">
			{#if printable}<input type="checkbox" name="book" value={id} aria-label="Print {what} in the book" bind:checked={uses[id].book} />{:else}<span class="not-applicable" aria-label="Never printed">–</span>{/if}
		</td>
		<td data-label="Website" class="mark"><input type="checkbox" name="website" value={id} aria-label="Show {what} on the website" bind:checked={uses[id].website} /></td>
	{/if}
{/snippet}

{#snippet privateCells()}
	<td class="use-private" colspan="2"><PrivateMark /></td>
{/snippet}

{#snippet useBoxes(id: string, what: string, printable = true, restricted = false)}
	{#if restricted && minor}
		<div class="use-private"><PrivateMark /></div>
	{:else}
		<label class="use-box">
			<span>Book</span>
			{#if printable}<input type="checkbox" name="book" value={id} aria-label="Print {what} in the book" bind:checked={uses[id].book} />{:else}<span class="not-applicable" aria-label="Never printed">–</span>{/if}
		</label>
		<label class="use-box">
			<span>Website</span>
			<input type="checkbox" name="website" value={id} aria-label="Show {what} on the website" bind:checked={uses[id].website} />
		</label>
	{/if}
{/snippet}

<h1>Edit your profile</h1>
<p class="lead">Only the lead author and editors see your answers. Tick Book or Website for anything that may appear there; nothing else is published.</p>

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
			{@render useBoxes('picture', 'your picture', false, true)}
		</div>

		<table class="rows">
			<caption class="visually-hidden">Your names</caption>
			<thead>
				<tr><th scope="col">Name</th><th scope="col">Kind</th><th scope="col" class="mark">Book</th><th scope="col" class="mark">Website</th><th scope="col"><span class="visually-hidden">Remove</span></th></tr>
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
					{@render useCells('name', 'your first and last name', true, true)}
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
						{@render useCells(`name-${other.key}`, other.name || 'this name', true, other.kind !== 'pen-name')}
						<td class="remove">
							<button type="button" class="icon-button" aria-label="Remove {other.name || 'this name'}" title="Remove" onclick={() => (otherNames = otherNames.filter((item) => item.key !== other.key))}>
								<Trash2 size={20} strokeWidth={1.75} />
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="add"><button type="button" class="button button-quiet" onclick={() => { const added = key(); addUse(`name-${added}`); otherNames.push({ key: added, name: '', kind: 'native' }); }}><Plus size={20} strokeWidth={1.75} aria-hidden="true" /> Add a name</button></p>

		<div class="field-with-use">
			<div class="field">
				<span class="field-label" id="pronouns-label">Pronouns</span>
				<div class="short-control">
					<CheckDropdown name="pronouns" label="Pronouns" choices={pronounChoices} labels={pronounLabels} bind:chosen={pronouns} />
				</div>
				{#if pronouns.includes('other')}
					<input type="text" class="other-text short-control" name="pronounOther" aria-label="Your pronouns" placeholder="Your pronouns" bind:value={pronounOther} />
				{/if}
			</div>
			{@render useBoxes('pronouns', 'your pronouns', false)}
		</div>

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
			<div class="use-private"><PrivateMark /></div>
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
					<th scope="col" class="mark">Preferred</th>
					<th scope="col" class="mark" colspan="2">Published</th>
					<th scope="col"><span class="visually-hidden">Remove</span></th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td data-label="Contact"><span class="sign-in-email">{data.email}</span> <span class="small muted">Signed in with</span></td>
					<td data-label="Email" class="mark"><input type="checkbox" name="signInMayEmail" aria-label="Email {data.email}" bind:checked={signInMayEmail} /></td>
					<td data-label="Call" class="mark"><span class="not-applicable" aria-label="Not a phone">–</span></td>
					<td data-label="Text" class="mark"><span class="not-applicable" aria-label="Not a phone">–</span></td>
					<td data-label="Preferred" class="mark"><input type="radio" name="preferred" value="sign-in" aria-label="Preferred: {data.email}" bind:group={preferred} /></td>
					{@render privateCells()}
					<td></td>
				</tr>
				{#each emails as email, index (email.key)}
					<tr>
						<td data-label="Contact"><input type="email" name="email" aria-label="Email address {index + 2}" autocomplete="email" bind:value={email.value} /></td>
						<td data-label="Email" class="mark"><input type="checkbox" name="emailMayEmail" value={String(index)} aria-label="Email this address" bind:checked={email.mayEmail} /></td>
						<td data-label="Call" class="mark"><span class="not-applicable" aria-label="Not a phone">–</span></td>
						<td data-label="Text" class="mark"><span class="not-applicable" aria-label="Not a phone">–</span></td>
						<td data-label="Preferred" class="mark"><input type="radio" name="preferred" value="email-{index}" aria-label="Preferred: this address" bind:group={preferred} /></td>
						{@render privateCells()}
						<td class="remove"><button type="button" class="icon-button" aria-label="Remove this address" title="Remove" onclick={() => (emails = emails.filter((item) => item.key !== email.key))}><Trash2 size={20} strokeWidth={1.75} /></button></td>
					</tr>
				{/each}
				{#each phones as phone, index (phone.key)}
					<tr>
						<td data-label="Contact"><PhoneField name="phone{index}" label="Phone {index + 1}" bind:country={phone.country} bind:digits={phone.digits} /></td>
						<td data-label="Email" class="mark"><span class="not-applicable" aria-label="Not an email address">–</span></td>
						<td data-label="Call" class="mark"><input type="checkbox" name="phoneMayCall" value={String(index)} aria-label="Call this number" bind:checked={phone.mayCall} /></td>
						<td data-label="Text" class="mark"><input type="checkbox" name="phoneMayText" value={String(index)} aria-label="Text this number" bind:checked={phone.mayText} /></td>
						<td data-label="Preferred" class="mark"><input type="radio" name="preferred" value="phone-{phone.key}" aria-label="Preferred: this number" bind:group={preferred} /></td>
						{@render privateCells()}
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
					<tr><th scope="col">Nation</th><th scope="col">Relationship</th><th scope="col" class="mark">Book</th><th scope="col" class="mark">Website</th><th scope="col"><span class="visually-hidden">Remove</span></th></tr>
				</thead>
				<tbody>
					{#each nations as nation, index (nation.key)}
						<tr>
							<td data-label="Nation">
								<SearchableDropdown label="Nation {index + 1}" hideLabel name="nation{index}" choices={nationChoices} value={nation.identifier} onchange={(value) => (nation.identifier = value)} />
								{#if nation.identifier === 'other'}
									<input type="text" class="other-text" name="nationOther{index}" aria-label="The nation’s name" placeholder="The nation’s name" bind:value={nation.name} />
								{/if}
							</td>
							<td data-label="Relationship">
								<CheckDropdown
									name="nationConnection{index}"
									label="Your relationship to {nationTitle(nation.identifier, nation.name) || `nation ${index + 1}`}"
									choices={nationConnections}
									labels={nationConnectionLabels}
									bind:chosen={nation.connections}
								/>
								{#if nation.connections.includes('other')}
									<input type="text" class="other-text" name="nationConnectionOther{index}" aria-label="Other relationship, in your own words" placeholder="In your own words" bind:value={nation.other} />
								{/if}
							</td>
							{@render useCells(`nation-${nation.key}`, nationTitle(nation.identifier, nation.name) || 'this nation')}
							<td class="remove"><button type="button" class="icon-button" aria-label="Remove {nationTitle(nation.identifier, nation.name) || 'this nation'}" title="Remove" onclick={() => (nations = nations.filter((item) => item.key !== nation.key))}><Trash2 size={20} strokeWidth={1.75} /></button></td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="add"><button type="button" class="button button-quiet" onclick={() => { const added = key(); addUse(`nation-${added}`); nations.push({ key: added, identifier: '', name: '', connections: [], other: '' }); }}><Plus size={20} strokeWidth={1.75} aria-hidden="true" /> Add a nation</button></p>
		{/if}
	</section>

	<section aria-labelledby="background-heading">
		<h2 id="background-heading">Your background</h2>
		<div class="field-with-use">
			<div class="field">
				<label for="background">Tell us about yourself</label>
				<p class="hint" id="background-hint">For example: peacemaking, mediation, Tribal courts or law, community roles, writing or research.</p>
				<textarea id="background" name="background" rows="4" aria-describedby="background-hint"></textarea>
				<div class="cv-row">
					<label class="button button-quiet file-button">
						<FileUp size={20} strokeWidth={1.75} aria-hidden="true" />
						Add CV or résumé
						<input type="file" name="curriculumVitae" accept=".pdf,.docx,.doc,.odt,.rtf,.txt" class="visually-hidden" />
					</label>
					<span class="hint">.pdf, .docx, .odt. Checked for viruses.</span>
				</div>
			</div>
			<div class="use-private"><PrivateMark /></div>
		</div>

		<h3 id="languages-heading">Languages</h3>
		<table class="rows languages">
			<caption class="visually-hidden">Languages you speak or read</caption>
			<thead>
				<tr>
					<th scope="col">Language</th>
					<th scope="col" class="mark">Speak</th>
					<th scope="col" class="mark">Read</th>
					<th scope="col" class="mark">Write</th>
					<th scope="col" class="mark">Book</th>
					<th scope="col" class="mark">Website</th>
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
						<td data-label="Write" class="mark"><input type="checkbox" name="languageWrites" value={String(index)} aria-label="Write" bind:checked={language.writes} /></td>
						{@render useCells(`language-${language.key}`, 'this language', false)}
						<td class="remove"><button type="button" class="icon-button" aria-label="Remove this language" title="Remove" onclick={() => (spoken = spoken.filter((item) => item.key !== language.key))}><Trash2 size={20} strokeWidth={1.75} /></button></td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="add"><button type="button" class="button button-quiet" onclick={() => { const added = key(); addUse(`language-${added}`); spoken.push({ key: added, code: '', other: '', speaks: true, reads: false, writes: false }); }}><Plus size={20} strokeWidth={1.75} aria-hidden="true" /> Add a language</button></p>

		<div class="field-with-use">
			<div class="field">
				<label for="organization">Organization, office or school</label>
				<input type="text" id="organization" name="organization" autocomplete="organization" bind:value={organization} />
			</div>
			{@render useBoxes('organization', 'your organization')}
		</div>

		<fieldset class="field-with-use">
			<div>
				<legend>Your specialties</legend>
				{#if chosenSpecialties.length + specialtyOthers.length > 0}
					<ul class="chips">
						{#each chosenSpecialties as option (option)}
							<li>
								<input type="hidden" name="specialties" value={option} />
								{specialtyLabels[option as keyof typeof specialtyLabels]}
								<button type="button" class="chip-remove" aria-label="Remove {specialtyLabels[option as keyof typeof specialtyLabels]}" title="Remove" onclick={() => (chosenSpecialties = chosenSpecialties.filter((item) => item !== option))}><X size={16} strokeWidth={2} /></button>
							</li>
						{/each}
						{#each specialtyOthers as other (other)}
							<li>
								<input type="hidden" name="specialtyOther" value={other} />
								{other}
								<button type="button" class="chip-remove" aria-label="Remove {other}" title="Remove" onclick={() => (specialtyOthers = specialtyOthers.filter((item) => item !== other))}><X size={16} strokeWidth={2} /></button>
							</li>
						{/each}
					</ul>
				{/if}
				<div class="short-control">
					<SearchableDropdown label="Add a specialty" hideLabel choices={specialtyChoices} value={specialtyPick} onchange={addSpecialty} placeholder="Type to search, or pick" />
				</div>
				{#if specialtyPick === 'other'}
					<div class="other-row short-control">
						<input type="text" aria-label="Specialty, in your own words" placeholder="In your own words" maxlength="100" bind:value={specialtyOtherDraft} />
						<button type="button" class="button button-quiet" onclick={() => { if (specialtyOtherDraft.trim()) specialtyOthers.push(specialtyOtherDraft.trim()); specialtyOtherDraft = ''; specialtyPick = ''; }}>Add</button>
					</div>
				{/if}
			</div>
			{@render useBoxes('specialties', 'your specialties', false)}
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
			<div class="use-private"><PrivateMark /></div>
		</fieldset>
		<div class="field-with-use">
			<div class="field">
				<label for="availability">How much time you have</label>
				<select id="availability" name="availability" bind:value={availability}>
					<option value="">Choose</option>
					{#each availabilities as option (option)}<option value={option}>{availabilityLabels[option]}</option>{/each}
				</select>
			</div>
			<div class="use-private"><PrivateMark /></div>
		</div>
	</section>

	<section aria-labelledby="credit-heading">
		<h2 id="credit-heading">Credit</h2>
		<div class="field-with-use">
			<div class="field">
				<label for="creditRole">A description, to use in place of a name</label>
				<input type="text" id="creditRole" name="creditRole" placeholder="For example: a peacemaker from the nation" bind:value={description} />
			</div>
			{@render useBoxes('description', 'this description')}
		</div>
		<div class="field-with-use">
			<div class="field">
				<label for="biography">A short biography</label>
				<p class="hint" id="biography-hint">Two or three sentences. Asked of writers.</p>
				<textarea id="biography" name="biography" rows="3" aria-describedby="biography-hint" bind:value={biography}></textarea>
			</div>
			{@render useBoxes('biography', 'your biography', true, true)}
		</div>
		<dl class="credit-preview" aria-live="polite">
			<div>
				<dt>In the book</dt>
				<dd class="credit-line" class:muted={!bookCredit}>{bookCredit || 'No credit'}</dd>
			</div>
			<div>
				<dt>On the website</dt>
				<dd class="credit-line" class:muted={!websiteCredit}>{websiteCredit || 'No credit'}</dd>
				{#if websiteCredit && websiteExtras.length > 0}<dd class="small muted">With your {websiteExtras.join(', ')}</dd>{/if}
			</div>
		</dl>
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

	/* A field, or a group of choices, with where it may appear on the right, lined up with the Book and Website columns of the tables. */
	.field-with-use {
		--mark-width: 5rem;
		display: grid;
		/* The last track matches the tables' Remove column, so every Book, Website and Private mark lines up. */
		grid-template-columns: minmax(0, 1fr) var(--mark-width) var(--mark-width) var(--layout-target-minimum);
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

	/* Outside a table each box carries its own small Book or Website label, centered over the box as the column header is in a table. */
	.use-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
		cursor: pointer;
	}

	.use-box input {
		width: 1.25rem;
		height: 1.25rem;
		margin: 0 0 0.6rem;
	}

	.use-box .not-applicable {
		line-height: 1.25rem;
		margin-bottom: 0.6rem;
	}

	div.use-private {
		grid-column: span 2;
		display: flex;
		justify-content: center;
	}

	.picture-row {
		--mark-width: 5rem;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) var(--mark-width) var(--mark-width) var(--layout-target-minimum);
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

	.cv-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin-top: var(--space-2);
	}

	.cv-row .hint {
		margin: 0;
	}

	.field-label {
		display: block;
		font-weight: var(--font-weight-semibold);
		margin-bottom: var(--space-1);
	}

	.short-control {
		max-width: 20rem;
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

	table.rows .mark {
		width: 5rem;
		box-sizing: border-box;
		text-align: center;
	}

	table.rows td.use-private {
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

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0 0 var(--space-2);
		padding: 0;
		list-style: none;
	}

	.chips li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0 0 0 var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: 999px;
		background: var(--color-surface);
	}

	.chip-remove {
		display: inline-grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.chip-remove:hover {
		background: color-mix(in srgb, currentColor 14%, transparent);
	}

	.other-row {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
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



	.credit-preview {
		padding: var(--space-3) var(--space-4);
		border-left: 4px solid var(--color-link);
		background: var(--color-surface);
		border-radius: var(--radius-control);
	}


	.credit-preview {
		display: grid;
		gap: var(--space-3);
		margin: 0;
	}

	.credit-preview dt {
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	.credit-preview dd {
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
		table.rows td.use-private {
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

		.field-with-use {
			grid-template-columns: auto auto 1fr;
			align-items: center;
		}

		.field-with-use > :first-child {
			grid-column: 1 / -1;
		}

		.picture-row {
			grid-template-columns: auto auto 1fr;
		}

		.picture-row > .picture-actions {
			grid-column: 2 / -1;
		}

		.use-box {
			flex-direction: row-reverse;
			margin: var(--space-2) var(--space-4) 0 0;
		}

		.use-box input,
		.use-box .not-applicable {
			margin: 0;
		}

		div.use-private {
			justify-content: flex-start;
			margin-top: var(--space-1);
		}
	}
</style>
