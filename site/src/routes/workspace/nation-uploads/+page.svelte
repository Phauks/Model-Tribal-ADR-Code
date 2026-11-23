<script lang="ts">
	// Files people sent about the nation reviewer's nation (docs/uploads.md,
	// "Comments from the nation"). The nation reads them and comments; the
	// project's reviewers decide where each one goes.
	import AudioLines from '@lucide/svelte/icons/audio-lines';
	import FileText from '@lucide/svelte/icons/file-text';
	import Film from '@lucide/svelte/icons/film';
	import Image from '@lucide/svelte/icons/image';
	import { onMount } from 'svelte';
	import { nationNames } from '#lib/nation-names.ts';
	import { nationStatusLabels, readableSize, uploadKindLabels } from '#lib/uploads.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let names = $state(new Map<string, string>());
	onMount(async () => (names = await nationNames()));

	const icons = { document: FileText, picture: Image, sound: AudioLines, video: Film } as const;
	const nationName = $derived(data.nation ? (names.get(data.nation) ?? 'your nation') : 'your nation');

	function day(value: string): string {
		return new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' });
	}
</script>

<svelte:head>
	<title>Files about your nation · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<div class="wide">
	<h1>Files about {nationName}</h1>
	<p class="lead">
		Documents, pictures, recordings and videos people sent the project about {nationName}. Open one to see it and tell the project what the nation thinks. The project's reviewers read every comment before they decide where a file goes, and the people who sent the files do not see your comments.
	</p>

	{#if !data.nation}
		<p class="notice">Your access to your nation's files has been paused. Ask the lead author if you think this is a mistake.</p>
	{:else if data.uploads.length === 0}
		<p>No one has sent files about {nationName} yet.</p>
	{:else}
		<div class="table-scroll">
			<table>
				<thead>
					<tr>
						<th scope="col">File</th>
						<th scope="col">Sent</th>
						<th scope="col">Status</th>
						<th scope="col">Comments from the nation</th>
					</tr>
				</thead>
				<tbody>
					{#each data.uploads as upload (upload.reference)}
						{@const Icon = upload.kind ? icons[upload.kind] : FileText}
						<tr>
							<th scope="row">
								<a href="/workspace/nation-uploads/{upload.reference}" class="name"><Icon size={18} aria-hidden="true" /> <span>{upload.name}</span></a>
								<span class="small muted">
									{[
										upload.source === 'youtube' ? 'YouTube video' : upload.kind ? uploadKindLabels[upload.kind] : 'File',
										readableSize(upload.sizeBytes),
										upload.reference
									]
										.filter(Boolean)
										.join(' · ')}
								</span>
							</th>
							<td class="small nowrap">{day(upload.receivedAt)}</td>
							<td class="small">{nationStatusLabels[upload.status]}</td>
							<td class="small">{upload.comments === 0 ? 'None yet' : upload.comments}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.wide {
		max-width: none;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		text-align: left;
		vertical-align: top;
		padding: var(--space-2) var(--space-3) var(--space-2) 0;
		border-bottom: 1px solid var(--color-line);
	}
	thead th {
		color: var(--color-ink-muted);
		border-bottom: 2px solid var(--color-line);
	}
	.name {
		display: inline-flex;
		gap: var(--space-2);
		align-items: center;
	}
	tbody th .small {
		display: block;
		font-weight: normal;
	}
	.nowrap {
		white-space: nowrap;
	}
</style>
