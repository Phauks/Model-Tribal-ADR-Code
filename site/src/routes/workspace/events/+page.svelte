<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import DataTable from '#lib/components/DataTable.svelte';
	import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// In the order the server gives them.
	const columns: TableColumn[] = [
		{ key: 'event', header: 'Event', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'when', header: 'When', type: 'date', sortable: true },
		{ key: 'status', header: 'Status', sortable: true, filterable: true },
		{ key: 'registered', header: 'Registered', type: 'number', sortable: true },
		{ key: 'waiting', header: 'Waitlist', type: 'number', sortable: true }
	];
	const rows: TableRow[] = $derived(
		data.events.map((event) => ({
			key: event.identifier,
			cells: {
				event: { text: event.title, href: `/workspace/events/${event.identifier}` },
				when: { text: event.when, sortValue: event.startsAt },
				status: { text: event.over ? `${event.status}, over` : event.status },
				registered: { text: String(event.registered), sortValue: event.registered },
				waiting: { text: String(event.waiting), sortValue: event.waiting }
			}
		}))
	);
</script>

<svelte:head>
	<title>Events · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<h1>Events</h1>
<p>
	Events listed at <a href="/events">Events</a>. A new event starts as a draft that only the lead author and editors
	can see; publish it when it is ready. People sign in to register, and get a confirmation and reminders by email once
	the site can send email.
</p>
<p>
	<a class="button" href="/workspace/events/new"><Plus size={20} strokeWidth={1.75} /> Add an event</a>
</p>

{#if data.events.length === 0}
	<p class="muted">No events yet.</p>
{:else}
	<DataTable identifier="events" label="Table: events" {columns} {rows} rowName={['event', 'events']} filters />
{/if}

<style>
	.button {
		gap: var(--space-2);
	}
</style>
