<script lang="ts">
	// The request form's questions for one kind of request (docs/requests.md):
	// what the request is about, who is asking, the details and, for a missing
	// nation, its proof. Used by the request page and by the Report a problem
	// dialog (ReportProblem.svelte), so both ask the same questions. Given
	// onresult, the form sends itself in place, without leaving the page.
	import { applyAction, enhance } from '$app/forms';
	import {
		authorityStatementLabels,
		authorityStatements,
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
		onresult
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
	} = $props();

	type ActionResult = Parameters<typeof applyAction>[0];

	const heading = $derived(`h${headingLevel}`);
	const subheading = $derived(`h${headingLevel + 1}`);
	const errorCount = $derived(Object.keys(errors).length);
	const accepted = 'application/pdf,image/png,image/jpeg,image/webp';

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
	function describedBy(name: string, hint = false): string | undefined {
		const ids = [hint ? `${prefix}${name}-hint` : '', errors[name] ? `${prefix}${name}-error` : ''].filter(Boolean);
		return ids.length > 0 ? ids.join(' ') : undefined;
	}

	/** Sends the form without leaving the page, when the caller handles the answer. */
	function submitInPlace(node: HTMLFormElement) {
		if (!onresult) return;
		return enhance(node, () => async ({ result }) => onresult?.(result));
	}
</script>

{#snippet fieldError(name: string)}
	{#if errors[name]}
		<p class="field-error" id="{prefix}{name}-error"><span class="visually-hidden">Error:</span> {errors[name]}</p>
	{/if}
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

		{#if kind === 'add-nation'}
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

			<fieldset>
				<legend><svelte:element this={heading}>Proof</svelte:element></legend>
				<p id="{prefix}proof-hint" class="hint">
					One federal or state government source that names the nation as a Native nation, Tribe,
					band or community is enough. For each source, give a citation or web address, upload a
					copy (PDF or an image), or both. A readable copy helps when a source is not online. The
					nation’s own website, articles, books and genealogy records are welcome as supporting
					material but do not count on their own.
				</p>
				{#each [1, 2, 3] as slot (slot)}
					<fieldset class="source">
						<legend><svelte:element this={subheading}>Source {slot}{slot > 1 ? ' (optional)' : ''}</svelte:element></legend>
						<div class="field">
							<label for="{prefix}source{slot}Kind">Kind of source</label>
							{@render fieldError(`source${slot}Kind`)}
							<select
								id="{prefix}source{slot}Kind"
								name="source{slot}Kind"
								aria-invalid={errors[`source${slot}Kind`] ? 'true' : undefined}
								aria-describedby={describedBy(`source${slot}Kind`)}
							>
								<option value="">Choose…</option>
								{#each sourceKinds as option (option)}
									<option value={option} selected={value(`source${slot}Kind`) === option}
										>{sourceKindLabels[option]}</option
									>
								{/each}
							</select>
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
				{/each}
			</fieldset>
		{:else}
			<fieldset>
				<legend><svelte:element this={heading}>Which material?</svelte:element></legend>
				<div class="field">
					<label for="{prefix}material">Page, record or passage</label>
					<p class="hint" id="{prefix}material-hint">
						{#if kind === 'restrict' || kind === 'remove'}
							Please only say where the material is. Do not repeat sensitive material here.
						{:else}
							Filled in from the page you came from, if any. Add more pages on new lines.
						{/if}
					</p>
					{@render fieldError('material')}
					<textarea
						id="{prefix}material"
						name="material"
						rows="3"
						aria-invalid={errors.material ? 'true' : undefined}
						aria-describedby={describedBy('material', true)}>{value('material', material)}</textarea
					>
				</div>
			</fieldset>
		{/if}

		<fieldset>
			<legend><svelte:element this={heading}>Who are you?</svelte:element></legend>
			<p class="hint">Only a way to reply is required.</p>
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
			<div class="field">
				<label for="{prefix}contact">Email address or phone number</label>
				{@render fieldError('contact')}
				<input
					type="text"
					id="{prefix}contact"
					name="contact"
					value={value('contact')}
					autocomplete="email"
					aria-invalid={errors.contact ? 'true' : undefined}
					aria-describedby={describedBy('contact')}
				/>
			</div>
		</fieldset>

		<fieldset>
			<legend><svelte:element this={heading}>Details{kind === 'add-nation' ? ' (optional)' : ''}</svelte:element></legend>
			<div class="field">
				<label for="{prefix}details">
					{#if kind === 'correct'}What is wrong, and what should it say?{:else if kind === 'restrict' || kind === 'remove'}What should happen to the material?{:else if kind === 'contribute'}What would you like to offer?{:else if kind === 'add-nation'}Anything else the project should know{:else}Your question{/if}
				</label>
				{@render fieldError('details')}
				<textarea
					id="{prefix}details"
					name="details"
					rows="6"
					aria-invalid={errors.details ? 'true' : undefined}
					aria-describedby={describedBy('details')}>{value('details')}</textarea
				>
			</div>
			{#if kind !== 'add-nation'}
				<p class="hint">
					You can attach up to three files, for example a nation’s resolution or a corrected citation
					(PDF, PNG, JPEG or WebP, up to 10 MB each).
				</p>
				{#each [1, 2, 3] as slot (slot)}
					<div class="field">
						<label for="{prefix}file{slot}">File {slot} (optional)</label>
						{@render fieldError(`file${slot}`)}
						<input type="file" id="{prefix}file{slot}" name="file{slot}" accept={accepted} />
					</div>
				{/each}
			{/if}
		</fieldset>

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
					<legend>May the project publish what you send?</legend>
					{@render fieldError('publicationPermission')}
					<div class="choice">
						<input type="radio" id="{prefix}publicationPermission-publish" name="publicationPermission" value="publish" checked={value('publicationPermission') === 'publish'} />
						<label for="{prefix}publicationPermission-publish">
							Yes, under the project’s licenses
							<span class="hint"><a href="/licenses">Licenses by material</a></span>
						</label>
					</div>
					<div class="choice">
						<input type="radio" id="{prefix}publicationPermission-review-only" name="publicationPermission" value="review-only" checked={value('publicationPermission') === 'review-only'} />
						<label for="{prefix}publicationPermission-review-only">No, share it with the project for review only</label>
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

		<p class="small">
			The request and any files are kept private, in the project’s own storage, and never published.
			Personal details are deleted 12 months after the request is resolved, unless you asked to be
			credited.
		</p>
		<p><button class="button" type="submit">Send the request</button></p>
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

	/* Hidden from people, visible to bots that fill in every field. */
	.trap {
		position: absolute;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
</style>
