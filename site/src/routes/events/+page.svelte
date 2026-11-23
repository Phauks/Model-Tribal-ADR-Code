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
	<p class="lead">
		Talks, panels, workshops and gatherings about dispute resolution in Native nations. Each event's page says where it
		is, how to take part and how to register.
	</p>

	<nav class="event-views" aria-label="Events">
		<a href="/events" aria-current={data.past ? undefined : 'page'}>Upcoming</a>
		<a href="/events?when=past" aria-current={data.past ? 'page' : undefined}>Past</a>
		<a href="/rooms">Open video rooms</a>
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

	{#if data.events.length === 0}
		<p class="muted">
			{data.past ? 'No past events yet.' : 'No events are planned right now. New events are listed here first.'}
		</p>
	{:else}
		<ol class="event-list">
			{#each data.events as event (event.slug)}
				<li class="event-item">
					<p class="event-day">{event.day}</p>
					<h2 class="event-title">
						<a href="/events/{event.slug}">{event.title}</a>
						{#if event.cancelled}<span class="cancelled-tag">Cancelled</span>{/if}
					</h2>
					<p class="event-detail"><span class="chip">{event.kind}</span> {event.where}</p>
					<p class="hint event-detail">{event.when}</p>
					{#if event.summary}<p class="event-summary">{event.summary}</p>{/if}
				</li>
			{/each}
		</ol>
	{/if}

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
