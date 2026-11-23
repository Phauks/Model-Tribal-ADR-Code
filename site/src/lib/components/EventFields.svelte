<script lang="ts">
	// The fields of an event in the workspace (src/routes/workspace/events).
	import { eventKindLabels, eventKinds, eventTimeZones, recordingChoiceLabels, recordingChoices } from '#lib/event-calendar.ts';

	interface Values {
		title: string;
		slug: string;
		summary: string;
		description: string;
		kind: string;
		startDate: string;
		startTime: string;
		endDate: string;
		endTime: string;
		timeZone: string;
		venueName: string;
		venueAddress: string;
		onlineLink: string;
		recordingLink: string;
		recording: string;
		accessNotes: string;
		closesDate: string;
		closesTime: string;
	}

	let { values, invalid, problem }: { values: Values; invalid?: string; problem?: string } = $props();

	const bad = (name: string) => (invalid === name ? 'true' : undefined);
</script>

{#snippet error(name: string)}
	{#if invalid === name && problem}<p class="field-error" id="{name}-error">{problem}</p>{/if}
{/snippet}

<div class="field">
	<label for="title">Title</label>
	{@render error('title')}
	<input type="text" id="title" name="title" maxlength="200" required value={values.title} aria-invalid={bad('title')} />
</div>

<div class="field">
	<label for="slug">Address</label>
	<p class="hint" id="slug-hint">The end of the event's web address, /events/…. Leave it empty to make one from the title.</p>
	{@render error('slug')}
	<input type="text" id="slug" name="slug" maxlength="80" class="short" value={values.slug} aria-describedby="slug-hint" aria-invalid={bad('slug')} />
</div>

<div class="field">
	<label for="kind">Kind of event</label>
	{@render error('kind')}
	<select id="kind" name="kind" aria-invalid={bad('kind')}>
		{#each eventKinds as kind (kind)}
			<option value={kind} selected={values.kind === kind}>{eventKindLabels[kind]}</option>
		{/each}
	</select>
</div>

<div class="field">
	<label for="summary">Summary</label>
	<p class="hint" id="summary-hint">One or two sentences for the list of events.</p>
	<textarea id="summary" name="summary" rows="2" maxlength="400" aria-describedby="summary-hint">{values.summary}</textarea>
</div>

<div class="field">
	<label for="description">About this event</label>
	<p class="hint" id="description-hint">Plain text. Leave a blank line between paragraphs.</p>
	<textarea id="description" name="description" rows="8" maxlength="20000" aria-describedby="description-hint"
		>{values.description}</textarea
	>
</div>

<fieldset class="group">
	<legend>When</legend>
	<div class="field">
		<label for="time-zone">Time zone</label>
		<p class="hint" id="zone-hint">The zone where the event is held. The Navajo Nation keeps daylight saving time, so use Mountain there.</p>
		{@render error('timeZone')}
		<select id="time-zone" name="time-zone" aria-describedby="zone-hint" aria-invalid={bad('timeZone')}>
			{#each eventTimeZones as entry (entry.zone)}
				<option value={entry.zone} selected={values.timeZone === entry.zone}>{entry.label}</option>
			{/each}
		</select>
	</div>
	{@render error('startDate')}
	<div class="pair">
		<div class="field">
			<label for="start-date">Starts on</label>
			<input type="date" id="start-date" name="start-date" required value={values.startDate} aria-invalid={bad('startDate')} />
		</div>
		<div class="field">
			<label for="start-time">at</label>
			<input type="time" id="start-time" name="start-time" required value={values.startTime} aria-invalid={bad('startDate')} />
		</div>
	</div>
	{@render error('endTime')}
	<div class="pair">
		<div class="field">
			<label for="end-date">Ends on <span class="hint">(empty if the same day)</span></label>
			<input type="date" id="end-date" name="end-date" value={values.endDate} />
		</div>
		<div class="field">
			<label for="end-time">at</label>
			<input type="time" id="end-time" name="end-time" required value={values.endTime} aria-invalid={bad('endTime')} />
		</div>
	</div>
	{@render error('closesDate')}
	<div class="pair">
		<div class="field">
			<label for="closes-date">Registration closes on <span class="hint">(empty: when it starts)</span></label>
			<input type="date" id="closes-date" name="closes-date" value={values.closesDate} aria-invalid={bad('closesDate')} />
		</div>
		<div class="field">
			<label for="closes-time">at</label>
			<input type="time" id="closes-time" name="closes-time" value={values.closesTime} />
		</div>
	</div>
</fieldset>

<fieldset class="group">
	<legend>Where</legend>
	<div class="field">
		<label for="venue-name">Place, if in person</label>
		<input type="text" id="venue-name" name="venue-name" maxlength="200" value={values.venueName} />
	</div>
	<div class="field">
		<label for="venue-address">Address</label>
		<input type="text" id="venue-address" name="venue-address" maxlength="400" value={values.venueAddress} />
	</div>
	<div class="field">
		<label for="online-link">Link to join online</label>
		<p class="hint" id="online-hint">
			A Zoom, YouTube or other https link. Only people registered for an online seat see it, unless the event takes no
			registration.
		</p>
		{@render error('onlineLink')}
		<input type="url" id="online-link" name="online-link" maxlength="500" value={values.onlineLink} aria-describedby="online-hint" aria-invalid={bad('onlineLink')} />
	</div>
</fieldset>

<fieldset class="group">
	<legend>Access and recording</legend>
	<div class="field">
		<label for="access-notes">Access</label>
		<p class="hint" id="access-notes-hint">Captions, interpreters, step-free entry, parking, and the like.</p>
		<textarea id="access-notes" name="access-notes" rows="3" maxlength="2000" aria-describedby="access-notes-hint">{values.accessNotes}</textarea>
	</div>
	<div class="field">
		<label for="recording">Recording</label>
		{@render error('recording')}
		<select id="recording" name="recording" aria-invalid={bad('recording')}>
			{#each recordingChoices as choice (choice)}
				<option value={choice} selected={values.recording === choice}>{recordingChoiceLabels[choice]}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="recording-link">Link to the recording</label>
		<p class="hint" id="recording-link-hint">Shown on the event's page once it is over, such as a YouTube link.</p>
		{@render error('recordingLink')}
		<input type="url" id="recording-link" name="recording-link" maxlength="500" value={values.recordingLink} aria-describedby="recording-link-hint" aria-invalid={bad('recordingLink')} />
	</div>
</fieldset>

<style>
	.group {
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		padding: var(--space-3) var(--space-4);
		margin: 0 0 var(--space-5);
		max-width: var(--layout-measure);
	}

	.pair {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
	}

	.pair .field {
		margin-bottom: var(--space-3);
	}

	input[type='date'],
	input[type='time'],
	input[type='url'] {
		display: block;
		box-sizing: border-box;
		font: inherit;
		min-height: var(--layout-target-minimum);
		padding: var(--space-2);
		border: 2px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-paper);
		color: var(--color-ink);
	}

	input[type='url'] {
		width: 100%;
	}

	input[aria-invalid='true'] {
		border-color: var(--color-danger);
	}
</style>
