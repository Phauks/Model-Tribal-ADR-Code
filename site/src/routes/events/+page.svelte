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

	const actionWords = { register: 'Register', waitlist: 'Join the waitlist', join: 'Join' } as const;

	/** The address of a view or a filter, keeping the other. */
	function link(past: boolean, mode: string | null): string {
		const query = new URLSearchParams();
		if (past) query.set('when', 'past');
		if (mode) query.set('mode', mode);
		const text = query.toString();
		return text ? `/events?${text}` : '/events';
	}
	const viewLink = (past: boolean) => link(past, data.mode);
	const modeLink = (mode: string | null) => link(data.past, mode);
</script>

<svelte:head>
	<title>{data.past ? 'Past events' : 'Events'} · Model Tribal ADR Code</title>
	<meta name="description" content="Talks, panels, workshops and gatherings about dispute resolution in Native nations." />
	<link rel="alternate" type="text/calendar" title="Model Tribal ADR Code events" href="/events/calendar.ics" />
</svelte:head>

<div class="events-page">
	<div class="title-row">
		<h1>{data.past ? 'Past events' : 'Events'}</h1>
		<a class="button button-quiet" href="/events/calendar.ics">
			<CalendarPlus size={20} strokeWidth={1.75} />
			Add all events to your calendar
		</a>
	</div>
	<nav class="event-views" aria-label="Events">
		<a href={viewLink(false)} aria-current={data.past ? undefined : 'page'}>Current and upcoming</a>
		<a href={viewLink(true)} aria-current={data.past ? 'page' : undefined}>Past</a>
	</nav>
	<nav class="filters" aria-label="Show">
		<a class="filter" href={modeLink(null)} aria-current={data.mode === null ? 'page' : undefined}>All</a>
		<a class="filter" href={modeLink('online')} aria-current={data.mode === 'online' ? 'page' : undefined}>Online</a>
		<a class="filter" href={modeLink('in-person')} aria-current={data.mode === 'in-person' ? 'page' : undefined}>In person</a>
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
			<p class="muted">{data.mode ? 'No past events of this kind.' : 'No past events yet.'}</p>
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
			<p class="muted">{data.mode ? 'No upcoming events of this kind.' : 'No events are planned right now. New events are listed here first.'}</p>
		{:else}
			{@render list(data.events, 3)}
		{/if}
	{/if}

	{#snippet list(events: typeof data.events, level: number)}
		<ol class="event-list">
			{#each events as event (event.slug)}
				<li class="event-item">
					<p class="tile" aria-hidden="true">
						<span class="tile-month">{event.tile.month}</span>
						<span class="tile-day">{event.tile.day}</span>
						<span class="tile-weekday">{event.tile.weekday}</span>
					</p>
					<div class="event-body">
						<svelte:element this={`h${level}`} class="event-title">
							{#if event.room}
								<a href={event.address} target="_blank" rel="noopener">{event.title}<span class="visually-hidden"> (opens in a new tab)</span></a>
							{:else}
								<a href={event.address}>{event.title}</a>
							{/if}
							{#if event.cancelled}<span class="cancelled-tag">Cancelled</span>{/if}
						</svelte:element>
						<p class="event-line">
							<span class="visually-hidden">{event.day}, </span><span>{event.clock}</span>
							<span>{event.where}</span>
							<span>Free</span>
						</p>
						<p class="event-chips">
							<span class="chip chip-kind">{event.kind}</span>
							{#if event.recorded}<span class="chip">{event.recorded}</span>{/if}
						</p>
						{#if event.summary}<p class="event-summary">{event.summary}</p>{/if}
					</div>
					{#if event.action || event.status}
						<div class="event-action">
							{#if event.action}
								<a
									class="button {event.action.kind === 'waitlist' ? 'button-quiet' : ''}"
									href={event.action.address}
									target={event.action.kind === 'join' ? '_blank' : undefined}
									rel={event.action.kind === 'join' ? 'noopener' : undefined}
								>
									{actionWords[event.action.kind]}<span class="visually-hidden">: {event.title}{event.action.kind === 'join' ? ' (opens in a new tab)' : ''}</span>
								</a>
							{/if}
							{#if event.status}<p class="hint">{event.status}</p>{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{/snippet}

	<p class="small muted">
		Times are in each event's own time zone. The calendar file lists every event, and your calendar program can
		subscribe to its address to keep it up to date.
	</p>
</div>

<style>
	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.title-row h1 {
		margin: 0;
	}

	.title-row .button {
		gap: var(--space-2);
	}

	.event-views {
		display: flex;
		gap: var(--space-4);
		margin: var(--space-4) 0 var(--space-3);
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

	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0 0 var(--space-4);
	}

	.filter {
		display: inline-flex;
		align-items: center;
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		color: var(--color-ink);
		text-decoration: none;
	}

	.filter[aria-current='page'] {
		border-color: var(--color-action);
		background: var(--color-notice-background);
		font-weight: var(--font-weight-semibold);
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
		margin: var(--space-3) 0 var(--space-5);
		padding: 0;
	}

	/* A date tile, the event, and its button with the seat status on the right (design/events-and-cle, "1-events-list"). */
	.event-item {
		display: grid;
		grid-template-columns: 6rem minmax(0, 1fr) auto;
		gap: var(--space-2) var(--space-4);
		align-items: start;
		padding: var(--space-4) 0;
		border-top: 1px solid var(--color-line);
	}

	.event-item:last-child {
		border-bottom: 1px solid var(--color-line);
	}

	.tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin: 0;
		padding: var(--space-2) var(--space-1);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface-raised);
		line-height: 1.2;
	}

	.tile-month {
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-action);
	}

	.tile-day {
		font-size: 1.75rem;
		font-weight: 700;
	}

	.tile-weekday {
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}

	.event-title {
		margin: 0 0 var(--space-1);
		font-size: var(--font-size-lead);
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2);
	}

	.event-line {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-4);
		margin: 0;
	}

	.event-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: var(--space-2) 0 0;
	}

	.chip-kind {
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}

	.cancelled-tag {
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-danger);
		border: 1px solid currentColor;
		border-radius: var(--radius-control);
		padding: 0 var(--space-2);
	}

	.event-summary {
		margin: var(--space-2) 0 0;
	}

	.event-action {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--space-1);
		text-align: right;
	}

	.event-action .hint {
		margin: 0;
	}

	/* Narrow: the button and status go under the event. */
	@container page (max-width: 40rem) {
		.event-item {
			grid-template-columns: 4.5rem minmax(0, 1fr);
		}

		.tile-day {
			font-size: 1.375rem;
		}

		.event-action {
			grid-column: 2;
			align-items: flex-start;
			text-align: left;
		}
	}
</style>
