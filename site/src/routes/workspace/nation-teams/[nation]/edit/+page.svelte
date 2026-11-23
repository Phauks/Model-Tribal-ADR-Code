<script lang="ts">
	import {
		changeKindLabels,
		contactHoldDays,
		contactKindLabels,
		contactKinds,
		describeChange,
		hideableSectionLabels,
		hideableSections,
		statementSectionLabels,
		statementSections,
		type ChangeContents,
		type ChangeKind
	} from '#lib/nation-page-changes.ts';
	import { teamAnswerDays, teamAnswerLabels, teamAnswerOutcomes } from '#lib/nation-team-reports.ts';
	import { requestKindLabels } from '#lib/requests.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const about = $derived(data.starting.about.content as ChangeContents['about']);
	const courts = $derived(data.starting.courts.content as ChangeContents['courts']);
	const statements = $derived(data.starting.statements.content as ChangeContents['statements']);
	const contacts = $derived(data.starting.contacts.content as ChangeContents['contacts']);
	const pictures = $derived(data.starting.pictures.content as ChangeContents['pictures']);
	const hidden = $derived(data.starting.hidden.content as ChangeContents['hidden']);
	// A few empty rows after the contacts already given.
	const contactRows = $derived(Math.min(data.contactRows, contacts.contacts.length + 2));

	function when(value: string | null): string {
		return value ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
	}

	function credit(kind: ChangeKind): string {
		return data.starting[kind].credit ?? data.nation.title;
	}

	function messageFor(kind: ChangeKind): { problem?: string; done?: string } | undefined {
		if (!form || !('kind' in form) || form.kind !== kind) return undefined;
		return form as { problem?: string; done?: string };
	}

	const generalMessage = $derived(form && !('kind' in form) ? (form as { problem?: string; done?: string }) : undefined);
	const pictureBase = $derived(`/workspace/nation-teams/${data.nation.identifier}/pictures`);
</script>

<svelte:head>
	<title>Edit the page of {data.nation.title} · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<p class="small">
	<a href="/workspace/nation-teams/{data.nation.identifier}">Your nation’s team</a> ·
	<a href="/workspace/nation-teams/{data.nation.identifier}/changes">Changes and history</a>
	{#if data.nation.page}· <a href={data.nation.page}>View the page</a>{/if}
</p>
<h1>Edit the page of {data.nation.title}</h1>
<p>
	Each part says when your change appears. The project reads every change after it is live and steps in only
	for safety problems, which it tells you about. Facts the project cites to government records stay cited to
	them; you can add your nation’s statement beside them, or ask for a correction through Report a problem on
	the page.
</p>

{#if generalMessage?.problem}
	<div class="notice notice-problem" role="alert"><p>{generalMessage.problem}</p></div>
{:else if generalMessage?.done}
	<div class="notice" role="status"><p>{generalMessage.done}</p></div>
{/if}

{#if data.reports.length > 0}
	<section class="panel panel-filled" aria-labelledby="reports-heading">
		<h2 id="reports-heading">Problems readers reported</h2>
		<p>
			Readers reported these about your nation’s page. The project sees them too, and steps in if nobody on your
			team answers within {teamAnswerDays} days. You see what was reported, never who sent it.
		</p>
		<ul class="report-list">
			{#each data.reports as report (report.identifier)}
				<li>
					<p>
						<strong>{requestKindLabels[report.kind]}</strong>
						<span class="small muted">{report.reference}, {when(report.receivedAt)}</span>
					</p>
					{#if report.material}<p class="small"><span class="muted">Where:</span> {report.material}</p>{/if}
					{#if report.details}<p class="report-details">{report.details}</p>{/if}
					{#if report.outcome}
						<p class="small">
							<strong>{teamAnswerLabels[report.outcome]}</strong>, {report.answeredByName ?? 'your team'}, {when(report.answeredAt)}{#if report.note}: {report.note}{/if}
						</p>
					{:else if data.canAnswer}
						<form method="post" action="?/answer" class="report-answer">
							<input type="hidden" name="reference" value={report.reference} />
							<label for="note-{report.reference}" class="small">Note for the project <span class="muted">(optional)</span></label>
							<input type="text" id="note-{report.reference}" name="note" />
							<div class="button-row">
								{#each teamAnswerOutcomes as outcome (outcome)}
									<button class="button {outcome === 'fixed' ? '' : 'button-quiet'}" type="submit" name="outcome" value={outcome}>{teamAnswerLabels[outcome]}</button>
								{/each}
							</div>
						</form>
					{:else}
						<p class="small muted">Waiting for an editor on your team.</p>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if data.waiting.length > 0}
	<section class="panel panel-filled" aria-labelledby="waiting-heading">
		<h2 id="waiting-heading">Waiting to go live</h2>
		<p>
			New contacts wait {contactHoldDays} days so nobody can quietly send your nation’s mail somewhere else.
			Another editor for your nation can approve them sooner.
		</p>
		<ul class="change-list">
			{#each data.waiting as change (change.identifier)}
				<li>
					<strong>{describeChange(change.kind, change.content)}</strong>
					<span class="small muted">Published by {change.publishedByName ?? 'a team member'}; goes live {when(change.liveAt)}.</span>
					<span class="change-actions">
						{#if change.canApprove}
							<form method="post" action="?/approve">
								<input type="hidden" name="change" value={change.identifier} />
								<button class="button" type="submit">Approve now</button>
							</form>
						{/if}
						{#if change.canCancel}
							<form method="post" action="?/discard">
								<input type="hidden" name="change" value={change.identifier} />
								<button class="button button-quiet" type="submit">Cancel it</button>
							</form>
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if data.drafts.length > 0}
	<section class="panel" aria-labelledby="drafts-heading">
		<h2 id="drafts-heading">Drafts</h2>
		<ul class="change-list">
			{#each data.drafts as draft (draft.identifier)}
				<li>
					<strong>{describeChange(draft.kind, draft.content)}</strong>
					<span class="small muted">By {draft.writtenByName ?? 'a team member'}, {when(draft.writtenAt)}.</span>
					<span class="change-actions">
						{#if data.allowed[draft.kind].publish}
							<form method="post" action="?/publishDraft">
								<input type="hidden" name="change" value={draft.identifier} />
								<button class="button" type="submit">Publish</button>
							</form>
						{/if}
						{#if data.allowed[draft.kind].publish || draft.writtenBy === data.personIdentifier}
							<form method="post" action="?/discard">
								<input type="hidden" name="change" value={draft.identifier} />
								<button class="button button-quiet" type="submit">Throw away</button>
							</form>
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<div class="edit-layout">
	<div class="edit-parts">
		{#if data.allowed.about.draft}
			<form method="post" action="?/save" class="panel" aria-labelledby="about-heading">
				<input type="hidden" name="kind" value="about" />
				{@render partHeading('about', 'about-heading', 'now')}
				<p class="hint">In your nation’s own words. The project does not rewrite it. Leave it empty to remove it.</p>
				<label for="about-text" class="visually-hidden">About your nation</label>
				<textarea id="about-text" name="text" rows="8">{about.text}</textarea>
				{@render actions('about')}
			</form>
		{/if}

		{#if data.allowed.courts.draft}
			<form method="post" action="?/save" class="panel" aria-labelledby="courts-heading">
				<input type="hidden" name="kind" value="courts" />
				{@render partHeading('courts', 'courts-heading', 'now')}
				<p class="hint">
					A note shown at the end of “Courts and dispute resolution”, beside what the project cites, such as where
					peacemaking sessions are held.
				</p>
				<label for="courts-text" class="visually-hidden">Note on courts and dispute resolution</label>
				<textarea id="courts-text" name="text" rows="5">{courts.text}</textarea>
				{@render actions('courts')}
			</form>
		{/if}

		{#if data.allowed.contacts.draft}
			<form method="post" action="?/save" class="panel" aria-labelledby="contacts-heading">
				<input type="hidden" name="kind" value="contacts" />
				{@render partHeading('contacts', 'contacts-heading', 'held')}
				<p class="hint">
					Shown as “Contacts from the nation” beside the contacts the project cites. New emails, phone numbers and
					links wait {contactHoldDays} days, and another editor for your nation can approve them sooner. Empty a row to
					remove it.
				</p>
				{#each { length: contactRows } as _, index (index)}
					{@const contact = contacts.contacts[index]}
					<fieldset class="contact-row">
						<legend class="visually-hidden">Contact {index + 1}</legend>
						<div class="field">
							<label for="contact-office-{index}">Office</label>
							<input type="text" id="contact-office-{index}" name="contact-office-{index}" value={contact?.office ?? ''} />
						</div>
						<div class="field">
							<label for="contact-kind-{index}">Kind</label>
							<select id="contact-kind-{index}" name="contact-kind-{index}">
								{#each contactKinds as kind (kind)}
									<option value={kind} selected={(contact?.kind ?? 'email') === kind}>{contactKindLabels[kind]}</option>
								{/each}
							</select>
						</div>
						<div class="field">
							<label for="contact-value-{index}">Email, number or address</label>
							<input type="text" id="contact-value-{index}" name="contact-value-{index}" value={contact?.value ?? ''} />
						</div>
					</fieldset>
				{/each}
				{@render actions('contacts')}
			</form>
		{/if}

		{#if data.allowed.statements.draft}
			<form method="post" action="?/save" class="panel" aria-labelledby="statements-heading">
				<input type="hidden" name="kind" value="statements" />
				{@render partHeading('statements', 'statements-heading', 'now')}
				<p class="hint">
					These facts come from government records and stay cited to them. Your nation’s statement is shown beside
					them, labeled as the nation’s.
				</p>
				{#each statementSections as section (section)}
					<div class="field">
						<label for="statement-{section}">Beside {statementSectionLabels[section]}</label>
						<textarea id="statement-{section}" name="statement-{section}" rows="3">{statements.statements[section] ?? ''}</textarea>
					</div>
				{/each}
				{@render actions('statements')}
			</form>
		{/if}

		{#if data.allowed.pictures.draft}
			<form method="post" action="?/save" enctype="multipart/form-data" class="panel" aria-labelledby="pictures-heading">
				<input type="hidden" name="kind" value="pictures" />
				{@render partHeading('pictures', 'pictures-heading', 'now')}
				<p class="hint">
					Your nation’s page has no pictures unless your team adds them. Add only pictures your nation may share.
				</p>
				{#each pictures.pictures as picture (picture.identifier)}
					<fieldset class="picture-row">
						<legend class="visually-hidden">Picture: {picture.alt}</legend>
						<input type="hidden" name="picture" value={picture.identifier} />
						<img src="{pictureBase}/{picture.identifier}" alt="" />
						<div>
							<div class="choice">
								<input type="checkbox" id="keep-{picture.identifier}" name="keep-{picture.identifier}" value="yes" checked />
								<label for="keep-{picture.identifier}">Keep this picture</label>
							</div>
							<div class="field">
								<label for="alt-{picture.identifier}">What it shows, for people who cannot see it</label>
								<input type="text" id="alt-{picture.identifier}" name="alt-{picture.identifier}" value={picture.alt} required />
							</div>
							<div class="field">
								<label for="caption-{picture.identifier}">Caption</label>
								<input type="text" id="caption-{picture.identifier}" name="caption-{picture.identifier}" value={picture.caption ?? ''} />
							</div>
							<div class="field">
								<label for="credit-{picture.identifier}">Credit</label>
								<input type="text" id="credit-{picture.identifier}" name="credit-{picture.identifier}" value={picture.credit ?? ''} />
							</div>
						</div>
					</fieldset>
				{/each}
				<fieldset>
					<legend>Add a picture</legend>
					<div class="field">
						<label for="new-picture">Picture</label>
						<p class="hint" id="new-picture-hint">A PNG, JPEG or WebP file, up to 5 MB.</p>
						<input type="file" id="new-picture" name="new-picture" accept="image/png,image/jpeg,image/webp" aria-describedby="new-picture-hint" />
					</div>
					<div class="field">
						<label for="new-alt">What it shows, for people who cannot see it</label>
						<input type="text" id="new-alt" name="new-alt" />
					</div>
					<div class="field">
						<label for="new-caption">Caption <span class="muted">(optional)</span></label>
						<input type="text" id="new-caption" name="new-caption" />
					</div>
					<div class="field">
						<label for="new-credit">Credit <span class="muted">(optional)</span></label>
						<input type="text" id="new-credit" name="new-credit" />
					</div>
				</fieldset>
				{@render actions('pictures')}
			</form>
		{/if}
	</div>

	<aside class="edit-side">
		{#if data.allowed.hidden.publish}
			<form method="post" action="?/save" class="panel panel-filled" aria-labelledby="hide-heading">
				<input type="hidden" name="kind" value="hidden" />
				<h2 id="hide-heading">Hide something now</h2>
				<p>If anything on the page should not be public, hide it. It disappears at once and the project follows up.</p>
				{@render message('hidden')}
				<fieldset>
					<legend class="visually-hidden">Parts of the page to hide</legend>
					{#each hideableSections as section (section)}
						<div class="choice">
							<input type="checkbox" id="hide-{section}" name="hide" value={section} checked={hidden.sections.includes(section)} />
							<label for="hide-{section}">{hideableSectionLabels[section]}</label>
						</div>
					{/each}
				</fieldset>
				<button class="button button-danger" type="submit">Save what is hidden</button>
			</form>
		{/if}
		<section class="panel" aria-labelledby="live-heading">
			<h2 id="live-heading">On the page now</h2>
			{#if Object.keys(data.live).length === 0}
				<p>Nothing from your nation yet. The page shows only what the project cites.</p>
			{:else}
				<ul>
					{#each Object.values(data.live) as change (change.identifier)}
						<li>{describeChange(change.kind, change.content)} <span class="small muted">({when(change.liveAt)})</span></li>
					{/each}
				</ul>
			{/if}
		</section>
	</aside>
</div>

{#snippet partHeading(kind: ChangeKind, identifier: string, timing: 'now' | 'held')}
	<div class="part-heading">
		<h2 id={identifier}>{changeKindLabels[kind]}</h2>
		<span class="timing" class:timing-held={timing === 'held'}>
			{timing === 'held' ? `Goes live in ${contactHoldDays} days` : 'Goes live when you publish'}
		</span>
	</div>
	{@render message(kind)}
{/snippet}

{#snippet message(kind: ChangeKind)}
	{@const result = messageFor(kind)}
	{#if result?.problem}
		<p class="field-error" role="alert">{result.problem}</p>
	{:else if result?.done}
		<p class="notice" role="status">{result.done}</p>
	{/if}
{/snippet}

{#snippet actions(kind: ChangeKind)}
	{#if data.starting[kind].fromDraft}
		<p class="small muted">This form shows your saved draft.</p>
	{/if}
	<div class="field">
		<label for="credit-{kind}">Credit the change to</label>
		<p class="hint" id="credit-{kind}-hint">Shown on the page. Your own name is not shown unless you type it here.</p>
		<input type="text" id="credit-{kind}" name="credit" value={credit(kind)} aria-describedby="credit-{kind}-hint" />
	</div>
	<div class="button-row">
		{#if data.allowed[kind].publish}
			<button class="button" type="submit" name="intent" value="publish">Publish</button>
		{/if}
		<button class="button button-quiet" type="submit" name="intent" value="draft">Save as a draft</button>
	</div>
{/snippet}

<style>
	.edit-layout {
		display: grid;
		gap: var(--space-5);
	}

	@media (min-width: 60rem) {
		.edit-layout {
			grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr);
			align-items: start;
		}
	}

	.edit-parts > :global(.panel:first-child),
	.edit-side > :global(.panel:first-child) {
		margin-top: 0;
	}

	.part-heading {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-3);
		align-items: baseline;
		justify-content: space-between;
	}

	.part-heading h2 {
		margin: 0;
	}

	.timing {
		padding: 0 var(--space-2);
		border: 1px solid var(--color-link);
		border-radius: 999px;
		color: var(--color-link);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
	}

	.timing-held {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}

	textarea,
	input[type='text'],
	select {
		width: 100%;
		font: inherit;
	}

	fieldset {
		border: 0;
		padding: 0;
		margin: 0 0 var(--space-4);
	}

	.contact-row {
		display: grid;
		gap: var(--space-2) var(--space-3);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--color-line);
	}

	@media (min-width: 40rem) {
		.contact-row {
			grid-template-columns: 2fr 1fr 2fr;
		}
	}

	.contact-row .field {
		margin: 0;
	}

	.picture-row {
		display: grid;
		grid-template-columns: 8rem minmax(0, 1fr);
		gap: var(--space-3);
	}

	.picture-row img {
		width: 8rem;
		height: auto;
		border-radius: var(--radius-control);
	}

	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		margin: var(--space-2) 0;
	}

	.choice input {
		margin-top: 0.3em;
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
	}

	.button-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.change-list {
		padding: 0;
		list-style: none;
	}

	.change-list li {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-3);
		align-items: center;
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.change-actions {
		display: flex;
		gap: var(--space-2);
		margin-left: auto;
	}

	.change-actions form {
		margin: 0;
	}

	.report-list {
		padding: 0;
		list-style: none;
	}

	.report-list > li {
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.report-list p {
		margin: 0 0 var(--space-2);
	}

	.report-details {
		white-space: pre-wrap;
	}

	.report-answer {
		display: grid;
		gap: var(--space-2);
		max-width: 36rem;
	}

	.button-danger {
		background: var(--color-danger);
		border-color: var(--color-danger);
		color: var(--color-action-text);
	}
</style>
