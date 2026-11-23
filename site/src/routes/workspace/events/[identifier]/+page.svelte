<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import Download from '@lucide/svelte/icons/download';
	import EventFields from '#lib/components/EventFields.svelte';
	import { attendanceKinds, attendanceLabels } from '#lib/event-calendar.ts';
	import RoomRecords from '#lib/components/RoomRecords.svelte';
	import { eventRecordingWatchers, recordingWatcherLabels, roomStyleLabels, roomStyles } from '#lib/video-rooms.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const values = $derived(form && 'values' in form && form.values ? form.values : data.values);
	const field = $derived(form && 'field' in form ? form.field : undefined);
	const problem = $derived(form && 'problem' in form ? form.problem : undefined);
	const live = $derived(data.registrations.filter((registration) => registration.live));
</script>

<svelte:head>
	<title>{data.event.title} · Events · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Workspace', href: '/workspace' },
		{ label: 'Events', href: '/workspace/events' }
	]}
/>
<h1>{data.event.title}</h1>
<p>
	<span class="chip">{data.event.status === 'draft' ? 'Draft' : data.event.status === 'published' ? 'Published' : 'Cancelled'}</span>
	{data.event.when}
</p>
<p><a href="/events/{data.event.slug}">{data.event.status === 'draft' ? 'Preview the event page' : 'Open the event page'}</a></p>

{#if data.added}
	<div class="notice" role="status"><p>Draft saved. Add the kinds of seat and the speakers below, then publish it.</p></div>
{/if}
{#if form && 'done' in form}
	<div class="notice" role="status"><p>{form.done}</p></div>
{:else if problem && !field}
	<div class="notice notice-problem" role="alert"><p>{problem}</p></div>
{/if}
{#if !data.emailReady}
	<div class="notice" role="note">
		<p>
			The site cannot send email yet, so nobody gets a confirmation, reminder or offer by email. People see where they
			stand on the event's page. Emails start once the project's domain is set up.
		</p>
	</div>
{/if}

<h2>Publishing</h2>
{#if data.event.status === 'draft'}
	<form method="post" action="?/publish"><button class="button" type="submit">Publish</button></form>
	<form method="post" action="?/delete" class="spaced"><button class="button button-quiet" type="submit">Delete this draft</button></form>
{:else if data.event.status === 'published'}
	{#if data.registrations.length === 0}
		<form method="post" action="?/unpublish"><button class="button button-quiet" type="submit">Back to a draft</button></form>
	{/if}
	<form method="post" action="?/cancel" class="spaced">
		<div class="field">
			<label for="cancel-note">Why it is cancelled (optional)</label>
			<p class="hint" id="cancel-hint">Shown on the event's page and in the email to everyone signed up.</p>
			<textarea id="cancel-note" name="cancel-note" rows="2" maxlength="1000" aria-describedby="cancel-hint"></textarea>
		</div>
		<button class="button button-quiet" type="submit">Cancel the event</button>
	</form>
{:else}
	<p>This event is cancelled{data.event.cancelNote ? `: ${data.event.cancelNote}` : '.'}</p>
{/if}

<h2>Seats</h2>
<p>
	Each kind of seat has its own limit and waitlist. Leave the limit empty for no limit. An event with no seats takes no
	registration, and its online link is shown to everyone.
</p>
{#each data.tickets as ticket (ticket.identifier)}
	<form method="post" action="?/saveTicket" class="row-form">
		<input type="hidden" name="ticket" value={ticket.identifier} />
		<div class="field">
			<label for="ticket-name-{ticket.identifier}">Name</label>
			<input type="text" id="ticket-name-{ticket.identifier}" name="name" maxlength="100" value={ticket.name} required />
		</div>
		<div class="field">
			<label for="ticket-attendance-{ticket.identifier}">Taking part</label>
			<select id="ticket-attendance-{ticket.identifier}" name="attendance">
				{#each attendanceKinds as kind (kind)}<option value={kind} selected={ticket.attendance === kind}>{attendanceLabels[kind]}</option>{/each}
			</select>
		</div>
		<div class="field">
			<label for="ticket-capacity-{ticket.identifier}">Limit</label>
			<input type="text" inputmode="numeric" class="number" id="ticket-capacity-{ticket.identifier}" name="capacity" value={ticket.capacity ?? ''} />
		</div>
		<input type="hidden" name="sort-order" value={ticket.sortOrder} />
		<p class="hint counts">{ticket.taken} taken{ticket.waiting > 0 ? `, ${ticket.waiting} waiting` : ''}</p>
		<button class="button button-quiet" type="submit">Save<span class="visually-hidden"> {ticket.name}</span></button>
	</form>
	{#if ticket.everRegistered === 0}
		<form method="post" action="?/removeTicket" class="remove">
			<input type="hidden" name="ticket" value={ticket.identifier} />
			<button class="button button-quiet" type="submit">Remove<span class="visually-hidden"> {ticket.name}</span></button>
		</form>
	{/if}
{/each}
<form method="post" action="?/saveTicket" class="row-form add">
	<div class="field">
		<label for="new-ticket-name">New kind of seat</label>
		<input type="text" id="new-ticket-name" name="name" maxlength="100" placeholder="In person" required />
	</div>
	<div class="field">
		<label for="new-ticket-attendance">Taking part</label>
		<select id="new-ticket-attendance" name="attendance">
			{#each attendanceKinds as kind (kind)}<option value={kind}>{attendanceLabels[kind]}</option>{/each}
		</select>
	</div>
	<div class="field">
		<label for="new-ticket-capacity">Limit</label>
		<input type="text" inputmode="numeric" class="number" id="new-ticket-capacity" name="capacity" />
	</div>
	<input type="hidden" name="sort-order" value={data.tickets.length} />
	<button class="button" type="submit">Add the seat</button>
</form>

<h2>Speakers</h2>
{#each data.speakers as speaker (speaker.identifier)}
	<div class="speaker">
		<p><strong>{speaker.name}</strong>{speaker.about ? `, ${speaker.about}` : ''}{speaker.contributorSlug ? ' (links to their contributor page)' : ''}</p>
		<form method="post" action="?/removeSpeaker">
			<input type="hidden" name="speaker" value={speaker.identifier} />
			<button class="button button-quiet" type="submit">Remove<span class="visually-hidden"> {speaker.name}</span></button>
		</form>
	</div>
{/each}
<form method="post" action="?/saveSpeaker" class="panel">
	<div class="field">
		<label for="speaker-name">Speaker's name</label>
		<input type="text" id="speaker-name" name="name" maxlength="200" required />
	</div>
	<div class="field">
		<label for="speaker-about">About them</label>
		<p class="hint" id="speaker-about-hint">Such as "Chief Justice, Navajo Nation Supreme Court".</p>
		<input type="text" id="speaker-about" name="about" maxlength="300" aria-describedby="speaker-about-hint" />
	</div>
	<div class="field">
		<label for="speaker-contributor">Contributor page</label>
		<p class="hint" id="speaker-contributor-hint">If the speaker is credited on the website, their name links to their page.</p>
		<select id="speaker-contributor" name="contributor" aria-describedby="speaker-contributor-hint">
			<option value="">None</option>
			{#each data.contributors as contributor (contributor.slug)}<option value={contributor.slug}>{contributor.line}</option>{/each}
		</select>
	</div>
	<input type="hidden" name="sort-order" value={data.speakers.length} />
	<button class="button" type="submit">Add the speaker</button>
</form>

<h2>Video room</h2>
<p>
	The website’s own video room, with recording. When it is on, people registered for an online seat join it from the
	event’s page, after they are told whether it is recorded and who may watch the recording. It opens 30 minutes before
	the event starts. The people who run events are its hosts and can open it any time before then to check it works. Each
	room is its own meeting, so several events, and rooms made under Video rooms, can run at the same time.
</p>
{#if !data.roomReady}
	<div class="notice" role="note">
		<p>The video room is not switched on yet, so nobody can join it. You can still set it up here.</p>
	</div>
{/if}
<form method="post" action="?/saveRoom" class="panel">
	<fieldset>
		<legend>How the room works</legend>
		{#each roomStyles as style (style)}
			<div class="choice">
				<input
					type="radio"
					id="room-style-{style}"
					name="style"
					value={style}
					checked={(data.room?.style ?? data.suggestedStyle) === style}
				/>
				<label for="room-style-{style}">{roomStyleLabels[style]}</label>
			</div>
		{/each}
	</fieldset>
	<fieldset>
		<legend>Who may watch the recordings</legend>
		{#each eventRecordingWatchers as watchers (watchers)}
			<div class="choice">
				<input
					type="radio"
					id="room-watchers-{watchers}"
					name="watchers"
					value={watchers}
					checked={(data.room?.watchers ?? 'hosts') === watchers}
				/>
				<label for="room-watchers-{watchers}">{recordingWatcherLabels[watchers]}</label>
			</div>
		{/each}
		<p class="hint">Everyone is told this before they join. Whether the event is recorded at all is set under Details.</p>
	</fieldset>
	<button class="button" type="submit">{data.room ? 'Save the room' : 'Use the website’s video room'}</button>
</form>
{#if data.room}
	<p><a href="/events/{data.event.slug}/room" target="_blank" rel="noopener">Open the room<span class="visually-hidden"> (opens in a new tab)</span></a></p>
	{#if data.recordings.length === 0}
		<form method="post" action="?/removeRoom">
			<button class="button button-quiet" type="submit">Stop using the website’s video room</button>
		</form>
	{/if}
	<RoomRecords recordings={data.recordings} visitors={data.visitors} />
{/if}

<h2>Details</h2>
{#if problem && field}
	<div class="notice notice-problem" role="alert"><p>{problem}</p></div>
{/if}
{#if data.event.status !== 'draft'}
	<p class="hint">
		If you change the time or place, everyone signed up is emailed about it once, and calendars that added the event
		update.
	</p>
{/if}
<form method="post" action="?/save">
	<EventFields {values} invalid={field} {problem} />
	<p><button class="button" type="submit">Save the details</button></p>
</form>

<h2>Who is coming</h2>
{#if data.registrations.length === 0}
	<p class="muted">Nobody has registered yet.</p>
{:else}
	<p>
		{live.filter((registration) => registration.code === 'registered').length} registered,
		{live.filter((registration) => registration.code === 'waitlisted').length} waiting.
		<a class="button button-quiet" href="/workspace/events/{data.event.identifier}/registrations.csv">
			<Download size={20} strokeWidth={1.75} /> Download the list
		</a>
	</p>
	<p class="hint">Access needs are private to the people running events, and are deleted 30 days after the event.</p>
	<div class="table-scroll">
		<table>
			<thead>
				<tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Seat</th><th scope="col">Status</th><th scope="col">Access needs</th><th scope="col">Signed up</th></tr>
			</thead>
			<tbody>
				{#each data.registrations as registration (registration.identifier)}
					<tr>
						<td>{registration.name}</td>
						<td>{registration.email}</td>
						<td>{registration.ticketName}</td>
						<td>{registration.status}{registration.offerEnds ? `, until ${registration.offerEnds}` : ''}</td>
						<td>{registration.accessNeeds ?? ''}</td>
						<td>{registration.registeredAt}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.spaced {
		margin-top: var(--space-4);
	}

	.row-form {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-3);
		margin: var(--space-3) 0 0;
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-line);
	}

	.row-form .field {
		margin: 0;
	}

	.row-form.add {
		margin-bottom: var(--space-5);
	}

	.number {
		max-width: 6rem;
	}

	.counts {
		margin: 0 0 var(--space-2);
	}

	.remove {
		margin: var(--space-2) 0 0;
	}

	.speaker {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		border-top: 1px solid var(--color-line);
	}

	.button {
		gap: var(--space-2);
	}

	fieldset {
		margin: 0 0 var(--space-4);
		padding: 0;
		border: 0;
	}

	legend {
		margin-bottom: var(--space-2);
		font-weight: 600;
	}

	.choice {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.choice input {
		margin-top: 0.3em;
	}
</style>
