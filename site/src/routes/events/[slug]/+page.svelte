<script lang="ts">
	// An event's page (site/COLLABORATION.md, "Events").
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import Clock from '@lucide/svelte/icons/clock';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Video from '@lucide/svelte/icons/video';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const event = $derived(data.event);
	const values = $derived(form && 'values' in form ? form.values : undefined);
	const field = $derived(form && 'field' in form ? form.field : undefined);
	const signInLink = $derived(`/sign-in?returnTo=${encodeURIComponent(`/events/${data.event.slug}`)}`);
</script>

<svelte:head>
	<title>{event.title} · Events · Model Tribal ADR Code</title>
	{#if event.summary}<meta name="description" content={event.summary} />{/if}
	{#if event.status === 'draft'}<meta name="robots" content="noindex, nofollow" />{/if}
</svelte:head>

<div class="reading">
	<p class="breadcrumb"><a href="/events">Events</a></p>
	<h1>{event.title}</h1>

	{#if event.status === 'draft'}
		<div class="notice" role="note"><p>This is a draft. Only the people who run events can see it until it is published.</p></div>
	{:else if event.status === 'cancelled'}
		<div class="notice notice-problem" role="note">
			<p><strong>This event is cancelled.</strong>{#if event.cancelNote}{' '}{event.cancelNote}{/if}</p>
		</div>
	{/if}

	{#if event.summary}<p class="lead">{event.summary}</p>{/if}

	<dl class="facts">
		<div>
			<dt><Clock size={20} strokeWidth={1.75} /><span class="visually-hidden">When</span></dt>
			<dd>{event.when}</dd>
		</div>
		<div>
			<dt><MapPin size={20} strokeWidth={1.75} /><span class="visually-hidden">Where</span></dt>
			<dd>
				{event.where}
				{#if event.venueAddress}<span class="hint address">{event.venueAddress}</span>{/if}
			</dd>
		</div>
	</dl>
	<p><span class="chip">{event.kind}</span></p>

	<p class="calendar-links">
		<a class="button button-quiet" href="/events/{event.slug}/calendar.ics" download>
			<CalendarPlus size={20} strokeWidth={1.75} />
			Add to your calendar
		</a>
	</p>

	<section class="panel panel-filled" aria-labelledby="take-part">
		<h2 id="take-part">Take part</h2>

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
		{:else if data.tickets.length === 0}
			<p>No registration is needed. Everyone is welcome.</p>
			{#if data.onlineLink}
				<p><a class="button" href={data.onlineLink}><Video size={20} strokeWidth={1.75} /> Join online</a></p>
			{/if}
		{:else if data.mine?.status === 'registered'}
			<p><strong>You are registered:</strong> {data.mine.ticketName}.</p>
			{#if data.onlineLink}
				<p><a class="button" href={data.onlineLink}><Video size={20} strokeWidth={1.75} /> Join online</a></p>
				<p class="hint">This link is for you. Please do not post it.</p>
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
		{:else if !data.signedIn}
			<p>Sign in to register. Registering holds your seat and lets us tell you if anything changes.</p>
			<p><a class="button" href={signInLink}>Sign in to register</a></p>
		{:else}
			<form method="post" action="?/register">
				<fieldset class="choices">
					<legend>How will you take part?</legend>
					{#if field === 'ticket'}<p class="field-error" id="ticket-error">Choose how you will take part.</p>{/if}
					{#each data.tickets as ticket, index (ticket.identifier)}
						<div class="choice">
							<input
								type="radio"
								id="ticket-{ticket.identifier}"
								name="ticket"
								value={ticket.identifier}
								checked={index === 0}
								aria-describedby="ticket-{ticket.identifier}-seats"
							/>
							<label for="ticket-{ticket.identifier}">
								{ticket.name}
								<span class="hint" id="ticket-{ticket.identifier}-seats">
									{#if ticket.full}Full: you will join the waitlist{:else if ticket.seatsLeft !== null}{ticket.seatsLeft}
										{ticket.seatsLeft === 1 ? 'seat' : 'seats'} left{:else}Open{/if}
								</span>
							</label>
						</div>
					{/each}
				</fieldset>
				<div class="field">
					<label for="name">Your name</label>
					<p class="hint" id="name-hint">As it should appear on the list of people coming.</p>
					<input
						type="text"
						id="name"
						name="name"
						autocomplete="name"
						maxlength="200"
						required
						value={values?.name ?? ''}
						aria-describedby="name-hint"
						aria-invalid={field === 'name' ? 'true' : undefined}
					/>
				</div>
				<div class="field">
					<label for="access-needs">Anything you need to take part (optional)</label>
					<p class="hint" id="access-hint">
						Such as an interpreter, captions, step-free entry or a quiet space. Only the people running the event see
						this, and it is deleted 30 days after the event.
					</p>
					<textarea id="access-needs" name="access-needs" rows="3" maxlength="2000" aria-describedby="access-hint"
						>{values?.accessNeeds ?? ''}</textarea
					>
				</div>
				<div class="choice">
					<input type="checkbox" id="reminders" name="reminders" value="yes" checked />
					<label for="reminders">Email me a reminder the day before and shortly before it starts</label>
				</div>
				<p><button class="button" type="submit">Register</button></p>
				{#if event.closes}<p class="hint">Registration closes {event.closes}.</p>{/if}
			</form>
		{/if}
	</section>

	{#if data.speakers.length > 0}
		<h2>{data.speakers.length === 1 ? 'Speaker' : 'Speakers'}</h2>
		<ul class="speakers">
			{#each data.speakers as speaker (speaker.name)}
				<li>
					{#if speaker.page}<a href={speaker.page}>{speaker.name}</a>{:else}<strong>{speaker.name}</strong>{/if}
					{#if speaker.about}<span class="hint">{speaker.about}</span>{/if}
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

	<h2>Access</h2>
	{#each event.accessNotes as paragraph, index (index)}
		<p class="description">{paragraph}</p>
	{/each}
	<p>{event.recording}</p>
	<p class="small muted">
		To ask about access, or anything else about this event, <a href="/requests?kind=question&amp;record=events">write to the project</a>.
	</p>
</div>

<style>
	.breadcrumb {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-small);
	}

	.facts {
		margin: var(--space-4) 0;
	}

	.facts div {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		margin: var(--space-2) 0;
	}

	.facts dt {
		flex: none;
		padding-top: 0.15em;
		color: var(--color-ink-muted);
	}

	.facts dd {
		margin: 0;
	}

	.address {
		display: block;
		margin: 0;
	}

	.calendar-links .button,
	.panel .button {
		gap: var(--space-2);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin: var(--space-3) 0;
	}

	.choices {
		margin: 0 0 var(--space-4);
		padding: 0;
		border: 0;
	}

	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		margin: var(--space-2) 0 var(--space-4);
	}

	.choice input {
		margin-top: 0.3em;
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
		accent-color: var(--color-action);
	}

	.choice .hint {
		display: block;
		margin: 0;
	}

	.speakers {
		list-style: none;
		padding: 0;
	}

	.speakers li {
		margin: var(--space-3) 0;
	}

	.speakers .hint {
		display: block;
		margin: 0;
	}

	.description {
		white-space: pre-line;
	}
</style>
