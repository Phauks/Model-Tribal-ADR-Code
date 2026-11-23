<script lang="ts">
	// Intake (docs/uploads.md, "Intake"): files for the research library. No
	// questions; the intake run matches each to its pull-list item by its
	// contents and files the rest by topic.
	import { invalidateAll } from '$app/navigation';
	import FileSender from '#lib/components/FileSender.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let note = $state('');
</script>

<svelte:head>
	<title>Intake · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<div class="intake-page">
	<h1>Intake</h1>
	<p class="lead">Files for the research library. Pull-list items are matched by contents; everything else is filed by topic.</p>

	<div class="field note">
		<label for="note">Note</label>
		<p class="hint">Optional. Goes with the files you send next, such as items you could not get.</p>
		<textarea id="note" rows="2" bind:value={note}></textarea>
	</div>

	<FileSender
		extra={() => ({ pulled: true, note })}
		finished={() => {
			note = '';
			void invalidateAll();
		}}
		earlier={data.earlier}
		filedColumn
	/>
</div>

<style>
	.intake-page {
		max-width: 72rem;
		min-width: 0;
	}
	.note {
		max-width: 40rem;
	}
</style>
