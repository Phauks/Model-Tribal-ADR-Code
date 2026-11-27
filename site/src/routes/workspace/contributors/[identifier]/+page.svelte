<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import SearchableDropdown from '#lib/components/SearchableDropdown.svelte';
	import ProfileSummary from '#lib/components/ProfileSummary.svelte';
	import { creditSectionLabels, creditSections, fullName, profileStatusLabels } from '#lib/contributors.ts';
	import { roleLabels, roles } from '#lib/permissions.ts';
	import type { PageProps } from './$types';
	import { mediumDateAndTime } from '#lib/readable-date.ts';

	let { data, form }: PageProps = $props();

	const profile = $derived(data.profile);
	let role = $state('co-author');
	const sectionChoices = [{ value: '', label: 'Not placed' }, ...creditSections.map((section) => ({ value: section as string, label: creditSectionLabels[section] }))];
	const roleChoices = roles.map((option) => ({ value: option as string, label: roleLabels[option] }));
	const nationChoices = $derived(data.nations.map((nation) => ({ value: nation.identifier, label: nation.title })));

</script>

<svelte:head>
	<title>{fullName(profile.answers) || 'Contributor'} · Workspace · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Workspace', href: '/workspace' },
		{ label: 'Contributors', href: '/workspace/contributors' }
	]}
	current={fullName(profile.answers) || '(no name given)'}
/>
<h1>{fullName(profile.answers) || '(no name given)'}</h1>

{#if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}
{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{/if}

<dl class="summary-list">
	<div>
		<dt>Status</dt>
		<dd>
			{profileStatusLabels[profile.status]}
			{#if profile.decidedAt}<span class="small muted">({mediumDateAndTime(profile.decidedAt)})</span>{/if}
			{#if profile.decisionNote}<p class="small">{profile.decisionNote}</p>{/if}
		</dd>
	</div>
	<div>
		<dt>Workspace access</dt>
		<dd>{profile.personIdentifier ? 'Yes' : 'No'}</dd>
	</div>
	<div>
		<dt>Board of directors</dt>
		<dd>{profile.boardMember ? `Board member${profile.boardOffice ? `, ${profile.boardOffice}` : ''}` : 'No'}</dd>
	</div>
	<div>
		<dt>Credit section</dt>
		<dd>{profile.creditSection ? creditSectionLabels[profile.creditSection] : 'Not placed yet'}</dd>
	</div>
	<div>
		<dt>Confirmed</dt>
		<dd>
			{#if profile.confirmedVersion}
				Version {profile.confirmedVersion}, {mediumDateAndTime(profile.confirmedAt)}{profile.hasUnconfirmedChanges
					? '. The person has changes they have not confirmed; this page shows them, credits do not use them.'
					: ''}
			{:else}
				Not confirmed
			{/if}
		</dd>
	</div>
</dl>

<ProfileSummary
	answers={profile.answers}
	curriculumVitae={profile.curriculumVitaeName ? { name: profile.curriculumVitaeName, href: `/workspace/contributors/${profile.identifier}/curriculum-vitae` } : null}
/>

{#if data.canManage}
	<section>
		<h2>Sign-up</h2>
		<form method="post" action="?/decide">
			<fieldset>
				<legend>Status</legend>
				<div class="choice">
					<input type="radio" id="decision-welcomed" name="decision" value="welcomed" checked={profile.status !== 'declined'} />
					<label for="decision-welcomed">Signed up</label>
				</div>
				<div class="choice">
					<input type="radio" id="decision-declined" name="decision" value="declined" checked={profile.status === 'declined'} />
					<label for="decision-declined">Removed (deleted after 12 months)</label>
				</div>
			</fieldset>
			<div class="field">
				<label for="note">Note to the person (required when removing; they see it on their profile)</label>
				<textarea id="note" name="note" rows="3">{profile.decisionNote ?? ''}</textarea>
			</div>
			<p><button class="button" type="submit">Save</button></p>
		</form>

		<h2>Place the credit</h2>
		<form method="post" action="?/section">
			<div class="field">
				<Dropdown label="Section of the book" id="section" name="section" choices={sectionChoices} value={profile.creditSection ?? ''} />
			</div>
			<p><button class="button button-quiet" type="submit">Save the section</button></p>
		</form>

		<h2>Board of directors</h2>
		<p>
			Board members are listed first on the People page, when they have a contributor page. Only the lead author
			can change this.
		</p>
		<form method="post" action="?/board">
			<div class="choice">
				<input type="checkbox" id="boardMember" name="boardMember" value="yes" checked={profile.boardMember} />
				<label for="boardMember">On the nonprofit's board</label>
			</div>
			<div class="field">
				<label for="boardOffice">Office (optional)</label>
				<p class="hint" id="boardOffice-hint">For example President, Secretary or Treasurer. Leave it empty until offices are set.</p>
				<input type="text" id="boardOffice" name="boardOffice" maxlength="100" value={profile.boardOffice ?? ''} aria-describedby="boardOffice-hint" />
			</div>
			<p><button class="button button-quiet" type="submit">Save</button></p>
		</form>

		{#if !profile.personIdentifier}
			<h2>Give workspace access</h2>
			<p>
				The person signs in with the same account they registered with. Their email address was
				confirmed when they first signed in, so access starts at once.
			</p>
			<form method="post" action="?/access">
				<div class="field">
					<Dropdown label="Role" id="role" name="role" choices={roleChoices} bind:value={role} />
				</div>
				{#if role === 'nation-reviewer'}
					<div class="field">
						<SearchableDropdown label="Nation they review for" id="nationIdentifier" name="nationIdentifier" choices={nationChoices} value={nationChoices[0]?.value ?? ''} />
					</div>
				{/if}
				<p><button class="button button-quiet" type="submit">Give access</button></p>
			</form>
		{/if}
	</section>
{/if}

<section>
	<h2>Confirmed versions</h2>
	{#if data.versions.length === 0}
		<p>None.</p>
	{:else}
		<ul>
			{#each data.versions as version (version.version)}
				<li>Version {version.version}, {mediumDateAndTime(version.confirmedAt)}: credit “{version.creditLine ?? 'no credit'}”</li>
			{/each}
		</ul>
	{/if}

	<h2>History</h2>
	<ul>
		{#each data.history as event (event.identifier)}
			<li>
				{mediumDateAndTime(event.createdAt)}: {event.action}{event.personName ? `, by ${event.personName}` : ''}{event.note
					? `. ${event.note}`
					: ''}
			</li>
		{/each}
	</ul>
</section>

<style>
	fieldset {
		border: 0;
		margin: 0 0 var(--space-4);
		padding: 0;
	}

	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		margin: var(--space-2) 0;
	}

	.choice input {
		width: 1.25rem;
		height: 1.25rem;
	}
</style>
