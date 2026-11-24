<script lang="ts">
	/**
	 * A room's recordings, with the buttons to hide or show each, and the log
	 * of who was let in and what each was told about recording. For the hosts,
	 * in the workspace. The page's form actions are hideRecording and
	 * showRecording.
	 */
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';

	interface Props {
		recordings: { identifier: string; when: string; length: string; status: string; address: string | null; hidden: boolean }[];
		visitors: { name: string; role: string; how: string; told: string; toldAt: string }[];
		/** The heading level of the two sections. */
		level?: 2 | 3;
	}

	let { recordings, visitors, level = 3 }: Props = $props();

	const identifier = $props.id();

	// The times come formatted, so the tables keep the order they are given in rather than sorting by them.
	const recordingColumns: TableColumn[] = [
		{ key: 'started', header: 'Started', isRowHeader: true, custom: true },
		{ key: 'length', header: 'Length', sortable: true },
		{ key: 'status', header: 'Status', sortable: true },
		{ key: 'shown', header: 'Shown', sortable: true, custom: true }
	];
	const recordingRows: TableRow[] = $derived(
		recordings.map((recording) => ({
			key: recording.identifier,
			cells: {
				started: { text: recording.when || 'Recording', href: recording.address ?? undefined },
				length: { text: recording.length },
				status: { text: recording.status },
				shown: { text: recording.hidden ? 'Hidden' : 'Shown' }
			}
		}))
	);
	const recordingsByKey = $derived(new Map(recordings.map((recording) => [recording.identifier, recording])));

	const visitorColumns: TableColumn[] = [
		{ key: 'name', header: 'Name', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'role', header: 'Joined as', sortable: true },
		{ key: 'how', header: 'How', sortable: true },
		{ key: 'told', header: 'Told', sortable: true },
		{ key: 'when', header: 'When' }
	];
	const visitorRows: TableRow[] = $derived(
		visitors.map((visitor, index) => ({
			key: String(index),
			cells: {
				name: { text: visitor.name },
				role: { text: visitor.role },
				how: { text: visitor.how },
				told: { text: visitor.told },
				when: { text: visitor.toldAt }
			}
		}))
	);
</script>

<svelte:element this={`h${level}`}>Recordings</svelte:element>
{#if recordings.length === 0}
	<p class="muted">No recordings yet. A recording is copied into the project’s private storage within about 15 minutes of ending, then checked for viruses before anyone can watch it.</p>
{:else}
	<DataTable
		identifier="{identifier}-recordings"
		label="Table: recordings"
		columns={recordingColumns}
		rows={recordingRows}
		rowName={['recording', 'recordings']}
		download="recordings"
	>
		{#snippet cell(row, column)}
			{@const recording = recordingsByKey.get(row.key)}
			{#if recording && column.key === 'started'}
				{#if recording.address}<a href={recording.address}>{recording.when || 'Recording'}</a>{:else}{recording.when}{/if}
			{:else if recording}
				<form method="post" action={recording.hidden ? '?/showRecording' : '?/hideRecording'}>
					<input type="hidden" name="recording" value={recording.identifier} />
					<button class="button button-quiet" type="submit">{recording.hidden ? 'Show it' : 'Hide it'}</button>
				</form>
			{/if}
		{/snippet}
	</DataTable>
{/if}
<svelte:element this={`h${level}`}>Who was told about recording</svelte:element>
{#if visitors.length === 0}
	<p class="muted">Nobody has joined the room yet.</p>
{:else}
	<p class="hint">Each person, and what they were told the last time they joined.</p>
	<DataTable
		identifier="{identifier}-visitors"
		label="Table: who was told about recording"
		columns={visitorColumns}
		rows={visitorRows}
		rowName={['person', 'people']}
		download="told-about-recording"
	/>
{/if}
