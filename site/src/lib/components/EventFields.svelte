<script lang="ts">
	// The fields of an event in the workspace (src/routes/workspace/events).
	import { eventKindLabels, eventKinds, eventTimeZones, recordingChoiceLabels, recordingChoices } from '#lib/event-calendar.ts';
	import DateField from '#lib/components/DateField.svelte';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import TimeField from '#lib/components/TimeField.svelte';

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
	const errorId = (name: string) => (invalid === name && problem ? `${name}-error` : undefined);

	const kindChoices = eventKinds.map((kind) => ({ value: kind as string, label: eventKindLabels[kind] }));
	const zoneChoices = eventTimeZones.map((entry) => ({ value: entry.zone as string, label: entry.label }));
	const recordingChoiceList = recordingChoices.map((choice) => ({ value: choice as string, label: recordingChoiceLabels[choice] }));
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
	<Dropdown label="Kind of event" id="kind" name="kind" choices={kindChoices} value={values.kind} invalid={Boolean(bad('kind'))} describedBy={errorId('kind')}>
		{#snippet message()}{@render error('kind')}{/snippet}
	</Dropdown>
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
		<Dropdown
			label="Time zone"
			id="time-zone"
			name="time-zone"
			choices={zoneChoices}
			value={values.timeZone}
			invalid={Boolean(bad('timeZone'))}
			describedBy={['zone-hint', errorId('timeZone')].filter(Boolean).join(' ')}
		>
			{#snippet message()}
				<p class="hint" id="zone-hint">The zone where the event is held. The Navajo Nation keeps daylight saving time, so use Mountain there.</p>
				{@render error('timeZone')}
			{/snippet}
		</Dropdown>
	</div>
	{@render error('startDate')}
	<div class="pair">
		<div class="field">
			<label for="start-date">Starts on</label>
			<DateField id="start-date" name="start-date" required value={values.startDate} invalid={invalid === 'startDate'} hint="" />
		</div>
		<div class="field">
			<label for="start-time">at</label>
			<TimeField id="start-time" name="start-time" required value={values.startTime} invalid={invalid === 'startDate'} />
		</div>
	</div>
	{@render error('endTime')}
	<div class="pair">
		<div class="field">
			<label for="end-date">Ends on <span class="hint">(empty if the same day)</span></label>
			<DateField id="end-date" name="end-date" value={values.endDate} hint="" />
		</div>
		<div class="field">
			<label for="end-time">at</label>
			<TimeField id="end-time" name="end-time" required value={values.endTime} invalid={invalid === 'endTime'} />
		</div>
	</div>
	{@render error('closesDate')}
	<div class="pair">
		<div class="field">
			<label for="closes-date">Registration closes on <span class="hint">(empty: when it starts)</span></label>
			<DateField id="closes-date" name="closes-date" value={values.closesDate} invalid={invalid === 'closesDate'} hint="" />
		</div>
		<div class="field">
			<label for="closes-time">at</label>
			<TimeField id="closes-time" name="closes-time" value={values.closesTime} />
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
		<Dropdown
			label="Recording"
			id="recording"
			name="recording"
			choices={recordingChoiceList}
			value={values.recording}
			invalid={Boolean(bad('recording'))}
			describedBy={errorId('recording')}
		>
			{#snippet message()}{@render error('recording')}{/snippet}
		</Dropdown>
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
