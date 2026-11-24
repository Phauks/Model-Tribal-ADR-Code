<script lang="ts">
	// One file sent about the nation, for its nation reviewer: see it, read
	// what the sender said about it, and comment for the nation. The sender's
	// name and the reviewers' own notes are not shown here.
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import Download from '@lucide/svelte/icons/download';
	import { onMount } from 'svelte';
	import { nationNames } from '#lib/nation-names.ts';
	import {
		destinationLabels,
		nationStatusLabels,
		originReviewLabels,
		permittedUseShortLabels,
		readableSize,
		uploadKindLabels
	} from '#lib/uploads.ts';
	import { youtubeEmbedAddress, youtubeWatchAddress } from '#lib/video-links.ts';
	import type { PageProps } from './$types';
	import { mediumDateAndTime } from '#lib/readable-date.ts';

	let { data, form }: PageProps = $props();

	const upload = $derived(data.upload);
	const name = $derived(upload.title ?? upload.file_name ?? 'YouTube video');
	const fileAddress = $derived(`/workspace/nation-uploads/${upload.reference}/file`);

	let names = $state(new Map<string, string>());
	onMount(async () => (names = await nationNames()));
	const nationName = $derived(names.get(data.nation) ?? 'your nation');

</script>

<svelte:head>
	<title>{name} · Files about your nation · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<div class="wide">
	<Breadcrumbs trail={[{ label: `Files about ${nationName}`, href: '/workspace/nation-uploads' }]} />
	<h1>{name}</h1>
	<p class="muted">{upload.reference} · sent {mediumDateAndTime(upload.received_at)}</p>
	<p><span class="chip">{nationStatusLabels[upload.status]}</span></p>

	{#if form && 'problem' in form}
		<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
	{:else if form && 'done' in form}
		<div class="notice" role="status"><p>Your comment was added. The project's reviewers will see it.</p></div>
	{/if}

	<h2 class="visually-hidden">The file</h2>
	{#if upload.source === 'youtube' && upload.youtube_identifier}
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
	{:else if upload.kind === 'picture'}
		<img class="preview" src="{fileAddress}?show" alt={upload.description ?? name} />
	{:else if upload.kind === 'video'}
		<!-- A video as sent has no captions yet; a reviewer writes its transcript when filing it. -->
		<!-- svelte-ignore a11y_media_has_caption -->
		<video class="preview" controls preload="metadata" src="{fileAddress}?show"></video>
	{:else if upload.kind === 'sound'}
		<audio controls preload="metadata" src="{fileAddress}?show"></audio>
	{:else if upload.kind === 'document'}
		<p>Documents are not opened in the browser. Download it and open it on your computer.</p>
	{/if}
	{#if upload.source === 'file'}
		<p class="small downloads">
			<a href={fileAddress} download><Download size={14} aria-hidden="true" /> Download the file</a>
			· Files are checked for viruses and hidden programs before they are shown. Open downloads with care all the same.
		</p>
	{/if}

	<h2>What the sender said</h2>
	<dl class="summary-list">
		<div><dt>What it is</dt><dd>{upload.description ?? 'Not said'}</dd></div>
		<div><dt>Where it came from</dt><dd>{upload.origin ? originReviewLabels[upload.origin] : 'Not said'}{upload.origin_note ? `: ${upload.origin_note}` : ''}</dd></div>
		<div><dt>How the project may use it</dt><dd>{upload.permitted_use ? permittedUseShortLabels[upload.permitted_use] : 'Not said'}</dd></div>
		<div><dt>Nation first?</dt><dd>{upload.nation_first ? 'Yes: the sender asked that the nation see it before anyone else' : 'No'}</dd></div>
		{#if upload.kind}
			<div><dt>Kind</dt><dd>{uploadKindLabels[upload.kind]}{upload.size_bytes ? `, ${readableSize(upload.size_bytes)}` : ''}</dd></div>
		{/if}
		{#if upload.status === 'filed' && upload.destination}
			<div><dt>Filed as</dt><dd>{destinationLabels[upload.destination]}{upload.filed_page ? ` (${upload.filed_page})` : ''}</dd></div>
		{/if}
	</dl>
	<p class="small muted">The project does not show you who sent it. Ask the lead author if the nation needs to know.</p>

	<h2>Comments from the nation</h2>
	{#if data.comments.length === 0}
		<p class="small muted">No comments yet.</p>
	{/if}
	{#each data.comments as comment (comment.identifier)}
		<div class="message">
			<p class="small"><strong>{comment.person_name ?? 'A nation reviewer'}</strong> · {mediumDateAndTime(comment.created_at)}</p>
			<p>{comment.body}</p>
		</div>
	{/each}
	<form method="post" action="?/comment" class="field">
		<label for="comment">Comment for the nation</label>
		<p class="hint">
			For example, whether the nation agrees it may be shown, who should be credited, a correction, or something that should stay private. The project's reviewers read it before they decide. The sender does not see it.
		</p>
		<textarea id="comment" name="comment" rows="4"></textarea>
		<p><button class="button" type="submit">Add comment</button></p>
	</form>
</div>

<style>
	.wide {
		max-width: none;
	}
	.preview {
		display: block;
		max-width: 100%;
		max-height: 70vh;
		border-radius: var(--radius-panel);
		background: var(--color-surface);
	}
	video.preview,
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
	.message {
		border-left: 4px solid var(--color-action);
		padding-left: var(--space-3);
		margin: var(--space-3) 0;
	}
	.message p {
		margin: 0 0 var(--space-1);
	}
</style>
