<script lang="ts">
	// An event's page (site/COLLABORATION.md, "Events").
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CopyHash from '#lib/components/CopyHash.svelte';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import Download from '@lucide/svelte/icons/download';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Video from '@lucide/svelte/icons/video';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const event = $derived(data.event);

</script>

<svelte:head>
	<title>{event.title} · Events · Tribal Law Project</title>
	{#if event.summary}<meta name="description" content={event.summary} />{/if}
	{#if event.status === 'draft'}<meta name="robots" content="noindex, nofollow" />{/if}
</svelte:head>

<div class="event-page">
	<Breadcrumbs trail={[{ label: 'Events', href: '/events' }]} />
	<h1>{event.title}</h1>
	<p class="meta">
		<span><CalendarDays size={20} strokeWidth={1.75} aria-hidden="true" /> {event.when}</span>
		<span><MapPin size={20} strokeWidth={1.75} aria-hidden="true" /> {event.where}{#if event.venueAddress}<span class="visually-hidden">, </span><span class="hint address">{event.venueAddress}</span>{/if}</span>
	</p>
	<p class="chips"><span class="chip chip-kind">{event.kind}</span></p>

	{#if event.status === 'draft'}
		<div class="notice" role="note"><p>This is a draft. Only the people who run events can see it until it is published.</p></div>
	{:else if event.status === 'cancelled'}
		<div class="notice notice-problem" role="note">
			<p><strong>This event is cancelled.</strong>{#if event.cancelNote}{' '}{event.cancelNote}{/if}</p>
		</div>
	{/if}

	<!-- The Register card is first, so on a phone it comes right after the title; on a wide screen it sits on the right (design/events-and-cle, "2-event-page" and "8-event-phone"). -->
	<div class="columns">
		<aside class="register panel" id="register" aria-labelledby="register-heading">
			<h2 id="register-heading">{data.tickets.length > 0 && !data.over && event.status !== 'cancelled' ? 'Register' : 'Take part'}</h2>
			{#if data.hostRoomLink}
				<p><a class="button button-quiet wide" href={data.hostRoomLink} target="_blank" rel="noopener"><Video size={20} strokeWidth={1.75} /> Open the room as a host<span class="visually-hidden"> (opens in a new tab)</span></a></p>
			{/if}
			{#if form && 'done' in form}
				<div class="notice" role="status"><p>{form.done}</p></div>
			{:else if form && 'problem' in form}
				<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
			{/if}

			{#if event.status === 'cancelled'}
				<p>This event will not take place.</p>
			{:else if data.over}
				<p>This event has ended.</p>
				{#if event.recordingLink}
					<p><a class="button" href={event.recordingLink}><Video size={20} strokeWidth={1.75} /> Watch the recording</a></p>
				{/if}
				{#each data.recordings as recording, index (recording.address)}
					{#if recording.ready}
						<p>
							<a class="button" href={recording.address}><Video size={20} strokeWidth={1.75} /> Watch the recording{data.recordings.length > 1 ? ` (part ${index + 1})` : ''}</a>
							{#if recording.length}<span class="hint">{recording.length}</span>{/if}
							{#if recording.hidden}<span class="chip">Hidden from everyone but the hosts</span>{/if}
						</p>
					{:else if recording.checking}
						<p class="hint">A recording is being saved and checked for viruses. It will be here soon.</p>
					{/if}
				{/each}
			{:else if data.tickets.length === 0}
				<p>No registration is needed. Everyone is welcome.</p>
				{#if data.onlineLink}
					<p><a class="button" href={data.onlineLink} target="_blank" rel="noopener"><Video size={20} strokeWidth={1.75} /> Join online<span class="visually-hidden"> (opens in a new tab)</span></a></p>
				{/if}
			{:else if data.mine?.status === 'registered'}
				<p><strong>You are registered:</strong> {data.mine.ticketName}.</p>
				{#if data.onlineLink}
					<p><a class="button" href={data.onlineLink} target="_blank" rel="noopener"><Video size={20} strokeWidth={1.75} /> Join online<span class="visually-hidden"> (opens in a new tab)</span></a></p>
					{#if !data.usesRoom}<p class="hint">This link is for you. Please do not post it.</p>{/if}
				{:else if data.mine.attendance === 'online'}
					<p class="hint">The link to join will be here before the event starts.</p>
				{/if}
				<form method="post" action="?/cancel">
					<input type="hidden" name="registration" value={data.mine.identifier} />
					<button class="button button-quiet" type="submit">Cancel my registration</button>
				</form>
				<p class="hint">If you can no longer come, cancelling gives your seat to the next person waiting.</p>
			{:else if data.mine?.status === 'offered'}
				<p><strong>A seat opened for you:</strong> {data.mine.ticketName}. It is held until {data.mine.offerEnds}.</p>
				<div class="actions">
					<form method="post" action="?/accept">
						<input type="hidden" name="registration" value={data.mine.identifier} />
						<button class="button" type="submit">Take the seat</button>
					</form>
					<form method="post" action="?/cancel">
						<input type="hidden" name="registration" value={data.mine.identifier} />
						<button class="button button-quiet" type="submit">No thanks</button>
					</form>
				</div>
			{:else if data.mine?.status === 'waitlisted'}
				<p>
					<strong>You are on the waitlist</strong> for {data.mine.ticketName}, number {data.mine.waitlistPlace} in line. If a
					seat opens, it is held for you for up to 48 hours and you will see it here.
				</p>
				<form method="post" action="?/cancel">
					<input type="hidden" name="registration" value={data.mine.identifier} />
					<button class="button button-quiet" type="submit">Leave the waitlist</button>
				</form>
			{:else if !data.open}
				<p>Registration is closed.</p>
			{:else}
				<form method="get" action="/events/{event.slug}/register">
					<fieldset class="tickets">
						<legend class="visually-hidden">How will you take part?</legend>
						{#each data.tickets as ticket, index (ticket.identifier)}
							<div class="ticket">
								<input type="radio" id="ticket-{ticket.identifier}" name="ticket" value={ticket.identifier} checked={index === 0} />
								<label for="ticket-{ticket.identifier}">
									<span class="ticket-name">{ticket.name}</span>
									<span class="ticket-note">Free</span>
									<span class="ticket-status {ticket.full ? 'is-full' : ticket.seatsLeft === null ? 'is-open' : ''}">
										{#if ticket.full}Full: waitlist{:else if ticket.seatsLeft !== null}{ticket.seatsLeft} left{:else}Open{/if}
									</span>
								</label>
							</div>
							{#if ticket.capacity !== null}
								<div class="seats-bar" aria-hidden="true"><span style:width="{Math.min(100, Math.round((ticket.taken / Math.max(1, ticket.capacity)) * 100))}%"></span></div>
								<p class="hint seats-words">{ticket.taken} of {ticket.capacity} {ticket.name.toLowerCase()} seats taken</p>
							{/if}
						{/each}
					</fieldset>
					<button class="button wide" type="submit">Continue</button>
					{#if !data.signedIn}<p class="hint">You will be asked to sign in first.</p>{/if}
					{#if event.closes}<p class="hint">Registration closes {event.closes}.</p>{/if}
				</form>
			{/if}
			<a class="button button-quiet wide" href="/events/{event.slug}/calendar.ics" download>
				<CalendarPlus size={20} strokeWidth={1.75} />
				Add to calendar
			</a>
		</aside>

		<div class="main">
			{#if event.summary}<p class="lead">{event.summary}</p>{/if}

			{#if data.sessions.length > 0}
				<h2>Sessions</h2>
				<ol class="sessions">
					{#each data.sessions as session (session.identifier)}
						<li>
							<p class="session-times">{session.times}</p>
							<div>
								<h3>{session.title}</h3>
								{#if session.about}<p>{session.about}</p>{/if}
							</div>
						</li>
					{/each}
				</ol>
			{/if}

			{#if data.speakers.length > 0}
				<h2>{data.speakers.length === 1 ? 'Speaker' : 'Speakers'}</h2>
				<ul class="speakers">
					{#each data.speakers as speaker (speaker.name)}
						<li>
							<span class="initials" aria-hidden="true">{speaker.initials}</span>
							<span>
								{#if speaker.page}<a href={speaker.page}>{speaker.name}</a>{:else}<strong>{speaker.name}</strong>{/if}
								{#if speaker.about}<span class="hint">{speaker.about}</span>{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}

			{#if event.paragraphs.length > 0}
				<h2>About this event</h2>
				{#each event.paragraphs as paragraph, index (index)}
					<p class="description">{paragraph}</p>
				{/each}
			{/if}

			{#if data.materials.length > 0}
				<h2>Materials</h2>
				<p class="materials">
					{#each data.materials as material (material.address)}
						{#if material.ready}
							<a class="button button-quiet" href={material.address} download>
								<Download size={20} strokeWidth={1.75} />
								{material.title} ({material.kind}, {material.size})
							</a>
						{:else}
							<span class="hint">{material.title} is being checked for viruses. It will be here soon.</span>
						{/if}
					{/each}
				</p>
				<details class="hashes">
					<summary>Check the files you downloaded</summary>
					<p class="small">Each file's SHA-256 fingerprint. <a href="/verify">Verify a file</a> to see that your copy matches.</p>
					<ul class="small">
						{#each data.materials.filter((material) => material.ready) as material (material.address)}
							<li>{material.title}: <CopyHash sha256={material.sha256} label={material.title} /></li>
						{/each}
					</ul>
				</details>
			{/if}

			<h2>Access</h2>
			{#each event.accessNotes as paragraph, index (index)}
				<p class="description">{paragraph}</p>
			{/each}
			<p>{event.recording}</p>
			<p class="small muted">
				To ask about access, or anything else about this event, <a href="/requests?kind=question&amp;record=events">write to the project</a>.
			</p>
		</div>
	</div>
</div>

<style>
	h1 {
		margin-bottom: var(--space-2);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-5);
		margin: 0 0 var(--space-2);
		color: var(--color-ink-muted);
	}

	.meta > span {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 var(--space-2);
	}

	.address {
		margin: 0;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0 0 var(--space-4);
	}

	.chip-kind {
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}

	/* Wide: the page and the Register card side by side, the card staying in view (design/events-and-cle, "2-event-page"). */
	.columns {
		display: grid;
		gap: var(--space-5);
		align-items: start;
	}

	@container page (min-width: 46rem) {
		.columns {
			grid-template-columns: minmax(0, 1fr) 19rem;
		}

		.register {
			grid-column: 2;
			grid-row: 1;
			position: sticky;
			top: var(--space-4);
		}

		.main {
			grid-column: 1;
			grid-row: 1;
		}
	}

	.register h2 {
		margin-top: 0;
	}

	.register .button,
	.materials .button {
		gap: var(--space-2);
	}

	.wide {
		display: flex;
		justify-content: center;
		width: 100%;
		box-sizing: border-box;
	}

	.register > .wide:last-child {
		margin-top: var(--space-3);
	}

	.tickets {
		margin: 0 0 var(--space-3);
		padding: 0;
		border: 0;
	}

	.ticket {
		position: relative;
		margin: 0 0 var(--space-2);
	}

	.ticket input {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
	}

	.ticket label {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0 var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-panel);
		cursor: pointer;
	}

	.ticket input:checked + label {
		border: 2px solid var(--color-action);
		background: var(--color-notice-background);
	}

	.ticket input:focus-visible + label {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: 2px;
	}

	.ticket-name {
		font-weight: var(--font-weight-semibold);
	}

	.ticket-note {
		grid-column: 1;
		color: var(--color-ink-muted);
	}

	.ticket-status {
		grid-column: 2;
		grid-row: 1 / span 2;
		align-self: center;
		font-size: var(--font-size-small);
	}

	.ticket-status.is-open {
		font-weight: var(--font-weight-semibold);
	}

	.ticket-status.is-full {
		color: var(--color-danger);
	}

	.seats-bar {
		height: 0.5rem;
		border-radius: var(--radius-control);
		background: var(--color-line);
		overflow: hidden;
	}

	.seats-bar span {
		display: block;
		height: 100%;
		background: var(--color-band);
	}

	.seats-words {
		margin: var(--space-1) 0 var(--space-3);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin: var(--space-3) 0;
	}

	.main > :global(h2:first-child),
	.main > .lead:first-child {
		margin-top: 0;
	}

	.sessions {
		list-style: none;
		margin: 0 0 var(--space-5);
		padding: 0;
	}

	.sessions li {
		display: grid;
		grid-template-columns: 11rem minmax(0, 1fr);
		gap: var(--space-1) var(--space-4);
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-line);
	}

	.sessions h3 {
		margin: 0;
		font-size: inherit;
	}

	.sessions p {
		margin: var(--space-1) 0 0;
	}

	.session-times {
		margin: 0;
		color: var(--color-ink-muted);
		font-variant-numeric: tabular-nums;
	}

	@container page (max-width: 36rem) {
		.sessions li {
			grid-template-columns: 6rem minmax(0, 1fr);
		}
	}

	.speakers {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: var(--space-3) var(--space-5);
		list-style: none;
		padding: 0;
	}

	.speakers li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.initials {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		background: var(--color-notice-background);
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}

	.speakers .hint {
		display: block;
		margin: 0;
	}

	.materials {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.description {
		white-space: pre-line;
	}
</style>
