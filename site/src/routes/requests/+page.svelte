<script lang="ts">
	import { repositoryLink } from '#lib';
	import {
		authorityStatementLabels,
		authorityStatements,
		requestKindHints,
		requestKindLabels,
		requestKinds,
		sourceKindLabels,
		sourceKinds,
		type RequestKind
	} from '#lib/requests.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const values: Record<string, string> = $derived(form && 'values' in form ? (form.values ?? {}) : {});
	const errors: Record<string, string> = $derived(form && 'errors' in form ? (form.errors ?? {}) : {});
	const problem = $derived(form && 'problem' in form ? form.problem : undefined);
	const sent = $derived(form && 'sent' in form ? form.sent : undefined);
	const kind: RequestKind | undefined = $derived(
		(values.kind as RequestKind | undefined) ?? data.kind
	);
	const errorCount = $derived(Object.keys(errors).length);
	const accepted = 'application/pdf,image/png,image/jpeg,image/webp';

	function value(name: string, fallback = ''): string {
		return values[name] ?? fallback;
	}

	/** Links each field to its error message, for screen readers. */
	function describedBy(name: string, hint = false): string | undefined {
		const ids = [hint ? `${name}-hint` : '', errors[name] ? `${name}-error` : ''].filter(Boolean);
		return ids.length > 0 ? ids.join(' ') : undefined;
	}
</script>

<svelte:head>
	<title>Make a request · Model Tribal ADR Code</title>
</svelte:head>

{#snippet fieldError(name: string)}
	{#if errors[name]}
		<p class="field-error" id="{name}-error"><span class="visually-hidden">Error:</span> {errors[name]}</p>
	{/if}
{/snippet}

<div class="reading">
	{#if sent}
		<h1>Request sent</h1>
		<div class="panel panel-filled" role="status">
			<p>Your reference number is</p>
			<p class="reference"><strong>{sent.reference}</strong></p>
			<p class="small">
				Received {new Date(sent.receivedAt).toLocaleDateString('en-US', { dateStyle: 'long' })}. Please
				keep this number; quote it if you write again or apply again.
			</p>
		</div>
		<h2>What happens next</h2>
		<ul>
			<li>The project acknowledges the request within 7 days, using the contact details you gave.</li>
			{#if sent.kind === 'restrict' || sent.kind === 'remove'}
				<li>The material you named is taken out of public view within 7 days, before it is reviewed.</li>
			{/if}
			{#if sent.kind === 'add-nation'}
				<li>
					The project checks each source in the government’s own publication, then searches its list
					for the nation under other names. Usually a decision follows within 30 days of the
					acknowledgment.
				</li>
			{/if}
			<li>A request about a nation is confirmed with that nation’s own office before it is final.</li>
			<li>Your request and any files you sent are kept private. They are never published.</li>
		</ul>
		<p><a href="/">Return to the home page</a></p>
	{:else}
		<h1>Make a request</h1>
		<p class="lead">
			Ask the project to correct, restrict or remove material about a Native nation, ask to add a
			nation that is missing, offer to contribute, or ask a question. No account is needed.
		</p>

		{#if problem}
			<div class="notice notice-problem" role="alert"><p>{problem}</p></div>
		{/if}
		{#if errorCount > 0}
			<div class="notice notice-problem" role="alert" tabindex="-1">
				<p>
					<strong>Please check {errorCount === 1 ? 'one answer' : `${errorCount} answers`}.</strong> The
					messages are next to the questions below.
				</p>
			</div>
		{/if}

		{#if !kind}
			<form method="get" action="/requests">
				{#if data.record}<input type="hidden" name="record" value={data.record} />{/if}
				{#if data.field}<input type="hidden" name="field" value={data.field} />{/if}
				<fieldset>
					<legend><h2>What would you like to do?</h2></legend>
					{#each requestKinds as option (option)}
						<div class="choice">
							<input type="radio" id="kind-{option}" name="kind" value={option} required />
							<label for="kind-{option}">
								{requestKindLabels[option]}
								<span class="hint">{requestKindHints[option]}</span>
							</label>
						</div>
					{/each}
				</fieldset>
				<p><button class="button" type="submit">Continue</button></p>
			</form>
			<p class="small muted">
				How requests are handled: <a href="{repositoryLink}/blob/main/docs/requests.md"
					>Requests from Native nations and contributors</a
				>. Please do not use public GitHub issues for a request about a nation.
			</p>
		{:else}
			<p>
				<strong>{requestKindLabels[kind]}.</strong>
				{requestKindHints[kind]}
				<a href="/requests{data.record ? `?record=${encodeURIComponent(data.record)}` : ''}"
					>Choose something else</a
				>
			</p>

			<form method="post" enctype="multipart/form-data" novalidate>
				<input type="hidden" name="kind" value={kind} />
				<input type="hidden" name="nationIdentifier" value={value('nationIdentifier', data.nationIdentifier)} />
				<div class="trap" aria-hidden="true">
					<label for="website">Leave this empty</label>
					<input type="text" id="website" name="website" tabindex="-1" autocomplete="off" />
				</div>

				{#if kind === 'add-nation'}
					<fieldset>
						<legend><h2>The nation</h2></legend>
						<div class="field">
							<label for="missingNationOfficialName">Name as the government source writes it</label>
							{@render fieldError('missingNationOfficialName')}
							<input
								type="text"
								id="missingNationOfficialName"
								name="missingNationOfficialName"
								value={value('missingNationOfficialName')}
								aria-invalid={errors.missingNationOfficialName ? 'true' : undefined}
								aria-describedby={describedBy('missingNationOfficialName')}
							/>
						</div>
						<div class="field">
							<label for="missingNationOwnName">
								Name the nation uses for itself, in any language or script (optional)
							</label>
							<input
								type="text"
								id="missingNationOwnName"
								name="missingNationOwnName"
								value={value('missingNationOwnName')}
							/>
						</div>
						<div class="field">
							<label for="missingNationStates">States where the nation is located</label>
							{@render fieldError('missingNationStates')}
							<input
								type="text"
								id="missingNationStates"
								name="missingNationStates"
								value={value('missingNationStates')}
								aria-invalid={errors.missingNationStates ? 'true' : undefined}
								aria-describedby={describedBy('missingNationStates')}
							/>
						</div>
						<div class="field">
							<label for="earlierReference">
								Reference number of an earlier application, if you are applying again (optional)
							</label>
							<input
								type="text"
								id="earlierReference"
								name="earlierReference"
								value={value('earlierReference')}
								class="short"
							/>
						</div>
					</fieldset>

					<fieldset>
						<legend><h2>Proof</h2></legend>
						<p id="proof-hint" class="hint">
							One federal or state government source that names the nation as a Native nation, Tribe,
							band or community is enough. For each source, give a citation or web address, upload a
							copy (PDF or an image), or both. A readable copy helps when a source is not online. The
							nation’s own website, articles, books and genealogy records are welcome as supporting
							material but do not count on their own.
						</p>
						{#each [1, 2, 3] as slot (slot)}
							<fieldset class="source">
								<legend><h3>Source {slot}{slot > 1 ? ' (optional)' : ''}</h3></legend>
								<div class="field">
									<label for="source{slot}Kind">Kind of source</label>
									{@render fieldError(`source${slot}Kind`)}
									<select
										id="source{slot}Kind"
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
									<label for="source{slot}Title">Title</label>
									<input type="text" id="source{slot}Title" name="source{slot}Title" value={value(`source${slot}Title`)} />
								</div>
								<div class="field">
									<label for="source{slot}Citation">Citation or web address</label>
									{@render fieldError(`source${slot}Citation`)}
									<textarea
										id="source{slot}Citation"
										name="source{slot}Citation"
										rows="2"
										aria-invalid={errors[`source${slot}Citation`] ? 'true' : undefined}
										aria-describedby={describedBy(`source${slot}Citation`)}
										>{value(`source${slot}Citation`)}</textarea
									>
								</div>
								<div class="field-row">
									<div class="field">
										<label for="source{slot}Date">Date</label>
										<input type="text" id="source{slot}Date" name="source{slot}Date" value={value(`source${slot}Date`)} class="short" />
									</div>
									<div class="field">
										<label for="source{slot}Location">Where it names the nation (page, section or entry)</label>
										<input
											type="text"
											id="source{slot}Location"
											name="source{slot}Location"
											value={value(`source${slot}Location`)}
										/>
									</div>
								</div>
								<div class="field">
									<label for="source{slot}File">Upload a copy (PDF, PNG, JPEG or WebP, up to 10 MB)</label>
									{@render fieldError(`source${slot}File`)}
									<input type="file" id="source{slot}File" name="source{slot}File" accept={accepted} />
								</div>
							</fieldset>
						{/each}
					</fieldset>
				{:else}
					<fieldset>
						<legend><h2>Which material?</h2></legend>
						<div class="field">
							<label for="material">Page, record or passage</label>
							<p class="hint" id="material-hint">
								{#if kind === 'restrict' || kind === 'remove'}
									Please only say where the material is. Do not repeat sensitive material here.
								{:else}
									Filled in from the page you came from, if any. Add more pages on new lines.
								{/if}
							</p>
							{@render fieldError('material')}
							<textarea
								id="material"
								name="material"
								rows="3"
								aria-invalid={errors.material ? 'true' : undefined}
								aria-describedby={describedBy('material', true)}>{value('material', data.material)}</textarea
							>
						</div>
					</fieldset>
				{/if}

				<fieldset>
					<legend><h2>Who are you?</h2></legend>
					<p class="hint">Only a way to reply is required.</p>
					<div class="field">
						<label for="requesterName">Name (optional)</label>
						<input type="text" id="requesterName" name="requesterName" value={value('requesterName')} autocomplete="name" />
					</div>
					<div class="field">
						<label for="requesterNation">Nation (optional)</label>
						<input type="text" id="requesterNation" name="requesterNation" value={value('requesterNation')} />
					</div>
					<div class="field">
						<label for="requesterRole">Role, for example court administrator or cultural preservation officer (optional)</label>
						<input type="text" id="requesterRole" name="requesterRole" value={value('requesterRole')} autocomplete="organization-title" />
					</div>
					{#if kind !== 'add-nation'}
						<fieldset class="inline-choices">
							<legend>Are you writing on behalf of the nation’s government or one of its offices?</legend>
							<div class="choice">
								<input type="radio" id="writingForGovernment-yes" name="writingForGovernment" value="yes" checked={value('writingForGovernment') === 'yes'} />
								<label for="writingForGovernment-yes">Yes</label>
							</div>
							<div class="choice">
								<input type="radio" id="writingForGovernment-no" name="writingForGovernment" value="no" checked={value('writingForGovernment') === 'no'} />
								<label for="writingForGovernment-no">No, or not sure</label>
							</div>
						</fieldset>
					{/if}
					<div class="field">
						<label for="contact">Email address or phone number</label>
						{@render fieldError('contact')}
						<input
							type="text"
							id="contact"
							name="contact"
							value={value('contact')}
							autocomplete="email"
							aria-invalid={errors.contact ? 'true' : undefined}
							aria-describedby={describedBy('contact')}
						/>
					</div>
				</fieldset>

				<fieldset>
					<legend><h2>Details{kind === 'add-nation' ? ' (optional)' : ''}</h2></legend>
					<div class="field">
						<label for="details">
							{#if kind === 'correct'}What is wrong, and what should it say?{:else if kind === 'restrict' || kind === 'remove'}What should happen to the material?{:else if kind === 'contribute'}What would you like to offer?{:else if kind === 'add-nation'}Anything else the project should know{:else}Your question{/if}
						</label>
						{@render fieldError('details')}
						<textarea
							id="details"
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
								<label for="file{slot}">File {slot} (optional)</label>
								{@render fieldError(`file${slot}`)}
								<input type="file" id="file{slot}" name="file{slot}" accept={accepted} />
							</div>
						{/each}
					{/if}
				</fieldset>

				{#if kind === 'contribute'}
					<fieldset>
						<legend><h2>Credit and permission</h2></legend>
						<div class="field">
							<label for="creditPreference">
								How would you like to be credited? Name, nation, role, or leave empty for no credit.
							</label>
							<input type="text" id="creditPreference" name="creditPreference" value={value('creditPreference')} />
						</div>
						<fieldset>
							<legend>May the project publish what you send?</legend>
							{@render fieldError('publicationPermission')}
							<div class="choice">
								<input type="radio" id="publicationPermission-publish" name="publicationPermission" value="publish" checked={value('publicationPermission') === 'publish'} />
								<label for="publicationPermission-publish">
									Yes, under the project’s licenses
									<span class="hint"><a href="{repositoryLink}/blob/main/LICENSE.md">Licenses by material</a></span>
								</label>
							</div>
							<div class="choice">
								<input type="radio" id="publicationPermission-review-only" name="publicationPermission" value="review-only" checked={value('publicationPermission') === 'review-only'} />
								<label for="publicationPermission-review-only">No, share it with the project for review only</label>
							</div>
						</fieldset>
					</fieldset>
				{/if}

				{#if kind === 'add-nation'}
					<fieldset>
						<legend><h2>Statement</h2></legend>
						{@render fieldError('authorityStatement')}
						{#each authorityStatements as option (option)}
							<div class="choice">
								<input type="radio" id="authorityStatement-{option}" name="authorityStatement" value={option} checked={value('authorityStatement') === option} />
								<label for="authorityStatement-{option}">{authorityStatementLabels[option]}</label>
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
		{/if}
	{/if}
</div>

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

	.reference {
		font-size: var(--font-size-lead);
		letter-spacing: 0.05em;
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
