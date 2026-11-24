<script lang="ts">
	// Review and file one upload (docs/uploads.md): look at the file and what
	// the checks found, read what the sender said, ask them a question, and
	// file it, keep it for reference, or say why it was not used.
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import { onMount } from 'svelte';
	import Download from '@lucide/svelte/icons/download';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import { nationNames } from '#lib/nation-names.ts';
	import {
		decidedStatuses,
		destinationLabels,
		destinations,
		filedAccessLevelLabels,
		filedAccessLevels,
		originReviewLabels,
		permittedUseShortLabels,
		readableSize,
		reviewerStatusLabels,
		uploadKindLabels,
		type Destination,
		type FiledAccessLevel
	} from '#lib/uploads.ts';
	import { youtubeEmbedAddress, youtubeWatchAddress } from '#lib/video-links.ts';
	import type { PageProps } from './$types';
	import DateField from '#lib/components/DateField.svelte';
	import { mediumDateAndTime } from '#lib/readable-date.ts';

	let { data, form }: PageProps = $props();

	const upload = $derived(data.upload);
	const name = $derived(upload.title ?? upload.file_name ?? 'YouTube video');
	const fileAddress = $derived(`/workspace/uploads/${upload.reference}/file`);
	const reviewable = $derived(['waiting-for-review', 'in-review', 'needs-answer', 'waiting-for-nation'].includes(upload.status));
	const decided = $derived(decidedStatuses.includes(upload.status));
	// Nothing is shown or downloaded until the virus check allows every stored copy.
	const servable = $derived(data.scans.length > 0 && data.scans.every((scan) => scan.status === 'clean' || scan.status === 'released-by-hand'));
	const nationLinks = $derived(data.links.filter((link) => link.target_kind === 'nation'));
	const filingErrors = $derived<Record<string, string>>((form && 'filingErrors' in form ? form.filingErrors : undefined) ?? {});

	let names = $state(new Map<string, string>());
	onMount(async () => (names = await nationNames()));

	function defaultDestination(): Destination {
		if (upload.kind === 'picture') return 'nation-picture';
		if (upload.kind === 'video' || upload.kind === 'sound') return 'nation-video';
		return 'nation-source';
	}

	function defaultAccess(): FiledAccessLevel {
		if (upload.permitted_use === 'background-only') return 'restricted';
		if (upload.nation_first) return 'nation-review-first';
		return 'public';
	}

	// The form starts from the sender's answers, or from an earlier filing.
	// Writable derived values (Svelte 5.25+): they follow the page's data and the reviewer's choice.
	let destination = $derived<Destination>(upload.destination ?? defaultDestination());
	let accessLevel = $derived<FiledAccessLevel>(upload.access_level ?? defaultAccess());

</script>

<svelte:head>
	<title>Upload {upload.reference} · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<div class="wide">
	<Breadcrumbs
		trail={[
			{ label: 'Workspace', href: '/workspace' },
			{ label: 'Uploads', href: '/workspace/uploads' }
		]}
	/>
	<h1>{name}</h1>
	<p class="muted">
		{upload.reference} · sent {mediumDateAndTime(upload.received_at)}{data.group.length > 0
			? ` · sent with ${data.group.length} other file${data.group.length === 1 ? '' : 's'}`
			: ''}
	</p>
	<p>
		<span class="chip">{reviewerStatusLabels[upload.status]}</span>
		{#if data.reviewerName}<span class="small muted">Reviewer: {data.reviewerName}</span>{/if}
	</p>

	{#if form && 'problem' in form}
		<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
	{:else if form && 'done' in form}
		<div class="notice" role="status"><p>Saved.</p></div>
	{/if}

	{#if upload.status === 'waiting-for-review'}
		<form method="post" action="?/claim" class="claim">
			<button class="button" type="submit">Start reviewing</button>
			<span class="small muted">Puts your name on it, so others know.</span>
		</form>
	{/if}

	<div class="columns">
		<div>
			<h2 class="visually-hidden">The file</h2>
			{#if upload.deleted_at}
				<p class="notice">The file was deleted on {mediumDateAndTime(upload.deleted_at)}. This record stays.</p>
			{:else if upload.source === 'youtube' && upload.youtube_identifier}
				<div class="frame">
					<iframe
						src={youtubeEmbedAddress(upload.youtube_identifier)}
						title="YouTube video: {name}"
						allow="encrypted-media; picture-in-picture"
						allowfullscreen
						loading="lazy"
						referrerpolicy="strict-origin-when-cross-origin"
					></iframe>
				</div>
				<p class="small"><a href={youtubeWatchAddress(upload.youtube_identifier)} rel="noreferrer">Open on YouTube</a></p>
			{:else if upload.status === 'sending'}
				<p class="notice">Still arriving.</p>
			{:else if upload.source === 'file' && !servable}
				<p class="notice">Held until the virus check passes. See Checks below.</p>
			{:else if upload.kind === 'picture'}
				<img class="preview" src="{fileAddress}?show" alt="As sent: {upload.description ?? name}" />
			{:else if upload.kind === 'video'}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video class="preview" controls preload="metadata" src="{fileAddress}?show"></video>
				<p class="small muted">Played from our storage. Some browsers cannot play every kind of video; download it if it does not play.</p>
			{:else if upload.kind === 'sound'}
				<audio controls preload="metadata" src="{fileAddress}?show"></audio>
			{:else if upload.kind === 'document'}
				<p>Documents are not opened in the browser. Download it and open it on your computer.</p>
			{/if}
			{#if upload.source === 'file' && upload.original_key && !upload.deleted_at && upload.status !== 'sending' && servable}
				<p class="small downloads">
					<a href="{fileAddress}?original" download><Download size={14} aria-hidden="true" /> Download the file as sent</a>
					{#if upload.preview_key}
						· <a href={fileAddress} download>Download the copy without location</a>
					{/if}
				</p>
			{/if}

			<h2>Checks</h2>
			<ul class="checks">
				{#if upload.media_type}
					<li class="ok"><ShieldCheck size={18} aria-hidden="true" /> The file is {upload.kind ? uploadKindLabels[upload.kind].toLocaleLowerCase('en-US') : 'a file'} ({upload.media_type}), found from its first bytes, not its name.</li>
				{/if}
				{#if upload.source === 'youtube'}
					<li class="ok"><ShieldCheck size={18} aria-hidden="true" /> A link to a YouTube video; nothing was stored.</li>
				{/if}
				{#if upload.check_result === 'careful-look' || upload.check_result === 'refused'}
					{#each (upload.check_notes ?? '').split('\n').filter(Boolean) as note, index (index)}
						<li class="warn"><ShieldAlert size={18} aria-hidden="true" /> {note}</li>
					{/each}
				{:else if upload.check_result === 'passed' && upload.source === 'file'}
					<li class="ok"><ShieldCheck size={18} aria-hidden="true" /> No hidden programs, macros or attachments found.</li>
				{/if}
				{#if upload.kind === 'picture' && upload.source === 'file' && upload.status !== 'sending'}
					{#if upload.preview_key}
						<li class="ok"><ShieldCheck size={18} aria-hidden="true" /> A copy without location and other hidden details was made; that copy is what gets filed.</li>
					{:else}
						<li class="warn"><ShieldAlert size={18} aria-hidden="true" /> No copy without location could be made. The file may still hold where it was taken.</li>
					{/if}
				{/if}
				{#if upload.fingerprint}
					<li class="ok">
						<ShieldCheck size={18} aria-hidden="true" /> Fingerprint <code>{upload.fingerprint.replace('pieces:', '').slice(0, 8)}…{upload.fingerprint.slice(-6)}</code>{#if data.sameFile.length > 0},
							also sent as {#each data.sameFile as same, index (same.reference)}{index > 0 ? ', ' : ''}<a href="/workspace/uploads/{same.reference}">{same.reference}</a>{/each}{:else}, not seen before{/if}.
					</li>
				{/if}
				{#each data.scans as scan, index (index)}
					<li class={scan.status === 'clean' ? 'ok' : 'warn'}>
						{#if scan.status === 'clean'}<ShieldCheck size={18} aria-hidden="true" />{:else}<ShieldAlert size={18} aria-hidden="true" />{/if}
						<span
							>{data.scans.length > 1 ? (index === 0 ? 'File as sent: ' : 'Copy without location: ') : ''}{scan.label}. {scan.explanation}{#if scan.checkedBy}<br /><span
									class="small muted">{scan.checkedBy}</span
								>{/if}</span
						>
					</li>
				{/each}
			</ul>
			{#if upload.status === 'checking' && data.scans.some((scan) => scan.status === 'cannot-scan' || scan.status === 'failed')}
				<form method="post" action="?/release" class="field">
					<label for="release-note">Release it without a virus check</label>
					<p class="hint">Only for a file you trust, such as one you know the source of. Say why; it goes in the history. A file where something was found can never be released.</p>
					<textarea id="release-note" name="note" rows="2"></textarea>
					<p><button class="button button-quiet" type="submit">Release it</button></p>
				</form>
			{/if}
			{#if upload.status === 'checking' && data.scans.some((scan) => scan.status === 'failed' || scan.status === 'cannot-scan')}
				<form method="post" action="?/check-again">
					<button class="button button-quiet" type="submit">Check it again</button>
				</form>
			{/if}

			<h2>What the sender said</h2>
			<dl class="summary-list">
				<div><dt>From</dt><dd>{data.senderEmail ? `${data.senderName ? `${data.senderName}, ` : ''}${data.senderEmail}` : 'The sender deleted their account'}</dd></div>
				<div><dt>What it is</dt><dd>{upload.description ?? 'Not said'}</dd></div>
				<div>
					<dt>Nations</dt>
					<dd>
						{#if nationLinks.length === 0}None named{:else}
							{#each nationLinks as link, index (link.target_identifier)}{index > 0 ? ', ' : ''}<a href="/nations/{link.target_identifier}">{names.get(link.target_identifier) ?? link.target_identifier}</a>{/each}
						{/if}
					</dd>
				</div>
				<div><dt>Where it came from</dt><dd>{upload.origin ? originReviewLabels[upload.origin] : 'Not said'}{upload.origin_note ? `: ${upload.origin_note}` : ''}</dd></div>
				<div><dt>How it may be used</dt><dd>{upload.permitted_use ? permittedUseShortLabels[upload.permitted_use] : 'Not said'}</dd></div>
				<div><dt>Nation first?</dt><dd>{upload.nation_first ? 'Yes: ask the nation before anyone else sees it' : 'No'}</dd></div>
				{#if upload.sender_under_eighteen}
					<div><dt>Age</dt><dd>Under 18: credit only by a description or a name they choose</dd></div>
				{/if}
				{#if upload.size_bytes}
					<div><dt>Size</dt><dd>{readableSize(upload.size_bytes)}{upload.file_name ? `, sent as “${upload.file_name}”` : ''}</dd></div>
				{/if}
				{#if data.group.length > 0}
					<div>
						<dt>Sent with</dt>
						<dd>
							{#each data.group as other, index (other.reference)}{index > 0 ? ', ' : ''}<a href="/workspace/uploads/{other.reference}">{other.name}</a>{/each}
						</dd>
					</div>
				{/if}
			</dl>

			<h2>Messages</h2>
			{#if data.messages.length === 0}
				<p class="small muted">No messages yet.</p>
			{/if}
			{#each data.messages as message (message.identifier)}
				<div class="message" class:note={message.kind === 'note'} class:nation={message.kind === 'nation-comment'}>
					<p class="small">
						<strong>
							{message.kind === 'question' ? `${message.person_name ?? 'A reviewer'} asked the sender` : message.kind === 'answer' ? 'The sender answered' : message.kind === 'nation-comment' ? `${message.person_name ?? 'A nation reviewer'} commented for the nation` : `${message.person_name ?? 'A reviewer'} noted (reviewers only)`}
						</strong>
						· {mediumDateAndTime(message.created_at)}
					</p>
					<p>{message.body}</p>
				</div>
			{/each}
			{#if reviewable}
				<form method="post" action="?/question" class="field">
					<label for="question">Ask the sender a question</label>
					<p class="hint">They see it on Your uploads, and the file waits for their answer.</p>
					<textarea id="question" name="question" rows="2"></textarea>
					<p><button class="button button-quiet" type="submit">Send question</button></p>
				</form>
			{/if}
			<form method="post" action="?/note" class="field">
				<label for="note">Add a note for reviewers</label>
				<textarea id="note" name="note" rows="2"></textarea>
				<p><button class="button button-quiet" type="submit">Add note</button></p>
			</form>

			<h2>History</h2>
			<ol class="history small">
				{#each data.history as entry (entry.identifier)}
					<li>{mediumDateAndTime(entry.createdAt)}: {entry.action}{entry.personName ? `, by ${entry.personName}` : ''}</li>
				{/each}
			</ol>
		</div>

		<aside class="panel file-it" aria-labelledby="file-heading">
			{#if reviewable}
				<h2 id="file-heading">File it</h2>
				<form method="post" action="?/file">
					{#each nationLinks as link (link.target_identifier)}
						<input type="hidden" name="nations" value={link.target_identifier} />
					{/each}
					<div class="field">
						<label for="destination">Where it goes</label>
						{#if filingErrors.destination}<p class="field-error">{filingErrors.destination}</p>{/if}
						<select id="destination" name="destination" bind:value={destination}>
							{#each destinations as value (value)}
								<option {value}>{destinationLabels[value]}</option>
							{/each}
						</select>
					</div>
					<div class="field">
						<label for="filed-page">Which page</label>
						<p class="hint">The address after the site name, such as nations/hopi-tribe. Optional.</p>
						{#if filingErrors.filedPage}<p class="field-error">{filingErrors.filedPage}</p>{/if}
						<input id="filed-page" name="filedPage" type="text" value={upload.filed_page ?? (nationLinks[0] ? `nations/${nationLinks[0].target_identifier}` : '')} />
					</div>
					<div class="field">
						<label for="caption">Caption</label>
						<input id="caption" name="caption" type="text" value={upload.caption ?? ''} />
					</div>
					{#if upload.kind === 'picture' || destination === 'nation-picture' || destination === 'essay-figure'}
						<div class="field">
							<label for="alternative-text">Description for people who cannot see it</label>
							{#if filingErrors.alternativeText}<p class="field-error">{filingErrors.alternativeText}</p>{/if}
							<textarea id="alternative-text" name="alternativeText" rows="2">{upload.alternative_text ?? ''}</textarea>
						</div>
					{/if}
					{#if upload.kind === 'sound' || upload.kind === 'video'}
						<div class="field">
							<label for="transcript">Transcript</label>
							<p class="hint">The words spoken, for people who cannot hear it. Optional.</p>
							<textarea id="transcript" name="transcript" rows="4">{upload.transcript ?? ''}</textarea>
						</div>
					{/if}
					<div class="field">
						<label for="credit">Credit</label>
						<p class="hint">As the sender wants it, from their answers or their profile.</p>
						<input id="credit" name="credit" type="text" value={upload.credit ?? ''} />
					</div>
					<div class="field">
						<label for="access">Who can see it</label>
						{#if filingErrors.accessLevel}<p class="field-error">{filingErrors.accessLevel}</p>{/if}
						<select id="access" name="accessLevel" bind:value={accessLevel}>
							{#each filedAccessLevels as value (value)}
								<option {value} disabled={value === 'public' && upload.permitted_use === 'background-only'}>{filedAccessLevelLabels[value]}</option>
							{/each}
						</select>
					</div>
					{#if accessLevel === 'embargoed'}
						<div class="field">
							<label for="embargoed-until">Shown from</label>
							{#if filingErrors.embargoedUntil}<p class="field-error">{filingErrors.embargoedUntil}</p>{/if}
							<DateField id="embargoed-until" name="embargoedUntil" value={upload.embargoed_until ?? ''} invalid={!!filingErrors.embargoedUntil} />
						</div>
					{/if}
					<div class="field">
						<label for="filing">Filing</label>
						<p class="hint">When a person, not a publisher, gave us this: the contribution filing, such as filing-2026-0001.</p>
						{#if filingErrors.filingIdentifier}<p class="field-error">{filingErrors.filingIdentifier}</p>{/if}
						<input id="filing" name="filingIdentifier" type="text" class="short" value={upload.filing_identifier ?? ''} />
					</div>
					<p><button class="button" type="submit">File it</button></p>
				</form>
				<hr />
				{#if upload.status !== 'waiting-for-nation'}
					<form method="post" action="?/nation">
						<p><button class="button button-quiet" type="submit">Wait for the nation</button></p>
					</form>
				{/if}
				<form method="post">
					<div class="field">
						<label for="reason">Or don’t use it</label>
						<p class="hint">For Not used, the sender sees this reason. Its file is deleted after 30 days.</p>
						<textarea id="reason" name="reason" rows="2"></textarea>
					</div>
					<p class="row">
						<button class="button button-quiet" type="submit" formaction="?/keep">Keep for reference only</button>
						<button class="button button-quiet" type="submit" formaction="?/decline">Not used</button>
					</p>
				</form>
			{:else}
				<h2 id="file-heading">Decision</h2>
				<p>{reviewerStatusLabels[upload.status]}{upload.decided_at ? ` on ${mediumDateAndTime(upload.decided_at)}` : ''}.</p>
				{#if upload.status === 'filed'}
					<dl class="summary-list">
						<div><dt>Where</dt><dd>{upload.destination ? destinationLabels[upload.destination] : ''}{upload.filed_page ? `, ${upload.filed_page}` : ''}</dd></div>
						<div><dt>Who can see it</dt><dd>{upload.access_level ? filedAccessLevelLabels[upload.access_level] : 'With its essay'}{upload.embargoed_until ? `, from ${upload.embargoed_until}` : ''}</dd></div>
						{#if upload.filing_identifier}<div><dt>Filing</dt><dd>{upload.filing_identifier}</dd></div>{/if}
					</dl>
					{#if upload.source === 'file'}
						<p class="small">Address for pages: <code>/files/{upload.reference}/{upload.file_name}</code></p>
					{/if}
				{/if}
				{#if upload.decision_reason}<p class="small">Reason given: {upload.decision_reason}</p>{/if}
				{#if decided && !upload.deleted_at}
					<form method="post" action="?/reopen">
						<p><button class="button button-quiet" type="submit">Reopen</button></p>
					</form>
				{/if}
			{/if}
		</aside>
	</div>
</div>

<style>
	.wide {
		max-width: none;
	}
	.claim {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		margin-bottom: var(--space-4);
	}
	.columns {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 22rem;
		gap: var(--space-6);
		align-items: start;
	}
	@media (max-width: 60rem) {
		.columns {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.preview {
		display: block;
		max-width: 100%;
		max-height: 70vh;
		border-radius: var(--radius-panel);
		background: var(--color-surface);
	}
	video.preview {
		width: 100%;
	}
	audio {
		width: 100%;
	}
	.frame {
		position: relative;
		aspect-ratio: 16 / 9;
	}
	.frame iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
		border-radius: var(--radius-panel);
	}
	.downloads :global(svg) {
		vertical-align: -2px;
	}
	.checks {
		list-style: none;
		padding: 0;
	}
	.checks li {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		margin: var(--space-2) 0;
	}
	.checks :global(svg) {
		flex: none;
		margin-top: 3px;
	}
	.ok :global(svg) {
		color: var(--color-link);
	}
	.warn {
		color: var(--color-action);
		font-weight: var(--font-weight-semibold);
	}
	.message {
		border-left: 4px solid var(--color-line);
		padding-left: var(--space-3);
		margin: var(--space-3) 0;
	}
	.message.note {
		border-left-style: dashed;
	}
	.message.nation {
		border-left-color: var(--color-action);
	}
	.message p {
		margin: 0 0 var(--space-1);
	}
	.history {
		padding-left: var(--space-5);
	}
	.file-it select {
		width: 100%;
	}
	.row {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	hr {
		border: 0;
		border-top: 1px solid var(--color-line);
		margin: var(--space-4) 0;
	}
</style>
