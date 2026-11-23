<script lang="ts">
	// The list of events (site/COLLABORATION.md, "Events").
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const statusWords: Record<string, string> = {
		registered: 'You are registered',
		waitlisted: 'You are on the waitlist',
		offered: 'A seat is held for you'
	};
</script>

<svelte:head>
	<title>{data.past ? 'Past events' : 'Events'} · Model Tribal ADR Code</title>
	<meta name="description" content="Talks, panels, workshops and gatherings about dispute resolution in Native nations." />
	<link rel="alternate" type="text/calendar" title="Model Tribal ADR Code events" href="/events/calendar.ics" />
</svelte:head>

<div class="reading">
	<h1>{data.past ? 'Past events' : 'Events'}</h1>
	<nav class="event-views" aria-label="Events">
		<a href="/events" aria-current={data.past ? undefined : 'page'}>Current and upcoming</a>
		<a href="/events?when=past" aria-current={data.past ? 'page' : undefined}>Past</a>
	</nav>

	{#if data.yours.length > 0}
		<section class="panel panel-filled" aria-labelledby="your-events">
			<h2 id="your-events">Your events</h2>
			<ul class="your-list">
				{#each data.yours as item (item.slug)}
					<li>
						<a href="/events/{item.slug}">{item.title}</a>
						<span class="hint">
							{item.cancelled ? 'Cancelled' : `${statusWords[item.status] ?? ''} (${item.ticketName})`} · {item.when}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.past}
		{#if data.events.length === 0}
			<p class="muted">No past events yet.</p>
		{:else}
			{@render list(data.events, 2)}
		{/if}
	{:else}
		{#if data.current.length > 0}
			<h2>Current events</h2>
			{@render list(data.current, 3)}
		{/if}
		<h2>Upcoming events</h2>
		{#if data.events.length === 0}
			<p class="muted">No events are planned right now. New events are listed here first.</p>
		{:else}
			{@render list(data.events, 3)}
		{/if}
	{/if}

	{#snippet list(events: typeof data.events, level: number)}
		<ol class="event-list">
			{#each events as event (event.slug)}
				<li class="event-item">
					<p class="event-day">{event.day}</p>
					<svelte:element this={`h${level}`} class="event-title">
						{#if event.room}
							<a href={event.address} target="_blank" rel="noopener">{event.title}<span class="visually-hidden"> (opens in a new tab)</span></a>
						{:else}
							<a href={event.address}>{event.title}</a>
						{/if}
						{#if event.cancelled}<span class="cancelled-tag">Cancelled</span>{/if}
					</svelte:element>
					<p class="event-detail"><span class="chip">{event.kind}</span> {event.where}</p>
					<p class="hint event-detail">{event.when}</p>
					{#if event.summary}<p class="event-summary">{event.summary}</p>{/if}
				</li>
			{/each}
		</ol>
	{/snippet}

	<p class="calendar-feed">
		<a class="button button-quiet" href="/events/calendar.ics">
			<CalendarPlus size={20} strokeWidth={1.75} />
			Add all events to your calendar
		</a>
	</p>
	<p class="small muted">
		The calendar file lists every event, and your calendar program can subscribe to its address to keep it up to date.
		To register, open the event's page.
	</p>
</div>

<style>
	.event-views {
		display: flex;
		gap: var(--space-4);
		margin: var(--space-4) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.event-views a {
		display: inline-block;
		padding: var(--space-2) 0;
		text-decoration: none;
		color: var(--color-ink-muted);
		border-bottom: 3px solid transparent;
	}

	.event-views a[aria-current='page'] {
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
		border-bottom-color: var(--color-action);
	}

	.your-list {
		margin: 0;
		padding-left: var(--space-4);
	}

	.your-list li {
		margin: var(--space-2) 0;
	}

	.your-list .hint {
		display: block;
		margin: 0;
	}

	.event-list {
		list-style: none;
		margin: var(--space-4) 0;
		padding: 0;
	}

	.event-item {
		padding: var(--space-4) 0;
		border-top: 1px solid var(--color-line);
	}

	.event-item:last-child {
		border-bottom: 1px solid var(--color-line);
	}

	.event-day {
		margin: 0;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink-muted);
	}

	.event-title {
		margin: var(--space-1) 0;
		font-size: var(--font-size-lead);
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2);
	}

	.cancelled-tag {
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-danger);
		border: 1px solid currentColor;
		border-radius: var(--radius-control);
		padding: 0 var(--space-2);
	}

	.event-detail {
		margin: var(--space-1) 0 0;
	}

	.event-summary {
		margin: var(--space-2) 0 0;
	}

	.calendar-feed .button {
		gap: var(--space-2);
	}
</style>
