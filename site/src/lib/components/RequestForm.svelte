<script lang="ts">
	// The request form's questions for one kind of request (docs/requests.md):
	// what the request is about, who is asking, the details and, for a missing
	// nation, its proof. Used by the request page and by the Request a Change
	// dialog (RequestChange.svelte), so both ask the same questions. Given
	// onresult, the form sends itself in place, without leaving the page.
	// Compact, for the Request a Change dialog, asks them on one page in two
	// columns (Trevor, Nov. 27, 2026): who is asking and what it is about on
	// the left, what should change and any files on the right, stacking into
	// one column on phones. Every request ends with the statements the reader
	// accepts before sending (requestStatements in src/lib/requests.ts).
	import type { Snippet } from 'svelte';
	import { applyAction, enhance } from '$app/forms';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import FileAdder from '#lib/components/FileAdder.svelte';
	import TurnstileCheck, { turnstileResetEvent } from '#lib/components/TurnstileCheck.svelte';
	import { turnstileKey } from '#lib/turnstile-key.ts';
	import {
		authorityStatementLabels,
		authorityStatements,
		maximumRequestFiles,
		requestStatements,
		sourceKindLabels,
		sourceKinds,
		type RequestKind
	} from '#lib/requests.ts';

	let {
		kind,
		nationIdentifier = '',
		material = '',
		values = {},
		errors = {},
		problem,
		headingLevel = 2,
		prefix = '',
		action,
		onresult,
		compact = false,
		toTeam = false,
		lead
	}: {
		kind: RequestKind;
		nationIdentifier?: string;
		/** The page or record the request is about, filled in for the reader. */
		material?: string;
		values?: Record<string, string>;
		errors?: Record<string, string>;
		problem?: string;
		/** The level of the section headings: 2 on the page, 3 inside a dialog. */
		headingLevel?: 2 | 3;
		/** Put before every id, so a dialog's fields never share an id with the page's. */
		prefix?: string;
		/** Where the form is sent; the request page's own address when left out. */
		action?: string;
		/** Called with the answer when the form sends itself in place. */
		onresult?: (result: ActionResult) => void;
		/** One short page, for the dialog: no section headings, optional questions folded. */
		compact?: boolean;
		/** Written to the nation's team from its page's badge: sharing who sent it starts ticked. */
		toTeam?: boolean;
		/** Put first in the compact form's left column, such as the dialog's choice of request. */
		lead?: Snippet;
	} = $props();

	type ActionResult = Parameters<typeof applyAction>[0];

	const heading = $derived(`h${headingLevel}`);
	const subheading = $derived(`h${headingLevel + 1}`);
	const errorCount = $derived(Object.keys(errors).length);
	const accepted = 'application/pdf,image/png,image/jpeg,image/webp';

	/** The folded sources open by themselves when they hold an answer or an error. */
	const moreSourcesAnswered = $derived(
		[2, 3].some((slot) =>
			['Kind', 'Title', 'Citation', 'Date', 'Location', 'File'].some(
				(field) => value(`source${slot}${field}`) !== '' || errors[`source${slot}${field}`]
			)
		)
	);

	function value(name: string, fallback = ''): string {
		return values[name] ?? fallback;
	}

	/**
	 * Moves focus to the error summary when the form comes back with problems,
	 * so keyboard and screen reader users start from the list of what to fix
	 * (WCAG 3.3.1, following the GOV.UK error summary pattern).
	 */
	function focusOnArrival(node: HTMLElement) {
		node.focus();
	}

	/** Links each field to its error message, for screen readers. */
	const sourceKindChoices = [{ value: '', label: 'Choose…' }, ...sourceKinds.map((kind) => ({ value: kind as string, label: sourceKindLabels[kind] }))];

	function describedBy(name: string, hint = false): string | undefined {
		const ids = [hint ? `${prefix}${name}-hint` : '', errors[name] ? `${prefix}${name}-error` : ''].filter(Boolean);
		return ids.length > 0 ? ids.join(' ') : undefined;
	}

	/** Sends the form without leaving the page, when the caller handles the answer. */
	function submitInPlace(node: HTMLFormElement) {
		if (!onresult) return;
		return enhance(node, () => async ({ result }) => {
			// The "are you a person?" token works once, so a form sent again needs a fresh one.
			node.dispatchEvent(new Event(turnstileResetEvent));
			onresult?.(result);
		});
	}

	// Cloudflare's "are you a person?" check, when it is on (src/lib/server/turnstile.ts).
	let siteKey = $state<string | undefined>(undefined);
	$effect(() => {
		void turnstileKey().then((key) => (siteKey = key));
	});
</script>

{#snippet fieldError(name: string)}
	{#if errors[name]}
		<p class="field-error" id="{prefix}{name}-error"><span class="visually-hidden">Error:</span> {errors[name]}</p>
	{/if}
{/snippet}

{#snippet sourceSlot(slot: number)}
	<fieldset class="source">
		<legend><svelte:element this={subheading}>Source {slot}{slot > 1 ? ' (optional)' : ''}</svelte:element></legend>
		<div class="field">
			<Dropdown
				label="Kind of source"
				id="{prefix}source{slot}Kind"
				name="source{slot}Kind"
				choices={sourceKindChoices}
				value={value(`source${slot}Kind`)}
				invalid={Boolean(errors[`source${slot}Kind`])}
				describedBy={describedBy(`source${slot}Kind`)}
			>
				{#snippet message()}{@render fieldError(`source${slot}Kind`)}{/snippet}
			</Dropdown>
		</div>
		<div class="field">
			<label for="{prefix}source{slot}Title">Title</label>
			<input type="text" id="{prefix}source{slot}Title" name="source{slot}Title" value={value(`source${slot}Title`)} />
		</div>
		<div class="field">
			<label for="{prefix}source{slot}Citation">Citation or web address</label>
			{@render fieldError(`source${slot}Citation`)}
			<textarea
				id="{prefix}source{slot}Citation"
				name="source{slot}Citation"
				rows="2"
				aria-invalid={errors[`source${slot}Citation`] ? 'true' : undefined}
				aria-describedby={describedBy(`source${slot}Citation`)}
				>{value(`source${slot}Citation`)}</textarea
			>
		</div>
		<div class="field-row">
			<div class="field">
				<label for="{prefix}source{slot}Date">Date</label>
				<input type="text" id="{prefix}source{slot}Date" name="source{slot}Date" value={value(`source${slot}Date`)} class="short" />
			</div>
			<div class="field">
				<label for="{prefix}source{slot}Location">Where it names the nation (page, section or entry)</label>
				<input
					type="text"
					id="{prefix}source{slot}Location"
					name="source{slot}Location"
					value={value(`source${slot}Location`)}
				/>
			</div>
		</div>
		<div class="field">
			<label for="{prefix}source{slot}File">Upload a copy (PDF, PNG, JPEG or WebP, up to 10 MB)</label>
			{@render fieldError(`source${slot}File`)}
			<input type="file" id="{prefix}source{slot}File" name="source{slot}File" accept={accepted} />
		</div>
	</fieldset>
{/snippet}
{#snippet nationFieldset()}
	<fieldset>
		<legend><svelte:element this={heading}>The nation</svelte:element></legend>
		<div class="field">
			<label for="{prefix}missingNationOfficialName">Name as the government source writes it</label>
			{@render fieldError('missingNationOfficialName')}
			<input
				type="text"
				id="{prefix}missingNationOfficialName"
				name="missingNationOfficialName"
				value={value('missingNationOfficialName')}
				aria-invalid={errors.missingNationOfficialName ? 'true' : undefined}
				aria-describedby={describedBy('missingNationOfficialName')}
			/>
		</div>
		<div class="field">
			<label for="{prefix}missingNationOwnName">
				Name the nation uses for itself, in any language or script (optional)
			</label>
			<input
				type="text"
				id="{prefix}missingNationOwnName"
				name="missingNationOwnName"
				value={value('missingNationOwnName')}
			/>
		</div>
		<div class="field">
			<label for="{prefix}missingNationStates">States where the nation is located</label>
			{@render fieldError('missingNationStates')}
			<input
				type="text"
				id="{prefix}missingNationStates"
				name="missingNationStates"
				value={value('missingNationStates')}
				aria-invalid={errors.missingNationStates ? 'true' : undefined}
				aria-describedby={describedBy('missingNationStates')}
			/>
		</div>
		<div class="field">
			<label for="{prefix}earlierReference">
				Reference number of an earlier application, if you are applying again (optional)
			</label>
			<input
				type="text"
				id="{prefix}earlierReference"
				name="earlierReference"
				value={value('earlierReference')}
				class="short"
			/>
		</div>
	</fieldset>
{/snippet}

{#snippet proofFieldset()}
	<fieldset>
		<legend><svelte:element this={heading}>Proof</svelte:element></legend>
		<p id="{prefix}proof-hint" class="hint">
			One federal or state government source that names the nation as a Native nation, Tribe,
			band or community is enough. For each source, give a citation or web address, upload a
			copy (PDF or an image), or both. A readable copy helps when a source is not online. The
			nation’s own website, articles, books and genealogy records are welcome as supporting
			material but do not count on their own.
		</p>
		{#if compact}
			{@render sourceSlot(1)}
			<details class="fold" open={moreSourcesAnswered}>
				<summary>More sources (optional)</summary>
				{@render sourceSlot(2)}
				{@render sourceSlot(3)}
			</details>
		{:else}
			{#each [1, 2, 3] as slot (slot)}
				{@render sourceSlot(slot)}
			{/each}
		{/if}
	</fieldset>
{/snippet}

{#snippet materialField()}
	{@const sensitive = kind === 'restrict' || kind === 'remove' || kind === 'replace-name'}
	<div class="field">
		<label for="{prefix}material">Web page</label>
		{#if sensitive}
			<p class="hint" id="{prefix}material-hint">
				Please only say where the material is. Do not repeat sensitive material here.
			</p>
		{:else if !compact}
			<p class="hint" id="{prefix}material-hint">
				Filled in from the page you came from, if any. Add more pages on new lines.
			</p>
		{/if}
		{@render fieldError('material')}
		<textarea
			id="{prefix}material"
			name="material"
			rows={compact ? 2 : 3}
			aria-invalid={errors.material ? 'true' : undefined}
			aria-describedby={describedBy('material', sensitive || !compact)}>{value('material', material)}</textarea
		>
	</div>
{/snippet}

{#snippet detailsField()}
	{@const question = kind === 'correct' ? 'What is wrong, and what should it say?' : kind === 'replace-name' ? 'Whose name should be replaced? Say how they appear, such as “the mother”, not their full name.' : kind === 'restrict' || kind === 'remove' ? 'What should happen to the material?' : kind === 'contribute' ? 'What would you like to offer?' : kind === 'add-nation' ? `Anything else we should know${compact ? ' (optional)' : ''}` : toTeam ? 'Your message' : 'Your question'}
	<div class="field">
		<!-- The dialog names the box "Details" and asks the question under it (Trevor, Nov. 27, 2026). -->
		<label for="{prefix}details">{compact ? `Details${kind === 'add-nation' ? ' (optional)' : ''}` : question}</label>
		{#if compact}<p class="hint" id="{prefix}details-hint">{question.replace(' (optional)', '')}</p>{/if}
		{@render fieldError('details')}
		<textarea
			id="{prefix}details"
			name="details"
			rows={compact ? 10 : 6}
			aria-invalid={errors.details ? 'true' : undefined}
			aria-describedby={describedBy('details', compact)}>{value('details')}</textarea
		>
	</div>
	{#if value('nationIdentifier', nationIdentifier) && (kind === 'correct' || kind === 'question' || kind === 'contribute')}
		<!-- Reports about a claimed page also go to the nation's team (src/lib/nation-team-reports.ts). -->
		<div class="choice">
			<input
				type="checkbox"
				id="{prefix}shareWithTeam"
				name="shareWithTeam"
				value="yes"
				checked={values.kind ? value('shareWithTeam') === 'yes' : toTeam}
			/>
			<label for="{prefix}shareWithTeam">Share my name and contact details with the nation’s team so they can write back</label>
		</div>
	{/if}
{/snippet}

{#snippet aboutYouFields()}
	<div class="field">
		<label for="{prefix}requesterName">Name (optional)</label>
		<input type="text" id="{prefix}requesterName" name="requesterName" value={value('requesterName')} autocomplete="name" />
	</div>
	<div class="field">
		<label for="{prefix}requesterNation">Nation (optional)</label>
		<input type="text" id="{prefix}requesterNation" name="requesterNation" value={value('requesterNation')} />
	</div>
	<div class="field">
		<label for="{prefix}requesterRole">Role, for example court administrator or cultural preservation officer (optional)</label>
		<input type="text" id="{prefix}requesterRole" name="requesterRole" value={value('requesterRole')} autocomplete="organization-title" />
	</div>
	{#if kind !== 'add-nation'}
		<fieldset class="inline-choices">
			<legend>Are you writing on behalf of the nation’s government or one of its offices?</legend>
			<div class="choice">
				<input type="radio" id="{prefix}writingForGovernment-yes" name="writingForGovernment" value="yes" checked={value('writingForGovernment') === 'yes'} />
				<label for="{prefix}writingForGovernment-yes">Yes</label>
			</div>
			<div class="choice">
				<input type="radio" id="{prefix}writingForGovernment-no" name="writingForGovernment" value="no" checked={value('writingForGovernment') === 'no'} />
				<label for="{prefix}writingForGovernment-no">No, or not sure</label>
			</div>
		</fieldset>
	{/if}
{/snippet}

{#snippet contactField()}
	<div class="field">
		<label for="{prefix}contact">Email address</label>
		{@render fieldError('contact')}
		<input
			type="email"
			id="{prefix}contact"
			name="contact"
			value={value('contact')}
			autocomplete="email"
			aria-invalid={errors.contact ? 'true' : undefined}
			aria-describedby={describedBy('contact')}
		/>
	</div>
{/snippet}

{#snippet fileFields()}
	<div class="field">
		<label for="{prefix}files">Files (optional)</label>
		<p class="hint" id="{prefix}files-hint">
			{#if compact}
				Up to {maximumRequestFiles}: PDF, PNG, JPEG or WebP, up to 10 MB each.
			{:else}
				Up to {maximumRequestFiles} files, for example a nation’s resolution or a corrected citation
				(PDF, PNG, JPEG or WebP, up to 10 MB each).
			{/if}
		</p>
		{@render fieldError('files')}
		<FileAdder
			id="{prefix}files"
			name="files"
			accept={accepted}
			maximum={maximumRequestFiles}
			invalid={Boolean(errors.files)}
			describedBy={describedBy('files', true)}
		/>
	</div>
{/snippet}

{#if problem}
	<div class="notice notice-problem" role="alert" tabindex="-1" {@attach focusOnArrival}><p>{problem}</p></div>
{/if}
{#if errorCount > 0}
	<div class="notice notice-problem" role="alert" tabindex="-1" {@attach focusOnArrival}>
		<p>
			<strong>Please check {errorCount === 1 ? 'one answer' : `${errorCount} answers`}.</strong> The
			messages are next to the questions below.
		</p>
	</div>
{/if}

	<form method="post" {action} enctype="multipart/form-data" novalidate use:submitInPlace>
		<input type="hidden" name="kind" value={kind} />
		<input type="hidden" name="nationIdentifier" value={value('nationIdentifier', nationIdentifier)} />
		<div class="trap" aria-hidden="true">
			<label for="{prefix}website">Leave this empty</label>
			<input type="text" id="{prefix}website" name="website" tabindex="-1" autocomplete="off" />
		</div>

		{#if compact}
			<div class="columns">
				<div class="column">
					{@render lead?.()}
					{#if kind === 'add-nation'}
						{@render nationFieldset()}
					{/if}
					{@render contactField()}
					{@render aboutYouFields()}
				</div>
				<div class="column">
					{#if kind === 'add-nation'}
						{@render proofFieldset()}
					{:else if toTeam}
						<input type="hidden" name="material" value={value('material', material)} />
					{:else}
						{@render materialField()}
					{/if}
					{@render detailsField()}
					{#if kind !== 'add-nation'}
						{@render fileFields()}
					{/if}
				</div>
			</div>
		{:else}
			{#if kind === 'add-nation'}
				{@render nationFieldset()}
				{@render proofFieldset()}
			{:else if toTeam}
				<!-- A message to the nation's team is about its page as a whole. -->
				<input type="hidden" name="material" value={value('material', material)} />
			{:else}
				<fieldset>
					<legend><svelte:element this={heading}>Which material?</svelte:element></legend>
					{@render materialField()}
				</fieldset>
			{/if}

			<fieldset>
				<legend><svelte:element this={heading}>Who are you?</svelte:element></legend>
				<p class="hint">Only an email address is required.</p>
				{@render aboutYouFields()}
				{@render contactField()}
			</fieldset>

			<fieldset>
				<legend><svelte:element this={heading}>Details{kind === 'add-nation' ? ' (optional)' : ''}</svelte:element></legend>
				{@render detailsField()}
				{#if kind !== 'add-nation'}
					{@render fileFields()}
				{/if}
			</fieldset>
		{/if}

		{#if kind === 'contribute'}
			<fieldset>
				<legend><svelte:element this={heading}>Credit and permission</svelte:element></legend>
				<div class="field">
					<label for="{prefix}creditPreference">
						How would you like to be credited? Name, nation, role, or leave empty for no credit.
					</label>
					<input type="text" id="{prefix}creditPreference" name="creditPreference" value={value('creditPreference')} />
				</div>
				<fieldset>
					<legend>May we publish what you send?</legend>
					{@render fieldError('publicationPermission')}
					<div class="choice">
						<input type="radio" id="{prefix}publicationPermission-publish" name="publicationPermission" value="publish" checked={value('publicationPermission') === 'publish'} />
						<label for="{prefix}publicationPermission-publish">
							Yes, under the site’s licenses
							<span class="hint"><a href="/licenses">Licenses by material</a></span>
						</label>
					</div>
					<div class="choice">
						<input type="radio" id="{prefix}publicationPermission-review-only" name="publicationPermission" value="review-only" checked={value('publicationPermission') === 'review-only'} />
						<label for="{prefix}publicationPermission-review-only">No, share it with us for review only</label>
					</div>
				</fieldset>
			</fieldset>
		{/if}

		{#if kind === 'add-nation'}
			<fieldset>
				<legend><svelte:element this={heading}>Statement</svelte:element></legend>
				{@render fieldError('authorityStatement')}
				{#each authorityStatements as option (option)}
					<div class="choice">
						<input type="radio" id="{prefix}authorityStatement-{option}" name="authorityStatement" value={option} checked={value('authorityStatement') === option} />
						<label for="{prefix}authorityStatement-{option}">{authorityStatementLabels[option]}</label>
					</div>
				{/each}
			</fieldset>
		{/if}

		<fieldset class="statements">
			<legend>Terms of Submission</legend>
			<!-- A short box that scrolls, so the terms take little room (Trevor, Nov. 27, 2026).
			     It takes focus so keyboard readers can scroll it (WCAG 2.1.1). -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<ul class="statement-lines" tabindex="0" aria-label="Terms of Submission">
				{#each requestStatements(kind) as statement (statement)}<li>{statement}</li>{/each}
			</ul>
			{@render fieldError('acceptStatements')}
			<div class="choice">
				<input
					type="checkbox"
					id="{prefix}acceptStatements"
					name="acceptStatements"
					value="yes"
					required
					checked={value('acceptStatements') === 'yes'}
					aria-invalid={errors.acceptStatements ? 'true' : undefined}
					aria-describedby={describedBy('acceptStatements')}
				/>
				<label for="{prefix}acceptStatements">I accept these terms</label>
			</div>
		</fieldset>
		{#if siteKey}<TurnstileCheck {siteKey} action="request" />{/if}
		<p><button class="button" type="submit">{toTeam ? 'Send the message' : 'Submit'}</button></p>
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

	legend h2,
	legend h3 {
		margin-bottom: var(--space-2);
	}

	fieldset.source {
		border-left: 4px solid var(--color-line);
		padding-left: var(--space-4);
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

	.inline-choices .choice {
		display: inline-flex;
		margin-right: var(--space-5);
	}

	.field-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-4);
	}

	.field-row .field {
		flex: 1 1 14rem;
	}

	/* The dialog's two columns: who and what on the left, the details and files on the right. */
	.columns {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0 var(--space-6);
	}

	.columns textarea[name='details'] {
		min-height: 14rem;
	}

	@media (max-width: 44rem) {
		.columns {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	/* Each term on its own line, above the one box that accepts them all. */
	.statements {
		margin-bottom: var(--space-3);
	}

	.statements legend {
		font-weight: var(--font-weight-bold);
		margin-bottom: var(--space-1);
	}

	/* Each term on its own line in a box about four lines tall that scrolls for the rest. */
	.statement-lines {
		list-style: none;
		margin: 0;
		padding: var(--space-1) var(--space-3);
		max-height: 6.25rem;
		overflow-y: auto;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		font-size: var(--font-size-small);
		line-height: 1.45;
	}

	.statement-lines li {
		margin: 0;
	}

	.statements .choice {
		margin: var(--space-2) 0 0;
	}

	/* The add-nation sources' fold. */
	details.fold {
		margin: 0;
	}

	details.fold[open] {
		margin-bottom: var(--space-4);
	}

	details.fold summary {
		padding: var(--space-2) 0;
		font-weight: var(--font-weight-bold);
		cursor: pointer;
	}

	/* Hidden from people, visible to bots that fill in every field. */
	.trap {
		position: absolute;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
</style>
