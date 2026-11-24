<script lang="ts">
	// Intake (docs/uploads.md, "Intake"): files for the research library. No
	// questions; the intake run matches each to its pull-list item by its
	// contents and files the rest by topic. A note goes with chosen files
	// through the table's pencil button (design/upload-table, mockup 1).
	import { invalidateAll } from '$app/navigation';
	import FileSender from '#lib/components/FileSender.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Intake · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<div class="intake-page">
	<h1>Intake</h1>
	<p class="lead">Files for the research library. Pull-list items are matched by contents; everything else is filed by topic.</p>

	<FileSender
		extra={() => ({ pulled: true })}
		finished={() => void invalidateAll()}
		notes
		earlier={data.earlier}
		refresh={invalidateAll}
		filedColumn
	/>
</div>

<style>
	.intake-page {
		max-width: 72rem;
		min-width: 0;
	}
</style>
