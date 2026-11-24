<script lang="ts">
	// The workspace's upload queue (docs/uploads.md): files people sent,
	// oldest first, with what the checks found and who is reviewing each.
	import AudioLines from '@lucide/svelte/icons/audio-lines';
	import FileText from '@lucide/svelte/icons/file-text';
	import Film from '@lucide/svelte/icons/film';
	import Image from '@lucide/svelte/icons/image';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Upload from '@lucide/svelte/icons/upload';
	import { onMount } from 'svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import SearchableDropdown from '#lib/components/SearchableDropdown.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import { nationNames } from '#lib/nation-names.ts';
	import { readableSize, reviewerStatusLabels, uploadKindLabels, uploadKinds } from '#lib/uploads.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let names = $state(new Map<string, string>());
	onMount(async () => (names = await nationNames()));

	const icons = { document: FileText, picture: Image, sound: AudioLines, video: Film } as const;
	const views = [
		{ value: 'open', label: 'To review' },
		{ value: 'waiting', label: 'Waiting on someone' },
		{ value: 'careful-look', label: 'Needs a careful look' },
		{ value: 'decided', label: 'Decided' },
		{ value: 'not-accepted', label: 'Not accepted or withdrawn' },
		{ value: 'all', label: 'All' }
	] as const;

	function since(value: string): string {
		const hours = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 3_600_000));
		if (hours < 1) return 'Under an hour';
		if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
		return `${Math.round(hours / 24)} days`;
	}

	function address(view: string, kind: string | null, nation: string | null): string {
		const search = new URLSearchParams({ show: view });
		if (kind) search.set('kind', kind);
		if (nation) search.set('nation', nation);
		return `?${search}`;
	}

	// Who has the file, or what it waits for, as the mockup's Reviewer column shows (design/uploads, mockup 3).
	const waitingLabels: Partial<Record<string, string>> = {
		'needs-answer': 'Asked a question',
		'waiting-for-nation': 'Waiting for the nation',
		checking: 'Being checked'
	};

	const nationChoices = $derived([{ value: '', label: 'All nations' }, ...data.nations.map((nation) => ({ value: nation, label: names.get(nation) ?? nation }))]);
	const kindChoices = [{ value: '', label: 'All kinds' }, ...uploadKinds.map((kind) => ({ value: kind as string, label: uploadKindLabels[kind] }))];

	const checkLabels: Partial<Record<string, string>> = { 'careful-look': 'Needs a careful look', refused: 'Refused', passed: 'Passed' };
	const showsDecision = $derived(data.view === 'decided' || data.view === 'not-accepted' || data.view === 'all');

	// Oldest first, as the server sends them.
	const columns: TableColumn[] = [
		{ key: 'file', header: 'File', isRowHeader: true, sortable: true, searchable: true, custom: true },
		{ key: 'from', header: 'From', sortable: true, searchable: true },
		{ key: 'about', header: 'About', sortable: true, searchable: true },
		{ key: 'checks', header: 'Checks', sortable: true, custom: true },
		{ key: 'waiting', header: 'Waiting', sortable: true },
		{ key: 'reviewer', header: 'Reviewer', sortable: true, custom: true }
	];
	const rows: TableRow[] = $derived(
		data.uploads.map((upload) => ({
			key: upload.reference,
			cells: {
				file: { text: upload.name, href: `/workspace/uploads/${upload.reference}` },
				from: { text: upload.senderName ?? upload.senderEmail ?? 'Account deleted' },
				about: { text: upload.nations.length > 0 ? upload.nations.map((id) => names.get(id) ?? id).join(', ') : 'No nation named' },
				checks: { text: checkLabels[upload.checkResult ?? ''] ?? '' },
				// Longest waiting first when sorted down: the oldest file.
				waiting: { text: since(upload.receivedAt), sortValue: -new Date(upload.receivedAt).getTime() },
				reviewer: {
					text: [upload.reviewerName ?? waitingLabels[upload.status] ?? 'None', showsDecision ? reviewerStatusLabels[upload.status] : ''].filter(Boolean).join(', ')
				}
			}
		}))
	);
	const uploadsByReference = $derived(new Map(data.uploads.map((upload) => [upload.reference, upload])));
</script>

<svelte:head>
	<title>Uploads · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<div class="wide">
	<h1>Uploads</h1>
	<p class="lead">Files people have sent. Check each one, then file it where it belongs or say why it was not used.</p>
	<p><a class="button button-quiet with-icon" href="/workspace/intake"><Upload size={18} aria-hidden="true" /> Intake</a></p>

	<div class="filter-row">
		<nav class="filters" aria-label="Show">
			{#each views as view (view.value)}
				<a
					class="button button-quiet"
					class:pressed={data.view === view.value}
					aria-current={data.view === view.value ? 'page' : undefined}
					href={address(view.value, data.kind, data.nation)}
				>
					{view.label} ({data.counts[view.value]})
				</a>
			{/each}
		</nav>
		<!-- A pick sends the form, so the filter applies at once; without scripts, Show sends it. -->
		<form class="kind-filter" method="get" onchange={(event) => event.currentTarget.requestSubmit()}>
			<input type="hidden" name="show" value={data.view} />
			<SearchableDropdown label="Nation" name="nation" choices={nationChoices} value={data.nation ?? ''} />
			<Dropdown label="Kind" name="kind" choices={kindChoices} value={data.kind ?? ''} />
			<noscript><button class="button button-quiet" type="submit">Show</button></noscript>
		</form>
	</div>

	{#if data.uploads.length === 0}
		<p>Nothing here.</p>
	{:else}
		<DataTable identifier="uploads" label="Table: uploads" {columns} {rows} rowName={['file', 'files']}>
			{#snippet cell(row, column)}
				{@const upload = uploadsByReference.get(row.key)}
				{#if !upload}
					<!-- Every row is an upload. -->
				{:else if column.key === 'file'}
					{@const Icon = upload.kind ? icons[upload.kind] : FileText}
					<a href="/workspace/uploads/{upload.reference}" class="name"><Icon size={18} aria-hidden="true" /> <span>{upload.name}</span></a>
					<span class="small muted file-details">
						{[
							upload.source === 'youtube' ? 'YouTube video' : upload.kind ? uploadKindLabels[upload.kind] : 'File',
							readableSize(upload.sizeBytes),
							upload.reference
						]
							.filter(Boolean)
							.join(' · ')}
					</span>
				{:else if column.key === 'checks'}
					{#if upload.checkResult === 'careful-look'}
						<span class="warn"><ShieldAlert size={16} aria-hidden="true" /> Needs a careful look</span>
					{:else if upload.checkResult === 'refused'}
						<span class="warn"><ShieldAlert size={16} aria-hidden="true" /> Refused</span>
					{:else if upload.checkResult === 'passed'}
						<span class="ok"><ShieldCheck size={16} aria-hidden="true" /> Passed</span>
					{/if}
				{:else}
					{upload.reviewerName ?? waitingLabels[upload.status] ?? 'None'}
					{#if showsDecision}
						<br /><span class="muted">{reviewerStatusLabels[upload.status]}</span>
					{/if}
				{/if}
			{/snippet}
		</DataTable>
	{/if}
	{#if data.deleted > 0}
		<p class="small muted">{data.deleted} declined or unfinished file{data.deleted === 1 ? ' was' : 's were'} removed from storage just now, as planned.</p>
	{/if}
</div>

<style>
	.wide {
		max-width: none;
	}
	.filter-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
		margin-bottom: var(--space-4);
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.with-icon {
		gap: var(--space-2);
	}
	.pressed {
		background: var(--color-surface);
		border-color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}
	.kind-filter {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
	}
	.kind-filter :global(.dropdown) {
		margin: 0;
	}
	.name {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		font-weight: var(--font-weight-semibold);
		overflow-wrap: anywhere;
	}
	.file-details {
		display: block;
		font-weight: normal;
	}
	.ok,
	.warn {
		display: flex;
		gap: var(--space-1);
		align-items: flex-start;
	}
	.ok :global(svg) {
		color: var(--color-link);
		flex: none;
	}
	.warn {
		color: var(--color-action);
		font-weight: var(--font-weight-semibold);
	}
	.warn :global(svg) {
		flex: none;
	}
</style>
