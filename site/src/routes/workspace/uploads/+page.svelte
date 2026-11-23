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

	function address(view: string, kind: string | null): string {
		const search = new URLSearchParams({ show: view });
		if (kind) search.set('kind', kind);
		return `?${search}`;
	}
</script>

<svelte:head>
	<title>Uploads · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<div class="wide">
	<h1>Uploads</h1>
	<p class="lead">Files people have sent. Check each one, then file it where it belongs or say why it was not used.</p>
	<p><a class="button button-quiet" href="/workspace/intake"><Upload size={18} aria-hidden="true" /> Intake</a></p>

	<nav class="filters" aria-label="Show">
		{#each views as view (view.value)}
			<a
				class="button button-quiet"
				class:pressed={data.view === view.value}
				aria-current={data.view === view.value ? 'page' : undefined}
				href={address(view.value, data.kind)}
			>
				{view.label} ({data.counts[view.value]})
			</a>
		{/each}
	</nav>
	<form class="kind-filter" method="get">
		<input type="hidden" name="show" value={data.view} />
		<label class="small">
			Kind
			<select name="kind" onchange={(event) => event.currentTarget.form?.requestSubmit()}>
				<option value="">All kinds</option>
				{#each uploadKinds as kind (kind)}
					<option value={kind} selected={data.kind === kind}>{uploadKindLabels[kind]}</option>
				{/each}
			</select>
		</label>
		<noscript><button class="button button-quiet" type="submit">Show</button></noscript>
	</form>

	{#if data.uploads.length === 0}
		<p>Nothing here.</p>
	{:else}
		<div class="table-scroll">
			<table class="queue">
				<thead>
					<tr>
						<th scope="col">File</th>
						<th scope="col">From</th>
						<th scope="col">About</th>
						<th scope="col">Checks</th>
						<th scope="col">Waiting</th>
						<th scope="col">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each data.uploads as upload (upload.reference)}
						{@const Icon = upload.kind ? icons[upload.kind] : FileText}
						<tr>
							<th scope="row">
								<a href="/workspace/uploads/{upload.reference}" class="name"><Icon size={18} aria-hidden="true" /> <span>{upload.name}</span></a>
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
							<td class="small">{upload.senderName ?? upload.senderEmail ?? 'Account deleted'}</td>
							<td class="small">{upload.nations.length > 0 ? upload.nations.map((id) => names.get(id) ?? id).join(', ') : 'No nation named'}</td>
							<td class="small">
								{#if upload.checkResult === 'careful-look'}
									<span class="warn"><ShieldAlert size={16} aria-hidden="true" /> Needs a careful look</span>
								{:else if upload.checkResult === 'refused'}
									<span class="warn"><ShieldAlert size={16} aria-hidden="true" /> Refused</span>
								{:else if upload.checkResult === 'passed'}
									<span class="ok"><ShieldCheck size={16} aria-hidden="true" /> Passed</span>
								{/if}
							</td>
							<td class="small nowrap">{since(upload.receivedAt)}</td>
							<td class="small">
								{reviewerStatusLabels[upload.status]}{#if upload.reviewerName}<br /><span class="muted">{upload.reviewerName}</span>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	{#if data.deleted > 0}
		<p class="small muted">{data.deleted} declined or unfinished file{data.deleted === 1 ? ' was' : 's were'} removed from storage just now, as planned.</p>
	{/if}
</div>

<style>
	.wide {
		max-width: 72rem;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}
	.pressed {
		background: var(--color-surface);
		border-color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}
	.kind-filter {
		margin-bottom: var(--space-4);
	}
	.kind-filter label {
		display: inline-flex;
		gap: var(--space-2);
		align-items: center;
	}
	.table-scroll {
		overflow-x: auto;
	}
	.queue {
		width: 100%;
		border-collapse: collapse;
	}
	.queue thead th {
		text-align: left;
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
		border-bottom: 2px solid var(--color-line);
		padding: var(--space-2);
	}
	.queue td,
	.queue tbody th {
		text-align: left;
		font-weight: normal;
		vertical-align: top;
		padding: var(--space-3) var(--space-2);
		border-bottom: 1px solid var(--color-line);
	}
	.name {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		font-weight: var(--font-weight-semibold);
		overflow-wrap: anywhere;
	}
	th > .small.muted {
		display: block;
	}
	.nowrap {
		white-space: nowrap;
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
