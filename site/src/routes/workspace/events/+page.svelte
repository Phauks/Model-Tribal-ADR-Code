<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
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
	<div class="table-scroll">
		<table>
			<thead>
				<tr><th scope="col">Event</th><th scope="col">When</th><th scope="col">Status</th><th scope="col">Registered</th><th scope="col">Waitlist</th></tr>
			</thead>
			<tbody>
				{#each data.events as event (event.identifier)}
					<tr>
						<td><a href="/workspace/events/{event.identifier}">{event.title}</a></td>
						<td>{event.when}</td>
						<td>{event.over ? `${event.status}, over` : event.status}</td>
						<td>{event.registered}</td>
						<td>{event.waiting}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.button {
		gap: var(--space-2);
	}
</style>
