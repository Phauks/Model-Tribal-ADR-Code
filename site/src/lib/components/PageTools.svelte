<!--
	@component
	Print and Download for the page a reader is on. They sit on the page,
	under its title, not in the masthead, because they act on this page and
	not on the whole site (Trevor, Nov. 22, 2026). Print opens the "Print this
	page" dialog (PrintOptions.svelte). Each download is a file built with
	the site, so it also works offline once the page is saved. The whole
	book and data exports stay on the Downloads page.

	Use:
	<PageTools downloads={[{ label: 'Download this record', format: 'JSON', link: '/nations/x/record.json' }]} />
-->
<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import PrintOptions from './PrintOptions.svelte';

	interface PageDownload {
		/** What the file holds, starting with a verb, such as "Download this list". */
		label: string;
		/** The file format, such as "CSV" or "JSON". */
		format: string;
		link: string;
	}

	let { downloads = [] }: { downloads?: PageDownload[] } = $props();
</script>

<div class="page-tools no-print">
	<PrintOptions />
	{#each downloads as file (file.link)}
		<a class="button button-quiet" href={file.link} download>
			<Download size={20} strokeWidth={1.75} />
			<span>{file.label} <span class="muted small">({file.format})</span></span>
		</a>
	{/each}
</div>

<style>
	.page-tools {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-3);
		margin: var(--space-3) 0 var(--space-5);
	}

	.page-tools > :global(.button) {
		gap: var(--space-2);
		padding: 0 var(--space-3);
		border-width: 1px;
	}
</style>
