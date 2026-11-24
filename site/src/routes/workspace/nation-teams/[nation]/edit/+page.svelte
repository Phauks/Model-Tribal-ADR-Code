<script lang="ts">
	// Editing a nation's page: one form with a card for each part, each saying
	// when a change appears, and beside it one "Ready to publish" summary with
	// one credit and one Publish button, and "Hide something now"
	// (design/nation-editors, screen 3, approved by Trevor on Nov. 23, 2026).
	import { onMount } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import Clock from '@lucide/svelte/icons/clock';
	import Landmark from '@lucide/svelte/icons/landmark';
	import Plus from '@lucide/svelte/icons/plus';
	import FileDropField from '#lib/components/FileDropField.svelte';
	import NationChangeContent from '#lib/components/NationChangeContent.svelte';
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
		type ChangeKind,
		type ContactKind,
		type StatementSection
	} from '#lib/nation-page-changes.ts';
	import { answersFor, teamAnswerDays, teamAnswerLabels } from '#lib/nation-team-reports.ts';
	import { mediumDateAndTime, readableDate } from '#lib/readable-date.ts';
	import { requestKindLabels } from '#lib/requests.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// The form's fields, starting from the person's draft or from the page.
	// svelte-ignore state_referenced_locally
	const starting = data.starting;
	let aboutText = $state((starting.about.content as ChangeContents['about']).text);
	let courtsText = $state((starting.courts.content as ChangeContents['courts']).text);
	let statementTexts = $state<Record<StatementSection, string>>(
		Object.fromEntries(
			statementSections.map((section) => [section, (starting.statements.content as ChangeContents['statements']).statements[section] ?? ''])
		) as Record<StatementSection, string>
	);
	// The contacts already given, or one empty row; "Add a contact" adds rows.
	const givenContacts = (starting.contacts.content as ChangeContents['contacts']).contacts;
	let contactRows = $state(givenContacts.length > 0 ? [...givenContacts] : [{ office: '', kind: 'email' as ContactKind, value: '' }]);
	const pictures = $derived(data.starting.pictures.content as ChangeContents['pictures']);
	let pictureTouched = $state(false);
	const hidden = $derived(data.starting.hidden.content as ChangeContents['hidden']);
	// svelte-ignore state_referenced_locally
	let credit = $state(data.starting.about.credit ?? data.credits[0] ?? data.nation.title);
	let otherCredit = $state('');
	let addingStatement = $state<Record<StatementSection, boolean>>({ recognition: false, law: false, jurisdiction: false });
	let scripted = $state(false);

	onMount(() => {
		scripted = true;
	});

	const onPage = $derived(data.onPage);
	const canPublish = $derived(
		(['about', 'courts', 'statements', 'contacts', 'pictures'] as const).some((kind) => data.allowed[kind].draft && data.allowed[kind].publish)
	);

	function cleaned(text: string): string {
		return text.replace(/\r\n?/g, '\n').trim();
	}

	const contactsNow = $derived(
		contactRows
			.map((row) => ({ office: cleaned(row.office), kind: row.kind, value: cleaned(row.value) }))
			.filter((row) => row.office || row.value)
	);

	/** One line for each part that differs from the page, for "Ready to publish". */
	const ready = $derived.by(() => {
		const lines: { kind: ChangeKind; text: string }[] = [];
		const goesLive = (kind: ChangeKind) =>
			!canPublish ? 'a draft' : kind === 'contacts' ? `live ${readableDate(data.contactsGoLive).replace(/, \d{4}$/, '')}` : 'live now';
		const text = (kind: 'about' | 'courts', now: string) => {
			const was = (onPage[kind] as ChangeContents['about']).text;
			if (cleaned(now) === was || !data.allowed[kind].draft) return;
			const what = !was ? 'added' : !cleaned(now) ? 'removed' : kind === 'about' ? 'rewritten' : 'changed';
			lines.push({ kind, text: `${changeKindLabels[kind]}: ${what} (${goesLive(kind)})` });
		};
		text('about', aboutText);
		text('courts', courtsText);
		if (data.allowed.contacts.draft) {
			const was = (onPage.contacts as ChangeContents['contacts']).contacts;
			if (JSON.stringify(was) !== JSON.stringify(contactsNow)) {
				const added = contactsNow.filter((contact) => !was.some((old) => old.office === contact.office && old.kind === contact.kind && old.value === contact.value));
				const what =
					added.length === 1 && contactsNow.length >= was.length
						? `new ${contactKindLabels[added[0].kind].toLocaleLowerCase('en-US')}`
						: 'changed';
				lines.push({ kind: 'contacts', text: `Contact: ${what} (${goesLive('contacts')})` });
			}
		}
		if (data.allowed.statements.draft) {
			const was = (onPage.statements as ChangeContents['statements']).statements;
			for (const section of statementSections) {
				const now = cleaned(statementTexts[section]);
				if (now === (was[section] ?? '')) continue;
				const what = !was[section] ? 'statement added' : !now ? 'statement removed' : 'statement changed';
				lines.push({ kind: 'statements', text: `${statementSectionLabels[section].replace(/ \(.*\)$/, '')}: ${what} (${goesLive('statements')})` });
			}
		}
		if (data.allowed.pictures.draft && pictureTouched) lines.push({ kind: 'pictures', text: `Pictures: changed (${goesLive('pictures')})` });
		return lines;
	});

	function the(title: string): string {
		return /^the\s/i.test(title) ? title : `the ${title}`;
	}

	function messageFor(kind: ChangeKind): { problem?: string; done?: string } | undefined {
		if (!form || !('kind' in form) || form.kind !== kind) return undefined;
		return form as { problem?: string; done?: string };
	}

	const generalMessage = $derived(form && !('kind' in form) ? (form as { problem?: string; done?: string }) : undefined);
	const pictureBase = $derived(`/workspace/nation-teams/${data.nation.identifier}/pictures`);
	const correctionLink = (section: StatementSection) =>
		`/requests?kind=correct&record=${encodeURIComponent(`tribes/${data.nation.identifier}`)}&field=${section}`;
</script>

<svelte:head>
	<title>Edit {the(data.nation.title)}’s page · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<p class="small page-links">
	<a href="/workspace/nation-teams/{data.nation.identifier}">Your nation’s team</a> ·
	<a href="/workspace/nation-teams/{data.nation.identifier}/changes">Changes and history</a> ·
	<a href="/workspace/nation-teams/{data.nation.identifier}/laws-and-cases">Laws and cases</a>
	{#if data.nation.page}· <a href={data.nation.page}>View the page</a>{/if}
</p>
<h1>Edit {the(data.nation.title)}’s page</h1>
<p class="lede">
	Each part says when your change appears. The project reads every change after it is live and only steps in for safety problems, which it tells you about.
</p>

{#if generalMessage?.problem}
	<div class="notice notice-problem" role="alert"><p>{generalMessage.problem}</p></div>
{:else if generalMessage?.done}
	<div class="notice" role="status"><p>{generalMessage.done}</p></div>
{/if}

{#if data.pause}
	<section class="panel panel-filled" id="project-question" aria-labelledby="pause-heading">
		<h2 id="pause-heading">The project has a question</h2>
		<p>
			The project paused publishing for this page on {mediumDateAndTime(data.pause.pausedAt)} and asks your team:
		</p>
		<blockquote class="pause-question">{data.pause.question}</blockquote>
		<p class="small">
			Until the project resumes publishing, you can still save drafts and hide parts of the page, but nothing else goes live.
		</p>
		{#if data.pause.answer}
			<p class="small">
				<strong>Your team’s answer</strong>, {data.pause.answeredByName ?? 'your team'}, {mediumDateAndTime(data.pause.answeredAt)}:
			</p>
			<p class="report-details">{data.pause.answer}</p>
		{/if}
		{#if data.canAnswer}
			<form method="post" action="?/answerProject" class="report-answer">
				<label for="pause-answer">{data.pause.answer ? 'Write a new answer' : 'Your answer'}</label>
				<textarea id="pause-answer" name="answer" rows="4" required></textarea>
				<div class="button-row"><button class="button" type="submit">Send to the project</button></div>
			</form>
		{:else}
			<p class="small muted">An editor or steward on your team can answer.</p>
		{/if}
	</section>
{/if}

{#if data.reports.length > 0}
	<section class="panel panel-filled" aria-labelledby="reports-heading">
		<h2 id="reports-heading">Messages and reports from readers</h2>
		<p>
			The project sees these too, and steps in if nobody on your team answers within {teamAnswerDays} days. You see
			who wrote only when they chose to share it.
		</p>
		<ul class="report-list">
			{#each data.reports as report (report.identifier)}
				<li>
					<p>
						<strong>{requestKindLabels[report.kind]}</strong>
						<span class="small muted">{report.reference}, {mediumDateAndTime(report.receivedAt)}</span>
					</p>
					{#if report.material}<p class="small"><span class="muted">Where:</span> {report.material}</p>{/if}
					{#if report.details}<p class="report-details">{report.details}</p>{/if}
					{#if report.sender}
						<p class="small">
							<span class="muted">From:</span>
							{#if report.sender.name}{report.sender.name},{/if}
							{#if report.sender.contact?.includes('@')}<a href="mailto:{report.sender.contact}?subject={encodeURIComponent(`Your message about our nation’s page (${report.reference})`)}">{report.sender.contact}</a>{:else}{report.sender.contact}{/if}
						</p>
					{/if}
					{#if report.outcome}
						<p class="small">
							<strong>{teamAnswerLabels[report.outcome]}</strong>, {report.answeredByName ?? 'your team'}, {mediumDateAndTime(report.answeredAt)}{#if report.note}: {report.note}{/if}
						</p>
					{:else if data.canAnswer}
						<form method="post" action="?/answer" class="report-answer">
							<input type="hidden" name="reference" value={report.reference} />
							<label for="note-{report.reference}" class="small">Note for the project <span class="muted">(optional)</span></label>
							<input type="text" id="note-{report.reference}" name="note" />
							<div class="button-row">
								{#each answersFor(report.sender !== null) as outcome (outcome)}
									<button class="button {outcome === (report.sender ? 'wrote-back' : 'fixed') ? '' : 'button-quiet'}" type="submit" name="outcome" value={outcome}>{teamAnswerLabels[outcome]}</button>
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

<div class="edit-layout">
	<form method="post" action="?/save" enctype="multipart/form-data" id="edit-form" class="edit-parts" onchange={(event) => { if ((event.target as HTMLElement).closest('.pictures-part')) pictureTouched = true; }}>
		<input type="hidden" name="intent" value={canPublish ? 'publish' : 'draft'} />
		{#if data.allowed.about.draft}
			<section class="part" aria-labelledby="about-heading">
				<input type="hidden" name="kind" value="about" />
				{@render partHeading('about', 'about-heading', 'now')}
				<p class="hint" id="about-hint">In your nation’s own words. The project does not rewrite it.</p>
				<label for="about-text" class="visually-hidden">About your nation</label>
				<textarea id="about-text" name="about-text" rows="4" bind:value={aboutText} aria-describedby="about-hint"></textarea>
			</section>
		{/if}

		{#if data.allowed.courts.draft}
			<section class="part" aria-labelledby="courts-heading">
				<input type="hidden" name="kind" value="courts" />
				{@render partHeading('courts', 'courts-heading', 'now')}
				<p class="hint" id="courts-hint">A note shown at the end of “Courts”, such as where peacemaking sessions are held.</p>
				<label for="courts-text" class="visually-hidden">Note on courts and dispute resolution</label>
				<textarea id="courts-text" name="courts-text" rows="3" bind:value={courtsText} aria-describedby="courts-hint"></textarea>
			</section>
		{/if}

		{#if data.allowed.contacts.draft}
			<section class="part" aria-labelledby="contacts-heading">
				<input type="hidden" name="kind" value="contacts" />
				{@render partHeading('contacts', 'contacts-heading', 'held')}
				<p class="hint">
					New emails, phone numbers and links wait {contactHoldDays} days, and the office already listed is told. This stops anyone from quietly sending your nation’s mail somewhere else. Another editor for your nation can approve it sooner.
				</p>
				{#each contactRows as row, index (index)}
					<fieldset class="contact-row">
						<legend class="visually-hidden">Contact {index + 1}</legend>
						<div>
							<label for="contact-office-{index}" class="small">Office</label>
							<input type="text" id="contact-office-{index}" name="contact-office-{index}" bind:value={row.office} />
						</div>
						<div>
							<label for="contact-kind-{index}" class="small">Kind</label>
							<select id="contact-kind-{index}" name="contact-kind-{index}" bind:value={row.kind}>
								{#each contactKinds as kind (kind)}
									<option value={kind}>{contactKindLabels[kind]}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="contact-value-{index}" class="small">Email, number or address</label>
							<input type="text" id="contact-value-{index}" name="contact-value-{index}" bind:value={row.value} />
						</div>
					</fieldset>
				{/each}
				{#if !scripted && contactRows.length < data.contactRows}
					<!-- Without scripts, one empty row to add a contact. -->
					<fieldset class="contact-row">
						<legend class="visually-hidden">Contact {contactRows.length + 1}</legend>
						<div><label for="contact-office-{contactRows.length}" class="small">Office</label><input type="text" id="contact-office-{contactRows.length}" name="contact-office-{contactRows.length}" /></div>
						<div>
							<label for="contact-kind-{contactRows.length}" class="small">Kind</label>
							<select id="contact-kind-{contactRows.length}" name="contact-kind-{contactRows.length}">
								{#each contactKinds as kind (kind)}<option value={kind}>{contactKindLabels[kind]}</option>{/each}
							</select>
						</div>
						<div><label for="contact-value-{contactRows.length}" class="small">Email, number or address</label><input type="text" id="contact-value-{contactRows.length}" name="contact-value-{contactRows.length}" /></div>
					</fieldset>
				{/if}
				{#if contactRows.length < data.contactRows && scripted}
					<button class="button button-quiet small-button" type="button" onclick={() => contactRows.push({ office: '', kind: 'email', value: '' })}>
						<Plus size={16} aria-hidden="true" />Add a contact
					</button>
				{/if}
				{#if ready.some((line) => line.kind === 'contacts')}
					<div class="compared" aria-live="polite">
						<NationChangeContent kind="contacts" content={{ contacts: contactsNow }} before={onPage.contacts} {pictureBase} />
					</div>
				{/if}
			</section>
		{/if}

		{#if data.allowed.statements.draft}
			<input type="hidden" name="kind" value="statements" />
			{#each statementSections as section (section)}
				{@const open = !scripted || addingStatement[section] || Boolean(statementTexts[section])}
				<section class="part" aria-labelledby="statement-{section}-heading">
					<div class="part-heading">
						<h2 id="statement-{section}-heading">{statementSectionLabels[section].replace(/ \(.*\)$/, '')}</h2>
						<span class="timing timing-record"><Landmark size={14} aria-hidden="true" />Government record</span>
					</div>
					<p class="hint">
						{section === 'recognition' ? 'This fact comes' : 'These facts come'} from government records and {section === 'recognition' ? 'stays' : 'stay'} cited to them. You can add your nation’s statement beside {section === 'recognition' ? 'it' : 'them'}, which goes live when you publish, or ask the project to correct {section === 'recognition' ? 'it' : 'them'}.
					</p>
					{#if open}
						<label for="statement-{section}">Your nation’s statement</label>
						<textarea id="statement-{section}" name="statement-{section}" rows="3" bind:value={statementTexts[section]}></textarea>
					{:else}
						<input type="hidden" name="statement-{section}" value={statementTexts[section]} />
					{/if}
					<div class="button-row">
						{#if !open}
							<button class="button button-quiet small-button" type="button" onclick={() => (addingStatement[section] = true)}>
								<Plus size={16} aria-hidden="true" />Add the nation’s statement
							</button>
						{/if}
						<a class="button button-quiet small-button" href={correctionLink(section)}>Ask for a correction</a>
					</div>
				</section>
			{/each}
		{/if}

		{#if data.allowed.pictures.draft}
			<section class="part pictures-part" aria-labelledby="pictures-heading">
				<input type="hidden" name="kind" value="pictures" />
				{@render partHeading('pictures', 'pictures-heading', 'now')}
				<p class="hint">Your nation’s page has no pictures unless your team adds them. Add only pictures your nation may share.</p>
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
				<label for="new-picture">Add a picture</label>
				<FileDropField id="new-picture" name="new-picture" accept="image/png,image/jpeg,image/webp" what="a PNG, JPEG or WebP picture" hint="Up to 5 MB." />
				{#if pictureTouched || !scripted}
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
				{/if}
			</section>
		{/if}
	</form>

	<aside class="edit-side">
		<section class="part" aria-labelledby="ready-heading">
			<h2 id="ready-heading">{canPublish ? 'Ready to publish' : 'Ready to save'}</h2>
			{#if ready.length > 0}
				<ul class="ready">
					{#each ready as line (line.text)}<li>{line.text}</li>{/each}
				</ul>
			{:else if scripted}
				<p class="small muted">Nothing changed yet.</p>
			{/if}
			{#if data.starting.about.fromDraft || data.starting.courts.fromDraft || data.starting.contacts.fromDraft || data.starting.statements.fromDraft}
				<p class="small muted">The form shows your saved draft.</p>
			{/if}
			<label for="credit">Credit the change to</label>
			<select id="credit" name={credit === 'other' ? undefined : 'credit'} form="edit-form" bind:value={credit} aria-describedby="credit-hint">
				{#each data.credits as option (option)}<option value={option}>{option}</option>{/each}
				<option value="other">Another name</option>
			</select>
			{#if credit === 'other'}
				<label for="credit-other" class="visually-hidden">Credit the change to</label>
				<input type="text" id="credit-other" name="credit" form="edit-form" bind:value={otherCredit} required />
			{/if}
			<p class="hint" id="credit-hint">Shown on the page and in the citation. Your own name is not shown unless you choose it.</p>
			<button class="button publish" type="submit" form="edit-form">{canPublish ? 'Publish' : 'Save as a draft'}</button>
			{#if !canPublish}
				<p class="small muted">An editor or steward for your nation publishes it{data.pause ? ' once the project resumes publishing' : ''}.</p>
			{/if}
		</section>

		{#if data.allowed.hidden.publish}
			<section class="part" aria-labelledby="hide-heading">
				<h2 id="hide-heading">Hide something now</h2>
				<p class="small muted">If anything on the page should not be public, hide it. It disappears at once and the project follows up.</p>
				{@render message('hidden')}
				{#if hidden.sections.length > 0}
					<p class="small">Hidden now: {hidden.sections.map((section) => hideableSectionLabels[section]).join(', ')}.</p>
				{/if}
				<details class="hide" open={hidden.sections.length > 0 || undefined}>
					<summary class="button button-quiet small-button warn">Hide a part of the page</summary>
					<form method="post" action="?/save">
						<input type="hidden" name="kind" value="hidden" />
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
				</details>
			</section>
		{/if}
	</aside>
</div>

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
					<span class="small muted">Published by {change.publishedByName ?? 'a team member'}; goes live {mediumDateAndTime(change.liveAt)}.</span>
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
					<span class="small muted">By {draft.writtenByName ?? 'a team member'}, {mediumDateAndTime(draft.writtenAt)}.</span>
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


{#snippet partHeading(kind: ChangeKind, identifier: string, timing: 'now' | 'held')}
	<div class="part-heading">
		<h2 id={identifier}>{kind === 'contacts' ? 'Contact' : changeKindLabels[kind]}</h2>
		{#if timing === 'held'}
			<span class="timing timing-held"><Clock size={14} aria-hidden="true" />Goes live in {contactHoldDays} days</span>
		{:else}
			<span class="timing timing-now"><Check size={14} aria-hidden="true" />Goes live when you publish</span>
		{/if}
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

<style>
	.edit-layout {
		display: grid;
		gap: var(--space-5);
	}

	@media (min-width: 60rem) {
		.edit-layout {
			grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem);
			align-items: start;
		}
	}

	.lede {
		color: var(--color-ink-muted);
	}

	.edit-parts,
	.edit-side {
		display: grid;
		gap: var(--space-4);
		min-width: 0;
	}

	/* One card for each part, as in the approved mockup. */
	.part {
		padding: var(--space-4) var(--space-5);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
	}

	.part > :last-child {
		margin-bottom: 0;
	}

	.part h2 {
		margin-top: 0;
		font-size: var(--font-size-large);
	}

	.part .hint {
		margin: var(--space-1) 0 var(--space-3);
	}

	.compared {
		margin-top: var(--space-3);
	}

	.ready {
		margin: var(--space-2) 0 var(--space-4);
		padding-left: var(--space-5);
	}

	.edit-side label {
		display: block;
		margin: var(--space-3) 0 var(--space-1);
		font-weight: var(--font-weight-semibold);
	}

	.edit-side .hint {
		margin: var(--space-1) 0 var(--space-3);
	}

	.publish {
		width: 100%;
		justify-content: center;
	}

	.small-button {
		display: inline-flex;
		gap: var(--space-2);
		align-items: center;
		min-height: auto;
		padding: var(--space-1) var(--space-3);
		border-color: var(--color-link);
		color: var(--color-link);
		font-size: var(--font-size-small);
	}

	.warn {
		border-color: var(--color-action);
		color: var(--color-action);
	}

	.hide > summary {
		list-style: none;
		cursor: pointer;
	}

	.hide > summary::-webkit-details-marker {
		display: none;
	}

	.hide form {
		margin-top: var(--space-3);
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
		display: inline-flex;
		gap: var(--space-1);
		align-items: center;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-link);
		border-radius: 999px;
		background: var(--color-notice-background);
		color: var(--color-link);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
	}

	.timing-now {
		border-color: var(--color-line);
		background: var(--color-added-background);
		color: var(--color-ink);
	}

	.timing-held {
		border-color: var(--color-action);
		background: var(--color-removed-background);
		color: var(--color-action);
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
		margin-bottom: var(--space-2);
	}

	.contact-row label {
		display: block;
	}

	/* On a wide screen the rows line up under the first row's labels. */
	@media (min-width: 40rem) {
		.contact-row + .contact-row label {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
	}

	@media (min-width: 40rem) {
		.contact-row {
			grid-template-columns: 2fr 1fr 2fr;
		}
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

	.pause-question {
		margin: var(--space-2) 0;
		border-left: 4px solid var(--color-line);
		padding-left: var(--space-3);
		white-space: pre-wrap;
	}

	.report-answer {
		display: grid;
		gap: var(--space-2);
		max-width: var(--layout-measure);
	}

	.button-danger {
		background: var(--color-danger);
		border-color: var(--color-danger);
		color: var(--color-action-text);
	}
</style>
