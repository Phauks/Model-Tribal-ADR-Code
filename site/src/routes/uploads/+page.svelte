<script lang="ts">
	// Your uploads (docs/uploads.md): everything the signed-in person has
	// sent, where each file is now, questions from reviewers, and a way to
	// take a file back before it is filed.
	import AudioLines from '@lucide/svelte/icons/audio-lines';
	import FileText from '@lucide/svelte/icons/file-text';
	import Film from '@lucide/svelte/icons/film';
	import Image from '@lucide/svelte/icons/image';
	import {
		readableSize,
		uploadKindLabels,
		uploadStatusExplanations,
		uploadStatusLabels,
		withdrawableStatuses,
		type UploadKind
	} from '#lib/uploads.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const icons = { document: FileText, picture: Image, sound: AudioLines, video: Film } as const;
	const asking = $derived(data.uploads.filter((upload) => upload.status === 'needs-answer'));

	function day(value: string): string {
		return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function kindText(kind: UploadKind | null, source: string): string {
		if (source === 'youtube') return 'YouTube video';
		return kind ? uploadKindLabels[kind] : 'File';
	}
</script>

<svelte:head>
	<title>Your uploads · Model Tribal ADR Code</title>
</svelte:head>

<div class="uploads-page">
	<h1>Your uploads</h1>
	<p class="lead">Everything you have sent, and where each file is now.</p>
	<p><a class="button" href="/uploads/send">Send files</a></p>

	{#if data.sent}
		<div class="notice" role="status">
			<p>Thank you. {data.sent === '1' ? 'Your file is' : 'Your files are'} in line for review. We will show each decision here.</p>
		</div>
	{/if}
	{#if form?.done === 'withdrawn'}
		<div class="notice" role="status"><p>You withdrew {form.reference}, and its file was deleted.</p></div>
	{:else if form?.done === 'answered'}
		<div class="notice" role="status"><p>Thank you. Your answer went to the reviewer.</p></div>
	{:else if form?.problem}
		<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
	{/if}

	{#each asking as upload (upload.reference)}
		<div class="notice">
			<p><strong>We have a question about “{upload.name}”.</strong> <a href="#{upload.reference}">Read and answer</a></p>
		</div>
	{/each}

	{#if data.uploads.length === 0}
		<p>You have not sent anything yet.</p>
	{:else}
		<ul class="uploads">
			{#each data.uploads as upload (upload.reference)}
				{@const Icon = upload.kind ? icons[upload.kind] : FileText}
				<li id={upload.reference}>
					<div class="what">
						<span class="name"><Icon size={18} aria-hidden="true" /> {upload.name}</span>
						<span class="small muted">
							{kindText(upload.kind, upload.source)}{#if upload.sizeBytes}, {readableSize(upload.sizeBytes)}{/if}
							· sent {day(upload.receivedAt)} · {upload.reference}
						</span>
					</div>
					<div class="where">
						<span
							class="state"
							class:filed={upload.status === 'filed'}
							class:ask={upload.status === 'needs-answer'}
							class:refused={upload.status === 'not-accepted' || upload.status === 'not-used' || upload.status === 'withdrawn'}
						>
							{uploadStatusLabels[upload.status]}
						</span>
						<span class="small">{uploadStatusExplanations[upload.status]}</span>
						{#if upload.reason}
							<span class="small">Reason given: {upload.reason}</span>
						{/if}
					</div>

					{#if upload.messages.length > 0}
						<div class="messages">
							{#each upload.messages as message, index (index)}
								<p class="small">
									<strong>{message.kind === 'question' ? 'Reviewer asked' : 'You answered'}</strong>
									({day(message.createdAt)}): {message.body}
								</p>
							{/each}
						</div>
					{/if}

					{#if upload.status === 'needs-answer'}
						<form method="post" action="?/answer" class="answer">
							<input type="hidden" name="reference" value={upload.reference} />
							<div class="field">
								<label for="answer-{upload.reference}">Your answer</label>
								<textarea id="answer-{upload.reference}" name="answer" rows="3" required></textarea>
							</div>
							<button class="button" type="submit">Send answer</button>
						</form>
					{/if}

					{#if withdrawableStatuses.includes(upload.status)}
						<details class="withdraw">
							<summary class="small">Withdraw</summary>
							<form method="post" action="?/withdraw">
								<input type="hidden" name="reference" value={upload.reference} />
								<p class="small">We will not use it, and its file is deleted at once. This cannot be undone.</p>
								<button class="button button-quiet" type="submit">Withdraw and delete</button>
							</form>
						</details>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
	<p class="small muted">
		You can withdraw a file at any time before it is filed. After that, use
		<a href="/requests?kind=restrict">Change or withdrawal</a> and we will take it down.
	</p>
</div>

<style>
	.uploads-page {
		max-width: 60rem;
	}
	.uploads {
		list-style: none;
		padding: 0;
		margin: var(--space-4) 0;
		border-top: 2px solid var(--color-line);
	}
	.uploads li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-2) var(--space-4);
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-line);
		scroll-margin-top: var(--space-6);
	}
	.uploads li > :not(.what, .where) {
		grid-column: 1 / -1;
	}
	@media (max-width: 40rem) {
		.uploads li {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.what,
	.where {
		display: flex;
		flex-direction: column;
		gap: 2px;
		align-items: flex-start;
	}
	.name {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		font-weight: var(--font-weight-semibold);
		overflow-wrap: anywhere;
	}
	.state {
		display: inline-block;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		padding: 0 var(--space-2);
	}
	.filed {
		border-color: var(--color-link);
		color: var(--color-link);
	}
	.ask {
		border-color: var(--color-action);
		color: var(--color-action);
	}
	.refused {
		border-style: dashed;
		color: var(--color-ink-muted);
	}
	.messages p {
		margin: 0 0 var(--space-1);
	}
	.answer {
		max-width: var(--layout-measure);
	}
	.withdraw summary {
		cursor: pointer;
		color: var(--color-link);
		width: fit-content;
	}
</style>
