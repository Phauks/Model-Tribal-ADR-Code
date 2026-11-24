<script lang="ts">
	// The download button on a chart's or a data table's control row
	// (site/DESIGN.md, section 6, "Tables"). Trevor asked on Nov. 23, 2026
	// that it offer both .csv and Excel, so a download icon opens a short
	// list of the two extensions. Both files hold the rows shown, laid out
	// alike (`downloadCells` in src/lib/tables/table-definition.ts); the
	// .xlsx is written in the browser (src/lib/spreadsheet.ts), which is
	// loaded only when asked for. Where a file is published at an address
	// and nothing is left out, the link goes to that file.
	//
	// The list is a <details> element, so it opens without scripts too, and
	// then its links go to the published files. Escape closes it and a click
	// elsewhere closes it.
	import { datedName } from '#lib/download-names.ts';
	import { rowsToCsv, type TableColumn, type TableRow } from '#lib/tables/table-definition.ts';
	import Download from '@lucide/svelte/icons/download';

	let {
		name,
		title = name,
		table,
		csvHref,
		xlsxHref,
		published = true,
		interactive = true,
		label = 'Download the rows shown'
	}: {
		/** The file name, without its extension. */
		name: string;
		/** The sheet's name in the .xlsx file. */
		title?: string;
		/** The columns and the rows shown, read when a file is asked for. */
		table: () => { columns: TableColumn[]; rows: TableRow[] };
		/** Published copies, used while `published` is true. */
		csvHref?: string;
		xlsxHref?: string;
		/** False when the rows shown differ from the published files, such as when rows are left out. */
		published?: boolean;
		/** False before scripts run: only published files are offered. */
		interactive?: boolean;
		label?: string;
	} = $props();

	let details: HTMLDetailsElement | undefined = $state();

	// The rows shown, saved with the day they were saved, as nations-2026-11-23.csv (src/lib/download-names.ts).
	const savedName = (extension: string) => datedName(`${name}.${extension}`, new Date());

	function save(contents: BlobPart, type: string, extension: string) {
		const address = URL.createObjectURL(new Blob([contents], { type }));
		const link = document.createElement('a');
		link.href = address;
		link.download = savedName(extension);
		link.click();
		setTimeout(() => URL.revokeObjectURL(address), 0);
	}

	function close() {
		if (details) details.open = false;
	}

	function saveCsv(event: MouseEvent) {
		close();
		if (csvHref && published) return;
		event.preventDefault();
		const { columns, rows } = table();
		save(rowsToCsv(columns, rows, location.origin), 'text/csv;charset=utf-8', 'csv');
	}

	async function saveSpreadsheet(event: MouseEvent) {
		close();
		if (xlsxHref && published) return;
		event.preventDefault();
		const { rowsToSpreadsheet, spreadsheetType } = await import('#lib/spreadsheet.ts');
		const { columns, rows } = table();
		save(rowsToSpreadsheet(columns, rows, location.origin, title) as Uint8Array<ArrayBuffer>, spreadsheetType, 'xlsx');
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && details?.open) {
			details.open = false;
			details.querySelector('summary')?.focus();
		}
	}

	function onWindowClick(event: MouseEvent) {
		if (details?.open && !details.contains(event.target as Node)) details.open = false;
	}
</script>

<svelte:window onclick={onWindowClick} />

{#if interactive || csvHref || xlsxHref}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<details class="table-download no-print" bind:this={details} onkeydown={onKeydown}>
		<summary aria-label="Download" title={label}>
			<Download aria-hidden="true" size="1.25em" strokeWidth={1.75} />
		</summary>
		<ul class="download-list">
			{#if interactive || csvHref}
				<li><a href={csvHref ?? '#'} download={savedName('csv')} title="{label} as a .csv file" onclick={saveCsv}>.csv</a></li>
			{/if}
			{#if interactive || xlsxHref}
				<li><a href={xlsxHref ?? '#'} download={savedName('xlsx')} title="{label} as an Excel workbook (.xlsx)" onclick={saveSpreadsheet}>.xlsx</a></li>
			{/if}
		</ul>
	</details>
{/if}

<style>
	.table-download {
		position: relative;
	}

	summary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--layout-target-minimum);
		min-height: var(--layout-target-minimum);
		border-radius: var(--radius-control);
		color: var(--color-ink-muted);
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary:hover,
	.table-download[open] summary {
		color: var(--color-ink);
		background: var(--color-surface);
	}

	.download-list {
		position: absolute;
		right: 0;
		top: calc(100% + var(--space-1));
		z-index: 20;
		min-width: 7rem;
		margin: 0;
		padding: var(--space-1) 0;
		list-style: none;
		background: var(--color-surface-raised);
		color: var(--color-ink);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		box-shadow: 0 var(--space-1) var(--space-3) color-mix(in srgb, var(--color-ink) 20%, transparent);
	}

	.download-list a {
		display: flex;
		align-items: center;
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
	}

	.download-list a:hover,
	.download-list a:focus-visible {
		background: var(--color-surface);
		text-decoration: underline;
	}
</style>
