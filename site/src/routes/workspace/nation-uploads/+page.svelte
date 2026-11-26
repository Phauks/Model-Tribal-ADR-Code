<script lang="ts">
	// Files people sent about the nation reviewer's nation (docs/uploads.md,
	// "Comments from the nation"). The nation reads them and comments; the
	// project's reviewers decide where each one goes.
	import AudioLines from '@lucide/svelte/icons/audio-lines';
	import FileText from '@lucide/svelte/icons/file-text';
	import Film from '@lucide/svelte/icons/film';
	import Image from '@lucide/svelte/icons/image';
	import { onMount } from 'svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import { nationNames } from '#lib/nation-names.ts';
	import { nationStatusLabels, readableSize, uploadKindLabels } from '#lib/uploads.ts';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';
	import { mediumDate } from '#lib/readable-date.ts';

	let { data }: PageProps = $props();

	let names = $state(new Map<string, string>());
	onMount(async () => (names = await nationNames()));

	const icons = { document: FileText, picture: Image, sound: AudioLines, video: Film } as const;
	const nationName = $derived(data.nation ? (names.get(data.nation) ?? 'your nation') : 'your nation');

	const columns: TableColumn[] = [
		{ key: 'file', header: 'File', isRowHeader: true, sortable: true, custom: true },
		{ key: 'sent', header: 'Sent', type: 'date', sortable: true },
		{ key: 'status', header: 'Status', sortable: true },
		{ key: 'comments', header: 'Comments from the nation', sortable: true }
	];
	const uploadsByKey = $derived(new Map(data.uploads.map((upload) => [upload.reference, upload])));
	const rows: TableRow[] = $derived(
		data.uploads.map((upload) => ({
			key: upload.reference,
			cells: {
				file: { text: `${upload.name} ${upload.reference}`, sortValue: upload.name, href: `/workspace/nation-uploads/${upload.reference}` },
				sent: { text: mediumDate(upload.receivedAt), sortValue: upload.receivedAt },
				status: { text: nationStatusLabels[upload.status] },
				comments: { text: upload.comments === 0 ? 'None yet' : String(upload.comments), sortValue: upload.comments }
			}
		}))
	);

	function details(upload: (typeof data.uploads)[number]): string {
		return [upload.source === 'youtube' ? 'YouTube video' : upload.kind ? uploadKindLabels[upload.kind] : 'File', readableSize(upload.sizeBytes), upload.reference]
			.filter(Boolean)
			.join(' · ');
	}
</script>

{#snippet cell(row: TableRow)}
	{@const upload = uploadsByKey.get(row.key)}
	{#if upload}
		{@const Icon = upload.kind ? icons[upload.kind] : FileText}
		<a href="/workspace/nation-uploads/{upload.reference}" class="name"><Icon size={18} aria-hidden="true" /> <span>{upload.name}</span></a>
		<span class="small muted details">{details(upload)}</span>
	{/if}
{/snippet}

<svelte:head>
	<title>Files about your nation · Workspace · Tribal Law Project</title>
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
		<DataTable
			identifier="nation-uploads"
			label="Table: files about {nationName}"
			{columns}
			{rows}
			defaultSort={{ key: 'sent', direction: 'descending' }}
			rowName={['file', 'files']}
			{cell}
		/>
	{/if}
</div>

<style>
	.wide {
		max-width: none;
	}
	.name {
		display: inline-flex;
		gap: var(--space-2);
		align-items: center;
	}
	.details {
		display: block;
		font-weight: normal;
	}
</style>
