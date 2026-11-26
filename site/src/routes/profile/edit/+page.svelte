<script lang="ts">
	import { untrack } from 'svelte';
	import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
	import FileText from '@lucide/svelte/icons/file-text';
	import FileUp from '@lucide/svelte/icons/file-up';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import UserRound from '@lucide/svelte/icons/user-round';
	import X from '@lucide/svelte/icons/x';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import SearchableDropdown, { type SearchableChoice } from '#lib/components/SearchableDropdown.svelte';
	import CheckDropdown from '#lib/components/profile/CheckDropdown.svelte';
	import PhoneField from '#lib/components/profile/PhoneField.svelte';
	import PrivateMark from '#lib/components/profile/PrivateMark.svelte';
	import {
		ageGroupOf,
		availabilities,
		availabilityLabels,
		birthdayQuestionAge,
		creditIn,
		emptyAnswers,
		interestLabels,
		interestNextSteps,
		interests,
		nameKindLabels,
		nameKinds,
		nationAnswerLabels,
		nationAnswers,
		nationRelationshipLabels,
		nationRelationships,
		oldestAge,
		placedAnswers,
		pronounChoices,
		pronounLabels,
		specialties,
		specialtyLabels,
		youngestAge,
		type Availability,
		type Interest,
		type NameKind,
		type NationAnswer,
		type NationRelationship,
		type PlacedAnswer,
		type Placement,
		type ProfileAnswers,
		type PronounChoice,
		type Specialty
	} from '#lib/contributors.ts';
	import { languageGroupLabels, languageOf, languages } from '#lib/languages.ts';
	import { canSquarePictures, squarePicture } from '#lib/square-picture.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** The answers the form starts from: those just sent when they came back with a problem, else those saved. The page is drawn again after each save, so these are read once. */
	const start: ProfileAnswers = untrack(() => form?.answers ?? data.profile?.answers ?? emptyAnswers);
	const year = untrack(() => data.year);
	const errors: Record<string, string> = $derived(form?.errors ?? {});
	const errorCount = $derived(Object.keys(errors).length);

	/** Moves focus to the message at the top when the form comes back with problems (WCAG 3.3.1). */
	function focusOnArrival(node: HTMLElement) {
		node.focus();
	}

	/**
	 * Each repeatable row has a short key. The form sends the keys in order
	 * under "…Row" and each field as "<field>-<key>"
	 * (src/lib/server/contributor-form.ts).
	 */
	let nextKey = 0;
	const key = () => `r${nextKey++}`;

	/**
	 * Where each answer may appear (Trevor, Nov. 24, 2026: "Shown" did not say
	 * whether that meant online or in anything published). Book means the
	 * printed book and ebook; Website means the person's contributor page and
	 * the credits on the website. Anything not ticked is never published.
	 */
	const uses = $state<Record<string, Placement>>(
		Object.fromEntries(placedAnswers.map((item) => [item, { ...(start.placements?.[item] ?? { book: false, website: false }) }]))
	);

	/** Adds a row's Book and Website choices, unticked unless given, so nothing new is published until the person ticks it. */
	function addUse(id: string, placement: Placement = { book: false, website: false }): void {
		uses[id] = { book: placement.book, website: placement.website };
	}

	let givenName = $state(start.givenName ?? '');
	let familyName = $state(start.familyName ?? '');
	let otherNames = $state(
		start.names.map((name) => {
			const rowKey = key();
			addUse(`name-${rowKey}`, name);
			return { key: rowKey, name: name.name, kind: name.kind as NameKind };
		})
	);
	function addName(): void {
		const rowKey = key();
		addUse(`name-${rowKey}`);
		otherNames.push({ key: rowKey, name: '', kind: 'native' });
	}

	let pronouns = $state<PronounChoice[]>([...start.pronouns]);
	let pronounOther = $state(start.pronounOther ?? '');

	let birthYear = $state(start.birthYear === null ? '' : String(start.birthYear));
	let birthdayAnswer = $state(start.birthdayAnswerYear === year ? (start.birthdayAnswer ?? '') : '');
	/** Years from 13 to 110 years ago, newest first. Signing up is for people 13 or older. */
	const birthYears = Array.from({ length: oldestAge - youngestAge + 1 }, (_, index) => String(year - youngestAge - index));
	/** In the year someone turns 13 or 18, the year alone cannot say which side of the line they are on, so only then is a birthday asked. */
	const turning = $derived(birthdayQuestionAge(birthYear ? Number(birthYear) : null, year));
	const ageGroup = $derived(
		ageGroupOf(
			{ birthYear: birthYear ? Number(birthYear) : null, birthdayAnswer: birthdayAnswer === 'yes' || birthdayAnswer === 'no' ? birthdayAnswer : null, birthdayAnswerYear: year },
			year
		)
	);
	/** Under 18, or not yet known: only a pen name may be published, and nothing that could identify the person. */
	const minor = $derived(ageGroup !== '18-or-older');
	/** Known to be under 18, so no picture may be added. With the age not yet given, a picture may be sent with the birth year. */
	const youngerThanEighteen = $derived(ageGroup === '13-to-17' || ageGroup === 'under-13');

	/** The national digits of a saved number, such as 7025550134 for +17025550134. */
	function nationalDigits(value: string): string {
		if (!value.startsWith('+')) return value.replace(/\D/g, '');
		return parsePhoneNumberFromString(value)?.nationalNumber ?? value.replace(/\D/g, '');
	}

	type ContactRow = { key: string; kind: 'sign-in' | 'email' | 'phone'; value: string; country: string; mayEmail: boolean; mayCall: boolean; mayText: boolean };
	const startContacts = [...start.contacts].sort((first, second) => Number(second.signIn) - Number(first.signIn));
	if (!startContacts.some((contact) => contact.signIn)) {
		startContacts.unshift({ kind: 'email', value: untrack(() => data.email), country: null, signIn: true, mayEmail: true, mayCall: false, mayText: false, preferred: !startContacts.some((contact) => contact.preferred) });
	}
	const startRows: ContactRow[] = startContacts.map((contact) => ({
		key: key(),
		kind: contact.signIn ? 'sign-in' : contact.kind,
		value: contact.kind === 'phone' ? nationalDigits(contact.value) : contact.value,
		country: contact.country ?? 'US',
		mayEmail: contact.mayEmail,
		mayCall: contact.mayCall,
		mayText: contact.mayText
	}));
	let contacts = $state<ContactRow[]>(startRows);
	let preferred = $state(startRows[Math.max(0, startContacts.findIndex((contact) => contact.preferred))].key);
	function addContact(kind: 'email' | 'phone'): void {
		contacts.push({ key: key(), kind, value: '', country: 'US', mayEmail: kind === 'email', mayCall: kind === 'phone', mayText: false });
	}

	let nationAnswer = $state<NationAnswer | ''>(start.nationAnswer ?? '');
	type NationRow = { key: string; identifier: string; name: string; relationships: NationRelationship[]; other: string };
	/** A nation from the project's list by its identifier, so the person's page can link to it; "other" is written in. */
	let nations = $state<NationRow[]>(
		start.nations.map((nation) => {
			const rowKey = key();
			addUse(`nation-${rowKey}`, nation);
			return {
				key: rowKey,
				identifier: nation.nationIdentifier ?? 'other',
				name: nation.nationIdentifier ? '' : nation.nationName,
				relationships: [...nation.relationships],
				other: nation.relationshipOther ?? ''
			};
		})
	);
	function addNation(): void {
		const rowKey = key();
		addUse(`nation-${rowKey}`);
		nations.push({ key: rowKey, identifier: '', name: '', relationships: [], other: '' });
	}
	const nationChoices: SearchableChoice<string>[] = $derived([
		...data.nationChoices,
		{ value: 'other', label: 'Not on the list', keywords: ['other', 'First Nations', 'state recognized'] }
	]);
	const nationTitle = (identifier: string, written: string) =>
		identifier === 'other' ? written : (data.nationChoices.find((choice) => choice.value === identifier)?.label ?? '');

	let background = $state(start.background ?? '');

	type LanguageRow = { key: string; code: string; other: string; speaks: boolean; reads: boolean; writes: boolean };
	let spoken = $state<LanguageRow[]>(
		start.languages.map((language) => {
			const rowKey = key();
			addUse(`language-${rowKey}`, { book: false, website: language.website });
			return { key: rowKey, code: language.code ?? 'other', other: language.otherName ?? '', speaks: language.speaks, reads: language.reads, writes: language.writes };
		})
	);
	function addLanguage(): void {
		const rowKey = key();
		addUse(`language-${rowKey}`);
		spoken.push({ key: rowKey, code: '', other: '', speaks: true, reads: false, writes: false });
	}
	const languageChoices: SearchableChoice<string>[] = [
		...languages.map((language) => ({
			value: language.code,
			label: language.name,
			group: languageGroupLabels[language.group],
			keywords: [language.code, ...(language.keywords ?? [])]
		})),
		{ value: 'other', label: 'Other', group: languageGroupLabels.other }
	];

	let organization = $state(start.organization ?? '');
	let chosenSpecialties = $state<Specialty[]>([...start.specialties]);
	let specialtyOthers = $state<string[]>([...start.specialtyOthers]);
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
			chosenSpecialties.push(value as Specialty);
			specialtyPick = '';
		}
	}
	function addSpecialtyOther(): void {
		const written = specialtyOtherDraft.trim();
		if (written && !specialtyOthers.includes(written)) specialtyOthers.push(written);
		specialtyOtherDraft = '';
		specialtyPick = '';
	}

	let chosenInterests = $state<Interest[]>([...start.interests]);
	let availability = $state<Availability | ''>(start.availability ?? '');
	let description = $state(start.description ?? '');
	let biography = $state(start.biography ?? '');

	// The "Add" buttons without scripts save the form and come back with one more empty row.
	untrack(() => {
		if (data.add === 'name') addName();
		else if (data.add === 'email' || data.add === 'phone') addContact(data.add);
		else if (data.add === 'nation') addNation();
		else if (data.add === 'language') addLanguage();
		if (start.nationAnswer === 'listed' && nations.length === 0 && data.add !== 'nation') addNation();
	});

	function chooseNationAnswer(answer: string): void {
		if (answer === 'listed' && nations.length === 0) addNation();
	}

	const nameKindChoices = nameKinds.map((kind) => ({ value: kind, label: nameKindLabels[kind] }));
	const birthYearChoices = birthYears.map((option) => ({ value: option, label: option }));
	const nationAnswerChoices = [{ value: '' as const, label: 'Choose' }, ...nationAnswers.map((option) => ({ value: option, label: nationAnswerLabels[option] }))];
	const availabilityChoices = [{ value: '' as const, label: 'Choose' }, ...availabilities.map((option) => ({ value: option, label: availabilityLabels[option] }))];

	/** With scripts an Add or Remove button changes the form in place; without them it saves and comes back. */
	function inPlace(change: () => void) {
		return (event: MouseEvent) => {
			event.preventDefault();
			change();
		};
	}

	// The picture: the one saved, or the one just chosen, which the browser makes square before it is sent.
	const savedPicture = $derived(
		data.profile?.pictureKey ? `/profile/picture?v=${encodeURIComponent(data.profile.pictureUpdatedAt ?? '')}` : null
	);
	let pictureInput: HTMLInputElement | undefined = $state();
	let picturePreview = $state<string | null>(null);
	let pictureProblem = $state<string | null>(null);
	let removingPicture = $state(false);
	const shownPicture = $derived(picturePreview ?? (removingPicture ? null : savedPicture));

	async function choosePicture(): Promise<void> {
		const file = pictureInput?.files?.[0];
		pictureProblem = null;
		if (!pictureInput || !file || !canSquarePictures()) return;
		const square = await squarePicture(file, data.pictureSide);
		if (!square) {
			pictureInput.value = '';
			pictureProblem = 'This file could not be opened as a picture. Choose a photo or picture file.';
			return;
		}
		const transfer = new DataTransfer();
		transfer.items.add(square);
		pictureInput.files = transfer.files;
		if (picturePreview) URL.revokeObjectURL(picturePreview);
		picturePreview = URL.createObjectURL(square);
		removingPicture = false;
	}

	function removeChosenPicture(): void {
		if (picturePreview) {
			URL.revokeObjectURL(picturePreview);
			picturePreview = null;
			if (pictureInput) pictureInput.value = '';
		} else removingPicture = true;
	}

	// The CV or résumé: the one saved, or the one just chosen.
	const savedDocument = $derived(data.profile?.curriculumVitaeName ?? null);
	let documentInput: HTMLInputElement | undefined = $state();
	let chosenDocument = $state<string | null>(null);
	let removingDocument = $state(false);
	function chooseDocument(): void {
		chosenDocument = documentInput?.files?.[0]?.name ?? null;
		if (chosenDocument) removingDocument = false;
	}
	function removeDocument(): void {
		if (chosenDocument) {
			chosenDocument = null;
			if (documentInput) documentInput.value = '';
		} else removingDocument = true;
	}
	const shownDocument = $derived(chosenDocument ?? (removingDocument ? null : savedDocument));

	/** The answers as they stand, for the credit preview, built the same way the server builds them. */
	const current: ProfileAnswers = $derived({
		...emptyAnswers,
		givenName: givenName.trim() || null,
		familyName: familyName.trim() || null,
		names: otherNames.map((name) => ({ name: name.name.trim(), kind: name.kind, ...(uses[`name-${name.key}`] ?? { book: false, website: false }) })),
		ageGroup: ageGroup === '13-to-17' || ageGroup === '18-or-older' ? ageGroup : null,
		nations: nations
			.filter((nation) => nationTitle(nation.identifier, nation.name))
			.map((nation) => ({
				nationIdentifier: nation.identifier === 'other' ? null : nation.identifier,
				nationName: nationTitle(nation.identifier, nation.name),
				relationships: nation.relationships,
				relationshipOther: null,
				...(uses[`nation-${nation.key}`] ?? { book: false, website: false })
			})),
		organization: organization.trim() || null,
		description: description.trim() || null,
		biography: biography.trim() || null,
		placements: Object.fromEntries(placedAnswers.map((item) => [item, uses[item]])) as Record<PlacedAnswer, Placement>
	});
	const bookCredit = $derived(nationAnswer === 'listed' ? creditIn(current, 'book')?.line : creditIn({ ...current, nations: [] }, 'book')?.line);
	const websiteCredit = $derived(nationAnswer === 'listed' ? creditIn(current, 'website')?.line : creditIn({ ...current, nations: [] }, 'website')?.line);
	/** What the contributor page adds to the website credit. */
	const websiteExtras = $derived(
		[
			!minor && uses.picture?.website && shownPicture ? 'picture' : '',
			spoken.some((language) => (language.code && language.code !== 'other' ? languageOf(language.code) : language.other.trim()) && uses[`language-${language.key}`]?.website) ? 'languages' : '',
			uses.specialties?.website && chosenSpecialties.length + specialtyOthers.length > 0 ? 'specialties' : '',
			!minor && uses.biography?.website && biography.trim() ? 'biography' : ''
		].filter(Boolean)
	);
</script>

<svelte:head>
	<title>Edit your profile · Tribal Law Project</title>
</svelte:head>

{#snippet fieldError(name: string)}
	{#if errors[name]}
		<p class="field-error" id="{name}-error"><span class="visually-hidden">Error:</span> {errors[name]}</p>
	{/if}
{/snippet}

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

{#snippet removeButton(row: string, what: string, change: () => void)}
	<button type="submit" name="remove" value={row} class="icon-button" aria-label="Remove {what}" title="Remove" formnovalidate onclick={inPlace(change)}>
		<Trash2 size={20} strokeWidth={1.75} />
	</button>
{/snippet}

<h1>Edit your profile</h1>
<p class="lead">Only the lead author and editors see your answers. Tick Book or Website for anything that may appear there; nothing else is published.</p>

{#if errorCount > 0}
	<div class="notice notice-problem" role="alert" tabindex="-1" {@attach focusOnArrival}>
		<p>
			<strong>Please check {errorCount === 1 ? 'one answer' : `${errorCount} answers`}.</strong> The messages are next to the questions below.
		</p>
	</div>
{/if}

<form method="post" enctype="multipart/form-data" novalidate class="profile-form">
	<!-- Pressing Enter in a box saves a draft, rather than pressing the first Add or Remove button. -->
	<button type="submit" name="next" value="later" class="visually-hidden" tabindex="-1" aria-hidden="true">Save draft</button>

	<section aria-labelledby="about-heading" id="about">
		<h2 id="about-heading">About you</h2>

		<div class="picture-row" id="picture">
			<div class="avatar" class:has-picture={shownPicture && !youngerThanEighteen} aria-hidden="true">
				{#if shownPicture && !youngerThanEighteen}<img src={shownPicture} alt="" width="96" height="96" />{:else}<UserRound size={44} strokeWidth={1.5} />{/if}
			</div>
			<div class="picture-actions">
				{#if youngerThanEighteen}
					<p class="hint">Pictures are for people 18 or older.</p>
				{:else}
					<div class="file-actions">
						<label class="button button-quiet file-button">
							<ImagePlus size={20} strokeWidth={1.75} aria-hidden="true" />
							{shownPicture ? 'Change picture' : 'Add picture'}
							<input bind:this={pictureInput} type="file" name="picture" accept="image/*" class="visually-hidden" aria-describedby="picture-hint" onchange={choosePicture} />
						</label>
						{#if shownPicture}
							<button type="button" class="button button-quiet" onclick={removeChosenPicture}>Remove</button>
						{/if}
					</div>
					{#if removingPicture}<input type="hidden" name="removePicture" value="yes" />{/if}
					<p class="hint" id="picture-hint">Square, from the middle. Checked for viruses; camera details removed.</p>
					{#if pictureProblem}<p class="field-error" role="alert"><span class="visually-hidden">Error:</span> {pictureProblem}</p>{/if}
					{@render fieldError('picture')}
				{/if}
			</div>
			{@render useBoxes('picture', 'your picture', false, true)}
		</div>

		<table class="rows" id="name-rows">
			<caption class="visually-hidden">Your names</caption>
			<thead>
				<tr><th scope="col">Name</th><th scope="col">Kind</th><th scope="col" class="mark">Book</th><th scope="col" class="mark">Website</th><th scope="col"><span class="visually-hidden">Remove</span></th></tr>
			</thead>
			<tbody>
				<tr>
					<td data-label="Name">
						<div class="name-pair">
							<input type="text" name="givenName" aria-label="First name" placeholder="First name" autocomplete="given-name" aria-invalid={errors.givenName ? 'true' : undefined} aria-describedby={errors.givenName ? 'givenName-error' : undefined} bind:value={givenName} />
							<input type="text" name="familyName" aria-label="Last name" placeholder="Last name" autocomplete="family-name" aria-invalid={errors.familyName ? 'true' : undefined} aria-describedby={errors.familyName ? 'familyName-error' : undefined} bind:value={familyName} />
						</div>
						{@render fieldError('givenName')}
						{@render fieldError('familyName')}
					</td>
					<td data-label="Kind" class="fixed-kind">First and last name</td>
					{@render useCells('full-name', 'your first and last name', true, true)}
					<td></td>
				</tr>
				{#each otherNames as other, index (other.key)}
					<tr>
						<td data-label="Name">
							<input type="hidden" name="nameRow" value={other.key} />
							<input type="text" name="name-{other.key}" aria-label="Name {index + 2}" aria-invalid={errors[`name-${index}`] ? 'true' : undefined} aria-describedby={errors[`name-${index}`] ? `name-${index}-error` : undefined} bind:value={other.name} />
							{@render fieldError(`name-${index}`)}
						</td>
						<td data-label="Kind">
							<Dropdown label="Kind of name {index + 2}" hideLabel name="nameKind-{other.key}" choices={nameKindChoices} bind:value={other.kind} />
						</td>
						{@render useCells(`name-${other.key}`, other.name || 'this name', true, other.kind !== 'pen-name')}
						<td class="remove">{@render removeButton(`name-${other.key}`, other.name || 'this name', () => (otherNames = otherNames.filter((item) => item.key !== other.key)))}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="add"><button type="submit" name="add" value="name" class="button button-quiet" formnovalidate onclick={inPlace(addName)}><Plus size={20} strokeWidth={1.75} aria-hidden="true" /> Add a name</button></p>

		<div class="field-with-use">
			<div class="field">
				<span class="field-label" id="pronouns-label">Pronouns</span>
				<div class="short-control">
					<CheckDropdown name="pronouns" label="Pronouns" choices={pronounChoices} labels={pronounLabels} bind:chosen={pronouns} />
				</div>
				{#if pronouns.includes('other')}
					<input type="text" class="other-text short-control" name="pronounOther" aria-label="Your pronouns" placeholder="Your pronouns" bind:value={pronounOther} />
				{/if}
				{@render fieldError('pronounOther')}
			</div>
			{@render useBoxes('pronouns', 'your pronouns', false)}
		</div>

		<div class="field-with-use">
			<div class="field">
				<SearchableDropdown
					label="Birth year"
					id="birthYear"
					name="birthYear"
					placeholder="Choose"
					choices={birthYearChoices}
					bind:value={birthYear}
					invalid={Boolean(errors.birthYear)}
					describedBy={errors.birthYear ? 'birthYear-error' : undefined}
				>
					{#snippet message()}{@render fieldError('birthYear')}{/snippet}
				</SearchableDropdown>
				{#if turning}
					<fieldset class="birthday">
						<legend>Have you had your {turning}th birthday yet?</legend>
						<label class="choice"><input type="radio" name="birthdayAnswer" value="yes" bind:group={birthdayAnswer} /> Yes</label>
						<label class="choice"><input type="radio" name="birthdayAnswer" value="no" bind:group={birthdayAnswer} /> Not yet</label>
					</fieldset>
				{/if}
			</div>
			<div class="use-private"><PrivateMark /></div>
		</div>
	</section>

	<section aria-labelledby="contact-heading" id="contact">
		<h2 id="contact-heading">How to reach you</h2>
		<table class="rows contacts" id="contact-rows">
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
				{#each contacts as contact, index (contact.key)}
					{@const what = contact.kind === 'phone' ? 'this number' : contact.kind === 'sign-in' ? data.email : 'this address'}
					<tr>
						<td data-label="Contact">
							<input type="hidden" name="contactRow" value={contact.key} />
							<input type="hidden" name="contactKind-{contact.key}" value={contact.kind} />
							{#if contact.kind === 'sign-in'}
								<span class="sign-in-email">{data.email}</span> <span class="small muted">Signed in with</span>
							{:else if contact.kind === 'email'}
								<input type="email" name="email-{contact.key}" aria-label="Email address {index + 1}" autocomplete="email" aria-invalid={errors[`contact-${index}`] ? 'true' : undefined} aria-describedby={errors[`contact-${index}`] ? `contact-${index}-error` : undefined} bind:value={contact.value} />
							{:else}
								<PhoneField name="phone-{contact.key}" label="Phone {index + 1}" invalid={Boolean(errors[`contact-${index}`])} describedBy={errors[`contact-${index}`] ? `contact-${index}-error` : undefined} bind:country={contact.country} bind:digits={contact.value} />
							{/if}
							{@render fieldError(`contact-${index}`)}
						</td>
						<td data-label="Email" class="mark">
							{#if contact.kind === 'phone'}<span class="not-applicable" aria-label="Not an email address">–</span>{:else}<input type="checkbox" name="mayEmail" value={contact.key} aria-label="Email {what}" bind:checked={contact.mayEmail} />{/if}
						</td>
						<td data-label="Call" class="mark">
							{#if contact.kind === 'phone'}<input type="checkbox" name="mayCall" value={contact.key} aria-label="Call this number" bind:checked={contact.mayCall} />{:else}<span class="not-applicable" aria-label="Not a phone">–</span>{/if}
						</td>
						<td data-label="Text" class="mark">
							{#if contact.kind === 'phone'}<input type="checkbox" name="mayText" value={contact.key} aria-label="Text this number" bind:checked={contact.mayText} />{:else}<span class="not-applicable" aria-label="Not a phone">–</span>{/if}
						</td>
						<td data-label="Preferred" class="mark"><input type="radio" name="preferred" value={contact.key} aria-label="Preferred: {what}" bind:group={preferred} /></td>
						{@render privateCells()}
						<td class:remove={contact.kind !== 'sign-in'}>
							{#if contact.kind !== 'sign-in'}
								{@render removeButton(`contact-${contact.key}`, what, () => {
									contacts = contacts.filter((item) => item.key !== contact.key);
									if (preferred === contact.key) preferred = contacts[0].key;
								})}
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{@render fieldError('contacts')}
		<p class="add">
			<button type="submit" name="add" value="email" class="button button-quiet" formnovalidate onclick={inPlace(() => addContact('email'))}><Plus size={20} strokeWidth={1.75} aria-hidden="true" /> Add email</button>
			<button type="submit" name="add" value="phone" class="button button-quiet" formnovalidate onclick={inPlace(() => addContact('phone'))}><Plus size={20} strokeWidth={1.75} aria-hidden="true" /> Add phone</button>
		</p>
	</section>

	<section aria-labelledby="nations-heading" id="nations">
		<h2 id="nations-heading">Native nations</h2>
		<div class="field">
			<Dropdown
				label="Are you a citizen of, or connected to, a Native nation?"
				id="nationAnswer"
				name="nationAnswer"
				choices={nationAnswerChoices}
				bind:value={nationAnswer}
				onchange={chooseNationAnswer}
			/>
		</div>
		{#if nationAnswer === 'listed'}
			<table class="rows" id="nation-rows">
				<caption class="visually-hidden">Nations you are connected to</caption>
				<thead>
					<tr><th scope="col">Nation</th><th scope="col">Relationship</th><th scope="col" class="mark">Book</th><th scope="col" class="mark">Website</th><th scope="col"><span class="visually-hidden">Remove</span></th></tr>
				</thead>
				<tbody>
					{#each nations as nation, index (nation.key)}
						{@const title = nationTitle(nation.identifier, nation.name)}
						<tr>
							<td data-label="Nation">
								<input type="hidden" name="nationRow" value={nation.key} />
								<SearchableDropdown label="Nation {index + 1}" hideLabel name="nation-{nation.key}" choices={nationChoices} value={nation.identifier} onchange={(value) => (nation.identifier = value)} />
								{#if nation.identifier === 'other'}
									<input type="text" class="other-text" name="nationOther-{nation.key}" aria-label="The nation’s name" placeholder="The nation’s name" bind:value={nation.name} />
								{/if}
								{@render fieldError(`nation-${index}`)}
							</td>
							<td data-label="Relationship">
								<CheckDropdown
									name="relationship-{nation.key}"
									label="Your relationship to {title || `nation ${index + 1}`}"
									choices={nationRelationships}
									labels={nationRelationshipLabels}
									bind:chosen={nation.relationships}
								/>
								{#if nation.relationships.includes('other')}
									<input type="text" class="other-text" name="relationshipOther-{nation.key}" aria-label="Other relationship, in your own words" placeholder="In your own words" bind:value={nation.other} />
								{/if}
							</td>
							{@render useCells(`nation-${nation.key}`, title || 'this nation')}
							<td class="remove">{@render removeButton(`nation-${nation.key}`, title || 'this nation', () => (nations = nations.filter((item) => item.key !== nation.key)))}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{@render fieldError('nations')}
			<p class="add"><button type="submit" name="add" value="nation" class="button button-quiet" formnovalidate onclick={inPlace(addNation)}><Plus size={20} strokeWidth={1.75} aria-hidden="true" /> Add a nation</button></p>
		{/if}
	</section>

	<section aria-labelledby="background-heading" id="your-background">
		<h2 id="background-heading">Your background</h2>
		<div class="field-with-use">
			<div class="field">
				<label for="background">Tell us about yourself</label>
				<p class="hint" id="background-hint">For example: peacemaking, mediation, Tribal courts or law, community roles, writing or research.</p>
				{@render fieldError('background')}
				<textarea id="background" name="background" rows="4" aria-describedby="background-hint" aria-invalid={errors.background ? 'true' : undefined} bind:value={background}></textarea>
				<div class="cv-row" id="curriculum-vitae">
					{#if shownDocument}
						<span class="document-name">
							<FileText size={20} strokeWidth={1.75} aria-hidden="true" />
							{#if chosenDocument}{chosenDocument}{:else}<a href="/profile/curriculum-vitae">{shownDocument}</a>{/if}
						</span>
						<button type="button" class="button button-quiet" onclick={removeDocument}>Remove</button>
					{/if}
					<label class="button button-quiet file-button" class:visually-hidden={shownDocument}>
						<FileUp size={20} strokeWidth={1.75} aria-hidden="true" />
						Add CV or résumé
						<input bind:this={documentInput} type="file" name="curriculumVitae" accept=".pdf,.docx,.doc,.odt,.rtf,.txt" class="visually-hidden" onchange={chooseDocument} />
					</label>
					{#if !shownDocument}<span class="hint">.pdf, .docx, .odt. Checked for viruses.</span>{/if}
					{#if removingDocument}<input type="hidden" name="removeCurriculumVitae" value="yes" />{/if}
				</div>
				{@render fieldError('curriculumVitae')}
			</div>
			<div class="use-private"><PrivateMark /></div>
		</div>

		<h3 id="languages-heading">Languages</h3>
		<table class="rows languages" id="language-rows">
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
							<input type="hidden" name="languageRow" value={language.key} />
							<SearchableDropdown label="Language {index + 1}" hideLabel name="language-{language.key}" choices={languageChoices} value={language.code} onchange={(value) => (language.code = value)} />
							{#if language.code === 'other'}
								<input type="text" class="other-text" name="languageOther-{language.key}" aria-label="Language name" placeholder="Language name" bind:value={language.other} />
							{/if}
							{@render fieldError(`language-${index}`)}
						</td>
						<td data-label="Speak" class="mark"><input type="checkbox" name="speaks" value={language.key} aria-label="Speak" bind:checked={language.speaks} /></td>
						<td data-label="Read" class="mark"><input type="checkbox" name="reads" value={language.key} aria-label="Read" bind:checked={language.reads} /></td>
						<td data-label="Write" class="mark"><input type="checkbox" name="writes" value={language.key} aria-label="Write" bind:checked={language.writes} /></td>
						{@render useCells(`language-${language.key}`, 'this language', false)}
						<td class="remove">{@render removeButton(`language-${language.key}`, 'this language', () => (spoken = spoken.filter((item) => item.key !== language.key)))}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="add"><button type="submit" name="add" value="language" class="button button-quiet" formnovalidate onclick={inPlace(addLanguage)}><Plus size={20} strokeWidth={1.75} aria-hidden="true" /> Add a language</button></p>

		<div class="field-with-use">
			<div class="field">
				<label for="organization">Organization, office or school</label>
				{@render fieldError('organization')}
				<input type="text" id="organization" name="organization" autocomplete="organization" aria-invalid={errors.organization ? 'true' : undefined} bind:value={organization} />
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
								{specialtyLabels[option]}
								<button type="button" class="chip-remove" aria-label="Remove {specialtyLabels[option]}" title="Remove" onclick={() => (chosenSpecialties = chosenSpecialties.filter((item) => item !== option))}><X size={16} strokeWidth={2} /></button>
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
						<input
							type="text"
							aria-label="Specialty, in your own words"
							placeholder="In your own words"
							maxlength="100"
							bind:value={specialtyOtherDraft}
							onkeydown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault();
									addSpecialtyOther();
								}
							}}
						/>
						<button type="button" class="button button-quiet" onclick={addSpecialtyOther}>Add</button>
					</div>
				{/if}
			</div>
			{@render useBoxes('specialties', 'your specialties', false)}
		</fieldset>
	</section>

	<section aria-labelledby="help-heading" id="help">
		<h2 id="help-heading">How you would like to help</h2>
		<fieldset class="field-with-use">
			<div>
				<legend class="visually-hidden">How you would like to help</legend>
				{@render fieldError('interests')}
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
				<Dropdown label="How much time you have" id="availability" name="availability" choices={availabilityChoices} bind:value={availability} />
			</div>
			<div class="use-private"><PrivateMark /></div>
		</div>
	</section>

	<section aria-labelledby="credit-heading" id="credit">
		<h2 id="credit-heading">Credit</h2>
		<div class="field-with-use">
			<div class="field">
				<label for="description">A description, to use in place of a name</label>
				{@render fieldError('description')}
				<input type="text" id="description" name="description" placeholder="For example: a peacemaker from the nation" aria-invalid={errors.description ? 'true' : undefined} bind:value={description} />
			</div>
			{@render useBoxes('description', 'this description')}
		</div>
		<div class="field-with-use">
			<div class="field">
				<label for="biography">A short biography</label>
				<p class="hint" id="biography-hint">Two or three sentences. Asked of writers.</p>
				{@render fieldError('biography')}
				<textarea id="biography" name="biography" rows="3" aria-describedby="biography-hint" aria-invalid={errors.biography ? 'true' : undefined} bind:value={biography}></textarea>
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
		<button class="button" type="submit" name="next" value="review">Review and confirm</button>
		<button class="button button-quiet" type="submit" name="next" value="later">Save draft</button>
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
		overflow: hidden;
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

	.avatar.has-picture {
		border-style: solid;
	}

	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.file-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.document-name {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		overflow-wrap: anywhere;
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
	table.rows input[type='email'] {
		width: 100%;
		max-width: none;
	}

	table.rows :global(.dropdown) {
		margin: 0;
	}

	table.rows :global(.dropdown-control) {
		width: 100%;
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
