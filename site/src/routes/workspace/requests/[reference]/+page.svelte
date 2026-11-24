<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import {
		authorityStatementLabels,
		requestKindLabels,
		requestOutcomeLabels,
		requestOutcomes,
		requestStatusLabels,
		sourceKindLabels,
		type AuthorityStatement
	} from '#lib/requests.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const request = $derived(data.request);
	const statusChoices = $derived(data.statuses.map((status) => ({ value: status as string, label: requestStatusLabels[status] })));
	const outcomeChoices = requestOutcomes.map((outcome) => ({ value: outcome as string, label: requestOutcomeLabels[outcome] }));

	function date(value: string | null, withTime = false): string {
		if (!value) return '';
		return new Date(value).toLocaleString('en-US', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
	}

	function size(bytes: number | null): string {
		if (!bytes) return '';
		return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
	}
</script>

<svelte:head>
	<title>Request {request.reference} · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Workspace', href: '/workspace' },
		{ label: 'Requests', href: '/workspace/requests' }
	]}
/>
<h1>Request {request.reference}</h1>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{:else if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{/if}

<dl class="summary-list">
	<div><dt>Kind</dt><dd>{requestKindLabels[request.kind]}</dd></div>
	<div>
		<dt>Status</dt>
		<dd>
			{requestStatusLabels[request.status]}{#if request.outcome}: {requestOutcomeLabels[request.outcome]}{/if}
		</dd>
	</div>
	{#if request.outcomeReason}
		<div><dt>Reasons given</dt><dd class="preserve">{request.outcomeReason}</dd></div>
	{/if}
	<div><dt>Received</dt><dd>{date(request.receivedAt, true)}</dd></div>
	{#if request.acknowledgedAt}<div><dt>Acknowledged</dt><dd>{date(request.acknowledgedAt, true)}</dd></div>{/if}
	{#if request.materialHiddenAt}<div><dt>Material hidden</dt><dd>{date(request.materialHiddenAt, true)}</dd></div>{/if}
	{#if request.resolvedAt}<div><dt>Resolved</dt><dd>{date(request.resolvedAt, true)}</dd></div>{/if}
	{#each data.deadlines as deadline (deadline.label)}
		<div>
			<dt>{deadline.label}</dt>
			<dd class:overdue={deadline.overdue}>{date(deadline.due)}{deadline.overdue ? ' (past)' : ''}</dd>
		</div>
	{/each}
	{#if request.earlierReference}
		<div>
			<dt>Applies again under</dt>
			<dd><a href="/workspace/requests/{request.earlierReference}">{request.earlierReference}</a></dd>
		</div>
	{/if}
</dl>

<h2>What is asked</h2>
<dl class="summary-list">
	{#if request.kind === 'add-nation'}
		<div><dt>Name in the government source</dt><dd>{request.missingNationOfficialName}</dd></div>
		{#if request.missingNationOwnName}<div><dt>Name the nation uses</dt><dd>{request.missingNationOwnName}</dd></div>{/if}
		<div><dt>States</dt><dd>{request.missingNationStates}</dd></div>
		{#if request.authorityStatement}
			<div>
				<dt>Statement</dt>
				<dd>{authorityStatementLabels[request.authorityStatement as AuthorityStatement]}</dd>
			</div>
		{/if}
	{:else}
		<div><dt>Material</dt><dd class="preserve">{request.material ?? ''}</dd></div>
		{#if request.nationIdentifier}
			<div><dt>Nation record</dt><dd><a href="/nations/{request.nationIdentifier}">{request.nationIdentifier}</a></dd></div>
		{/if}
	{/if}
	{#if request.details}<div><dt>Details</dt><dd class="preserve">{request.details}</dd></div>{/if}
	{#if request.kind === 'contribute' && data.submissions.length === 0}
		<div><dt>Credit</dt><dd>{request.creditPreference ?? 'No credit'}</dd></div>
		<div>
			<dt>Permission</dt>
			<dd>{request.publicationPermission === 'publish' ? 'May be published under the site’s licenses' : 'For review only'}</dd>
		</div>
	{/if}
</dl>

{#if data.submissions.length > 0}
	<h2>Forms</h2>
	{#each data.submissions as submission (submission.identifier)}
		<section class="panel">
			<h3>{submission.title}, version {submission.version}</h3>
			<dl class="summary-list">
				<div>
					<dt>How</dt>
					<dd>{submission.method === 'online' ? 'Filled in and signed online' : 'Signed paper copy, uploaded (see Files)'}</dd>
				</div>
				{#if submission.signedName}<div><dt>Signed as</dt><dd>{submission.signedName}</dd></div>{/if}
				<div><dt>Received</dt><dd>{date(submission.receivedAt, true)}</dd></div>
				<div><dt>Filing</dt><dd>{submission.filingIdentifier ?? 'Not filed yet'}</dd></div>
			</dl>
			{#if submission.canShow || submission.hasCopy}
				<p>
					{#if submission.canShow}
						<a href="/workspace/requests/{request.reference}/forms/{submission.identifier}">Read the filled form</a>
					{/if}
					{#if submission.canShow && submission.hasCopy}<span aria-hidden="true"> · </span>{/if}
					{#if submission.hasCopy}
						<a href="/workspace/requests/{request.reference}/forms/{submission.identifier}/copy" download
							>Download the filled form (Markdown)</a
						>
					{/if}
				</p>
			{/if}
		</section>
	{/each}
	{#if data.canHandle}
		<form method="post" action="?/filing" class="panel">
			<h3>File the forms</h3>
			<p class="small">
				Give a new filing number, or the number of an existing filing when this adds to one
				(docs/contributions.md). Check the signature and the answers before filing.
			</p>
			<div class="field">
				<label for="filing">Filing number</label>
				<input
					id="filing"
					name="filing"
					type="text"
					value={data.submissions[0]?.filingIdentifier ?? data.nextFiling ?? ''}
					pattern="filing-[0-9]{'{4}'}-[0-9]{'{4}'}"
				/>
			</div>
			<button class="button" type="submit">File the forms</button>
		</form>
	{/if}
{/if}

{#if data.sources.length > 0}
	<h2>{request.kind === 'add-nation' ? 'Proof' : 'Files'}</h2>
	{#each data.sources as source, index (source.identifier)}
		<section class="panel">
			{#if request.kind === 'add-nation'}
				<h3>Source {index + 1}</h3>
				<dl class="summary-list">
					{#if source.sourceKind}<div><dt>Kind</dt><dd>{sourceKindLabels[source.sourceKind]}</dd></div>{/if}
					{#if source.title}<div><dt>Title</dt><dd>{source.title}</dd></div>{/if}
					{#if source.citation}<div><dt>Citation</dt><dd class="preserve">{source.citation}</dd></div>{/if}
					{#if source.sourceDate}<div><dt>Date</dt><dd>{source.sourceDate}</dd></div>{/if}
					{#if source.locationInSource}<div><dt>Where it names the nation</dt><dd>{source.locationInSource}</dd></div>{/if}
				</dl>
			{/if}
			{#if source.fileKey}
				<p>
					<a href="/workspace/requests/{request.reference}/files/{source.identifier}" download
						>Download {source.fileName}</a
					>
					<span class="small muted">({size(source.fileSize)})</span>
				</p>
			{/if}
		</section>
	{/each}
	{#if request.kind === 'add-nation'}
		<p class="small">
			Check each source in the government’s own publication, not only the uploaded copy, and save an
			archived copy as the methodology requires (docs/requests.md, “How the project reviews it”).
		</p>
	{/if}
{/if}

<h2>Requester</h2>
{#if request.personalDetailsDeletedAt}
	<p>Personal details were deleted on {date(request.personalDetailsDeletedAt)}, 12 months after the request was resolved.</p>
{:else}
	<dl class="summary-list">
		<div><dt>Name</dt><dd>{request.requesterName ?? ''}</dd></div>
		<div><dt>Nation</dt><dd>{request.requesterNation ?? ''}</dd></div>
		<div><dt>Role</dt><dd>{request.requesterRole ?? ''}</dd></div>
		{#if request.kind !== 'add-nation'}
			<div><dt>For the nation’s government</dt><dd>{request.writingForGovernment ? 'Yes' : 'No, or not sure'}</dd></div>
		{/if}
		<div><dt>Contact</dt><dd>{request.contact ?? ''}</dd></div>
	</dl>
{/if}

{#if data.canHandle}
	<h2>Handle the request</h2>
	{#if request.status !== 'resolved'}
		<form method="post" action="?/status" class="panel">
			<h3>Change the status</h3>
			<div class="field">
				<Dropdown label="New status" id="status" name="status" choices={statusChoices} value={request.status} />
			</div>
			<div class="field">
				<label for="status-note">Note for the history (optional)</label>
				<textarea id="status-note" name="note" rows="2"></textarea>
			</div>
			<button class="button" type="submit">Change status</button>
		</form>

		<form method="post" action="?/resolve" class="panel">
			<h3>Resolve</h3>
			<div class="field">
				<Dropdown label="Outcome" id="outcome" name="outcome" choices={outcomeChoices} value={requestOutcomes[0]} />
			</div>
			<div class="field">
				<label for="reason">Reasons, as given to the requester (required when declining)</label>
				<p class="hint">
					For a declined application to add a nation: which part of the rule the proof did not meet, the
					sources checked, and what kind of source would meet it.
				</p>
				<textarea id="reason" name="reason" rows="4"></textarea>
			</div>
			<button class="button" type="submit">Resolve the request</button>
			<p class="small">
				Content changes still go through a pull request, with a commit message that does not repeat
				withdrawn material.
			</p>
		</form>
	{:else}
		<form method="post" action="?/reopen" class="panel">
			<h3>Reopen</h3>
			<p>For example, when the requester asks for reconsideration or sends new proof.</p>
			<div class="field">
				<label for="reopen-note">Why (optional)</label>
				<textarea id="reopen-note" name="note" rows="2"></textarea>
			</div>
			<button class="button button-quiet" type="submit">Reopen the request</button>
		</form>
	{/if}

	<form method="post" action="?/note" class="panel">
		<h3>Add a note</h3>
		<div class="field">
			<label for="note">Note (private to editors)</label>
			<textarea id="note" name="note" rows="3"></textarea>
		</div>
		<button class="button button-quiet" type="submit">Add the note</button>
	</form>
{/if}

<h2>History</h2>
<ol class="history">
	{#each data.history as event (event.identifier)}
		<li>
			<span class="small muted">{date(event.createdAt, true)}</span>
			{event.action}{#if event.personName} · {event.personName}{/if}
			{#if event.note}<div class="preserve">{event.note}</div>{/if}
		</li>
	{/each}
</ol>

<style>
	.preserve {
		white-space: pre-wrap;
	}

	.overdue {
		color: var(--color-danger);
		font-weight: var(--font-weight-semibold);
	}

	.history {
		padding-left: var(--space-5);
	}

	.history li {
		margin-bottom: var(--space-3);
	}
</style>
